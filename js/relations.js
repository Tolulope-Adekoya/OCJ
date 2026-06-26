// relations.js
// D3 v7 force-directed relationship network for OCJ Save File

(async function () {

  // ── DOM refs ────────────────────────────────────────────────────────────────
  const loadingScreen    = document.getElementById('loadingScreen');
  const emptyState       = document.getElementById('emptyState');
  const svgEl            = document.getElementById('relationsSvg');
  const networkContainer = document.getElementById('networkContainer');
  const simSearch        = document.getElementById('simSearch');
  const suggestions      = document.getElementById('searchSuggestions');
  const relFilter        = document.getElementById('relationshipFilter');
  const resetBtn         = document.getElementById('resetGraph');
  const secretToggle     = document.getElementById('secretToggle');
  const secretBanner     = document.getElementById('secretBanner');
  const edgePopup        = document.getElementById('edgePopup');
  const popupContent     = document.getElementById('popupContent');
  const closePopup       = document.getElementById('closePopup');
  const legendGrid       = document.getElementById('legendGrid');

  // ── State ───────────────────────────────────────────────────────────────────
  let secretMode       = false;
  let activeFilter     = '';
  let focusedSimId     = null;
  let allNodes         = [];
  let allEdges         = [];
  let connectionStyles = {};   // type → { color, dash, secret }
  let simulation       = null;
  let svgSel, gSel, linkSel, nodeSel;
  let zoomBehavior;

  // ── Load data (clear cache first so changes to CSV files always apply) ─────
  CSV.clearCache();
  const [simsRaw, relsRaw, connsRaw] = await Promise.all([
    CSV.loadCSV('data/sims.csv'),          // lowercase — match actual filename
    CSV.loadCSV('data/relationships.csv'),  // lowercase — match actual filename
    CSV.loadCSV('data/lookups/connections.csv'),
  ]);

  console.log('[relations] Loaded sims:', simsRaw?.length);
  console.log('[relations] Loaded relationships:', relsRaw?.length);
  console.log('[relations] Loaded connections:', connsRaw?.length);

  // ── Parse connection styles ──────────────────────────────────────────────────
  connsRaw.forEach(row => {
    const type   = (row['connection'] || '').trim();
    const color  = (row['color'] || '#888888').trim().replace(/^\\#/, '#');
    const style  = (row['line style'] || 'Solid').trim().toLowerCase();
    const secret = (row['secret'] || '').trim().toUpperCase() === 'TRUE';

    let dash = 'none';
    if (style === 'dashed') dash = '8,4';
    if (style === 'dotted') dash = '2,4';

    if (type) connectionStyles[type] = { color, dash, secret };
  });

  // ── Build sim map ────────────────────────────────────────────────────────────
  // sims.csv has a multiline cell in the header (LOT VALUE formula spans 2 lines),
  // which can shift column indices. We find SIM_ID by scanning all values in each
  // row for the SIM##### pattern as a robust fallback.
  const SIM_ID_RE = /^SIM\d+$/;

  function extractSimId(row) {
    // Try known header names first
    const direct = (row['SIM_ID'] || row['Sim_ID'] || row['SIM ID'] || '').trim();
    if (SIM_ID_RE.test(direct)) return direct;
    // Scan all values for a SIM##### match
    for (const val of Object.values(row)) {
      const v = String(val || '').trim();
      if (SIM_ID_RE.test(v)) return v;
    }
    return '';
  }

  function extractSimName(row) {
    // NAME is reliably the second column
    const direct = (row['NAME'] || row['Name'] || '').trim();
    if (direct) return direct;
    // Fallback: second value in row
    const vals = Object.values(row);
    return (vals[1] || '').trim();
  }

  const simMap = {};
  simsRaw.forEach(s => {
    const id   = extractSimId(s);
    const name = extractSimName(s);
    if (id) simMap[id] = { ...s, _id: id, _name: name };
  });

  // ── Build nodes from relationships ───────────────────────────────────────────
  // Collect every sim ID that appears in relationships
  const simIdsInRels = new Set();
  relsRaw.forEach(r => {
    const a = (r['Sim_ID A'] || '').trim();
    const b = (r['Sim_ID B'] || '').trim();
    if (a) simIdsInRels.add(a);
    if (b) simIdsInRels.add(b);
  });

  allNodes = Array.from(simIdsInRels).map(id => {
    const sim  = simMap[id] || {};
    const name = (sim._name || sim['NAME'] || sim['Name'] || id).trim();
    return { id, name, sim };
  });

  // ── Build edges ──────────────────────────────────────────────────────────────
  allEdges = relsRaw.map((r, i) => {
    const source   = (r['Sim_ID A'] || '').trim();
    const target   = (r['Sim_ID B'] || '').trim();
    const type     = (r['connection of sim A to sim B'] || r['Relationship of sim A to sim B'] || '').trim();
    const level    = (r['level'] || '').trim();
    const rlevel   = (r['rlevel'] || '').trim();
    const notes    = (r['Notes'] || '').trim();
    const sents    = (r['Sentiments'] || '').trim();
    const rowSec   = (r['secret'] || '').trim().toUpperCase() === 'TRUE';
    const typeSec  = connectionStyles[type]?.secret || false;
    const isSecret = rowSec || typeSec;

    const style = connectionStyles[type] || { color: '#888888', dash: 'none', secret: false };

    return { id: i, source, target, type, level, rlevel, notes, sents, isSecret, ...style };
  }).filter(e => e.source && e.target && e.source !== e.target);

  // ── Hide loading ─────────────────────────────────────────────────────────────
  loadingScreen.style.display = 'none';

  if (allEdges.length === 0) {
    emptyState.style.display = 'flex';
    return;
  }

  // ── Populate filter dropdown ─────────────────────────────────────────────────
  const uniqueTypes = [...new Set(allEdges.map(e => e.type))].sort();
  uniqueTypes.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t;
    opt.textContent = t;
    relFilter.appendChild(opt);
  });

  // ── Build legend ─────────────────────────────────────────────────────────────
  function buildLegend() {
    legendGrid.innerHTML = '';
    connsRaw.forEach(row => {
      const type   = (row['connection'] || '').trim();
      const color  = (row['color'] || '#888888').trim().replace(/^\\#/, '#');
      const style  = (row['line style'] || 'Solid').trim().toLowerCase();
      const secret = (row['secret'] || '').trim().toUpperCase() === 'TRUE';

      if (!type) return;
      // In public mode, skip secret connection types from legend
      if (secret && !secretMode) return;

      let dashArr = '';
      if (style === 'dashed') dashArr = '8,4';
      if (style === 'dotted') dashArr = '2,4';

      const item = document.createElement('div');
      item.className = 'legend-item' + (secret ? ' legend-secret' : '');

      const svgNS = 'http://www.w3.org/2000/svg';
      const svg   = document.createElementNS(svgNS, 'svg');
      svg.setAttribute('width', '40');
      svg.setAttribute('height', '12');
      svg.classList.add('legend-line-svg');

      const line = document.createElementNS(svgNS, 'line');
      line.setAttribute('x1', '0');
      line.setAttribute('y1', '6');
      line.setAttribute('x2', '40');
      line.setAttribute('y2', '6');
      line.setAttribute('stroke', color);
      line.setAttribute('stroke-width', '2.5');
      if (dashArr) line.setAttribute('stroke-dasharray', dashArr);
      svg.appendChild(line);

      const label = document.createElement('span');
      label.textContent = type + (secret ? ' 🔒' : '');

      item.appendChild(svg);
      item.appendChild(label);
      legendGrid.appendChild(item);
    });
  }
  buildLegend();

  // ── Init SVG + D3 ────────────────────────────────────────────────────────────
  const W = networkContainer.clientWidth  || 900;
  const H = networkContainer.clientHeight || 600;

  svgSel = d3.select(svgEl)
    .attr('width',  W)
    .attr('height', H);

  // Defs for arrow markers (one per colour is overkill; use a generic one)
  const defs = svgSel.append('defs');

  zoomBehavior = d3.zoom()
    .scaleExtent([0.1, 4])
    .on('zoom', e => gSel.attr('transform', e.transform));

  svgSel.call(zoomBehavior);

  gSel = svgSel.append('g').attr('class', 'graph-root');

  // ── Draw graph ───────────────────────────────────────────────────────────────
  function visibleEdges() {
    let edges = secretMode
      ? allEdges
      : allEdges.filter(e => !e.isSecret);

    if (activeFilter) {
      edges = edges.filter(e => e.type === activeFilter);
    }
    return edges;
  }

  function visibleNodes(edges) {
    const ids = new Set();
    edges.forEach(e => {
      ids.add(typeof e.source === 'object' ? e.source.id : e.source);
      ids.add(typeof e.target === 'object' ? e.target.id : e.target);
    });
    return allNodes.filter(n => ids.has(n.id));
  }

  function drawGraph() {
    gSel.selectAll('*').remove();

    const edges = visibleEdges();
    const nodes = visibleNodes(edges);

    if (nodes.length === 0) {
      emptyState.style.display = 'flex';
      return;
    }
    emptyState.style.display = 'none';

    // Clone node objects so D3 can mutate x/y
    const nodeData = nodes.map(n => ({ ...n }));
    const nodeById = {};
    nodeData.forEach(n => nodeById[n.id] = n);

    const edgeData = edges.map(e => ({
      ...e,
      source: nodeById[typeof e.source === 'object' ? e.source.id : e.source] || e.source,
      target: nodeById[typeof e.target === 'object' ? e.target.id : e.target] || e.target,
    }));

    // ── Simulation ─────────────────────────────────────────────────────────────
    if (simulation) simulation.stop();

    simulation = d3.forceSimulation(nodeData)
      .force('link', d3.forceLink(edgeData)
        .id(d => d.id)
        .distance(120)
        .strength(0.4)
      )
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(W / 2, H / 2))
      .force('collision', d3.forceCollide(32));

    // ── Links ──────────────────────────────────────────────────────────────────
    linkSel = gSel.append('g').attr('class', 'links')
      .selectAll('line')
      .data(edgeData)
      .join('line')
        .attr('class', 'graph-link')
        .attr('stroke',           d => d.color)
        .attr('stroke-width',     2)
        .attr('stroke-dasharray', d => d.dash === 'none' ? null : d.dash)
        .attr('stroke-opacity',   d => (d.isSecret && secretMode) ? 0.85 : 0.7)
        .on('click',  onLinkClick)
        .on('mouseenter', onLinkHover)
        .on('mouseleave', clearLinkHover);

    // ── Nodes ──────────────────────────────────────────────────────────────────
    nodeSel = gSel.append('g').attr('class', 'nodes')
      .selectAll('g')
      .data(nodeData)
      .join('g')
        .attr('class', 'graph-node')
        .call(
          d3.drag()
            .on('start', dragStart)
            .on('drag',  dragging)
            .on('end',   dragEnd)
        )
        .on('click', onNodeClick);

    // Circle background
    nodeSel.append('circle')
      .attr('r', 22)
      .attr('class', 'node-circle');

    // Clip path per node
    nodeSel.append('clipPath')
      .attr('id', d => `clip-${d.id}`)
      .append('circle')
        .attr('r', 20);

    // Portrait image with fallback chain: .png → .jpg → .webp → default.png → default.webp
    nodeSel.append('image')
      .attr('href',        d => `image/sims/${d.id}/portrait.png`)
      .attr('x',           -20)
      .attr('y',           -20)
      .attr('width',       40)
      .attr('height',      40)
      .attr('clip-path',   d => `url(#clip-${d.id})`)
      .attr('preserveAspectRatio', 'xMidYMid slice')
      .attr('data-fallbacks', d => JSON.stringify([
        `image/sims/${d.id}/portrait.jpg`,
        `image/sims/${d.id}/portrait.webp`,
        'image/default/sims/profile.png',
        'image/default/sims/profile.webp'
      ]))
      .on('error', function () {
        const el = d3.select(this);
        const current = el.attr('href');
        let fallbacks;
        try { fallbacks = JSON.parse(el.attr('data-fallbacks') || '[]'); } catch(e) { fallbacks = []; }
        if (!fallbacks.length) {
          // All fallbacks exhausted — show initials
          const parent = d3.select(this.parentNode);
          this.remove();
          parent.append('circle')
            .attr('r', 20)
            .attr('class', 'node-initials-bg');
          parent.append('text')
            .attr('class', 'node-initials')
            .attr('text-anchor', 'middle')
            .attr('dominant-baseline', 'central')
            .text(d => initials(d.name));
        } else {
          const next = fallbacks.shift();
          el.attr('data-fallbacks', JSON.stringify(fallbacks));
          el.attr('href', next);
        }
      });

    // Name label
    nodeSel.append('text')
      .attr('class', 'node-label')
      .attr('text-anchor', 'middle')
      .attr('y', 32)
      .text(d => shortName(d.name));

    // Simulation tick
    simulation.on('tick', () => {
      linkSel
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y);

      nodeSel.attr('transform', d => `translate(${d.x},${d.y})`);
    });

    // Re-apply focus if one was active
    if (focusedSimId) applyFocus(focusedSimId, nodeData, edgeData);
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────
  function initials(name) {
    return name.split(' ').map(w => w[0] || '').join('').slice(0, 2).toUpperCase();
  }

  function shortName(name) {
    const parts = name.trim().split(' ');
    if (parts.length <= 2) return name;
    return parts[0] + ' ' + parts[parts.length - 1];
  }

  // ── Drag handlers ─────────────────────────────────────────────────────────────
  function dragStart(event, d) {
    if (!event.active) simulation.alphaTarget(0.3).restart();
    d.fx = d.x;
    d.fy = d.y;
  }
  function dragging(event, d) {
    d.fx = event.x;
    d.fy = event.y;
  }
  function dragEnd(event, d) {
    if (!event.active) simulation.alphaTarget(0);
    d.fx = null;
    d.fy = null;
  }

  // ── Link interactions ─────────────────────────────────────────────────────────
  function onLinkClick(event, d) {
    event.stopPropagation();
    showEdgePopup(d);
  }

  function onLinkHover(event, d) {
    d3.select(this).attr('stroke-width', 4);
  }

  function clearLinkHover(event, d) {
    d3.select(this).attr('stroke-width', 2);
  }

  function showEdgePopup(d) {
    const srcName = typeof d.source === 'object' ? d.source.name : d.source;
    const tgtName = typeof d.target === 'object' ? d.target.name : d.target;

    let html = `<div class="popup-header">
      <span class="popup-type-dot" style="background:${d.color}"></span>
      <strong>${d.type}</strong>
      ${d.isSecret ? '<span class="popup-secret-tag">🔒 Secret</span>' : ''}
    </div>
    <div class="popup-sims">${srcName} → ${tgtName}</div>`;

    if (d.level || d.rlevel) {
      html += '<div class="popup-levels">';
      if (d.level)  html += `<span class="level-tag level-green">Level: ${d.level}</span>`;
      if (d.rlevel) html += `<span class="level-tag level-pink">RLevel: ${d.rlevel}</span>`;
      html += '</div>';
    }

    if (d.notes) html += `<div class="popup-row"><span class="popup-label">Notes</span><p>${d.notes}</p></div>`;
    if (d.sents) html += `<div class="popup-row"><span class="popup-label">Sentiments</span><p>${d.sents}</p></div>`;

    popupContent.innerHTML = html;
    edgePopup.style.display = 'block';
  }

  // ── Node interaction ──────────────────────────────────────────────────────────
  function onNodeClick(event, d) {
    event.stopPropagation();
    if (focusedSimId === d.id) {
      clearFocus();
    } else {
      focusedSimId = d.id;
      const edges = visibleEdges();
      const nodes = visibleNodes(edges);
      const nodeData = nodes.map(n => ({ ...n }));
      const nodeById = {};
      nodeData.forEach(n => nodeById[n.id] = n);
      const edgeData = edges.map(e => ({
        ...e,
        source: nodeById[typeof e.source === 'object' ? e.source.id : e.source] || e.source,
        target: nodeById[typeof e.target === 'object' ? e.target.id : e.target] || e.target,
      }));
      applyFocus(d.id, nodeData, edgeData);
    }
  }

  function applyFocus(simId, nodeData, edgeData) {
    const connectedIds = new Set([simId]);
    edgeData.forEach(e => {
      const srcId = typeof e.source === 'object' ? e.source.id : e.source;
      const tgtId = typeof e.target === 'object' ? e.target.id : e.target;
      if (srcId === simId) connectedIds.add(tgtId);
      if (tgtId === simId) connectedIds.add(srcId);
    });

    nodeSel.attr('opacity', d => connectedIds.has(d.id) ? 1 : 0.15);
    linkSel.attr('opacity', d => {
      const s = typeof d.source === 'object' ? d.source.id : d.source;
      const t = typeof d.target === 'object' ? d.target.id : d.target;
      return (s === simId || t === simId) ? 1 : 0.05;
    });

    // Pan to focused node
    const node = nodeData.find(n => n.id === simId);
    if (node) {
      const tx = W / 2 - node.x;
      const ty = H / 2 - node.y;
      svgSel.transition().duration(500)
        .call(zoomBehavior.transform, d3.zoomIdentity.translate(tx, ty));
    }
  }

  function clearFocus() {
    focusedSimId = null;
    nodeSel?.attr('opacity', 1);
    linkSel?.attr('opacity', 0.7);
    svgSel.transition().duration(400)
      .call(zoomBehavior.transform, d3.zoomIdentity);
  }

  // Click on SVG background = clear focus
  svgSel.on('click', () => {
    clearFocus();
    edgePopup.style.display = 'none';
  });

  // ── Search ────────────────────────────────────────────────────────────────────
  simSearch.addEventListener('input', () => {
    const q = simSearch.value.trim().toLowerCase();
    suggestions.innerHTML = '';
    if (!q) { suggestions.style.display = 'none'; return; }

    const matches = allNodes.filter(n => n.name.toLowerCase().includes(q)).slice(0, 8);
    if (!matches.length) { suggestions.style.display = 'none'; return; }

    matches.forEach(n => {
      const div = document.createElement('div');
      div.className = 'suggestion-item';
      div.textContent = n.name;
      div.addEventListener('click', () => {
        simSearch.value = n.name;
        suggestions.style.display = 'none';
        focusedSimId = n.id;
        const edges = visibleEdges();
        const nodes = visibleNodes(edges);
        const nodeData = nodes.map(nd => ({ ...nd }));
        const nodeById = {};
        nodeData.forEach(nd => nodeById[nd.id] = nd);
        const edgeData = edges.map(e => ({
          ...e,
          source: nodeById[typeof e.source === 'object' ? e.source.id : e.source] || e.source,
          target: nodeById[typeof e.target === 'object' ? e.target.id : e.target] || e.target,
        }));
        applyFocus(n.id, nodeData, edgeData);
      });
      suggestions.appendChild(div);
    });
    suggestions.style.display = 'block';
  });

  document.addEventListener('click', e => {
    if (!e.target.closest('.search-wrap')) {
      suggestions.style.display = 'none';
    }
  });

  // ── Filter ────────────────────────────────────────────────────────────────────
  relFilter.addEventListener('change', () => {
    activeFilter  = relFilter.value;
    focusedSimId  = null;
    edgePopup.style.display = 'none';
    drawGraph();
  });

  // ── Reset ─────────────────────────────────────────────────────────────────────
  resetBtn.addEventListener('click', () => {
    clearFocus();
    edgePopup.style.display = 'none';
    simSearch.value = '';
    suggestions.style.display = 'none';
    svgSel.transition().duration(400)
      .call(zoomBehavior.transform, d3.zoomIdentity);
  });

  // ── Secret toggle ─────────────────────────────────────────────────────────────
  secretToggle.addEventListener('click', () => {
    secretMode = !secretMode;
    secretToggle.textContent = secretMode ? '🔓 Hide Secrets' : '🔒 Show Secrets';
    secretToggle.classList.toggle('secret-active', secretMode);
    secretBanner.style.display = secretMode ? 'flex' : 'none';
    edgePopup.style.display = 'none';
    focusedSimId = null;
    buildLegend();
    drawGraph();
  });

  // ── Close popup ───────────────────────────────────────────────────────────────
  closePopup.addEventListener('click', () => {
    edgePopup.style.display = 'none';
  });

  // ── Resize ────────────────────────────────────────────────────────────────────
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      const nw = networkContainer.clientWidth;
      const nh = networkContainer.clientHeight;
      svgSel.attr('width', nw).attr('height', nh);
      if (simulation) {
        simulation.force('center', d3.forceCenter(nw / 2, nh / 2));
        simulation.alpha(0.3).restart();
      }
    }, 200);
  });

  // ── Initial render ────────────────────────────────────────────────────────────
  drawGraph();

})();
