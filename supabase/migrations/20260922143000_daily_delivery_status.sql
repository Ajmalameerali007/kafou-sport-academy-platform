-- Attendance completion and coaching delivery are independent states.
-- Keep the existing command and permissions, changing only its status predicate.
do $migration$
declare definition text;
begin
 select pg_get_functiondef('public.daily_command(text,jsonb,uuid)'::regprocedure) into definition;
 if position('s.status<>''scheduled'' or s.delivered_at is not null' in definition)=0 then
  raise exception 'Unexpected daily command definition; inspect before applying';
 end if;
 execute replace(definition,'s.status<>''scheduled'' or s.delivered_at is not null','s.status=''cancelled'' or s.delivered_at is not null');
end
$migration$;
