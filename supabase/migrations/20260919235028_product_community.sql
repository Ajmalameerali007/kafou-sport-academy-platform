create table public.family_emergency_contacts(id uuid primary key default gen_random_uuid(),family_id uuid not null unique references public.families,name text not null,mobile text not null,relationship text not null,updated_at timestamptz not null default now());
create table private.guardian_offers(id uuid primary key default gen_random_uuid(),family_id uuid not null references public.families,invited_by uuid not null references public.profiles,user_id uuid not null references public.profiles,token_hash text not null unique,expires_at timestamptz not null,accepted_at timestamptz,revoked_at timestamptz);
alter table private.guardian_offers enable row level security;
-- Only new acceptances that actually insert a guardian may establish revocation authority.
-- Existing links and historical offers remain independent; deleting/replacing a link removes its origin.
create table private.guardian_link_origins(
 family_id uuid not null,user_id uuid not null,offer_id uuid not null unique references private.guardian_offers,
 primary key(family_id,user_id),foreign key(family_id,user_id) references public.guardians(family_id,user_id) on delete cascade
);
alter table private.guardian_link_origins enable row level security;
revoke all on private.guardian_link_origins from public,anon,authenticated;grant all on private.guardian_link_origins to service_role;
create table public.support_tickets(id uuid primary key default gen_random_uuid(),reference text not null unique default ('SUP-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,10))),family_id uuid not null references public.families,branch_id uuid not null references public.branches,child_id uuid references public.children,session_id uuid references public.class_sessions,invoice_id uuid references public.commercial_invoices,subject text not null,status text not null default 'open' check(status in ('open','in_progress','resolved')),opened_by uuid not null references public.profiles,assigned_to uuid references public.profiles,resolution text,created_at timestamptz not null default now());
create table public.support_messages(id uuid primary key default gen_random_uuid(),ticket_id uuid not null references public.support_tickets,author_id uuid not null references public.profiles,message text not null check(length(message) between 2 and 2000),created_at timestamptz not null default now());
create table public.shift_handovers(id uuid primary key default gen_random_uuid(),branch_id uuid not null references public.branches,title text not null,note text not null,assigned_to uuid references public.profiles,follow_up_at timestamptz,status text not null default 'open' check(status in ('open','resolved')),resolution text,created_by uuid not null references public.profiles,created_at timestamptz not null default now());
create table public.document_versions(id uuid primary key default gen_random_uuid(),title text not null,purpose text not null check(purpose in ('privacy','waiver','media','contact')),version text not null,body text not null,synthetic boolean not null default true,created_by uuid not null references public.profiles,created_at timestamptz not null default now(),unique(purpose,version));
create table public.document_acceptances(id uuid primary key default gen_random_uuid(),document_id uuid not null references public.document_versions,family_id uuid not null references public.families,guardian_id uuid not null references public.profiles,granted boolean not null,created_at timestamptz not null default now());
create table public.recognition_nominations(id uuid primary key default gen_random_uuid(),child_id uuid not null references public.children,branch_id uuid not null references public.branches,title text not null,evidence text not null,status text not null default 'submitted' check(status in ('submitted','approved','returned')),nominated_by uuid not null references public.profiles,reviewed_by uuid references public.profiles,review_reason text,created_at timestamptz not null default now());
create function private.ticket_access(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.support_tickets t where t.id=p_id and (private.family_owner(t.family_id) or private.operations_staff(t.branch_id))) $$;
create function private.community_command(p_action text,p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare rid uuid;f uuid;b uuid;ticket public.support_tickets;offer private.guardian_offers;token text;d public.document_versions;nom public.recognition_nominations;begin
 perform private.require_access(private.active() and private.mfa_ready());
 case p_action
 when 'community.notification.read' then
 update public.notifications set read_at=coalesce(read_at,now()) where id=(p_data->>'id')::uuid and recipient_id=auth.uid() and exists(select 1 from public.product_events e where e.id=event_id and private.family_owner(e.family_id)) returning id into rid;
 when 'community.contact.save' then
 f:=(p_data->>'family_id')::uuid;perform private.require_access(private.family_owner(f));
 insert into public.family_emergency_contacts(family_id,name,mobile,relationship) values(f,p_data->>'name',p_data->>'mobile',p_data->>'relationship') on conflict(family_id) do update set name=excluded.name,mobile=excluded.mobile,relationship=excluded.relationship,updated_at=now() returning id into rid;
 when 'community.ticket.open' then
 f:=(p_data->>'family_id')::uuid;b:=(p_data->>'branch_id')::uuid;perform private.require_access(private.family_owner(f) or (private.operations_staff(b) and private.family_access(f)));
 if not exists(select 1 from public.branches where id=b and active) or (p_data ? 'child_id' and not exists(select 1 from public.children where id=(p_data->>'child_id')::uuid and family_id=f)) then raise exception 'Context not authorized' using errcode='42501';end if;
 if p_data ? 'session_id' and not exists(select 1 from public.session_roster r join public.enrollments e on e.id=r.enrollment_id join public.children k on k.id=e.child_id join public.class_sessions s on s.id=r.session_id join public.academy_classes c on c.id=s.class_id where s.id=(p_data->>'session_id')::uuid and k.family_id=f and c.branch_id=b) then raise exception 'Session not authorized' using errcode='42501';end if;
 if p_data ? 'invoice_id' and not exists(select 1 from public.commercial_invoices where id=(p_data->>'invoice_id')::uuid and family_id=f and branch_id=b) then raise exception 'Invoice not authorized' using errcode='42501';end if;
 insert into public.support_tickets(family_id,branch_id,child_id,session_id,invoice_id,subject,opened_by) values(f,b,nullif(p_data->>'child_id','')::uuid,nullif(p_data->>'session_id','')::uuid,nullif(p_data->>'invoice_id','')::uuid,p_data->>'subject',auth.uid()) returning id into rid;
 insert into public.support_messages(ticket_id,author_id,message) values(rid,auth.uid(),p_data->>'message');
 when 'community.ticket.reply' then
 select * into ticket from public.support_tickets where id=(p_data->>'id')::uuid;perform private.require_access(private.ticket_access(ticket.id));
 if ticket.status='resolved' then raise exception 'Ticket resolved' using errcode='P0409';end if;
 insert into public.support_messages(ticket_id,author_id,message) values(ticket.id,auth.uid(),p_data->>'message') returning id into rid;
 perform private.emit_product_event('support.reply',rid,ticket.family_id,ticket.branch_id,'Support response','There is a new message in your support conversation.','/parent?view=Support');
 when 'community.ticket.resolve' then
 select * into ticket from public.support_tickets where id=(p_data->>'id')::uuid;perform private.require_access(private.ticket_access(ticket.id));update public.support_tickets set status='resolved',resolution=p_data->>'resolution' where id=ticket.id returning id into rid;
 when 'community.ticket.assign' then
 select * into ticket from public.support_tickets where id=(p_data->>'id')::uuid;perform private.require_access(private.operations_staff(ticket.branch_id));
 if ticket.status='resolved' then raise exception 'Resolved conversation cannot be assigned' using errcode='P0409';end if;
 if not exists(select 1 from public.profiles p join public.role_assignments r on r.user_id=p.id where p.id=(p_data->>'user_id')::uuid and p.active and (r.role in ('admin','super_admin') or (r.role='branch' and exists(select 1 from public.branch_permissions bp where bp.user_id=p.id and bp.branch_id=ticket.branch_id)))) then raise exception 'Invalid assignee' using errcode='42501';end if;
 update public.support_tickets set assigned_to=(p_data->>'user_id')::uuid,status='in_progress' where id=ticket.id returning id into rid;
 when 'community.guardian.invite' then
 f:=(p_data->>'family_id')::uuid;perform private.require_access(private.family_owner(f));
 if (p_data->>'user_id')::uuid=auth.uid() or not exists(select 1 from public.profiles p join auth.users u on u.id=p.id join public.role_assignments r on r.user_id=p.id where p.id=(p_data->>'user_id')::uuid and p.active and u.email_confirmed_at is not null and r.role='parent') then raise exception 'Verified parent account required' using errcode='42501';end if;
 if exists(select 1 from public.guardians where family_id=f and user_id=(p_data->>'user_id')::uuid) then raise exception 'Guardian already has family access' using errcode='P0409';end if;
 token:=encode(extensions.gen_random_bytes(24),'hex');insert into private.guardian_offers(family_id,invited_by,user_id,token_hash,expires_at) values(f,auth.uid(),(p_data->>'user_id')::uuid,md5(token),now()+interval '24 hours') returning id into rid;
 return jsonb_build_object('id',rid,'token',token,'expiresInHours',24);
 when 'community.guardian.accept' then
 select * into offer from private.guardian_offers where token_hash=md5(p_data->>'token') for update;perform private.require_access(offer.user_id=auth.uid() and private.has_role(array['parent']::public.academy_role[]));
 if offer.expires_at<now() or offer.revoked_at is not null or not exists(select 1 from public.guardians g join public.profiles p on p.id=g.user_id join public.role_assignments r on r.user_id=p.id where g.family_id=offer.family_id and g.user_id=offer.invited_by and p.active and r.role='parent') or not exists(select 1 from auth.users where id=auth.uid() and email_confirmed_at is not null) then raise exception 'Offer unavailable' using errcode='P0409';end if;
 if offer.accepted_at is not null then
 if exists(select 1 from private.guardian_link_origins where family_id=offer.family_id and user_id=auth.uid() and offer_id=offer.id) then return jsonb_build_object('id',offer.id,'unchanged',true);end if;
 raise exception 'Offer no longer owns this family access' using errcode='P0409';end if;
 if exists(select 1 from public.guardians where family_id=offer.family_id and user_id=auth.uid()) then raise exception 'Guardian already has independently granted family access' using errcode='P0409';end if;
 insert into public.guardians values(offer.family_id,auth.uid());
 insert into private.guardian_link_origins(family_id,user_id,offer_id) values(offer.family_id,auth.uid(),offer.id);
 update private.guardian_offers set accepted_at=now() where id=offer.id;rid:=offer.id;
 when 'community.guardian.revoke' then
 f:=(p_data->>'family_id')::uuid;perform private.require_access(private.family_owner(f));
 if not exists(select 1 from private.guardian_offers where family_id=f and invited_by=auth.uid() and user_id=(p_data->>'user_id')::uuid) then raise exception 'Only your invited guardian can be revoked here' using errcode='42501';end if;
 if exists(select 1 from private.guardian_link_origins o join private.guardian_offers v on v.id=o.offer_id where o.family_id=f and o.user_id=(p_data->>'user_id')::uuid and v.invited_by=auth.uid()) then
 delete from public.guardians where family_id=f and user_id=(p_data->>'user_id')::uuid;
 update private.guardian_offers set revoked_at=coalesce(revoked_at,now()) where family_id=f and user_id=(p_data->>'user_id')::uuid;
 return jsonb_build_object('id',f,'access_removed',true);
 end if;
 if exists(select 1 from public.guardians where family_id=f and user_id=(p_data->>'user_id')::uuid) and not exists(select 1 from private.guardian_offers where family_id=f and invited_by=auth.uid() and user_id=(p_data->>'user_id')::uuid and accepted_at is null and revoked_at is null) then raise exception 'Only access created by your invitation can be removed' using errcode='42501';end if;
 update private.guardian_offers set revoked_at=coalesce(revoked_at,now()) where family_id=f and invited_by=auth.uid() and user_id=(p_data->>'user_id')::uuid;
 return jsonb_build_object('id',f,'access_removed',false);
 when 'community.handover.create' then
 b:=(p_data->>'branch_id')::uuid;perform private.require_access(private.operations_staff(b));
 if nullif(p_data->>'assigned_to','') is not null and not exists(select 1 from public.branch_permissions bp join public.profiles p on p.id=bp.user_id join public.role_assignments r on r.user_id=p.id where bp.branch_id=b and p.id=(p_data->>'assigned_to')::uuid and p.active and r.role='branch') then raise exception 'Branch assignee required' using errcode='42501';end if;
 insert into public.shift_handovers(branch_id,title,note,assigned_to,follow_up_at,created_by) values(b,p_data->>'title',p_data->>'note',nullif(p_data->>'assigned_to','')::uuid,nullif(p_data->>'follow_up_at','')::timestamptz,auth.uid()) returning id into rid;
 when 'community.handover.close' then
 select branch_id into b from public.shift_handovers where id=(p_data->>'id')::uuid;perform private.require_access(private.operations_staff(b));update public.shift_handovers set status='resolved',resolution=p_data->>'resolution' where id=(p_data->>'id')::uuid returning id into rid;
 when 'community.document.create' then
 perform private.require_access(private.super_admin());insert into public.document_versions(title,purpose,version,body,created_by) values(p_data->>'title',p_data->>'purpose',p_data->>'version',p_data->>'body',auth.uid()) returning id into rid;
 when 'community.document.accept' then
 f:=(p_data->>'family_id')::uuid;perform private.require_access(private.family_owner(f));select * into d from public.document_versions where id=(p_data->>'id')::uuid;
 insert into public.document_acceptances(document_id,family_id,guardian_id,granted) values(d.id,f,auth.uid(),(p_data->>'granted')::boolean) returning id into rid;
 if d.purpose in ('privacy','contact','media') then insert into public.consent_records(family_id,actor_id,kind,version,granted,created_at) values(f,auth.uid(),d.purpose,'document:'||d.id::text||':'||d.version,(p_data->>'granted')::boolean,clock_timestamp());end if;
 when 'community.recognition.nominate' then
 b:=(p_data->>'branch_id')::uuid;select family_id into f from public.children where id=(p_data->>'child_id')::uuid;
 perform private.require_access((private.operations_staff(b) and exists(select 1 from public.enrollments n join public.academy_classes c on c.id=n.class_id where n.child_id=(p_data->>'child_id')::uuid and c.branch_id=b and n.status='active')) or exists(select 1 from public.enrollments n join public.academy_classes c on c.id=n.class_id join public.class_sessions s on s.class_id=c.id where n.child_id=(p_data->>'child_id')::uuid and c.branch_id=b and n.status='active' and private.development_coach_session(s.id)));
 insert into public.recognition_nominations(child_id,branch_id,title,evidence,nominated_by) values((p_data->>'child_id')::uuid,b,p_data->>'title',p_data->>'evidence',auth.uid()) returning id into rid;
 when 'community.recognition.review' then
 select * into nom from public.recognition_nominations where id=(p_data->>'id')::uuid for update;perform private.require_access(private.head_office());if nom.status<>'submitted' or nom.nominated_by=auth.uid() or p_data->>'decision' not in ('approved','returned') then raise exception 'Independent review required' using errcode='P0409';end if;
 update public.recognition_nominations set status=p_data->>'decision',reviewed_by=auth.uid(),review_reason=p_data->>'reason' where id=nom.id;rid:=nom.id;
 if p_data->>'decision'='approved' then perform private.emit_product_event('recognition.approved',rid,(select family_id from public.children where id=nom.child_id),nom.branch_id,'Recognition approved',nom.title,'/parent?view=Progress');end if;
 else raise exception 'Unknown community command' using errcode='22023';end case;
 if rid is null then raise exception 'Record not found' using errcode='P0002';end if;return jsonb_build_object('id',rid);
end $$;
revoke all on function private.community_command(text,jsonb),private.ticket_access(uuid) from public,anon,authenticated;grant execute on function private.ticket_access(uuid) to authenticated,service_role;
do $$declare t text;begin foreach t in array array['family_emergency_contacts','support_tickets','support_messages','shift_handovers','document_versions','document_acceptances','recognition_nominations'] loop execute format('alter table public.%I enable row level security',t);execute format('revoke all on public.%I from anon,authenticated',t);execute format('grant select on public.%I to authenticated',t);execute format('grant all on public.%I to service_role',t);execute format('create trigger product_audit after insert or update or delete on public.%I for each row execute function private.product_audit()',t);end loop;end $$;
create policy emergency_read on public.family_emergency_contacts for select to authenticated using(private.family_access(family_id));
create policy ticket_read on public.support_tickets for select to authenticated using(private.ticket_access(id));
create policy message_read on public.support_messages for select to authenticated using(private.ticket_access(ticket_id));
create policy handover_read on public.shift_handovers for select to authenticated using(private.operations_staff(branch_id));
create policy document_read on public.document_versions for select to authenticated using(private.active() and private.mfa_ready());
create policy acceptance_read on public.document_acceptances for select to authenticated using(private.family_access(family_id));
create policy recognition_read on public.recognition_nominations for select to authenticated using(private.operations_staff(branch_id) or (nominated_by=auth.uid() and private.has_role(array['coach']::public.academy_role[]) and exists(select 1 from public.enrollments n join public.class_sessions s on s.class_id=n.class_id where n.child_id=recognition_nominations.child_id and n.status='active' and private.development_coach_session(s.id))) or (status='approved' and exists(select 1 from public.children c where c.id=child_id and private.family_owner(c.family_id))));
