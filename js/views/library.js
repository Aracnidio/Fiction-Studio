/* Fiction Studio — biblioteca de mídia do projeto, coleções, cobertura de referências,
   biblioteca global (todos os projetos) e anotações do universo. */
'use strict';

const libState = { q: '', cat: '', kind: '', entity: '', tag: '', filter: 'all', size: 'm' };

function mediaLibrary(body) {
  const imgs = () => [...Store.S.imgs.values()].filter(i => i.role !== 'cover');
  const selected = new Set();
  const grid = h('div'); const bulk = h('div.row', { style: { minHeight: '34px' } });
  let dupGroups = null;
  async function computeDuplicates() {
    const list = imgs().filter(i => i.blob);
    for (const im of list) if (!im.hash) await Images.ensureHash(im);
    const g = {}; list.forEach(im => (g[im.hash] = g[im.hash] || []).push(im));
    dupGroups = Object.values(g).filter(x => x.length > 1);
    await Store.flush();
  }
  function filtered() {
    const q = U.norm(libState.q);
    return imgs().filter(i => {
      const u = libState.filter === 'unused' || libState.filter === 'used' ? Store.mediaUsage(i.id) : null;
      if (libState.filter === 'unused' && u.used) return false;
      if (libState.filter === 'used' && !u.used) return false;
      if (libState.filter === 'remote' && !Images.isRemoteOnly(i)) return false;
      if (libState.cat && i.category !== libState.cat && !i.links.some(l => l.category === libState.cat)) return false;
      if (libState.entity && !i.links.some(l => l.entityId === libState.entity) && !Store.mediaUsage(i.id).boards.some(b => b.id === libState.entity)) return false;
      if (libState.kind && !i.links.some(l => (Store.get(l.entityId) || {}).kind === libState.kind)) return false;
      if (libState.tag && !(i.tags || []).includes(libState.tag)) return false;
      if (q && !U.norm([i.title, i.description, i.category, i.source, i.notes, i.creator, ...(i.tags || []).map(Store.tagName), ...i.links.map(l => (Store.get(l.entityId) || {}).name)].join(' ')).includes(q)) return false;
      return true;
    }).sort((a, b) => b.createdAt - a.createdAt);
  }
  function renderBulk() {
    clear(bulk);
    if (!selected.size) { bulk.appendChild(h('span.meta', 'Clique na caixa de uma imagem para selecionar várias e agir em conjunto.')); return; }
    const ids = [...selected];
    bulk.append(h('b.small', selected.size + ' selecionada(s)'),
      btn('Adicionar a moodboard', e => Menu.open(e.currentTarget, [
        ...Boards.list().sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 12).map(b => ({ label: b.name, ic: 'moodboard', onClick: () => addToBoard(b, ids) })),
        Boards.list().length ? { sep: true } : null,
        { label: 'Novo moodboard com estas imagens', ic: 'plus', onClick: () => Boards.create({ imageIds: ids }) },
      ]), { small: true, ic: 'moodboard' }),
      btn('Adicionar a coleção', e => Menu.open(e.currentTarget, [
        ...Store.list('refcollection').map(c => ({ label: c.name, ic: 'images', onClick: () => { c.imageIds = U.uniq([...(c.imageIds || []), ...ids]); Store.saveEntity(c); Toast.ok('Adicionadas a "' + c.name + '".'); } })),
        Store.list('refcollection').length ? { sep: true } : null,
        { label: 'Nova coleção…', ic: 'plus', onClick: async () => { const n = await Modal.prompt('Nova coleção', 'Nome'); if (n) { Store.newEntity('refcollection', { name: n, fields: { description: '', linkedIds: [] }, imageIds: ids }); await Store.flush(); Toast.ok('Coleção "' + n + '" criada.'); } } },
      ]), { small: true, ic: 'images' }),
      h('div', { style: { minWidth: '240px' } }, refPicker({ kinds: Schema.NARRATIVE_KINDS, multi: true, value: [], allowCreate: false, placeholder: 'Associar a registro…', onChange: async ents => { for (const id of ents) for (const iid of ids) { const im = Store.S.imgs.get(iid); if (!im.links.some(l => l.entityId === id)) { im.links.push({ entityId: id, category: '', order: Store.imagesOf(id).length }); Store.saveImage(im); } } await Store.flush(); Toast.ok('Imagens associadas.'); selected.clear(); render(); } })),
      btn('Excluir', async () => { if (await confirmDeleteImages(ids)) { selected.clear(); render(); } }, { kind: 'danger', small: true, ic: 'trash' }),
      btn('Limpar seleção', () => { selected.clear(); render(); }, { small: true, kind: 'ghost' }));
  }
  async function addToBoard(b, ids) {
    b.items = b.items || [];
    let z = b.items.reduce((m, i) => Math.max(m, i.z || 0), 0);
    const bb = b.items.length ? { x: Math.min(...b.items.map(i => i.x)), y: Math.max(...b.items.map(i => i.y + i.h)) + 60 } : { x: 0, y: 0 };
    let x = bb.x;
    for (const id of ids) {
      const im = Store.S.imgs.get(id); if (!im) continue;
      const w = 260, hh = Math.round(w * (im.width ? Math.min(1.6, im.height / im.width) : .75));
      b.items.push({ id: U.id('mi'), type: 'image', imageId: id, x, y: bb.y, w, h: hh, rot: 0, z: ++z, fit: 'cover', posX: 50, posY: 50, zoom: 1, caption: '', showCaption: false });
      x += w + 24;
    }
    Store.saveEntity(b); await Store.flush();
    Toast.action(U.plural(ids.length, 'imagem adicionada', 'imagens adicionadas') + ' a "' + b.name + '".', 'Abrir', () => Nav.entity(b.id));
    selected.clear(); render();
  }
  function card(im, idx, list) {
    const u = Store.mediaUsage(im.id);
    const names = [...u.ents.map(e => e.name), ...u.boards.map(b => b.name)];
    const cb = h('input.selbox', { type: 'checkbox', checked: selected.has(im.id), 'aria-label': 'Selecionar ' + (im.title || 'imagem'), onclick: e => { e.stopPropagation(); cb.checked ? selected.add(im.id) : selected.delete(im.id); el.classList.toggle('sel', cb.checked); renderBulk(); } });
    const el = h('div.gitem' + (selected.has(im.id) ? '.sel' : ''), { tabindex: 0, onclick: e => { if (!e.target.closest('.tools') && e.target !== cb) Lightbox.fromImages(list, idx); }, onkeydown: e => { if (e.key === 'Enter') Lightbox.fromImages(list, idx); } },
      h('img', { src: Store.imgURL(im), alt: im.title || '', loading: 'lazy' }),
      Images.isRemoteOnly(im) ? h('span.badge.warn', 'link externo') : !u.used ? h('span.badge.remote', 'sem uso') : null,
      h('div.cap', im.title || names.join(', ') || ' '),
      h('div.tools', h('button', { type: 'button', title: 'Detalhes e uso', 'aria-label': 'Detalhes da imagem', onclick: () => editImageModal(im) }, icon('edit', 13))), cb);
    return el;
  }
  async function render() {
    clear(grid);
    renderBulk();
    const all = imgs();
    if (!all.length) { grid.appendChild(emptyState('Biblioteca vazia', 'Importe imagens do computador, arraste arquivos para esta página ou cole com Ctrl+V. Elas ficam disponíveis para todas as fichas e moodboards do projeto.', btn('Importar imagens', async () => { const f = await U.pickFile({ accept: 'image/*', multiple: true }); if (f.length) { await Images.importFiles(f); render(); } }, { kind: 'primary', ic: 'upload' }), 'library')); return; }
    if (libState.filter === 'dups') {
      grid.appendChild(h('div.notice.info', 'Calculando impressões digitais…'));
      await computeDuplicates(); clear(grid);
      if (!dupGroups.length) { grid.appendChild(emptyState('Nenhuma duplicada', 'Não há arquivos idênticos na biblioteca.', null, 'check')); return; }
      grid.appendChild(h('p.meta', { style: { marginBottom: '10px' } }, 'Arquivos idênticos (mesmo conteúdo). "Manter esta" junta vínculos, moodboards e coleções na imagem escolhida e apaga as outras cópias.'));
      for (const g of dupGroups) grid.appendChild(h('div.panel', h('div.gallery', g.map(im => h('div.col', { style: { gap: '6px' } }, h('div.gitem', { onclick: () => editImageModal(im) }, h('img', { src: Store.imgURL(im), alt: '' }), h('div.cap', im.title || '')),
        btn('Manter esta', async () => { await mergeDuplicates(im, g.filter(x => x !== im)); render(); }, { small: true }))))));
      return;
    }
    const list = filtered();
    if (!list.length) { grid.appendChild(emptyState('Nada encontrado', 'Ajuste a busca ou os filtros.', null, 'search')); return; }
    const g = h('div.gallery', { style: { gridTemplateColumns: 'repeat(auto-fill, minmax(' + ({ s: 110, m: 150, l: 220 })[libState.size] + 'px, 1fr))' } }, list.map((im, i) => card(im, i, list)));
    grid.append(g, h('p.meta', { style: { marginTop: '10px' } }, list.length + ' de ' + all.length + ' imagens · ' + U.fmtBytes(all.reduce((s, i) => s + (i.size || 0), 0)) + ' em arquivos originais.'));
  }
  async function mergeDuplicates(keep, others) {
    for (const o of others) {
      for (const l of o.links || []) if (!keep.links.some(x => x.entityId === l.entityId)) keep.links.push(l);
      for (const e of Store.S.ents.values()) {
        let ch = false;
        if (e.mainImageId === o.id) { e.mainImageId = keep.id; ch = true; }
        if (e.kind === 'moodboard') { for (const it of e.items || []) if (it.imageId === o.id) { it.imageId = keep.id; ch = true; } if (e.fields.coverImageId === o.id) { e.fields.coverImageId = keep.id; ch = true; } }
        if (e.kind === 'refcollection' && (e.imageIds || []).includes(o.id)) { e.imageIds = U.uniq(e.imageIds.map(x => x === o.id ? keep.id : x)); ch = true; }
        if (ch) Store.saveEntity(e, { silent: true });
      }
      keep.tags = U.uniq([...(keep.tags || []), ...(o.tags || [])]);
      Store.deleteImageRecord(o.id);
    }
    Store.saveImage(keep); await Store.flush();
    Toast.ok(U.plural(others.length, 'cópia removida', 'cópias removidas') + '; todos os usos apontam para a imagem mantida.');
  }
  const cats = Images.allCategories();
  const tags = U.uniq(imgs().flatMap(i => i.tags || [])).filter(id => Store.S.tags.has(id));
  const ents = U.uniq(imgs().flatMap(i => i.links.map(l => l.entityId))).map(Store.get).filter(Boolean).concat(Boards.list()).sort(U.byName);
  const sel = (label, key, opts) => h('select.input', { 'aria-label': label, onchange: e => { libState[key] = e.target.value; render(); } }, opts.map(([v, l]) => h('option', { value: v, selected: libState[key] === v }, l)));
  body.append(
    h('div.toolbar', searchInput(libState.q, v => { libState.q = v; render(); }, 'Buscar por nome, origem, tag ou ficha'),
      sel('Mostrar', 'filter', [['all', 'Todas'], ['unused', 'Não utilizadas'], ['used', 'Em uso'], ['remote', 'Links externos'], ['dups', 'Possíveis duplicadas']]),
      sel('Categoria', 'cat', [['', 'Qualquer categoria'], ...cats.map(c => [c, c])]),
      sel('Elemento associado', 'entity', [['', 'Qualquer elemento'], ...ents.map(e => [e.id, e.name + ' (' + Schema.kindLabel(e.kind).toLowerCase() + ')'])]),
      sel('Tipo de registro', 'kind', [['', 'Qualquer tipo'], ...Schema.NARRATIVE_KINDS.map(k => [k, Schema.kindLabel(k, true)])]),
      tags.length ? sel('Tag', 'tag', [['', 'Qualquer tag'], ...tags.map(id => [id, Store.tagName(id)])]) : null,
      h('span.spacer'),
      segmented([{ value: 's', label: 'P', title: 'Miniaturas pequenas' }, { value: 'm', label: 'M', title: 'Miniaturas médias' }, { value: 'l', label: 'G', title: 'Miniaturas grandes' }], libState.size, v => { libState.size = v; render(); }, { label: 'Tamanho das miniaturas' }),
      btn('Por endereço web', () => Images.urlModal(() => render()), { ic: 'globe' })),
    bulk, h('div', { style: { height: '10px' } }), grid);
  const page = body.closest('.page') || body;
  page.addEventListener('dragover', e => { if (e.dataTransfer.types.includes('Files')) e.preventDefault(); });
  page.addEventListener('drop', async e => { const f = [...e.dataTransfer.files]; if (f.length) { e.preventDefault(); await Images.importFiles(f); render(); } });
  App.pasteHandler = async e => { const f = Images.imagesFromClipboard(e); if (f.length) { e.preventDefault(); await Images.importFiles(f); render(); } };
  render();
}

function collectionsView(body) {
  const render = () => {
    clear(body);
    const cols = Store.list('refcollection').sort((a, b) => b.updatedAt - a.updatedAt);
    body.appendChild(h('div.toolbar', btn('Nova coleção', async () => { const n = await Modal.prompt('Nova coleção', 'Nome', '', { placeholder: 'Ex.: Armaduras de referência' }); if (n) { Store.newEntity('refcollection', { name: n, fields: { description: '', linkedIds: [] }, imageIds: [] }); await Store.flush(); render(); } }, { kind: 'primary', ic: 'plus' }),
      h('span.meta', 'Coleções agrupam imagens da biblioteca sem copiá-las. Para compor visualmente, use um moodboard.')));
    if (!cols.length) { body.appendChild(emptyState('Nenhuma coleção', 'Crie uma coleção aqui ou selecione imagens na biblioteca e use "Adicionar a coleção".', null, 'images')); return; }
    for (const c of cols) {
      const imgs = (c.imageIds || []).map(id => Store.S.imgs.get(id)).filter(Boolean);
      body.appendChild(h('div.panel',
        h('div.panel-title', icon('images'), h('input.input.sm', { value: c.name, style: { maxWidth: '320px', fontWeight: 600 }, 'aria-label': 'Nome da coleção', oninput: e => { c.name = e.target.value; Store.saveEntity(c, { silent: true }); } }),
          c.legacy ? h('span.pill.warn', { title: 'Criada pela antiga pesquisa automática' }, 'pesquisa antiga') : null, h('span.spacer'), h('span.meta', U.plural(imgs.length, 'imagem', 'imagens')),
          btn('', e => Menu.open(e.currentTarget, [
            { label: 'Adicionar imagens da biblioteca', ic: 'library', onClick: () => pickImages({ exclude: c.imageIds, onPick: ids => { c.imageIds = U.uniq([...c.imageIds, ...ids]); Store.saveEntity(c); render(); } }) },
            { label: 'Criar moodboard com estas imagens', ic: 'moodboard', disabled: !imgs.some(i => !Images.isRemoteOnly(i)), onClick: () => Boards.create({ name: c.name, imageIds: imgs.filter(i => !Images.isRemoteOnly(i)).map(i => i.id), linkedIds: c.fields.linkedIds || [] }) },
            imgs.some(Images.isRemoteOnly) ? { label: 'Baixar links externos para o projeto', ic: 'download', onClick: async () => { let ok = 0; for (const im of imgs.filter(Images.isRemoteOnly)) { const r = await Images.fetchURL(im.remoteUrl || im.remoteThumb); if (r.blob) { const f = await Images.fromBlob(r.blob, {}); Object.assign(im, { blob: f.blob, thumb: f.thumb, preview: f.preview, mime: f.mime, size: f.size, width: f.width, height: f.height, hash: f.hash }); Store.saveImage(im); ok++; } } await Store.flush(); Toast.info(ok + ' de ' + imgs.filter(i => !i.blob).length + ' imagens baixadas. As demais continuam como link externo.'); render(); } } : null,
            { sep: true },
            { label: 'Excluir coleção', ic: 'trash', danger: true, onClick: async () => { if (await Modal.confirm('Excluir coleção', 'Excluir "' + c.name + '"? As imagens continuam na biblioteca.', { danger: true, okLabel: 'Excluir' })) { Store.deleteEntity(c.id); await Store.flush(); render(); } } },
          ], { align: 'end' }), { ic: 'more', small: true, title: 'Ações da coleção' })),
        h('div.form-grid', { style: { marginBottom: '10px' } },
          h('label.field', h('span.lbl', 'Descrição'), h('input.input.sm', { value: c.fields.description || '', oninput: e => { c.fields.description = e.target.value; Store.saveEntity(c, { silent: true }); } })),
          h('div.field', h('span.lbl', 'Elementos associados'), refPicker({ kinds: Schema.NARRATIVE_KINDS, multi: true, value: c.fields.linkedIds || [], allowCreate: false, onChange: v => { c.fields.linkedIds = v; Store.saveEntity(c, { silent: true }); } }))),
        imgs.length ? h('div.gallery', { style: { gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))' } }, imgs.map((im, i) => h('div.gitem', { onclick: e => { if (!e.target.closest('.tools')) Lightbox.fromImages(imgs, i); } }, h('img', { src: Store.imgURL(im), alt: '', loading: 'lazy', referrerpolicy: 'no-referrer' }), Images.isRemoteOnly(im) ? h('span.badge.warn', 'link') : null,
          h('div.tools', h('button', { type: 'button', title: 'Tirar da coleção', 'aria-label': 'Tirar da coleção', onclick: () => { c.imageIds = c.imageIds.filter(x => x !== im.id); Store.saveEntity(c); render(); } }, icon('x', 13)))))) : h('p.meta', 'Coleção vazia.')));
    }
  };
  render();
}

function lackingView(body) {
  const p = Store.S.p; const minRefs = p.config.minRefs || 3;
  const count = e => Store.imagesOf(e.id).length + Boards.forEntity(e.id).reduce((s, b) => s + Boards.imageIds(b).length, 0);
  const rows = [...Store.list('character'), ...Store.list('location'), ...Store.list('storyline')].map(e => ({ e, n: count(e) })).sort((a, b) => a.n - b.n || U.byName(a.e, b.e));
  const lacking = rows.filter(r => r.n < minRefs);
  body.append(h('div.toolbar', h('label.row.small', 'Mínimo de referências por registro:', h('input.input', { type: 'number', min: 1, value: minRefs, style: { width: '72px' }, 'aria-label': 'Mínimo de referências', onchange: e => { p.config.minRefs = Math.max(1, Number(e.target.value) || 3); Store.saveProject(); App.refresh(); } })), h('span.meta', 'Conta as imagens associadas à ficha e as dos moodboards ligados a ela.')),
    lacking.length ? h('div.table-wrap', h('table.table', h('thead', h('tr', h('th', 'Registro'), h('th', 'Tipo'), h('th', 'Imagens'), h('th', ''))),
      h('tbody', lacking.map(({ e, n }) => h('tr', h('td', entityLink(e.id)), h('td.muted', Schema.kindLabel(e.kind)), h('td', h('span.pill' + (n === 0 ? '.err' : '.warn'), n + ' / ' + minRefs)),
        h('td', h('div.row', btn('Abrir referências', () => Nav.entity(e.id, 'referencias'), { small: true, ic: 'image' }), btn('Novo moodboard', () => Boards.createFor(e), { small: true, ic: 'moodboard' })))))))) : emptyState('Tudo coberto', 'Todos os personagens, localidades e storylines têm pelo menos ' + minRefs + ' referências.', null, 'check'));
}

/* Biblioteca global: imagens de todos os projetos, só para consulta e navegação. */
Views.globalLibrary = async function (main) {
  const page = h('div.page'); main.appendChild(page);
  page.append(pageHead('Biblioteca de referências', 'Imagens de todos os projetos. Cada projeto mantém a sua própria biblioteca; abra um projeto para editar, associar ou montar moodboards.'));
  const projects = (await Store.listProjects()).filter(p => !p.archived);
  const urls = [];
  let q = '', pf = '';
  const box = h('div');
  const all = [];
  for (const p of projects) for (const im of await DB.byProject('images', p.id)) if (im.role !== 'cover') all.push({ im, p });
  const url = im => { const b = im.thumb || im.preview || im.blob; if (b instanceof Blob) { const u = URL.createObjectURL(b); urls.push(u); return u; } return im.remoteThumb || im.remoteUrl; };
  const cache = new Map(); const src = im => cache.get(im.id) || (cache.set(im.id, url(im)), cache.get(im.id));
  App.onLeave(() => urls.forEach(u => URL.revokeObjectURL(u)));
  const render = () => {
    clear(box);
    const nq = U.norm(q);
    const list = all.filter(x => (!pf || x.p.id === pf) && (!nq || U.norm([x.im.title, x.im.category, x.im.description, x.p.name].join(' ')).includes(nq)));
    if (!all.length) { box.appendChild(emptyState('Nenhuma imagem ainda', 'Abra um projeto e importe imagens em Moodboards e referências.', btn('Ver projetos', () => Nav.go('/projects'), { kind: 'primary' }), 'library')); return; }
    if (!list.length) { box.appendChild(emptyState('Nada encontrado', 'Ajuste a busca.', null, 'search')); return; }
    const byP = {}; list.forEach(x => (byP[x.p.id] = byP[x.p.id] || { p: x.p, items: [] }).items.push(x.im));
    for (const { p, items } of Object.values(byP)) {
      box.appendChild(h('div', { style: { marginBottom: '22px' } }, h('div.panel-title', icon('folder'), h('h3', p.name), h('span.meta', U.plural(items.length, 'imagem', 'imagens')), btn('Abrir biblioteca do projeto', () => Nav.go('/p/' + p.id + '/refs/library'), { small: true })),
        h('div.gallery', { style: { gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))' } }, items.slice(0, 60).map((im, i) => h('div.gitem', { title: im.title || '', onclick: () => Lightbox.open(items.map(x => ({ full: src(x), title: x.title, description: x.description, source: x.source, sourceUrl: x.sourceUrl })), i) }, h('img', { src: src(im), alt: '', loading: 'lazy', referrerpolicy: 'no-referrer' }), im.title ? h('div.cap', im.title) : null))),
        items.length > 60 ? h('p.meta', { style: { marginTop: '6px' } }, '+' + (items.length - 60) + ' na biblioteca do projeto.') : null));
    }
  };
  page.append(h('div.toolbar', searchInput('', v => { q = v; render(); }, 'Buscar imagens'), projects.length > 1 ? h('select.input', { 'aria-label': 'Projeto', onchange: e => { pf = e.target.value; render(); } }, h('option', { value: '' }, 'Todos os projetos'), projects.map(p => h('option', { value: p.id }, p.name))) : null), box);
  render();
};

/* ---------- anotações do universo ---------- */
const notesState = { cat: '' };
Views.notes = function (main) {
  const page = h('div.page'); main.appendChild(page);
  const cats = Store.listValues('loreCategories');
  const all = Store.list('lore');
  const count = c => all.filter(n => (n.fields.category || '') === c).length;
  const list = all.filter(n => !notesState.cat || (notesState.cat === '__none' ? !n.fields.category : n.fields.category === notesState.cat)).sort(U.byName);
  page.append(pageHead('Anotações do universo', 'Regras do mundo, sistemas de magia, culturas, vocabulário, continuidade e o que mais a obra precisar. As categorias são editáveis.',
    btn('Nova categoria', async () => { const v = await Modal.prompt('Nova categoria', 'Nome'); if (v) { Store.addListValue('loreCategories', v); App.refresh(); } }, { ic: 'plus' }),
    btn('Nova anotação', () => quickCreate('lore', '', { fields: { category: notesState.cat && notesState.cat !== '__none' ? notesState.cat : '' } }), { kind: 'primary', ic: 'plus' })),
    h('div.row', { style: { alignItems: 'flex-start', gap: '16px' } },
      h('div.col', { style: { width: '230px', flex: 'none', gap: '2px' } },
        h('button.navlink' + (!notesState.cat ? '.active' : ''), { onclick: () => { notesState.cat = ''; App.refresh(); } }, 'Todas', h('span.count', String(all.length))),
        cats.map(c => h('button.navlink' + (notesState.cat === c ? '.active' : ''), { onclick: () => { notesState.cat = c; App.refresh(); } }, h('span', { style: { overflow: 'hidden', textOverflow: 'ellipsis' } }, c), h('span.count', String(count(c) || '')))),
        all.some(n => !n.fields.category) ? h('button.navlink' + (notesState.cat === '__none' ? '.active' : ''), { onclick: () => { notesState.cat = '__none'; App.refresh(); } }, 'Sem categoria', h('span.count', String(count('')))) : null),
      h('div.grow', list.length ? h('div.linklist', list.map(n => h('div.linkrow', { style: { alignItems: 'flex-start', cursor: 'pointer' }, onclick: () => Nav.entity(n.id) },
        icon('note'), h('div.grow', h('b', n.name), h('div.small.muted', n.fields.category || 'Sem categoria'), n.fields.content ? h('div.small', n.fields.content.slice(0, 240)) : null), tagChips(n.tags)))) :
        emptyState('Nada aqui ainda', notesState.cat ? 'Nenhuma anotação em "' + notesState.cat + '".' : 'Comece pelas regras do mundo ou por uma ideia solta.'))));
};
