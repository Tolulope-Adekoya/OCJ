// worlds.js — Worlds page

document.addEventListener('ocj-data-ready', () => {
  setBadge('badge-worlds', window.WORLDS.length);
  setBadge('badge-sims',   window.SIMS.length);
  setBadge('badge-lots',   window.LOTS.length);
  renderWorlds(window.WORLDS);
  setupFilters();
});

function setBadge(id, count) {
  const el = document.getElementById(id);
  if (el && count > 0) el.textContent = count;
}

function getStatusTag(status) {
  if (!status) return '<span class="tag tag--muted">Unknown</span>';
  const s = status.toLowerCase();
  if (s.includes('complete'))    return `<span class="tag tag--green">${status}</span>`;
  if (s.includes('progress'))    return `<span class="tag tag--amber">${status}</span>`;
  return `<span class="tag tag--muted">${status}</span>`;
}

function renderWorlds(data) {
  const grid = document.getElementById('worlds-grid');
  const count = document.getElementById('worlds-count');

  if (!data.length) {
    grid.innerHTML = '<div class="no-results">No worlds found.</div>';
    count.textContent = '0 worlds';
    return;
  }

  count.textContent = `${data.length} world${data.length !== 1 ? 's' : ''}`;

  // Column names may vary — try common variants
  const nameKey   = findKey(data[0], ['WORLD', 'World', 'NAME', 'Name', 'WORLD NAME']);
  const statusKey = findKey(data[0], ['STATUS', 'Status', 'COMPLETION', 'Completion']);
  const descKey   = findKey(data[0], ['DESCRIPTION', 'Description', 'WORLD DESCRIPTION', 'DESC']);

  grid.innerHTML = data.map(w => {
    const name   = w[nameKey]   || 'Unnamed World';
    const status = w[statusKey] || '';
    const desc   = w[descKey]   || '';
    return `
      <div class="world-card">
        <div class="world-card-name">${name}</div>
        ${desc ? `<p class="world-card-desc">${desc}</p>` : ''}
        <div class="world-card-meta">
          ${getStatusTag(status)}
        </div>
      </div>
    `;
  }).join('');
}

function setupFilters() {
  const search = document.getElementById('search-worlds');
  const statusSelect = document.getElementById('filter-status');

  const nameKey   = findKey(window.WORLDS[0] || {}, ['WORLD', 'World', 'NAME', 'Name']);
  const statusKey = findKey(window.WORLDS[0] || {}, ['STATUS', 'Status', 'COMPLETION']);

  function applyFilters() {
    const q = search.value.toLowerCase();
    const s = statusSelect.value.toLowerCase();
    const filtered = window.WORLDS.filter(w => {
      const name   = (w[nameKey] || '').toLowerCase();
      const status = (w[statusKey] || '').toLowerCase();
      return (!q || name.includes(q)) && (!s || status.includes(s));
    });
    renderWorlds(filtered);
  }

  search.addEventListener('input', applyFilters);
  statusSelect.addEventListener('change', applyFilters);
}

// Find the first matching key in an object from a list of candidates
function findKey(obj, candidates) {
  for (const c of candidates) {
    if (obj.hasOwnProperty(c)) return c;
  }
  return Object.keys(obj)[0] || '';
}
