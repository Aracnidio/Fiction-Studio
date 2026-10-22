/* Fiction Studio — fichas: área de identidade, navegação interna por abas e área de conteúdo.
   Todas as categorias seguem a mesma lógica; cada uma tem suas abas próprias.
   Modo "Resumida" mostra só o que está preenchido, para leitura; "Detalhada" mostra todos os campos editáveis. */
'use strict';

const entityTabState = {};
const TAB_ALIASES = { galeria: 'referencias', ficha: 'overview', conexoes: 'notas', combate: 'combate' };
const detailMode = () => (Store.ui().detail === 'summary' ? 'summary' : 'detailed');

Views.entity = function (main, id, tab) {
  const e = Store.get(id);
  if (!e) { main.appendChild(h('div.page', emptyState('Registro não encontrado', 'Ele pode ter sido excluído.', btn('Voltar à visão geral', () => Nav.section(''), { kind: 'primary' }), 'alert'))); return; }
  if (e.kind === 'refcollection') { Nav.go('/p/' + Store.S.p.id + '/refs/collections'); return; }
  if (e.kind === 'skilltree') { Views.skillTree(main, e, tab); return; }
  if (e.kind === 'moodboard') { Views.moodboard(main, e); return; }
  tab = TAB_ALIASES[tab] || tab;
  const tabs = entityTabs(e);
  // a última aba vista de cada ficha é lembrada durante a sessão
  if (!tab || !tabs.find(t => t.id === tab)) tab = entityTabState[e.id] && tabs.find(t => t.id === entityTabState[e.id]) ? entityTabState[e.id] : tabs[0].id;
  entityTabState[e.id] = tab;
  const page = h('div.page'); main.appendChild(page);
  const head = h('div'); const tabBar = h('div.tabs', { role: 'tablist', 'aria-label': 'Seções da ficha' }); const body = h('div', { role: 'tabpanel' });
  page.append(head, tabBar, body);
  const renderHead = () => { clear(head); head.appendChild(entityHeader(e, () => { clear(body); body.appendChild(tabs.find(x => x.id === tab).render()); })); };
  App._headerRenderer = renderHead;
  renderHead();
  for (const t of tabs) {
    tabBar.appendChild(h('button.tab' + (t.id === tab ? '.active' : ''), { role: 'tab', 'aria-selected': String(t.id === tab), onclick: () => Nav.entity(e.id, t.id) }, t.ic ? icon(t.ic, 14) : null, t.label, t.count ? h('span.count', String(t.count)) : null));
  }
  body.appendChild(tabs.find(x => x.id === tab).render());
};

function entityTabs(e) {
  const p = Store.S.p; const K = e.kind; const mech = p.mechanics.enabled;
  const T = (id, label, render, extra = {}) => ({ id, label, render, ...extra });
  const secTab = (id, ic) => Schema.sections(K, p).some(s => s.tab === id) ? T(id, Schema.TAB_LABELS[id], () => formTab(e, id), { ic }) : null;
  const relCount = Store.relationsOf(e.id).length;
  const evCount = eventsOf(e).length;
  const refCount = Store.imagesOf(e.id).length + Boards.forEntity(e.id).length;
  const overview = T('overview', 'Visão geral', () => overviewTab(e), { ic: 'eye' });
  const refs = T('referencias', 'Referências', () => galleryPanel(e), { ic: 'image', count: refCount });
  const notes = T('notas', 'Notas', () => notesTab(e), { ic: 'note' });
  const rel = (label = 'Relações') => T('relacoes', label, () => relationsTab(e), { count: relCount, ic: K === 'character' ? 'users' : 'link' });
  const ev = T('eventos', 'Eventos', () => eventsTab(e), { count: evCount, ic: 'bolt' });
  let tabs;
  if (K === 'character') tabs = [overview, secTab('aparencia', 'user'), secTab('personalidade', 'heart'), secTab('historia', 'book'), rel('Relacionamentos'), ev,
    mech ? T('combate', 'Combate e habilidades', () => combatTab(e, 'combat'), { ic: 'sword' }) : null,
    mech && p.mechanics.modules.items !== false ? T('equipamentos', 'Equipamentos', () => combatTab(e, 'equipment'), { ic: 'gem' }) : null, refs, notes];
  else if (K === 'location') tabs = [overview, secTab('ambiente', 'sun'), secTab('historico', 'clock'), T('ocupantes', 'Ocupantes', () => locationOccupants(e), { ic: 'users' }), ev, rel(), refs, notes];
  else if (K === 'storyline') tabs = [overview, T('progressao', 'Progressão', () => storylineSteps(e), { count: (e.steps || []).length, ic: 'route' }),
    p.config.modules.branching ? T('ramificacoes', 'Ramificações', () => storylineBranching(e), { count: ((e.branching || {}).nodes || []).length, ic: 'tree' }) : null, ev, rel(), refs, notes];
  else if (K === 'event') tabs = [overview, mech ? T('mecanica', 'Efeitos mecânicos', () => eventMechTab(e), { ic: 'sword' }) : null, refs, notes];
  else if (K === 'organization') tabs = [overview, T('membros', 'Membros', () => orgMembers(e), { ic: 'users' }), rel(), refs, notes];
  else if (Schema.MECH_KINDS.includes(K)) tabs = [overview, T('mecanica', mechTabLabel(K), () => mechEntityTab(e), { ic: 'formula' }), refs, notes];
  else tabs = [overview, notes];
  return tabs.filter(Boolean);
}

/* Linha de contexto sob o nome (função, tipo, estado…) */
function entitySubline(e) {
  const f = e.fields; const bits = [];
  const add = (v, cls) => { if (v) bits.push(cls ? h('span.pill.' + cls, v) : h('span', v)); };
  if (e.kind === 'character') { add(f.storyRole, 'ac'); add(f.occupation); add(f.species); if (f.age) add(f.age + (isNaN(f.age) ? '' : ' anos')); if (f.status && f.status !== 'Vivo') add(f.status, f.status === 'Morto' ? 'err' : ''); }
  else if (e.kind === 'location') { add(f.locType, 'cy'); const pid = f.parentId && Store.get(f.parentId); if (pid) bits.push(h('span', 'em ', entityLink(pid.id))); }
  else if (e.kind === 'storyline') { add(f.slType, 'cy'); if (f.status) bits.push(statusPill(f.status)); }
  else if (e.kind === 'event') { add(f.evType, 'cy'); add(f.chronoLabel); if (f.chapter) add(f.chapter); if (f.status) bits.push(statusPill(f.status)); }
  else if (e.kind === 'organization') { add(f.orgType, 'cy'); }
  else if (Schema.MECH_KINDS.includes(e.kind)) { add(f.category || f.skillType, 'cy'); add(f.rarity, 'gold'); }
  else if (e.kind === 'lore') add(f.category, 'cy');
  return bits.length ? h('div.ent-sub', bits) : null;
}

function entityHeader(e, rerenderBody) {
  const K = Schema.KINDS[e.kind];
  const im = Store.mainImage(e);
  const portrait = h('div.ent-portrait', { style: { '--k': kc(e.kind) }, title: 'Referências visuais', role: 'button', tabindex: 0, 'aria-label': 'Abrir referências visuais', onclick: () => Nav.entity(e.id, 'referencias'), onkeydown: ev => { if (ev.key === 'Enter') Nav.entity(e.id, 'referencias'); } },
    im ? h('img', { src: Store.imgURL(im, 'preview'), alt: e.name }) : (e.fields.iconText ? h('span.glyph', e.fields.iconText) : icon(K.icon, 34)));
  const nameIn = h('input.name-input', { value: e.name, 'aria-label': 'Nome' });
  nameIn.addEventListener('input', () => { e.name = nameIn.value || 'Sem nome'; Store.saveEntity(e, { silent: true }); });
  nameIn.addEventListener('change', () => {
    const sim = Store.findSimilar(e.kind, e.name, e.id);
    if (sim.length) Toast.warn('Já existe ' + K.label.toLowerCase() + ' com nome parecido: ' + sim.map(x => x.name).slice(0, 3).join(', ') + '.');
    Store.emit('change', { kind: e.kind, id: e.id }); App.renderSidebar(); App.renderCrumbs();
  });
  const summary = entSummary(e);
  return h('div.ent-head',
    e.kind !== 'lore' ? portrait : null,
    h('div.ent-title',
      h('div.row', kindChip(e.kind), e.demo ? h('span.pill', 'exemplo') : null),
      nameIn, entitySubline(e),
      summary ? h('div.ent-summary.clamp2', summary) : null,
      tagInput(e.tags, v => { e.tags = v; Store.saveEntity(e, { silent: true }); }),
      h('div.meta', 'Criado em ' + U.fmtDate(e.createdAt) + ' · modificado em ' + U.fmtDate(e.updatedAt))),
    h('div.ent-actions',
      segmented([{ value: 'summary', label: 'Resumida', ic: 'eye', title: 'Mostrar só o que está preenchido, para leitura' }, { value: 'detailed', label: 'Detalhada', ic: 'edit', title: 'Mostrar todos os campos para edição' }], detailMode(), v => { Store.ui().detail = v; Store.saveSettings(); rerenderBody(); }, { label: 'Nível de detalhe' }),
      K.refs ? btn('', () => Boards.createFor(e), { ic: 'moodboard', title: 'Novo moodboard para ' + e.name }) : null,
      btn('', ev => Menu.open(ev.currentTarget, [
        { label: 'Duplicar', ic: 'copy', onClick: () => { const c = Store.duplicateEntity(e.id); if (c) { Toast.ok('Cópia criada.'); Nav.entity(c.id); } } },
        Schema.NARRATIVE_KINDS.includes(e.kind) ? { label: 'Ver no grafo', ic: 'graph', onClick: () => Nav.go('/p/' + Store.S.p.id + '/graph/all/' + e.id) } : null,
        e.kind === 'character' ? { label: 'Árvore genealógica', ic: 'family', onClick: () => Nav.go('/p/' + Store.S.p.id + '/graph/family/' + e.id) } : null,
        { label: 'Voltar para ' + K.plural.toLowerCase(), ic: 'left', onClick: () => Nav.section(KIND_SECTION[e.kind]) },
        { sep: true },
        { label: 'Excluir…', ic: 'trash', danger: true, onClick: async () => { if (await confirmDeleteEntity(e.id)) Nav.section(KIND_SECTION[e.kind]); } },
      ], { align: 'end' }), { ic: 'more', title: 'Mais ações' })));
}

/* ---------- leitura (modo resumido) ---------- */
function filled(v) { return Array.isArray(v) ? v.length > 0 : v != null && v !== '' && v !== false; }
function readValue(f, v) {
  if (f.type === 'ref') return entityLink(v);
  if (f.type === 'refs') return h('div.chips', v.map(id => h('span.chip', entityLink(id))));
  if (f.type === 'select') return h('span.pill', v);
  if (f.type === 'bool') return v ? 'Sim' : 'Não';
  if (f.type === 'mechlist') { const x = (Store.S.p.mechanics[f.list] || []).find(i => i.id === v); return x ? x.name : '—'; }
  return String(v);
}
function readGrid(fields, obj) {
  const shown = fields.filter(f => filled(obj[f.key]));
  if (!shown.length) return null;
  return h('div.read', shown.map(f => h('div.ri' + (f.type === 'textarea' ? '.long' : '') + (f.wide || (f.type === 'textarea' && String(obj[f.key]).length > 160) ? '.wide' : ''), h('span.lbl', f.label), h('div.v', readValue(f, obj[f.key])))));
}
function favs(e) { const lay = Store.S.p.config.layout[e.kind] = Store.S.p.config.layout[e.kind] || {}; lay.favorites = lay.favorites || []; return lay.favorites; }

/* Seções de uma aba, em modo de leitura ou edição */
function formTab(e, tabId, { asPanel = true } = {}) {
  const wrap = h('div');
  const p = Store.S.p;
  const save = U.debounce(() => Store.saveEntity(e, { silent: true }), 250);
  const proxy = new Proxy(e.fields, { get: (t, k) => k === '__selfId' ? e.id : t[k] });
  const mode = detailMode();
  const fv = favs(e);
  let anyFilled = false;
  for (const sec of Schema.sections(e.kind, p).filter(s => s.tab === tabId)) {
    const fields = sec.fields.filter(f => !f.hidden);
    if (!fields.length) continue;
    const nFilled = fields.filter(f => filled(e.fields[f.key])).length;
    if (mode === 'summary') {
      const g = readGrid(fields, e.fields);
      if (!g) continue;
      anyFilled = true;
      if (sec.spoiler) { g.classList.add('spoiler-veil'); g.title = 'Clique para revelar'; g.addEventListener('click', () => g.classList.remove('spoiler-veil'), { once: true }); }
      wrap.appendChild(h('section.panel', h('div.panel-title', h('h3', sec.title), sec.spoiler ? h('span.pill.warn', 'spoiler') : null), g));
      continue;
    }
    const grid = h('div.form-grid' + (sec.spoiler && nFilled ? '.spoiler-veil' : ''), fields.map(f => fieldControl(f, proxy, v => { e.fields[f.key] = v; save(); }, {
      fav: { on: fv.includes(f.key), toggle: on => { const l = favs(e); const i = l.indexOf(f.key); if (on && i < 0) l.push(f.key); if (!on && i >= 0) l.splice(i, 1); Store.saveProject(); } },
    })));
    if (sec.spoiler && nFilled) grid.addEventListener('click', () => grid.classList.remove('spoiler-veil'), { once: true });
    wrap.appendChild(h('details.sec', { open: sec.open || (nFilled > 0 && !sec.spoiler) },
      h('summary', sec.title, sec.spoiler ? h('span.pill.warn', 'spoiler') : null, h('span.fill', nFilled + '/' + fields.length + ' preenchidos')),
      h('div.sec-body', sec.spoiler && nFilled ? h('p.meta', 'Clique no conteúdo para revelar.') : null, grid)));
  }
  if (mode === 'summary' && !anyFilled && asPanel) wrap.appendChild(emptyState('Nada preenchido aqui ainda', 'No modo Resumida aparecem só os campos com conteúdo.', btn('Mudar para Detalhada', () => { Store.ui().detail = 'detailed'; Store.saveSettings(); App.refresh(); }, { kind: 'primary', ic: 'edit' }), 'note'));
  return wrap;
}

function projectFieldsSection(e) {
  const defs = Store.S.p.config.customFieldDefs[e.kind] || [];
  if (!defs.length) return null;
  const fields = defs.map(d => ({ key: 'cf_' + d.id, label: d.label, type: d.type || 'text', wide: d.type === 'textarea' }));
  if (detailMode() === 'summary') { const g = readGrid(fields, e.fields); return g ? h('section.panel', h('div.panel-title', h('h3', 'Campos do projeto')), g) : null; }
  const save = U.debounce(() => Store.saveEntity(e, { silent: true }), 250);
  return h('details.sec', { open: true }, h('summary', 'Campos do projeto', h('span.fill', 'definidos em Configurações')),
    h('div.sec-body', h('div.form-grid', fields.map(f => fieldControl(f, e.fields, v => { e.fields[f.key] = v; save(); })))));
}

/* ---------- visão geral ---------- */
const OV_BLOCKS = {
  character: [['rel', 'Relacionamentos'], ['events', 'Eventos recentes'], ['places', 'Localidades'], ['storylines', 'Storylines'], ['orgs', 'Organizações'], ['refs', 'Referências visuais'], ['mentions', 'Mencionado em']],
  location: [['hier', 'Hierarquia'], ['people', 'Personagens presentes'], ['events', 'Eventos ocorridos'], ['storylines', 'Storylines'], ['orgs', 'Organizações'], ['refs', 'Referências visuais'], ['mentions', 'Mencionado em']],
  storyline: [['progress', 'Progresso'], ['people', 'Personagens'], ['places', 'Localidades'], ['events', 'Eventos'], ['rel', 'Storylines relacionadas'], ['refs', 'Referências visuais']],
  event: [['people', 'Participantes'], ['places', 'Localidades'], ['storylines', 'Storylines'], ['chain', 'Causas e consequências'], ['unlocks', 'Efeitos mecânicos'], ['refs', 'Referências visuais']],
  organization: [['people', 'Membros'], ['places', 'Territórios e sede'], ['rel', 'Relações'], ['refs', 'Referências visuais'], ['mentions', 'Mencionado em']],
};
function ovHidden(e) { const lay = Store.S.p.config.layout[e.kind] = Store.S.p.config.layout[e.kind] || {}; lay.overviewHidden = lay.overviewHidden || {}; return lay.overviewHidden; }

function overviewTab(e) {
  const fv = favs(e).map(k => Schema.allFields(e.kind).find(f => f.key === k)).filter(Boolean);
  const highlights = fv.length ? readGrid(fv, e.fields) : null;
  const main = h('div.ov-main',
    highlights ? h('section.panel', { style: { marginBottom: '12px' } }, h('div.panel-title', icon('star'), h('h3', 'Destaques'), h('span.meta', 'campos marcados com estrela')), highlights) : null,
    formTab(e, 'overview', { asPanel: false }),
    projectFieldsSection(e),
    detailMode() === 'summary' && !Schema.sections(e.kind, Store.S.p).filter(s => s.tab === 'overview').some(s => s.fields.some(f => !f.hidden && filled(e.fields[f.key]))) && !highlights
      ? emptyState('Ficha ainda vazia', 'Cadastre o essencial agora e complete depois.', btn('Preencher', () => { Store.ui().detail = 'detailed'; Store.saveSettings(); App.refresh(); }, { kind: 'primary', ic: 'edit' }), 'note') : null);
  const blocks = OV_BLOCKS[e.kind];
  if (!blocks) return h('div.ov', { style: { gridTemplateColumns: '1fr' } }, main, h('div.ov-side', mentionsBlock(e)));
  const hidden = ovHidden(e);
  const side = h('div.ov-side');
  for (const [id, title] of blocks) {
    if (hidden[id]) continue;
    const content = ovBlock(e, id);
    if (content === undefined) continue;
    side.appendChild(h('section.panel', { style: { padding: '14px' } }, h('div.ov-block-head', h('h4', title), content.action || null), content.body || content));
  }
  side.appendChild(h('div.row', { style: { justifyContent: 'flex-end' } }, btn('Personalizar visão geral', ev => {
    Menu.open(ev.currentTarget, [{ header: 'Mostrar na visão geral' }, ...blocks.map(([id, title]) => ({ label: title, ic: hidden[id] ? 'square' : 'check', onClick: () => { if (hidden[id]) delete hidden[id]; else hidden[id] = true; Store.saveProject(); App.refresh(); } })),
      { sep: true }, { label: 'Ocultar ou reordenar campos…', ic: 'gear', onClick: () => { setFields.kind = e.kind; Nav.go('/p/' + Store.S.p.id + '/settings/fields'); } }], { align: 'end' });
  }, { small: true, kind: 'ghost', ic: 'gear' })));
  return h('div.ov', main, side);
}
const miniRow = (id, right, rightCls = '') => { const o = Store.get(id); if (!o) return null; return h('div.mini-row', { role: 'link', tabindex: 0, onclick: () => Nav.entity(id), onkeydown: ev => { if (ev.key === 'Enter') Nav.entity(id); } }, kindDot(o.kind), h('span.t', o.name), right ? h('span.r' + (rightCls ? '.' + rightCls : ''), right) : null); };
const miniList = (ids, empty, right) => { ids = U.uniq(ids).filter(id => Store.get(id)); return ids.length ? h('div.mini-list', ids.slice(0, 10).map(id => miniRow(id, right ? right(id) : null)), ids.length > 10 ? h('div.meta', '+' + (ids.length - 10)) : null) : h('p.meta', empty); };
function mentionsBlock(e) {
  const refs = Store.referrers(e.id).filter(r => r.kind !== 'refcollection');
  return h('section.panel', { style: { padding: '14px' } }, h('div.ov-block-head', h('h4', 'Mencionado em')), refs.length ? h('div.mini-list', refs.slice(0, 10).map(r => miniRow(r.id, Schema.kindLabel(r.kind)))) : h('p.meta', 'Nenhuma outra ficha cita esta.'));
}
function ovBlock(e, id) {
  const f = e.fields; const chars = Store.list('character'); const evs = Store.list('event');
  const link = (label, tab) => h('a.small', { href: Nav.href(e.id) + '/' + tab, onclick: ev => { ev.preventDefault(); Nav.entity(e.id, tab); } }, label);
  switch (id) {
    case 'rel': {
      const rels = Store.relationsOf(e.id);
      const body = rels.length ? h('div.mini-list', rels.slice(0, 8).map(r => { const o = r.fromId === e.id ? r.toId : r.fromId; const t = Store.relType(r.typeId); return miniRow(o, Store.relLabel(r, o), t.cat === 'romance' ? 'affect' : ''); })) : h('p.meta', 'Nenhuma relação ainda.');
      return { body, action: link(rels.length > 8 ? 'ver todas (' + rels.length + ')' : 'gerenciar', 'relacoes') };
    }
    case 'events': { const list = eventsOf(e); const recent = [...list].sort((a, b) => (b.fields.narrativeOrder ?? b.fields.chronoOrder ?? 0) - (a.fields.narrativeOrder ?? a.fields.chronoOrder ?? 0)).slice(0, 6); return { body: recent.length ? h('div.mini-list', recent.map(ev => miniRow(ev.id, ev.fields.chronoLabel || ev.fields.chapter || ''))) : h('p.meta', 'Nenhum evento.'), action: link('ver todos', 'eventos') }; }
    case 'places': {
      if (e.kind === 'character') {
        const ids = [f.originId, ...(f.residenceIds || []), ...(f.visitedIds || []), ...eventsOf(e).flatMap(ev => ev.fields.locationIds || [])].filter(Boolean);
        return miniList(ids, 'Nenhuma localidade ligada.', id => id === f.originId ? 'origem' : (f.residenceIds || []).includes(id) ? 'vive' : (f.visitedIds || []).includes(id) ? 'visitou' : 'em eventos');
      }
      if (e.kind === 'organization') return miniList([f.baseId, ...Store.list('location').filter(l => l.fields.controlledById === e.id || (l.fields.orgIds || []).includes(e.id)).map(l => l.id)].filter(Boolean), 'Nenhuma.', id => id === f.baseId ? 'sede' : 'presente');
      return miniList([...(f.locationIds || []), ...(e.steps || []).flatMap(s => s.locationIds || [])], 'Nenhuma localidade.');
    }
    case 'storylines': {
      if (e.kind === 'event') return miniList(f.storylineIds || [], 'Nenhuma.');
      const key = e.kind === 'character' ? 'characterIds' : 'locationIds';
      return miniList(Store.list('storyline').filter(s => (s.fields[key] || []).includes(e.id) || (s.steps || []).some(st => (st[key] || []).includes(e.id))).map(s => s.id), 'Não participa de nenhuma storyline.');
    }
    case 'orgs': return miniList(e.kind === 'character' ? (f.orgIds || []) : [...(f.orgIds || []), f.controlledById, ...Store.list('organization').filter(o => o.fields.baseId === e.id).map(o => o.id)].filter(Boolean), 'Nenhuma.');
    case 'hier': {
      const path = locPath(e); const kids = Store.list('location').filter(l => l.fields.parentId === e.id);
      return h('div.col', { style: { gap: '6px' } }, path.length ? h('div.row', { style: { gap: '4px' } }, path.map((id, i) => [entityLink(id), i < path.length - 1 ? h('span.meta', '›') : null])) : h('p.meta', 'Não está dentro de outra localidade.'),
        kids.length ? [h('span.lbl', 'Contém'), miniList(kids.map(k => k.id), '')] : null);
    }
    case 'people': {
      if (e.kind === 'location') { const ids = chars.filter(c => (c.fields.residenceIds || []).includes(e.id) || (c.fields.visitedIds || []).includes(e.id) || c.fields.originId === e.id).map(c => c.id); return { body: miniList(ids, 'Ninguém registrado aqui.', id => { const c = Store.get(id); return (c.fields.residenceIds || []).includes(e.id) ? 'vive' : c.fields.originId === e.id ? 'origem' : 'visitou'; }), action: link('detalhes', 'ocupantes') }; }
      if (e.kind === 'organization') { const ids = U.uniq([f.leaderId, ...chars.filter(c => (c.fields.orgIds || []).includes(e.id)).map(c => c.id), ...Store.relationsOf(e.id).filter(r => r.typeId === 'rt_member').map(r => r.fromId)].filter(Boolean)); return miniList(ids, 'Nenhum membro.', id => id === f.leaderId ? 'liderança' : ''); }
      return miniList([...(f.characterIds || []), ...(e.steps || []).flatMap(s => s.characterIds || [])], 'Ninguém associado.');
    }
    case 'progress': {
      const steps = e.steps || []; if (!steps.length) return { body: h('p.meta', 'Sem etapas.'), action: link('organizar', 'progressao') };
      const done = steps.filter(s => /escrito|revisad|conclu/i.test(s.status || '')).length;
      return { body: h('div.col', { style: { gap: '6px' } }, h('div.bar', h('i', { style: { width: Math.round(done / steps.length * 100) + '%' } })), h('div.meta', done + ' de ' + steps.length + ' etapas escritas'), h('div.mini-list', steps.slice(0, 5).map((s, i) => h('div.mini-row', { onclick: () => Nav.entity(e.id, 'progressao') }, h('span.meta', String(i + 1)), h('span.t', s.title), statusPill(s.status))))), action: link('abrir', 'progressao') };
    }
    case 'chain': {
      const causes = f.causeEventIds || []; const cons = evs.filter(x => (x.fields.causeEventIds || []).includes(e.id)).map(x => x.id);
      return h('div.col', { style: { gap: '6px' } }, h('span.lbl', 'Causado por'), miniList(causes, 'Nenhum evento anterior.'), h('span.lbl', 'Leva a'), miniList(cons, 'Nenhum evento posterior registrado.'));
    }
    case 'unlocks': { if (!Store.S.p.mechanics.enabled) return undefined; const u = (e.unlocks || []).map(x => x.ref); return { body: u.length || (e.statChanges || []).length ? h('div.col', miniList(u, ''), (e.statChanges || []).length ? h('div.meta', U.plural(e.statChanges.length, 'alteração de atributo', 'alterações de atributo')) : null) : h('p.meta', 'Nenhum.'), action: link('editar', 'mecanica') }; }
    case 'refs': {
      const imgs = Store.imagesOf(e.id); const boards = Boards.forEntity(e.id);
      return { body: h('div.col', { style: { gap: '8px' } }, imgs.length ? h('div.row', { style: { gap: '4px' } }, imgs.slice(0, 6).map((im, i) => h('img', { src: Store.imgURL(im), alt: im.title || '', loading: 'lazy', style: { width: '44px', height: '44px', objectFit: 'cover', borderRadius: '6px', cursor: 'zoom-in' }, onclick: () => Lightbox.fromImages(imgs, i) })), imgs.length > 6 ? h('span.meta', '+' + (imgs.length - 6)) : null) : h('p.meta', 'Nenhuma imagem associada.'),
        boards.length ? h('div.mini-list', boards.slice(0, 4).map(b => miniRow(b.id, U.plural(Boards.imageIds(b).length, 'imagem', 'imagens')))) : null), action: link('abrir', 'referencias') };
    }
    case 'mentions': { const refs = Store.referrers(e.id).filter(r => r.kind !== 'refcollection'); return refs.length ? h('div.mini-list', refs.slice(0, 8).map(r => miniRow(r.id, Schema.kindLabel(r.kind)))) : h('p.meta', 'Nenhuma outra ficha cita esta.'); }
  }
  return h('div');
}

function notesTab(e) {
  return h('div', formTab(e, 'notas', { asPanel: false }), customFieldsSection(e), h('h3', { style: { margin: '22px 0 10px' } }, 'Mapa de conexões'), connectionsTab(e));
}

function customFieldsSection(e) {
  e.custom = e.custom || [];
  if (detailMode() === 'summary') {
    const list = e.custom.filter(c => c.label || c.value);
    return list.length ? h('section.panel', h('div.panel-title', h('h3', 'Campos personalizados')), h('div.read', list.map(c => h('div.ri' + (String(c.value || '').length > 120 ? '.wide' : ''), h('span.lbl', c.label || 'Sem nome'), h('div.v', c.value || '—'))))) : null;
  }
  const box = h('div.col');
  const save = U.debounce(() => Store.saveEntity(e, { silent: true }), 250);
  function render() {
    clear(box);
    if (!e.custom.length) box.appendChild(h('p.meta', 'Campos livres só desta ficha. Dê um nome e um valor; reordene com as setas.'));
    e.custom.forEach((c, i) => {
      const lab = h('input.input.sm', { value: c.label, placeholder: 'Nome do campo', 'aria-label': 'Nome do campo', oninput: ev => { c.label = ev.target.value; save(); } });
      const val = h('textarea.input', { rows: 2, value: c.value || '', placeholder: 'Valor', 'aria-label': 'Valor do campo', oninput: ev => { c.value = ev.target.value; save(); } });
      box.appendChild(h('div.custom-field', h('div.col', { style: { gap: '5px' } }, lab, val),
        h('div.col', { style: { gap: '3px' } },
          btn('', () => { U.move(e.custom, i, i - 1); Store.saveEntity(e, { silent: true }); render(); }, { ic: 'up', small: true, title: 'Mover para cima', disabled: i === 0 }),
          btn('', () => { U.move(e.custom, i, i + 1); Store.saveEntity(e, { silent: true }); render(); }, { ic: 'down', small: true, title: 'Mover para baixo', disabled: i === e.custom.length - 1 }),
          btn('', () => { e.custom.splice(i, 1); Store.saveEntity(e, { silent: true }); render(); }, { ic: 'trash', small: true, title: 'Remover campo' }))));
    });
    box.appendChild(h('div', btn('Adicionar campo', () => { e.custom.push({ id: U.id('cf'), label: '', value: '' }); Store.saveEntity(e, { silent: true }); render(); box.querySelectorAll('input')[e.custom.length - 1].focus(); }, { ic: 'plus', small: true })));
  }
  render();
  return h('details.sec', { open: true }, h('summary', 'Campos personalizados', h('span.fill', e.custom.length + ' campo(s)')), h('div.sec-body', box));
}

/* ---------- relações ---------- */
function relationsTab(e) {
  const wrap = h('div.col', { style: { gap: '14px' } });
  const rels = Store.relationsOf(e.id);
  const groups = {};
  for (const r of rels) { const t = Store.relType(r.typeId); (groups[t.cat] = groups[t.cat] || []).push(r); }
  wrap.appendChild(h('div.row', btn('Nova relação', () => relationModal({ fromId: e.id }), { kind: 'primary', ic: 'plus' }),
    e.kind === 'character' ? btn('Ver árvore genealógica', () => Nav.go('/p/' + Store.S.p.id + '/graph/family/' + e.id), { ic: 'family' }) : null,
    btn('Ver no grafo', () => Nav.go('/p/' + Store.S.p.id + '/graph/all/' + e.id), { ic: 'graph' }),
    h('span.spacer'), h('span.muted.small', 'Cada relação aparece automaticamente nas duas fichas.')));
  if (e.kind === 'character') wrap.appendChild(familySummary(e));
  if (!rels.length) { wrap.appendChild(emptyState('Sem relações', 'Conecte este registro a outros: família, romance, rivalidade, hierarquia, organizações ou tipos que você criar.')); return wrap; }
  for (const [cat, list] of Object.entries(groups)) {
    wrap.appendChild(h('div', h('h3', { style: { marginBottom: '6px' } }, Schema.EDGE_CATS[cat] || cat),
      h('div.linklist', list.map(r => {
        const other = r.fromId === e.id ? r.toId : r.fromId;
        return h('div.linkrow', { style: { alignItems: 'flex-start' } },
          h('div.grow', h('div.row', h('span.rel-label' + (Store.relType(r.typeId).cat === 'romance' ? '.affect' : ''), Store.relLabel(r, other)), entityLink(other), r.state ? h('span.pill', r.state) : null, r.period ? h('span.muted.small', r.period) : null),
            r.description ? h('div.small', r.description) : null, r.history ? h('div.small.muted', 'Histórico: ' + r.history) : null, (r.tags || []).length ? tagChips(r.tags) : null),
          btn('', () => relationModal(r), { ic: 'edit', small: true, title: 'Editar relação' }),
          btn('', () => { const copy = U.clone(r); Store.deleteRelation(r.id); App.refresh(); Toast.action('Relação removida das duas fichas.', 'Desfazer', () => { Store.saveRelation(copy); App.refresh(); }); }, { ic: 'trash', small: true, title: 'Remover relação' }));
      }))));
  }
  return wrap;
}

function familyOf(id) {
  const out = { parents: [], children: [], siblings: [], spouses: [] };
  for (const r of Store.relationsOf(id)) {
    const t = Store.relType(r.typeId); if (!t.genealogy) continue;
    const other = r.fromId === id ? r.toId : r.fromId;
    if (t.genealogy === 'parent') (r.fromId === id ? out.children : out.parents).push(other);
    if (t.genealogy === 'sibling') out.siblings.push(other);
    if (t.genealogy === 'spouse') out.spouses.push(other);
  }
  // irmãos implícitos: compartilham um dos pais
  for (const par of out.parents) for (const c of familyOf.childrenOf(par)) if (c !== id && !out.siblings.includes(c)) out.siblings.push(c);
  return out;
}
familyOf.childrenOf = function (pid) {
  return Store.relationsOf(pid).filter(r => Store.relType(r.typeId).genealogy === 'parent' && r.fromId === pid).map(r => r.toId);
};
function familySummary(e) {
  const f = familyOf(e.id);
  const row = (label, ids) => ids.length ? h('div.row', h('span.lbl', { style: { minWidth: '80px' } }, label), ids.map(id => entityLink(id))) : null;
  const any = f.parents.length + f.children.length + f.siblings.length + f.spouses.length;
  if (!any) return h('div');
  return h('div.panel', h('div.panel-title', h('h3', 'Família'), btn('Calcular parentesco com…', () => kinshipModal(e.id), { small: true })),
    h('div.col', row('Pais', f.parents), row('Filhos', f.children), row('Irmãos', f.siblings), row('Cônjuges', f.spouses)));
}
function kinshipModal(fromId) {
  const out = h('div');
  Modal.open({ title: 'Parentesco', body: h('div.col', h('p.muted', 'Encontra o caminho de vínculos familiares mais curto entre duas pessoas.'),
    refPicker({ kind: 'character', multi: false, exclude: [fromId], allowCreate: false, onChange: id => { clear(out); if (id) out.appendChild(kinshipPath(fromId, id)); } }), out), actions: [{ label: 'Fechar' }] });
}
function kinshipPath(a, b) {
  const famRels = [...Store.S.rels.values()].filter(r => Store.relType(r.typeId).cat === 'familia');
  const prev = { [a]: null }; const q = [a];
  while (q.length) {
    const x = q.shift(); if (x === b) break;
    for (const r of famRels) {
      const y = r.fromId === x ? r.toId : r.toId === x ? r.fromId : null;
      if (y && !(y in prev)) { prev[y] = { from: x, r }; q.push(y); }
    }
  }
  if (!(b in prev)) return h('div.notice.warn', 'Não há vínculo familiar registrado entre os dois.');
  const steps = []; let cur = b;
  while (prev[cur]) { steps.unshift({ from: prev[cur].from, to: cur, r: prev[cur].r }); cur = prev[cur].from; }
  return h('div.col', h('div.lbl', steps.length + ' grau(s) de separação'), steps.map(st => h('div.row', entityLink(st.from), h('span.rel-label', Store.relLabel(st.r, st.to)), entityLink(st.to))));
}

function relationModal(rel) {
  const isNew = !rel.id;
  const d = isNew ? { typeId: '', fromId: rel.fromId, toId: null, description: '', history: '', state: '', period: '', notes: '', tags: [] } : U.clone(rel);
  const self = Store.get(isNew ? rel.fromId : d.fromId);
  const typeSel = h('select.input', { 'aria-label': 'Tipo de vínculo' });
  const otherBox = h('div');
  const dir = h('div.small.muted');
  function allowed(t, kind, side) { const l = t[side] || ['character']; return l.includes('*') || l.includes(kind); }
  function fillTypes() {
    clear(typeSel);
    const anchorKind = self.kind;
    const types = Store.relTypes().filter(t => allowed(t, anchorKind, 'from') || (!t.symmetric && allowed(t, anchorKind, 'to')) || (t.symmetric && allowed(t, anchorKind, 'to')));
    typeSel.appendChild(h('option', { value: '' }, 'Escolha o vínculo…'));
    const byCat = {}; types.forEach(t => (byCat[t.cat] = byCat[t.cat] || []).push(t));
    for (const [cat, ts] of Object.entries(byCat)) typeSel.appendChild(h('optgroup', { label: Schema.EDGE_CATS[cat] || cat }, ts.flatMap(t => {
      const opts = [];
      if (allowed(t, anchorKind, 'from')) opts.push(h('option', { value: t.id + '|f', selected: d.typeId === t.id && d.fromId === self.id }, t.label));
      if (!t.symmetric && allowed(t, anchorKind, 'to')) opts.push(h('option', { value: t.id + '|r', selected: d.typeId === t.id && d.toId === self.id }, t.reverse));
      return opts;
    })));
    typeSel.appendChild(h('option', { value: '__new' }, '+ Criar tipo de relação…'));
  }
  let reversed = !isNew && d.toId === self.id;
  function renderOther() {
    clear(otherBox);
    const t = Store.relTypes().find(x => x.id === d.typeId);
    const kinds = t ? (reversed ? t.from : t.to) : ['character'];
    const ks = kinds.includes('*') ? Schema.NARRATIVE_KINDS : kinds;
    const otherId = reversed ? d.fromId : d.toId;
    otherBox.appendChild(h('label.field', h('span.lbl', 'Com quem / com o quê'), refPicker({ kinds: ks, multi: false, value: otherId === self.id ? null : otherId, exclude: [self.id], onChange: v => { if (reversed) d.fromId = v; else d.toId = v; updDir(); } })));
    updDir();
  }
  function updDir() {
    const t = Store.relTypes().find(x => x.id === d.typeId);
    const other = Store.get(reversed ? d.fromId : d.toId);
    dir.textContent = t && other ? (reversed ? other.name + ' ' + t.label + ' ' + self.name + '  ·  na outra ficha: "' + self.name + ' ' + t.reverse + ' ' + other.name + '"' : self.name + ' ' + t.label + ' ' + other.name + (t.symmetric ? '  ·  (recíproca)' : '  ·  na outra ficha: "' + other.name + ' ' + t.reverse + ' ' + self.name + '"')) : '';
  }
  typeSel.addEventListener('change', async () => {
    if (typeSel.value === '__new') { const t = await relationTypeModal(); fillTypes(); if (t) { typeSel.value = t.id + '|f'; } else { typeSel.value = ''; return; } }
    const [tid, side] = typeSel.value.split('|');
    const other = reversed ? d.fromId : d.toId;
    d.typeId = tid; reversed = side === 'r';
    if (reversed) { d.toId = self.id; d.fromId = other && other !== self.id ? other : null; } else { d.fromId = self.id; d.toId = other && other !== self.id ? other : null; }
    renderOther();
  });
  fillTypes();
  if (!isNew) { d.typeId && (typeSel.value = d.typeId + (reversed ? '|r' : '|f')); }
  renderOther();
  const F = (k, label, ta) => fieldControl({ key: k, label, type: ta ? 'textarea' : 'text', wide: ta, rows: 2 }, d, v => d[k] = v);
  Modal.open({
    title: isNew ? 'Nova relação' : 'Editar relação', wide: true,
    body: h('div.col', h('div.form-grid', h('label.field', h('span.lbl', 'Tipo de vínculo (do ponto de vista de ' + self.name + ')'), typeSel), otherBox), dir,
      h('div.form-grid', F('state', 'Estado atual'), F('period', 'Data ou período narrativo'), F('description', 'Descrição do relacionamento', true), F('history', 'Histórico da relação', true), F('notes', 'Observações', true)),
      h('label.field', h('span.lbl', 'Tags'), tagInput(d.tags, v => d.tags = v))),
    actions: [{ label: 'Cancelar' }, { label: 'Salvar relação', kind: 'primary', onClick: async () => {
      if (!d.typeId || !d.fromId || !d.toId) { Toast.warn('Escolha o tipo de vínculo e o outro registro.'); return false; }
      if (d.fromId === d.toId) { Toast.warn('Um registro não pode se relacionar consigo mesmo.'); return false; }
      const dup = Store.findDuplicateRelation(d);
      if (dup && !await Modal.confirm('Relação repetida', 'Essa mesma relação já existe entre os dois. Criar outra mesmo assim?', { okLabel: 'Criar outra' })) return false;
      const r = isNew ? d : Object.assign(rel, d);
      Store.saveRelation(r); Toast.ok('Relação salva nas duas fichas.'); App.refresh();
    } }],
  });
}

function relationTypeModal(existing = null) {
  return new Promise(res => {
    const d = existing ? U.clone(existing) : { id: U.id('rt'), label: '', reverse: '', symmetric: false, cat: 'social', from: ['character'], to: ['character'], genealogy: null };
    const kinds = Schema.NARRATIVE_KINDS;
    const kindChecks = side => h('div.chips', ['*', ...kinds].map(k => h('label.check.small', h('input', { type: 'checkbox', checked: d[side].includes(k), onchange: ev => { d[side] = ev.target.checked ? U.uniq([...d[side], k]) : d[side].filter(x => x !== k); } }), k === '*' ? 'Qualquer' : Schema.kindLabel(k))));
    const symCb = h('input', { type: 'checkbox', checked: d.symmetric, onchange: () => { d.symmetric = symCb.checked; revField.hidden = d.symmetric; } });
    const revField = fieldControl({ key: 'reverse', label: 'Rótulo inverso (como aparece na outra ficha)' }, d, v => d.reverse = v); revField.hidden = d.symmetric;
    let done = false;
    Modal.open({
      title: existing ? 'Editar tipo de relação' : 'Novo tipo de relação', wide: true,
      body: h('div.col',
        h('div.form-grid', fieldControl({ key: 'label', label: 'Rótulo (ex.: "é mentor de")' }, d, v => d.label = v), revField),
        h('label.check', symCb, 'Recíproca (o mesmo rótulo vale nos dois sentidos, como "é amigo de")'),
        h('div.form-grid',
          h('label.field', h('span.lbl', 'Categoria'), h('select.input', { onchange: ev => d.cat = ev.target.value }, Object.entries(Schema.EDGE_CATS).map(([k, l]) => h('option', { value: k, selected: d.cat === k }, l)))),
          h('label.field', h('span.lbl', 'Papel na árvore genealógica'), h('select.input', { onchange: ev => d.genealogy = ev.target.value || null }, [['', 'Nenhum'], ['parent', 'Origem é progenitor do destino'], ['spouse', 'Cônjuges'], ['sibling', 'Irmãos']].map(([v, l]) => h('option', { value: v, selected: (d.genealogy || '') === v }, l))))),
        h('div.field', h('span.lbl', 'Pode partir de'), kindChecks('from')), h('div.field', h('span.lbl', 'Pode apontar para'), kindChecks('to'))),
      actions: [{ label: 'Cancelar' }, { label: 'Salvar', kind: 'primary', onClick: () => {
        if (!d.label.trim()) { Toast.warn('Escreva o rótulo.'); return false; }
        if (!d.symmetric && !d.reverse.trim()) d.reverse = d.label;
        if (!d.from.length || !d.to.length) { Toast.warn('Escolha os tipos de registro permitidos.'); return false; }
        const list = Store.relTypes(); const i = list.findIndex(t => t.id === d.id);
        if (i >= 0) list[i] = d; else list.push(d);
        Store.saveProject(); done = true; res(d);
      } }],
      onClose: () => { if (!done) res(null); },
    });
  });
}

/* ---------- eventos ligados ---------- */
function eventsOf(e) {
  const key = { character: 'characterIds', location: 'locationIds', storyline: 'storylineIds' }[e.kind];
  if (!key) return [];
  return Store.list('event').filter(ev => (ev.fields[key] || []).includes(e.id)).sort((a, b) => (a.fields.chronoOrder ?? 1e9) - (b.fields.chronoOrder ?? 1e9));
}
function eventRow(ev) {
  const f = ev.fields;
  return h('div.linkrow', { style: { alignItems: 'flex-start' } },
    h('div.tl-when', f.chronoLabel || (f.chronoOrder != null ? '#' + f.chronoOrder : '—')),
    h('div.grow', h('div.row', entityLink(ev.id), f.evType ? h('span.pill', f.evType) : null, statusPill(f.status), f.chapter ? h('span.muted.small', f.chapter) : null),
      f.summary ? h('div.small', f.summary.slice(0, 220)) : null,
      h('div.small.muted', [(f.characterIds || []).map(id => (Store.get(id) || {}).name).filter(Boolean).join(', '), (f.locationIds || []).map(id => (Store.get(id) || {}).name).filter(Boolean).join(', ')].filter(Boolean).join(' · '))));
}
function eventsTab(e) {
  const key = { character: 'characterIds', location: 'locationIds', storyline: 'storylineIds' }[e.kind];
  const evs = eventsOf(e);
  return h('div.col', { style: { gap: '12px' } },
    h('div.row',
      btn('Novo evento', () => quickCreate('event', '', { fields: { [key]: [e.id] } }), { kind: 'primary', ic: 'plus' }),
      h('div', { style: { minWidth: '280px', flex: '1' } }, refPicker({ kind: 'event', multi: true, value: [], allowCreate: false, placeholder: 'Associar evento existente…', onChange: ids => { for (const id of ids) { const ev = Store.get(id); ev.fields[key] = U.uniq([...(ev.fields[key] || []), e.id]); Store.saveEntity(ev); } App.refresh(); } }))),
    evs.length ? h('div.linklist', evs.map(ev => h('div.row.nowrap', h('div.grow', eventRow(ev)), btn('', () => { ev.fields[key] = (ev.fields[key] || []).filter(x => x !== e.id); Store.saveEntity(ev); App.refresh(); }, { ic: 'x', small: true, title: 'Desassociar' })))) : emptyState('Nenhum evento', 'Eventos criados aqui também aparecem na seção geral de eventos e nas fichas de todos os envolvidos.'),
    evs.length ? h('p.muted.small', 'Ordenado pela cronologia do universo. A ordem de apresentação ao público fica na Linha do tempo.') : null);
}

/* ---------- localidade: ocupantes e histórico ---------- */
function locationOccupants(loc) {
  const chars = Store.list('character');
  const sec = (title, items, empty) => h('div.panel', h('div.panel-title', h('h3', title), h('span.muted.small', String(items.length))), items.length ? h('div.chips', items.map(x => h('span.chip', entityLink(x.id)))) : h('p.muted.small', empty));
  const orgs = U.uniq([...(loc.fields.orgIds || []), loc.fields.controlledById, ...Store.list('organization').filter(o => o.fields.baseId === loc.id).map(o => o.id)].filter(Boolean)).map(Store.get).filter(Boolean);
  return h('div.col', { style: { gap: '0' } },
    sec('Vivem aqui', chars.filter(c => (c.fields.residenceIds || []).includes(loc.id)), 'Ninguém marcou esta localidade em "Vive em".'),
    sec('Visitaram', chars.filter(c => (c.fields.visitedIds || []).includes(loc.id)), 'Nenhuma visita registrada.'),
    sec('Originários daqui', chars.filter(c => c.fields.originId === loc.id), '—'),
    sec('Organizações presentes', orgs, 'Nenhuma.'),
    sec('Localidades contidas aqui', Store.list('location').filter(l => l.fields.parentId === loc.id), 'Nenhuma sublocalidade.'),
    loc.fields.parentId ? h('div.panel', h('div.panel-title', h('h3', 'Faz parte de')), h('div.row', locPath(loc).map((id, i, a) => [entityLink(id), i < a.length - 1 ? h('span.muted', '›') : null]))) : null,
    sec('Storylines que usam este lugar', Store.list('storyline').filter(s => (s.fields.locationIds || []).includes(loc.id) || (s.steps || []).some(st => (st.locationIds || []).includes(loc.id))), 'Nenhuma.'),
    h('div.panel', h('div.panel-title', h('h3', 'Eventos ocorridos aqui')), eventsOf(loc).length ? h('div.linklist', eventsOf(loc).map(eventRow)) : h('p.muted.small', 'Nenhum evento. Crie pela seção Eventos ou pela ficha de um personagem.')),
    loc.fields.changes ? h('div.panel', h('div.panel-title', h('h3', 'Alterações importantes')), h('p', { style: { whiteSpace: 'pre-wrap' } }, loc.fields.changes)) : null);
}
function locPath(loc) {
  const path = []; let cur = loc; const seen = new Set();
  while (cur && cur.fields.parentId && !seen.has(cur.id)) { seen.add(cur.id); cur = Store.get(cur.fields.parentId); if (cur) path.unshift(cur.id); }
  return path;
}

function orgMembers(org) {
  const byField = Store.list('character').filter(c => (c.fields.orgIds || []).includes(org.id));
  const byRel = Store.relationsOf(org.id).filter(r => r.typeId === 'rt_member').map(r => Store.get(r.fromId)).filter(Boolean);
  const members = U.uniq([...byField, ...byRel]);
  return h('div.col',
    org.fields.leaderId ? h('div.row', h('span.lbl', 'Liderança'), entityLink(org.fields.leaderId)) : null,
    members.length ? h('div.chips', members.map(m => h('span.chip', entityLink(m.id)))) : emptyState('Sem membros', 'Marque esta organização no campo "Grupo, facção ou organização" dos personagens, ou crie relações "é membro de".'),
    h('p.muted.small', 'Lista calculada a partir das fichas dos personagens e das relações; não é uma cópia.'));
}

/* ---------- conexões (todas as referências inversas) ---------- */
function connectionsTab(e) {
  const refs = Store.referrers(e.id);
  const fieldsPointing = [];
  for (const r of refs) {
    const hits = Schema.refFields(r.kind).filter(f => { const v = r.fields[f.key]; return Array.isArray(v) ? v.includes(e.id) : v === e.id; });
    const other = [];
    if ((r.steps || []).some(st => Store.containsRef(st, e.id))) other.push('etapas da storyline');
    if (r.branching && Store.containsRef(r.branching, e.id)) other.push('ramificações');
    if (r.mech && Store.containsRef(r.mech, e.id)) other.push('combate e progressão');
    if ((r.nodes || []).some(n => Store.containsRef(n, e.id))) other.push('nós da árvore');
    if (r.unlocks && Store.containsRef(r.unlocks, e.id)) other.push('desbloqueios');
    if (r.statChanges && Store.containsRef(r.statChanges, e.id)) other.push('alterações de atributo');
    if (r.fields.entityId === e.id) other.push('coleção de referências');
    fieldsPointing.push({ r, labels: [...hits.map(f => f.edge ? f.edge.label : f.label), ...other] });
  }
  const own = Schema.refFields(e.kind).flatMap(f => { const v = e.fields[f.key]; const ids = Array.isArray(v) ? v : v ? [v] : []; return ids.map(id => ({ id, label: f.edge ? f.edge.label : f.label })); });
  return h('div.col', { style: { gap: '14px' } },
    h('div.panel', h('div.panel-title', h('h3', 'Esta ficha aponta para')), own.length ? h('div.linklist', own.map(x => h('div.row', h('span.rel-label', x.label), entityLink(x.id, { showKind: true })))) : h('p.muted.small', 'Nenhum vínculo nos campos desta ficha.')),
    h('div.panel', h('div.panel-title', h('h3', 'Outras fichas que mencionam esta')), fieldsPointing.length ? h('div.linklist', fieldsPointing.map(({ r, labels }) => h('div.row', entityLink(r.id, { showKind: true }), h('span.rel-label', labels.join(', ') || 'vínculo')))) : h('p.muted.small', 'Nenhuma.')),
    h('div.panel', h('div.panel-title', h('h3', 'Relações'), h('span.muted.small', String(Store.relationsOf(e.id).length))), Store.relationsOf(e.id).length ? h('div.linklist', Store.relationsOf(e.id).map(r => { const o = r.fromId === e.id ? r.toId : r.fromId; return h('div.row', h('span.rel-label', Store.relLabel(r, o)), entityLink(o, { showKind: true })); })) : h('p.muted.small', 'Nenhuma.')));
}
