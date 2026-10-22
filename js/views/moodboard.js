/* Fiction Studio — moodboards: lista, editor visual livre e exportação PNG.
   Um moodboard é um registro (kind 'moodboard') com:
     fields: { description, notes, linkedIds[], coverImageId, bg }
     items:  [{ id, type, x, y, w, h, rot, z, ...propriedades do tipo }]
     view:   { x, y, k }  — enquadramento salvo
   Itens de imagem apontam para registros de mídia (imageId); nada é duplicado. */
'use strict';

const MB_TYPES = {
  image: { label: 'Imagem', ic: 'image' }, text: { label: 'Texto', ic: 'type' }, title: { label: 'Título', ic: 'heading' },
  note: { label: 'Nota adesiva', ic: 'sticky' }, label: { label: 'Etiqueta', ic: 'flag' }, divider: { label: 'Separador', ic: 'separator' },
  color: { label: 'Bloco de cor', ic: 'square' }, palette: { label: 'Paleta', ic: 'palette' }, ref: { label: 'Referência a registro', ic: 'link' },
};
const MB_AUX = ['note', 'label', 'ref', 'divider'];
const MB_PLURAL = { image: 'imagens', text: 'textos', title: 'títulos', note: 'notas adesivas', label: 'etiquetas', divider: 'separadores', color: 'blocos de cor', palette: 'paletas', ref: 'referências a registros' };
const TEXT_COLORS = [['fg', 'Texto'], ['fg-2', 'Secundário'], ['accent', 'Violeta'], ['cyan', 'Ciano'], ['pink', 'Rosa'], ['gold', 'Dourado'], ['ok', 'Verde'], ['err', 'Vermelho'], ['warn', 'Amarelo']];
const NOTE_COLORS = [['yellow', 'Amarelo'], ['pink', 'Rosa'], ['violet', 'Violeta'], ['cyan', 'Ciano'], ['green', 'Verde'], ['gray', 'Cinza']];
const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const tokenColor = (c) => !c ? 'var(--fg)' : c.startsWith('#') ? c : 'var(--' + c + ')';
const tokenValue = (c) => !c ? cssVar('--fg') : c.startsWith('#') ? c : cssVar('--' + c);

/* ---------- utilidades de moodboards (usadas também por fichas, biblioteca e grafo) ---------- */
const Boards = {
  list() { return Store.list('moodboard'); },
  imageIds(b) { return U.uniq((b.items || []).filter(i => i.type === 'image' && i.imageId).map(i => i.imageId)); },
  related(b) {
    const ids = new Set(b.fields.linkedIds || []);
    for (const it of b.items || []) {
      if (it.type === 'ref' && it.ref) ids.add(it.ref);
      if (it.type === 'image') { const im = Store.S.imgs.get(it.imageId); if (im) (im.links || []).forEach(l => ids.add(l.entityId)); }
    }
    return [...ids].filter(id => Store.get(id));
  },
  forEntity(id) {
    return Boards.list().filter(b => (b.fields.linkedIds || []).includes(id) || (b.items || []).some(it => it.type === 'ref' && it.ref === id))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  },
  mosaic(b) {
    const cover = b.fields.coverImageId && Store.S.imgs.get(b.fields.coverImageId);
    const imgs = cover ? [cover] : Boards.imageIds(b).map(id => Store.S.imgs.get(id)).filter(Boolean).slice(0, 3);
    if (!imgs.length) return h('div.mosaic.single', h('div.ph', icon('moodboard', 28)));
    return h('div.mosaic' + (imgs.length === 1 ? '.single' : ''), imgs.map(im => h('div', h('img', { src: Store.imgURL(im), alt: '', loading: 'lazy' }))), imgs.length === 2 ? h('div') : null);
  },
  card(b) {
    const rel = Boards.related(b);
    return h('article.mbcard', { tabindex: 0, onclick: () => Nav.entity(b.id), onkeydown: e => { if (e.key === 'Enter') Nav.entity(b.id); } },
      Boards.mosaic(b),
      h('div.body', h('h4', b.name),
        b.fields.description ? h('div.small.muted.clamp2', b.fields.description) : null,
        rel.length ? h('div.chips', rel.slice(0, 4).map(id => h('span.chip', kindDot(Store.get(id).kind), Store.get(id).name)), rel.length > 4 ? h('span.meta', '+' + (rel.length - 4)) : null) : null,
        h('div.meta', U.plural(Boards.imageIds(b).length, 'imagem', 'imagens') + ' · ' + U.plural((b.items || []).length, 'objeto', 'objetos') + ' · ' + U.fmtDate(b.updatedAt))));
  },
  async create({ name, linkedIds = [], imageIds = [], refIds = [], navigate = true } = {}) {
    if (!name) { name = await Modal.prompt('Novo moodboard', 'Nome', '', { placeholder: 'Ex.: Vestimentas da nobreza' }); if (!name) return null; }
    const items = []; let x = 0, y = 0, z = 1, rowH = 0;
    for (const id of refIds) { items.push({ id: U.id('mi'), type: 'ref', ref: id, x, y, w: 280, h: 88, rot: 0, z: z++ }); x += 304; }
    if (refIds.length) { y += 120; x = 0; }
    for (const id of imageIds) {
      const im = Store.S.imgs.get(id); if (!im) continue;
      const w = 260, hh = Math.round(w * ((im.height && im.width) ? Math.min(1.6, im.height / im.width) : 0.75));
      if (x > 1100) { x = 0; y += rowH + 32; rowH = 0; }
      items.push({ id: U.id('mi'), type: 'image', imageId: id, x, y, w, h: hh, rot: 0, z: z++, fit: 'cover', posX: 50, posY: 50, zoom: 1, caption: '', showCaption: false });
      x += w + 24; rowH = Math.max(rowH, hh);
    }
    const b = Store.newEntity('moodboard', { name, fields: { description: '', notes: '', linkedIds: [...linkedIds], coverImageId: null, bg: 'dots' }, items, view: null });
    await Store.flush();
    Toast.ok('Moodboard "' + name + '" criado.');
    if (navigate) Nav.entity(b.id);
    return b;
  },
  createFor(entity) { return Boards.create({ linkedIds: [entity.id], refIds: [entity.id], imageIds: Store.imagesOf(entity.id).filter(i => !Images.isRemoteOnly(i)).map(i => i.id) }); },
};

/* ---------- página "Moodboards e referências" ---------- */
const refsState = { q: '', linked: '' };
Views.refs = function (main, sub = 'boards') {
  const p = Store.S.p;
  const page = h('div.page'); main.appendChild(page);
  const tabs = [['boards', 'Moodboards', 'moodboard', Boards.list().length], ['library', 'Biblioteca de mídia', 'library', [...Store.S.imgs.values()].filter(i => i.role !== 'cover').length], ['collections', 'Coleções', 'images', Store.list('refcollection').length], ['lacking', 'Faltam referências', 'alert', null]];
  page.append(
    pageHead('Moodboards e referências', 'Reúna suas próprias imagens de inspiração e componha painéis visuais. A biblioteca guarda cada arquivo uma única vez; moodboards, fichas e coleções usam os mesmos registros.',
      sub === 'boards' ? btn('Novo moodboard', () => Boards.create(), { kind: 'primary', ic: 'plus' }) : btn('Importar imagens', async () => { const f = await U.pickFile({ accept: 'image/*', multiple: true }); if (f.length) { await Images.importFiles(f); App.refresh(); } }, { kind: 'primary', ic: 'upload' })),
    h('div.tabs', { role: 'tablist' }, tabs.map(([id, l, ic, n]) => h('button.tab' + (id === sub ? '.active' : ''), { role: 'tab', 'aria-selected': String(id === sub), onclick: () => Nav.go('/p/' + p.id + '/refs' + (id === 'boards' ? '' : '/' + id)) }, icon(ic, 14), l, n != null ? h('span.count', String(n)) : null))));
  const body = h('div'); page.appendChild(body);
  if (sub === 'library') return mediaLibrary(body);
  if (sub === 'collections') return collectionsView(body);
  if (sub === 'lacking') return lackingView(body);
  const grid = h('div');
  const render = () => {
    clear(grid);
    let list = Boards.list();
    const nq = U.norm(refsState.q);
    if (nq) list = list.filter(b => U.norm([b.name, b.fields.description, ...(b.tags || []).map(Store.tagName)].join(' ')).includes(nq));
    if (refsState.linked) list = list.filter(b => Boards.related(b).includes(refsState.linked));
    list.sort((a, b) => b.updatedAt - a.updatedAt);
    if (!Boards.list().length) { grid.appendChild(emptyState('Nenhum moodboard ainda', 'Crie painéis para a aparência do protagonista, a arquitetura de uma cidade, a paleta do projeto ou a atmosfera de uma storyline.', btn('Criar moodboard', () => Boards.create(), { kind: 'primary', ic: 'plus' }), 'moodboard')); return; }
    if (!list.length) { grid.appendChild(emptyState('Nada encontrado', 'Ajuste a busca ou o filtro.', null, 'search')); return; }
    grid.appendChild(h('div.mbcards', list.map(b => Boards.card(b))));
  };
  const ents = U.uniq(Boards.list().flatMap(b => Boards.related(b))).map(Store.get).filter(Boolean).sort(U.byName);
  body.append(h('div.toolbar', searchInput(refsState.q, v => { refsState.q = v; render(); }, 'Buscar moodboards'),
    ents.length ? h('select.input', { 'aria-label': 'Filtrar por elemento associado', onchange: e => { refsState.linked = e.target.value; render(); } }, h('option', { value: '' }, 'Qualquer elemento associado'), ents.map(e => h('option', { value: e.id, selected: refsState.linked === e.id }, e.name + ' (' + Schema.kindLabel(e.kind).toLowerCase() + ')'))) : null), grid);
  render();
};

/* ---------- editor ---------- */
Views.moodboard = function (main, board) {
  board.items = board.items || []; board.fields.linkedIds = board.fields.linkedIds || [];
  const page = h('div.page.fill'); main.appendChild(page);
  const items = () => board.items;
  const byId = (id) => board.items.find(i => i.id === id);
  let sel = new Set();
  const vp = { x: 60, y: 60, k: 1 };
  const els = new Map();
  let editing = null;

  /* ---- histórico (desfazer/refazer) ---- */
  const snap = () => JSON.stringify(board.items);
  let last = snap(); const past = []; const future = [];
  const persist = U.debounce(() => { Store.saveEntity(board, { silent: true }); }, 300);
  function commit() {
    const now = snap(); if (now === last) return;
    past.push(last); if (past.length > 120) past.shift(); future.length = 0; last = now;
    persist(); ctl.update();
  }
  const commitSoon = U.debounce(commit, 450);
  function restore(json) { board.items = JSON.parse(json); last = json; sel = new Set([...sel].filter(id => byId(id))); renderAll(); renderProps(); persist(); }
  function undo() { commitSoon.flush(); if (!past.length) return; future.push(last); restore(past.pop()); }
  function redo() { if (!future.length) return; past.push(last); restore(future.pop()); }
  const saveView = U.debounce(() => { board.view = { x: Math.round(vp.x), y: Math.round(vp.y), k: +vp.k.toFixed(4) }; Store.queue('entities', board); }, 700);

  /* ---- estrutura ---- */
  const canvas = h('div.mb-canvas' + (board.fields.bg === 'plain' ? '.plain' : ''), { tabindex: 0, role: 'application', 'aria-label': 'Área de trabalho do moodboard' });
  const layer = h('div.mb-layer');
  const overlay = h('div', { style: { position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 999990 } });
  canvas.append(layer, overlay);
  const props = h('aside.mb-props', { 'aria-label': 'Propriedades' });
  const nameIn = h('input.name-input', { value: board.name, 'aria-label': 'Nome do moodboard' });
  nameIn.addEventListener('input', () => { board.name = nameIn.value || 'Moodboard'; Store.saveEntity(board, { silent: true }); });
  nameIn.addEventListener('change', () => App.renderCrumbs());
  const ctl = canvasControls({
    zoomIn: () => zoomBy(1.25), zoomOut: () => zoomBy(0.8), fit: () => fitAll(), getZoom: () => vp.k, setZoom: (k) => zoomTo(k),
    undo, redo, canUndo: () => past.length > 0, canRedo: () => future.length > 0,
    help: [['Arrastar o fundo', 'mover a área'], ['Shift + arrastar fundo', 'selecionar várias'], ['Roda do mouse', 'zoom'], ['Shift + clique', 'somar à seleção'], ['Alças', 'redimensionar (Shift: livre) e girar (Shift: 15°)'], ['Alt + arrastar imagem', 'ajustar o enquadramento'], ['Duplo clique', 'editar texto, ampliar imagem, abrir ficha'], ['Ctrl+V', 'colar imagem ou texto'], ['Ctrl+D', 'duplicar'], ['Delete', 'remover do moodboard'], ['[ e ]', 'enviar para trás / trazer para frente'], ['Setas', 'mover 1 px (Shift: 10)'], ['Ctrl+Z / Ctrl+Shift+Z', 'desfazer / refazer'], ['Ctrl+0', 'enquadrar tudo']],
  });
  const canvasWrap = h('div', { style: { position: 'relative', flex: 1, minWidth: 0, display: 'flex' } }, canvas, ctl);
  const tool = (ic, title, fn) => btn('', fn, { ic, title });
  const tools = h('div.mb-tools', { role: 'toolbar', 'aria-label': 'Adicionar ao moodboard' },
    tool('upload', 'Adicionar imagens do computador', async () => { const f = await U.pickFile({ accept: 'image/*', multiple: true }); if (f.length) importAndPlace(f); }),
    tool('library', 'Biblioteca do projeto (arraste para a área)', () => toggleDrawer()),
    tool('globe', 'Importar imagem por endereço web', () => Images.urlModal(img => addImages([img]))),
    h('div.sep'),
    tool('heading', 'Título', () => addText('title')), tool('type', 'Texto livre', () => addText('text')), tool('sticky', 'Nota adesiva', () => addText('note')), tool('flag', 'Etiqueta', () => addText('label')),
    tool('separator', 'Separador', () => addSimple({ type: 'divider', w: 420, h: 18, color: 'fg-2', thickness: 2 })),
    h('div.sep'),
    tool('square', 'Bloco de cor', () => addSimple({ type: 'color', w: 140, h: 140, hex: '#A78BFA', name: '' })),
    tool('palette', 'Paleta de cores', () => addSimple({ type: 'palette', w: 320, h: 120, colors: ['#1D1F2A', '#A78BFA', '#67E8F9', '#F472B6', '#F5C76A'], name: 'Paleta' })),
    tool('link', 'Referência a personagem, local, storyline ou evento', () => addRefs()));
  const side = h('div.row.nowrap', { style: { alignItems: 'stretch', minHeight: 0, flex: 'none' } }, resizableSide(props, 'moodboard', 320, 260, 520), props);
  page.append(
    h('div.mb-bar', h('a.btn.btn-ghost.btn-sm', { href: '#/p/' + Store.S.p.id + '/refs' }, icon('left', 14), h('span', 'Moodboards')), nameIn, h('span.spacer'),
      btn('Exportar PNG', () => exportDialog(), { ic: 'download' }),
      btn('', e => Menu.open(e.currentTarget, [
        { label: 'Duplicar moodboard', ic: 'copy', onClick: () => { const c = Store.duplicateEntity(board.id); if (c) Nav.entity(c.id); } },
        { label: 'Enquadrar tudo', ic: 'center', onClick: fitAll },
        { sep: true },
        { label: 'Excluir moodboard', ic: 'trash', danger: true, onClick: async () => { if (await Modal.confirm('Excluir moodboard', 'Excluir "' + board.name + '"? As imagens continuam na biblioteca do projeto.', { danger: true, okLabel: 'Excluir' })) { Store.deleteEntity(board.id); await Store.flush(); Toast.ok('Moodboard excluído.'); Nav.go('/p/' + Store.S.p.id + '/refs'); } } },
      ], { align: 'end' }), { ic: 'more', title: 'Mais ações' })),
    h('div.mb-body', tools, canvasWrap, side));

  /* ---- coordenadas ---- */
  const rect = () => canvas.getBoundingClientRect();
  const toWorld = (cx, cy) => { const r = rect(); return { x: (cx - r.left - vp.x) / vp.k, y: (cy - r.top - vp.y) / vp.k }; };
  const visibleWorld = () => { const r = rect(); return { x: -vp.x / vp.k, y: -vp.y / vp.k, w: r.width / vp.k, h: r.height / vp.k }; };
  function itemBounds(it) {
    const r = (it.rot || 0) * Math.PI / 180, c = Math.abs(Math.cos(r)), s = Math.abs(Math.sin(r));
    const bw = it.w * c + it.h * s, bh = it.w * s + it.h * c, cx = it.x + it.w / 2, cy = it.y + it.h / 2;
    return { minX: cx - bw / 2, minY: cy - bh / 2, maxX: cx + bw / 2, maxY: cy + bh / 2 };
  }
  function bboxOf(list) {
    if (!list.length) return null;
    const bs = list.map(itemBounds);
    return { minX: Math.min(...bs.map(b => b.minX)), minY: Math.min(...bs.map(b => b.minY)), maxX: Math.max(...bs.map(b => b.maxX)), maxY: Math.max(...bs.map(b => b.maxY)) };
  }
  function applyView() {
    layer.style.transform = `translate(${vp.x}px, ${vp.y}px) scale(${vp.k})`;
    const g = 22 * vp.k; canvas.style.backgroundSize = g + 'px ' + g + 'px'; canvas.style.backgroundPosition = vp.x + 'px ' + vp.y + 'px';
    renderSelection(); ctl.update(); saveView(); refreshSources();
  }
  function zoomAt(px, py, f) { const k = Math.min(5, Math.max(0.05, vp.k * f)); const wx = (px - vp.x) / vp.k, wy = (py - vp.y) / vp.k; vp.k = k; vp.x = px - wx * k; vp.y = py - wy * k; applyView(); }
  function zoomBy(f) { const r = rect(); zoomAt(r.width / 2, r.height / 2, f); }
  function zoomTo(k) { zoomBy(k / vp.k); }
  function fitTo(b, maxK = 1.5) {
    const r = rect(); if (!b || !r.width) return;
    const pad = 70, w = Math.max(b.maxX - b.minX, 1), hh = Math.max(b.maxY - b.minY, 1);
    vp.k = Math.min(maxK, Math.max(0.05, Math.min((r.width - pad * 2) / w, (r.height - pad * 2) / hh)));
    vp.x = r.width / 2 - (b.minX + w / 2) * vp.k; vp.y = r.height / 2 - (b.minY + hh / 2) * vp.k; applyView();
  }
  function fitAll() { const b = bboxOf(items()); if (b) fitTo({ ...b, maxY: b.maxY + 30 }); else { vp.x = 60; vp.y = 60; vp.k = 1; applyView(); } }
  function ensureVisible(list) {
    const b = bboxOf(list); if (!b) return; const v = visibleWorld();
    if (b.minX < v.x || b.minY < v.y || b.maxX > v.x + v.w || b.maxY > v.y + v.h) fitTo(bboxOf(items()), vp.k);
  }

  /* ---- renderização dos itens ---- */
  function imageSrc(im, it) {
    if (!im) return null;
    const px = it.w * (it.zoom || 1) * vp.k * (window.devicePixelRatio || 1);
    if (px <= 440) return Store.imgURL(im, 'thumb');
    if (px <= 1700 || !im.blob) { if (!im.preview && im.blob) Images.ensurePreview(im).then(ok => { if (ok) refreshSources(); }); return Store.imgURL(im, 'preview'); }
    return Store.imgURL(im, 'full');
  }
  const refreshSources = U.debounce(() => {
    for (const it of items()) {
      if (it.type !== 'image') continue; const el = els.get(it.id); const img = el && el.querySelector('img'); if (!img) continue;
      const src = imageSrc(Store.S.imgs.get(it.imageId), it); if (src && img.getAttribute('src') !== src) img.src = src;
    }
  }, 220);
  function content(it) {
    switch (it.type) {
      case 'image': {
        const im = Store.S.imgs.get(it.imageId);
        if (!im) return h('div.mb-image', h('div.missing', 'Imagem removida da biblioteca'));
        const img = h('img', { src: imageSrc(im, it), alt: im.title || '', draggable: 'false', referrerpolicy: 'no-referrer' });
        styleImg(img, it);
        return [h('div.mb-image', img, Images.isRemoteOnly(im) ? h('span.badge.remote', { style: { position: 'absolute', left: '6px', top: '6px', fontSize: '10px', padding: '2px 6px', borderRadius: '4px', background: 'rgba(15,17,22,.82)', color: '#fff' } }, 'link externo') : null),
          it.showCaption && (it.caption || im.title) ? h('div.mb-cap', it.caption || im.title) : null];
      }
      case 'text': case 'title': return h('div.mb-text' + (it.type === 'title' ? '.mb-title' : ''), { style: { fontSize: (it.size || (it.type === 'title' ? 36 : 16)) + 'px', color: tokenColor(it.color), fontWeight: it.bold ? '700' : null, textAlign: it.align || 'left' } }, it.text || '');
      case 'note': return h('div.mb-note', { style: { background: 'var(--note-' + (it.color || 'yellow') + ')', fontSize: (it.size || 14) + 'px' } }, it.text || '');
      case 'label': return h('div.mb-label', { style: { background: `color-mix(in srgb, ${tokenColor(it.color || 'accent')} 22%, var(--panel))`, color: tokenColor(it.color || 'accent') } }, it.text || 'Etiqueta');
      case 'divider': return h('div.mb-divider', h('i', { style: { background: tokenColor(it.color || 'fg-2'), height: (it.thickness || 2) + 'px' } }));
      case 'color': return h('div.mb-color', { style: { background: it.hex } }, h('span', (it.name ? it.name + ' · ' : '') + it.hex.toUpperCase()));
      case 'palette': return h('div.mb-palette', h('div.sw', (it.colors || []).map(c => h('i', { style: { background: c }, title: c }))), h('div.nm', h('b', it.name || 'Paleta'), h('span.mono', (it.colors || []).map(c => c.toUpperCase()).join(' '))));
      case 'ref': {
        const e = Store.get(it.ref);
        if (!e) return h('div.mb-ref', { style: { '--k': 'var(--muted)' } }, h('div.rt', h('div.rn', 'Registro removido')));
        return h('div.mb-ref', { style: { '--k': kc(e.kind) } }, h('div.ri', entityThumb(e, 22)), h('div.rt', h('div.rn', e.name), h('div.rk', Schema.kindLabel(e.kind)), entSummary(e) ? h('div.rs', entSummary(e)) : null));
      }
    }
    return h('div');
  }
  function styleImg(img, it) {
    img.style.objectFit = it.fit === 'contain' ? 'contain' : it.fit === 'fill' ? 'fill' : 'cover';
    img.style.objectPosition = (it.posX ?? 50) + '% ' + (it.posY ?? 50) + '%';
    img.style.transformOrigin = (it.posX ?? 50) + '% ' + (it.posY ?? 50) + '%';
    img.style.transform = (it.zoom || 1) !== 1 ? 'scale(' + it.zoom + ')' : '';
  }
  function place(el, it) {
    el.style.left = it.x + 'px'; el.style.top = it.y + 'px'; el.style.width = it.w + 'px'; el.style.height = it.h + 'px';
    el.style.transform = it.rot ? 'rotate(' + it.rot + 'deg)' : ''; el.style.setProperty('--rot', (it.rot || 0) + 'deg'); el.style.zIndex = it.z || 1;
  }
  function makeEl(it, isNew) {
    const el = h('div.mb-item' + (isNew ? '.new' : ''), { dataset: { id: it.id }, 'aria-label': MB_TYPES[it.type].label });
    appendKids(el, [content(it)]); place(el, it); return el;
  }
  function renderAll() { clear(layer); els.clear(); for (const it of [...items()].sort((a, b) => (a.z || 0) - (b.z || 0))) { const el = makeEl(it); els.set(it.id, el); layer.appendChild(el); } renderSelection(); empty(); }
  function rerender(it) { const old = els.get(it.id); const el = makeEl(it); els.set(it.id, el); if (old) old.replaceWith(el); else layer.appendChild(el); }
  let emptyEl = null;
  function empty() {
    if (items().length) { if (emptyEl) { emptyEl.remove(); emptyEl = null; } return; }
    if (emptyEl) return;
    emptyEl = h('div.mb-empty', h('div', h('div.empty-ic', { style: { width: '48px', height: '48px', margin: '0 auto 10px', borderRadius: '50%', background: 'var(--raised)', display: 'grid', placeItems: 'center' } }, icon('moodboard', 22)),
      h('h3', 'Comece a compor'), h('p.small', 'Arraste imagens do computador para cá, cole com Ctrl+V ou use a barra à esquerda para adicionar imagens, textos, notas, cores e referências do seu universo.'),
      h('div.row', { style: { justifyContent: 'center', marginTop: '10px' } }, btn('Adicionar imagens', async () => { const f = await U.pickFile({ accept: 'image/*', multiple: true }); if (f.length) importAndPlace(f); }, { kind: 'primary', ic: 'upload' }), btn('Da biblioteca', () => toggleDrawer(), { ic: 'library' }))));
    canvasWrap.appendChild(emptyEl);
  }

  /* ---- seleção ---- */
  function renderSelection() {
    clear(overlay);
    const list = [...sel].map(byId).filter(Boolean);
    if (!list.length) return;
    if (list.length === 1) {
      const it = list[0];
      const box = h('div.mb-sel', { style: { left: (vp.x + it.x * vp.k) + 'px', top: (vp.y + it.y * vp.k) + 'px', width: it.w * vp.k + 'px', height: it.h * vp.k + 'px', transform: it.rot ? 'rotate(' + it.rot + 'deg)' : '' } });
      const hs = it.type === 'divider' || it.type === 'label' ? ['e', 'w', 'rot'] : ['nw', 'ne', 'sw', 'se', 'e', 'w', 'rot'];
      for (const k of hs) box.appendChild(h('div.mb-h.' + k, { dataset: { handle: k }, title: k === 'rot' ? 'Girar (Shift: 15°)' : 'Redimensionar' }));
      overlay.appendChild(box);
    } else {
      const b = bboxOf(list);
      overlay.appendChild(h('div.mb-sel.multi', { style: { left: (vp.x + b.minX * vp.k) + 'px', top: (vp.y + b.minY * vp.k) + 'px', width: (b.maxX - b.minX) * vp.k + 'px', height: (b.maxY - b.minY) * vp.k + 'px' } }));
    }
  }
  function select(ids, { toggle = false } = {}) {
    if (toggle) { for (const id of ids) sel.has(id) ? sel.delete(id) : sel.add(id); }
    else sel = new Set(ids);
    renderSelection(); renderProps();
  }

  /* ---- adicionar ---- */
  const maxZ = () => items().reduce((m, i) => Math.max(m, i.z || 0), 0);
  const overlaps = (a, list, gap = 18) => list.some(b => a.x < b.x + b.w + gap && a.x + a.w + gap > b.x && a.y < b.y + b.h + gap && a.y + a.h + gap > b.y);
  function findSpot(w, hh, occupied) {
    const v = visibleWorld(); const m = 28 / vp.k; const step = Math.max(12 / vp.k, Math.min(w, hh) / 3);
    for (let y = v.y + m; y + hh <= v.y + v.h - m; y += step) for (let x = v.x + m; x + w <= v.x + v.w - m; x += step) { if (!overlaps({ x, y, w, h: hh }, occupied)) return { x, y }; }
    const bb = bboxOf(occupied.length ? occupied : items());
    return bb ? { x: bb.minX, y: bb.maxY + 40 } : { x: v.x + m, y: v.y + m };
  }
  function baseImageSize(im) {
    const v = visibleWorld();
    const w = Math.round(Math.min(480, Math.max(170, v.w / 4.6)));
    const ratio = im && im.width && im.height ? im.height / im.width : 0.75;
    let hh = Math.round(w * ratio); const maxH = v.h * 0.55; let ww = w;
    if (hh > maxH) { hh = Math.round(maxH); ww = Math.round(hh / ratio); }
    return { w: ww, h: hh };
  }
  function addItems(newItems, { at = null, edit = false } = {}) {
    const occupied = [...items()]; let z = maxZ();
    let cursor = at ? { x: at.x, y: at.y } : null; let rowH = 0; const startX = at ? at.x : 0;
    for (const it of newItems) {
      it.id = it.id || U.id('mi'); it.rot = it.rot || 0; it.z = ++z;
      if (cursor) {
        if (cursor.x - startX > visibleWorld().w * 0.7) { cursor.x = startX; cursor.y += rowH + 20; rowH = 0; }
        it.x = Math.round(cursor.x - (newItems.length === 1 ? it.w / 2 : 0)); it.y = Math.round(cursor.y - (newItems.length === 1 ? it.h / 2 : 0));
        cursor.x += it.w + 20; rowH = Math.max(rowH, it.h);
      } else { const s = findSpot(it.w, it.h, occupied); it.x = Math.round(s.x); it.y = Math.round(s.y); }
      occupied.push(it); board.items.push(it);
      const el = makeEl(it, true); els.set(it.id, el); layer.appendChild(el);
    }
    empty(); commit(); select(newItems.map(i => i.id)); ensureVisible(newItems);
    if (edit && newItems.length === 1) setTimeout(() => startEdit(newItems[0]), 30);
  }
  function addImages(imgs, at = null) {
    if (!imgs.length) return;
    addItems(imgs.map(im => ({ type: 'image', imageId: im.id, ...baseImageSize(im), fit: 'cover', posX: 50, posY: 50, zoom: 1, caption: '', showCaption: false })), { at });
  }
  async function importAndPlace(files, at = null) {
    const imgs = await Images.importFiles(files, { quiet: true });
    if (imgs.length) { addImages(imgs, at); await Store.flush(); Toast.ok(U.plural(imgs.length, 'imagem adicionada', 'imagens adicionadas') + ' ao moodboard e à biblioteca.'); }
  }
  function addText(type) {
    const v = visibleWorld();
    const defs = { title: { w: Math.round(Math.min(640, Math.max(380, v.w / 2.4))), h: 54, text: 'Título', size: 36, color: 'fg' }, text: { w: 280, h: 90, text: 'Escreva aqui…', size: 16, color: 'fg-2' }, note: { w: 220, h: 170, text: '', color: 'yellow', size: 14 }, label: { w: 140, h: 32, text: 'Etiqueta', color: 'accent' } }[type];
    addItems([{ type, ...defs }], { edit: true });
  }
  function addSimple(it) { addItems([it]); }
  function addRefs() {
    const picked = [];
    Modal.open({ title: 'Adicionar referência a registro', body: h('div.col', h('p.small.muted', 'O cartão funciona como atalho para a ficha e mostra a imagem principal, o nome e o resumo atuais do registro.'),
      refPicker({ kinds: Schema.NARRATIVE_KINDS, multi: true, value: [], allowCreate: false, placeholder: 'Personagem, localidade, storyline, evento…', onChange: v => { picked.splice(0, picked.length, ...v); } })),
      actions: [{ label: 'Cancelar' }, { label: 'Adicionar', kind: 'primary', onClick: () => { if (!picked.length) { Toast.warn('Escolha ao menos um registro.'); return false; } addItems(picked.map(ref => ({ type: 'ref', ref, w: 280, h: 88 }))); } }] });
  }
  function duplicateSel() {
    const list = [...sel].map(byId).filter(Boolean); if (!list.length) return;
    let z = maxZ();
    const copies = list.map(it => ({ ...U.clone(it), id: U.id('mi'), x: it.x + 24, y: it.y + 24, z: ++z }));
    for (const c of copies) { board.items.push(c); const el = makeEl(c, true); els.set(c.id, el); layer.appendChild(el); }
    commit(); select(copies.map(c => c.id));
  }
  function removeSel() {
    if (!sel.size) return;
    const n = sel.size;
    board.items = board.items.filter(i => !sel.has(i.id));
    for (const id of sel) { const el = els.get(id); if (el) el.remove(); els.delete(id); }
    sel.clear(); commit(); renderSelection(); renderProps(); empty();
    Toast.action(U.plural(n, 'objeto removido', 'objetos removidos') + ' do moodboard. As imagens continuam na biblioteca.', 'Desfazer', undo);
  }
  function reorder(dir) {
    const list = [...sel].map(byId).filter(Boolean); if (!list.length) return;
    if (dir === 'front') { let z = maxZ(); list.sort((a, b) => a.z - b.z).forEach(it => it.z = ++z); }
    else if (dir === 'back') { let z = items().reduce((m, i) => Math.min(m, i.z || 0), 0); list.sort((a, b) => b.z - a.z).forEach(it => it.z = --z); }
    else {
      const ordered = [...items()].sort((a, b) => a.z - b.z); ordered.forEach((it, i) => it.z = i + 1);
      for (const it of (dir === 'up' ? [...list].sort((a, b) => b.z - a.z) : [...list].sort((a, b) => a.z - b.z))) {
        const i = ordered.indexOf(it), j = dir === 'up' ? i + 1 : i - 1;
        if (j < 0 || j >= ordered.length || sel.has(ordered[j].id)) continue;
        [ordered[i].z, ordered[j].z] = [ordered[j].z, ordered[i].z]; [ordered[i], ordered[j]] = [ordered[j], ordered[i]];
      }
    }
    for (const it of items()) { const el = els.get(it.id); if (el) el.style.zIndex = it.z; }
    commit(); renderProps();
  }
  function align(mode) {
    const list = [...sel].map(byId).filter(Boolean); if (list.length < 2) return;
    const b = bboxOf(list);
    for (const it of list) {
      const ib = itemBounds(it), dx = it.x - ib.minX, dy = it.y - ib.minY, iw = ib.maxX - ib.minX, ih = ib.maxY - ib.minY;
      if (mode === 'left') it.x = b.minX + dx; if (mode === 'right') it.x = b.maxX - iw + dx; if (mode === 'hcenter') it.x = (b.minX + b.maxX) / 2 - iw / 2 + dx;
      if (mode === 'top') it.y = b.minY + dy; if (mode === 'bottom') it.y = b.maxY - ih + dy; if (mode === 'vcenter') it.y = (b.minY + b.maxY) / 2 - ih / 2 + dy;
    }
    if (mode === 'hdist' || mode === 'vdist') {
      const key = mode === 'hdist' ? 'x' : 'y', size = mode === 'hdist' ? 'w' : 'h';
      const sorted = [...list].sort((a, c) => a[key] - c[key]);
      const total = sorted.reduce((s, it) => s + it[size], 0), span = (mode === 'hdist' ? b.maxX - b.minX : b.maxY - b.minY);
      const gap = (span - total) / (sorted.length - 1); let pos = sorted[0][key];
      for (const it of sorted) { it[key] = pos; pos += it[size] + gap; }
    }
    for (const it of list) { it.x = Math.round(it.x); it.y = Math.round(it.y); place(els.get(it.id), it); }
    commit(); renderSelection();
  }

  /* ---- edição de texto no próprio quadro ---- */
  function startEdit(it) {
    if (!['text', 'title', 'note', 'label'].includes(it.type)) return;
    const el = els.get(it.id); if (!el) return;
    const t = el.querySelector('.mb-text, .mb-note, .mb-label'); if (!t) return;
    editing = it.id; el.classList.add('editing');
    try { t.contentEditable = 'plaintext-only'; } catch (e) { t.contentEditable = 'true'; }
    if (t.contentEditable !== 'plaintext-only') t.contentEditable = 'true';
    t.focus();
    const r = document.createRange(); r.selectNodeContents(t); const s = getSelection(); s.removeAllRanges(); s.addRange(r);
    const done = () => {
      t.removeEventListener('blur', done); t.contentEditable = 'false'; el.classList.remove('editing'); editing = null;
      it.text = t.innerText.replace(/\n$/, '');
      fitHeight(it, t); commit(); renderProps();
    };
    t.addEventListener('blur', done);
    t.addEventListener('keydown', e => { if (e.key === 'Escape' || (e.key === 'Enter' && (e.ctrlKey || e.metaKey))) { e.preventDefault(); t.blur(); canvas.focus(); } e.stopPropagation(); });
  }

  /* Textos crescem para caber o conteúdo (nunca encolhem abaixo do tamanho escolhido). */
  function fitHeight(it, t) {
    if (!['text', 'title', 'note'].includes(it.type)) return;
    const prev = t.style.height; t.style.height = 'auto';
    const need = Math.ceil(t.scrollHeight) + (it.type === 'note' ? 2 : 4);
    t.style.height = prev;
    if (need > it.h) { it.h = need; place(els.get(it.id), it); renderSelection(); }
  }

  /* ---- gestos ---- */
  let gesture = null;
  canvas.addEventListener('pointerdown', e => {
    if (editing) return;
    if (e.button === 2) return;
    canvas.focus({ preventScroll: true });
    const handle = e.target.closest('[data-handle]');
    const itemEl = e.target.closest('.mb-item');
    const w = toWorld(e.clientX, e.clientY);
    if (handle && sel.size === 1) {
      const it = byId([...sel][0]);
      gesture = { type: handle.dataset.handle === 'rot' ? 'rotate' : 'resize', handle: handle.dataset.handle, it, start: { ...it }, wx: w.x, wy: w.y };
    } else if (itemEl && e.button === 0) {
      const id = itemEl.dataset.id;
      let narrow = false;
      if (e.shiftKey || e.ctrlKey || e.metaKey) { select([id], { toggle: true }); if (!sel.has(id)) return; }
      else if (!sel.has(id)) select([id]);
      else if (sel.size > 1) narrow = true; // clique simples dentro de uma seleção múltipla: sem arrastar, fica só este
      const it = byId(id);
      if (e.altKey && it.type === 'image') gesture = { type: 'crop', it, start: { ...it }, cx: e.clientX, cy: e.clientY };
      else gesture = { type: 'move', starts: [...sel].map(byId).filter(Boolean).map(i => ({ it: i, x: i.x, y: i.y })), wx: w.x, wy: w.y, moved: false, narrow: narrow ? id : null };
    } else if (e.button === 1 || (e.button === 0 && !e.shiftKey)) {
      gesture = { type: 'pan', cx: e.clientX, cy: e.clientY, ox: vp.x, oy: vp.y, moved: false }; canvas.classList.add('panning');
    } else if (e.button === 0 && e.shiftKey) {
      const r = rect(); gesture = { type: 'marquee', sx: e.clientX - r.left, sy: e.clientY - r.top, base: new Set(sel), el: h('div.mb-marquee') }; overlay.appendChild(gesture.el);
    }
    if (gesture) { canvas.setPointerCapture(e.pointerId); e.preventDefault(); }
  });
  canvas.addEventListener('pointermove', e => {
    if (!gesture) return;
    const g = gesture;
    if (g.type === 'pan') { vp.x = g.ox + e.clientX - g.cx; vp.y = g.oy + e.clientY - g.cy; if (Math.abs(e.clientX - g.cx) + Math.abs(e.clientY - g.cy) > 3) g.moved = true; applyView(); return; }
    const w = toWorld(e.clientX, e.clientY);
    if (g.type === 'move') {
      let dx = w.x - g.wx, dy = w.y - g.wy;
      if (e.shiftKey) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0; }
      if (Math.abs(dx) + Math.abs(dy) > 1 / vp.k) g.moved = true;
      for (const s of g.starts) { s.it.x = Math.round(s.x + dx); s.it.y = Math.round(s.y + dy); place(els.get(s.it.id), s.it); }
      renderSelection();
    } else if (g.type === 'resize') resizeTo(g, w, e.shiftKey);
    else if (g.type === 'rotate') {
      const it = g.it, cx = it.x + it.w / 2, cy = it.y + it.h / 2;
      let a = Math.atan2(w.y - cy, w.x - cx) * 180 / Math.PI + 90;
      a = e.shiftKey ? Math.round(a / 15) * 15 : Math.round(a);
      for (const snapA of [0, 90, 180, -90, 270, -180]) if (Math.abs(a - snapA) < 3) a = snapA;
      it.rot = ((a + 540) % 360) - 180; place(els.get(it.id), it); renderSelection();
    } else if (g.type === 'crop') {
      const it = g.it; const el = els.get(it.id);
      it.posX = Math.max(0, Math.min(100, Math.round(g.start.posX - (e.clientX - g.cx) / (it.w * vp.k) * 100)));
      it.posY = Math.max(0, Math.min(100, Math.round(g.start.posY - (e.clientY - g.cy) / (it.h * vp.k) * 100)));
      const img = el.querySelector('img'); if (img) styleImg(img, it);
    } else if (g.type === 'marquee') {
      const r = rect(); const x = e.clientX - r.left, y = e.clientY - r.top;
      const L = Math.min(x, g.sx), T = Math.min(y, g.sy), W = Math.abs(x - g.sx), H = Math.abs(y - g.sy);
      Object.assign(g.el.style, { left: L + 'px', top: T + 'px', width: W + 'px', height: H + 'px' });
      const a = { minX: (L - vp.x) / vp.k, minY: (T - vp.y) / vp.k, maxX: (L + W - vp.x) / vp.k, maxY: (T + H - vp.y) / vp.k };
      const hit = items().filter(it => { const b = itemBounds(it); return b.minX < a.maxX && b.maxX > a.minX && b.minY < a.maxY && b.maxY > a.minY; }).map(i => i.id);
      sel = new Set([...g.base, ...hit]);
      for (const [id, el2] of els) el2.style.outline = sel.has(id) ? '1.5px dashed var(--accent)' : '';
    }
  });
  const endGesture = () => {
    const g = gesture; if (!g) return; gesture = null; canvas.classList.remove('panning');
    if (g.type === 'pan' && !g.moved) { if (sel.size) select([]); }
    if (g.type === 'marquee') { g.el.remove(); for (const el2 of els.values()) el2.style.outline = ''; renderSelection(); renderProps(); }
    if (g.type === 'move' && !g.moved) { if (g.narrow) select([g.narrow]); return; }
    if (['move', 'resize', 'rotate', 'crop'].includes(g.type)) { commit(); renderProps(); refreshSources(); }
  };
  canvas.addEventListener('pointerup', endGesture); canvas.addEventListener('pointercancel', endGesture);
  function resizeTo(g, w, free) {
    const it = g.it, s0 = g.start, hd = g.handle;
    const rad = (s0.rot || 0) * Math.PI / 180, cos = Math.cos(rad), sin = Math.sin(rad);
    const dxw = w.x - g.wx, dyw = w.y - g.wy;
    const dx = dxw * cos + dyw * sin, dy = -dxw * sin + dyw * cos; // delta no referencial do item
    const sx = hd.includes('e') ? 1 : hd.includes('w') ? -1 : 0, sy = hd.includes('s') ? 1 : hd.includes('n') ? -1 : 0;
    let nw = Math.max(24, s0.w + sx * dx), nh = Math.max(16, s0.h + sy * dy);
    if (sy === 0) nh = s0.h;
    const keep = !free && ['image', 'color', 'note'].includes(it.type) && sx !== 0 && sy !== 0;
    if (keep) { const f = Math.max(nw / s0.w, nh / s0.h); nw = Math.max(24, s0.w * f); nh = Math.max(16, s0.h * f); }
    const ax = -sx, ay = -sy; // âncora: canto oposto
    const c0x = s0.x + s0.w / 2, c0y = s0.y + s0.h / 2;
    const aLx = ax * s0.w / 2, aLy = ay * s0.h / 2;
    const awx = c0x + aLx * cos - aLy * sin, awy = c0y + aLx * sin + aLy * cos;
    const nLx = ax * nw / 2, nLy = ay * nh / 2;
    const ncx = awx - (nLx * cos - nLy * sin), ncy = awy - (nLx * sin + nLy * cos);
    it.w = Math.round(nw); it.h = Math.round(nh); it.x = Math.round(ncx - nw / 2); it.y = Math.round(ncy - nh / 2);
    place(els.get(it.id), it); renderSelection();
  }
  canvas.addEventListener('wheel', e => { e.preventDefault(); const r = rect(); zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015))); }, { passive: false });
  canvas.addEventListener('dblclick', e => {
    const itemEl = e.target.closest('.mb-item'); if (!itemEl) return;
    const it = byId(itemEl.dataset.id); if (!it) return;
    if (it.type === 'image') { const im = Store.S.imgs.get(it.imageId); if (im) Lightbox.fromImages([im], 0); }
    else if (it.type === 'ref') { if (Store.get(it.ref)) Nav.entity(it.ref); }
    else startEdit(it);
  });
  canvas.addEventListener('contextmenu', e => {
    const itemEl = e.target.closest('.mb-item'); if (!itemEl) return;
    e.preventDefault();
    const id = itemEl.dataset.id; if (!sel.has(id)) select([id]);
    const it = byId(id);
    Menu.open({ x: e.clientX, y: e.clientY }, [
      it.type === 'image' && Store.S.imgs.get(it.imageId) ? { label: 'Detalhes da imagem…', ic: 'edit', onClick: () => editImageModal(Store.S.imgs.get(it.imageId)) } : null,
      it.type === 'ref' && Store.get(it.ref) ? { label: 'Abrir ficha', ic: 'external', onClick: () => Nav.entity(it.ref) } : null,
      ['text', 'title', 'note', 'label'].includes(it.type) ? { label: 'Editar texto', ic: 'edit', onClick: () => startEdit(it) } : null,
      { label: 'Duplicar', ic: 'copy', hint: 'Ctrl+D', onClick: duplicateSel },
      { label: 'Trazer para frente', ic: 'front', hint: ']', onClick: () => reorder('front') },
      { label: 'Enviar para trás', ic: 'back', hint: '[', onClick: () => reorder('back') },
      { sep: true },
      { label: 'Remover do moodboard', ic: 'trash', danger: true, hint: 'Del', onClick: removeSel },
    ]);
  });
  /* soltar arquivos ou imagens da biblioteca */
  canvas.addEventListener('dragover', e => { const t = e.dataTransfer.types; if (t.includes('Files') || t.includes('text/x-fs-image')) { e.preventDefault(); canvas.classList.add('dropping'); } });
  canvas.addEventListener('dragleave', () => canvas.classList.remove('dropping'));
  canvas.addEventListener('drop', e => {
    e.preventDefault(); canvas.classList.remove('dropping');
    const at = toWorld(e.clientX, e.clientY);
    const libId = e.dataTransfer.getData('text/x-fs-image');
    if (libId) { const im = Store.S.imgs.get(libId); if (im) addImages([im], at); return; }
    const files = [...e.dataTransfer.files].filter(f => String(f.type).startsWith('image/'));
    if (files.length) importAndPlace(files, at); else if (e.dataTransfer.files.length) Toast.warn('Só arquivos de imagem podem ser adicionados.');
  });
  /* teclado e colar (ativos enquanto o editor está aberto) */
  const typing = () => { const a = document.activeElement; return editing || (a && (a.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName))); };
  App.keyHandler = e => {
    if (typing() || Modal.stack.length || Menu.current) return;
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); ctl.update(); }
    else if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); ctl.update(); }
    else if (mod && e.key.toLowerCase() === 'd') { e.preventDefault(); duplicateSel(); }
    else if (mod && e.key.toLowerCase() === 'a') { e.preventDefault(); select(items().map(i => i.id)); }
    else if (mod && e.key === '0') { e.preventDefault(); fitAll(); }
    else if (e.key === 'Delete' || e.key === 'Backspace') { if (sel.size) { e.preventDefault(); removeSel(); } }
    else if (e.key === 'Escape') { if (sel.size) select([]); }
    else if (e.key === ']') reorder('front'); else if (e.key === '[') reorder('back');
    else if (e.key === '+' || e.key === '=') zoomBy(1.2); else if (e.key === '-') zoomBy(1 / 1.2);
    else if (e.key === 'F2' || e.key === 'Enter') { const it = sel.size === 1 && byId([...sel][0]); if (it) { e.preventDefault(); if (it.type === 'image') { const f = props.querySelector('input'); if (f) f.focus(); } else startEdit(it); } }
    else if (e.key.startsWith('Arrow') && sel.size) {
      e.preventDefault(); const d = e.shiftKey ? 10 : 1;
      for (const id of sel) { const it = byId(id); if (e.key === 'ArrowLeft') it.x -= d; if (e.key === 'ArrowRight') it.x += d; if (e.key === 'ArrowUp') it.y -= d; if (e.key === 'ArrowDown') it.y += d; place(els.get(id), it); }
      renderSelection(); commitSoon();
    }
  };
  App.pasteHandler = e => {
    if (typing()) return;
    const files = Images.imagesFromClipboard(e);
    if (files.length) { e.preventDefault(); importAndPlace(files); return; }
    const text = (e.clipboardData && e.clipboardData.getData('text/plain') || '').trim();
    if (text) { e.preventDefault(); addItems([{ type: 'text', text: text.slice(0, 2000), w: 300, h: Math.min(400, 40 + Math.ceil(text.length / 34) * 22), size: 16, color: 'fg' }]); }
  };

  /* ---- gaveta da biblioteca ---- */
  let drawer = null;
  function toggleDrawer() {
    if (drawer) { drawer.remove(); drawer = null; return; }
    let q = '';
    const grid = h('div');
    const render = () => {
      clear(grid);
      const nq = U.norm(q);
      const used = new Set(Boards.imageIds(board));
      const list = [...Store.S.imgs.values()].filter(i => i.role !== 'cover' && (!nq || U.norm([i.title, i.category, ...(i.tags || []).map(Store.tagName)].join(' ')).includes(nq))).sort((a, b) => b.createdAt - a.createdAt);
      if (!list.length) { grid.appendChild(h('p.small.muted', Store.S.imgs.size ? 'Nada encontrado.' : 'A biblioteca do projeto está vazia.')); return; }
      grid.appendChild(h('div.gallery', list.map(im => {
        const el = h('div.gitem', { draggable: 'true', tabindex: 0, title: (im.title || 'Imagem') + ' — clique ou arraste para a área', onclick: () => addImages([im]), onkeydown: e => { if (e.key === 'Enter') addImages([im]); } },
          h('img', { src: Store.imgURL(im), alt: '', loading: 'lazy', draggable: 'false' }), used.has(im.id) ? h('span.badge', 'no quadro') : null, im.title ? h('div.cap', im.title) : null);
        el.addEventListener('dragstart', e => { e.dataTransfer.setData('text/x-fs-image', im.id); e.dataTransfer.effectAllowed = 'copy'; });
        return el;
      })));
    };
    drawer = h('div.drawer', h('div.drawer-head', icon('library', 15), h('b.grow', 'Biblioteca'), btn('', toggleDrawer, { ic: 'x', small: true, title: 'Fechar' })),
      h('div', { style: { padding: '10px 10px 0' } }, searchInput('', v => { q = v; render(); }, 'Buscar imagens', '100%')), h('div.drawer-body', grid));
    canvasWrap.appendChild(drawer); render();
  }

  /* ---- painel de propriedades ---- */
  const P = (title, ...kids) => h('div.panel', title ? h('div.panel-title', { style: { marginBottom: '10px' } }, h('h3', title)) : null, ...kids);
  const num = (label, val, set, { step = 1, min = null } = {}) => h('label.field', h('span.lbl', label), h('input.input.sm', { type: 'number', step, value: Math.round(val * 100) / 100, min, 'aria-label': label, onchange: e => { set(Number(e.target.value)); } }));
  const upd = (it, fn, full = false) => { fn(); if (full) rerender(it); else place(els.get(it.id), it); renderSelection(); commitSoon(); };
  function geometry(it) {
    return h('div.prop-grid', num('X', it.x, v => upd(it, () => it.x = v)), num('Y', it.y, v => upd(it, () => it.y = v)),
      num('Largura', it.w, v => upd(it, () => it.w = Math.max(24, v)), { min: 24 }), num('Altura', it.h, v => upd(it, () => it.h = Math.max(16, v)), { min: 16 }),
      h('label.field.wide', h('span.lbl', 'Rotação (°)'), h('div.row.nowrap', h('input', { type: 'range', min: -180, max: 180, value: it.rot || 0, 'aria-label': 'Rotação', oninput: e => upd(it, () => it.rot = Number(e.target.value)) }), h('input.input.sm', { type: 'number', value: it.rot || 0, style: { width: '72px' }, 'aria-label': 'Rotação em graus', onchange: e => { upd(it, () => it.rot = Number(e.target.value)); renderProps(); } }))));
  }
  function layerButtons() {
    return h('div.row', btn('', () => reorder('front'), { ic: 'front', small: true, title: 'Trazer para frente ( ] )' }), btn('', () => reorder('up'), { ic: 'up', small: true, title: 'Avançar uma camada' }),
      btn('', () => reorder('down'), { ic: 'down', small: true, title: 'Recuar uma camada' }), btn('', () => reorder('back'), { ic: 'back', small: true, title: 'Enviar para trás ( [ )' }),
      h('span.spacer'), btn('', duplicateSel, { ic: 'copy', small: true, title: 'Duplicar (Ctrl+D)' }), btn('', removeSel, { ic: 'trash', small: true, kind: 'danger', title: 'Remover do moodboard (Delete)' }));
  }
  function colorChoices(it, key, choices, full = true) {
    return h('div.swatches', choices.map(([c, l]) => h('button.swatch' + (it[key] === c ? '.on' : ''), { type: 'button', title: l, 'aria-label': l, style: { background: key === 'color' && it.type === 'note' ? 'var(--note-' + c + ')' : tokenColor(c) }, onclick: () => { upd(it, () => it[key] = c, full); renderProps(); } })),
      it.type !== 'note' ? h('input', { type: 'color', value: (it[key] || '').startsWith('#') ? it[key] : '#a78bfa', title: 'Cor personalizada', 'aria-label': 'Cor personalizada', onchange: e => { upd(it, () => it[key] = e.target.value, full); renderProps(); } }) : null);
  }
  function renderProps() {
    clear(props);
    const list = [...sel].map(byId).filter(Boolean);
    if (!list.length) return boardProps();
    if (list.length > 1) {
      const imgs = list.filter(i => i.type === 'image' && Store.S.imgs.get(i.imageId));
      props.append(P(list.length + ' objetos selecionados',
        h('div.lbl', 'Alinhar'), h('div.row', { style: { margin: '6px 0 12px' } }, [['left', 'Esquerda'], ['hcenter', 'Centro horizontal'], ['right', 'Direita'], ['top', 'Topo'], ['vcenter', 'Centro vertical'], ['bottom', 'Base']].map(([m, l]) => btn(l, () => align(m), { small: true }))),
        h('div.lbl', 'Distribuir'), h('div.row', { style: { margin: '6px 0 12px' } }, btn('Horizontalmente', () => align('hdist'), { small: true, disabled: list.length < 3 }), btn('Verticalmente', () => align('vdist'), { small: true, disabled: list.length < 3 })),
        layerButtons()),
        imgs.length ? P('Imagens selecionadas', h('p.meta', 'Associe as ' + imgs.length + ' imagens de uma vez a registros do projeto.'),
          refPicker({ kinds: Schema.NARRATIVE_KINDS, multi: true, value: [], allowCreate: false, placeholder: 'Associar a…', onChange: async ids => { for (const it of imgs) { const im = Store.S.imgs.get(it.imageId); for (const id of ids) if (!im.links.some(l => l.entityId === id)) im.links.push({ entityId: id, category: '', order: Store.imagesOf(id).length }); Store.saveImage(im); } await Store.flush(); Toast.ok('Imagens associadas.'); renderProps(); } })) : null);
      return;
    }
    const it = list[0];
    props.appendChild(h('div.row', { style: { padding: '0 2px' } }, icon(MB_TYPES[it.type].ic, 15), h('b', MB_TYPES[it.type].label)));
    if (it.type === 'image') imageProps(it);
    else if (['text', 'title', 'note', 'label'].includes(it.type)) {
      const ta = h('textarea.input', { rows: it.type === 'note' || it.type === 'text' ? 5 : 2, value: it.text || '', 'aria-label': 'Conteúdo' });
      ta.addEventListener('input', () => { upd(it, () => it.text = ta.value, true); const el = els.get(it.id); const t = el && el.querySelector('.mb-text, .mb-note'); if (t) fitHeight(it, t); });
      props.append(P('Conteúdo', ta, h('p.meta', { style: { marginTop: '6px' } }, 'Dica: dê duplo clique no objeto para editar direto no quadro.'),
        it.type !== 'label' ? h('label.field', { style: { marginTop: '10px' } }, h('span.lbl', 'Tamanho do texto'), h('div.row.nowrap', h('input', { type: 'range', min: 10, max: it.type === 'title' ? 96 : 40, value: it.size || 16, 'aria-label': 'Tamanho do texto', oninput: e => upd(it, () => it.size = Number(e.target.value), true) }))) : null,
        it.type === 'text' || it.type === 'title' ? h('div.row', { style: { marginTop: '10px' } }, segmented([{ value: 'left', label: 'Esq.' }, { value: 'center', label: 'Centro' }, { value: 'right', label: 'Dir.' }], it.align || 'left', v => upd(it, () => it.align = v, true), { label: 'Alinhamento' }),
          h('label.check.small', h('input', { type: 'checkbox', checked: !!it.bold, onchange: e => upd(it, () => it.bold = e.target.checked, true) }), 'Negrito')) : null,
        h('div.field', { style: { marginTop: '10px' } }, h('span.lbl', 'Cor'), colorChoices(it, 'color', it.type === 'note' ? NOTE_COLORS : TEXT_COLORS))));
    } else if (it.type === 'divider') props.append(P('Separador', h('div.field', h('span.lbl', 'Cor'), colorChoices(it, 'color', TEXT_COLORS)), h('label.field', { style: { marginTop: '10px' } }, h('span.lbl', 'Espessura'), h('input', { type: 'range', min: 1, max: 12, value: it.thickness || 2, oninput: e => upd(it, () => it.thickness = Number(e.target.value), true) }))));
    else if (it.type === 'color') props.append(P('Cor', h('div.row.nowrap', h('input', { type: 'color', value: it.hex, 'aria-label': 'Cor', onchange: e => { upd(it, () => it.hex = e.target.value, true); renderProps(); } }), h('input.input.sm.mono', { value: it.hex, 'aria-label': 'Código da cor', onchange: e => { if (/^#[0-9a-f]{6}$/i.test(e.target.value)) upd(it, () => it.hex = e.target.value, true); else Toast.warn('Use o formato #RRGGBB.'); } })),
      h('label.field', { style: { marginTop: '10px' } }, h('span.lbl', 'Nome'), h('input.input.sm', { value: it.name || '', placeholder: 'Ex.: Capa da nobreza', oninput: e => upd(it, () => it.name = e.target.value, true) }))));
    else if (it.type === 'palette') {
      const box = h('div.col', { style: { gap: '6px' } });
      const draw = () => { clear(box); (it.colors || []).forEach((c, i) => box.appendChild(h('div.row.nowrap', h('input', { type: 'color', value: c, 'aria-label': 'Cor ' + (i + 1), onchange: e => { it.colors[i] = e.target.value; upd(it, () => {}, true); draw(); } }), h('span.mono.grow', c.toUpperCase()),
        btn('', () => { it.colors.splice(i, 1); upd(it, () => {}, true); draw(); }, { ic: 'x', small: true, title: 'Remover cor' })))); box.appendChild(btn('Adicionar cor', () => { it.colors.push('#888888'); upd(it, () => {}, true); draw(); }, { small: true, ic: 'plus', disabled: (it.colors || []).length >= 12 })); };
      draw();
      props.append(P('Paleta', h('label.field', h('span.lbl', 'Nome'), h('input.input.sm', { value: it.name || '', oninput: e => upd(it, () => it.name = e.target.value, true) })), h('div', { style: { height: '10px' } }), box));
    } else if (it.type === 'ref') {
      const e = Store.get(it.ref);
      props.append(P('Registro', e ? h('div.col', h('div.row', entityLink(e.id, { showKind: true })), entSummary(e) ? h('p.small.muted', entSummary(e).slice(0, 220)) : null, btn('Abrir ficha', () => Nav.entity(e.id), { small: true, ic: 'external' })) : h('p.muted.small', 'O registro foi excluído.'),
        h('div.field', { style: { marginTop: '10px' } }, h('span.lbl', 'Trocar por'), refPicker({ kinds: Schema.NARRATIVE_KINDS, multi: false, value: null, allowCreate: false, onChange: v => { if (v) { upd(it, () => it.ref = v, true); renderProps(); } } }))));
    }
    props.append(P('Posição e tamanho', geometry(it)), P('Camadas e ações', layerButtons()));
  }
  function imageProps(it) {
    const im = Store.S.imgs.get(it.imageId);
    if (!im) { props.append(P('Imagem', h('p.muted.small', 'Esta imagem foi excluída da biblioteca.'), btn('Remover do moodboard', removeSel, { small: true, kind: 'danger' }))); return; }
    const save = U.debounce(() => { Store.saveImage(im); }, 300);
    const F = (k, label, ta) => { const c = ta ? h('textarea.input', { rows: 2, value: im[k] || '', 'aria-label': label }) : h('input.input.sm', { value: im[k] || '', 'aria-label': label }); c.addEventListener('input', () => { im[k] = c.value; save(); if (k === 'title' && it.showCaption && !it.caption) rerender(it); }); return h('label.field', h('span.lbl', label), c); };
    const catIn = h('input.input.sm', { value: im.category || '', list: 'mb-cats', 'aria-label': 'Categoria', oninput: e => { im.category = e.target.value; save(); } });
    props.append(
      P('Imagem', h('div.row.nowrap', { style: { alignItems: 'flex-start', marginBottom: '10px' } }, h('img', { src: Store.imgURL(im), alt: '', style: { width: '64px', height: '64px', objectFit: 'cover', borderRadius: '6px', cursor: 'zoom-in', flex: 'none' }, onclick: () => Lightbox.fromImages([im], 0) }),
          h('div.meta', [im.width ? im.width + '×' + im.height + ' px' : null, im.size ? U.fmtBytes(im.size) : null, Images.isRemoteOnly(im) ? 'link externo (não guardada)' : null].filter(Boolean).join(' · '))),
        h('div.col', { style: { gap: '9px' } }, F('title', 'Nome'), F('description', 'Descrição', true), h('label.field', h('span.lbl', 'Categoria'), catIn, h('datalist#mb-cats', Images.allCategories().map(c => h('option', { value: c })))),
          h('label.field', h('span.lbl', 'Tags'), tagInput(im.tags || [], v => { im.tags = v; save(); })), F('source', 'Origem'), F('sourceUrl', 'Link de origem'), F('notes', 'Observações', true),
          h('div.field', h('span.lbl', 'Elementos relacionados'), refPicker({ kinds: Schema.NARRATIVE_KINDS, multi: true, value: (im.links || []).map(l => l.entityId), allowCreate: false, onChange: ids => { const old = im.links || []; im.links = ids.map(id => old.find(l => l.entityId === id) || { entityId: id, category: im.category || '', order: Store.imagesOf(id).length }); save(); } })),
          h('p.meta', 'Nome, descrição, tags e vínculos são da imagem e aparecem em todas as fichas e moodboards que a usam.'),
          h('div.row', btn('Mais detalhes', () => editImageModal(im), { small: true, ic: 'edit' }), btn('Extrair paleta', () => extractPalette(it, im), { small: true, ic: 'palette', title: 'Cria uma paleta com as cores principais desta imagem' })))),
      P('Neste moodboard',
        h('label.field', h('span.lbl', 'Legenda'), h('input.input.sm', { value: it.caption || '', placeholder: 'Usa o nome da imagem se vazio', 'aria-label': 'Legenda', oninput: e => upd(it, () => it.caption = e.target.value, true) })),
        h('label.check.small', { style: { marginTop: '6px' } }, h('input', { type: 'checkbox', checked: !!it.showCaption, onchange: e => upd(it, () => it.showCaption = e.target.checked, true) }), 'Mostrar legenda abaixo da imagem'),
        h('div.field', { style: { marginTop: '12px' } }, h('span.lbl', 'Ajuste'), segmented([{ value: 'cover', label: 'Preencher' }, { value: 'contain', label: 'Inteira' }, { value: 'fill', label: 'Esticar' }], it.fit || 'cover', v => { upd(it, () => it.fit = v, true); }, { label: 'Modo de ajuste' })),
        h('div.field', { style: { marginTop: '12px' } }, h('span.lbl', 'Enquadramento'),
          ...[['zoom', 'Zoom', 1, 3, 0.05], ['posX', 'Horizontal', 0, 100, 1], ['posY', 'Vertical', 0, 100, 1]].map(([k, l, mn, mx, st]) => h('div.row.nowrap', h('span.meta', { style: { width: '74px' } }, l), h('input', { type: 'range', min: mn, max: mx, step: st, value: it[k] ?? (k === 'zoom' ? 1 : 50), 'aria-label': l, oninput: e => { it[k] = Number(e.target.value); const img = els.get(it.id).querySelector('img'); if (img) styleImg(img, it); commitSoon(); } }))),
          h('div.row', btn('Redefinir enquadramento', () => { upd(it, () => { it.zoom = 1; it.posX = 50; it.posY = 50; }, true); renderProps(); }, { small: true }), h('span.meta', 'ou Alt + arrastar a imagem')))),
      P('Posição e tamanho', geometry(it), h('div.row', { style: { marginTop: '8px' } }, btn('Proporção original', () => { if (im.width) upd(it, () => it.h = Math.round(it.w * im.height / im.width)); renderProps(); }, { small: true }))),
      P('Camadas e ações', layerButtons()));
  }
  async function extractPalette(it, im) {
    try {
      const bmp = await createImageBitmap(im.thumb || im.preview || im.blob);
      const cv = document.createElement('canvas'); const s = 64; cv.width = s; cv.height = s; const ctx = cv.getContext('2d'); ctx.drawImage(bmp, 0, 0, s, s);
      const d = ctx.getImageData(0, 0, s, s).data; const buckets = new Map();
      for (let i = 0; i < d.length; i += 4) { if (d[i + 3] < 128) continue; const key = (d[i] >> 4) << 8 | (d[i + 1] >> 4) << 4 | (d[i + 2] >> 4); const b = buckets.get(key) || { n: 0, r: 0, g: 0, b: 0 }; b.n++; b.r += d[i]; b.g += d[i + 1]; b.b += d[i + 2]; buckets.set(key, b); }
      const cand = [...buckets.values()].sort((a, b) => b.n - a.n).map(b => [b.r / b.n, b.g / b.n, b.b / b.n]);
      const picked = [];
      for (const c of cand) { if (picked.every(p => Math.hypot(p[0] - c[0], p[1] - c[1], p[2] - c[2]) > 48)) picked.push(c); if (picked.length >= 6) break; }
      const hex = picked.map(c => '#' + c.map(v => Math.round(v).toString(16).padStart(2, '0')).join(''));
      addItems([{ type: 'palette', colors: hex, name: 'Paleta · ' + (im.title || 'imagem'), w: Math.max(240, it.w), h: 110 }], { at: { x: it.x, y: it.y + it.h + (it.showCaption ? 40 : 20) } });
    } catch (e) { Toast.err('Não foi possível ler as cores desta imagem.'); }
  }
  function boardProps() {
    const f = board.fields;
    const save = U.debounce(() => Store.saveEntity(board, { silent: true }), 300);
    const T = (k, label, ta) => { const c = ta ? h('textarea.input', { rows: 3, value: f[k] || '', 'aria-label': label }) : h('input.input.sm', { value: f[k] || '' }); c.addEventListener('input', () => { f[k] = c.value; save(); }); return h('label.field', h('span.lbl', label), c); };
    const rel = Boards.related(board);
    const counts = {}; items().forEach(i => counts[i.type] = (counts[i.type] || 0) + 1);
    const boardImgs = Boards.imageIds(board).map(id => Store.S.imgs.get(id)).filter(Boolean);
    props.append(
      P('Moodboard', h('div.col', { style: { gap: '10px' } }, T('description', 'Descrição', true),
        h('label.field', h('span.lbl', 'Tags'), tagInput(board.tags || [], v => { board.tags = v; save(); })),
        h('div.field', h('span.lbl', 'Elementos associados'), refPicker({ kinds: Schema.NARRATIVE_KINDS, multi: true, value: f.linkedIds, allowCreate: false, onChange: v => { f.linkedIds = v; save(); } }),
          h('span.hint', 'O moodboard aparece na aba Referências dessas fichas.')),
        T('notes', 'Observações gerais', true),
        h('div.field', h('span.lbl', 'Capa'), h('select.input.sm', { 'aria-label': 'Imagem de capa', onchange: e => { f.coverImageId = e.target.value || null; save(); } }, h('option', { value: '' }, 'Automática (primeiras imagens)'), boardImgs.map(im => h('option', { value: im.id, selected: f.coverImageId === im.id }, im.title || 'Imagem')))),
        h('div.field', h('span.lbl', 'Fundo da área'), segmented([{ value: 'dots', label: 'Pontilhado' }, { value: 'plain', label: 'Liso' }], f.bg || 'dots', v => { f.bg = v; canvas.classList.toggle('plain', v === 'plain'); save(); }, { label: 'Fundo' })))),
      P('Conteúdo', h('div.meta', Object.entries(counts).map(([t, n]) => n + ' ' + (n === 1 ? MB_TYPES[t].label.toLowerCase() : MB_PLURAL[t])).join(' · ') || 'Vazio'),
        rel.length ? h('div.col', { style: { gap: '4px', marginTop: '10px' } }, h('span.lbl', 'Universo ligado a este moodboard'), rel.map(id => h('div.row.nowrap', entityLink(id, { showKind: true })))) : null,
        h('div.meta', { style: { marginTop: '10px' } }, 'Criado em ' + U.fmtDate(board.createdAt) + ' · modificado em ' + U.fmtDate(board.updatedAt))),
      P(null, h('p.meta', 'Selecione um objeto para ver suas propriedades. Shift + arrastar no fundo seleciona vários.')));
  }

  /* ---- exportação PNG ---- */
  function exportDialog() {
    const opts = { area: sel.size ? 'selection' : 'all', scale: 2, captions: true, hideAux: false, bg: 'theme' };
    const info = h('div.meta');
    const upd2 = () => { const list = exportItems(opts); const b = exportBounds(list, opts); if (!b) { info.textContent = 'Nada a exportar.'; return; } const sc = effScale(b, opts.scale); info.textContent = 'Resultado: ' + Math.round((b.maxX - b.minX) * sc) + ' × ' + Math.round((b.maxY - b.minY) * sc) + ' px' + (sc < opts.scale ? ' (resolução reduzida para caber no limite do navegador)' : ''); };
    const radio = (name, val, label, disabled) => h('label.check', h('input', { type: 'radio', name, value: val, checked: opts[name === 'mbarea' ? 'area' : 'bg'] === val, disabled, onchange: () => { opts[name === 'mbarea' ? 'area' : 'bg'] = val; upd2(); } }), label);
    Modal.open({
      title: 'Exportar moodboard como PNG', body: h('div.col', { style: { gap: '14px' } },
        h('div.field', h('span.lbl', 'Área'), h('div.col', { style: { gap: '4px' } }, radio('mbarea', 'all', 'Moodboard completo'), radio('mbarea', 'selection', 'Apenas a seleção (' + sel.size + ' objeto[s])', !sel.size), radio('mbarea', 'view', 'Área visível na tela'))),
        h('div.field', h('span.lbl', 'Resolução'), segmented([{ value: 1, label: '1×' }, { value: 2, label: '2×' }, { value: 3, label: '3×' }, { value: 4, label: '4×' }], opts.scale, v => { opts.scale = v; upd2(); }, { label: 'Resolução' })),
        h('div.col', { style: { gap: '6px' } }, h('label.check', h('input', { type: 'checkbox', checked: opts.captions, onchange: e => { opts.captions = e.target.checked; upd2(); } }), 'Incluir legendas das imagens'),
          h('label.check', h('input', { type: 'checkbox', checked: opts.hideAux, onchange: e => { opts.hideAux = e.target.checked; upd2(); } }), 'Ocultar elementos auxiliares (notas, etiquetas, referências e separadores)')),
        h('div.field', h('span.lbl', 'Fundo'), h('div.col', { style: { gap: '4px' } }, radio('mbbg', 'theme', 'Cor da área de trabalho'), radio('mbbg', 'white', 'Branco'), radio('mbbg', 'transparent', 'Transparente'))),
        info, h('p.meta', 'A exportação não altera o moodboard.')),
      actions: [{ label: 'Cancelar' }, { label: 'Exportar', kind: 'primary', onClick: async () => { await exportPNG(opts); } }],
    });
    upd2();
  }
  function exportItems(opts) {
    let list = items();
    if (opts.area === 'selection') list = list.filter(i => sel.has(i.id));
    if (opts.area === 'view') { const v = visibleWorld(); list = list.filter(i => { const b = itemBounds(i); return b.maxX > v.x && b.minX < v.x + v.w && b.maxY > v.y && b.minY < v.y + v.h; }); }
    if (opts.hideAux) list = list.filter(i => !MB_AUX.includes(i.type));
    return [...list].sort((a, b) => (a.z || 0) - (b.z || 0));
  }
  function exportBounds(list, opts) {
    if (opts.area === 'view') { const v = visibleWorld(); return { minX: v.x, minY: v.y, maxX: v.x + v.w, maxY: v.y + v.h }; }
    const b = bboxOf(list); if (!b) return null;
    const capExtra = opts.captions && list.some(i => i.type === 'image' && i.showCaption) ? 44 : 0;
    return { minX: b.minX - 40, minY: b.minY - 40, maxX: b.maxX + 40, maxY: b.maxY + 40 + capExtra };
  }
  function effScale(b, s) { const LIM = 8192, MAXPX = 50e6; const w = b.maxX - b.minX, hh = b.maxY - b.minY; return Math.max(0.1, Math.min(s, LIM / w, LIM / hh, Math.sqrt(MAXPX / (w * hh)))); }
  function wrap(ctx, text, maxW) {
    const out = [];
    for (const para of String(text || '').split('\n')) {
      let line = '';
      for (const word of para.split(/(\s+)/)) { const t = line + word; if (ctx.measureText(t).width > maxW && line.trim()) { out.push(line.trimEnd()); line = word.trimStart(); } else line = t; }
      out.push(line);
    }
    return out;
  }
  function rrect(ctx, x, y, w, hh, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + hh, r); ctx.arcTo(x + w, y + hh, x, y + hh, r); ctx.arcTo(x, y + hh, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  async function bitmapOf(im, wantPx) {
    if (!im) return null;
    const src = im.blob ? (wantPx > 1700 || !im.preview ? im.blob : im.preview) : null;
    if (src) { try { return await createImageBitmap(src); } catch (e) { return null; } }
    return null;
  }
  async function exportPNG(opts) {
    const list = exportItems(opts); const b = exportBounds(list, opts);
    if (!b || !list.length) { Toast.warn('Não há objetos na área escolhida.'); return false; }
    const sc = effScale(b, opts.scale);
    const W = Math.round((b.maxX - b.minX) * sc), H = Math.round((b.maxY - b.minY) * sc);
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');
    if (opts.bg !== 'transparent') { ctx.fillStyle = opts.bg === 'white' ? '#ffffff' : cssVar('--canvas'); ctx.fillRect(0, 0, W, H); }
    ctx.scale(sc, sc); ctx.translate(-b.minX, -b.minY);
    const font = getComputedStyle(document.body).fontFamily;
    const fgOnBg = opts.bg === 'white' ? '#1b1c25' : cssVar('--fg');
    let skipped = 0;
    for (const it of list) {
      ctx.save();
      ctx.translate(it.x + it.w / 2, it.y + it.h / 2); if (it.rot) ctx.rotate(it.rot * Math.PI / 180);
      const x = -it.w / 2, y = -it.h / 2, w = it.w, hh = it.h;
      if (it.type === 'image') {
        const im = Store.S.imgs.get(it.imageId); const bmp = await bitmapOf(im, w * sc);
        if (!bmp) { skipped++; ctx.fillStyle = cssVar('--raised'); ctx.fillRect(x, y, w, hh); }
        else {
          ctx.save(); rrect(ctx, x, y, w, hh, 3); ctx.clip();
          const iw = bmp.width, ih = bmp.height, fit = it.fit || 'cover', px = (it.posX ?? 50) / 100, py = (it.posY ?? 50) / 100, z = it.zoom || 1;
          let dw, dh;
          if (fit === 'fill') { dw = w; dh = hh; } else { const s0 = fit === 'cover' ? Math.max(w / iw, hh / ih) : Math.min(w / iw, hh / ih); dw = iw * s0; dh = ih * s0; }
          let dx = (w - dw) * px, dy = (hh - dh) * py;
          const ox = w * px, oy = hh * py; dx = ox + (dx - ox) * z; dy = oy + (dy - oy) * z; dw *= z; dh *= z;
          ctx.drawImage(bmp, x + dx, y + dy, dw, dh); ctx.restore();
        }
        if (opts.captions && it.showCaption) {
          const cap = it.caption || (im && im.title) || '';
          if (cap) { ctx.font = `400 13px ${font}`; ctx.fillStyle = opts.bg === 'white' ? '#555869' : cssVar('--fg-2'); ctx.textBaseline = 'top'; wrap(ctx, cap, w).slice(0, 3).forEach((l, i) => ctx.fillText(l, x, y + hh + 6 + i * 17)); }
        }
      } else if (it.type === 'text' || it.type === 'title') {
        const size = it.size || (it.type === 'title' ? 36 : 16);
        ctx.font = `${it.type === 'title' || it.bold ? 700 : 400} ${size}px ${font}`; ctx.fillStyle = it.color === 'fg' || !it.color ? fgOnBg : tokenValue(it.color); ctx.textBaseline = 'top';
        ctx.textAlign = it.align || 'left'; const ax = it.align === 'center' ? x + w / 2 : it.align === 'right' ? x + w : x;
        const lh = size * (it.type === 'title' ? 1.12 : 1.35); ctx.beginPath(); ctx.rect(x, y, w, hh); ctx.clip();
        wrap(ctx, it.text, w).forEach((l, i) => ctx.fillText(l, ax, y + i * lh));
      } else if (it.type === 'note') {
        ctx.fillStyle = cssVar('--note-' + (it.color || 'yellow')); rrect(ctx, x, y, w, hh, 4); ctx.fill();
        const size = it.size || 14; ctx.font = `400 ${size}px ${font}`; ctx.fillStyle = cssVar('--fg'); ctx.textBaseline = 'top'; ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, hh); ctx.clip();
        wrap(ctx, it.text, w - 32).forEach((l, i) => ctx.fillText(l, x + 16, y + 14 + i * size * 1.45)); ctx.restore();
      } else if (it.type === 'label') {
        const c = tokenValue(it.color || 'accent'); ctx.globalAlpha = .24; ctx.fillStyle = c; rrect(ctx, x, y, w, hh, hh / 2); ctx.fill(); ctx.globalAlpha = 1;
        ctx.font = `650 13px ${font}`; ctx.fillStyle = c; ctx.textBaseline = 'middle'; ctx.fillText(it.text || '', x + 12, y + hh / 2, w - 24);
      } else if (it.type === 'divider') { ctx.fillStyle = tokenValue(it.color || 'fg-2'); const t = it.thickness || 2; ctx.fillRect(x, -t / 2, w, t); }
      else if (it.type === 'color') {
        ctx.fillStyle = it.hex; rrect(ctx, x, y, w, hh, 4); ctx.fill();
        ctx.font = `500 11.5px ${font}`; const label = (it.name ? it.name + ' · ' : '') + it.hex.toUpperCase(); const tw = ctx.measureText(label).width;
        ctx.fillStyle = 'rgba(0,0,0,.35)'; rrect(ctx, x + 8, y + hh - 28, tw + 12, 20, 4); ctx.fill(); ctx.fillStyle = '#fff'; ctx.textBaseline = 'middle'; ctx.fillText(label, x + 14, y + hh - 18);
      } else if (it.type === 'palette') {
        ctx.save(); rrect(ctx, x, y, w, hh, 6); ctx.clip(); ctx.fillStyle = cssVar('--panel'); ctx.fillRect(x, y, w, hh);
        const cols = it.colors || []; const sh = hh - 28; cols.forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(x + i * w / cols.length, y, w / cols.length + 0.5, sh); });
        ctx.font = `600 12px ${font}`; ctx.fillStyle = cssVar('--fg-2'); ctx.textBaseline = 'middle'; ctx.fillText(it.name || 'Paleta', x + 10, y + sh + 14, w - 20); ctx.restore();
      } else if (it.type === 'ref') {
        const e = Store.get(it.ref);
        ctx.fillStyle = cssVar('--panel'); rrect(ctx, x, y, w, hh, 8); ctx.fill(); ctx.strokeStyle = cssVar('--line'); ctx.lineWidth = 1; ctx.stroke();
        ctx.fillStyle = e ? (Schema.KINDS[e.kind] || {}).color : cssVar('--muted'); ctx.fillRect(x, y + 4, 4, hh - 8);
        let tx = x + 16;
        if (e) {
          const im = Store.mainImage(e); const bmp = im ? await bitmapOf(im, 96) : null;
          if (bmp) { ctx.save(); rrect(ctx, x + 12, y + (hh - 48) / 2, 48, 48, 6); ctx.clip(); const s0 = Math.max(48 / bmp.width, 48 / bmp.height); ctx.drawImage(bmp, x + 12 + (48 - bmp.width * s0) / 2, y + (hh - 48) / 2 + (48 - bmp.height * s0) / 2, bmp.width * s0, bmp.height * s0); ctx.restore(); tx = x + 70; }
          ctx.textBaseline = 'top'; ctx.font = `650 14px ${font}`; ctx.fillStyle = cssVar('--fg'); ctx.fillText(e.name, tx, y + 14, w - (tx - x) - 10);
          ctx.font = `400 11.5px ${font}`; ctx.fillStyle = cssVar('--muted'); ctx.fillText(Schema.kindLabel(e.kind), tx, y + 34, w - (tx - x) - 10);
          const sm = entSummary(e); if (sm && hh > 70) { ctx.font = `400 12px ${font}`; ctx.fillStyle = cssVar('--fg-2'); wrap(ctx, sm, w - (tx - x) - 10).slice(0, 1).forEach(l => ctx.fillText(l, tx, y + 52, w - (tx - x) - 10)); }
        }
      }
      ctx.restore();
    }
    const blob = await new Promise(r => cv.toBlob(r, 'image/png'));
    if (!blob) { Toast.err('O navegador não conseguiu gerar a imagem (área grande demais). Tente uma resolução menor.'); return false; }
    U.download(blob, U.slug(board.name) + '.png');
    Toast.ok('PNG exportado (' + W + ' × ' + H + ' px).' + (skipped ? ' ' + skipped + ' imagem(ns) em link externo ficaram em branco.' : ''));
    return true;
  }

  /* ---- início ---- */
  renderAll(); renderProps();
  requestAnimationFrame(() => {
    if (board.view && typeof board.view.k === 'number') { vp.x = board.view.x; vp.y = board.view.y; vp.k = board.view.k; applyView(); }
    else if (items().length) fitAll(); else applyView();
  });
  const onResize = U.debounce(() => renderSelection(), 100);
  window.addEventListener('resize', onResize);
  App.onLeave(() => { window.removeEventListener('resize', onResize); commitSoon.flush(); saveView.flush(); });
  // exposto para testes automatizados
  Views.moodboard._api = { board, select, addImages, addText, removeSel, duplicateSel, undo, redo, reorder, exportPNG, fitAll, vp, sel: () => sel, items };
};
