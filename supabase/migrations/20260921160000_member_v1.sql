-- Additive native member adapter. Reads run with authenticated RLS, never service role.
create function public.member_v1_read(p_resource text,p_child uuid default null,p_offset int default 0,p_limit int default 50) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare ctx jsonb; query text; rows jsonb; begin
 ctx:=public.account_context();
 if ctx is null or ctx->>'active'<>'true' or ctx->'roles'<>'["parent"]'::jsonb then raise exception 'Parent access required' using errcode='42501';end if;
 if p_offset<0 or p_offset>100000 or p_limit<1 or p_limit>100 then raise exception 'Invalid page' using errcode='22023';end if;
 if p_child is not null and not exists(select 1 from public.children c join public.guardians g on g.family_id=c.family_id where c.id=p_child and g.user_id=auth.uid()) then raise exception 'Child access revoked' using errcode='42501';end if;
 case p_resource
 when 'families' then query:=$q$select f.id,f.name title,f.mobile detail,f.email status,f.id family_id,
 (select coalesce(jsonb_agg(fb.branch_id),'[]') from public.family_branches fb where fb.family_id=f.id) branch_ids,
 '[{"action":"family.update","data":{}}]'::jsonb actions from public.families f where exists(select 1 from public.guardians g where g.family_id=f.id and g.user_id=auth.uid())$q$;
 when 'children' then query:=$q$select c.id,c.name title,c.family_id,c.dob::text date,c.reported_age age,c.synthetic,
 coalesce((select jsonb_agg(jsonb_build_object('sport',s.sport,'level',l.name,'level_ar',l.name_ar)) from public.child_sports s left join public.sport_levels l on l.id=s.level_id where s.child_id=c.id),'[]') sports
 from public.children c where ($1 is null or c.id=$1) and exists(select 1 from public.guardians g where g.family_id=c.family_id and g.user_id=auth.uid())$q$;
 when 'sessions' then query:=$q$select r.id,s.id session_id,c.name title,v.name detail,c.sport,c.branch_id,coalesce(n.child_id,q.child_id) child_id,s.starts_at,s.ends_at,s.status,
 case when s.finalized_at is not null then r.attendance else null end attendance,r.kind session_kind,r.cancelled,
 case when s.starts_at>now() and s.status='scheduled' and not r.cancelled and r.makeup_booking_id is not null then jsonb_build_array(jsonb_build_object('action','academy.makeup.cancel','data',jsonb_build_object('id',r.makeup_booking_id)))
 when s.starts_at>now() and s.status='scheduled' and not r.cancelled and tb.status='booked' then jsonb_build_array(jsonb_build_object('action','trial.cancel','data',jsonb_build_object('id',tb.id))) else '[]'::jsonb end actions
 from public.session_roster r join public.class_sessions s on s.id=r.session_id join public.academy_classes c on c.id=s.class_id left join public.venues v on v.id=c.venue_id
 left join public.enrollments n on n.id=r.enrollment_id left join public.trial_bookings tb on tb.id=r.trial_booking_id left join public.trial_enquiries q on q.id=tb.enquiry_id
 where ($1 is null or coalesce(n.child_id,q.child_id)=$1)$q$;
 when 'progress' then query:=$q$select a.id,'assessment' kind,a.child_id,'Coach feedback' title,a.summary detail,a.status,a.published_at starts_at from public.development_assessments a where a.status='published' and ($1 is null or a.child_id=$1)$q$;
 when 'levels' then query:=$q$select c.id,c.child_id,c.sport,l.name title,l.name_ar title_ar,c.status from public.child_sports c left join public.sport_levels l on l.id=c.level_id where ($1 is null or c.child_id=$1)$q$;
 when 'memberships' then query:=$q$select m.id,m.child_id,m.family_id,m.branch_id,m.sport,p.name title,p.name_ar title_ar,p.terms detail,p.terms_ar detail_ar,m.status,m.starts_on::text date,m.expires_on::text expires_on,p.price_minor amount_minor,p.currency,p.session_allowance,
 coalesce((select sum(available_delta) from public.entitlement_ledger e where e.membership_id=m.id),0) available,
 coalesce((select sum(reserved_delta) from public.entitlement_ledger e where e.membership_id=m.id),0) reserved,
 coalesce((select sum(consumed_delta) from public.entitlement_ledger e where e.membership_id=m.id),0) consumed,
 case when p.active and m.expires_on>=(now() at time zone 'Asia/Dubai')::date and not exists(select 1 from public.commercial_memberships next where next.renewed_from=m.id) then jsonb_build_array(jsonb_build_object('action','commercial.membership.renew','data',jsonb_build_object('id',m.id,'accepted',true))) else '[]'::jsonb end actions
 from public.commercial_memberships m join public.commercial_packages p on p.id=m.package_id where ($1 is null or m.child_id=$1)$q$;
 when 'notifications' then query:=$q$select n.id,n.title,n.body detail,n.created_at starts_at,case when n.read_at is null then 'unread' else 'read' end status,
 case when n.read_at is null then jsonb_build_array(jsonb_build_object('action','community.notification.read','data',jsonb_build_object('id',n.id))) else '[]'::jsonb end actions from public.notifications n where n.recipient_id=auth.uid()$q$;
 when 'documents' then query:=$q$select id,child_id,title,level_name detail,'certificate' kind,issued_at starts_at,'documents/certificate/'||id document_path from public.development_certificates where ($1 is null or child_id=$1)
 union all select id,child_id,'Progress report',summary,'report',published_at,'documents/report/'||id from public.development_reports where status='published' and ($1 is null or child_id=$1)
 union all select id,child_id,name,mime_type,'file',created_at,'documents/file/'||id from public.family_files where status='ready' and ($1 is null or child_id=$1 or child_id is null)$q$;
 when 'credits' then query:=$q$select id,child_id,branch_id,sport,'Make-up credit' title,expires_at starts_at,status,enrollment_id from public.makeup_credits where ($1 is null or child_id=$1)$q$;
 when 'waitlist-options' then query:=$q$select * from public.member_v1_waitlist($1)$q$;
 when 'waitlist' then query:=$q$select w.id,w.child_id,c.name title,w.status,w.offered_until starts_at,
 case when w.status='offered' and w.offered_until>now() then jsonb_build_array(jsonb_build_object('action','academy.waitlist.accept','data',jsonb_build_object('id',w.id))) else '[]'::jsonb end actions
 from public.waitlist_entries w join public.class_sessions s on s.id=w.session_id join public.academy_classes c on c.id=s.class_id where ($1 is null or w.child_id=$1)$q$;
 when 'invoices' then query:=$q$select i.id,i.family_id,i.reference title,i.currency,i.created_at starts_at,
 coalesce((select sum(l.quantity::bigint*l.unit_minor) from public.commercial_invoice_lines l where l.invoice_id=i.id),0)-coalesce((select sum(a.amount_minor) from public.commercial_allocations a where a.invoice_id=i.id),0)-coalesce((select sum(a.amount_minor) from public.commercial_adjustments a where a.invoice_id=i.id),0) amount_minor
 from public.commercial_invoices i$q$;
 when 'receipts' then query:=$q$select r.id,p.family_id,r.reference title,p.method detail,p.amount_minor,p.currency,r.created_at starts_at,'documents/receipt/'||r.id document_path from public.commercial_receipts r join public.commercial_payments p on p.id=r.payment_id$q$;
 when 'support' then query:=$q$select t.id,t.family_id,t.branch_id,t.child_id,t.subject title,t.status,t.created_at starts_at,
 coalesce((select string_agg(m.message,E'\n\n' order by m.created_at) from public.support_messages m where m.ticket_id=t.id),'') detail
 from public.support_tickets t where ($1 is null or t.child_id=$1 or t.child_id is null)$q$;
 when 'consents' then query:=$q$select id,title,body detail,purpose status,version from public.document_versions$q$;
 when 'events' then query:=$q$select e.id,e.title,e.sport,e.branch_id,e.starts_at,e.ends_at,e.status,e.document_id, (select body from public.document_versions where id=e.document_id) detail,public.member_v1_actions('events',e.id,$1) actions,
 coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'batch_id',r.batch_id,'child_id',r.child_id,'status',r.status)) from public.event_registrations r where r.event_id=e.id and ($1 is null or r.child_id=$1)),'[]') registrations
 from public.academy_events e where exists(select 1 from public.family_branches f where f.branch_id=e.branch_id)$q$;
 when 'challenges' then query:=$q$select id,title,description detail,branch_id,published_at starts_at,public.member_v1_actions('challenges',id,$1) actions from public.engagement_challenges where published_at is not null$q$;
 when 'recognition' then query:=$q$select id,child_id,title,evidence detail,status,created_at starts_at from public.recognition_nominations where status='approved' and ($1 is null or child_id=$1)$q$;
 when 'trials' then query:=$q$select q.id,q.child_id,q.sport,q.child_name title,q.experience detail,q.reference status from public.trial_enquiries q where q.child_id is not null and ($1 is null or q.child_id=$1)$q$;
 else raise exception 'Unknown member resource' using errcode='22023';end case;
 execute 'select coalesce(jsonb_agg(jsonb_strip_nulls(to_jsonb(x)) || jsonb_build_object(''kind'',coalesce(to_jsonb(x)->>''kind'',$4),''actions'',coalesce(to_jsonb(x)->''actions'',''[]''::jsonb))),''[]''::jsonb) from ('||query||' order by id limit $2 offset $3) x' into rows using p_child,p_limit+1,p_offset,p_resource;
 return jsonb_build_object('items',case when jsonb_array_length(rows)>p_limit then rows-p_limit else rows end,'next_cursor',case when jsonb_array_length(rows)>p_limit then p_offset+p_limit else null end,'server_time',now());
end $$;
revoke all on function public.member_v1_read(text,uuid,int,int) from public,anon;
grant execute on function public.member_v1_read(text,uuid,int,int) to authenticated;

-- Idempotency for foundation/trial commands without changing the web command contract.
create table private.member_requests(actor_id uuid not null references public.profiles,key uuid not null,payload_hash text not null,access_hash text not null,response jsonb not null,created_at timestamptz not null default now(),primary key(actor_id,key));
revoke all on private.member_requests from public,anon,authenticated;
create function public.member_v1_command(p_action text,p_data jsonb,p_key uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare ctx jsonb; result jsonb; prior private.member_requests; payload text; access text; begin
 ctx:=public.account_context();
 if ctx is null or ctx->>'active'<>'true' or ctx->'roles'<>'["parent"]'::jsonb or not private.active() or not private.mfa_ready() then raise exception 'Parent access required' using errcode='42501';end if;
 if p_action is null or p_key is null or jsonb_typeof(p_data)<>'object' or octet_length(p_data::text)>24000 then raise exception 'Invalid command' using errcode='22023';end if;
 if p_action not in ('family.create','family.update','child.save','child.sport','consent.record','trial.book','trial.cancel','academy.makeup.book','academy.makeup.cancel','academy.waitlist.join','academy.waitlist.accept','commercial.membership.renew','community.notification.read','community.ticket.open','community.ticket.reply','community.contact.save','community.document.accept','files.withdraw','events.register','events.cancel_registration','engagement.challenge.join','engagement.completion.submit','schedule.acknowledge') then raise exception 'Member action not allowed' using errcode='42501';end if;
 if p_action='events.register' and not exists(select 1 from public.academy_events e join public.family_branches f on f.branch_id=e.branch_id where e.id=(p_data->>'event_id')::uuid and f.family_id=(p_data->>'family_id')::uuid and private.family_owner(f.family_id)) then raise exception 'Same-branch family required' using errcode='42501';end if;
 -- Do not trust even authenticated client-supplied level/override fields.
 if (p_action='child.sport' and nullif(p_data->>'level','') is not null) or (p_action='trial.book' and p_data ? 'override_reason') then raise exception 'Academy-controlled field' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||p_key::text,0));
 payload:=md5(p_action||p_data::text);
 select md5(coalesce(string_agg(family_id::text,',' order by family_id),'')) into access from public.guardians where user_id=auth.uid();
 select * into prior from private.member_requests where actor_id=auth.uid() and key=p_key;
 if found then
  if prior.payload_hash<>payload or prior.access_hash<>access then raise exception 'Request or authority changed' using errcode='P0409';end if;
  return prior.response;
 end if;
 if p_action in ('family.create','family.update','child.save','child.sport','consent.record') then result:=public.academy_command(p_action,p_data);
 elsif p_action in ('trial.book','trial.cancel') then result:=public.operations_command(p_action,p_data);
 else result:=public.product_command(p_action,p_data,p_key);end if;
 select md5(coalesce(string_agg(family_id::text,',' order by family_id),'')) into access from public.guardians where user_id=auth.uid();
 insert into private.member_requests(actor_id,key,payload_hash,access_hash,response) values(auth.uid(),p_key,payload,access,result);
 return result;
end $$;
revoke all on function public.member_v1_command(text,jsonb,uuid) from public,anon;
grant execute on function public.member_v1_command(text,jsonb,uuid) to authenticated;
-- Permitted-action projections are scoped to an owned child and never grant mutation authority.
create or replace function public.member_v1_actions(p_kind text,p_id uuid,p_child uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare k public.children;e public.academy_events;g public.age_groups;challenge public.engagement_challenges;entry public.engagement_entries;batch uuid;ctx jsonb;begin
 ctx:=public.account_context();
 if ctx is null or ctx->>'active'<>'true' or ctx->'roles'<>'["parent"]'::jsonb or not private.mfa_ready() then return '[]';end if;
 select * into k from public.children where id=p_child;
 if k.id is null or not private.family_owner(k.family_id) then return '[]';end if;
 if p_kind='events' then
  select * into e from public.academy_events where id=p_id;select * into g from public.age_groups where id=e.age_group_id;
  select batch_id into batch from public.event_registrations where event_id=e.id and child_id=k.id and status='registered';
  if batch is not null and e.starts_at>now() then return jsonb_build_array(jsonb_build_object('action','events.cancel_registration','data',jsonb_build_object('batch_id',batch)));end if;
  if e.status<>'open' or e.starts_at<=now() or not exists(select 1 from public.family_branches where family_id=k.family_id and branch_id=e.branch_id) then return '[]';end if;
  if not coalesce(private.age_fits(k.dob,k.reported_age,k.age_captured_on,(e.starts_at at time zone 'Asia/Dubai')::date,g.min_age,g.max_age),false) or not exists(select 1 from public.child_sports where child_id=k.id and sport=e.sport and level_id=e.level_id and status='reviewed') then return '[]';end if;
  if (select count(*) from public.event_registrations where event_id=e.id and status='registered')>=e.capacity or private.child_conflict(k.id,e.starts_at,e.ends_at) then return '[]';end if;
  return jsonb_build_array(jsonb_build_object('action','events.register','data',jsonb_build_object('event_id',e.id,'family_id',k.family_id,'children',jsonb_build_array(jsonb_build_object('child_id',k.id,'document_id',e.document_id,'accepted',true)))));
 elsif p_kind='challenges' then
  select * into challenge from public.engagement_challenges where id=p_id;
  if challenge.id is null or challenge.published_at is null then return '[]';end if;
  select * into entry from public.engagement_entries where challenge_id=p_id and child_id=p_child;
  if entry.id is not null then
   if now() between challenge.starts_at and challenge.ends_at+interval '30 days' and coalesce((private.engagement_proof(entry.id)->>'qualified')::boolean,false) then return jsonb_build_array(jsonb_build_object('action','engagement.completion.submit','data',jsonb_build_object('entry_id',entry.id)));end if;return '[]';
  end if;
  if challenge.ends_at<=now() or not exists(select 1 from public.enrollments n join public.academy_classes c on c.id=n.class_id where n.child_id=p_child and n.status='active' and c.active and c.branch_id=challenge.branch_id and c.sport=challenge.sport) or (challenge.level_id is not null and not exists(select 1 from public.child_sports where child_id=p_child and sport=challenge.sport and level_id=challenge.level_id)) then return '[]';end if;
  return jsonb_build_array(jsonb_build_object('action','engagement.challenge.join','data',jsonb_build_object('challenge_id',p_id,'child_id',p_child)));
 end if;return '[]';
end $$;
revoke all on function public.member_v1_actions(text,uuid,uuid) from public,anon;
grant execute on function public.member_v1_actions(text,uuid,uuid) to authenticated;
create or replace function public.member_v1_waitlist(p_child uuid) returns table(id uuid,title text,starts_at timestamptz,ends_at timestamptz,actions jsonb)
language plpgsql stable security definer set search_path='' as $$
declare k public.children;ctx jsonb;begin
 ctx:=public.account_context();select * into k from public.children where children.id=p_child;
 if ctx is null or ctx->>'active'<>'true' or ctx->'roles'<>'["parent"]'::jsonb or k.id is null or not private.family_owner(k.family_id) then return;end if;
 return query select distinct on(s.id) s.id,c.name,s.starts_at,s.ends_at,jsonb_build_array(jsonb_build_object('action','academy.waitlist.join','data',jsonb_build_object('enrollment_id',n.id,'session_id',s.id)))
 from public.enrollments n join public.academy_classes source on source.id=n.class_id join public.academy_classes c on c.branch_id=source.branch_id and c.sport=source.sport and c.level_id=source.level_id join public.class_sessions s on s.class_id=c.id
 where n.child_id=p_child and n.status='active' and private.academy_eligible(k.id,s.id,c.branch_id,c.sport,c.level_id)
 and (select count(*) from public.session_roster r where r.session_id=s.id and not r.cancelled)+(select count(*) from public.waitlist_entries w where w.session_id=s.id and w.status='offered' and w.offered_until>now())>=s.capacity
 and not exists(select 1 from public.waitlist_entries w where w.child_id=p_child and w.session_id=s.id and w.status in ('waiting','offered','booked')) order by s.id,n.id;
end $$;
revoke all on function public.member_v1_waitlist(uuid) from public,anon;
grant execute on function public.member_v1_waitlist(uuid) to authenticated;
