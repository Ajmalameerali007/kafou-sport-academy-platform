-- Corrections append new decisions and certificate versions; published evidence remains immutable.
create table public.development_level_reversals(
 id uuid primary key default gen_random_uuid(),history_id uuid not null unique references public.development_level_history,
 reversed_by uuid not null references public.profiles,reason text not null check(length(trim(reason)) between 3 and 3000),
 reversed_at timestamptz not null default now()
);
create index development_reversal_actor on public.development_level_reversals(reversed_by);
alter table public.development_level_reversals enable row level security;
revoke all on public.development_level_reversals from anon,authenticated;
grant select on public.development_level_reversals to authenticated;grant all on public.development_level_reversals to service_role;
create policy development_reversal_read on public.development_level_reversals for select to authenticated using(exists(select 1 from public.development_level_history h where h.id=history_id));
create trigger development_reversal_immutable before update or delete on public.development_level_reversals for each row execute function private.immutable_record();
create trigger development_reversal_audit after insert on public.development_level_reversals for each row execute function private.product_audit();
alter table public.development_certificates drop constraint development_certificates_assessment_id_key;
alter table public.development_certificates add column version int not null default 1 check(version>0),add column reissue_reason text not null default '',add column replaces_id uuid unique references public.development_certificates,add constraint development_certificate_version unique(assessment_id,version),add constraint development_certificate_reissue_reason check((version=1 and reissue_reason='') or (version>1 and length(trim(reissue_reason)) between 3 and 3000));
-- This history projection intentionally includes revoked snapshots. Base certificate RLS continues to deny their PDF downloads.
create function private.development_certificate_record_rows() returns table(
 id uuid,assessment_id uuid,child_id uuid,reference text,recipient_name text,sport public.sport_id,level_name text,title text,issued_at timestamptz,version int,replaces_id uuid,revoked_at timestamptz,revocation_reason text,branch_id uuid,reissue_reason text
) language sql stable security definer set search_path='' as $$
select c.id,c.assessment_id,c.child_id,c.reference,c.recipient_name,c.sport,c.level_name,c.title,c.issued_at,c.version,c.replaces_id,r.revoked_at,r.reason revocation_reason,cls.branch_id,c.reissue_reason
 from public.development_certificates c join public.development_assessments a on a.id=c.assessment_id join public.class_sessions ss on ss.id=a.session_id join public.academy_classes cls on cls.id=ss.class_id left join public.development_certificate_revocations r on r.certificate_id=c.id
 where private.development_assessment_access(c.assessment_id)
$$;
revoke all on function private.development_certificate_record_rows() from public,anon;grant execute on function private.development_certificate_record_rows() to authenticated,service_role;
create view public.development_certificate_records with(security_invoker=true,security_barrier=true) as select * from private.development_certificate_record_rows();
revoke all on public.development_certificate_records from anon,authenticated;grant select on public.development_certificate_records to authenticated,service_role;
alter function private.development_command(text,jsonb) rename to development_original_command;
create function private.development_command(p_action text,p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.development_assessments;h public.development_level_history;c public.development_certificates;cls public.academy_classes;cr public.development_criteria;lev public.sport_levels;rid uuid;cid uuid;current_level uuid;fid uuid;next_version int;v_reason text;begin
 if p_action not in ('development.certificate.issue','development.certificate.reissue','development.level.reverse') then return private.development_original_command(p_action,p_data);end if;
 perform private.require_access(private.active() and private.mfa_ready());
 perform pg_advisory_xact_lock(hashtextextended('kafou-operational-writes',0));
 v_reason:=trim(coalesce(p_data->>'reason',''));
 if p_action='development.level.reverse' then
 select * into h from public.development_level_history where id=(p_data->>'id')::uuid;
 select * into a from public.development_assessments where id=h.assessment_id;
 else
 if p_action='development.certificate.reissue' then
 select * into c from public.development_certificates where id=(p_data->>'id')::uuid;
 select * into a from public.development_assessments where id=c.assessment_id;
 else select * into a from public.development_assessments where id=(p_data->>'assessment_id')::uuid;end if;
 end if;
 select * into cls from public.academy_classes where id=(select s.class_id from public.class_sessions s where s.id=a.session_id);
 perform private.require_access(a.id is not null and private.head_office() and private.product_can(case when p_action='development.level.reverse' then 'development.review' else 'development.certify' end,cls.branch_id));
 select * into cr from public.development_criteria where id=a.criteria_id;
 if a.status<>'published' then raise exception 'Published evidence required' using errcode='P0409';end if;
 select family_id into fid from public.children where id=a.child_id;
 if p_action='development.level.reverse' then
 perform private.require_access(auth.uid()<>a.author_id);
 if length(v_reason) not between 3 and 3000 then raise exception 'Family-facing reversal reason required' using errcode='22023';end if;
 select id into rid from public.development_level_reversals where history_id=h.id;
 if rid is not null then return jsonb_build_object('id',rid);end if;
 select level_id into current_level from public.child_sports where child_id=h.child_id and sport=h.sport for update;
 if current_level is distinct from h.to_level_id or exists(select 1 from public.development_level_history later where later.child_id=h.child_id and later.sport=h.sport and later.created_at>h.created_at and not exists(select 1 from public.development_level_reversals x where x.history_id=later.id)) then raise exception 'Reverse the latest effective progression first' using errcode='P0409';end if;
 select * into lev from public.sport_levels where id=h.from_level_id and sport=h.sport and active;
 if lev.id is null then raise exception 'Previous sport level must be active' using errcode='P0409';end if;
 insert into public.development_level_reversals(history_id,reversed_by,reason) values(h.id,auth.uid(),v_reason) returning id into rid;
 update public.child_sports set level_id=lev.id,level=lev.name,status='reviewed' where child_id=h.child_id and sport=h.sport;
 insert into public.development_certificate_revocations(certificate_id,revoked_by,reason) select cc.id,auth.uid(),left('Progression reversed: '||v_reason,3000) from public.development_certificates cc where cc.assessment_id=a.id on conflict(certificate_id) do nothing;
 perform private.emit_product_event('development.level.reversed',rid,fid,cls.branch_id,'Sport level correction','An approved sport level correction is available in your child journey. Related certificates are withdrawn; class arrangements are unchanged.','/parent?view=Progress');
 else
 if length(trim(coalesce(p_data->>'title',''))) not between 2 and 120 then raise exception 'Certificate title required' using errcode='22023';end if;
 if p_action='development.certificate.reissue' then
 if length(v_reason) not between 3 and 3000 then raise exception 'Family-facing reissue reason required' using errcode='22023';end if;
 if exists(select 1 from public.development_certificates where replaces_id=c.id) then raise exception 'Certificate already replaced; select its latest version' using errcode='P0409';end if;
 insert into public.development_certificate_revocations(certificate_id,revoked_by,reason) values(c.id,auth.uid(),v_reason) on conflict(certificate_id) do nothing;
 next_version:=c.version+1;cid:=c.id;
 else
 if exists(select 1 from public.development_certificates where assessment_id=a.id) then raise exception 'Certificate already issued; use reissue with its history' using errcode='P0409';end if;
 next_version:=1;
 end if;
 select * into lev from public.sport_levels where id=coalesce((select hh.to_level_id from public.development_level_history hh where hh.assessment_id=a.id and not exists(select 1 from public.development_level_reversals rv where rv.history_id=hh.id)),cr.level_id);
 insert into public.development_certificates(assessment_id,child_id,recipient_name,sport,level_name,title,issued_by,version,replaces_id,reissue_reason)
 select a.id,a.child_id,k.name,cr.sport,lev.name,trim(p_data->>'title'),auth.uid(),next_version,cid,case when next_version>1 then v_reason else '' end from public.children k where k.id=a.child_id returning id into rid;
 perform private.emit_product_event('development.certificate.issued',rid,fid,cls.branch_id,'Achievement certificate available','Your reviewed achievement certificate is ready for private download. Earlier replaced versions remain in the history.','/parent?view=Progress');
 end if;
 return jsonb_build_object('id',rid);
end $$;
revoke all on function private.development_command(text,jsonb),private.development_original_command(text,jsonb) from public,anon,authenticated;
