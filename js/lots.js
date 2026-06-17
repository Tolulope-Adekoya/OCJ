// lots.js

let ALL_LOTS = [];
let LOT_CARDS = [];
let FILTERED_CARDS = [];

const FILTER_STATE = {
  world: '',
  type: '',
  status: '',
  owner: '',
  search: ''
};

let currentSort = 'az';

function getLotId(lot) {
  return ((lot['LOT ID'] || lot['LOT_ID'] || lot['ID'] || '') || '').trim();
}

function getParentLotId(lot) {
  return ((lot['PARENT LOT ID'] || lot['PARENT_LOT_ID'] || '') || '').trim();
}

function getLotName(lot) {
  return ((lot['LOT NEW NAME'] || lot['LOT ORIGINAL NAME'] || lot['NAME'] || '') || '').trim();
}

function isLotComplex(lot) {
  const type = ((lot['LOT TYPE'] || '') || '').toLowerCase();
  // Only treat as a multi-unit building when explicitly marked as 'apartment' or 'residential rental'
  return /\b(apartment|residential rental)\b/.test(type);
}

async function initLotsPage() {
  try {
    const { lots } = await window.CSV.loadCSVs({ lots: 'data/lots.csv' });
    ALL_LOTS = lots.filter(lot => getLotName(lot));
    buildLotCards();
    await populateFilters();
    bindEvents();
    applyFilters();
  } catch (err) {
    console.error('[lots.js]', err);
  }
}

const LOTS_PAGE_ROOT = document.getElementById('lotGrid');
if (LOTS_PAGE_ROOT) {
  document.addEventListener('DOMContentLoaded', initLotsPage);
}

function buildLotCards() {
  const childUnits = new Map();
  const rootLots = new Map();

  ALL_LOTS.forEach(lot => {
    const id = getLotId(lot);
    const parentId = getParentLotId(lot);
    if (parentId) {
      const list = childUnits.get(parentId) || [];
      list.push(lot);
      childUnits.set(parentId, list);
    } else {
      rootLots.set(id, lot);
    }
  });

  LOT_CARDS = [];

  rootLots.forEach((rootLot, rootId) => {
    const units = childUnits.get(rootId) || [];
    units.sort((a, b) => getLotName(a).localeCompare(getLotName(b)));
    LOT_CARDS.push({ rootLot, units });
  });

  childUnits.forEach((units, parentId) => {
    if (rootLots.has(parentId)) return;
    const rootLot = units[0];
    units.sort((a, b) => getLotName(a).localeCompare(getLotName(b)));
    LOT_CARDS.push({ rootLot, units });
  });
}

function attachLotImageFallbacks() {
  document.querySelectorAll('.lot-preview img[data-lot-id]').forEach(img => {
    const lotId = img.dataset.lotId;
    const primaryBase = `image/lots/${window.Utils.sanitizeFolderName(lotId)}/portrait`;
    const defaultBase = window.Utils.defaultEntityImagePath('lots', 'profile');
    const fallbacks = window.Utils.imageFallbackSources(primaryBase, defaultBase);
    window.Utils.imgWithFallback(img, fallbacks);
  });

  document.querySelectorAll('.unit-thumb img[data-lot-id]').forEach(img => {
    const lotId = img.dataset.lotId;
    const primaryBase = `image/lots/${window.Utils.sanitizeFolderName(lotId)}/portrait`;
    const defaultBase = window.Utils.defaultEntityImagePath('lots', 'profile');
    const fallbacks = window.Utils.imageFallbackSources(primaryBase, defaultBase);
    window.Utils.imgWithFallback(img, fallbacks);
  });
}

async function populateFilters() {
  populateSelect('worldFilter', window.Utils.uniqueSorted(ALL_LOTS, 'WORLD'));
  populateSelect('lotTypeFilter', await loadLookup('data/lookups/dropdown/lot_types.csv'));
  populateSelect('statusFilter', await loadLookup('data/lookups/dropdown/status.csv'));
  populateSelect('ownerFilter', window.Utils.uniqueSorted(ALL_LOTS, 'LOT OWNER'));
}

async function loadLookup(path) {
  const rows = await window.CSV.loadCSV(path);
  return rows
    .map(row => Object.values(row)[0])
    .filter(Boolean)
    .sort();
}

function populateSelect(id, values) {
  const select = document.getElementById(id);
  if (!select || !values?.length) return;
  values.forEach(value => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
  });
}

function bindEvents() {
  document.getElementById('lotSearch')?.addEventListener('input', applyFilters);
  document.getElementById('worldFilter')?.addEventListener('change', event => { FILTER_STATE.world = event.target.value; applyFilters(); });
  document.getElementById('lotTypeFilter')?.addEventListener('change', event => { FILTER_STATE.type = event.target.value; applyFilters(); });
  document.getElementById('statusFilter')?.addEventListener('change', event => { FILTER_STATE.status = event.target.value; applyFilters(); });
  document.getElementById('ownerFilter')?.addEventListener('change', event => { FILTER_STATE.owner = event.target.value; applyFilters(); });
  document.getElementById('sortSelect')?.addEventListener('change', event => { currentSort = event.target.value; applyFilters(); });
  document.getElementById('clearFilters')?.addEventListener('click', clearFilters);

  const toggle = document.getElementById('filterToggle');
  const panel = document.getElementById('filterPanel');
  const closeBtn = document.getElementById('closeFilterPanel');

  const setPanelState = (open) => {
    if (!panel || !toggle) return;
    panel.classList.toggle('open', open);
    toggle.classList.toggle('active', open);
    toggle.setAttribute('aria-expanded', String(open));
    panel.setAttribute('aria-hidden', String(!open));
  };

  toggle?.addEventListener('click', () => setPanelState(!panel?.classList.contains('open')));
  if (closeBtn) closeBtn.addEventListener('click', () => setPanelState(false));
}

function clearFilters() {
  const searchInput = document.getElementById('lotSearch');
  if (searchInput) searchInput.value = '';
  const worldFilter = document.getElementById('worldFilter');
  if (worldFilter) worldFilter.value = '';
  const typeFilter = document.getElementById('lotTypeFilter');
  if (typeFilter) typeFilter.value = '';
  const statusFilter = document.getElementById('statusFilter');
  if (statusFilter) statusFilter.value = '';
  const ownerFilter = document.getElementById('ownerFilter');
  if (ownerFilter) ownerFilter.value = '';
  const sortSelect = document.getElementById('sortSelect');
  if (sortSelect) sortSelect.value = 'az';

  FILTER_STATE.world = '';
  FILTER_STATE.type = '';
  FILTER_STATE.status = '';
  FILTER_STATE.owner = '';
  FILTER_STATE.search = '';
  currentSort = 'az';
  applyFilters();
}

function applyFilters() {
  FILTER_STATE.search = document.getElementById('lotSearch')?.value.trim().toLowerCase() || '';

  FILTERED_CARDS = LOT_CARDS.filter(card => {
    const lot = card.rootLot;
    const name = getLotName(lot).toLowerCase();
    const world = ((lot['WORLD'] || '') || '').trim();
    const type = ((lot['LOT TYPE'] || '') || '').trim();
    const status = ((lot['STATUS'] || '') || '').trim();
    const owner = ((lot['LOT OWNER'] || lot['OWNER'] || '') || '').trim();

    const search = FILTER_STATE.search;
    const terms = [
      name,
      (lot['LOT ORIGINAL NAME'] || '').toLowerCase(),
      world.toLowerCase(),
      type.toLowerCase(),
      owner.toLowerCase(),
      ...card.units.map(unit => getLotName(unit).toLowerCase())
    ];
    const searchMatch = !search || terms.some(term => term.includes(search));
    const worldMatch = !FILTER_STATE.world || world === FILTER_STATE.world;
    const typeMatch = !FILTER_STATE.type || type === FILTER_STATE.type;
    const statusMatch = !FILTER_STATE.status || status === FILTER_STATE.status;
    const ownerMatch = !FILTER_STATE.owner || owner === FILTER_STATE.owner;

    return searchMatch && worldMatch && typeMatch && statusMatch && ownerMatch;
  });

  sortCards();
  renderLots();
  attachLotImageFallbacks();
  renderActiveFilters();
  updateCount();
}

function renderActiveFilters() {
  const container = document.getElementById('activeFilters');
  if (!container) return;
  const chips = [];
  if (FILTER_STATE.search) chips.push({ key: 'search', label: `Search: ${FILTER_STATE.search}` });
  if (FILTER_STATE.world) chips.push({ key: 'world', label: `World: ${FILTER_STATE.world}` });
  if (FILTER_STATE.type) chips.push({ key: 'type', label: `Type: ${FILTER_STATE.type}` });
  if (FILTER_STATE.owner) chips.push({ key: 'owner', label: `Owner: ${FILTER_STATE.owner}` });
  if (FILTER_STATE.status) chips.push({ key: 'status', label: `Status: ${FILTER_STATE.status}` });
  container.innerHTML = chips.map(chip => `
    <span class="active-filter-chip" data-key="${window.Utils.escapeHTML(chip.key)}">
      ${window.Utils.escapeHTML(chip.label)}
      <button type="button" aria-label="Remove filter ${window.Utils.escapeHTML(chip.label)}">×</button>
    </span>
  `).join('');

  container.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      const chip = btn.closest('.active-filter-chip');
      if (!chip) return;
      const key = chip.dataset.key;
      if (key === 'search') {
        const el = document.getElementById('lotSearch'); if (el) el.value = '';
        FILTER_STATE.search = '';
      } else if (key === 'world') {
        const el = document.getElementById('worldFilter'); if (el) el.value = '';
        FILTER_STATE.world = '';
      } else if (key === 'type') {
        const el = document.getElementById('lotTypeFilter'); if (el) el.value = '';
        FILTER_STATE.type = '';
      } else if (key === 'status') {
        const el = document.getElementById('statusFilter'); if (el) el.value = '';
        FILTER_STATE.status = '';
      } else if (key === 'owner') {
        const el = document.getElementById('ownerFilter'); if (el) el.value = '';
        FILTER_STATE.owner = '';
      }
      applyFilters();
    });
  });
}

function sortCards() {
  FILTERED_CARDS.sort((a, b) => {
    const aLot = a.rootLot;
    const bLot = b.rootLot;
    switch (currentSort) {
      case 'za':
        return getLotName(bLot).localeCompare(getLotName(aLot));
      case 'world':
        return ((aLot['WORLD'] || '') || '').localeCompare((bLot['WORLD'] || '') || '');
      case 'status':
        return ((aLot['STATUS'] || '') || '').localeCompare((bLot['STATUS'] || '') || '');
      case 'type':
        return ((aLot['LOT TYPE'] || '') || '').localeCompare((bLot['LOT TYPE'] || '') || '');
      default:
        return getLotName(aLot).localeCompare(getLotName(bLot));
    }
  });
}

function renderLots() {
  const grid = document.getElementById('lotGrid');
  const empty = document.getElementById('emptyState');
  if (!grid) return;

  if (!FILTERED_CARDS.length) {
    grid.innerHTML = '';
    if (empty) empty.style.display = 'block';
    return;
  }

  if (empty) empty.style.display = 'none';
  grid.innerHTML = FILTERED_CARDS.map(renderLotCard).join('');
}

function renderLotCard(card) {
  const lot = card.rootLot;
  const id = getLotId(lot);
  const name = getLotName(lot);
  const world = ((lot['WORLD'] || '') || '').trim();
  const type = ((lot['LOT TYPE'] || '') || '').trim();
  const priceRaw = (lot['PRICE'] || lot['Price'] || '').toString().trim();
  const price = window.Utils.normalizeCurrency(priceRaw.replace(/\uFFFD/g, ''));
  const owner = ((lot['LOT OWNER'] || lot['OWNER'] || '') || '').trim();
  const units = card.units || [];
  const isBuilding = isLotComplex(lot);
  const imageSrc = window.Utils.lotImagePath(id, 0);

  const allUnits = isBuilding ? [lot, ...units] : [];
  const unitEntries = allUnits.map(unit => {
    const unitId = getLotId(unit);
    const unitName = getLotName(unit);
    return `
      <a href="lot.html?id=${encodeURIComponent(unitId)}" class="unit-link" title="${window.Utils.escapeHTML(unitName)}">
        ${window.Utils.escapeHTML(unitName)}
      </a>
    `;
  }).join('');

  return `
    <article class="lot-card ${isBuilding ? 'lot-card-building' : ''}">
      <div class="lot-preview">
        <a href="lot.html?id=${encodeURIComponent(id)}">
          <img src="${window.Utils.escapeHTML(imageSrc)}" data-lot-id="${window.Utils.escapeHTML(id)}" alt="${window.Utils.escapeHTML(name)}" loading="lazy" />
        </a>
      </div>
      <div class="lot-content">
        <div class="lot-header-row">
          <div>
            <a class="lot-link-title" href="lot.html?id=${encodeURIComponent(id)}">
              <div class="lot-name">${window.Utils.escapeHTML(name)}</div>
            </a>
            <div class="lot-meta">${window.Utils.escapeHTML(world)}</div>
          </div>
          ${owner ? `<div class="lot-owner">${window.Utils.escapeHTML(owner)}</div>` : ''}
        </div>
        <div class="lot-meta">${window.Utils.escapeHTML(type)}</div>
        ${price ? `<div class="lot-price">${window.Utils.escapeHTML(price)}</div>` : ''}
        ${isBuilding ? `
          <div class="building-unit-summary">${allUnits.length} unit${allUnits.length === 1 ? '' : 's'}</div>
          <div class="unit-list">${unitEntries}</div>
        ` : ''}
      </div>
    </article>
  `;
}

function updateCount() {
  const el = document.getElementById('lotCount');
  if (!el) return;
  el.textContent = `${FILTERED_CARDS.length} ${FILTERED_CARDS.length === 1 ? 'Property' : 'Properties'}`;
}
