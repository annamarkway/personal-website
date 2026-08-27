function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
}

async function loadFeaturedProjects() {
  const grid = document.getElementById('featured-projects-grid');
  if (!grid) return;

  const resp = await fetch('portfolio.json');
  const items = await resp.json();
  const featured = [...items].sort((a, b) => b.impact_score - a.impact_score).slice(0, 3);

  grid.innerHTML = '';
  featured.forEach(item => {
    const link = document.createElement('a');
    link.className = 'portfolio-card-link';
    link.href = 'portfolio.html';

    const card = document.createElement('div');
    card.className = 'portfolio-card';

    const date = document.createElement('p');
    date.className = 'portfolio-card-date';
    date.innerText = formatDate(item.date);

    const header = document.createElement('div');
    header.className = 'portfolio-card-header';

    const title = document.createElement('div');
    title.className = 'portfolio-card-title';
    title.innerText = item.title;
    header.appendChild(title);

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

    card.appendChild(date);
    card.appendChild(header);
    card.appendChild(context);
    card.appendChild(meta);
    card.appendChild(desc);
    card.appendChild(tagRow);
    link.appendChild(card);
    grid.appendChild(link);
  });
}

window.addEventListener('load', loadFeaturedProjects);
