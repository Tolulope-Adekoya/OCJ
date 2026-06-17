// sims.js — Sims grid page: search, multi-field filters, card rendering
// Updated: 2026-06-15 02:50:00 - Fixed SIM ID links

const TEXT_SEARCH_FIELDS_CSV = 'data/lookups/attribute_text_search.csv';

const DROPDOWN_FILTERS = [
  { key: 'AGE GROUP', label: 'Age Group', csvPath: null },
  { key: 'GENDER', label: 'Gender', csvPath: 'data/lookups/dropdown/gender.csv' },
  { key: 'OCCULT', label: 'Occult', csvPath: 'data/lookups/dropdown/occults.csv' },
  { key: 'OCCULT GROUP', label: 'Occult Group', csvPath: 'data/lookups/dropdown/occult_groups.csv' },
  { key: 'ETHNICITY', label: 'Ethnicity', csvPath: 'data/lookups/dropdown/ethnicity.csv' },
  { key: 'WORLD', label: 'World', csvPath: null },
  { key: 'PLAYABLE SIM', label: 'Playable Sim', csvPath: 'data/lookups/dropdown/playable_sim.csv' },
  { key: 'STATUS', label: 'Status', csvPath: 'data/lookups/dropdown/status.csv' },
  { key: 'ALIGNMENT', label: 'Alignment', csvPath: 'data/lookups/dropdown/alignment.csv' },
  { key: 'DOS', label: 'Dos', csvPath: 'data/lookups/dropdown/dos.csv' },
  { key: 'FAITH', label: 'Faith', csvPath: 'data/lookups/dropdown/faiths.csv' },
  { key: 'FAME LEVEL', label: 'Fame Level', csvPath: 'data/lookups/dropdown/fame_level.csv' },
  { key: 'FORM LEVEL', label: 'Form Level', csvPath: 'data/lookups/dropdown/form_level.csv' },
  { key: 'ORIENTATION', label: 'Orientation', csvPath: 'data/lookups/dropdown/orientation.csv' },
  { key: 'POLITICAL ALIGNMENT', label: 'Political Alignment', csvPath: 'data/lookups/dropdown/political_alignments.csv' },
  { key: 'POWER SOURCE', label: 'Power Source', csvPath: 'data/lookups/dropdown/power_sources.csv' },
  { key: 'PRESTIGE RANK', label: 'Prestige Rank', csvPath: 'data/lookups/dropdown/prestige_rank.csv' },
  { key: 'ADDICTION', label: 'Addiction', csvPath: 'data/lookups/dropdown/addiction.csv' },
  { key: 'SUGAR', label: 'Sugar', csvPath: 'data/lookups/dropdown/sugar.csv' },
  { key: 'WEALTH CLASS', label: 'Wealth Class', csvPath: 'data/lookups/dropdown/wealth_class.csv' },
];

const CHECKBOX_FILTERS = [
  { key: 'FAMILY STATUS', label: 'Family Status', csvPath: 'data/lookups/family_status.csv' },
  { key: 'CLUB', label: 'Clubs', csvPath: 'data/lookups/checkbox/clubs.csv' },
  { key: 'LANGUAGE SPOKEN', label: 'Languages', csvPath: 'data/lookups/checkbox/languages.csv' },
  { key: 'PET', label: 'Pets', csvPath: 'data/lookups/checkbox/pet.csv' },
];

let ALL_SIMS = [];
let SEARCH_FIELDS = [];
let JOB_CATEGORIES = [];
let TRAIT_CATEGORIES = [];
let JOB_VALUES_BY_CATEGORY = {};
let TRAIT_VALUES_BY_CATEGORY = {};
let activeFilters = {};
let searchTerm = '';
let currentSort = 'az';
let PET_BY_ID = {};
let PETS_BY_SIM_ID = {};
let PET_NAME_TO_ID = {};

document.addEventListener('DOMContentLoaded', async () => {
  const [{ sims }, searchFields, jobsData, traitsData, petsData] = await Promise.all([
    window.CSV.loadCSVs({ sims: 'data/sims.csv' }),
    window.CSV.loadCSV(TEXT_SEARCH_FIELDS_CSV),
    window.CSV.loadCSV('data/lookups/checkbox/jobs.csv'),
    window.CSV.loadCSV('data/lookups/checkbox/traits.csv'),
    window.CSV.loadCSV('data/pets.csv'),
  ]);

  ALL_SIMS = sims
    .filter(s => s['NAME'] && s['NAME'].trim())
    .sort((a, b) => a['NAME'].localeCompare(b['NAME']));

  SEARCH_FIELDS = extractSearchFields(searchFields);
  ({ categories: JOB_CATEGORIES, valuesByCategory: JOB_VALUES_BY_CATEGORY } = buildMultiColumnLookup(jobsData));
  ({ categories: TRAIT_CATEGORIES, valuesByCategory: TRAIT_VALUES_BY_CATEGORY } = buildMultiColumnLookup(traitsData));

  // Build pet maps from pets.csv: by-id and by-owning-sim
  if (petsData && petsData.length) {
    petsData.forEach(row => {
      const id = (row['PET_ID'] || row['Pet ID'] || '').toString().trim();
      const name = (row['NAME'] || row['Name'] || '').toString().trim();
      const simId = (row['SIM_ID'] || row['Sim ID'] || '').toString().trim();
      if (id) {
        PET_BY_ID[id] = { id, name, simId };
        if (name) PET_NAME_TO_ID[name.toLowerCase()] = id;
        if (simId) {
          const key = simId.trim();
          PETS_BY_SIM_ID[key] = PETS_BY_SIM_ID[key] || [];
          PETS_BY_SIM_ID[key].push(id);
        }
      }
    });
  }

  buildFilterPanel();
  setupSearch();
  setupFilterToggle();
  setupSortListener();
  setupResetButton();
  render();
});

/* ---------- Filter panel ---------- */
async function loadFilterOptions(csvPath) {
  if (!csvPath) return [];
  try {
    const data = await window.CSV.loadCSV(csvPath);
    return data.map(row => Object.values(row)[0]).filter(Boolean).sort();
  } catch (e) {
    console.warn(`Failed to load ${csvPath}:`, e);
    return [];
  }
}

function getUniqueValues(field) {
  const vals = new Set();
  ALL_SIMS.forEach(s => {
    const raw = s[field];
    if (raw) {
      const trimmed = raw.trim();
      if (trimmed) vals.add(trimmed);
    }
  });
  return [...vals].sort();
}

function extractSearchFields(rows) {
  if (!rows || !rows.length) return ['NAME'];
  const values = new Set();
  rows.forEach(row => {
    Object.values(row).forEach(value => {
      if (value && String(value).trim()) values.add(String(value).trim());
    });
  });
  return [...values];
}

function buildMultiColumnLookup(rows) {
  if (!rows || !rows.length) return { categories: [], valuesByCategory: {} };
  const categories = Object.keys(rows[0]).filter(Boolean);
  const valuesByCategory = {};
  categories.forEach(category => valuesByCategory[category] = new Set());

  rows.forEach(row => {
    categories.forEach(category => {
      const value = (row[category] || '').trim();
      if (value) valuesByCategory[category].add(value);
    });
  });

  return {
    categories,
    valuesByCategory: Object.fromEntries(
      categories.map(category => [
        category,
        [...valuesByCategory[category]].sort()
      ])
    )
  };
}

function renderDynamicCheckboxGroup(groupId, fieldName, options = []) {
  const group = document.getElementById(groupId);
  if (!group) return;
  if (!options.length) {
    group.innerHTML = '<p class="filter-note">Choose a category above to see options.</p>';
    return;
  }

  const selectedValues = Array.isArray(activeFilters[fieldName]?.values)
    ? activeFilters[fieldName].values
    : [];

  group.innerHTML = options.map(opt => `
    <label class="checkbox-label">
      <input type="checkbox" class="dynamic-checkbox" data-field="${fieldName}" value="${window.Utils.escapeHTML(opt)}" ${selectedValues.includes(opt) ? 'checked' : ''}>
      ${window.Utils.escapeHTML(opt)}
    </label>
  `).join('');

  group.querySelectorAll('.dynamic-checkbox').forEach(cb => {
    cb.addEventListener('change', () => {
      const field = cb.dataset.field;
      const values = Array.from(group.querySelectorAll(`.dynamic-checkbox[data-field="${field}"]:checked`))
        .map(el => el.value);
      if (values.length) activeFilters[field] = { category: activeFilters[field]?.category || '', values };
      else delete activeFilters[field];
      updateFilterBadge();
      render();
    });
  });
}

async function buildFilterPanel() {
  const grid = document.getElementById('filterGrid');
  if (!grid) return;

  let html = '';

  // Dropdown filters
  html += '<div class="filter-section"><h4>Filters</h4>';
  for (const field of DROPDOWN_FILTERS) {
    const options = field.csvPath ? await loadFilterOptions(field.csvPath) : getUniqueValues(field.key);
    if (!options.length) continue;

    html += `
      <div class="filter-group">
        <label class="filter-label">${field.label}</label>
        <select class="filter-select dropdown-filter" data-field="${field.key}" size="6">
          <option value="">All</option>
          ${options.map(opt => `<option value="${window.Utils.escapeHTML(opt)}">${window.Utils.escapeHTML(opt)}</option>`).join('')}
        </select>
      </div>
    `;
  }
  html += '</div>';

  // Job category and values
  html += `
    <div class="filter-section">
      <h4>Jobs</h4>
      <div class="filter-group">
        <label class="filter-label">Job Category</label>
        <select id="jobCategorySelect" class="filter-select">
          <option value="">All Categories</option>
          ${JOB_CATEGORIES.map(cat => `<option value="${window.Utils.escapeHTML(cat)}">${window.Utils.escapeHTML(cat)}</option>`).join('')}
        </select>
      </div>
      <div class="filter-group">
        <label class="filter-label">Job Values</label>
        <div id="jobValueGroup" class="checkbox-group"></div>
      </div>
    </div>
  `;

  // Trait category and values
  html += `
    <div class="filter-section">
      <h4>Traits</h4>
      <div class="filter-group">
        <label class="filter-label">Trait Category</label>
        <select id="traitCategorySelect" class="filter-select">
          <option value="">All Categories</option>
          ${TRAIT_CATEGORIES.map(cat => `<option value="${window.Utils.escapeHTML(cat)}">${window.Utils.escapeHTML(cat)}</option>`).join('')}
        </select>
      </div>
      <div class="filter-group">
        <label class="filter-label">Trait Values</label>
        <div id="traitValueGroup" class="checkbox-group"></div>
      </div>
    </div>
  `;

  // Remaining checkbox filters
  html += '<div class="filter-section"><h4>Options</h4>';
  for (const field of CHECKBOX_FILTERS) {
    const options = field.csvPath ? await loadFilterOptions(field.csvPath) : getUniqueValues(field.key);
    if (!options.length) continue;

    html += `
      <div class="filter-group">
        <label class="filter-label">${field.label}</label>
        <div class="checkbox-group">
          ${options.map(opt => `
            <label class="checkbox-label">
              <input type="checkbox" class="checkbox-filter" data-field="${field.key}" value="${window.Utils.escapeHTML(opt)}">
              ${window.Utils.escapeHTML(opt)}
            </label>
          `).join('')}
        </div>
      </div>
    `;
  }
  html += '</div>';

  grid.innerHTML = html;

  grid.querySelectorAll('.dropdown-filter').forEach(sel => {
    sel.addEventListener('change', () => {
      const field = sel.dataset.field;
      if (sel.value) activeFilters[field] = sel.value;
      else delete activeFilters[field];
      updateFilterBadge();
      render();
    });
  });

  grid.querySelectorAll('.checkbox-filter').forEach(cb => {
    cb.addEventListener('change', () => {
      const field = cb.dataset.field;
      const checked = Array.from(grid.querySelectorAll(`.checkbox-filter[data-field="${field}"]:checked`))
        .map(c => c.value);
      if (checked.length) activeFilters[field] = checked;
      else delete activeFilters[field];
      updateFilterBadge();
      render();
    });
  });

  const jobCategorySelect = document.getElementById('jobCategorySelect');
  const traitCategorySelect = document.getElementById('traitCategorySelect');

  if (jobCategorySelect) {
    jobCategorySelect.addEventListener('change', () => {
      if (!jobCategorySelect.value) {
        delete activeFilters['JOBS'];
        delete activeFilters['JOBS_CATEGORY'];
        renderDynamicCheckboxGroup('jobValueGroup', 'JOBS', []);
      } else {
        activeFilters['JOBS_CATEGORY'] = jobCategorySelect.value;
        delete activeFilters['JOBS'];
        renderDynamicCheckboxGroup('jobValueGroup', 'JOBS', JOB_VALUES_BY_CATEGORY[jobCategorySelect.value] || []);
      }
      updateFilterBadge();
      render();
    });
  }

  if (traitCategorySelect) {
    traitCategorySelect.addEventListener('change', () => {
      if (!traitCategorySelect.value) {
        delete activeFilters['TRAITS'];
        delete activeFilters['TRAITS_CATEGORY'];
        renderDynamicCheckboxGroup('traitValueGroup', 'TRAITS', []);
      } else {
        activeFilters['TRAITS_CATEGORY'] = traitCategorySelect.value;
        delete activeFilters['TRAITS'];
        renderDynamicCheckboxGroup('traitValueGroup', 'TRAITS', TRAIT_VALUES_BY_CATEGORY[traitCategorySelect.value] || []);
      }
      updateFilterBadge();
      render();
    });
  }
}

function updateFilterBadge() {
  const badge = document.getElementById('filterBadge');
  const toggle = document.getElementById('filterToggle');
  const count = Object.keys(activeFilters).length;
  if (badge) {
    badge.textContent = count;
    badge.style.display = count > 0 ? 'inline-flex' : 'none';
  }
  if (toggle) toggle.classList.toggle('has-filters', count > 0);
}

function setupFilterToggle() {
  const toggle = document.getElementById('filterToggle');
  const panel = document.getElementById('filterPanel');
  if (!toggle || !panel) return;

  const setPanelState = (open) => {
    panel.classList.toggle('open', open);
    toggle.classList.toggle('active', open);
    toggle.setAttribute('aria-expanded', String(open));
    panel.setAttribute('aria-hidden', String(!open));
  };

  toggle.addEventListener('click', () => setPanelState(!panel.classList.contains('open')));

  const closeBtn = document.getElementById('closeFilterPanel');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => setPanelState(false));
  }
}

function setupSortListener() {
  const sortSelect = document.getElementById('sortSelect');
  if (!sortSelect) return;
  sortSelect.addEventListener('change', (e) => {
    currentSort = e.target.value;
    render();
  });
}

function setupResetButton() {
  const resetBtn = document.getElementById('resetFilters');
  const clearAllBtn = document.getElementById('clearFilters');
  const resetHandler = () => {
    activeFilters = {};
    currentSort = 'az';
    searchTerm = '';

    const grid = document.getElementById('filterGrid');
    if (grid) {
      grid.querySelectorAll('.dropdown-filter').forEach(sel => { sel.value = ''; });
      grid.querySelectorAll('.checkbox-filter').forEach(cb => { cb.checked = false; });
      grid.querySelectorAll('.dynamic-checkbox').forEach(cb => { cb.checked = false; });
    }

    const jobSelect = document.getElementById('jobCategorySelect');
    if (jobSelect) jobSelect.value = '';
    const traitSelect = document.getElementById('traitCategorySelect');
    if (traitSelect) traitSelect.value = '';

    renderDynamicCheckboxGroup('jobValueGroup', 'JOBS', []);
    renderDynamicCheckboxGroup('traitValueGroup', 'TRAITS', []);

    const searchInput = document.getElementById('searchInput');
    if (searchInput) searchInput.value = '';

    const sortSelect = document.getElementById('sortSelect');
    if (sortSelect) sortSelect.value = 'az';

    updateFilterBadge();
    render();
  };

  if (resetBtn) resetBtn.addEventListener('click', resetHandler);
  if (clearAllBtn) clearAllBtn.addEventListener('click', resetHandler);
}

/* ---------- Search ---------- */
function setupSearch() {
  const input = document.getElementById('searchInput');
  if (!input) return;

  let datalist = document.getElementById('searchSuggestions');
  if (!datalist) {
    datalist = document.createElement('datalist');
    datalist.id = 'searchSuggestions';
    document.body.appendChild(datalist);
  }

  if (SEARCH_FIELDS.length) {
    datalist.innerHTML = SEARCH_FIELDS.map(item => `<option value="${window.Utils.escapeHTML(item)}">`).join('');
    input.setAttribute('list', 'searchSuggestions');
  }

  input.addEventListener('input', window.Utils.debounce(() => {
    searchTerm = input.value.trim().toLowerCase();
    render();
  }, 150));
}

/* ---------- Filtering + Sorting + Render ---------- */
function getFiltered() {
  return ALL_SIMS.filter(sim => {
    // Search across all text values
    if (searchTerm) {
      const searchMatch = Object.values(sim).some(value => {
        if (!value) return false;
        return String(value).toLowerCase().includes(searchTerm);
      });
      if (!searchMatch) return false;
    }

    // Dropdown filters (exact match on trimmed values)
    for (const field of DROPDOWN_FILTERS) {
      const val = activeFilters[field.key];
      if (val && (sim[field.key] || '').trim() !== val) return false;
    }

    // Checkbox filters (any match)
    for (const field of CHECKBOX_FILTERS) {
      const vals = activeFilters[field.key];
      if (vals && vals.length > 0) {
        const simVal = (sim[field.key] || '').toLowerCase();
        if (!vals.some(v => simVal.includes(v.toLowerCase()))) return false;
      }
    }

    // Job filters
    if (activeFilters['JOBS']?.values?.length) {
      const simVal = (sim['JOB'] || '').toLowerCase();
      const matches = activeFilters['JOBS'].values.some(v => simVal.includes(v.toLowerCase()));
      if (!matches) return false;
    }

    // Trait filters
    if (activeFilters['TRAITS']?.values?.length) {
      const simVal = (sim['TRAITS'] || '').toLowerCase();
      const matches = activeFilters['TRAITS'].values.some(v => simVal.includes(v.toLowerCase()));
      if (!matches) return false;
    }

    return true;
  });
}

function sortSims(sims) {
  const sorted = [...sims];
  switch (currentSort) {
    case 'za':
      sorted.sort((a, b) => b['NAME'].localeCompare(a['NAME']));
      break;
    case 'age':
      sorted.sort((a, b) => {
        const ageOrder = { 'Baby': 0, 'Toddler': 1, 'Child': 2, 'Teen': 3, 'Young Adult': 4, 'Adult': 5, 'Elder': 6 };
        return (ageOrder[a['AGE GROUP']] || 99) - (ageOrder[b['AGE GROUP']] || 99);
      });
      break;
    case 'world':
      sorted.sort((a, b) => (a['WORLD'] || '').localeCompare(b['WORLD'] || ''));
      break;
    default:
      sorted.sort((a, b) => a['NAME'].localeCompare(b['NAME']));
  }
  return sorted;
}

function render() {
  const filtered = getFiltered();
  const sorted = sortSims(filtered);
  renderCount(sorted.length);
  renderGrid(sorted);
  renderFilterChips();
}

function renderFilterChips() {
  const container = document.getElementById('activeFilters');
  if (!container) return;

  const chips = [];
  if (searchTerm) {
    chips.push({ key: 'search', label: `Search: ${searchTerm}` });
  }

  Object.entries(activeFilters).forEach(([field, value]) => {
    if (field === 'JOBS' || field === 'TRAITS') {
      const label = value.values && value.values.length
        ? `${field}: ${value.category} → ${value.values.join(', ')}`
        : `${field}: ${value.category}`;
      chips.push({ key: field, label });
    } else if (field === 'JOBS_CATEGORY' || field === 'TRAITS_CATEGORY') {
      const label = `${field.replace('_', ' ')}: ${value}`;
      chips.push({ key: field, label });
    } else if (Array.isArray(value)) {
      chips.push({ key: field, label: `${field}: ${value.join(', ')}` });
    } else {
      chips.push({ key: field, label: `${field}: ${value}` });
    }
  });

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
        searchTerm = '';
        const input = document.getElementById('searchInput');
        if (input) input.value = '';
      } else if (key === 'JOBS') {
        delete activeFilters['JOBS'];
        const select = document.getElementById('jobCategorySelect');
        if (select) select.value = '';
        renderDynamicCheckboxGroup('jobValueGroup', 'JOBS', []);
      } else if (key === 'TRAITS') {
        delete activeFilters['TRAITS'];
        const select = document.getElementById('traitCategorySelect');
        if (select) select.value = '';
        renderDynamicCheckboxGroup('traitValueGroup', 'TRAITS', []);
      } else {
        delete activeFilters[key];
        const grid = document.getElementById('filterGrid');
        if (grid) {
          grid.querySelectorAll(`[data-field="${key}"]`).forEach(el => {
            if (el.tagName === 'SELECT') el.value = '';
            if (el.type === 'checkbox') el.checked = false;
          });
        }
      }

      updateFilterBadge();
      render();
    });
  });
}

function renderCount(shownCount) {
  const countEl = document.getElementById('countLabel');
  if (!countEl) return;
  if (shownCount === ALL_SIMS.length) {
    countEl.textContent = `${ALL_SIMS.length} sims`;
  } else {
    countEl.textContent = `${ALL_SIMS.length} sims · Showing ${shownCount}`;
  }
}

function renderGrid(data) {
  const grid = document.getElementById('simGrid');
  const empty = document.getElementById('emptyState');
  if (!grid) return;

  if (!data.length) {
    grid.innerHTML = '';
    if (empty) empty.style.display = 'block';
    return;
  }
  if (empty) empty.style.display = 'none';

  grid.innerHTML = data.map(sim => simCardHTML(sim)).join('');
  attachImageFallbacks();
}

function attachImageFallbacks() {
  // Sim portraits
  document.querySelectorAll('.sim-card-portrait img[data-sim-id]').forEach(img => {
    const simId = img.dataset.simId;
    const initials = img.dataset.initials || '';
    const primaryBase = `image/sims/${window.Utils.sanitizeFolderName(simId)}/portrait`;
    const defaultBase = window.Utils.defaultEntityImagePath('sims', 'profile');
    const fallbacks = window.Utils.imageFallbackSources(primaryBase, defaultBase);
    img.dataset.initials = initials;
    window.Utils.imgWithFallback(img, fallbacks);
  });

  // Pet thumbnails
  document.querySelectorAll('.pet-thumb img[data-pet-id]').forEach(img => {
    const petId = img.dataset.petId;
    const initials = img.dataset.initials || '';
    const primaryBase = `image/pets/${window.Utils.sanitizeFolderName(petId)}/portrait`;
    const defaultBase = window.Utils.defaultEntityImagePath('pets', 'profile');
    const fallbacks = window.Utils.imageFallbackSources(primaryBase, defaultBase);
    img.dataset.initials = initials;
    window.Utils.imgWithFallback(img, fallbacks);
  });
}

function simCardHTML(sim) {
  const name = sim['NAME'];
  const gender = sim['GENDER'] || '—';
  const age = sim['AGE GROUP'] || '—';
  const initials = window.Utils.getInitials(name);
  const slug = window.Utils.slugify(name);
  // Determine pet IDs for this sim using pets.csv SIM_ID mapping first
  const simId = (sim['SIM_ID'] || sim['Sim ID'] || sim['SIMID'] || '').toString().trim();
  let petIds = [];
  if (simId) {
    petIds = PETS_BY_SIM_ID[simId] || [];
  }

  // If no pet IDs from pets.csv, fall back to parsing the sim 'PET' column and mapping by name
  if (!petIds.length) {
    const petStr = (sim['PET'] || '').trim();
    const petNames = petStr ? petStr.split(',').map(p => p.trim()).filter(Boolean) : [];
    petIds = petNames.map(name => PET_NAME_TO_ID[name.toLowerCase()]).filter(Boolean);
  }

  let petBadges = '';
  if (petIds.length) {
    const displayPets = petIds.slice(0, 3);
    const petHTML = displayPets.map(petId => {
      const petRec = PET_BY_ID[petId] || { id: petId, name: petId };
      const petName = petRec.name || petRec.id || '';
      const initialsPet = window.Utils.getInitials(petName).slice(0,2).toUpperCase();
      const src = `image/pets/${window.Utils.sanitizeFolderName(petId)}/portrait.png`;
      return `
        <div class="pet-thumb" title="${window.Utils.escapeHTML(petName)}">
          <img src="${window.Utils.escapeHTML(src)}" data-pet-id="${window.Utils.escapeHTML(petId)}" data-initials="${window.Utils.escapeHTML(initialsPet)}" alt="${window.Utils.escapeHTML(petName)}" loading="lazy" />
        </div>
      `;
    }).join('');
    const morePets = petIds.length > 3 ? `<span class="pet-more">+${petIds.length - 3}</span>` : '';
    petBadges = `<div class="sim-card-pets">${petHTML}${morePets}</div>`;
  }

  // Sim portrait: prefer image by SIM_ID folder, fallback to initials placeholder
  const portraitSrc = simId ? window.Utils.simImagePath(simId, 0) : null;

  const portraitHTML = portraitSrc ? `
    <img src="${window.Utils.escapeHTML(portraitSrc)}" data-sim-id="${window.Utils.escapeHTML(simId)}" data-initials="${window.Utils.escapeHTML(initials)}" alt="${window.Utils.escapeHTML(name)}" loading="lazy" />
  ` : `<div class="placeholder-img">${initials}</div>`;

  return `
    <a href="sim.html?id=${encodeURIComponent(simId || slug)}" class="sim-card">
      <div class="sim-card-portrait">${portraitHTML}</div>
      <div class="sim-card-body">
        <h3 class="sim-card-name">${window.Utils.escapeHTML(name)}</h3>
        <div class="sim-card-meta">
          <span>${window.Utils.escapeHTML(gender)}</span>
          <span class="meta-sep">·</span>
          <span>${window.Utils.escapeHTML(age)}</span>
        </div>
        ${petBadges}
      </div>
    </a>
  `;
}
