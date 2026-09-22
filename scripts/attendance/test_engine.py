"""Real installed models and authorized synthetic adult photographs only."""
import unittest
from pathlib import Path
from engine import Engine
ROOT=Path(__file__).resolve().parents[2]/'test-assets/attendance-recognition'
class EngineTest(unittest.TestCase):
 @classmethod
 def setUpClass(cls):cls.engine=Engine()
 def test_genuine_distinct_photo_and_ambiguous_references(self):
  vector=self.engine.reference((ROOT/'subject-01/reference/reference.jpg').read_bytes())
  raw=(ROOT/'subject-01/sessions/session-01.jpg').read_bytes()
  self.assertEqual(self.engine.match(raw,{'enrolled':vector})[0]['status'],'matched')
  # Adversarial identical candidate templates tests rejection, not twin accuracy.
  self.assertEqual(self.engine.match(raw,{'first':vector,'second':vector})[0]['status'],'ambiguous')
 def test_invalid_and_heic(self):
  for raw in [b'not-an-image',b'\x00\x00\x00\x20ftypheic'+b'\x00'*40]:
   with self.assertRaisesRegex(ValueError,'Use '):self.engine.decode(raw)
 def test_unknown_face_is_not_enrolled(self):
  refs={f'subject-{n:02}':self.engine.reference((ROOT/f'subject-{n:02}/reference/reference.jpg').read_bytes()) for n in [1,2]}
  result=self.engine.match((ROOT/'group-sessions/group-unknown.jpg').read_bytes(),refs)
  self.assertEqual(sum(r['status']=='matched' for r in result),2)
  self.assertEqual(sum(r['status']=='not_identified' for r in result),1)
if __name__=='__main__':unittest.main()
