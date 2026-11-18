/* =========================================================
   admin.js – Admin panel (frontend-only demo)
   Demo login:  admin / admin123   (NOT real security – see note in README/answer)
   ========================================================= */
document.addEventListener('lf:ready', () => {
  'use strict';
  const { $, $$, esc, store, toast, fmtDate, hash, CATS, modal, uid } = window.LF;
  const root = $('#adminApp'); if (!root) return;
  const ADMIN_USER = 'admin', ADMIN_PW = hash('admin123');
  const items = () => store.get('items', []), claims = () => store.get('claims', []);
  const saveItems = v => store.set('items', v), saveClaims = v => store.set('claims', v);
  let tab = (location.hash || '#dashboard').slice(1), cFilter = 'Under review', iQuery = '';

  /* ---------- matching engine ---------- */
  const STOP = new Set('the a an of in on at with and or is to for my it this that has have was were had are near inside from'.split(' '));
  const tok = s => [...new Set(String(s || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(w => w.length > 2 && !STOP.has(w)))];
  const overlap = (a, b) => {
    const A = tok(a), B = tok(b); if (!A.length || !B.length) return 0;
    return A.filter(w => B.some(x => x === w || x.startsWith(w) || w.startsWith(x))).length / Math.min(A.length, B.length);
  };
  const score = (c, i) => Math.round(100 * (.5 * overlap(c.item, i.title + ' ' + i.category) + .3 * overlap(c.desc, i.title + ' ' + i.description) + .2 * overlap(c.location, i.location)));
  const bestMatches = c => items().filter(i => i.status !== 'returned').map(i => ({ i, s: score(c, i) })).sort((a, b) => b.s - a.s).slice(0, 3);
  const level = s => s >= 60 ? ['High match', '#28a745'] : s >= 30 ? ['Possible match', '#f0ad00'] : ['Weak match', '#dc3545'];
  const bar = s => `<div class="mbar"><span style="width:${s}%;background:${level(s)[1]}"></span></div><small><b>${s}%</b> · ${level(s)[0]}</small>`;

  /* ---------- auth ---------- */
  const isAdmin = () => !!store.get('admin', null);
  function loginView() {
    root.innerHTML = `<div class="admin-login"><i class="fas fa-user-shield"></i><h2>Admin Login</h2>
      <p class="muted">Only portal administrators can verify claims.</p>
      <form id="adminLogin" novalidate>
        <div class="field"><input class="input" name="u" placeholder="Username" autocomplete="username"></div>
        <div class="field"><input class="input" name="p" type="password" placeholder="Password" autocomplete="current-password"></div>
        <button class="btn btn-blue btn-full">Sign in</button>
      </form><small class="muted d-block top-m">Demo credentials: <b>admin</b> / <b>admin123</b></small></div>`;
    $('#adminLogin').addEventListener('submit', e => {
      e.preventDefault(); const f = e.target;
      if (f.u.value.trim() === ADMIN_USER && hash(f.p.value) === ADMIN_PW) { store.set('admin', { at: Date.now() }); toast('Welcome, admin!', 'success'); app(); }
      else { f.classList.remove('shake'); void f.offsetWidth; f.classList.add('shake'); toast('Wrong username or password.', 'error'); }
    });
  }

  /* ---------- shell ---------- */
  const TABS = [['dashboard', 'fa-chart-pie', 'Dashboard'], ['claims', 'fa-clipboard-check', 'Claims'], ['items', 'fa-boxes', 'Found Items'], ['inbox', 'fa-envelope-open-text', 'Messages & Feedback']];
  function app() {
    if (!isAdmin()) return loginView();
    const pending = claims().filter(c => c.status === 'Under review').length;
    root.innerHTML = `<div class="admin-grid">
      <aside class="admin-side">
        <h4><i class="fas fa-user-shield"></i> Admin</h4>
        ${TABS.map(([k, ic, t]) => `<a href="#${k}" data-tab="${k}" class="${tab === k ? 'on' : ''}"><i class="fas ${ic}"></i> ${t}${k === 'claims' && pending ? `<span class="count">${pending}</span>` : ''}</a>`).join('')}
        <button class="btn btn-small btn-line-white top-m" id="aOut"><i class="fas fa-sign-out-alt"></i> Sign out</button>
      </aside>
      <section class="admin-main" id="aMain"></section></div>`;
    $$('[data-tab]').forEach(a => a.addEventListener('click', () => { tab = a.dataset.tab; app(); }));
    $('#aOut').onclick = () => { localStorage.removeItem('lf_admin'); toast('Signed out.', 'info'); loginView(); };
    ({ dashboard, claims: claimsView, items: itemsView, inbox })[tab]();
  }

  /* ---------- dashboard ---------- */
  function dashboard() {
    const I = items(), C = claims(), M = store.get('messages', []), F = store.get('feedback', []);
    const avg = F.length ? (F.reduce((a, f) => a + f.rating, 0) / F.length).toFixed(1) : '–';
    const card = (ic, n, l, col) => `<div class="a-stat"><i class="fas ${ic}" style="background:${col}"></i><div><b>${n}</b><small>${l}</small></div></div>`;
    $('#aMain').innerHTML = `<h3>Dashboard</h3>
      <div class="a-stats">
        ${card('fa-box-open', I.length, 'Items listed', '#007bff')}${card('fa-hourglass-half', C.filter(c => c.status === 'Under review').length, 'Claims to review', '#f0ad00')}
        ${card('fa-check-circle', C.filter(c => c.status === 'Verified').length, 'Verified, awaiting pickup', '#17a2b8')}${card('fa-handshake', I.filter(i => i.status === 'returned').length, 'Items returned', '#28a745')}
        ${card('fa-envelope', M.length, 'Messages', '#6f42c1')}${card('fa-star', avg, 'Avg. feedback rating', '#fd7e14')}
      </div>
      <div class="a-card"><div class="flex space-between items-center"><h5 class="bottom-0">Needs your attention</h5>
        <div><button class="btn btn-small btn-light" id="xItems"><i class="fas fa-download"></i> Items CSV</button> <button class="btn btn-small btn-light" id="xClaims"><i class="fas fa-download"></i> Claims CSV</button></div></div>
        <div id="attn">${C.filter(c => c.status === 'Under review').slice(0, 4).map(c => { const m = bestMatches(c)[0]; return `<div class="a-row"><div><b>${esc(c.item)}</b> <small class="muted">by ${esc(c.name)} · ${fmtDate(c.date)}</small></div><div>${m ? `best match <b>${m.s}%</b>` : 'no match'} <a href="#claims" data-go="claims" class="btn btn-small btn-blue left-s">Review</a></div></div>`; }).join('') || '<p class="muted top-m bottom-0">🎉 No claims are waiting for review.</p>'}</div></div>`;
    $$('[data-go]').forEach(a => a.addEventListener('click', () => { tab = 'claims'; cFilter = 'Under review'; app(); }));
    const csv = (name, rows, cols) => {
      const q = v => '"' + String(v ?? '').replace(/"/g, '""') + '"';
      const text = [cols.join(','), ...rows.map(r => cols.map(c => q(r[c])).join(','))].join('\n');
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv' })); a.download = name; a.click();
    };
    $('#xItems').onclick = () => csv('found-items.csv', I, ['title', 'category', 'location', 'date', 'status', 'finder', 'email']);
    $('#xClaims').onclick = () => csv('claims.csv', C, ['item', 'name', 'email', 'location', 'date', 'status', 'adminNote']);
  }

  /* ---------- claims + matching ---------- */
  function claimsView() {
    const all = claims(), STAT = ['Under review', 'Verified', 'Returned', 'Rejected'];
    const list = all.filter(c => !cFilter || c.status === cFilter);
    $('#aMain').innerHTML = `<h3>Claims</h3>
      <div class="chips bottom-m"><button class="chip ${cFilter === '' ? 'active' : ''}" data-f="">All (${all.length})</button>
        ${STAT.map(s => `<button class="chip ${cFilter === s ? 'active' : ''}" data-f="${s}">${s} (${all.filter(c => c.status === s).length})</button>`).join('')}</div>
      ${list.length ? list.map(claimCard).join('') : '<div class="a-card center-text muted">No claims in this view.</div>'}`;
    $$('[data-f]').forEach(b => b.addEventListener('click', () => { cFilter = b.dataset.f; claimsView(); }));
    $$('[data-act]').forEach(b => b.addEventListener('click', () => act(b.dataset.act, b.closest('[data-cid]').dataset.cid, b)));
    $$('[data-link]').forEach(s => s.addEventListener('change', () => { setLink(s.closest('[data-cid]').dataset.cid, s.value); }));
  }
  function claimCard(c) {
    const linked = items().find(i => i.id === c.itemId), sug = bestMatches(c), cand = linked ? { i: linked, s: score(c, linked) } : sug[0];
    const col = { 'Under review': 'amber', Verified: 'ok', Returned: 'ok', Rejected: 'bad' }[c.status];
    const side = (t, rows) => `<div class="cmp"><h6>${t}</h6>${rows}</div>`;
    const kv = (k, v) => `<div><span>${k}</span>${esc(v || '–')}</div>`;
    const open = c.status === 'Under review';
    return `<div class="a-card claim" data-cid="${c.id}">
      <div class="flex space-between wrap-items"><h5>${esc(c.item)} <span class="pill ${col === 'ok' ? 'ok' : col === 'bad' ? 'bad' : ''}">${esc(c.status)}</span></h5><small class="muted">${fmtDate(c.date)}</small></div>
      <div class="cmp-grid">
        ${side('<i class="fas fa-user"></i> Claimant says', kv('Name', c.name) + kv('Email', c.email) + kv('Item', c.item) + kv('Last seen', c.location) + kv('Proof / details', c.desc))}
        ${cand ? side(`<i class="fas fa-box-open"></i> ${linked ? 'Linked found item' : 'Best suggested item'}`, kv('Title', cand.i.title) + kv('Category', cand.i.category) + kv('Found at', cand.i.location) + kv('Description', cand.i.description) + kv('Found by', cand.i.finder + ' (' + cand.i.email + ')') + `<div class="top-s">${bar(cand.s)}</div>`) : side('Found item', '<p class="muted">No found item to compare.</p>')}
      </div>
      ${open ? `<div class="flex wrap-items items-center top-m" style="gap:8px">
        <select class="input input-small" style="max-width:280px" data-link><option value="">Link a different found item…</option>${sug.map(m => `<option value="${m.i.id}">${esc(m.i.title)} (${m.s}%)</option>`).join('')}${items().filter(i => !sug.some(m => m.i.id === i.id) && i.status !== 'returned').map(i => `<option value="${i.id}">${esc(i.title)}</option>`).join('')}</select>
        <button class="btn btn-success btn-small" data-act="approve"><i class="fas fa-check"></i> Approve</button>
        <button class="btn btn-red btn-small" data-act="reject"><i class="fas fa-times"></i> Reject</button></div>` : ''}
      ${c.status === 'Verified' ? `<div class="top-m"><button class="btn btn-blue btn-small" data-act="return"><i class="fas fa-handshake"></i> Mark as returned to owner</button></div>` : ''}
      ${c.adminNote ? `<p class="top-m bottom-0 small"><b>Admin note:</b> ${esc(c.adminNote)}</p>` : ''}</div>`;
  }
  function setLink(id, itemId) {
    const cs = claims(), c = cs.find(x => x.id === id); if (!c) return;
    if (c.itemId && c.itemId !== itemId) saveItems(items().map(i => i.id === c.itemId && i.status === 'pending' ? { ...i, status: 'available' } : i));
    c.itemId = itemId || null; saveClaims(cs); if (itemId) saveItems(items().map(i => i.id === itemId && i.status === 'available' ? { ...i, status: 'pending' } : i));
    toast('Linked item updated.', 'info'); claimsView();
  }
  function act(a, id) {
    const cs = claims(), c = cs.find(x => x.id === id); if (!c) return;
    const setItem = (st, only) => saveItems(items().map(i => i.id === c.itemId && (!only || i.status === only) ? { ...i, status: st } : i));
    if (a === 'approve') {
      if (!c.itemId) { const m = bestMatches(c)[0]; if (!m) return toast('No found item to link – link one first.', 'error'); c.itemId = m.i.id; }
      const m = items().find(i => i.id === c.itemId), s = m ? score(c, m) : 0;
      if (s < 30 && !confirm(`Match is only ${s}%. Approve anyway?`)) return;
      c.status = 'Verified'; c.adminNote = c.adminNote || `Verified (match ${s}%).`; setItem('pending'); toast('Claim verified. Owner can collect the item.', 'success');
    }
    if (a === 'reject') {
      const why = prompt('Reason for rejection (shown to the user):', 'Details did not match the found item.'); if (why === null) return;
      c.status = 'Rejected'; c.adminNote = why.trim() || 'Rejected by admin.'; setItem('available', 'pending'); toast('Claim rejected.', 'info');
    }
    if (a === 'return') { c.status = 'Returned'; setItem('returned'); toast('Marked as returned. 🎉', 'success'); }
    c.reviewed = new Date().toISOString(); saveClaims(cs); app();
  }

  /* ---------- items ---------- */
  function itemsView() {
    const q = iQuery.toLowerCase(), I = items().filter(i => !q || (i.title + i.location + i.category).toLowerCase().includes(q));
    $('#aMain').innerHTML = `<h3>Found Items</h3><input class="input bottom-m" id="aq" placeholder="Search items…" value="${esc(iQuery)}">
      <div class="a-card pad-0" style="overflow-x:auto"><table class="data-table bottom-0"><thead><tr><th>Item</th><th>Category</th><th>Found at</th><th>Date</th><th>Status</th><th></th></tr></thead><tbody>
      ${I.map(i => `<tr data-iid="${i.id}"><td><b>${esc(i.title)}</b><br><small class="muted">${esc(i.finder)}</small></td><td>${esc(i.category)}</td><td>${esc(i.location)}</td><td>${fmtDate(i.date)}</td>
        <td><select class="input input-small" data-st>${['available', 'pending', 'returned'].map(s => `<option ${s === i.status ? 'selected' : ''}>${s}</option>`).join('')}</select></td>
        <td><button class="btn btn-small btn-line-red" data-del><i class="fas fa-trash"></i></button></td></tr>`).join('') || '<tr><td colspan="6" class="center-text muted pad">Nothing found.</td></tr>'}</tbody></table></div>`;
    $('#aq').addEventListener('input', e => { iQuery = e.target.value; itemsView(); const x = $('#aq'); x.focus(); x.setSelectionRange(x.value.length, x.value.length); });
    $$('[data-st]').forEach(s => s.addEventListener('change', () => { const id = s.closest('tr').dataset.iid; saveItems(items().map(i => i.id === id ? { ...i, status: s.value } : i)); toast('Status updated.', 'success'); }));
    $$('[data-del]').forEach(b => b.addEventListener('click', () => { if (!confirm('Delete this item permanently?')) return; const id = b.closest('tr').dataset.iid; saveItems(items().filter(i => i.id !== id)); toast('Item deleted.', 'info'); itemsView(); }));
  }

  /* ---------- messages & feedback ---------- */
  function inbox() {
    const M = store.get('messages', []), F = store.get('feedback', []);
    $('#aMain').innerHTML = `<h3>Messages &amp; Feedback</h3>
      <div class="a-card"><h5>Contact messages (${M.length})</h5>${M.map(m => `<div class="a-row" data-mid="${m.id}"><div><b>${esc(m.name)}</b> &lt;${esc(m.email)}&gt; <small class="muted">${fmtDate(m.date)}</small><br>${esc(m.message)}</div><div><a class="btn btn-small btn-light" href="mailto:${esc(m.email)}?subject=Re: your message"><i class="fas fa-reply"></i></a> <button class="btn btn-small btn-line-red" data-dm><i class="fas fa-trash"></i></button></div></div>`).join('') || '<p class="muted top-s bottom-0">No messages yet.</p>'}</div>
      <div class="a-card"><h5>Feedback (${F.length})</h5>${F.map(f => `<div class="a-row" data-fid="${f.id}"><div><b>${esc(f.name || 'Anonymous')}</b> <span style="color:#ffc107">${'★'.repeat(f.rating)}${'☆'.repeat(5 - f.rating)}</span> <small class="muted">${fmtDate(f.date)}</small><br>${esc(f.comments)}</div><button class="btn btn-small btn-line-red" data-df><i class="fas fa-trash"></i></button></div>`).join('') || '<p class="muted top-s bottom-0">No feedback yet.</p>'}</div>`;
    $$('[data-dm]').forEach(b => b.addEventListener('click', () => { const id = b.closest('[data-mid]').dataset.mid; store.set('messages', M.filter(x => x.id !== id)); inbox(); }));
    $$('[data-df]').forEach(b => b.addEventListener('click', () => { const id = b.closest('[data-fid]').dataset.fid; store.set('feedback', F.filter(x => x.id !== id)); inbox(); }));
  }

  app();
});
