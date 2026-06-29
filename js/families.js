// families.js — OCJ Save File
// Phase 4: ancestor search (filter families by sim name match)
// Phase 5: collapsed headers, expand on click, background + icon images

'use strict';

// ── State ─────────────────────────────────────────────────────────
let allFamilies      = [];   // [{id, name, members:[], chartData, el}]
let simNameIndex     = {};   // { normalisedName: [familyId, ...] }
let secretMode       = false;
let linkMode         = false;
let searchActive     = false;
let dropdownValue    = '';
let searchDebounce   = null;

// ── Image path helpers ────────────────────────────────────────────
function familyBackgroundPath(familyId) {
  return `image/families/background/${familyId}.png`;
}
function familyBackgroundDefault() {
  return `image/default/families/background.png`;
}
function familyIconPath(familyId) {
  return `image/families/icon/${familyId}.png`;
}
function familyIconDefault() {
  return `image/default/families/icon.png`;
}

// Test whether an image URL resolves (HEAD request).
// Returns a Promise<string|null> — the working URL or null.
async function probeImage(candidates) {
  for (const url of candidates) {
    try {
      const r = await fetch(url, { method: 'HEAD' });
      if (r.ok) return url;
    } catch { /* try next */ }
  }
  return null;
}

// ── Initialise ────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  const loading = document.getElementById('loadingScreen');

  try {
    // Load CSVs using the project's actual CSV API (csv.js → window.CSV.loadCSVs)
    // If the next line throws "loadCSVs is not a function", open csv.js,
    // find its exported method name, and update this call to match.
    const csvData = await window.CSV.loadCSVs({
      sims:        'data/sims.csv',
      families:    'data/families.csv',
      familyNames: 'data/lookups/family_names.csv',
      connections: 'data/lookups/connections.csv',
    });

    const simsRaw        = csvData.sims;
    const familiesRaw    = csvData.families;
    const familyNamesRaw = csvData.familyNames;
    const connectionsRaw = csvData.connections;

    // Normalise data — normalizeFamilyData.js exports window.FamilyData.buildFamilyGraphs
    const graphs = window.FamilyData.buildFamilyGraphs(
      simsRaw, familiesRaw, familyNamesRaw, connectionsRaw
    );
    const families    = graphs;   // array of family graph objects
    const connections = {};       // connStyles are resolved internally by buildFamilyGraphs

    // Build sim-name index for search
    buildSimNameIndex(families);

    // Populate family dropdown
    populateDropdown(families);

    // Render all family sections
    await renderFamilies(families, connections);

    // Wire controls
    wireControls();

  } catch (err) {
    console.error('[families.js]', err);
  } finally {
    if (loading) loading.style.display = 'none';
  }
});

// ── Build sim name index ──────────────────────────────────────────
function buildSimNameIndex(families) {
  simNameIndex = {};
  families.forEach(family => {
    (family.sims || []).forEach(sim => {
      const name = (sim.name || '').trim();
      if (!name) return;
      const key = normaliseName(name);
      if (!simNameIndex[key]) simNameIndex[key] = new Set();
      simNameIndex[key].add(family.familyId);
    });
  });
}

function normaliseName(str) {
  return str.toLowerCase().replace(/\s+/g, ' ').trim();
}

// ── Populate dropdown ─────────────────────────────────────────────
function populateDropdown(families) {
  const select = document.getElementById('familyDropdown');
  if (!select) return;

  families
    .slice()
    .sort((a, b) => (a.familyName || '').localeCompare(b.familyName || ''))
    .forEach(family => {
      const opt = document.createElement('option');
      opt.value = family.familyId;
      opt.textContent = family.familyName || family.familyId;
      select.appendChild(opt);
    });
}

// ── Render all families ───────────────────────────────────────────
async function renderFamilies(families, connections) {
  const container = document.getElementById('treesContainer');
  if (!container) return;

  container.innerHTML = '';
  allFamilies = [];

  for (const family of families) {
    const section = await buildFamilySection(family, connections);
    container.appendChild(section);
    allFamilies.push({
      id:      family.familyId,
      name:    family.familyName || family.familyId,
      members: family.sims || [],
      el:      section,
      chartMounted: false,
      chartData:    family,
    });
  }
}

// ── Build a single family section ────────────────────────────────
async function buildFamilySection(family, connections) {

  const section = document.createElement('div');
  section.className = 'family-section';
  section.dataset.familyId = family.familyId;

  // ── Header ───────────────────────────────────────────────────
  const header = document.createElement('div');
  header.className = 'family-header';
  header.setAttribute('role', 'button');
  header.setAttribute('tabindex', '0');
  header.setAttribute('aria-expanded', 'false');
  header.setAttribute('aria-controls', `tree-body-${family.familyId}`);

  // Background image
  setHeaderBackground(header, family.familyId);

  // Family icon
  const iconWrap = document.createElement('div');
  iconWrap.className = 'family-icon-wrap';
  setFamilyIcon(iconWrap, family.familyId, family.familyName);

  // Text block
  const textBlock = document.createElement('div');
  textBlock.className = 'family-header-text';

  const nameEl = document.createElement('div');
  nameEl.className = 'family-name';
  nameEl.textContent = family.familyName || family.familyId;

  const metaEl = document.createElement('div');
  metaEl.className = 'family-meta';
  metaEl.textContent = familyMetaLine(family);

  textBlock.appendChild(nameEl);
  textBlock.appendChild(metaEl);

  // Member badge
  const badge = document.createElement('span');
  badge.className = 'member-badge';
  const memberCount = (family.sims || []).length;
  badge.textContent = `${memberCount} member${memberCount === 1 ? '' : 's'}`;

  // Chevron
  const chevron = document.createElement('span');
  chevron.className = 'family-chevron';
  chevron.setAttribute('aria-hidden', 'true');
  chevron.textContent = '›';

  header.appendChild(iconWrap);
  header.appendChild(textBlock);
  header.appendChild(badge);
  header.appendChild(chevron);

  // ── Tree body (hidden by default) ────────────────────────────
  const body = document.createElement('div');
  body.className = 'family-tree-body';
  body.id = `tree-body-${family.familyId}`;

  const treeWrap = document.createElement('div');
  treeWrap.className = 'tree-svg-wrap';
  treeWrap.id = `tree-wrap-${family.familyId}`;

  body.appendChild(treeWrap);
  section.appendChild(header);
  section.appendChild(body);

  // ── Expand/collapse ──────────────────────────────────────────
  header.addEventListener('click', () => toggleExpand(section, family, connections));
  header.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggleExpand(section, family, connections);
    }
  });

  return section;
}

// ── Background image ──────────────────────────────────────────────
function setHeaderBackground(headerEl, familyId) {
  probeImage([
    familyBackgroundPath(familyId),
    familyBackgroundPath(familyId).replace('.png', '.jpg'),
    familyBackgroundPath(familyId).replace('.png', '.webp'),
    familyBackgroundDefault(),
  ]).then(url => {
    if (url) {
      headerEl.style.backgroundImage = `url('${url}')`;
    }
  });
}

// ── Family icon ───────────────────────────────────────────────────
function setFamilyIcon(wrapEl, familyId, familyName) {
  const img = document.createElement('img');
  img.alt = `${familyName || familyId} family icon`;
  img.loading = 'lazy';

  const candidates = [
    familyIconPath(familyId),
    familyIconPath(familyId).replace('.png', '.jpg'),
    familyIconPath(familyId).replace('.png', '.webp'),
    familyIconDefault(),
  ];

  // Use Utils.imgWithFallback if available, else manual chain
  if (window.Utils && window.Utils.imgWithFallback) {
    img.src = candidates[0];
    window.Utils.imgWithFallback(img, candidates.slice(1), () => {
      // All candidates failed — show initials
      showIconInitials(wrapEl, familyName);
    });
    wrapEl.appendChild(img);
  } else {
    let idx = 0;
    img.src = candidates[0];
    img.onerror = function () {
      idx++;
      if (idx < candidates.length) {
        img.src = candidates[idx];
      } else {
        img.style.display = 'none';
        showIconInitials(wrapEl, familyName);
      }
    };
    wrapEl.appendChild(img);
  }
}

function showIconInitials(wrapEl, familyName) {
  const span = document.createElement('span');
  span.className = 'family-icon-initials';
  const words = (familyName || '?').split(/[\s\-]+/).filter(Boolean);
  span.textContent = words.length > 1
    ? (words[0][0] + words[words.length - 1][0]).toUpperCase()
    : (familyName || '?')[0].toUpperCase();
  wrapEl.appendChild(span);
}

// ── Meta line ─────────────────────────────────────────────────────
function familyMetaLine(family) {
  const parts = [];
  if (family.world) parts.push(family.world);
  if (family.status) parts.push(family.status);
  return parts.join(' · ');
}

// ── Expand / collapse ─────────────────────────────────────────────
function toggleExpand(section, family, connections) {
  const isExpanded = section.classList.contains('expanded');
  const header     = section.querySelector('.family-header');
  const body       = section.querySelector('.family-tree-body');

  if (isExpanded) {
    // Collapse
    section.classList.remove('expanded');
    header.setAttribute('aria-expanded', 'false');
    body.style.maxHeight = '0';
  } else {
    // Expand
    section.classList.add('expanded');
    header.setAttribute('aria-expanded', 'true');

    // Mount chart on first expand
    const record = allFamilies.find(f => f.id === family.familyId);
    if (record && !record.chartMounted) {
      mountChart(family, connections, section);
      record.chartMounted = true;
    }

    // Set explicit maxHeight to the body's scrollHeight for smooth transition
    body.style.maxHeight = body.scrollHeight + 'px';

    // After content loads/renders, recalculate in case chart added height
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        body.style.maxHeight = body.scrollHeight + 'px';
      });
    });
  }
}

// ── Mount family-chart ────────────────────────────────────────────
function mountChart(family, connections, section) {
  const wrapEl = section.querySelector(`#tree-wrap-${family.familyId}`);
  if (!wrapEl) return;

  try {
    const chartData = buildChartData(family);

    const chart = window.f3.createChart('#' + wrapEl.id, chartData);
    chart.updateTree({ initial: true });

    applyNodeModes(section);

    const record = allFamilies.find(f => f.id === family.familyId);
    if (record) record.chart = chart;

    const body = section.querySelector('.family-tree-body');
    if (body) {
      setTimeout(() => {
        body.style.maxHeight = body.scrollHeight + 'px';
      }, 100);
    }

  } catch (err) {
    console.error(`[families.js] Chart error for family ${family.familyId}:`, err);
    wrapEl.innerHTML = `<p style="padding:1.5rem;color:var(--fg-muted);font-size:.85rem">
      Could not render tree for ${family.familyName || family.familyId}.
    </p>`;
  }
}

// Build chart data from the graph object returned by buildFamilyGraphs.
// family.sims → nodes, family.edges → relationships
function buildChartData(family) {
  const sims  = family.sims  || [];
  const edges = family.edges || [];

  // Build a spouses/partners map per sim from edges
  const spousesOf  = {};
  const childrenOf = {};
  const parentsOf  = {};

  edges.forEach(e => {
    if (isCoupleRelType(e.type)) {
      if (!spousesOf[e.from]) spousesOf[e.from] = [];
      if (!spousesOf[e.to])   spousesOf[e.to]   = [];
      if (!spousesOf[e.from].includes(e.to))   spousesOf[e.from].push(e.to);
      if (!spousesOf[e.to].includes(e.from))   spousesOf[e.to].push(e.from);
    }
    if (isParentRelType(e.type)) {
      // e.from is parent, e.to is child
      if (!childrenOf[e.from]) childrenOf[e.from] = [];
      if (!childrenOf[e.from].includes(e.to)) childrenOf[e.from].push(e.to);
      if (!parentsOf[e.to])  parentsOf[e.to]  = [];
      if (!parentsOf[e.to].includes(e.from))  parentsOf[e.to].push(e.from);
    }
  });

  return sims.map(sim => {
    const imgSrc = getSimImageSrc(sim);
    return {
      id:   sim.id,
      data: {
        'first name':  getFirstName(sim.name || ''),
        'last name':   getLastName(sim.name  || ''),
        gender:        mapGender(sim.gender  || ''),
        img:           imgSrc,
        'data-sim-id': sim.id || '',
        secret:        false,
      },
      rels: {
        spouses:  spousesOf[sim.id]  || [],
        children: childrenOf[sim.id] || [],
        parents:  parentsOf[sim.id]  || [],
      },
    };
  });
}

function isCoupleRelType(type) {
  return ['Legal Spouse','Deceased Legal Spouse','Divorced','Co-Parent','Deceased Co-Parent'].includes(type);
}

function isParentRelType(type) {
  return type === 'Parent' || type === 'Adoptive Parent';
}

function getSimImageSrc(sim) {
  const id   = sim.SIM_ID || sim.id || '';
  const slug = window.Utils ? window.Utils.slugify(id) : id.toLowerCase();
  return `image/sims/${slug}/portrait.png`;
}

function getFirstName(fullName) {
  return (fullName || '').split(' ')[0] || '';
}

function getLastName(fullName) {
  const parts = (fullName || '').split(' ');
  return parts.length > 1 ? parts.slice(1).join(' ') : '';
}

function mapGender(g) {
  const lower = (g || '').toLowerCase();
  if (lower === 'male' || lower === 'm')   return 'M';
  if (lower === 'female' || lower === 'f') return 'F';
  return 'U';
}

// ── Apply node modes (link mode, secret mode) ─────────────────────
function applyNodeModes(section) {
  const cards = section.querySelectorAll('.f3-node-card');

  cards.forEach(card => {
    // Secret
    const simId  = card.dataset.simId || '';
    const isSecret = card.dataset.secret === 'true';
    if (isSecret) card.classList.add('secret-node');
    if (!secretMode && isSecret) card.classList.add('secret-hidden');

    // Link mode
    if (linkMode) {
      card.style.cursor = 'pointer';
      card.addEventListener('click', () => {
        if (simId) window.location.href = `sim.html?id=${encodeURIComponent(simId)}`;
      });
    }
  });
}

// ── Wire controls ─────────────────────────────────────────────────
function wireControls() {

  // ── Dropdown filter ────────────────────────────────────────────
  const dropdown = document.getElementById('familyDropdown');
  if (dropdown) {
    dropdown.addEventListener('change', () => {
      dropdownValue = dropdown.value;
      applyFilters();
    });
  }

  // ── Ancestor search (phase 4) ──────────────────────────────────
  const searchInput = document.getElementById('familySimSearch');
  const resultCount = document.getElementById('searchResultCount');

  if (searchInput) {
    searchInput.addEventListener('input', () => {
      clearTimeout(searchDebounce);
      searchDebounce = setTimeout(() => {
        applyFilters();
      }, 200);
    });

    // Clear search on Escape
    searchInput.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        searchInput.value = '';
        applyFilters();
        searchInput.blur();
      }
    });
  }

  // ── Secret toggle ──────────────────────────────────────────────
  const secretBtn    = document.getElementById('secretToggle');
  const secretBanner = document.getElementById('secretBanner');

  if (secretBtn) {
    secretBtn.addEventListener('click', () => {
      secretMode = !secretMode;
      secretBtn.classList.toggle('active', secretMode);
      secretBtn.setAttribute('aria-pressed', String(secretMode));
      secretBtn.textContent = secretMode ? '🔓 Hide Secrets' : '🔒 Show Secrets';
      if (secretBanner) secretBanner.style.display = secretMode ? '' : 'none';
      updateSecretVisibility();
    });
  }

  // ── Link mode toggle ───────────────────────────────────────────
  const linkBtn    = document.getElementById('linkToggle');
  const linkBanner = document.getElementById('linkBanner');

  if (linkBtn) {
    linkBtn.addEventListener('click', () => {
      linkMode = !linkMode;
      linkBtn.classList.toggle('active', linkMode);
      linkBtn.setAttribute('aria-pressed', String(linkMode));
      linkBtn.textContent = linkMode ? '🔗 Profile Links: On' : '🔗 Profile Links: Off';
      if (linkBanner) linkBanner.style.display = linkMode ? '' : 'none';
      updateLinkMode();
    });
  }
}

// ── Apply all active filters ──────────────────────────────────────
// Both the dropdown and the search work together.
// A family is visible if:
//   - it matches the dropdown (or dropdown is "All Families"), AND
//   - it contains a sim matching the search term (or search is empty)
function applyFilters() {
  const searchInput  = document.getElementById('familySimSearch');
  const resultCount  = document.getElementById('searchResultCount');
  const emptyState   = document.getElementById('familiesEmpty');
  const query        = (searchInput ? searchInput.value : '').trim();
  const normQuery    = normaliseName(query);
  searchActive       = query.length > 0;

  // Which family IDs match the search term
  const searchMatchIds = searchActive
    ? getFamiliesMatchingSearch(normQuery)
    : null; // null = all

  let visibleCount = 0;

  allFamilies.forEach(record => {
    const matchesDropdown = !dropdownValue || record.id === dropdownValue;
    const matchesSearch   = !searchActive || searchMatchIds.has(record.id);
    const visible         = matchesDropdown && matchesSearch;

    record.el.classList.toggle('search-hidden', !visible);

    if (visible) {
      visibleCount++;
      // Highlight matching nodes within this family if search active
      applySearchHighlight(record, normQuery);
    } else {
      clearSearchHighlight(record);
    }
  });

  // Update result count pill
  if (resultCount) {
    if (searchActive) {
      resultCount.textContent = `${visibleCount} famil${visibleCount === 1 ? 'y' : 'ies'}`;
      resultCount.classList.add('visible');
    } else {
      resultCount.classList.remove('visible');
    }
  }

  // Empty state
  if (emptyState) {
    emptyState.classList.toggle('visible', visibleCount === 0 && searchActive);
  }

  // Apply search-active class to trees container (dims non-matching nodes)
  const container = document.getElementById('treesContainer');
  if (container) {
    container.classList.toggle('search-active', searchActive);
  }
}

// ── Get family IDs that contain a sim matching the query ──────────
function getFamiliesMatchingSearch(normQuery) {
  const matchedFamilyIds = new Set();

  Object.keys(simNameIndex).forEach(key => {
    if (key.includes(normQuery)) {
      simNameIndex[key].forEach(id => matchedFamilyIds.add(id));
    }
  });

  return matchedFamilyIds;
}

// ── Apply search highlight to node cards ──────────────────────────
function applySearchHighlight(record, normQuery) {
  const section = record.el;
  if (!section || !searchActive) {
    clearSearchHighlight(record);
    return;
  }

  const cards = section.querySelectorAll('.f3-node-card');
  cards.forEach(card => {
    const nameText = normaliseName(
      (card.querySelector('.f3-node-name, .node-name, [class*="name"]')
        || card).textContent || ''
    );
    const matches = nameText.includes(normQuery);
    card.classList.toggle('search-match', matches);
  });
}

function clearSearchHighlight(record) {
  if (!record || !record.el) return;
  record.el.querySelectorAll('.f3-node-card').forEach(card => {
    card.classList.remove('search-match');
  });
}

// ── Secret visibility ─────────────────────────────────────────────
function updateSecretVisibility() {
  document.querySelectorAll('.f3-node-card.secret-node').forEach(card => {
    card.classList.toggle('secret-hidden', !secretMode);
  });
  document.querySelectorAll('.f3-link[data-secret="true"]').forEach(link => {
    link.style.display = secretMode ? '' : 'none';
  });
}

// ── Link mode ─────────────────────────────────────────────────────
function updateLinkMode() {
  document.querySelectorAll('.f3-node-card').forEach(card => {
    card.style.cursor = linkMode ? 'pointer' : '';
  });
}
