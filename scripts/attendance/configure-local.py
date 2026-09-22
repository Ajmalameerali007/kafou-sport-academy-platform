"""Explicit local-only provision; never prints secrets or touches hosted data."""
from pathlib import Path
import secrets,subprocess,os
root=Path(__file__).resolve().parents[2];env=root/'.env.local';text=env.read_text()
if 'SUPABASE_URL=http://127.0.0.1:56321' not in text:raise SystemExit('Known local database required')
keyfile=root/'.attendance-local/key'
if not keyfile.exists():keyfile.write_text(secrets.token_hex(32));os.chmod(keyfile,0o600)
key=keyfile.read_text().strip()
lines=[l for l in text.splitlines() if not l.startswith('ATTENDANCE_LOCAL_KEY=')];env.write_text('\n'.join(lines)+f'\nATTENDANCE_LOCAL_KEY={key}\n')
subprocess.run(['docker','exec','-i','supabase_db_kafou-local','psql','-U','supabase_admin','-d','postgres','-v','ON_ERROR_STOP=1'],input=f"insert into private.attendance_engine_key(secret) values('{key}') on conflict(id) do update set secret=excluded.secret;",text=True,check=True,stdout=subprocess.DEVNULL)
print('Local synthetic engine signing configured; no external providers activated.')
