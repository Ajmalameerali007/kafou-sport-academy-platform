from engine import Engine,MODEL_DIR
from pathlib import Path
import json,time,hashlib
root=MODEL_DIR.parents[1]/'test-assets/attendance-recognition';e=Engine()
refs={key:e.reference((root/key/'reference/reference.jpg').read_bytes()) for key in ['subject-01','subject-02']}
result={'model':'SFace 2021dec / YuNet 2023mar','model_sha256':{p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in MODEL_DIR.glob('*.onnx')},'threshold':0.60,'margin':0.12,'synthetic_adults_only':True,'images':[]}
for p in sorted(root.glob('**/*.jpg')):
 if '/reference/' in str(p):continue
 start=time.perf_counter();matches=e.match(p.read_bytes(),refs)
 result['images'].append({'image':str(p.relative_to(root)),'milliseconds':round((time.perf_counter()-start)*1000,1),'faces':matches})
print(json.dumps(result,indent=2))
