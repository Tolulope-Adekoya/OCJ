// worlds.js — Worlds page with drill-down to lots

document.addEventListener('ocj-data-ready', () => {
  setBadge('badge-worlds', window.WORLDS.length);
  setBadge('badge-sims',   window.SIMS.length);
  setBadge('badge-lots',   window.LOTS.length);

  const cleanWorlds = getCleanWorlds();
  renderWorlds(cleanWorlds);
  setupWorldFilters(cleanWorlds);
  setupBreadcrumb();
});

function setBadge(id, count) {
  const el = document.getElementById(id);
  if (el && count > 0) el.textContent = count;
}

// Filter out blank rows and pivot table junk from bottom of CSV
function getCleanWorlds() {
  return window.WORLDS.filter(w =>
    w['WORLD'] &&
    w['WORLD'].trim() !== '' &&
    w['WORLD'].trim() !== 'Row Labels' &&
    w['WORLD'].trim() !== 'Grand Total'
  );
}

// Normalise world name for matching (lowercase, trim)
function normalise(str) {
  return (str || '').toLowerCase().trim();
}

function getLotsForWorld(worldName) {
  const n = normalise(worldName);
  return window.LOTS.filter(l => normalise(l['WORLD']) === n);
}

function slugify(name) {
  return (name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function getStatusTag(status) {
  if (!status) return '<span class="tag tag--muted">Unknown</span>';
  const s = status.toLowerCase();
  if (s === 'complete')         return `<span class="tag tag--green">${status}</span>`;
  if (s === 'almost complete')  return `<span class="tag tag--amber">${status}</span>`;
  if (s === 'active')           return `<span class="tag tag--rose">${status}</span>`;
  if (s === 'not started')      return `<span class="tag tag--muted">${status}</span>`;
  return `<span class="tag tag--muted">${status}</span>`;
}

function getLotStatusTag(status) {
  if (!status) return '<span class="tag tag--muted">—</span>';
  const s = status.toLowerCase();
  if (s === 'done' || s === 'complete')    return `<span class="tag tag--green">${status}</span>`;
  if (s === 'ongoing' || s === 'wip')      return `<span class="tag tag--amber">${status}</span>`;
  return `<span class="tag tag--muted">${status}</span>`;
}

// ── WORLDS LIST VIEW ──────────────────────────────────────

function renderWorlds(data) {
  const grid  = document.getElementById('worlds-grid');
  const count = document.getElementById('worlds-count');

  if (!data || !data.length) {
    grid.innerHTML = '<div class="no-results">No worlds found.</div>';
    count.textContent = '0 worlds';
    return;
  }

  count.textContent = `${data.length} world${data.length !== 1 ? 's' : ''}`;

  grid.innerHTML = data.map(w => {
    const name      = w['WORLD'] || 'Unnamed';
    const status    = w['STATUS'] || '';
    const desc      = w['DESCRIPTION'] || '';
    const icon      = `images/worlds/icons/${name} Icon.png`;
    const lotCount  = getLotsForWorld(name).length;

    return `
      <div class="world-card" onclick="openWorldDetail('${name.replace(/'/g, "\\'")}')">
        <div class="world-card-header">
          <img class="world-card-icon" src="${icon}" alt=""
            onerror="this.style.display='none'" />
          <div class="world-card-name">${name}</div>
        </div>
        ${desc ? `<p class="world-card-desc">${desc}</p>` : ''}
        <div class="world-card-meta">
          ${getStatusTag(status)}
          ${lotCount ? `<span class="world-card-lot-count">${lotCount} lots</span>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

function setupWorldFilters(cleanWorlds) {
  const search = document.getElementById('search-worlds');
  const statusSel = document.getElementById('filter-status');

  // Populate status options
  const statuses = [...new Set(cleanWorlds.map(w => w['STATUS']).filter(Boolean))].sort();
  statuses.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s; opt.textContent = s;
    statusSel.appendChild(opt);
  });

  function apply() {
    const q = search.value.toLowerCase();
    const s = statusSel.value;
    const filtered = cleanWorlds.filter(w =>
      (!q || (w['WORLD'] || '').toLowerCase().includes(q)) &&
      (!s || w['STATUS'] === s)
    );
    renderWorlds(filtered);
  }

  search.addEventListener('input', apply);
  statusSel.addEventListener('change', apply);
}

// ── WORLD DETAIL VIEW ─────────────────────────────────────

function openWorldDetail(worldName) {
  const worlds     = getCleanWorlds();
  const worldData  = worlds.find(w => normalise(w['WORLD']) === normalise(worldName));
  const lots       = getLotsForWorld(worldName);

  // Switch views
  document.getElementById('view-worlds').style.display       = 'none';
  document.getElementById('view-world-detail').style.display = 'block';

  // Header
  document.getElementById('breadcrumb-world-name').textContent = worldName;
  document.getElementById('world-detail-name').innerHTML = `<em>${worldName}</em>`;

  // Icon
  const icon = document.getElementById('world-detail-icon');
  icon.src = `images/worlds/icons/${worldName} Icon.png`;
  icon.style.display = 'block';
  icon.onerror = () => { icon.style.display = 'none'; };

  // Status
  if (worldData) {
    document.getElementById('world-detail-status').innerHTML =
      getStatusTag(worldData['STATUS'] || '');
  }

  // Description
  document.getElementById('world-detail-desc').textContent =
    (worldData && worldData['DESCRIPTION']) ? worldData['DESCRIPTION'] : 'No description yet.';

  // Scenery gallery
  const gallery = document.getElementById('world-scenery-gallery');
  const sceneryImgs = [1, 2, 3, 4].map(i => {
    const src = `images/worlds/scenery/${worldName} Situation ${i}.png`;
    return `<img src="${src}" alt="" onerror="this.style.display='none'" />`;
  }).join('');
  gallery.innerHTML = sceneryImgs;

  // Lots
  renderWorldLots(lots, worldName);
}

function renderWorldLots(lots, worldName) {
  const grid  = document.getElementById('world-lots-grid');
  const count = document.getElementById('world-lots-count');

  // Populate type and status filters
  const typeSel   = document.getElementById('filter-world-lot-type');
  const statusSel = document.getElementById('filter-world-lot-status');

  // Reset filter options
  typeSel.innerHTML   = '<option value="">All types</option>';
  statusSel.innerHTML = '<option value="">All statuses</option>';

  const types    = [...new Set(lots.map(l => l['LOT TYPE']).filter(Boolean))].sort();
  const statuses = [...new Set(lots.map(l => l['STATUS']).filter(Boolean))].sort();

  types.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t; opt.textContent = t;
    typeSel.appendChild(opt);
  });
  statuses.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s; opt.textContent = s;
    statusSel.appendChild(opt);
  });

  function display(data) {
    count.textContent = `${data.length} lot${data.length !== 1 ? 's' : ''} in ${worldName}`;

    if (!data.length) {
      grid.innerHTML = '<div class="no-results">No lots found.</div>';
      return;
    }

    grid.innerHTML = data.map(l => {
      const name     = l['LOT NEW NAME'] || l['LOT ORIGINAL NAME'] || 'Unnamed Lot';
      const type     = l['LOT TYPE']     || '—';
      const price    = l['PRICE']        || '—';
      const status   = l['STATUS']       || '';
      const slug     = slugify(name);
      const imgSrc   = `images/lots/${slugify(worldName)}/${slug}/main.png`;

      return `
        <div class="lot-card" onclick="window.location='lots/${slug}.html'">
          <img class="lot-card-img" src="${imgSrc}" alt="${name}"
            onerror="this.outerHTML='<div class=\\'lot-card-img-placeholder\\'>No image yet</div>'" />
          <div class="lot-card-body">
            <div class="lot-card-name">${name}</div>
            <div class="lot-card-type">${type}</div>
            <div class="lot-card-meta">
              <span class="lot-card-price">${price}</span>
              ${getLotStatusTag(status)}
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  display(lots);

  // Lot filters
  const searchInput = document.getElementById('search-world-lots');
  searchInput.value = '';

  function applyLotFilters() {
    const q = searchInput.value.toLowerCase();
    const t = typeSel.value;
    const s = statusSel.value;
    const filtered = lots.filter(l => {
      const name = (l['LOT NEW NAME'] || l['LOT ORIGINAL NAME'] || '').toLowerCase();
      return (
        (!q || name.includes(q)) &&
        (!t || l['LOT TYPE'] === t) &&
        (!s || l['STATUS']   === s)
      );
    });
    display(filtered);
  }

  [searchInput, typeSel, statusSel].forEach(el => {
    el.addEventListener('input',  applyLotFilters);
    el.addEventListener('change', applyLotFilters);
  });
}

function setupBreadcrumb() {
  document.getElementById('breadcrumb-worlds').addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('view-world-detail').style.display = 'none';
    document.getElementById('view-worlds').style.display       = 'block';
  });
}