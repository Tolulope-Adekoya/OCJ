// pivot-engine.js
//
// Dataset-agnostic cross-tab builder. Takes already-loaded CSV rows plus a
// Rows field and an optional Columns field, and produces counts + the
// actual matching records behind every count (for drill-down).
//
// Two special-case rules live here, both driven by data shape rather than
// hardcoded field names:
//   - Multi-value fields (as flagged by PivotClassifier) get split before
//     counting, so a sim with TRAITS "Neat, Gloomy" contributes to both
//     the Neat bucket and the Gloomy bucket.
//   - Lots with a PARENT LOT ID get collapsed into their parent before
//     anything else happens, so an apartment building + all its units
//     count as ONE lot everywhere a lot is counted, charted, or pivoted.

(function (global) {

  const UNKNOWN_LABEL = 'Unknown';
  const FLAT_COLUMN_KEY = '__flat__';

  /**
   * Groups lots by PARENT LOT ID so an apartment/residential building and
   * all its units count as a single lot. The parent row (the row whose own
   * LOT ID is the group key, i.e. has no PARENT LOT ID itself) is used as
   * the representative record for every attribute. If no row in the group
   * is parentless (orphaned units, parent row missing from the data), the
   * first unit is used as a fallback representative so the group still
   * has something to count.
   *
   * @param {object[]} rows
   * @returns {object[]} one representative row per building/standalone lot,
   *   each carrying __unitCount and __isApartment metadata and __unitRows
   *   (the original rows that were collapsed into it, for drill-down).
   */
  function collapseLotsByParent(rows) {
    if (!rows || !rows.length) return [];
    if (!('PARENT LOT ID' in rows[0])) return rows; // not a lots-shaped dataset

    const groups = new Map();

    rows.forEach(row => {
      const parentId = (row['PARENT LOT ID'] || '').trim();
      const ownId = (row['LOT ID'] || '').trim();
      const effectiveId = parentId || ownId || `__noid__${groups.size}`;

      if (!groups.has(effectiveId)) {
        groups.set(effectiveId, { rows: [], representative: null });
      }
      const g = groups.get(effectiveId);
      g.rows.push(row);
      if (!parentId) g.representative = row; // this row IS the parent/standalone lot
    });

    return Array.from(groups.values()).map(g => {
      const rep = g.representative || g.rows[0];
      return Object.assign({}, rep, {
        __unitCount: g.rows.length,
        __isApartment: g.rows.length > 1,
        __unitRows: g.rows
      });
    });
  }

  /**
   * Returns the array of axis values a single record contributes for a
   * given field — more than one value if the field is multi-value.
   * Empty/missing values fall back to "Unknown", matching the rest of
   * the app's existing convention.
   */
  function getAxisValues(record, field, isMulti) {
    const raw = record[field];
    if (raw === null || raw === undefined || String(raw).trim() === '') {
      return [UNKNOWN_LABEL];
    }
    if (!isMulti) return [String(raw).trim()];

    const pieces = global.PivotClassifier.splitMultiValue(String(raw).trim());
    return pieces.length ? pieces : [UNKNOWN_LABEL];
  }

  /**
   * Build a cross-tab.
   *
   * @param {object} opts
   * @param {string} opts.datasetName - 'sims' | 'lots' | 'worlds' | 'pets'
   * @param {object[]} opts.rows - loaded CSV rows for this dataset
   * @param {object} opts.classification - result of PivotClassifier.classifyDataset(rows)
   * @param {string} opts.rowsField - field name to put on the Rows axis
   * @param {?string} opts.columnsField - field name for Columns axis, or null/'' for flat mode
   * @param {number|'all'} [opts.topN] - limit on number of Rows categories shown (by total count)
   *
   * @returns {{
   *   isCrossTab: boolean,
   *   rowsField: string, columnsField: ?string,
   *   rowsIsMulti: boolean, columnsIsMulti: boolean,
   *   rowKeys: string[], columnKeys: string[],
   *   cells: Object<string, Object<string, {count:number, records:object[]}>>,
   *   rowTotals: Object<string, number>,
   *   columnTotals: Object<string, number>,
   *   grandTotal: number,
   *   recordCount: number,
   *   unitCount: number
   * }}
   */
  function buildPivot(opts) {
    const { datasetName, classification, rowsField } = opts;
    const columnsField = opts.columnsField || null;
    const topN = opts.topN || 'all';

    let records = opts.rows || [];
    let unitCount = records.length;

    if (datasetName === 'lots') {
      records = collapseLotsByParent(records);
      unitCount = (opts.rows || []).length;
    }

    const rowsIsMulti = !!(classification[rowsField] && classification[rowsField].isMulti);
    const columnsIsMulti = !!(columnsField && classification[columnsField] && classification[columnsField].isMulti);

    const cells = {};
    const rowTotals = {};
    const columnTotals = {};
    let grandTotal = 0;

    records.forEach(record => {
      const rowVals = getAxisValues(record, rowsField, rowsIsMulti);
      const colVals = columnsField
        ? getAxisValues(record, columnsField, columnsIsMulti)
        : [FLAT_COLUMN_KEY];

      rowVals.forEach(rv => {
        if (!cells[rv]) cells[rv] = {};
        rowTotals[rv] = (rowTotals[rv] || 0) + colVals.length;

        colVals.forEach(cv => {
          if (!cells[rv][cv]) cells[rv][cv] = { count: 0, records: [] };
          cells[rv][cv].count += 1;
          cells[rv][cv].records.push(record);

          columnTotals[cv] = (columnTotals[cv] || 0) + 1;
          grandTotal += 1;
        });
      });
    });

    let rowKeys = Object.keys(rowTotals).sort((a, b) => rowTotals[b] - rowTotals[a]);
    if (topN !== 'all') {
      rowKeys = rowKeys.slice(0, Number(topN));
    }

    const columnKeys = columnsField
      ? Object.keys(columnTotals).sort((a, b) => columnTotals[b] - columnTotals[a])
      : [FLAT_COLUMN_KEY];

    return {
      isCrossTab: !!columnsField,
      rowsField,
      columnsField,
      rowsIsMulti,
      columnsIsMulti,
      rowKeys,
      columnKeys,
      cells,
      rowTotals,
      columnTotals,
      grandTotal,
      recordCount: records.length,
      unitCount
    };
  }

  /**
   * Flat [value, count] list, sorted desc — same shape the old single-axis
   * statistics.js relied on. Convenience wrapper around buildPivot() for
   * the simple (no Columns) case.
   */
  function toFlatEntries(pivot) {
    return pivot.rowKeys.map(rk => [rk, pivot.rowTotals[rk]]);
  }

  global.PivotEngine = {
    buildPivot,
    collapseLotsByParent,
    getAxisValues,
    toFlatEntries,
    FLAT_COLUMN_KEY,
    UNKNOWN_LABEL
  };

})(typeof window !== 'undefined' ? window : globalThis);
