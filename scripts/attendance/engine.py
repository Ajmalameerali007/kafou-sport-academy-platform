"""Local synthetic evaluation only. No network, gallery or age/trait inference.
SFace 2021dec / YuNet 2023mar; thresholds are experimental, not child validation.
"""
from pathlib import Path
from io import BytesIO
import cv2, numpy as np
import hashlib
from PIL import Image, ImageOps, UnidentifiedImageError
MODEL_DIR=Path(__file__).resolve().parents[2]/'.attendance-local/models'
class Engine:
 def __init__(self):
  for name,expected in {'yunet.onnx':'8f2383e4dd3cfbb4553ea8718107fc0423210dc964f9f4280604804ed2552fa4','sface.onnx':'0ba9fbfa01b5270c96627c4ef784da859931e02f04419c829e83484087c34e79'}.items():
   if hashlib.sha256((MODEL_DIR/name).read_bytes()).hexdigest()!=expected:raise RuntimeError('Reviewed model checksum mismatch')
  self.detector=cv2.FaceDetectorYN.create(str(MODEL_DIR/'yunet.onnx'),'',(320,320),0.9,0.3,100)
  self.recognizer=cv2.FaceRecognizerSF.create(str(MODEL_DIR/'sface.onnx'),'')
 def decode(self,raw):
  if not raw or len(raw)>8*1024*1024: raise ValueError('Use a photo smaller than 8 MB.')
  if raw[4:8]==b'ftyp' and any(x in raw[8:40] for x in (b'heic',b'heix',b'hevc',b'mif1')): raise ValueError('Use JPEG, PNG or WebP. Export HEIC as JPEG first.')
  try: opened=Image.open(BytesIO(raw))
  except (UnidentifiedImageError,Image.DecompressionBombError): raise ValueError('Use a valid JPEG, PNG or WebP photograph.')
  with opened as im:
   if im.format not in ('JPEG','PNG','WEBP'): raise ValueError('Use JPEG, PNG or WebP. Export HEIC as JPEG first.')
   if getattr(im,'n_frames',1)!=1: raise ValueError('Use a still photograph.')
   w,h=im.size
   if min(w,h)<128 or max(w,h)>8192 or w*h>24_000_000: raise ValueError('Use a photo between 128 and 8192 pixels, up to 24 megapixels.')
   im=ImageOps.exif_transpose(im).convert('RGB');im.thumbnail((2400,2400))
   normalized=BytesIO();im.save(normalized,'JPEG',quality=90)
   return cv2.cvtColor(np.array(im),cv2.COLOR_RGB2BGR),normalized.getvalue()
 def faces(self,image):
  self.detector.setInputSize((image.shape[1],image.shape[0]));_,faces=self.detector.detect(image)
  results=[]
  for face in ([] if faces is None else faces):
   crop=self.recognizer.alignCrop(image,face)
   blur=float(cv2.Laplacian(cv2.cvtColor(crop,cv2.COLOR_BGR2GRAY),cv2.CV_64F).var())
   quality=min(face[2:4])>=64 and blur>=40
   embedding=None
   if quality:
    vec=self.recognizer.feature(crop).flatten();vec=vec/np.linalg.norm(vec);embedding=vec.tolist()
   results.append({'box':[float(x) for x in face[:4]],'quality':quality,'blur':round(blur,2),'embedding':embedding})
  return results
 def reference(self,raw):
  image,_=self.decode(raw);faces=self.faces(image)
  if len(faces)!=1: raise ValueError('Use a clear reference with exactly one face.')
  if not faces[0]['quality']: raise ValueError('Reference photo unclear. Use a closer, sharp front-facing photograph.')
  return faces[0]['embedding']
 def match(self,raw,references,threshold=0.60,margin=0.12):
  image,_=self.decode(raw);faces=self.faces(image);results=[]
  for face in faces:
   result={'status':'photo_unclear'}
   if face['quality']:
    scores=sorted([(float(np.dot(face['embedding'],ref)),key) for key,ref in references.items()],reverse=True)
    result={'status':'not_identified'}
    if scores:
     first=scores[0];gap=first[0]-(scores[1][0] if len(scores)>1 else -1)
     result={'status':'not_identified','score':round(first[0],5),'separation':round(gap,5)}
     if first[0]>=threshold:
      result['status']='matched' if gap>=margin else 'ambiguous'
      if result['status']=='matched':result['reference']=first[1]
   results.append(result)
  # A single reference cannot explain two faces in one photograph.
  for r in results:
   if r.get('reference') and sum(x.get('reference')==r['reference'] for x in results)>1:
    key=r['reference']
    for x in results:
     if x.get('reference')==key:x.pop('reference');x['status']='ambiguous'
  return results
