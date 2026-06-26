// families.js — v7
// Uses family-chart (github.com/donatso/family-chart) for layout.
//
// REQUIRED in families.html (add before this script tag):
//   <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/family-chart/dist/styles/family-chart.css" />
//   <script src="https://cdn.jsdelivr.net/npm/family-chart/dist/family-chart.js"></script>
//
// HOW IT WORKS:
//   1. Load CSVs via your existing csv.js + normalizeFamilyData.js
//   2. Convert each family's edges into family-chart's { id, data, rels } format
//   3. rels MUST be bidirectional:
//        - if A.rels.spouses includes B, then B.rels.spouses must include A
//        - if A.rels.children includes C, then C.rels.parents must include A
//   4. Call f3.createChart('#containerId', data) → .setCardHtml(fn) → .updateTree({initial:true})
//   5. Secret toggle: rebuild data without secret edges and call updateTree again

(async function () {

  // ── Sanity check ─────────────────────────────────────────────────────────────
  if (typeof f3 === 'undefined') {
    const ls = document.getElementById('loadingScreen');
    if (ls) {
      ls.textContent = '⚠ family-chart not loaded. Add the two CDN tags to families.html before families.js.';
      ls.style.color = '#C0572A';
    }
    return;
  }

  // ── DOM ──────────────────────────────────────────────────────────────────────
  const loadingScreen  = document.getElementById('loadingScreen');
  const familyDropdown = document.getElementById('familyDropdown');
  const secretToggle   = document.getElementById('secretToggle');
  const linkToggle     = document.getElementById('linkToggle');
  const linkBanner     = document.getElementById('linkBanner');
  const secretBanner   = document.getElementById('secretBanner');
  const treesContainer = document.getElementById('treesContainer');

  let secretMode   = false;
  let linkMode     = false;
  let familyGraphs = [];
  const redraws    = {};   // familyId → redraw function

  // ── Load CSV data ─────────────────────────────────────────────────────────────
  CSV.clearCache();
  const [simsRaw, familiesRaw, familyNamesRaw, connsRaw] = await Promise.all([
    CSV.loadCSV('data/sims.csv'),
    CSV.loadCSV('data/families.csv'),
    CSV.loadCSV('data/lookups/family_names.csv'),
    CSV.loadCSV('data/lookups/connections.csv'),
  ]);

  familyGraphs = FamilyData.buildFamilyGraphs(simsRaw, familiesRaw, familyNamesRaw, connsRaw, []);
  if (loadingScreen) loadingScreen.style.display = 'none';

  // ── Dropdown ──────────────────────────────────────────────────────────────────
  familyDropdown.innerHTML = '<option value="">All Families</option>';
  familyGraphs.forEach(fg => {
    const o = document.createElement('option');
    o.value       = fg.familyId;
    o.textContent = `${fg.familyName} (${fg.sims.filter(s => !s.isGhost).length} sims)`;
    familyDropdown.appendChild(o);
  });

  familyDropdown.addEventListener('change', () => {
    const fid = familyDropdown.value;
    document.querySelectorAll('.family-section').forEach(s => {
      s.style.display = (!fid || s.dataset.fid === fid) ? '' : 'none';
    });
    if (fid) {
      document.querySelector(`.family-section[data-fid="${fid}"]`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });

  // ── Secret toggle ─────────────────────────────────────────────────────────────
  secretToggle.addEventListener('click', () => {
    secretMode = !secretMode;
    secretToggle.textContent = secretMode ? '🔓 Hide Secrets' : '🔒 Show Secrets';
    secretToggle.classList.toggle('secret-active', secretMode);
    secretBanner.style.display = secretMode ? 'flex' : 'none';
    // Redraw every family tree with updated secret mode
    Object.values(redraws).forEach(fn => fn());
  });

  // ── Click-to-View toggle ────────────────────────────────────────────────────
  // Independent of secret mode. When off (default), clicking a card just lets
  // family-chart do its normal thing (recenter the tree on that person).
  // When on, clicking a sim card navigates to their profile page instead.
  linkToggle.addEventListener('click', () => {
    linkMode = !linkMode;
    linkToggle.textContent = linkMode ? '🔗 Profile Links: On' : '🔗 Profile Links: Off';
    linkToggle.classList.toggle('link-active', linkMode);
    linkBanner.style.display = linkMode ? 'flex' : 'none';
  });

  // ── Inject card CSS ───────────────────────────────────────────────────────────
  const cardStyle = document.createElement('style');
  cardStyle.textContent = `
    /* Wrapper sizing */
    .fc-wrap { width:100%; height:520px; position:relative; }

    /* OCJ-themed card, matching the site's .card pattern from components.css */
    .f3 .card-body {
      width: 112px !important;
      height: 124px !important;
      padding: 0 !important;
      background: var(--bg-card) !important;
      border: 1.5px solid var(--border) !important;
      border-radius: var(--radius-sm) !important;
      overflow: hidden !important;
      display: flex !important;
      flex-direction: column !important;
      box-shadow: 0 2px 8px rgba(0,0,0,0.4) !important;
      cursor: pointer !important;
      position: relative !important;
      transition: transform .2s, border-color .2s, box-shadow .2s !important;
    }
    .f3 .card-body:hover {
      border-color: var(--primary) !important;
      transform: translateY(-2px) !important;
      box-shadow: 0 8px 20px rgba(0,0,0,0.45) !important;
    }

    /* Portrait area */
    .f3 .card-img {
      flex: 1 !important;
      overflow: hidden !important;
      background: var(--bg-muted) !important;
      position: relative !important;
    }
    .f3 .card-img img {
      width: 100% !important; height: 100% !important;
      object-fit: cover !important; object-position: center top !important;
      display: block !important;
    }

    /* Name strip */
    .f3 .card-label {
      height: 26px !important;
      font-family: var(--font-head) !important;
      font-size: 10px !important;
      font-weight: 600 !important;
      color: var(--fg) !important;
      background: var(--bg-card) !important;
      border-top: 1px solid var(--border) !important;
      text-align: center !important;
      padding: 0 4px !important;
      line-height: 25px !important;
      white-space: nowrap !important;
      overflow: hidden !important;
      text-overflow: ellipsis !important;
    }

    /* Ghost */
    .f3 .card-ghost .card-img {
      display: flex !important; align-items: center !important; justify-content: center !important;
      font-family: var(--font-head) !important; font-size: 2rem !important;
      color: var(--fg-muted) !important; background: var(--bg-muted) !important;
      opacity: .6 !important;
    }
    .f3 .card-ghost {
      border-style: dashed !important;
      border-color: var(--border-soft, var(--border)) !important;
      cursor: default !important;
      box-shadow: none !important;
    }
    .f3 .card-ghost:hover { transform: none !important; }

    /* Badges inside portrait */
    .f3 .card-badge-lock  { position:absolute; top:3px; right:4px; font-size:11px; line-height:1; z-index:2; pointer-events:none;
      filter: drop-shadow(0 1px 2px rgba(0,0,0,.6)); }
    .f3 .card-badge-cross { position:absolute; top:3px; left:3px; font-size:8px; font-weight:700;
      color:var(--chrysolite); background:rgba(10,10,14,0.8); border-radius:4px; padding:2px 4px;
      line-height:1.3; z-index:2; cursor:pointer; }

    /* Secret-reveal pulse: signals "this person's parentage differs from public view" */
    .f3 .card-pulse-secret {
      border-color: var(--jacinth) !important;
      border-width: 2px !important;
      animation: ocj-pulse-jacinth 1.6s ease-in-out infinite;
    }
    @keyframes ocj-pulse-jacinth {
      0%, 100% { box-shadow: 0 2px 8px rgba(0,0,0,0.4), 0 0 0 0 rgba(192,87,42,0.6); }
      50%      { box-shadow: 0 2px 8px rgba(0,0,0,0.4), 0 0 0 12px rgba(192,87,42,0); }
    }

    /* Connector lines – match OCJ palette */
    .f3 .link          { stroke: var(--chrysolite) !important; stroke-width: 2px !important; }
    .f3 .link-spouse   { stroke: #FFD700 !important; stroke-width: 2px !important; }
  `;
  document.head.appendChild(cardStyle);

  // ── Build all family sections ──────────────────────────────────────────────────
  familyGraphs.forEach(fg => buildSection(fg));

  // ── Click delegation (cards are HTML inside SVG foreignObjects) ───────────────
  // CAPTURE phase: when Click-to-View mode is on, intercept sim card clicks
  // BEFORE family-chart's own click handler (bound directly to .card, which
  // recenters the tree) gets a chance to fire.
  treesContainer.addEventListener('click', e => {
    if (!linkMode) return;
    const card = e.target.closest('[data-sim-id]');
    if (!card?.dataset.simId) return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    window.open(`sim.html?id=${card.dataset.simId}`, '_blank');
  }, true); // capture: true

  // BUBBLE phase: everything else (cross-family badge navigation, and — when
  // Click-to-View is off — family-chart's own recenter click passes through
  // untouched since the capture listener above returns early).
  treesContainer.addEventListener('click', e => {
    // Cross-family badge click → scroll to that family
    const cross = e.target.closest('.card-badge-cross[data-fid]');
    if (cross) {
      e.stopPropagation();
      const fid = cross.dataset.fid;
      familyDropdown.value = fid;
      document.querySelectorAll('.family-section').forEach(s => {
        s.style.display = s.dataset.fid === fid ? '' : 'none';
      });
      document.querySelector(`.family-section[data-fid="${fid}"]`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });

  // ── Secret-relationship tooltip (hover, secret mode only) ──────────────────
  // A single shared tooltip element, reused for every card. Built from the
  // raw families.csv row(s) — Sim A, Relationship of sim A to sim B, Sim B —
  // for any sim touching a secret=TRUE row. Sims with no secret rows never
  // get the data-secret-rels attribute at all (see cardHtml), so they're
  // completely unaffected by any of this.
  const secretTooltipEl = document.createElement('div');
  secretTooltipEl.className = 'ocj-secret-tooltip';
  secretTooltipEl.setAttribute('role', 'tooltip');
  document.body.appendChild(secretTooltipEl);

  function buildSecretTooltipHtml(rels) {
    return rels.map(rel => `
      <div class="ocj-secret-tooltip-rel">
        <span class="ocj-secret-tooltip-name">${esc(rel.fromName)}</span>
        <span class="ocj-secret-tooltip-type">${esc(rel.type)}</span>
        <span class="ocj-secret-tooltip-name">${esc(rel.toName)}</span>
      </div>
    `).join('');
  }

  function positionSecretTooltip(targetEl) {
    const rect = targetEl.getBoundingClientRect();
    const ttRect = secretTooltipEl.getBoundingClientRect();
    let top  = rect.top - ttRect.height - 10;
    let left = rect.left + (rect.width / 2) - (ttRect.width / 2);

    // Flip below the card if there's no room above the viewport.
    if (top < 8) top = rect.bottom + 10;
    // Clamp horizontally so it never runs off-screen.
    left = Math.max(8, Math.min(left, window.innerWidth - ttRect.width - 8));

    secretTooltipEl.style.top  = `${top}px`;
    secretTooltipEl.style.left = `${left}px`;
  }

  treesContainer.addEventListener('mouseover', e => {
    const card = e.target.closest('[data-secret-rels]');
    if (!card) return;

    let rels;
    try {
      rels = JSON.parse(card.dataset.secretRels);
    } catch (err) {
      return; // malformed data — fail silently, never break hover for other cards
    }
    if (!rels || !rels.length) return;

    secretTooltipEl.innerHTML = buildSecretTooltipHtml(rels);
    secretTooltipEl.classList.add('ocj-secret-tooltip-visible');
    positionSecretTooltip(card);
  });

  treesContainer.addEventListener('mouseout', e => {
    const card = e.target.closest('[data-secret-rels]');
    if (!card) return;
    // Only hide when the mouse has actually left the card (not just moved
    // between two child elements inside it).
    if (card.contains(e.relatedTarget)) return;
    secretTooltipEl.classList.remove('ocj-secret-tooltip-visible');
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION BUILDER
  // ═══════════════════════════════════════════════════════════════════════════
  function buildSection(fg) {
    // Outer section
    const section = document.createElement('div');
    section.className   = 'family-section';
    section.dataset.fid = fg.familyId;
    tryImg(
      [`image/families/background/${fg.familyId}.png`, `image/families/background/${fg.familyId}.jpg`],
      src => { section.style.backgroundImage = `url('${src}')`; }
    );

    // Header
    const header = document.createElement('div'); header.className = 'family-header';
    const iw = document.createElement('div');     iw.className = 'family-icon-wrap';
    const ii = document.createElement('img');     ii.className = 'family-icon'; ii.alt = '';
    tryImg(
      [`image/families/icon/${fg.familyId}.png`, `image/families/icon/${fg.familyId}.jpg`],
      src => { ii.src = src; }
    );
    iw.appendChild(ii);
    const te = document.createElement('h2');   te.className = 'family-title'; te.textContent = fg.familyName;
    const ce = document.createElement('span'); ce.className = 'family-count';
    ce.textContent = `${fg.sims.filter(s => !s.isGhost).length} members`;
    header.append(iw, te, ce);
    section.appendChild(header);

    // Chart container
    // IMPORTANT: family-chart needs class="f3" on the element AND an explicit height
    const chartId  = `fc-${fg.familyId.replace(/[^a-z0-9]/gi, '_')}`;
    const chartDiv = document.createElement('div');
    chartDiv.className = 'tree-svg-wrap fc-wrap f3';
    chartDiv.id        = chartId;

    section.appendChild(chartDiv);
    treesContainer.appendChild(section);

    // ── Redraw function ─────────────────────────────────────────────────────────
    // Called on first render and again whenever secretMode changes.
    let chart = null;

    // Root is pinned ONCE per family, not re-derived inside redraw(). Tree
    // wiring is mode-invariant now (see csvToF3), so this would already be
    // stable either way — but pinning it explicitly here means a future
    // change to csvToF3 can't silently reintroduce root drift between modes.
    let pinnedRootId = null;

    function redraw() {
      // Clear previous render
      chartDiv.innerHTML = '';
      chart = null;

      // Convert CSV data → family-chart format
      const data = csvToF3(fg);
      if (!data.length) return;

      if (!pinnedRootId) {
        // Pick a root once: someone with no parents in this family.
        const root = data.find(n => !n.rels.parents.length) || data[0];
        pinnedRootId = root.id;
      }

      // family-chart API (verified against library source, src/core/chart.ts /
      // src/core/cards/card-html.ts):
      //   f3.createChart(selector, data)
      //     .setCardHtml()                      ← takes NO args, returns a CardHtml config object
      //       .setCardInnerHtmlCreator(fn)       ← THIS is where the custom HTML callback goes
      //     .updateTree({ initial: true, rootId: id })
      chart = f3.createChart(`#${chartId}`, data);

      chart.setCardHtml().setCardInnerHtmlCreator(d => cardHtml(d, fg.familyId));

      chart.updateTree({ initial: true, rootId: pinnedRootId });

      // Fix #2: after the tree has rendered, attempt to style individual
      // parent-child connector lines based on per-edge secrecy. Safe no-op
      // if the library's DOM doesn't support it (see styleSecretLines below).
      requestAnimationFrame(() => styleSecretLines(chartDiv, data));
    }

    redraws[fg.familyId] = redraw;
    redraw();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DATA CONVERSION: fg edges → family-chart { id, data, rels } array
  //
  // family-chart REQUIRES bidirectional rels:
  //   A.rels.spouses includes B  ↔  B.rels.spouses includes A
  //   A.rels.children includes C ↔  C.rels.parents includes A
  // ═══════════════════════════════════════════════════════════════════════════
  function csvToF3(fg) {
    const PARENT_TYPES = new Set(['Parent', 'Adoptive Parent']);
    const COUPLE_TYPES = new Set(['Legal Spouse', 'Deceased Legal Spouse', 'Divorced', 'Co-Parent', 'Deceased Co-Parent']);

    // ── IMPORTANT ──────────────────────────────────────────────────────────
    // The tree's WIRING (what's reachable/drawn at all) must NEVER change
    // between public and secret mode — only what's FLAGGED as secret on top
    // of that wiring should change. Previously this function fed the tree
    // library a different parent set per mode (publicParents vs trueParents),
    // which meant any sim whose ONLY parent edge was secret had zero parents
    // in public mode — making them, and everything hanging off them,
    // unreachable from the root and invisible. That's fixed below: we always
    // wire TRUE parents/couples into the tree, and separately track which
    // specific edges are secret so the card renderer can still flag them.
    //
    // parentSecrecy / coupleSecrecy let downstream code (card badges, line
    // styling) ask "is THIS specific edge secret?" without affecting whether
    // the tree can reach that node at all.
    const parentIds     = {};   // childId  → Set of parentIds (ALWAYS true parents)
    const parentSecrecy = {};   // childId  → Map(parentId → isSecret)
    const spousePairs   = new Set();    // "minId+maxId" strings (deduplicated)
    const coupleSecrecy = {};   // "minId+maxId" → isSecret (true if that pair's edge is secret)
    const secretRelationsBySim = {};    // simId → [{ fromId, fromName, toId, toName, type }] —
                                         // every secret=TRUE row in families.csv touching this sim
                                         // (as either Sim A or Sim B), regardless of relationship
                                         // type. Powers the hover tooltip in secret-reveal mode.

    fg.sims.forEach(sim => {
      // Always use trueParents so tree reachability is constant across modes.
      const parents = sim.trueParents;
      if (parents && parents.length) {
        parentIds[sim.id] = new Set(parents.map(p => p.parentId));
        parentSecrecy[sim.id] = new Map(parents.map(p => [p.parentId, !!p.secret]));
      }
      secretRelationsBySim[sim.id] = [];
    });

    fg.edges.forEach(edge => {
      if (edge.secret) {
        const fromSim = fg.sims.find(s => s.id === edge.from);
        const toSim   = fg.sims.find(s => s.id === edge.to);
        const rel = {
          fromId:   edge.from,
          fromName: (fromSim && fromSim.name) || edge.from,
          toId:     edge.to,
          toName:   (toSim && toSim.name) || edge.to,
          type:     edge.type,
        };
        if (secretRelationsBySim[edge.from]) secretRelationsBySim[edge.from].push(rel);
        if (secretRelationsBySim[edge.to])   secretRelationsBySim[edge.to].push(rel);
      }

      if (PARENT_TYPES.has(edge.type)) return; // handled above via trueParents

      if (COUPLE_TYPES.has(edge.type)) {
        // Canonicalise so A < B to avoid duplicates
        const a = edge.from < edge.to ? edge.from : edge.to;
        const b = edge.from < edge.to ? edge.to   : edge.from;
        const key = `${a}+${b}`;
        spousePairs.add(key);
        // If either direction's edge is secret, treat the pair as secret.
        coupleSecrecy[key] = coupleSecrecy[key] || !!edge.secret;
      }
    });

    // Step 2: derive childrenOf from parentIds (so parent nodes know their children)
    const childrenOf = {};  // parentId → Set of childIds
    fg.sims.forEach(s => { childrenOf[s.id] = new Set(); });

    Object.entries(parentIds).forEach(([childId, parents]) => {
      parents.forEach(pId => {
        if (childrenOf[pId]) childrenOf[pId].add(childId);
      });
    });

    // Step 3: derive spousesOf (bidirectional) from spousePairs
    const spousesOf = {};   // simId → Set of spouseIds
    fg.sims.forEach(s => { spousesOf[s.id] = new Set(); });

    spousePairs.forEach(pair => {
      const [a, b] = pair.split('+');
      if (spousesOf[a]) spousesOf[a].add(b);
      if (spousesOf[b]) spousesOf[b].add(a);
    });

    // Step 4: build the final array
    return fg.sims.map(sim => {
      const mySpouseIds = [...(spousesOf[sim.id] || [])];

      // Per-spouse secrecy lookup (key by spouseId, not the canonical pair key)
      const spouseSecrecyById = {};
      mySpouseIds.forEach(spId => {
        const key = sim.id < spId ? `${sim.id}+${spId}` : `${spId}+${sim.id}`;
        spouseSecrecyById[spId] = !!coupleSecrecy[key];
      });

      // Per-parent secrecy + name, for tooltip text and line styling.
      // Each entry: { id, name, secret }
      const myParentIds = [...(parentIds[sim.id] || [])];
      const parentEdgeInfo = myParentIds.map(pId => {
        const parentSim = fg.sims.find(s => s.id === pId);
        return {
          id: pId,
          name: (parentSim && parentSim.name) || pId,
          secret: parentSecrecy[sim.id] ? !!parentSecrecy[sim.id].get(pId) : false,
        };
      });

      return {
        id: sim.id,

        // family-chart uses "data" for display fields.
        // We store custom fields here too (prefixed with _) for our card renderer.
        data: {
          'first name': sim.name || sim.id,   // family-chart uses this for its default display
          'last name':  '',                   // empty string, not missing key — avoids "undefined" in default renderer
          'gender':     genderCode(sim.gender),

          // Our custom fields for the card renderer:
          _name:        sim.name || sim.id,
          _isGhost:     sim.isGhost     || false,
          _parentHidden: sim.parentageHidden || false,
          _originFamily: sim.originFamilyId  || '',
          _familyId:    fg.familyId,
          _avatar:      `image/sims/${sim.id}/portrait.png`,
          _avatarFallback: `image/sims/${sim.id}/portrait.jpg`,

          // Secrecy metadata (always present, regardless of mode) — used by
          // the card renderer for tooltip text and by the post-render pass
          // for per-line styling. This does NOT affect tree wiring above.
          _parentEdges:    parentEdgeInfo,       // [{id, name, secret}, ...]
          _spouseSecrecy:  spouseSecrecyById,     // { spouseId: isSecret }
          _secretRelations: secretRelationsBySim[sim.id] || [], // [{fromId, fromName, toId, toName, type}, ...]
        },

        rels: {
          // All three arrays required, all bidirectional
          spouses:  mySpouseIds,
          children: [...(childrenOf[sim.id] || [])],
          parents:  myParentIds,
        },
      };
    });
  }

  function genderCode(g) {
    if (!g) return 'M';
    const lower = g.toLowerCase();
    if (lower.startsWith('f') || lower === 'female') return 'F';
    return 'M';
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FIX #2 — ADAPTIVE SECRET-LINE STYLING
  //
  // family-chart's link-drawing internals aren't part of its public API, and
  // we can't guarantee which DOM shape it uses across versions. This function
  // is written DEFENSIVELY: it tries a few known-plausible ways to identify
  // "the path connecting child X to parent Y", and only recolors a line if it
  // can confidently match it to a specific (child, parent) pair. If it can't,
  // it does nothing — the card-level badge/glow/tooltip (cardHtml below)
  // already carries the same information, so a no-op here is safe, not
  // broken. This function should NEVER throw or break the rendered tree.
  // ═══════════════════════════════════════════════════════════════════════════
  function styleSecretLines(container, data) {
    try {
      // Build a quick lookup: childId → [{ parentId, name, secret }, ...]
      const childParentInfo = {};
      data.forEach(node => {
        const edges = (node.data && node.data._parentEdges) || [];
        if (edges.length) childParentInfo[node.id] = edges;
      });

      // Only bother if there's at least one contested case in this family
      // (a child with 2+ parent edges where at least one is secret).
      const hasContested = Object.values(childParentInfo)
        .some(edges => edges.length > 1 && edges.some(e => e.secret));
      if (!hasContested) return;

      // family-chart typically renders links as SVG <path> elements inside
      // the chart's main <svg>. Common conventions (varies by version):
      //   <path class="link" data-child="ID" data-parent="ID">
      //   <path class="link" d="...">  with no data attrs at all
      // We look for data attributes first (best case). If absent, we don't
      // guess based on path geometry — that's too fragile and could mis-color
      // an unrelated line — we just bail out for that family.
      const svg = container.querySelector('svg');
      if (!svg) return;

      const paths = svg.querySelectorAll('path.link, path[class*="link"]');
      if (!paths.length) return;

      let matchedAny = false;

      paths.forEach(path => {
        // Best case: explicit data attributes identifying the relationship.
        const childId  = path.dataset.child  || path.dataset.childId  || path.getAttribute('data-id-child');
        const parentId = path.dataset.parent || path.dataset.parentId || path.getAttribute('data-id-parent');
        if (!childId || !parentId) return; // can't confidently identify — skip, don't guess

        const edges = childParentInfo[childId];
        if (!edges) return;

        const thisEdge = edges.find(e => e.parentId === parentId || e.id === parentId);
        if (!thisEdge) return;

        const isContested = edges.length > 1 && edges.some(e => e.secret);
        if (!isContested) return; // ordinary edge, leave default styling alone

        matchedAny = true;

        if (thisEdge.secret) {
          // True biological parent line: full opacity, slightly emphasized.
          path.style.opacity = '1';
          path.style.strokeWidth = '2.5px';
          path.setAttribute('data-ocj-secret-style', 'true-parent');
        } else {
          // Publicly-believed-but-contradicted line: fade + dashed.
          path.style.opacity = '0.3';
          path.style.strokeDasharray = '4,3';
          path.setAttribute('data-ocj-secret-style', 'public-belief');
        }
      });

      // If we found contested cases in the data but couldn't match a single
      // path to them, the library's DOM doesn't expose what we need. That's
      // fine — fail silently. The card badge/glow/tooltip already covers it.
      if (!matchedAny) return;

    } catch (err) {
      // Never let a styling experiment break the tree render.
      console.warn('[families.js] styleSecretLines skipped:', err.message);
    }
  }


  // family-chart calls this for every node.
  // Must return an HTML string. Rendered inside a <foreignObject> in the SVG.
  // ═══════════════════════════════════════════════════════════════════════════
  function cardHtml(treeDatum, familyId) {
    // treeDatum.data is the original node we built in csvToF3: { id, data, rels }.
    // treeDatum.data.data holds our actual fields (_name, _avatar, _parentHidden, etc).
    const node = treeDatum.data || {};
    const d    = node.data || {};
    const id   = node.id;
    const name = d._name || id;

    // Ghost / unknown node
    if (d._isGhost) {
      return `
        <div class="card-body card-ghost" style="cursor:default">
          <div class="card-img">?</div>
          <div class="card-label">Unknown</div>
        </div>`;
    }

    // Every secret=TRUE families.csv row touching this sim, regardless of
    // relationship type (Parent, Legal Spouse, Co-Parent, etc).
    const secretRels = d._secretRelations || [];
    const hasSecret  = secretRels.length > 0;

    const showLock   = hasSecret && !secretMode;
    const showPulse  = hasSecret && secretMode;
    const showCross  = d._originFamily && d._originFamily !== familyId;

    // Lock badge (public mode only): hints that this sim has hidden
    // relationships WITHOUT revealing what they are. The actual content
    // only ever appears via the custom tooltip, and only once "Show
    // Secrets" is toggled on — never through this native title attribute.
    const lockBadge  = showLock
      ? `<div class="card-badge-lock" title="This sim has hidden relationships. Toggle &quot;Show Secrets&quot; to reveal them.">🔒</div>`
      : '';

    const pulseClass = showPulse ? ' card-pulse-secret' : '';

    // Secret-reveal mode only: attach the raw relationship rows as a data
    // attribute. The shared tooltip (see the treesContainer mouseover /
    // mouseout handlers above) reads this on hover and renders it with the
    // relationship type in red — a native title attribute can't be styled,
    // so this is a real custom tooltip instead.
    const secretRelsAttr = showPulse
      ? ` data-secret-rels="${esc(JSON.stringify(secretRels))}"`
      : '';

    const crossBadge = showCross
      ? `<div class="card-badge-cross" data-fid="${esc(d._originFamily)}" title="From ${esc(d._originFamily)}">↗ ${esc(d._originFamily)}</div>`
      : '';

    return `
      <div class="card-body${pulseClass}" data-sim-id="${esc(id)}"${secretRelsAttr}>
        <div class="card-img">
          <img
            src="${esc(d._avatar)}"
            alt="${esc(shortName(name))}"
            data-fallbacks="${esc(JSON.stringify([d._avatarFallback, 'image/default/sims/profile.png', 'image/default/sims/profile.webp']))}"
            onerror="(function(i){try{var a=JSON.parse(i.dataset.fallbacks||'[]');if(a.length){i.src=a.shift();i.dataset.fallbacks=JSON.stringify(a);}else{i.style.display='none';}}catch(e){i.style.display='none';}})(this)"
          />
          ${lockBadge}
          ${crossBadge}
        </div>
        <div class="card-label">${esc(shortName(name))}</div>
      </div>`;
  }

  // ── Utilities ─────────────────────────────────────────────────────────────────
  function shortName(n) {
    const parts = (n || '').trim().split(' ');
    return parts.length <= 2 ? n : `${parts[0]} ${parts[parts.length - 1]}`;
  }

  function esc(s) {
    return String(s || '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function tryImg(paths, cb) {
    let i = 0;
    (function next() {
      if (i >= paths.length) return;
      const img = new Image();
      img.onload  = () => cb(paths[i]);
      img.onerror = () => { i++; next(); };
      img.src = paths[i];
    })();
  }

})();
