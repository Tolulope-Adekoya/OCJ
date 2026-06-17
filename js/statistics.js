// statistics.js

const DATASETS = {

  sims: {
    file: 'data/sims.csv',
    exclude: [
      'SIM_ID',
      'NAME',
      'DESCRIPTION',
      'LORE'
    ]
  },

  lots: {
    file: 'data/lots.csv',
    exclude: [
      'LOT ID',
      'PARENT LOT ID',
      'LOT NEW NAME',
      'LOT ORIGINAL NAME',
      'LOT DESCRIPTION',
      'HOUSEHOLD DESCRIPTION',
      'LOTS CC'
    ]
  },

  worlds: {
    file: 'data/worlds.csv',
    exclude: [
      'WORLD ID',
      'DESCRIPTION'
    ]
  },

  pets: {
    file: 'data/pets.csv',
    exclude: [
      'SIM_ID',
      'NAME'
    ]
  }

};

let DATA = {};
let CURRENT_DATASET = 'sims';
let CURRENT_ATTRIBUTE = '';
let CHART = null;

document.addEventListener('DOMContentLoaded', init);

async function init() {

  try {

    DATA.sims =
      await window.CSV.loadCSV(
        DATASETS.sims.file
      );

    DATA.lots =
      await window.CSV.loadCSV(
        DATASETS.lots.file
      );

    DATA.worlds =
      await window.CSV.loadCSV(
        DATASETS.worlds.file
      );

    DATA.pets =
      await window.CSV.loadCSV(
        DATASETS.pets.file
      );

    setupDatasetButtons();

    setupControls();

    renderQuickStats();

    populateAttributes();

    updateStatistics();

    hideLoading();

  } catch (err) {

    console.error(err);

  }

}

/* =========================
   DATASET BUTTONS
========================= */

function setupDatasetButtons() {

  document
    .querySelectorAll('.dataset-btn')
    .forEach(btn => {

      btn.addEventListener(
        'click',
        () => {

          document
            .querySelectorAll('.dataset-btn')
            .forEach(b =>
              b.classList.remove('active')
            );

          btn.classList.add('active');

          CURRENT_DATASET =
            btn.dataset.dataset;

          populateAttributes();

          updateStatistics();
          renderQuickStats();

        }
      );

    });

}

/* =========================
   CONTROLS
========================= */

function setupControls() {

  document
    .getElementById('attributeSelect')
    ?.addEventListener(
      'change',
      e => {

        CURRENT_ATTRIBUTE =
          e.target.value;

        updateStatistics();

      }
    );

  document
    .getElementById('chartType')
    ?.addEventListener(
      'change',
      updateStatistics
    );

  document
    .getElementById('topN')
    ?.addEventListener(
      'change',
      updateStatistics
    );

}

/* =========================
   ATTRIBUTES
========================= */

function populateAttributes() {

  const select =
    document.getElementById(
      'attributeSelect'
    );

  if (!select) return;

  const rows =
    DATA[CURRENT_DATASET] || [];

  if (!rows.length) {

    select.innerHTML = '';

    return;

  }

  const headers =
    Object.keys(rows[0])

      .filter(header =>

        !DATASETS[
          CURRENT_DATASET
        ].exclude.includes(header)

      );

  select.innerHTML =
    headers.map(h => `
      <option value="${h}">
        ${h}
      </option>
    `).join('');

  CURRENT_ATTRIBUTE =
    headers[0] || '';

}

/* =========================
   MAIN UPDATE
========================= */

function updateStatistics() {

  if (!CURRENT_ATTRIBUTE)
    return;

  const counts =
    getCounts();

  renderSummary(counts);

  renderChart(counts);

  renderTable(counts);

}

/* =========================
   COUNT VALUES
========================= */

function getCounts() {

  const rows =
    DATA[CURRENT_DATASET] || [];

  const map = {};

  rows.forEach(row => {

    let value =
      row[CURRENT_ATTRIBUTE];

    if (
      value === null ||
      value === undefined ||
      value === ''
    ) {

      value = 'Unknown';

    }

    map[value] =
      (map[value] || 0) + 1;

  });

  let entries =
    Object.entries(map)

      .sort(
        (a, b) =>
          b[1] - a[1]
      );

  const topN =
    document
      .getElementById('topN')
      ?.value;

  if (
    topN &&
    topN !== 'all'
  ) {

    entries =
      entries.slice(
        0,
        Number(topN)
      );

  }

  return entries;

}

/* =========================
   SUMMARY
========================= */

function renderSummary(entries) {

  const el =
    document.getElementById(
      'statsSummary'
    );

  if (!el) return;

  const total =
    entries.reduce(
      (sum, e) =>
        sum + e[1],
      0
    );

  el.innerHTML = `

    <div class="summary-card">
      Dataset:
      <strong>
        ${CURRENT_DATASET}
      </strong>
    </div>

    <div class="summary-card">
      Attribute:
      <strong>
        ${CURRENT_ATTRIBUTE}
      </strong>
    </div>

    <div class="summary-card">
      Categories:
      <strong>
        ${entries.length}
      </strong>
    </div>

    <div class="summary-card">
      Records:
      <strong>
        ${total}
      </strong>
    </div>

  `;

}

/* =========================
   CHART
========================= */

function renderChart(entries) {

  const ctx =
    document
      .getElementById('statsChart')
      ?.getContext('2d');

  if (!ctx) return;

  const labels =
    entries.map(e => e[0]);

  const values =
    entries.map(e => e[1]);

  if (CHART) {

    CHART.destroy();

  }

  const chartType =
    document
      .getElementById('chartType')
      ?.value || 'bar';

  CHART =
    new Chart(ctx, {

      type: chartType,

      data: {

        labels,

        datasets: [

          {
            label:
              CURRENT_ATTRIBUTE,

            data: values
          }

        ]

      },

      options: {

        responsive: true,

        maintainAspectRatio:
          false

      }

    });

}

/* =========================
   TABLE
========================= */

function renderTable(entries) {

  const tbody =
    document.querySelector(
      '#statsTable tbody'
    );

  if (!tbody) return;

  const total =
    entries.reduce(
      (sum, e) =>
        sum + e[1],
      0
    );

  tbody.innerHTML =
    entries.map(([value, count]) => {

      const pct =
        total
          ? (
              count /
              total *
              100
            ).toFixed(1)
          : 0;

      return `
        <tr>

          <td>${value}</td>

          <td>${count}</td>

          <td>${pct}%</td>

        </tr>
      `;

    }).join('');

}

/* =========================
   QUICK STATS
========================= */

function renderQuickStats() {

  const grid =
    document.getElementById(
      'quickStatsGrid'
    );

  if (!grid) return;

  const sims =
    DATA.sims.length;

  const pets =
    DATA.pets.length;

  const worlds =
    DATA.worlds.length;

  const lots =
    DATA.lots.filter(
      lot =>
        !(lot['PARENT LOT ID'] || '')
          .trim()
    ).length;

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
      <strong>${lots}</strong>
      <span>Lots</span>
    </div>

  `;

}

/* =========================
   LOADING
========================= */

function hideLoading() {

  const loading =
    document.getElementById(
      'loadingScreen'
    );

  if (loading) {

    loading.style.display =
      'none';

  }

}