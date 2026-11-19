// Featured projects on the homepage. Projects with "featured": true in
// portfolio.json are shown; if none are marked, the top 3 by impact_score are used.
async function loadFeaturedProjects() {
  const grid = document.getElementById('featured-projects-grid');
  if (!grid) return;

  const resp = await fetch('portfolio.json');
  const items = await resp.json();
  const byImpact = [...items].sort((a, b) => b.impact_score - a.impact_score);
  const marked = byImpact.filter(i => i.featured);
  const featured = marked.length ? marked : byImpact.slice(0, 3);

  grid.innerHTML = '';
  featured.forEach(item => {
    const link = el('a', 'portfolio-card-link');
    link.href = 'portfolio.html?project=' + encodeURIComponent(item.id);
    link.appendChild(buildCard(item));
    grid.appendChild(link);
  });
}

window.addEventListener('load', loadFeaturedProjects);
