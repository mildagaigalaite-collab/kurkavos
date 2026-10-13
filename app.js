/* Kur Kavos? – Vilniaus kavos žaidimas
   Duomenys: places.json (generuojamas iš „places (v8)“ lentelės – žr. tools/build.py)
   Jokių slapukų, jokios analitikos, vieta niekur nesiunčiama. */
(function () {
'use strict';

/* ───────────── helpers ───────────── */
const $  = s => document.querySelector(s);
const $$ = s => Array.prototype.slice.call(document.querySelectorAll(s));
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const show = id => { $$('.screen').forEach(s => s.classList.remove('on')); $(id).classList.add('on'); window.scrollTo(0, 0); };
const setCup = f => { $('#cupLiquid').style.transform = 'scaleY(' + Math.max(0, Math.min(1, f)) + ')'; };

/* ───────────── constants ───────────── */
const BOUNDS = [[54.55, 25.00], [54.85, 25.50]];          // Vilnius-ish
const OLD_TOWN = { lat: 54.6812, lng: 25.2874, label: 'Senamiestis' };
const DISTRICTS = [
  { k: 'senamiestis',  n: 'Senamiestis',  lat: 54.6812, lng: 25.2874 },
  { k: 'centras',      n: 'Centras',      lat: 54.6889, lng: 25.2700 },
  { k: 'naujamiestis', n: 'Naujamiestis', lat: 54.6785, lng: 25.2705 },
  { k: 'stotis',       n: 'Stotis',       lat: 54.6702, lng: 25.2830 },
  { k: 'uzupis',       n: 'Užupis',       lat: 54.6810, lng: 25.2950 },
  { k: 'paupys',       n: 'Paupys',       lat: 54.6795, lng: 25.3030 },
  { k: 'snipiskes',    n: 'Šnipiškės',    lat: 54.6965, lng: 25.2740 },
  { k: 'zverynas',     n: 'Žvėrynas',     lat: 54.6935, lng: 25.2560 },
  { k: 'antakalnis',   n: 'Antakalnis',   lat: 54.6950, lng: 25.3080 },
  { k: 'zirmunai',     n: 'Žirmūnai',     lat: 54.7110, lng: 25.2890 }
];
const DETOUR = 1.3;                                       // gatvės vs. tiesi linija
const SPD = { walk: 4.8, bike: 15, car: 24 };             // km/h
const SPEEDS = {
  stay: { lab: 'noriu nejudėti', k: 2.5 },
  walk: { lab: 'eisiu',          k: 1.5 },
  ride: { lab: 'važiuosiu',      k: 0.6 },
  fly:  { lab: 'skrisiu',        k: 0.15 }
};
/* kiek leidžiam, ir kaip plečiam, jei per mažai vietų */
const LADDER = {
  stay: [{ m: 'walk', max: 5 },  { m: 'walk', max: 10 }, { m: 'walk', max: 15 }, { m: 'bike', max: 20 }, { m: 'any' }],
  walk: [{ m: 'walk', max: 15 }, { m: 'walk', max: 25 }, { m: 'bike', max: 20 }, { m: 'any' }],
  ride: [{ m: 'bike', max: 20 }, { m: 'bike', max: 30 }, { m: 'any' }],
  fly:  [{ m: 'any' }]
};
const MIN_DECK = 4;

const LT = {
  'specialty':'rūšinė kava','own-roastery':'sava skrudykla','filter-focus':'filtras','classic-espresso':'espresso',
  'laptop-friendly':'su kompu','co-working':'koworkingas',quiet:'tylu',lively:'gyva',cozy:'jauku',minimalist:'minimalizmas',
  'design-forward':'dizainas','hidden-gem':'paslaptis','instagram-worthy':'fotogeniška','no-frills':'be pretenzijų',retro:'retro',
  'good-for-groups':'kompanijai','date-spot':'pasimatymui','solo-friendly':'vienam','kid-friendly':'su vaikais',
  'full-brunch':'brunch','lunch-savory':'sotu',pastries:'kepiniai','cake-notable':'tortai','vegan-options':'vegan',
  'outdoor-seating':'terasa',spacious:'erdvu',tiny:'mažytė',scenic:'vaizdas','opens-early':'anksti','closes-early':'iki 15','cash-only':'grynais','takeaway-only':'tik išsinešti','open-late':'vėlai',vegetarian:'vegetariška'
};
/* struktūriniai žymenys – naudojami atrankai, bet kortelėje nerodomi */
const HIDE = new Set(['specialty','grab-and-go','takeaway-cups','card-ok','cash-only','chain','retail-only','by-appointment','station','central',
  'old-town','naujamiestis','uzupis','paupys','snipiskes','zverynas','antakalnis','zirmunai','vilkpede','balsiai','budget','mid','splurge','closes-early','opens-early','open-late','wild']);

/* klausimai. w = žymenų svoriai (kiek gerai tinka); m = ar vieta išvis tinka (TAIP = privaloma); ord = kurį atsisakom pirmą, jei vietų per mažai */
const has = (p, ...t) => t.some(x => p.tags.indexOf(x) >= 0);
const Q = [
  { k: 'sweet',   q: 'Kažko skanaus?',        ord: 1, m: p => has(p, 'cake-notable', 'pastries'),
    w: { 'cake-notable': 3, pastries: 2, 'vegan-options': .5 } },
  { k: 'hungry',  q: 'Išalkai?',              ord: 4, m: p => has(p, 'full-brunch', 'lunch-savory'),
    w: { 'full-brunch': 3, 'lunch-savory': 3 } },
  { k: 'work',    q: 'Sėdėsi prie kompo?',    ord: 5, m: p => has(p, 'laptop-friendly') && !has(p, 'takeaway-only'),
    w: { 'laptop-friendly': 3, quiet: 2, 'co-working': 1.5, lively: -1.5 } },
  { k: 'friends', q: 'Eini su kompanija?',    ord: 3, m: p => has(p, 'good-for-groups', 'spacious', 'lively', 'outdoor-seating') && !has(p, 'tiny', 'takeaway-only'),
    w: { 'good-for-groups': 3, spacious: 2, lively: 1.5, 'outdoor-seating': 1, tiny: -2 } },
  { k: 'date',    q: 'Pasimatymas?',          ord: 2, m: p => has(p, 'date-spot', 'cozy', 'instagram-worthy') && !has(p, 'takeaway-only'),
    w: { 'date-spot': 3, cozy: 2, 'instagram-worthy': 1, lively: -.5, 'grab-and-go': -2 } }
];
const RECAP = { sweet:'kažko saldaus', hungry:'pavalgyt', work:'su kompu', friends:'su kompanija', date:'pasimatymas' };
const SKIP_LT = { sweet:'saldumyną', hungry:'valgį', work:'kompą', friends:'kompaniją', date:'pasimatymą' };

/* ───────────── state ───────────── */
let P = [];
let ans = {}, qi = 0, qskip = false;
let origin = null;                 // {lat,lng,label}
let speed = null;
let deck = [], pi = 0, brandPen = {}, tagPen = {}, matched = null;
let pickMap = null, pickPin = null, matchMap = null;

/* ───────────── time / opening hours ───────────── */
const DAYS = ['Mo','Tu','We','Th','Fr','Sa','Su'];
const DAY_LT = ['pirmadienį','antradienį','trečiadienį','ketvirtadienį','penktadienį','šeštadienį','sekmadienį'];
function vilniusNow() {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Vilnius', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date());
  const get = t => (parts.find(p => p.type === t) || {}).value;
  const dow = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].indexOf(get('weekday'));
  return { dow: dow < 0 ? 0 : dow, min: (parseInt(get('hour'), 10) % 24) * 60 + parseInt(get('minute'), 10) };
}
/* "Mo-Fr 08:00-15:00; Sa 10:00-15:00" → [{days:[0..], from, to}] */
function parseHours(str) {
  if (!str) return null;
  const rules = [];
  str.split(';').forEach(part => {
    const m = part.trim().match(/^([A-Za-z,\-\s]+?)\s+(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/);
    if (!m) return;
    const days = [];
    m[1].split(',').forEach(tok => {
      tok = tok.trim();
      const r = tok.split('-');
      if (r.length === 2) { for (let i = DAYS.indexOf(r[0]); i <= DAYS.indexOf(r[1]) && i >= 0; i++) days.push(i); }
      else if (DAYS.indexOf(tok) >= 0) days.push(DAYS.indexOf(tok));
    });
    rules.push({ days, from: +m[2] * 60 + +m[3], to: +m[4] * 60 + +m[5] });
  });
  return rules.length ? rules : null;
}
const hhmm = m => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
function openStatus(p, now) {
  if (!p.rules) return { known: false };
  const today = p.rules.filter(r => r.days.indexOf(now.dow) >= 0);
  for (const r of today) if (now.min >= r.from && now.min < r.to) return { known: true, open: true, until: hhmm(r.to), left: r.to - now.min };
  for (const r of today.slice().sort((a, b) => a.from - b.from)) if (now.min < r.from) return { known: true, open: false, next: 'šiandien ' + hhmm(r.from) };
  for (let d = 1; d <= 7; d++) {
    const dow = (now.dow + d) % 7;
    const rs = p.rules.filter(r => r.days.indexOf(dow) >= 0).sort((a, b) => a.from - b.from);
    if (rs.length) return { known: true, open: false, next: (d === 1 ? 'rytoj ' : DAY_LT[dow] + ' ') + hhmm(rs[0].from) };
  }
  return { known: true, open: false, next: '' };
}

/* ───────────── geo ───────────── */
function km(a, b, c, d) {
  const R = 6371, r = Math.PI / 180, dLat = (c - a) * r, dLng = (d - b) * r;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a * r) * Math.cos(c * r) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}
function enrich(p) {                    // atstumai nuo origin
  const d = km(origin.lat, origin.lng, p.lat, p.lng) * DETOUR;
  p._km = d;
  p._walk = Math.max(1, Math.round(d / SPD.walk * 60));
  p._bike = Math.max(1, Math.round(d / SPD.bike * 60));
  p._car  = Math.max(2, Math.round(d / SPD.car * 60));
}
function travel(p) {                    // ką rodom kortelėje
  if (p._walk <= 8) return { min: p._walk, mode: 'pėsčiom', g: 'walking' };
  if ((speed === 'stay' || speed === 'walk') && p._walk <= 25) return { min: p._walk, mode: 'pėsčiom', g: 'walking' };
  if (speed === 'ride' || (speed !== 'fly' && p._bike <= 25)) return { min: p._bike, mode: 'ant ratų', g: 'bicycling' };
  return { min: p._car, mode: 'važiuojant', g: 'driving' };
}
function within(p, step) {
  if (step.m === 'any') return true;
  return (step.m === 'walk' ? p._walk : p._bike) <= step.max;
}
function stepLabel(step) {
  if (step.m === 'any') return 'visame mieste';
  return 'iki ' + step.max + ' min ' + (step.m === 'walk' ? 'pėsčiom' : 'ant ratų');
}

/* ───────────── ranking ─────────────
   1) atidaryta (žinomai uždarytų nerodom)
   2) atstumas – rūpi labiausiai: ~5 min kelio ≈ 1 balas
   3) kriterijai: kiekvienas TAIP yra privalomas filtras; jei per mažai – atsisakom mažiausiai svarbaus
   4) smulkmenos: paros metas, Google įvertinimas (su atsiliepimų skaičiumi), „wild“ vietos – žemiau                     */
const PER_MIN = { stay: .3, walk: .2, ride: .12, fly: .03 };   // balų už minutę kelio (pėsčiom / dviračiu / mašina pagal greitį)
const CLOSING_SOON = 45;                                        // min iki uždarymo
function weights() {
  const w = {};
  Q.forEach(q => { if (ans[q.k]) for (const t in q.w) w[t] = (w[t] || 0) + q.w[t]; });
  return w;
}
const ratingBonus = p => {                                       // Bayes: mažai atsiliepimų – artėja prie vidurkio 4.4
  if (!p.rating) return 0;
  const m = 100, adj = (p.reviews * p.rating + m * 4.4) / (p.reviews + m);
  return Math.max(-.5, Math.min(.5, adj - 4.4));
};
function score(p, now, w) {
  let s = 0;
  /* kiek gerai tinka atsakymams (visos vietos jau praėjo filtrą, čia tik „kuri geriau“) */
  p.tags.forEach(t => { if (w[t]) s += w[t] / 3; if (tagPen[t]) s += tagPen[t]; });

  /* atstumas */
  s -= (speed === 'ride' ? p._bike : speed === 'fly' ? p._car : p._walk) * PER_MIN[speed];   // visada to paties matavimo vienetais
  if (speed === 'fly') {                       // verta važiuoti tik dėl ko nors ypatingo
    ['own-roastery','hidden-gem','design-forward','scenic'].forEach(x => { if (has(p, x)) s += .3; });
    if (p._km > 3 && has(p, 'grab-and-go', 'station', 'tiny')) s -= .5;
  }

  /* paros metas */
  const h = now.min / 60, st = p._status;
  if (h < 11) { if (has(p, 'full-brunch')) s += .5; if (has(p, 'opens-early')) s += .3; if (has(p, 'pastries')) s += .15; }
  else if (h < 17) { if (has(p, 'lunch-savory')) s += .15; }
  else if (!st.known && has(p, 'closes-early')) s -= 1.3;
  if (h >= 18 && has(p, 'open-late')) s += .5;
  if (st.known && st.open) { s += .2; if (st.left <= CLOSING_SOON) s -= 3; }   // greit užsidarys – ne pirma

  s += ratingBonus(p) + (has(p, 'specialty') ? .1 : 0);
  if (has(p, 'wild')) s -= 2;                  // keisčiau – ne pirmas pasirinkimas, bet nešalinam
  s += brandPen[p.brand] || 0;
  return s + Math.random() * .3;
}
function prepare() {
  const now = vilniusNow();
  P.forEach(p => { enrich(p); p._status = openStatus(p, now); });
  return now;
}
function buildDeck() {
  const now = prepare(), w = weights();
  const live = P.filter(p => !(p._status.known && !p._status.open));      // žinomai uždarytų nerodom
  const pool = live.length >= 1 ? live : P;
  const ladder = LADDER[speed];
  const yes = Q.filter(q => ans[q.k]).sort((a, b) => b.ord - a.ord);       // svarbiausi pirmi
  const last = ladder.length - 1;
  let cands = [], used = 0, dropped = [];
  /* 1 fazė: neišeinam už „kur esi“ spindulio – jei per mažai, atsisakom mažiausiai svarbaus kriterijaus (svarbiausio – niekada).
     2 fazė: tik jei ir taip tuščia – plečiam iki viso miesto, kriterijus laikom privalomais. */
  const tryIt = (keep, i) => { const c = pool.filter(p => within(p, ladder[i]) && keep.every(q => q.m(p))); return c.length >= MIN_DECK ? c : null; };
  search: {
    for (let d = 0; d < Math.max(yes.length, 1); d++) {
      const keep = yes.slice(0, yes.length - d);
      for (let i = 0; i < last; i++) {
        const c = tryIt(keep, i);
        if (c) { cands = c; used = i; dropped = yes.slice(yes.length - d).map(q => q.k).reverse(); break search; }
      }
    }
    for (let d = 0; d <= yes.length; d++) {
      const keep = yes.slice(0, yes.length - d);
      const c = tryIt(keep, last) || (d === yes.length ? pool : null);
      if (c) { cands = c; used = last; dropped = yes.slice(yes.length - d).map(q => q.k).reverse(); break search; }
    }
  }
  const ranked = cands.map(p => ({ p, s: score(p, now, w) })).sort((a, b) => b.s - a.s);
  const out = [], perBrand = {};
  let prev = null;
  while (out.length < 8 && ranked.length) {
    let i = ranked.findIndex(r => out.indexOf(r.p) < 0 && r.p.brand !== prev && (perBrand[r.p.brand] || 0) < 2);
    if (i < 0) i = ranked.findIndex(r => out.indexOf(r.p) < 0 && (perBrand[r.p.brand] || 0) < 2);
    if (i < 0) break;
    const p = ranked[i].p; out.push(p); prev = p.brand; perBrand[p.brand] = (perBrand[p.brand] || 0) + 1;
  }
  deck = out; pi = 0;

  const note = $('#decknotice'), msgs = [];
  if (used > 0) msgs.push(speed === 'stay' ? 'Deja, teks pajudėti.' : 'Arti per mažai tinkamų, ieškom ' + stepLabel(ladder[used]) + '.');
  if (dropped.length) msgs.push('Visko iškart nesurasta, tad praleidau: ' + dropped.map(k => SKIP_LT[k]).join(', ') + '.');
  if (now.min >= 20 * 60 || now.min < 7 * 60) msgs.push('Vėlu, patikrink darbo laiką.');
  note.textContent = msgs.join(' ');
  note.hidden = !msgs.length;
}

/* ───────────── swipe engine ───────────── */
function makeSwipe(el, onDone) {
  let sx = 0, dx = 0, drag = false;
  const yes = el.querySelector('.stamp.yes'), no = el.querySelector('.stamp.no');
  el.addEventListener('pointerdown', e => { drag = true; sx = e.clientX; dx = 0; try { el.setPointerCapture(e.pointerId); } catch (_) {} el.style.transition = 'none'; });
  el.addEventListener('pointermove', e => {
    if (!drag) return;
    dx = e.clientX - sx;
    el.style.transform = 'translate(' + dx + 'px,0) rotate(' + dx / 16 + 'deg)';
    if (yes) yes.style.opacity = Math.max(0, Math.min(1, dx / 90));
    if (no)  no.style.opacity  = Math.max(0, Math.min(1, -dx / 90));
  });
  const up = () => {
    if (!drag) return; drag = false;
    el.style.transition = 'transform .3s ease, opacity .3s ease';
    if (Math.abs(dx) > 92) { fly(el, dx > 0); onDone(dx > 0); }
    else { el.style.transform = ''; if (yes) yes.style.opacity = 0; if (no) no.style.opacity = 0; }
    dx = 0;
  };
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);
}
function fly(el, right) {
  el.style.transition = 'transform .34s ease, opacity .34s ease';
  el.style.transform = 'translate(' + (right ? 520 : -520) + 'px,' + (right ? -40 : 40) + 'px) rotate(' + (right ? 26 : -26) + 'deg)';
  el.style.opacity = '0';
  setTimeout(() => el.remove(), 340);
}
function buttonSwipe(sel, right, handler) {
  $(sel).addEventListener('click', () => {
    const top = $(sel.charAt(1) === 'q' ? '#qdeck .card:last-child' : '#pdeck .card:last-child');
    if (!top || top.dataset.busy) return;
    top.dataset.busy = '1';
    const s = top.querySelector(right ? '.stamp.yes' : '.stamp.no'); if (s) s.style.opacity = 1;
    fly(top, right); handler(right);
  });
}

/* ───────────── round 1: klausimai ───────────── */
const activeQ = () => Q;
function renderQ() {
  const d = $('#qdeck'); d.innerHTML = '';
  const list = activeQ();
  setCup(qi / (list.length + 2));
  if (qi >= list.length) { goMap(); return; }
  for (let k = Math.min(qi + 2, list.length - 1); k >= qi; k--) {
    const q = list[k], c = document.createElement('div');
    c.className = 'card qcard' + (k > qi ? ' behind' : '');
    c.style.transform = k > qi ? 'translateY(' + (k - qi) * 7 + 'px) scale(' + (1 - (k - qi) * .03) + ')' : '';
    c.style.zIndex = 100 - k;
    c.innerHTML = '<div class="stamp yes">TAIP</div><div class="stamp no">NE</div><p class="q">' + esc(q.q) + '</p><p class="hint">← ne · taip →</p>';
    d.appendChild(c);
    if (k === qi) makeSwipe(c, v => answerQ(q, v));
  }
}
function answerQ(q, v) {
  ans[q.k] = v;
  qi++;
  setTimeout(renderQ, 300);
}
buttonSwipe('#qyes', true,  v => { const l = activeQ(); answerQ(l[qi], v); });
buttonSwipe('#qno',  false, v => { const l = activeQ(); answerQ(l[qi], v); });

/* ───────────── žemėlapis: kur esi ───────────── */
const tileLayer = (map) => {
  const l = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19, attribution: '© <a href="https://www.openstreetmap.org/copyright" rel="noopener">OpenStreetMap</a>'
  });
  /* jei plytelės neužsikrauna (užblokuota / be interneto) – žemėlapis lieka naudojamas: popierius, tinklelis, rajonų pavadinimai */
  let ok = 0, bad = 0, labels = null;
  l.on('tileload', () => { ok++; map.getContainer().classList.remove('notiles'); if (labels) { map.removeLayer(labels); labels = null; } });
  l.on('tileerror', () => {
    bad++;
    if (ok === 0 && bad >= 3) {
      map.getContainer().classList.add('notiles');
      if (!labels && map === pickMap) {
        labels = L.layerGroup(DISTRICTS.map(d => L.marker([d.lat, d.lng], { interactive: false, keyboard: false,
          icon: L.divIcon({ className: 'dlabel', html: '<span>' + esc(d.n) + '</span>', iconSize: [0, 0] }) }))).addTo(map);
      }
    }
  });
  return l;
};
const meIcon = () => L.divIcon({ className: '', html: '<div class="me-pin"></div>', iconSize: [26, 26], iconAnchor: [13, 24] });
function goMap() {
  show('#s-map'); setCup(.55);
  initPickMap();
}
function initPickMap() {
  if (pickMap) { setTimeout(() => pickMap.invalidateSize(), 60); return; }
  pickMap = L.map('pickmap', { maxBounds: BOUNDS, minZoom: 11, zoomSnap: .5, scrollWheelZoom: false }).setView([54.6865, 25.2800], 13);
  tileLayer(pickMap).addTo(pickMap);
  const dot = L.divIcon({ className: '', html: '<div class="cafe-dot"></div>', iconSize: [12, 12], iconAnchor: [6, 6] });
  P.forEach(p => L.marker([p.lat, p.lng], { icon: dot, interactive: false, keyboard: false }).addTo(pickMap));
  pickMap.on('click', e => setOrigin(e.latlng.lat, e.latlng.lng, 'pažymėta žemėlapyje'));
  pickMap.once('click', () => pickMap.scrollWheelZoom.enable());
  setTimeout(() => pickMap.invalidateSize(), 60);
}
function setOrigin(lat, lng, label, distKey, zoom) {
  origin = { lat, lng, label };
  if (pickPin) pickPin.setLatLng([lat, lng]); else pickPin = L.marker([lat, lng], { icon: meIcon(), keyboard: false }).addTo(pickMap);
  if (zoom) pickMap.setView([lat, lng], zoom); else pickMap.panTo([lat, lng]);
  $('#whereis').innerHTML = '📍 <b>' + esc(label) + '</b>';
  $$('.dchip').forEach(c => c.classList.toggle('sel', c.dataset.k === distKey));
  chk();
}
DISTRICTS.forEach(d => {
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'dchip'; b.dataset.k = d.k; b.textContent = d.n;
  b.addEventListener('click', () => { if (!pickMap) initPickMap(); setOrigin(d.lat, d.lng, d.n, d.k, 14.5); });
  $('#dchips').appendChild(b);
});
$('#geo').addEventListener('click', () => {
  const note = $('#geonote');
  if (!navigator.geolocation) { note.textContent = 'Naršyklė nemoka nustatyti vietos – pažymėk ją žemėlapyje.'; return; }
  note.textContent = 'Ieškom tavęs…';
  navigator.geolocation.getCurrentPosition(pos => {
    const lat = pos.coords.latitude, lng = pos.coords.longitude;
    if (lat < BOUNDS[0][0] || lat > BOUNDS[1][0] || lng < BOUNDS[0][1] || lng > BOUNDS[1][1]) {
      note.textContent = 'Atrodo, kad esi ne Vilniuje. Pažymėk žemėlapyje, kur norėtum gerti kavą.'; return;
    }
    setOrigin(lat, lng, 'tavo vieta', null, 15);
    note.textContent = 'Tavo vieta lieka tik tavo naršyklėje – niekur nesiunčiama.';
  }, () => { note.textContent = 'Vietos gauti nepavyko – pažymėk ją žemėlapyje arba pasirink rajoną.'; },
  { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 });
});
$$('#speed li').forEach(li => {
  const pick = () => { $$('#speed li').forEach(x => x.classList.remove('sel')); li.classList.add('sel'); speed = li.dataset.s; chk(); };
  li.addEventListener('click', pick);
  li.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } });
});
function chk() {
  const b = $('#mapNext'), ok = origin && speed;
  b.disabled = !ok;
  b.textContent = ok ? 'Kaičiam' : !origin ? 'Pirma pažymėk, kur esi' : 'Dabar pasirink greitį';
}
$('#mapNext').addEventListener('click', () => {
  const r = $('#recap'); r.innerHTML = '';
  const bits = Object.keys(ans).filter(k => ans[k]).map(k => RECAP[k]);
  bits.push(SPEEDS[speed].lab);
  bits.push(origin.label === 'tavo vieta' || origin.label === 'pažymėta žemėlapyje' ? 'iš čia' : origin.label);
  bits.forEach(b => { const s = document.createElement('span'); s.className = 'chip'; s.textContent = b; r.appendChild(s); });
  show('#s-brew'); setCup(.8);
  buildDeck();
  setTimeout(() => { show('#s-deck'); setCup(1); renderP(); }, 2600);
});

/* ───────────── round 2: vietos ───────────── */
function cardTags(p, n) {
  const w = weights();
  const tw = p.tags.indexOf('takeaway-only') >= 0 ? ['takeaway-only'] : [];
  return tw.concat(p.tags.filter(t => LT[t] && !HIDE.has(t) && t !== 'takeaway-only').sort((a, b) => (w[b] || 0) - (w[a] || 0))).slice(0, n || 4);
}
function statusHtml(p) {
  const s = p._status;
  if (!s.known) return '';
  if (s.open && s.left <= CLOSING_SOON) return '<span class="shut">užsidaro po ' + s.left + ' min</span>';
  return s.open ? '<span class="open">atidaryta iki ' + s.until + '</span>' : '<span class="shut">uždaryta' + (s.next ? ' · atidaro ' + s.next : '') + '</span>';
}
/* citata: iš turimų (LT / EN) renkam tą, kuri labiausiai atitinka tavo atsakymus */
function pickQuote(p) {
  if (!p.quotes || !p.quotes.length) return null;
  const w = weights();
  let best = null, bs = -1;
  p.quotes.forEach(q => {
    let s = q.l === 'lt' ? .4 : 0;
    q.tags.forEach(t => { if (w[t] > 0) s += w[t]; });
    if (s > bs) { bs = s; best = q; }
  });
  return best;
}
function quoteHtml(p) {
  const q = pickQuote(p);
  if (!q) return '';
  return '<blockquote class="quote"' + (q.l === 'en' ? ' lang="en"' : '') + '>„' + esc(q.t) + '“<small>— ' + esc(q.by || 'Google atsiliepimas') + (q.d ? ', ' + esc(q.d) : '') + '</small></blockquote>';
}
function placeCard(p, top) {
  const t = travel(p), c = document.createElement('div');
  c.className = 'card pcard' + (top ? '' : ' behind');
  const hue = ['#fa9658', '#c68e61', '#bc3c3a', '#7c4e21'][p.name.length % 4];
  c.innerHTML =
    '<div class="stamp yes">ČIA</div><div class="stamp no">NE</div>' +
    '<div class="pic" style="background:' + hue + '"><svg viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true">' +
    '<path d="M0 30 Q25 14 50 24 T100 18 L100 40 L0 40Z" fill="#fff9ba" opacity=".28"/>' +
    '<path d="M0 36 Q30 24 56 32 T100 28 L100 40 L0 40Z" fill="#fff9ba" opacity=".22"/></svg>' +
    '<div class="initial">' + esc(p.name[0]) + '</div></div>' +
    '<div class="pbody"><h3 class="pname">' + esc(p.name) + '</h3>' +
    '<div class="meta"><span>' + esc(p.area) + '</span><span class="dist">apie ' + t.min + ' min ' + t.mode + '</span><span>' + '€'.repeat(p.price) + '</span>' + statusHtml(p) + '</div>' +
    '<p class="blurb">' + esc(p.blurb) + '</p>' +
    '<div class="chips">' + cardTags(p, 4).map(x => '<span class="chip">' + LT[x] + '</span>').join('') + '</div></div>';
  return c;
}
function renderP() {
  const d = $('#pdeck'); d.innerHTML = '';
  $('#deckleft').textContent = Math.min(pi + 1, deck.length) + '/' + deck.length;
  if (pi >= deck.length) {
    d.innerHTML = '<div class="card" style="justify-content:center;text-align:center"><div class="empty"><p class="pname" style="margin-bottom:12px">Viskas peržiūrėta</p>' +
      '<p style="margin:0 0 18px">Nė vienos nepasirinkai. Gal pradėti iš naujo su kitais atsakymais?</p>' +
      '<button class="btn" id="again" type="button">Iš naujo</button></div></div>';
    $('#again').addEventListener('click', reset);
    return;
  }
  for (let k = Math.min(pi + 2, deck.length - 1); k >= pi; k--) {
    const c = placeCard(deck[k], k === pi);
    c.style.transform = k > pi ? 'translateY(' + (k - pi) * 7 + 'px) scale(' + (1 - (k - pi) * .03) + ')' : '';
    c.style.zIndex = 100 - k;
    d.appendChild(c);
    if (k === pi) makeSwipe(c, v => answerP(deck[k], v));
  }
}
function answerP(p, v) {
  if (v) { matched = p; setTimeout(showMatch, 320); return; }
  brandPen[p.brand] = (brandPen[p.brand] || 0) - 1;                      // tinklas – švelniai žemyn
  p.tags.forEach(t => { tagPen[t] = (tagPen[t] || 0) - .1; });          // stilius – dar švelniau
  pi++;
  const now = vilniusNow(), w = weights();
  const rest = deck.slice(pi).map(x => ({ p: x, s: score(x, now, w) })).sort((a, b) => b.s - a.s).map(x => x.p);
  deck = deck.slice(0, pi).concat(rest);
  setTimeout(renderP, 300);
}
buttonSwipe('#pyes', true,  () => answerP(deck[pi], true));
buttonSwipe('#pno',  false, () => answerP(deck[pi], false));

/* ───────────── match ───────────── */
function showMatch() {
  const p = matched, t = travel(p), w = weights();
  const hits = p.tags.filter(x => w[x] > 0 && LT[x]).map(x => LT[x]);
  $('#matchcard').innerHTML =
    '<h2>' + esc(p.name) + '</h2>' +
    '<div class="meta" style="margin-bottom:10px"><span>' + esc(p.area) + '</span><span class="dist">apie ' + t.min + ' min ' + t.mode + '</span><span>' + '€'.repeat(p.price) + '</span>' + statusHtml(p) + '</div>' +
    '<p style="margin:0 0 12px">' + esc(p.blurb) + '</p>' + quoteHtml(p) +
    '<p class="note" style="margin:0 0 12px">' + esc(p.address) + (p._status && !p._status.known ? ' · darbo laiko nežinau – patikrink žemėlapyje prieš važiuodamas' : '') + '</p>' +
    '<div class="chips">' + cardTags(p, 5).map(x => '<span class="chip">' + LT[x] + '</span>').join('') + '</div>' +
    '<details class="why"><summary>Kodėl ši?</summary><ul>' +
    (hits.length ? hits.map(h => '<li>' + esc(h) + '</li>').join('') : '<li>tiesiog gera kava</li>') +
    '<li>' + esc(SPEEDS[speed].lab) + ' → apie ' + t.min + ' min</li></ul></details>';
  $('#varom').href = 'https://www.google.com/maps/dir/?api=1&origin=' + origin.lat + ',' + origin.lng +
    '&destination=' + p.lat + ',' + p.lng + '&travelmode=' + t.g;
  show('#s-match');
  drawMatchMap(p);
}
function drawMatchMap(p) {
  if (matchMap) { matchMap.remove(); matchMap = null; }
  matchMap = L.map('matchmap', { zoomControl: true, scrollWheelZoom: false, zoomSnap: .5, maxBounds: BOUNDS, minZoom: 10 });
  tileLayer(matchMap).addTo(matchMap);
  const cafe = L.divIcon({ className: '', html: '<div class="cafe-pin"><span>☕</span></div>', iconSize: [32, 32], iconAnchor: [16, 30] });
  L.polyline([[origin.lat, origin.lng], [p.lat, p.lng]], { color: '#bc3c3a', weight: 3, dashArray: '6 8' }).addTo(matchMap);
  L.marker([origin.lat, origin.lng], { icon: meIcon(), keyboard: false }).addTo(matchMap);
  L.marker([p.lat, p.lng], { icon: cafe, keyboard: false, title: p.name }).addTo(matchMap);
  matchMap.fitBounds([[origin.lat, origin.lng], [p.lat, p.lng]], { padding: [34, 34], maxZoom: 16 });
  setTimeout(() => { matchMap.invalidateSize(); matchMap.fitBounds([[origin.lat, origin.lng], [p.lat, p.lng]], { padding: [34, 34], maxZoom: 16 }); }, 80);
}
$('#another').addEventListener('click', () => { pi++; show('#s-deck'); renderP(); });
$('#restart').addEventListener('click', reset);

/* ───────────── nav ───────────── */
$('#go').addEventListener('click', () => { show('#s-quiz'); renderQ(); });
$('#lucky').addEventListener('click', () => {
  const o = origin || OLD_TOWN;
  origin = { lat: o.lat, lng: o.lng, label: o.label };
  speed = speed || 'ride';
  prepare();
  const near = P.filter(p => p._km <= 4 && !(p._status.known && !p._status.open));
  const pool = near.length ? near : P;
  const wt = pool.map(p => p.tags.indexOf('wild') >= 0 ? 4 : 1);               // „Nustebink“: keistesnės vietos ištraukiamos dažniau
  let r = Math.random() * wt.reduce((a, b) => a + b, 0), k = 0;
  while (k < pool.length - 1 && (r -= wt[k]) >= 0) k++;
  matched = pool[k];
  showMatch();
  $('#varom').textContent = 'Važiuojam, Džesika';           // easter egg
});
function reset() {
  ans = {}; qi = 0; qskip = false; origin = null; speed = null; deck = []; pi = 0;
  brandPen = {}; tagPen = {}; matched = null;
  if (pickPin && pickMap) { pickMap.removeLayer(pickPin); pickPin = null; }
  $('#whereis').textContent = 'Paspausk žemėlapyje arba pasirink rajoną';
  $$('.dchip,#speed li').forEach(x => x.classList.remove('sel'));
  chk(); setCup(0); $('#varom').textContent = 'Varom';
  show('#s-landing');
}
document.addEventListener('keydown', e => {
  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
  if ($('#s-quiz').classList.contains('on')) $(e.key === 'ArrowRight' ? '#qyes' : '#qno').click();
  else if ($('#s-deck').classList.contains('on')) $(e.key === 'ArrowRight' ? '#pyes' : '#pno').click();
});

/* ───────────── start ───────────── */
setCup(0); chk();
fetch('places.json', { cache: 'no-cache' })
  .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
  .then(j => {
    P = j.places.map(p => Object.assign({}, p, { rules: parseHours(p.hours) }));
    $('#go').disabled = false; $('#lucky').disabled = false; $('#loadnote').hidden = true;
  })
  .catch(() => { $('#loadnote').textContent = 'Nepavyko užkrauti vietų. Perkrauk puslapį arba pažiūrėk sąrašą žemiau.'; });

})();
