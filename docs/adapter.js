/* Ligação da app ao Supabase, sem bibliotecas externas.
   Expõe window.G27: { db, user, dl, ready } com a mesma forma que a app já usa:
   db.doc(path).get/set/update/delete/onSnapshot · db.collection(col).onSnapshot · user.id()/canEdit()
   Os dados são lidos por "polling" incremental (um pedido leve a cada ~25 s) e guardados em cache no aparelho. */
(function () {
  'use strict';
  var CFG = window.G27_CONFIG || {};
  var BASE = (CFG.url || '').replace(/\/+$/, ''), KEY = CFG.anonKey || '';
  var POLL_MS = CFG.pollMs || 25000, OVERLAP_MS = 60000, PAGE = 1000;
  var PUBLIC_COLS = ['segments', 'athletes', 'config', 'review', 'manual', 'claims', 'efforts'];
  var LS = (function () { try { var k = '__g27'; localStorage.setItem(k, '1'); localStorage.removeItem(k); return localStorage; } catch (e) { return null; } })();
  function lsGet(k) { try { return LS ? JSON.parse(LS.getItem(k)) : null; } catch (e) { return null; } }
  function lsSet(k, v) { try { if (LS) LS.setItem(k, JSON.stringify(v)); } catch (e) { try { LS.removeItem(k); } catch (e2) {} } }
  function lsDel(k) { try { if (LS) LS.removeItem(k); } catch (e) {} }
  function err(code, message, extra) { var e = new Error(message || code); e.code = code; if (extra) e.detail = extra; return e; }

  /* ───────── sessão anónima (GoTrue) ───────── */
  var AUTH_KEY = 'g27-auth', sess = lsGet(AUTH_KEY), signing = null;
  function jwtPayload(t) { try { return JSON.parse(atob(t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))); } catch (e) { return {}; } }
  function saveSess(s) { sess = s; if (s) lsSet(AUTH_KEY, s); else lsDel(AUTH_KEY); }
  function fromAuthResponse(j) { var p = jwtPayload(j.access_token); return { access_token: j.access_token, refresh_token: j.refresh_token, exp: (p.exp || 0) * 1000, uid: p.sub }; }
  async function authCall(path, body) {
    var r = await fetch(BASE + '/auth/v1/' + path, { method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
    var j = await r.json().catch(function () { return {}; });
    if (!r.ok) throw err(j.error_code || j.code || 'auth_' + r.status, j.msg || j.message || j.error_description || 'Falha na autenticação.', j);
    return j;
  }
  async function captchaToken() { return CFG.captcha && window.G27_captcha ? window.G27_captcha() : undefined; }
  async function signInAnon() {
    var tok = await captchaToken();
    var j = await authCall('signup', tok ? { gotrue_meta_security: { captcha_token: tok } } : {});
    saveSess(fromAuthResponse(j)); return sess;
  }
  async function refresh() {
    try { var j = await authCall('token?grant_type=refresh_token', { refresh_token: sess.refresh_token }); saveSess(fromAuthResponse(j)); }
    catch (e) { saveSess(null); who = { member: null, admin: false }; }
    return sess;
  }
  /* devolve a sessão válida, a criar uma nova (anónima) se ainda não existir e create=true */
  async function session(create) {
    if (signing && (create || !sess)) { try { await signing; } catch (e) {} }
    if (sess && sess.exp - Date.now() < 60000) {
      if (!signing) signing = refresh().then(function () { signing = null; }, function () { signing = null; });
      await signing;
    }
    if (!sess && create) {
      if (!signing) signing = signInAnon().then(function () { signing = null; }, function (e) { signing = null; throw e; });
      await signing;
    }
    return sess;
  }

  /* ───────── REST (PostgREST) ───────── */
  async function rest(method, path, opt) {
    opt = opt || {};
    var s = await session(!!opt.auth);
    var h = { apikey: KEY, Authorization: 'Bearer ' + (s ? s.access_token : KEY) };
    if (opt.body !== undefined) h['Content-Type'] = 'application/json';
    if (opt.prefer) h.Prefer = opt.prefer;
    var r = await fetch(BASE + '/rest/v1/' + path, { method: method, headers: h, body: opt.body !== undefined ? JSON.stringify(opt.body) : undefined });
    var txt = await r.text(), j = null; try { j = txt ? JSON.parse(txt) : null; } catch (e) {}
    if (!r.ok) {
      var code = j && j.code === '42501' ? 'permission_denied' : j && j.message && /demasiadas_tentativas/.test(j.message) ? 'rate_limited' : j && j.message && /sem_inscricao/.test(j.message) ? 'no_registration' : (j && j.code) || 'http_' + r.status;
      throw err(code, (j && (j.message || j.hint)) || ('Erro ' + r.status), j);
    }
    return j;
  }
  function rpc(name, args) { return rest('POST', 'rpc/' + name, { body: args || {}, auth: true }); }

  /* ───────── identidade ───────── */
  var who = lsGet('g27-who') || { member: null, admin: false };
  async function loadWho() {
    if (!sess) { who = { member: null, admin: false }; return who; }
    try { var w = await rpc('whoami'); who = { member: w.member, admin: !!w.admin }; lsSet('g27-who', who); }
    catch (e) { if (e.code === 'http_401' || /JWT/i.test(e.message)) { saveSess(null); who = { member: null, admin: false }; } }
    return who;
  }

  /* ───────── cache local + polling ───────── */
  var CACHE_KEY = 'g27-cache-v1', cache = { cols: {}, cur: null, uid: null }, loaded = false;
  var listeners = {};            // col -> [{fn, id}]
  var watched = {};              // col -> true
  var pollTimer = null, polling = false;
  var maxTs = null;

  function colMap(col) { return cache.cols[col] || (cache.cols[col] = {}); }
  function bump(ts) { var t = ts ? Date.parse(ts) : NaN; if (isFinite(t) && (!maxTs || t > Date.parse(maxTs))) maxTs = new Date(t).toISOString(); }
  function snapOf(col) {
    var m = colMap(col), ids = Object.keys(m);
    return { docs: ids.map(function (id) { return { id: id, exists: true, data: function () { return structuredClone(m[id]); } }; }), size: ids.length, empty: !ids.length };
  }
  function docSnap(col, id) { var m = colMap(col), has = Object.prototype.hasOwnProperty.call(m, id); return { id: id, exists: has, data: function () { return has ? structuredClone(m[id]) : undefined; } }; }
  function notify(col) {
    (listeners[col] || []).slice().forEach(function (l) { try { l.id == null ? l.fn(snapOf(col)) : l.fn(docSnap(col, l.id)); } catch (e) { console.error(e); } });
  }
  function persist() { lsSet(CACHE_KEY, { cols: cache.cols, cur: maxTs, uid: cache.uid }); }

  async function fetchAll(col) {
    var out = {}, off = 0;
    for (;;) {
      var rows = await rest('GET', 'docs?select=id,data,updated_at&col=eq.' + col + '&deleted=eq.false&order=id.asc&limit=' + PAGE + '&offset=' + off);
      rows.forEach(function (r) { out[r.id] = r.data; bump(r.updated_at); });
      if (rows.length < PAGE) break; off += PAGE;
    }
    return out;
  }
  async function pollOnce() {
    if (polling) return; polling = true;
    try {
      cache._ok = cache._ok || {};
      var cols = Object.keys(watched), fresh = cols.filter(function (c) { return !cache._ok[c]; }), changed = {};
      if (!maxTs && fresh.length) { var st = await rest('POST', 'rpc/server_time', { body: {} }); if (st) bump(new Date(st).toISOString()); }
      for (var i = 0; i < fresh.length; i++) { var c = fresh[i]; cache.cols[c] = await fetchAll(c); cache._ok[c] = true; changed[c] = true; }
      if (maxTs && cols.length > fresh.length) {
        var since = new Date(new Date(maxTs).getTime() - OVERLAP_MS).toISOString(), off = 0;
        for (;;) {
          var rows = await rest('GET', 'docs?select=col,id,data,deleted,updated_at&updated_at=gt.' + encodeURIComponent(since) + '&order=updated_at.asc&limit=' + PAGE + '&offset=' + off);
          rows.forEach(function (r) {
            bump(r.updated_at); if (!watched[r.col]) return;
            var m = colMap(r.col);
            if (r.deleted) { if (r.id in m) { delete m[r.id]; changed[r.col] = true; } }
            else if (JSON.stringify(m[r.id]) !== JSON.stringify(r.data)) { m[r.id] = r.data; changed[r.col] = true; }
          });
          if (rows.length < PAGE) break; off += PAGE;
        }
      }
      var any = false; Object.keys(changed).forEach(function (c) { any = true; notify(c); });
      if (any || fresh.length) persist();
    } catch (e) { console.warn('poll', e); Object.keys(listeners).forEach(function (c) { (listeners[c] || []).forEach(function (l) { if (l.onErr) try { l.onErr(e); } catch (e2) {} }); }); }
    finally { polling = false; }
  }
  function schedule() {
    if (pollTimer) return;
    pollTimer = setInterval(function () { if (!document.hidden) pollOnce(); }, POLL_MS);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) pollOnce(); });
    window.addEventListener('online', function () { pollOnce(); });
  }
  function loadCache() {
    if (loaded) return; loaded = true;
    var c = lsGet(CACHE_KEY);
    if (c && c.cols && c.uid === (who.member || 'anon') + (who.admin ? ':a' : '')) { cache.cols = c.cols; maxTs = c.cur || null; cache._ok = {}; Object.keys(c.cols).forEach(function (k) { cache._ok[k] = true; }); }
    cache.uid = (who.member || 'anon') + (who.admin ? ':a' : '');
  }
  function watch(col, fn, id, onErr) {
    loadCache(); watched[col] = true;
    (listeners[col] = listeners[col] || []).push({ fn: fn, id: id, onErr: onErr });
    // entrega logo o que há em cache (se já tiver) e atualiza
    if (cache._ok && cache._ok[col]) setTimeout(function () { id == null ? fn(snapOf(col)) : fn(docSnap(col, id)); }, 0);
    setTimeout(pollOnce, 0); schedule();
    return function () { listeners[col] = (listeners[col] || []).filter(function (l) { return l.fn !== fn; }); };
  }
  function resetCache() { cache = { cols: {}, cur: null, uid: null }; loaded = false; maxTs = null; lsDel(CACHE_KEY); }

  /* ───────── API estilo "documentos" ───────── */
  function split(path) { var p = String(path).split('/'); if (p.length !== 2) throw err('bad_path', 'Caminho inválido: ' + path); return p; }
  async function put(col, id, data) {
    await rest('POST', 'docs?on_conflict=col,id', { body: { col: col, id: id, data: data, deleted: false }, prefer: 'resolution=merge-duplicates,return=minimal', auth: true });
    var m = colMap(col); m[id] = structuredClone(data); notify(col); persist(); setTimeout(pollOnce, 400);
  }
  async function current(col, id) {
    var m = colMap(col); if (id in m) return m[id];
    var r = await rest('GET', 'docs?select=data,deleted&col=eq.' + col + '&id=eq.' + encodeURIComponent(id), { auth: true });
    return r && r[0] && !r[0].deleted ? r[0].data : null;
  }
  function docRef(path) {
    var pr = split(path), col = pr[0], id = pr[1];
    return {
      id: id, path: path,
      get: async function () { var d = await current(col, id); return { id: id, exists: d != null, data: function () { return d == null ? undefined : structuredClone(d); } }; },
      set: function (d) { return put(col, id, d); },
      update: async function (d) { var cur = await current(col, id); if (cur == null) throw err('not_found', 'Documento inexistente.'); return put(col, id, Object.assign({}, cur, d)); },
      delete: async function () {
        await rest('PATCH', 'docs?col=eq.' + col + '&id=eq.' + encodeURIComponent(id), { body: { deleted: true }, prefer: 'return=minimal', auth: true });
        var m = colMap(col); delete m[id]; notify(col); persist(); setTimeout(pollOnce, 400);
      },
      onSnapshot: function (fn, onErr) { return watch(col, fn, id, onErr); }
    };
  }
  var db = {
    doc: docRef,
    collection: function (col) { return { path: col, onSnapshot: function (fn, onErr) { return watch(col, fn, null, onErr); }, doc: function (id) { return docRef(col + '/' + id); } }; }
  };

  /* ───────── "utilizador": identidade do aparelho, código pessoal, organizador ───────── */
  function setWho(w) { who = { member: w.member || null, admin: !!w.admin }; lsSet('g27-who', who); }
  var user = {
    id: async function () { return who.member; },
    canEdit: async function () { return who.admin; },
    isOwner: async function () { return who.admin; },
    profiles: async function () { return {}; },
    /* garante uma sessão (anónima) e devolve o id do atleta deste aparelho */
    ensure: async function () { await session(true); await loadWho(); return who.member; },
    newCode: async function () { await user.ensure(); return rpc('new_code'); },
    adminNewCode: function (member) { return rpc('admin_new_code', { p_member: member }); },
    /* entra com o código pessoal; devolve true/false */
    loginCode: async function (code) { await user.ensure(); var m = await rpc('login_code', { p_code: code }); if (!m) return false; resetCache(); await loadWho(); return true; },
    claimAdmin: async function (secret) { await user.ensure(); var ok = await rpc('claim_admin', { p_secret: secret }); if (!ok) return false; resetCache(); await loadWho(); return true; },
    leaveAdmin: async function () { await rpc('leave_admin'); resetCache(); await loadWho(); },
    signOut: async function () { saveSess(null); lsDel('g27-who'); who = { member: null, admin: false }; resetCache(); }
  };

  /* ───────── descarregar ficheiros (nativo no navegador) ───────── */
  var dl = {
    native: true,
    save: async function (r) {
      var name = String(r.filename || 'ficheiro'), ext = (name.split('.').pop() || '').toLowerCase();
      var types = { gpx: 'application/gpx+xml', csv: 'text/csv;charset=utf-8', json: 'application/json', zip: 'application/zip', txt: 'text/plain' };
      var blob = r.data instanceof Blob ? r.data : new Blob([r.data], { type: types[ext] || 'application/octet-stream' });
      var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
      return { status: 'saved' };
    }
  };

  var ready = (async function () {
    if (!BASE || !KEY) throw err('no_config', 'Falta configurar o Supabase (config.js).');
    if (sess) await session(false);
    await loadWho();
    return true;
  })();
  window.G27 = { db: db, user: user, dl: dl, ready: ready, PUBLIC_COLS: PUBLIC_COLS, _pollOnce: pollOnce, _resetCache: resetCache };
  // compatibilidade com o código que usa claude.use('db'|'user'|'downloads')
  window.claude = { use: async function (n) { try { await ready; } catch (e) { return null; } return { db: db, user: user, downloads: dl }[n] || null; } };
})();
