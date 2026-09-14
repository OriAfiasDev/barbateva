/* ברבא טבע – main.js
   Scroll-scrubbed hero: the camera is static, the motion is six hands setting
   six desserts on the board. Six words enter from the same side as each hand
   and settle above "their" dessert. Then: word-by-word reveal, pinned stream
   steps, nav state. No libraries. */
(() => {
  'use strict';

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  // smoothstep between two points of progress
  const win = (p, a, b) => { const t = clamp((p - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  /* ------------------------------------------------------------
     Scroll state – one passive listener, one rAF loop
     ------------------------------------------------------------ */
  let scrollY = window.scrollY, vh = innerHeight, vw = innerWidth, dirty = true;
  const phone = () => vw < 760;
  addEventListener('scroll', () => { scrollY = window.scrollY; dirty = true; }, { passive: true });
  addEventListener('resize', () => { vh = innerHeight; vw = innerWidth; layout(); dirty = true; }, { passive: true });
  // layout settles late (fonts, lazy images): re-measure instead of trusting the first frame
  addEventListener('load', () => { layout(); dirty = true; });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { layout(); dirty = true; });
  if ('ResizeObserver' in window) new ResizeObserver(() => { layout(); dirty = true; }).observe(document.body);

  const progress = $('.progress span');
  const nav = $('#nav');

  /* ------------------------------------------------------------
     HERO
     ------------------------------------------------------------ */
  const hero = $('#hero');
  const pin = $('.hero__pin');
  const frame = $('#heroFrame');
  const typeLayer = $('.hero__type');
  const video = $('#heroVideo');
  const cue = $('#heroCue');
  const name = $('[data-l="name"]');
  const tag = $('[data-l="tag"]');
  const end = $('[data-l="end"]');
  const words = $$('.hero__word');

  /* Beats, as fractions of the 15 s clip: when a hand enters and when the
     dessert lands. Side is where the hand comes from. */
  const BEATS = [
    { enter: .10, land: .18, side: -1 }, // קפה – meringue cup, from the left
    { enter: .23, land: .31, side:  1 }, // קינוח – round cheesecake, from the right
    { enter: .36, land: .44, side: -1 }, // נחל – chocolate slice, from the left
    { enter: .54, land: .63, side:  1 }, // צל – cheesecake slice, from the right
    { enter: .66, land: .74, side: -1 }, // בטבע – brûlée, far left
    { enter: .82, land: .91, side:  1 }, // בר – chocolate square, far right
  ];

  /* The closing move: the four nouns leave, "בר" and "בטבע" slide to the centre
     line and touch, then ב and טבע part to let "א " in — "ברבא טבע". Everything
     is measured from the real glyphs so the join is exact. */
  const bar = words[5], bet = words[4];
  const jBet = bet.querySelector('.hero__j'), jTeva = bet.querySelectorAll('.hero__j')[1], alef = bet.querySelector('.hero__alef');
  const M = { w1: 0, w2: 0, wa: 0, kern: 0, cx: 0, ty: 0, base: [{ x: 0, y: 0 }, { x: 0, y: 0 }] };
  function measureJoin() {
    const isPhone = phone();
    const centre = el => isPhone
      ? { x: el.offsetLeft + el.offsetWidth / 2, y: el.offsetTop + el.offsetHeight / 2 }
      : { x: el.offsetLeft, y: el.offsetTop };            // desktop words are centred on `left/top`
    M.w1 = bar.offsetWidth; M.w2 = bet.offsetWidth; M.wa = alef.offsetWidth;
    M.kern = parseFloat(getComputedStyle(bar).fontSize) * .02;
    M.cx = (bar.offsetParent || typeLayer).clientWidth / 2;
    M.base = [centre(bar), centre(bet)];
    M.ty = (M.base[0].y + M.base[1].y) / 2;
    alef.style.left = (M.w2 - jBet.offsetWidth - M.wa / 2) + 'px';   // centred on the ב|טבע seam
  }

  /* ------------------------------------------------------------
     MENU – normal scroll carries the page to the section; JS then pins it
     and turns further scroll into a sideways pan of the strip (see
     .menu.is-pinned). Pinned only when the whole box fits the viewport
     height; short phones keep the plain horizontal strip.
     ------------------------------------------------------------ */
  const menuEl = $('#menu'), menuPin = $('#menuPin'), menuHead = $('#menuHead'), menuStrip = $('#menuStrip');
  let menuExtra = 0;
  function measureMenu() {
    if (!menuEl || reduce) return;
    // try the pinned layout, keep it only if the whole box fits the viewport
    menuEl.classList.add('is-pinned');
    const fits = menuPin.scrollHeight <= menuPin.clientHeight + 1;
    menuExtra = fits ? Math.max(0, menuStrip.scrollWidth - menuPin.clientWidth) : 0;
    menuEl.style.setProperty('--menu-extra', menuExtra + 'px');
    menuEl.classList.toggle('is-pinned', menuExtra > 0);
    if (!menuExtra) menuStrip.style.transform = '';
  }

  /* ------------------------------------------------------------
     Stream steps – the pinned photo follows the active step
     ------------------------------------------------------------ */
  const steps = $$('.step');
  const streamImgs = $$('.stream__img');
  const streamFrame = $('.stream__frame');
  // phones: each photo lives inside its step; desktop: all four stack in the pinned frame
  function mountStreamImages() {
    if (!streamFrame) return;
    streamImgs.forEach(im => {
      const home = phone() ? $(`.step[data-step="${im.dataset.step}"] .step__fig`) : streamFrame;
      if (home && im.parentNode !== home) home.appendChild(im);
    });
  }
  function activateStep(n) {
    steps.forEach(s => s.classList.toggle('is-on', +s.dataset.step === n));
    streamImgs.forEach(im => im.classList.toggle('is-on', +im.dataset.step === n));
  }
  if (steps.length && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver((es) => {
      es.forEach(e => { if (e.isIntersecting) activateStep(+e.target.dataset.step); });
    }, { rootMargin: '-45% 0px -45% 0px', threshold: 0 });
    steps.forEach(s => io.observe(s));
    activateStep(0);
  }

  let heroTrack = 1, frameW = vw;
  function layout() {
    heroTrack = Math.max(1, hero.offsetHeight - pin.offsetHeight);
    if (phone()) {
      // CSS places the 4:3 band at the bottom; the type layer covers the pin
      frame.style.cssText = '';
      typeLayer.style.cssText = '';
      frameW = vw;
    } else {
      // a 16:9 box that covers the viewport, so word positions match the video pixels
      const ph = pin.offsetHeight;
      const w = Math.max(vw, ph * 16 / 9), h = w * 9 / 16;
      const left = (vw - w) / 2, top = (ph - h) / 2;
      const rect = `left:${left}px;top:${top}px;width:${w}px;height:${h}px`;
      frame.style.cssText = rect;
      typeLayer.style.cssText = rect;
      frameW = w;
    }
    typeLayer.style.setProperty('--fw', frameW + 'px');
    measureJoin();
    measureMenu();
    mountStreamImages();
    if (reduce) choreograph(1);
  }
  layout();

  // smaller, 4:3-cropped file on phones
  if (phone()) {
    video.querySelector('source').src = 'assets/video/hero-sm.mp4';
    video.poster = 'assets/img/poster-sm.jpg';
    video.load();
  }

  let duration = video.duration || 15;
  video.addEventListener('loadedmetadata', () => { duration = video.duration || duration; dirty = true; });
  video.addEventListener('durationchange', () => { duration = video.duration || duration; dirty = true; });
  // iOS: a muted play()+pause() unlocks seeking on touch devices
  const unlock = () => { video.play().then(() => video.pause()).catch(() => {}); removeEventListener('touchstart', unlock); };
  addEventListener('touchstart', unlock, { passive: true });

  let vidTarget = 0, vidCur = 0, seekBusy = false, lastSet = -1;
  video.addEventListener('seeked', () => { seekBusy = false; });

  function set(el, o, t) { el.style.opacity = o.toFixed(3); el.style.transform = t; }

  function choreograph(p) {
    const fw = frameW;
    const isPhone = phone();

    // Name + tag hold the empty board, then lift away as the first hand comes in
    {
      const o = 1 - win(p, .05, .13);
      const y = -win(p, .05, .13) * (isPhone ? 6 : 9) * vh / 100;
      const s = 1 - .08 * win(p, .05, .13);
      set(name, o, `translate(-50%, -50%) translate3d(0, ${y}px, 0) scale(${s})`);
      set(tag, o, `translate(-50%, -50%) translate3d(0, ${y * .7}px, 0)`);
    }

    // Six words – each rides in with its hand and settles when the dessert lands
    const leave = win(p, .90, .95);          // the four nouns step out
    const tB = win(p, .92, .975);            // "בר" and "בטבע" slide together
    const tC = win(p, .975, 1);              // the seam opens for "א "
    const c2 = M.cx - M.w1 / 2;              // centre of "בטבע" once the pair is centred as a whole
    words.forEach((el, i) => {
      const b = BEATS[i];
      const local = win(p, b.enter, b.land);
      const drift = (1 - local) * b.side * (isPhone ? 32 : 22) * fw / 100;  // px from the hand's side
      const rise = (1 - local) * -3 * fw / 100;                              // hands come in slightly high
      const s = 1.28 - .28 * local;
      const base = isPhone ? '' : 'translate(-50%, -50%) ';
      if (i < 4) {
        set(el, local * (1 - leave), `${base}translate3d(${drift}px, ${rise - leave * 4 * fw / 100}px, 0) scale(${s})`);
        return;
      }
      const isBar = i === 5;
      const from = M.base[isBar ? 0 : 1];
      const grow = 1 + (isPhone ? .08 : .25) * tC;   // the finished name swells a little, around its own centre
      const tx0 = isBar ? c2 + M.w2 / 2 + M.w1 / 2 - M.kern + (M.wa / 2) * tC : c2;
      const tx = M.cx + (tx0 - M.cx) * grow;
      const dx = (tx - from.x) * tB, dy = (M.ty - from.y) * tB;
      set(el, local, `${base}translate3d(${drift + dx}px, ${rise + dy}px, 0) scale(${s * lerp(1, grow, tB)})`);
      el.classList.toggle('is-set', p > .92);
    });
    jBet.style.transform = `translateX(${(M.wa / 2) * tC}px)`;
    jTeva.style.transform = `translateX(${-(M.wa / 2) * tC}px)`;
    alef.style.opacity = tC.toFixed(3);

    // Closing line
    {
      const o = win(p, .96, 1);
      set(end, o, `translateX(-50%) translate3d(0, ${(1 - o) * 16}px, 0)`);
    }
    cue.classList.toggle('is-hidden', p > .04);
  }

  /* ------------------------------------------------------------
     Word-by-word reveal (once, on the sentence that matters)
     ------------------------------------------------------------ */
  const reveal = $('#revealText');
  let revealWords = [];
  if (reveal && !reduce) {
    reveal.innerHTML = reveal.textContent.trim().split(/\s+/).map(w => `<span class="w">${w}</span>`).join(' ');
    revealWords = $$('.w', reveal);
  }

  /* ------------------------------------------------------------
     Oval draws itself when the name is on screen
     ------------------------------------------------------------ */
  const oval = $('.name__oval');
  if (oval && 'IntersectionObserver' in window) {
    new IntersectionObserver((es) => {
      es.forEach(e => { if (e.isIntersecting) { oval.classList.add('is-drawn'); } });
    }, { threshold: .35 }).observe($('#nameTitle'));
  }

  /* ------------------------------------------------------------
     Reviews on phones – each quote steps in as it reaches the screen
     ------------------------------------------------------------ */
  const reviewsEl = $('#reviews');
  if (reviewsEl && phone() && !reduce && 'IntersectionObserver' in window) {
    reviewsEl.classList.add('is-staged');
    const io = new IntersectionObserver((es) => {
      let n = 0;
      es.forEach(e => {
        if (!e.isIntersecting) return;
        e.target.style.transitionDelay = (n++ * 90) + 'ms';
        e.target.classList.add('is-in');
        io.unobserve(e.target);
      });
    }, { threshold: .2, rootMargin: '0px 0px -6% 0px' });
    $$('.quote', reviewsEl).forEach(q => io.observe(q));
  }

  /* ------------------------------------------------------------
     Frame loop
     ------------------------------------------------------------ */
  function tick() {
    if (dirty) {
      dirty = false;
      const docH = document.documentElement.scrollHeight - vh;
      progress.style.transform = `scaleX(${clamp(scrollY / Math.max(1, docH), 0, 1)})`;

      // hero
      const p = clamp(scrollY / heroTrack, 0, 1);
      nav.classList.toggle('is-solid', scrollY > heroTrack + vh * .35);
      if (!reduce) {
        choreograph(p);
        vidTarget = p * duration;
      }

      // menu: the pinned section pans sideways as the page scrolls through it
      if (menuExtra > 0) {
        const mr = menuEl.getBoundingClientRect();
        const gp = clamp(-mr.top / menuExtra, 0, 1);
        menuStrip.style.transform = `translate3d(${(gp * menuExtra).toFixed(1)}px, 0, 0)`;
      }

      // reveal: as the paragraph travels from 85% to 35% of the viewport
      if (revealWords.length) {
        const r = reveal.getBoundingClientRect();
        const t = clamp((vh * .85 - r.top) / (vh * .5), 0, 1);
        const n = Math.round(t * revealWords.length);
        revealWords.forEach((w, i) => w.classList.toggle('is-on', i < n));
      }
    }

    // video seek runs every frame so scrubbing feels continuous
    if (!reduce) {
      vidCur = lerp(vidCur, vidTarget, .35);
      if (!seekBusy && Math.abs(vidCur - lastSet) > 1 / 60 && video.readyState >= 1) {
        seekBusy = true; lastSet = vidCur;
        try { video.currentTime = vidCur; } catch (_) { seekBusy = false; }
      }
    }
    requestAnimationFrame(tick);
  }

  if (reduce) {
    // show the finished board and the composed name, no motion
    const showEnd = () => { try { video.currentTime = Math.max(0, (video.duration || 15) - .05); } catch (_) {} };
    if (video.readyState >= 1) showEnd(); else video.addEventListener('loadedmetadata', showEnd, { once: true });
    choreograph(1);
  }

  requestAnimationFrame(tick);
})();
