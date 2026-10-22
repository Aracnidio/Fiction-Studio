/* Fiction Studio — visão geral do projeto, listas de registros e pesquisa global. */
'use strict';

function entSummary(e) {
  const f = e.fields || {};
  return f.summary || f.description || f.content || f.synopsis || f.effect || '';
}
function entStatus(e) { const f = e.fields || {}; return f.status || f.locType || f.slType || f.evType || f.orgType || f.category || ''; }

Views.overview = function (main) {
  const p = Store.S.p;
  const page = h('div.page'); main.appendChild(page);
  const count = k => Store.list(k).length;
  const kinds = ['character', 'location', 'storyline', 'event'].concat(p.config.modules.organizations ? ['organization'] : []);
  const recent = [...Store.S.ents.values()].filter(e => e.kind !== 'refcollection').sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 8);
  const minRefs = p.config.minRefs || 3;
  const lacking = [...Store.list('character'), ...Store.list('location')].filter(e => Store.imagesOf(e.id).length + Boards.forEntity(e.id).reduce((s, b) => s + Boards.imageIds(b).length, 0) < minRefs);
  const problems = Store.integrityScan();
  const demo = [...Store.S.ents.values()].filter(e => e.demo).length;
  const boards = Boards.list().sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 3);
  const cover = h('div.ent-portrait', { style: { width: '168px', height: '104px' }, role: 'button', tabindex: 0, title: 'Alterar capa', 'aria-label': 'Alterar capa do projeto' }, icon('image', 28));
  if (p.coverImageId && Store.S.imgs.get(p.coverImageId)) { clear(cover); cover.appendChild(h('img', { src: Store.imgURL(Store.S.imgs.get(p.coverImageId), 'preview'), alt: 'Capa' })); }
  cover.addEventListener('click', async () => { const f = await U.pickFile({ accept: 'image/*' }); if (f[0]) { await setProjectCover(p, f[0]); Store.saveProject(); await Store.flush(); Toast.ok('Capa atualizada.'); App.route(); } });
  const stat = (label, n, ic, kind, go) => h('div.stat', { style: kind ? { '--k': kc(kind) } : null, tabindex: 0, role: 'link', onclick: go, onkeydown: e => { if (e.key === 'Enter') go(); } }, h('b', n), h('span', icon(ic, 13), label));
  page.append(
    h('div.ent-head', cover,
      h('div.ent-title', h('div.eyebrow', p.workType), h('h1', p.name), p.altTitle ? h('div.muted', p.altTitle) : null, tagChips(p.tags)),
      h('div.ent-actions', btn('Editar projeto', () => projectForm(p), { ic: 'edit' }), btn('', async () => { const n = await IO.exportProject(p.id); Toast.ok('Projeto exportado (' + U.fmtBytes(n) + ').'); }, { ic: 'download', title: 'Exportar projeto' }))),
    demo ? h('div.notice.info', { style: { marginBottom: '16px' } }, 'Este projeto contém ' + demo + ' registros de exemplo (tag "Exemplo"). ', h('a', { href: '#/p/' + p.id + '/settings/integrity' }, 'Remover exemplos')) : null,
    h('div.stat-row', kinds.map(k => stat(Schema.kindLabel(k, true), count(k), Schema.KINDS[k].icon, k, () => Nav.section(KIND_SECTION[k]))),
      stat('Relações', Store.S.rels.size, 'graph', null, () => Nav.section('graph')),
      stat('Moodboards', count('moodboard'), 'moodboard', 'moodboard', () => Nav.section('refs')),
      stat('Imagens', [...Store.S.imgs.values()].filter(i => i.role !== 'cover').length, 'image', null, () => Nav.section('refs/library'))),
    h('div.ov', { style: { marginTop: '18px' } },
      h('div.ov-main', { style: { gap: '14px' } },
        h('section.panel', h('div.panel-title', h('h3', 'Sobre a obra')),
          p.description || p.synopsis ? [p.description ? h('p', p.description) : null, p.synopsis ? [h('div.lbl', { style: { marginTop: '8px' } }, 'Sinopse'), h('p', { style: { whiteSpace: 'pre-wrap', maxWidth: '75ch' } }, p.synopsis)] : null] : h('p.muted.small', 'Sem descrição. Use "Editar projeto" para escrever a descrição e a sinopse.')),
        h('section.panel', h('div.panel-title', h('h3', 'Moodboards recentes'), btn('Novo moodboard', () => Boards.create(), { small: true, ic: 'plus' })),
          boards.length ? h('div.mbcards', boards.map(b => Boards.card(b))) : h('p.meta', 'Nenhum moodboard ainda. Monte painéis com imagens, notas, paletas e cartões do seu universo.')),
        h('section.panel', h('div.panel-title', h('h3', 'Alterados recentemente')),
          recent.length ? h('div.mini-list', recent.map(e => miniRow(e.id, U.fmtDate(e.updatedAt), 'muted'))) : h('p.meta', 'Nada ainda. Use o botão Criar ou a tecla N.'))),
      h('div.ov-side',
        h('section.panel', { style: { padding: '14px' } }, h('div.ov-block-head', h('h4', 'Precisam de referências visuais'), h('a.small', { href: '#/p/' + p.id + '/refs/lacking' }, 'ver todos')),
          lacking.length ? h('div.mini-list', lacking.slice(0, 8).map(e => miniRow(e.id, (Store.imagesOf(e.id).length) + '/' + minRefs))) : h('p.meta', 'Todos têm pelo menos ' + minRefs + ' referências.')),
        h('section.panel', { style: { padding: '14px' } }, h('div.ov-block-head', h('h4', 'Integridade')),
          problems.length ? h('div.col', h('p.small', h('span.pill.warn', String(problems.length)), ' vínculo(s) quebrado(s).'), btn('Revisar', () => Nav.section('settings/integrity'), { small: true })) : h('p.meta', h('span.pill.ok', icon('check', 12), 'ok'), ' Nenhum vínculo quebrado.'),
          p.integrityLog.length ? h('p.meta', { style: { marginTop: '6px' } }, p.integrityLog.length + ' alteração(ões) automática(s) registradas após exclusões.') : null),
        h('section.panel', { style: { padding: '14px' } }, h('div.ov-block-head', h('h4', 'Criar rapidamente')),
          h('div.col', { style: { gap: '4px' } }, kinds.map(k => h('button.navlink', { type: 'button', onclick: () => quickCreate(k) }, kindIcon(k), h('span', 'Novo(a) ' + Schema.kindLabel(k).toLowerCase()))),
            h('button.navlink', { type: 'button', onclick: () => Boards.create() }, kindIcon('moodboard'), h('span', 'Novo moodboard')),
            h('button.navlink', { type: 'button', onclick: () => quickCreate('lore') }, kindIcon('lore'), h('span', 'Nova nota'))),
          h('p.meta', { style: { marginTop: '8px' } }, 'Dica: a tecla ', h('span.kbd', 'N'), ' abre o menu de criação em qualquer tela.')))));
};

/* ---------- listas ---------- */
const listState = {};
Views.list = function (main, kind) {
  const K = Schema.KINDS[kind];
  const st = listState[kind] = listState[kind] || { q: '', tag: '', status: '', sort: 'name', view: (Store.ui().listViews || {})[kind] || (kind === 'event' ? 'table' : 'cards') };
  const page = h('div.page'); main.appendChild(page);
  const statusKey = Schema.allFields(kind).find(f => f.key === 'status' || f.key === 'locType' || f.key === 'slType' || f.key === 'category' || f.key === 'evType' || f.key === 'orgType');
  const body = h('div');
  const q = searchInput(st.q, v => { st.q = v; render(); }, 'Buscar em ' + K.plural.toLowerCase());
  const usedTags = U.uniq(Store.list(kind).flatMap(e => e.tags || [])).filter(id => Store.S.tags.has(id));
  function render() {
    clear(body);
    let items = Store.list(kind);
    const nq = U.norm(st.q);
    if (nq) items = items.filter(e => U.norm(e.name + ' ' + Object.values(e.fields || {}).filter(v => typeof v === 'string').join(' ') + ' ' + (e.custom || []).map(c => c.label + ' ' + c.value).join(' ')).includes(nq));
    if (st.tag) items = items.filter(e => (e.tags || []).includes(st.tag));
    if (st.status && statusKey) items = items.filter(e => e.fields[statusKey.key] === st.status);
    const sorters = {
      name: U.byName, updated: (a, b) => b.updatedAt - a.updatedAt, created: (a, b) => b.createdAt - a.createdAt,
      status: (a, b) => String(entStatus(a)).localeCompare(String(entStatus(b))) || U.byName(a, b),
      chrono: (a, b) => (a.fields.chronoOrder ?? 1e9) - (b.fields.chronoOrder ?? 1e9),
      narrative: (a, b) => (a.fields.narrativeOrder ?? 1e9) - (b.fields.narrativeOrder ?? 1e9),
      images: (a, b) => Store.imagesOf(a.id).length - Store.imagesOf(b.id).length,
    };
    items.sort(sorters[st.sort] || U.byName);
    if (!Store.list(kind).length) { body.appendChild(emptyState('Nenhum(a) ' + K.label.toLowerCase() + ' ainda', 'Cadastre o essencial agora — só o nome já basta — e complete os detalhes quando quiser.', btn('Criar ' + K.label.toLowerCase(), () => quickCreate(kind), { kind: 'primary', ic: 'plus' }), K.icon)); return; }
    if (!items.length) { body.appendChild(emptyState('Nada encontrado', 'Ajuste a busca ou os filtros.', null, 'search')); return; }
    if (st.view === 'table') {
      body.appendChild(h('div.table-wrap', h('table.table', h('thead', h('tr', h('th', 'Nome'), statusKey ? h('th', statusKey.label) : null, kind === 'event' ? [h('th', 'Cronologia'), h('th', 'Apresentação')] : null, h('th', 'Tags'), h('th', 'Imagens'), h('th', 'Modificado'))),
        h('tbody', items.map(e => h('tr.click', { onclick: () => Nav.entity(e.id) }, h('td', h('b', e.name), entSummary(e) ? h('div.muted.small', entSummary(e).slice(0, 110)) : null),
          statusKey ? h('td', statusPill(e.fields[statusKey.key])) : null,
          kind === 'event' ? [h('td.num.small', [e.fields.chronoLabel, e.fields.chronoOrder != null ? '#' + e.fields.chronoOrder : ''].filter(Boolean).join(' · ')), h('td.num.small', e.fields.narrativeOrder != null ? '#' + e.fields.narrativeOrder : '—')] : null,
          h('td', tagChips(e.tags)), h('td.num', Store.imagesOf(e.id).length), h('td.small.muted', U.fmtDate(e.updatedAt))))))));
    } else {
      body.appendChild(h('div.ecards', items.map(e => {
        const im = Store.mainImage(e);
        return h('div.ecard', { tabindex: 0, role: 'link', style: { '--k': kc(kind) }, onclick: () => Nav.entity(e.id), onkeydown: ev => { if (ev.key === 'Enter') Nav.entity(e.id); } },
          h('div.thumb', im ? h('img', { src: Store.imgURL(im), alt: '', loading: 'lazy' }) : (e.fields.iconText ? h('span', { style: { fontSize: '22px' } }, e.fields.iconText) : icon(K.icon, 22))),
          h('div.grow', h('div.t', e.name), h('div.row', { style: { gap: '4px', margin: '2px 0' } }, statusKey && e.fields[statusKey.key] ? statusPill(e.fields[statusKey.key]) : null, e.demo ? h('span.pill', 'exemplo') : null),
            entSummary(e) ? h('div.s', entSummary(e)) : null, (e.tags || []).length ? h('div', { style: { marginTop: '5px' } }, tagChips(e.tags.slice(0, 3))) : null));
      })));
    }
    body.appendChild(h('p.muted.small', { style: { marginTop: '10px' } }, U.plural(items.length, 'registro', 'registros') + ' exibidos de ' + Store.list(kind).length + '.'));
  }
  const sortOpts = [['name', 'Nome'], ['updated', 'Modificação'], ['created', 'Criação'], ['status', statusKey ? statusKey.label : 'Status'], ['images', 'Menos imagens']].concat(kind === 'event' ? [['chrono', 'Cronologia'], ['narrative', 'Ordem de apresentação']] : []);
  page.append(
    pageHead(K.plural, null,
      kind === 'event' ? btn('Linha do tempo', () => Nav.section('timeline'), { ic: 'clock' }) : null,
      btn('Novo(a) ' + K.label.toLowerCase(), () => quickCreate(kind), { kind: 'primary', ic: 'plus' })),
    h('div.toolbar', q,
      usedTags.length ? h('select.input', { 'aria-label': 'Filtrar por tag', onchange: e => { st.tag = e.target.value; render(); } }, h('option', { value: '' }, 'Todas as tags'), usedTags.map(id => h('option', { value: id, selected: st.tag === id }, Store.tagName(id)))) : null,
      statusKey ? h('select.input', { 'aria-label': 'Filtrar por ' + statusKey.label, onchange: e => { st.status = e.target.value; render(); } }, h('option', { value: '' }, statusKey.label + ': todos'), U.uniq(Store.list(kind).map(e => e.fields[statusKey.key]).filter(Boolean)).map(v => h('option', { value: v, selected: st.status === v }, v))) : null,
      h('select.input', { 'aria-label': 'Ordenar', onchange: e => { st.sort = e.target.value; render(); } }, sortOpts.map(([v, l]) => h('option', { value: v, selected: st.sort === v }, 'Ordenar: ' + l))),
      h('span.spacer'),
      segmented([{ value: 'cards', label: 'Cartões', ic: 'moodboard' }, { value: 'table', label: 'Tabela', ic: 'menu' }], st.view, v => { st.view = v; const u = Store.ui(); u.listViews = u.listViews || {}; u.listViews[kind] = v; Store.saveSettings(); render(); }, { label: 'Visualização' })),
    body);
  render();
};

/* ---------- pesquisa global ---------- */
const searchState = { q: '', kinds: [], tag: '', status: '' };
Views.search = function (main, initial) {
  if (initial != null) searchState.q = initial;
  const page = h('div.page'); main.appendChild(page);
  const q = h('input.input', { value: searchState.q, placeholder: 'Nome, descrição, campo personalizado, tag, anotação…', 'aria-label': 'Pesquisar', style: { maxWidth: '420px' } });
  const res = h('div');
  const kinds = Object.keys(Schema.KINDS).filter(k => k !== 'refcollection');
  const kindBox = h('div.chips');
  function renderKinds() { clear(kindBox); kinds.filter(k => Store.list(k).length).forEach(k => kindBox.appendChild(h('span.chip.click' + (searchState.kinds.includes(k) ? '.on' : ''), { onclick: () => { searchState.kinds = searchState.kinds.includes(k) ? searchState.kinds.filter(x => x !== k) : [...searchState.kinds, k]; renderKinds(); run(); } }, kindDot(k), Schema.kindLabel(k, true)))); }
  function snippet(text, nq) {
    const n = U.norm(text); const i = n.indexOf(nq); if (i < 0) return null;
    const a = Math.max(0, i - 40), b = Math.min(text.length, i + nq.length + 60);
    return h('span.search-hit', (a ? '…' : '') + text.slice(a, i), h('mark', text.slice(i, i + nq.length)), text.slice(i + nq.length, b) + (b < text.length ? '…' : ''));
  }
  function run() {
    clear(res);
    const nq = U.norm(searchState.q);
    if (!nq && !searchState.tag) { res.appendChild(h('p.muted', 'Digite um termo ou escolha uma tag.')); return; }
    const hits = [];
    for (const e of Store.S.ents.values()) {
      if (e.kind === 'refcollection') continue;
      if (searchState.kinds.length && !searchState.kinds.includes(e.kind)) continue;
      if (searchState.tag && !(e.tags || []).includes(searchState.tag)) continue;
      if (searchState.status && entStatus(e) !== searchState.status) continue;
      const where = [];
      if (!nq) { hits.push({ e, where: [] }); continue; }
      if (U.norm(e.name).includes(nq)) where.push({ label: 'Nome', s: null });
      const fl = Object.fromEntries(Schema.allFields(e.kind).map(f => [f.key, f.label]));
      for (const [k, v] of Object.entries(e.fields || {})) if (typeof v === 'string' && U.norm(v).includes(nq)) where.push({ label: fl[k] || k, s: snippet(v, nq) });
      for (const c of e.custom || []) if (U.norm(c.label + ' ' + c.value).includes(nq)) where.push({ label: 'Campo personalizado: ' + c.label, s: snippet(String(c.value || c.label), nq) });
      for (const t of e.tags || []) if (U.norm(Store.tagName(t) || '').includes(nq)) where.push({ label: 'Tag', s: h('span', Store.tagName(t)) });
      for (const st of e.steps || []) if (U.norm(st.title + ' ' + st.description).includes(nq)) where.push({ label: 'Etapa: ' + st.title, s: snippet(st.description || st.title, nq) });
      for (const n of e.nodes || []) if (U.norm((n.label || '') + ' ' + (n.description || '')).includes(nq)) where.push({ label: 'Nó: ' + n.label, s: null });
      for (const it of e.items || []) if (it.text && U.norm(it.text).includes(nq)) where.push({ label: 'Texto no moodboard', s: snippet(it.text, nq) });
      if (where.length) hits.push({ e, where, score: (U.norm(e.name) === nq ? 100 : 0) + (U.norm(e.name).includes(nq) ? 10 : 0) + where.length });
    }
    for (const r of Store.S.rels.values()) {
      if (!nq || searchState.kinds.length) continue;
      if (U.norm([r.description, r.history, r.notes, r.state].join(' ')).includes(nq)) { const a = Store.get(r.fromId); if (a) hits.push({ e: a, where: [{ label: 'Relação: ' + Store.relLabel(r, r.toId) + ' ' + ((Store.get(r.toId) || {}).name || ''), s: snippet([r.description, r.history, r.notes, r.state].join(' '), nq) }], score: 1 }); }
    }
    hits.sort((a, b) => (b.score || 0) - (a.score || 0));
    res.appendChild(h('p.muted.small', U.plural(hits.length, 'resultado', 'resultados')));
    res.appendChild(h('div.linklist', hits.slice(0, 300).map(({ e, where }) => h('div.linkrow', { style: { alignItems: 'flex-start' } },
      h('div.grow', h('div.row', entityLink(e.id), h('span.muted.small', Schema.kindLabel(e.kind)), statusPill(entStatus(e))),
        where.slice(0, 3).map(w => h('div.small', h('span.muted', w.label + (w.s ? ': ' : '')), w.s)))))));
  }
  q.addEventListener('input', U.debounce(() => { searchState.q = q.value; run(); }, 150));
  const allTags = U.uniq([...Store.S.ents.values()].flatMap(e => e.tags || [])).filter(id => Store.S.tags.has(id));
  const statuses = U.uniq([...Store.S.ents.values()].map(entStatus).filter(Boolean)).sort();
  page.append(pageHead('Pesquisa', 'Procura em todos os registros deste projeto, incluindo campos personalizados, etapas de storylines, nós de árvores e relações.'),
    h('div.toolbar', q,
      h('select.input', { 'aria-label': 'Tag', onchange: e => { searchState.tag = e.target.value; run(); } }, h('option', { value: '' }, 'Qualquer tag'), allTags.map(id => h('option', { value: id, selected: searchState.tag === id }, Store.tagName(id)))),
      h('select.input', { 'aria-label': 'Status ou tipo', onchange: e => { searchState.status = e.target.value; run(); } }, h('option', { value: '' }, 'Qualquer status/tipo'), statuses.map(v => h('option', { value: v, selected: searchState.status === v }, v)))),
    kindBox, h('div', { style: { height: '12px' } }), res);
  renderKinds(); run(); setTimeout(() => q.focus(), 20);
};
