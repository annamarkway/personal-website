let activeTags = new Set();

async function loadPortfolio() {
  const resp = await fetch('portfolio.json');
  const items = await resp.json();
  window.portfolioItems = items;

  const presetTag = new URLSearchParams(window.location.search).get('tag');

  renderFilters(items);

  if (presetTag && items.some(i => i.tags.includes(presetTag))) {
    activeTags.add(presetTag);
    const chip = [...document.querySelectorAll('.tag-chip')].find(b => b.innerText === presetTag);
    if (chip) chip.classList.add('active');
  }

  applyFilters();
}

function renderFilters(items) {
  const allTags = new Set();
  items.forEach(i => i.tags.forEach(t => allTags.add(t)));
  const tagsContainer = document.getElementById('tag-filters');
  tagsContainer.innerHTML = '';
  [...allTags].sort().forEach(tag => {
    const btn = document.createElement('button');
    btn.className = 'tag-chip';
    btn.innerText = tag;
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

function applyFilters() {
  const search = document.getElementById('search').value.toLowerCase();
  const sort = document.getElementById('sort').value;
  let results = window.portfolioItems.filter(item => {
    const matchesTags = activeTags.size === 0 || [...activeTags].every(t => item.tags.includes(t));
    const matchesSearch = [item.title, item.short_description, item.long_description, item.context, (item.tech_stack || []).join(' ')].join(' ').toLowerCase().includes(search);
    return matchesTags && matchesSearch;
  });

  if (sort === 'recent') results.sort((a, b) => new Date(b.date) - new Date(a.date));
  if (sort === 'impact') results.sort((a, b) => b.impact_score - a.impact_score);

  renderGrid(results);
}

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
}

function renderGrid(items) {
  const grid = document.getElementById('portfolio-grid');
  grid.innerHTML = '';
  if (items.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'portfolio-empty';
    empty.innerText = 'No projects match your filters.';
    grid.appendChild(empty);
    return;
  }
  items.forEach(item => {
    const card = document.createElement('div');
    card.className = 'portfolio-card';

    const date = document.createElement('p');
    date.className = 'portfolio-card-date';
    date.innerText = formatDate(item.date);
    card.appendChild(date);

    const header = document.createElement('div');
    header.className = 'portfolio-card-header';

    const title = document.createElement('div');
    title.className = 'portfolio-card-title';
    title.innerText = item.title;
    header.appendChild(title);

    if (item.status) {
      const badge = document.createElement('span');
      badge.className = 'portfolio-status-badge';
      badge.innerText = item.status;
      header.appendChild(badge);
    }

    const context = document.createElement('div');
    context.className = 'portfolio-card-context';
    context.innerText = item.context || '';

    const meta = document.createElement('div');
    meta.className = 'portfolio-card-meta';
    meta.innerText = item.tech_stack.join(', ');

    const desc = document.createElement('p');
    desc.className = 'portfolio-card-desc';
    desc.innerText = item.short_description;

    const tagRow = document.createElement('div');
    tagRow.className = 'portfolio-tag-row';
    item.tags.forEach(t => {
      const chip = document.createElement('span');
      chip.className = 'portfolio-tag';
      chip.innerText = t;
      tagRow.appendChild(chip);
    });

    const actions = document.createElement('div');
    actions.className = 'portfolio-card-actions';

    const viewBtn = document.createElement('a');
    viewBtn.className = 'doc-btn';
    viewBtn.innerText = 'View Details';
    viewBtn.href = '#';
    viewBtn.onclick = (e) => { e.preventDefault(); openDetails(item); };
    actions.appendChild(viewBtn);

    (item.attachments || []).forEach(a => {
      const aEl = document.createElement('a');
      aEl.href = a.url;
      aEl.innerText = a.name;
      aEl.target = '_blank';
      aEl.className = 'doc-btn';
      actions.appendChild(aEl);
    });

    card.appendChild(header);
    card.appendChild(context);
    card.appendChild(meta);
    card.appendChild(desc);
    card.appendChild(tagRow);
    card.appendChild(actions);
    grid.appendChild(card);
  });
}

function openDetails(item) {
  const modal = document.getElementById('portfolio-modal');
  const overlay = document.getElementById('modal-overlay');
  modal.querySelector('.modal-context').innerText = item.context || '';
  modal.querySelector('.modal-title').innerText = item.title;
  modal.querySelector('.modal-body').innerText = item.long_description;
  const att = modal.querySelector('.modal-attachments');
  att.innerHTML = '';
  (item.attachments || []).forEach(a => {
    const aEl = document.createElement('a');
    aEl.href = a.url;
    aEl.innerText = a.name;
    aEl.target = '_blank';
    aEl.style.display = 'block';
    aEl.className = 'doc-btn';
    aEl.style.marginBottom = '0.5rem';
    att.appendChild(aEl);
  });
  modal.classList.add('open');
  overlay.classList.add('open');
}

function closeModal() {
  document.getElementById('portfolio-modal').classList.remove('open');
  document.getElementById('modal-overlay').classList.remove('open');
}

window.addEventListener('load', () => {
  document.getElementById('search').addEventListener('input', applyFilters);
  document.getElementById('sort').addEventListener('change', applyFilters);
  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('modal-overlay').addEventListener('click', closeModal);
  loadPortfolio();
});
