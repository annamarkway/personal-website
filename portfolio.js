// Portfolio filters: Type (pick one), Area and Tools (pick any).
// The allowed values live in filters.json; each project has a "type" and "areas",
// and its tools come from "tech_stack" entries that are on the tools list.
// Within a row, a project matches any selected chip; across rows it must match all.
let filterConfig = { types: [], areas: [], tools: [], toolAliases: {} };
const filterState = { type: null, areas: new Set(), tools: new Set() };
// Hidden filter set from ?employer=<key>; matches the "employer" field in portfolio.json.
let activeEmployer = null;
let lastFocused = null;

function projectTools(item) {
  const aliases = filterConfig.toolAliases || {};
  const tools = (item.tech_stack || []).map(t => aliases[t] || t).filter(t => filterConfig.tools.includes(t));
  return [...new Set(tools)];
}

const FACETS = [
  { key: 'type', param: 'type', label: 'Type', single: true, values: () => filterConfig.types, of: item => [item.type] },
  { key: 'areas', param: 'area', label: 'Area', values: () => filterConfig.areas, of: item => item.areas || [] },
  { key: 'tools', param: 'tool', label: 'Tools', values: () => filterConfig.tools, of: projectTools },
];

function selectedValues(facet) {
  if (facet.single) return filterState.type ? [filterState.type] : [];
  return [...filterState[facet.key]];
}

function matchesFacet(item, facet) {
  const selected = selectedValues(facet);
  if (!selected.length) return true;
  const values = facet.of(item);
  return selected.some(v => values.includes(v));
}

function searchText() {
  return document.getElementById('search').value.trim().toLowerCase();
}

function matchesBase(item) {
  if (activeEmployer && item.employer !== activeEmployer) return false;
  const search = searchText();
  if (!search) return true;
  const haystack = [item.title, item.short_description, item.long_description, item.context,
    (item.tech_stack || []).join(' '), (item.tags || []).join(' ')].join(' ').toLowerCase();
  return haystack.includes(search);
}

// Matches every filter, optionally ignoring one row (used for that row's chip counts).
function matchesAll(item, ignoreKey) {
  return matchesBase(item) && FACETS.every(f => f.key === ignoreKey || matchesFacet(item, f));
}

async function loadPortfolio() {
  const [items, config] = await Promise.all([
    fetch('portfolio.json').then(r => r.json()),
    fetch('filters.json').then(r => r.json()),
  ]);
  window.portfolioItems = items;
  filterConfig = config;

  const params = new URLSearchParams(window.location.search);
  const listParam = name => (params.get(name) || '').split(',').map(v => v.trim()).filter(Boolean);
  const presetType = params.get('type');
  if (presetType && filterConfig.types.includes(presetType)) filterState.type = presetType;
  listParam('area').filter(v => filterConfig.areas.includes(v)).forEach(v => filterState.areas.add(v));
  listParam('tool').filter(v => filterConfig.tools.includes(v)).forEach(v => filterState.tools.add(v));

  const presetEmployer = params.get('employer');
  if (presetEmployer && items.some(i => i.employer === presetEmployer)) activeEmployer = presetEmployer;

  renderFilters();
  applyFilters();

  const presetProject = params.get('project');
  const projectItem = presetProject && items.find(i => i.id === presetProject);
  if (projectItem) openDetails(projectItem);
}

function makeChip(label, onClick) {
  const btn = el('button', 'tag-chip');
  btn.type = 'button';
  btn.appendChild(el('span', 'chip-label', label));
  btn.appendChild(el('span', 'chip-count', ''));
  btn.onclick = onClick;
  return btn;
}

function renderFilters() {
  const container = document.getElementById('filters');
  container.innerHTML = '';
  FACETS.forEach(facet => {
    const row = el('div', 'filter-row');
    row.setAttribute('role', 'group');
    row.setAttribute('aria-label', facet.label);
    row.appendChild(el('span', 'filter-label', facet.label));
    const chips = el('div', 'filter-chips');

    if (facet.single) {
      const all = makeChip('All', () => { filterState.type = null; applyFilters(); });
      all.dataset.facet = facet.key;
      all.dataset.all = 'true';
      chips.appendChild(all);
    }
    facet.values().forEach(value => {
      const chip = makeChip(value, () => {
        if (facet.single) {
          filterState.type = filterState.type === value ? null : value;
        } else {
          const set = filterState[facet.key];
          set.has(value) ? set.delete(value) : set.add(value);
        }
        applyFilters();
      });
      chip.dataset.facet = facet.key;
      chip.dataset.value = value;
      chips.appendChild(chip);
    });
    row.appendChild(chips);
    container.appendChild(row);
  });
}

// Update each chip's count, pressed state, and whether it can be picked.
function updateFilterChips() {
  const items = window.portfolioItems;
  FACETS.forEach(facet => {
    const pool = items.filter(i => matchesAll(i, facet.key));
    const selected = selectedValues(facet);
    document.querySelectorAll(`.tag-chip[data-facet="${facet.key}"]`).forEach(chip => {
      let count, active;
      if (chip.dataset.all) {
        count = pool.length;
        active = selected.length === 0;
      } else {
        const value = chip.dataset.value;
        count = pool.filter(i => facet.of(i).includes(value)).length;
        active = selected.includes(value);
      }
      chip.querySelector('.chip-count').innerText = count;
      chip.classList.toggle('active', active);
      chip.setAttribute('aria-pressed', active ? 'true' : 'false');
      chip.disabled = count === 0 && !active;
    });
  });
}

function anyFilterActive() {
  return Boolean(filterState.type || filterState.areas.size || filterState.tools.size || searchText() || activeEmployer);
}

function clearAllFilters() {
  filterState.type = null;
  filterState.areas.clear();
  filterState.tools.clear();
  document.getElementById('search').value = '';
  activeEmployer = null;
  applyFilters();
}

function renderSummary(results) {
  const summary = document.getElementById('filter-summary');
  summary.innerHTML = '';
  const total = window.portfolioItems.length;
  summary.appendChild(el('span', '', `Showing ${results.length} of ${total} project${total === 1 ? '' : 's'}`));
  if (anyFilterActive()) {
    const clear = el('button', 'filter-clear', 'Clear all');
    clear.type = 'button';
    clear.onclick = clearAllFilters;
    summary.appendChild(clear);
  }
}

// Keep the address bar in sync so a filtered view can be shared.
function syncUrl() {
  const url = new URL(window.location.href);
  ['type', 'area', 'tool', 'employer', 'project', 'tag'].forEach(p => url.searchParams.delete(p));
  if (filterState.type) url.searchParams.set('type', filterState.type);
  if (filterState.areas.size) url.searchParams.set('area', [...filterState.areas].join(','));
  if (filterState.tools.size) url.searchParams.set('tool', [...filterState.tools].join(','));
  if (activeEmployer) url.searchParams.set('employer', activeEmployer);
  history.replaceState(null, '', url);
}

function clearEmployerFilter() {
  activeEmployer = null;
  applyFilters();
}

function renderEmployerBanner(results) {
  const banner = document.getElementById('employer-banner');
  if (!activeEmployer) {
    banner.hidden = true;
    return;
  }
  const label = (window.portfolioItems.find(i => i.employer === activeEmployer) || {}).context || 'this role';
  banner.innerHTML = '';
  banner.appendChild(el('span', '', 'Showing ' + results.length + ' project' + (results.length === 1 ? '' : 's') + ' from ' + label));
  const clear = el('button', 'employer-banner-clear', 'Show all projects');
  clear.type = 'button';
  clear.onclick = clearEmployerFilter;
  banner.appendChild(clear);
  banner.hidden = false;
}

function applyFilters() {
  const sort = document.getElementById('sort').value;
  const results = window.portfolioItems.filter(item => matchesAll(item));

  if (sort === 'recent') results.sort((a, b) => new Date(b.date) - new Date(a.date));
  if (sort === 'impact') results.sort((a, b) => b.impact_score - a.impact_score);

  updateFilterChips();
  renderSummary(results);
  renderEmployerBanner(results);
  renderGrid(results);
  syncUrl();
}

function attachmentLink(a) {
  const aEl = el('a', 'doc-btn', a.name);
  aEl.href = a.url;
  aEl.target = '_blank';
  aEl.rel = 'noopener';
  return aEl;
}

function renderGrid(items) {
  const grid = document.getElementById('portfolio-grid');
  grid.innerHTML = '';
  if (items.length === 0) {
    grid.appendChild(el('p', 'portfolio-empty', 'No projects match your filters.'));
    return;
  }
  items.forEach(item => {
    const card = buildCard(item);

    const actions = el('div', 'portfolio-card-actions');
    const viewBtn = el('button', 'doc-btn', 'View Details');
    viewBtn.type = 'button';
    viewBtn.onclick = () => openDetails(item);
    actions.appendChild(viewBtn);
    (item.attachments || []).forEach(a => actions.appendChild(attachmentLink(a)));

    card.appendChild(actions);
    grid.appendChild(card);
  });
}

function openDetails(item) {
  trackEvent('project-' + item.id, 'Project details: ' + item.title);
  const modal = document.getElementById('portfolio-modal');
  const overlay = document.getElementById('modal-overlay');
  modal.querySelector('.modal-context').innerText = item.context || '';
  modal.querySelector('.modal-title').innerText = item.title;
  const result = modal.querySelector('.modal-result');
  result.innerText = item.result || '';
  result.hidden = !item.result;
  modal.querySelector('.modal-body').innerText = item.long_description;
  const att = modal.querySelector('.modal-attachments');
  att.innerHTML = '';
  (item.attachments || []).forEach(a => att.appendChild(attachmentLink(a)));

  lastFocused = document.activeElement;
  modal.classList.add('open');
  overlay.classList.add('open');
  document.body.classList.add('modal-open');
  document.getElementById('modal-close').focus();
}

function closeModal() {
  const modal = document.getElementById('portfolio-modal');
  if (!modal.classList.contains('open')) return;
  modal.classList.remove('open');
  document.getElementById('modal-overlay').classList.remove('open');
  document.body.classList.remove('modal-open');
  if (lastFocused && lastFocused.focus) lastFocused.focus();
}

// Keep keyboard focus inside the open modal.
function trapFocus(e) {
  const modal = document.getElementById('portfolio-modal');
  if (e.key !== 'Tab' || !modal.classList.contains('open')) return;
  const focusable = [...modal.querySelectorAll('button, a[href]')];
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}

window.addEventListener('load', () => {
  document.getElementById('search').addEventListener('input', applyFilters);
  document.getElementById('sort').addEventListener('change', applyFilters);
  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('modal-overlay').addEventListener('click', closeModal);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
    trapFocus(e);
  });
  loadPortfolio();
});
