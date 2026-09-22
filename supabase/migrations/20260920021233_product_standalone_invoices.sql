-- Posted standalone invoices reuse the existing RLS, exact-money allocation,
-- adjustment and receipt ledgers. They never activate a membership or grant units.
alter table public.commercial_invoices alter column membership_id drop not null;
alter table public.commercial_invoices add column author_reference text
 check(author_reference is null or length(trim(author_reference)) between 3 and 100);
create unique index commercial_invoice_author_reference
 on public.commercial_invoices(branch_id,author_reference) where author_reference is not null;
alter table public.commercial_invoice_lines
 add column child_id uuid references public.children,
 add column package_id uuid references public.commercial_packages,
 add column description_ar text not null default '',
 add column line_position integer check(line_position between 1 and 20),
 add constraint commercial_line_subject check((child_id is null)=(package_id is null));
create unique index commercial_invoice_child_package on public.commercial_invoice_lines(invoice_id,child_id,package_id) where child_id is not null;
create unique index commercial_invoice_line_position on public.commercial_invoice_lines(invoice_id,line_position) where line_position is not null;

alter function private.commercial_command(text,jsonb) rename to commercial_command_before_invoices;
create function private.commercial_command(p_action text,p_data jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare f uuid;b uuid;ref text;line jsonb;pkg public.commercial_packages;
 child public.children;i uuid;invoice_ref text;quantity integer;total bigint:=0;position integer:=0;
begin
 if p_action<>'commercial.invoice.create' then return private.commercial_command_before_invoices(p_action,p_data);end if;
 perform private.require_access(private.active() and private.mfa_ready() and not private.has_role(array['coach','sales']::public.academy_role[]));
 perform pg_advisory_xact_lock(hashtextextended('kafou-operational-writes',0));
 f:=(p_data->>'family_id')::uuid;b:=(p_data->>'branch_id')::uuid;
 perform private.require_access(private.commercial_can('finance.invoices',f,b));
 if jsonb_typeof(p_data)<>'object' or p_data-array['family_id','branch_id','reference','lines']<>'{}'::jsonb
  or jsonb_typeof(p_data->'lines') is distinct from 'array' then raise exception 'Invalid invoice fields' using errcode='22023';end if;
 ref:=trim(p_data->>'reference');
 if ref is null or length(ref) not between 3 and 100 or jsonb_array_length(p_data->'lines') not between 1 and 20 then raise exception 'Invoice reference and 1 to 20 lines required' using errcode='22023';end if;
 if not exists(select 1 from public.families where id=f) then raise exception 'Invoice family is unavailable' using errcode='42501';end if;
 if not exists(select 1 from public.branches where id=b and active and not provisional) then raise exception 'Invoice branch is unavailable' using errcode='P0409';end if;
 if exists(select 1 from public.commercial_invoices where branch_id=b and author_reference=ref) then raise exception 'Invoice reference already used in this branch' using errcode='P0409';end if;
 if exists(select 1 from jsonb_array_elements(p_data->'lines') l group by l->>'child_id',l->>'package_id' having count(*)>1) then raise exception 'Combine repeated child and package lines using quantity' using errcode='22023';end if;
 insert into public.commercial_invoices(family_id,branch_id,issued_by,author_reference)
 values(f,b,auth.uid(),ref) returning id,reference into i,invoice_ref;
 for line in select value from jsonb_array_elements(p_data->'lines') loop
  if jsonb_typeof(line)<>'object' or line-array['child_id','package_id','quantity']<>'{}'::jsonb
   or jsonb_typeof(line->'quantity') is distinct from 'number'
   or (line->>'quantity') !~ '^[0-9]+$' then raise exception 'Invalid invoice line fields' using errcode='22023';end if;
  if (line->>'quantity')::numeric not between 1 and 100 then raise exception 'Invoice quantity must be between 1 and 100' using errcode='22023';end if;
  quantity:=(line->>'quantity')::integer;
  select * into child from public.children where id=(line->>'child_id')::uuid for share;
  select * into pkg from public.commercial_packages where id=(line->>'package_id')::uuid for share;
  perform private.require_access(child.id is not null and child.family_id=f and pkg.id is not null and pkg.branch_id=b);
  if not pkg.active or not exists(select 1 from public.branch_sports where branch_id=b and sport=pkg.sport)
   or (pkg.level_id is not null and not exists(select 1 from public.sport_levels where id=pkg.level_id and active and sport=pkg.sport))
   or not exists(select 1 from public.child_sports where child_id=child.id and sport=pkg.sport and (pkg.level_id is null or level_id=pkg.level_id)) then
   raise exception 'Active package, child sport and level must match' using errcode='P0409';end if;
  total:=total+quantity::bigint*pkg.price_minor;
  if total>1000000000 then raise exception 'Invoice total exceeds the supported amount' using errcode='22023';end if;
  position:=position+1;
  insert into public.commercial_invoice_lines(invoice_id,child_id,package_id,description,description_ar,quantity,unit_minor,line_position)
  values(i,child.id,pkg.id,child.name||' · '||pkg.name,child.name||' · '||coalesce(nullif(pkg.name_ar,''),pkg.name),quantity,pkg.price_minor,position);
 end loop;
 perform private.emit_product_event('invoice.created',i,f,b,'Invoice available','A new invoice is available in your family finance records.','/parent?view=Finance');
 return jsonb_build_object('id',i,'reference',invoice_ref,'total_minor',total,'line_count',position);
end $$;
revoke all on function private.commercial_command(text,jsonb),private.commercial_command_before_invoices(text,jsonb) from public,anon,authenticated;
