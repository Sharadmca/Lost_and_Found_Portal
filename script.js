/* =========================================================
   script.js – shared behaviour for all pages
   Data is kept in localStorage (frontend-only demo, no server)
   ========================================================= */
(function () {
  'use strict';

  /* ---------- helpers ---------- */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const today = () => new Date().toISOString().slice(0, 10);
  const daysAgo = n => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
  const fmtDate = d => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  const hash = s => { let h = 5381; for (const c of s) h = ((h << 5) + h + c.charCodeAt(0)) | 0; return String(h); };
  const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  const store = {
    get(k, d) { try { const v = localStorage.getItem('lf_' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('lf_' + k, JSON.stringify(v)); return true; } catch (e) { toast('Storage is full – try a smaller photo.', 'error'); return false; } }
  };

  const CATS = { Electronics: 'fa-laptop', Accessories: 'fa-glasses', Documents: 'fa-id-card', Bags: 'fa-shopping-bag', Keys: 'fa-key', Others: 'fa-box-open' };

  /* ---------- seed data ---------- */
  function seed() {
    if (store.get('items')) return;
    const S = (title, category, location, d, description, status = 'available') =>
      ({ id: uid(), title, category, location, date: daysAgo(d), description, finder: 'Security Desk', email: 'security@lostfound.edu', status, mine: false });
    store.set('items', [
      S('Black Leather Wallet', 'Accessories', 'Main Library, 2nd floor', 1, 'Black bifold wallet with a few cards inside. Found on a reading table near the window.'),
      S('iPhone with blue cover', 'Electronics', 'Cafeteria', 2, 'Locked iPhone with a transparent blue back cover and a small crack on the corner.'),
      S('Student ID Card', 'Documents', 'Block A, Room 204', 2, 'College ID card of a 3rd-year student. Name is partly faded, photo is visible.'),
      S('Bunch of Keys (red keychain)', 'Keys', 'Bus Stand', 3, 'Four keys on a red keychain shaped like a football.'),
      S('Wireless Earbuds Case', 'Electronics', 'Sports Ground', 4, 'White charging case, earbuds are inside. Has a small sticker on the lid.'),
      S('Prescription Glasses', 'Accessories', 'Seminar Hall', 5, 'Black rectangular frame glasses in a brown soft case.'),
      S('Blue Backpack', 'Bags', 'Parking Area', 6, 'Navy blue backpack with notebooks and a water bottle inside.', 'pending'),
      S('Scientific Calculator', 'Electronics', 'Lab 3', 8, 'Casio scientific calculator with initials scratched on the back.', 'returned')
    ]);
  }
  seed();
  const items = () => store.get('items', []);
  window.LF = { $, $$, esc, uid, today, fmtDate, store, CATS, items, toast: (...a) => toast(...a), modal: (...a) => modal(...a), readImage: (...a) => readImage(...a), hash, EMAIL, field, clearErrors };

  /* ---------- toast ---------- */
  function toast(msg, type = 'info') {
    let box = $('#lf-toasts');
    if (!box) { box = document.createElement('div'); box.id = 'lf-toasts'; document.body.appendChild(box); }
    const t = document.createElement('div');
    t.className = 'lf-toast ' + type;
    const ic = { success: 'fa-check-circle', error: 'fa-exclamation-circle', info: 'fa-info-circle' }[type] || 'fa-info-circle';
    t.innerHTML = `<i class="fas ${ic}"></i><span>${esc(msg)}</span>`;
    box.appendChild(t);
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 300); }, 3800);
  }

  /* ---------- modal ---------- */
  function modal(html, opts = {}) {
    const w = document.createElement('div');
    w.className = 'lf-modal-wrap';
    w.innerHTML = `<div class="lf-modal${opts.wide ? ' wide' : ''}" role="dialog" aria-modal="true"><button class="lf-close" aria-label="Close">&times;</button>${html}</div>`;
    document.body.appendChild(w);
    document.body.classList.add('lf-noscroll');
    requestAnimationFrame(() => w.classList.add('show'));
    w._close = () => {
      w.classList.remove('show');
      setTimeout(() => { w.remove(); if (!$('.lf-modal-wrap')) document.body.classList.remove('lf-noscroll'); }, 200);
    };
    w.addEventListener('mousedown', e => { if (e.target === w || e.target.closest('.lf-close')) w._close(); });
    setTimeout(() => { const f = $('input:not([type=hidden]),textarea,select', w); f && f.focus(); }, 80);
    return w;
  }
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { const m = $$('.lf-modal-wrap').pop(); m && m._close(); } });

  /* ---------- validation helpers ---------- */
  function field(el, msg) {
    el.classList.add('is-invalid');
    if (!el.parentNode.querySelector('.lf-err')) { const d = document.createElement('div'); d.className = 'lf-err'; d.textContent = msg; el.insertAdjacentElement('afterend', d); }
    else el.parentNode.querySelector('.lf-err').textContent = msg;
    return false;
  }
  function clearErrors(form) { $$('.is-invalid', form).forEach(e => e.classList.remove('is-invalid')); $$('.lf-err', form).forEach(e => e.remove()); }
  document.addEventListener('input', e => {
    if (e.target.classList && e.target.classList.contains('is-invalid')) {
      e.target.classList.remove('is-invalid');
      const n = e.target.nextElementSibling; if (n && n.classList.contains('lf-err')) n.remove();
    }
  });
  function busy(btn, ms, done) {
    if (!btn) return done();
    btn.classList.add('loading');
    setTimeout(() => { btn.classList.remove('loading'); done(); }, ms);
  }

  function readImage(file, max = 640, q = 0.78) {
    return new Promise((res, rej) => {
      if (!file || !file.type.startsWith('image/')) return rej(new Error('Please choose an image file.'));
      const fr = new FileReader();
      fr.onerror = () => rej(new Error('Could not read the file.'));
      fr.onload = () => {
        const img = new Image();
        img.onload = () => {
          const k = Math.min(1, max / Math.max(img.width, img.height));
          const c = document.createElement('canvas');
          c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          res(c.toDataURL('image/jpeg', q));
        };
        img.onerror = () => rej(new Error('Invalid image.'));
        img.src = fr.result;
      };
      fr.readAsDataURL(file);
    });
  }

  /* =========================================================
     NAVBAR + AUTH
     ========================================================= */
  const session = () => store.get('session', null);
  const page = (location.pathname.split('/').pop() || 'index.html').toLowerCase();

  function renderNav() {
    const host = $('#site-nav'); if (!host) return;
    const L = [['index.html', 'Home'], ['about.html', 'About us'], ['found.html', 'Found Items'], ['lost.html', 'Lost Reports'],
      ['claim.html', 'Claim Missing'], ['feedback.html', 'Feedback'], ['contact.html', 'Contact us']];
    if (store.get('admin', null)) L.push(['admin.html', 'Admin']);
    const u = session();
    host.outerHTML = `
    <nav class="site-nav" id="siteNav">
      <a href="index.html" class="brand"><img src="Lost.jpg" alt="Logo"><span>Lost &amp; Found</span></a>
      <button class="nav-toggle" aria-label="Toggle menu" aria-expanded="false"><i class="fas fa-bars"></i></button>
      <ul class="nav-links">
        ${L.map(([h, t]) => `<li><a href="${h}" class="${h.toLowerCase() === page ? 'active' : ''}">${t}</a></li>`).join('')}
      </ul>
      <div class="nav-auth">
        ${u ? `<span class="nav-user">${u.picture ? `<img src="${u.picture}" alt="">` : '<i class="fas fa-user-circle"></i>'} ${esc(u.name.split(' ')[0])}</span>
               <button class="btn-nav" id="logoutBtn">Logout</button>`
            : `<button class="btn-nav" id="loginBtn">Login</button><button class="btn-nav solid" id="registerBtn">Register</button>`}
      </div>
    </nav>`;
    const nav = $('#siteNav');
    $('.nav-toggle', nav).addEventListener('click', e => { nav.classList.toggle('open'); e.currentTarget.setAttribute('aria-expanded', nav.classList.contains('open')); });
    $$('.nav-links a', nav).forEach(a => a.addEventListener('click', () => nav.classList.remove('open')));
    $('#loginBtn') && $('#loginBtn').addEventListener('click', openLogin);
    $('#registerBtn') && $('#registerBtn').addEventListener('click', openRegister);
    $('#logoutBtn') && $('#logoutBtn').addEventListener('click', () => { localStorage.removeItem('lf_session'); toast('You have been logged out.', 'info'); setTimeout(() => location.reload(), 600); });
    window.addEventListener('scroll', () => nav.classList.toggle('scrolled', scrollY > 10), { passive: true });
  }

  function pwToggle(root) {
    $$('.pw-toggle', root).forEach(b => b.addEventListener('click', () => {
      const i = b.previousElementSibling; i.type = i.type === 'password' ? 'text' : 'password';
      b.innerHTML = `<i class="fas fa-eye${i.type === 'password' ? '' : '-slash'}"></i>`;
    }));
  }

  function openLogin() {
    const m = modal(`
      <h3><i class="fas fa-sign-in-alt"></i> Login</h3>
      <form id="loginForm" novalidate>
        <div class="field"><label>Email</label><input type="email" name="email" class="input" autocomplete="email"></div>
        <div class="field"><label>Password</label><input type="password" name="password" class="input" autocomplete="current-password"><button type="button" class="pw-toggle"><i class="fas fa-eye"></i></button></div>
        <button class="btn btn-blue btn-full" type="submit">Login</button>
      </form>
      <p class="lf-switch">New here? <a id="toReg">Create an account</a></p>`);
    pwToggle(m);
    $('#toReg', m).onclick = () => { m._close(); openRegister(); };
    $('#loginForm', m).addEventListener('submit', e => {
      e.preventDefault(); const f = e.target; clearErrors(f);
      const email = f.email.value.trim().toLowerCase(), pw = f.password.value;
      let ok = true;
      if (!EMAIL.test(email)) ok = field(f.email, 'Enter a valid email.');
      if (!pw) ok = field(f.password, 'Enter your password.');
      if (!ok) return;
      const user = store.get('users', []).find(u => u.email === email);
      if (!user || user.pw !== hash(pw)) return field(f.password, 'Incorrect email or password.');
      busy($('button[type=submit]', f), 500, () => {
        store.set('session', { name: user.name, email: user.email, phone: user.phone, picture: user.picture });
        toast(`Welcome back, ${user.name.split(' ')[0]}!`, 'success'); m._close(); setTimeout(() => location.reload(), 700);
      });
    });
  }

  function openRegister() {
    const m = modal(`
      <h3><i class="fas fa-user-plus"></i> User Registration</h3>
      <form id="regForm" novalidate>
        <div class="lf-grid-2">
          <div class="field"><label>Name *</label><input name="name" class="input" autocomplete="name"></div>
          <div class="field"><label>Email *</label><input name="email" type="email" class="input" autocomplete="email"></div>
          <div class="field"><label>Phone (10 digits) *</label><input name="phone" type="tel" maxlength="10" inputmode="numeric" class="input"></div>
          <div class="field"><label>Date of Birth</label><input name="dob" type="date" max="${today()}" class="input"></div>
          <div class="field"><label>Pincode</label><input name="pincode" maxlength="6" inputmode="numeric" class="input"></div>
          <div class="field"><label>Picture</label><input name="picture" type="file" accept="image/*" class="input"></div>
        </div>
        <div class="field"><label>Address</label><textarea name="address" rows="2" class="input"></textarea></div>
        <div class="lf-grid-2">
          <div class="field"><label>Password *</label><input name="password" type="password" class="input" autocomplete="new-password"><button type="button" class="pw-toggle"><i class="fas fa-eye"></i></button><div class="pw-meter"><span></span></div></div>
          <div class="field"><label>Confirm Password *</label><input name="confirm" type="password" class="input" autocomplete="new-password"></div>
        </div>
        <button class="btn btn-blue btn-full" type="submit">Register</button>
      </form>
      <p class="lf-switch">Already registered? <a id="toLogin">Login</a></p>`, { wide: true });
    pwToggle(m);
    $('#toLogin', m).onclick = () => { m._close(); openLogin(); };
    const f = $('#regForm', m);
    f.phone.addEventListener('input', () => f.phone.value = f.phone.value.replace(/\D/g, ''));
    f.pincode.addEventListener('input', () => f.pincode.value = f.pincode.value.replace(/\D/g, ''));
    f.password.addEventListener('input', () => {
      const v = f.password.value; let s = 0;
      if (v.length >= 6) s++; if (v.length >= 10) s++; if (/[A-Z]/.test(v) && /[a-z]/.test(v)) s++; if (/\d/.test(v) && /[^\w]/.test(v)) s++;
      const bar = $('.pw-meter span', f); bar.style.width = (v ? Math.max(s, 1) * 25 : 0) + '%'; bar.style.background = ['#dc3545', '#dc3545', '#f0ad00', '#28a745', '#28a745'][s];
    });
    f.addEventListener('submit', async e => {
      e.preventDefault(); clearErrors(f);
      const v = n => f[n].value.trim(); let ok = true;
      if (v('name').length < 2) ok = field(f.name, 'Please enter your full name.');
      if (!EMAIL.test(v('email'))) ok = field(f.email, 'Enter a valid email.');
      if (!/^\d{10}$/.test(v('phone'))) ok = field(f.phone, 'Phone must be 10 digits.');
      if (v('pincode') && !/^\d{6}$/.test(v('pincode'))) ok = field(f.pincode, 'Pincode must be 6 digits.');
      if (v('dob') && v('dob') > today()) ok = field(f.dob, 'Date of birth cannot be in the future.');
      if (f.password.value.length < 6) ok = field(f.password, 'Use at least 6 characters.');
      else if (f.password.value !== f.confirm.value) ok = field(f.confirm, 'Passwords do not match.');
      const users = store.get('users', []);
      if (ok && users.some(u => u.email === v('email').toLowerCase())) ok = field(f.email, 'This email is already registered.');
      if (!ok) return;
      let picture = '';
      if (f.picture.files[0]) { try { picture = await readImage(f.picture.files[0], 120, .7); } catch (err) { return field(f.picture, err.message); } }
      busy($('button[type=submit]', f), 600, () => {
        const user = { name: v('name'), email: v('email').toLowerCase(), phone: v('phone'), dob: v('dob'), pincode: v('pincode'), address: v('address'), picture, pw: hash(f.password.value) };
        users.push(user); store.set('users', users);
        store.set('session', { name: user.name, email: user.email, phone: user.phone, picture });
        toast('Registration successful – you are logged in!', 'success'); m._close(); setTimeout(() => location.reload(), 800);
      });
    });
  }

  /* =========================================================
     GLOBAL UI: progress bar, back-to-top, reveal, newsletter
     ========================================================= */
  function globalUI() {
    const bar = document.createElement('div'); bar.id = 'lf-progress'; document.body.appendChild(bar);
    const top = document.createElement('button'); top.id = 'lf-top'; top.setAttribute('aria-label', 'Back to top'); top.innerHTML = '<i class="fas fa-arrow-up"></i>';
    top.onclick = () => scrollTo({ top: 0, behavior: 'smooth' }); document.body.appendChild(top);
    addEventListener('scroll', () => {
      const h = document.documentElement; bar.style.width = (scrollY / Math.max(1, h.scrollHeight - innerHeight) * 100) + '%';
      top.classList.toggle('show', scrollY > 500);
    }, { passive: true });

    // reveal on scroll
    const targets = $$('main section, section.wrap, .category-card, .how-it-works-card, .testimonial-card, .update-card, .about-us-card, .quote-section, .contact-details, .contact-form, .faq-item');
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver(es => es.forEach(en => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } }), { threshold: .12 });
      targets.forEach((t, i) => { t.classList.add('reveal'); t.style.transitionDelay = (i % 4) * 70 + 'ms'; io.observe(t); });
    }

    // live counters (home / about); found page sets its own
    if (!$('#foundGrid')) {
      const all = items(), st = { found: all.length, available: all.filter(i => i.status === 'available').length, returned: all.filter(i => i.status === 'returned').length, claims: store.get('claims', []).length };
      $$('[data-stat]').forEach(el => { const end = st[el.dataset.stat] || 0; let n = 0; const step = Math.max(1, Math.ceil(end / 30)); const t = setInterval(() => { n = Math.min(end, n + step); el.textContent = n; if (n >= end) clearInterval(t); }, 40); });
    }
    // admin link in footer
    const fp = $$('footer p').pop(); if (fp && !$('footer a[href="admin.html"]')) fp.insertAdjacentHTML('beforeend', ' | <a href="admin.html" style="color:#adb5bd"><i class="fas fa-user-shield"></i> Admin</a>');

    // newsletter (all pages)
    $$('#NewsletterForm, .newsletter-form').forEach(f => f.addEventListener('submit', e => {
      e.preventDefault(); const i = $('input[type=email]', f); clearErrors(f);
      if (!EMAIL.test(i.value.trim())) return field(i, 'Enter a valid email.');
      const subs = store.get('subs', []); const em = i.value.trim().toLowerCase();
      if (subs.includes(em)) toast('You are already subscribed.', 'info'); else { subs.push(em); store.set('subs', subs); toast('Subscribed! Thanks for joining.', 'success'); }
      f.reset();
    }));

    // broken images → nice placeholder (e.g. Documents.png is empty in the project)
    const fix = img => {
      if (img.dataset.fixed) return; img.dataset.fixed = 1;
      const d = document.createElement('div'); d.className = 'ph ph-' + (img.alt && CATS[img.alt] ? img.alt : 'Documents');
      d.innerHTML = '<i class="fas ' + (CATS[img.alt] || 'fa-image') + '"></i>'; img.replaceWith(d);
    };
    document.addEventListener('error', e => { if (e.target.tagName === 'IMG' && !e.target.closest('.site-nav')) fix(e.target); }, true);
    $$('img').forEach(i => { if (i.complete && i.naturalWidth === 0 && i.getAttribute('src')) fix(i); });
  }

  /* quick form helper for simple "send" forms */
  function simpleForm(form, { key, get, validate, msg }) {
    form.addEventListener('submit', e => {
      e.preventDefault(); clearErrors(form);
      if (validate && !validate(form)) return;
      busy($('button[type=submit]', form), 700, () => {
        const list = store.get(key, []); list.push({ id: uid(), date: today(), ...get(form) }); store.set(key, list);
        toast(msg, 'success'); form.reset(); form.dispatchEvent(new Event('lf:reset'));
      });
    });
  }

  /* =========================================================
     PAGE: HOME
     ========================================================= */
  function initHome() {
    const input = $('#searchinput'); if (!input) return;
    const go = (q, cat) => location.href = 'found.html?' + new URLSearchParams({ ...(q ? { q } : {}), ...(cat ? { cat } : {}) });
    const box = document.createElement('div'); box.id = 'lf-suggest'; $('.search-bar').appendChild(box);
    const sel = document.createElement('select'); sel.id = 'searchCat';
    sel.innerHTML = '<option value="">All</option>' + Object.keys(CATS).map(c => `<option>${c}</option>`).join('');
    input.after(sel);
    let idx = -1;
    const show = () => {
      const q = input.value.trim().toLowerCase(); idx = -1;
      if (!q) return box.classList.remove('show');
      const r = items().filter(i => (i.title + ' ' + i.description + ' ' + i.location).toLowerCase().includes(q) && (!sel.value || i.category === sel.value)).slice(0, 5);
      box.innerHTML = r.length ? r.map(i => `<a href="found.html?q=${encodeURIComponent(i.title)}"><i class="fas ${CATS[i.category] || 'fa-box-open'}"></i>${esc(i.title)}<small>${esc(i.location)}</small></a>`).join('')
        : '<a><i class="fas fa-search"></i>No match yet – try Search to see all results</a>';
      box.classList.add('show');
    };
    input.addEventListener('input', show);
    input.addEventListener('keydown', e => {
      const a = $$('a[href]', box);
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); idx = (idx + (e.key === 'ArrowDown' ? 1 : -1) + a.length) % a.length; a.forEach((x, i) => x.classList.toggle('sel', i === idx)); }
      else if (e.key === 'Enter') { e.preventDefault(); idx >= 0 && a[idx] ? location.href = a[idx].href : go(input.value.trim(), sel.value); }
    });
    sel.addEventListener('change', show);
    document.addEventListener('click', e => { if (!e.target.closest('.search-bar')) box.classList.remove('show'); });
    $('#searchButton').addEventListener('click', () => go(input.value.trim(), sel.value));

    // category cards -> found page
    $$('.category-card').forEach(c => {
      const cat = $('h3', c).textContent.trim(); c.tabIndex = 0; c.setAttribute('role', 'link');
      c.insertAdjacentHTML('beforeend', '<span class="more">Browse items <i class="fas fa-arrow-right"></i></span>');
      c.addEventListener('click', () => go('', cat));
      c.addEventListener('keydown', e => { if (e.key === 'Enter') go('', cat); });
    });

    // latest found items strip
    const strip = $('#latestFound');
    if (strip) strip.innerHTML = items().filter(i => i.status === 'available').sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4).map(i => `
      <a class="item-card" href="found.html?q=${encodeURIComponent(i.title)}" style="text-decoration:none">
        <div class="item-media">${i.image ? `<img src="${i.image}" alt="${esc(i.title)}">` : `<div class="ph ph-${i.category}"><i class="fas ${CATS[i.category] || 'fa-box-open'}"></i></div>`}</div>
        <div class="item-body"><h3>${esc(i.title)}</h3><div class="item-meta"><i class="fas fa-map-marker-alt"></i>${esc(i.location)}</div><div class="item-meta"><i class="far fa-calendar"></i>${fmtDate(i.date)}</div></div></a>`).join('');

    // FAQ accordion
    $$('.faq-item').forEach(it => $('.faq-q', it).addEventListener('click', () => {
      const open = !it.classList.contains('open');
      $$('.faq-item.open').forEach(o => { o.classList.remove('open'); $('.faq-a', o).style.maxHeight = 0; });
      if (open) { it.classList.add('open'); const a = $('.faq-a', it); a.style.maxHeight = a.scrollHeight + 'px'; }
    }));

    // home contact form
    const cf = $('#contact-form');
    cf && simpleForm(cf, {
      key: 'messages', msg: 'Message sent! We will get back to you soon.',
      get: f => ({ name: $('#c-name', f).value, email: $('#c-email', f).value, message: $('#c-message', f).value }),
      validate: f => { let ok = true; if (!$('#c-name', f).value.trim()) ok = field($('#c-name', f), 'Please enter your name.'); if (!EMAIL.test($('#c-email', f).value.trim())) ok = field($('#c-email', f), 'Enter a valid email.'); if ($('#c-message', f).value.trim().length < 10) ok = field($('#c-message', f), 'Message should be at least 10 characters.'); return ok; }
    });
  }

  /* =========================================================
     PAGE: CLAIM
     ========================================================= */
  function initClaim() {
    const form = $('#claimItemForm'); if (!form) return;
    const u = session(), p = new URLSearchParams(location.search), itemId = p.get('item');
    const all = items(), target = all.find(i => i.id === itemId);
    if (u) { $('#claimantName').value = u.name; $('#claimant-mail').value = u.email; }
    if (target) {
      $('#claimant-Itemname').value = target.title; $('#claimant-ItemLocation').value = target.location;
      form.insertAdjacentHTML('afterbegin', `<div class="claim-banner"><i class="fas fa-info-circle"></i><div>You are claiming <b>${esc(target.title)}</b> found at ${esc(target.location)}. Describe something only the owner would know.</div></div>`);
      $('#ClaimItemDesc').placeholder = 'Unique marks, contents, passcode hint, purchase details...';
    }
    const dl = document.createElement('datalist'); dl.id = 'foundTitles';
    dl.innerHTML = all.filter(i => i.status === 'available').map(i => `<option value="${esc(i.title)}">`).join(''); form.appendChild(dl);
    $('#claimant-Itemname').setAttribute('list', 'foundTitles');

    form.addEventListener('submit', e => {
      e.preventDefault(); clearErrors(form); let ok = true;
      if ($('#claimantName').value.trim().length < 2) ok = field($('#claimantName'), 'Please enter your name.');
      if (!EMAIL.test($('#claimant-mail').value.trim())) ok = field($('#claimant-mail'), 'Enter a valid email.');
      if ($('#ClaimItemDesc').value.trim().length < 15) ok = field($('#ClaimItemDesc'), 'Add a few more details (at least 15 characters) so we can verify.');
      if (!ok) return;
      busy($('button[type=submit]', form), 800, () => {
        const title = $('#claimant-Itemname').value.trim();
        const linked = target || items().find(i => i.title.toLowerCase() === title.toLowerCase() && i.status === 'available');
        const claims = store.get('claims', []);
        claims.unshift({ id: uid(), itemId: linked ? linked.id : null, item: title, name: $('#claimantName').value.trim(), email: $('#claimant-mail').value.trim().toLowerCase(), desc: $('#ClaimItemDesc').value.trim(), location: $('#claimant-ItemLocation').value.trim(), date: today(), status: 'Under review' });
        store.set('claims', claims);
        if (linked) { store.set('items', items().map(i => i.id === linked.id ? { ...i, status: 'pending' } : i)); }
        toast('Claim submitted! Our team will verify it shortly.', 'success');
        form.reset(); $('.claim-banner', form) && $('.claim-banner', form).remove();
        history.replaceState(null, '', 'claim.html'); renderClaims();
      });
    });

    // claims tracker
    const panel = document.createElement('div'); panel.className = 'claims-panel'; panel.id = 'claimsPanel';
    $('.claim-section').after(panel);
    function renderClaims() {
      const list = store.get('claims', []);
      panel.style.display = list.length ? '' : 'none';
      const lvl = { 'Under review': 2, Verified: 3, Returned: 4, Rejected: 2 };
      panel.innerHTML = `<h3><i class="fas fa-clipboard-list"></i> My Claims (${list.length})</h3>` + list.map(c => {
        const n = lvl[c.status] || 2, cls = c.status === 'Verified' || c.status === 'Returned' ? 'ok' : c.status === 'Rejected' ? 'bad' : '';
        return `
        <div class="claim-row" data-id="${c.id}">
          <div class="top"><div><b>${esc(c.item)}</b><br><small class="muted">Submitted ${fmtDate(c.date)} · ${esc(c.location || 'location not given')}</small></div>
            <span class="pill ${cls}">${esc(c.status)}</span></div>
          <div class="steps">${['Submitted', 'Under review', 'Verified', 'Returned'].map((t, i) => `<div class="${i < n ? 'done' : ''}">${t}</div>`).join('')}</div>
          ${c.adminNote ? `<p class="small top-m bottom-0"><b>Admin:</b> ${esc(c.adminNote)}</p>` : ''}
          ${c.status === 'Verified' ? '<p class="small green-text top-s bottom-0"><i class="fas fa-check-circle"></i> Approved! Visit the Security Office with your ID to collect the item.</p>' : ''}
          ${c.status === 'Under review' || c.status === 'Rejected' ? `<button class="btn btn-small btn-line-red top-m" data-cancel="${c.id}"><i class="fas fa-times"></i> ${c.status === 'Rejected' ? 'Remove' : 'Cancel claim'}</button>` : ''}
        </div>`; }).join('');
    }
    panel.addEventListener('click', e => {
      const b = e.target.closest('[data-cancel]'); if (!b) return;
      if (!confirm('Cancel this claim?')) return;
      const claims = store.get('claims', []), c = claims.find(x => x.id === b.dataset.cancel);
      store.set('claims', claims.filter(x => x.id !== c.id));
      if (c.itemId) store.set('items', items().map(i => i.id === c.itemId && i.status === 'pending' ? { ...i, status: 'available' } : i));
      toast('Claim cancelled.', 'info'); renderClaims();
    });
    renderClaims();
  }

  /* =========================================================
     PAGE: FEEDBACK
     ========================================================= */
  function initFeedback() {
    const form = $('#feedback-form'); if (!form) return;
    const u = session(); if (u) { $('#Name').value = u.name; $('#Email').value = u.email; $('#Phone').value = u.phone || ''; }
    const labels = ['', 'Poor 😞', 'Fair 😕', 'Good 🙂', 'Very good 😀', 'Excellent 🤩'];
    const grp = document.createElement('div'); grp.className = 'form-group';
    grp.innerHTML = '<label><i class="fas fa-star"></i> Rating:</label><div class="stars" role="radiogroup">' + [1, 2, 3, 4, 5].map(n => `<button type="button" data-v="${n}" aria-label="${n} star">★</button>`).join('') + '</div><div class="star-label"></div>';
    $('#Comments').closest('.form-group').before(grp);
    let rating = 0; const stars = $$('.stars button', grp), lab = $('.star-label', grp);
    const paint = n => stars.forEach((s, i) => s.classList.toggle('on', i < n));
    stars.forEach(s => {
      s.addEventListener('mouseenter', () => { paint(+s.dataset.v); lab.textContent = labels[+s.dataset.v]; });
      s.addEventListener('click', () => { rating = +s.dataset.v; paint(rating); lab.textContent = labels[rating]; $('.lf-err', grp) && $('.lf-err', grp).remove(); });
    });
    $('.stars', grp).addEventListener('mouseleave', () => { paint(rating); lab.textContent = labels[rating]; });

    const cm = $('#Comments'); cm.maxLength = 500;
    const cnt = document.createElement('div'); cnt.className = 'counter'; cnt.textContent = '0 / 500'; cm.after(cnt);
    cm.addEventListener('input', () => cnt.textContent = cm.value.length + ' / 500');

    const ok = $('#success-alert'), bad = $('.msg-error', form); bad && (bad.style.display = 'none');
    const list = document.createElement('div'); list.className = 'fb-list'; $('.feedback-section').after(list);
    const render = () => { const fb = store.get('feedback', []).slice(0, 3); list.innerHTML = fb.length ? '<h5 class="center-text bottom-m">Recent feedback</h5>' + fb.map(f => `<div class="fb-item"><b>${esc(f.name || 'Anonymous')}</b> <span class="s">${'★'.repeat(f.rating)}${'☆'.repeat(5 - f.rating)}</span><br>${esc(f.comments)}</div>`).join('') : ''; };
    render();

    form.addEventListener('submit', e => {
      e.preventDefault(); clearErrors(form); let valid = true;
      if ($('#Email').value && !EMAIL.test($('#Email').value.trim())) valid = field($('#Email'), 'Enter a valid email.');
      if ($('#Phone').value && !/^\d{10}$/.test($('#Phone').value.trim())) valid = field($('#Phone'), 'Phone must be 10 digits.');
      if (!rating) { valid = false; if (!$('.lf-err', grp)) grp.insertAdjacentHTML('beforeend', '<div class="lf-err">Please select a rating.</div>'); }
      if ($('#Comments').value.trim().length < 5) valid = field($('#Comments'), 'Please write a few words.');
      if (!valid) return;
      busy($('button[type=submit]', form), 700, () => {
        const fb = store.get('feedback', []); fb.unshift({ id: uid(), date: today(), name: $('#Name').value.trim(), email: $('#Email').value.trim(), phone: $('#Phone').value.trim(), rating, comments: $('#Comments').value.trim() });
        store.set('feedback', fb); form.reset(); rating = 0; paint(0); lab.textContent = ''; cnt.textContent = '0 / 500';
        if (ok) { ok.style.display = 'block'; setTimeout(() => ok.style.display = 'none', 5000); }
        toast('Thank you for your feedback!', 'success'); render();
      });
    });
  }

  /* =========================================================
     PAGE: CONTACT
     ========================================================= */
  function initContact() {
    const form = $('#contactForm'); if (!form) return;
    const u = session(); if (u) { $('#userName').value = u.name; $('#userEmail').value = u.email; }
    simpleForm(form, {
      key: 'messages', msg: 'Message sent! We will reply by email.',
      get: f => ({ name: $('#userName', f).value, email: $('#userEmail', f).value, message: $('#userMessage', f).value }),
      validate: f => { let ok = true; if (!$('#userName', f).value.trim()) ok = field($('#userName', f), 'Please enter your name.'); if (!EMAIL.test($('#userEmail', f).value.trim())) ok = field($('#userEmail', f), 'Enter a valid email.'); if ($('#userMessage', f).value.trim().length < 10) ok = field($('#userMessage', f), 'Message should be at least 10 characters.'); return ok; }
    });
  }

  /* ---------- boot ---------- */
  document.addEventListener('DOMContentLoaded', () => {
    renderNav(); globalUI(); initHome(); initClaim(); initFeedback(); initContact();
    document.dispatchEvent(new Event('lf:ready'));
  });
})();
