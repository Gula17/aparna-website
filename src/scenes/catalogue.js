// Search, filters and sorting on /products/ and the category pages.
// Every product card is already in the HTML (so the page works without JavaScript); this script only
// hides, shows and reorders them. The state lives in the URL, so a filtered view can be shared or bookmarked:
//   /products/?category=air-coolers&size=48&q=pearl&sort=name

const FACETS = ['category', 'series', 'type', 'size', 'colour'];
const MATCHERS = {
  category: (card, values) => values.includes(card.dataset.category),
  series: (card, values) => values.includes(card.dataset.series),
  type: (card, values) => values.includes(card.dataset.type),
  size: (card, values) => values.includes(card.dataset.size),
  colour: (card, values) => card.dataset.colours.split('|').some((c) => values.includes(c)),
};
const SORTS = {
  featured: (a, b) => a.dataset.sort.localeCompare(b.dataset.sort, undefined, { numeric: true }),
  name: (a, b) => a.dataset.name.localeCompare(b.dataset.name),
  'name-desc': (a, b) => b.dataset.name.localeCompare(a.dataset.name),
  size: (a, b) => (Number(a.dataset.size) || 999) - (Number(b.dataset.size) || 999),
  'size-desc': (a, b) => (Number(b.dataset.size) || 0) - (Number(a.dataset.size) || 0),
  new: (a, b) => Number(Boolean(b.dataset.new)) - Number(Boolean(a.dataset.new)) || SORTS.featured(a, b),
};

export function setupCatalogue() {
  const grid = document.querySelector('.catalogue .product-grid');
  if (!grid) return;
  const cards = [...grid.children];
  const filters = document.getElementById('filters');
  const search = document.querySelector('.toolbar input[name="q"]');
  const sort = document.querySelector('.toolbar select[name="sort"]');
  const count = document.querySelector('[data-count]');
  const none = document.querySelector('[data-none]');
  const done = document.querySelector('[data-filters-done]');
  const openBtn = document.querySelector('[data-filters-open]');

  // ---- URL <-> controls
  function readUrl() {
    const params = new URLSearchParams(location.search);
    search.value = params.get('q') ?? '';
    sort.value = SORTS[params.get('sort')] ? params.get('sort') : 'featured';
    filters.querySelectorAll('input[type="checkbox"]').forEach((input) => {
      input.checked = params.getAll(input.name).includes(input.value);
    });
  }
  function writeUrl() {
    const params = new URLSearchParams();
    if (search.value.trim()) params.set('q', search.value.trim());
    if (sort.value !== 'featured') params.set('sort', sort.value);
    filters.querySelectorAll('input[type="checkbox"]:checked').forEach((input) => params.append(input.name, input.value));
    const query = params.toString();
    history.replaceState(null, '', `${location.pathname}${query ? `?${query}` : ''}`);
  }

  // ---- filtering
  function apply() {
    const words = search.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const chosen = Object.fromEntries(FACETS.map((f) => [f, [...filters.querySelectorAll(`input[name="${f}"]:checked`)].map((i) => i.value)]));
    const newOnly = filters.querySelector('input[name="new"]')?.checked;

    let shown = 0;
    for (const card of cards) {
      const ok = words.every((w) => card.dataset.search.includes(w))
        && FACETS.every((f) => chosen[f].length === 0 || MATCHERS[f](card, chosen[f]))
        && (!newOnly || card.dataset.new);
      card.hidden = !ok;
      if (ok) shown++;
    }
    [...cards].sort(SORTS[sort.value]).forEach((card) => grid.append(card));

    const text = (shown === 1 ? count.dataset.one : count.dataset.many).replace('{count}', shown);
    count.textContent = text;
    done.textContent = count.dataset.done.replace('{count}', shown);
    none.hidden = shown > 0;
    showActiveCounts();
    writeUrl();
    document.dispatchEvent(new CustomEvent('catalogue:filtered'));
  }

  // ---- how many options are ticked, on each pill and on the phone "Filters" button
  const pops = [...filters.querySelectorAll('.filter-pop')];
  const clear = filters.querySelector('[data-clear]');
  const activeCount = document.querySelector('[data-active-count]');
  function showActiveCounts() {
    let total = 0;
    for (const pop of pops) {
      const n = pop.querySelectorAll('input:checked').length;
      const badge = pop.querySelector('[data-facet-count]');
      badge.textContent = n;
      badge.hidden = !n;
      total += n;
    }
    if (filters.querySelector('input[name="new"]')?.checked) total++;
    activeCount.textContent = total;
    activeCount.hidden = !total;
    clear.hidden = !total && !search.value.trim();
  }

  readUrl();
  apply();
  let typing;
  search.addEventListener('input', () => { clearTimeout(typing); typing = setTimeout(apply, 120); });
  sort.addEventListener('change', apply);
  filters.addEventListener('change', apply);
  clear.addEventListener('click', () => {
    filters.querySelectorAll('input[type="checkbox"]').forEach((i) => { i.checked = false; });
    search.value = '';
    apply();
  });

  // ---- desktop: one dropdown open at a time; click outside or Esc closes it
  const isDrawer = () => matchMedia('(max-width: 899px)').matches;
  for (const pop of pops) {
    pop.addEventListener('toggle', () => {
      if (pop.open && !isDrawer()) pops.forEach((other) => { if (other !== pop) other.open = false; });
    });
  }
  document.addEventListener('click', (e) => {
    if (isDrawer()) {
      if (filters.classList.contains('is-open') && !filters.contains(e.target) && !openBtn.contains(e.target)) setOpen(false);
      return;
    }
    pops.forEach((pop) => { if (pop.open && !pop.contains(e.target)) pop.open = false; });
  });

  // ---- phones and tablets: the filters open as a drawer, every group open
  const setOpen = (open) => {
    filters.classList.toggle('is-open', open);
    openBtn.setAttribute('aria-expanded', String(open));
    document.documentElement.classList.toggle('filters-open', open);
    if (open) {
      pops.forEach((pop) => { pop.open = true; });
      filters.querySelector('[data-filters-close]').focus();
    }
  };
  openBtn.addEventListener('click', () => setOpen(true));
  done.addEventListener('click', () => { setOpen(false); openBtn.focus(); });
  filters.querySelector('[data-filters-close]').addEventListener('click', () => { setOpen(false); openBtn.focus(); });
  addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (filters.classList.contains('is-open')) { setOpen(false); openBtn.focus(); return; }
    const open = pops.find((pop) => pop.open);
    if (open) { open.open = false; open.querySelector('summary').focus(); }
  });
  // leaving drawer size (e.g. rotating a tablet) closes the drawer and folds the dropdowns
  matchMedia('(max-width: 899px)').addEventListener('change', () => { setOpen(false); pops.forEach((pop) => { pop.open = false; }); });
}
