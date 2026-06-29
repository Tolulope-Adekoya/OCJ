// normalizeFamilyData.js
// Normalizes raw CSV arrays into per-family graph objects for D3 tree rendering.

const GHOST_RE = /^FAM-\d+NULL/i;

// Relationship type → connections.csv key mapping
const REL_STYLE_MAP = {
  'Legal Spouse':          { pub: 'Legal Spouse',          sec: 'Legal Spouse' },
  'Deceased Legal Spouse': { pub: 'Deceased Spouse',       sec: 'Deceased Spouse' },
  'Divorced':              { pub: 'Divorced',              sec: 'Divorced' },
  'Co-Parent':             { pub: 'Co-Parent (Known)',     sec: 'Co-Parent (Secret)' },
  'Deceased Co-Parent':    { pub: 'Deceased Co-Parent',   sec: 'Deceased Co-Parent (secret)' },
  'Parent':                { pub: 'Parent',                sec: 'Parent (secret)' },
  'Adoptive Parent':       { pub: 'Adoptive Parent',       sec: 'Adoptive Parent (secret)' },
};

// Couple relationship precedence (higher index = lower priority)
const COUPLE_PRECEDENCE = [
  'Legal Spouse',
  'Deceased Legal Spouse',
  'Divorced',
  'Co-Parent',
  'Deceased Co-Parent',
];

function isParentRel(type) {
  return type === 'Parent' || type === 'Adoptive Parent';
}

function isCoupleRel(type) {
  return COUPLE_PRECEDENCE.includes(type);
}

/**
 * Build connection style lookup from connections.csv rows.
 * Returns map: connectionName → { color, dash }
 */
function buildConnectionStyles(connsRaw) {
  const map = {};
  connsRaw.forEach(row => {
    const name  = (row['connection'] || '').trim();
    const color = (row['color'] || '#888888').trim().replace(/^\\?#/, '#');
    const ls    = (row['line style'] || 'Solid').trim().toLowerCase();
    let dash = null;
    if (ls === 'dashed') dash = '8,4';
    if (ls === 'dotted') dash = '2,4';
    if (name) map[name] = { color, dash };
  });
  return map;
}

/**
 * Resolve style for a relationship given its type + secret flag.
 */
function resolveStyle(type, isSecret, connStyles) {
  const mapping = REL_STYLE_MAP[type];
  if (!mapping) return { color: '#888888', dash: null };
  const key = isSecret ? mapping.sec : mapping.pub;
  return connStyles[key] || { color: '#888888', dash: null };
}

/**
 * Main export.
 * Returns array of family graph objects, sorted largest-first by sim count.
 */
function buildFamilyGraphs(simsRaw, familiesRaw, familyNamesRaw, connsRaw, petsRaw = []) {

  const connStyles = buildConnectionStyles(connsRaw);

  // ── Family name lookup ─────────────────────────────────────────────────────
  const familyNames = {};
  familyNamesRaw.forEach(row => {
    const name = (row['family_names'] || row['Family_names'] || Object.values(row)[0] || '').trim();
    const id   = (row['Family_ID']   || Object.values(row)[1] || '').trim();
    if (id) familyNames[id] = name;
  });

  // ── Sim lookup ─────────────────────────────────────────────────────────────
  const simMap = {};
  simsRaw.forEach(s => {
    const id = (s['SIM_ID'] || '').trim();
    if (!id) return;
    simMap[id] = {
      id,
      name:         (s['NAME'] || id).trim(),
      ageGroup:     (s['AGE GROUP'] || '').trim(),
      gender:       (s['GENDER'] || '').trim(),
      occult:       (s['OCCULT'] || '').trim(),
      familyStatus: (s['FAMILY STATUS'] || '').trim(),
      originFamilyId: (s['Family ID'] || '').trim(),
    };
  });

  // ── Pet lookup by sim ID ───────────────────────────────────────────────────
  const petsBySim = {};
  (petsRaw || []).forEach(p => {
    const simId = (p['SIM_ID'] || '').trim();
    if (!simId) return;
    if (!petsBySim[simId]) petsBySim[simId] = [];
    petsBySim[simId].push({
      id:      (p['PET_ID'] || '').trim(),
      name:    (p['NAME'] || '').trim(),
      species: (p['SPECIES'] || '').trim(),
      age:     (p['AGE GROUP'] || '').trim(),
    });
  });

  // ── Group families.csv rows by Family_ID ──────────────────────────────────
  const familyRows = {};
  const seen = new Set(); // for deduplication

  familiesRaw.forEach(row => {
    const a    = (row['Sim_ID A'] || '').trim();
    const b    = (row['Related Sim_ID B'] || '').trim();
    const type = (row['Relationship of sim A to sim B'] || '').trim();
    const fid  = (row['Family_ID'] || '').trim();
    const sec  = (row['secret'] || '').trim().toUpperCase() === 'TRUE';

    if (!a || !b || !fid) return;

    const key = `${a}|${b}|${type}|${fid}`;
    if (seen.has(key)) return;
    seen.add(key);

    if (!familyRows[fid]) familyRows[fid] = [];
    familyRows[fid].push({ a, b, type, fid, secret: sec });
  });

  // ── Build per-family graph ─────────────────────────────────────────────────
  const graphs = Object.keys(familyRows).map(fid => {
    const rows = familyRows[fid];

    // Collect all sim IDs referenced in this family
    const allIds = new Set();
    rows.forEach(r => { allIds.add(r.a); allIds.add(r.b); });

    // Build sim nodes
    const simsInFamily = {};
    allIds.forEach(id => {
      const isGhost = GHOST_RE.test(id);
      if (isGhost) {
        simsInFamily[id] = { id, name: 'Unknown', isGhost: true, originFamilyId: fid, pets: [] };
      } else {
        const base = simMap[id] || { id, name: id, ageGroup: '', gender: '', occult: '', familyStatus: '', originFamilyId: '' };
        simsInFamily[id] = {
          ...base,
          isGhost: false,
          originFamilyId: base.originFamilyId || fid,
          pets: petsBySim[id] || [],
        };
      }
    });

    // Build raw edges
    const edges = rows.map((r, i) => {
      const style = resolveStyle(r.type, r.secret, connStyles);
      return {
        id:     `${fid}-${i}`,
        from:   r.a,
        to:     r.b,
        type:   r.type,
        secret: r.secret,
        ...style,
      };
    });

    // ── Compute parents per child ──────────────────────────────────────────
    // publicParents: parent/adoptive-parent edges where secret=FALSE
    // trueParents:   all parent/adoptive-parent edges
    const publicParentsOf = {};
    const trueParentsOf   = {};

    edges.forEach(e => {
      if (!isParentRel(e.type)) return;
      if (!trueParentsOf[e.to])   trueParentsOf[e.to]   = [];
      if (!publicParentsOf[e.to]) publicParentsOf[e.to] = [];
      trueParentsOf[e.to].push({ parentId: e.from, type: e.type, secret: e.secret });
      if (!e.secret) publicParentsOf[e.to].push({ parentId: e.from, type: e.type, secret: false });
    });

    // Flag sims where public ≠ true parents
    Object.keys(simsInFamily).forEach(id => {
      const pub  = (publicParentsOf[id] || []).map(p => p.parentId).sort().join(',');
      const tru  = (trueParentsOf[id]   || []).map(p => p.parentId).sort().join(',');
      simsInFamily[id].parentageHidden = pub !== tru;
      simsInFamily[id].publicParents   = publicParentsOf[id]  || [];
      simsInFamily[id].trueParents     = trueParentsOf[id]    || [];
    });

    // ── Compute couple relationships per sim ──────────────────────────────
    // coupleEdges: symmetric edges for spouse/divorce/co-parent
    const coupleEdgesOf = {}; // simId → [{ partnerId, type, secret }]

    edges.forEach(e => {
      if (!isCoupleRel(e.type)) return;
      if (!coupleEdgesOf[e.from]) coupleEdgesOf[e.from] = [];
      if (!coupleEdgesOf[e.to])   coupleEdgesOf[e.to]   = [];
      coupleEdgesOf[e.from].push({ partnerId: e.to,   type: e.type, secret: e.secret });
      coupleEdgesOf[e.to].push(  { partnerId: e.from, type: e.type, secret: e.secret });
    });

    // Deduplicate couple edges (since families.csv is directional)
    Object.keys(coupleEdgesOf).forEach(id => {
      const seen = new Set();
      coupleEdgesOf[id] = coupleEdgesOf[id].filter(e => {
        const k = [e.partnerId, e.type].join('|');
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
    });

    // Assign primaryCouple and secondaryRelationships per sim
    Object.keys(simsInFamily).forEach(id => {
      const couples = coupleEdgesOf[id] || [];

      // Sort by precedence
      const sorted = [...couples].sort((a, b) => {
        const ai = COUPLE_PRECEDENCE.indexOf(a.type);
        const bi = COUPLE_PRECEDENCE.indexOf(b.type);
        return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
      });

      const primary = sorted[0] || null;
      const secondary = sorted.slice(1);

      simsInFamily[id].primaryCouple = primary
        ? { partnerId: primary.partnerId, type: primary.type, secret: primary.secret, flagged: sorted.length > 1 }
        : null;

      simsInFamily[id].secondaryRelationships = secondary.map(s => {
        // Find children of this secondary relationship
        const secChildren = Object.keys(trueParentsOf).filter(childId => {
          const parents = trueParentsOf[childId].map(p => p.parentId);
          return parents.includes(id) && parents.includes(s.partnerId);
        });
        return { ...s, children: secChildren };
      });
    });

    const simsList = Object.values(simsInFamily);
    const judgmentCalls = simsList
      .filter(s => s.primaryCouple?.flagged)
      .map(s => s.id);

    return {
      familyId:      fid,
      familyName:    familyNames[fid] || fid,
      sims:          simsList,
      edges,
      judgmentCalls,
    };
  });

  // Sort largest family first
  return graphs.sort((a, b) => b.sims.length - a.sims.length);
}

window.FamilyData = { buildFamilyGraphs };
window.normalizeFamilyData = normalizeFamilyData;
