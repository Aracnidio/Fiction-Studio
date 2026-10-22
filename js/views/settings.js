/* Fiction Studio — configurações do projeto: módulos, listas, tipos de relação, layout das fichas, integridade e dados. */
'use strict';

const LIST_LABELS = {
  storyRoles: 'Papéis na história', characterStatus: 'Status de personagem', locationTypes: 'Tipos de localidade', storylineStatus: 'Status de storyline', storylineTypes: 'Tipos de storyline',
  eventTypes: 'Tipos de evento', eventStatus: 'Estados de evento', orgTypes: 'Tipos de organização', loreCategories: 'Categorias de anotações', stepStatus: 'Estados das etapas',
  narrativeUnits: 'Níveis da estrutura narrativa (do maior ao menor)', imgCatCharacter: 'Categorias de imagem: personagens', imgCatLocation: 'Categorias de imagem: localidades',
  imgCatStoryline: 'Categorias de imagem: storylines', imgCatEvent: 'Categorias de imagem: eventos', imgCatOrganization: 'Categorias de imagem: organizações',
  skillCategories: 'Categorias de habilidades ativas', passiveCategories: 'Categorias de passivas', passiveActivation: 'Funcionamento de passivas', itemCategories: 'Categorias de itens', itemRarities: 'Raridades', effectPolarity: 'Natureza dos efeitos',
};

Views.settings = function (main, sub = 'general') {
  const p = Store.S.p;
  const page = h('div.page'); main.appendChild(page);
  const tabs = [['general', 'Geral'], ['lists', 'Listas e categorias'], ['relations', 'Tipos de relação'], ['fields', 'Campos das fichas'], ['integrity', 'Integridade'], ['data', 'Dados']];
  page.append(pageHead('Configurações do projeto', null), h('div.tabs', tabs.map(([id, l]) => h('button.tab' + (id === sub ? '.active' : ''), { onclick: () => Nav.go('/p/' + p.id + '/settings/' + id) }, l))));
  const body = h('div'); page.appendChild(body);
  ({ general: setGeneral, lists: setLists, relations: setRelations, fields: setFields, integrity: setIntegrity, data: setData }[sub] || setGeneral)(body);
};

function setGeneral(body) {
  const p = Store.S.p;
  const tog = (obj, key, label, hint, after) => h('label.check', { style: { alignItems: 'flex-start' } }, h('input', { type: 'checkbox', checked: !!obj[key], onchange: e => { obj[key] = e.target.checked; Store.saveProject(); App.renderSidebar(); if (after) after(); } }), h('span', label, hint ? h('div.muted.small', hint) : null));
  body.append(
    h('div.panel', h('div.panel-title', h('h3', p.name), btn('Editar dados do projeto', () => projectForm(p), { small: true, ic: 'edit' })), h('p.muted', p.workType + ' · criado em ' + U.fmtDate(p.createdAt))),
    h('div.panel', h('div.panel-title', h('h3', 'Módulos')), h('div.col',
      tog(p.config.modules, 'organizations', 'Organizações', 'Facções, guildas, famílias, governos. Aparecem no grafo.'),
      tog(p.config.modules, 'branching', 'Ramificações narrativas', 'Cenas, escolhas, rotas e finais nas storylines (útil para visual novels e histórias interativas).'),
      tog(p.mechanics, 'enabled', 'Sistema de jogo: atributos, combate, habilidades e progressão', 'Totalmente opcional. Desligar só oculta o módulo; nada é apagado.', () => App.refresh()))),
    p.mechanics.enabled ? h('div.panel', h('div.panel-title', h('h3', 'Subsistemas do jogo')), h('p.muted.small', 'Ative apenas o que faz sentido para esta obra.'),
      h('div.form-grid', [['attributes', 'Atributos e status'], ['resources', 'Recursos de combate'], ['actives', 'Habilidades ativas'], ['passives', 'Habilidades passivas'], ['tree', 'Árvores de habilidades'], ['classes', 'Classes e especializações'], ['items', 'Equipamentos e itens'], ['resist', 'Resistências e fraquezas'], ['effects', 'Efeitos de status'], ['progression', 'Progressão e evolução'], ['rules', 'Fórmulas e regras'], ['history', 'Histórico de alterações']].map(([k, l]) => tog(p.mechanics.modules, k, l)))) : null,
    h('div.panel', h('div.panel-title', h('h3', 'Aparência')), h('div.row', btn('Tema escuro', () => App.setTheme('dark'), { small: true }), btn('Tema claro', () => App.setTheme('light'), { small: true }), btn('Configurações gerais', globalSettings, { small: true, ic: 'gear' }))));
}

function setLists(body) {
  const p = Store.S.p;
  const mechKeys = ['skillCategories', 'passiveCategories', 'passiveActivation', 'itemCategories', 'itemRarities', 'effectPolarity'];
  const keys = Object.keys(LIST_LABELS).filter(k => p.mechanics.enabled || !mechKeys.includes(k));
  const fieldsUsing = key => Object.keys(Schema.KINDS).flatMap(kind => Schema.allFields(kind).filter(f => f.list === key).map(f => ({ kind, key: f.key })));
  function renameValue(key, oldV, newV) {
    let n = 0;
    for (const { kind, key: fk } of fieldsUsing(key)) for (const e of Store.list(kind)) if (e.fields[fk] === oldV) { e.fields[fk] = newV; Store.saveEntity(e, { silent: true }); n++; }
    if (key === 'narrativeUnits') for (const s of Store.list('storyline')) for (const st of s.steps || []) if (st.unit === oldV) { st.unit = newV; Store.saveEntity(s, { silent: true }); n++; }
    if (key === 'stepStatus') for (const s of Store.list('storyline')) for (const st of s.steps || []) if (st.status === oldV) { st.status = newV; Store.saveEntity(s, { silent: true }); n++; }
    if (key.startsWith('imgCat')) for (const im of Store.S.imgs.values()) for (const l of im.links) if (l.category === oldV) { l.category = newV; Store.saveImage(im); n++; }
    return n;
  }
  function usage(key, v) {
    let n = 0;
    for (const { kind, key: fk } of fieldsUsing(key)) n += Store.list(kind).filter(e => e.fields[fk] === v).length;
    if (key.startsWith('imgCat')) n += [...Store.S.imgs.values()].filter(im => im.links.some(l => l.category === v)).length;
    return n;
  }
  body.appendChild(h('p.muted', 'Todas as opções de seleção do projeto. Renomear uma opção atualiza os registros que a usam.'));
  for (const key of keys) {
    const vals = p.config.lists[key] = p.config.lists[key] || [];
    const box = h('div.chips');
    const render = () => {
      clear(box);
      vals.forEach((v, i) => box.appendChild(h('span.chip', { style: { height: '28px' } }, v,
        h('button', { type: 'button', title: 'Mover para a esquerda', 'aria-label': 'Mover', onclick: () => { U.move(vals, i, i - 1); Store.saveProject(); render(); } }, icon('left', 12)),
        h('button', { type: 'button', title: 'Renomear', 'aria-label': 'Renomear', onclick: async () => { const n = await Modal.prompt('Renomear opção', 'Novo nome', v); if (n && n !== v) { const c = renameValue(key, v, n); vals[i] = n; Store.saveProject(); render(); if (c) Toast.ok(c + ' registro(s) atualizado(s).'); } } }, icon('edit', 12)),
        h('button', { type: 'button', title: 'Excluir', 'aria-label': 'Excluir', onclick: async () => { const u = usage(key, v); if (u && !await Modal.confirm('Excluir opção', '"' + v + '" está em uso em ' + u + ' registro(s). Eles manterão o valor, marcado como "fora da lista".', { okLabel: 'Excluir mesmo assim' })) return; vals.splice(i, 1); Store.saveProject(); render(); } }, icon('x', 12)))));
      box.appendChild(btn('Adicionar', async () => { const n = await Modal.prompt('Nova opção', LIST_LABELS[key]); if (n) { Store.addListValue(key, n); render(); } }, { small: true, ic: 'plus' }));
    };
    render();
    body.appendChild(h('div.panel', h('div.panel-title', h('h3', LIST_LABELS[key])), box));
  }
}

function setRelations(body) {
  const list = Store.relTypes();
  const render = () => {
    clear(body);
    body.append(h('div.row', { style: { marginBottom: '12px' } }, btn('Novo tipo de relação', async () => { if (await relationTypeModal()) render(); }, { kind: 'primary', ic: 'plus' }), h('span.muted.small', 'Relações direcionais mostram o rótulo inverso na outra ficha; recíprocas usam o mesmo rótulo.')),
      h('div.table-wrap', h('table.table', h('thead', h('tr', h('th', 'Rótulo'), h('th', 'Inverso'), h('th', 'Categoria'), h('th', 'Entre'), h('th', 'Em uso'), h('th', ''))),
        h('tbody', list.map((t, i) => {
          const used = [...Store.S.rels.values()].filter(r => r.typeId === t.id).length;
          return h('tr', h('td', h('b', t.label)), h('td', t.symmetric ? h('span.muted', 'recíproca') : t.reverse), h('td', Schema.EDGE_CATS[t.cat] || t.cat, t.genealogy ? h('span.pill.cy', { style: { marginLeft: '6px' } }, 'genealogia') : null),
            h('td.small', [t.from, t.to].map(l => l.includes('*') ? 'qualquer' : l.map(k => Schema.kindLabel(k)).join('/')).join(' → ')), h('td.num', used),
            h('td', h('div.row.nowrap', btn('', async () => { if (await relationTypeModal(t)) render(); }, { ic: 'edit', small: true, title: 'Editar' }),
              btn('', async () => {
                if (used && !await Modal.confirm('Excluir tipo de relação', 'Há ' + used + ' relação(ões) deste tipo. Elas serão removidas também.', { danger: true, okLabel: 'Excluir tipo e relações' })) return;
                if (!used && !await Modal.confirm('Excluir tipo de relação', 'Excluir "' + t.label + '"?', { danger: true, okLabel: 'Excluir' })) return;
                [...Store.S.rels.values()].filter(r => r.typeId === t.id).forEach(r => Store.deleteRelation(r.id));
                if (used) Store.addLog(used + ' relação(ões) "' + t.label + '" removidas junto com o tipo.');
                list.splice(i, 1); Store.saveProject(); render();
              }, { ic: 'trash', small: true, title: 'Excluir' }))));
        })))));
  };
  render();
}

function setFields(body) {
  const p = Store.S.p;
  let kind = setFields.kind || 'character';
  const kinds = Schema.NARRATIVE_KINDS.concat(['lore']).concat(p.mechanics.enabled ? Schema.MECH_KINDS.filter(k => k !== 'skilltree') : []);
  const render = () => {
    clear(body);
    const lay = p.config.layout[kind] = p.config.layout[kind] || { labels: {}, hidden: {}, sectionOrder: [] };
    lay.labels = lay.labels || {}; lay.hidden = lay.hidden || {};
    const secs = Schema.sections(kind, p);
    if (!lay.sectionOrder || !lay.sectionOrder.length) lay.sectionOrder = secs.map(s => s.id);
    const defs = p.config.customFieldDefs[kind] = p.config.customFieldDefs[kind] || [];
    body.append(
      h('div.toolbar', h('select.input', { 'aria-label': 'Tipo de ficha', onchange: e => { kind = setFields.kind = e.target.value; render(); } }, kinds.map(k => h('option', { value: k, selected: k === kind }, Schema.kindLabel(k, true)))),
        h('span.muted.small', 'Renomeie ou oculte campos e reordene as seções. Nada é apagado: campos ocultos mantêm o conteúdo.')),
      h('div.panel', h('div.panel-title', h('h3', 'Campos do projeto para ' + Schema.kindLabel(kind, true).toLowerCase())), h('p.muted.small', 'Aparecem em todas as fichas deste tipo, numa seção própria.'),
        h('div.linklist', defs.map((d, i) => h('div.linkrow',
          h('input.input.sm', { value: d.label, 'aria-label': 'Nome do campo', oninput: e => { d.label = e.target.value; Store.saveProject(); } }),
          h('select.input.sm', { style: { width: '130px' }, 'aria-label': 'Tipo', onchange: e => { d.type = e.target.value; Store.saveProject(); } }, [['text', 'Texto curto'], ['textarea', 'Texto longo'], ['number', 'Número'], ['bool', 'Sim/não']].map(([v, l]) => h('option', { value: v, selected: (d.type || 'text') === v }, l))),
          btn('', () => { U.move(defs, i, i - 1); Store.saveProject(); render(); }, { ic: 'up', small: true, title: 'Subir', disabled: !i }),
          btn('', async () => { if (await Modal.confirm('Remover campo', 'Os valores já preenchidos ficam guardados nas fichas, mas deixam de aparecer.', { okLabel: 'Remover' })) { defs.splice(i, 1); Store.saveProject(); render(); } }, { ic: 'trash', small: true, title: 'Remover' })))),
        btn('Adicionar campo do projeto', () => { defs.push({ id: U.id('pf'), label: 'Novo campo', type: 'text' }); Store.saveProject(); render(); }, { small: true, ic: 'plus' })),
      lay.sectionOrder.map((sid, si) => {
        const sec = Schema.KINDS[kind].sections.find(s => s.id === sid); if (!sec) return null;
        return h('div.panel', h('div.panel-title', h('h3', sec.title),
          btn('', () => { U.move(lay.sectionOrder, si, si - 1); Store.saveProject(); render(); }, { ic: 'up', small: true, title: 'Subir seção', disabled: !si }),
          btn('', () => { U.move(lay.sectionOrder, si, si + 1); Store.saveProject(); render(); }, { ic: 'down', small: true, title: 'Descer seção', disabled: si === lay.sectionOrder.length - 1 })),
          h('div.form-grid', sec.fields.map(f => h('div.row.nowrap', { style: { gap: '6px' } },
            h('input', { type: 'checkbox', checked: !lay.hidden[f.key], title: 'Visível', 'aria-label': 'Visível: ' + f.label, onchange: e => { if (e.target.checked) delete lay.hidden[f.key]; else lay.hidden[f.key] = true; Store.saveProject(); } }),
            h('input.input.sm', { value: lay.labels[f.key] || f.label, 'aria-label': 'Rótulo de ' + f.label, oninput: e => { if (e.target.value && e.target.value !== f.label) lay.labels[f.key] = e.target.value; else delete lay.labels[f.key]; Store.saveProject(); } })))));
      }));
  };
  render();
}

function setIntegrity(body) {
  const p = Store.S.p;
  const render = () => {
    clear(body);
    const probs = Store.integrityScan();
    const demo = [...Store.S.ents.values()].filter(e => e.demo);
    const demoRels = [...Store.S.rels.values()].filter(r => r.demo);
    body.append(
      h('div.panel', h('div.panel-title', h('h3', 'Verificação de vínculos'), probs.some(x => x.fix) ? btn('Corrigir tudo', () => { probs.forEach(x => x.fix && x.fix()); Toast.ok('Vínculos corrigidos.'); render(); }, { small: true, kind: 'primary' }) : null),
        probs.length ? h('div.linklist', probs.map(x => h('div.linkrow', h('div.grow.small', x.text), x.entity ? entityLink(x.entity.id) : null, x.fix ? btn('Corrigir', () => { x.fix(); render(); }, { small: true }) : h('span.muted.small', 'corrija manualmente')))) : h('p.formula-ok', 'Nenhum vínculo quebrado.')),
      demo.length || demoRels.length ? h('div.panel', h('div.panel-title', h('h3', 'Dados de exemplo')), h('p', demo.length + ' registros e ' + demoRels.length + ' relações de exemplo.'),
        btn('Remover dados de exemplo', async () => { if (!await Modal.confirm('Remover exemplos', 'Remover todos os registros marcados como exemplo? Registros seus não são tocados (apenas perdem vínculos com os exemplos).', { danger: true, okLabel: 'Remover' })) return; demoRels.forEach(r => Store.deleteRelation(r.id)); demo.forEach(e => Store.deleteEntity(e.id, { keepImages: false })); Toast.ok('Exemplos removidos.'); App.renderSidebar(); render(); }, { kind: 'danger', small: true })) : null,
      h('div.panel', h('div.panel-title', h('h3', 'Registro de alterações automáticas'), p.integrityLog.length ? btn('Limpar registro', () => { p.integrityLog = []; Store.saveProject(); render(); }, { small: true }) : null),
        h('p.muted.small', 'Quando um registro é excluído, as relações e vínculos removidos ficam anotados aqui para você revisar.'),
        p.integrityLog.length ? h('div.table-wrap', h('table.table', h('tbody', p.integrityLog.slice(0, 200).map(l => h('tr', h('td.small.muted', { style: { whiteSpace: 'nowrap' } }, U.fmtDate(l.date)), h('td.small', l.text)))))) : h('p.muted', 'Vazio.')));
  };
  render();
}

function setData(body) {
  const p = Store.S.p;
  body.append(
    h('div.panel', h('div.panel-title', h('h3', 'Exportar')), h('p', 'Gera um arquivo .fsproj.zip com todos os registros, relações, tags, configurações, sistema de jogo e imagens (originais e miniaturas). O formato está descrito no README.'),
      btn('Exportar projeto', async () => { try { const n = await IO.exportProject(p.id); Toast.ok('Exportado (' + U.fmtBytes(n) + ').'); } catch (e) { Toast.err('Falha ao exportar: ' + e.message); } }, { kind: 'primary', ic: 'download' })),
    h('div.panel', h('div.panel-title', h('h3', 'Duplicar')), h('p', 'Cria uma versão alternativa independente, com todo o conteúdo copiado.'),
      btn('Duplicar projeto', async () => { const d = await IO.duplicateProject(p.id); Toast.ok('Cópia criada: ' + d.name); Nav.go('/p/' + d.id); }, { ic: 'copy' })),
    h('div.panel', h('div.panel-title', h('h3', 'Importar')), h('p', 'A importação é feita na página Projetos e sempre cria um projeto novo, sem sobrescrever este.'), btn('Ir para Projetos', () => Nav.go('/projects'), {})),
    h('div.panel', h('div.panel-title', h('h3', 'Excluir projeto')), h('p', 'Apaga este projeto e todo o seu conteúdo. Outros projetos não são afetados.'), btn('Excluir projeto…', () => deleteProjectFlow(p), { kind: 'danger', ic: 'trash' })));
}
