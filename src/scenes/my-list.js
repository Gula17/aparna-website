// "My list": products a visitor saves (with the colour they chose) to show at their local shop or send on
// WhatsApp. It stays on the visitor's own device (browser storage). There is no cart and no buying: Aparna
// sells only through its dealers (brief §2-3).

const KEY = 'aparna-my-list';

export function readList() {
  try {
    const items = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(items) ? items.filter((x) => x && typeof x.id === 'string') : [];
  } catch {
    return []; // private mode or blocked storage: the list simply starts empty
  }
}

function writeList(items) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    /* storage unavailable: the change lasts for this page only */
  }
  document.dispatchEvent(new CustomEvent('mylist:change'));
}

const has = (id) => readList().some((x) => x.id === id);

export function toggleSaved(id, colour = null) {
  const items = readList();
  const index = items.findIndex((x) => x.id === id);
  if (index >= 0) items.splice(index, 1);
  else items.push({ id, colour, savedAt: Date.now() });
  writeList(items);
  return index < 0;
}

export function setColour(id, colour) {
  const items = readList();
  const item = items.find((x) => x.id === id);
  if (item) {
    item.colour = colour;
    writeList(items);
  }
}

function refreshButtons() {
  const count = readList().length;
  document.querySelectorAll('[data-list-count]').forEach((el) => {
    el.textContent = String(count);
    el.hidden = count === 0;
  });
  document.querySelectorAll('[data-save]').forEach((btn) => {
    const saved = has(btn.dataset.save);
    btn.setAttribute('aria-pressed', String(saved));
    btn.classList.toggle('is-saved', saved);
  });
}

// Heart buttons on cards and product pages, and the count in the header.
export function setupSaveButtons({ chosenColour = () => null } = {}) {
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-save]');
    if (!btn) return;
    e.preventDefault();
    const added = toggleSaved(btn.dataset.save, chosenColour(btn.dataset.save));
    btn.animate?.([{ transform: 'scale(1)' }, { transform: `scale(${added ? 1.25 : 0.85})` }, { transform: 'scale(1)' }], { duration: 320, easing: 'ease-out' });
  });
  document.addEventListener('mylist:change', refreshButtons);
  addEventListener('storage', (e) => e.key === KEY && refreshButtons()); // other tabs
  refreshButtons();
}

// The /my-list/ page.
export function setupListPage() {
  const list = document.querySelector('[data-list-items]');
  if (!list) return;
  const index = JSON.parse(document.getElementById('product-index').textContent);
  const empty = document.querySelector('[data-list-empty]');
  const actions = document.querySelector('[data-list-actions]');
  const share = document.querySelector('[data-list-share]');
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

  const draw = () => {
    const items = readList().filter((x) => index[x.id]); // ignore products that no longer exist
    list.innerHTML = items.map(({ id, colour }) => {
      const p = index[id];
      return `<li class="list-item">
        <a class="list-item__media" href="${esc(p.url)}">${p.image ? `<img src="${esc(p.image)}" alt="" loading="lazy">` : '<span class="no-photo no-photo--small"></span>'}</a>
        <div class="list-item__body">
          <a class="list-item__name" href="${esc(p.url)}">${esc(p.name)}</a>
          <p class="list-item__meta">${esc(p.category)} · ${esc(p.meta)}</p>
          ${colour ? `<p class="list-item__meta">${esc(list.dataset.colour)}: ${esc(colour)}</p>` : ''}
        </div>
        <button class="link-arrow list-item__remove" type="button" data-remove-id="${esc(id)}" aria-label="${esc(list.dataset.removeLabel.replace('{name}', p.name))}">${esc(list.dataset.remove)}</button>
      </li>`;
    }).join('');
    empty.hidden = items.length > 0;
    actions.hidden = items.length === 0;
    const lines = items.map(({ id, colour }) => `• ${index[id].name}${colour ? ` (${colour})` : ''}: ${location.origin}${index[id].url}`);
    share.href = `https://wa.me/?text=${encodeURIComponent(`${share.dataset.intro}\n${lines.join('\n')}`)}`;
  };

  list.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-remove-id]');
    if (btn) toggleSaved(btn.dataset.removeId);
  });
  document.querySelector('[data-list-clear]').addEventListener('click', () => writeList([]));
  document.addEventListener('mylist:change', draw);
  addEventListener('storage', (e) => e.key === KEY && draw());
  draw();
}
