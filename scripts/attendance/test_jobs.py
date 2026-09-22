"""Queue plumbing tests only; recognition accuracy is evaluated separately."""
import tempfile,unittest,time,sqlite3
from pathlib import Path
from jobs import PhotoJobs
class JobsTest(unittest.TestCase):
 def test_dedup_and_restart(self):
  with tempfile.TemporaryDirectory() as folder:
   calls=[];path=Path(folder)/'jobs.sqlite'
   def process(v):calls.append(v);return {'value':v['value']+1}
   q=PhotoJobs(path,process,ttl=300)
   self.assertEqual(q.run({'value':1}),{'value':2});self.assertEqual(q.run({'value':1}),{'value':2});self.assertEqual(len(calls),1);q.close()
   q=PhotoJobs(path,process);self.assertEqual(q.run({'value':1}),{'value':2});self.assertEqual(len(calls),1);q.close()
 def test_failed_retry_and_cleanup(self):
  with tempfile.TemporaryDirectory() as folder:
   calls=[];path=Path(folder)/'jobs.sqlite'
   def process(v):
    calls.append(v)
    if len(calls)==1:raise ValueError('Use a clearer photograph.')
    return {'done':True}
   q=PhotoJobs(path,process,ttl=0.1)
   with self.assertRaises(ValueError):q.run({'value':2})
   self.assertTrue(q.run({'value':2})['done']);time.sleep(.2);q.cleanup()
   with sqlite3.connect(path) as db:self.assertEqual(db.execute('select count(*) from jobs').fetchone()[0],0)
   q.close()
 def test_interrupted_running_job_resumes(self):
  with tempfile.TemporaryDirectory() as folder:
   path=Path(folder)/'jobs.sqlite';q=PhotoJobs(path,lambda v:{'value':v['value']+1});q.close()
   import json,hashlib
   body=json.dumps({'value':3},sort_keys=True,separators=(',',':'));key=hashlib.sha256(body.encode()).hexdigest()
   with q.db() as db:db.execute("insert into jobs values(?,?,null,null,'running',1,?)",(key,body,time.time()))
   calls=[]
   def process(v):calls.append(v);return {'value':v['value']+1}
   q=PhotoJobs(path,process);self.assertEqual(q.run({'value':3}),{'value':4});self.assertEqual(len(calls),1);q.close()
if __name__=='__main__':unittest.main()
