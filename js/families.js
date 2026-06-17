// families.js
// Layout computation and SVG rendering for OCJ family trees.

(async function () {

  // ── Constants ────────────────────────────────────────────────────────────────
  const NODE_W        = 72;   // card width
  const NODE_H        = 90;   // card height
  const PET_W         = 36;
  const PET_H         = 44;
  const H_GAP         = 28;   // horizontal gap between siblings
  const COUPLE_GAP    = 10;   // gap between couple partners
  const GEN_H         = 180;  // vertical distance between generations
  const SEC_OFFSET_Y  = 60;   // secondary partner Y offset below primary row
  const PORTRAIT_PATH = id => `image/sims/${id}/portrait.png`;
  const PET_PATH      = id => `image/pets/${id}/portrait.png`;
  const BG_PATH       = fid => [`image/families/background/${fid}.png`, `image/families/background/${fid}.jpg`];
  const ICON_PATH     = fid => [`image/families/icon/${fid}.png`, `image/families/icon/${fid}.jpg`];

  // ── DOM ──────────────────────────────────────────────────────────────────────
  const loadingScreen  = document.getElementById('loadingScreen');
  const familyDropdown = document.getElementById('familyDropdown');
  const secretToggle   = document.getElementById('secretToggle');
  const secretBanner   = document.getElementById('secretBanner');
  const treesContainer = document.getElementById('treesContainer');

  // ── State ─────────────────────────────────────────────────────────────────────
  let secretMode   = false;
  let familyGraphs = [];
  let renderedSvgs = {}; // fid → { svg el, redraw fn }

  // ── Load CSVs (clear cache so changes always reflect) ──────────────────────
  CSV.clearCache();
  const [simsRaw, familiesRaw, familyNamesRaw, connsRaw, petsRaw] = await Promise.all([
    CSV.loadCSV('data/sims.csv'),
    CSV.loadCSV('data/families.csv'),
    CSV.loadCSV('data/lookups/family_names.csv'),
    CSV.loadCSV('data/lookups/connections.csv'),
    CSV.loadCSV('data/pets.csv'),
  ]);
  console.log('[families] Loaded sims:', simsRaw?.length);
  console.log('[families] Loaded families:', familiesRaw?.length);
  console.log('[families] Loaded connections:', connsRaw?.length);

  // ── Normalize ─────────────────────────────────────────────────────────────────
  familyGraphs = FamilyData.buildFamilyGraphs(simsRaw, familiesRaw, familyNamesRaw, connsRaw, petsRaw);

  loadingScreen.style.display = 'none';

  // ── Populate dropdown ─────────────────────────────────────────────────────────
  familyDropdown.innerHTML = '<option value="">All Families</option>';
  familyGraphs.forEach(fg => {
    const opt = document.createElement('option');
    opt.value = fg.familyId;
    opt.textContent = `${fg.familyName} (${fg.sims.filter(s => !s.isGhost).length} sims)`;
    familyDropdown.appendChild(opt);
  });

  familyDropdown.addEventListener('change', () => {
    const fid = familyDropdown.value;
    if (!fid) {
      document.querySelectorAll('.family-section').forEach(s => s.style.display = '');
    } else {
      document.querySelectorAll('.family-section').forEach(s => {
        s.style.display = s.dataset.fid === fid ? '' : 'none';
      });
      const target = document.querySelector(`.family-section[data-fid="${fid}"]`);
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });

  // ── Secret toggle ─────────────────────────────────────────────────────────────
  secretToggle.addEventListener('click', () => {
    secretMode = !secretMode;
    secretToggle.textContent = secretMode ? '🔓 Hide Secrets' : '🔒 Show Secrets';
    secretToggle.classList.toggle('secret-active', secretMode);
    secretBanner.style.display = secretMode ? 'flex' : 'none';
    // Re-render all trees
    Object.values(renderedSvgs).forEach(r => r.redraw());
  });

  // ── Render all families ───────────────────────────────────────────────────────
  familyGraphs.forEach(fg => renderFamilySection(fg));

  // ════════════════════════════════════════════════════════════════════════════
  // SECTION BUILDER
  // ════════════════════════════════════════════════════════════════════════════
  function renderFamilySection(fg) {
    const section = document.createElement('div');
    section.className = 'family-section';
    section.dataset.fid = fg.familyId;

    // Background image (try .png then .jpg)
    const bgPaths = BG_PATH(fg.familyId);
    tryImageSrc(bgPaths, src => {
      section.style.backgroundImage = `url('${src}')`;
    });

    // Header bar
    const header = document.createElement('div');
    header.className = 'family-header';

    const iconWrap = document.createElement('div');
    iconWrap.className = 'family-icon-wrap';
    const iconImg = document.createElement('img');
    iconImg.className = 'family-icon';
    iconImg.alt = '';
    tryImageSrc(ICON_PATH(fg.familyId), src => { iconImg.src = src; });
    iconWrap.appendChild(iconImg);

    const titleEl = document.createElement('h2');
    titleEl.className = 'family-title';
    titleEl.textContent = fg.familyName;

    const countEl = document.createElement('span');
    countEl.className = 'family-count';
    countEl.textContent = `${fg.sims.filter(s => !s.isGhost).length} members`;

    header.appendChild(iconWrap);
    header.appendChild(titleEl);
    header.appendChild(countEl);
    section.appendChild(header);

    // SVG container
    const svgWrap = document.createElement('div');
    svgWrap.className = 'tree-svg-wrap';
    section.appendChild(svgWrap);

    treesContainer.appendChild(section);

    // Build and store redraw function
    const redraw = () => {
      svgWrap.innerHTML = '';
      const layout = computeLayout(fg, secretMode);
      drawTree(svgWrap, fg, layout, secretMode, fg.familyId);
    };

    renderedSvgs[fg.familyId] = { redraw };
    redraw();
  }

  // ════════════════════════════════════════════════════════════════════════════
  // LAYOUT ENGINE
  // ════════════════════════════════════════════════════════════════════════════
  function computeLayout(fg, revealSecrets) {

    // Active edges in current mode
    const activeEdges = fg.edges.filter(e => revealSecrets || !e.secret);

    // Build parent→child and child→parents maps
    const parentsOf = {}; // childId → [parentId]
    const childrenOf = {}; // parentId → [childId]

    activeEdges.forEach(e => {
      if (e.type !== 'Parent' && e.type !== 'Adoptive Parent') return;
      if (!parentsOf[e.to])  parentsOf[e.to]  = [];
      if (!childrenOf[e.from]) childrenOf[e.from] = [];
      parentsOf[e.to].push(e.from);
      childrenOf[e.from].push(e.to);
    });

    // Build couple pairs: primary couples
    const primaryCoupleOf = {}; // simId → partnerId
    activeEdges.forEach(e => {
      if (e.type !== 'Legal Spouse' && e.type !== 'Deceased Legal Spouse') return;
      primaryCoupleOf[e.from] = e.to;
      primaryCoupleOf[e.to]   = e.from;
    });

    // Secondary couple edges (co-parent, divorced)
    const secondaryCouples = []; // [{a, b, type, secret}]
    const secondarySeen = new Set();
    activeEdges.forEach(e => {
      if (e.type !== 'Co-Parent' && e.type !== 'Divorced' && e.type !== 'Deceased Co-Parent') return;
      const key = [e.from, e.to].sort().join('|');
      if (secondarySeen.has(key)) return;
      secondarySeen.add(key);
      secondaryCouples.push({ a: e.from, b: e.to, type: e.type, secret: e.secret, color: e.color, dash: e.dash });
    });

    // Determine generations via BFS from roots (nodes with no parents in this family)
    const allIds = fg.sims.map(s => s.id);
    const genOf = {};

    // Roots = sims with no parents listed in this family's active edges
    const roots = allIds.filter(id => !parentsOf[id] || parentsOf[id].length === 0);

    const queue = roots.map(id => ({ id, gen: 0 }));
    const visited = new Set();

    while (queue.length) {
      const { id, gen } = queue.shift();
      if (visited.has(id)) continue;
      visited.add(id);
      genOf[id] = Math.max(genOf[id] ?? 0, gen);
      (childrenOf[id] || []).forEach(childId => {
        queue.push({ id: childId, gen: gen + 1 });
      });
    }

    // Any unvisited nodes get generation 0
    allIds.forEach(id => { if (genOf[id] === undefined) genOf[id] = 0; });

    // Group by generation
    const genGroups = {};
    allIds.forEach(id => {
      const g = genOf[id];
      if (!genGroups[g]) genGroups[g] = [];
      genGroups[g].push(id);
    });

    const maxGen = Math.max(...Object.keys(genGroups).map(Number));

    // ── Assign X positions ────────────────────────────────────────────────────
    // Strategy: place couple pairs together, then space children under their parents
    const nodeX = {};
    const nodeY = {};
    const processed = new Set();

    // We'll do a recursive layout pass
    // First, identify "couple units" at gen 0 and lay them out
    // Then recursively place their children

    let cursor = 0;

    function placeCouple(simId, partnerId, gen) {
      if (processed.has(simId)) return nodeX[simId];

      const y = gen * GEN_H + 60;

      if (partnerId && !processed.has(partnerId)) {
        nodeX[simId]     = cursor;
        nodeX[partnerId] = cursor + NODE_W + COUPLE_GAP;
        nodeY[simId]     = y;
        nodeY[partnerId] = y;
        processed.add(simId);
        processed.add(partnerId);
        cursor += NODE_W * 2 + COUPLE_GAP + H_GAP;
      } else if (!processed.has(simId)) {
        nodeX[simId] = cursor;
        nodeY[simId] = y;
        processed.add(simId);
        cursor += NODE_W + H_GAP;
      }

      return nodeX[simId];
    }

    // Recursive: place a sim (and spouse) and all descendants
    function layoutSubtree(simId, gen) {
      if (processed.has(simId)) return;

      const partnerId = primaryCoupleOf[simId];
      const partnerAlreadyPlaced = partnerId && processed.has(partnerId);

      // If partner is already placed (placed from the other direction), skip
      if (partnerAlreadyPlaced) {
        processed.add(simId);
        return;
      }

      // Get children of this couple
      const myChildren = getSharedChildren(simId, partnerId, childrenOf, parentsOf);

      if (myChildren.length === 0) {
        placeCouple(simId, partnerId, gen);
        return;
      }

      // First, layout all children recursively
      const startCursor = cursor;
      myChildren.forEach(childId => layoutSubtree(childId, gen + 1));
      const endCursor = cursor;

      // Place couple centred above children span
      const firstChildX = nodeX[myChildren[0]];
      const lastChildX  = nodeX[myChildren[myChildren.length - 1]];
      const midX = (firstChildX + lastChildX) / 2;

      const y = gen * GEN_H + 60;

      if (partnerId) {
        nodeX[simId]     = midX - (NODE_W + COUPLE_GAP) / 2;
        nodeX[partnerId] = midX + (NODE_W + COUPLE_GAP) / 2;
        nodeY[simId]     = y;
        nodeY[partnerId] = y;
        processed.add(simId);
        processed.add(partnerId);
      } else {
        nodeX[simId] = midX;
        nodeY[simId] = y;
        processed.add(simId);
      }
    }

    // Layout all roots and their subtrees
    // Sort roots: those with more descendants first
    const rootsSorted = [...roots].sort((a, b) => countDescendants(b, childrenOf) - countDescendants(a, childrenOf));

    rootsSorted.forEach(rootId => {
      if (!processed.has(rootId)) layoutSubtree(rootId, genOf[rootId] || 0);
    });

    // Catch any stragglers
    allIds.forEach(id => {
      if (!processed.has(id)) {
        nodeX[id] = cursor;
        nodeY[id] = (genOf[id] || 0) * GEN_H + 60;
        processed.add(id);
        cursor += NODE_W + H_GAP;
      }
    });

    // ── Place secondary partners ──────────────────────────────────────────────
    const secondaryNodes = []; // { id, x, y, primarySimId, type }
    const secEdgeLayout  = [];

    secondaryCouples.forEach(sc => {
      // Determine which of a/b is the "primary" sim (already has a primaryCouple or is the main one)
      const aHasPrimary = !!primaryCoupleOf[sc.a];
      const bHasPrimary = !!primaryCoupleOf[sc.b];
      const primarySim  = aHasPrimary ? sc.a : sc.b;
      const secSim      = aHasPrimary ? sc.b : sc.a;

      // Only place if secondary sim isn't a primary-coupled node in this context
      if (nodeX[secSim] === undefined || (!aHasPrimary && !bHasPrimary)) {
        // Both are orphan-ish; use standard placement
        return;
      }

      const px = nodeX[primarySim];
      const py = nodeY[primarySim];

      // Offset secondary partner to the right and below
      const sx = px + NODE_W + H_GAP + 40;
      const sy = py + SEC_OFFSET_Y;

      if (nodeX[secSim] === undefined) {
        nodeX[secSim] = sx;
        nodeY[secSim] = sy;
      }

      secondaryNodes.push({ id: secSim, x: nodeX[secSim], y: nodeY[secSim], primarySimId: primarySim, type: sc.type });

      // Children of this secondary relationship
      const secChildren = getSharedChildren(primarySim, secSim, childrenOf, parentsOf);
      secEdgeLayout.push({
        primarySimId: primarySim,
        secSimId:     secSim,
        children:     secChildren,
        type:         sc.type,
        color:        sc.color,
        dash:         sc.dash,
        secret:       sc.secret,
      });
    });

    // ── Build edge layout objects ─────────────────────────────────────────────
    const edgeLayout = [];

    // Parent→child edges
    activeEdges.forEach(e => {
      if (e.type !== 'Parent' && e.type !== 'Adoptive Parent') return;
      const parentId  = e.from;
      const childId   = e.to;
      const partnerId = primaryCoupleOf[parentId];

      if (nodeX[parentId] === undefined || nodeX[childId] === undefined) return;

      // Midpoint between couple as source
      let srcX, srcY;
      if (partnerId && nodeX[partnerId] !== undefined) {
        srcX = (nodeX[parentId] + NODE_W / 2 + nodeX[partnerId] + NODE_W / 2) / 2;
        srcY = nodeY[parentId] + NODE_H;
      } else {
        srcX = nodeX[parentId] + NODE_W / 2;
        srcY = nodeY[parentId] + NODE_H;
      }

      edgeLayout.push({
        type:     e.type,
        secret:   e.secret,
        color:    e.color,
        dash:     e.dash,
        fromX:    srcX,
        fromY:    srcY,
        toX:      nodeX[childId] + NODE_W / 2,
        toY:      nodeY[childId],
        childId,
        parentId,
      });
    });

    // Couple edges
    activeEdges.forEach(e => {
      if (!isCoupleRel(e.type)) return;
      if (nodeX[e.from] === undefined || nodeX[e.to] === undefined) return;

      // Deduplicate (since couples appear in both directions)
      const key = [e.from, e.to].sort().join('|') + e.type;
      if (edgeLayout.find(el => el._coupleKey === key)) return;

      edgeLayout.push({
        _coupleKey: key,
        type:   e.type,
        secret: e.secret,
        color:  e.color,
        dash:   e.dash,
        fromX:  nodeX[e.from] + NODE_W,
        fromY:  nodeY[e.from] + NODE_H / 2,
        toX:    nodeX[e.to],
        toY:    nodeY[e.to] + NODE_H / 2,
        isCouple: true,
      });
    });

    // ── Compute SVG dimensions ────────────────────────────────────────────────
    const allX = Object.values(nodeX);
    const allY = Object.values(nodeY);
    const svgW = Math.max(...allX) + NODE_W + 80;
    const svgH = Math.max(...allY) + NODE_H + 120;

    return {
      nodeX, nodeY,
      edgeLayout,
      secEdgeLayout,
      secondaryNodes,
      svgW, svgH,
      sims: fg.sims,
    };
  }

  function isCoupleRel(type) {
    return ['Legal Spouse', 'Deceased Legal Spouse', 'Divorced', 'Co-Parent', 'Deceased Co-Parent'].includes(type);
  }

  function getSharedChildren(aId, bId, childrenOf, parentsOf) {
    const aChildren = new Set(childrenOf[aId] || []);
    if (!bId) return [...aChildren];
    return (childrenOf[aId] || []).filter(c => (parentsOf[c] || []).includes(bId));
  }

  function countDescendants(id, childrenOf) {
    let count = 0;
    const stack = [...(childrenOf[id] || [])];
    while (stack.length) {
      const c = stack.pop();
      count++;
      (childrenOf[c] || []).forEach(gc => stack.push(gc));
    }
    return count;
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SVG RENDERER
  // ════════════════════════════════════════════════════════════════════════════
  function drawTree(container, fg, layout, revealSecrets, familyId) {
    const { nodeX, nodeY, edgeLayout, svgW, svgH, sims } = layout;

    const NS = 'http://www.w3.org/2000/svg';

    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('width',   svgW);
    svg.setAttribute('height',  svgH);
    svg.setAttribute('viewBox', `0 0 ${svgW} ${svgH}`);
    svg.setAttribute('class',   'family-tree-svg');

    // D3 zoom
    const svgSel = d3.select(svg);
    const g = svgSel.append('g').attr('class', 'tree-root');

    svgSel.call(
      d3.zoom()
        .scaleExtent([0.15, 2.5])
        .on('zoom', e => g.attr('transform', e.transform))
    );

    const gEl = g.node();

    // ── Draw edges ────────────────────────────────────────────────────────────
    edgeLayout.forEach(e => {
      // In public mode, skip secret edges entirely
      if (!revealSecrets && e.secret) return;

      const line = document.createElementNS(NS, 'path');

      let d;
      if (e.isCouple) {
        d = `M${e.fromX},${e.fromY} L${e.toX},${e.toY}`;
      } else {
        // Elbow path: down then across then down
        const midY = e.fromY + (e.toY - e.fromY) * 0.5;
        d = `M${e.fromX},${e.fromY} L${e.fromX},${midY} L${e.toX},${midY} L${e.toX},${e.toY}`;
      }

      line.setAttribute('d',            d);
      line.setAttribute('fill',         'none');
      line.setAttribute('stroke',       e.color || '#888');
      line.setAttribute('stroke-width', '2');
      if (e.dash) line.setAttribute('stroke-dasharray', e.dash);

      // Secret conflict: if this is a public parent edge but reveal mode shows a secret parent too,
      // fade this line
      if (revealSecrets && !e.secret && e.childId) {
        const child = sims.find(s => s.id === e.childId);
        if (child?.parentageHidden) {
          line.setAttribute('stroke-opacity', '0.3');
          // ⚠ midpoint marker
          const midX = (e.fromX + e.toX) / 2;
          const midY = e.fromY + (e.toY - e.fromY) * 0.5;
          const warn = document.createElementNS(NS, 'text');
          warn.setAttribute('x', midX);
          warn.setAttribute('y', midY - 6);
          warn.setAttribute('text-anchor', 'middle');
          warn.setAttribute('font-size', '14');
          warn.setAttribute('class', 'conflict-warn');
          warn.textContent = '⚠️';
          const title = document.createElementNS(NS, 'title');
          title.textContent = 'Public belief — not biological.';
          warn.appendChild(title);
          gEl.appendChild(warn);
        }
      }

      if (revealSecrets && e.secret && e.childId) {
        const title = document.createElementNS(NS, 'title');
        title.textContent = 'True biological parent.';
        line.appendChild(title);
      }

      gEl.appendChild(line);
    });

    // ── Draw nodes ────────────────────────────────────────────────────────────
    sims.forEach(sim => {
      const x = nodeX[sim.id];
      const y = nodeY[sim.id];
      if (x === undefined || y === undefined) return;

      // In public mode, skip rendering secret-only sims?
      // (all sims in the layout have been placed; ghost nodes always show)

      const g2 = document.createElementNS(NS, 'g');
      g2.setAttribute('class',    'tree-node' + (sim.isGhost ? ' ghost-node' : ''));
      g2.setAttribute('transform', `translate(${x},${y})`);

      if (!sim.isGhost) {
        g2.style.cursor = 'pointer';
        g2.addEventListener('click', () => {
          window.open(`sim.html?id=${sim.id}`, '_blank');
        });
      }

      // Card background
      const rect = document.createElementNS(NS, 'rect');
      rect.setAttribute('width',  NODE_W);
      rect.setAttribute('height', NODE_H);
      rect.setAttribute('rx',     6);
      rect.setAttribute('ry',     6);
      rect.setAttribute('class',  sim.isGhost ? 'node-rect ghost-rect' : 'node-rect');
      g2.appendChild(rect);

      if (sim.isGhost) {
        // Unknown label
        const txt = document.createElementNS(NS, 'text');
        txt.setAttribute('x',            NODE_W / 2);
        txt.setAttribute('y',            NODE_H / 2 + 5);
        txt.setAttribute('text-anchor', 'middle');
        txt.setAttribute('class',       'ghost-label');
        txt.textContent = '?';
        g2.appendChild(txt);

        const lbl = document.createElementNS(NS, 'text');
        lbl.setAttribute('x',            NODE_W / 2);
        lbl.setAttribute('y',            NODE_H - 8);
        lbl.setAttribute('text-anchor', 'middle');
        lbl.setAttribute('class',       'node-name ghost-name');
        lbl.textContent = 'Unknown';
        g2.appendChild(lbl);

      } else {
        // Portrait clip
        const clipId = `clip-${sim.id}-${familyId}`;
        const clip   = document.createElementNS(NS, 'clipPath');
        clip.setAttribute('id', clipId);
        const clipRect = document.createElementNS(NS, 'rect');
        clipRect.setAttribute('width',  NODE_W);
        clipRect.setAttribute('height', NODE_H - 22);
        clipRect.setAttribute('rx',     4);
        clip.appendChild(clipRect);
        g2.appendChild(clip);

        // Portrait image
        const img = document.createElementNS(NS, 'image');
        img.setAttribute('href',            PORTRAIT_PATH(sim.id));
        img.setAttribute('width',           NODE_W);
        img.setAttribute('height',          NODE_H - 22);
        img.setAttribute('clip-path',       `url(#${clipId})`);
        img.setAttribute('preserveAspectRatio', 'xMidYMid slice');
        img.setAttribute('class',           'node-portrait');

        // Fallback: on error, show initials
        img.addEventListener('error', () => {
          img.style.display = 'none';
          const initRect = document.createElementNS(NS, 'rect');
          initRect.setAttribute('width',  NODE_W);
          initRect.setAttribute('height', NODE_H - 22);
          initRect.setAttribute('rx',     4);
          initRect.setAttribute('class',  'node-initials-bg');
          g2.insertBefore(initRect, img);

          const initTxt = document.createElementNS(NS, 'text');
          initTxt.setAttribute('x',            NODE_W / 2);
          initTxt.setAttribute('y',            (NODE_H - 22) / 2 + 6);
          initTxt.setAttribute('text-anchor', 'middle');
          initTxt.setAttribute('class',       'node-initials');
          initTxt.textContent = initials(sim.name);
          g2.insertBefore(initTxt, img);
        });

        g2.appendChild(img);

        // Name label
        const name = document.createElementNS(NS, 'text');
        name.setAttribute('x',            NODE_W / 2);
        name.setAttribute('y',            NODE_H - 8);
        name.setAttribute('text-anchor', 'middle');
        name.setAttribute('class',       'node-name');
        name.textContent = shortName(sim.name);
        g2.appendChild(name);

        // 🔒 icon if parentage hidden (public mode only)
        if (!revealSecrets && sim.parentageHidden) {
          const lock = document.createElementNS(NS, 'text');
          lock.setAttribute('x',         NODE_W - 4);
          lock.setAttribute('y',         14);
          lock.setAttribute('font-size', '12');
          lock.setAttribute('class',     'lock-icon');
          lock.textContent = '🔒';
          g2.appendChild(lock);
        }

        // Cross-family badge
        if (sim.originFamilyId && sim.originFamilyId !== familyId) {
          const badge = document.createElementNS(NS, 'text');
          badge.setAttribute('x',         4);
          badge.setAttribute('y',         14);
          badge.setAttribute('font-size', '9');
          badge.setAttribute('class',     'cross-family-badge');
          badge.textContent = `↗ ${sim.originFamilyId}`;
          badge.style.cursor = 'pointer';
          badge.addEventListener('click', e => {
            e.stopPropagation();
            navigateToFamily(sim.originFamilyId);
          });
          const title = document.createElementNS(NS, 'title');
          title.textContent = `From ${sim.originFamilyId} — click to navigate`;
          badge.appendChild(title);
          g2.appendChild(badge);
        }

        // Pet portraits
        let petOffset = NODE_W + 4;
        (sim.pets || []).forEach(pet => {
          const pg = document.createElementNS(NS, 'g');
          pg.setAttribute('class',     'pet-node');
          pg.setAttribute('transform', `translate(${petOffset}, ${(NODE_H - PET_H) / 2})`);

          const petRect = document.createElementNS(NS, 'rect');
          petRect.setAttribute('width',  PET_W);
          petRect.setAttribute('height', PET_H);
          petRect.setAttribute('rx',     4);
          petRect.setAttribute('class',  'pet-rect');
          pg.appendChild(petRect);

          const petClipId = `clip-pet-${pet.id}-${familyId}`;
          const petClip   = document.createElementNS(NS, 'clipPath');
          petClip.setAttribute('id', petClipId);
          const petClipR = document.createElementNS(NS, 'rect');
          petClipR.setAttribute('width',  PET_W);
          petClipR.setAttribute('height', PET_H - 14);
          petClipR.setAttribute('rx',     3);
          petClip.appendChild(petClipR);
          pg.appendChild(petClip);

          const petImg = document.createElementNS(NS, 'image');
          petImg.setAttribute('href',     PET_PATH(pet.id));
          petImg.setAttribute('width',    PET_W);
          petImg.setAttribute('height',   PET_H - 14);
          petImg.setAttribute('clip-path', `url(#${petClipId})`);
          petImg.setAttribute('preserveAspectRatio', 'xMidYMid slice');
          pg.appendChild(petImg);

          const petName = document.createElementNS(NS, 'text');
          petName.setAttribute('x',           PET_W / 2);
          petName.setAttribute('y',           PET_H - 4);
          petName.setAttribute('text-anchor', 'middle');
          petName.setAttribute('class',       'pet-name');
          petName.textContent = pet.name.slice(0, 6);
          pg.appendChild(petName);

          g2.appendChild(pg);
          petOffset += PET_W + 4;
        });
      }

      gEl.appendChild(g2);
    });

    container.appendChild(svg);
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────
  function initials(name) {
    return name.split(' ').map(w => w[0] || '').join('').slice(0, 2).toUpperCase();
  }

  function shortName(name) {
    const parts = (name || '').trim().split(' ');
    if (parts.length <= 2) return name;
    return parts[0] + ' ' + parts[parts.length - 1];
  }

  function tryImageSrc(paths, callback) {
    let i = 0;
    function attempt() {
      if (i >= paths.length) return;
      const img = new Image();
      img.onload  = () => callback(paths[i]);
      img.onerror = () => { i++; attempt(); };
      img.src = paths[i];
    }
    attempt();
  }

  function navigateToFamily(fid) {
    familyDropdown.value = fid;
    document.querySelectorAll('.family-section').forEach(s => {
      s.style.display = s.dataset.fid === fid ? '' : 'none';
    });
    const target = document.querySelector(`.family-section[data-fid="${fid}"]`);
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

})();
