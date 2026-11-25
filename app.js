/* The Daily Seven — engine */
(function () {
'use strict';
const D = window.D7;
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function shuffle(a, r) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
const hash = s => { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const store = { get(k, d) { try { const v = localStorage.getItem('d7:' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem('d7:' + k, JSON.stringify(v)); } catch (e) {} } };
const norm = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/&/g, ' and ').replace(/[^a-z0-9 ]/g, ' ').replace(/\b(the|a|an)\b/g, ' ').replace(/\s+/g, ' ').trim();

const now = new Date();
const EPOCH = new Date(2026, 0, 1);
const TODAY = Math.round((new Date(now.getFullYear(), now.getMonth(), now.getDate()) - EPOCH) / 864e5);
const NUM = TODAY + 1;

/* deterministic picking: walks a fixed shuffle so a pool is used up before anything repeats */
function permOf(n, salt) { return shuffle([...Array(n).keys()], rng(salt * 7919 + 13)); }
function pickFrom(pool, salt, day) { const n = pool.length, cyc = Math.floor(day / n), p = shuffle(permOf(n, salt), rng(salt * 31 + cyc * 977 + 5)); return pool[p[((day % n) + n) % n]]; }
function sampleK(pool, k, salt, day) { const p = permOf(pool.length, salt), n = pool.length, s = ((day * k) % n + n) % n; return [...Array(Math.min(k, n))].map((_, i) => pool[p[(s + i) % n]]); }

/* ---------------- categories & modes ---------------- */
const CATS = [
 {id:'geo', name:'Geography', modes:['pin','shape','flag','capitals']},
 {id:'maths', name:'Maths', modes:['angle','target','sprint','fraction']},
 {id:'eng', name:'English', modes:['wordle','anagram','hangman','spelling','cross']},
 {id:'ent', name:'Entertainment', modes:['reel','year','songs','chars']},
 {id:'sport', name:'Sport', modes:['replay','jargon','numbers','venue']},
 {id:'hist', name:'History', modes:['timeline','year','whoami','first']},
 {id:'sci', name:'Science', modes:['element','sort','tf','numbers']}];
const M = {}; // mode registry: key 'cat.mode' → {name, how, run(el, ctx)}

const MODE_MEMO = {};
function modeFor(ci, day) {
 const k = ci + ':' + day; if (MODE_MEMO[k]) return MODE_MEMO[k];
 const c = CATS[ci]; let m = pickFrom(c.modes, 500 + ci, day);
 if (day > -30) { const y = modeFor(ci, day - 1); if (m === y) m = c.modes[(c.modes.indexOf(m) + 1 + (day & 1)) % c.modes.length]; }
 return (MODE_MEMO[k] = m);
}
const lineup = day => CATS.map((c, i) => c.id + '.' + modeFor(i, day));

/* ---------------- icons ---------------- */
const IC = {
 geo:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18"/>',
 maths:'<path d="M4 19h16M4 19 17 6"/><path d="M10 19a6 6 0 0 0-1.8-4.3"/>',
 eng:'<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M9 16l3-8 3 8M10 13h4"/>',
 ent:'<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M7 6l2 4M12 6l2 4M17 6l2 4"/>',
 sport:'<circle cx="12" cy="12" r="9"/><path d="m12 7 4 3-1.5 4.5h-5L8 10z"/>',
 hist:'<path d="M6 3h12M6 21h12M7 3c0 5 10 5 10 9s-10 4-10 9M17 3c0 5-10 5-10 9"/>',
 sci:'<path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3"/><path d="M7.5 15h9"/>'};
const icon = id => `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${IC[id]}</svg>`;
const col = id => `var(--${id})`;

/* ---------------- shared bits ---------------- */
function timer(el, seconds, onEnd) {
 const bar = el.querySelector('.tbar i'), lab = el.querySelector('.tbar b'); const t0 = performance.now(); let stopped = false;
 const iv = setInterval(() => {
  if (!el.isConnected || stopped) return clearInterval(iv);
  const left = Math.max(0, seconds - (performance.now() - t0) / 1000);
  if (bar) { bar.style.width = (left / seconds * 100) + '%'; bar.classList.toggle('low', left < 8); }
  if (lab) lab.textContent = Math.ceil(left) + 's';
  if (left <= 0) { clearInterval(iv); stopped = true; onEnd(); }
 }, 100);
 return () => { stopped = true; clearInterval(iv); };
}
const tbar = s => `<div class="tbar"><i></i><b>${s}s</b></div>`;
const disableAll = el => el.querySelectorAll('button,input').forEach(x => { if (!x.classList.contains('keep')) x.disabled = true; });

/* multiple-choice sprint */
function mcq(el, ctx, {items, seconds, cols}) {
 let i = 0, right = 0, over = false; const missed = [];
 el.innerHTML = `${tbar(seconds)}<div class="qcount" id="qc"></div><div id="qv"></div><div class="qtext" id="qt"></div><div class="opts ${cols === 2 ? 'two' : ''}" id="qo"></div>`;
 const finish = () => { if (over) return; over = true; stop(); disableAll(el);
  for (let k = i; k < items.length; k++) missed.push(items[k]);
  const sc = right / items.length * 100;
  ctx.done(sc, `${right} of ${items.length} correct.` + (missed.length ? `<span class="miss">${missed.map(m => `${m.recap || esc(m.q)} → <b>${esc(m.ans)}</b>`).join('<br>')}</span>` : ''));
 };
 const show = () => {
  if (i >= items.length) return finish();
  const it = items[i];
  $('#qc').innerHTML = items.map((_, k) => `<span class="${k < i ? (items[k].ok ? 'y' : 'n') : k === i ? 'c' : ''}"></span>`).join('');
  $('#qv').innerHTML = it.vis || ''; $('#qt').innerHTML = it.qh || esc(it.q);
  $('#qo').innerHTML = it.opts.map((o, k) => `<button class="opt" data-k="${k}">${esc(o)}</button>`).join('');
  $('#qo').querySelectorAll('.opt').forEach(b => b.onclick = () => {
   if (over || b.disabled) return; const o = it.opts[+b.dataset.k];
   $('#qo').querySelectorAll('.opt').forEach(x => { x.disabled = true; if (it.opts[+x.dataset.k] === it.ans) x.classList.add('ok'); });
   if (o === it.ans) { right++; it.ok = true; } else { b.classList.add('no'); missed.push(it); }
   setTimeout(() => { if (!over) { i++; show(); } }, o === it.ans ? 450 : 1100);
  });
 };
 const stop = timer(el, seconds, finish); show();
}
function opts4(ans, pool, r, n = 4) { const o = shuffle(pool.filter(x => x !== ans), r).filter((x, k, a) => a.indexOf(x) === k).slice(0, n - 1); return shuffle([ans, ...o], r); }

/* typed sprint */
function typed(el, ctx, {items, seconds, per, max, skip, label}) {
 let i = 0, right = 0, over = false; const log = [];
 el.innerHTML = `${tbar(seconds)}<div class="prompt" id="tp"></div><form class="row" id="tf" autocomplete="off"><input class="inp" id="ti" ${items.numeric ? 'inputmode="numeric"' : ''} autocapitalize="off" spellcheck="false" aria-label="${esc(label || 'Answer')}" placeholder="${esc(label || 'Answer')}" style="flex:1 1 180px"><button class="btn">Enter</button>${skip ? '<button type="button" class="btn ghost" id="tsk">Skip</button>' : ''}</form><div class="tally" id="tl"></div>`;
 const finish = () => { if (over) return; over = true; stop(); disableAll(el);
  const sc = Math.min(max || 100, right * per);
  ctx.done(sc, `${right} correct.` + (log.length ? `<span class="miss">${log.slice(0, 6).join('<br>')}</span>` : ''));
 };
 const show = () => { if (i >= items.length) return finish(); $('#tp').innerHTML = items[i].p; $('#ti').value = ''; $('#ti').focus({preventScroll: true}); $('#tl').textContent = `${right} correct`; };
 $('#tf').onsubmit = e => { e.preventDefault(); if (over) return; const v = $('#ti').value.trim(); if (!v) return;
  if (items[i].check(v)) { right++; i++; flash('ok'); show(); }
  else { flash('no'); if (items.strict) { log.push(`${items[i].recap} → <b>${esc(items[i].a)}</b>`); i++; show(); } else { $('#ti').select(); } } };
 const flash = c => { const p = $('#tp'); p.classList.remove('fok', 'fno'); void p.offsetWidth; p.classList.add(c === 'ok' ? 'fok' : 'fno'); };
 if (skip) $('#tsk').onclick = () => { if (over) return; log.push(`${items[i].recap} → <b>${esc(items[i].a)}</b>`); i++; show(); };
 const stop = timer(el, seconds, finish); show();
}

/* slider estimate */
function slider(el, ctx, {q, min, max, step, ans, tol, unit}) {
 const dec = (String(step).split('.')[1] || '').length;
 const isYear = min >= 1000 && max <= 2100 && step === 1; const fmt = v => Number(v).toLocaleString('en-GB', {minimumFractionDigits: dec, maximumFractionDigits: dec, useGrouping: !isYear}) + (unit ? (/^[%°]/.test(unit) ? '' : ' ') + unit : '');
 const mid = Math.round(((min + max) / 2) / step) * step;
 el.innerHTML = `<div class="qtext big">${esc(q)}</div><div class="readout" id="sr">${fmt(mid)}</div><div class="rangebox"><input type="range" id="sv" min="${min}" max="${max}" step="${step}" value="${mid}" aria-label="Your estimate"><div class="mark" id="smk" hidden></div></div><div class="ends"><span>${fmt(min)}</span><span>${fmt(max)}</span></div><div class="row end"><button class="btn ghost" id="sm" type="button">−</button><button class="btn ghost" id="sp" type="button">+</button><button class="btn" id="lock">Lock it in</button></div>`;
 const sv = $('#sv'), upd = () => { $('#sr').textContent = fmt(sv.value); sv.style.setProperty('--p', ((sv.value - min) / (max - min) * 100) + '%'); };
 sv.oninput = upd; upd();
 $('#sm').onclick = () => { sv.value = Math.max(min, +sv.value - step); upd(); }; $('#sp').onclick = () => { sv.value = Math.min(max, +sv.value + step); upd(); };
 $('#lock').onclick = () => { disableAll(el); const v = +sv.value, err = Math.abs(v - ans);
  const mk = $('#smk'); mk.hidden = false; mk.style.left = ((ans - min) / (max - min) * 100) + '%'; mk.textContent = fmt(ans);
  ctx.done(100 * Math.max(0, 1 - err / tol), err < step / 2 ? `Exactly right: <b>${fmt(ans)}</b>.` : `You said ${fmt(v)}. The answer is <b>${fmt(ans)}</b>.`); };
}

/* put in order */
function order(el, ctx, {items, top, bottom}) {
 const sorted = items.slice().sort((a, b) => a[1] - b[1]);
 let list = shuffle(items, ctx.r); if (list.every((e, i) => e === sorted[i])) list.reverse();
 let locked = false;
 el.innerHTML = `<div class="small">${esc(top)}</div><ol class="tl"></ol><div class="small">${esc(bottom)}</div><div class="row end"><button class="btn" id="lock">Lock it in</button></div>`;
 const draw = () => { el.querySelector('.tl').innerHTML = list.map((e, i) => { const st = locked ? (e === sorted[i] ? 'ok' : 'no') : '';
   return `<li class="${st}"><span class="n">${i + 1}</span><span class="t">${esc(e[0])}</span>${locked ? `<span class="yr">${esc(e[2])}</span>` : `<button class="mv" data-i="${i}" data-d="-1" ${i ? '' : 'disabled'} aria-label="Move up">▲</button><button class="mv" data-i="${i}" data-d="1" ${i < list.length - 1 ? '' : 'disabled'} aria-label="Move down">▼</button>`}</li>`; }).join('');
  el.querySelectorAll('.mv').forEach(b => b.onclick = () => { const i = +b.dataset.i, j = i + +b.dataset.d; [list[i], list[j]] = [list[j], list[i]]; draw(); const nb = el.querySelector(`.mv[data-i="${j}"][data-d="${b.dataset.d}"]:not([disabled])`) || el.querySelector(`.mv[data-i="${j}"]:not([disabled])`); if (nb) nb.focus(); }); };
 draw();
 $('#lock').onclick = () => { locked = true; $('#lock').disabled = true; draw(); let ok = 0, tot = 0;
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) { tot++; if (list[i][1] < list[j][1]) ok++; }
  ctx.done(ok / tot * 100, ok === tot ? 'Perfect order.' : `${ok} of ${tot} pairs in the right order.`); };
}

/* clue reveal + typed answer */
function clues(el, ctx, {vis, clues, accept, answer, list, scores, word, placeholder}) {
 let shown = 1, over = false; const wrong = [];
 const lid = 'dl' + Math.floor(Math.random() * 1e6);
 el.innerHTML = `${vis || ''}<div class="reel" id="reel"></div><form id="ff" class="row" autocomplete="off"><input class="inp" id="fi" list="${lid}" placeholder="${esc(placeholder)}" aria-label="${esc(placeholder)}" style="flex:1 1 220px"><datalist id="${lid}">${list.map(t => `<option value="${esc(t)}">`).join('')}</datalist><button class="btn">Guess</button><button type="button" class="btn ghost" id="skip">Next ${word}</button></form><div class="chips" id="wr"></div>`;
 const reel = () => { $('#reel').innerHTML = clues.map((c, i) => `<div class="frame ${i < shown ? 'on' : ''}"><em>${esc(word)} ${i + 1}<small>${scores[i]} pts</small></em><span>${i < shown ? esc(c) : '— locked —'}</span></div>`).join(''); };
 reel();
 const end = (sc, msg) => { over = true; shown = clues.length; reel(); disableAll($('#ff')); ctx.done(sc, msg); };
 const advance = () => { if (shown < clues.length) { shown++; reel(); } else end(0, `It was <b>${esc(answer)}</b>.`); };
 $('#skip').onclick = () => { if (!over) advance(); };
 $('#ff').onsubmit = e => { e.preventDefault(); if (over) return; const g = $('#fi').value.trim(); if (!g) return;
  if (accept(norm(g))) return end(scores[shown - 1], `Yes — <b>${esc(answer)}</b>, on ${word.toLowerCase()} ${shown}.`);
  wrong.push(g); $('#wr').innerHTML = wrong.map(w => `<span class="chip">${esc(w)}</span>`).join(''); $('#fi').value = ''; advance(); };
}
const acceptor = (name, aliases = []) => { const set = new Set([name, ...aliases].map(norm)); const last = norm(name).split(' ').pop(); return g => set.has(g) || (name.split(' ').length > 1 && last.length >= 4 && g === last); };

/* ---------------- world map ---------------- */
let WORLD = null;
async function world() { if (!WORLD) { const tj = await (await fetch('countries.json')).json(); WORLD = topojson.feature(tj, tj.objects.countries).features.filter(f => f.properties.name !== 'Antarctica'); } return WORLD; }
const COUNTRY_NAMES = () => WORLD.map(f => f.properties.name).sort();

async function mapPin(el, ctx, {feature, point, label, score, msg}) {
 el.innerHTML = `<div class="board map" id="mapb"><svg id="map"></svg></div><div class="row end"><span class="small" id="mh" style="margin-right:auto">Tap the map to drop a pin</span><button class="btn ghost keep" id="zm" type="button">Zoom</button><button class="btn" id="lock" disabled>Lock it in</button></div>`;
 try { await world(); } catch (e) { el.innerHTML = '<p>The map could not load.</p>'; return ctx.done(0, 'The map failed to load, so this round scores 0.'); }
 const svg = $('#map'), W = 960, H = 500; svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
 const proj = d3.geoNaturalEarth1().fitExtent([[6, 6], [W - 6, H - 6]], {type: 'Sphere'}), path = d3.geoPath(proj);
 const tgt = feature ? WORLD.find(f => f.properties.name === feature) : null;
 svg.innerHTML = `<defs><radialGradient id="sea" cx="50%" cy="45%"><stop offset="0" stop-color="#0d2a52"/><stop offset="1" stop-color="#06122a"/></radialGradient></defs><path d="${path({type: 'Sphere'})}" fill="url(#sea)" stroke="var(--cyan)" stroke-opacity=".5"/><path d="${path(d3.geoGraticule10())}" fill="none" stroke="var(--cyan)" stroke-opacity=".12"/>` +
  WORLD.map(f => `<path d="${path(f)}" class="land" ${f === tgt ? 'id="tgt"' : ''}/>`).join('') + '<g id="ov"></g>';
 let ll = null, locked = false;
 const pin = () => { const [x, y] = proj(ll); $('#ov').innerHTML = `<g transform="translate(${x},${y})"><circle r="16" class="pulse"/><path d="M0 0c-6-10-12-14-12-21a12 12 0 0 1 24 0c0 7-6 11-12 21z" fill="var(--pink)" stroke="#fff" stroke-width="2"/><circle cy="-21" r="4.5" fill="#fff"/></g>`; };
 svg.addEventListener('click', e => { if (locked) return; const b = svg.getBoundingClientRect(); const p = proj.invert([(e.clientX - b.left) * W / b.width, (e.clientY - b.top) * H / b.height]);
  if (!p || !d3.geoContains({type: 'Sphere'}, p)) return; ll = p; pin(); $('#lock').disabled = false; $('#mh').textContent = 'Tap again to move your pin'; });
 $('#zm').onclick = () => { const z = !svg.classList.contains('z'); svg.classList.toggle('z', z); $('#zm').textContent = z ? 'Zoom out' : 'Zoom';
  if (z) requestAnimationFrame(() => { const b = $('#mapb'), [x, y] = ll ? proj(ll) : [W / 2, H / 2]; b.scrollLeft = x / W * b.scrollWidth - b.clientWidth / 2; b.scrollTop = y / H * b.scrollHeight - b.clientHeight / 2; }); };
 $('#lock').onclick = () => { locked = true; $('#lock').disabled = true; $('#mh').textContent = '';
  let km, near, inside = false;
  if (tgt) { inside = d3.geoContains(tgt, ll); near = ll; km = 0;
   if (!inside) { let best = 9; const walk = c => { if (typeof c[0] === 'number') { const d = d3.geoDistance(ll, c); if (d < best) { best = d; near = c; } } else c.forEach(walk); }; walk(tgt.geometry.coordinates); km = Math.round(best * 6371); }
   const t = $('#tgt'); t.classList.add('hit'); t.parentNode.insertBefore(t, $('#ov'));
  } else { near = point; km = Math.round(d3.geoDistance(ll, point) * 6371); const [x, y] = proj(point);
   $('#ov').insertAdjacentHTML('beforeend', `<g transform="translate(${x},${y})"><circle r="9" fill="var(--good)" stroke="#fff" stroke-width="2.5"/><circle r="20" class="pulse g"/></g>`); }
  if (km > 0) $('#ov').insertAdjacentHTML('afterbegin', `<path d="${path({type: 'LineString', coordinates: [ll, near]})}" fill="none" stroke="var(--pink)" stroke-width="3" stroke-dasharray="6 5"/>`);
  ctx.done(score(km, inside), msg(km, inside)); };
}

/* flags */
function flagSVG(f) {
 const [, kind, c, w] = f, W = 60, H = 40; let s = '';
 if (kind === 'h' || kind === 'v') { const ws = w || c.map(() => 1), tot = ws.reduce((a, b) => a + b, 0); let p = 0;
  c.forEach((cl, i) => { const L = (kind === 'h' ? H : W) * ws[i] / tot; s += kind === 'h' ? `<rect x="0" y="${p}" width="${W}" height="${L + .3}" fill="${cl}"/>` : `<rect x="${p}" y="0" width="${L + .3}" height="${H}" fill="${cl}"/>`; p += L; }); }
 else if (kind === 'nordic') { const [bg, cr, inner] = c; s = `<rect width="${W}" height="${H}" fill="${bg}"/><rect x="16" y="0" width="8" height="${H}" fill="${cr}"/><rect x="0" y="16" width="${W}" height="8" fill="${cr}"/>`;
  if (inner) s += `<rect x="18" y="0" width="4" height="${H}" fill="${inner}"/><rect x="0" y="18" width="${W}" height="4" fill="${inner}"/>`; }
 else if (kind === 'disc') { const [bg, dc, x] = c; s = `<rect width="${W}" height="${H}" fill="${bg}"/><circle cx="${W * x}" cy="${H / 2}" r="${H * .3}" fill="${dc}"/>`; }
 return `<svg class="flag" viewBox="0 0 60 40" role="img" aria-label="A flag">${s}<rect width="60" height="40" fill="none" stroke="rgba(255,255,255,.3)" stroke-width=".6"/></svg>`;
}

/* ================= GEOGRAPHY ================= */
M['geo.pin'] = {name:'Pin the country', how:'Drop a pin on the world map.', run(el, ctx) {
 const name = ctx.pick(D.COUNTRIES);
 ctx.title(`Where is ${name}?`, 'Drop a pin and lock it in. Inside the border scores 100; every 25 km away costs a point.');
 mapPin(el, ctx, {feature: name, score: (km, inside) => inside ? 100 : 100 - km / 25,
  msg: (km, inside) => inside ? `Bang on — your pin landed inside ${esc(name)}.` : `${esc(name)} is highlighted. You were ${km.toLocaleString()} km from its border.`});
}};
M['geo.shape'] = {name:'Silhouette', how:'Name a country from its outline.', async run(el, ctx) {
 const [name, cont, al] = ctx.pick(D.SHAPES);
 ctx.title('Name this country', 'Just the outline to start. Each extra clue lowers the prize.');
 try { await world(); } catch (e) { return ctx.done(0, 'The map failed to load.'); }
 const f = WORLD.find(x => x.properties.name === name); let g = f.geometry;
 if (g.type === 'MultiPolygon') { const polys = g.coordinates.map(c => ({type: 'Polygon', coordinates: c})); const main = polys.reduce((a, b) => d3.geoArea(b) > d3.geoArea(a) ? b : a); const mc = d3.geoCentroid(main);
  g = {type: 'MultiPolygon', coordinates: polys.filter(p => d3.geoDistance(d3.geoCentroid(p), mc) < 0.5).map(p => p.coordinates)}; }
 const feat = {type: 'Feature', geometry: g}, c = d3.geoCentroid(feat);
 const proj = d3.geoAzimuthalEqualArea().rotate([-c[0], -c[1]]).fitExtent([[24, 24], [376, 276]], feat);
 const vis = `<div class="board shape"><svg viewBox="0 0 400 300"><defs><filter id="glow"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs><path d="${d3.geoPath(proj)(feat)}" fill="rgba(56,234,255,.14)" stroke="var(--cyan)" stroke-width="2" filter="url(#glow)"/></svg></div>`;
 const display = name === 'United States of America' ? 'the United States' : name;
 clues(el, ctx, {vis, word: 'Clue', placeholder: 'Type a country…', list: COUNTRY_NAMES(), scores: [100, 70, 45, 20], answer: display,
  clues: ['Outline only — no other help.', `It's in ${cont}.`, `Its name starts with ‘${name[0]}’.`, `Its name has ${name.replace(/[^A-Za-z]/g, '').length} letters.`],
  accept: g2 => new Set([name, ...(al || [])].map(norm)).has(g2)});
}};
M['geo.flag'] = {name:'Flag flash', how:'Five flags, 45 seconds.', run(el, ctx) {
 const pick = ctx.sample(D.FLAGS, 5);
 ctx.title('Whose flag is this?', 'Five flags against the clock. 20 points each.');
 mcq(el, ctx, {seconds: 45, items: pick.map(f => { const same = D.FLAGS.filter(x => x[1] === f[1]).map(x => x[0]); const rest = D.FLAGS.map(x => x[0]);
  const o = opts4(f[0], same, ctx.r); while (o.length < 4) { const x = rest[Math.floor(ctx.r() * rest.length)]; if (!o.includes(x)) o.push(x); }
  return {q: 'Whose flag?', vis: flagSVG(f), opts: shuffle(o, ctx.r), ans: f[0], recap: 'Flag'}; })});
}};
M['geo.capitals'] = {name:'Capital sprint', how:'Five capitals, 45 seconds.', run(el, ctx) {
 const pick = ctx.sample(D.CAPITALS, 5), caps = D.CAPITALS.map(c => c[1]);
 ctx.title('Capital sprint', 'Pick the capital city. Five questions, 45 seconds, 20 points each.');
 mcq(el, ctx, {seconds: 45, items: pick.map(([c, cap]) => ({q: `Capital of ${c}?`, opts: opts4(cap, caps, ctx.r), ans: cap}))});
}};

/* ================= MATHS ================= */
M['maths.angle'] = {name:'Draw the angle', how:'Drag the arm to an exact angle.', run(el, ctx) {
 let tgt; do { tgt = 8 + Math.floor(ctx.r() * 345); } while (tgt % 90 < 6 || tgt % 90 > 84);
 ctx.title(`Draw an angle of ${tgt}°`, 'Drag the arm anticlockwise from the fixed line. No numbers while you drag. Each degree off costs 3 points.');
 el.innerHTML = `<div class="board dial"><svg id="ang" viewBox="-130 -130 260 260"></svg></div><div class="readout" id="ar" style="visibility:hidden">0°</div><div class="row end"><button class="btn" id="lock" disabled>Lock it in</button></div>`;
 const svg = $('#ang'); let a = 0, locked = false, drag = false;
 const pt = (d, r) => [r * Math.cos(d * Math.PI / 180), -r * Math.sin(d * Math.PI / 180)];
 const arc = (d, r, c, w) => { if (d <= 0) return ''; const [x, y] = pt(d, r); return `<path d="M${r} 0A${r} ${r} 0 ${d > 180 ? 1 : 0} 0 ${x.toFixed(2)} ${y.toFixed(2)}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round"/>`; };
 const ticks = Array.from({length: 72}, (_, i) => { const [x1, y1] = pt(i * 5, 112), [x2, y2] = pt(i * 5, i % 18 ? (i % 2 ? 115 : 118) : 124); return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="var(--cyan)" stroke-opacity="${i % 18 ? .25 : .7}"/>`; }).join('');
 const draw = show => { const [x, y] = pt(a, 104); let s = `<circle r="122" fill="rgba(56,234,255,.04)" stroke="var(--cyan)" stroke-opacity=".35"/><circle r="70" fill="none" stroke="var(--cyan)" stroke-opacity=".12" stroke-dasharray="2 4"/>${ticks}`;
  if (show) { const [tx, ty] = pt(tgt, 104); s += arc(tgt, 46, 'var(--good)', 4) + `<line x2="${tx}" y2="${ty}" stroke="var(--good)" stroke-width="5" stroke-linecap="round"/>`; }
  s += arc(a, 30, 'var(--maths)', 6) + `<line x2="104" y2="0" stroke="#dfe9ff" stroke-width="5" stroke-linecap="round"/><line x2="${x}" y2="${y}" stroke="var(--pink)" stroke-width="6" stroke-linecap="round" class="glowline"/><circle cx="${x}" cy="${y}" r="11" fill="var(--pink)" stroke="#fff" stroke-width="2.5"/><circle r="6" fill="#dfe9ff"/>`; svg.innerHTML = s; };
 draw(false);
 const upd = e => { const b = svg.getBoundingClientRect(); const x = (e.clientX - b.left) / b.width * 260 - 130, y = (e.clientY - b.top) / b.height * 260 - 130; if (Math.hypot(x, y) < 8) return; let d = Math.atan2(-y, x) * 180 / Math.PI; if (d < 0) d += 360; a = Math.round(d); $('#lock').disabled = false; draw(false); };
 svg.addEventListener('pointerdown', e => { if (locked) return; drag = true; svg.setPointerCapture(e.pointerId); upd(e); });
 svg.addEventListener('pointermove', e => { if (drag && !locked) upd(e); }); svg.addEventListener('pointerup', () => drag = false);
 $('#lock').onclick = () => { locked = true; $('#lock').disabled = true; draw(true); const err = Math.abs(a - tgt); const ar = $('#ar'); ar.style.visibility = 'visible'; ar.textContent = a + '°';
  ctx.done(100 - err * 3, err === 0 ? `Perfect — exactly ${tgt}°!` : `You drew <b>${a}°</b>, ${err}° off. The target is shown in green.`); };
}};
M['maths.target'] = {name:'Target number', how:'Combine numbers to hit a target.', run(el, ctx) {
 const r = ctx.r; let nums, target;
 for (let k = 0; k < 400; k++) { nums = [...Array(4)].map(() => 1 + Math.floor(r() * 10)).concat([[25, 50, 75, 100][Math.floor(r() * 4)], 1 + Math.floor(r() * 10)]);
  let pool = shuffle(nums, r), v = pool[0]; const steps = 2 + Math.floor(r() * 3);
  for (let s = 1; s <= steps; s++) { const n = pool[s], op = Math.floor(r() * 4); const c = [v + n, v - n, v * n, v % n === 0 ? v / n : -1][op]; if (c > 0) v = c; }
  if (v >= 101 && v <= 999 && !nums.includes(v)) { target = v; break; } }
 if (!target) { nums = [3, 6, 7, 8, 50, 2]; target = 384; }
 ctx.title(`Make ${target}`, 'Tap a number, an operation, then another number. Results become new numbers. Get as close as you can — each one away costs 4 points.');
 let tiles = nums.map((v, i) => ({v, id: i})), hist = [], sel = null, op = null, nid = 10;
 el.innerHTML = `<div class="target-num">${target}</div><div class="tiles" id="tt"></div><div class="ops" id="to">${['+', '−', '×', '÷'].map(o => `<button class="opb" data-o="${o}">${o}</button>`).join('')}</div><div class="toast" id="tm"></div><div class="steps" id="ts"></div><div class="row end"><button class="btn ghost" id="tu" type="button">Undo</button><button class="btn" id="lock">Lock in closest</button></div>`;
 const draw = () => { const best = tiles.reduce((a, b) => Math.abs(b.v - target) < Math.abs(a.v - target) ? b : a);
  $('#tt').innerHTML = tiles.map(t => `<button class="tile ${sel === t.id ? 'sel' : ''} ${t.id === best.id ? 'best' : ''} ${t.id >= 10 ? 'made' : ''}" data-id="${t.id}">${t.v}</button>`).join('');
  $('#to').querySelectorAll('.opb').forEach(b => b.classList.toggle('sel', b.dataset.o === op));
  $('#ts').innerHTML = hist.map(h => `<span>${esc(h.txt)}</span>`).join('');
  $('#tt').querySelectorAll('.tile').forEach(b => b.onclick = () => tap(+b.dataset.id)); };
 const msg = t => { $('#tm').textContent = t; setTimeout(() => { if ($('#tm') && $('#tm').textContent === t) $('#tm').textContent = ''; }, 1600); };
 const tap = id => { if (sel === null || op === null) { sel = sel === id ? null : id; op = null; return draw(); } if (id === sel) { sel = null; op = null; return draw(); }
  const a = tiles.find(t => t.id === sel), b = tiles.find(t => t.id === id); let v;
  if (op === '+') v = a.v + b.v; if (op === '−') v = a.v - b.v; if (op === '×') v = a.v * b.v; if (op === '÷') v = b.v && a.v % b.v === 0 ? a.v / b.v : NaN;
  if (!(v > 0) || !Number.isInteger(v)) { msg(op === '÷' ? 'Must divide exactly' : 'Results must be positive'); return; }
  hist.push({tiles: tiles.slice(), txt: `${a.v} ${op} ${b.v} = ${v}`}); tiles = tiles.filter(t => t.id !== a.id && t.id !== b.id).concat({v, id: nid++}); sel = null; op = null; draw(); };
 $('#to').querySelectorAll('.opb').forEach(b => b.onclick = () => { if (sel === null) return msg('Pick a number first'); op = b.dataset.o; draw(); });
 $('#tu').onclick = () => { const h = hist.pop(); if (h) { tiles = h.tiles; sel = null; op = null; draw(); } };
 $('#lock').onclick = () => { disableAll(el); const best = tiles.reduce((a, b) => Math.abs(b.v - target) < Math.abs(a.v - target) ? b : a); const d = Math.abs(best.v - target);
  ctx.done(100 - d * 4, d === 0 ? `Nailed it — exactly ${target}.` : `Your closest was <b>${best.v}</b>, ${d} away from ${target}.`); };
 draw();
}};
M['maths.sprint'] = {name:'Mental maths sprint', how:'As many sums as you can in 60 seconds.', run(el, ctx) {
 const r = ctx.r, it = [];
 for (let k = 0; k < 40; k++) { const t = k % 4, lvl = Math.min(3, Math.floor(k / 4)); let a, b, ans, s;
  if (t === 0) { a = 12 + Math.floor(r() * (40 + lvl * 40)); b = 7 + Math.floor(r() * (30 + lvl * 30)); ans = a + b; s = `${a} + ${b}`; }
  if (t === 1) { a = 40 + Math.floor(r() * (60 + lvl * 50)); b = 8 + Math.floor(r() * 35); ans = a - b; s = `${a} − ${b}`; }
  if (t === 2) { a = 3 + Math.floor(r() * (8 + lvl * 2)); b = 4 + Math.floor(r() * (8 + lvl)); ans = a * b; s = `${a} × ${b}`; }
  if (t === 3) { b = 3 + Math.floor(r() * 9); ans = 3 + Math.floor(r() * (9 + lvl * 2)); a = b * ans; s = `${a} ÷ ${b}`; }
  it.push({p: `<div class="sum">${s} = ?</div>`, a: String(ans), recap: s, check: v => +v.replace(/\s/g, '') === ans}); }
 it.numeric = true;
 ctx.title('Mental maths sprint', '60 seconds. 10 points per correct answer, up to 100. A wrong answer lets you try again; Skip moves on.');
 typed(el, ctx, {items: it, seconds: 60, per: 10, max: 100, skip: true, label: 'Your answer'});
}};
M['maths.fraction'] = {name:'Split the bar', how:'Slice a bar at an exact fraction.', run(el, ctx) {
 const r = ctx.r; const d = 3 + Math.floor(r() * 10); let n = 1 + Math.floor(r() * (d - 1)); const g = (x, y) => y ? g(y, x % y) : x; const gg = g(n, d);
 const usePct = r() < .4; const val = usePct ? 3 + Math.floor(r() * 94) : n / d * 100; const label = usePct ? `${Math.round(val)}%` : `${n / gg}/${d / gg}`;
 ctx.title(`Fill exactly ${label} of the bar`, 'Drag the cutter along the bar. No numbers to help you. Each percentage point off costs 5 points.');
 el.innerHTML = `<div class="board fbar" id="fb"><div class="fill" id="ff"></div><div class="cut" id="fc"></div><div class="ans" id="fa" hidden></div></div><div class="readout" id="fr" style="visibility:hidden"></div><div class="row end"><button class="btn" id="lock" disabled>Lock it in</button></div>`;
 let p = 50, drag = false, locked = false; const fb = $('#fb');
 const draw = () => { $('#ff').style.width = p + '%'; $('#fc').style.left = p + '%'; };
 const upd = e => { const b = fb.getBoundingClientRect(); p = clamp((e.clientX - b.left) / b.width * 100, 0, 100); $('#lock').disabled = false; draw(); };
 fb.addEventListener('pointerdown', e => { if (locked) return; drag = true; fb.setPointerCapture(e.pointerId); upd(e); });
 fb.addEventListener('pointermove', e => { if (drag && !locked) upd(e); }); fb.addEventListener('pointerup', () => drag = false); draw();
 $('#lock').onclick = () => { locked = true; $('#lock').disabled = true; const err = Math.abs(p - val); const a = $('#fa'); a.hidden = false; a.style.left = val + '%';
  $('#fr').style.visibility = 'visible'; $('#fr').textContent = `${p.toFixed(1)}%`;
  ctx.done(100 - err * 5, `You cut at <b>${p.toFixed(1)}%</b>. ${esc(label)} is ${val.toFixed(1)}% — ${err.toFixed(1)} points off.`); };
}};

/* ================= ENGLISH ================= */
let DICT = null;
const KB = (extra) => `<div class="kb">${['qwertyuiop', 'asdfghjkl', (extra ? '+' : '') + 'zxcvbnm' + (extra ? '-' : '')].map(rw => `<div class="krow">${[...rw].map(k => k === '+' ? '<button class="key wide" data-k="Enter">Enter</button>' : k === '-' ? '<button class="key wide" data-k="Backspace" aria-label="Delete">Del</button>' : `<button class="key" data-k="${k}">${k.toUpperCase()}</button>`).join('')}</div>`).join('')}</div>`;
function keys(el, fn) { el.querySelectorAll('.key').forEach(b => b.onclick = () => fn(b.dataset.k));
 const kd = e => { if (!el.isConnected) return document.removeEventListener('keydown', kd); if (e.ctrlKey || e.metaKey || e.altKey || /INPUT|TEXTAREA/.test(document.activeElement.tagName)) return;
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key; if (k === 'Enter' || k === 'Backspace' || /^[a-z]$/.test(k)) { e.preventDefault(); fn(k); } };
 document.addEventListener('keydown', kd); }

M['eng.wordle'] = {name:'Six-guess word', how:'Crack a five-letter word.', async run(el, ctx) {
 const ans = ctx.pick(D.WORDLE);
 ctx.title('Crack the five-letter word', 'Six guesses. Green: right letter, right place. Amber: in the word elsewhere. Solve in one for 100, then 90, 75, 60, 45, 30.');
 if (!DICT) { try { DICT = new Set((await (await fetch('words.json')).json()).match(/.{5}/g)); D.WORDLE.forEach(w => DICT.add(w)); } catch (e) { DICT = null; } }
 const rows = Array(6).fill(''), marks = [], ks = {}; let cur = 0, over = false;
 el.innerHTML = `<div class="wgrid" id="wg">${rows.map((_, r) => `<div class="wrow">${[...Array(5)].map((_, c) => `<div class="wcell" id="c${r}${c}"></div>`).join('')}</div>`).join('')}</div><p class="toast" id="wt" aria-live="polite"></p>${KB(true)}`;
 const paint = () => { for (let r = 0; r < 6; r++) for (let c = 0; c < 5; c++) { const e = $(`#c${r}${c}`); e.textContent = rows[r][c] || ''; e.className = 'wcell' + (marks[r] ? ' ' + marks[r][c] : rows[r][c] ? ' f' : ''); if (marks[r]) e.style.animationDelay = c * 90 + 'ms'; }
  el.querySelectorAll('.key[data-k]').forEach(b => { const s = ks[b.dataset.k]; b.className = 'key' + (b.dataset.k.length > 1 ? ' wide' : '') + (s ? ' ' + s : ''); }); };
 const msg = t => { $('#wt').textContent = t; setTimeout(() => { if ($('#wt') && $('#wt').textContent === t) $('#wt').textContent = ''; }, 1600); };
 keys(el, k => { if (over) return; const w = rows[cur];
  if (k === 'Enter') { if (w.length < 5) return msg('Not enough letters');
   if (DICT && !DICT.has(w)) { const rw = $('#wg').children[cur]; rw.classList.remove('shake'); void rw.offsetWidth; rw.classList.add('shake'); return msg('Not in the word list'); }
   const m = Array(5).fill('x'), pool = [...ans]; for (let i = 0; i < 5; i++) if (w[i] === ans[i]) { m[i] = 'g'; pool[i] = null; }
   for (let i = 0; i < 5; i++) if (m[i] !== 'g') { const j = pool.indexOf(w[i]); if (j > -1) { m[i] = 'y'; pool[j] = null; } }
   marks[cur] = m; const rank = {g: 3, y: 2, x: 1}; [...w].forEach((ch, i) => { if (!ks[ch] || rank[m[i]] > rank[ks[ch]]) ks[ch] = m[i]; }); paint();
   if (w === ans) { over = true; return ctx.done([100, 90, 75, 60, 45, 30][cur], `Solved <b>${ans.toUpperCase()}</b> in ${cur + 1} ${cur ? 'guesses' : 'guess'}.`); }
   if (++cur === 6) { over = true; return ctx.done(0, `The word was <b>${ans.toUpperCase()}</b>.`); } return; }
  if (k === 'Backspace') { rows[cur] = w.slice(0, -1); return paint(); }
  if (/^[a-z]$/.test(k) && w.length < 5) { rows[cur] = w + k; paint(); $(`#c${cur}${w.length}`).classList.add('pop'); } });
 paint();
}};
M['eng.anagram'] = {name:'Anagram sprint', how:'Unscramble five words in 75 seconds.', run(el, ctx) {
 const ws = ctx.sample(D.ANAGRAMS, 5);
 const items = ws.map(w => { const ok = new Set((D.ANA_OK && D.ANA_OK[w]) || [w]); let s; let k = 0; do { s = shuffle([...w], ctx.r).join(''); } while ((ok.has(s) || s === w) && ++k < 30);
  return {p: `<div class="scram">${[...s].map(c => `<span>${c.toUpperCase()}</span>`).join('')}</div>`, a: w.toUpperCase(), recap: s.toUpperCase(), check: v => ok.has(v.toLowerCase().replace(/[^a-z]/g, ''))}; });
 ctx.title('Anagram sprint', 'Unscramble each word. Five words, 75 seconds, 20 points each. Skip if you are stuck.');
 typed(el, ctx, {items, seconds: 75, per: 20, max: 100, skip: true, label: 'Unscrambled word'});
}};
M['eng.hangman'] = {name:'Letter drop', how:'Guess the hidden word before your shields run out.', run(el, ctx) {
 const [cat, word] = ctx.pick(D.HANGMAN); const W = word.toLowerCase(); const got = new Set(), miss = new Set(); let over = false;
 ctx.title(`Category: ${cat}`, 'Guess letters to reveal the word. Six shields — each wrong letter knocks one out. Fewer misses, more points.');
 el.innerHTML = `<div class="shields" id="hs"></div><div class="hword" id="hw"></div>${KB(false)}`;
 const done = () => [...W].every(c => !/[a-z]/.test(c) || got.has(c));
 const paint = () => { $('#hs').innerHTML = [...Array(6)].map((_, i) => `<i class="${i < 6 - miss.size ? 'on' : ''}"></i>`).join('');
  $('#hw').innerHTML = word.split(' ').map(part => `<span class="hw">${[...part].map(c => `<b class="${got.has(c.toLowerCase()) || over ? 'shown' : ''} ${over && !got.has(c.toLowerCase()) ? 'late' : ''}">${got.has(c.toLowerCase()) || over ? c : ''}</b>`).join('')}</span>`).join('');
  el.querySelectorAll('.key').forEach(b => { const k = b.dataset.k; b.className = 'key' + (got.has(k) ? ' g' : miss.has(k) ? ' x' : ''); b.disabled = over || got.has(k) || miss.has(k); }); };
 keys(el, k => { if (over || !/^[a-z]$/.test(k) || got.has(k) || miss.has(k)) return; (W.includes(k) ? got : miss).add(k);
  if (done()) { over = true; paint(); return ctx.done([100, 88, 76, 64, 52, 40][miss.size], `Solved <b>${esc(word)}</b> with ${miss.size} miss${miss.size === 1 ? '' : 'es'}.`); }
  if (miss.size >= 6) { over = true; paint(); return ctx.done(0, `Out of shields. It was <b>${esc(word)}</b>.`); } paint(); });
 paint();
}};
M['eng.spelling'] = {name:'Spell check', how:'Spot the correct spelling, fast.', run(el, ctx) {
 const ws = ctx.sample(D.SPELL, 5);
 ctx.title('Which is spelled correctly?', 'Five tricky words, 45 seconds, 20 points each.');
 mcq(el, ctx, {seconds: 45, cols: 2, items: ws.map(w => { const wr = shuffle(((D.SPELL_WRONG || {})[w] || []).slice(0, 5), ctx.r).slice(0, 3); return {q: 'Pick the correct spelling', opts: shuffle([w, ...wr], ctx.r), ans: w, recap: 'Correct spelling'}; })});
}};
M['eng.cross'] = {name:'Mini crossword', how:'A word square: every row is also a column.', run(el, ctx) {
 const P = ctx.pick(D.CROSS), n = P.g.length;
 ctx.title('Mini crossword', `A ${n}×${n} word square — each word reads the same across and down. Fill it in, then lock it in. Score = letters correct.`);
 el.innerHTML = `<div class="xw" style="--n:${n}" id="xw">${P.g.map((w, r) => [...w].map((_, c) => `<div class="xc">${c === 0 || r === 0 ? `<small>${r === 0 ? c + 1 : r + 1}</small>` : ''}<input maxlength="1" data-r="${r}" data-c="${c}" aria-label="Row ${r + 1}, column ${c + 1}" autocomplete="off" autocapitalize="characters"></div>`).join('')).join('')}</div>
 <ol class="xclues" id="xcl">${P.c.map((c, i) => `<li data-i="${i}"><b>${i + 1}</b> ${esc(c)}</li>`).join('')}</ol><div class="row end"><button class="btn ghost" id="xr" type="button">Reveal a letter (−10)</button><button class="btn" id="lock">Lock it in</button></div>`;
 const cells = [...el.querySelectorAll('.xw input')], at = (r, c) => cells[r * n + c]; let dir = 0, reveals = 0, lastFocus = cells[0];
 const hl = (r, c) => { cells.forEach(x => x.parentNode.classList.remove('hl')); for (let k = 0; k < n; k++) (dir ? at(k, c) : at(r, k)).parentNode.classList.add('hl');
  el.querySelectorAll('#xcl li').forEach(li => li.classList.toggle('on', +li.dataset.i === (dir ? c : r))); };
 cells.forEach(inp => { const r = +inp.dataset.r, c = +inp.dataset.c;
  inp.addEventListener('focus', () => { lastFocus = inp; hl(r, c); inp.select(); });
  inp.addEventListener('click', () => { if (document.activeElement === inp && lastFocus === inp) { dir ^= 1; hl(r, c); } });
  inp.addEventListener('input', () => { inp.value = inp.value.replace(/[^a-z]/gi, '').slice(-1).toUpperCase(); if (inp.value) { const nx = dir ? at(r + 1, c) : at(r, c + 1); if (nx) nx.focus(); } });
  inp.addEventListener('keydown', e => { const mv = {ArrowRight: [0, 1], ArrowLeft: [0, -1], ArrowDown: [1, 0], ArrowUp: [-1, 0]}[e.key];
   if (mv) { e.preventDefault(); const t = at(r + mv[0], c + mv[1]); if (t && r + mv[0] < n && c + mv[1] < n && c + mv[1] >= 0) t.focus(); }
   if (e.key === 'Backspace' && !inp.value) { const pv = dir ? at(r - 1, c) : at(r, c - 1); if (pv && c - (dir ? 0 : 1) >= 0) { e.preventDefault(); pv.value = ''; pv.focus(); } } }); });
 el.querySelectorAll('#xcl li').forEach(li => li.onclick = () => { dir = 0; at(+li.dataset.i, 0).focus(); });
 $('#xr').onclick = () => { const empty = cells.filter(x => x.value.toUpperCase() !== P.g[+x.dataset.r][+x.dataset.c]); if (!empty.length) return; const x = lastFocus && empty.includes(lastFocus) ? lastFocus : empty[0];
  x.value = P.g[+x.dataset.r][+x.dataset.c]; x.parentNode.classList.add('rev'); reveals++; };
 $('#lock').onclick = () => { let ok = 0; cells.forEach(x => { const good = x.value.toUpperCase() === P.g[+x.dataset.r][+x.dataset.c]; if (good) ok++; x.parentNode.classList.add(good ? 'ok' : 'no'); if (!good) x.value = P.g[+x.dataset.r][+x.dataset.c]; x.readOnly = true; });
  disableAll(el); ctx.done(ok / cells.length * 100 - reveals * 10, `${ok} of ${cells.length} letters right${reveals ? `, ${reveals} revealed` : ''}. Words: <b>${P.g.join(', ')}</b>.`); };
 cells[0].focus({preventScroll: true});
}};

/* ================= ENTERTAINMENT ================= */
M['ent.reel'] = {name:'Name the film', how:'A scene revealed one frame at a time.', run(el, ctx) {
 const [title, al, cl] = ctx.pick(D.FILMS);
 ctx.title('Name the film from the scene', 'The reel unlocks one frame at a time. The sooner you name it, the more you score.');
 clues(el, ctx, {clues: cl, word: 'Frame', scores: [100, 75, 50, 25], answer: title, placeholder: 'Type a film title…', list: D.FILMS.map(f => f[0]).concat(D.FILM_EXTRA).sort(), accept: g => new Set([title, ...al].map(norm)).has(g)});
}};
M['ent.year'] = {name:'Year dial', how:'Guess the year a release came out.', run(el, ctx) {
 const [label, y] = ctx.pick(D.ENT_YEARS);
 ctx.title('What year?', 'Slide to the year. Exact scores 100; each year off costs about 7 points.');
 slider(el, ctx, {q: label, min: 1930, max: 2026, step: 1, ans: y, tol: 15, unit: ''});
}};
M['ent.songs'] = {name:'Who sang it?', how:'Match five hits to the artist.', run(el, ctx) {
 const pick = ctx.sample(D.SONGS, 5), arts = [...new Set(D.SONGS.map(s => s[1]))];
 ctx.title('Who sang it?', 'Five hits, 45 seconds, 20 points each.');
 mcq(el, ctx, {seconds: 45, items: pick.map(([s, a]) => ({q: `“${s}”`, qh: `<span class="small">Who had the hit</span><br>“${esc(s)}”?`, opts: opts4(a, arts, ctx.r), ans: a}))});
}};
M['ent.chars'] = {name:'Character check', how:'Which film, show or game are they from?', run(el, ctx) {
 const pick = ctx.sample(D.CHARS, 5), works = [...new Set(D.CHARS.map(s => s[1]))];
 ctx.title('Where are they from?', 'Five characters — pick the film, TV show or game. 45 seconds, 20 points each.');
 mcq(el, ctx, {seconds: 45, items: pick.map(([c, w]) => ({q: c, qh: `${esc(c)}<br><span class="small">appears in…</span>`, opts: opts4(w, works, ctx.r), ans: w}))});
}};

/* ================= SPORT ================= */
M['sport.replay'] = {name:'Archive replay', how:'Name the famous match from a replay.', run(el, ctx) {
 const m = ctx.pick(D.REPLAYS), opts = shuffle([m, ...shuffle(D.REPLAYS.filter(x => x !== m), ctx.r).slice(0, 3)], ctx.r);
 ctx.title('Which match is this?', 'A grainy archive replay of a famous moment. Team names are hidden. First guess 100, then 60 with a clue, then 30.');
 el.innerHTML = `<div class="tv"><svg id="pitch" viewBox="-4 -4 113 76"></svg><div class="grain"></div><div class="scan"></div><div class="vig"></div><div class="cut" id="cut"></div><div class="bug" id="bug"></div><div class="rec">● REPLAY</div></div>
 <div class="row"><button class="btn ghost keep" id="rp">Replay</button><span class="small">Dark and light shirts. The attack goes left to right.</span></div><div class="opts" id="op">${opts.map((o, i) => `<button class="opt" data-i="${i}">${esc(o.n)}</button>`).join('')}</div><div id="cl"></div>`;
 const svg = $('#pitch');
 const lines = `<rect x="-4" y="-4" width="113" height="76" fill="#3d4a3d"/>${[...Array(10)].map((_, i) => `<rect x="${i * 10.5}" y="0" width="5.25" height="68" fill="#465446"/>`).join('')}<g fill="none" stroke="#e8e8e8" stroke-width=".4"><rect width="105" height="68"/><line x1="52.5" x2="52.5" y2="68"/><circle cx="52.5" cy="34" r="9.15"/><rect y="13.85" width="16.5" height="40.3"/><rect x="88.5" y="13.85" width="16.5" height="40.3"/><rect y="24.85" width="5.5" height="18.3"/><rect x="99.5" y="24.85" width="5.5" height="18.3"/><rect x="105" y="30.34" width="2.5" height="7.32" stroke-width=".5"/><rect x="-2.5" y="30.34" width="2.5" height="7.32" stroke-width=".5"/></g>`;
 const at = (p, t) => { if (p.length === 1 || t <= p[0][0]) return [p[0][1], p[0][2]]; for (let i = 1; i < p.length; i++) if (t <= p[i][0]) { const [t0, x0, y0] = p[i - 1], [t1, x1, y1] = p[i]; const k = (t - t0) / (t1 - t0 || 1); return [x0 + (x1 - x0) * k, y0 + (y1 - y0) * k]; } const l = p[p.length - 1]; return [l[1], l[2]]; };
 const ca = m.aDark ? '#1c1c1c' : '#f4f4f4', cb = m.aDark ? '#f4f4f4' : '#1c1c1c'; let t0 = null; const Dm = m.dur * 1000;
 const frame = ts => { if (!svg.isConnected) return; if (t0 == null) t0 = ts; let t = (ts - t0) / Dm; if (t > 1.18) { t0 = ts; t = 0; } const tt = Math.min(t, 1);
  const pl = (arr, f, s) => arr.map(p => { const [x, y] = at(p, tt); return `<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="1.6" fill="${f}" stroke="${s}" stroke-width=".45"/>`; }).join('');
  const [bx, by] = at(m.ball, tt);
  svg.innerHTML = lines + pl(m.b, cb, ca) + pl(m.a, ca, cb) + `<ellipse cx="${bx + .4}" cy="${by + .5}" rx=".9" ry=".5" fill="#000" opacity=".4"/><circle cx="${bx}" cy="${by}" r=".85" fill="#fff" stroke="#000" stroke-width=".3"/>`;
  let clk = m.clock, sc = m.start; m.ev.forEach(e => { if (tt >= e[0]) { clk = e[1]; sc = e[2]; } }); $('#bug').textContent = `${clk}   ???  ${sc}  ???`;
  $('#cut').style.opacity = m.cut && Math.abs(tt - m.cut) < .012 ? 1 : 0; requestAnimationFrame(frame); };
 requestAnimationFrame(frame); $('#rp').onclick = () => { t0 = null; };
 let tries = 0, over = false;
 $('#op').querySelectorAll('.opt').forEach(b => b.onclick = () => { if (over || b.disabled) return; const o = opts[+b.dataset.i];
  if (o === m) { over = true; b.classList.add('ok'); $('#op').querySelectorAll('.opt').forEach(x => x.disabled = true); return ctx.done([100, 60, 30][tries], `Correct — <b>${esc(m.n)}</b>. ${esc(m.clues[1])}`); }
  b.classList.add('no'); b.disabled = true; tries++;
  if (tries >= 3) { over = true; $('#op').querySelectorAll('.opt').forEach(x => { x.disabled = true; if (opts[+x.dataset.i] === m) x.classList.add('ok'); }); return ctx.done(0, `It was <b>${esc(m.n)}</b>.`); }
  $('#cl').innerHTML = m.clues.slice(0, tries).map(c => `<div class="clue"><b>Clue</b> ${esc(c)}</div>`).join(''); });
}};
M['sport.jargon'] = {name:'Speak the sport', how:'Name the sport from its jargon.', run(el, ctx) {
 const pick = ctx.sample(D.JARGON, 5), sports = [...new Set(D.JARGON.map(j => j[1]))];
 ctx.title('Which sport is this?', 'Three bits of jargon — name the sport. Five rounds, 45 seconds, 20 points each.');
 mcq(el, ctx, {seconds: 45, items: pick.map(([t, s]) => ({q: t, qh: `<span class="jargon">${t.split(', ').map(x => `<i>${esc(x)}</i>`).join('')}</span>`, opts: opts4(s, sports, ctx.r), ans: s}))});
}};
M['sport.numbers'] = {name:'Stat attack', how:'Estimate a sporting number.', run(el, ctx) {
 const [q, a, mn, mx, st, tol, u] = ctx.pick(D.SPORT_NUM);
 ctx.title('Stat attack', 'Slide to your best estimate. The closer you are, the more you score.');
 slider(el, ctx, {q, min: mn, max: mx, step: st, ans: a, tol, unit: u});
}};
M['sport.venue'] = {name:'Venue drop', how:'Pin a famous sporting venue on the map.', run(el, ctx) {
 const [name, sport, lat, lon] = ctx.pick(D.VENUES);
 ctx.title(`Where is ${name}?`, `${esc(sport)} venue. Drop a pin: within 30 km scores 100, then a point lost every 12 km.`);
 mapPin(el, ctx, {point: [lon, lat], score: km => km <= 30 ? 100 : 100 - (km - 30) / 12, msg: km => km <= 30 ? `Spot on — within ${km} km.` : `You were <b>${km.toLocaleString()} km</b> away. The venue is the green dot.`});
}};

/* ================= HISTORY ================= */
const yr = y => y < 0 ? `${-y} BC` : y < 1000 ? `AD ${y}` : String(y);
M['hist.timeline'] = {name:'Timeline', how:'Put four events in order.', run(el, ctx) {
 let set; for (let k = 0; k < 300; k++) { const s = shuffle(D.EVENTS, ctx.r).slice(0, 4); const ys = s.map(e => e[1]).sort((a, b) => a - b); if (ys.every((y, i) => !i || y - ys[i - 1] >= 10)) { set = s; break; } }
 ctx.title('Put these in order', 'Oldest at the top. Use the arrows, then lock it in. Points for every pair in the right order.');
 order(el, ctx, {items: set.map(e => [e[0], e[1], yr(e[1])]), top: 'Oldest', bottom: 'Most recent'});
}};
M['hist.year'] = {name:'Year dial', how:'Pin an event to its year.', run(el, ctx) {
 const pool = D.EVENTS.filter(e => e[1] >= 1000), [label, y] = ctx.pick(pool);
 const u = .15 + ctx.r() * .7, w = 400; let mn = Math.round((y - u * w) / 10) * 10, mx = mn + w; if (mx > 2030) { mx = 2030; mn = mx - w; }
 ctx.title('What year?', 'Slide to the year it happened. Exact scores 100; you lose 2.5 points per year off.');
 slider(el, ctx, {q: label, min: mn, max: mx, step: 1, ans: y, tol: 40, unit: ''});
}};
M['hist.whoami'] = {name:'Who am I?', how:'Identify a historical figure from clues.', run(el, ctx) {
 const [name, al, cl] = ctx.pick(D.FIGURES);
 const extra = ['Henry VIII', 'Queen Victoria', 'Charles Dickens', 'Pablo Picasso', 'Ludwig van Beethoven', 'Socrates', 'George Washington', 'John F. Kennedy', 'Elvis Presley', 'Stephen Hawking', 'Charles Babbage', 'Thomas Edison', 'Nikola Tesla', 'Vincent van Gogh', 'Mother Teresa', 'Eamon de Valera', 'Countess Markievicz', 'Wolfe Tone', 'Brian Boru', 'Saint Patrick', 'Anne Frank', 'Karl Marx', 'Sigmund Freud', 'Emmeline Pankhurst'];
 ctx.title('Who am I?', 'Clues unlock one at a time, hardest first. Name me early for more points.');
 clues(el, ctx, {clues: cl, word: 'Clue', scores: [100, 75, 50, 25], answer: name, placeholder: 'Type a name…', list: D.FIGURES.map(f => f[0]).concat(extra).sort(), accept: acceptor(name, al)});
}};
M['hist.first'] = {name:'Which came first?', how:'Five head-to-heads in 50 seconds.', run(el, ctx) {
 const s = shuffle(D.EVENTS, ctx.r), pairs = [];
 for (let i = 0; i < s.length - 1 && pairs.length < 5; i += 2) if (Math.abs(s[i][1] - s[i + 1][1]) >= 8) pairs.push([s[i], s[i + 1]]);
 ctx.title('Which came first?', 'Pick the earlier event. Five pairs, 50 seconds, 20 points each.');
 mcq(el, ctx, {seconds: 50, cols: 2, items: pairs.map(([a, b]) => { const first = a[1] < b[1] ? a : b; return {q: 'Which came first?', opts: [a[0], b[0]], ans: first[0], recap: `${esc(a[0])} (${yr(a[1])}) vs ${esc(b[0])} (${yr(b[1])})`}; })});
}};

/* ================= SCIENCE ================= */
const ELS = D.ELS.split(',').map((s, i) => { const [sym, name] = s.split(' '); return {z: i + 1, sym, name}; });
function elPos(z) { if (z === 1) return [1, 1]; if (z === 2) return [18, 1]; if (z <= 18) { const p = z <= 10 ? 2 : 3, i = z - (p === 2 ? 3 : 11); return [i < 2 ? i + 1 : i + 11, p]; }
 if (z <= 36) return [z - 18, 4]; if (z <= 54) return [z - 36, 5]; if (z <= 56) return [z - 54, 6]; if (z <= 71) return [z - 54, 9]; if (z <= 86) return [z - 68, 6]; if (z <= 88) return [z - 86, 7]; if (z <= 103) return [z - 86, 10]; return [z - 100, 7]; }
M['sci.element'] = {name:'Element hunt', how:'Find an element on the periodic table.', run(el, ctx) {
 const [name, fact] = ctx.pick(D.ELEMENT_FACTS); const tz = ELS.find(e => e.name === name); const [tc, tr] = elPos(tz.z);
 ctx.title(`Find ${name}`, `${esc(fact)} Tap it on the table: exact 100, a neighbouring square 50, two away 20.`);
 const cells = ELS.map(e => { const [c, r] = elPos(e.z); return `<button class="el" data-z="${e.z}" style="grid-column:${c};grid-row:${r}" aria-label="${esc(e.name)}"><small>${e.z}</small>${esc(e.sym)}</button>`; });
 cells.push(`<div class="el gap" style="grid-column:3;grid-row:6">57–71</div><div class="el gap" style="grid-column:3;grid-row:7">89–103</div><div style="grid-column:1/-1;grid-row:8;height:8px"></div>`);
 el.innerHTML = `<div class="pt-wrap"><div class="pt">${cells.join('')}</div></div>`;
 el.querySelectorAll('.el[data-z]').forEach(b => b.onclick = () => { const z = +b.dataset.z, [c, r] = elPos(z), d = Math.max(Math.abs(c - tc), Math.abs(r - tr));
  el.querySelectorAll('.el[data-z]').forEach(x => x.disabled = true); el.querySelector(`.el[data-z="${tz.z}"]`).classList.add('hit'); if (z !== tz.z) b.classList.add(d <= 2 ? 'near' : 'miss');
  const p = ELS[z - 1]; ctx.done(z === tz.z ? 100 : d === 1 ? 50 : d === 2 ? 20 : 0, z === tz.z ? `Spot on — ${esc(name)} is <b>${esc(tz.sym)}</b>, number ${tz.z}.` : `You tapped ${esc(p.name)} (${esc(p.sym)}). ${esc(name)} is <b>${esc(tz.sym)}</b>, number ${tz.z}.`); });
}};
M['sci.sort'] = {name:'Sort it out', how:'Rank four things by a property.', run(el, ctx) {
 const [t, top, bot, items] = ctx.pick(D.SORTS); const pick = shuffle(items, ctx.r).slice(0, 4);
 ctx.title(t, `Order them from ${top.toLowerCase()} at the top to ${bot.toLowerCase()} at the bottom.`);
 order(el, ctx, {items: pick, top, bottom: bot});
}};
M['sci.tf'] = {name:'True or false', how:'Five science claims, 40 seconds.', run(el, ctx) {
 const pick = ctx.sample(D.TF, 5);
 ctx.title('True or false?', 'Five science claims, 40 seconds, 20 points each.');
 mcq(el, ctx, {seconds: 40, cols: 2, items: pick.map(([s, v, why]) => ({q: s, opts: ['True', 'False'], ans: v ? 'True' : 'False', recap: `${esc(s)} <span class="small">${esc(why)}</span>`}))});
}};
M['sci.numbers'] = {name:'Science estimate', how:'Estimate a number from science.', run(el, ctx) {
 const [q, a, mn, mx, st, tol, u] = ctx.pick(D.SCI_NUM);
 ctx.title('Science estimate', 'Slide to your best estimate. The closer you are, the more you score.');
 slider(el, ctx, {q, min: mn, max: mx, step: st, ans: a, tol, unit: u});
}};

/* ================= app shell ================= */
let S, practice = false, LINE = lineup(TODAY);
const KEY = 'v2-' + TODAY;
function load() { S = store.get(KEY, null); if (!S || !Array.isArray(S.scores)) S = {scores: [], notes: [], line: LINE}; LINE = S.line && S.line.length === 7 ? S.line : LINE; }
const save = () => { if (!practice) store.set(KEY, S); };
const dateStr = now.toLocaleDateString('en-GB', {weekday: 'long', day: 'numeric', month: 'long'});

function ring(vals, center, sub) {
 const R = 92, seg = 360 / 7, gap = 5; let s = '';
 const P = (a, r) => [120 + r * Math.cos((a - 90) * Math.PI / 180), 120 + r * Math.sin((a - 90) * Math.PI / 180)];
 const arcD = (a0, a1, r) => { const [x0, y0] = P(a0, r), [x1, y1] = P(a1, r); return `M${x0.toFixed(1)} ${y0.toFixed(1)}A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`; };
 CATS.forEach((c, i) => { const a0 = i * seg + gap / 2, a1 = (i + 1) * seg - gap / 2, v = vals ? (vals[i] == null ? 0 : vals[i]) : 100;
  s += `<path d="${arcD(a0, a1, R)}" stroke="${col(c.id)}" stroke-opacity=".18" stroke-width="16" fill="none"/>`;
  if (v > 0) s += `<path class="seg" d="${arcD(a0, a0 + (a1 - a0) * Math.max(.04, v / 100), R)}" stroke="${col(c.id)}" stroke-width="16" fill="none" style="filter:drop-shadow(0 0 6px ${col(c.id)});animation-delay:${i * 80}ms"/>`;
  const [ix, iy] = P((a0 + a1) / 2, 122); s += `<g transform="translate(${ix - 9},${iy - 9})" color="${col(c.id)}"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${IC[c.id]}</svg></g>`; });
 return `<svg class="ring" viewBox="0 0 240 240" role="img" aria-label="Seven rounds">
  <circle cx="120" cy="120" r="74" fill="rgba(56,234,255,.05)" stroke="var(--cyan)" stroke-opacity=".25"/><circle cx="120" cy="120" r="64" fill="none" stroke="var(--cyan)" stroke-opacity=".15" stroke-dasharray="1 5" class="spin"/>${s}
  <text x="120" y="${sub ? 118 : 128}" text-anchor="middle" class="rc">${esc(center)}</text>${sub ? `<text x="120" y="142" text-anchor="middle" class="rs">${esc(sub)}</text>` : ''}</svg>`;
}
let PR = null; // practice run state
function head(cur) {
 $('#meta').innerHTML = `<span>${esc(dateStr)}</span><b>${PR ? 'Practice mode' : practice ? 'Game lab' : 'No. ' + NUM}</b>`;
 const line = PR ? PR.line : LINE, sc = PR ? PR.scores : practice ? [] : S.scores;
 $('#pips').innerHTML = practice && !PR ? '' : line.map((k, i) => { const c = k.split('.')[0], s = sc[i]; return `<div class="pip ${i === cur ? 'now' : ''}" style="--c:${col(c)}"><i style="width:${s == null ? 0 : Math.max(5, s)}%"></i></div>`; }).join('');
}
function card(html) { const a = $('#app'); a.innerHTML = `<div class="enter">${html}</div>`; window.scrollTo({top: 0}); }

function start() {
 practice = false; PR = null; load(); head(-1); const n = S.scores.length;
 card(`<div class="hero"><div class="hero-t"><p class="kicker">Daily challenge · No. ${NUM}</p><h1>Seven games.<br><span>Never the same day twice.</span></h1>
  <p class="lede">Today's line-up has been generated from ${Object.keys(M).length} different mini-games. One shot each, up to 100 points a round.</p>
  <div class="row"><button class="btn" id="go">${n ? `Resume · round ${n + 1}` : 'Launch today\'s seven'}</button><a class="btn ghost" href="#practice">Practice · unlimited</a><a class="link" href="#lab">Game lab</a></div></div>
  <div class="hero-r">${ring(n ? S.scores : null, n ? `${S.scores.reduce((a, b) => a + b, 0)}` : '7', n ? 'points so far' : 'games today')}</div></div>
  <div class="line">${LINE.map((k, i) => { const c = CATS[i], m = M[k], sc = S.scores[i]; return `<div class="li" style="--c:${col(c.id)}">${icon(c.id)}<div><span>${esc(c.name)}</span><b>${esc(m.name)}</b><em>${esc(m.how)}</em></div>${sc != null ? `<strong>${sc}</strong>` : ''}</div>`; }).join('')}</div>`);
 $('#go').onclick = () => round(S.scores.length);
}

function ctxFor(key, i, day, onDone) {
 const salt = hash(key), r = rng(salt + day * 131);
 return {r, day, pick: pool => pickFrom(pool, salt, day), sample: (pool, k) => sampleK(pool, k, salt, day),
  title: (t, l) => { $('#rt').textContent = t; $('#rl').innerHTML = l; }, done: onDone};
}
function shell(key, idx, label) {
 const c = key.split('.')[0], cat = CATS.find(x => x.id === c);
 card(`<div class="rhead"><span class="tag" style="--c:${col(c)}">${icon(c)}${esc(cat.name)}</span><span class="small">${esc(label)} · ${esc(M[key].name)}</span></div><h2 id="rt"></h2><p class="lede" id="rl"></p><div id="stage"></div><div id="after"></div>`);
}
function verdict(score, note, btn, fn) {
 const c = score >= 80 ? 'var(--good)' : score >= 40 ? 'var(--mid)' : 'var(--bad)';
 $('#after').innerHTML = `<div class="verdict enter" style="--v:${c}"><div class="pts">${score}<small>pts</small></div><p>${note}</p></div><div class="row end"><button class="btn" id="next">${btn}</button></div>`;
 const nb = $('#next'); nb.onclick = fn; nb.focus({preventScroll: true}); setTimeout(() => nb.scrollIntoView({block: 'nearest', behavior: 'smooth'}), 60);
}
function round(i) {
 if (i >= 7) return results();
 const key = LINE[i]; head(i); shell(key, i, `Round ${i + 1} of 7`);
 let fired = false;
 const ctx = ctxFor(key, i, TODAY, (score, note) => { if (fired) return; fired = true; score = Math.round(clamp(score, 0, 100)); S.scores[i] = score; S.notes[i] = note; save(); head(i);
  verdict(score, note, i < 6 ? 'Next round' : 'See your score', () => round(i + 1)); });
 M[key].run($('#stage'), ctx);
}

function results() {
 head(-1); const total = S.scores.reduce((a, b) => a + (b || 0), 0);
 if (!S.final) { S.final = true; const st = store.get('stats', {played: 0, streak: 0, best: 0, last: -9}); st.played++; st.streak = st.last === TODAY - 1 ? st.streak + 1 : 1; st.best = Math.max(st.best, total); st.last = TODAY; store.set('stats', st); save(); }
 const st = store.get('stats', {played: 1, streak: 1, best: total});
 const sq = s => s >= 80 ? '🟩' : s >= 40 ? '🟨' : '🟥';
 const share = `The Daily Seven No. ${NUM} — ${total}/700\n${S.scores.map(sq).join('')}\nthedailyseven.com`;
 const v = total >= 600 ? 'Off the charts.' : total >= 450 ? 'Seriously strong.' : total >= 300 ? 'Solid run.' : 'Systems recharging — tomorrow brings a new seven.';
 card(`<div class="hero res"><div class="hero-t"><p class="kicker">Today's score · No. ${NUM}</p><div class="big">${total}<small>/700</small></div><p class="lede strong">${v}</p>
  <div class="stats"><div><b>${st.streak}</b><span>Day streak</span></div><div><b>${st.played}</b><span>Played</span></div><div><b>${st.best}</b><span>Best</span></div></div></div>
  <div class="hero-r">${ring(S.scores, total, 'of 700')}</div></div>
  <div class="bars">${LINE.map((k, i) => { const c = k.split('.')[0]; return `<div class="bar" style="--c:${col(c)}"><span>${esc(M[k].name)}</span><div class="tr"><i data-w="${S.scores[i] || 0}"></i></div><b>${S.scores[i] || 0}</b></div>`; }).join('')}</div>
  <div class="row"><button class="btn" id="cp">Copy result</button><a class="btn ghost" href="#practice">Keep playing · practice</a><span class="small" id="cd" style="margin-left:auto"></span></div>`);
 requestAnimationFrame(() => document.querySelectorAll('.bar i').forEach(x => x.style.width = x.dataset.w + '%'));
 $('#cp').onclick = async () => { try { await navigator.clipboard.writeText(share); $('#cp').textContent = 'Copied!'; } catch (e) { $('#cp').textContent = 'Copy blocked here'; } };
 const tick = () => { const e = $('#cd'); if (!e) return clearInterval(iv); const m = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1) - new Date(); if (m <= 0) { e.textContent = 'A new seven is ready — refresh!'; return; }
  e.textContent = `Next seven in ${Math.floor(m / 36e5)}h ${String(Math.floor(m % 36e5 / 6e4)).padStart(2, '0')}m ${String(Math.floor(m % 6e4 / 1e3)).padStart(2, '0')}s`; };
 const iv = setInterval(tick, 1000); tick();
}

function lab() {
 practice = true; PR = null; head(-2); $('#pips').innerHTML = '';
 card(`<div class="rhead"><span class="tag" style="--c:var(--cyan)">Game lab</span><span class="small">Practice mode · scores aren't saved</span></div><h2>Every game, any time</h2><p class="lede">Each try deals a random puzzle. Your daily seven is untouched.</p>
  <div class="labgrid">${CATS.map(c => `<div class="labcat" style="--c:${col(c.id)}"><h3>${icon(c.id)}${esc(c.name)}</h3>${c.modes.map(m => `<button class="labb" data-k="${c.id}.${m}"><b>${esc(M[c.id + '.' + m].name)}</b><span>${esc(M[c.id + '.' + m].how)}</span></button>`).join('')}</div>`).join('')}</div>
  <div class="row"><a class="link" href="#">← Back to today's seven</a></div>`);
 document.querySelectorAll('.labb').forEach(b => b.onclick = () => labPlay(b.dataset.k));
}
function labPlay(key) {
 const day = Math.floor(Math.random() * 5000); shell(key, 0, 'Game lab'); let fired = false;
 M[key].run($('#stage'), ctxFor(key, 0, day, (score, note) => { if (fired) return; fired = true; verdict(Math.round(clamp(score, 0, 100)), note, 'Back to the lab', lab);
  $('#after .row').insertAdjacentHTML('afterbegin', '<button class="btn ghost" id="again">Another one</button>'); $('#again').onclick = () => labPlay(key); }));
}
window.D7_TEST = {M, CATS, lineup, labPlay, TODAY};

/* ---------- unlimited practice: endless random sevens ---------- */
function practiceStart() {
 practice = true; const R = Math.random;
 PR = {line: CATS.map(c => c.id + '.' + c.modes[Math.floor(R() * c.modes.length)]), days: CATS.map(() => 1000 + Math.floor(R() * 200000)), scores: [], set: (PR ? PR.set : 0) + 1};
 prRound(0);
}
function prRound(i) {
 if (i >= 7) return prResults();
 const key = PR.line[i]; head(i); shell(key, i, `Practice set ${PR.set} · round ${i + 1} of 7`); let fired = false;
 M[key].run($('#stage'), ctxFor(key, i, PR.days[i], (score, note) => { if (fired) return; fired = true; score = Math.round(clamp(score, 0, 100)); PR.scores[i] = score; head(i);
  verdict(score, note, i < 6 ? 'Next round' : 'See your score', () => prRound(i + 1));
  $('#after .row').insertAdjacentHTML('afterbegin', '<a class="btn ghost" href="#">Quit practice</a>'); }));
}
function prResults() {
 head(-1); const total = PR.scores.reduce((a, b) => a + b, 0);
 const pb = store.get('pbest', 0); if (total > pb) store.set('pbest', total); const played = store.get('pplayed', 0) + 1; store.set('pplayed', played);
 card(`<div class="hero res"><div class="hero-t"><p class="kicker">Practice set ${PR.set} · not counted in your streak</p><div class="big">${total}<small>/700</small></div>
  <p class="lede strong">${total > pb && pb ? 'New practice best!' : total >= 450 ? 'Strong set.' : 'Warming up — go again.'}</p>
  <div class="stats"><div><b>${Math.max(pb, total)}</b><span>Practice best</span></div><div><b>${played}</b><span>Sets played</span></div><div><b>${PR.set}</b><span>This session</span></div></div></div>
  <div class="hero-r">${ring(PR.scores, total, 'of 700')}</div></div>
  <div class="bars">${PR.line.map((k, i) => `<div class="bar" style="--c:${col(k.split('.')[0])}"><span>${esc(M[k].name)}</span><div class="tr"><i data-w="${PR.scores[i]}"></i></div><b>${PR.scores[i]}</b></div>`).join('')}</div>
  <div class="row"><button class="btn" id="again7">Play another seven</button><a class="link" href="#lab">Pick a game in the lab</a><a class="link" href="#">Back to today's daily</a></div>`);
 requestAnimationFrame(() => document.querySelectorAll('.bar i').forEach(x => x.style.width = x.dataset.w + '%'));
 $('#again7').onclick = practiceStart;
}

function route() { if (location.hash === '#practice') return practiceStart(); if (location.hash === '#lab') return lab(); practice = false; PR = null; load(); if (S.scores.length >= 7) results(); else start(); }
window.addEventListener('hashchange', route);
route();
})();
