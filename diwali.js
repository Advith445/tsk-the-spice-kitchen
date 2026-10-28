/* TSK Diwali 2026 preorder section (#diwali-preorders in index.html).
   Guests pick dishes and add a special request; "Enquire on WhatsApp" opens a
   prefilled message to +91 93986 93051. Nothing is stored or sent from the page.
   The section removes itself once the date in its data-ends attribute has passed. */
(() => {
  'use strict';
  const root = document.getElementById('diwali-preorders');
  if (!root) return;

  const ends = Date.parse(root.dataset.ends || '');
  if (ends && Date.now() >= ends) {
    root.remove();
    if (window.ScrollTrigger) window.ScrollTrigger.refresh();
    return;
  }

  const WHATSAPP = '919398693051';
  const $ = selector => root.querySelector(selector);
  const cards = Array.from(root.querySelectorAll('.dish-card'));
  const dishes = cards.map(card => ({ id: card.dataset.id, name: card.dataset.name }));
  const selected = new Set();
  const request = $('#tskd-request');
  const panel = $('#tskd-custom-panel');
  const openRequest = $('#tskd-custom-open');
  const bar = $('.selection-bar');
  const reviewOpen = $('#tskd-review-open');
  const selectAll = $('#tskd-select-all');
  const dialog = $('#tskd-review');
  let customOn = false;

  const custom = () => (customOn ? request.value.trim() : '');
  const chosen = () => dishes.filter(dish => selected.has(dish.id));
  const message = () => [
    'Hi TSK! I would like to enquire about your Diwali pre-orders.',
    ...(selected.size ? ['I am interested in:', ...chosen().map(dish => '- ' + dish.name)] : []),
    ...(custom() ? ['Other dish / special request: ' + custom()] : []),
    'Please confirm availability, prices, portions, and collection or delivery options.',
    'This is a preorder enquiry, not a confirmed booking.'
  ].join('\n');

  function bump() {
    const icon = $('.tray-icon');
    icon.classList.remove('is-bump');
    void icon.offsetWidth;
    icon.classList.add('is-bump');
  }

  function setRequestButton() {
    openRequest.innerHTML = customOn ? 'Edit special request <span aria-hidden="true">↘</span>' : 'Add a special request <span aria-hidden="true">+</span>';
    openRequest.setAttribute('aria-expanded', String(customOn));
  }

  function sync() {
    for (const card of cards) {
      const on = selected.has(card.dataset.id);
      card.classList.toggle('active', on);
      card.setAttribute('aria-pressed', String(on));
      card.querySelector('.dish-action span').textContent = on ? 'Added to my feast' : 'Add to my feast';
      card.querySelector('.dish-action b').textContent = on ? '✓' : '+';
    }
    const n = selected.size;
    const hasRequest = !!custom();
    const any = n > 0 || hasRequest;
    bar.hidden = !any;
    $('#tskd-tray-count').textContent = n;
    $('#tskd-tray-title').textContent = n
      ? n + (n === 1 ? ' favourite' : ' favourites') + ' on your festive table'
      : hasRequest ? 'A special request for our kitchen' : 'Your festive table';
    $('#tskd-tray-subtitle').textContent = chosen().map(dish => dish.name).concat(hasRequest ? ['Special request'] : []).join(' · ') || 'Choose a dish from the collection.';
    reviewOpen.disabled = !any;
    $('#tskd-clear').hidden = !(any || customOn);
    const all = n === dishes.length;
    selectAll.firstChild.textContent = (all ? 'Remove all five' : 'Choose all five') + ' ';
    selectAll.querySelector('span').textContent = all ? '−' : '+';
    selectAll.setAttribute('aria-pressed', String(all));
    $('#tskd-status').textContent = n + (n === 1 ? ' dish' : ' dishes') + ' selected' + (hasRequest ? ', with a special request.' : '.');
    $('#tskd-count').textContent = request.value.length + ' / 300';
    if (dialog.open) renderReview();
  }

  function toggle(id) {
    if (selected.has(id)) selected.delete(id); else selected.add(id);
    sync();
    bump();
  }

  function renderReview() {
    const list = $('#tskd-review-items');
    list.replaceChildren();
    for (const dish of chosen()) {
      const item = document.createElement('li');
      const mark = document.createElement('span');
      const name = document.createElement('span');
      const remove = document.createElement('button');
      mark.textContent = '✦';
      mark.setAttribute('aria-hidden', 'true');
      name.textContent = dish.name;
      remove.type = 'button';
      remove.textContent = '×';
      remove.setAttribute('aria-label', 'Remove ' + dish.name + ' from enquiry');
      remove.addEventListener('click', () => {
        selected.delete(dish.id);
        sync();
        if (!selected.size && !custom()) { dialog.close(); return; }
        const next = list.querySelector('button') || $('#tskd-whatsapp');
        next.focus();
      });
      item.append(mark, name, remove);
      list.append(item);
    }
    const requestBox = $('#tskd-review-request');
    requestBox.hidden = !custom();
    requestBox.textContent = custom() ? 'YOUR SPECIAL REQUEST\n' + custom() : '';
    $('#tskd-message').textContent = message();
    $('#tskd-whatsapp').href = 'https://wa.me/' + WHATSAPP + '?text=' + encodeURIComponent(message());
  }

  function closeRequest(focusButton) {
    customOn = false;
    request.value = '';
    panel.hidden = true;
    setRequestButton();
    if (focusButton) openRequest.focus();
  }

  cards.forEach(card => card.addEventListener('click', () => toggle(card.dataset.id)));

  selectAll.addEventListener('click', () => {
    const all = selected.size === dishes.length;
    selected.clear();
    if (!all) dishes.forEach(dish => selected.add(dish.id));
    sync();
    bump();
  });

  openRequest.addEventListener('click', () => {
    customOn = true;
    panel.hidden = false;
    setRequestButton();
    request.focus();
    sync();
  });
  $('#tskd-custom-close').addEventListener('click', () => { closeRequest(true); sync(); });
  request.addEventListener('input', sync);

  $('#tskd-clear').addEventListener('click', () => {
    selected.clear();
    closeRequest(false);
    sync();
    selectAll.focus();
  });

  reviewOpen.addEventListener('click', () => {
    if (!selected.size && !custom()) return;
    renderReview();
    if (typeof dialog.showModal === 'function') dialog.showModal(); else dialog.setAttribute('open', '');
    document.documentElement.classList.add('tskd-lock');
  });
  root.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => dialog.close()));
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const box = dialog.getBoundingClientRect();
    if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close();
  });
  dialog.addEventListener('close', () => {
    document.documentElement.classList.remove('tskd-lock');
    (bar.hidden ? selectAll : reviewOpen).focus();
  });

  // Light the five lamps one by one when the artwork scrolls into view; pause the flicker when it is off screen.
  const art = $('.tskd-art');
  if (art && 'IntersectionObserver' in window) {
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) art.classList.add('is-waiting');
    new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (entry.isIntersecting) art.classList.remove('is-waiting');
        art.classList.toggle('is-paused', !entry.isIntersecting);
      }
    }, { threshold: 0.25 }).observe(art);
  }

  window.addEventListener('pageshow', sync);
  sync();
})();
