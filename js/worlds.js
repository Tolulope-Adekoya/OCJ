// worlds.js — Worlds grid page: search + status filtering

const STATUS_CLASS_MAP = {
  'Active': 'status-active',
  'Almost Complete': 'status-almost',
  'Complete': 'status-complete',
  'Not Started': 'status-not-started',
  'Started': 'status-started',
  'Planned': 'status-planned',
};

let ALL_WORLDS = [];
let ALL_STATUSES = [];

document.addEventListener('DOMContentLoaded', async () => {
  // Load worlds and status lookup data
  const [worldsData, statusesData] = await Promise.all([
    window.CSV.loadCSV('data/worlds.csv'),
    window.CSV.loadCSV('data/lookups/dropdown/status_worlds.csv'),
  ]);

  ALL_WORLDS = worldsData.filter(
    w => w['WORLD'] && w['WORLD'].trim() && !['Row Labels', 'Grand Total'].includes(w['WORLD'].trim())
  );

  ALL_STATUSES = statusesData.map(s => s.status).filter(Boolean);

  // Populate status filter dropdown
  populateStatusFilter();

  // Initial render
  renderCount(ALL_WORLDS.length);
  renderGrid(ALL_WORLDS);

  // Setup event listeners
  setupSearch();
  setupStatusFilter();
});

function populateStatusFilter() {
  const select = document.getElementById('statusFilter');
  if (!select) return;

  ALL_STATUSES.forEach(status => {
    const option = document.createElement('option');
    option.value = status;
    option.textContent = status;
    select.appendChild(option);
  });
}

function setupSearch() {
  const input = document.getElementById('worldSearch');
  if (!input) return;

  input.addEventListener('input', window.Utils.debounce(() => {
    applyFilters();
  }, 150));
}

function setupStatusFilter() {
  const select = document.getElementById('statusFilter');
  if (!select) return;

  select.addEventListener('change', () => {
    applyFilters();
  });
}

function applyFilters() {
  const searchQuery = (document.getElementById('worldSearch')?.value || '').trim().toLowerCase();
  const statusFilter = (document.getElementById('statusFilter')?.value || '').trim();

  let filtered = ALL_WORLDS;

  // Filter by search query
  if (searchQuery) {
    filtered = filtered.filter(w =>
      w['WORLD'].toLowerCase().includes(searchQuery)
    );
  }

  // Filter by status
  if (statusFilter) {
    filtered = filtered.filter(w =>
      (w['STATUS'] || '').trim() === statusFilter
    );
  }

  renderCount(filtered.length);
  renderGrid(filtered);
}

function renderCount(n) {
  const el = document.getElementById('worldCount');
  if (!el) return;

  const total = ALL_WORLDS.length;
  if (n === total) {
    el.textContent = `${total} worlds, each with its own lore, lots, and inhabitants.`;
  } else {
    el.textContent = `Showing ${n} of ${total} worlds`;
  }
}

function renderGrid(data) {
  const grid = document.getElementById('worldGrid');
  if (!grid) return;

  if (!data.length) {
    grid.innerHTML = '<div class="empty-state">No worlds match your search criteria.</div>';
    return;
  }

  grid.innerHTML = data.map(w => worldCardHTML(w)).join('');
  // Attach JS-based fallback handlers to newly rendered images
  enhanceImageFallbacks();
}

function worldCardHTML(w) {
  const name = w['WORLD'];
  const status = (w['STATUS'] || '').trim();
  const statusClass = STATUS_CLASS_MAP[status] || 'status-not-started';
  const desc = (w['DESCRIPTION'] || '').trim();
  const worldId = (w['WORLD ID'] || window.Utils.slugify(name)).trim();
  const initials = window.Utils.getInitials(name);
  const imageUrl = window.Utils.worldIconPath(worldId, name);

  return `
    <a href="world.html?id=${encodeURIComponent(worldId)}" class="world-card">
      <div class="world-card-img">
        <div class="world-card-img-circle">
          <img src="${imageUrl}" alt="${window.Utils.escapeHTML(name)}" data-initials="${initials}">
        </div>
        ${status ? `<div class="world-card-status ${statusClass}" title="${window.Utils.escapeHTML(status)}"></div>` : ''}
      </div>
      <div class="world-card-body">
        <h3 class="world-card-name">${window.Utils.escapeHTML(name)}</h3>
        ${desc ? `<p class="world-card-desc">${window.Utils.escapeHTML(desc)}</p>` : ''}
      </div>
    </a>
  `;
}

function enhanceImageFallbacks() {
  const imgs = document.querySelectorAll('.world-card-img-circle img');
  imgs.forEach(img => {
    if (!img.dataset.initials) img.dataset.initials = window.Utils.getInitials(img.alt || '');
    const primaryBase = img.src.replace(/\.[^/.]+$/, '');
    const defaultBase = window.Utils.defaultEntityImagePath('worlds', 'icon');
    const fallbacks = window.Utils.imageFallbackSources(primaryBase, defaultBase);
    window.Utils.imgWithFallback(img, fallbacks);
  });
}

// Note: fallback handlers are invoked after each render via renderGrid()
