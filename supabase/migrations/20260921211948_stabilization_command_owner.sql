-- Preserve the existing definer chain owner when migrations run under a different local admin.
-- No grants to application roles are introduced.
do $$declare owner_name text;begin
 select pg_get_userbyid(proowner) into owner_name from pg_proc where oid='private.commercial_command_before_stabilization(text,jsonb)'::regprocedure;
 execute format('alter function private.commercial_command(text,jsonb) owner to %I',owner_name);
end $$;
