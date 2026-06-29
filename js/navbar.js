// navbar.js — OCJ Save File
// Handles: scroll-aware background, hamburger toggle + X animation,
//          mobile menu close behaviours, auto-active link, opaque on inner pages

document.addEventListener('DOMContentLoaded', () => {
  const hamburger  = document.getElementById('hamburger');
  const mobileMenu = document.getElementById('mobileMenu');
  const navbar     = document.querySelector('.navbar');

  // ── Scroll-aware background ─────────────────────────────────
  // Index page: navbar starts transparent and gains .scrolled after 20px.
  // All other pages: navbar is always opaque (.opaque added immediately).
  const isHomePage = (
    window.location.pathname.endsWith('index.html') ||
    window.location.pathname === '/' ||
    window.location.pathname.endsWith('/')
  );

  if (navbar) {
    if (!isHomePage) {
      navbar.classList.add('opaque');
    } else {
      const onScroll = () => {
        navbar.classList.toggle('scrolled', window.scrollY > 20);
      };
      window.addEventListener('scroll', onScroll, { passive: true });
      onScroll(); // run once on load
    }
  }

  // ── Hamburger toggle ─────────────────────────────────────────
  if (hamburger && mobileMenu) {

    hamburger.addEventListener('click', () => {
      const isOpen = mobileMenu.classList.toggle('open');
      hamburger.classList.toggle('open', isOpen);
      hamburger.setAttribute('aria-expanded', String(isOpen));
      mobileMenu.setAttribute('aria-hidden', String(!isOpen));
    });

    // Close on mobile link click
    mobileMenu.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', closeMobileMenu);
    });

    // Close on outside click
    document.addEventListener('click', e => {
      if (!hamburger.contains(e.target) && !mobileMenu.contains(e.target)) {
        closeMobileMenu();
      }
    });

    // Close on Escape
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && mobileMenu.classList.contains('open')) {
        closeMobileMenu();
        hamburger.focus();
      }
    });
  }

  function closeMobileMenu() {
    if (!mobileMenu || !hamburger) return;
    mobileMenu.classList.remove('open');
    hamburger.classList.remove('open');
    hamburger.setAttribute('aria-expanded', 'false');
    mobileMenu.setAttribute('aria-hidden', 'true');
  }

  // ── Auto-active link ─────────────────────────────────────────
  // Detects current page from pathname and marks the matching link active.
  // This means no page needs a hardcoded class="active" in HTML.
  try {
    const path    = window.location.pathname.split('/').pop() || 'index.html';
    const allLinks = document.querySelectorAll('.navbar-links a, .mobile-menu a');

    allLinks.forEach(a => {
      const href = (a.getAttribute('href') || '').split('/').pop();
      if (!href) return;
      if (href === path || (href === 'index.html' && (path === '' || path === '/'))) {
        a.classList.add('active');
      } else {
        a.classList.remove('active');
      }
    });
  } catch (e) {
    // Non-critical — ignore
  }
});
