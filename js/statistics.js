// statistics.js
//
// Pivot dashboard for Sims / Lots / Worlds / Pets. Field eligibility comes
// entirely from PivotClassifier (no hardcoded per-column lists), and all
// counting/cross-tabbing/lot-collapsing comes from PivotEngine. This file
// is just wiring: load data once, then read the controls and re-render on
// every change.

const DATASETS = {
  sims:   { file: 'data/sims.csv',   label: 'Sims' },
  lots:   { file: 'data/lots.csv',   label: 'Lots' },
  worlds: { file: 'data/worlds.csv', label: 'Worlds' },
  pets:   { file: 'data/pets.csv',   label: 'Pets' }
};

// Small, intentional exception to "no hardcoded field names": these are
// structural ID/reference columns used to build a neutral, non-Name
// drill-down row and (where possible) a link to that record's own page.
const DRILL_FIELDS = {
  sims:   ['SIM_ID', 'WORLD', 'AGE GROUP'],
  lots:   ['LOT ID', 'WORLD', 'LOT TYPE'],
  worlds: ['WORLD ID', 'STATUS'],
  pets:   ['PET_ID', 'WORLD', 'SPECIES']
};

// Primary display label per dataset — tried in order, first non-empty wins.
const NAME_FIELDS = {
  sims:   ['NAME'],
  lots:   ['LOT NEW NAME', 'LOT ORIGINAL NAME'],
  worlds: ['WORLD'],
  pets:   ['NAME']
};

const DETAIL_LINKS = {
  sims: { idField: 'SIM_ID', page: 'sim.html' },
  pets: { idField: 'PET_ID', page: 'pet.html' }
};

let DATA = {};
let CLASSIFICATION = {};
let CURRENT_DATASET = 'sims';
let CURRENT_PIVOT = null;
let CURRENT_CHART_TYPE = 'bar';
let CHART = null;

document.addEventListener('DOMContentLoaded', init);

async function init() {

  try {

    DATA.sims = await window.CSV.loadCSV(DATASETS.sims.file);
    DATA.lots = await window.CSV.loadCSV(DATASETS.lots.file);
    DATA.worlds = await window.CSV.loadCSV(DATASETS.worlds.file);
    DATA.pets = await window.CSV.loadCSV(DATASETS.pets.file);

    Object.keys(DATA).forEach(key => {
      CLASSIFICATION[key] = window.PivotClassifier.classifyDataset(DATA[key] || []);
    });

    setupDatasetButtons();
    setupControls();
    updateDatasetButtonCounts();
    renderQuickStats();
    populateFieldSelects();
    updateStatistics();
    hideLoading();

  } catch (err) {

    console.error(err);
    showLoadError();

  }

}

/* =========================
   DATASET BUTTONS
========================= */

function setupDatasetButtons() {

  document
    .querySelectorAll('.dataset-btn')
    .forEach(btn => {

      btn.addEventListener('click', () => {

        document
          .querySelectorAll('.dataset-btn')
          .forEach(b => b.classList.remove('active'));

        btn.classList.add('active');

        CURRENT_DATASET = btn.dataset.dataset;

        populateFieldSelects();
        updateStatistics();

      });

    });

}

function updateDatasetButtonCounts() {

  const ids = {
    sims: 'countSims',
    lots: 'countLots',
    worlds: 'countWorlds',
    pets: 'countPets'
  };

  Object.entries(ids).forEach(([key, elId]) => {

    const el = document.getElementById(elId);
    if (!el) return;

    if (key === 'lots') {
      const collapsed = window.PivotEngine.collapseLotsByParent(DATA.lots || []);
      el.textContent = `${collapsed.length} lots`;
      return;
    }

    el.textContent = `${(DATA[key] || []).length} ${DATASETS[key].label.toLowerCase()}`;

  });

}

/* =========================
   CONTROLS
========================= */

function setupControls() {

  document
    .getElementById('rowsSelect')
    ?.addEventListener('change', updateStatistics);

  document
    .getElementById('columnsSelect')
    ?.addEventListener('change', updateStatistics);

  document
    .getElementById('topN')
    ?.addEventListener('change', updateStatistics);

  document
    .querySelectorAll('.chart-btn')
    .forEach(btn => {

      btn.addEventListener('click', () => {

        if (btn.disabled) return;

        document
          .querySelectorAll('.chart-btn')
          .forEach(b => b.classList.remove('active'));

        btn.classList.add('active');

        CURRENT_CHART_TYPE = btn.dataset.chartType;

        if (CURRENT_PIVOT) renderChart(CURRENT_PIVOT);

      });

    });

}

/* =========================
   FIELD SELECTS
========================= */

function populateFieldSelects() {

  const rowsSelect = document.getElementById('rowsSelect');
  const columnsSelect = document.getElementById('columnsSelect');
  if (!rowsSelect || !columnsSelect) return;

  const rows = DATA[CURRENT_DATASET] || [];

  if (!rows.length) {
    rowsSelect.innerHTML = '';
    columnsSelect.innerHTML = '<option value="">— None —</option>';
    return;
  }

  const classification = CLASSIFICATION[CURRENT_DATASET] || {};

  const fields = Object.keys(rows[0]).filter(h =>
    classification[h] &&
    window.PivotClassifier.PIVOTABLE_BUCKETS.has(classification[h].bucket)
  );

  const prevRows = rowsSelect.value;
  const prevCols = columnsSelect.value;

  rowsSelect.innerHTML = fields
    .map(f => `<option value="${escapeAttr(f)}">${escapeHtml(f)}</option>`)
    .join('');

  columnsSelect.innerHTML =
    `<option value="">— None —</option>` +
    fields.map(f => `<option value="${escapeAttr(f)}">${escapeHtml(f)}</option>`).join('');

  rowsSelect.value = fields.includes(prevRows) ? prevRows : (fields[0] || '');
  columnsSelect.value = fields.includes(prevCols) ? prevCols : '';

}

/* =========================
   MAIN UPDATE
========================= */

function updateStatistics() {

  const rowsField = document.getElementById('rowsSelect')?.value;
  if (!rowsField) {
    renderEmptyState();
    return;
  }

  const columnsField = document.getElementById('columnsSelect')?.value || null;
  const topN = document.getElementById('topN')?.value || 'all';

  CURRENT_PIVOT = window.PivotEngine.buildPivot({
    datasetName: CURRENT_DATASET,
    rows: DATA[CURRENT_DATASET] || [],
    classification: CLASSIFICATION[CURRENT_DATASET] || {},
    rowsField,
    columnsField,
    topN
  });

  updateChartTypeAvailability(CURRENT_PIVOT);
  renderKpis(CURRENT_PIVOT);
  renderChart(CURRENT_PIVOT);
  renderTable(CURRENT_PIVOT);
  clearDrilldown();

}

function renderEmptyState() {

  const kpis = document.getElementById('statsKpis');
  if (kpis) kpis.innerHTML = '';

  if (CHART) { CHART.destroy(); CHART = null; }

  const tableWrap = document.getElementById('statsTableWrap');
  if (tableWrap) {
    tableWrap.innerHTML = '<div class="stats-empty">No pivotable fields found for this dataset.</div>';
  }

  clearDrilldown();

}

/* =========================
   CHART TYPE AVAILABILITY
========================= */

function updateChartTypeAvailability(pivot) {

  const pieBtn = document.querySelector('.chart-btn[data-chart-type="pie"]');
  const barBtn = document.querySelector('.chart-btn[data-chart-type="bar"]');
  if (!pieBtn || !barBtn) return;

  if (pivot.isCrossTab) {

    pieBtn.disabled = true;
    pieBtn.classList.add('chart-btn-disabled');

    if (CURRENT_CHART_TYPE === 'pie') {
      CURRENT_CHART_TYPE = 'bar';
      pieBtn.classList.remove('active');
      barBtn.classList.add('active');
    }

  } else {

    pieBtn.disabled = false;
    pieBtn.classList.remove('chart-btn-disabled');

  }

}

/* =========================
   KPIs
========================= */

function renderKpis(pivot) {

  const el = document.getElementById('statsKpis');
  if (!el) return;

  const datasetLabel = DATASETS[CURRENT_DATASET]?.label || CURRENT_DATASET;

  const cards = [
    ['Dataset', datasetLabel],
    ['Rows', pivot.rowsField],
    ['Columns', pivot.columnsField || 'None'],
    ['Categories', pivot.rowKeys.length],
    ['Records', pivot.grandTotal]
  ];

  if (CURRENT_DATASET === 'lots') {
    cards.push(['Units', pivot.unitCount]);
  }

  el.innerHTML = `
    <div class="kpi-grid">
      ${cards.map(([label, value]) => `
        <div class="kpi-card">
          <div class="kpi-label">${escapeHtml(label)}</div>
          <div class="kpi-value">${escapeHtml(String(value))}</div>
        </div>
      `).join('')}
    </div>
  `;

}

/* =========================
   CHART
========================= */

function getChartPalette() {

  // Reads the live theme where possible; falls back to hex approximations
  // of the Chrysolite / Jacinth palette since pivot-classifier.js and
  // pivot-engine.js don't have access to theme.css's exact variable names.
  const styles = getComputedStyle(document.documentElement);
  const read = (name, fallback) => {
    const v = styles.getPropertyValue(name)?.trim();
    return v || fallback;
  };

  return [
    read('--primary', '#8FA31E'),       // Chrysolite-ish olive/lime
    read('--jacinth', '#C97B4A'),       // Jacinth-ish warm orange-brown
    read('--accent-2', '#5B6B3F'),
    '#B8C77A',
    '#D89B6A',
    '#7A8A8A',
    '#9CA3AF',
    '#4B4B4B'
  ];

}

function renderChart(pivot) {

  const canvas = document.getElementById('statsChart');
  const ctx = canvas?.getContext('2d');
  if (!ctx) return;

  if (CHART) { CHART.destroy(); CHART = null; }

  if (!pivot.rowKeys.length) return;

  const palette = getChartPalette();

  if (pivot.isCrossTab) {

    const datasets = pivot.columnKeys.map((ck, i) => ({
      label: ck,
      data: pivot.rowKeys.map(rk => (pivot.cells[rk][ck] || { count: 0 }).count),
      backgroundColor: palette[i % palette.length]
    }));

    CHART = new Chart(ctx, {
      type: 'bar',
      data: { labels: pivot.rowKeys, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: { y: { beginAtZero: true } },
        onClick: (evt, elements) => handleChartClick(elements, pivot)
      }
    });

  } else {

    const data = pivot.rowKeys.map(rk => pivot.rowTotals[rk]);
    const colors = pivot.rowKeys.map((_, i) => palette[i % palette.length]);

    CHART = new Chart(ctx, {
      type: CURRENT_CHART_TYPE,
      data: {
        labels: pivot.rowKeys,
        datasets: [{
          label: pivot.rowsField,
          data,
          backgroundColor: colors
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: CURRENT_CHART_TYPE === 'bar' ? { y: { beginAtZero: true } } : {},
        onClick: (evt, elements) => handleChartClick(elements, pivot)
      }
    });

  }

}

function handleChartClick(elements, pivot) {

  if (!elements || !elements.length) return;

  const el = elements[0];
  const rowKey = pivot.rowKeys[el.index];
  const colKey = pivot.isCrossTab
    ? pivot.columnKeys[el.datasetIndex]
    : window.PivotEngine.FLAT_COLUMN_KEY;

  showDrilldown(pivot, rowKey, colKey);

}

/* =========================
   TABLE (flat or cross-tab)
========================= */

function renderTable(pivot) {

  const wrap = document.getElementById('statsTableWrap');
  if (!wrap) return;

  if (!pivot.rowKeys.length) {
    wrap.innerHTML = '<div class="stats-empty">No data for this selection.</div>';
    return;
  }

  if (!pivot.isCrossTab) {

    const total = pivot.grandTotal;

    const rowsHtml = pivot.rowKeys.map(rk => {
      const count = pivot.rowTotals[rk];
      const pct = total ? ((count / total) * 100).toFixed(1) : '0.0';
      return `
        <tr class="clickable-row" data-row="${escapeAttr(rk)}" data-col="${window.PivotEngine.FLAT_COLUMN_KEY}">
          <td>${escapeHtml(rk)}</td>
          <td>${count}</td>
          <td>${pct}%</td>
        </tr>
      `;
    }).join('');

    wrap.innerHTML = `
      <table class="stats-table" id="statsTable">
        <thead>
          <tr><th>Value</th><th>Count</th><th>Percentage</th></tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    `;

  } else {

    const headCells = pivot.columnKeys.map(ck => `<th>${escapeHtml(ck)}</th>`).join('');

    const bodyRows = pivot.rowKeys.map(rk => {

      const cells = pivot.columnKeys.map(ck => {
        const cell = pivot.cells[rk][ck];
        const count = cell ? cell.count : 0;
        const clickable = count ? 'clickable-cell' : '';
        return `<td class="${clickable}" data-row="${escapeAttr(rk)}" data-col="${escapeAttr(ck)}">${count || '–'}</td>`;
      }).join('');

      return `
        <tr>
          <th class="row-head" data-row="${escapeAttr(rk)}" data-col="__row_total__">${escapeHtml(rk)}</th>
          ${cells}
          <td class="row-total">${pivot.rowTotals[rk]}</td>
        </tr>
      `;

    }).join('');

    const colTotalsRow = pivot.columnKeys
      .map(ck => `<td class="col-total">${pivot.columnTotals[ck] || 0}</td>`)
      .join('');

    wrap.innerHTML = `
      <table class="stats-table cross-tab" id="statsTable">
        <thead>
          <tr><th></th>${headCells}<th>Total</th></tr>
        </thead>
        <tbody>${bodyRows}</tbody>
        <tfoot>
          <tr><th>Total</th>${colTotalsRow}<td class="grand-total">${pivot.grandTotal}</td></tr>
        </tfoot>
      </table>
    `;

  }

  wrap.querySelectorAll('[data-row]').forEach(el => {
    el.addEventListener('click', () => {
      const rowKey = el.dataset.row;
      const colKey = el.dataset.col;
      if (colKey === '__row_total__') {
        showDrilldownForRow(pivot, rowKey);
      } else {
        showDrilldown(pivot, rowKey, colKey);
      }
    });
  });

}

/* =========================
   DRILL-DOWN
========================= */

function showDrilldown(pivot, rowKey, colKey) {

  const cell = pivot.cells[rowKey] && pivot.cells[rowKey][colKey];
  const records = cell ? cell.records : [];

  const colLabel = colKey === window.PivotEngine.FLAT_COLUMN_KEY ? null : colKey;

  renderDrilldownContent(pivot, rowKey, colLabel, records);

}

function showDrilldownForRow(pivot, rowKey) {

  const colMap = pivot.cells[rowKey] || {};
  const records = Object.values(colMap).reduce((acc, c) => acc.concat(c.records), []);

  renderDrilldownContent(pivot, rowKey, 'All Columns', records);

}

function renderDrilldownContent(pivot, rowKey, colLabel, records) {

  const content = document.getElementById('drilldownContent');
  if (!content) return;

  const drillFields = DRILL_FIELDS[CURRENT_DATASET] || [];
  const nameFields = NAME_FIELDS[CURRENT_DATASET] || [];
  const detailLink = DETAIL_LINKS[CURRENT_DATASET];

  const metaLines = [`<strong>${escapeHtml(pivot.rowsField)}:</strong> ${escapeHtml(rowKey)}`];
  if (colLabel) {
    metaLines.push(`<strong>${escapeHtml(pivot.columnsField)}:</strong> ${escapeHtml(colLabel)}`);
  }
  metaLines.push(`<strong>Records:</strong> ${records.length}`);

  const recordsHtml = records.map(record => {

    const nameVal = nameFields
      .map(f => (record[f] || '').toString().trim())
      .find(Boolean) || 'Unnamed';

    const secondary = drillFields
      .map(f => (record[f] || '').toString().trim())
      .filter(Boolean)
      .join(' · ');

    let primaryHtml = escapeHtml(nameVal);
    if (detailLink && record[detailLink.idField]) {
      const id = encodeURIComponent(record[detailLink.idField]);
      primaryHtml = `<a href="${detailLink.page}?id=${id}">${escapeHtml(nameVal)}</a>`;
    }

    return `
      <div class="drilldown-record">
        <span>${primaryHtml}</span>
        ${secondary ? `<span class="drilldown-record-sub">${escapeHtml(secondary)}</span>` : ''}
      </div>
    `;

  }).join('');

  content.innerHTML = `
    <div class="drilldown-meta">${metaLines.join('<br>')}</div>
    <div class="drilldown-list">
      ${recordsHtml || '<p class="stats-empty-hint">No records.</p>'}
    </div>
  `;

}

function clearDrilldown() {

  const content = document.getElementById('drilldownContent');
  if (!content) return;

  content.innerHTML = `
    <p class="stats-empty-hint">
      Click a bar, slice, or table cell to see the matching records.
    </p>
  `;

}

/* =========================
   QUICK STATS
========================= */

function renderQuickStats() {

  const grid = document.getElementById('quickStatsGrid');
  if (!grid) return;

  const sims = (DATA.sims || []).length;
  const pets = (DATA.pets || []).length;
  const worlds = (DATA.worlds || []).length;

  const lotRows = DATA.lots || [];
  const collapsedLots = window.PivotEngine.collapseLotsByParent(lotRows);
  const buildingCount = collapsedLots.length;
  const unitCount = lotRows.length;

  grid.innerHTML = `

    <div class="quick-stat">
      <strong>${sims}</strong>
      <span>Sims</span>
    </div>

    <div class="quick-stat">
      <strong>${pets}</strong>
      <span>Pets</span>
    </div>

    <div class="quick-stat">
      <strong>${worlds}</strong>
      <span>Worlds</span>
    </div>

    <div class="quick-stat">
      <strong>${buildingCount}</strong>
      <span>Lots</span>
    </div>

    <div class="quick-stat">
      <strong>${unitCount}</strong>
      <span>Lot Units</span>
    </div>

  `;

}

/* =========================
   HELPERS
========================= */

function escapeHtml(str) {
  return String(str).replace(/[&<>"]/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'
  }[c]));
}

function escapeAttr(str) {
  return escapeHtml(str);
}

/* =========================
   LOADING / ERROR
========================= */

function hideLoading() {
  const loading = document.getElementById('loadingScreen');
  if (loading) loading.style.display = 'none';
}

function showLoadError() {
  const loading = document.getElementById('loadingScreen');
  if (loading) {
    loading.textContent = 'Could not load statistics data. Check that the data/ CSV files are present.';
  }
}
