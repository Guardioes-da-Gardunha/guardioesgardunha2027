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
/* ---------- outros formatos: TCX, FIT e ZIP ---------- */
function mkPt(lat, lon, ele, t, hr) { const [x, y] = proj(lat, lon); return { x, y, lat, lon, ele: ele == null || !isFinite(ele) ? null : ele, t: t == null || !isFinite(t) ? null : t, hr: hr || null }; }
function parseTCX(text) {
  const out = { name: '', type: '', pts: [] };
  const sp = /<Activity\b[^>]*Sport\s*=\s*["']([^"']+)["']/.exec(text); if (sp) out.type = sp[1].toLowerCase();
  const re = /<Trackpoint>([\s\S]*?)<\/Trackpoint>/g; let m;
  while ((m = re.exec(text))) {
    const b = m[1], la = /<LatitudeDegrees>([-\d.eE]+)</.exec(b), lo = /<LongitudeDegrees>([-\d.eE]+)</.exec(b);
    if (!la || !lo) continue;
    const tm = /<Time>([^<]+)</.exec(b), el = /<AltitudeMeters>([-\d.eE]+)</.exec(b), hr = /<HeartRateBpm>\s*<Value>(\d+)</.exec(b);
    const lat = parseFloat(la[1]), lon = parseFloat(lo[1]); if (!isFinite(lat) || !isFinite(lon)) continue;
    out.pts.push(mkPt(lat, lon, el ? parseFloat(el[1]) : null, tm ? Date.parse(tm[1]) / 1000 : null, hr ? parseInt(hr[1], 10) : null));
  }
  return out;
}
/* FIT (ficheiro original dos relógios): lê as mensagens "record" (posição, hora, altitude, FC) e o desporto */
function parseFIT(buf) {
  const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf), dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  const out = { name: '', type: '', pts: [] };
  if (u8.length < 14) throw new Error('FIT inválido');
  const hs = u8[0], dataSize = dv.getUint32(4, true);
  if (String.fromCharCode(u8[8], u8[9], u8[10], u8[11]) !== '.FIT') throw new Error('FIT inválido');
  const end = Math.min(u8.length, hs + dataSize), defs = {}, SC = 180 / 2147483648, EPOCH = 631065600;
  let p = hs, lastTs = null;
  const SPORT = { 0: 'generic', 1: 'running', 2: 'cycling', 5: 'swimming', 11: 'walking', 17: 'hiking', 21: 'e_biking' };
  const rd = (off, size, base, le) => {
    switch (base & 0x1F) {
      case 0: case 2: case 10: case 13: return size === 1 ? u8[off] : null;          // enum/uint8/uint8z/byte
      case 1: return size === 1 ? dv.getInt8(off) : null;
      case 3: return size === 2 ? dv.getInt16(off, le) : null;
      case 4: case 11: return size === 2 ? dv.getUint16(off, le) : null;
      case 5: return size === 4 ? dv.getInt32(off, le) : null;
      case 6: case 12: return size === 4 ? dv.getUint32(off, le) : null;
      default: return null;
    }
  };
  while (p < end) {
    const h = u8[p++];
    if (h & 0x80) {                                     // cabeçalho com hora comprimida
      const lt = (h >> 5) & 3, off = h & 0x1F, d = defs[lt]; if (!d) throw new Error('FIT: definição em falta');
      if (lastTs != null) { let ts = (lastTs & ~0x1F) + off; if (ts < lastTs) ts += 0x20; lastTs = ts; }
      p = readData(d, p, lastTs); continue;
    }
    const lt = h & 0x0F;
    if (h & 0x40) {                                     // definição
      const le = u8[p + 1] === 0, gm = le ? dv.getUint16(p + 2, true) : dv.getUint16(p + 2, false), nf = u8[p + 4]; p += 5;
      const fields = []; let size = 0;
      for (let i = 0; i < nf; i++) { fields.push({ n: u8[p], s: u8[p + 1], b: u8[p + 2], o: size }); size += u8[p + 1]; p += 3; }
      if (h & 0x20) { const nd = u8[p++]; for (let i = 0; i < nd; i++) { size += u8[p + 1]; p += 3; } }
      defs[lt] = { le, gm, fields, size };
    } else {
      const d = defs[lt]; if (!d) throw new Error('FIT: definição em falta');
      p = readData(d, p, null);
    }
  }
  function readData(d, at, compTs) {
    if (d.gm === 20 || d.gm === 18 || d.gm === 12) {
      const v = {};
      for (const f of d.fields) v[f.n] = rd(at + f.o, f.s, f.b, d.le);
      if (d.gm === 20) {
        let ts = v[253]; if (ts != null && ts !== 0xFFFFFFFF) lastTs = ts; else ts = compTs;
        const la = v[0], lo = v[1];
        if (la != null && lo != null && la !== 0x7FFFFFFF && lo !== 0x7FFFFFFF && ts != null) {
          let ele = null; if (v[78] != null && v[78] !== 0xFFFFFFFF) ele = v[78] / 5 - 500; else if (v[2] != null && v[2] !== 0xFFFF) ele = v[2] / 5 - 500;
          const hr = v[3] != null && v[3] !== 0xFF ? v[3] : null;
          out.pts.push(mkPt(la * SC, lo * SC, ele, ts + EPOCH, hr));
        }
      } else if (v[253] != null && v[253] !== 0xFFFFFFFF) lastTs = v[253];
      const sp = d.gm === 18 ? v[5] : d.gm === 12 ? v[0] : null;
      if (sp != null && sp !== 0xFF && !out.type) out.type = SPORT[sp] || ('sport' + sp);
    } else {
      for (const f of d.fields) if (f.n === 253 && f.s === 4) { const t = d.le ? dv.getUint32(at + f.o, true) : dv.getUint32(at + f.o, false); if (t !== 0xFFFFFFFF) lastTs = t; }
    }
    return at + d.size;
  }
  return out;
}
/* ZIP: devolve a lista de ficheiros {name, method, data} (comprimidos); a descompressão é feita por quem chama */
function zipEntries(buf) {
  const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf), dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  let e = -1; for (let i = u8.length - 22; i >= Math.max(0, u8.length - 65557); i--) if (dv.getUint32(i, true) === 0x06054b50) { e = i; break; }
  if (e < 0) throw new Error('ZIP inválido');
  const n = dv.getUint16(e + 10, true); let p = dv.getUint32(e + 16, true); const out = [];
  for (let k = 0; k < n; k++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break;
    const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true), nl = dv.getUint16(p + 28, true), xl = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), lo = dv.getUint32(p + 42, true);
    const name = new TextDecoder().decode(u8.subarray(p + 46, p + 46 + nl));
    const ds = lo + 30 + dv.getUint16(lo + 26, true) + dv.getUint16(lo + 28, true);
    out.push({ name, method, data: u8.subarray(ds, ds + csize) });
    p += 46 + nl + xl + cl;
  }
  return out;
}
const isZip = u8 => u8.length > 4 && u8[0] === 0x50 && u8[1] === 0x4B && u8[2] === 3 && u8[3] === 4;
const isFit = u8 => u8.length > 12 && u8[8] === 0x2E && u8[9] === 0x46 && u8[10] === 0x49 && u8[11] === 0x54;
/* lê qualquer ficheiro de atividade (GPX, TCX, FIT ou ZIP com um destes). inflateRaw(bytes) -> Promise<Uint8Array> */
async function parseActivity(buf, inflateRaw) {
  let u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  if (isZip(u8)) {
    const es = zipEntries(u8).filter(x => /\.(fit|gpx|tcx)$/i.test(x.name));
    if (!es.length) throw new Error('O ZIP não tem nenhum ficheiro de atividade (.fit, .gpx ou .tcx).');
    const en = es.find(x => /\.fit$/i.test(x.name)) || es[0];
    u8 = en.method === 0 ? en.data : en.method === 8 ? await inflateRaw(en.data) : null;
    if (!u8) throw new Error('Este ZIP usa uma compressão que a página não conhece.');
  }
  if (isFit(u8)) return parseFIT(u8);
  const text = new TextDecoder().decode(u8);
  if (/<TrainingCenterDatabase/i.test(text)) return parseTCX(text);
  return parseGPX(text);
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

/* altitude ao longo de um traçado (lat/lon planos): para cada ponto, a altitude do ponto mais próximo da atividade.
   devolve {ele:[m inteiros], cov: distância média ao ponto usado} ou null se a atividade não tiver altitude */
function traceEle(flat, pts) {
  const P = pts.filter(p => p.ele != null); if (P.length < 2 || !flat || flat.length < 4) return null;
  const cum = [0]; for (let k = 1; k < P.length; k++) cum.push(cum[k - 1] + Math.hypot(P[k].x - P[k - 1].x, P[k].y - P[k - 1].y));
  const near = (x, y, lo, hi) => { let best = Infinity, bk = lo; for (let k = lo; k < hi; k++) { const d = (P[k].x - x) ** 2 + (P[k].y - y) ** 2; if (d < best) { best = d; bk = k; } } return [bk, Math.sqrt(best)]; };
  const raw = [], ds = []; let k0 = -1, px = 0, py = 0;
  for (let i = 0; i + 1 < flat.length; i += 2) {
    const [x, y] = proj(flat[i], flat[i + 1]); let r;
    if (k0 < 0) r = near(x, y, 0, P.length);
    else { // segue a atividade para a frente: não salta para outra volta que passe perto
      const reach = Math.hypot(x - px, y - py) * 3 + 60; let hi = k0; while (hi < P.length - 1 && cum[hi] - cum[k0] <= reach) hi++;
      r = near(x, y, k0, hi + 1); if (r[1] > 60) { const g = near(x, y, 0, P.length); if (g[1] < r[1]) r = g; }
    }
    k0 = r[0]; px = x; py = y; raw.push(P[k0].ele); ds.push(r[1]);
  }
  const n = raw.length, ele = raw.map((_, i) => { let s = 0, c = 0; for (let k = Math.max(0, i - 2); k <= Math.min(n - 1, i + 2); k++) { s += raw[k]; c++; } return Math.round(s / c); });
  return { ele, cov: ds.reduce((a, b) => a + b, 0) / n };
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
/* dificuldade (1–5) de uma subida ou descida a partir da distância e do desnível; null para os outros perfis */
function nivelSub(tipo, L, desn) {
  const g = L > 0 ? desn / L : 0;
  if (tipo === 'Subida') { const s = desn * g; return s < 8 ? 1 : s < 15 ? 2 : s < 35 ? 3 : s < 60 ? 4 : 5; }
  if (tipo === 'Descida') { const s = g * 100 + desn / 50; return s < 10 ? 1 : s < 16 ? 2 : s < 19 ? 3 : s < 23 ? 4 : 5; }
  return null;
}
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
/* escalões: idade a 31/12 do ano da época (ano da época − ano de nascimento). Os escalões de Juvenis a Seniores são mistos (género filtra-se à parte);
   dos 35 em diante há M35/F35 … M70/F70. Fora de 16–74 anos: sem escalão (só Geral). */
const ESCALOES = [
  {k:'JUV', nome:'Juvenis (Sub 18)', min:16, max:17}, {k:'JUN', nome:'Juniores (Sub 20)', min:18, max:19}, {k:'S23', nome:'Sub 23', min:20, max:22}, {k:'SEN', nome:'SEN', min:23, max:34},
  {k:'V35', min:35, max:39}, {k:'V40', min:40, max:44}, {k:'V45', min:45, max:49}, {k:'V50', min:50, max:54}, {k:'V55', min:55, max:59}, {k:'V60', min:60, max:64}, {k:'V65', min:65, max:69}, {k:'V70', min:70, max:74}];
function idadeEpoca(nasc, ano) { const y = parseInt(String(nasc || '').slice(0, 4), 10); return isFinite(y) && y > 1900 ? (ano || 2027) - y : null; }
function escalaoOf(nasc, ano) { const a = idadeEpoca(nasc, ano); if (a == null) return null; const e = ESCALOES.find(x => a >= x.min && a <= x.max); return e ? e.k : null; }
function escLabel(k, g) { const e = ESCALOES.find(x => x.k === k); if (!e) return ''; return e.nome || ((g === 'F' ? 'F' : 'M') + e.min); }
function escOptLabel(e) { return e.nome || ('M' + e.min + ' / F' + e.min); }
if (typeof module !== 'undefined') module.exports = { nivelSub, ESCALOES, idadeEpoca, escalaoOf, escLabel, escOptLabel, traceEle, parseActivity, parseFIT, parseTCX, zipEntries, climbStats, classifySeg, monthKey, parseGPX, detectSegment, suggestWindows, sliceToTrace, proj, unproj, bestPerAthlete, computePoints, rankRows, suspicion, fmtTime, tracePoly, polyLen };
