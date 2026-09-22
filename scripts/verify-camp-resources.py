"""Real bidirectional camp/class resource contention in an existing disposable replay DB."""
import subprocess,time,json,sys,re
DB=sys.argv[1]
if not re.fullmatch(r'kafou_replay_[0-9]+_[0-9]+',DB): raise ValueError('Only a guarded disposable replay database is accepted')
base=['docker','exec','supabase_db_kafou-local','psql','-U','supabase_admin','-d',DB,'-X','-Atq','-v','ON_ERROR_STOP=1']
def sql(q):
 p=subprocess.run(base+['-c',q],capture_output=True,text=True)
 if p.returncode: raise RuntimeError(p.stderr)
 return p.stdout.strip()
auth="set local role authenticated;select set_config('request.jwt.claims','{\"sub\":\"fb100000-0000-4000-8000-000000000003\",\"role\":\"authenticated\",\"aal\":\"aal2\"}',true);"
payload="jsonb_build_object('branch_id','fb200000-0000-4000-8000-000000000001','sport','swimming','level_id','fb200000-0000-4000-8000-000000000003','age_group_id','fb200000-0000-4000-8000-000000000004','document_id','fb200000-0000-4000-8000-000000000005','title','Synthetic concurrent camp','capacity',2,'policy_acknowledged',true,'occurrences',(select jsonb_agg(jsonb_build_object('venue_id','fb200000-0000-4000-8000-000000000002','coach_id','fb100000-0000-4000-8000-000000000004','starts_at',(current_date+i)::timestamptz+interval '8 hours','ends_at',(current_date+i)::timestamptz+interval '9 hours')) from generate_series(9,10) i))"
camp=auth+"select public.product_command('events.camp.create',"+payload+",gen_random_uuid());"
class_cmd="insert into public.class_sessions(id,class_id,starts_at,ends_at,capacity) values('fb700000-0000-4000-8000-000000000001','fb500000-0000-4000-8000-000000000001',(current_date+9)::timestamptz+interval '8 hours',(current_date+9)::timestamptz+interval '9 hours',10);"
for first,second in [('camp','class'),('class','camp')]:
 cmds={'camp':camp,'class':class_cmd}
 p=subprocess.Popen(base+['-c',f"set application_name='kafou-camp-race-first';begin;{cmds[first]}select pg_sleep(2);commit;"],stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
 for _ in range(80):
  if sql("select count(*) from pg_stat_activity where application_name='kafou-camp-race-first' and wait_event='PgSleep'")=='1':break
  if p.poll() is not None:raise RuntimeError(p.communicate())
  time.sleep(.025)
 else:raise RuntimeError('First operation did not reach real held-lock barrier')
 q=subprocess.Popen(base+['-c',f"set application_name='kafou-camp-race-second';begin;{cmds[second]}commit;"],stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
 contended=False
 for _ in range(40):
  if sql("select count(*) from pg_stat_activity where application_name='kafou-camp-race-second' and wait_event='advisory'")=='1':contended=True;break
  if q.poll() is not None:break
  time.sleep(.025)
 pout,perr=p.communicate(timeout=8);qout,qerr=q.communicate(timeout=8)
 assert p.returncode==0,(pout,perr)
 assert q.returncode!=0 and 'overlaps' in qerr,(qout,qerr)
 assert contended,'Second operation did not actually wait on shared advisory lock'
 counts=sql("select (select count(*) from public.event_occurrences o join public.academy_events e on e.id=o.event_id where e.title='Synthetic concurrent camp' and o.status='scheduled' and e.status='open')||'|'||(select count(*) from public.class_sessions where id='fb700000-0000-4000-8000-000000000001');")
 assert counts==('2|0' if first=='camp' else '0|1'),counts
 print(json.dumps({'winner':first,'loser':second,'observed_advisory_wait':contended,'live_camp_occurrences_class_sessions':counts,'loser_error':qerr.splitlines()[0]}))
 if first=='camp':sql("begin;"+auth+"select public.product_command('events.cancel',jsonb_build_object('event_id',(select id from public.academy_events where title='Synthetic concurrent camp'),'reason','Synthetic reverse-order contention verification'),gen_random_uuid());commit;")
# New multi-date camp registration path: one remaining shared place, two families.
capacity_payload=payload.replace("'Synthetic concurrent camp'","'Synthetic capacity camp'").replace("'capacity',2","'capacity',1").replace('generate_series(9,10)','generate_series(19,20)')
sql("begin;"+auth+"select public.product_command('events.camp.create',"+capacity_payload+",gen_random_uuid());commit;")
actor_a='fb100000-0000-4000-8000-000000000001'
actor_b='fb100000-0000-4000-8000-000000000002'
def register(actor,family,child):
 return f"set local role authenticated;select set_config('request.jwt.claims','{{\"sub\":\"{actor}\",\"role\":\"authenticated\",\"aal\":\"aal1\"}}',true);select public.product_command('events.register',jsonb_build_object('event_id',(select id from public.academy_events where title='Synthetic capacity camp'),'family_id','{family}','children',jsonb_build_array(jsonb_build_object('child_id','{child}','document_id','fb200000-0000-4000-8000-000000000005','accepted',true))),gen_random_uuid());"
p=subprocess.Popen(base+['-c',"set application_name='kafou-camp-seat-first';begin;"+register(actor_a,'fb300000-0000-4000-8000-000000000001','fb400000-0000-4000-8000-000000000002')+"select pg_sleep(2);commit;"],stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
for _ in range(80):
 if sql("select count(*) from pg_stat_activity where application_name='kafou-camp-seat-first' and wait_event='PgSleep'")=='1':break
 if p.poll() is not None:raise RuntimeError(p.communicate())
 time.sleep(.025)
else:raise RuntimeError('First camp registration did not reach hold barrier')
q=subprocess.Popen(base+['-c',"set application_name='kafou-camp-seat-second';begin;"+register(actor_b,'fb300000-0000-4000-8000-000000000002','fb400000-0000-4000-8000-000000000003')+"commit;"],stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
contended=False
for _ in range(40):
 if sql("select count(*) from pg_stat_activity where application_name='kafou-camp-seat-second' and wait_event='advisory'")=='1':contended=True;break
 if q.poll() is not None:break
 time.sleep(.025)
pout,perr=p.communicate(timeout=8);qout,qerr=q.communicate(timeout=8)
assert p.returncode==0,(pout,perr)
assert q.returncode!=0 and 'Event capacity unavailable' in qerr,(qout,qerr)
assert contended,'Competing camp registration did not actually wait'
counts=sql("with e as(select id from public.academy_events where title='Synthetic capacity camp') select (select count(*) from public.event_registrations where event_id=(select id from e) and status='registered')||'|'||(select count(*) from public.event_registration_batches where event_id=(select id from e))||'|'||(select count(*) from public.event_attendance a join public.event_occurrences o on o.id=a.occurrence_id where o.event_id=(select id from e))||'|'||(select count(*) from public.event_consents c join public.event_registrations r on r.id=c.registration_id where r.event_id=(select id from e) and jsonb_array_length(c.occurrence_snapshot)=2);")
assert counts=='1|1|2|1',counts
print(json.dumps({'race':'camp_last_place','observed_advisory_wait':contended,'registrations_batches_attendance_full_consents':counts,'loser_error':qerr.splitlines()[0]}))
