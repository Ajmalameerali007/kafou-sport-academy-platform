"""Private bounded inference queue, independent of academy business-event outbox.
Five-minute retention includes input bytes/results; restart resumes interrupted work.
No JWTs, child names or customer identifiers are stored. API reauthorizes results.
"""
import sqlite3,json,hashlib,time,threading,os
from contextlib import contextmanager
class PhotoJobs:
 def __init__(self,path,process,ttl=300):
  self.path=path;self.process=process;self.ttl=ttl;self.stopped=threading.Event();self.signal=threading.Event()
  fd=os.open(path,os.O_CREAT|os.O_RDWR,0o600);os.close(fd);os.chmod(path,0o600)
  with self.db() as db:
   db.execute('create table if not exists jobs(id text primary key,input text,result text,error text,status text,attempts integer,created real)')
   db.execute("update jobs set status='queued' where status='running'")
  self.cleanup();self.worker=threading.Thread(target=self.work,daemon=True);self.worker.start()
 @contextmanager
 def db(self):
  db=sqlite3.connect(self.path,timeout=5);db.execute('pragma secure_delete=on')
  try:
   with db:yield db
  finally:db.close()
 def cleanup(self):
  with self.db() as db:db.execute('delete from jobs where created<?',(time.time()-self.ttl,))
 def run(self,value,timeout=25):
  body=json.dumps(value,sort_keys=True,separators=(',',':'));key=hashlib.sha256(body.encode()).hexdigest();self.cleanup()
  with self.db() as db:
   db.execute('begin immediate');old=db.execute('select status,attempts from jobs where id=?',(key,)).fetchone()
   if not old:
    if db.execute("select count(*) from jobs where status in ('queued','running')").fetchone()[0]>=16:raise ValueError('Photo queue is full. Retry this photo shortly.')
    db.execute("insert into jobs values(?,?,null,null,'queued',0,?)",(key,body,time.time()))
   elif old[0]=='failed' and old[1]<3:db.execute("update jobs set status='queued',error=null where id=?",(key,))
  self.signal.set();deadline=time.monotonic()+timeout
  while time.monotonic()<deadline:
   with self.db() as db:row=db.execute('select status,result,error from jobs where id=?',(key,)).fetchone()
   if not row:raise ValueError('Photo job expired. Upload the photo again.')
   if row[0]=='done':return json.loads(row[1])
   if row[0]=='failed':raise ValueError(row[2])
   self.stopped.wait(.05)
  raise ValueError('Photo is still processing. Retry this photo to collect its result.')
 def work(self):
  while not self.stopped.is_set():
   self.cleanup()
   with self.db() as db:
    db.execute('begin immediate');row=db.execute("select id,input from jobs where status='queued' order by created limit 1").fetchone()
    if row:db.execute("update jobs set status='running',attempts=attempts+1 where id=?",(row[0],))
   if not row:self.signal.wait(.2);self.signal.clear();continue
   try:
    result=json.dumps(self.process(json.loads(row[1])))
    with self.db() as db:db.execute("update jobs set status='done',result=?,input=null where id=?",(result,row[0]))
   except Exception as e:
    message=str(e) if isinstance(e,ValueError) and str(e).startswith(('Use ','Reference ','Photo ')) else 'Photo processing failed. Retry this photo or mark manually.'
    with self.db() as db:db.execute("update jobs set status='failed',error=? where id=?",(message,row[0]))
 def close(self):self.stopped.set();self.signal.set();self.worker.join(timeout=5)
