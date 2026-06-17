// csv.js
// Loads and parses CSV files into arrays of objects.
// Includes in-memory caching so files are only fetched once.

const CSV_CACHE = {};

/**
 * Parse raw CSV text into an array of row objects keyed by header.
 * Handles:
 * - quoted fields
 * - commas inside quotes
 * - newlines inside quotes
 * - escaped double quotes
 */
function parseCSV(text) {
  const rows = [];

  let row = [];
  let field = '';

  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (inQuotes) {

      if (char === '"' && next === '"') {
        field += '"';
        i++;
      }
      else if (char === '"') {
        inQuotes = false;
      }
      else {
        field += char;
      }

    } else {

      if (char === '"') {
        inQuotes = true;
      }

      else if (char === ',') {
        row.push(field);
        field = '';
      }

      else if (char === '\r') {
        // ignore
      }

      else if (char === '\n') {
        row.push(field);
        field = '';

        rows.push(row);
        row = [];
      }

      else {
        field += char;
      }

    }
  }

  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }

  while (
    rows.length &&
    rows[rows.length - 1].every(
      cell => String(cell).trim() === ''
    )
  ) {
    rows.pop();
  }

  if (!rows.length) {
    return [];
  }

  const headers = rows[0].map(
    h => String(h || '').trim()
  );

  if (headers.length) {
    headers[0] = headers[0].replace(/^\uFEFF/, '');
  }

  return rows.slice(1).map(r => {

    const obj = {};

    headers.forEach((header, index) => {

      obj[header] =
        r[index] !== undefined
          ? String(r[index]).trim().replace(/\uFFFD/g, '§')
          : '';

    });

    return obj;

  });
}

/**
 * Load a single CSV.
 */
async function loadCSV(path) {

  // Always bust browser HTTP cache with a timestamp,
  // so edits to CSV files reflect immediately on page refresh.
  const bustedPath = path + '?v=' + Date.now();

  if (CSV_CACHE[path]) {
    return CSV_CACHE[path];
  }

  try {

    const response = await fetch(bustedPath);

    if (!response.ok) {
      throw new Error(
        `HTTP ${response.status}`
      );
    }

    const buffer = await response.arrayBuffer();
    const text = new TextDecoder('utf-8').decode(buffer);

    const data = parseCSV(text);

    CSV_CACHE[path] = data;

    return data;

  } catch (error) {

    console.warn(
      `[csv.js] Failed to load ${path}:`,
      error.message
    );

    return [];
  }
}

/**
 * Load multiple CSVs in parallel.
 *
 * Example:
 *
 * const data = await CSV.loadCSVs({
 *   sims: "data/Sims.csv",
 *   worlds: "data/Worlds.csv"
 * });
 */
async function loadCSVs(pathMap) {

  const keys = Object.keys(pathMap);

  const results = await Promise.all(
    keys.map(
      key => loadCSV(pathMap[key])
    )
  );

  const output = {};

  keys.forEach((key, index) => {
    output[key] = results[index];
  });

  return output;
}

/**
 * Clear cache.
 * Useful while developing.
 */
function clearCache() {

  Object.keys(CSV_CACHE)
    .forEach(key => delete CSV_CACHE[key]);

}

/**
 * Remove one cached file.
 */
function clearFile(path) {

  delete CSV_CACHE[path];

}

window.CSV = {
  parseCSV,
  loadCSV,
  loadCSVs,
  clearCache,
  clearFile
};