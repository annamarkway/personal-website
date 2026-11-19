let activeTags = new Set();
// Hidden filter set from ?employer=<key>; matches the "employer" field in portfolio.json.
let activeEmployer = null;
let lastFocused = null;

async function loadPortfolio() {
  const resp = await fetch('portfolio.json');
  const items = await resp.json();
  window.portfolioItems = items;

  const params = new URLSearchParams(window.location.search);
  const presetTag = params.get('tag');
  const presetEmployer = params.get('employer');
  const presetProject = params.get('project');

  renderFilters(items);

  if (presetTag && items.some(i => i.tags.includes(presetTag))) {
    activeTags.add(presetTag);
    const chip = [...document.querySelectorAll('.tag-chip')].find(b => b.dataset.tag === presetTag);
    if (chip) chip.classList.add('active');
  }

  if (presetEmployer && items.some(i => i.employer === presetEmployer)) {
    activeEmployer = presetEmployer;
  }

  applyFilters();

  const projectItem = presetProject && items.find(i => i.id === presetProject);
  if (projectItem) openDetails(projectItem);
}

function renderFilters(items) {
  const allTags = new Set();
  items.forEach(i => i.tags.forEach(t => allTags.add(t)));
  const tagsContainer = document.getElementById('tag-filters');
  tagsContainer.innerHTML = '';
  [...allTags].sort().forEach(tag => {
    const btn = el('button', 'tag-chip', tag);
    btn.type = 'button';
    btn.dataset.tag = tag;
    btn.onclick = () => toggleTagFilter(tag, btn);
    tagsContainer.appendChild(btn);
  });
}

function toggleTagFilter(tag, btn) {
  if (activeTags.has(tag)) {
    activeTags.delete(tag);
    btn.classList.remove('active');
  } else {
    activeTags.add(tag);
    btn.classList.add('active');
  }
  applyFilters();
}

function clearEmployerFilter() {
  activeEmployer = null;
  const url = new URL(window.location.href);
  url.searchParams.delete('employer');
  history.replaceState(null, '', url);
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
  const search = document.getElementById('search').value.toLowerCase();
  const sort = document.getElementById('sort').value;
  let results = window.portfolioItems.filter(item => {
    const matchesEmployer = !activeEmployer || item.employer === activeEmployer;
    const matchesTags = activeTags.size === 0 || [...activeTags].every(t => item.tags.includes(t));
    const matchesSearch = [item.title, item.short_description, item.long_description, item.context, (item.tech_stack || []).join(' ')].join(' ').toLowerCase().includes(search);
    return matchesEmployer && matchesTags && matchesSearch;
  });

  if (sort === 'recent') results.sort((a, b) => new Date(b.date) - new Date(a.date));
  if (sort === 'impact') results.sort((a, b) => b.impact_score - a.impact_score);

  renderEmployerBanner(results);
  renderGrid(results);
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
