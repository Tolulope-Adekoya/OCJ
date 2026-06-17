// world.js — World detail page logic

document.addEventListener('DOMContentLoaded', async () => {
  try {
    const worldId = (window.Utils.getQueryParam('id') || '').trim();
    const [worlds, lots] = await Promise.all([
      window.CSV.loadCSV('data/worlds.csv'),
      window.CSV.loadCSV('data/lots.csv')
    ]);

    const world = worlds.find(w => {
      const id = getRowId(w);
      return id && id.toLowerCase() === worldId.toLowerCase();
    });

    const loading = document.getElementById('loadingScreen');
    if (loading) loading.style.display = 'none';

    if (!world) {
      document.getElementById('errorState').style.display = 'block';
      return;
    }

    renderWorld(world);
    const worldLots = lots.filter(lot => ((lot['WORLD'] || '').trim().toLowerCase() === (world['WORLD'] || '').trim().toLowerCase()));
    renderWorldLots(worldLots);
  } catch (error) {
    console.error('[world.js]', error);
    document.getElementById('errorState').style.display = 'block';
    document.getElementById('loadingScreen').style.display = 'none';
  }
});

function renderWorld(world) {
  const title = getRowName(world) || 'World';
  const subtitle = (world['DESCRIPTION'] || '').split('\n')[0].trim();
  document.title = `${title} — OCJ Save File`;
  document.getElementById('worldTitle').textContent = title;
  document.getElementById('worldDescription').textContent = (world['DESCRIPTION'] || '').trim();

  // worldDetails is now used for the lot grid only; no world detail panel is rendered here.

  const mapImg = document.getElementById('worldMapImg');
  const worldId = getRowId(world) || window.Utils.slugify(title);
  const folderName = `worlds/${window.Utils.sanitizeFolderName(worldId)}`;
  findFolderImage(folderName, 'map').then(src => {
    if (src) {
      mapImg.src = src;
      return;
    }
    const fallbackSources = window.Utils.imageFallbackSources(`image/${folderName}/map`, window.Utils.defaultEntityImagePath('worlds', 'profile'));
    mapImg.dataset.initials = window.Utils.getInitials(title);
    window.Utils.imgWithFallback(mapImg, fallbackSources);
  }).catch(() => {
    const fallbackSources = window.Utils.imageFallbackSources(`image/${folderName}/map`, window.Utils.defaultEntityImagePath('worlds', 'profile'));
    mapImg.dataset.initials = window.Utils.getInitials(title);
    window.Utils.imgWithFallback(mapImg, fallbackSources);
  });
}

function renderWorldLots(lots) {
  const lotGrid = document.getElementById('worldDetails');
  const empty = document.getElementById('worldLotsEmpty');
  const cards = buildLotUnits(lots).map(({ rootLot, units }) => {
    if (!rootLot) return '';
    return renderLotCard({ rootLot, units });
  }).join('');

  lotGrid.innerHTML = cards;
  empty.style.display = cards ? 'none' : 'block';
  attachLotImageFallbacks();
}
