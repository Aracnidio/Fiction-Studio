/* Fiction Studio — grafo geral e visualizações especializadas (personagens, família, localidades, storylines, rotas). */
'use strict';

const EDGE_COLORS = { familia: 'var(--accent)', romance: 'var(--pink)', hierarquia: 'var(--k-event)', organizacao: 'var(--k-organization)', geografia: 'var(--k-location)', evento: 'var(--k-event)', storyline: 'var(--k-storyline)', mecanica: 'var(--k-skill)', referencias: 'var(--k-moodboard)' };
const GRAPH_SHAPES = { moodboard: 'rect',  character: 'circle', location: 'rect', storyline: 'hex', event: 'diamond', organization: 'tri', skill: 'circle', passive: 'circle', class: 'hex', item: 'rect', effect: 'diamond', skilltree: 'hex', attribute: 'rect' };
const graphState = { kinds: ['character', 'location', 'storyline', 'event', 'organization'], cats: Object.keys(Schema.EDGE_CATS), tag: '', storyline: '', layout: 'saved', labels: true, depth: 0, focus: null, showMech: false };

function buildGraph({ kinds, includeAttributes = false }) {
  const nodes = []; const edges = []; const ids = new Set();
  const p = Store.S.p;
  for (const e of Store.S.ents.values()) {
    if (!kinds.includes(e.kind)) continue;
    const im = Store.mainImage(e);
    const bimg = e.kind === 'moodboard' ? Store.S.imgs.get(e.fields.coverImageId || Boards.imageIds(e)[0]) : null;
    nodes.push({ id: e.id, label: e.name, kind: e.kind, color: Schema.KINDS[e.kind].color, shape: GRAPH_SHAPES[e.kind], img: e.kind === 'character' && im ? Store.imgURL(im) : bimg ? Store.imgURL(bimg) : null, glyph: e.fields.iconText || null, tags: e.tags || [], size: e.kind === 'storyline' ? 22 : e.kind === 'event' ? 14 : 18 });
    ids.add(e.id);
  }
  if (includeAttributes) for (const a of p.mechanics.attributes) { nodes.push({ id: 'attr:' + a.id, label: a.name, kind: 'attribute', color: '#5aa0e6', shape: 'rect', size: 12, tags: [] }); ids.add('attr:' + a.id); }
  const add = (source, target, label, cat, extra = {}) => { if (ids.has(source) && ids.has(target) && source !== target) edges.push({ id: 'e' + edges.length, source, target, label, cat, directed: true, color: EDGE_COLORS[cat] || null, ...extra }); };
  for (const r of Store.S.rels.values()) { const t = Store.relType(r.typeId); add(r.fromId, r.toId, t.label, t.cat, { directed: !t.symmetric, relId: r.id, dashed: t.genealogy === 'spouse' }); }
  for (const e of Store.S.ents.values()) {
    if (!ids.has(e.id)) continue;
    for (const f of Schema.refFields(e.kind)) {
      if (!f.edge) continue;
      const v = e.fields[f.key]; for (const t of (Array.isArray(v) ? v : v ? [v] : [])) add(e.id, t, f.edge.label, f.edge.cat);
    }
    if (e.kind === 'character' && e.mech) {
      (e.mech.skills || []).forEach(s => add(e.id, s.ref, 'possui habilidade', 'mecanica'));
      (e.mech.passives || []).forEach(s => add(e.id, s.ref, 'possui passiva', 'mecanica'));
      (e.mech.classes || []).forEach(s => add(e.id, s.ref, 'pertence à classe', 'mecanica'));
      Object.values(e.mech.equipment || {}).forEach(it => add(e.id, it, 'equipa', 'mecanica'));
      (e.mech.effects || []).forEach(s => add(e.id, s.ref, 'sob efeito de', 'mecanica'));
    }
    (e.unlocks || []).forEach(u => add(e.id, u.ref, 'desbloqueia', 'mecanica'));
    if (e.kind === 'moodboard') U.uniq([...(e.fields.linkedIds || []), ...(e.items || []).filter(i => i.type === 'ref').map(i => i.ref)]).forEach(id => add(e.id, id, 'referência visual', 'referencias', { dashed: true }));
    if (includeAttributes) {
      for (const m of e.modifiers || []) add(e.id, 'attr:' + m.attrId, e.kind === 'effect' ? 'altera' : 'modifica', 'mecanica');
      for (const sc of e.statChanges || []) add(e.id, 'attr:' + sc.attrId, 'altera atributo', 'mecanica');
    }
    if (e.kind === 'storyline') for (const n of (e.branching && e.branching.nodes) || []) for (const ev of n.eventIds || []) add(e.id, ev, 'evento de rota', 'storyline');
  }
  if (includeAttributes) for (const a of p.mechanics.attributes) if (a.derived && a.formula) for (const r of Formula.refs((() => { try { return Formula.parse(a.formula); } catch (e) { return null; } })())) if (r.startsWith('$')) add('attr:' + r.slice(1), 'attr:' + a.id, 'influencia', 'mecanica');
  return { nodes, edges };
}

function neighborhood(edges, id, depth) {
  const set = new Set([id]); let frontier = [id];
  for (let d = 0; d < depth; d++) {
    const next = [];
    for (const e of edges) { if (frontier.includes(e.source) && !set.has(e.target)) { set.add(e.target); next.push(e.target); } if (frontier.includes(e.target) && !set.has(e.source)) { set.add(e.source); next.push(e.source); } }
    frontier = next;
  }
  return set;
}

Views.graph = function (main, sub = 'all', focusId = null) {
  const p = Store.S.p;
  const page = h('div.page.fill'); main.appendChild(page);
  const views = [['all', 'Grafo geral', 'graph'], ['characters', 'Relações entre personagens', 'users'], ['family', 'Árvore genealógica', 'family'], ['locations', 'Mapa de localidades', 'pin'], ['storylines', 'Fluxo de storylines', 'route'], ['routes', 'Rotas e escolhas', 'tree']];
  page.append(h('div.page-head', { style: { marginBottom: '8px' } }, h('div.titles', h('h1', 'Grafo do universo')), h('div.row', btn('Cronologia', () => Nav.section('timeline'), { ic: 'clock' }))),
    h('div.tabs', { role: 'tablist', style: { marginBottom: '12px' } }, views.map(([id, l, ic]) => h('button.tab' + (id === sub ? '.active' : ''), { role: 'tab', 'aria-selected': String(id === sub), onclick: () => Nav.go('/p/' + p.id + '/graph/' + id) }, icon(ic, 14), l))));
  if (sub === 'routes') return routesView(page);
  const toolbar = h('div.toolbar', { style: { marginBottom: '10px' } });
  const vizBox = h('div.viz-wrap');
  const side = h('div.viz-side');
  page.append(toolbar, h('div.viz-layout', vizBox, resizableSide(side, 'graph'), side));
  const legend = h('div.viz-legend');
  const gv = new GraphView(vizBox, {
    onSelect: n => { graphState.focus = n ? n.id : graphState.focus; renderSide(n); },
    onOpen: n => openNode(n),
    onMove: (id, pos) => { const key = sub; p.config.graphPositions[key] = p.config.graphPositions[key] || {}; p.config.graphPositions[key][id] = { x: Math.round(pos.x), y: Math.round(pos.y) }; Store.saveProject(); },
  });
  const ctl = canvasControls({ zoomIn: () => gv.vp.zoom(1.25), zoomOut: () => gv.vp.zoom(0.8), fit: () => gv.fit(), getZoom: () => gv.vp.k, setZoom: k => gv.vp.zoom(k / gv.vp.k),
    help: [...COMMON_CANVAS_HELP, ['Arrastar um nó', 'reposicionar (fica salvo)'], ['Clique numa linha', 'editar a relação'], ['Enter', 'abrir a ficha do nó em foco']] });
  vizBox.append(legend, ctl);
  const origApply = gv.vp.apply.bind(gv.vp); gv.vp.apply = () => { origApply(); ctl.update(); };
  gv.onEdge = e => { if (e.relId) relationModal(Store.S.rels.get(e.relId)); };
  let data = { nodes: [], edges: [] };

  function openNode(n) {
    if (!n) return;
    if (n.kind === 'attribute') { Nav.go('/p/' + p.id + '/mech/attributes'); return; }
    if (n.kind === 'step') { Nav.entity(n.slId, 'progressao'); return; }
    Nav.entity(n.id);
  }
  function renderSide(n) {
    clear(side);
    if (!n) {
      side.appendChild(h('div.panel', h('div.panel-title', icon('info'), h('h3', 'Selecione um nó')), h('p.small.muted', 'Clique num elemento para ver uma prévia e suas conexões. Duplo clique abre a ficha. A ajuda (?) no canto da área lista os gestos.'),
        h('div.meta', { style: { marginTop: '8px' } }, data.nodes.length + ' nós · ' + data.edges.length + ' conexões visíveis')));
      return;
    }
    const conns = data.edges.filter(e => e.source === n.id || e.target === n.id);
    const ent = Store.get(n.id);
    const thumb = ent ? entityThumb(ent, 26) : icon(n.kind === 'attribute' ? 'formula' : 'route', 26);
    side.appendChild(h('div.panel.preview-card',
      h('div.pc-top', h('div.pc-img', { style: { '--k': ent ? kc(ent.kind) : 'var(--cyan)' } }, ent && ent.kind === 'moodboard' && n.img ? h('img', { src: n.img, alt: '' }) : thumb),
        h('div.grow', ent ? kindChip(ent.kind) : h('span.kind-chip', { style: { '--k': 'var(--cyan)' } }, n.kind === 'attribute' ? 'Atributo' : 'Etapa de storyline'),
          h('h3', { style: { margin: '6px 0 2px' } }, n.label), ent ? entitySubline(ent) : null)),
      ent && entSummary(ent) ? h('p.small.muted.clamp2', { style: { margin: 0 } }, entSummary(ent)) : null,
      ent && (ent.tags || []).length ? tagChips(ent.tags.slice(0, 4)) : null,
      h('div.row', btn(ent && ent.kind === 'moodboard' ? 'Abrir moodboard' : 'Abrir ficha', () => openNode(n), { kind: 'primary', small: true }),
        btn(graphState.depth ? 'Mostrar tudo' : 'Só vizinhos', () => { graphState.depth = graphState.depth ? 0 : 1; graphState.focus = n.id; refresh(); }, { small: true }),
        graphState.depth ? btn('2 níveis', () => { graphState.depth = 2; refresh(); }, { small: true }) : null)));
    side.appendChild(h('div.panel', h('div.panel-title', h('h3', 'Conexões'), h('span.muted.small', String(conns.length))),
      conns.length ? h('div.linklist', conns.map(e => {
        const other = e.source === n.id ? e.target : e.source;
        const on = data.nodes.find(x => x.id === other);
        const r = e.relId ? Store.S.rels.get(e.relId) : null;
        const label = r ? Store.relLabel(r, other) : (e.source === n.id ? e.label : '← ' + e.label);
        return h('div.row.nowrap', { style: { cursor: 'pointer' }, onclick: () => gv.focus(other) }, h('span.rel-label', label), kindDot(on ? on.kind : 'character'), h('span', on ? on.label : '?'));
      })) : h('p.muted.small', 'Nenhuma conexão visível com os filtros atuais.')));
  }

  function computeData() {
    if (sub === 'family') return familyData();
    if (sub === 'locations') return locationsData();
    if (sub === 'storylines') return storylineFlowData();
    const kinds = sub === 'characters' ? ['character'] : [...graphState.kinds, ...(graphState.showMech ? Schema.MECH_KINDS.filter(k => k !== 'skilltree') : [])];
    let d = buildGraph({ kinds, includeAttributes: graphState.showMech && sub === 'all' });
    if (sub === 'characters') d.edges = d.edges.filter(e => e.relId);
    return d;
  }
  function familyData() {
    const fam = [...Store.S.rels.values()].filter(r => Store.relType(r.typeId).cat === 'familia');
    const ids = new Set(fam.flatMap(r => [r.fromId, r.toId]));
    const nodes = [...ids].map(Store.get).filter(Boolean).map(e => { const im = Store.mainImage(e); return { id: e.id, label: e.name, kind: e.kind, color: Schema.KINDS[e.kind].color, shape: 'circle', img: im ? Store.imgURL(im) : null, tags: e.tags || [], size: 20 }; });
    const edges = fam.map((r, i) => { const t = Store.relType(r.typeId); return { id: 'f' + i, source: r.fromId, target: r.toId, label: t.genealogy === 'parent' ? '' : t.label, directed: t.genealogy === 'parent', dashed: t.genealogy !== 'parent', cat: 'familia', relId: r.id, gen: t.genealogy }; });
    return { nodes, edges, layered: true };
  }
  function locationsData() {
    const locs = Store.list('location');
    const nodes = locs.map(e => ({ id: e.id, label: e.name, kind: 'location', color: Schema.KINDS.location.color, shape: 'rect', tags: e.tags || [], size: 17 }));
    const edges = [];
    locs.forEach(l => { if (l.fields.parentId && Store.get(l.fields.parentId)) edges.push({ id: 'h' + l.id, source: l.fields.parentId, target: l.id, label: 'contém', directed: true, cat: 'geografia', hier: true }); });
    for (const r of Store.S.rels.values()) { const a = Store.get(r.fromId), b = Store.get(r.toId); if (a && b && a.kind === 'location' && b.kind === 'location') { const t = Store.relType(r.typeId); edges.push({ id: r.id, source: r.fromId, target: r.toId, label: t.label, dashed: true, cat: t.cat, relId: r.id }); } }
    if (graphState.kinds.includes('character')) for (const c of Store.list('character')) for (const lid of c.fields.residenceIds || []) { if (!nodes.find(n => n.id === c.id)) nodes.push({ id: c.id, label: c.name, kind: 'character', color: Schema.KINDS.character.color, shape: 'circle', size: 11, tags: c.tags || [] }); edges.push({ id: 'res' + c.id + lid, source: lid, target: c.id, label: 'morador', cat: 'geografia', hier: true }); }
    return { nodes, edges, layered: true };
  }
  function storylineFlowData() {
    const nodes = [], edges = [];
    for (const sl of Store.list('storyline')) {
      nodes.push({ id: sl.id, label: sl.name, kind: 'storyline', color: Schema.KINDS.storyline.color, shape: 'hex', size: 22, tags: sl.tags || [] });
      let prev = sl.id;
      for (const st of sl.steps || []) {
        const sid = 'step:' + st.id;
        nodes.push({ id: sid, label: (st.unit ? st.unit + ': ' : '') + st.title, kind: 'step', slId: sl.id, color: '#b89454', shape: 'rect', size: 12, tags: [] });
        edges.push({ id: 'se' + st.id, source: prev, target: sid, label: '', directed: true, cat: 'storyline', hier: true });
        prev = sid;
        for (const ev of st.eventIds || []) { const e = Store.get(ev); if (!e) continue; if (!nodes.find(n => n.id === e.id)) nodes.push({ id: e.id, label: e.name, kind: 'event', color: Schema.KINDS.event.color, shape: 'diamond', size: 12, tags: e.tags || [] }); edges.push({ id: 'sev' + st.id + ev, source: sid, target: ev, label: 'evento', cat: 'evento' }); }
      }
    }
    for (const r of Store.S.rels.values()) { const a = Store.get(r.fromId), b = Store.get(r.toId); if (a && b && a.kind === 'storyline' && b.kind === 'storyline') edges.push({ id: r.id, source: r.fromId, target: r.toId, label: Store.relType(r.typeId).label, dashed: true, cat: 'storyline', relId: r.id }); }
    return { nodes, edges, layered: true, dir: 'LR' };
  }

  function refresh(keepView = false) {
    data = computeData();
    let { nodes, edges } = data;
    if (!['family', 'locations', 'storylines'].includes(sub)) {
      edges = edges.filter(e => graphState.cats.includes(e.cat));
      if (graphState.tag) { const keep = new Set(nodes.filter(n => n.tags.includes(graphState.tag)).map(n => n.id)); nodes = nodes.filter(n => keep.has(n.id)); }
      if (graphState.storyline) {
        const sl = Store.get(graphState.storyline);
        if (sl) {
          const keep = new Set([sl.id, ...(sl.fields.characterIds || []), ...(sl.fields.locationIds || []), ...Store.list('event').filter(e => (e.fields.storylineIds || []).includes(sl.id)).map(e => e.id), ...(sl.steps || []).flatMap(s => [...s.characterIds, ...s.locationIds, ...s.eventIds])]);
          nodes = nodes.filter(n => keep.has(n.id));
        }
      }
    }
    const nodeIds = new Set(nodes.map(n => n.id));
    edges = edges.filter(e => nodeIds.has(e.source) && nodeIds.has(e.target));
    if (graphState.depth && graphState.focus && nodeIds.has(graphState.focus)) {
      const nb = neighborhood(edges, graphState.focus, graphState.depth);
      nodes = nodes.filter(n => nb.has(n.id)); edges = edges.filter(e => nb.has(e.source) && nb.has(e.target));
    }
    data = { nodes, edges };
    const saved = p.config.graphPositions[sub] || {};
    let pos;
    const useLayered = sub === 'family' || sub === 'locations' || sub === 'storylines';
    if (sub === 'family') {
      const gen = {}; nodes.forEach(n => gen[n.id] = 0);
      const parentE = edges.filter(e => e.gen === 'parent'); const spouseE = edges.filter(e => e.gen === 'spouse' || e.gen === 'sibling');
      for (let k = 0; k < nodes.length + 2; k++) {
        let ch = false;
        for (const e of parentE) if (gen[e.target] < gen[e.source] + 1) { gen[e.target] = gen[e.source] + 1; ch = true; }
        for (const e of spouseE) { const m = Math.max(gen[e.source], gen[e.target]); if (gen[e.source] !== m || gen[e.target] !== m) { gen[e.source] = gen[e.target] = m; ch = true; } }
        if (!ch) break;
      }
      pos = Layout.layered(nodes, parentE.concat(spouseE), { rankOf: id => gen[id], gapX: 150, gapY: 140 });
    } else if (useLayered) pos = Layout.layered(nodes, edges.filter(e => e.hier || e.directed), { dir: sub === 'storylines' ? 'LR' : 'TB', gapX: sub === 'storylines' ? 200 : 150, gapY: 110 });
    else if (graphState.layout === 'circle') pos = Layout.circle(nodes);
    else if (graphState.layout === 'grid') pos = Layout.grid(nodes);
    else if (graphState.layout === 'layered') pos = Layout.layered(nodes, edges);
    else pos = Layout.force(nodes, edges, { fixed: graphState.layout === 'saved' ? saved : {} });
    if (graphState.layout === 'saved' || useLayered) for (const [id, xy] of Object.entries(saved)) if (pos[id]) pos[id] = { ...xy };
    gv.showLabels = graphState.labels;
    gv.setData(nodes, edges, pos);
    if (!keepView) setTimeout(() => { gv.fit(); if (focusId && nodeIds.has(focusId)) { gv.select(focusId); } }, 10);
    // legenda
    clear(legend);
    const kindsShown = U.uniq(nodes.map(n => n.kind));
    kindsShown.forEach(k => legend.appendChild(h('span', h('span.kind-dot', { style: { background: (nodes.find(n => n.kind === k) || {}).color } }), k === 'attribute' ? 'Atributo' : k === 'step' ? 'Etapa' : Schema.kindLabel(k, true))));
    if (sub === 'family') legend.appendChild(h('span', '→ progenitor para filho(a) · - - cônjuges e irmãos'));
    renderSide(gv.selected ? nodes.find(n => n.id === gv.selected) : null);
  }

  // barra de ferramentas
  const search = h('input.input', { placeholder: 'Encontrar no mapa…', 'aria-label': 'Encontrar no mapa', style: { width: '190px' } });
  search.addEventListener('keydown', e => { if (e.key === 'Enter') { const q = U.norm(search.value); const n = data.nodes.find(n => U.norm(n.label).includes(q)); if (n) gv.focus(n.id); else Toast.warn('Nada com esse nome no mapa atual.'); } });
  const chipToggle = (list, key, label, color) => h('span.chip.click' + (list.includes(key) ? '.on' : ''), { onclick: ev => { const i = list.indexOf(key); if (i >= 0) list.splice(i, 1); else list.push(key); ev.currentTarget.classList.toggle('on'); refresh(true); } }, color ? h('span.kind-dot', { style: { background: color } }) : null, label);
  toolbar.append(search);
  if (sub === 'all' || sub === 'locations') {
    toolbar.append(h('div.chips', (sub === 'all' ? ['character', 'location', 'storyline', 'event', 'organization', 'moodboard'] : ['character']).map(k => chipToggle(graphState.kinds, k, sub === 'locations' ? 'Mostrar moradores' : Schema.kindLabel(k, true), sub === 'locations' ? null : kc(k)))));
    if (sub === 'all' && p.mechanics.enabled) toolbar.append(h('label.check.small', h('input', { type: 'checkbox', checked: graphState.showMech, onchange: e => { graphState.showMech = e.target.checked; if (!graphState.cats.includes('mecanica')) graphState.cats.push('mecanica'); refresh(); } }), 'Camada mecânica'));
  }
  if (sub === 'all' || sub === 'characters') {
    const catSel = h('details', { style: { position: 'relative' } }, h('summary.btn.btn-sm', 'Tipos de conexão'),
      h('div.panel', { style: { position: 'absolute', zIndex: 30, top: '30px', left: 0, width: '240px' } }, h('div.col', Object.entries(Schema.EDGE_CATS).map(([k, l]) => h('label.check.small', h('input', { type: 'checkbox', checked: graphState.cats.includes(k), onchange: e => { if (e.target.checked) graphState.cats.push(k); else graphState.cats = graphState.cats.filter(x => x !== k); refresh(true); } }), l)),
        h('div.row', btn('Só família', () => { graphState.cats = ['familia']; refresh(); catSel.open = false; }, { small: true }), btn('Todas', () => { graphState.cats = Object.keys(Schema.EDGE_CATS); refresh(); catSel.open = false; }, { small: true })))));
    const tags = U.uniq([...Store.S.ents.values()].flatMap(e => e.tags || [])).filter(id => Store.S.tags.has(id));
    toolbar.append(catSel,
      tags.length ? h('select.input', { 'aria-label': 'Filtrar por tag', onchange: e => { graphState.tag = e.target.value; refresh(); } }, h('option', { value: '' }, 'Todas as tags'), tags.map(id => h('option', { value: id, selected: graphState.tag === id }, Store.tagName(id)))) : null,
      sub === 'all' ? h('select.input', { 'aria-label': 'Filtrar por storyline', onchange: e => { graphState.storyline = e.target.value; refresh(); } }, h('option', { value: '' }, 'Todas as storylines'), Store.list('storyline').map(s => h('option', { value: s.id, selected: graphState.storyline === s.id }, 'Só: ' + s.name))) : null,
      h('select.input', { 'aria-label': 'Layout', onchange: e => { graphState.layout = e.target.value; refresh(); } }, [['saved', 'Layout: livre (salvo)'], ['force', 'Layout: forças (recalcular)'], ['layered', 'Layout: camadas'], ['circle', 'Layout: círculo'], ['grid', 'Layout: grade']].map(([v, l]) => h('option', { value: v, selected: graphState.layout === v }, l))));
  }
  toolbar.append(h('label.check.small', h('input', { type: 'checkbox', checked: graphState.labels, onchange: e => { graphState.labels = e.target.checked; refresh(true); } }), 'Rótulos'),
    graphState.depth ? btn('Mostrar grafo completo', () => { graphState.depth = 0; refresh(); }, { small: true, kind: 'cyan' }) : null,
    h('span.spacer'),
    btn('Reposicionar', async () => { if (await Modal.confirm('Reposicionar', 'Descartar as posições que você arrastou nesta visualização?', { okLabel: 'Descartar' })) { delete p.config.graphPositions[sub]; Store.saveProject(); refresh(); } }, { small: true }),
    btn('PNG', () => svgToPng(gv.svg, U.slug(p.name) + '-' + sub + '.png', { bbox: (() => { const b = Layout.bbox(gv.pos, data.nodes.map(n => n.id)); return { minX: b.minX - 60, minY: b.minY - 40, maxX: b.maxX + 60, maxY: b.maxY + 50 }; })() }), { small: true, ic: 'download', title: 'Exportar imagem' }));
  if (focusId) graphState.focus = focusId;
  setTimeout(() => refresh(), 0);
  if (sub === 'family' && !data.nodes.length) setTimeout(() => { if (!data.nodes.length) vizBox.appendChild(h('div', { style: { position: 'absolute', inset: '40% 20% auto', textAlign: 'center' } }, emptyState('Sem relações familiares', 'Crie relações como "é pai de", "é irmão de" ou "é cônjuge de" na aba Relacionamentos de um personagem.'))); }, 50);
};

function routesView(page) {
  const sls = Store.list('storyline').filter(s => s.branching && s.branching.nodes && s.branching.nodes.length);
  if (!sls.length) { page.appendChild(emptyState('Nenhuma ramificação', 'Abra uma storyline e use a aba "Ramificações" para desenhar cenas, escolhas, rotas e finais.')); return; }
  let cur = sls[0];
  const box = h('div.viz-wrap', { style: { minHeight: '520px' } });
  const sel = h('select.input', { 'aria-label': 'Storyline', style: { width: 'auto' }, onchange: () => { cur = Store.get(sel.value); draw(); } }, sls.map(s => h('option', { value: s.id }, s.name)));
  const info = h('div.small.muted');
  let ed;
  function draw() {
    clear(box);
    ed = new NodeEditor(box, U.clone(cur.branching), { types: VN_TYPES, readOnly: true, sub: n => [VN_TYPES.find(t => t.id === n.type)?.label, n.route].filter(Boolean).join(' · '), onSelect: () => {} });
    attachNodeControls(ed, box);
    setTimeout(() => ed.fit(), 10);
    const iss = validateBranching(cur.branching);
    info.textContent = cur.branching.nodes.filter(n => n.type === 'ending').length + ' final(is) · ' + U.uniq(cur.branching.nodes.map(n => n.route).filter(Boolean)).length + ' rota(s) · ' + (iss.length ? iss.length + ' aviso(s)' : 'sem avisos');
  }
  page.append(h('div.toolbar', sel, info, h('span.spacer'), btn('Editar ramificações', () => Nav.entity(cur.id, 'ramificacoes'), { kind: 'primary', small: true })), box);
  draw();
}
