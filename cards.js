// Shared helpers for rendering portfolio cards (used by home.js and portfolio.js).

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.innerText = text;
  return node;
}

// Builds the inner card element. Callers wrap it in a link or append actions.
function buildCard(item) {
  const card = el('div', 'portfolio-card');

  card.appendChild(el('p', 'portfolio-card-date', formatDate(item.date)));

  const header = el('div', 'portfolio-card-header');
  header.appendChild(el('div', 'portfolio-card-title', item.title));
  if (item.status) header.appendChild(el('span', 'portfolio-status-badge', item.status));
  card.appendChild(header);

  card.appendChild(el('div', 'portfolio-card-context', item.context || ''));
  card.appendChild(el('div', 'portfolio-card-meta', (item.tech_stack || []).join(', ')));

  if (item.result) card.appendChild(el('p', 'portfolio-card-result', item.result));

  card.appendChild(el('p', 'portfolio-card-desc', item.short_description));

  const tagRow = el('div', 'portfolio-tag-row');
  (item.tags || []).forEach(t => tagRow.appendChild(el('span', 'portfolio-tag', t)));
  card.appendChild(tagRow);

  return card;
}
