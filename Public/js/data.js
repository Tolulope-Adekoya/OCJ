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
function parseCSV(text) {
  const lines = text.trim().split('\n');
  const headers = splitCSVLine(lines[0]);
  return lines.slice(1).map(line => {
    const values = splitCSVLine(line);
    const obj = {};
    headers.forEach((h, i) => {
      obj[h.trim()] = (values[i] || '').trim();
    });
    return obj;
  });
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

// -- Fetch a CSV file and parse it --
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

// -- Load everything and fire an event when done --
(async () => {
  const [sims, lots, worlds] = await Promise.all([
    loadCSV('data/Sims.csv'),
    loadCSV('data/Lots.csv'),
    loadCSV('data/Worlds.csv'),
  ]);

  window.SIMS   = sims;
  window.LOTS   = lots;
  window.WORLDS = worlds;

  // Fire event so page scripts know data is ready
  document.dispatchEvent(new Event('ocj-data-ready'));
})();

// -- Helper: count unique values in an array of objects by key --
function countBy(arr, key) {
  const counts = {};
  arr.forEach(item => {
    const val = item[key] || 'Unknown';
    counts[val] = (counts[val] || 0) + 1;
  });
  return counts;
}

// -- Helper: sort an object by value descending, return as array of [key, count] --
function sortedEntries(obj) {
  return Object.entries(obj).sort((a, b) => b[1] - a[1]);
}
