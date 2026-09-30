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

  function setText(n, t) { if (n.textContent !== t) n.textContent = t; }

  // "$1,234.56" / "1.234,56 €" / "29,99" -> cents
  function parseMoney(str) {
    const m = String(str || '').replace(/\u00a0/g, ' ').match(/\d[\d.,\s']*/);
    if (!m) return null;
    let n = m[0].replace(/[\s']/g, '').replace(/[.,]$/, '');
    const dec = n.match(/[.,](\d{1,2})$/);
    let whole = dec ? n.slice(0, -dec[0].length) : n;
    whole = whole.replace(/[.,]/g, '');
    const cents = Number(whole) * 100 + (dec ? Number(dec[1].padEnd(2, '0')) : 0);
    return isFinite(cents) ? Math.round(cents) : null;
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
      // offer card prices (subscription / Kaching-synced)
      this.offers.forEach((el) => {
        const p = this.subscribing && el.dataset.subPrice ? el.dataset.subPrice : el.dataset.price;
        const now = el.querySelector('[data-lw-offer-now]');
        if (now) setText(now, formatMoney(p));
        if (!el.dataset.kSynced) return;
        const was = el.querySelector('[data-lw-offer-was]');
        const c = Number(el.dataset.compare) > Number(p) ? el.dataset.compare : '';
        if (was) { setText(was, c ? formatMoney(c) : ''); was.hidden = !c; }
        const per = el.querySelector('[data-lw-offer-per]');
        if (per && per.dataset.tpl && per.dataset.tpl.includes('[per_unit]')) {
          setText(per, per.dataset.tpl.replace('[per_unit]', formatMoney(Math.round(Number(p) / Math.max(1, Number(per.dataset.bottles) || 1)))));
        }
      });
      this.querySelectorAll('[data-lw-sub-note]').forEach((n) => (n.hidden = !this.subscribing));
      const unlocked = Number(d.gifts || 0);
      this.gifts.forEach((g, i) => g.classList.toggle('is-locked', i >= unlocked));
      if (this.atc) this.atc.disabled = d.available === 'false';
      if (this.hasAttribute('data-kaching-sync') && !this._kReading) this.syncKaching();
      document.dispatchEvent(new CustomEvent('lw:offer-change', { detail: { price, compare, box: this } }));
    }

    /* ---- Kaching sync: our offer cards drive the (hidden) Kaching widget ---- */
    findKaching() {
      const custom = this.dataset.kachingSelector;
      const scope = this.closest('.shopify-section') || document;
      const sels = [custom, 'kaching-bundles-block', 'kaching-bundles', '[class*="kaching-bundles"]', '[id*="kaching"]', '[class*="kaching"]'].filter(Boolean);
      for (const sel of sels) {
        let el = null;
        try { el = scope.querySelector(sel) || document.querySelector(sel); } catch (e) {}
        if (el && !el.closest('[data-lw-offer], .lw-offers, .lw-gifts') && !el.matches('form, .product-form') && !(this.atc && el.contains(this.atc))) {
          // climb to the outermost Kaching element so we hide the whole widget
          while (el.parentElement && el.parentElement !== scope && el.parentElement !== this && !el.parentElement.matches('form, .product-form') && !(this.atc && el.parentElement.contains(this.atc)) && /kaching/i.test(el.parentElement.className + ' ' + el.parentElement.id + ' ' + el.parentElement.tagName)) el = el.parentElement;
          return el;
        }
      }
      return null;
    }

    kachingDeals(root) {
      let opts = Array.from(root.querySelectorAll('input[type="radio"]'));
      if (!opts.length) opts = Array.from(root.querySelectorAll('[class*="deal-bar"]:not([class*="deal-bar"] [class*="deal-bar"]), [class*="bundle-bar"], [data-deal-index], [role="radio"]'));
      return opts;
    }

    syncKaching() {
      if (!this.kaching || !this.kaching.isConnected) {
        this.kaching = this.findKaching();
        if (!this.kaching) {
          // Kaching renders a moment after page load — keep looking for a few seconds
          if (!this._kTries) this._kTries = 0;
          if (this._kTries++ < 40) { clearTimeout(this._kT); this._kT = setTimeout(() => this.syncKaching(), 250); }
          return;
        }
        this.kaching.classList.add('lw-kaching-hidden');
        if (!this._kObs && 'MutationObserver' in window) {
          this._kObs = new MutationObserver(() => { if (this.kaching && !this.kaching.isConnected) { this.kaching = null; this.syncKaching(); } });
          this._kObs.observe(this.closest('.shopify-section') || document.body, { childList: true, subtree: true });
        }
        this.kaching.setAttribute('aria-hidden', 'true');
        if (this.hasAttribute('data-kaching-prices') && 'MutationObserver' in window) {
          if (this._kpObs) this._kpObs.disconnect();
          this._kpObs = new MutationObserver(() => { clearTimeout(this._kpT); this._kpT = setTimeout(() => this.readKaching(), 60); });
          this._kpObs.observe(this.kaching, { childList: true, subtree: true, characterData: true });
        }
      }
      const idx = Math.max(0, this.offers.indexOf(this.selected));
      const deals = this.kachingDeals(this.kaching);
      const target = deals[idx] || deals[deals.length - 1];
      if (target) {
        const isInput = target.tagName === 'INPUT';
        const already = isInput ? target.checked : (target.getAttribute('aria-checked') === 'true' || /selected|active/.test(target.className));
        if (!already) {
          if (isInput) { target.click(); target.dispatchEvent(new Event('change', { bubbles: true })); }
          else target.click();
        }
      }
      // subscription toggle follows ours
      const subBox = this.kaching.querySelector('input[type="checkbox"]');
      if (subBox && this.subInput && subBox.checked !== this.subscribing) { subBox.click(); subBox.dispatchEvent(new Event('change', { bubbles: true })); }
      // keep our form's fallback id/quantity in line with the chosen offer (Kaching may overwrite them)
      if (this.form) {
        const d = this.selected.dataset;
        const idIn = this.form.querySelector('[name="id"]'), qIn = this.form.querySelector('[name="quantity"]'), spIn = this.form.querySelector('[name="selling_plan"]');
        if (idIn && d.variant) idIn.value = d.variant;
        if (qIn) qIn.value = d.qty || 1;
        if (spIn) spIn.value = this.subscribing && d.sellingPlan ? d.sellingPlan : '';
      }
      if (this.hasAttribute('data-kaching-prices')) { clearTimeout(this._kpT); this._kpT = setTimeout(() => this.readKaching(), 60); }
    }

    /* ---- Kaching prices -> our offer cards (their numbers, our styling) ---- */
    readKaching() {
      if (!this.kaching || !this.kaching.isConnected) return;
      const deals = this.kachingDeals(this.kaching);
      if (!deals.length) return;
      const boxOf = (opt) => opt.closest('.kaching-bundles__bar, [class*="bundles__bar"]:not([class*="__bar-"]), label, [role="radio"]') || opt.parentElement;
      const isStruck = (n) => !!n.closest('s, del, strike, [class*="full-price"], [class*="compare"], [class*="original"]') || /line-through/.test(getComputedStyle(n).textDecorationLine || '');
      const moneyRe = /\d[\d.,\s']*\d|\d/;
      let changed = false;
      this.offers.forEach((el, i) => {
        const opt = deals[i];
        if (!opt) return;
        const box = boxOf(opt);
        if (!box) return;
        let price = null, compare = null;
        const priceEl = box.querySelector('[class*="bar-price"]:not([class*="full"]):not([class*="compare"]), [class*="__price"]:not([class*="full"]):not([class*="compare"])');
        const compEl = box.querySelector('[class*="full-price"], [class*="compare"], s, del');
        if (priceEl) price = parseMoney(priceEl.textContent);
        if (compEl) compare = parseMoney(compEl.textContent);
        if (price == null) {
          // fallback: first money amount that isn't struck through
          const walker = document.createTreeWalker(box, NodeFilter.SHOW_TEXT);
          let t;
          while ((t = walker.nextNode())) {
            if (!/[$€£¥₹]|\d[.,]\d{2}/.test(t.nodeValue) || !moneyRe.test(t.nodeValue)) continue;
            const v = parseMoney(t.nodeValue);
            if (v == null) continue;
            if (isStruck(t.parentElement)) { if (compare == null) compare = v; } else if (price == null) price = v;
          }
        }
        if (price == null) return;
        const key = this.subscribing && el.dataset.subPrice ? 'subPrice' : 'price';
        if (String(price) !== el.dataset[key]) { el.dataset[key] = price; changed = true; }
        const c = compare && compare > price ? String(compare) : '0';
        if (c !== el.dataset.compare) { el.dataset.compare = c; changed = true; }
        if (!el.dataset.kSynced) { el.dataset.kSynced = '1'; changed = true; }
        if (this.hasAttribute('data-kaching-titles')) {
          const tEl = box.querySelector('[class*="bar-title"], [class*="__title"]');
          const ours = el.querySelector('.lw-offer__title');
          if (tEl && ours && tEl.textContent.trim()) setText(ours, tEl.textContent.trim());
        }
      });
      if (changed) { this._kReading = true; try { this.update(); } finally { this._kReading = false; } }
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
      // bundle/subscription apps (e.g. Kaching) write id, quantity, selling_plan, properties or items[] into this form.
      // An empty selling_plan makes Shopify reject the add, so drop it when no plan is chosen.
      if (!fd.get('selling_plan')) fd.delete('selling_plan');
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
      if (el.dataset.lwCount && io) {
        const dec = (el.dataset.lwCount.split('.')[1] || '').length;
        el.textContent = (el.dataset.prefix || '') + (0).toFixed(dec) + (el.dataset.suffix || '');
      }
      // counters animate in the theme editor too; reveal effects show instantly there
      if (io && (!(window.Shopify && window.Shopify.designMode) || el.dataset.lwCount)) io.observe(el);
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
    const watch = target.querySelector('.lw-atc, [type="submit"]') || target;
    let ticking = false;
    // circle -> pill animation: distance the thumbnail travels while the bar expands
    const inner = bar.querySelector('.lw-sticky__inner');
    const measure = () => {
      if (!inner) return;
      const c = parseFloat(getComputedStyle(inner).getPropertyValue('--lw-c')) || 54;
      bar.style.setProperty('--lw-w', Math.max(0, inner.offsetWidth - c) + 'px');
    };
    window.addEventListener('resize', () => { if (bar.classList.contains('is-shown')) measure(); });
    const check = () => {
      ticking = false;
      const on = watch.getBoundingClientRect().bottom < 0;
      if (on === visible) return;
      visible = on;
      document.body.classList.toggle('lw-sticky-on', on);
      clearTimeout(bar._hideT);
      if (on) {
        // display first (Safari samples anything rendered at the bottom, even invisible), then animate in
        bar.classList.add('is-shown');
        measure();
        requestAnimationFrame(() => requestAnimationFrame(() => bar.classList.add('is-visible')));
      } else {
        bar.classList.remove('is-visible');
        bar._hideT = setTimeout(() => { if (!visible) bar.classList.remove('is-shown'); }, 1000);
      }
    };
    visible = null;
    window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(check); } }, { passive: true });
    window.addEventListener('resize', check);
    check();
    bar.querySelector('[data-lw-sticky-btn]').addEventListener('click', (e) => {
      e.preventDefault();
      const atc = target.querySelector('.lw-atc, [type="submit"]');
      if (bar.dataset.action === 'add' && atc && !atc.disabled) { atc.click(); return; }
      (atc || target).scrollIntoView({ behavior: 'smooth', block: 'center' });
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

  /* ------------------------------------------------------------------ */
  /* Customer videos: move the "LW · Customer videos" carousel into the  */
  /* product section's slot (under the image / after info on mobile).    */
  /* ------------------------------------------------------------------ */
  function placeUgc() {
    const slot = document.querySelector('[data-lw-ugc-slot]');
    document.querySelectorAll('[data-lw-ugc-home][data-position="media"]').forEach((home) => {
      const ugc = home.querySelector('[data-lw-ugc-from]');
      if (!slot || !ugc) return;
      slot.querySelectorAll('[data-lw-ugc-from="' + home.dataset.lwUgcHome + '"]').forEach((old) => { if (old !== ugc) old.remove(); });
      slot.appendChild(ugc);
      home.hidden = true;
    });
  }
  function returnUgc(root) {
    // before the product section re-renders in the editor, send carousels back home
    root.querySelectorAll('[data-lw-ugc-slot] [data-lw-ugc-from]').forEach((ugc) => {
      const home = document.querySelector('[data-lw-ugc-home="' + ugc.dataset.lwUgcFrom + '"]');
      if (home) { (home.firstElementChild || home).appendChild(ugc); home.hidden = false; } else ugc.remove();
    });
  }
  document.addEventListener('shopify:section:unload', (e) => {
    returnUgc(e.target);
    const home = e.target.querySelector('[data-lw-ugc-home]');
    if (home) document.querySelectorAll('[data-lw-ugc-slot] [data-lw-ugc-from="' + home.dataset.lwUgcHome + '"]').forEach((n) => n.remove());
  });

  /* ------------------------------------------------------------------ */
  /* Mouse drag-to-swipe for scroll-snap strips (touch swipes natively)  */
  /* ------------------------------------------------------------------ */
  function initDrag(root) {
    root.querySelectorAll('.lw-gallery__slides, .lw-slider__track').forEach((el) => {
      if (el._lwDrag) return; el._lwDrag = true;
      let down = false, moved = false, startX = 0, startLeft = 0;
      el.addEventListener('dragstart', (e) => e.preventDefault());
      el.addEventListener('pointerdown', (e) => {
        if (e.pointerType !== 'mouse' || e.button !== 0) return;
        if (el.scrollWidth <= el.clientWidth + 2) return; // not a slider at this size (e.g. desktop grid)
        down = true; moved = false; startX = e.clientX; startLeft = el.scrollLeft;
      });
      window.addEventListener('pointermove', (e) => {
        if (!down) return;
        const dx = e.clientX - startX;
        if (!moved && Math.abs(dx) > 5) {
          moved = true;
          el.style.scrollSnapType = 'none'; el.style.scrollBehavior = 'auto'; el.style.cursor = 'grabbing';
        }
        if (moved) el.scrollLeft = startLeft - dx;
      });
      window.addEventListener('pointerup', () => {
        if (!down) return;
        down = false;
        if (!moved) return;
        // snap to the nearest item in the drag direction
        const items = Array.from(el.children);
        const step = items[1] ? items[1].offsetLeft - items[0].offsetLeft : el.clientWidth;
        const delta = el.scrollLeft - startLeft;
        let idx = Math.round(startLeft / step) + (Math.abs(delta) > step * 0.15 ? Math.sign(delta) : 0);
        idx = Math.max(0, Math.min(idx, Math.round((el.scrollWidth - el.clientWidth) / step)));
        el.style.cursor = '';
        el.scrollTo({ left: idx * step, behavior: 'smooth' });
        setTimeout(() => { el.style.scrollSnapType = ''; el.style.scrollBehavior = ''; }, 450);
      });
      // swallow the click that ends a drag (e.g. on a video card)
      el.addEventListener('click', (e) => { if (moved) { e.stopPropagation(); e.preventDefault(); moved = false; } }, true);
    });
  }

  /* ------------------------------------------------------------------ */
  /* Sticky left column: if taller than the screen, stick by its bottom  */
  /* ------------------------------------------------------------------ */
  function initStickyLeft(root) {
    root.querySelectorAll('.lw-pdp__left--sticky').forEach((col) => {
      if (col._lw) return; col._lw = true;
      const update = () => {
        const offset = parseFloat(getComputedStyle(col).getPropertyValue('--lw-sticky-offset')) || 24;
        const top = Math.min(offset, window.innerHeight - col.offsetHeight - 16);
        col.style.setProperty('--lw-left-top', top + 'px');
      };
      update();
      window.addEventListener('resize', update);
      if ('ResizeObserver' in window) new ResizeObserver(update).observe(col);
    });
  }

  /* ------------------------------------------------------------------ */
  /* Timeline: line runs dot-to-dot and fills green as you scroll        */
  /* ------------------------------------------------------------------ */
  function initTimeline(root) {
    root.querySelectorAll('.lw-tl__list').forEach((list) => {
      if (list._lw) return; list._lw = true;
      const steps = [...list.querySelectorAll('.lw-tl__step')];
      if (!steps.length) return;
      const DOT = 19; // dot centre, px from the top of each step
      let ticking = false;
      const update = () => {
        ticking = false;
        const start = steps[0].offsetTop + DOT;
        const end = steps[steps.length - 1].offsetTop + DOT;
        const len = Math.max(0, end - start);
        const trigger = window.innerHeight * 0.6 - list.getBoundingClientRect().top;
        const fill = Math.min(len, Math.max(0, trigger - start));
        list.style.setProperty('--tl-start', start + 'px');
        list.style.setProperty('--tl-len', len + 'px');
        list.style.setProperty('--tl-fill', fill + 'px');
        steps.forEach((st) => st.classList.toggle('is-active', st.offsetTop + DOT <= trigger));
        list.classList.add('lw-tl__list--progress');
      };
      const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
      update();
      window.addEventListener('scroll', onScroll, { passive: true });
      window.addEventListener('resize', onScroll);
      if ('ResizeObserver' in window) new ResizeObserver(onScroll).observe(list);
    });
  }

  /* ------------------------------------------------------------------ */
  /* Accordions: smooth open / close (height animation)                  */
  /* ------------------------------------------------------------------ */
  function initAccordions(root) {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    root.querySelectorAll('.lw-acc details, details.lw-bcard').forEach((d) => {
      if (d._lw) return; d._lw = true;
      const summary = d.querySelector('summary');
      const body = d.querySelector('.lw-acc__body, .lw-bcard__body');
      if (!summary || !body || reduce) return;
      summary.addEventListener('click', (e) => {
        e.preventDefault();
        // decide from the state the user asked for last (not d.open, which lags during a close animation)
        const opening = d._want === undefined ? !d.open : !d._want;
        d._want = opening;
        const border = (parseFloat(getComputedStyle(d).borderTopWidth) || 0) * 2;
        const start = d.offsetHeight;
        if (d._anim) { d._anim.cancel(); d._anim = null; }
        if (opening) {
          d.classList.remove('is-closing');
          d.open = true;
          const end = d.scrollHeight + border;
          d._anim = d.animate({ height: [start + 'px', end + 'px'] }, { duration: 380, easing: 'cubic-bezier(.4, 0, .2, 1)' });
          d._anim.onfinish = () => { d._anim = null; d._want = undefined; };
        } else {
          const end = summary.offsetHeight + border;
          d.classList.add('is-closing');
          d._anim = d.animate({ height: [start + 'px', end + 'px'] }, { duration: 320, easing: 'cubic-bezier(.4, 0, .2, 1)' });
          d._anim.onfinish = () => { d.open = false; d.classList.remove('is-closing'); d._anim = null; d._want = undefined; };
        }
      });
    });
  }

  /* ------------------------------------------------------------------ */
  /* CTA buttons (#lw-product / #lw-offers) scroll to the bundle offers  */
  /* ------------------------------------------------------------------ */
  function initOfferLinks() {
    if (document._lwOfferLinks) return; document._lwOfferLinks = true;
    document.addEventListener('click', (e) => {
      const a = e.target.closest && e.target.closest('a[href]');
      if (!a) return;
      const href = a.getAttribute('href') || '';
      if (!/#lw-(product|offers)$/.test(href)) return;
      const hrefPath = href.split('#')[0];
      if (hrefPath && hrefPath !== location.pathname && hrefPath !== location.href.split('#')[0]) return;
      const offers = document.querySelector('lw-buy-box[data-main] .lw-offers') || document.querySelector('.lw-offers') || document.querySelector('lw-buy-box');
      if (!offers) return;
      e.preventDefault();
      const top = offers.getBoundingClientRect().top + window.scrollY - 90;
      window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
    });
  }

  function initAll(root) {
    root = root || document;
    placeUgc();
    initGallery(root); initSliders(root); initDrag(root); initStickyLeft(root); initVideos(root); initObservers(root);
    initDelivery(root); initLoadMore(root); initCountdown(root); initSticky(); initTimeline(root); initAccordions(root); initOfferLinks();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => initAll());
  else initAll();
  document.addEventListener('shopify:section:load', (e) => initAll(e.target));
})();
