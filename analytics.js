/* Optional TSK website measurement. No form values or raw destination URLs. */
(() => {
  'use strict';
  if (document.getElementById('tsk-cookie-notice')) return;
  const ID = 'G-HLX4G8BV7E';
  const CHOICE = 'tsk_cookie_choice_v1';
  const DISMISSED = 'tsk_cookie_dismissed_v1';
  const production = location.hostname === 'tskthespicekitchenkokapet.in';
  let enabled = false;
  let loaded = false;
  const read = (store, key) => { try { return store.getItem(key); } catch (_) { return null; } };
  const save = (store, key, value) => { try { store.setItem(key, value); } catch (_) { /* Optional storage unavailable. */ } };
  function cleanLocation() {
    const url = new URL(location.origin + location.pathname);
    for (const key of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term']) {
      const value = new URLSearchParams(location.search).get(key);
      if (value && /^[a-z0-9_-]{1,80}$/i.test(value)) url.searchParams.set(key, value);
    }
    return url.href;
  }
  function cleanReferrer() {
    try {
      const url = new URL(document.referrer);
      return /^https?:$/.test(url.protocol) && url.origin !== location.origin ? url.origin + '/' : '';
    } catch (_) { return ''; }
  }
  function activate() {
    enabled = true;
    if (!production || loaded) return;
    loaded = true;
    window['ga-disable-' + ID] = false;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('consent', 'default', {
      analytics_storage: 'denied', ad_storage: 'denied',
      ad_user_data: 'denied', ad_personalization: 'denied'
    });
    window.gtag('consent', 'update', { analytics_storage: 'granted' });
    window.gtag('js', new Date());
    window.gtag('config', ID, {
      send_page_view: false, allow_google_signals: false,
      allow_ad_personalization_signals: false,
      page_location: cleanLocation(), page_referrer: cleanReferrer()
    });
    window.gtag('event', 'page_view', {
      page_location: cleanLocation(), page_referrer: cleanReferrer(), page_title: document.title
    });
    const tag = document.createElement('script');
    tag.async = true;
    tag.src = 'https://www.googletagmanager.com/gtag/js?id=' + ID;
    document.head.appendChild(tag);
  }
  function measure(name, placement, platform) {
    if (!enabled || !production || typeof window.gtag !== 'function') return;
    const params = {
      placement, page_location: cleanLocation(), page_referrer: cleanReferrer(), transport_type: 'beacon'
    };
    if (platform) params.platform = platform;
    window.gtag('event', name, params);
  }
  const notice = document.createElement('aside');
  notice.id = 'tsk-cookie-notice';
  notice.setAttribute('aria-label', 'Optional cookies');
  notice.innerHTML = '<button class="tsk-cookie-close" type="button" aria-label="Dismiss cookie notice">×</button><p>We use optional cookies to understand visits and improve our website. <a href="/privacy.html">Privacy details</a></p><button class="tsk-cookie-choice" type="button" data-cookie-choice="granted">Allow cookies</button><button class="tsk-cookie-choice tsk-cookie-decline" type="button" data-cookie-choice="denied">No thanks</button>';
  const style = document.createElement('style');
  style.textContent = '#tsk-cookie-notice{position:fixed;z-index:9999;bottom:80px;left:12px;right:12px;box-sizing:content-box;max-width:330px;background:#fffaf2;color:#2a1512;border:1px solid #dfd3c1;border-radius:10px;padding:12px 14px;font:13px/1.45 system-ui;box-shadow:0 3px 14px #0001;text-align:left}#tsk-cookie-notice[hidden]{display:none!important}#tsk-cookie-notice p{margin:0 20px 9px 0;font:inherit;color:inherit}#tsk-cookie-notice a{color:#5d1607;text-decoration:underline}#tsk-cookie-notice button{font:inherit;cursor:pointer;letter-spacing:normal;text-transform:none}#tsk-cookie-notice .tsk-cookie-choice{display:inline-block;min-height:38px;padding:7px 11px;border:1px solid #5d1607;border-radius:6px;background:#5d1607;color:#fff}#tsk-cookie-notice .tsk-cookie-decline{background:transparent;color:#5d1607;margin-left:6px}#tsk-cookie-notice .tsk-cookie-close{position:absolute;right:4px;top:2px;width:30px;height:30px;padding:0;border:0;background:none;color:#6c5b50;font-size:19px}#tsk-cookie-settings{font:inherit;font-size:13px;cursor:pointer;border:0;background:none;color:inherit;text-decoration:underline;padding:8px;letter-spacing:normal;text-transform:none}';
  document.head.appendChild(style);
  document.body.appendChild(notice);
  const settings = document.createElement('button');
  settings.type = 'button';
  settings.id = 'tsk-cookie-settings';
  settings.textContent = 'Cookie choices';
  settings.addEventListener('click', () => {
    notice.hidden = false;
    notice.querySelector('[data-cookie-choice]').focus();
  });
  (document.querySelector('footer') || document.querySelector('[role="contentinfo"]') || document.body).appendChild(settings);
  function forgetCookies() {
    // Remove only this stream's optional measurement cookies on this site.
    for (const name of ['_ga', '_ga_HLX4G8BV7E']) {
      for (const domain of ['', ';domain=' + location.hostname, ';domain=.' + location.hostname]) {
        document.cookie = name + '=;max-age=0;path=/' + domain + ';SameSite=Lax';
      }
    }
  }
  notice.addEventListener('click', e => {
    const close = e.target.closest('.tsk-cookie-close');
    const button = e.target.closest('[data-cookie-choice]');
    if (!close && !button) return;
    if (close) {
      save(sessionStorage, DISMISSED, 'yes');
    } else {
      const choice = button.dataset.cookieChoice;
      save(localStorage, CHOICE, choice);
      if (choice === 'granted') activate();
      else {
        enabled = false;
        window['ga-disable-' + ID] = true;
        forgetCookies();
        if (loaded) { location.reload(); return; }
      }
    }
    notice.hidden = true;
    settings.focus();
  });
  const choice = read(localStorage, CHOICE);
  notice.hidden = choice === 'granted' || choice === 'denied' || read(sessionStorage, DISMISSED) === 'yes';
  if (choice === 'granted') activate();
  document.addEventListener('click', e => {
    const link = e.target.closest('a[href]');
    if (!link || link.closest('#tsk-cookie-notice')) return;
    let url;
    try { url = new URL(link.href, location.href); } catch (_) { return; }
    const area = link.closest('section,nav,footer,[id="catering"],[id="catering-popup"]');
    const placement = area && ['top', 'menu', 'reserve', 'inside', 'visit', 'catering', 'catering-popup'].includes(area.id)
      ? area.id : area && ['NAV', 'FOOTER'].includes(area.tagName) ? area.tagName.toLowerCase() : 'page';
    // The site's smooth-scroll handler prevents the default for working menu anchors.
    if (url.origin === location.origin && (url.pathname.replace(/\/$/, '') === '/menu' || url.hash === '#menu')) {
      measure('menu_clicked', placement);
      return;
    }
    // In particular, do not count a reservation request rejected by form validation.
    if (e.defaultPrevented) return;
    if (url.protocol === 'tel:') measure('call_clicked', placement);
    else if (url.hostname === 'wa.me' || url.hostname === 'api.whatsapp.com') {
      const cateringPage = location.pathname === '/blog/catering-in-kokapet/';
      const catering = link.closest('#catering,.catering,#catering-popup') || cateringPage;
      measure(link.id === 'bookSend' ? 'reservation_request_clicked' : catering ? 'catering_enquiry_clicked' : 'whatsapp_clicked', placement);
    } else if (['google.com', 'www.google.com', 'maps.google.com'].includes(url.hostname) && url.pathname.startsWith('/maps/dir')) {
      measure('directions_clicked', placement);
    } else {
      const platform = url.hostname === 'ownly.food' ? 'ownly'
        : /(^|\.)swiggy\.com$/.test(url.hostname) ? 'swiggy'
        : /(^|\.)zomato\.com$/.test(url.hostname) ? 'zomato' : '';
      if (platform) measure('order_platform_clicked', placement, platform);
    }
  });
})();
