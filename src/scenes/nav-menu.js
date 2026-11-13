// The header's Products menu: a native <details>, so it opens and works without JavaScript. This adds:
// - the category thumbnails download only when the menu is first wanted (hover, focus or open),
// - Escape closes it and puts focus back on "Products"; a click outside, or the close button, closes it,
// - focus leaving the menu (Tab past the end) closes it,
// - arrow keys move between the tiles (Up/Down by a row of the grid), Home/End to the first/last link.

export function setupNavMenu() {
  for (const menu of document.querySelectorAll('[data-nav-menu]')) {
    const summary = menu.querySelector('summary');
    const grid = menu.querySelector('.nav-menu__grid');

    const loadThumbs = () => {
      for (const img of menu.querySelectorAll('img[data-src]')) {
        img.srcset = img.dataset.srcset;
        img.src = img.dataset.src;
        img.removeAttribute('data-src');
        img.removeAttribute('data-srcset');
      }
    };
    summary.addEventListener('pointerenter', loadThumbs, { once: true });
    summary.addEventListener('focus', loadThumbs, { once: true });
    menu.addEventListener('toggle', () => { if (menu.open) loadThumbs(); });

    const close = ({ focus = false } = {}) => {
      if (!menu.open) return;
      menu.open = false;
      if (focus) summary.focus();
    };
    menu.querySelector('[data-nav-close]')?.addEventListener('click', () => close({ focus: true }));
    document.addEventListener('click', (e) => { if (menu.open && !menu.contains(e.target)) close(); });
    menu.addEventListener('focusout', (e) => { if (menu.open && e.relatedTarget && !menu.contains(e.relatedTarget)) close(); });

    menu.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && menu.open) {
        e.preventDefault();
        close({ focus: true });
        return;
      }
      if (!menu.open || !['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
      const links = [...menu.querySelectorAll('.nav-menu__panel a')];
      const i = links.indexOf(document.activeElement);
      let next;
      if (document.activeElement === summary) next = e.key === 'ArrowDown' ? 0 : null;
      else if (i < 0) return;
      else {
        const cols = getComputedStyle(grid).gridTemplateColumns.split(' ').length || 1;
        const last = links.length - 1;
        next = {
          ArrowRight: Math.min(i + 1, last), ArrowLeft: Math.max(i - 1, 0),
          ArrowDown: Math.min(i + cols, last), ArrowUp: i - cols < 0 ? -1 : i - cols,
          Home: 0, End: last,
        }[e.key];
      }
      if (next === null) return;
      e.preventDefault();
      if (next < 0) summary.focus(); // up from the first row goes back to "Products"
      else links[next].focus();
    });
  }
}
