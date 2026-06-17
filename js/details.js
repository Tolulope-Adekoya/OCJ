// Shared detail helpers for world, lot, sim, and pet pages

function findFieldKey(row, regex) {
  return Object.keys(row || {}).find(key => regex.test(key));
}

function getIdKey(row) {
  // Check specific entity IDs first (in priority order), then generic ID
  // This ensures we get the entity's own ID, not a foreign key (e.g., PET_ID not SIM_ID)
  const explicitKeys = ['PET_ID', 'PET ID', 'LOT_ID', 'LOT ID', 'SIM_ID', 'SIM ID', 'WORLD_ID', 'WORLD ID', 'ID'];
  for (const key of explicitKeys) {
    if (row[key] && String(row[key]).trim()) return key;
  }
  return findFieldKey(row, /\b(?:world|lot|sim|pet)?[\s_-]*id\b/i) || findFieldKey(row, /\bid\b/i);
}

function getRowId(row) {
  const idKey = getIdKey(row);
  return (idKey && row[idKey]) ? String(row[idKey]).trim() : '';
}

function getRowName(row) {
  if (!row) return '';
  const preferred = ['NAME', 'WORLD', 'LOT NEW NAME', 'LOT ORIGINAL NAME', 'TITLE'];
  for (const key of preferred) {
    if (row[key] && String(row[key]).trim()) {
      return String(row[key]).trim();
    }
  }
  const key = findFieldKey(row, /\b(?:name|title|world)\b/i);
  return (key && row[key]) ? String(row[key]).trim() : '';
}

function getFieldValue(row, regex) {
  const key = findFieldKey(row, regex);
  return (key && row[key]) ? String(row[key]).trim() : '';
}

function buildFolderCandidates(folderName) {
  const folderId = folderName.split('/').pop() || '';
  const names = new Set(['portrait', folderId]);

  if (folderId) {
    for (let i = 1; i <= 16; i++) {
      names.add(`${folderId} ${i}`);
      names.add(`${folderId}-${i}`);
      names.add(`${folderId}_${i}`);
      names.add(`${folderId} (${i})`);
      names.add(`${folderId} ${String(i).padStart(2, '0')}`);
      names.add(`${i}`);
      names.add(String(i).padStart(2, '0'));
      for (let duplicate = 2; duplicate <= 4; duplicate++) {
        names.add(`${folderId} ${i} (${duplicate})`);
      }
    }
  }

  const extensions = ['png', 'jpg', 'jpeg', 'webp'];
  return [...names].flatMap(name => extensions.map(ext => `image/${folderName}/${name}.${ext}`));
}

function hydrateImageGallery(folderName) {
  return fetch(`image/${folderName}/`)
    .then(response => {
      if (!response.ok) throw new Error('Directory listing unavailable');
      return response.text();
    })
    .then(html => {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const images = Array.from(doc.querySelectorAll('a'))
        .map(link => link.getAttribute('href') || '')
        .filter(name => /\.(png|jpe?g|webp)$/i.test(name))
        .map(name => `image/${folderName}/${name}`);

      if (images.length) {
        return [...new Set(images)];
      }

      throw new Error('No images found in folder listing');
    })
    .catch(() => {
      const candidates = buildFolderCandidates(folderName);
      return Promise.all(candidates.map(src => new Promise(resolve => {
        const img = new Image();
        img.onload = () => resolve(src);
        img.onerror = () => resolve(null);
        img.src = src;  // Don't double-encode here; src is already a proper path
      }))).then(r => [...new Set(r.filter(Boolean))]);
    });
}

function findFolderImage(folderName, keyword) {
  return fetch(`image/${folderName}/`)
    .then(response => {
      if (!response.ok) throw new Error('Directory listing unavailable');
      return response.text();
    })
    .then(html => {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const images = Array.from(doc.querySelectorAll('a'))
        .map(link => link.getAttribute('href') || '')
        .filter(name => /\.(png|jpe?g|webp)$/i.test(name));

      const match = images.find(name => name.toLowerCase().includes(keyword.toLowerCase()));
      if (match) return `image/${folderName}/${match}`;
      return images.length ? `image/${folderName}/${images[0]}` : null;
    })
    .catch(() => null);
}

function renderGalleryImages(images, mainImageId, thumbsId, prevBtnId, nextBtnId, title = '') {
  const mainImage = document.getElementById(mainImageId);
  const thumbsContainer = document.getElementById(thumbsId);
  const prevBtn = document.getElementById(prevBtnId);
  const nextBtn = document.getElementById(nextBtnId);
  if (!mainImage || !thumbsContainer) return;

  let currentIndex = 0;
  const galleryImages = images || [];

  const galleryRoot = mainImage.closest('.gallery-main');
  const initials = window.Utils.getInitials(title || 'Image');

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
    currentIndex = (index + galleryImages.length) % galleryImages.length;
    mainImage.src = galleryImages[currentIndex];
    thumbsContainer.querySelectorAll('.gallery-thumb').forEach((thumb, idx) => {
      thumb.classList.toggle('active', idx === currentIndex);
    });
  }

  thumbsContainer.innerHTML = galleryImages.map((src, idx) => `
    <img src="${window.Utils.escapeHTML(src)}" alt="${window.Utils.escapeHTML(title)} photo ${idx + 1}" class="gallery-thumb ${idx === 0 ? 'active' : ''}" data-index="${idx}" loading="lazy" />
  `).join('');

  thumbsContainer.querySelectorAll('.gallery-thumb').forEach(thumb => {
    thumb.addEventListener('click', () => showSlide(Number(thumb.dataset.index)));
  });

  prevBtn?.addEventListener('click', () => showSlide(currentIndex - 1));
  nextBtn?.addEventListener('click', () => showSlide(currentIndex + 1));

  document.addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft') showSlide(currentIndex - 1);
    if (e.key === 'ArrowRight') showSlide(currentIndex + 1);
  });

  showSlide(0);
}

function renderAttributeCards(containerId, row, omitKeys = []) {
  const container = document.getElementById(containerId);
  if (!container || !row) return;
  const idKey = getIdKey(row);
  const nameKey = findFieldKey(row, /\b(?:name|title)\b/i);
  const html = Object.entries(row)
    .filter(([key, value]) => {
      const text = String(value || '').trim();
      if (!text) return false;
      if (omitKeys.includes(key)) return false;
      if (key === idKey || key === nameKey) return false;
      return true;
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

  document.querySelectorAll(`#${containerId} .text-clamp`).forEach(element => {
    element.style.cursor = 'pointer';
    element.addEventListener('click', () => element.classList.toggle('expanded'));
  });
}

function renderCcList(containerId, ccText) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const items = String(ccText || '').split(/[,\n]/).map(item => item.trim()).filter(Boolean);
  container.innerHTML = items.length ? items.map(item => `<li>${window.Utils.escapeHTML(item)}</li>`).join('') : '<li>None recorded.</li>';
}

function buildLotUnits(lots) {
  const childUnitsMap = new Map();
  const rootLots = new Map();

  lots.forEach(lot => {
    const id = getRowId(lot);
    const parentId = (lot['PARENT LOT ID'] || lot['PARENT_LOT_ID'] || '').trim();
    if (parentId) {
      const list = childUnitsMap.get(parentId) || [];
      list.push(lot);
      childUnitsMap.set(parentId, list);
    } else {
      rootLots.set(id, lot);
    }
  });

  const cards = [];

  rootLots.forEach((rootLot, rootId) => {
    const units = childUnitsMap.get(rootId) || [];
    units.sort((a, b) => getRowName(a).localeCompare(getRowName(b)));
    cards.push({ rootLot, units });
  });

  childUnitsMap.forEach((units, parentId) => {
    if (rootLots.has(parentId)) return;
    const rootLot = units[0];
    units.sort((a, b) => getRowName(a).localeCompare(getRowName(b)));
    cards.push({ rootLot, units });
  });

  return cards;
}

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.detail-back-button').forEach(button => {
    button.addEventListener('click', () => {
      if (window.history.length > 1) {
        window.history.back();
      } else {
        window.location.href = 'index.html';
      }
    });
  });
});

function renderLotCardMini(lot, units = []) {
  const lotId = getRowId(lot);
  const lotName = getRowName(lot) || 'Unnamed lot';
  const world = (lot['WORLD'] || '').trim();
  const type = (lot['LOT TYPE'] || '').trim();
  const imageSrc = `image/lots/${window.Utils.sanitizeFolderName(lotId)}/portrait.png`;

  const unitLinks = units.length ? units.map(unit => {
    const uid = getRowId(unit);
    return `<a href="lot.html?id=${encodeURIComponent(uid)}" class="unit-link">${window.Utils.escapeHTML(getRowName(unit) || uid)}</a>`;
  }).join('') : '';

  return `
    <a href="lot.html?id=${encodeURIComponent(lotId)}" class="lot-card-mini">
      <div class="lot-card-preview">
        <img src="${window.Utils.escapeHTML(imageSrc)}" alt="${window.Utils.escapeHTML(lotName)}" loading="lazy" />
      </div>
      <div class="lot-card-body">
        <div class="lot-card-title">${window.Utils.escapeHTML(lotName)}</div>
        <div class="lot-card-meta">${window.Utils.escapeHTML(type)}${world ? ` · ${window.Utils.escapeHTML(world)}` : ''}</div>
        ${unitLinks ? `<div class="lot-card-unit-list">${unitLinks}</div>` : ''}
      </div>
    </a>
  `;
}

function attachImageFallbacks(selector, folder, defaultEntity, initialsField) {
  document.querySelectorAll(selector).forEach(img => {
    const entityId = img.dataset.entityId;
    const primaryBase = `image/${folder}/${window.Utils.sanitizeFolderName(entityId)}/portrait`;
    const defaultBase = window.Utils.defaultEntityImagePath(defaultEntity, 'profile');
    const fallbacks = window.Utils.imageFallbackSources(primaryBase, defaultBase);
    img.dataset.initials = img.dataset.initials || initialsField;
    window.Utils.imgWithFallback(img, fallbacks);
  });
}