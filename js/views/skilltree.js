/* Fiction Studio — editor visual de árvores de habilidades, com validação e simulação de desbloqueio. */
'use strict';

Views.skillTree = function (main, tree, tab) {
  const p = Store.S.p; const M = p.mechanics;
  tree.nodes = tree.nodes || []; tree.edges = tree.edges || [];
  const page = h('div.page.fill'); main.appendChild(page);
  const save = U.debounce(() => Store.saveEntity(tree, { silent: true }), 250);
  const types = M.nodeTypes && M.nodeTypes.length ? M.nodeTypes : (M.nodeTypes = Schema.defaultNodeTypes());
  const sim = { on: false, charId: null, budget: 10, unlocked: new Set(), flags: new Set() };
  if (tab && tab.startsWith('sim:')) { sim.on = true; sim.charId = tab.slice(4); const c = Store.get(sim.charId); if (c && c.mech) sim.budget = Number(c.mech.skillPoints) || 10; }
  let ed; let filterCat = ''; let issues = { issues: [] };
  const vizBox = h('div.viz-wrap');
  const side = h('div.viz-side');
  const head = h('div');
  const bar = h('div.toolbar', { style: { marginBottom: '10px' } });

  function simCtx() {
    const base = Mech.charContext(sim.charId ? Store.get(sim.charId) : null);
    const spent = tree.nodes.filter(n => sim.unlocked.has(n.id)).reduce((s, n) => s + (Number(n.cost) || 0), 0);
    return { ...base, unlocked: sim.unlocked, flags: sim.flags, spent, pointsLeft: sim.budget - spent };
  }
  function statusClass(n) {
    if (!sim.on) return '';
    if (sim.unlocked.has(n.id)) return 'unlocked';
    return Mech.canUnlock(tree, n, simCtx()).ok ? 'available' : 'locked';
  }
  function validate() {
    issues = Mech.validateTree(tree);
    ed.errNodes = new Set(issues.issues.filter(i => i.level === 'erro').flatMap(i => i.nodes || []));
    ed.errEdges = new Set(issues.issues.filter(i => i.edge).map(i => i.edge));
  }
  function changed() { save(); validate(); ed.render(); renderSide(ed.sel); }
  function addNode(typeId, x, y) {
    const t = types.find(t => t.id === typeId) || types[0];
    const pos = x != null ? { x, y } : ed.nextFreePos();
    const n = { id: U.id('tn'), type: t.id, label: t.label, icon: '', color: '', skillId: null, description: '', category: '', cost: 1, minLevel: null, pointsInTree: null, exclusiveGroup: '', hidden: false, isRoot: !tree.nodes.length, reqMode: 'all', reqs: [], x: Math.round(pos.x), y: Math.round(pos.y) };
    tree.nodes.push(n); ed.render(); ed.select({ node: n.id }); changed();
  }

  function renderHead() {
    clear(head);
    const nameIn = h('input.name-input', { value: tree.name, 'aria-label': 'Nome da árvore', style: { fontSize: '22px' }, oninput: e => { tree.name = e.target.value || 'Árvore'; save(); } });
    const ownerSel = h('select.input.sm', { style: { width: 'auto' }, 'aria-label': 'Associada a', onchange: e => { tree.fields.ownerType = e.target.value; tree.fields.ownerId = null; save(); renderHead(); } },
      [['project', 'Conjunto do projeto'], ['character', 'Personagem'], ['class', 'Classe']].map(([v, l]) => h('option', { value: v, selected: (tree.fields.ownerType || 'project') === v }, l)));
    head.append(h('div.row', { style: { alignItems: 'flex-end', marginBottom: '10px' } },
      h('div.grow', h('div.row', h('span.eyebrow', 'Árvore de habilidades'), h('a.small.muted', { href: '#/p/' + p.id + '/mech/trees' }, '← Árvores')), nameIn),
      h('div.row', h('span.small.muted', 'Associada a'), ownerSel,
        tree.fields.ownerType && tree.fields.ownerType !== 'project' ? h('div', { style: { minWidth: '200px' } }, refPicker({ kind: tree.fields.ownerType, multi: false, value: tree.fields.ownerId, allowCreate: false, onChange: v => { tree.fields.ownerId = v; if (tree.fields.ownerType === 'class' && v) { const c = Store.get(v); c.fields.treeId = tree.id; Store.saveEntity(c, { silent: true }); } save(); } })) : null,
        btn('', async () => { if (await confirmDeleteEntity(tree.id)) Nav.section('mech/trees'); }, { ic: 'trash', kind: 'danger', title: 'Excluir árvore' }))));
  }
  function renderBar() {
    clear(bar);
    const typeSel = h('select.input.sm', { style: { width: 'auto' }, 'aria-label': 'Tipo do novo nó' }, types.map(t => h('option', { value: t.id }, t.label)));
    const search = h('input.input.sm', { placeholder: 'Buscar nó…', style: { width: '150px' }, 'aria-label': 'Buscar nó', onkeydown: e => { if (e.key === 'Enter') { const q = U.norm(search.value); const n = tree.nodes.find(n => U.norm(n.label).includes(q)); if (n) ed.focusNode(n.id); else Toast.warn('Nenhum nó com esse nome.'); } } });
    const cats = U.uniq(tree.nodes.map(n => n.category).filter(Boolean));
    bar.append(
      !sim.on ? [typeSel, btn('Novo nó', () => addNode(typeSel.value), { small: true, ic: 'plus', kind: 'primary' }),
        btn(ed && ed.connectMode ? 'Conectando… (clique origem e destino)' : 'Modo conectar', () => { ed.connectMode = !ed.connectMode; ed.connectFrom = null; renderBar(); }, { small: true, ic: 'link', kind: ed && ed.connectMode ? 'cyan' : '' }),
        btn('Organizar', () => { ed.autoLayout(); }, { small: true, ic: 'layers' })] : null,
      search,
      cats.length ? h('select.input.sm', { style: { width: 'auto' }, 'aria-label': 'Filtrar categoria', onchange: e => { filterCat = e.target.value; ed.filter = filterCat ? n => n.category === filterCat : null; ed.render(); } }, h('option', { value: '' }, 'Todas as categorias'), cats.map(c => h('option', { value: c, selected: filterCat === c }, c))) : null,
      btn('PNG', () => svgToPng(ed.svg, U.slug(tree.name) + '.png', { bbox: ed.bbox() }), { small: true, ic: 'download', title: 'Exportar como imagem' }),
      btn('Tipos de nó', nodeTypesModal, { small: true }),
      h('span.spacer'),
      btn(sim.on ? 'Sair da simulação' : 'Simular desbloqueio', () => { sim.on = !sim.on; sim.unlocked.clear(); if (ed) { ed.o.readOnly = sim.on; ed.connectMode = false; } renderBar(); ed.render(); renderSide(null); }, { small: true, ic: 'play', kind: sim.on ? 'cyan' : '' }));
  }
  function nodeTypesModal() {
    const box = h('div.col');
    const render = () => {
      clear(box);
      types.forEach((t, i) => box.appendChild(h('div.linkrow',
        h('input', { type: 'color', value: t.color, 'aria-label': 'Cor', onchange: e => { t.color = e.target.value; Store.saveProject(); ed.render(); } }),
        h('input.input.sm', { value: t.label, 'aria-label': 'Nome', oninput: e => { t.label = e.target.value; Store.saveProject(); } }),
        h('select.input.sm', { style: { width: '130px' }, 'aria-label': 'Forma', onchange: e => { t.shape = e.target.value; Store.saveProject(); ed.render(); } }, [['round', 'Arredondado'], ['rect', 'Retângulo'], ['hex', 'Hexágono'], ['diamond', 'Losango']].map(([v, l]) => h('option', { value: v, selected: t.shape === v }, l))),
        btn('', () => { if (tree.nodes.some(n => n.type === t.id) || Store.list('skilltree').some(tr => (tr.nodes || []).some(n => n.type === t.id))) { Toast.warn('Este tipo está em uso por algum nó.'); return; } types.splice(i, 1); Store.saveProject(); render(); }, { ic: 'trash', small: true, title: 'Excluir tipo' }))));
      box.appendChild(btn('Novo tipo de nó', () => { types.push({ id: U.id('nt'), label: 'Novo tipo', color: '#8b7cf6', shape: 'round' }); Store.saveProject(); render(); }, { small: true, ic: 'plus' }));
    };
    render();
    Modal.open({ title: 'Tipos de nó (do projeto)', body: box, actions: [{ label: 'Fechar', kind: 'primary', onClick: () => { renderBar(); ed.render(); } }] });
  }

  function renderSide(sel) {
    clear(side);
    if (sim.on) return renderSim();
    const errs = issues.issues;
    side.appendChild(h('div.panel', h('div.panel-title', h('h3', 'Validação'), h('span.muted.small', tree.nodes.length + ' nós · ' + tree.edges.length + ' conexões')),
      errs.length ? h('ul.impact', errs.slice(0, 25).map(i => h('li', { style: { color: i.level === 'erro' ? 'var(--err)' : 'var(--warn)', cursor: i.nodes ? 'pointer' : null }, onclick: () => i.nodes && ed.focusNode(i.nodes[0]) }, i.text))) : h('div.formula-ok', tree.nodes.length ? 'Sem conexões inválidas, ciclos ou nós inalcançáveis.' : 'Árvore vazia.'),
      h('p.muted.small', { style: { marginTop: '6px' } }, 'Uma seta A → B significa: B exige A. Duplo clique no fundo cria um nó; arraste do ponto ciano para conectar; Delete remove a seleção.')));
    if (!sel) {
      const skillIds = new Set(tree.nodes.map(n => n.skillId).filter(Boolean));
      const users = Store.list('character').filter(c => c.mech && ((c.mech.treeIds || []).includes(tree.id) || [...(c.mech.skills || []), ...(c.mech.passives || []), ...(c.mech.classes || [])].some(x => skillIds.has(x.ref))));
      side.appendChild(h('div.panel', h('div.panel-title', icon('users'), h('h3', 'Personagens que usam esta árvore')),
        users.length ? h('div.mini-list', users.map(c => miniRow(c.id, 'nível ' + (c.mech.level || 1)))) : h('p.meta', 'Nenhum personagem conhece habilidades desta árvore ainda.')));
      return;
    }
    if (sel.edge) {
      const e = tree.edges.find(x => x.id === sel.edge); if (!e) return;
      const a = tree.nodes.find(n => n.id === e.from), b = tree.nodes.find(n => n.id === e.to);
      side.appendChild(h('div.panel', h('div.panel-title', h('h3', 'Conexão')), h('p.small', '"' + (b ? b.label : '?') + '" exige "' + (a ? a.label : '?') + '"'),
        fieldControl({ key: 'label', label: 'Rótulo (opcional)' }, e, v => { e.label = v; changed(); }),
        h('div.row', { style: { marginTop: '8px' } }, btn('Inverter direção', () => { [e.from, e.to] = [e.to, e.from]; changed(); }, { small: true }), btn('Remover conexão', () => ed.deleteSelection(), { small: true, kind: 'danger', ic: 'trash' }))));
      return;
    }
    const n = tree.nodes.find(x => x.id === sel.node); if (!n) return;
    const F = (k, label, type = 'text', extra = {}) => fieldControl({ key: k, label, type, ...extra }, n, v => { n[k] = v; changed(); });
    const linked = n.skillId ? Store.get(n.skillId) : null;
    side.appendChild(h('div.panel', h('div.panel-title', h('h3', 'Nó')),
      h('div.col',
        h('label.field', h('span.lbl', 'Tipo'), h('select.input', { onchange: e => { n.type = e.target.value; changed(); } }, types.map(t => h('option', { value: t.id, selected: n.type === t.id }, t.label)))),
        F('label', 'Nome'),
        h('div.form-grid', { style: { gridTemplateColumns: '1fr 1fr' } }, F('icon', 'Ícone'), h('label.field', h('span.lbl', 'Cor própria'), h('input', { type: 'color', value: n.color || (types.find(t => t.id === n.type) || {}).color || '#8b7cf6', 'aria-label': 'Cor', onchange: e => { n.color = e.target.value; changed(); } }))),
        h('label.field', h('span.lbl', 'Ligado à ficha de'), refPicker({ kinds: ['skill', 'passive', 'class', 'item'], multi: false, value: n.skillId, allowCreate: false, onChange: v => { n.skillId = v; const t = Store.get(v); if (t && (!n.label || types.some(x => x.label === n.label))) n.label = t.name; if (t && t.fields.iconText && !n.icon) n.icon = t.fields.iconText; changed(); } })),
        !linked ? btn('Criar habilidade a partir deste nó', async () => { const kind = (types.find(t => t.id === n.type) || {}).id === 'nt_passive' ? 'passive' : 'skill'; const s = await quickCreate(kind, n.label, { navigate: false, fields: { iconText: n.icon, summary: n.description, category: n.category } }); if (s) { n.skillId = s.id; changed(); } }, { small: true }) : btn('Abrir ficha de ' + linked.name, () => Nav.entity(linked.id), { small: true }),
        F('description', 'Descrição', 'textarea', { rows: 2 }),
        h('label.field', h('span.lbl', 'Categoria'), (() => { const inp = h('input.input', { value: n.category || '', list: 'tree-cats', 'aria-label': 'Categoria', oninput: e => { n.category = e.target.value; changed(); } }); return [inp, h('datalist#tree-cats', Store.listValues('skillCategories').map(c => h('option', { value: c })))]; })()),
        h('div.form-grid', { style: { gridTemplateColumns: '1fr 1fr' } }, F('cost', 'Custo (pontos)', 'number'), F('minLevel', 'Nível mínimo', 'number'), F('pointsInTree', 'Pontos já gastos na árvore', 'number'), F('exclusiveGroup', 'Grupo exclusivo', 'text', { hint: 'Nós com o mesmo grupo: só um pode ser escolhido.' })),
        h('label.check', h('input', { type: 'checkbox', checked: !!n.isRoot, onchange: e => { n.isRoot = e.target.checked; changed(); } }), 'Ponto de início da árvore'),
        h('label.check', h('input', { type: 'checkbox', checked: !!n.hidden, onchange: e => { n.hidden = e.target.checked; changed(); } }), 'Nó oculto (secreto para o jogador)'),
        h('label.field', h('span.lbl', 'Como combinar as exigências'), h('select.input', { onchange: e => { n.reqMode = e.target.value; changed(); } }, [['all', 'Exigir todos os nós anteriores e requisitos'], ['any', 'Basta cumprir um deles']].map(([v, l]) => h('option', { value: v, selected: (n.reqMode || 'all') === v }, l)))),
        h('div.field', h('span.lbl', 'Requisitos extras'), reqListEditor(n, 'reqs', { nodes: tree.nodes, onChange: () => { save(); validate(); ed.render(); } })),
        h('div.row', btn('Duplicar', () => { const c = U.clone(n); c.id = U.id('tn'); c.x += 24; c.y += 24; c.isRoot = false; tree.nodes.push(c); ed.render(); ed.select({ node: c.id }); changed(); }, { small: true, ic: 'copy' }), btn('Excluir nó', () => ed.deleteSelection(), { small: true, kind: 'danger', ic: 'trash' })))));
  }
  function renderSim() {
    const ctx = simCtx();
    const flagsReqs = tree.nodes.flatMap(n => (n.reqs || []).filter(r => ['event', 'choice', 'text'].includes(r.type)).map(r => ({ r, n })));
    side.append(h('div.panel', h('div.panel-title', h('h3', 'Simulação')),
      h('p.muted.small', 'Clique nos nós para desbloquear (ou bloquear de novo). As regras configuradas são aplicadas de verdade.'),
      h('label.field', h('span.lbl', 'Personagem (nível, atributos, itens, classes)'), h('select.input', { onchange: e => { sim.charId = e.target.value || null; const c = Store.get(sim.charId); if (c && c.mech) sim.budget = Number(c.mech.skillPoints) || sim.budget; sim.unlocked.clear(); ed.render(); renderSide(null); renderBar(); } }, h('option', { value: '' }, 'Nenhum (só a estrutura)'), Store.list('character').map(c => h('option', { value: c.id, selected: sim.charId === c.id }, c.name + (c.mech && c.mech.enabled ? ' · nível ' + (c.mech.level || 1) : ''))))),
      h('label.field', h('span.lbl', 'Pontos disponíveis'), h('input.input', { type: 'number', value: sim.budget, 'aria-label': 'Pontos disponíveis', onchange: e => { sim.budget = Number(e.target.value) || 0; ed.render(); renderSide(null); } })),
      h('div.stat-row', { style: { gridTemplateColumns: '1fr 1fr' } }, h('div.stat', h('b', ctx.spent), h('span', 'gastos')), h('div.stat', h('b', ctx.pointsLeft), h('span', 'restantes'))),
      flagsReqs.length ? h('div.field', h('span.lbl', 'Condições narrativas cumpridas'), flagsReqs.map(({ r, n }) => h('label.check.small', h('input', { type: 'checkbox', checked: sim.flags.has(r.id), onchange: e => { e.target.checked ? sim.flags.add(r.id) : sim.flags.delete(r.id); ed.render(); renderSide(null); } }), n.label + ': ' + Mech.reqLabel(r)))) : null,
      sim.unlocked.size && sim.charId ? btn('Conceder ao personagem as habilidades desbloqueadas', () => {
        const c = Store.get(sim.charId); const m = Mech.ensureMech(c); m.enabled = true; let k = 0;
        for (const n of tree.nodes.filter(n => sim.unlocked.has(n.id) && n.skillId)) {
          const t = Store.get(n.skillId); if (!t) continue;
          if (t.kind === 'skill' && !m.skills.some(s => s.ref === t.id)) { m.skills.push({ ref: t.id, level: 1 }); k++; }
          if (t.kind === 'passive' && !m.passives.some(s => s.ref === t.id)) { m.passives.push({ ref: t.id, active: true }); k++; }
          if (t.kind === 'class' && !m.classes.some(s => s.ref === t.id)) { m.classes.push({ ref: t.id, mode: 'opcional' }); k++; }
        }
        m.skillPoints = Math.max(0, (Number(m.skillPoints) || 0) - ctx.spent);
        m.history.unshift({ id: U.id('h'), date: U.now(), text: 'Árvore "' + tree.name + '": ' + ctx.spent + ' pontos gastos, ' + k + ' habilidade(s) recebida(s).' });
        if (!m.treeIds.includes(tree.id)) m.treeIds.push(tree.id);
        Store.saveEntity(c, { silent: true }); Toast.ok(k + ' habilidade(s) adicionada(s) a ' + c.name + '.');
      }, { kind: 'primary', small: true }) : null,
      btn('Reiniciar', () => { sim.unlocked.clear(); ed.render(); renderSide(null); }, { small: true })));
    if (ed.sel && ed.sel.node) {
      const n = tree.nodes.find(x => x.id === ed.sel.node);
      if (n) { const r = Mech.canUnlock(tree, n, ctx); side.appendChild(h('div.panel', h('h3', n.label), sim.unlocked.has(n.id) ? h('p.formula-ok', 'Desbloqueado.') : r.ok ? h('p.formula-ok', 'Pode ser desbloqueado.') : h('div', h('p.small', 'Falta:'), h('ul.impact', r.missing.map(t => h('li', t)))))); }
    }
  }
  function onNodeClick(n) {
    if (!sim.on) return false;
    if (sim.unlocked.has(n.id)) {
      const dependents = tree.edges.filter(e => e.from === n.id && sim.unlocked.has(e.to));
      if (dependents.length) { Toast.warn('Bloqueie antes os nós que dependem deste.'); }
      else sim.unlocked.delete(n.id);
    } else {
      const r = Mech.canUnlock(tree, n, simCtx());
      if (r.ok) sim.unlocked.add(n.id); else Toast.warn('Não dá ainda: ' + r.missing.join('; '));
    }
    ed.sel = { node: n.id }; ed.render(); renderSide(null);
    return true;
  }

  page.append(head, bar, h('div.viz-layout', vizBox, resizableSide(side, 'tree'), side));
  renderHead();
  setTimeout(() => {
    ed = new NodeEditor(vizBox, tree, {
      types, onChange: () => changed(), onSelect: s => renderSide(s), statusClass, onNodeClick, readOnly: sim.on,
      sub: n => { const t = types.find(x => x.id === n.type); return [t ? t.label : '', n.cost ? n.cost + ' pt' : '', n.minLevel ? 'nv ' + n.minLevel : ''].filter(Boolean).join(' · '); },
      onCreateAt: (x, y) => { if (!sim.on) addNode(types[0].id, x, y); },
    });
    attachNodeControls(ed, vizBox, [['Clique (simulação)', 'desbloquear / bloquear']]);
    validate(); ed.render(); renderBar(); renderSide(null); ed.fit();
  }, 0);
};
