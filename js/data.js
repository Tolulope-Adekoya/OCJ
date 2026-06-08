// ============================================
// data.js — Loads all CSV files and parses them
// into global arrays the other JS files can use.
//
// HOW IT WORKS:
// - Reads your CSV files from the /data/ folder
// - Converts each row into a JavaScript object
// - Stores them as window.SIMS, window.LOTS, window.WORLDS
// - Other pages wait for the 'ocj-data-ready' event
// ============================================

// -- Simple CSV parser --
// Handles quoted fields (e.g. fields with commas inside)
// data.js — Loads all CSV files and parses them into global arrays

function parseCSV(text) {
  const lines = text.trim().split('\n');
  const headers = splitCSVLine(lines[0]);
  return lines.slice(1)
    .map(line => {
      const values = splitCSVLine(line);
      const obj = {};
      headers.forEach((h, i) => {
        obj[h.trim()] = (values[i] || '').trim();
      });
      return obj;
    })
    .filter(row => Object.values(row).some(v => v !== ''));
}

function splitCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

async function loadCSV(path) {
  try {
    const res = await fetch(path);
    if (!res.ok) throw new Error(`Could not load ${path}`);
    const text = await res.text();
    return parseCSV(text);
  } catch (e) {
    console.warn(`[OCJ] Failed to load ${path}:`, e.message);
    return [];
  }
}
// Image path helpers — use these anywhere you need sim or world images
window.OCJ = {
  simProfile:  (name)        => `images/sims/profile/${name} Profile Picture.png`,
  simOther:    (name, label) => `images/sims/OtherPictures/${name} ${label}.png`,
  worldIcon:   (world)       => `images/worlds/icons/${world} Icon.png`,
  worldMap:    (world)       => `images/worlds/map/${world} Map.jpg`,
  worldScene:  (world, label)=> `images/worlds/scenery/${world} ${label}.png`,
  lotImage:    (world, lot)  => `images/lots/${slugify(world)}/${slugify(lot)}/main.png`,
  favicon:     ()            => `images/favicon/favicon.ico`,
};

function slugify(name) {
  return (name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}
(async () => {
  const [sims, lots, worlds] = await Promise.all([
    loadCSV('data/Sims.csv'),
    loadCSV('data/Lots.csv'),
    loadCSV('data/Worlds.csv'),
  ]);

  window.SIMS   = sims;
  window.LOTS   = lots;
  window.WORLDS = worlds;

  console.log(`[OCJ] Loaded — Sims: ${sims.length}, Lots: ${lots.length}, Worlds: ${worlds.length}`);

  document.dispatchEvent(new Event('ocj-data-ready'));
})();

function countBy(arr, key) {
  const counts = {};
  arr.forEach(item => {
    const val = (item[key] || '').trim() || 'Unknown';
    counts[val] = (counts[val] || 0) + 1;
  });
  return counts;
}

function sortedEntries(obj) {
  return Object.entries(obj).sort((a, b) => b[1] - a[1]);
}