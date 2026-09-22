"""Actual competing allocation corrections/refunds, only in a disposable replay database."""
import subprocess,time,json,sys,re
DB=sys.argv[1]
if not re.fullmatch(r'kafou_replay_[0-9]+_[0-9]+',DB):raise ValueError('Only a guarded disposable replay database is accepted')
base=['docker','exec','supabase_db_kafou-local','psql','-U','supabase_admin','-d',DB,'-X','-Atq','-v','ON_ERROR_STOP=1']
def sql(q):
 p=subprocess.run(base+['-c',q],capture_output=True,text=True)
 if p.returncode:raise RuntimeError(p.stderr)
 return p.stdout.strip()
auth="set local role authenticated;select set_config('request.jwt.claims','{\"sub\":\"71000000-0000-4000-8000-000000000001\",\"role\":\"authenticated\",\"aal\":\"aal2\"}',true);"
unallocate="select public.product_command('commercial.payment.unallocate',jsonb_build_object('allocation_id',(select a.id from public.commercial_allocations a join public.commercial_payments p on p.id=a.payment_id where p.reference='AMEND-PAID-001' and a.amount_minor>0),'amount_minor',20000,'reason','Synthetic simultaneous partial correction'),gen_random_uuid());"
def refund(ref):return "select public.product_command('commercial.payment.refund',jsonb_build_object('payment_id',(select id from public.commercial_payments where reference='AMEND-PAID-001'),'amount_minor',15000,'reason','Synthetic recorded offline refund','reference','"+ref+"'),gen_random_uuid());"
for kind,first,second,expected in [('partial_reversal',unallocate,unallocate,'Reversal exceeds remaining allocation'),('refund',refund('REPLAY-RACE-REFUND-A'),refund('REPLAY-RACE-REFUND-B'),'Refund exceeds unallocated payment')]:
 p=subprocess.Popen(base+['-c',"set application_name='kafou-money-first';begin;"+auth+first+"select pg_sleep(2);commit;"],stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
 for _ in range(80):
  if sql("select count(*) from pg_stat_activity where application_name='kafou-money-first' and wait_event='PgSleep'")=='1':break
  if p.poll() is not None:raise RuntimeError(p.communicate())
  time.sleep(.025)
 else:raise RuntimeError('First correction did not reach held-lock barrier')
 q=subprocess.Popen(base+['-c',"set application_name='kafou-money-second';begin;"+auth+second+"commit;"],stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
 contended=False
 for _ in range(40):
  if sql("select count(*) from pg_stat_activity where application_name='kafou-money-second' and wait_event='advisory'")=='1':contended=True;break
  if q.poll() is not None:break
  time.sleep(.025)
 pout,perr=p.communicate(timeout=8);qout,qerr=q.communicate(timeout=8)
 assert p.returncode==0,(pout,perr)
 assert q.returncode!=0 and expected in qerr,(qout,qerr)
 assert contended,'Competing correction never observed shared-lock contention'
 balances=sql("select (select coalesce(sum(a.amount_minor),0) from public.commercial_allocations a where a.payment_id=p.id)||'|'||(select coalesce(sum(r.amount_minor),0) from public.commercial_refunds r where r.payment_id=p.id)||'|'||private.commercial_unallocated(p.id) from public.commercial_payments p where p.reference='AMEND-PAID-001';")
 assert balances==('5010|0|20000' if kind=='partial_reversal' else '5010|15000|5000'),balances
 print(json.dumps({'race':kind,'observed_advisory_wait':contended,'allocated_refunded_available_minor':balances,'loser_error':qerr.splitlines()[0]}))
