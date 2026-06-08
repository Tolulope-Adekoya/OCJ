// worlds.js — Worlds page

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
  if (s === 'complete')         return `<span class="tag tag--green">${status}</span>`;
  if (s === 'almost complete')  return `<span class="tag tag--amber">${status}</span>`;
  if (s === 'active')           return `<span class="tag tag--rose">${status}</span>`;
  return `<span class="tag tag--muted">${status}</span>`;
}

function renderWorlds(data) {
  const grid = document.getElementById('worlds-grid');
  const count = document.getElementById('worlds-count');

  if (!data || !data.length) {
    grid.innerHTML = '<div class="no-results">No worlds found.</div>';
    count.textContent = '0 worlds';
    return;
  }

  // Filter out rows with no world name
  const clean = data.filter(w => w['WORLD'] && w['WORLD'].trim() !== '');

  count.textContent = `${clean.length} world${clean.length !== 1 ? 's' : ''}`;

  grid.innerHTML = clean.map(w => {
    const name   = w['WORLD']       || 'Unnamed World';
    const status = w['STATUS']      || '';
    const desc   = w['DESCRIPTION'] || '';
    const icon   = `images/worlds/icons/${name} Icon.png`;

    return `
      <div class="world-card" onclick="window.location='worlds/${slugify(name)}.html'">
        <div class="world-card-header">
          <img class="world-card-icon" src="${icon}" alt="" onerror="this.style.display='none'" />
          <div class="world-card-name">${name}</div>
        </div>
        ${desc ? `<p class="world-card-desc">${desc}</p>` : ''}
        <div class="world-card-meta">
          ${getStatusTag(status)}
        </div>
      </div>
    `;
  }).join('');
}

function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function setupFilters() {
  const search = document.getElementById('search-worlds');
  const statusSelect = document.getElementById('filter-status');

  // Populate status options from actual data
  const statuses = [...new Set(window.WORLDS.map(w => w['STATUS']).filter(Boolean))].sort();
  statuses.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s;
    opt.textContent = s;
    statusSelect.appendChild(opt);
  });

  function applyFilters() {
    const q = search.value.toLowerCase();
    const s = statusSelect.value;
    const filtered = window.WORLDS.filter(w => {
      const name   = (w['WORLD']  || '').toLowerCase();
      const status = (w['STATUS'] || '');
      return (
        w['WORLD'] && w['WORLD'].trim() !== '' &&
        (!q || name.includes(q)) &&
        (!s || status === s)
      );
    });
    renderWorlds(filtered);
  }

  search.addEventListener('input', applyFilters);
  statusSelect.addEventListener('change', applyFilters);
}