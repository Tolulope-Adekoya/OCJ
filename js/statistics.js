// statistics.js — Statistics page

document.addEventListener('ocj-data-ready', () => {
  setBadge('badge-worlds', window.WORLDS.length);
  setBadge('badge-sims',   window.SIMS.length);
  setBadge('badge-lots',   window.LOTS.length);
  buildCharts();
});

function setBadge(id, count) {
  const el = document.getElementById(id);
  if (el && count > 0) el.textContent = count;
}

function buildCharts() {
  const sims = window.SIMS;
  const lots = window.LOTS;

  buildBarChart('chart-age',        countBy(sims, 'AGE GROUP'));
  buildBarChart('chart-gender',     countBy(sims, 'GENDER '));
  buildBarChart('chart-occult',     countBy(sims, 'OCCULT'));
  buildBarChart('chart-wealth',     countBy(sims, 'WEALTH CLASS'));
  buildBarChart('chart-lot-type',   countBy(lots, 'LOT TYPE'));
  buildBarChart('chart-lot-status', countBy(lots, 'STATUS'));

  // Sims per world
  buildBarChart('chart-sims-world', countBy(sims, 'WORLD'));

  // Lots per world
  buildBarChart('chart-lots-world', countBy(lots, 'WORLD'));
}

function buildBarChart(containerId, countsObj) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const entries = sortedEntries(countsObj);
  if (!entries.length) {
    container.innerHTML = '<div class="no-results" style="padding:1rem 0">No data yet.</div>';
    return;
  }

  const max = entries[0][1];

  container.innerHTML = entries.map(([label, count]) => {
    const pct = Math.round((count / max) * 100);
    const displayLabel = label || 'Unknown';
    return `
      <div class="bar-row">
        <span class="bar-label" title="${displayLabel}">${displayLabel}</span>
        <div class="bar-track">
          <div class="bar-fill" style="width: 0%" data-target="${pct}"></div>
        </div>
        <span class="bar-val">${count}</span>
      </div>
    `;
  }).join('');

  // Animate bars in
  requestAnimationFrame(() => {
    container.querySelectorAll('.bar-fill').forEach(bar => {
      const target = bar.getAttribute('data-target');
      setTimeout(() => { bar.style.width = target + '%'; }, 50);
    });
  });
}
