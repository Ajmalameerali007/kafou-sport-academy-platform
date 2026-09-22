-- Preserve message authorship/content and the first publication review.
create function private.lock_coach_message_history() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='DELETE' then raise exception 'Conversation history is retained' using errcode='42501';end if;
 if (to_jsonb(new)-array['status','published_at','reviewed_by']) is distinct from (to_jsonb(old)-array['status','published_at','reviewed_by']) or (old.status='published' and to_jsonb(new) is distinct from to_jsonb(old)) then raise exception 'Message content and published review are immutable' using errcode='42501';end if;
 return new;
end $$;
revoke all on function private.lock_coach_message_history() from public,anon,authenticated,service_role;
create trigger lock_coach_message_history before update or delete on public.coach_messages for each row execute function private.lock_coach_message_history();
