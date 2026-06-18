// families.js
// Layout computation and SVG rendering for OCJ family trees.
(async function () {
  // ── Constants ────────────────────────────────────────────────────────────────
  const NODE_W        = 72;
  const NODE_H        = 90;
  const PET_W         = 26;
  const PET_H         = 34;
  const H_GAP         = 28;
  const COUPLE_GAP    = 10;
  const GEN_H         = 180;
  const MARGIN_X      = 30;
  const MARGIN_Y      = 50;
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
  let renderedSvgs = {};

  // ── Load CSVs ──────────────────────────────────────────────────────────────
  CSV.clearCache();
  const [simsRaw, familiesRaw, familyNamesRaw, connsRaw, petsRaw] = await Promise.all([
    CSV.loadCSV('data/sims.csv'),
    CSV.loadCSV('data/families.csv'),
    CSV.loadCSV('data/lookups/family_names.csv'),
    CSV.loadCSV('data/lookups/connections.csv'),
    CSV.loadCSV('data/pets.csv'),
  ]);

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
    tryImageSrc(BG_PATH(fg.familyId), src => {
      section.style.backgroundImage = `url('${src}')`;
    });
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
    const svgWrap = document.createElement('div');
    svgWrap.className = 'tree-svg-wrap';
    section.appendChild(svgWrap);
    treesContainer.appendChild(section);
    const redraw = () => {
      svgWrap.innerHTML = '';
      const layout = computeLayout(fg, secretMode);
      drawTree(svgWrap, fg, layout, secretMode, fg.familyId);
    };
    renderedSvgs[fg.familyId] = { redraw };
    redraw();
  }

  // ════════════════════════════════════════════════════════════════════════════
  // LAYOUT ENGINE — bottom-up subtree-width positioning
  // ════════════════════════════════════════════════════════════════════════════
  function computeLayout(fg, revealSecrets) {
    const activeEdges = fg.edges.filter(e => revealSecrets || !e.secret);
    const allIds = fg.sims.map(s => s.id);

    // 1. Build parent/child maps
    const parentsOf  = {}; // childId  → [parentId]
    const childrenOf = {}; // parentId → [childId]
    activeEdges.forEach(e => {
      if (e.type !== 'Parent' && e.type !== 'Adoptive Parent') return;
      if (!parentsOf[e.to])    parentsOf[e.to]    = [];
      if (!childrenOf[e.from]) childrenOf[e.from] = [];
      if (!parentsOf[e.to].includes(e.from))    parentsOf[e.to].push(e.from);
      if (!childrenOf[e.from].includes(e.to))   childrenOf[e.from].push(e.to);
    });

    // 2. Primary spouse map
    const primarySpouseOf = {};
    const seenSpouses = new Set();
    activeEdges.forEach(e => {
      if (e.type !== 'Legal Spouse' && e.type !== 'Deceased Legal Spouse') return;
      const key = [e.from, e.to].sort().join('|');
      if (seenSpouses.has(key)) return;
      seenSpouses.add(key);
      if (!primarySpouseOf[e.from]) primarySpouseOf[e.from] = e.to;
      if (!primarySpouseOf[e.to])   primarySpouseOf[e.to]   = e.from;
    });

    // 3. Secondary couples (co-parent, divorced)
    const secondaryCouples = [];
    const seenSecondary = new Set();
    activeEdges.forEach(e => {
      if (!['Co-Parent','Divorced','Deceased Co-Parent'].includes(e.type)) return;
      const key = [e.from, e.to].sort().join('|');
      if (seenSecondary.has(key)) return;
      seenSecondary.add(key);
      secondaryCouples.push({ a: e.from, b: e.to, type: e.type, secret: e.secret, color: e.color, dash: e.dash });
    });

    // 4. BFS generations
    const genOf = {};
    const roots = allIds.filter(id => !parentsOf[id]?.length);
    const queue = roots.map(id => ({ id, gen: 0 }));
    const visited = new Set();
    while (queue.length) {
      const { id, gen } = queue.shift();
      if (visited.has(id)) continue;
      visited.add(id);
      genOf[id] = Math.max(genOf[id] ?? 0, gen);
      (childrenOf[id] || []).forEach(c => queue.push({ id: c, gen: gen + 1 }));
    }
    allIds.forEach(id => { if (genOf[id] === undefined) genOf[id] = 0; });

    // Spouses share same generation
    let changed = true;
    while (changed) {
      changed = false;
      activeEdges.forEach(e => {
        if (!['Legal Spouse','Deceased Legal Spouse','Co-Parent','Divorced','Deceased Co-Parent'].includes(e.type)) return;
        if (genOf[e.from] !== undefined && genOf[e.to] !== undefined && genOf[e.from] !== genOf[e.to]) {
          const m = Math.min(genOf[e.from], genOf[e.to]);
          genOf[e.from] = m; genOf[e.to] = m; changed = true;
        }
      });
    }

    // 5. Build couple units
    // A "unit" is a (sim, spouse?) pair that children hang from.
    // Key = sorted IDs joined by +
    const unitOf = {};
    const unitPairs = {}; // unitKey → [idA, idB?]

    allIds.forEach(id => {
      if (unitOf[id]) return;
      const sp = primarySpouseOf[id];
      if (sp && !unitOf[sp]) {
        const key = [id, sp].sort().join('+');
        unitOf[id] = key;
        unitOf[sp] = key;
        unitPairs[key] = [id, sp].sort(); // consistent order
      } else if (!sp) {
        unitOf[id] = id;
        unitPairs[id] = [id];
      }
    });
    allIds.forEach(id => {
      if (!unitOf[id]) { unitOf[id] = id; unitPairs[id] = [id]; }
    });

    // Children per unit: any child that has at least one parent in this unit
    const unitChildren = {};
    Object.keys(unitPairs).forEach(key => {
      const members = unitPairs[key];
      const kids = new Set();
      members.forEach(m => (childrenOf[m] || []).forEach(c => kids.add(c)));
      unitChildren[key] = [...kids];
    });

    // 6. Subtree width (bottom-up)
    const unitW = key => {
      const m = unitPairs[key];
      return m.length === 2 ? NODE_W * 2 + COUPLE_GAP : NODE_W;
    };

    const swCache = {};
    function subtreeW(key) {
      if (swCache[key] !== undefined) return swCache[key];
      const kids = unitChildren[key] || [];
      // Get unique child units (a child might appear in multiple parents' lists)
      const childUnits = [...new Set(kids.map(c => unitOf[c]))].filter(u => u !== key);
      if (childUnits.length === 0) {
        swCache[key] = unitW(key);
        return swCache[key];
      }
      const childTotal = childUnits.reduce((s, u) => s + subtreeW(u), 0)
        + H_GAP * (childUnits.length - 1);
      swCache[key] = Math.max(unitW(key), childTotal);
      return swCache[key];
    }
    Object.keys(unitPairs).forEach(key => subtreeW(key));

    // 7. Top-down placement
    const nodeX = {}, nodeY = {};
    const placed = new Set();

    function placeUnit(key, centerX) {
      const members = unitPairs[key];
      if (members.every(m => placed.has(m))) return;
      const gen = genOf[members[0]] ?? 0;
      const y = gen * GEN_H + MARGIN_Y;

      if (members.length === 2) {
        nodeX[members[0]] = centerX - NODE_W - COUPLE_GAP / 2;
        nodeX[members[1]] = centerX + COUPLE_GAP / 2;
        nodeY[members[0]] = y;
        nodeY[members[1]] = y;
      } else {
        nodeX[members[0]] = centerX - NODE_W / 2;
        nodeY[members[0]] = y;
      }
      members.forEach(m => placed.add(m));

      // Place child units centred under this unit
      const kids = unitChildren[key] || [];
      const childUnits = [...new Set(kids.map(c => unitOf[c]))].filter(u => u !== key);
      if (childUnits.length === 0) return;

      const totalW = childUnits.reduce((s, u) => s + subtreeW(u), 0)
        + H_GAP * (childUnits.length - 1);
      let cx = centerX - totalW / 2;
      childUnits.forEach(cu => {
        const sw = subtreeW(cu);
        placeUnit(cu, cx + sw / 2);
        cx += sw + H_GAP;
      });
    }

    // Root units = units with no parents among their members
    const rootUnits = [...new Set(
      allIds.filter(id => !parentsOf[id]?.length).map(id => unitOf[id])
    )];

    let cursor = MARGIN_X;
    rootUnits.forEach(key => {
      const sw = subtreeW(key);
      placeUnit(key, cursor + sw / 2);
      cursor += sw + H_GAP;
    });

    // Stragglers
    allIds.forEach(id => {
      if (nodeX[id] === undefined) {
        nodeX[id] = cursor;
        nodeY[id] = (genOf[id] ?? 0) * GEN_H + MARGIN_Y;
        cursor += NODE_W + H_GAP;
      }
    });

    // 8. Build edge layout
    const edgeLayout = [];
    const drawnCouples = new Set();

    // Couple lines (horizontal)
    activeEdges.forEach(e => {
      if (!['Legal Spouse','Deceased Legal Spouse','Co-Parent','Divorced','Deceased Co-Parent'].includes(e.type)) return;
      if (nodeX[e.from] === undefined || nodeX[e.to] === undefined) return;
      const key = [e.from, e.to].sort().join('|') + '|' + e.type;
      if (drawnCouples.has(key)) return;
      drawnCouples.add(key);
      edgeLayout.push({
        _coupleKey: key,
        type: e.type, secret: e.secret, color: e.color, dash: e.dash,
        fromX: nodeX[e.from] + NODE_W, fromY: nodeY[e.from] + NODE_H / 2,
        toX:   nodeX[e.to],            toY:   nodeY[e.to]   + NODE_H / 2,
        isCouple: true,
      });
    });

    // Parent→child: trunk + crossbar + individual drops
    // Group children by their parent-unit so siblings share one trunk
    const coupleChildGroups = {}; // unitKey → { trunkX, trunkY, color, dash, children[] }

    activeEdges.forEach(e => {
      if (e.type !== 'Parent' && e.type !== 'Adoptive Parent') return;
      if (nodeX[e.from] === undefined || nodeX[e.to] === undefined) return;

      const parentUnit = unitOf[e.from];
      if (!coupleChildGroups[parentUnit]) {
        const members = unitPairs[parentUnit] || [e.from];
        let trunkX;
        if (members.length === 2 && nodeX[members[1]] !== undefined) {
          trunkX = (nodeX[members[0]] + NODE_W / 2 + nodeX[members[1]] + NODE_W / 2) / 2;
        } else {
          trunkX = nodeX[members[0]] + NODE_W / 2;
        }
        coupleChildGroups[parentUnit] = {
          trunkX,
          trunkY: nodeY[e.from] + NODE_H,
          color: e.color, dash: e.dash,
          children: [],
        };
      }

      const group = coupleChildGroups[parentUnit];
      if (!group.children.find(c => c.childId === e.to)) {
        group.children.push({
          childId: e.to,
          toX: nodeX[e.to] + NODE_W / 2,
          toY: nodeY[e.to],
          type: e.type, secret: e.secret, color: e.color, dash: e.dash,
        });
      }
    });

    Object.values(coupleChildGroups).forEach(group => {
      const { trunkX, trunkY, children } = group;
      if (!children.length) return;
      children.sort((a, b) => a.toX - b.toX);

      const childTopY = Math.min(...children.map(c => c.toY));
      const midY = trunkY + (childTopY - trunkY) * 0.5;

      if (children.length === 1) {
        // Single child: simple elbow
        edgeLayout.push({
          type: children[0].type, secret: children[0].secret,
          color: children[0].color, dash: children[0].dash,
          fromX: trunkX, fromY: trunkY,
          toX: children[0].toX, toY: children[0].toY,
          childId: children[0].childId, isSingleChild: true,
        });
      } else {
        // Trunk
        edgeLayout.push({
          type: group.type ?? 'Parent', secret: false,
          color: group.color, dash: group.dash,
          fromX: trunkX, fromY: trunkY, toX: trunkX, toY: midY,
          isTrunk: true,
        });
        // Crossbar
        edgeLayout.push({
          type: group.type ?? 'Parent', secret: false,
          color: group.color, dash: group.dash,
          fromX: children[0].toX, fromY: midY,
          toX: children[children.length - 1].toX, toY: midY,
          isCrossbar: true,
        });
        // Individual drops
        children.forEach(c => {
          edgeLayout.push({
            type: c.type, secret: c.secret, color: c.color, dash: c.dash,
            fromX: c.toX, fromY: midY, toX: c.toX, toY: c.toY,
            childId: c.childId, isDrop: true,
          });
        });
      }
    });

    const allX = Object.values(nodeX);
    const allY = Object.values(nodeY);
    const svgW = Math.max(600, ...allX.map(x => x + NODE_W + MARGIN_X)) + 40;
    const svgH = Math.max(300, ...allY.map(y => y + NODE_H + MARGIN_Y)) + 80;

    return { nodeX, nodeY, edgeLayout, svgW, svgH, sims: fg.sims };
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
    const svgSel = d3.select(svg);
    const g = svgSel.append('g').attr('class', 'tree-root');
    svgSel.call(d3.zoom().scaleExtent([0.15, 2.5]).on('zoom', e => g.attr('transform', e.transform)));
    const gEl = g.node();

    // Draw edges
    edgeLayout.forEach(e => {
      if (!revealSecrets && e.secret) return;
      const line = document.createElementNS(NS, 'path');
      let d;
      if (e.isCouple) {
        d = `M${e.fromX},${e.fromY} L${e.toX},${e.toY}`;
      } else if (e.isSingleChild) {
        const midY = e.fromY + (e.toY - e.fromY) * 0.5;
        d = `M${e.fromX},${e.fromY} L${e.fromX},${midY} L${e.toX},${midY} L${e.toX},${e.toY}`;
      } else {
        // trunk, crossbar, drop — all straight lines
        d = `M${e.fromX},${e.fromY} L${e.toX},${e.toY}`;
      }
      line.setAttribute('d',            d);
      line.setAttribute('fill',         'none');
      line.setAttribute('stroke',       e.color || '#888');
      line.setAttribute('stroke-width', '2');
      if (e.dash) line.setAttribute('stroke-dasharray', e.dash);

      // Secret conflict fade
      if (revealSecrets && !e.secret && e.childId && (e.isDrop || e.isSingleChild)) {
        const child = sims.find(s => s.id === e.childId);
        if (child?.parentageHidden) {
          line.setAttribute('stroke-opacity', '0.3');
          const midX = (e.fromX + e.toX) / 2;
          const midY = e.fromY + (e.toY - e.fromY) * 0.5;
          const warn = document.createElementNS(NS, 'text');
          warn.setAttribute('x', midX); warn.setAttribute('y', midY - 6);
          warn.setAttribute('text-anchor', 'middle'); warn.setAttribute('font-size', '14');
          warn.setAttribute('class', 'conflict-warn'); warn.textContent = '⚠️';
          const wt = document.createElementNS(NS, 'title');
          wt.textContent = 'Public belief — not biological.';
          warn.appendChild(wt); gEl.appendChild(warn);
        }
      }
      if (revealSecrets && e.secret && e.childId) {
        const t = document.createElementNS(NS, 'title');
        t.textContent = 'True biological parent.'; line.appendChild(t);
      }
      gEl.appendChild(line);
    });

    // Draw nodes
    sims.forEach(sim => {
      const x = nodeX[sim.id], y = nodeY[sim.id];
      if (x === undefined || y === undefined) return;
      const g2 = document.createElementNS(NS, 'g');
      g2.setAttribute('class',     'tree-node' + (sim.isGhost ? ' ghost-node' : ''));
      g2.setAttribute('transform', `translate(${x},${y})`);
      if (!sim.isGhost) {
        g2.style.cursor = 'pointer';
        g2.addEventListener('click', () => window.open(`sim.html?id=${sim.id}`, '_blank'));
      }
      const rect = document.createElementNS(NS, 'rect');
      rect.setAttribute('width', NODE_W); rect.setAttribute('height', NODE_H);
      rect.setAttribute('rx', 6); rect.setAttribute('ry', 6);
      rect.setAttribute('class', sim.isGhost ? 'node-rect ghost-rect' : 'node-rect');
      g2.appendChild(rect);

      if (sim.isGhost) {
        const txt = document.createElementNS(NS, 'text');
        txt.setAttribute('x', NODE_W / 2); txt.setAttribute('y', NODE_H / 2 + 5);
        txt.setAttribute('text-anchor', 'middle'); txt.setAttribute('class', 'ghost-label');
        txt.textContent = '?'; g2.appendChild(txt);
        const lbl = document.createElementNS(NS, 'text');
        lbl.setAttribute('x', NODE_W / 2); lbl.setAttribute('y', NODE_H - 8);
        lbl.setAttribute('text-anchor', 'middle'); lbl.setAttribute('class', 'node-name ghost-name');
        lbl.textContent = 'Unknown'; g2.appendChild(lbl);
      } else {
        const clipId = `clip-${sim.id}-${familyId}`;
        const clip = document.createElementNS(NS, 'clipPath');
        clip.setAttribute('id', clipId);
        const clipRect = document.createElementNS(NS, 'rect');
        clipRect.setAttribute('width', NODE_W); clipRect.setAttribute('height', NODE_H - 22);
        clipRect.setAttribute('rx', 4); clip.appendChild(clipRect); g2.appendChild(clip);

        const img = document.createElementNS(NS, 'image');
        img.setAttribute('href', PORTRAIT_PATH(sim.id));
        img.setAttribute('width', NODE_W); img.setAttribute('height', NODE_H - 22);
        img.setAttribute('clip-path', `url(#${clipId})`);
        img.setAttribute('preserveAspectRatio', 'xMidYMid slice');
        img.setAttribute('class', 'node-portrait');
        img.addEventListener('error', () => {
          img.style.display = 'none';
          const ir = document.createElementNS(NS, 'rect');
          ir.setAttribute('width', NODE_W); ir.setAttribute('height', NODE_H - 22);
          ir.setAttribute('rx', 4); ir.setAttribute('class', 'node-initials-bg');
          g2.insertBefore(ir, img);
          const it = document.createElementNS(NS, 'text');
          it.setAttribute('x', NODE_W / 2); it.setAttribute('y', (NODE_H - 22) / 2 + 6);
          it.setAttribute('text-anchor', 'middle'); it.setAttribute('class', 'node-initials');
          it.textContent = initials(sim.name); g2.insertBefore(it, img);
        });
        g2.appendChild(img);

        const name = document.createElementNS(NS, 'text');
        name.setAttribute('x', NODE_W / 2); name.setAttribute('y', NODE_H - 8);
        name.setAttribute('text-anchor', 'middle'); name.setAttribute('class', 'node-name');
        name.textContent = shortName(sim.name); g2.appendChild(name);

        if (!revealSecrets && sim.parentageHidden) {
          const lock = document.createElementNS(NS, 'text');
          lock.setAttribute('x', NODE_W - 4); lock.setAttribute('y', 14);
          lock.setAttribute('font-size', '12'); lock.setAttribute('class', 'lock-icon');
          lock.textContent = '🔒'; g2.appendChild(lock);
        }

        if (sim.originFamilyId && sim.originFamilyId !== familyId) {
          const badge = document.createElementNS(NS, 'text');
          badge.setAttribute('x', 4); badge.setAttribute('y', 14);
          badge.setAttribute('font-size', '9'); badge.setAttribute('class', 'cross-family-badge');
          badge.textContent = `↗ ${sim.originFamilyId}`; badge.style.cursor = 'pointer';
          badge.addEventListener('click', ev => { ev.stopPropagation(); navigateToFamily(sim.originFamilyId); });
          const bt = document.createElementNS(NS, 'title');
          bt.textContent = `From ${sim.originFamilyId} — click to navigate`;
          badge.appendChild(bt); g2.appendChild(badge);
        }

        let petOffset = NODE_W + 4;
        (sim.pets || []).forEach(pet => {
          const pg = document.createElementNS(NS, 'g');
          pg.setAttribute('class', 'pet-node');
          pg.setAttribute('transform', `translate(${petOffset}, ${(NODE_H - PET_H) / 2})`);
          const pr = document.createElementNS(NS, 'rect');
          pr.setAttribute('width', PET_W); pr.setAttribute('height', PET_H);
          pr.setAttribute('rx', 4); pr.setAttribute('class', 'pet-rect'); pg.appendChild(pr);
          const pcid = `clip-pet-${pet.id}-${familyId}`;
          const pc = document.createElementNS(NS, 'clipPath'); pc.setAttribute('id', pcid);
          const pcr = document.createElementNS(NS, 'rect');
          pcr.setAttribute('width', PET_W); pcr.setAttribute('height', PET_H - 14);
          pcr.setAttribute('rx', 3); pc.appendChild(pcr); pg.appendChild(pc);
          const pi = document.createElementNS(NS, 'image');
          pi.setAttribute('href', PET_PATH(pet.id)); pi.setAttribute('width', PET_W);
          pi.setAttribute('height', PET_H - 14); pi.setAttribute('clip-path', `url(#${pcid})`);
          pi.setAttribute('preserveAspectRatio', 'xMidYMid slice'); pg.appendChild(pi);
          const pn = document.createElementNS(NS, 'text');
          pn.setAttribute('x', PET_W / 2); pn.setAttribute('y', PET_H - 4);
          pn.setAttribute('text-anchor', 'middle'); pn.setAttribute('class', 'pet-name');
          pn.textContent = pet.name.slice(0, 6); pg.appendChild(pn);
          g2.appendChild(pg); petOffset += PET_W + 4;
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
