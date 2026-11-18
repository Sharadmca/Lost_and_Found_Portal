/* =========================================================
   found.js – Found Items page
   ========================================================= */
document.addEventListener('lf:ready', () => {
  'use strict';
  const { $, $$, esc, uid, today, fmtDate, store, CATS, toast, modal, readImage, EMAIL, field, clearErrors } = window.LF;
  const grid = $('#foundGrid'); if (!grid) return;
  const params = new URLSearchParams(location.search);
  const state = { q: params.get('q') || '', cat: CATS[params.get('cat')] ? params.get('cat') : '', sort: 'new', avail: false };
  const getItems = () => store.get('items', []);
  const session = () => store.get('session', null);

  /* ---------- toolbar ---------- */
  const search = $('#fSearch'), sortSel = $('#fSort'), availCb = $('#fAvail'), chips = $('#fChips');
  search.value = state.q;
  chips.innerHTML = ['<button class="chip" data-cat="">All</button>']
    .concat(Object.entries(CATS).map(([c, ic]) => `<button class="chip" data-cat="${c}"><i class="fas ${ic}"></i>${c}</button>`)).join('');
  const paintChips = () => $$('.chip', chips).forEach(c => c.classList.toggle('active', c.dataset.cat === state.cat));
  chips.addEventListener('click', e => { const c = e.target.closest('.chip'); if (!c) return; state.cat = c.dataset.cat; paintChips(); render(); });
  let t; search.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { state.q = search.value.trim(); render(); }, 180); });
  sortSel.addEventListener('change', () => { state.sort = sortSel.value; render(); });
  availCb.addEventListener('change', () => { state.avail = availCb.checked; render(); });
  $('#fReset').addEventListener('click', () => { Object.assign(state, { q: '', cat: '', sort: 'new', avail: false }); search.value = ''; sortSel.value = 'new'; availCb.checked = false; paintChips(); render(); });
  $('#goReport').addEventListener('click', () => $('#report').scrollIntoView({ behavior: 'smooth' }));

  /* ---------- rendering ---------- */
  const hl = s => { const e = esc(s); if (!state.q) return e; const r = new RegExp('(' + state.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig'); return e.replace(r, '<mark>$1</mark>'); };
  const media = i => i.image ? `<img src="${i.image}" alt="${esc(i.title)}" loading="lazy">` : `<div class="ph ph-${i.category}"><i class="fas ${CATS[i.category] || 'fa-box-open'}"></i></div>`;
  const label = { available: 'Available', pending: 'Claim pending', returned: 'Returned' };

  function card(i, n) {
    const can = i.status === 'available';
    return `<article class="item-card" data-id="${i.id}" style="animation-delay:${Math.min(n, 12) * 40}ms">
      <div class="item-media">${media(i)}<span class="badge-st ${i.status}">${label[i.status]}</span></div>
      <div class="item-body">
        <h3>${hl(i.title)}</h3>
        <div class="item-meta"><i class="fas fa-tag"></i>${esc(i.category)}</div>
        <div class="item-meta"><i class="fas fa-map-marker-alt"></i>${hl(i.location)}</div>
        <div class="item-meta"><i class="far fa-calendar"></i>Found ${fmtDate(i.date)}</div>
        <p class="item-desc">${esc(i.description)}</p>
        <div class="item-actions">
          <button class="btn btn-light btn-small" data-act="view"><i class="far fa-eye"></i> Details</button>
          <a class="btn btn-blue btn-small ${can ? '' : 'disabled'}" href="claim.html?item=${i.id}"><i class="fas fa-hand-paper"></i> Claim</a>
          ${i.mine ? '<button class="btn btn-del btn-small" data-act="del" title="Delete my post"><i class="fas fa-trash"></i></button>' : ''}
        </div>
      </div></article>`;
  }

  function filtered() {
    const q = state.q.toLowerCase();
    let r = getItems().filter(i =>
      (!state.cat || i.category === state.cat) && (!state.avail || i.status === 'available') &&
      (!q || (i.title + ' ' + i.description + ' ' + i.location + ' ' + i.category).toLowerCase().includes(q)));
    r.sort((a, b) => state.sort === 'old' ? a.date.localeCompare(b.date) : state.sort === 'az' ? a.title.localeCompare(b.title) : b.date.localeCompare(a.date));
    return r;
  }

  function stats() {
    const all = getItems();
    const set = (k, v) => { const el = $(`[data-stat="${k}"]`); el && (el.textContent = v); };
    set('found', all.length); set('available', all.filter(i => i.status === 'available').length); set('returned', all.filter(i => i.status === 'returned').length);
  }

  function render() {
    const r = filtered();
    grid.innerHTML = r.length ? r.map(card).join('') : `<div class="empty"><i class="fas fa-search"></i><h4>No items match your search</h4><p>Try different words, or <a href="claim.html">file a claim</a> for your missing item.</p><button class="btn btn-blue" id="emptyReset">Clear filters</button></div>`;
    $('#fCount').textContent = `${r.length} item${r.length === 1 ? '' : 's'} ${state.q || state.cat || state.avail ? 'match' : 'found'}`;
    $('#fReset').style.display = state.q || state.cat || state.avail || state.sort !== 'new' ? '' : 'none';
    const er = $('#emptyReset'); er && er.addEventListener('click', () => $('#fReset').click());
    stats();
  }

  /* ---------- card actions ---------- */
  grid.addEventListener('click', e => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const id = b.closest('.item-card').dataset.id, it = getItems().find(x => x.id === id);
    if (b.dataset.act === 'view') details(it);
    if (b.dataset.act === 'del' && confirm('Delete this post?')) { store.set('items', getItems().filter(x => x.id !== id)); toast('Post deleted.', 'info'); render(); }
  });
  const maskMail = m => m.replace(/^(.).*(@.*)$/, '$1•••$2');
  function details(i) {
    const m = modal(`
      <div class="detail-img">${media(i)}</div>
      <h3>${esc(i.title)} <span class="pill ${i.status === 'available' ? 'ok' : ''}" style="font-size:.7rem;vertical-align:middle">${label[i.status]}</span></h3>
      <ul class="detail-list">
        <li><b>Category</b>${esc(i.category)}</li><li><b>Found at</b>${esc(i.location)}</li><li><b>Date found</b>${fmtDate(i.date)}</li>
        <li><b>Found by</b>${esc(i.finder)} (${esc(maskMail(i.email))})</li><li><b>Description</b>${esc(i.description)}</li>
      </ul>
      <div class="flex" style="gap:10px">
        <a class="btn btn-blue flex-fill ${i.status === 'available' ? '' : 'disabled'}" href="claim.html?item=${i.id}">This is mine – Claim it</a>
        <button class="btn btn-light" id="shareBtn" title="Copy link"><i class="fas fa-share-alt"></i></button>
      </div>`, { wide: true });
    $('#shareBtn', m).onclick = () => {
      const url = location.origin + location.pathname + '?q=' + encodeURIComponent(i.title);
      (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject()).then(() => toast('Link copied!', 'success')).catch(() => toast(url, 'info'));
    };
  }

  /* ---------- report a found item ---------- */
  const form = $('#reportForm'), drop = $('#drop'), file = $('#rPhoto'), prev = $('#preview');
  let photo = '';
  const catSel = $('#rCat'); catSel.innerHTML = '<option value="">Select category</option>' + Object.keys(CATS).map(c => `<option>${c}</option>`).join('');
  $('#rDate').max = today(); $('#rDate').value = today();
  const u = session(); if (u) { $('#rName').value = u.name; $('#rEmail').value = u.email; }

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
  const desc = $('#rDesc'), cnt = $('#rCount'); desc.addEventListener('input', () => cnt.textContent = desc.value.length + ' / 300');

  form.addEventListener('submit', e => {
    e.preventDefault(); clearErrors(form); let ok = true;
    if ($('#rTitle').value.trim().length < 3) ok = field($('#rTitle'), 'Give the item a short name.');
    if (!catSel.value) ok = field(catSel, 'Choose a category.');
    if ($('#rLoc').value.trim().length < 3) ok = field($('#rLoc'), 'Where did you find it?');
    if (!$('#rDate').value || $('#rDate').value > today()) ok = field($('#rDate'), 'Pick a valid date (not in the future).');
    if (desc.value.trim().length < 10) ok = field(desc, 'Add a short description (min 10 characters).');
    if ($('#rName').value.trim().length < 2) ok = field($('#rName'), 'Enter your name.');
    if (!EMAIL.test($('#rEmail').value.trim())) ok = field($('#rEmail'), 'Enter a valid email.');
    if (!ok) return;
    const btn = $('button[type=submit]', form); btn.classList.add('loading');
    setTimeout(() => {
      btn.classList.remove('loading');
      const it = { id: uid(), title: $('#rTitle').value.trim(), category: catSel.value, location: $('#rLoc').value.trim(), date: $('#rDate').value,
        description: desc.value.trim(), finder: $('#rName').value.trim(), email: $('#rEmail').value.trim(), image: photo, status: 'available', mine: true };
      if (!store.set('items', [it, ...getItems()])) return;
      toast('Thanks! Your found item is now listed.', 'success');
      form.reset(); photo = ''; prev.style.display = 'none'; drop.style.display = ''; cnt.textContent = '0 / 300'; $('#rDate').value = today();
      if (u) { $('#rName').value = u.name; $('#rEmail').value = u.email; }
      Object.assign(state, { q: '', cat: '', avail: false, sort: 'new' }); search.value = ''; sortSel.value = 'new'; availCb.checked = false; paintChips(); render();
      $('#foundTop').scrollIntoView({ behavior: 'smooth' });
      setTimeout(() => { const c = $(`[data-id="${it.id}"]`); c && c.classList.add('flash'); }, 500);
    }, 700);
  });

  paintChips(); render();
  if (location.hash === '#report') setTimeout(() => $('#report').scrollIntoView({ behavior: 'smooth' }), 300);
});
