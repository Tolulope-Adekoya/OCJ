// sim.js — Individual sim detail page
// Updated: 2026-06-15 to use shared details.js helpers

let sim = null;
let galleryImages = [];
let galleryIndex = 0;
let petsData = [];

// Helper to find pets owned by sim from the pet field
function findPetFieldNames(row) {
  return Object.entries(row || {})
    .filter(([key, value]) => /pet/i.test(key) && String(value || '').trim())
    .map(([key, value]) => String(value).trim())
    .flatMap(value => value.split(',').map(p => p.trim()).filter(Boolean));
}

document.addEventListener('DOMContentLoaded', async () => {
  try {
    const simId = (window.Utils.getQueryParam('id') || '').trim();
    const [sims, pets] = await Promise.all([
      window.CSV.loadCSV('data/sims.csv'),
      window.CSV.loadCSV('data/pets.csv')
    ]);

    petsData = pets;
    
    // Find the sim by matching getRowId
    sim = sims.find(s => {
      const id = getRowId(s);
      return id && id.toLowerCase() === simId.toLowerCase();
    });

    if (!sim) {
      const error = document.getElementById('errorState');
      if (error) error.style.display = 'block';
      const loading = document.getElementById('loadingScreen');
      if (loading) loading.style.display = 'none';
      return;
    }

    document.title = `${getRowName(sim) || 'Sim'} — OCJ Save File`;
    const loading = document.getElementById('loadingScreen');
    if (loading) loading.style.display = 'none';

    renderHeader();
    setupGallery();
    renderAttrs();
    renderPets();
  } catch (error) {
    console.error('[sim.js]', error);
    const err = document.getElementById('errorState');
    if (err) err.style.display = 'block';
    const loading = document.getElementById('loadingScreen');
    if (loading) loading.style.display = 'none';
  }
});

/* ---------- Header ---------- */
function renderHeader() {
  const name = getRowName(sim) || 'Unknown';
  const id = getRowId(sim) || window.Utils.slugify(name);
  const world = getFieldValue(sim, /world/i);
  const criteria = [getFieldValue(sim, /age|group|gender/i)].filter(Boolean).join(' · ');
  const subtitle = [criteria, world].filter(Boolean).join(' · ');

  const simIdEl = document.getElementById('simId');
  const simNameEl = document.getElementById('simName');
  const simSubtitleEl = document.getElementById('simSubtitle');

  if (simIdEl) simIdEl.textContent = id.toUpperCase();
  if (simNameEl) simNameEl.textContent = window.Utils.escapeHTML(name);
  if (simSubtitleEl) simSubtitleEl.textContent = subtitle;
}

/* ---------- Gallery ---------- */
function setupGallery() {
  const folderId = getRowId(sim) || window.Utils.slugify(getRowName(sim) || 'sim');
  hydrateImageGallery(`sims/${window.Utils.sanitizeFolderName(folderId)}`).then(images => {
    galleryImages = images;
    renderGallery();
  });
}

function renderGallery() {
  const mainImage = document.getElementById('mainImage');
  const thumbsContainer = document.getElementById('galleryThumbs');
  const prevBtn = document.getElementById('prevImage');
  const nextBtn = document.getElementById('nextImage');
  const galleryRoot = mainImage?.closest('.gallery-main');
  const initials = window.Utils.getInitials(getRowName(sim) || 'Sim');

  if (!mainImage || !thumbsContainer) return;

  if (!galleryImages.length) {
    mainImage.style.display = 'none';
    if (galleryRoot && !galleryRoot.querySelector('.placeholder-img')) {
      const placeholder = document.createElement('div');
      placeholder.className = 'placeholder-img';
      placeholder.textContent = initials;
      galleryRoot.appendChild(placeholder);
    }
    thumbsContainer.innerHTML = '';
    return;
  }

  if (galleryRoot) {
    const placeholder = galleryRoot.querySelector('.placeholder-img');
    if (placeholder) placeholder.remove();
  }

  mainImage.style.display = '';

  function showSlide(index) {
    galleryIndex = (index + galleryImages.length) % galleryImages.length;
    mainImage.src = galleryImages[galleryIndex];
    thumbsContainer.querySelectorAll('.gallery-thumb').forEach((thumb, idx) => {
      thumb.classList.toggle('active', idx === galleryIndex);
    });
  }

  thumbsContainer.innerHTML = galleryImages.map((src, idx) => `
    <img src="${window.Utils.escapeHTML(src)}" alt="${window.Utils.escapeHTML(getRowName(sim) || 'Sim')} photo ${idx + 1}" class="gallery-thumb ${idx === 0 ? 'active' : ''}" data-index="${idx}" loading="lazy" />
  `).join('');

  thumbsContainer.querySelectorAll('.gallery-thumb').forEach(thumb => {
    thumb.addEventListener('click', () => showSlide(Number(thumb.dataset.index)));
  });

  prevBtn?.addEventListener('click', () => showSlide(galleryIndex - 1));
  nextBtn?.addEventListener('click', () => showSlide(galleryIndex + 1));

  document.addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft') showSlide(galleryIndex - 1);
    if (e.key === 'ArrowRight') showSlide(galleryIndex + 1);
  });

  showSlide(0);
}

/* ---------- Attributes ---------- */
function renderAttrs() {
  const container = document.getElementById('simAttributes');
  if (!container) return;

  const idKey = findFieldKey(sim, /\b(?:world|lot|sim|pet)?[\s_-]*id\b/i);
  const nameKey = findFieldKey(sim, /\b(?:name|title)\b/i);
  const html = Object.entries(sim)
    .filter(([key, value]) => {
      const text = String(value || '').trim();
      return text && key !== idKey && key !== nameKey;
    })
    .map(([key, value]) => `
      <div class="attribute-card">
        <div class="attribute-card-title">${window.Utils.escapeHTML(key)}</div>
        <div class="attribute-row">
          <div class="attribute-key">${window.Utils.escapeHTML(key)}</div>
          <div class="attribute-value text-clamp">${window.Utils.escapeHTML(value)}</div>
        </div>
      </div>
    `)
    .join('');

  container.innerHTML = html || '<p class="no-attrs">No attributes recorded.</p>';
  setupTextClamp();
}

/* ---------- Pets ---------- */
function getPetOwnerIds(pet) {
  return Object.keys(pet)
    .filter(key => /(?:sim|owner)[\s_-]*id/i.test(key))
    .flatMap(key => String(pet[key] || '').split(/[;,]/).map(value => value.trim()).filter(Boolean));
}

function renderPets() {
  const petsSection = document.getElementById('petsSection');
  const petsGrid = document.getElementById('petsGrid');
  if (!petsSection || !petsGrid) return;

  const simId = getRowId(sim).toLowerCase();
  const ownedPets = simId
    ? petsData.filter(pet => getPetOwnerIds(pet).some(ownerId => ownerId.toLowerCase() === simId))
    : [];

  const petNames = findPetFieldNames(sim);
  const petsToShow = ownedPets.length
    ? ownedPets
    : petNames.map(name => {
        const record = petsData.find(p => getRowName(p).toLowerCase() === name.toLowerCase());
        return record || { [findFieldKey(petsData[0]||{}, /pet.*id\b/i) || 'PET_ID']: window.Utils.slugify(name), [findFieldKey(petsData[0]||{}, /\bname\b/i) || 'NAME']: name };
      });

  if (!petsToShow.length) {
    petsSection.style.display = 'none';
    return;
  }

  petsSection.style.display = '';
  petsGrid.innerHTML = petsToShow.map(pet => {
    const petId = getRowId(pet) || window.Utils.slugify(getRowName(pet) || 'pet');
    const petName = getRowName(pet) || 'Unknown Pet';
    const species = getFieldValue(pet, /species/i);
    const age = getFieldValue(pet, /age/i);
    const initials = window.Utils.getInitials(petName).slice(0, 2).toUpperCase();
    const src = `image/pets/${window.Utils.sanitizeFolderName(petId)}/portrait.png`;

    return `
      <a href="pet.html?id=${encodeURIComponent(petId)}" class="pet-card">
        <div class="pet-icon"><img src="${window.Utils.escapeHTML(src)}" data-pet-id="${window.Utils.escapeHTML(petId)}" data-initials="${window.Utils.escapeHTML(initials)}" alt="${window.Utils.escapeHTML(petName)}" loading="lazy" /></div>
        <div>
          <div class="pet-name">${window.Utils.escapeHTML(petName)}</div>
          ${species ? `<div class="pet-meta">${window.Utils.escapeHTML(species)}</div>` : ''}
          ${age ? `<div class="pet-meta">${window.Utils.escapeHTML(age)}</div>` : ''}
        </div>
      </a>
    `;
  }).join('');

  petsGrid.querySelectorAll('img[data-pet-id]').forEach(img => {
    const petId = img.dataset.petId;
    const initials = img.dataset.initials || '';
    const primaryBase = `image/pets/${window.Utils.sanitizeFolderName(petId)}/portrait`;
    const defaultBase = window.Utils.defaultEntityImagePath('pets', 'profile');
    const fallbacks = window.Utils.imageFallbackSources(primaryBase, defaultBase);
    img.dataset.initials = initials;
    window.Utils.imgWithFallback(img, fallbacks);
  });
}

function setupTextClamp() {
  document.querySelectorAll('.text-clamp').forEach(element => {
    element.style.cursor = 'pointer';
    element.addEventListener('click', () => {
      element.classList.toggle('expanded');
    });
  });
}
