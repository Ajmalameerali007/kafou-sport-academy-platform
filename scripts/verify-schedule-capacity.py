import subprocess,time,json,sys,re
DB=sys.argv[1]
if not re.fullmatch(r'kafou_replay_[0-9]+_[0-9]+',DB): raise ValueError('Only a guarded disposable replay database is accepted')
base=['docker','exec','supabase_db_kafou-local','psql','-U','supabase_admin','-d',DB,'-X','-Atq','-v','ON_ERROR_STOP=1']
def sql(q):
 p=subprocess.run(base+['-c',q],capture_output=True,text=True)
 if p.returncode: raise RuntimeError(p.stderr)
 return p.stdout.strip()
auth="set local role authenticated;select set_config('request.jwt.claims',jsonb_build_object('sub',test_schedule.sid('owner'),'role','authenticated','aal','aal2')::text,true);"
trial="select public.operations_command('trial.book',jsonb_build_object('enquiry_id',test_schedule.sid('enquiry'),'session_id',test_schedule.sid('race')));"
makeup="select public.product_command('academy.makeup.book',jsonb_build_object('credit_id',test_schedule.sid('credit'),'session_id',test_schedule.sid('race')),gen_random_uuid());"
for first,second in [('trial','makeup'),('makeup','trial')]:
 cmds={'trial':trial,'makeup':makeup}
 p=subprocess.Popen(base+['-c',f"set application_name='kafou-race-first';begin;{auth}{cmds[first]}select pg_sleep(2);commit;"],stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
 for _ in range(80):
  if sql("select count(*) from pg_stat_activity where application_name='kafou-race-first' and wait_event='PgSleep'")=='1':break
  if p.poll() is not None:raise RuntimeError(p.communicate())
  time.sleep(.025)
 else:raise RuntimeError('first connection did not reach hold barrier')
 q=subprocess.Popen(base+['-c',f"set application_name='kafou-race-second';begin;{auth}{cmds[second]}commit;"],stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
 contended=False
 for _ in range(40):
  if sql("select count(*) from pg_stat_activity where application_name='kafou-race-second' and wait_event='advisory'")=='1':contended=True;break
  if q.poll() is not None:break
  time.sleep(.025)
 pout,perr=p.communicate(timeout=6);qout,qerr=q.communicate(timeout=6)
 assert p.returncode==0,(pout,perr)
 assert q.returncode!=0 and 'Session full' in qerr or q.returncode!=0 and 'Session is full' in qerr,(qout,qerr)
 assert contended,'second connection did not actually wait on shared advisory lock'
 occupied=sql("select count(*) from public.session_roster where session_id=test_schedule.sid('race') and not cancelled")
 assert occupied=='1',occupied
 print(json.dumps({'winner':first,'loser':second,'observed_advisory_wait':contended,'occupied_seats':int(occupied),'loser_error':qerr.splitlines()[0]}))
 if first=='trial':sql("begin;"+auth+"select public.operations_command('trial.cancel',jsonb_build_object('id',(select id from public.trial_bookings where enquiry_id=test_schedule.sid('enquiry') and status='booked')));commit;")
print(sql("select jsonb_build_object('credit_status',(select status from public.makeup_credits where id=test_schedule.sid('credit')),'live_makeups',(select count(*) from public.makeup_bookings where status='reserved'),'live_trials',(select count(*) from public.trial_bookings where status='booked'),'live_roster',(select count(*) from public.session_roster where session_id=test_schedule.sid('race') and not cancelled))"))
