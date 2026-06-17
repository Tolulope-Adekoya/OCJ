// theme.js — Dark/light mode toggle. Applied before paint to avoid flash.

(function () {
  const saved = localStorage.getItem('ocj-theme');
  if (saved === 'light') document.documentElement.classList.add('light');
})();

document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('themeBtn');
  if (!btn) return;

  function update() {
    const isLight = document.documentElement.classList.contains('light');
    btn.textContent = isLight ? '🌙' : '☀';
    btn.title = isLight ? 'Switch to dark mode' : 'Switch to light mode';
  }

  update();

  btn.addEventListener('click', () => {
    document.documentElement.classList.toggle('light');
    localStorage.setItem('ocj-theme',
      document.documentElement.classList.contains('light') ? 'light' : 'dark');
    update();
  });
});
