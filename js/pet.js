// pet.js — Pet detail page logic

document.addEventListener('DOMContentLoaded', async () => {
  try {
    const petId = (window.Utils.getQueryParam('id') || '').trim();
    const [pets, sims] = await Promise.all([
      window.CSV.loadCSV('data/pets.csv'),
      window.CSV.loadCSV('data/sims.csv')
    ]);

    const pet = pets.find(p => {
      const id = getRowId(p);
      return id && id.toLowerCase() === petId.toLowerCase();
    });

    document.getElementById('loadingScreen').style.display = 'none';
    if (!pet) {
      document.getElementById('errorState').style.display = 'block';
      return;
    }

    renderPet(pet, sims);
  } catch (error) {
    console.error('[pet.js]', error);
    document.getElementById('loadingScreen').style.display = 'none';
    document.getElementById('errorState').style.display = 'block';
  }
});

function renderPet(pet, sims) {
  const title = getRowName(pet) || 'Pet';
  const id = getRowId(pet);
  const ownerIdKey = Object.keys(pet).find(key => /(?:sim|owner)[\s_-]*id/i.test(key));
  
  document.title = `${title} — OCJ Save File`;
  document.getElementById('petTitle').textContent = title;
  document.getElementById('petSubtitle').textContent = id;
  
  // Render attributes, omitting ID, NAME, and OWNER_ID/SIM_ID fields
  const omitKeys = [ownerIdKey].filter(Boolean);
  renderAttributeCards('petAttributes', pet, omitKeys);

  const imageFolder = `pets/${window.Utils.sanitizeFolderName(id)}`;
  hydrateImageGallery(imageFolder).then(images => {
    renderGalleryImages(images, 'mainImage', 'galleryThumbs', 'prevImage', 'nextImage', title);
  });

  // Render owner section
  const ownerIds = String(ownerIdKey ? pet[ownerIdKey] : '').split(/[;,]/).map(v => v.trim()).filter(Boolean);
  const ownerSection = document.getElementById('petOwners');
  if (ownerIds.length) {
    const ownerLinks = ownerIds.map(ownerId => {
      const owner = sims.find(sim => getRowId(sim).toLowerCase() === ownerId.toLowerCase());
      return owner ? `<a href="sim.html?id=${encodeURIComponent(getRowId(owner))}" class="entity-link">${window.Utils.escapeHTML(getRowName(owner) || getRowId(owner))}</a>` : window.Utils.escapeHTML(ownerId);
    }).join(', ');
    ownerSection.innerHTML = ownerLinks;
  } else {
    ownerSection.innerHTML = '<span>Unknown owner</span>';
  }
}
