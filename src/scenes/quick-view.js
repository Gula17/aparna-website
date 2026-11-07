// Quick view on every product card: a pop-up with the product in real-time 3D (drag to turn it, blades
// turning), or its photo where there is no 3D model or this device runs without 3D. One shared dialog per page;
// each open builds a fresh 3D view and closing frees it (browsers allow only a few 3D views at once).

import { mountViewer } from './products.js';

export function setupQuickView({ can3D, quality }) {
  const dialog = document.querySelector('[data-quick-dialog]');
  if (!dialog) return;
  const media = dialog.querySelector('[data-quick-media]');
  const $ = (name) => dialog.querySelector(`[data-quick-${name}]`);
  let current = null;
  let opener = null;

  document.addEventListener('click', (e) => {
    const button = e.target.closest('[data-quick]');
    if (!button) return;
    e.preventDefault();
    opener = button;
    open(button.closest('.product-card'));
  });

  function open(card) {
    const d = card.dataset;
    $('series').textContent = d.seriesLabel ?? '';
    $('name').textContent = d.title ?? '';
    $('meta').textContent = d.meta ?? '';
    $('link').href = d.url;
    $('save').dataset.save = d.id;
    $('save').setAttribute('aria-label', $('save').dataset.labelTemplate.replace('{name}', d.title ?? ''));
    document.dispatchEvent(new CustomEvent('mylist:change')); // shows whether this one is saved
    media.replaceChildren();
    const use3D = can3D && d.model;
    $('hint').hidden = !use3D;
    if (use3D) {
      const host = document.createElement('div');
      host.className = 'viewer quick__viewer';
      host.dataset.viewer = d.model;
      host.tabIndex = 0;
      host.setAttribute('role', 'img');
      host.setAttribute('aria-label', dialog.dataset.viewerLabel.replace('{name}', d.title ?? ''));
      host.innerHTML = `<canvas class="viewer__canvas"></canvas><span class="viewer__badge" aria-hidden="true">${dialog.dataset.badge}</span>`;
      media.append(host);
      dialog.showModal();
      mountViewer(host, { quality }).then((v) => {
        if (!dialog.open || !media.contains(host)) { v?.dispose(); return; } // closed before it was ready
        current = v;
      }).catch(() => { media.replaceChildren(photo(d)); });
    } else {
      media.replaceChildren(photo(d));
      dialog.showModal();
    }
  }

  function photo(d) {
    if (!d.img) {
      const p = document.createElement('p');
      p.className = 'quick__nophoto';
      p.textContent = dialog.dataset.noPhoto;
      return p;
    }
    const img = new Image();
    img.src = d.img;
    img.alt = d.title ?? '';
    img.className = 'quick__img';
    return img;
  }

  dialog.addEventListener('close', () => {
    current?.dispose();
    current = null;
    media.replaceChildren();
    opener?.focus();
  });
  $('close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); }); // the backdrop
}
