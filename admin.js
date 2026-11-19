// Portfolio project editor. Reads and writes portfolio.json, filters.json,
// and documents/ in the website folder you pick, using the browser's
// File System Access API (Chrome or Edge). Nothing is sent anywhere.
(function () {
  const R = window.PortfolioRules;
  const $ = id => document.getElementById(id);

  const state = {
    dir: null,           // FileSystemDirectoryHandle for the website folder
    items: [],           // portfolio.json
    filters: null,       // filters.json
    indexHtml: '',       // index.html, for link checks
    docFiles: new Set(), // "documents/<name>" files that already exist
    editing: null,       // index into items, or null for a new project
    dirty: false,
  };

  // The project being edited.
  const form = {
    original: null,
    idTouched: false,
    areas: new Set(),
    tools: new Set(),
    techOther: [],
    tags: [],
    attachments: [],     // { name, type?, url, file? } (file = pending upload)
    newValues: { types: new Set(), areas: new Set(), tools: new Set() },
  };

  // ---------- Saved folder (so you don't have to pick it every time) ----------

  function idb(mode, fn) {
    return new Promise((resolve, reject) => {
      const open = indexedDB.open('portfolio-editor', 1);
      open.onupgradeneeded = () => open.result.createObjectStore('kv');
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const tx = open.result.transaction('kv', mode);
        const req = fn(tx.objectStore('kv'));
        tx.oncomplete = () => resolve(req && req.result);
        tx.onerror = () => reject(tx.error);
      };
    });
  }
  const saveHandle = h => idb('readwrite', s => s.put(h, 'dir')).catch(() => {});
  const loadHandle = () => idb('readonly', s => s.get('dir')).catch(() => null);

  // ---------- Files ----------

  async function readText(name) {
    const fh = await state.dir.getFileHandle(name);
    return (await fh.getFile()).text();
  }

  async function writeFile(dirHandle, name, data) {
    const fh = await dirHandle.getFileHandle(name, { create: true });
    const w = await fh.createWritable();
    await w.write(data);
    await w.close();
  }

  async function useDirectory(handle) {
    try {
      await handle.getFileHandle('portfolio.json');
      await handle.getFileHandle('filters.json');
    } catch {
      showMessages('connect-messages', [['error', `"${handle.name}" doesn't look like the website folder: it needs portfolio.json and filters.json. Pick the personal-website folder.`]]);
      return false;
    }
    state.dir = handle;
    await loadAll();
    $('connect-panel').hidden = true;
    $('editor').hidden = false;
    $('folder-status').textContent = 'Folder: ' + handle.name;
    startNew();
    return true;
  }

  async function loadAll() {
    state.items = JSON.parse(await readText('portfolio.json'));
    state.filters = JSON.parse(await readText('filters.json'));
    state.filters.toolAliases = state.filters.toolAliases || {};
    try { state.indexHtml = await readText('index.html'); } catch { state.indexHtml = ''; }
    state.docFiles = new Set();
    try {
      const docs = await state.dir.getDirectoryHandle('documents');
      for await (const [name, entry] of docs.entries()) {
        if (entry.kind === 'file') state.docFiles.add('documents/' + name);
      }
    } catch { /* no documents folder yet */ }
    renderList();
  }

  // ---------- Project list ----------

  function renderList() {
    const list = $('project-list');
    list.innerHTML = '';
    const order = state.items.map((p, i) => i).sort((a, b) =>
      String(state.items[b].date).localeCompare(String(state.items[a].date)));
    order.forEach(i => {
      const p = state.items[i];
      const btn = el('button', 'project-item' + (state.editing === i ? ' active' : ''));
      btn.type = 'button';
      btn.appendChild(el('span', 't', p.title || p.id));
      btn.appendChild(el('span', 'm', [p.type, p.date ? formatDate(p.date) : ''].filter(Boolean).join(' · ')));
      btn.onclick = () => { if (confirmDiscard()) startEdit(i); };
      list.appendChild(btn);
    });
  }

  function confirmDiscard() {
    return !state.dirty || window.confirm('You have unsaved changes. Discard them?');
  }

  // ---------- Loading a project into the form ----------

  function canonicalTool(name) {
    const alias = state.filters.toolAliases[name] || name;
    return state.filters.tools.includes(alias) ? alias : null;
  }

  function resetForm(project) {
    form.original = project ? JSON.parse(JSON.stringify(project)) : null;
    form.idTouched = Boolean(project);
    form.areas = new Set(project ? project.areas || [] : []);
    form.tools = new Set();
    form.techOther = [];
    (project ? project.tech_stack || [] : []).forEach(t => {
      const tool = canonicalTool(t);
      if (tool) form.tools.add(tool); else form.techOther.push(t);
    });
    form.tags = project ? [...(project.tags || [])] : [];
    form.attachments = project ? (project.attachments || []).map(a => ({ ...a })) : [];
    form.newValues = { types: new Set(), areas: new Set(), tools: new Set() };

    $('f-title').value = project ? project.title || '' : '';
    $('f-id').value = project ? project.id || '' : '';
    $('f-date').value = project ? project.date || '' : new Date().toISOString().slice(0, 10);
    $('f-context').value = project ? project.context || '' : '';
    $('f-short').value = project ? project.short_description || '' : '';
    $('f-long').value = project ? project.long_description || '' : '';
    $('f-impact').value = project && typeof project.impact_score === 'number' ? project.impact_score : 5;
    $('f-result').value = project ? project.result || '' : '';
    $('f-status').value = project ? project.status || '' : '';
    $('f-featured').checked = Boolean(project && project.featured);
    $('type-new').value = '';
    $('employer-new').value = '';

    renderTypeSelect(project ? project.type : '');
    renderEmployerSelect(project ? project.employer || '' : '');
    renderAll();
    clearMessages('form-messages');
    state.dirty = false;
  }

  function startNew() {
    state.editing = null;
    $('form-title').textContent = 'New project';
    $('delete-btn').hidden = true;
    $('id-hint').textContent = 'Used in links like portfolio.html?project=… Filled in from the title.';
    resetForm(null);
    renderList();
    $('f-title').focus();
  }

  function startEdit(index) {
    state.editing = index;
    $('form-title').textContent = 'Edit: ' + (state.items[index].title || state.items[index].id);
    $('delete-btn').hidden = false;
    $('id-hint').textContent = 'Changing the ID breaks existing links to this project.';
    resetForm(state.items[index]);
    renderList();
  }

  // ---------- Pickers ----------

  function renderTypeSelect(current) {
    const sel = $('f-type');
    sel.innerHTML = '';
    sel.appendChild(new Option('Choose a type…', ''));
    state.filters.types.forEach(t => sel.appendChild(new Option(t, t)));
    sel.appendChild(new Option('+ New type…', '__new__'));
    sel.value = state.filters.types.includes(current) ? current : '';
    $('type-new-row').hidden = true;
  }

  function existingEmployers() {
    return [...new Set(state.items.map(p => p.employer).filter(Boolean))].sort();
  }

  function renderEmployerSelect(current) {
    const sel = $('f-employer');
    sel.innerHTML = '';
    sel.appendChild(new Option('None', ''));
    existingEmployers().forEach(e => sel.appendChild(new Option(e, e)));
    sel.appendChild(new Option('+ New employer…', '__new__'));
    sel.value = current;
    $('employer-new-row').hidden = true;
  }

  function renderPicks(containerId, values, selected, newSet) {
    const box = $(containerId);
    box.innerHTML = '';
    values.forEach(v => {
      const b = el('button', 'pick' + (newSet.has(v) ? ' new' : ''), v);
      b.type = 'button';
      b.setAttribute('aria-pressed', selected.has(v) ? 'true' : 'false');
      b.onclick = () => {
        selected.has(v) ? selected.delete(v) : selected.add(v);
        changed();
        renderAll();
      };
      box.appendChild(b);
    });
  }

  function renderTokens(containerId, list) {
    const box = $(containerId);
    box.innerHTML = '';
    list.forEach((v, i) => {
      const t = el('span', 'token', v);
      const x = el('button', '', '×');
      x.type = 'button';
      x.setAttribute('aria-label', 'Remove ' + v);
      x.onclick = () => { list.splice(i, 1); changed(); renderAll(); };
      t.appendChild(x);
      box.appendChild(t);
    });
    if (!list.length) box.appendChild(el('span', 'hint', 'None yet.'));
  }

  function renderAttachments() {
    const box = $('attachments');
    box.innerHTML = '';
    if (!form.attachments.length) box.appendChild(el('span', 'hint', 'No attachments.'));
    form.attachments.forEach((a, i) => {
      const row = el('div', 'attachment-row');
      row.appendChild(el('span', 'name', a.name));
      row.appendChild(el('span', 'url', a.url));
      if (a.file) row.appendChild(el('span', 'pending', 'will be copied on save'));
      const x = el('button', 'btn btn-light btn-small', 'Remove');
      x.type = 'button';
      x.onclick = () => { form.attachments.splice(i, 1); changed(); renderAll(); };
      row.appendChild(x);
      box.appendChild(row);
    });
  }

  function renderTagSuggestions() {
    const all = new Set();
    state.items.forEach(p => (p.tags || []).forEach(t => all.add(t)));
    const dl = $('tag-suggestions');
    dl.innerHTML = '';
    [...all].sort().filter(t => !form.tags.includes(t)).forEach(t => dl.appendChild(new Option(t)));
  }

  function renderFeaturedHint() {
    const others = state.items.filter((p, i) => p.featured && i !== state.editing).length;
    const total = others + ($('f-featured').checked ? 1 : 0);
    $('featured-hint').textContent = `${total} project${total === 1 ? '' : 's'} featured` + (total === 3 ? '.' : ' (the homepage is designed for 3).');
  }

  function renderAll() {
    renderPicks('areas', state.filters.areas.concat([...form.newValues.areas]), form.areas, form.newValues.areas);
    renderPicks('tools', state.filters.tools.concat([...form.newValues.tools]), form.tools, form.newValues.tools);
    renderTokens('tech-other', form.techOther);
    renderTokens('tags', form.tags);
    renderAttachments();
    renderTagSuggestions();
    renderFeaturedHint();
    renderPreview();
  }

  // ---------- Building the project from the form ----------

  function currentType() {
    const v = $('f-type').value;
    return v === '__new__' ? $('type-new').value.trim() : v;
  }

  function currentEmployer() {
    const v = $('f-employer').value;
    return v === '__new__' ? R.slugify($('employer-new').value) : v;
  }

  // tech_stack keeps its existing order; new entries are added at the end.
  function buildTechStack() {
    const wantedTools = new Set(form.tools);
    const wantedOther = new Set(form.techOther);
    const result = [];
    const covered = new Set();
    const original = form.original ? form.original.tech_stack || [] : [];
    original.forEach(t => {
      const tool = canonicalTool(t) || (form.newValues.tools.has(t) ? t : null);
      if (tool ? wantedTools.has(tool) : wantedOther.has(t)) {
        result.push(t);
        covered.add(tool || t);
      }
    });
    const toolOrder = state.filters.tools.concat([...form.newValues.tools]);
    toolOrder.filter(t => wantedTools.has(t) && !covered.has(t)).forEach(t => { result.push(t); covered.add(t); });
    form.techOther.filter(t => !covered.has(t)).forEach(t => { result.push(t); covered.add(t); });
    return result;
  }

  function buildProject() {
    const base = form.original ? JSON.parse(JSON.stringify(form.original)) : {};
    const p = {};
    const set = (key, value) => { p[key] = value; };
    // Start from the standard key order, then keep any extra keys the project already had.
    R.PROJECT_KEY_ORDER.forEach(k => { if (k in base) p[k] = base[k]; });
    Object.keys(base).forEach(k => { if (!(k in p)) p[k] = base[k]; });

    set('id', $('f-id').value.trim());
    set('title', $('f-title').value.trim());
    set('context', $('f-context').value.trim());
    set('short_description', $('f-short').value.trim());
    set('long_description', $('f-long').value.trim());
    set('tags', [...form.tags]);
    set('type', currentType());
    set('areas', state.filters.areas.concat([...form.newValues.areas]).filter(a => form.areas.has(a)));
    set('tech_stack', buildTechStack());
    set('date', $('f-date').value);
    const impact = Number($('f-impact').value);
    set('impact_score', $('f-impact').value === '' ? NaN : impact);

    const optional = {
      employer: currentEmployer(),
      result: $('f-result').value.trim(),
      status: $('f-status').value.trim(),
    };
    Object.entries(optional).forEach(([k, v]) => { if (v) p[k] = v; else delete p[k]; });
    if ($('f-featured').checked) p.featured = true; else delete p.featured;

    set('attachments', form.attachments.map(a => {
      const out = { name: a.name };
      if (a.type) out.type = a.type;
      out.url = a.url;
      return out;
    }));

    // Re-apply the standard key order for any keys added above.
    const ordered = {};
    const keys = Object.keys(p);
    R.PROJECT_KEY_ORDER.filter(k => keys.includes(k) && k !== 'attachments').forEach(k => { ordered[k] = p[k]; });
    keys.filter(k => !R.PROJECT_KEY_ORDER.includes(k)).forEach(k => { ordered[k] = p[k]; });
    ordered.attachments = p.attachments;
    return ordered;
  }

  // filters.json with any new values this project actually uses.
  function buildFilters(project) {
    const f = JSON.parse(JSON.stringify(state.filters));
    form.newValues.areas.forEach(a => { if (project.areas.includes(a) && !f.areas.includes(a)) f.areas.push(a); });
    form.newValues.tools.forEach(t => { if (form.tools.has(t) && !f.tools.includes(t)) f.tools.push(t); });
    if (form.newValues.types.size && project.type && !f.types.includes(project.type)) f.types.push(project.type);
    return f;
  }

  // ---------- Preview ----------

  function renderPreview() {
    const stage = $('preview');
    stage.innerHTML = '';
    const p = buildProject();
    const shown = {
      ...p,
      title: p.title || 'Project title',
      context: p.context || 'Context',
      short_description: p.short_description || 'Short description',
      date: p.date || new Date().toISOString().slice(0, 10),
    };
    const card = buildCard(shown);
    if (p.attachments.length) {
      const actions = el('div', 'portfolio-card-actions');
      actions.appendChild(el('span', 'doc-btn', 'View Details'));
      p.attachments.forEach(a => actions.appendChild(el('span', 'doc-btn', a.name)));
      card.appendChild(actions);
    }
    const wrap = el('div', 'portfolio-section');
    wrap.style.padding = '0';
    wrap.appendChild(card);
    stage.appendChild(wrap);
    $('preview-long').textContent = p.long_description || '';
  }

  // ---------- Messages ----------

  function showMessages(id, list) {
    const box = $(id);
    box.innerHTML = '';
    list.forEach(([kind, text]) => box.appendChild(el('div', 'msg msg-' + kind, text)));
  }
  function clearMessages(id) { $(id).innerHTML = ''; }

  // ---------- Saving ----------

  function uniqueDocPath(fileName, taken) {
    const safe = fileName.toLowerCase().replace(/[^a-z0-9._-]+/g, '_').replace(/^_+|_+$/g, '') || 'attachment';
    const dot = safe.lastIndexOf('.');
    const stem = dot > 0 ? safe.slice(0, dot) : safe;
    const ext = dot > 0 ? safe.slice(dot) : '';
    let path = 'documents/' + safe;
    for (let n = 2; taken.has(path); n++) path = `documents/${stem}-${n}${ext}`;
    return path;
  }

  function candidateFiles() {
    const pending = new Set(form.attachments.filter(a => a.file).map(a => a.url));
    return path => state.docFiles.has(path) || pending.has(path);
  }

  async function save(e) {
    e.preventDefault();
    const project = buildProject();
    const filters = buildFilters(project);
    const items = state.items.slice();
    if (state.editing === null) items.push(project); else items[state.editing] = project;

    const extra = [];
    if (form.newValues.types.size && !project.type) extra.push(['error', 'Enter a name for the new type.']);
    const { errors, warnings } = R.validate(items, filters, { fileExists: candidateFiles(), indexHtml: state.indexHtml });
    const idx = items.indexOf(project);
    const thisProject = new RegExp('^Project #' + (idx + 1) + '[ :]');
    const mine = errors.filter(m => thisProject.test(m) || !m.startsWith('Project #'));
    if (project.id && items.some(q => q !== project && q.id === project.id)) {
      extra.push(['error', `Another project already uses the ID "${project.id}". Choose a different ID.`]);
      for (let i = mine.length - 1; i >= 0; i--) if (/is used more than once$/.test(mine[i])) mine.splice(i, 1);
    }
    const others = errors.length - mine.length;
    if (others) extra.push(['warning', `${others} problem(s) in other projects; run the checker for details. Saving anyway.`]);
    if (mine.length || extra.some(([k]) => k === 'error')) {
      showMessages('form-messages', extra.concat(mine.map(m => ['error', m.replace(/^Project #\d+( \("[^"]*"\))?: /, '')])));
      return;
    }

    $('save-btn').disabled = true;
    try {
      const uploads = form.attachments.filter(a => a.file);
      if (uploads.length) {
        const docs = await state.dir.getDirectoryHandle('documents', { create: true });
        for (const a of uploads) {
          await writeFile(docs, a.url.slice('documents/'.length), a.file);
          state.docFiles.add(a.url);
          delete a.file;
        }
      }
      const filtersChanged = R.formatFilters(filters) !== R.formatFilters(state.filters);
      if (filtersChanged) await writeFile(state.dir, 'filters.json', R.formatFilters(filters));
      await writeFile(state.dir, 'portfolio.json', R.formatPortfolio(items));

      state.items = items;
      state.filters = filters;
      const wasNew = state.editing === null;
      state.editing = items.indexOf(project);
      const notes = [['success', `Saved "${project.title}". ${wasNew ? 'Added to' : 'Updated in'} portfolio.json` +
        (filtersChanged ? ', with new filter values in filters.json' : '') +
        (uploads.length ? `, and copied ${uploads.length} file(s) into documents/` : '') +
        '. Commit and push to publish it.']];
      warnings.forEach(w => notes.push(['warning', w]));
      if (project.employer && !state.indexHtml.includes('employer=' + project.employer)) {
        notes.push(['warning', `No Experience link on the homepage uses employer "${project.employer}" yet. Add one to index.html if this is a new role.`]);
      }
      startEdit(state.editing);
      showMessages('form-messages', notes);
    } catch (err) {
      showMessages('form-messages', [['error', 'Saving failed: ' + err.message]]);
    } finally {
      $('save-btn').disabled = false;
    }
  }

  async function removeProject() {
    if (state.editing === null) return;
    const p = state.items[state.editing];
    if (!window.confirm(`Delete "${p.title}" from portfolio.json? Attachment files in documents/ are kept.`)) return;
    const items = state.items.filter((_, i) => i !== state.editing);
    const { errors } = R.validate(items, state.filters, { indexHtml: state.indexHtml });
    const links = errors.filter(m => m.startsWith('index.html'));
    if (links.length) {
      showMessages('form-messages', [['error', 'Not deleted: the homepage still links to this project or its employer. Update index.html first.']]
        .concat(links.map(m => ['error', m])));
      return;
    }
    try {
      await writeFile(state.dir, 'portfolio.json', R.formatPortfolio(items));
      state.items = items;
      startNew();
      showMessages('form-messages', [['success', `Deleted "${p.title}". Commit and push to publish the change.`]]);
    } catch (err) {
      showMessages('form-messages', [['error', 'Deleting failed: ' + err.message]]);
    }
  }

  // ---------- Events ----------

  function changed() {
    state.dirty = true;
  }

  function addFromInput(inputId, handler) {
    const input = $(inputId);
    const value = input.value.trim();
    if (!value) return;
    handler(value);
    input.value = '';
    changed();
    renderAll();
  }

  function addNewValue(list, set, newSet, value) {
    const existing = list.concat([...newSet]).find(v => v.toLowerCase() === value.toLowerCase());
    if (existing) { set.add(existing); return; }
    newSet.add(value);
    set.add(value);
  }

  function enterAdds(inputId, buttonId) {
    $(inputId).addEventListener('keydown', ev => {
      if (ev.key === 'Enter') { ev.preventDefault(); $(buttonId).click(); }
    });
  }

  function bind() {
    $('connect-btn').onclick = async () => {
      try {
        const handle = await window.showDirectoryPicker({ id: 'personal-website', mode: 'readwrite' });
        if (await useDirectory(handle)) saveHandle(handle);
      } catch (err) {
        if (err.name !== 'AbortError') showMessages('connect-messages', [['error', 'Could not open the folder: ' + err.message]]);
      }
    };
    $('reconnect-btn').onclick = async () => {
      const handle = await loadHandle();
      if (!handle) return;
      try {
        if (await handle.requestPermission({ mode: 'readwrite' }) === 'granted') await useDirectory(handle);
      } catch (err) {
        showMessages('connect-messages', [['error', 'Could not reconnect: ' + err.message + '. Choose the folder again.']]);
      }
    };

    $('new-btn').onclick = () => { if (confirmDiscard()) startNew(); };
    $('project-form').addEventListener('submit', save);
    $('project-form').addEventListener('input', () => { changed(); renderFeaturedHint(); renderPreview(); });
    $('project-form').addEventListener('change', () => { changed(); renderPreview(); });
    $('revert-btn').onclick = () => {
      if (!state.dirty || window.confirm('Discard your changes?')) {
        state.editing === null ? startNew() : startEdit(state.editing);
      }
    };
    $('delete-btn').onclick = removeProject;

    $('f-title').addEventListener('input', () => {
      if (!form.idTouched) $('f-id').value = R.slugify($('f-title').value);
    });
    $('f-id').addEventListener('input', () => { form.idTouched = true; });
    $('f-type').addEventListener('change', () => {
      const isNew = $('f-type').value === '__new__';
      $('type-new-row').hidden = !isNew;
      if (isNew) { form.newValues.types.add('__new__'); $('type-new').focus(); } else form.newValues.types.clear();
    });
    $('f-employer').addEventListener('change', () => {
      const isNew = $('f-employer').value === '__new__';
      $('employer-new-row').hidden = !isNew;
      if (isNew) $('employer-new').focus();
    });

    $('area-add').onclick = () => addFromInput('area-new', v => addNewValue(state.filters.areas, form.areas, form.newValues.areas, v));
    $('tool-add').onclick = () => addFromInput('tool-new', v => addNewValue(state.filters.tools, form.tools, form.newValues.tools, v));
    $('tech-add').onclick = () => addFromInput('tech-new', v => {
      const tool = canonicalTool(v);
      if (tool) form.tools.add(tool);
      else if (!form.techOther.includes(v)) form.techOther.push(v);
    });
    $('tag-add').onclick = () => addFromInput('tag-new', v => { if (!form.tags.includes(v)) form.tags.push(v); });
    [['area-new', 'area-add'], ['tool-new', 'tool-add'], ['tech-new', 'tech-add'], ['tag-new', 'tag-add']]
      .forEach(([i, b]) => enterAdds(i, b));

    $('attach-file-add').onclick = () => {
      const file = $('attach-file').files[0];
      if (!file) { showMessages('form-messages', [['error', 'Choose a file to attach first.']]); return; }
      const taken = new Set([...state.docFiles, ...form.attachments.map(a => a.url)]);
      const url = uniqueDocPath(file.name, taken);
      const ext = (file.name.split('.').pop() || '').toLowerCase();
      const name = $('attach-file-name').value.trim() || file.name;
      form.attachments.push({ name, type: ext || undefined, url, file });
      $('attach-file').value = '';
      $('attach-file-name').value = '';
      clearMessages('form-messages');
      changed();
      renderAll();
    };
    $('attach-link-add').onclick = () => {
      const url = $('attach-link-url').value.trim();
      if (!/^https?:\/\//.test(url)) { showMessages('form-messages', [['error', 'Links must start with http:// or https://']]); return; }
      const name = $('attach-link-name').value.trim() || url;
      form.attachments.push({ name, type: 'link', url });
      $('attach-link-url').value = '';
      $('attach-link-name').value = '';
      clearMessages('form-messages');
      changed();
      renderAll();
    };

    window.addEventListener('beforeunload', ev => {
      if (state.dirty) { ev.preventDefault(); ev.returnValue = ''; }
    });
  }

  async function init() {
    bind();
    if (!window.showDirectoryPicker) {
      $('unsupported').hidden = false;
      $('connect-btn').disabled = true;
      return;
    }
    if (await loadHandle()) $('reconnect-btn').hidden = false;
  }

  // Exposed for automated tests, which supply a folder without a picker.
  window.PortfolioEditor = { useDirectory };
  init();
})();
