// pivot-classifier.js
//
// Looks at the ACTUAL VALUES in a column (not a hardcoded field name list)
// and decides whether it's safe / meaningful to put on a pivot axis.
//
// Buckets:
//   categorical_single  -> usable on Rows or Columns directly
//   categorical_multi   -> usable on Rows or Columns, but each cell is
//                          split on , / ; first (e.g. "Neat, Gloomy")
//   freetext            -> excluded (long prose: NOTES, DESCRIPTION...)
//   numeric             -> excluded (currency, dimensions, raw counts)
//   identifier           -> excluded (near-unique per row: SIM_ID, NAME...)
//   empty               -> excluded (column has no data at all)
//   garbage             -> excluded (header is a leaked spreadsheet
//                          formula, e.g. "LOT VALUE\n=IF(...)")
//
// Why this order matters (each one fixes a real misclassification found
// while validating against the live CSVs):
//   1. garbage/empty first  - cheap, unambiguous, must short-circuit.
//   2. numeric SECOND       - "$120,000" must be caught before the comma
//                             is mistaken for a list delimiter.
//   3. multi-value THIRD    - must run before the freetext length check,
//                             or short comma lists like "Neat, Gloomy"
//                             get miscounted as one long freetext string.
//   4. freetext FOURTH      - long unique prose (NOTES) must be caught
//                             before the identifier check, because long
//                             unique strings and true IDs look similar
//                             on distinct-ratio alone.
//   5. identifier FIFTH     - >90% unique AND at least 8 distinct values
//                             (the "at least 8" guard stops small CSVs
//                             like worlds.csv/pets.csv from flagging
//                             everything as an identifier by accident).
//   6. categorical_single   - safe default / fallback.

(function (global) {

  const NUMERIC_RE = /^[^\d-]{0,2}-?[\d,]+(\.\d+)?$/;
  const DELIM_RE = /[,;]/;
  const FORMULA_HEADER_RE = /=\s*[A-Za-z]+\(/;

  const MULTIVALUE_DELIM_FRACTION = 0.15;  // share of cells that must contain , or ;
  const MULTIVALUE_MAX_AVG_PIECE_LEN = 25; // split pieces must be short...
  const MULTIVALUE_MAX_PIECE_DISTINCT_RATIO = 0.7; // ...and repeat across rows
  const FREETEXT_MIN_AVG_LEN = 30;
  const IDENTIFIER_MIN_DISTINCT_RATIO = 0.9;
  const IDENTIFIER_MIN_DISTINCT_COUNT = 8;

  function isHeaderGarbage(header) {
    if (!header) return true;
    return header.includes('\n') || FORMULA_HEADER_RE.test(header);
  }

  function splitMultiValue(raw) {
    // Currency/number-formatted cells keep their thousands-separator comma
    // intact instead of being shredded into nonsense fragments like
    // "400,000" -> ["400", "000"].
    if (NUMERIC_RE.test(raw)) return [raw];
    return raw
      .split(/[,;]/)
      .map(p => p.trim())
      .filter(Boolean);
  }

  /**
   * Classify a single column.
   * @param {string} header - the raw CSV header string for this column
   * @param {string[]} rawValues - every row's raw value for this column (may include '', null, undefined)
   * @returns {{bucket:string, distinctCount:number, nonEmptyCount:number}}
   */
  function classifyField(header, rawValues) {

    if (isHeaderGarbage(header)) {
      return { bucket: 'garbage', distinctCount: 0, nonEmptyCount: 0 };
    }

    const nonEmpty = (rawValues || [])
      .map(v => (v === null || v === undefined ? '' : String(v).trim()))
      .filter(v => v !== '');

    if (nonEmpty.length === 0) {
      return { bucket: 'empty', distinctCount: 0, nonEmptyCount: 0 };
    }

    // 1. Numeric (currency, dimensions, raw counts)
    const numericCount = nonEmpty.filter(v => NUMERIC_RE.test(v)).length;
    if (numericCount / nonEmpty.length >= 0.9) {
      return {
        bucket: 'numeric',
        distinctCount: new Set(nonEmpty.map(v => v.toLowerCase())).size,
        nonEmptyCount: nonEmpty.length
      };
    }

    // 2. Multi-value categorical
    const withDelim = nonEmpty.filter(v => DELIM_RE.test(v));
    if (withDelim.length / nonEmpty.length >= MULTIVALUE_DELIM_FRACTION) {

      const pieces = [];
      nonEmpty.forEach(v => pieces.push(...splitMultiValue(v)));

      const avgPieceLen = pieces.reduce((s, p) => s + p.length, 0) / pieces.length;
      const distinctPieces = new Set(pieces.map(p => p.toLowerCase()));
      const pieceDistinctRatio = distinctPieces.size / pieces.length;

      if (avgPieceLen < MULTIVALUE_MAX_AVG_PIECE_LEN &&
          pieceDistinctRatio < MULTIVALUE_MAX_PIECE_DISTINCT_RATIO) {
        return {
          bucket: 'categorical_multi',
          distinctCount: distinctPieces.size,
          nonEmptyCount: nonEmpty.length
        };
      }
    }

    // 3. Free text (long unique prose)
    const avgLen = nonEmpty.reduce((s, v) => s + v.length, 0) / nonEmpty.length;
    if (avgLen > FREETEXT_MIN_AVG_LEN) {
      return {
        bucket: 'freetext',
        distinctCount: new Set(nonEmpty.map(v => v.toLowerCase())).size,
        nonEmptyCount: nonEmpty.length
      };
    }

    // 4. Identifier (near-unique per row)
    const distinctVals = new Set(nonEmpty.map(v => v.toLowerCase()));
    if (distinctVals.size / nonEmpty.length > IDENTIFIER_MIN_DISTINCT_RATIO &&
        distinctVals.size >= IDENTIFIER_MIN_DISTINCT_COUNT) {
      return {
        bucket: 'identifier',
        distinctCount: distinctVals.size,
        nonEmptyCount: nonEmpty.length
      };
    }

    // 5. Default: safe single-value category
    return {
      bucket: 'categorical_single',
      distinctCount: distinctVals.size,
      nonEmptyCount: nonEmpty.length
    };
  }

  const PIVOTABLE_BUCKETS = new Set(['categorical_single', 'categorical_multi']);

  /**
   * Classify every column in a dataset.
   * @param {object[]} rows - array of row objects as returned by loadCSV()
   * @returns {Object<string, {bucket:string, distinctCount:number, nonEmptyCount:number, isMulti:boolean}>}
   */
  function classifyDataset(rows) {
    const result = {};
    if (!rows || !rows.length) return result;

    const headers = Object.keys(rows[0]);
    headers.forEach(header => {
      const values = rows.map(r => r[header]);
      const info = classifyField(header, values);
      result[header] = {
        ...info,
        isMulti: info.bucket === 'categorical_multi'
      };
    });

    return result;
  }

  /**
   * Convenience: just the headers usable as Rows/Columns pivot fields,
   * in their original CSV column order.
   */
  function getPivotableFields(rows) {
    const classification = classifyDataset(rows);
    if (!rows || !rows.length) return [];
    return Object.keys(rows[0]).filter(h =>
      PIVOTABLE_BUCKETS.has(classification[h].bucket)
    );
  }

  global.PivotClassifier = {
    classifyField,
    classifyDataset,
    getPivotableFields,
    splitMultiValue,
    PIVOTABLE_BUCKETS
  };

})(typeof window !== 'undefined' ? window : globalThis);
