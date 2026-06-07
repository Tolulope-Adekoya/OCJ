// main.js — Home page
// Updates the stats bar and sidebar badges once data loads

document.addEventListener('ocj-data-ready', () => {
  const worldCount = window.WORLDS.length;
  const simCount   = window.SIMS.length;
  const lotCount   = window.LOTS.length;

  // Stats bar on home page
  animateCount('stat-worlds', worldCount);
  animateCount('stat-sims',   simCount);
  animateCount('stat-lots',   lotCount);

  // Sidebar badges
  setBadge('badge-worlds', worldCount);
  setBadge('badge-sims',   simCount);
  setBadge('badge-lots',   lotCount);
});

function animateCount(id, target) {
  const el = document.getElementById(id);
  if (!el || target === 0) return;
  let start = null;
  const duration = 900;
  const step = (ts) => {
    if (!start) start = ts;
    const progress = Math.min((ts - start) / duration, 1);
    el.textContent = Math.floor(progress * target);
    if (progress < 1) requestAnimationFrame(step);
    else el.textContent = target;
  };
  requestAnimationFrame(step);
}

function setBadge(id, count) {
  const el = document.getElementById(id);
  if (el && count > 0) el.textContent = count;
}
