-- File bytes are private. Server handlers authorize metadata with the user's JWT before any storage operation.
create table public.family_files(id uuid primary key default gen_random_uuid(),family_id uuid not null references public.families,child_id uuid references public.children,branch_id uuid references public.branches,uploaded_by uuid not null references public.profiles,name text not null check(length(name) between 1 and 160),mime_type text not null check(mime_type in ('application/pdf','image/png','image/jpeg')),size_bytes int not null check(size_bytes between 1 and 524288),sha256 text not null check(sha256~'^[a-f0-9]{64}$'),object_path text not null unique,status text not null default 'pending' check(status in ('pending','ready','withdrawn')),created_at timestamptz not null default now(),withdrawn_at timestamptz);
create table public.file_access_events(id uuid primary key default gen_random_uuid(),file_id uuid not null references public.family_files,user_id uuid not null references public.profiles,action text not null check(action in ('download','withdraw')),created_at timestamptz not null default now());
create function private.file_access(fid uuid) returns boolean language sql stable security definer set search_path='' as $$ select private.active() and private.mfa_ready() and exists(select 1 from public.family_files f where f.id=fid and (private.family_owner(f.family_id) or (private.operations_staff(f.branch_id) and private.family_access(f.family_id)))) $$;
create function private.files_command(p_action text,p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare f public.family_files;fid uuid;bid uuid;cid uuid;rid uuid;begin
 perform private.require_access(private.active() and private.mfa_ready());
 case p_action
 when 'files.begin' then
 fid:=(p_data->>'family_id')::uuid;bid:=nullif(p_data->>'branch_id','')::uuid;cid:=nullif(p_data->>'child_id','')::uuid;
 perform private.require_access(private.family_owner(fid) or (private.operations_staff(bid) and private.family_access(fid)));
 if cid is not null and not exists(select 1 from public.children where id=cid and family_id=fid) then raise exception 'Child outside family' using errcode='42501';end if;
 if not exists(select 1 from storage.buckets where id='kafou-private-documents' and not public) then raise exception 'Private storage unavailable' using errcode='P0503';end if;
 rid:=gen_random_uuid();insert into public.family_files(id,family_id,child_id,branch_id,uploaded_by,name,mime_type,size_bytes,sha256,object_path) values(rid,fid,cid,bid,auth.uid(),p_data->>'name',p_data->>'mime_type',(p_data->>'size_bytes')::int,p_data->>'sha256',auth.uid()::text||'/'||rid::text);return jsonb_build_object('id',rid,'path',auth.uid()::text||'/'||rid::text);
 when 'files.finish' then
 select * into f from public.family_files where id=(p_data->>'id')::uuid for update;perform private.require_access(private.file_access(f.id) and f.uploaded_by=auth.uid());
 if not exists(select 1 from storage.objects o where o.bucket_id='kafou-private-documents' and o.name=f.object_path and (o.metadata->>'size')::bigint=f.size_bytes) then raise exception 'Upload has not persisted' using errcode='P0409';end if;
 if f.status='withdrawn' then raise exception 'File withdrawn' using errcode='P0409';end if;
 update public.family_files set status='ready' where id=f.id;rid:=f.id;
 when 'files.download','files.withdraw' then
 select * into f from public.family_files where id=(p_data->>'id')::uuid for update;perform private.require_access(private.file_access(f.id));
 if f.status<>'ready' then raise exception 'File unavailable' using errcode='P0409';end if;
 if p_action='files.withdraw' then perform private.require_access(private.family_owner(f.family_id) or private.super_admin());update public.family_files set status='withdrawn',withdrawn_at=now() where id=f.id;end if;
 insert into public.file_access_events(file_id,user_id,action) values(f.id,auth.uid(),split_part(p_action,'.',2));rid:=f.id;
 else raise exception 'Unknown file command' using errcode='22023';end case;return jsonb_build_object('id',rid);
end $$;
revoke all on function private.files_command(text,jsonb),private.file_access(uuid) from public,anon,authenticated;grant execute on function private.file_access(uuid) to authenticated;
alter table public.family_files enable row level security;alter table public.file_access_events enable row level security;
revoke all on public.family_files,public.file_access_events from anon,authenticated;grant select on public.family_files,public.file_access_events to authenticated;grant all on public.family_files,public.file_access_events to service_role;
create policy family_file_read on public.family_files for select to authenticated using(private.file_access(id));
create policy file_history_read on public.file_access_events for select to authenticated using(private.file_access(file_id));
create trigger family_file_audit after insert or update on public.family_files for each row execute function private.product_audit();
-- No public/authenticated storage object policies: download/upload are only through the authorized same-origin API.
