// sims.js — Sims page

const AGE_ORDER = ['Newborn','Infant','Toddler','Child','Teenager','Young Adult','Adult','Elder'];
const WEALTH_ORDER = ['Destitute','Poor','Middle Class','Rich','Elite'];

document.addEventListener('ocj-data-ready', () => {
  setBadge('badge-worlds', window.WORLDS.length);
  setBadge('badge-sims',   window.SIMS.length);
  setBadge('badge-lots',   window.LOTS.length);
  populateFilters();
  renderSims(window.SIMS);
  setupFilters();
  setupTooltip();
});

function setBadge(id, count) {
  const el = document.getElementById(id);
  if (el && count > 0) el.textContent = count;
}

function slugify(name) {
  return (name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(' ');
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function genderClass(gender) {
  if (!gender) return 'other';
  const g = gender.toLowerCase();
  if (g === 'male')   return 'male';
  if (g === 'female') return 'female';
  return 'other';
}

function renderSims(data) {
  const grid  = document.getElementById('sims-grid');
  const count = document.getElementById('sims-count');

  count.textContent = `${data.length} sim${data.length !== 1 ? 's' : ''}`;

  if (!data.length) {
    grid.innerHTML = '<div class="no-results">No sims match your filters.</div>';
    return;
  }

  grid.innerHTML = data.map(s => {
    const name     = s['NAME']         || '—';
    const gender   = s['GENDER']       || '';
    const world    = s['WORLD']        || '';
    const age      = s['AGE GROUP']    || '';
    const job      = s['JOB']          || '—';
    const occult   = s['OCCULT']       || 'Human';
    const wealth   = s['WEALTH CLASS'] || '—';
    const playable = s['PLAYABLE SIM'] || 'No';
    const gc       = genderClass(gender);
    const slug     = slugify(name);
    const imgPath  = `images/sims/profile/${name} Profile Picture.png`;

    return `
      <div class="sim-card"
        data-name="${name}"
        data-gender="${gender}"
        data-world="${world}"
        data-age="${age}"
        data-job="${job}"
        data-occult="${occult}"
        data-wealth="${wealth}"
        onclick="window.location='sims/${slug}.html'">
        <div class="sim-avatar ${gc}">
          <img
            src="${imgPath}"
            alt="${name}"
            onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"
          />
          <div class="sim-avatar-placeholder" style="display:none;width:100%;height:100%;align-items:center;justify-content:center;">
            ${getInitials(name)}
          </div>
        </div>
        <div class="sim-name">${name}</div>
        ${playable === 'No' ? '<div class="sim-npc-badge">NPC</div>' : ''}
      </div>
    `;
  }).join('');
}

function populateFilters() {
  const sims = window.SIMS;

  populate('filter-world',       uniqueVals(sims, 'WORLD'));
  populate('filter-age',         AGE_ORDER.filter(a => sims.some(s => s['AGE GROUP'] === a)));
  populate('filter-gender',      uniqueVals(sims, 'GENDER'));
  populate('filter-occult',      uniqueVals(sims, 'OCCULT'));
  populate('filter-wealth',      WEALTH_ORDER.filter(w => sims.some(s => s['WEALTH CLASS'] === w)));
  populate('filter-club',        uniqueVals(sims, 'CLUB'));
  populate('filter-faith',       uniqueVals(sims, 'FAITH'));
  populate('filter-language',    uniqueVals(sims, 'LANGUAGE SPOKEN'));
  populate('filter-orientation', uniqueVals(sims, 'ORIENTATION'));
  populate('filter-political',   uniqueVals(sims, 'POLITICAL ALIGNMENT'));
}

function uniqueVals(arr, key) {
  return [...new Set(arr.map(s => s[key]).filter(Boolean))].sort();
}

function populate(selectId, values) {
  const sel = document.getElementById(selectId);
  if (!sel) return;
  values.forEach(v => {
    const opt = document.createElement('option');
    opt.value = v;
    opt.textContent = v;
    sel.appendChild(opt);
  });
}

function setupFilters() {
  const inputs = [
    'search-sims','filter-world','filter-age','filter-gender',
    'filter-occult','filter-wealth','filter-playable','filter-status',
    'filter-club','filter-faith','filter-language','filter-orientation',
    'filter-political','sort-by'
  ].map(id => document.getElementById(id));

  function applyFilters() {
    const q          = document.getElementById('search-sims').value.toLowerCase();
    const world      = document.getElementById('filter-world').value;
    const age        = document.getElementById('filter-age').value;
    const gender     = document.getElementById('filter-gender').value;
    const occult     = document.getElementById('filter-occult').value;
    const wealth     = document.getElementById('filter-wealth').value;
    const playable   = document.getElementById('filter-playable').value;
    const status     = document.getElementById('filter-status').value;
    const club       = document.getElementById('filter-club').value;
    const faith      = document.getElementById('filter-faith').value;
    const language   = document.getElementById('filter-language').value;
    const orientation= document.getElementById('filter-orientation').value;
    const political  = document.getElementById('filter-political').value;
    const sortBy     = document.getElementById('sort-by').value;

    let filtered = window.SIMS.filter(s => {
      return (
        (!q           || (s['NAME'] || '').toLowerCase().includes(q)) &&
        (!world       || s['WORLD']             === world) &&
        (!age         || s['AGE GROUP']         === age) &&
        (!gender      || s['GENDER']            === gender) &&
        (!occult      || s['OCCULT']            === occult) &&
        (!wealth      || s['WEALTH CLASS']      === wealth) &&
        (!playable    || s['PLAYABLE SIM']      === playable) &&
        (!status      || s['STATUS']            === status) &&
        (!club        || (s['CLUB'] || '').includes(club)) &&
        (!faith       || (s['FAITH'] || '').includes(faith)) &&
        (!language    || (s['LANGUAGE SPOKEN'] || '').includes(language)) &&
        (!orientation || s['ORIENTATION']       === orientation) &&
        (!political   || s['POLITICAL ALIGNMENT'] === political)
      );
    });

    // Sort
    filtered = sortSims(filtered, sortBy);
    renderSims(filtered);
    setupTooltip();
  }

  inputs.forEach(el => {
    if (!el) return;
    el.addEventListener('input',  applyFilters);
    el.addEventListener('change', applyFilters);
  });
}

function sortSims(arr, sortBy) {
  return [...arr].sort((a, b) => {
    switch (sortBy) {
      case 'name-desc':
        return (b['NAME'] || '').localeCompare(a['NAME'] || '');
      case 'world':
        return (a['WORLD'] || '').localeCompare(b['WORLD'] || '');
      case 'age':
        return AGE_ORDER.indexOf(a['AGE GROUP']) - AGE_ORDER.indexOf(b['AGE GROUP']);
      case 'wealth':
        return WEALTH_ORDER.indexOf(a['WEALTH CLASS']) - WEALTH_ORDER.indexOf(b['WEALTH CLASS']);
      default: // name-asc
        return (a['NAME'] || '').localeCompare(b['NAME'] || '');
    }
  });
}

function setupTooltip() {
  const tooltip = document.getElementById('sim-tooltip');

  document.querySelectorAll('.sim-card').forEach(card => {
    card.addEventListener('mouseenter', (e) => {
      document.getElementById('tt-name').textContent   = card.dataset.name;
      document.getElementById('tt-gender').textContent = card.dataset.gender || '—';
      document.getElementById('tt-age').textContent    = card.dataset.age    || '—';
      document.getElementById('tt-world').textContent  = card.dataset.world  || '—';
      document.getElementById('tt-job').textContent    = (card.dataset.job   || '—').split(',')[0].trim();
      document.getElementById('tt-occult').textContent = card.dataset.occult || '—';
      document.getElementById('tt-wealth').textContent = card.dataset.wealth || '—';
      tooltip.classList.add('visible');
    });

    card.addEventListener('mousemove', (e) => {
      tooltip.style.left = (e.clientX + 16) + 'px';
      tooltip.style.top  = (e.clientY - 10) + 'px';
    });

    card.addEventListener('mouseleave', () => {
      tooltip.classList.remove('visible');
    });
  });
}