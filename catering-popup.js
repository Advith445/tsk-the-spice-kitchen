/* Catering pop-up. Phone visitors see it every time they open the site, DELAY_S seconds after the page starts
   loading, and it takes them to the catering section (#catering). If the visitor's finger is on the screen or they
   are typing at that moment, or the order, a dish or the menu sheet is open, it waits until they are done.
   It is skipped for visitors who arrive on #catering or are already looking at the catering section.
   Preview it any time by adding ?popup to the address, e.g. tskthespicekitchenkokapet.in/?popup
   To take it down: delete the <dialog id="catering-popup"> in index.html, the catering-popup.css link in its <head>
   and the catering-popup.js script tag. It stores nothing on the visitor's phone. */
(() => {
  'use strict';
  const SHOW_ON = 'phones';   // 'phones' = the site's phone layout (screens up to 860px wide); 'everyone' = computers too
  const DELAY_S = 3;          // seconds after the page starts loading before it appears (every visit)

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

  // An earlier version remembered when it was shown; clear that note from phones that still have it.
  try { localStorage.removeItem('tsk.cateringPopupSeen'); } catch (e) { /* storage unavailable */ }

  if (!forced && location.hash === '#catering') return;

  // Already looking at the catering section: no need to show it this visit.
  let reached = false;
  if (!forced && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { reached = true; io.disconnect(); } }, { threshold: 0.2 });
    io.observe(target);
  }

  // Never pop up under a finger mid-swipe (a stray tap would land on it): wait until the finger lifts.
  let touching = 0, lastMove = 0;
  addEventListener('touchstart', e => { touching = e.touches.length; }, { passive: true, capture: true });
  addEventListener('touchend', e => { touching = e.touches.length; lastMove = performance.now(); }, { passive: true, capture: true });
  addEventListener('touchcancel', () => { touching = 0; }, { passive: true, capture: true });

  function busy() {
    if (document.visibilityState !== 'visible') return true;
    if (!root.classList.contains('loaded')) return true; // opening logo still up
    if (document.querySelector('dialog[open]:not(#catering-popup), #drawer.is-open, #modal.is-open, #sheetnav.is-open')) return true;
    const a = document.activeElement;
    if (a && a.matches && a.matches('input, textarea, select, [contenteditable="true"]')) return true;
    const css = document.getElementById('tskc-css');
    if (css && !css.sheet) return true; // styles not in yet
    return touching > 0 || performance.now() - lastMove < 300;
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

  // performance.now() counts from the moment the visitor opened the page, so the delay includes loading time.
  const wait = DELAY_S * 1000;
  let shown = false, opening = false;
  const timer = setInterval(() => {
    if (shown || opening) return;
    const now = performance.now();
    if (now > wait + 180000) { clearInterval(timer); return; } // still busy three minutes later: leave them be
    if (!forced && reached) { clearInterval(timer); return; }
    if (now < wait - 1500) return;
    if (!allowed()) return;
    loadPhoto();
    if (now < wait || busy()) return;
    opening = true;
    photo.then(() => {
      opening = false;
      if (shown || busy() || !allowed()) return; // something changed while the photo loaded; try again next tick
      clearInterval(timer);
      open();
    });
  }, 100);

  function open() {
    shown = true;
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
