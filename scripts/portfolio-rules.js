// Shared rules for portfolio.json and filters.json, used by both the
// project editor (admin.html, in the browser) and the checker
// (scripts/check-portfolio.mjs, in Node). Plain script, no modules, so it
// also works when admin.html is opened straight from disk.
(function (root) {
  const PROJECT_KEY_ORDER = [
    'id', 'title', 'context', 'short_description', 'long_description',
    'tags', 'type', 'areas', 'tech_stack', 'date', 'impact_score',
    'employer', 'featured', 'result', 'status', 'attachments',
  ];

  const isString = v => typeof v === 'string' && v.trim() !== '';
  const isStringList = v => Array.isArray(v) && v.every(isString);

  // problems: { errors: [], warnings: [] }
  // options.fileExists(path) -> bool, options.indexHtml -> string (both optional)
  function validate(items, filters, options) {
    const opts = options || {};
    const errors = [];
    const warnings = [];

    if (!Array.isArray(items)) {
      errors.push('portfolio.json must be a list of projects: [ {...}, {...} ]');
      return { errors, warnings };
    }

    const lists = {};
    for (const list of ['types', 'areas', 'tools']) {
      if (!filters || !isStringList(filters[list])) {
        errors.push(`filters.json: "${list}" must be a list of text values`);
        lists[list] = [];
      } else {
        lists[list] = filters[list];
      }
    }
    const allowed = (list, value) => lists[list].includes(value);

    const ids = new Set();
    const employers = new Set();

    items.forEach((p, i) => {
      const where = `Project #${i + 1}` + (p && p.id ? ` ("${p.id}")` : '');
      if (!p || typeof p !== 'object') { errors.push(`${where}: is not an object`); return; }

      for (const field of ['id', 'title', 'context', 'short_description', 'long_description', 'date']) {
        if (!isString(p[field])) errors.push(`${where}: "${field}" is missing or empty`);
      }
      if (!isStringList(p.tags)) errors.push(`${where}: "tags" must be a list of text values`);
      if (!isStringList(p.tech_stack)) errors.push(`${where}: "tech_stack" must be a list of text values`);
      if (typeof p.impact_score !== 'number' || isNaN(p.impact_score)) errors.push(`${where}: "impact_score" must be a number`);

      if (!allowed('types', p.type)) {
        errors.push(`${where}: "type" must be one of: ${lists.types.join(', ')}`);
      }
      if (!Array.isArray(p.areas) || p.areas.length === 0) {
        errors.push(`${where}: "areas" must be a list with at least one area`);
      } else {
        p.areas.filter(a => !allowed('areas', a)).forEach(a =>
          errors.push(`${where}: area "${a}" isn't in filters.json (allowed: ${lists.areas.join(', ')})`));
      }

      if (isString(p.date) && (!/^\d{4}-\d{2}-\d{2}$/.test(p.date) || isNaN(new Date(p.date + 'T00:00:00')))) {
        errors.push(`${where}: "date" must look like 2026-08-01`);
      }
      if (isString(p.id)) {
        if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(p.id)) errors.push(`${where}: "id" should use only lowercase letters, numbers, and dashes`);
        if (ids.has(p.id)) errors.push(`${where}: id "${p.id}" is used more than once`);
        ids.add(p.id);
      }

      if ('employer' in p) {
        if (!isString(p.employer)) errors.push(`${where}: "employer" must be text`);
        else employers.add(p.employer);
      }
      if ('featured' in p && typeof p.featured !== 'boolean') errors.push(`${where}: "featured" must be true or false (no quotes)`);
      if ('result' in p && !isString(p.result)) errors.push(`${where}: "result" must be text`);
      if ('status' in p && !isString(p.status)) errors.push(`${where}: "status" must be text`);

      if ('attachments' in p) {
        if (!Array.isArray(p.attachments)) errors.push(`${where}: "attachments" must be a list`);
        else p.attachments.forEach((a, j) => {
          if (!a || !isString(a.name) || !isString(a.url)) {
            errors.push(`${where}: attachment #${j + 1} needs a "name" and a "url"`);
          } else if (!/^https?:\/\//.test(a.url) && opts.fileExists && !opts.fileExists(a.url)) {
            errors.push(`${where}: attachment file "${a.url}" doesn't exist`);
          }
        });
      }
    });

    if (typeof opts.indexHtml === 'string') {
      const html = opts.indexHtml;
      for (const m of html.matchAll(/portfolio\.html\?employer=([^"&#]+)/g)) {
        if (!employers.has(decodeURIComponent(m[1]))) errors.push(`index.html links to employer "${m[1]}", but no project has that "employer"`);
      }
      for (const m of html.matchAll(/portfolio\.html\?project=([^"&#]+)/g)) {
        if (!ids.has(decodeURIComponent(m[1]))) errors.push(`index.html links to project "${m[1]}", which doesn't exist`);
      }
      const facetLists = { type: 'types', area: 'areas', tool: 'tools' };
      for (const m of html.matchAll(/portfolio\.html\?(?:[^"#]*&(?:amp;)?)?(type|area|tool)=([^"&#]+)/g)) {
        for (const value of decodeURIComponent(m[2]).split(',')) {
          if (!allowed(facetLists[m[1]], value.trim())) errors.push(`index.html links to ${m[1]} "${value}", which isn't in filters.json`);
        }
      }
    }

    // Filter values no project uses show up as greyed-out chips on the site.
    const used = { types: new Set(), areas: new Set(), tools: new Set() };
    const aliases = (filters && filters.toolAliases) || {};
    items.forEach(p => {
      if (!p || typeof p !== 'object') return;
      used.types.add(p.type);
      (Array.isArray(p.areas) ? p.areas : []).forEach(a => used.areas.add(a));
      (Array.isArray(p.tech_stack) ? p.tech_stack : []).forEach(t => used.tools.add(aliases[t] || t));
    });
    for (const list of ['types', 'areas', 'tools']) {
      const unused = lists[list].filter(v => !used[list].has(v));
      if (unused.length) warnings.push(`filters.json ${list} not used by any project: ${unused.join(', ')}`);
    }

    const featured = items.filter(p => p && p.featured === true).length;
    if (featured > 0 && featured !== 3) warnings.push(`${featured} projects are marked "featured"; the homepage grid is designed for 3`);

    return { errors, warnings };
  }

  // Writes portfolio.json in the file's existing style: one field per line,
  // short lists on one line, each attachment on its own line.
  function formatPortfolio(items) {
    const inlineObject = o => '{' + Object.keys(o).map(k => JSON.stringify(k) + ': ' + JSON.stringify(o[k])).join(', ') + '}';
    const inlineList = list => '[' + list.map(v => JSON.stringify(v)).join(', ') + ']';
    const projects = items.map(p => {
      const lines = orderedKeys(p).map(key => {
        const value = p[key];
        let text;
        if (key === 'attachments' && Array.isArray(value)) {
          text = value.length === 0 ? '[]'
            : '[\n' + value.map(a => '      ' + inlineObject(a)).join(',\n') + '\n    ]';
        } else if (Array.isArray(value) && value.every(v => typeof v !== 'object' || v === null)) {
          text = inlineList(value);
        } else {
          text = JSON.stringify(value);
        }
        return '    ' + JSON.stringify(key) + ': ' + text;
      });
      return '  {\n' + lines.join(',\n') + '\n  }';
    });
    return '[\n' + projects.join(',\n') + '\n]\n';
  }

  // Known keys in the standard order, then any extra keys in their original order.
  function orderedKeys(p) {
    const keys = Object.keys(p);
    const known = PROJECT_KEY_ORDER.filter(k => keys.includes(k) && k !== 'attachments');
    const extra = keys.filter(k => !PROJECT_KEY_ORDER.includes(k));
    return known.concat(extra, keys.includes('attachments') ? ['attachments'] : []);
  }

  function formatFilters(f) {
    const list = (arr, indent) => '[\n' + arr.map(v => indent + '  ' + JSON.stringify(v)).join(',\n') + '\n' + indent + ']';
    const aliases = f.toolAliases || {};
    const aliasLines = Object.keys(aliases).map(k => '    ' + JSON.stringify(k) + ': ' + JSON.stringify(aliases[k]));
    const extra = Object.keys(f).filter(k => !['types', 'areas', 'tools', 'toolAliases'].includes(k));
    const parts = [
      '  "types": [' + f.types.map(v => JSON.stringify(v)).join(', ') + ']',
      '  "areas": ' + list(f.areas, '  '),
      '  "tools": ' + list(f.tools, '  '),
      '  "toolAliases": ' + (aliasLines.length ? '{\n' + aliasLines.join(',\n') + '\n  }' : '{}'),
    ].concat(extra.map(k => '  ' + JSON.stringify(k) + ': ' + JSON.stringify(f[k])));
    return '{\n' + parts.join(',\n') + '\n}\n';
  }

  function slugify(text) {
    return String(text || '')
      .toLowerCase()
      .normalize('NFKD').replace(/[̀-ͯ]/g, '')
      .replace(/&/g, ' and ')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60)
      .replace(/-+$/, '');
  }

  root.PortfolioRules = { validate, formatPortfolio, formatFilters, slugify, PROJECT_KEY_ORDER };
})(typeof window !== 'undefined' ? window : globalThis);
