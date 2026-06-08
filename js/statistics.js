// statistics.js — Statistics page with bar/pie toggle

const PIE_COLOURS = [
  '#c9879a','#5a9fd4','#7ec99a','#d4a76a','#a0a0c0',
  '#b07ec9','#7ec9c9','#c97e7e','#9fd45a','#d4c97e',
  '#5a7ed4','#c9a07e'
];

document.addEventListener('ocj-data-ready', () => {
  setBadge('badge-worlds', window.WORLDS.length);
  setBadge('badge-sims',   window.SIMS.length);
  setBadge('badge-lots',   window.LOTS.length);
  buildAllCharts();
  setupToggles();
});

function setBadge(id, count) {
  const el = document.getElementById(id);
  if (el && count > 0) el.textContent = count;
}

const CHARTS = [
  { id: 'chart-world',       key: 'WORLD',              source: 'sims' },
  { id: 'chart-gender',      key: 'GENDER',             source: 'sims' },
  { id: 'chart-age',         key: 'AGE GROUP',          source: 'sims' },
  { id: 'chart-occult',      key: 'OCCULT',             source: 'sims' },
  { id: 'chart-wealth',      key: 'WEALTH CLASS',       source: 'sims' },
  { id: 'chart-orientation', key: 'ORIENTATION',        source: 'sims' },
  { id: 'chart-political',   key: 'POLITICAL ALIGNMENT',source: 'sims' },
  { id: 'chart-faith',       key: 'FAITH',              source: 'sims' },
  { id: 'chart-alignment',   key: 'ALIGNMENT',          source: 'sims' },
  { id: 'chart-playable',    key: 'PLAYABLE SIM',       source: 'sims' },
  { id: 'chart-lots-world',  key: 'WORLD',              source: 'lots' },
  { id: 'chart-lot-type',    key: 'LOT TYPE',           source: 'lots' },
];

function buildAllCharts() {
  CHARTS.forEach(c => {
    const data = c.source === 'sims' ? window.SIMS : window.LOTS;
    const counts = countBy(data, c.key);
    renderBar(c.id, counts);
  });
}

function setupToggles() {
  document.querySelectorAll('.toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const chartId = btn.dataset.chart;
      const type    = btn.dataset.type;

      // Update active state
      btn.closest('.chart-toggle').querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      // Re-render
      const chart = CHARTS.find(c => c.id === chartId);
      if (!chart) return;
      const data   = chart.source === 'sims' ? window.SIMS : window.LOTS;
      const counts = countBy(data, chart.key);
      if (type === 'pie') {
        renderPie(chartId, counts);
      } else {
        renderBar(chartId, counts);
      }
    });
  });
}

function renderBar(containerId, countsObj) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const entries = sortedEntries(countsObj).filter(([k]) => k && k !== 'Unknown');
  if (!entries.length) {
    container.innerHTML = '<div class="no-results" style="padding:1rem 0">No data.</div>';
    return;
  }

  const max = entries[0][1];

  container.innerHTML = `<div class="bar-chart">${
    entries.map(([label, count]) => {
      const pct = Math.round((count / max) * 100);
      return `
        <div class="bar-row">
          <span class="bar-label" title="${label}">${label}</span>
          <div class="bar-track">
            <div class="bar-fill" style="width:0%" data-target="${pct}"></div>
          </div>
          <span class="bar-val">${count}</span>
        </div>
      `;
    }).join('')
  }</div>`;

  requestAnimationFrame(() => {
    container.querySelectorAll('.bar-fill').forEach(bar => {
      setTimeout(() => { bar.style.width = bar.dataset.target + '%'; }, 50);
    });
  });
}

function renderPie(containerId, countsObj) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const entries = sortedEntries(countsObj).filter(([k]) => k && k !== 'Unknown');
  if (!entries.length) {
    container.innerHTML = '<div class="no-results" style="padding:1rem 0">No data.</div>';
    return;
  }

  const total = entries.reduce((s, [,v]) => s + v, 0);
  const size  = 120;
  const cx = size / 2, cy = size / 2, r = size / 2 - 4;

  let angle = -Math.PI / 2;
  const slices = entries.map(([label, count], i) => {
    const frac  = count / total;
    const start = angle;
    angle += frac * 2 * Math.PI;
    const end = angle;
    const x1 = cx + r * Math.cos(start);
    const y1 = cy + r * Math.sin(start);
    const x2 = cx + r * Math.cos(end);
    const y2 = cy + r * Math.sin(end);
    const large = frac > 0.5 ? 1 : 0;
    return {
      label, count, frac,
      path: `M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${large},1 ${x2},${y2} Z`,
      colour: PIE_COLOURS[i % PIE_COLOURS.length]
    };
  });

  container.innerHTML = `
    <div class="pie-wrap">
      <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
        ${slices.map(s => `<path d="${s.path}" fill="${s.colour}" opacity="0.9"/>`).join('')}
      </svg>
      <div class="pie-legend">
        ${slices.map(s => `
          <div class="pie-legend-item">
            <div class="pie-legend-dot" style="background:${s.colour}"></div>
            <span>${s.label}</span>
            <span class="pie-legend-pct">${Math.round(s.frac * 100)}%</span>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}