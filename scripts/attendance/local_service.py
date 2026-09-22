"""Loopback-only private inference. One worker, bounded persistent queue.
Queued inputs are private, cleared on success and expired after five minutes.
Reference images/templates have separately enforced consent and retention.
"""
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path
from engine import Engine
from io import BytesIO
from PIL import Image
import base64,json,hashlib,hmac,time,os,uuid,urllib.request,threading
from jobs import PhotoJobs
ROOT=Path(__file__).resolve().parents[2]/'.attendance-local';STORE=ROOT/'references';STORE.mkdir(mode=0o700,parents=True,exist_ok=True)
env={}
for line in (ROOT.parent/'.env.local').read_text().splitlines():
 if '=' in line and not line.startswith('#'):
  k,v=line.split('=',1);env[k]=v.strip().strip('"').strip("'")
if env.get('SUPABASE_URL')!='http://127.0.0.1:56321':raise RuntimeError('Known local database required')
KEY=(ROOT/'key').read_text().strip();engine=Engine()
def rid(value):return str(uuid.UUID(value))
engine_lock=threading.RLock()
def process_match(body):
 with engine_lock:
  req=urllib.request.Request(env['SUPABASE_URL']+'/rest/v1/rpc/attendance_worker_authorize',data=json.dumps({'p_actor':body['actor'],'p_aal':body['aal'],'p_session':body['session'],'p_references':body['references']}).encode(),headers={'apikey':env['SUPABASE_SECRET_KEY'],'Authorization':'Bearer '+env['SUPABASE_SECRET_KEY'],'Content-Type':'application/json'})
  with urllib.request.urlopen(req,timeout=5) as response:allowed=json.load(response)
  if allowed is not True:raise ValueError('Photo permission, consent or session changed. Reload the register.')
  start=time.perf_counter();raw=base64.b64decode(body['content'],validate=True)
  _,normalized=engine.decode(raw)
  references={r:json.loads((STORE/(rid(r)+'.json')).read_text()) for r in body['references'][:100]}
  return {'sha256':hashlib.sha256(normalized).hexdigest(),'faces':engine.match(raw,references),'processing_ms':round((time.perf_counter()-start)*1000,1)}
def process_staff_match(body):
 with engine_lock:
  req=urllib.request.Request(env['SUPABASE_URL']+'/rest/v1/rpc/staff_photo_worker_authorize',data=json.dumps({'p_actor':body['actor'],'p_aal':body['aal'],'p_reference':body['reference']}).encode(),headers={'apikey':env['SUPABASE_SECRET_KEY'],'Authorization':'Bearer '+env['SUPABASE_SECRET_KEY'],'Content-Type':'application/json'})
  with urllib.request.urlopen(req,timeout=5) as response:allowed=json.load(response)
  if allowed is not True:raise ValueError('Photo permission, consent or session changed. Reload staff verification.')
  start=time.perf_counter();raw=base64.b64decode(body['content'],validate=True);_,normalized=engine.decode(raw)
  reference=rid(body['reference']); vector=json.loads((STORE/(reference+'.json')).read_text())
  faces=engine.match(raw,{reference:vector})
  matched=len(faces)==1 and faces[0].get('status')=='matched' and faces[0].get('reference')==reference
  return {'sha256':hashlib.sha256(normalized).hexdigest(),'faces':faces,'matched':matched,'processing_ms':round((time.perf_counter()-start)*1000,1)}
jobs=PhotoJobs(ROOT/'photo-jobs.sqlite',process_match)
def process_direct(body):
 action=body['action']
 with engine_lock:
  if action=='delete':
   for r in body['references'][:100]:
    for suffix in ['.json','.jpg']:(STORE/(rid(r)+suffix)).unlink(missing_ok=True)
   return {'deleted':True}
  if action=='preview':
   raw=(STORE/(rid(body['reference'])+'.jpg')).read_bytes()
   if body.get('thumbnail'):
    with Image.open(BytesIO(raw)) as im:
     im.thumbnail((96,96));output=BytesIO();im.save(output,'JPEG',quality=80);raw=output.getvalue()
   return {'content':base64.b64encode(raw).decode()}
  if action not in ('reference','staff_reference'):raise ValueError('Unknown photo request.')
  raw=base64.b64decode(body['content'],validate=True);_,normalized=engine.decode(raw)
  vector=engine.reference(raw);ref=rid(body['reference'])
  try:
   for suffix,data in [('.jpg',normalized),('.json',json.dumps(vector).encode())]:
    fd=os.open(STORE/(ref+suffix),os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
    with os.fdopen(fd,'wb') as f:f.write(data)
  except Exception:
   for suffix in ['.json','.jpg']:(STORE/(ref+suffix)).unlink(missing_ok=True)
   raise
  return {'sha256':hashlib.sha256(normalized).hexdigest(),'model':'opencv-sface-2021dec-yunet-2023mar'}

class Handler(BaseHTTPRequestHandler):
 def log_message(self,*args):pass # Never log photos, bearer tokens or identifiers.
 def do_POST(self):
  if not hmac.compare_digest(self.headers.get('Authorization',''),'Bearer '+KEY):self.send_error(403);return
  try:
   n=int(self.headers.get('Content-Length','0'))
   if not 0<n<12_000_000:raise ValueError('Photo request too large.')
   body=json.loads(self.rfile.read(n))
   result=jobs.run(body) if body['action']=='match' else process_staff_match(body) if body['action']=='staff_match' else process_direct(body)
   encoded=json.dumps({'ok':True,'data':result}).encode();self.send_response(200)
  except (ValueError,KeyError,FileNotFoundError) as e:
   # Known messages only; file paths and raw decoder errors stay private.
   message=str(e) if isinstance(e,ValueError) and str(e).startswith(('Use ','Reference ','Photo ','Unknown ')) else 'Photo or approved reference is unavailable. Review the photo and retry.'
   encoded=json.dumps({'ok':False,'message':message}).encode();self.send_response(400)
  except Exception:
   encoded=json.dumps({'ok':False,'message':'Photo processing failed. Retry this photo or mark manually.'}).encode();self.send_response(503)
  self.send_header('Content-Type','application/json');self.send_header('Cache-Control','no-store');self.send_header('Content-Length',str(len(encoded)));self.end_headers();self.wfile.write(encoded)
server=ThreadingHTTPServer(('127.0.0.1',8766),Handler);server.timeout=30
print('Private synthetic inference listening on loopback port 8766',flush=True)
# Periodic actual removal also recovers a failed immediate withdrawal deletion.
last_cleanup=0
while True:
 server.handle_request()
 if time.monotonic()-last_cleanup>30:
  try:
   req=urllib.request.Request(env['SUPABASE_URL']+'/rest/v1/rpc/attendance_reference_retention',data=b'{}',headers={'apikey':env['SUPABASE_SECRET_KEY'],'Authorization':'Bearer '+env['SUPABASE_SECRET_KEY'],'Content-Type':'application/json'})
   with urllib.request.urlopen(req,timeout=5) as response:keep=set(json.load(response))
   for path in STORE.iterdir():
    if path.stem not in keep and time.time()-path.stat().st_mtime>120:path.unlink()
   last_cleanup=time.monotonic()
  except Exception:pass # Do not expose secrets or delete on an unavailable authorization service.
