// navbar.js — Mobile hamburger toggle and scroll shadow

document.addEventListener('DOMContentLoaded', () => {
  const hamburger = document.getElementById('hamburger');
  const mobileMenu = document.getElementById('mobileMenu');
  const navbar = document.querySelector('.navbar');

  if (hamburger && mobileMenu) {
    hamburger.addEventListener('click', () => {
      const open = mobileMenu.classList.toggle('open');
      hamburger.classList.toggle('open', open);
      hamburger.setAttribute('aria-expanded', open);
    });

    // Close on link click
    mobileMenu.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', () => {
        mobileMenu.classList.remove('open');
        hamburger.classList.remove('open');
      });
    });

    // Close on outside click
    document.addEventListener('click', e => {
      if (!hamburger.contains(e.target) && !mobileMenu.contains(e.target)) {
        mobileMenu.classList.remove('open');
        hamburger.classList.remove('open');
      }
    });
  }

  // Navbar scroll shadow
  if (navbar) {
    window.addEventListener('scroll', () => {
      navbar.classList.toggle('scrolled', window.scrollY > 10);
    }, { passive: true });
  }

  // Mark active nav link based on current filename
  try {
    const path = window.location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.navbar-links a').forEach(a => {
      const href = (a.getAttribute('href') || '').split('/').pop();
      if (!href) return;
      if (href === path) {
        a.classList.add('active');
      } else {
        a.classList.remove('active');
      }
    });
    // mobile menu links
    document.querySelectorAll('.mobile-menu a').forEach(a => {
      const href = (a.getAttribute('href') || '').split('/').pop();
      if (href === path) a.classList.add('active'); else a.classList.remove('active');
    });
  } catch (e) {
    // ignore
  }
});
