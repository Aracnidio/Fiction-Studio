/* Fiction Studio — progressão de storylines, ramificações de visual novel e linha do tempo de eventos. */
'use strict';

function storylineSteps(sl) {
  sl.steps = sl.steps || [];
  const units = Store.listValues('narrativeUnits');
  const wrap = h('div.col', { style: { gap: '10px' } });
  let open = null;
  const save = () => Store.saveEntity(sl, { silent: true });
  const saveSoon = U.debounce(save, 250);
  function render() {
    clear(wrap);
    wrap.appendChild(h('div.row',
      btn('Adicionar etapa', async () => {
        const st = { id: U.id('st'), title: 'Nova etapa', unit: units[Math.min(1, units.length - 1)] || '', description: '', status: 'Ideia', characterIds: [], locationIds: [], eventIds: [], conflicts: '', revelations: '', consequences: '' };
        sl.steps.push(st); open = st.id; save(); render();
      }, { kind: 'primary', ic: 'plus' }),
      h('span.muted.small', 'Estrutura deste projeto: ' + units.join(' › ') + '. '), h('a.small', { href: '#/p/' + Store.S.p.id + '/settings/lists' }, 'Alterar níveis'),
      h('span.spacer'), h('span.muted.small', 'Arraste para reordenar; as conexões de cada etapa são mantidas.')));
    if (!sl.steps.length) { wrap.appendChild(emptyState('Sem etapas', 'Divida a storyline em ' + units.map(u => u.toLowerCase()).join(', ') + ' ou qualquer estrutura que você definir.')); return; }
    const list = h('div.col', { style: { gap: '8px' } });
    sl.steps.forEach((st, i) => {
      const depth = Math.max(0, units.indexOf(st.unit));
      const counts = [st.characterIds.length && st.characterIds.length + ' pers.', st.locationIds.length && st.locationIds.length + ' loc.', st.eventIds.length && st.eventIds.length + ' ev.'].filter(Boolean).join(' · ');
      const card = h('div.step', { style: { marginLeft: depth * 22 + 'px' } },
        h('span.drag-handle', { title: 'Arrastar' }, icon('layers', 14)),
        h('div.pos', String(i + 1)),
        h('div.grow',
          h('div.row', st.unit ? h('span.pill.cy', st.unit) : null, h('a.elink', { onclick: () => { open = open === st.id ? null : st.id; render(); } }, st.title || 'Sem título'), statusPill(st.status), counts ? h('span.muted.small', counts) : null),
          st.description && open !== st.id ? h('div.small.muted', st.description.slice(0, 180)) : null,
          open === st.id ? stepForm(st) : null),
        h('div.col', { style: { gap: '3px' } },
          btn('', () => { U.move(sl.steps, i, i - 1); save(); render(); }, { ic: 'up', small: true, title: 'Subir', disabled: i === 0 }),
          btn('', () => { U.move(sl.steps, i, i + 1); save(); render(); }, { ic: 'down', small: true, title: 'Descer', disabled: i === sl.steps.length - 1 }),
          btn('', async () => { if (await Modal.confirm('Remover etapa', 'Remover "' + st.title + '"? Personagens, locais e eventos ligados não são apagados.', { danger: true, okLabel: 'Remover' })) { sl.steps.splice(i, 1); save(); render(); } }, { ic: 'trash', small: true, title: 'Remover' })));
      list.appendChild(card);
    });
    makeSortable(list, '.step', (from, to) => { U.move(sl.steps, from, to); save(); render(); });
    wrap.appendChild(list);
  }
  function stepForm(st) {
    const F = (k, label, type = 'text', extra = {}) => fieldControl({ key: k, label, type, ...extra }, st, v => { st[k] = v; saveSoon(); });
    const unitSel = h('select.input', { onchange: ev => { st.unit = ev.target.value; save(); render(); } }, h('option', { value: '' }, '—'), units.map(u => h('option', { value: u, selected: st.unit === u }, u)));
    const box = h('div.form-grid', { style: { marginTop: '10px' } },
      F('title', 'Título'), h('label.field', h('span.lbl', 'Nível'), unitSel), F('status', 'Estado de desenvolvimento', 'select', { list: 'stepStatus' }),
      F('description', 'Descrição', 'textarea', { wide: true, rows: 3 }),
      h('label.field.wide', h('span.lbl', 'Personagens'), refPicker({ kind: 'character', value: st.characterIds, onChange: v => { st.characterIds = v; save(); } })),
      h('label.field', h('span.lbl', 'Localidades'), refPicker({ kind: 'location', value: st.locationIds, onChange: v => { st.locationIds = v; save(); } })),
      h('label.field', h('span.lbl', 'Eventos'), refPicker({ kind: 'event', value: st.eventIds, onChange: v => { st.eventIds = v; save(); } })),
      F('conflicts', 'Conflitos', 'textarea'), F('revelations', 'Revelações', 'textarea'), F('consequences', 'Consequências', 'textarea'));
    box.addEventListener('click', ev => ev.stopPropagation());
    return box;
  }
  render();
  return wrap;
}

/* ---------- ramificações (visual novel) ---------- */
const VN_TYPES = [
  { id: 'start', label: 'Cena inicial', color: '#3cc8d6', shape: 'round' },
  { id: 'scene', label: 'Cena', color: '#8b7cf6', shape: 'rect' },
  { id: 'choice', label: 'Escolha', color: '#e0a03c', shape: 'diamond' },
  { id: 'route', label: 'Início de rota', color: '#6fc36f', shape: 'round' },
  { id: 'ending', label: 'Final', color: '#e46a8a', shape: 'hex' },
];
function validateBranching(b) {
  const issues = [];
  const starts = b.nodes.filter(n => n.type === 'start');
  if (!starts.length && b.nodes.length) issues.push({ level: 'erro', text: 'Defina uma cena inicial.' });
  if (starts.length > 1) issues.push({ level: 'aviso', text: 'Há ' + starts.length + ' cenas iniciais.' });
  const out = {}; b.nodes.forEach(n => out[n.id] = []); b.edges.forEach(e => out[e.from] && out[e.from].push(e.to));
  const reach = new Set(); const q = starts.map(n => n.id);
  while (q.length) { const x = q.shift(); if (reach.has(x)) continue; reach.add(x); (out[x] || []).forEach(y => q.push(y)); }
  for (const n of b.nodes) {
    if (starts.length && !reach.has(n.id)) issues.push({ level: 'erro', text: `"${n.label}" não é alcançável a partir da cena inicial.`, node: n.id });
    if (n.type !== 'ending' && !(out[n.id] || []).length) issues.push({ level: 'aviso', text: `"${n.label}" não leva a lugar nenhum (falta conexão ou marcar como Final).`, node: n.id });
    if (n.type === 'choice' && (out[n.id] || []).length < 2) issues.push({ level: 'aviso', text: `Escolha "${n.label}" tem menos de duas opções.`, node: n.id });
    if (n.type === 'ending' && (out[n.id] || []).length) issues.push({ level: 'aviso', text: `Final "${n.label}" tem saídas.`, node: n.id });
  }
  return issues;
}
function storylineBranching(sl) {
  sl.branching = sl.branching || { nodes: [], edges: [] };
  const b = sl.branching;
  const wrap = h('div.col', { style: { gap: '10px', minHeight: '600px' } });
  const vizBox = h('div.viz-wrap', { style: { height: '560px' } });
  const side = h('div.viz-side');
  const issuesBox = h('div');
  const save = U.debounce(() => Store.saveEntity(sl, { silent: true }), 200);
  let ed;
  function addNode(type, x, y) {
    const t = VN_TYPES.find(t => t.id === type);
    const pos = x != null ? { x, y } : ed.nextFreePos();
    const n = { id: U.id('vn'), type, label: type === 'start' && !b.nodes.some(n => n.type === 'start') ? 'Início' : t.label, description: '', route: '', conditions: '', consequences: '', eventIds: [], characterIds: [], x: Math.round(pos.x), y: Math.round(pos.y) };
    b.nodes.push(n); ed.render(); ed.select({ node: n.id }); changed();
  }
  function changed() { save(); renderIssues(); }
  function renderIssues() {
    clear(issuesBox);
    const iss = validateBranching(b);
    ed.errNodes = new Set(iss.filter(i => i.level === 'erro' && i.node).map(i => i.node));
    const routes = U.uniq(b.nodes.map(n => n.route).filter(Boolean));
    const endings = b.nodes.filter(n => n.type === 'ending');
    issuesBox.append(h('div.panel', h('div.panel-title', h('h3', 'Resumo')),
      h('div.small', b.nodes.length + ' nós · ' + b.edges.length + ' conexões · ' + endings.length + ' final(is) · ' + routes.length + ' rota(s)'),
      routes.length ? h('div.chips', { style: { marginTop: '6px' } }, routes.map(r => h('span.chip', r))) : null,
      iss.length ? h('ul.impact', { style: { marginTop: '8px' } }, iss.slice(0, 20).map(i => h('li', { style: { color: i.level === 'erro' ? 'var(--err)' : 'var(--warn)', cursor: i.node ? 'pointer' : null }, onclick: () => i.node && ed.focusNode(i.node) }, i.text))) : (b.nodes.length ? h('div.formula-ok', 'Estrutura sem problemas.') : null)));
    ed.render();
  }
  function renderSide(sel) {
    clear(side);
    side.appendChild(issuesBox);
    if (!sel) { side.appendChild(h('div.panel', h('p.muted.small', 'Selecione um nó ou uma conexão para editar. Duplo clique no fundo cria uma cena. Arraste do ponto ciano de um nó até outro para conectar.'))); return; }
    if (sel.node) {
      const n = b.nodes.find(x => x.id === sel.node); if (!n) return;
      const F = (k, label, type = 'text', rows) => fieldControl({ key: k, label, type, rows }, n, v => { n[k] = v; ed.render(); changed(); });
      side.appendChild(h('div.panel', h('div.panel-title', h('h3', 'Nó')),
        h('div.col',
          h('label.field', h('span.lbl', 'Tipo'), h('select.input', { onchange: ev => { n.type = ev.target.value; ed.render(); changed(); } }, VN_TYPES.map(t => h('option', { value: t.id, selected: n.type === t.id }, t.label)))),
          F('label', 'Título'), F('description', 'Descrição / o que acontece', 'textarea', 3), F('route', 'Rota (nome)'),
          F('conditions', 'Condições para liberar / desbloquear', 'textarea', 2), F('consequences', 'Consequências / flags alteradas', 'textarea', 2),
          h('label.field', h('span.lbl', 'Eventos exclusivos desta cena/rota'), refPicker({ kind: 'event', value: n.eventIds || [], onChange: v => { n.eventIds = v; changed(); } })),
          h('label.field', h('span.lbl', 'Personagens'), refPicker({ kind: 'character', value: n.characterIds || [], onChange: v => { n.characterIds = v; changed(); } })),
          h('div.row', btn('Excluir nó', () => ed.deleteSelection(), { kind: 'danger', small: true, ic: 'trash' })))));
    } else if (sel.edge) {
      const e = b.edges.find(x => x.id === sel.edge); if (!e) return;
      const from = b.nodes.find(n => n.id === e.from), to = b.nodes.find(n => n.id === e.to);
      const F = (k, label, type = 'text') => fieldControl({ key: k, label, type, rows: 2 }, e, v => { e[k] = v; ed.render(); changed(); });
      side.appendChild(h('div.panel', h('div.panel-title', h('h3', 'Conexão')),
        h('div.small.muted', (from ? from.label : '?') + ' → ' + (to ? to.label : '?')),
        h('div.col', F('label', from && from.type === 'choice' ? 'Texto da opção' : 'Rótulo'), F('condition', 'Condição para a opção aparecer', 'textarea'), F('consequence', 'Consequência (afinidade, flags…)', 'textarea'),
          btn('Excluir conexão', () => ed.deleteSelection(), { kind: 'danger', small: true, ic: 'trash' }))));
    }
  }
  wrap.append(h('div.row',
    VN_TYPES.map(t => btn(t.label, () => addNode(t.id), { small: true, ic: 'plus' })),
    h('span.spacer'),
    btn('Organizar', () => ed.autoLayout(), { small: true, ic: 'layers' }),
    btn('Exportar PNG', () => svgToPng(ed.svg, U.slug(sl.name) + '-ramificacoes.png', { bbox: ed.bbox() }), { small: true, ic: 'download' })),
    h('div.viz-layout', vizBox, resizableSide(side, 'branching'), side));
  setTimeout(() => {
    ed = new NodeEditor(vizBox, b, {
      types: VN_TYPES, onChange: () => changed(), onSelect: renderSide,
      sub: n => [VN_TYPES.find(t => t.id === n.type)?.label, n.route].filter(Boolean).join(' · '),
      onCreateAt: (x, y) => addNode('scene', x, y),
    });
    attachNodeControls(ed, vizBox);
    renderIssues(); renderSide(null); ed.fit();
  }, 0);
  return wrap;
}

/* ---------- linha do tempo ---------- */
const tlState = { mode: 'chrono', storyline: '', character: '' };
Views.timeline = function (main) {
  const page = h('div.page'); main.appendChild(page);
  const body = h('div');
  function render() {
    clear(body);
    const key = tlState.mode === 'chrono' ? 'chronoOrder' : 'narrativeOrder';
    let evs = Store.list('event');
    if (tlState.storyline) evs = evs.filter(e => (e.fields.storylineIds || []).includes(tlState.storyline));
    if (tlState.character) evs = evs.filter(e => (e.fields.characterIds || []).includes(tlState.character));
    const placed = evs.filter(e => e.fields[key] != null && e.fields[key] !== '').sort((a, b) => a.fields[key] - b.fields[key] || U.byName(a, b));
    const unplaced = evs.filter(e => e.fields[key] == null || e.fields[key] === '');
    const chronoRank = Object.fromEntries(Store.list('event').filter(e => e.fields.chronoOrder != null).sort((a, b) => a.fields.chronoOrder - b.fields.chronoOrder).map((e, i) => [e.id, i]));
    const narrRank = Object.fromEntries(Store.list('event').filter(e => e.fields.narrativeOrder != null).sort((a, b) => a.fields.narrativeOrder - b.fields.narrativeOrder).map((e, i) => [e.id, i]));
    if (!evs.length) { body.appendChild(emptyState('Sem eventos', 'Crie eventos e defina a posição cronológica e a ordem de apresentação.', btn('Novo evento', () => quickCreate('event'), { kind: 'primary', ic: 'plus' }))); return; }
    function renumber(list) { list.forEach((e, i) => { e.fields[key] = i + 1; Store.saveEntity(e, { silent: true }); }); render(); }
    const tl = h('div.tl', placed.map((e, i) => {
      const f = e.fields;
      const isFlash = chronoRank[e.id] != null && narrRank[e.id] != null && tlState.mode === 'narrative' && placed.some(o => o !== e && narrRank[o.id] < narrRank[e.id] && chronoRank[o.id] > chronoRank[e.id]);
      return h('div.tl-item' + (isFlash ? '.flash' : ''),
        h('div.tl-card',
          h('div.tl-when', tlState.mode === 'chrono' ? (f.chronoLabel || '#' + f.chronoOrder) : (f.chapter || '#' + f.narrativeOrder)),
          h('div.grow', h('div.row', entityLink(e.id), f.evType ? h('span.pill', f.evType) : null, isFlash ? h('span.pill.warn', 'flashback') : null,
            h('span.muted.small', tlState.mode === 'chrono' ? (f.narrativeOrder != null ? 'apresentado em #' + f.narrativeOrder + (f.chapter ? ' (' + f.chapter + ')' : '') : 'sem ordem de apresentação') : (f.chronoLabel ? 'acontece em ' + f.chronoLabel : ''))),
            f.summary ? h('div.small', f.summary.slice(0, 200)) : null,
            h('div.small.muted', [(f.characterIds || []).map(id => (Store.get(id) || {}).name).filter(Boolean).join(', '), (f.locationIds || []).map(id => (Store.get(id) || {}).name).filter(Boolean).join(', ')].filter(Boolean).join(' · '))),
          h('div.col', { style: { gap: '3px' } },
            btn('', () => { const l = [...placed]; U.move(l, i, i - 1); renumber(l); }, { ic: 'up', small: true, title: 'Mover antes', disabled: i === 0 }),
            btn('', () => { const l = [...placed]; U.move(l, i, i + 1); renumber(l); }, { ic: 'down', small: true, title: 'Mover depois', disabled: i === placed.length - 1 }))));
    }));
    body.append(placed.length ? tl : h('p.muted', 'Nenhum evento tem posição definida neste modo.'),
      unplaced.length ? h('div.panel', h('div.panel-title', h('h3', 'Sem posição ' + (tlState.mode === 'chrono' ? 'cronológica' : 'de apresentação')), btn('Colocar todos no fim', () => renumber([...placed, ...unplaced]), { small: true })),
        h('div.chips', unplaced.map(e => h('span.chip', entityLink(e.id))))) : null);
  }
  page.append(pageHead('Linha do tempo', 'A cronologia do universo e a ordem em que o público conhece os fatos são sequências independentes. Um evento da infância pode aparecer só no capítulo 10.'),
    h('div.toolbar',
      h('div.row', { style: { gap: '2px' } }, btn('Cronologia do universo', () => { tlState.mode = 'chrono'; App.refresh(); }, { kind: tlState.mode === 'chrono' ? 'primary' : '' }), btn('Ordem de apresentação', () => { tlState.mode = 'narrative'; App.refresh(); }, { kind: tlState.mode === 'narrative' ? 'primary' : '' })),
      h('select.input', { 'aria-label': 'Storyline', onchange: e => { tlState.storyline = e.target.value; render(); } }, h('option', { value: '' }, 'Todas as storylines'), Store.list('storyline').sort(U.byName).map(s => h('option', { value: s.id, selected: tlState.storyline === s.id }, s.name))),
      h('select.input', { 'aria-label': 'Personagem', onchange: e => { tlState.character = e.target.value; render(); } }, h('option', { value: '' }, 'Todos os personagens'), Store.list('character').sort(U.byName).map(c => h('option', { value: c.id, selected: tlState.character === c.id }, c.name))),
      h('span.spacer'), btn('Novo evento', () => quickCreate('event'), { kind: 'primary', ic: 'plus' })),
    body);
  render();
};
