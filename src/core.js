/* ===== Motor: leitura de GPX, deteção de segmentos, tempos e pontos ===== */
const LAT0 = 40.14, LON0 = -7.50;               // origem local (Fundão / Gardunha)
const KX = 111320 * Math.cos(LAT0 * Math.PI / 180), KY = 110540;
function proj(lat, lon) { return [(lon - LON0) * KX, (lat - LAT0) * KY]; }
function unproj(x, y) { return [LAT0 + y / KY, LON0 + x / KX]; }

/* GPX -> {name, type, pts:[{x,y,lat,lon,ele,t,hr}]} (t em segundos epoch; null se não houver hora) */
function parseGPX(text) {
  const out = { name: '', type: '', pts: [] };
  const nm = /<trk>[\s\S]*?<name>([\s\S]*?)<\/name>/.exec(text) || /<metadata>[\s\S]*?<name>([\s\S]*?)<\/name>/.exec(text);
  if (nm) out.name = nm[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim();
  const ty = /<type>([\s\S]*?)<\/type>/.exec(text); if (ty) out.type = ty[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim().toLowerCase();
  const re = /<(?:trkpt|rtept)\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:trkpt|rtept)>)/g; let m;
  while ((m = re.exec(text))) {
    const a = m[1], body = m[2] || '';
    const la = /lat\s*=\s*["']([-\d.eE]+)["']/.exec(a), lo = /lon\s*=\s*["']([-\d.eE]+)["']/.exec(a);
    if (!la || !lo) continue;
    const lat = parseFloat(la[1]), lon = parseFloat(lo[1]); if (!isFinite(lat) || !isFinite(lon)) continue;
    const el = /<ele>([-\d.eE]+)<\/ele>/.exec(body), tm = /<time>([^<]+)<\/time>/.exec(body), hr = /<(?:\w+:)?hr>(\d+)<\/(?:\w+:)?hr>/.exec(body);
    const [x, y] = proj(lat, lon);
    out.pts.push({ x, y, lat, lon, ele: el ? parseFloat(el[1]) : null, t: tm ? Date.parse(tm[1]) / 1000 : null, hr: hr ? parseInt(hr[1], 10) : null });
  }
  return out;
}
function cumDist(pts) { const c = [0]; for (let i = 1; i < pts.length; i++) c.push(c[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y)); return c; }

/* ponto a segmento: devolve {d, f} (distância e fração ao longo de a->b) */
function ptSeg(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy;
  let f = L2 ? ((px - ax) * dx + (py - ay) * dy) / L2 : 0; f = Math.max(0, Math.min(1, f));
  return { d: Math.hypot(px - (ax + f * dx), py - (ay + f * dy)), f };
}
/* distância mínima de um ponto a uma polilinha [[x,y],...] */
function distToPoly(px, py, poly) { let m = Infinity; for (let i = 1; i < poly.length; i++) { const r = ptSeg(px, py, poly[i - 1][0], poly[i - 1][1], poly[i][0], poly[i][1]).d; if (r < m) m = r; } return m; }

/* instante em que a atividade passa mais perto de (px,py), perto do índice i */
function crossTime(pts, i, px, py) {
  let best = null;
  for (const k of [i - 1, i]) {
    if (k < 0 || k + 1 >= pts.length) continue;
    const r = ptSeg(px, py, pts[k].x, pts[k].y, pts[k + 1].x, pts[k + 1].y);
    if (!best || r.d < best.d) best = { d: r.d, k, f: r.f };
  }
  if (!best) return pts[i].t;
  const a = pts[best.k], b = pts[best.k + 1]; return a.t + (b.t - a.t) * best.f;
}

/* trace: lista plana [lat,lon,lat,lon...] -> polilinha projetada */
function tracePoly(flat) { const p = []; for (let i = 0; i + 1 < flat.length; i += 2) p.push(proj(flat[i], flat[i + 1])); return p; }
function polyLen(p) { let L = 0; for (let i = 1; i < p.length; i++) L += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]); return L; }
function resamplePoly(p, step) { // pontos de referência a cada ~step metros
  const out = [p[0]]; let acc = 0;
  for (let i = 1; i < p.length; i++) { acc += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]); if (acc >= step) { out.push(p[i]); acc = 0; } }
  out.push(p[p.length - 1]); return out;
}

/* Deteta passagens de uma atividade por um segmento.
   act: resultado de parseGPX (com tempos); trace: lista plana; opts.R: tolerância em metros */
function detectSegment(act, trace, opts) {
  const R = (opts && opts.R) || 25, pts = act.pts;
  const poly = tracePoly(trace); if (poly.length < 2 || pts.length < 2) return [];
  const S = poly[0], E = poly[poly.length - 1], refLen = polyLen(poly), cum = cumDist(pts), refs = resamplePoly(poly, 20);
  function runs(P) { // mínimos locais de cada passagem a menos de R do ponto P
    const r = []; let best = -1, bd = Infinity;
    for (let i = 0; i < pts.length; i++) {
      const d = Math.hypot(pts[i].x - P[0], pts[i].y - P[1]);
      if (d <= R) { if (d < bd) { bd = d; best = i; } }
      else if (best >= 0) { r.push(best); best = -1; bd = Infinity; }
    }
    if (best >= 0) r.push(best); return r;
  }
  const rs = runs(S), re = runs(E), found = [];
  for (const s of rs) {
    let pick = null;
    for (const e of re) {
      if (e <= s) continue;
      const L = cum[e] - cum[s];
      if (L < refLen * 0.8 - 2 * R || L > refLen * 1.4 + 2 * R) continue;
      // cobertura: cada vértice de referência tem de ter um ponto da atividade por perto
      let ok = 0, tot = refs.length;
      const step = Math.max(1, Math.floor((e - s) / 400));
      for (const rp of refs) {
        let m = Infinity; for (let k = s; k <= e; k += step) { const d = Math.hypot(pts[k].x - rp[0], pts[k].y - rp[1]); if (d < m) m = d; if (m <= R * 1.2) break; }
        if (m <= R * 1.6) ok++;
      }
      const cover = ok / tot; if (cover < 0.9) continue;
      // fidelidade: pontos da atividade perto da referência
      let sum = 0, n = 0; for (let k = s; k <= e; k += Math.max(1, Math.floor((e - s) / 60))) { sum += distToPoly(pts[k].x, pts[k].y, poly); n++; }
      const mean = sum / n; if (mean > R * 0.9) continue;
      const score = Math.abs(L - refLen) / refLen + mean / R;
      if (!pick || score < pick.score) pick = { e, L, cover, mean, score };
    }
    if (pick) {
      const e = pick.e; if (pts[s].t == null || pts[e].t == null) continue;
      const t0 = crossTime(pts, s, S[0], S[1]), t1 = crossTime(pts, e, E[0], E[1]); const t = t1 - t0; if (!(t > 0)) continue;
      let hs = 0, hn = 0, gmax = 0; for (let k = s; k <= e; k++) { if (pts[k].hr) { hs += pts[k].hr; hn++; } }
      for (let k = s + 1; k <= e; k++) { const dt = pts[k].t - pts[k - 1].t; if (dt > 0) gmax = Math.max(gmax, (cum[k] - cum[k - 1]) / dt); }
      found.push({ s, e, t: Math.round(t * 10) / 10, st: Math.round(t0), len: pick.L, hr: hn ? Math.round(hs / hn) : null, vmax: gmax, cover: pick.cover });
    }
  }
  // remove passagens sobrepostas, fica a mais rápida
  found.sort((a, b) => a.t - b.t); const keep = [];
  for (const f of found) if (!keep.some(k => !(f.e < k.s || f.s > k.e))) keep.push(f);
  return keep.sort((a, b) => a.s - b.s);
}

/* suspeita: devolve texto ou null */
function suspicion(pass, seg, mod, cfg) {
  const v = pass.len / pass.t;
  const lim = mod === 'b' ? ((cfg && cfg.maxBike) || 17) : ((cfg && cfg.maxRun) || 6.5);
  if (v > lim) return mod === 'b' ? 'velocidade média alta para ciclismo' : 'velocidade média incompatível com corrida';
  if (pass.vmax > 30) return 'salto de GPS';
  return null;
}

/* Sugestão de janelas num GPX de referência: procura troços com distância e desnível parecidos aos do segmento */
function suggestWindows(act, seg) {
  const pts = act.pts, n = pts.length; if (n < 3) return [];
  const cum = cumDist(pts), D = seg.dist, hasEle = pts.every(p => p.ele != null);
  let up = [0], dn = [0];
  if (hasEle) { // altitude suavizada (média móvel de 5)
    const sm = pts.map((_, i) => { let s = 0, c = 0; for (let k = Math.max(0, i - 2); k <= Math.min(n - 1, i + 2); k++) { s += pts[k].ele; c++; } return s / c; });
    for (let i = 1; i < n; i++) { const d = sm[i] - sm[i - 1]; up.push(up[i - 1] + (d > 0 ? d : 0)); dn.push(dn[i - 1] + (d < 0 ? -d : 0)); }
  }
  const desc = seg.tipo === 'Descida', target = seg.desn, best = [];
  // para cada início i, só a melhor janela (sem criar objetos por candidato: rápido mesmo em atividades de horas)
  let j = 0;
  for (let i = 0; i < n - 1; i++) {
    if (j < i) j = i;
    while (j < n - 1 && cum[j] - cum[i] < D * 0.9) j++;
    let bs = Infinity, bk = -1;
    for (let k = j; k < n && cum[k] - cum[i] <= D * 1.1; k++) {
      let score = Math.abs(cum[k] - cum[i] - D) / D * 2;
      if (hasEle) { const g = desc ? dn[k] - dn[i] : up[k] - up[i]; score += Math.abs(g - target) / Math.max(target, 20); }
      if (score < bs) { bs = score; bk = k; }
    }
    if (bk >= 0) best.push({ i, j: bk, score: bs, len: cum[bk] - cum[i] });
  }
  best.sort((a, b) => a.score - b.score); const out = [];
  for (const c of best) { if (out.length >= 4) break; if (out.every(o => c.j < o.i || c.i > o.j)) out.push(c); }
  return out;
}

/* troço -> lista plana [lat,lon,...] com ~step m entre pontos, 5 casas decimais */
function sliceToTrace(pts, i, j, step) {
  const flat = []; let acc = 0, last = null; const r = v => Math.round(v * 1e5) / 1e5;
  for (let k = i; k <= j; k++) {
    if (last) acc += Math.hypot(pts[k].x - last.x, pts[k].y - last.y);
    if (k === i || k === j || acc >= (step || 8)) { flat.push(r(pts[k].lat), r(pts[k].lon)); acc = 0; }
    last = pts[k];
  }
  return flat;
}

/* ===== Rankings e pontos ===== */
const RATE = { c: 'corrida', b: 'bicicleta' };
function attemptValid(a) { return !a.fl || a.ap; }
/* efforts: docs {a,s,h:[tentativas]}; devolve melhor tentativa válida por atleta no segmento, filtrando modalidade */
function bestPerAthlete(efforts, segN, mod) {
  const out = [];
  for (const d of efforts) {
    if (d.s !== segN) continue;
    let b = null;
    for (const a of d.h || []) { if (!attemptValid(a)) continue; if (mod && mod !== 'all' && a.mod !== mod) continue; if (!b || a.t < b.t || (a.t === b.t && a.st < b.st)) b = a; }
    if (b) out.push({ a: d.a, s: d.s, ...b });
  }
  out.sort((x, y) => x.t - y.t || x.st - y.st); return out;
}
/* classificação conforme o Regulamento (Art. 4, 5, 6 e 9).
   efforts: [{a, s, h:[{t, st, mod, fl, ap}]}] (já sem tentativas rejeitadas e dentro do período)
   athletes: [{id, g:'M'|'F', nasc, treinos, extra}]; cfg: podium, checkin, halfAt, halfBonus, allAt, allBonus,
   treinoPts, treinoMax, steal, podiumBy ('genero'|'todos'), mod ('b'|'c'|'all') */
/* Pontuação 2027 (Art. 5):
   pódio mensal por caminho e género 8/5/3 · check-in 1 por tentativa, até 3 por caminho em cada mês ·
   completismo metade 16 / todos 32 · roubos acumuláveis: líder do mês +3, Guardião da época +5,
   Guardião de Todos os Tempos +8 (uma vez por caminho) · Dias de Ataque 8 por presença, até 40.
   month: 'all' (época) ou 'AAAA-MM' — os pontos contam no mês em que foram ganhos. */
function monthKey(st) { const d = new Date(st * 1000); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); }
function computePoints(efforts, segs, athletes, cfg, mod, month) {
  cfg = cfg || {}; const P = cfg.podium || [8, 5, 3], CI = cfg.checkin != null ? cfg.checkin : 1, CIM = cfg.checkinMax != null ? cfg.checkinMax : 3;
  const SM = cfg.stealMonth != null ? cfg.stealMonth : 3, SA = cfg.stealSeason != null ? cfg.stealSeason : 5, SL = cfg.stealLegend != null ? cfg.stealLegend : 8;
  const mk = cfg.monthOf || monthKey, M = month && month !== 'all' ? month : null, inM = m => !M || m === M;
  const byId = {}, rows = {};
  for (const a of athletes) { byId[a.id] = a; rows[a.id] = { id: a.id, done: 0, pod: 0, chk: 0, byTipo: { Subida: 0, Descida: 0, Cumeada: 0, Loop: 0 }, wins: 0, mWins: 0, steals: 0, stM: 0, stA: 0, lendas: 0, stl: 0, lpts: 0 }; }
  const grp = id => cfg.podiumBy === 'todos' ? 'T' : ((byId[id] && byId[id].g) || 'M');
  const addT = (row, tipo, v) => { if (row.byTipo[tipo] == null) row.byTipo[tipo] = 0; row.byTipo[tipo] += v; };
  for (const sg of segs) {
    const att = [];
    for (const d of efforts) { if (d.s !== sg.n || !rows[d.a]) continue; for (const a of d.h || []) { if (!attemptValid(a)) continue; if (mod && mod !== 'all' && a.mod !== mod) continue; att.push({ a: d.a, t: a.t, st: a.st, m: mk(a.st) }); } }
    att.sort((x, y) => x.st - y.st || x.t - y.t);
    // concluído + check-in (1 por tentativa, até ao limite por caminho e por mês)
    const seen = {}, ciPts = {};
    for (const x of att) { const r = rows[x.a]; if (inM(x.m) && !seen[x.a]) { seen[x.a] = 1; r.done++; }
      const ck = x.a + '|' + x.m, got = ciPts[ck] || 0; if (got < CIM) { const v = Math.min(CI, CIM - got); ciPts[ck] = got + v; if (inM(x.m)) { r.chk += v; addT(r, sg.tipo, v); } } }
    // pódio mensal: melhor tempo de cada atleta em cada mês, por género
    const best = {};
    for (const x of att) { const k = x.m + '|' + x.a, b = best[k]; if (!b || x.t < b.t) best[k] = x; }
    const byMG = {};
    for (const x of Object.values(best)) { if (!inM(x.m)) continue; const k = x.m + '|' + grp(x.a); (byMG[k] = byMG[k] || []).push(x); }
    for (const L of Object.values(byMG)) { L.sort((x, y) => x.t - y.t || x.st - y.st); L.slice(0, P.length).forEach((x, i) => { const r = rows[x.a], v = P[i] || 0; r.pod += v; addT(r, sg.tipo, v); if (i === 0) r.mWins++; }); }
    // roubos, por ordem cronológica
    const leadM = {}, leadA = {}, legend = {}, ref = sg.gtt || {};
    for (const x of att) { const g = grp(x.a), r = rows[x.a], cnt = inM(x.m);
      const kM = x.m + '|' + g, LM = leadM[kM];
      if (!LM || x.t < LM.t) { if (LM && LM.a !== x.a && cnt) { r.stM++; r.steals++; r.stl += SM; } leadM[kM] = { a: x.a, t: x.t }; }
      const LA = leadA[g];
      if (!LA || x.t < LA.t) { if (LA && LA.a !== x.a && cnt) { r.stA++; r.steals++; r.stl += SA; } leadA[g] = { a: x.a, t: x.t }; }
      const R = cfg.podiumBy === 'todos' ? null : ref[g];
      if (R && R.t && x.t < R.t && !legend[x.a]) { legend[x.a] = 1; if (cnt) { r.lendas++; r.steals++; r.lpts += SL; r.stl += SL; } } }
    // bordões guardados: líder da época (ou do mês, na vista mensal)
    if (M) { for (const L of Object.values(byMG)) if (L.length) rows[L[0].a].wins++; }
    else for (const L of Object.values(leadA)) rows[L.a].wins++;
  }
  const allAt = cfg.allAt || segs.length;
  for (const r of Object.values(rows)) {
    const ath = byId[r.id] || {};
    r.bonus = 0; r.treinos = ath.treinos || 0; r.trn = 0; r.extra = 0;
    if (!M) {
      if (allAt && r.done >= allAt) r.bonus = cfg.allBonus != null ? cfg.allBonus : 32; else if (cfg.halfAt && r.done >= cfg.halfAt) r.bonus = cfg.halfBonus != null ? cfg.halfBonus : 16;
      r.trn = Math.min(r.treinos * (cfg.treinoPts != null ? cfg.treinoPts : 8), cfg.treinoMax != null ? cfg.treinoMax : 40);
      r.extra = ath.extra || 0;
    }
    r.total = r.pod + r.chk + r.bonus + r.trn + r.stl + r.extra;
  }
  return Object.values(rows);
}
/* subida e descida acumuladas entre i e j, com histerese (ignora oscilações menores que thr metros) */
function climbStats(e, i, j, thr) {
  thr = thr == null ? 3 : thr; let up = 0, dn = 0, ref = e[i];
  for (let k = i + 1; k <= j; k++) { const d = e[k] - ref; if (d >= thr) { up += d; ref = e[k]; } else if (d <= -thr) { dn -= d; ref = e[k]; } }
  return { up, dn };
}
/* perfil, desnível, inclinação e dificuldade (1–5) de um troço: L metros, up/dn acumulados, gap = distância entre partida e chegada */
function classifySeg(L, up, dn, gap) {
  let tipo;
  if (L > 300 && gap < Math.max(50, Math.min(L * 0.05, 150))) tipo = 'Loop';
  else if (up > 0 && up >= 2 * dn) tipo = 'Subida';
  else if (dn > 0 && dn >= 2 * up) tipo = 'Descida';
  else tipo = 'Cumeada';
  const desn = tipo === 'Descida' ? dn : tipo === 'Subida' ? up : Math.max(up, dn);
  const g = L > 0 ? desn / L : 0; let s, nivel;
  if (tipo === 'Subida') { s = desn * g; nivel = s < 8 ? 1 : s < 15 ? 2 : s < 35 ? 3 : s < 60 ? 4 : 5; }
  else if (tipo === 'Descida') { s = g * 100 + desn / 50; nivel = s < 10 ? 1 : s < 16 ? 2 : s < 19 ? 3 : s < 23 ? 4 : 5; }
  else { s = L / 1000 + (up + dn) / 200; nivel = s < 1.5 ? 1 : s < 3 ? 2 : s < 5 ? 3 : s < 8 ? 4 : 5; }
  return { tipo, desn: Math.round(desn), incl: +g.toFixed(4), nivel };
}
/* desempate (Art. 9.2): pontos, segmentos concluídos, coroas, presenças em treinos */
function rankRows(rows, key) { const k = key || (r => r.total); return rows.slice().sort((a, b) => k(b) - k(a) || b.done - a.done || b.wins - a.wins || b.treinos - a.treinos); }
function fmtTime(s) { s = Math.round(s * 10) / 10; const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s - h * 3600 - m * 60; const ss = (sec < 10 ? '0' : '') + sec.toFixed(sec % 1 ? 1 : 0); return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`; }
if (typeof module !== 'undefined') module.exports = { climbStats, classifySeg, monthKey, parseGPX, detectSegment, suggestWindows, sliceToTrace, proj, unproj, bestPerAthlete, computePoints, rankRows, suspicion, fmtTime, tracePoly, polyLen };
