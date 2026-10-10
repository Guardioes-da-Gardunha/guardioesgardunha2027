#!/usr/bin/env python3
"""Emulador mínimo do Supabase (GoTrue anónimo + PostgREST) para testar a app contra um Postgres local.
Usa `psql` e o esquema real (supabase/schema.sql). Só serve para testes.
Uso: python3 tests/emulator.py [porta]   (variáveis: PGHOST PGPORT PGUSER PGDATABASE)"""
import base64, json, os, re, subprocess, sys, time, uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs, unquote

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 54321
PSQL = ['psql', '-h', os.environ.get('PGHOST', '/tmp/pgdata'), '-p', os.environ.get('PGPORT', '5433'), '-U', os.environ.get('PGUSER', 'postgres'), '-d', os.environ.get('PGDATABASE', 't'), '-At', '-q', '-v', 'VERBOSITY=verbose']
SECRET = b'emulador'
REFRESH = {}
LOG = []

def b64(b): return base64.urlsafe_b64encode(b).rstrip(b'=').decode()
def mint(sub, ttl=3600):
    h = b64(json.dumps({'alg': 'HS256', 'typ': 'JWT'}).encode())
    p = b64(json.dumps({'sub': sub, 'role': 'authenticated', 'is_anonymous': True, 'exp': int(time.time()) + ttl}).encode())
    return f'{h}.{p}.{b64(b"sig")}'
def claims(tok):
    try: return json.loads(base64.urlsafe_b64decode(tok.split('.')[1] + '=='))
    except Exception: return {}
def lit(v): return "'" + str(v).replace("'", "''") + "'"
def ident_ok(s): return re.fullmatch(r'[a-z_]+', s) is not None

def run(role, sub, sql):
    pre = f"set role {role}; " + (f"select set_config('request.jwt.claim.sub', {lit(sub)}, false); " if sub else '')
    # psql -c envia tudo numa só mensagem; só o resultado do último comando é impresso
    p = subprocess.run(PSQL + ['-c', pre + sql], capture_output=True, text=True)
    if p.returncode != 0:
        m = re.search(r'ERROR:\s+(\w{5}):\s+(.*)', p.stderr)
        code, msg = (m.group(1), m.group(2).strip()) if m else ('XX000', p.stderr.strip())
        raise PgError(code, msg)
    lines = p.stdout.split('\n')
    if lines and lines[-1] == '': lines.pop()
    return lines[-1] if lines else ''

class PgError(Exception):
    def __init__(s, code, msg): s.code, s.msg = code, msg

class H(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def _send(self, status, body=None):
        raw = b'' if body is None else json.dumps(body).encode()
        self.send_response(status)
        for k, v in {'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, prefer, x-client-info', 'Access-Control-Allow-Methods': '*', 'Content-Type': 'application/json'}.items(): self.send_header(k, v)
        self.send_header('Content-Length', str(len(raw))); self.end_headers(); self.wfile.write(raw)
    def do_OPTIONS(self): self._send(204)
    def _who(self):
        a = self.headers.get('Authorization', '')
        tok = a[7:] if a.startswith('Bearer ') else ''
        c = claims(tok)
        if c.get('role') == 'authenticated' and c.get('sub'):
            if c.get('exp', 0) < time.time(): raise PgError('PGRST301', 'JWT expired')
            return 'authenticated', c['sub']
        return 'anon', None
    def _body(self):
        n = int(self.headers.get('Content-Length') or 0)
        return json.loads(self.rfile.read(n) or b'null') if n else None
    def handle_any(self, method):
        u = urlparse(self.path); q = {k: v[0] for k, v in parse_qs(u.query, keep_blank_values=True).items()}
        LOG.append((method, u.path, q))
        try:
            if u.path == '/auth/v1/signup' and method == 'POST':
                self._body(); sub = str(uuid.uuid4()); rt = uuid.uuid4().hex; REFRESH[rt] = sub
                return self._send(200, {'access_token': mint(sub), 'refresh_token': rt, 'expires_in': 3600, 'token_type': 'bearer', 'user': {'id': sub, 'is_anonymous': True}})
            if u.path == '/auth/v1/token' and method == 'POST':
                b = self._body() or {}; sub = REFRESH.get(b.get('refresh_token'))
                if not sub: return self._send(400, {'error_code': 'refresh_token_not_found', 'msg': 'Invalid Refresh Token'})
                rt = uuid.uuid4().hex; REFRESH[rt] = sub
                return self._send(200, {'access_token': mint(sub), 'refresh_token': rt, 'expires_in': 3600})
            role, sub = self._who()
            m = re.fullmatch(r'/rest/v1/rpc/([a-z_]+)', u.path)
            if m and method == 'POST':
                fn = m.group(1)
                if not ident_ok(fn) or fn.startswith('_') or fn == 'set_admin_secret': return self._send(404, {'message': 'not found'})
                args = self._body() or {}
                a = ', '.join(f'{k} := {lit(v)}' + ('::uuid' if k == 'p_member' else '') for k, v in args.items())
                out = run(role, sub, f'select to_json({fn}({a}))::jsonb::text')
                return self._send(200, json.loads(out) if out not in ('', 'null') else None)
            if u.path == '/rest/v1/docs':
                if method == 'GET':
                    cols = [c for c in q.get('select', 'col,id,data,deleted,updated_at').split(',') if c in ('col', 'id', 'data', 'deleted', 'updated_at')]
                    where = []
                    for k in ('col', 'id', 'deleted', 'updated_at'):
                        if k in q:
                            op, val = q[k].split('.', 1)
                            sqlop = {'eq': '=', 'gt': '>'}[op]
                            where.append(f"{k} {sqlop} {lit(val)}" + ('::timestamptz' if k == 'updated_at' else '::boolean' if k == 'deleted' else ''))
                    order = ''
                    if 'order' in q:
                        f, d = q['order'].split('.'); order = f' order by {f if f in ("id","updated_at","col") else "id"} {"desc" if d == "desc" else "asc"}'
                    sql = f"select coalesce(json_agg(t), '[]'::json)::jsonb::text from (select {','.join(cols)} from docs{(' where ' + ' and '.join(where)) if where else ''}{order} limit {int(q.get('limit', 1000))} offset {int(q.get('offset', 0))}) t"
                    return self._send(200, json.loads(run(role, sub, sql)))
                if method == 'POST':
                    b = self._body()
                    sql = f"insert into docs(col,id,data,deleted) values ({lit(b['col'])},{lit(b['id'])},{lit(json.dumps(b['data']))}::jsonb,{'true' if b.get('deleted') else 'false'}) on conflict (col,id) do update set data = excluded.data, deleted = excluded.deleted"
                    run(role, sub, sql); return self._send(201, None)
                if method == 'PATCH':
                    b = self._body(); wh = []
                    for k in ('col', 'id'):
                        if k in q: wh.append(f"{k} = {lit(q[k].split('.',1)[1])}")
                    run(role, sub, f"update docs set deleted = {'true' if b.get('deleted') else 'false'} where {' and '.join(wh)}"); return self._send(204)
            return self._send(404, {'message': 'não implementado: ' + u.path})
        except json.JSONDecodeError as e:
            return self._send(500, {'message': 'json: ' + str(e)})
        except PgError as e:
            return self._send(401 if e.code == 'PGRST301' else 403 if e.code == '42501' else 400, {'code': e.code, 'message': e.msg})
    def do_GET(self):
        if self.path == '/__log': return self._send(200, [list(x) for x in LOG[-200:]])
        self.handle_any('GET')
    def do_POST(self): self.handle_any('POST')
    def do_PATCH(self): self.handle_any('PATCH')

if __name__ == '__main__':
    ThreadingHTTPServer(('127.0.0.1', PORT), H).serve_forever()
