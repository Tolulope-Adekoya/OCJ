// pets.js

let ALL_PETS = [];
let ALL_SIMS = [];
let FILTERED_PETS = [];

document.addEventListener('DOMContentLoaded', async () => {
  try {
    const [pets, sims] = await Promise.all([
      window.CSV.loadCSV('data/pets.csv'),
      window.CSV.loadCSV('data/sims.csv')
    ]);

    ALL_PETS = pets.filter(pet => getPetName(pet));
    ALL_SIMS = sims;

    setupSearch();
    applySearch();
  } catch (err) {
    console.error('[pets.js]', err);
  }
});

/* =========================
   SEARCH
========================= */

function setupSearch() {
  const input = document.getElementById('petSearch');
  if (!input) return;
  input.addEventListener('input', applySearch);
}

function applySearch() {
  const search = document.getElementById('petSearch')?.value.trim().toLowerCase() || '';

  FILTERED_PETS = ALL_PETS.filter(pet => {
    const name = getPetName(pet).toLowerCase();
    const species = ((pet['SPECIES'] || '')).toLowerCase();
    const world = ((pet['WORLD'] || '')).toLowerCase();
    const ownerId = ((pet['SIM_ID'] || '')).trim().toLowerCase();
    const ownerName = getSimName(ownerId).toLowerCase();

    return (
      !search ||
      name.includes(search) ||
      species.includes(search) ||
      world.includes(search) ||
      ownerName.includes(search)
    );
  });

  renderPets();
  updateCount();
}

/* =========================
   RENDER
========================= */

function renderPets() {
  const grid = document.getElementById('petGrid');
  const empty = document.getElementById('emptyState');
  if (!grid) return;

  if (!FILTERED_PETS.length) {
    grid.innerHTML = '';
    if (empty) empty.style.display = 'block';
    return;
  }

  if (empty) empty.style.display = 'none';
  grid.innerHTML = FILTERED_PETS.map(renderPetCard).join('');
  attachPetImageFallbacks();
}

function attachPetImageFallbacks() {
  const imgs = document.querySelectorAll('.pet-card img[data-pet-id]');
  imgs.forEach(img => {
    const petId = img.dataset.petId;
    const initials = img.dataset.initials || '';
    const primaryBase = `image/pets/${window.Utils.sanitizeFolderName(petId)}/portrait`;
    const defaultBase = window.Utils.defaultEntityImagePath('pets', 'profile');
    const fallbacks = window.Utils.imageFallbackSources(primaryBase, defaultBase);
    img.dataset.initials = initials;
    window.Utils.imgWithFallback(img, fallbacks);
  });
}

function renderPetCard(pet) {
  const petId = ((pet['PET_ID'] || '') || window.Utils.slugify(getPetName(pet))).trim();
  const name = getPetName(pet);
  const species = (pet['SPECIES'] || '').trim();
  const age = (pet['AGE GROUP'] || '').trim();
  const ownerId = ((pet['SIM_ID'] || '')).trim();
  const ownerName = getSimName(ownerId);
  const initials = window.Utils.getInitials(name);
  const src = `image/pets/${window.Utils.sanitizeFolderName(petId)}/portrait.png`;

  return `
    <a href="pet.html?id=${encodeURIComponent(petId)}" class="pet-card">
      <div class="pet-portrait">
        <img src="${window.Utils.escapeHTML(src)}" data-pet-id="${window.Utils.escapeHTML(petId)}" data-initials="${window.Utils.escapeHTML(initials)}" alt="${window.Utils.escapeHTML(name)}" loading="lazy" />
      </div>
      <div class="pet-info">
        <div class="pet-name">${window.Utils.escapeHTML(name)}</div>
        ${species ? `<div class="pet-owner">${window.Utils.escapeHTML(species)}</div>` : ''}
        ${age ? `<div class="pet-household">${window.Utils.escapeHTML(age)}</div>` : ''}
        ${ownerName ? `<div class="pet-owner">Owner: ${window.Utils.escapeHTML(ownerName)}</div>` : ''}
      </div>
    </a>
  `;
}

/* =========================
   COUNT
========================= */

function updateCount() {
  const el = document.getElementById('petCount');
  if (!el) return;
  const count = FILTERED_PETS.length;
  el.textContent = `${count} Pet${count === 1 ? '' : 's'}`;
}

/* =========================
   HELPERS
========================= */

function getPetName(pet) {
  return ((pet['NAME'] || '')).trim();
}

function getSimName(simId) {
  if (!simId) return '';
  const sim = ALL_SIMS.find(s => ((s['SIM_ID'] || '').trim().toLowerCase() === simId.toLowerCase()));
  return (sim && sim['NAME']) ? sim['NAME'].trim() : '';
}
