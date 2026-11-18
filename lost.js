/* =========================================================
   lost.js – Lost Reports page
   (found.js jaisa hi kaam karta hai; data localStorage me 'lost' key me rehta hai)
   ========================================================= */
document.addEventListener('lf:ready', () => {
  'use strict';
  const { $, $$, esc, uid, today, fmtDate, store, CATS, toast, modal, readImage, EMAIL, field, clearErrors, items } = window.LF;
  const grid = $('#lostGrid'); if (!grid) return;

  /* ---------- data ---------- */
  const ago = n => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
  const getLost = () => store.get('lost', []);
  const session = () => store.get('session', null);

  // Pehli baar page khulne par kuch sample reports
  if (!store.get('lost')) {
    const S = (title, category, location, d, description, status = 'missing') =>
      ({ id: uid(), title, category, location, date: ago(d), description, owner: 'Student', email: 'student@lostfound.edu', image: '', status, mine: false });
    store.set('lost', [
      S('Grey Hoodie', 'Others', 'Basketball Court', 1, 'Grey zip hoodie with a small logo on the chest. Left on the bench after practice.'),
      S('Samsung Phone (black)', 'Electronics', 'Library Reading Hall', 2, 'Black Samsung phone with a green cover. Lock screen has a mountain photo.'),
      S('House Keys with blue tag', 'Keys', 'Bus Stand', 3, 'Three keys on a ring with a blue name tag.'),
      S('Brown Wallet', 'Accessories', 'Cafeteria', 4, 'Brown leather wallet with college ID and some cash inside.'),
      S('Black Laptop Bag', 'Bags', 'Block B, Room 101', 6, 'Black laptop bag with a charger and two notebooks.', 'recovered')
    ]);
  }

  const params = new URLSearchParams(location.search);
  const state = { q: params.get('q') || '', cat: CATS[params.get('cat')] ? params.get('cat') : '', sort: 'new', missing: false };

  /* ---------- toolbar (search, sort, chips) ---------- */
  const search = $('#lSearch'), sortSel = $('#lSort'), missCb = $('#lMissing'), chips = $('#lChips');
  search.value = state.q;
  chips.innerHTML = ['<button class="chip" data-cat="">All</button>']
    .concat(Object.entries(CATS).map(([c, ic]) => `<button class="chip" data-cat="${c}"><i class="fas ${ic}"></i>${c}</button>`)).join('');
  const paintChips = () => $$('.chip', chips).forEach(c => c.classList.toggle('active', c.dataset.cat === state.cat));
  chips.addEventListener('click', e => { const c = e.target.closest('.chip'); if (!c) return; state.cat = c.dataset.cat; paintChips(); render(); });
  let t; search.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { state.q = search.value.trim(); render(); }, 180); });
  sortSel.addEventListener('change', () => { state.sort = sortSel.value; render(); });
  missCb.addEventListener('change', () => { state.missing = missCb.checked; render(); });
  $('#lReset').addEventListener('click', () => { Object.assign(state, { q: '', cat: '', sort: 'new', missing: false }); search.value = ''; sortSel.value = 'new'; missCb.checked = false; paintChips(); render(); });
  $('#goLost').addEventListener('click', () => $('#report').scrollIntoView({ behavior: 'smooth' }));

  /* ---------- cards ---------- */
  const hl = s => { const e = esc(s); if (!state.q) return e; const r = new RegExp('(' + state.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig'); return e.replace(r, '<mark>$1</mark>'); };
  const media = i => i.image ? `<img src="${i.image}" alt="${esc(i.title)}" loading="lazy">` : `<div class="ph ph-${i.category}"><i class="fas ${CATS[i.category] || 'fa-box-open'}"></i></div>`;
  const label = { missing: 'Still missing', recovered: 'Recovered' };

  function card(i, n) {
    const open = i.status === 'missing';
    return `<article class="item-card" data-id="${i.id}" style="animation-delay:${Math.min(n, 12) * 40}ms">
      <div class="item-media">${media(i)}<span class="badge-st ${i.status}">${label[i.status]}</span></div>
      <div class="item-body">
        <h3>${hl(i.title)}</h3>
        <div class="item-meta"><i class="fas fa-tag"></i>${esc(i.category)}</div>
        <div class="item-meta"><i class="fas fa-map-marker-alt"></i>${hl(i.location)}</div>
        <div class="item-meta"><i class="far fa-calendar"></i>Lost ${fmtDate(i.date)}</div>
        <p class="item-desc">${esc(i.description)}</p>
        <div class="item-actions">
          <button class="btn btn-light btn-small" data-act="view"><i class="far fa-eye"></i> Details</button>
          <button class="btn btn-blue btn-small" data-act="found" ${open ? '' : 'disabled'}><i class="fas fa-hand-holding-heart"></i> I found it</button>
          ${i.mine && open ? '<button class="btn btn-light btn-small" data-act="done" title="Mark as recovered"><i class="fas fa-check"></i></button>' : ''}
          ${i.mine ? '<button class="btn btn-del btn-small" data-act="del" title="Delete my report"><i class="fas fa-trash"></i></button>' : ''}
        </div>
      </div></article>`;
  }

  function filtered() {
    const q = state.q.toLowerCase();
    const r = getLost().filter(i =>
      (!state.cat || i.category === state.cat) && (!state.missing || i.status === 'missing') &&
      (!q || (i.title + ' ' + i.description + ' ' + i.location + ' ' + i.category).toLowerCase().includes(q)));
    r.sort((a, b) => state.sort === 'old' ? a.date.localeCompare(b.date) : state.sort === 'az' ? a.title.localeCompare(b.title) : b.date.localeCompare(a.date));
    return r;
  }

  function stats() {
    const all = getLost();
    $('#sTotal').textContent = all.length;
    $('#sMissing').textContent = all.filter(i => i.status === 'missing').length;
    $('#sRecovered').textContent = all.filter(i => i.status === 'recovered').length;
  }

  function render() {
    const r = filtered();
    grid.innerHTML = r.length ? r.map(card).join('') : `<div class="empty"><i class="fas fa-search"></i><h4>No reports match your search</h4><p>Try different words, or <a href="found.html">check the Found Items list</a>.</p><button class="btn btn-blue" id="emptyReset">Clear filters</button></div>`;
    $('#lCount').textContent = `${r.length} report${r.length === 1 ? '' : 's'} ${state.q || state.cat || state.missing ? 'match' : 'listed'}`;
    $('#lReset').style.display = state.q || state.cat || state.missing || state.sort !== 'new' ? '' : 'none';
    const er = $('#emptyReset'); er && er.addEventListener('click', () => $('#lReset').click());
    stats();
  }

  /* ---------- card buttons ---------- */
  grid.addEventListener('click', e => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const id = b.closest('.item-card').dataset.id, it = getLost().find(x => x.id === id);
    if (!it) return;
    if (b.dataset.act === 'view') details(it);
    if (b.dataset.act === 'found') iFoundIt(it);
    if (b.dataset.act === 'done') { store.set('lost', getLost().map(x => x.id === id ? { ...x, status: 'recovered' } : x)); toast('Great! Marked as recovered.', 'success'); render(); }
    if (b.dataset.act === 'del' && confirm('Delete this report?')) { store.set('lost', getLost().filter(x => x.id !== id)); toast('Report deleted.', 'info'); render(); }
  });

  const maskMail = m => m.replace(/^(.).*(@.*)$/, '$1•••$2');
  function details(i) {
    const m = modal(`
      <div class="detail-img">${media(i)}</div>
      <h3>${esc(i.title)} <span class="pill ${i.status === 'recovered' ? 'ok' : 'bad'}" style="font-size:.7rem;vertical-align:middle">${label[i.status]}</span></h3>
      <ul class="detail-list">
        <li><b>Category</b>${esc(i.category)}</li><li><b>Lost at</b>${esc(i.location)}</li><li><b>Date lost</b>${fmtDate(i.date)}</li>
        <li><b>Reported by</b>${esc(i.owner)} (${esc(maskMail(i.email))})</li><li><b>Description</b>${esc(i.description)}</li>
      </ul>
      <button class="btn btn-blue btn-full" id="dFound" ${i.status === 'missing' ? '' : 'disabled'}>I found this item</button>`, { wide: true });
    $('#dFound', m).onclick = () => { m._close(); iFoundIt(i); };
  }

  /* ---------- "I found it" – owner ko message bhejne ka chhota form ---------- */
  function iFoundIt(i) {
    const u = session();
    const m = modal(`
      <h3><i class="fas fa-hand-holding-heart"></i> You found "${esc(i.title)}"?</h3>
      <p class="muted">Tell us where the item is. Our team will contact the owner.</p>
      <form id="leadForm" novalidate>
        <div class="field"><label>Your name *</label><input name="name" class="input" value="${esc(u ? u.name : '')}"></div>
        <div class="field"><label>Your email *</label><input name="email" type="email" class="input" value="${esc(u ? u.email : '')}"></div>
        <div class="field"><label>Message *</label><textarea name="msg" rows="3" class="input" placeholder="Where is the item now? How can the owner collect it?"></textarea></div>
        <button class="btn btn-blue btn-full" type="submit">Send</button>
      </form>`);
    $('#leadForm', m).addEventListener('submit', e => {
      e.preventDefault(); const f = e.target; clearErrors(f); let ok = true;
      if (f.name.value.trim().length < 2) ok = field(f.name, 'Enter your name.');
      if (!EMAIL.test(f.email.value.trim())) ok = field(f.email, 'Enter a valid email.');
      if (f.msg.value.trim().length < 10) ok = field(f.msg, 'Write at least 10 characters.');
      if (!ok) return;
      // Admin ke "Messages & Feedback" me ye message dikhega
      const list = store.get('messages', []);
      list.push({ id: uid(), date: today(), name: f.name.value.trim(), email: f.email.value.trim(), message: `[Found: ${i.title}] ${f.msg.value.trim()}` });
      store.set('messages', list);
      toast('Thank you! We will inform the owner.', 'success'); m._close();
    });
  }

  /* ---------- lost report form ---------- */
  const form = $('#lostForm'), drop = $('#drop'), file = $('#lPhoto'), prev = $('#preview');
  let photo = '';
  const catSel = $('#lCat'); catSel.innerHTML = '<option value="">Select category</option>' + Object.keys(CATS).map(c => `<option>${c}</option>`).join('');
  $('#lDate').max = today(); $('#lDate').value = today();
  const u = session(); if (u) { $('#lName').value = u.name; $('#lEmail').value = u.email; }

  async function setPhoto(f) {
    if (!f) return;
    if (f.size > 8 * 1024 * 1024) return toast('Photo is too large (max 8 MB).', 'error');
    try { photo = await readImage(f); prev.style.display = 'block'; $('img', prev).src = photo; drop.style.display = 'none'; }
    catch (err) { toast(err.message, 'error'); }
  }
  drop.addEventListener('click', () => file.click());
  drop.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); file.click(); } });
  file.addEventListener('change', () => setPhoto(file.files[0]));
  ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', e => setPhoto(e.dataTransfer.files[0]));
  $('button', prev).addEventListener('click', () => { photo = ''; file.value = ''; prev.style.display = 'none'; drop.style.display = ''; });
  const desc = $('#lDesc'), cnt = $('#lDescCount'); desc.addEventListener('input', () => cnt.textContent = desc.value.length + ' / 300');

  // Naya report post hone ke baad Found list me milte-julte items dhoondhta hai
  const words = s => s.toLowerCase().split(/\W+/).filter(w => w.length > 2);
  function matchesFor(l) {
    const w = new Set(words(l.title + ' ' + l.description));
    return items().filter(f => f.status === 'available')
      .map(f => ({ f, s: words(f.title + ' ' + f.description).filter(x => w.has(x)).length + (f.category === l.category ? 1 : 0) }))
      .filter(x => x.s >= 2).sort((a, b) => b.s - a.s).slice(0, 3).map(x => x.f);
  }
  function showMatches(list) {
    const m = modal(`
      <h3><i class="fas fa-bell"></i> Possible matches found!</h3>
      <p class="muted">These items in the Found list look similar to what you lost.</p>
      ${list.map(f => `<div class="claim-row"><b>${esc(f.title)}</b><br><small class="muted">${esc(f.location)} · ${fmtDate(f.date)}</small><br>
        <a class="btn btn-small btn-blue top-s" href="claim.html?item=${f.id}">This is mine – Claim it</a></div>`).join('')}`);
    return m;
  }

  form.addEventListener('submit', e => {
    e.preventDefault(); clearErrors(form); let ok = true;
    if ($('#lTitle').value.trim().length < 3) ok = field($('#lTitle'), 'Give the item a short name.');
    if (!catSel.value) ok = field(catSel, 'Choose a category.');
    if ($('#lLoc').value.trim().length < 3) ok = field($('#lLoc'), 'Where did you lose it?');
    if (!$('#lDate').value || $('#lDate').value > today()) ok = field($('#lDate'), 'Pick a valid date (not in the future).');
    if (desc.value.trim().length < 10) ok = field(desc, 'Add a short description (min 10 characters).');
    if ($('#lName').value.trim().length < 2) ok = field($('#lName'), 'Enter your name.');
    if (!EMAIL.test($('#lEmail').value.trim())) ok = field($('#lEmail'), 'Enter a valid email.');
    if (!ok) return;
    const btn = $('button[type=submit]', form); btn.classList.add('loading');
    setTimeout(() => {
      btn.classList.remove('loading');
      const it = { id: uid(), title: $('#lTitle').value.trim(), category: catSel.value, location: $('#lLoc').value.trim(), date: $('#lDate').value,
        description: desc.value.trim(), owner: $('#lName').value.trim(), email: $('#lEmail').value.trim(), image: photo, status: 'missing', mine: true };
      if (!store.set('lost', [it, ...getLost()])) return;
      toast('Your lost report is posted.', 'success');
      form.reset(); photo = ''; prev.style.display = 'none'; drop.style.display = ''; cnt.textContent = '0 / 300'; $('#lDate').value = today();
      if (u) { $('#lName').value = u.name; $('#lEmail').value = u.email; }
      Object.assign(state, { q: '', cat: '', missing: false, sort: 'new' }); search.value = ''; sortSel.value = 'new'; missCb.checked = false; paintChips(); render();
      $('#lostTop').scrollIntoView({ behavior: 'smooth' });
      setTimeout(() => { const c = $(`[data-id="${it.id}"]`); c && c.classList.add('flash'); }, 500);
      const found = matchesFor(it); if (found.length) setTimeout(() => showMatches(found), 900);
    }, 700);
  });

  paintChips(); render();
  if (location.hash === '#report') setTimeout(() => $('#report').scrollIntoView({ behavior: 'smooth' }), 300);
});
