// relationships.js — Relationship Network Graph using D3

let relData = null;
let svg, simulation, tooltip;
let allNodes = [], allLinks = [];
let selectedNode = null;

const NODE_R = 18;

async function loadRelData() {
  try {
    const res = await fetch('data/relationships.json');
    relData = await res.json();
    init();
  } catch (e) {
    console.error('[OCJ] Could not load relationships.json', e);
  }
}

function init() {
  allNodes = relData.nodes.map(n => ({ ...n }));
  allLinks = relData.links.map(l => ({ ...l }));

  document.getElementById('rel-count').textContent =
    `${allNodes.length} sims · ${allLinks.length} connections`;

  setupSVG();
  setupTooltip();
  renderGraph(allNodes, allLinks);
  setupControls();
}

function setupSVG() {
  svg = d3.select('#rel-graph-svg');
}

function setupTooltip() {
  tooltip = document.createElement('div');
  tooltip.className = 'rel-tooltip';
  document.body.appendChild(tooltip);
}

function renderGraph(nodes, links) {
  const svgEl = document.getElementById('rel-graph-svg');
  const W = svgEl.clientWidth || 1100;
  const H = svgEl.clientHeight || 680;

  svg.selectAll('*').remove();
  if (simulation) simulation.stop();

  const g = svg.append('g');

  // Zoom & pan
  const zoom = d3.zoom()
    .scaleExtent([0.2, 4])
    .on('zoom', e => g.attr('transform', e.transform));
  svg.call(zoom);

  // Draw links
  const link = g.append('g').selectAll('line')
    .data(links)
    .join('line')
    .attr('class', d => `rel-link ${d.type}`);

  // Link labels (only shown on hover via JS)
  const linkLabel = g.append('g').selectAll('text')
    .data(links)
    .join('text')
    .attr('class', 'rel-link-label')
    .attr('opacity', 0)
    .text(d => d.label || '');

  // Draw nodes
  const node = g.append('g').selectAll('g')
    .data(nodes)
    .join('g')
    .attr('class', d => `rel-node ${d.gender}`)
    .call(d3.drag()
      .on('start', dragStart)
      .on('drag', dragged)
      .on('end', dragEnd)
    )
    .on('click', (e, d) => {
      e.stopPropagation();
      selectNode(d, node, link, linkLabel);
    })
    .on('mouseover', (e, d) => {
      tooltip.innerHTML = `<strong>${d.name}</strong><br><span style="color:var(--text-muted);font-size:0.75rem">${d.world || ''}</span>`;
      tooltip.classList.add('visible');
    })
    .on('mousemove', e => {
      tooltip.style.left = (e.clientX + 14) + 'px';
      tooltip.style.top  = (e.clientY - 10) + 'px';
    })
    .on('mouseout', () => tooltip.classList.remove('visible'));

  // Click background to deselect
  svg.on('click', () => {
    clearSelection(node, link, linkLabel);
    hidePanel();
  });

  node.append('circle').attr('r', NODE_R);

  // Profile image
  node.append('image')
    .attr('href', d => `images/sims/profile/${d.id}.png`)
    .attr('x', -NODE_R).attr('y', -NODE_R)
    .attr('width', NODE_R * 2).attr('height', NODE_R * 2)
    .attr('clip-path', `circle(${NODE_R}px)`)
    .on('error', function() { d3.select(this).remove(); });

  // Name label
  node.append('text')
    .attr('y', NODE_R + 12)
    .text(d => d.name.split(' ')[0]);

  // Force simulation
  simulation = d3.forceSimulation(nodes)
    .force('link', d3.forceLink(links).id(d => d.id).distance(100).strength(0.5))
    .force('charge', d3.forceManyBody().strength(-300))
    .force('center', d3.forceCenter(W / 2, H / 2))
    .force('collision', d3.forceCollide(NODE_R + 15))
    .on('tick', () => {
      link
        .attr('x1', d => d.source.x).attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x).attr('y2', d => d.target.y);

      linkLabel
        .attr('x', d => (d.source.x + d.target.x) / 2)
        .attr('y', d => (d.source.y + d.target.y) / 2 - 4);

      node.attr('transform', d => `translate(${d.x},${d.y})`);
    });
}

function selectNode(d, nodeSel, linkSel, labelSel) {
  selectedNode = d;

  const connectedIds = new Set([d.id]);
  const connectedLinks = [];

  allLinks.forEach(l => {
    const srcId = typeof l.source === 'object' ? l.source.id : l.source;
    const tgtId = typeof l.target === 'object' ? l.target.id : l.target;
    if (srcId === d.id || tgtId === d.id) {
      connectedIds.add(srcId);
      connectedIds.add(tgtId);
      connectedLinks.push(l);
    }
  });

  // Dim/highlight nodes
  nodeSel
    .classed('highlighted', n => connectedIds.has(n.id))
    .classed('dimmed', n => !connectedIds.has(n.id));

  // Dim/highlight links
  linkSel.classed('dimmed', l => {
    const srcId = typeof l.source === 'object' ? l.source.id : l.source;
    const tgtId = typeof l.target === 'object' ? l.target.id : l.target;
    return srcId !== d.id && tgtId !== d.id;
  });

  // Show labels on connected links
  labelSel.attr('opacity', l => {
    const srcId = typeof l.source === 'object' ? l.source.id : l.source;
    const tgtId = typeof l.target === 'object' ? l.target.id : l.target;
    return (srcId === d.id || tgtId === d.id) ? 1 : 0;
  });

  showPanel(d, connectedLinks);
}

function clearSelection(nodeSel, linkSel, labelSel) {
  selectedNode = null;
  nodeSel.classed('highlighted dimmed', false);
  linkSel.classed('dimmed', false);
  labelSel.attr('opacity', 0);
}

function showPanel(d, connections) {
  const panel = document.getElementById('sim-panel');
  panel.style.display = 'block';

  document.getElementById('panel-avatar').textContent =
    d.gender === 'male' ? '♂' : d.gender === 'female' ? '♀' : '◈';
  document.getElementById('panel-name').textContent = d.name;
  document.getElementById('panel-world').textContent = d.world || '';

  const connDiv = document.getElementById('panel-connections');
  connDiv.innerHTML = connections.map(l => {
    const srcId = typeof l.source === 'object' ? l.source.id : l.source;
    const tgtId = typeof l.target === 'object' ? l.target.id : l.target;
    const otherId = srcId === d.id ? tgtId : srcId;
    const other = allNodes.find(n => n.id === otherId);
    return `<span class="tag tag--muted">${l.label || l.type}: ${other ? other.name : otherId}</span>`;
  }).join('');
}

function hidePanel() {
  document.getElementById('sim-panel').style.display = 'none';
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('panel-close').addEventListener('click', () => {
    hidePanel();
  });
});

function setupControls() {
  const search = document.getElementById('search-rel');
  const typeFilter = document.getElementById('filter-rel-type');
  const resetBtn = document.getElementById('btn-reset');

  function applyFilters() {
    const q = search.value.toLowerCase();
    const t = typeFilter.value;

    let filteredNodes = allNodes;
    let filteredLinks = allLinks;

    if (q) {
      filteredNodes = allNodes.filter(n => n.name.toLowerCase().includes(q));
      const ids = new Set(filteredNodes.map(n => n.id));
      filteredLinks = allLinks.filter(l => {
        const srcId = typeof l.source === 'object' ? l.source.id : l.source;
        const tgtId = typeof l.target === 'object' ? l.target.id : l.target;
        return ids.has(srcId) && ids.has(tgtId);
      });
    }

    if (t) {
      filteredLinks = filteredLinks.filter(l => l.type === t);
      const ids = new Set();
      filteredLinks.forEach(l => {
        const srcId = typeof l.source === 'object' ? l.source.id : l.source;
        const tgtId = typeof l.target === 'object' ? l.target.id : l.target;
        ids.add(srcId); ids.add(tgtId);
      });
      filteredNodes = filteredNodes.filter(n => ids.has(n.id));
    }

    document.getElementById('rel-count').textContent =
      `${filteredNodes.length} sims · ${filteredLinks.length} connections`;

    renderGraph(
      filteredNodes.map(n => ({ ...n })),
      filteredLinks.map(l => ({ ...l, source: typeof l.source === 'object' ? l.source.id : l.source, target: typeof l.target === 'object' ? l.target.id : l.target }))
    );
    hidePanel();
  }

  search.addEventListener('input', applyFilters);
  typeFilter.addEventListener('change', applyFilters);
  resetBtn.addEventListener('click', () => {
    search.value = '';
    typeFilter.value = '';
    applyFilters();
  });
}

function dragStart(e, d) {
  if (!e.active) simulation.alphaTarget(0.3).restart();
  d.fx = d.x; d.fy = d.y;
}

function dragged(e, d) {
  d.fx = e.x; d.fy = e.y;
}

function dragEnd(e, d) {
  if (!e.active) simulation.alphaTarget(0);
  d.fx = null; d.fy = null;
}

document.addEventListener('ocj-data-ready', () => {
  setBadge('badge-worlds', window.WORLDS.length);
  setBadge('badge-sims',   window.SIMS.length);
  setBadge('badge-lots',   window.LOTS.length);
});

function setBadge(id, count) {
  const el = document.getElementById(id);
  if (el && count > 0) el.textContent = count;
}

loadRelData();
