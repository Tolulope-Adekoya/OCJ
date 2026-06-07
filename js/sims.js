// sims.js — Sims page

document.addEventListener('ocj-data-ready', () => {
  setBadge('badge-worlds', window.WORLDS.length);
  setBadge('badge-sims',   window.SIMS.length);
  setBadge('badge-lots',   window.LOTS.length);
  populateFilters();
  renderSims(window.SIMS);
  setupFilters();
});

function setBadge(id, count) {
  const el = document.getElementById(id);
  if (el && count > 0) el.textContent = count;
}

function getStatusTag(status) {
  if (!status) return '';
  const s = status.toLowerCase();
  if (s.includes('complete') || s.includes('done')) return `<span class="tag tag--green">${status}</span>`;
  if (s.includes('progress') || s.includes('wip'))  return `<span class="tag tag--amber">${status}</span>`;
  return `<span class="tag tag--muted">${status}</span>`;
}

function getWealthTag(wealth) {
  if (!wealth) return '';
  const w = wealth.toLowerCase();
  if (w.includes('elite'))       return `<span class="tag tag--rose">${wealth}</span>`;
  if (w.includes('rich'))        return `<span class="tag tag--amber">${wealth}</span>`;
  if (w.includes('middle'))      return `<span class="tag">${wealth}</span>`;
  return `<span class="tag tag--muted">${wealth}</span>`;
}

function renderSims(data) {
  const tbody = document.getElementById('sims-tbody');
  const count = document.getElementById('sims-count');

  count.textContent = `${data.length} sim${data.length !== 1 ? 's' : ''}`;

  if (!data.length) {
    tbody.innerHTML = '<tr><td colspan="9" class="no-results">No sims match your filters.</td></tr>';
    return;
  }

  tbody.innerHTML = data.map(s => `
    <tr>
      <td class="td-name">${s['NAME'] || '—'}</td>
      <td>${s['WORLD'] || '—'}</td>
      <td>${s['AGE GROUP'] || '—'}</td>
      <td>${s['GENDER '] || s['GENDER'] || '—'}</td>
      <td>${s['OCCULT'] || 'Human'}</td>
      <td>${s['JOB'] || '—'}</td>
      <td>${getWealthTag(s['WEALTH CLASS']) || '—'}</td>
      <td>${s['PLAYABLE SIM'] === 'Yes' ? '<span class="tag tag--green">Yes</span>' : '<span class="tag tag--muted">NPC</span>'}</td>
      <td>${getStatusTag(s['STATUS']) || '—'}</td>
    </tr>
  `).join('');
}

function populateFilters() {
  // Worlds dropdown
  const worldSelect = document.getElementById('filter-world');
  const worlds = [...new Set(window.SIMS.map(s => s['WORLD']).filter(Boolean))].sort();
  worlds.forEach(w => {
    const opt = document.createElement('option');
    opt.value = w; opt.textContent = w;
    worldSelect.appendChild(opt);
  });

  // Occult dropdown
  const occultSelect = document.getElementById('filter-occult');
  const occults = [...new Set(window.SIMS.map(s => s['OCCULT'] || 'Human').filter(Boolean))].sort();
  occults.forEach(o => {
    const opt = document.createElement('option');
    opt.value = o; opt.textContent = o;
    occultSelect.appendChild(opt);
  });
}

function setupFilters() {
  const search   = document.getElementById('search-sims');
  const world    = document.getElementById('filter-world');
  const age      = document.getElementById('filter-age');
  const playable = document.getElementById('filter-playable');
  const occult   = document.getElementById('filter-occult');

  function applyFilters() {
    const q  = search.value.toLowerCase();
    const w  = world.value;
    const a  = age.value;
    const p  = playable.value;
    const o  = occult.value;

    const filtered = window.SIMS.filter(s => {
      const name        = (s['NAME'] || '').toLowerCase();
      const simWorld    = s['WORLD'] || '';
      const simAge      = s['AGE GROUP'] || '';
      const simPlayable = s['PLAYABLE SIM'] || '';
      const simOccult   = s['OCCULT'] || 'Human';

      return (
        (!q || name.includes(q)) &&
        (!w || simWorld === w) &&
        (!a || simAge === a) &&
        (!p || simPlayable === p) &&
        (!o || simOccult === o)
      );
    });

    renderSims(filtered);
  }

  [search, world, age, playable, occult].forEach(el => {
    el.addEventListener('input',  applyFilters);
    el.addEventListener('change', applyFilters);
  });
}
