/* Catering pop-up. Phone visitors see it once, a few seconds after the page opens, and it takes them to the
   catering section (#catering). After someone has seen it, it stays away for HIDE_DAYS on that phone.
   It waits while the visitor is scrolling, typing or has the order, a dish or the menu sheet open, and it is skipped
   when they arrive on #catering or reach the catering section on their own.
   Preview it any time by adding ?popup to the address, e.g. tskthespicekitchenkokapet.in/?popup
   To take it down: delete the <dialog id="catering-popup"> in index.html, the catering-popup.css link in its <head>
   and the catering-popup.js script tag. Only remembers the time it was shown (localStorage), nothing else. */
(() => {
  'use strict';
  const SHOW_ON = 'phones';   // 'phones' = the site's phone layout (screens up to 860px wide); 'everyone' = computers too
  const DELAY_S = 7;          // seconds on the page before it appears
  const HIDE_DAYS = 3;        // days before the same phone sees it again
  const KEY = 'tsk.cateringPopupSeen';

  const box = document.getElementById('catering-popup');
  const target = document.getElementById('catering');
  if (!box || !target || typeof box.showModal !== 'function') return;
  const root = document.documentElement;
  const card = box.querySelector('.tskc__card');
  const body = box.querySelector('.tskc__body');
  const img = box.querySelector('.tskc__photo img');
  const cta = box.querySelector('.tskc__cta');

  const forced = /[?&]popup(=|&|$)/.test(location.search);
  const phone = matchMedia('(max-width: 860px)');
  const upright = matchMedia('(min-height: 480px)');   // skip phones held sideways
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');

  function seenRecently() {
    try { const t = Number(localStorage.getItem(KEY)); return t > 0 && Date.now() - t < HIDE_DAYS * 864e5; } catch (e) { return false; }
  }
  function markSeen() { try { localStorage.setItem(KEY, String(Date.now())); } catch (e) { /* storage unavailable */ } }

  if (!forced && (seenRecently() || location.hash === '#catering')) return;

  // Reached the catering section on their own: no need to show it this visit.
  let reached = false;
  if (!forced && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { reached = true; io.disconnect(); } }, { threshold: 0.2 });
    io.observe(target);
  }

  // Never pop up mid-swipe: wait until the page has been still for a moment.
  let lastMove = 0;
  const moved = () => { lastMove = performance.now(); };
  addEventListener('scroll', moved, { passive: true });
  addEventListener('touchmove', moved, { passive: true });

  function busy() {
    if (document.visibilityState !== 'visible') return true;
    if (!root.classList.contains('loaded')) return true; // opening logo still up
    if (document.querySelector('dialog[open]:not(#catering-popup), #drawer.is-open, #modal.is-open, #sheetnav.is-open')) return true;
    const a = document.activeElement;
    if (a && a.matches && a.matches('input, textarea, select, [contenteditable="true"]')) return true;
    const css = document.getElementById('tskc-css');
    if (css && !css.sheet) return true; // styles not in yet
    return performance.now() - lastMove < 1200;
  }
  function allowed() {
    if (forced) return true;
    if (reached) return false;
    if (SHOW_ON === 'phones' && !phone.matches) return false;
    return phone.matches ? upright.matches : true;
  }

  // Load the photo only when the pop-up is about to open (it is the hero photo, so usually already cached).
  let photo = null;
  function loadPhoto() {
    if (photo) return photo;
    if (img.dataset.srcset) img.srcset = img.dataset.srcset;
    img.src = img.dataset.src;
    const loaded = img.decode ? img.decode() : new Promise((ok, no) => { img.onload = ok; img.onerror = no; });
    photo = Promise.race([loaded, new Promise(ok => setTimeout(ok, 2500))]).catch(() => card.classList.add('no-photo'));
    return photo;
  }

  const started = performance.now();
  const wait = forced ? 1000 : DELAY_S * 1000;
  let shown = false, opening = false;
  const timer = setInterval(() => {
    if (shown || opening) return;
    if (performance.now() - started > 180000) { clearInterval(timer); return; } // three minutes in: leave them be
    if (!forced && reached) { clearInterval(timer); return; }
    if (performance.now() - started < wait - 1500) return;
    if (!allowed()) return;
    loadPhoto();
    if (performance.now() - started < wait || busy()) return;
    opening = true;
    photo.then(() => {
      opening = false;
      if (shown || busy() || !allowed()) return; // something changed while the photo loaded; try again next tick
      clearInterval(timer);
      open();
    });
  }, 500);

  function open() {
    shown = true;
    markSeen();
    box.showModal();
    root.classList.add('tskc-lock');
    card.focus({ preventScroll: true });
    requestAnimationFrame(() => requestAnimationFrame(() => box.classList.add('is-in')));
  }
  let closing = 0;
  function close(instant) {
    if (!box.open) return;
    root.classList.remove('tskc-lock');
    box.classList.remove('is-in');
    card.style.transition = '';
    card.style.transform = '';
    clearTimeout(closing);
    if (instant || reduce.matches) box.close();
    else closing = setTimeout(() => { if (box.open) box.close(); }, 420);
  }
  // Esc, and the Android back button where the browser supports it
  box.addEventListener('cancel', e => { e.preventDefault(); close(); });
  box.addEventListener('close', () => { root.classList.remove('tskc-lock'); box.classList.remove('is-in'); });
  box.addEventListener('click', e => {
    if (e.target.closest('[data-tskc-close]')) { close(); return; }
    if (e.target.closest('.tskc__photo')) { cta.click(); }
  });
  // "See catering options": close at once; the page's own link handling then scrolls to #catering
  // (if the page script isn't running, the plain #catering link still works).
  cta.addEventListener('click', () => {
    close(true);
    const h = target.querySelector('h3');
    if (h) {
      h.setAttribute('tabindex', '-1');
      setTimeout(() => h.focus({ preventScroll: true }), 500);
    }
  });

  // Swipe the sheet down to close it (phone layout only).
  let y0 = null, dy = 0, t0 = 0;
  card.addEventListener('touchstart', e => {
    if (!phone.matches || e.touches.length !== 1 || !box.classList.contains('is-in')) return;
    if (body.scrollTop > 0 && body.contains(e.target)) return; // let the text scroll first
    y0 = e.touches[0].clientY; dy = 0; t0 = performance.now();
  }, { passive: true });
  card.addEventListener('touchmove', e => {
    if (y0 === null) return;
    dy = Math.max(0, e.touches[0].clientY - y0);
    if (dy > 6) { card.style.transition = 'none'; card.style.transform = 'translateY(' + dy + 'px)'; }
  }, { passive: true });
  const release = cancelled => {
    if (y0 === null) return;
    const fast = dy > 40 && dy / Math.max(1, performance.now() - t0) > 0.6;
    y0 = null;
    if (!cancelled && (dy > 90 || fast)) close();
    else { card.style.transition = ''; card.style.transform = ''; }
  };
  card.addEventListener('touchend', () => release(false));
  card.addEventListener('touchcancel', () => release(true));
})();
