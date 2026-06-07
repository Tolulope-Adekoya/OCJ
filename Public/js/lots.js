// lots.js — Lots page

document.addEventListener('ocj-data-ready', () => {
  setBadge('badge-worlds', window.WORLDS.length);
  setBadge('badge-sims',   window.SIMS.length);
  setBadge('badge-lots',   window.LOTS.length);
  populateFilters();
  renderLots(window.LOTS);
  setupFilters();
});

function setBadge(id, count) {
  const el = document.getElementById(id);
  if (el && count > 0) el.textContent = count;
}

function getStatusTag(status) {
  if (!status) return '<span class="tag tag--muted">—</span>';
  const s = status.toLowerCase();
  if (s.includes('complete') || s.includes('done')) return `<span class="tag tag--green">${status}</span>`;
  if (s.includes('progress') || s.includes('wip'))  return `<span class="tag tag--amber">${status}</span>`;
  if (s.includes('empty') || s.includes('vacant'))  return `<span class="tag tag--muted">${status}</span>`;
  return `<span class="tag">${status}</span>`;
}

function renderLots(data) {
  const tbody = document.getElementById('lots-tbody');
  const count = document.getElementById('lots-count');

  count.textContent = `${data.length} lot${data.length !== 1 ? 's' : ''}`;

  if (!data.length) {
    tbody.innerHTML = '<tr><td colspan="10" class="no-results">No lots match your filters.</td></tr>';
    return;
  }

  tbody.innerHTML = data.map(l => `
    <tr>
      <td class="td-name">${l['LOT NEW NAME'] || l['LOT ORIGINAL NAME'] || '—'}</td>
      <td>${l['WORLD'] || '—'}</td>
      <td>${l['LOT TYPE'] || '—'}</td>
      <td>${l['LOT USE'] || '—'}</td>
      <td>${l['SIZE'] || '—'}</td>
      <td>${l['PRICE'] || '—'}</td>
      <td>${l['BED'] || '—'}</td>
      <td>${l['BATH'] || '—'}</td>
      <td>${l['RESIDENT(S)'] || '—'}</td>
      <td>${getStatusTag(l['STATUS'])}</td>
    </tr>
  `).join('');
}

function populateFilters() {
  // Worlds
  const worldSelect = document.getElementById('filter-world');
  const worlds = [...new Set(window.LOTS.map(l => l['WORLD']).filter(Boolean))].sort();
  worlds.forEach(w => {
    const opt = document.createElement('option');
    opt.value = w; opt.textContent = w;
    worldSelect.appendChild(opt);
  });

  // Lot types
  const typeSelect = document.getElementById('filter-type');
  const types = [...new Set(window.LOTS.map(l => l['LOT TYPE']).filter(Boolean))].sort();
  types.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t; opt.textContent = t;
    typeSelect.appendChild(opt);
  });

  // Statuses
  const statusSelect = document.getElementById('filter-status');
  const statuses = [...new Set(window.LOTS.map(l => l['STATUS']).filter(Boolean))].sort();
  statuses.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s; opt.textContent = s;
    statusSelect.appendChild(opt);
  });
}

function setupFilters() {
  const search = document.getElementById('search-lots');
  const world  = document.getElementById('filter-world');
  const type   = document.getElementById('filter-type');
  const status = document.getElementById('filter-status');

  function applyFilters() {
    const q  = search.value.toLowerCase();
    const w  = world.value;
    const t  = type.value;
    const s  = status.value;

    const filtered = window.LOTS.filter(l => {
      const name      = (l['LOT NEW NAME'] || l['LOT ORIGINAL NAME'] || '').toLowerCase();
      const lotWorld  = l['WORLD']    || '';
      const lotType   = l['LOT TYPE'] || '';
      const lotStatus = l['STATUS']   || '';

      return (
        (!q || name.includes(q)) &&
        (!w || lotWorld  === w) &&
        (!t || lotType   === t) &&
        (!s || lotStatus === s)
      );
    });

    renderLots(filtered);
  }

  [search, world, type, status].forEach(el => {
    el.addEventListener('input',  applyFilters);
    el.addEventListener('change', applyFilters);
  });
}
