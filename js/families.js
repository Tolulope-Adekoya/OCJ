// families.js — Family Trees page using D3

let familyData = null;
let currentFamily = null;
let svg, simulation, tooltip;

const NODE_RADIUS = 28;

async function loadFamilyData() {
  try {
    const res = await fetch('data/families.json');
    familyData = await res.json();
    init();
  } catch (e) {
    console.error('[OCJ] Could not load families.json', e);
  }
}

function init() {
  buildSelector();
  setupSVG();
  setupTooltip();
  // Load first family by default
  if (familyData.families.length > 0) {
    selectFamily(familyData.families[0]);
  }
}

function buildSelector() {
  const container = document.getElementById('family-selector');
  familyData.families.forEach(f => {
    const btn = document.createElement('button');
    btn.className = 'family-btn';
    btn.textContent = f.name;
    btn.addEventListener('click', () => selectFamily(f));
    btn.dataset.id = f.id;
    container.appendChild(btn);
  });
}

function selectFamily(family) {
  currentFamily = family;

  // Update active button
  document.querySelectorAll('.family-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.id === family.id);
  });

  // Update theme
  document.getElementById('family-theme').textContent = family.theme || '';

  // Render tree
  renderTree(family);
}

function setupSVG() {
  svg = d3.select('#family-tree-svg');
}

function setupTooltip() {
  tooltip = document.createElement('div');
  tooltip.className = 'tree-tooltip';
  document.querySelector('.tree-wrap').appendChild(tooltip);
}

function renderTree(family) {
  const svgEl = document.getElementById('family-tree-svg');
  const W = svgEl.clientWidth || 900;
  const H = svgEl.clientHeight || 600;

  svg.selectAll('*').remove();

  if (simulation) simulation.stop();

  const g = svg.append('g');

  // Zoom & pan
  const zoom = d3.zoom()
    .scaleExtent([0.3, 3])
    .on('zoom', e => g.attr('transform', e.transform));
  svg.call(zoom);

  // Build node and link data
  const nodes = family.members.map(m => ({ ...m }));
  const links = family.relationships.map(r => ({ ...r }));

  // Arrow marker for parent links
  svg.append('defs').selectAll('marker')
    .data(['parent'])
    .join('marker')
    .attr('id', 'arrow-parent')
    .attr('viewBox', '0 -4 8 8')
    .attr('refX', NODE_RADIUS + 8)
    .attr('refY', 0)
    .attr('markerWidth', 6)
    .attr('markerHeight', 6)
    .attr('orient', 'auto')
    .append('path')
    .attr('d', 'M0,-4L8,0L0,4')
    .attr('fill', '#5a9fd4');

  // Draw links
  const link = g.append('g').selectAll('line')
    .data(links)
    .join('line')
    .attr('class', d => `tree-link ${d.type}`)
    .attr('marker-end', d => d.type === 'parent' ? 'url(#arrow-parent)' : null);

  // Link labels
  const linkLabel = g.append('g').selectAll('text')
    .data(links)
    .join('text')
    .attr('class', 'link-label')
    .text(d => getLinkLabel(d.type));

  // Draw nodes
  const node = g.append('g').selectAll('g')
    .data(nodes)
    .join('g')
    .attr('class', d => `tree-node ${d.gender}`)
    .call(d3.drag()
      .on('start', dragStart)
      .on('drag', dragged)
      .on('end', dragEnd)
    )
    .on('mouseover', (e, d) => showTooltip(e, d))
    .on('mousemove', (e) => moveTooltip(e))
    .on('mouseout', hideTooltip);

  // Circle
  node.append('circle')
    .attr('r', NODE_RADIUS);

  // Profile image (if available)
  node.append('image')
    .attr('href', d => `images/sims/profile/${d.id}.png`)
    .attr('x', -NODE_RADIUS)
    .attr('y', -NODE_RADIUS)
    .attr('width', NODE_RADIUS * 2)
    .attr('height', NODE_RADIUS * 2)
    .attr('clip-path', `circle(${NODE_RADIUS}px)`)
    .on('error', function() { d3.select(this).remove(); });

  // Name label below node
  node.append('text')
    .attr('class', 'name-label')
    .attr('y', NODE_RADIUS + 14)
    .text(d => d.name.split(' ')[0]); // First name only to keep it clean

  // Force simulation
  simulation = d3.forceSimulation(nodes)
    .force('link', d3.forceLink(links).id(d => d.id).distance(120).strength(0.8))
    .force('charge', d3.forceManyBody().strength(-400))
    .force('center', d3.forceCenter(W / 2, H / 2))
    .force('collision', d3.forceCollide(NODE_RADIUS + 20))
    .on('tick', () => {
      link
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y);

      linkLabel
        .attr('x', d => (d.source.x + d.target.x) / 2)
        .attr('y', d => (d.source.y + d.target.y) / 2 - 5);

      node.attr('transform', d => `translate(${d.x},${d.y})`);
    });
}

function getLinkLabel(type) {
  const labels = {
    married: '💍', parent: '↓', siblings: '≈', affair: '♦',
    dating: '♥', divorced: '✗', crush: '♡', stepparent: '↓',
    in_love: '♥', roommates: '⌂', best_friend: '★', situationship: '~'
  };
  return labels[type] || '';
}

function showTooltip(e, d) {
  tooltip.classList.add('visible');
  tooltip.innerHTML = `
    <div class="tree-tooltip-name">${d.name}</div>
    ${d.notes ? `<div class="tree-tooltip-notes">${d.notes}</div>` : ''}
  `;
  moveTooltip(e);
}

function moveTooltip(e) {
  const wrap = document.querySelector('.tree-wrap');
  const rect = wrap.getBoundingClientRect();
  tooltip.style.left = (e.clientX - rect.left + 12) + 'px';
  tooltip.style.top  = (e.clientY - rect.top + 12) + 'px';
}

function hideTooltip() {
  tooltip.classList.remove('visible');
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

// Wait for data.js to be ready, then also load family data
document.addEventListener('ocj-data-ready', () => {
  setBadge('badge-worlds', window.WORLDS.length);
  setBadge('badge-sims',   window.SIMS.length);
  setBadge('badge-lots',   window.LOTS.length);
});

function setBadge(id, count) {
  const el = document.getElementById(id);
  if (el && count > 0) el.textContent = count;
}

// Load family data independently
loadFamilyData();
