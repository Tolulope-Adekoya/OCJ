// lot.js — Lot detail page logic

let lot = null;
let galleryImages = [];

function getLotById(id, lots) {
  if (!id) return null;
  const normalized = id.trim().toLowerCase();
  return lots.find(l => {
    const lotId = getRowId(l).toLowerCase();
    return lotId && lotId === normalized;
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  try {
    const lotId = (window.Utils.getQueryParam('id') || '').trim();
    const lots = await window.CSV.loadCSV('data/lots.csv');
    lot = getLotById(lotId, lots);
    if (!lot) {
      document.getElementById('loadingScreen').style.display = 'none';
      document.getElementById('errorState').style.display = 'block';
      return;
    }

    document.getElementById('loadingScreen').style.display = 'none';
    renderLot(lot, lots);
  } catch (error) {
    console.error('[lot.js]', error);
    document.getElementById('loadingScreen').style.display = 'none';
    document.getElementById('errorState').style.display = 'block';
  }
});

function renderLot(lot, lots) {
  const title = getRowName(lot) || 'Lot';
  const subtitle = getRowId(lot);
  document.title = `${title} — OCJ Save File`;
  document.getElementById('lotTitle').textContent = title;
  document.getElementById('lotSubtitle').textContent = subtitle;
  renderAttributeCards('lotAttributes', lot, ['LOT ID', 'PARENT LOT ID', 'LOT NEW NAME', 'LOT ORIGINAL NAME']);

  const imageFolder = `lots/${window.Utils.sanitizeFolderName(getRowId(lot))}`;
  hydrateImageGallery(imageFolder).then(images => {
    renderGalleryImages(images, 'mainImage', 'galleryThumbs', 'prevImage', 'nextImage', title);
  });

  const units = buildLotUnits(lots);
  const parentId = getRowId(lot);
  const unitGroup = units.find(group => {
    if (getRowId(group.rootLot) === parentId) return true;
    return group.units.some(child => getRowId(child) === parentId);
  });

  const unitSection = document.getElementById('lotUnitSection');
  if (unitGroup && (unitGroup.units.length || unitGroup.rootLot !== lot)) {
    const allUnits = [unitGroup.rootLot, ...unitGroup.units].map(unit => ({
      id: getRowId(unit),
      name: getRowName(unit),
    }));
    unitSection.innerHTML = `
      <div class="lot-card-unit-list">
        ${allUnits.map(unit => `
          <a href="lot.html?id=${encodeURIComponent(unit.id)}" class="unit-link">${window.Utils.escapeHTML(unit.name || unit.id)}</a>
        `).join('')}
      </div>
    `;
  } else {
    unitSection.innerHTML = '<p class="no-attrs">This lot is a standalone property.</p>';
  }

  const ccText = getFieldValue(lot, /cc|lots cc|cc used/i);
  renderCcList('ccList', ccText);
}
