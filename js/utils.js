// utils.js — Shared utility functions for the OCJ Save File site

window.Utils = {

  /* ---------- String ---------- */
  escapeHTML(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  },

  slugify(str) {
    return String(str)
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  },

  getInitials(name) {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0][0].toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  },

  debounce(fn, delay) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  },

  getQueryParam(key) {
    const params = new URLSearchParams(window.location.search);
    return params.get(key);
  },

  uniqueSorted(rows, field) {
    const vals = new Set();
    rows.forEach(r => {
      const v = (r[field] || '').trim();
      if (v) vals.add(v);
    });
    return [...vals].sort();
  },

  /* ---------- Image paths ---------- */
  sanitizeFolderName(nameOrId) {
    const value = String(nameOrId || '').trim();
    if (!value) return 'unknown';
    if (/^[A-Za-z0-9_-]+$/.test(value)) return value;
    return value.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/(^_+|_+$)/g, '');
  },

  simImagePath(nameOrId, index) {
    const folder = this.sanitizeFolderName(nameOrId);
    if (index === 0) return `image/sims/${folder}/portrait.png`;
    const n = String(index).padStart(2, '0');
    return `image/sims/${folder}/${n}.png`;
  },

  petImagePath(nameOrId, index) {
    const folder = this.sanitizeFolderName(nameOrId);
    if (index === 0) return `image/pets/${folder}/portrait.png`;
    const n = String(index).padStart(2, '0');
    return `image/pets/${folder}/${n}.png`;
  },


  lotImagePath(id, index) {
    const folder = this.sanitizeFolderName(id);
    if (index === 0) return `image/lots/${folder}/portrait.png`;
    const n = String(index).padStart(2, '0');
    return `image/lots/${folder}/${n}.png`;
  },

  defaultEntityImagePath(entity, variant = 'profile') {
    const folder = this.sanitizeFolderName(entity);
    return `image/default/${folder}/${variant}`;
  },

  buildImageFallbacks(source) {
    const sources = [];

    const addSource = (item) => {
      if (!item) return;
      if (Array.isArray(item)) {
        item.forEach(addSource);
        return;
      }
      const value = String(item).trim();
      if (!value) return;
      if (/\.[a-zA-Z0-9]+$/.test(value)) {
        sources.push(value);
      } else {
        sources.push(`${value}.png`, `${value}.jpg`, `${value}.webp`);
      }
    };

    addSource(source);
    return [...new Set(sources)];
  },

  imageFallbackSources(primaryBase, defaultBase) {
    const sources = [primaryBase, defaultBase].filter(Boolean);
    return this.buildImageFallbacks(sources);
  },

  normalizeCurrency(value) {
    if (!value && value !== 0) return '';
    let text = String(value).trim();
    text = text.replace(/[^0-9\-.,]/g, '');
    if (!text) return '';
    text = text.replace(/,/g, '');
    if (!text.match(/[0-9]/)) return '';
    return `§${text}`;
  },

  imgWithFallback(img, fallbackSrc) {
    const fallbacks = Array.isArray(fallbackSrc) ? fallbackSrc.slice() : (fallbackSrc ? [fallbackSrc] : []);
    img.dataset._fallbacks = JSON.stringify(fallbacks);
    img.onerror = function () {
      try {
        const arr = JSON.parse(this.dataset._fallbacks || '[]');
        if (arr.length) {
          const next = arr.shift();
          this.dataset._fallbacks = JSON.stringify(arr);
          this.src = next;
          return;
        }
      } catch (e) {
        // ignore
      }
      this.onerror = null;
      const ph = document.createElement('div');
      ph.className = 'placeholder-img';
      ph.textContent = this.dataset.initials || '?';
      if (this.parentNode) this.parentNode.replaceChild(ph, this);
    };
  },

  /* ---------- Occult ---------- */
  getOccultClass(occult) {
    if (!occult) return 'occ-default';
    const o = occult.toLowerCase();
    if (o.includes('vampire'))    return 'occ-vampire';
    if (o.includes('fairy') || o.includes('everdew')) return 'occ-fairy';
    if (o.includes('fae') || o.includes('sylvan'))    return 'occ-fairy';
    if (o.includes('alien'))      return 'occ-alien';
    if (o.includes('werewolf'))   return 'occ-werewolf';
    if (o.includes('ghost'))      return 'occ-ghost';
    if (o.includes('mermaid'))    return 'occ-mermaid';
    if (o.includes('spellcaster') || o.includes('witch')) return 'occ-spellcaster';
    if (o.includes('plantsim'))   return 'occ-plantsim';
    if (o.includes('succubus'))   return 'occ-succubus';
    if (o.includes('infected'))   return 'occ-infected';
    if (o.includes('hybrid'))     return 'occ-hybrid';
    if (o.includes('human'))      return 'occ-human';
    return 'occ-default';
  },

  worldIconPath(worldId, worldName) {
    const folder = this.sanitizeFolderName(worldId);
    const iconName = worldName ? `${worldName} Icon.png` : 'icon.png';
    return `image/worlds/${folder}/${encodeURIComponent(iconName)}`;
  },

  /* ---------- Pets ---------- */
  parsePets(petStr) {
    if (!petStr || !petStr.trim()) return [];
    return petStr.split(',').map(p => p.trim()).filter(Boolean).map(p => ({ name: p }));
  },


};
