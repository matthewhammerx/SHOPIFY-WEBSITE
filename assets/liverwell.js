/* LiverWell custom sections – vanilla JS, no dependencies. */
(function () {
  'use strict';

  const moneyFormat = (window.LW && window.LW.moneyFormat) || '${{amount}}';

  function formatMoney(cents) {
    if (typeof cents === 'string') cents = cents.replace('.', '');
    const value = (Number(cents) || 0) / 100;
    const withDelims = (n, dec, thou, sep) => {
      const parts = n.toFixed(dec).split('.');
      parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, thou);
      return parts.join(sep);
    };
    return moneyFormat.replace(/\{\{\s*(\w+)\s*\}\}/, (_, key) => {
      switch (key) {
        case 'amount_no_decimals': return withDelims(value, 0, ',', '.');
        case 'amount_with_comma_separator': return withDelims(value, 2, '.', ',');
        case 'amount_no_decimals_with_comma_separator': return withDelims(value, 0, '.', ',');
        case 'amount_with_apostrophe_separator': return withDelims(value, 2, "'", '.');
        default: return withDelims(value, 2, ',', '.');
      }
    });
  }

  /* ------------------------------------------------------------------ */
  /* Buy box                                                             */
  /* ------------------------------------------------------------------ */
  class LwBuyBox extends HTMLElement {
    connectedCallback() {
      if (this._init) return;
      this._init = true;
      this.offers = Array.from(this.querySelectorAll('[data-lw-offer]'));
      this.gifts = Array.from(this.querySelectorAll('[data-lw-gift]'));
      this.subInput = this.querySelector('[data-lw-subscribe]');
      this.atc = this.querySelector('[data-lw-atc]');
      this.errorEl = this.querySelector('[data-lw-error]');
      this.offers.forEach((el) => {
        el.querySelector('input').addEventListener('change', () => this.update());
      });
      if (this.subInput) this.subInput.addEventListener('change', () => this.update());
      this.form = this.querySelector('form[action*="/cart/add"]');
      if (this.form) {
        // Bundle-app mode (Kaching etc.): the app writes variant/quantity/properties into this form.
        this.form.addEventListener('submit', (e) => { e.preventDefault(); this.submitForm(); });
      } else if (this.atc) {
        this.atc.addEventListener('click', (e) => { e.preventDefault(); this.addToCart(); });
      }
      this.update();
    }

    get selected() {
      return this.offers.find((el) => el.querySelector('input').checked) || this.offers[0];
    }

    get subscribing() {
      return !!(this.subInput && this.subInput.checked);
    }

    update() {
      const sel = this.selected;
      if (!sel) return;
      this.offers.forEach((el) => el.classList.toggle('is-selected', el === sel));
      const d = sel.dataset;
      const price = this.subscribing && d.subPrice ? d.subPrice : d.price;
      const compare = Number(d.compare) > Number(price) ? d.compare : '';
      this.querySelectorAll('[data-lw-price]').forEach((n) => (n.textContent = formatMoney(price)));
      this.querySelectorAll('[data-lw-compare]').forEach((n) => {
        n.textContent = compare ? formatMoney(compare) : '';
        n.hidden = !compare;
      });
      this.querySelectorAll('[data-lw-save]').forEach((n) => {
        const save = compare ? Number(compare) - Number(price) : 0;
        n.hidden = save <= 0;
        const lbl = n.dataset.template || 'Save [amount]';
        n.textContent = lbl.replace('[amount]', formatMoney(save).replace(/[.,]00(?=\D*$)/, ''));
      });
      // offer card prices when subscribing
      this.offers.forEach((el) => {
        const now = el.querySelector('[data-lw-offer-now]');
        if (now) now.textContent = formatMoney(this.subscribing && el.dataset.subPrice ? el.dataset.subPrice : el.dataset.price);
      });
      this.querySelectorAll('[data-lw-sub-note]').forEach((n) => (n.hidden = !this.subscribing));
      const unlocked = Number(d.gifts || 0);
      this.gifts.forEach((g, i) => g.classList.toggle('is-locked', i >= unlocked));
      if (this.atc) this.atc.disabled = d.available === 'false';
      document.dispatchEvent(new CustomEvent('lw:offer-change', { detail: { price, compare, box: this } }));
    }

    async addToCart() {
      const sel = this.selected;
      if (!sel || !this.atc) return;
      const d = sel.dataset;
      const item = { id: Number(d.variant), quantity: Number(d.qty || 1) };
      if (this.subscribing && d.sellingPlan) item.selling_plan = Number(d.sellingPlan);
      const items = [item];
      const unlocked = Number(d.gifts || 0);
      this.gifts.forEach((g, i) => {
        if (g.dataset.giftVariant && i < unlocked) {
          items.push({ id: Number(g.dataset.giftVariant), quantity: 1, properties: { _lw_gift: 'true' } });
        }
      });

      await this.post(JSON.stringify({ items }), 'application/json', d.discount, item.id);
    }

    async submitForm() {
      const fd = new FormData(this.form);
      await this.post(fd, null, null, Number(fd.get('id')));
    }

    async post(body, contentType, discount, variantId) {
      if (!this.atc) return;
      this.atc.classList.add('is-loading');
      this.atc.disabled = true;
      if (this.errorEl) this.errorEl.classList.remove('is-visible');

      const drawer = document.querySelector('cart-drawer');
      const sections = drawer ? ['cart-drawer', 'cart-icon-bubble'] : ['cart-icon-bubble'];
      if (body instanceof FormData) {
        body.append('sections', sections.join(','));
        body.append('sections_url', window.location.pathname);
      } else {
        const obj = JSON.parse(body);
        obj.sections = sections;
        obj.sections_url = window.location.pathname;
        body = JSON.stringify(obj);
      }
      const headers = { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' };
      if (contentType) headers['Content-Type'] = contentType;
      const cartUrl = (window.routes && window.routes.cart_url) || '/cart';
      try {
        if (discount) {
          await fetch('/discount/' + encodeURIComponent(discount), { credentials: 'same-origin' }).catch(() => {});
        }
        const res = await fetch((window.routes && window.routes.cart_add_url ? window.routes.cart_add_url : '/cart/add') + '.js', { method: 'POST', headers, body });
        const data = await res.json();
        if (!res.ok || data.status) throw new Error(data.description || data.message || 'Could not add to cart');

        if (this.dataset.redirect === 'checkout') { window.location.href = '/checkout'; return; }
        if (drawer && typeof drawer.renderContents === 'function' && this.dataset.redirect !== 'cart') {
          data.id = data.id || variantId;
          try {
            drawer.classList.remove('is-empty');
            drawer.renderContents(data);
          } catch (err) {
            window.location.href = cartUrl;
          }
        } else {
          window.location.href = cartUrl;
        }
        document.dispatchEvent(new CustomEvent('lw:added', { detail: data }));
      } catch (err) {
        if (this.errorEl) { this.errorEl.textContent = err.message; this.errorEl.classList.add('is-visible'); }
      } finally {
        this.atc.classList.remove('is-loading');
        this.atc.disabled = false;
      }
    }
  }
  if (!customElements.get('lw-buy-box')) customElements.define('lw-buy-box', LwBuyBox);

  /* ------------------------------------------------------------------ */
  /* Gallery                                                             */
  /* ------------------------------------------------------------------ */
  function initGallery(root) {
    root.querySelectorAll('[data-lw-gallery]').forEach((g) => {
      if (g._lw) return; g._lw = true;
      const slides = g.querySelector('.lw-gallery__slides');
      const thumbs = Array.from(g.querySelectorAll('.lw-gallery__thumb'));
      if (!slides) return;
      const go = (i) => {
        const n = slides.children.length;
        i = (i + n) % n;
        slides.scrollTo({ left: slides.clientWidth * i, behavior: 'smooth' });
      };
      const current = () => Math.round(slides.scrollLeft / Math.max(1, slides.clientWidth));
      thumbs.forEach((t, i) => t.addEventListener('click', () => go(i)));
      const prev = g.querySelector('.lw-gallery__arrow--prev');
      const next = g.querySelector('.lw-gallery__arrow--next');
      if (prev) prev.addEventListener('click', () => go(current() - 1));
      if (next) next.addEventListener('click', () => go(current() + 1));
      let t;
      slides.addEventListener('scroll', () => {
        clearTimeout(t);
        t = setTimeout(() => {
          const c = current();
          thumbs.forEach((th, i) => th.classList.toggle('is-active', i === c));
          const at = thumbs[c];
          if (at) at.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
        }, 60);
      }, { passive: true });
    });
  }

  /* ------------------------------------------------------------------ */
  /* Generic sliders                                                     */
  /* ------------------------------------------------------------------ */
  function initSliders(root) {
    root.querySelectorAll('[data-lw-slider]').forEach((s) => {
      if (s._lw) return; s._lw = true;
      const track = s.querySelector('.lw-slider__track');
      const dotsWrap = s.querySelector('.lw-slider__dots');
      if (!track) return;
      const items = Array.from(track.children);
      const step = () => (items[1] ? items[1].offsetLeft - items[0].offsetLeft : track.clientWidth);
      const pages = () => Math.max(1, Math.round((track.scrollWidth - track.clientWidth) / step()) + 1);
      const renderDots = () => {
        if (!dotsWrap) return;
        const n = pages();
        dotsWrap.innerHTML = '';
        if (n <= 1) { s.querySelector('.lw-slider__nav') && (s.querySelector('.lw-slider__nav').style.display = 'none'); return; }
        s.querySelector('.lw-slider__nav') && (s.querySelector('.lw-slider__nav').style.display = '');
        for (let i = 0; i < n; i++) {
          const b = document.createElement('button');
          b.type = 'button';
          b.setAttribute('aria-label', 'Slide ' + (i + 1));
          b.addEventListener('click', () => track.scrollTo({ left: step() * i }));
          dotsWrap.appendChild(b);
        }
        sync();
      };
      const sync = () => {
        if (!dotsWrap) return;
        const i = Math.round(track.scrollLeft / step());
        Array.from(dotsWrap.children).forEach((b, j) => b.classList.toggle('is-active', j === i));
      };
      const prev = s.querySelector('[data-lw-prev]');
      const next = s.querySelector('[data-lw-next]');
      if (prev) prev.addEventListener('click', () => track.scrollBy({ left: -step() }));
      if (next) next.addEventListener('click', () => track.scrollBy({ left: step() }));
      track.addEventListener('scroll', () => requestAnimationFrame(sync), { passive: true });
      window.addEventListener('resize', renderDots);
      renderDots();
    });
  }

  /* ------------------------------------------------------------------ */
  /* Video cards: click to play/pause with sound                         */
  /* ------------------------------------------------------------------ */
  function initVideos(root) {
    root.querySelectorAll('[data-lw-video]').forEach((card) => {
      if (card._lw) return; card._lw = true;
      const v = card.querySelector('video');
      if (!v) return;
      card.addEventListener('click', () => {
        if (v.paused) {
          document.querySelectorAll('[data-lw-video] video').forEach((o) => { if (o !== v) { o.pause(); o.closest('[data-lw-video]').classList.remove('is-playing'); } });
          v.muted = false; v.play(); card.classList.add('is-playing');
        } else { v.pause(); card.classList.remove('is-playing'); }
      });
    });
  }

  /* ------------------------------------------------------------------ */
  /* Counters, stock bar, reveal                                         */
  /* ------------------------------------------------------------------ */
  function animateCount(el) {
    const target = parseFloat(el.dataset.lwCount.replace(/,/g, ''));
    if (isNaN(target)) return;
    const decimals = (el.dataset.lwCount.split('.')[1] || '').length;
    const dur = 1400; const start = performance.now();
    const fmt = (n) => n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    const tick = (now) => {
      const p = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = (el.dataset.prefix || '') + fmt(target * eased) + (el.dataset.suffix || '');
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  const io = 'IntersectionObserver' in window ? new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      const el = e.target;
      if (el.dataset.lwCount) animateCount(el);
      if (el.dataset.lwWidth) el.style.width = el.dataset.lwWidth;
      el.classList.add('is-in');
      io.unobserve(el);
    });
  }, { rootMargin: '0px 0px -60px 0px' }) : null;

  function initObservers(root) {
    root.querySelectorAll('[data-lw-count], [data-lw-width], .lw-reveal').forEach((el) => {
      if (el._lwObs) return; el._lwObs = true;
      if (io && !(window.Shopify && window.Shopify.designMode)) io.observe(el);
      else {
        if (el.dataset.lwWidth) el.style.width = el.dataset.lwWidth;
        el.classList.add('is-in');
      }
    });
  }

  /* ------------------------------------------------------------------ */
  /* Delivery date                                                       */
  /* ------------------------------------------------------------------ */
  function initDelivery(root) {
    root.querySelectorAll('[data-lw-delivery]').forEach((el) => {
      let days = Number(el.dataset.lwDelivery || 3);
      const d = new Date();
      while (days > 0) { d.setDate(d.getDate() + 1); if (d.getDay() !== 0 && d.getDay() !== 6) days--; }
      el.textContent = d.toLocaleDateString(document.documentElement.lang || 'en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    });
  }

  /* ------------------------------------------------------------------ */
  /* Review list "load more"                                             */
  /* ------------------------------------------------------------------ */
  function initLoadMore(root) {
    root.querySelectorAll('[data-lw-more]').forEach((btn) => {
      if (btn._lw) return; btn._lw = true;
      const list = document.getElementById(btn.dataset.lwMore);
      const step = Number(btn.dataset.step || 4);
      btn.addEventListener('click', () => {
        const hidden = Array.from(list.querySelectorAll('.lw-review[hidden]'));
        hidden.slice(0, step).forEach((r) => (r.hidden = false));
        if (hidden.length <= step) btn.remove();
      });
    });
  }

  /* ------------------------------------------------------------------ */
  /* Sticky ATC                                                          */
  /* ------------------------------------------------------------------ */
  function initSticky() {
    const bar = document.querySelector('[data-lw-sticky]');
    if (!bar || bar._lw) return; bar._lw = true;
    const target = document.querySelector('lw-buy-box[data-main]') || document.querySelector('lw-buy-box');
    if (!target || !io) return;
    let visible = true;
    new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        visible = e.isIntersecting;
        const pastTop = e.boundingClientRect.top < 0;
        bar.classList.toggle('is-visible', !visible && pastTop);
      });
    }).observe(target);
    bar.querySelector('[data-lw-sticky-btn]').addEventListener('click', (e) => {
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    document.addEventListener('lw:offer-change', (e) => {
      if (e.detail.box !== target) return;
      const p = bar.querySelector('[data-lw-price]');
      if (p) p.textContent = formatMoney(e.detail.price);
    });
    if (typeof target.update === 'function') target.update();
  }

  /* ------------------------------------------------------------------ */
  /* Sale countdown bar                                                  */
  /* ------------------------------------------------------------------ */
  function initCountdown(root) {
    root.querySelectorAll('[data-lw-countdown]').forEach((el) => {
      if (el._lw) return; el._lw = true;
      const mode = el.dataset.mode;
      const endFor = () => {
        const now = new Date();
        if (mode === 'date') {
          const d = new Date((el.dataset.end || '').replace(' ', 'T'));
          if (!isNaN(d) && d > now) return d;
        }
        if (mode === 'session') {
          const key = 'lw-cd-end';
          let end = 0;
          try { end = Number(localStorage.getItem(key)); } catch (e) {}
          if (!end || end < Date.now()) {
            end = Date.now() + Number(el.dataset.hours || 2) * 3600000;
            try { localStorage.setItem(key, String(end)); } catch (e) {}
          }
          return new Date(end);
        }
        const m = new Date(now); m.setHours(24, 0, 0, 0); return m;
      };
      let end = endFor();
      const h = el.querySelector('[data-h]'), m = el.querySelector('[data-m]'), s = el.querySelector('[data-s]');
      const pad = (n) => String(n).padStart(2, '0');
      const tick = () => {
        let left = Math.floor((end - Date.now()) / 1000);
        if (left < 0) { end = endFor(); left = Math.max(0, Math.floor((end - Date.now()) / 1000)); }
        h.textContent = pad(Math.floor(left / 3600)); m.textContent = pad(Math.floor((left % 3600) / 60)); s.textContent = pad(left % 60);
      };
      tick(); setInterval(tick, 1000);
    });
  }

  function initAll(root) {
    root = root || document;
    initGallery(root); initSliders(root); initVideos(root); initObservers(root);
    initDelivery(root); initLoadMore(root); initCountdown(root); initSticky();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => initAll());
  else initAll();
  document.addEventListener('shopify:section:load', (e) => initAll(e.target));
})();
