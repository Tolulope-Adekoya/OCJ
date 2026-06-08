// lots.js — Lots page

// Map lot names to their detail page IDs
const LOT_PAGE_MAP = {
  "Ridley Family Home": "ridley_family_home",
  "Jacobs Estate": "jacobs_estate",
  "Yoh Manor": "nichole_yoh_manor",
  "Usher Estate": "usher_estate",
  "Bhatnagar Family Home": "bhatnagar_home",
  "Addams Manor": "addams_manor",
  "Kovac Apartment": "kovac_apartment",
  "La Cosa Simstra HQ": "johnny_zest_hideout",
  "Rollins Family Home": "rollins_home",
  "Faircroft Estate": "faircroft_estate",
  "Ashcroft Farm": "ashcroft_farm",
  "Faircroft Goods": "sabrina_shop",
  "Bhatnagar Vet Clinic": "bhatnagar_vet",
  "Blackwood Residence": "kason_blackwood_home",
  "Moanikea Household": "moanikea_home",
  "Oliana's Sulani Kitchen": "oliana_restaurant",
  "Chaudhary Home": "chaudhary_home",
  "Mehra-Moretti Apartment": "shalini_apartment",
  "Straud Castle": "vladislaus_castle",
  "Simkuza Dojo": "rinka_dojo",
  "Mochizuki Sanctum": "toya_sanctum",
  "Darwin Research Facility": "tesla_darwin_lab",
  "Delacroix Apartment": "delacroix_home",
  "Peloquin Estate": "peloquin_home",
  "Willow Creek Police Station": "willow_creek_police",
  "Willow Creek Hospital": "willow_creek_hospital",
  "Copperdale High School": "copperdale_high",
  "Thornwood Boarding School": "boarding_school",
  "Blackwoods": "blackwoods_club",
  "Rollins Soul Kitchen": "darius_restaurant_future",
  "Anuhewa Lair": "hinaopele_lair",
  "Montenegro's": "montana_restaurant",
  "Komorebi Rest": "simkuza_bar",
  "Corrections Facility": "ink_prison",
  "Ashcroft Jewellers": "enzo_jewellery",
  "Winona's Cottage": "winona_cottage",
  "Faircroft-Moretti Home": "dorian_home",
  "Faircroft-Ashcroft Home": "chayton_fiona_home",
  "Bhatnagar Animal Shelter": "parivita_shelter",
  "Bhatnagar Home": "rajiv_priya_home",
  "Addams Craft Studio": "morticia_craft_room",
  "Strangerville Museum": "dr_darwin_museum",
  "Magic Realm Portal": "magic_realm_portal",
  "Simkuza Saferoom": "simkuza_saferoom",
  "Mireshade Lair": "bellatrix_lair",
  "Sanguine Estate": "varek_estate",
  "Ashcroft Flower Farm": "hawthorne_flower_farm",
  "Ashcroft Crop Farm": "saffron_farm",
  "Parkshore": "perrin_home",
  "Brown Family Home": "evelyn_brown_home"
};

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

function getLotLink(name) {
  const pageId = LOT_PAGE_MAP[name];
  if (pageId) return `<a href="lots/${pageId}.html" class="lot-name-link">${name}</a>`;
  return name;
}

function renderLots(data) {
  const tbody = document.getElementById('lots-tbody');
  const count = document.getElementById('lots-count');

  count.textContent = `${data.length} lot${data.length !== 1 ? 's' : ''}`;

  if (!data.length) {
    tbody.innerHTML = '<tr><td colspan="10" class="no-results">No lots match your filters.</td></tr>';
    return;
  }

  tbody.innerHTML = data.map(l => {
    const displayName = l['LOT NEW NAME'] || l['LOT ORIGINAL NAME'] || '—';
    return `
    <tr>
      <td class="td-name">${getLotLink(displayName)}</td>
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
  `}).join('');
}

function populateFilters() {
  const worldSelect = document.getElementById('filter-world');
  const worlds = [...new Set(window.LOTS.map(l => l['WORLD']).filter(Boolean))].sort();
  worlds.forEach(w => {
    const opt = document.createElement('option');
    opt.value = w; opt.textContent = w;
    worldSelect.appendChild(opt);
  });

  const typeSelect = document.getElementById('filter-type');
  const types = [...new Set(window.LOTS.map(l => l['LOT TYPE']).filter(Boolean))].sort();
  types.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t; opt.textContent = t;
    typeSelect.appendChild(opt);
  });

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
