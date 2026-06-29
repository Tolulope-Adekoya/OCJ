// index.js — OCJ Save File home page logic
// Loads CSV counts for stat strip + nav cards,
// and probes for a hero image with graceful fallback.

document.addEventListener('DOMContentLoaded', async () => {

  // ── Hero image probe ──────────────────────────────────────────
  // Tries each candidate in order; applies the first one that loads.
  // If none load, the orb/gradient background handles the visual gracefully.
  probeHeroImage([
    'image/webdesign/webimages/hero.png',
    'image/webdesign/webimages/hero.webp',
    'image/webdesign/webimages/hero.jpeg',
    'image/webdesign/webimages/hero.jpg',
    // Legacy path with space in folder name — kept as final fallback
    'image/webdesign/web images/hero.png',
    'image/webdesign/web images/hero.jpeg',
    'image/webdesign/web images/hero.jpg',
  ]);

  // ── CSV counts ────────────────────────────────────────────────
  try {

    const { sims, worlds, lots, pets } = await window.CSV.loadCSVs({
      sims:   'data/sims.csv',
      worlds: 'data/worlds.csv',
      lots:   'data/lots.csv',
      pets:   'data/pets.csv',
    });

    const simCount = sims.filter(
      s => (s['NAME'] || '').trim()
    ).length;

    const worldCount = worlds.filter(
      w => (w['WORLD'] || '').trim()
    ).length;

    // Only count root lots (not child units of apartments)
    const lotCount = lots.filter(
      lot => !(lot['PARENT LOT ID'] || '').trim()
    ).length;

    const petCount = pets.filter(
      p => (p['NAME'] || '').trim()
    ).length;

    // Stat strip
    animateCount('statSims',   simCount);
    animateCount('statWorlds', worldCount);
    animateCount('statLots',   lotCount);
    animateCount('statPets',   petCount);

    // Nav card meta lines
    setCardCount('cardSimCount',   simCount,   'Sim');
    setCardCount('cardWorldCount', worldCount, 'World');
    setCardCount('cardLotCount',   lotCount,   'Lot');
    setCardCount('cardPetCount',   petCount,   'Pet');

  } catch (err) {
    console.error('[index.js]', err);
  }

});

// ── Hero image probe ──────────────────────────────────────────────
// Uses fetch HEAD requests (no image download) to test each path.
// Falls back silently — the gradient/orb system already looks good.
async function probeHeroImage(candidates) {
  const heroEl = document.getElementById('heroImage');
  if (!heroEl) return;

  for (const path of candidates) {
    try {
      const res = await fetch(path, { method: 'HEAD' });
      if (res.ok) {
        heroEl.style.backgroundImage    = `url('${CSS.escape ? path : path}')`;
        heroEl.style.backgroundSize     = 'cover';
        heroEl.style.backgroundPosition = 'center';
        heroEl.style.backgroundRepeat   = 'no-repeat';
        return; // found — stop probing
      }
    } catch {
      // Network error or CORS on this candidate — try next
    }
  }
  // No image found — heroEl stays empty, gradient + orbs handle it
}

// ── Count animation ───────────────────────────────────────────────
function animateCount(id, target) {
  const el = document.getElementById(id);
  if (!el) return;
  if (!target) { el.textContent = '0'; return; }

  const duration = 900;
  let start = null;

  function step(ts) {
    if (!start) start = ts;
    const progress = Math.min((ts - start) / duration, 1);
    el.textContent = Math.floor(progress * target);
    if (progress < 1) {
      requestAnimationFrame(step);
    } else {
      el.textContent = target.toLocaleString();
    }
  }

  requestAnimationFrame(step);
}

// ── Nav card count labels ─────────────────────────────────────────
function setCardCount(id, count, singular) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = `${count.toLocaleString()} ${singular}${count === 1 ? '' : 's'}`;
}
