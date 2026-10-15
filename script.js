/* =========================================================
   SOPRANI TRASPORTI — bozza demo
   Effetti: loader camion · mappa Europa con rotte · testo parola
   per parola · titolo gigante orizzontale · strada + camion ·
   bancali che si impilano · rimorchio che si riempie (preventivo)
   ========================================================= */
(() => {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const ease = t => 1 - Math.pow(1 - t, 3);
  const easeIn = t => t * t * t;

  $('#year').textContent = new Date().getFullYear();

  /* ---------- Progresso di una sezione "sticky" (0 → 1) ---------- */
  const progressOf = el => {
    const r = el.getBoundingClientRect();
    const total = r.height - window.innerHeight;
    return total > 0 ? clamp(-r.top / total) : 0;
  };

  /* ---------- Testo diviso in parole (hero) ---------- */
  const heroTitle = $('#heroTitle');
  heroTitle.innerHTML = heroTitle.textContent.trim().split(/\s+/)
    .map((w, i) => `<span class="w"><span style="transition-delay:${i * 60}ms">${w}</span></span>`).join(' ');

  /* ---------- Loader ---------- */
  const loader = $('#loader');
  const startSite = () => {
    loader.classList.add('done');
    heroTitle.classList.add('in');
  };
  if (reduced) startSite();
  else {
    const km = $('#loaderKm'); const t0 = performance.now();
    const tick = now => {
      const p = clamp((now - t0) / 1600);
      km.textContent = Math.round(ease(p) * 1996).toLocaleString('it-IT');
      if (p < 1) requestAnimationFrame(tick); else setTimeout(startSite, 200);
    };
    requestAnimationFrame(tick);
  }

  const heroPhoto = $('#heroPhoto');

  /* =========================================================
     1. MAPPA EUROPA A PUNTINI CON ROTTE DA CORTENUOVA
     ========================================================= */
  const canvas = $('#mapCanvas');
  const ctx = canvas.getContext('2d');
  const M = window.EUROPE_DOTS;
  const dots = M.d.split(' ').map(s => s.split(',').map(Number));
  const toGrid = (lon, lat) => [(lon - M.lonMin) * M.k / M.step, (M.latMax - lat) / M.step];
  const HOME = toGrid(9.79, 45.54); // Cortenuova
  // Rotte illustrative (da verificare con il cliente)
  const DEST = [
    [9.19, 45.46], [7.69, 45.07], [8.93, 44.41], [11.34, 44.49], [11.88, 45.41],
    [11.25, 43.77], [12.50, 41.90], [14.27, 40.85], [16.87, 41.12],
    [11.58, 48.14], [9.18, 48.78], [8.68, 50.11], [8.54, 47.37], [4.84, 45.76],
    [2.35, 48.86], [2.17, 41.39], [16.37, 48.21], [14.51, 46.05], [4.48, 51.92]
  ].map(([lo, la]) => toGrid(lo, la));
  const routes = DEST.map((d, i) => {
    const [x0, y0] = HOME, [x1, y1] = d;
    const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy);
    const bend = Math.min(len * 0.25, 10);
    // punto di controllo spostato perpendicolarmente → arco
    const cx = (x0 + x1) / 2 - dy / len * bend, cy = (y0 + y1) / 2 + dx / len * bend * (dx > 0 ? -1 : 1);
    return { d, c: [cx, cy], delay: 0.2 + i * 0.09, speed: 0.25 + (i % 5) * 0.05 };
  });
  const qb = (r, t) => {
    const [x0, y0] = HOME, [cx, cy] = r.c, [x1, y1] = r.d, u = 1 - t;
    return [u * u * x0 + 2 * u * t * cx + t * t * x1, u * u * y0 + 2 * u * t * cy + t * t * y1];
  };

  let W = 0, H = 0, DPR = 1;
  const resize = () => {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.clientWidth; H = canvas.clientHeight;
    canvas.width = W * DPR; canvas.height = H * DPR;
  };
  window.addEventListener('resize', resize); resize();

  let mapStart = null;
  const drawMap = (now, p) => {
    if (mapStart === null) mapStart = now;
    const t = (now - mapStart) / 1000 - (reduced ? 99 : 1.6); // parte dopo il loader
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, W, H);

    const mobile = W < 900;
    const s0 = Math.max(W / M.cols, H / M.rows) * (mobile ? 1.5 : 1.05);
    const zp = easeIn(clamp((p - 0.25) / 0.6));
    const s = s0 * (1 + zp * 16);
    // dove sta Cortenuova sullo schermo: a destra in alto → poi al centro
    const ax = (mobile ? 0.55 : 0.66) + ((0.5 - (mobile ? 0.55 : 0.66)) * ease(clamp(p / 0.6)));
    const ay = (mobile ? 0.22 : 0.4) + ((0.5 - (mobile ? 0.22 : 0.4)) * ease(clamp(p / 0.6)));
    const ox = W * ax - HOME[0] * s, oy = H * ay - HOME[1] * s;
    const X = gx => ox + gx * s, Y = gy => oy + gy * s;

    const fade = 1 - clamp((p - 0.6) / 0.25);
    ctx.globalAlpha = fade;

    // puntini
    const r = Math.min(Math.max(s * 0.17, 0.8), 6);
    for (let i = 0; i < dots.length; i++) {
      const x = X(dots[i][0]), y = Y(dots[i][1]);
      if (x < -10 || y < -10 || x > W + 10 || y > H + 10) continue;
      const dist = Math.hypot(dots[i][0] - HOME[0], dots[i][1] - HOME[1]);
      const a = 0.16 + 0.35 * clamp(1 - dist / 30);
      ctx.fillStyle = `rgba(120,160,240,${a})`;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }

    // rotte
    ctx.lineCap = 'round';
    routes.forEach(rt => {
      const k = ease(clamp((t - rt.delay) / 1.1));
      if (k <= 0) return;
      ctx.strokeStyle = 'rgba(61,123,255,.55)'; ctx.lineWidth = 1.4;
      ctx.beginPath();
      for (let j = 0; j <= 40; j++) {
        const [gx, gy] = qb(rt, (j / 40) * k);
        j ? ctx.lineTo(X(gx), Y(gy)) : ctx.moveTo(X(gx), Y(gy));
      }
      ctx.stroke();
      if (k >= 1) {
        // impulso luminoso che viaggia sulla rotta
        const ph = ((t - rt.delay) * rt.speed) % 1;
        const [px, py] = qb(rt, ph);
        const g = ctx.createRadialGradient(X(px), Y(py), 0, X(px), Y(py), 8);
        g.addColorStop(0, 'rgba(160,200,255,1)'); g.addColorStop(1, 'rgba(61,123,255,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(X(px), Y(py), 8, 0, Math.PI * 2); ctx.fill();
        // destinazione
        ctx.fillStyle = '#9cc0ff';
        ctx.beginPath(); ctx.arc(X(rt.d[0]), Y(rt.d[1]), 2.6, 0, Math.PI * 2); ctx.fill();
      }
    });

    // Cortenuova
    const hx = X(HOME[0]), hy = Y(HOME[1]);
    const pulse = (now / 1600) % 1;
    ctx.strokeStyle = `rgba(61,123,255,${1 - pulse})`; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(hx, hy, 6 + pulse * 26, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(hx, hy, 5, 0, Math.PI * 2); ctx.fill();
    if (p < 0.2 && t > 0) {
      ctx.globalAlpha = fade * clamp(t / 0.6) * (1 - p / 0.2);
      ctx.font = '600 11px "JetBrains Mono", monospace';
      ctx.fillStyle = '#fff'; ctx.fillText('CORTENUOVA (BG)', hx + 14, hy + 4);
    }
    ctx.globalAlpha = 1;
  };

  /* =========================================================
     2. CONTACHILOMETRI (numeri)
     ========================================================= */
  $$('.odo[data-value]').forEach(el => {
    el.innerHTML = [...el.dataset.value].map(() =>
      `<span class="digit"><span class="digit-col">${[...'0123456789'].map(n => `<span>${n}</span>`).join('')}</span></span>`).join('');
  });
  const odoIO = new IntersectionObserver(entries => entries.forEach(e => {
    if (!e.isIntersecting) return;
    const digits = [...e.target.dataset.value];
    $$('.digit-col', e.target).forEach((col, i) => {
      col.style.transitionDelay = `${i * 120}ms`;
      col.style.transform = `translateY(-${digits[i]}em)`;
    });
    odoIO.unobserve(e.target);
  }), { threshold: 0.6 });
  $$('.odo[data-value]').forEach(el => odoIO.observe(el));

  /* =========================================================
     3. MANIFESTO: parole che si accendono
     ========================================================= */
  const mText = $('#manifestoText');
  const accents = ['trent\'anni,', 'Europa.', 'nostro,'];
  mText.innerHTML = mText.textContent.trim().split(/\s+/)
    .map(w => `<span class="mw${accents.includes(w) ? ' accent' : ''}">${w}</span>`).join(' ');
  const mWords = $$('.mw', mText);

  /* =========================================================
     6. STRADA + CAMION
     ========================================================= */
  const roadPath = $('#roadDraw'), roadDash = $('#roadDash'), roadTruck = $('#roadTruck');
  const L = roadPath.getTotalLength();
  roadPath.style.strokeDasharray = `${L} ${L}`;
  const stops = $$('#stops li');

  /* =========================================================
     7. MAGAZZINO ISOMETRICO
     ========================================================= */
  const iso = $('#iso');
  const U = 44, OX = 281, OY = 250, C30 = Math.cos(Math.PI / 6), S30 = 0.5;
  const P = (x, y, z) => [OX + (x - y) * C30 * U, OY + (x + y) * S30 * U - z * U];
  const pts = arr => arr.map(p => p.join(',')).join(' ');
  const svgNS = 'http://www.w3.org/2000/svg';
  const el = (tag, attrs, parent) => {
    const n = document.createElementNS(svgNS, tag);
    Object.entries(attrs).forEach(([k, v]) => n.setAttribute(k, v));
    parent.appendChild(n); return n;
  };
  const line = (a, b, attrs, parent) => el('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], ...attrs }, parent);
  const BAYS = 4, LEVELS = 3, BW = 1.15, LH = 1.05, DEPTH = 1, ROWS = [0, 2.6];
  const RACK_W = BAYS * BW, TOP = LEVELS * LH;
  const pallets = [];
  // pavimento + corsia
  el('polygon', { points: pts([P(-0.4, -0.4, 0), P(RACK_W + 0.4, -0.4, 0), P(RACK_W + 0.4, 4, 0), P(-0.4, 4, 0)]), fill: '#eef2f8' }, iso);
  el('polygon', { points: pts([P(-0.4, 1.25, 0), P(RACK_W + 0.4, 1.25, 0), P(RACK_W + 0.4, 2.35, 0), P(-0.4, 2.35, 0)]), fill: '#e2e8f2' }, iso);
  const beam = { stroke: '#f07d1a', 'stroke-width': 3, 'stroke-linecap': 'round' };
  const post = { stroke: '#1f4fd1', 'stroke-width': 3.2, 'stroke-linecap': 'round' };
  ROWS.forEach(ry => {
    const row = el('g', {}, iso);
    // montanti e traverse posteriori
    for (let b = 0; b <= BAYS; b++) line(P(b * BW, ry, 0), P(b * BW, ry, TOP), post, row);
    for (let z = 0; z <= LEVELS; z++) line(P(0, ry, z * LH), P(RACK_W, ry, z * LH), beam, row);
    for (let z = 0; z < LEVELS; z++) for (let b = 0; b < BAYS; b++) {
      const g = el('g', { class: 'pallet' }, row);
      const x = b * BW + 0.1, y = ry + 0.05, zz = z * LH + 0.02, w = 0.95, d = 0.9, h = 0.7;
      // bancale di legno
      el('polygon', { points: pts([P(x, y + d, zz), P(x + w, y + d, zz), P(x + w, y + d, zz + 0.12), P(x, y + d, zz + 0.12)]), fill: '#8a6a3d' }, g);
      el('polygon', { points: pts([P(x + w, y, zz), P(x + w, y + d, zz), P(x + w, y + d, zz + 0.12), P(x + w, y, zz + 0.12)]), fill: '#6f5430' }, g);
      // collo
      const z2 = zz + 0.12;
      el('polygon', { points: pts([P(x, y, z2 + h), P(x + w, y, z2 + h), P(x + w, y + d, z2 + h), P(x, y + d, z2 + h)]), fill: '#e4b878' }, g);
      el('polygon', { points: pts([P(x, y + d, z2), P(x + w, y + d, z2), P(x + w, y + d, z2 + h), P(x, y + d, z2 + h)]), fill: '#c99556' }, g);
      el('polygon', { points: pts([P(x + w, y, z2), P(x + w, y + d, z2), P(x + w, y + d, z2 + h), P(x + w, y, z2 + h)]), fill: '#a87a40' }, g);
      // nastro blu
      el('polygon', { points: pts([P(x + w * .45, y + d, z2), P(x + w * .55, y + d, z2), P(x + w * .55, y + d, z2 + h), P(x + w * .45, y + d, z2 + h)]), fill: '#1f4fd1', opacity: .75 }, g);
      g.style.transform = 'translateY(-90px)'; g.style.opacity = 0;
      pallets.push({ g, order: (ry ? 1000 : 0) + z * 100 + b });
    }
    // montanti e traverse anteriori
    for (let z = 0; z <= LEVELS; z++) line(P(0, ry + DEPTH, z * LH), P(RACK_W, ry + DEPTH, z * LH), beam, row);
    for (let b = 0; b <= BAYS; b++) line(P(b * BW, ry + DEPTH, 0), P(b * BW, ry + DEPTH, TOP), post, row);
  });
  pallets.sort((a, b) => a.order - b.order);
  const palletCount = $('#palletCount');
  let shownPallets = -1;
  const setPallets = n => {
    if (n === shownPallets) return; shownPallets = n;
    pallets.forEach((pl, i) => {
      const on = i < n;
      pl.g.style.transform = on ? 'translateY(0)' : 'translateY(-90px)';
      pl.g.style.opacity = on ? 1 : 0;
    });
    palletCount.textContent = n;
  };

  /* =========================================================
     LOOP PRINCIPALE (scroll + animazioni)
     ========================================================= */
  const hero = $('#hero'), heroContent = $('#heroContent'), zoomLabel = $('#zoomLabel'), hint = $('#scrollHint');
  const manifesto = $('#manifesto'), marquee = $('#marquee'), track = $('#marqueeTrack');
  const journey = $('#percorso'), warehouse = $('#magazzino'), nav = $('#nav');
  const lightSections = $$('.marquee, .services, .warehouse, .fleet, .jobs');

  const frame = now => {
    const vh = window.innerHeight;

    // HERO
    const hr = hero.getBoundingClientRect();
    if (hr.bottom > 0) {
      const p = progressOf(hero);
      drawMap(now, p);
      heroContent.style.opacity = 1 - clamp(p / 0.22);
      heroContent.style.transform = `translateY(${-p * 160}px)`;
      hint.style.opacity = 1 - clamp(p / 0.1);
      // la foto si apre come un cerchio che parte dal puntino di Cortenuova
      const ph = ease(clamp((p - 0.5) / 0.32));
      heroPhoto.style.opacity = ph > 0 ? 1 : 0;
      heroPhoto.style.clipPath = `circle(${ph * 75}% at 50% 50%)`;
      heroPhoto.firstElementChild.style.transform = `scale(${1.25 - ph * 0.25})`;
      const zl = clamp((p - 0.75) / 0.12);
      zoomLabel.style.opacity = zl;
      zoomLabel.style.transform = `translateY(${(1 - zl) * 24}px)`;
    }

    // MANIFESTO
    const mp = progressOf(manifesto);
    const lit = Math.floor(clamp((mp - 0.08) / 0.8) * mWords.length);
    mWords.forEach((w, i) => w.classList.toggle('lit', i < lit));

    // MARQUEE orizzontale
    const mr = marquee.getBoundingClientRect();
    if (mr.top < vh && mr.bottom > 0) {
      const k = clamp((vh - mr.top) / (vh + mr.height));
      track.style.transform = `translateX(${-k * (track.scrollWidth - window.innerWidth)}px)`;
    }

    // STRADA
    const jp = progressOf(journey);
    const len = L * clamp(jp / 0.95);
    roadPath.style.strokeDashoffset = L - len;
    const a = roadPath.getPointAtLength(Math.max(len, 1));
    const b = roadPath.getPointAtLength(Math.max(len - 2, 0));
    const ang = Math.atan2(a.y - b.y, a.x - b.x) * 180 / Math.PI;
    roadTruck.setAttribute('transform', `translate(${a.x} ${a.y}) rotate(${ang})`);
    stops.forEach(s => s.classList.toggle('on', jp >= +s.dataset.at - 0.06));

    // MAGAZZINO
    const wp = progressOf(warehouse);
    setPallets(Math.round(clamp((wp - 0.05) / 0.8) * pallets.length));

    // NAV chiara/scura
    const onLight = lightSections.some(s => { const r = s.getBoundingClientRect(); return r.top <= 40 && r.bottom >= 40; });
    nav.classList.toggle('on-light', onLight);

    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);

  /* ---------- Reveal ---------- */
  const revIO = new IntersectionObserver(entries => entries.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('in'); revIO.unobserve(e.target); }
  }), { threshold: 0.2 });
  $$('.reveal').forEach(r => revIO.observe(r));

  /* =========================================================
     9. PREVENTIVO: rimorchio che si riempie + email
     ========================================================= */
  const trailer = $('#trailer'), info = $('#trailerInfo'), input = $('#palletInput');
  const MAX = 33;
  // 33 posti = 11 colonne × 3 file (vista dall'alto)
  for (let i = 0; i < MAX; i++) trailer.insertAdjacentHTML('beforeend', '<span class="slot"></span>');
  const slots = $$('.slot', trailer);
  const fill = () => {
    const n = Math.max(0, parseInt(input.value, 10) || 0);
    const shown = Math.min(n, MAX);
    // riempimento colonna per colonna, dalla cabina verso il fondo
    const order = [];
    for (let c = 10; c >= 0; c--) for (let r = 0; r < 3; r++) order.push(r * 11 + c);
    slots.forEach(s => s.classList.remove('full'));
    order.slice(0, shown).forEach((idx, i) => setTimeout(() => slots[idx].classList.add('full'), i * 25));
    if (n > MAX) {
      const trips = Math.ceil(n / MAX);
      info.textContent = `${n} bancali → circa ${trips} bilici completi`;
      info.classList.add('over');
    } else {
      info.textContent = `${shown} / ${MAX} bancali EUR` + (shown ? ` · ${Math.round(shown / MAX * 100)}% del rimorchio` : '');
      info.classList.remove('over');
    }
  };
  input.addEventListener('input', fill);

  $('#quoteForm').addEventListener('submit', e => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    const subject = `Richiesta preventivo – ${f.azienda || ''}`.trim();
    const body = [
      'Buongiorno,', '', 'vorremmo ricevere un preventivo per:', '',
      `Partenza: ${f.partenza}`,
      `Destinazione: ${f.destinazione}`,
      `N° bancali: ${f.bancali}`,
      `Tipo di merce: ${f.merce || '-'}`,
      `Data indicativa: ${f.data || '-'}`,
      `Servizio: ${f.servizio}`,
      `Note: ${f.note || '-'}`, '',
      `Azienda: ${f.azienda}`,
      `Telefono: ${f.telefono || '-'}`, '', 'Grazie, cordiali saluti.'
    ].join('\n');
    window.location.href = `mailto:traffico@sopranitrasporti.it?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  });

  /* ---------- Menu mobile ---------- */
  $('#burger').addEventListener('click', () => nav.classList.toggle('open'));
  $$('#navLinks a').forEach(a => a.addEventListener('click', () => nav.classList.remove('open')));
})();
