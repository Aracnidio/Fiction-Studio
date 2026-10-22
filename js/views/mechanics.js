/* Fiction Studio — Sistema de jogo: atributos, variáveis, tipos de dano, slots, progressão, regras, modelos
   e as abas mecânicas das fichas de habilidades, passivas, classes, itens, efeitos e eventos. */
'use strict';

const MECH_SUBS = [
  ['overview', 'Visão geral', 'layers'], ['attributes', 'Atributos e recursos', 'stats'], ['skills', 'Habilidades ativas', 'sword', 'actives'], ['passives', 'Habilidades passivas', 'shield', 'passives'],
  ['trees', 'Árvores de habilidades', 'tree', 'tree'], ['classes', 'Classes e especializações', 'crown', 'classes'], ['items', 'Equipamentos e itens', 'gem', 'items'],
  ['effects', 'Efeitos, dano e slots', 'flame'], ['progression', 'Progressão', 'trending', 'progression'], ['rules', 'Regras e fórmulas', 'formula', 'rules'], ['templates', 'Modelos', 'template'],
];
const MECH_KIND_BY_SUB = { skills: 'skill', passives: 'passive', trees: 'skilltree', classes: 'class', items: 'item' };

Views.mech = function (main, sub = 'overview') {
  const p = Store.S.p;
  if (!p.mechanics.enabled) {
    const page = h('div.page'); main.appendChild(page);
    page.append(pageHead('Sistemas de RPG', 'Atributos, combate, habilidades, árvores, classes, itens e progressão. Totalmente opcional: obras sem mecânicas não precisam disto.'),
      h('div.panel', h('p', 'O sistema de jogo está desligado neste projeto.'), h('div.row', btn('Ativar do zero', () => { p.mechanics.enabled = true; Store.saveProject(); App.renderSidebar(); App.refresh(); }, { kind: 'primary' }),
        IO.allTemplates().map(t => btn('Ativar com modelo "' + t.name + '"', () => { IO.applyTemplate(t, { replace: !p.mechanics.attributes.length }); App.renderSidebar(); App.refresh(); Toast.ok('Modelo aplicado.'); })))));
    return;
  }
  if (MECH_KIND_BY_SUB[sub]) return Views.list(main, MECH_KIND_BY_SUB[sub]);
  if (sub === 'effects') return mechEffectsPage(main);
  ({ overview: mechOverview, attributes: mechAttributes, progression: mechProgression, rules: mechRules, templates: mechTemplates }[sub] || mechOverview)(main);
};

function mechOverview(main) {
  const p = Store.S.p; const M = p.mechanics;
  const page = h('div.page'); main.appendChild(page);
  const errs = Mech.validateAll();
  const stat = (n, l, sub) => h('div.stat', { onclick: () => Nav.section('mech/' + sub) }, h('b', n), h('span', l));
  page.append(pageHead('Sistemas de RPG', 'Projete seu próprio sistema: nada aqui é obrigatório. Os valores das fichas são calculados de verdade a partir destas regras.'),
    h('div.stat-row', stat(M.attributes.length, 'Atributos', 'attributes'), stat(Store.list('skill').length, 'Habilidades ativas', 'skills'), stat(Store.list('passive').length, 'Passivas', 'passives'),
      stat(Store.list('skilltree').length, 'Árvores', 'trees'), stat(Store.list('class').length, 'Classes', 'classes'), stat(Store.list('item').length, 'Itens', 'items'),
      stat(Store.list('effect').length, 'Efeitos de status', 'effects'), stat(M.rules.length, 'Regras', 'rules')),
    Object.keys(errs).length ? h('div.notice.err', { style: { marginTop: '14px' } }, h('b', 'Fórmulas com problema: '), Object.entries(errs).map(([id, e]) => ((M.attributes.find(a => a.id === id) || {}).name || id) + ' — ' + e).join('; ')) : null,
    h('div.panel', { style: { marginTop: '14px' } }, h('div.panel-title', h('h3', 'Personagens com fichas de jogo')),
      (() => { const cs = Store.list('character').filter(c => c.mech && c.mech.enabled); return cs.length ? h('div.linklist', cs.map(c => h('div.row', entityLink(c.id), h('span.muted.small', 'nível ' + (c.mech.level || 1)), btn('Abrir', () => Nav.entity(c.id, 'combate'), { small: true })))) : h('p.muted.small', 'Nenhum ainda. Abra um personagem e use a aba "Combate e Progressão".'); })()),
    h('div.panel', h('div.panel-title', h('h3', 'Desligar')), h('p.muted.small', 'Desativar oculta o módulo; os dados são mantidos.'), btn('Desativar sistema de jogo', () => { M.enabled = false; Store.saveProject(); App.renderSidebar(); Nav.section(''); }, { small: true })));
}

/* ---------- atributos ---------- */
function mechAttributes(main) {
  const p = Store.S.p; const M = p.mechanics;
  const page = h('div.page'); main.appendChild(page);
  const list = h('div.col', { style: { gap: '8px' } });
  const preview = h('div');
  let previewChar = (Store.list('character').find(c => c.mech && c.mech.enabled) || {}).id || '';
  let open = null;
  const save = U.debounce(() => { Store.saveProject(); renderPreview(); renderErrors(); }, 300);
  const errBox = h('div');
  function renderErrors() { clear(errBox); const errs = Mech.validateAll(); if (Object.keys(errs).length) errBox.appendChild(h('div.notice.err', Object.entries(errs).map(([id, e]) => h('div', h('b', (M.attributes.find(a => a.id === id) || M.variables.find(v => v.id === id) || {}).name || '?'), ': ' + e)))); }
  function attrCard(a, i) {
    const syms = Mech.symbols();
    const isOpen = open === a.id;
    const head = h('div.row.nowrap', { style: { cursor: 'pointer' }, onclick: () => { open = isOpen ? null : a.id; render(); } },
      h('span.drag-handle', icon('layers', 14)), h('b', (a.icon ? a.icon + ' ' : '') + a.name), a.code ? h('span.kbd', a.code) : null,
      h('span.pill', ({ int: 'inteiro', decimal: 'decimal', percent: 'percentual', bool: 'sim/não', scale: 'escala', qualitative: 'qualitativo' })[a.dataType] || a.dataType),
      a.derived ? h('span.pill.ac', 'calculado') : null, a.isResource ? h('span.pill.cy', 'recurso') : null, a.highlight ? h('span.pill.warn', 'destaque') : null,
      h('span.muted.small.grow', { style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, a.derived ? '= ' + Formula.toDisplay(a.formula, syms) : (a.dataType === 'qualitative' ? (a.options || []).join(' / ') : (a.min !== '' && a.min != null ? a.min : '') + '…' + (a.max !== '' && a.max != null ? a.max : '') + ' · padrão ' + a.default)),
      h('span.muted.small', (M.attrCategories.find(c => c.id === a.categoryId) || {}).name || ''));
    const card = h('div.mech-card', head);
    if (isOpen) card.appendChild(attrForm(a, i));
    return card;
  }
  function attrForm(a, i) {
    const syms = Mech.symbols();
    const F = (k, label, type = 'text', extra = {}) => fieldControl({ key: k, label, type, ...extra }, a, v => { a[k] = v; save(); });
    const fIn = h('input.input.mono', { value: Formula.toDisplay(a.formula, syms), placeholder: 'Ex.: [Vitalidade] * 20 + nivel * 5', 'aria-label': 'Fórmula' });
    const fMsg = h('div');
    const checkF = () => {
      clear(fMsg);
      if (!fIn.value.trim()) { a.formula = ''; save(); return; }
      const c = Formula.toCanonical(fIn.value, syms.filter(s => s.id !== a.id).concat(syms.filter(s => s.id === a.id)));
      if (c.unknown.length) { fMsg.appendChild(h('div.formula-err', 'Não encontrado: ' + c.unknown.join(', '))); return; }
      const chk = Formula.check(c.text, syms, ['nivel', 'level', 'xp']);
      if (!chk.ok) { fMsg.appendChild(h('div.formula-err', chk.error)); return; }
      a.formula = c.text; save();
      const errs = Mech.validateAll();
      fMsg.appendChild(errs[a.id] ? h('div.formula-err', errs[a.id]) : h('div.formula-ok', 'Fórmula válida. Usa: ' + ([...Formula.refs(chk.ast)].map(r => r.startsWith('$') ? (syms.find(s => '$' + s.id === r) || {}).name : r).join(', ') || 'só números')));
    };
    fIn.addEventListener('input', U.debounce(checkF, 300));
    setTimeout(checkF, 0);
    const optsIn = h('input.input', { value: (a.options || []).join(', '), placeholder: 'Baixo, Médio, Alto, Crítico', 'aria-label': 'Níveis', oninput: e => { a.options = e.target.value.split(',').map(x => x.trim()).filter(Boolean); save(); } });
    const catSel = h('select.input', { 'aria-label': 'Categoria', onchange: async e => {
      if (e.target.value === '__new') { const n = await Modal.prompt('Nova categoria de atributos', 'Nome'); if (n) { const c = { id: U.id('ac'), name: n }; M.attrCategories.push(c); a.categoryId = c.id; } Store.saveProject(); render(); return; }
      a.categoryId = e.target.value || null; save();
    } }, h('option', { value: '' }, 'Sem categoria'), M.attrCategories.map(c => h('option', { value: c.id, selected: a.categoryId === c.id }, c.name)), h('option', { value: '__new' }, '+ Nova categoria…'));
    const derivedCb = h('input', { type: 'checkbox', checked: !!a.derived, onchange: e => { a.derived = e.target.checked; Store.saveProject(); render(); } });
    return h('div.col', { style: { marginTop: '10px' } },
      h('div.form-grid',
        F('name', 'Nome'), F('code', 'Código curto (usado em fórmulas)', 'text', { hint: 'Ex.: FOR. Pode escrever o código direto ou [Nome] na fórmula.' }), F('icon', 'Ícone (emoji ou símbolo)'),
        h('label.field', h('span.lbl', 'Categoria'), catSel),
        h('label.field', h('span.lbl', 'Tipo de dado'), h('select.input', { onchange: e => { a.dataType = e.target.value; Store.saveProject(); render(); } }, [['int', 'Número inteiro'], ['decimal', 'Número decimal'], ['percent', 'Porcentagem'], ['bool', 'Sim / não'], ['scale', 'Escala personalizada'], ['qualitative', 'Qualitativo (níveis nomeados)']].map(([v, l]) => h('option', { value: v, selected: a.dataType === v }, l)))),
        a.dataType === 'qualitative' ? h('label.field', h('span.lbl', 'Níveis, em ordem (vírgulas)'), optsIn) : null,
        a.dataType === 'bool' ? null : F('default', 'Valor padrão / inicial'),
        Mech.isNumeric(a) ? [F('min', 'Mínimo', 'number'), F('max', 'Máximo', 'number'), F('unit', 'Unidade')] : null,
        F('description', 'Descrição', 'textarea', { wide: true, rows: 2 })),
      Mech.isNumeric(a) ? h('div.panel', { style: { marginTop: 0 } },
        h('label.check', derivedCb, 'Atributo calculado (derivado de outros por fórmula)'),
        a.derived ? h('div.col', { style: { marginTop: '8px' } }, h('label.field', h('span.lbl', 'Fórmula'), fIn, h('span.hint', 'Operadores + − × ÷ ^ e comparações; funções: ' + Formula.FUNCS.join(', ') + '; variáveis livres: nivel, xp.')), fMsg,
          h('div.form-grid',
            h('label.field', h('span.lbl', 'Arredondamento'), h('select.input', { onchange: e => { a.rounding = e.target.value; save(); } }, [['none', 'Sem arredondar'], ['round', 'Ao inteiro mais próximo'], ['floor', 'Para baixo'], ['ceil', 'Para cima'], ['1', '1 casa decimal'], ['2', '2 casas decimais']].map(([v, l]) => h('option', { value: v, selected: (a.rounding || 'none') === v }, l)))),
            h('label.check', h('input', { type: 'checkbox', checked: a.formulaEnabled !== false, onchange: e => { a.formulaEnabled = e.target.checked; save(); } }), 'Cálculo automático ligado'))) : null) : null,
      h('div.form-grid',
        h('label.check', h('input', { type: 'checkbox', checked: !!a.isResource, onchange: e => { a.isResource = e.target.checked; save(); } }), 'Recurso de combate (tem valor atual, ex.: HP)'),
        h('label.check', h('input', { type: 'checkbox', checked: a.visible !== false, onchange: e => { a.visible = e.target.checked; save(); } }), 'Visível na ficha'),
        h('label.check', h('input', { type: 'checkbox', checked: !!a.highlight, onchange: e => { a.highlight = e.target.checked; save(); } }), 'Destaque na ficha'),
        h('label.check', h('input', { type: 'checkbox', checked: a.combat !== false, onchange: e => { a.combat = e.target.checked; save(); } }), 'Participa de cálculos de combate'),
        h('label.check', h('input', { type: 'checkbox', checked: a.formulaUsable !== false, onchange: e => { a.formulaUsable = e.target.checked; save(); } }), 'Pode ser usado em fórmulas'),
        F('evolution', 'Forma de evolução', 'textarea', { rows: 2 }), F('changeRules', 'Regras de alteração', 'textarea', { rows: 2 })),
      h('label.field', h('span.lbl', 'Tags'), tagInput(a.tags || [], v => { a.tags = v; save(); })),
      h('div.row', btn('Duplicar', () => { const c = U.clone(a); c.id = U.id('a'); c.name += ' (cópia)'; c.code = ''; M.attributes.splice(i + 1, 0, c); Store.saveProject(); open = c.id; render(); }, { small: true, ic: 'copy' }),
        btn('Excluir atributo', async () => {
          const users = M.attributes.filter(x => x.formula && x.formula.includes('$' + a.id));
          const ok = await Modal.confirm('Excluir atributo', h('div', h('p', 'Excluir "' + a.name + '"? Os valores nas fichas dos personagens deixam de aparecer.'), users.length ? h('p.formula-err', 'Usado nas fórmulas de: ' + users.map(u => u.name).join(', ') + '. Elas ficarão com erro até serem corrigidas.') : null), { danger: true, okLabel: 'Excluir' });
          if (ok) { M.attributes.splice(i, 1); Store.saveProject(); open = null; render(); }
        }, { small: true, kind: 'danger', ic: 'trash' })));
  }
  function render() {
    clear(list);
    const groups = [{ id: null, name: 'Sem categoria' }, ...M.attrCategories];
    if (!M.attributes.length) list.appendChild(emptyState('Nenhum atributo', 'Crie atributos tradicionais (Força, Inteligência…), recursos (HP, Mana…) ou qualquer característica do seu universo (Sanidade, Corrupção, Sincronização…).'));
    else {
      const sortable = h('div.col', { style: { gap: '6px' } }, M.attributes.map((a, i) => attrCard(a, i)));
      list.appendChild(sortable);
      makeSortable(sortable, '.mech-card', (from, to) => { U.move(M.attributes, from, to); Store.saveProject(); render(); });
    }
    renderErrors();
    void groups;
  }
  function renderPreview() {
    clear(preview);
    const chars = Store.list('character');
    const ch = Store.get(previewChar);
    preview.append(h('div.panel-title', h('h3', 'Prévia com um personagem'), h('select.input.sm', { style: { width: 'auto' }, 'aria-label': 'Personagem', onchange: e => { previewChar = e.target.value; renderPreview(); } }, h('option', { value: '' }, 'Escolha…'), chars.map(c => h('option', { value: c.id, selected: c.id === previewChar }, c.name)))));
    if (!ch) { preview.appendChild(h('p.muted.small', 'Escolha um personagem para ver os valores calculados com as regras atuais.')); return; }
    const r = Mech.compute(ch);
    preview.appendChild(h('div.attr-grid', M.attributes.map(a => h('div.attr' + (a.highlight ? '.hl' : ''), h('div.n', a.name), h('div.v', Mech.display(a, r.values[a.id], ((ch.mech.attrs || {})[a.id] || {}).base)), r.errors[a.id] ? h('div.err', r.errors[a.id]) : h('div.bd', (r.breakdown[a.id] || []).map(b => b.text).join(' · '))))));
  }
  const varsBox = h('div');
  function renderVars() {
    clear(varsBox);
    varsBox.append(h('div.panel-title', h('h3', 'Variáveis e constantes'), btn('Nova variável', () => { M.variables.push({ id: U.id('v'), name: 'Nova variável', code: '', value: 1 }); Store.saveProject(); renderVars(); }, { small: true, ic: 'plus' })),
      h('p.muted.small', 'Valores configuráveis usados nas fórmulas, como um multiplicador de movimento.'),
      M.variables.length ? h('div.linklist', M.variables.map((v, i) => h('div.linkrow',
        h('input.input.sm', { value: v.name, 'aria-label': 'Nome', oninput: e => { v.name = e.target.value; save(); } }),
        h('input.input.sm.mono', { value: v.code || '', placeholder: 'CÓDIGO', style: { width: '110px' }, 'aria-label': 'Código', oninput: e => { v.code = e.target.value.trim(); save(); } }),
        h('input.input.sm', { type: 'number', step: 'any', value: v.value, style: { width: '100px' }, 'aria-label': 'Valor', oninput: e => { v.value = Number(e.target.value); save(); } }),
        btn('', () => { M.variables.splice(i, 1); Store.saveProject(); renderVars(); renderErrors(); }, { ic: 'trash', small: true, title: 'Excluir' })))) : null);
  }
  page.append(pageHead('Atributos e recursos', 'Lista inteiramente sua. Fórmulas guardam os atributos por identificador, então renomear não quebra nada.',
    btn('Categorias', () => editNamedList('Categorias de atributos', M.attrCategories, 'ac', () => render()), { ic: 'layers' }),
    btn('Novo atributo', () => { const a = { id: U.id('a'), name: 'Novo atributo', code: '', categoryId: null, description: '', icon: '', dataType: 'int', min: 0, max: 100, default: 10, unit: '', derived: false, formula: '', formulaEnabled: true, rounding: 'round', visible: true, highlight: false, combat: true, isResource: false, evolution: '', changeRules: '', options: [], tags: [] }; M.attributes.push(a); open = a.id; Store.saveProject(); render(); }, { kind: 'primary', ic: 'plus' })),
    errBox,
    h('div.row', { style: { alignItems: 'flex-start', gap: '16px' } }, h('div.grow', { style: { flex: '2 1 420px' } }, list), h('div.col', { style: { flex: '1 1 300px' } }, h('div.panel', { style: { marginTop: 0 } }, preview), h('div.panel', varsBox))));
  render(); renderPreview(); renderVars();
}

function editNamedList(title, arr, prefix, after) {
  const box = h('div.col');
  const render = () => {
    clear(box);
    arr.forEach((c, i) => box.appendChild(h('div.linkrow', h('input.input.sm', { value: c.name, 'aria-label': 'Nome', oninput: e => { c.name = e.target.value; Store.saveProject(); } }),
      c.color !== undefined ? h('input', { type: 'color', value: c.color || '#888888', 'aria-label': 'Cor', onchange: e => { c.color = e.target.value; Store.saveProject(); } }) : null,
      btn('', () => { U.move(arr, i, i - 1); Store.saveProject(); render(); }, { ic: 'up', small: true, title: 'Subir', disabled: !i }),
      btn('', () => { arr.splice(i, 1); Store.saveProject(); render(); }, { ic: 'trash', small: true, title: 'Excluir' }))));
    box.appendChild(btn('Adicionar', () => { arr.push({ id: U.id(prefix), name: 'Novo' }); Store.saveProject(); render(); }, { small: true, ic: 'plus' }));
  };
  render();
  Modal.open({ title, body: box, actions: [{ label: 'Fechar', kind: 'primary', onClick: () => after && after() }] });
}

/* ---------- efeitos, tipos de dano, slots ---------- */
function mechEffectsPage(main) {
  const p = Store.S.p; const M = p.mechanics;
  const wrap = h('div'); main.appendChild(wrap);
  Views.list(wrap, 'effect');
  const page = wrap.querySelector('.page');
  const listEditor = (title, arr, prefix, hint) => {
    const box = h('div.chips');
    const render = () => { clear(box); arr.forEach((x, i) => box.appendChild(h('span.chip', { style: { height: '28px' } }, x.name,
      h('button', { type: 'button', 'aria-label': 'Renomear', title: 'Renomear', onclick: async () => { const n = await Modal.prompt('Renomear', 'Nome', x.name); if (n) { x.name = n; Store.saveProject(); render(); } } }, icon('edit', 12)),
      h('button', { type: 'button', 'aria-label': 'Excluir', title: 'Excluir', onclick: async () => { if (await Modal.confirm('Excluir', 'Excluir "' + x.name + '"? Fichas que o usam ficam sem valor neste campo.', { danger: true, okLabel: 'Excluir' })) { arr.splice(i, 1); Store.saveProject(); render(); } } }, icon('x', 12)))));
      box.appendChild(btn('Adicionar', async () => { const n = await Modal.prompt('Adicionar', 'Nome'); if (n) { arr.push({ id: U.id(prefix), name: n }); Store.saveProject(); render(); } }, { small: true, ic: 'plus' })); };
    render();
    return h('div.panel', h('div.panel-title', h('h3', title)), hint ? h('p.muted.small', hint) : null, box);
  };
  page.append(h('div', { style: { height: '20px' } }),
    listEditor('Tipos de dano', M.damageTypes, 'dt', 'Usados em habilidades e nas resistências/fraquezas dos personagens.'),
    listEditor('Slots de equipamento', M.slots, 'sl', 'Arma principal, cabeça, acessórios… ou qualquer configuração.'));
}

/* ---------- progressão ---------- */
function mechProgression(main) {
  const pr = Store.S.p.mechanics.progression;
  const page = h('div.page'); main.appendChild(page);
  const table = h('div');
  const save = U.debounce(() => { Store.saveProject(); renderTable(); }, 300);
  const F = (k, label, type = 'text', extra = {}) => fieldControl({ key: k, label, type, ...extra }, pr, v => { pr[k] = v; save(); });
  const fMsg = h('div');
  function renderTable() {
    clear(table); clear(fMsg);
    if (pr.xpMode === 'formula') {
      const c = Formula.check(pr.xpFormula || '', Mech.symbols(), ['nivel', 'level']);
      fMsg.appendChild(c.ok ? h('div.formula-ok', 'Fórmula válida.') : h('div.formula-err', c.error));
    }
    const max = Math.min(Number(pr.maxLevel) || 20, 100);
    const rows = [];
    for (let l = 1; l <= max; l++) rows.push({ l, xp: Mech.xpForLevel(l) });
    table.appendChild(h('div.table-wrap', h('table.table', h('thead', h('tr', h('th', 'Nível'), h('th', 'XP necessária'), h('th', 'Pontos de atributo (acum.)'), h('th', 'Pontos de habilidade (acum.)'))),
      h('tbody', rows.map(r => h('tr', h('td.num', r.l),
        h('td.num', pr.xpMode === 'table' ? h('input.input.sm', { type: 'number', value: r.xp ?? '', style: { width: '120px' }, 'aria-label': 'XP do nível ' + r.l, onchange: e => { pr.xpTable = pr.xpTable || []; const row = pr.xpTable.find(x => Number(x.level) === r.l); if (row) row.xp = Number(e.target.value); else pr.xpTable.push({ level: r.l, xp: Number(e.target.value) }); Store.saveProject(); } }) : (r.xp == null ? '—' : r.xp.toLocaleString('pt-BR'))),
        h('td.num', (r.l - 1) * (Number(pr.attrPointsPerLevel) || 0)), h('td.num', (r.l - 1) * (Number(pr.skillPointsPerLevel) || 0))))))));
  }
  page.append(pageHead('Progressão', 'Regras gerais de evolução. Progressões não lineares (por escolhas, eventos ou relações) são definidas nos requisitos das árvores e nos efeitos mecânicos dos eventos.'),
    h('div.panel', h('div.form-grid',
      h('label.check', h('input', { type: 'checkbox', checked: pr.useLevels !== false, onchange: e => { pr.useLevels = e.target.checked; save(); } }), 'Este sistema usa níveis'),
      F('maxLevel', 'Nível máximo', 'number'),
      h('label.field', h('span.lbl', 'Experiência necessária'), h('select.input', { onchange: e => { pr.xpMode = e.target.value; Store.saveProject(); App.refresh(); } }, [['formula', 'Calculada por fórmula'], ['table', 'Tabela manual por nível'], ['none', 'Não usa experiência']].map(([v, l]) => h('option', { value: v, selected: pr.xpMode === v }, l)))),
      pr.xpMode === 'formula' ? h('div.field.wide', fieldControl({ key: 'xpFormula', label: 'Fórmula de XP por nível (use "nivel")', hint: 'Ex.: 100 * nivel ^ 1.5   ·   round(50 * nivel * nivel)' }, pr, v => { pr.xpFormula = v; save(); }), fMsg) : null,
      F('attrPointsPerLevel', 'Pontos de atributo por nível', 'number'), F('skillPointsPerLevel', 'Pontos de habilidade por nível', 'number'), F('specPointsPerLevel', 'Pontos de especialização por nível', 'number'),
      F('notes', 'Regras de obtenção de experiência e distribuição de pontos', 'textarea', { wide: true, rows: 3 }))),
    pr.xpMode !== 'none' ? h('div.panel', h('div.panel-title', h('h3', 'Tabela resultante')), table) : null);
  renderTable();
}

/* ---------- regras e fórmulas ---------- */
function mechRules(main) {
  const M = Store.S.p.mechanics;
  const page = h('div.page'); main.appendChild(page);
  const list = h('div.col', { style: { gap: '8px' } });
  let ch = (Store.list('character').find(c => c.mech && c.mech.enabled) || {}).id || '';
  function render() {
    clear(list);
    if (!M.rules.length) list.appendChild(emptyState('Nenhuma regra', 'Documente dano final, chance de acerto, crítico, redução de dano, custo de habilidades… Com fórmula, o cálculo é feito de verdade; sem fórmula, fica como texto.'));
    const syms = Mech.symbols();
    const char = Store.get(ch);
    const vals = char ? Mech.compute(char).values : Object.fromEntries(M.attributes.map(a => [a.id, Number(a.default) || 0]).concat(M.variables.map(v => [v.id, Number(v.value) || 0])));
    const level = char ? (char.mech.level || 1) : 1;
    M.rules.forEach((r, i) => {
      const fIn = h('input.input.mono', { value: Formula.toDisplay(r.formula, syms), placeholder: 'Ex.: max(1, [Dano físico] * 1.5 - 10)', 'aria-label': 'Fórmula', disabled: r.textOnly });
      const out = h('div.small');
      const calc = () => {
        clear(out);
        if (r.textOnly || !fIn.value.trim()) { out.appendChild(h('span.muted', 'Regra apenas descritiva.')); return; }
        const c = Formula.toCanonical(fIn.value, syms);
        if (c.unknown.length) { out.appendChild(h('span.formula-err', 'Não encontrado: ' + c.unknown.join(', '))); return; }
        r.formula = c.text; Store.saveProject();
        const res = Formula.run(c.text, syms, vals, { nivel: level, level });
        if (res.error) out.appendChild(h('span.formula-err', res.error));
        else out.append(h('b.formula-ok', '= ' + Mech.fmt(res.value)), h('span.muted', '  ' + (char ? 'para ' + char.name : 'com valores padrão') + (res.used.length ? ' · ' + res.used.map(u => u.name + ' = ' + Mech.fmt(u.value)).join(', ') : '')));
      };
      fIn.addEventListener('input', U.debounce(calc, 250));
      list.appendChild(h('div.mech-card', h('div.col',
        h('div.row', h('input.input', { value: r.name, style: { maxWidth: '280px', fontWeight: 600 }, 'aria-label': 'Nome da regra', oninput: e => { r.name = e.target.value; Store.saveProject(); } }),
          h('label.check.small', h('input', { type: 'checkbox', checked: !!r.textOnly, onchange: e => { r.textOnly = e.target.checked; Store.saveProject(); render(); } }), 'Só documentação'),
          h('span.spacer'), btn('', () => { U.move(M.rules, i, i - 1); Store.saveProject(); render(); }, { ic: 'up', small: true, title: 'Subir', disabled: !i }),
          btn('', async () => { if (await Modal.confirm('Excluir regra', 'Excluir "' + r.name + '"?', { danger: true, okLabel: 'Excluir' })) { M.rules.splice(i, 1); Store.saveProject(); render(); } }, { ic: 'trash', small: true, title: 'Excluir' })),
        h('textarea.input', { rows: 2, value: r.description || '', placeholder: 'Descrição da regra', 'aria-label': 'Descrição', oninput: e => { r.description = e.target.value; Store.saveProject(); } }),
        fIn, out)));
      setTimeout(calc, 0);
    });
  }
  page.append(pageHead('Regras e fórmulas', 'Avaliação segura: as fórmulas são interpretadas por um analisador próprio, sem executar código.',
    h('select.input', { 'aria-label': 'Personagem da prévia', style: { width: 'auto' }, onchange: e => { ch = e.target.value; render(); } }, h('option', { value: '' }, 'Prévia com valores padrão'), Store.list('character').map(c => h('option', { value: c.id, selected: c.id === ch }, 'Prévia: ' + c.name))),
    btn('Nova regra', () => { M.rules.push({ id: U.id('ru'), name: 'Nova regra', description: '', formula: '', textOnly: false }); Store.saveProject(); render(); }, { kind: 'primary', ic: 'plus' })), list);
  render();
}

/* ---------- modelos ---------- */
function mechTemplates(main) {
  const page = h('div.page'); main.appendChild(page);
  const list = h('div.col');
  function render() {
    clear(list);
    for (const t of IO.allTemplates()) {
      const kinds = {}; (t.entities || []).forEach(e => kinds[e.kind] = (kinds[e.kind] || 0) + 1);
      list.appendChild(h('div.panel', h('div.panel-title', h('h3', t.name), t.builtin ? h('span.pill', 'incluso') : h('span.muted.small', 'atualizado ' + U.fmtDate(t.updatedAt))),
        t.description ? h('p.small', t.description) : null,
        h('p.small.muted', (t.mechanics.attributes || []).length + ' atributos · ' + (t.mechanics.damageTypes || []).length + ' tipos de dano · ' + (t.mechanics.slots || []).length + ' slots · ' + Object.entries(kinds).map(([k, n]) => n + ' ' + Schema.kindLabel(k, n !== 1).toLowerCase()).join(' · ')),
        h('div.row',
          btn('Aplicar a este projeto', async () => {
            const mode = Store.S.p.mechanics.attributes.length ? await new Promise(res => Modal.open({ title: 'Aplicar modelo', body: h('p', 'Este projeto já tem um sistema. Como aplicar "' + t.name + '"?'), actions: [{ label: 'Cancelar', onClick: () => res(null) }, { label: 'Mesclar (acrescentar)', onClick: () => res('merge') }, { label: 'Substituir configuração', kind: 'danger', onClick: () => res('replace') }] })) : 'replace';
            if (!mode) return;
            const n = IO.applyTemplate(t, { replace: mode === 'replace' });
            Toast.ok('Modelo aplicado: configuração copiada e ' + n + ' registro(s) criados. Os personagens não foram alterados.'); App.renderSidebar();
          }, { kind: 'primary', small: true }),
          !t.builtin ? btn('Atualizar com o sistema deste projeto', async () => { if (await Modal.confirm('Atualizar modelo', 'Substituir o conteúdo de "' + t.name + '" pelo sistema atual deste projeto?', { okLabel: 'Atualizar' })) { const n = IO.templateFromProject(t.name, t.description); n.id = t.id; n.createdAt = t.createdAt; Store.saveTemplate(n); render(); Toast.ok('Modelo atualizado.'); } }, { small: true }) : null,
          !t.builtin ? btn('Renomear', async () => { const n = await Modal.prompt('Renomear modelo', 'Nome', t.name); if (n) { t.name = n; t.updatedAt = U.now(); Store.saveTemplate(t); render(); } }, { small: true }) : null,
          !t.builtin ? btn('Descrição', async () => { const n = await Modal.prompt('Descrição do modelo', 'Descrição', t.description || ''); if (n != null) { t.description = n; t.updatedAt = U.now(); Store.saveTemplate(t); render(); } }, { small: true }) : null,
          !t.builtin ? btn('Excluir', async () => { if (await Modal.confirm('Excluir modelo', 'Excluir "' + t.name + '"? Projetos que já o usaram não são afetados.', { danger: true, okLabel: 'Excluir' })) { Store.deleteTemplate(t.id); render(); } }, { small: true, kind: 'danger' }) : null)));
    }
  }
  page.append(pageHead('Modelos de sistema', 'Salve o sistema deste projeto (atributos, categorias, dano, efeitos, progressão, classes, habilidades, itens e árvores) para reutilizar. Aplicar um modelo copia os dados: os projetos não ficam ligados entre si.',
    btn('Salvar sistema atual como modelo', async () => { const n = await Modal.prompt('Novo modelo', 'Nome do modelo', Store.S.p.name + ' — sistema'); if (!n) return; Store.saveTemplate(IO.templateFromProject(n, '')); render(); Toast.ok('Modelo salvo.'); }, { kind: 'primary', ic: 'plus' })), list);
  render();
}

/* ---------- abas mecânicas das fichas ---------- */
function mechTabLabel(kind) { return ({ skill: 'Níveis e requisitos', passive: 'Modificadores', class: 'Atributos e crescimento', item: 'Modificadores', effect: 'Modificadores' })[kind] || 'Mecânica'; }

function modifiersEditor(owner, { title = 'Modificadores de atributos', hint } = {}) {
  owner.modifiers = owner.modifiers || [];
  const M = Store.S.p.mechanics;
  const box = h('div.col');
  const save = U.debounce(() => Store.saveEntity(owner, { silent: true }), 250);
  const render = () => {
    clear(box);
    box.append(h('div.panel-title', h('h3', title)), hint ? h('p.muted.small', hint) : null);
    if (!M.attributes.length) { box.appendChild(h('p.muted.small', 'Crie atributos em Sistema de jogo → Atributos para usar modificadores.')); return; }
    owner.modifiers.forEach((m, i) => box.appendChild(h('div.linkrow',
      h('select.input.sm', { 'aria-label': 'Atributo', style: { maxWidth: '200px' }, onchange: e => { m.attrId = e.target.value; save(); } }, M.attributes.filter(a => Mech.isNumeric(a)).map(a => h('option', { value: a.id, selected: m.attrId === a.id }, a.name))),
      h('select.input.sm', { 'aria-label': 'Modo', style: { width: '140px' }, onchange: e => { m.mode = e.target.value; save(); render(); } }, [['flat', 'Valor fixo (+/−)'], ['percent', 'Percentual (%)'], ['formula', 'Fórmula']].map(([v, l]) => h('option', { value: v, selected: m.mode === v }, l))),
      m.mode === 'formula' ? h('input.input.sm.mono', { value: Formula.toDisplay(m.formula, Mech.symbols()), placeholder: '[Força] * 0.1', 'aria-label': 'Fórmula', oninput: e => { const c = Formula.toCanonical(e.target.value, Mech.symbols()); m.formula = c.text; save(); } })
        : h('input.input.sm', { type: 'number', step: 'any', value: m.value, style: { width: '100px' }, 'aria-label': 'Valor', oninput: e => { m.value = Number(e.target.value); save(); } }),
      btn('', () => { owner.modifiers.splice(i, 1); Store.saveEntity(owner, { silent: true }); render(); }, { ic: 'x', small: true, title: 'Remover' }))));
    box.appendChild(btn('Adicionar modificador', () => { const a = M.attributes.find(a => Mech.isNumeric(a)); if (!a) { Toast.warn('Crie um atributo numérico primeiro.'); return; } owner.modifiers.push({ attrId: a.id, mode: 'flat', value: 1 }); Store.saveEntity(owner, { silent: true }); render(); }, { small: true, ic: 'plus' }));
  };
  render();
  return h('div.panel', box);
}

function usedByPanel(e) {
  const holders = [];
  for (const c of Store.list('character')) {
    const m = c.mech; if (!m) continue;
    const how = [];
    if ((m.skills || []).some(s => s.ref === e.id)) how.push('conhece');
    if ((m.passives || []).some(s => s.ref === e.id)) how.push('possui');
    if ((m.classes || []).some(s => s.ref === e.id)) how.push('classe');
    if (Object.values(m.equipment || {}).includes(e.id)) how.push('equipado');
    if ((m.inventory || []).some(s => s.ref === e.id)) how.push('inventário');
    if ((m.effects || []).some(s => s.ref === e.id)) how.push('sob efeito');
    if (how.length) holders.push({ c, how });
  }
  const others = Store.referrers(e.id).filter(r => r.kind !== 'character');
  return h('div.panel', h('div.panel-title', h('h3', 'Usado por')),
    holders.length ? h('div.linklist', holders.map(({ c, how }) => h('div.row', entityLink(c.id), h('span.rel-label', how.join(', '))))) : h('p.muted.small', 'Nenhum personagem.'),
    others.length ? h('div.chips', { style: { marginTop: '8px' } }, others.map(o => h('span.chip', entityLink(o.id, { showKind: true })))) : null);
}

function reqListEditor(owner, key = 'reqs', { nodes = null, onChange } = {}) {
  owner[key] = owner[key] || [];
  const box = h('div.col', { style: { gap: '6px' } });
  const save = () => { onChange ? onChange() : Store.saveEntity(owner, { silent: true }); };
  const M = Store.S.p.mechanics;
  const render = () => {
    clear(box);
    owner[key].forEach((r, i) => {
      const typeSel = h('select.input.sm', { style: { width: '170px' }, 'aria-label': 'Tipo de requisito', onchange: e => { r.type = e.target.value; r.ref = null; r.value = ''; save(); render(); } }, Object.entries(Mech.REQ_TYPES).filter(([k]) => k !== 'node' || nodes).map(([k, l]) => h('option', { value: k, selected: r.type === k }, l)));
      let detail;
      if (r.type === 'node') detail = h('select.input.sm', { 'aria-label': 'Nó', onchange: e => { r.ref = e.target.value; save(); } }, h('option', { value: '' }, '—'), (nodes || []).filter(n => n !== owner).map(n => h('option', { value: n.id, selected: r.ref === n.id }, n.label)));
      else if (r.type === 'attr') detail = h('div.row.nowrap', h('select.input.sm', { 'aria-label': 'Atributo', onchange: e => { r.ref = e.target.value; save(); } }, h('option', { value: '' }, '—'), M.attributes.map(a => h('option', { value: a.id, selected: r.ref === a.id }, a.name))),
        h('select.input.sm', { style: { width: '64px' }, 'aria-label': 'Comparação', onchange: e => { r.op = e.target.value; save(); } }, ['>=', '>', '<=', '<', '==', '!='].map(o => h('option', { value: o, selected: (r.op || '>=') === o }, o))),
        h('input.input.sm', { type: 'number', value: r.value ?? '', style: { width: '80px' }, 'aria-label': 'Valor', oninput: e => { r.value = Number(e.target.value); save(); } }));
      else if (r.type === 'level' || r.type === 'points') detail = h('input.input.sm', { type: 'number', value: r.value ?? '', style: { width: '90px' }, 'aria-label': 'Valor', oninput: e => { r.value = Number(e.target.value); save(); } });
      else if (['item', 'event', 'class', 'skill'].includes(r.type)) detail = h('div', { style: { minWidth: '200px' } }, refPicker({ kinds: r.type === 'skill' ? ['skill', 'passive'] : [r.type], multi: false, value: r.ref, allowCreate: false, onChange: v => { r.ref = v; save(); } }));
      else detail = h('input.input.sm', { value: r.text || '', placeholder: r.type === 'choice' ? 'Ex.: escolheu salvar a vila' : 'Descreva a condição', 'aria-label': 'Condição', oninput: e => { r.text = e.target.value; save(); } });
      box.appendChild(h('div.linkrow', typeSel, h('div.grow', detail), btn('', () => { owner[key].splice(i, 1); save(); render(); }, { ic: 'x', small: true, title: 'Remover requisito' })));
    });
    box.appendChild(btn('Adicionar requisito', () => { owner[key].push({ id: U.id('rq'), type: nodes ? 'node' : 'level', ref: null, value: '' }); save(); render(); }, { small: true, ic: 'plus' }));
  };
  render();
  return box;
}

function mechEntityTab(e) {
  const wrap = h('div.col', { style: { gap: '0' } });
  const M = Store.S.p.mechanics;
  if (e.kind === 'skill') {
    e.levels = e.levels || []; e.evolutions = e.evolutions || [];
    const cols = M.skillLevelColumns || ['Efeito'];
    const tbl = h('div');
    const renderLevels = () => {
      clear(tbl);
      tbl.append(h('div.panel-title', h('h3', 'Níveis da habilidade'), btn('Colunas', async () => { const v = await Modal.prompt('Colunas da tabela de níveis', 'Separe por vírgula (vale para todo o projeto)', cols.join(', ')); if (v) { M.skillLevelColumns = v.split(',').map(x => x.trim()).filter(Boolean); Store.saveProject(); App.refresh(); } }, { small: true }),
        btn('Gerar níveis 1…' + (e.fields.maxLevel || 5), () => { const n = Number(e.fields.maxLevel) || 5; for (let l = 1; l <= n; l++) if (!e.levels.find(x => x.level === l)) e.levels.push({ level: l, values: {} }); e.levels.sort((a, b) => a.level - b.level); Store.saveEntity(e, { silent: true }); renderLevels(); }, { small: true })),
        h('p.muted.small', 'Cada nível pode alterar dano, custo, duração, alcance ou qualquer coluna que você definir.'),
        e.levels.length ? h('div.table-wrap', h('table.table', h('thead', h('tr', h('th', 'Nível'), cols.map(c => h('th', c)), h('th', ''))),
          h('tbody', e.levels.map((row, i) => h('tr', h('td', h('input.input.sm', { type: 'number', value: row.level, style: { width: '64px' }, 'aria-label': 'Nível', onchange: ev => { row.level = Number(ev.target.value); Store.saveEntity(e, { silent: true }); } })),
            cols.map(c => h('td', h('input.input.sm', { value: (row.values || {})[c] || '', 'aria-label': c, oninput: ev => { row.values = row.values || {}; row.values[c] = ev.target.value; Store.saveEntity(e, { silent: true }); } }))),
            h('td', btn('', () => { e.levels.splice(i, 1); Store.saveEntity(e, { silent: true }); renderLevels(); }, { ic: 'x', small: true, title: 'Remover nível' }))))))) : null,
        btn('Adicionar nível', () => { e.levels.push({ level: (e.levels[e.levels.length - 1] || { level: 0 }).level + 1, values: {} }); Store.saveEntity(e, { silent: true }); renderLevels(); }, { small: true, ic: 'plus' }));
    };
    renderLevels();
    const evo = h('div');
    const renderEvo = () => {
      clear(evo);
      evo.append(h('div.panel-title', h('h3', 'Evoluções alternativas')), h('p.muted.small', 'Caminhos diferentes que a habilidade pode seguir.'),
        h('div.col', e.evolutions.map((v, i) => h('div.mech-card', h('div.form-grid',
          fieldControl({ key: 'name', label: 'Nome' }, v, x => { v.name = x; Store.saveEntity(e, { silent: true }); }),
          fieldControl({ key: 'requirement', label: 'Requisito' }, v, x => { v.requirement = x; Store.saveEntity(e, { silent: true }); }),
          fieldControl({ key: 'description', label: 'O que muda', type: 'textarea', wide: true, rows: 2 }, v, x => { v.description = x; Store.saveEntity(e, { silent: true }); }),
          h('div.field', h('span.lbl', 'Vira a habilidade (opcional)'), refPicker({ kind: 'skill', multi: false, value: v.targetId, exclude: [e.id], onChange: x => { v.targetId = x; Store.saveEntity(e, { silent: true }); } }))),
          btn('Remover', () => { e.evolutions.splice(i, 1); Store.saveEntity(e, { silent: true }); renderEvo(); }, { small: true, kind: 'danger' })))),
        btn('Adicionar evolução', () => { e.evolutions.push({ id: U.id('ev'), name: '', requirement: '', description: '' }); Store.saveEntity(e, { silent: true }); renderEvo(); }, { small: true, ic: 'plus' }));
    };
    renderEvo();
    wrap.append(h('div.panel', tbl), h('div.panel', evo), h('div.panel', h('div.panel-title', h('h3', 'Requisitos estruturados')), h('p.muted.small', 'Atributo mínimo, nível, outra habilidade, classe, item ou evento narrativo. Usados também na simulação das árvores.'), reqListEditor(e, 'reqs')), usedByPanel(e));
  } else if (e.kind === 'passive' || e.kind === 'item' || e.kind === 'effect') {
    wrap.append(modifiersEditor(e, { hint: e.kind === 'effect' ? 'Aplicados enquanto o personagem estiver sob este efeito (multiplicados pelo número de acúmulos).' : e.kind === 'item' ? 'Aplicados quando o item está equipado num slot.' : 'Aplicados quando a passiva está ativa no personagem.' }));
    if (e.kind === 'passive') wrap.append(h('div.panel', h('div.panel-title', h('h3', 'Requisitos')), reqListEditor(e, 'reqs')));
    wrap.append(usedByPanel(e));
  } else if (e.kind === 'class') {
    e.startAttrs = e.startAttrs || {}; e.growth = e.growth || {};
    const numeric = M.attributes.filter(a => Mech.isNumeric(a) && !a.derived);
    wrap.append(h('div.panel', h('div.panel-title', h('h3', 'Atributos iniciais e crescimento por nível')),
      numeric.length ? h('div.table-wrap', h('table.table', h('thead', h('tr', h('th', 'Atributo'), h('th', 'Inicial'), h('th', 'Ganho por nível'))),
        h('tbody', numeric.map(a => h('tr', h('td', a.name),
          h('td', h('input.input.sm', { type: 'number', step: 'any', value: e.startAttrs[a.id] ?? '', placeholder: String(a.default ?? ''), style: { width: '90px' }, 'aria-label': 'Inicial de ' + a.name, oninput: ev => { if (ev.target.value === '') delete e.startAttrs[a.id]; else e.startAttrs[a.id] = Number(ev.target.value); Store.saveEntity(e, { silent: true }); } })),
          h('td', h('input.input.sm', { type: 'number', step: 'any', value: e.growth[a.id] ?? '', style: { width: '90px' }, 'aria-label': 'Crescimento de ' + a.name, oninput: ev => { if (ev.target.value === '') delete e.growth[a.id]; else e.growth[a.id] = Number(ev.target.value); Store.saveEntity(e, { silent: true }); } })))))))
        : h('p.muted.small', 'Crie atributos numéricos para definir valores da classe.'),
      h('p.muted.small', 'O crescimento é somado automaticamente na ficha do personagem conforme o nível (exceto em classes marcadas como "apenas descritiva").')),
    h('div.panel', h('div.panel-title', h('h3', 'Especializações e subclasses')), (() => { const subs = Store.list('class').filter(c => c.fields.parentClassId === e.id); return subs.length ? h('div.chips', subs.map(s => h('span.chip', entityLink(s.id)))) : h('p.muted.small', 'Crie outra classe e marque esta em "Subclasse / especialização de".'); })(),
      btn('Nova especialização', async () => { const c = await quickCreate('class', '', { navigate: false, fields: { parentClassId: e.id } }); if (c) App.refresh(); }, { small: true, ic: 'plus' })),
    h('div.panel', h('div.panel-title', h('h3', 'Requisitos para escolher a classe')), reqListEditor(e, 'reqs')), usedByPanel(e));
  }
  return wrap;
}

/* ---------- efeitos mecânicos de eventos ---------- */
function eventMechTab(ev) {
  ev.unlocks = ev.unlocks || []; ev.statChanges = ev.statChanges || [];
  const M = Store.S.p.mechanics;
  const box = h('div.col', { style: { gap: '0' } });
  const render = () => {
    clear(box);
    box.append(
      h('div.panel', h('div.panel-title', h('h3', 'Desbloqueia')), h('p.muted.small', 'Habilidades, passivas, classes ou itens liberados por este evento. Aparecem no grafo como "desbloqueia".'),
        refPicker({ kinds: ['skill', 'passive', 'class', 'item', 'effect'], multi: true, value: ev.unlocks.map(u => u.ref), allowCreate: false, onChange: ids => { ev.unlocks = ids.map(ref => ({ ref })); Store.saveEntity(ev, { silent: true }); } }),
        (ev.fields.characterIds || []).length && ev.unlocks.length ? btn('Conceder aos personagens envolvidos', () => {
          let n = 0;
          for (const cid of ev.fields.characterIds) {
            const c = Store.get(cid); if (!c) continue; const m = Mech.ensureMech(c); m.enabled = true;
            for (const u of ev.unlocks) {
              const t = Store.get(u.ref); if (!t) continue;
              if (t.kind === 'skill' && !m.skills.some(s => s.ref === t.id)) { m.skills.push({ ref: t.id, level: 1 }); n++; }
              if (t.kind === 'passive' && !m.passives.some(s => s.ref === t.id)) { m.passives.push({ ref: t.id, active: true }); n++; }
              if (t.kind === 'class' && !m.classes.some(s => s.ref === t.id)) { m.classes.push({ ref: t.id, mode: 'opcional' }); n++; }
              if (t.kind === 'item' && !m.inventory.some(s => s.ref === t.id)) { m.inventory.push({ ref: t.id, status: 'obtido em evento', eventId: ev.id, qty: 1 }); n++; }
              if (t.kind === 'effect' && !m.effects.some(s => s.ref === t.id)) { m.effects.push({ ref: t.id, stacks: 1 }); n++; }
            }
            m.history.unshift({ id: U.id('h'), date: U.now(), text: 'Evento "' + ev.name + '": recebeu ' + ev.unlocks.map(u => (Store.get(u.ref) || {}).name).filter(Boolean).join(', ') + '.' });
            Store.saveEntity(c, { silent: true });
          }
          Toast.ok(n ? n + ' concessão(ões) feitas.' : 'Os personagens já tinham tudo.');
        }, { small: true, kind: 'cyan' }) : null),
      h('div.panel', h('div.panel-title', h('h3', 'Alterações de atributos')), h('p.muted.small', 'Consequências mecânicas de uma decisão ou acontecimento. "Aplicar" soma ao valor base do personagem e registra no histórico dele.'),
        ev.statChanges.map((sc, i) => h('div.linkrow',
          h('select.input.sm', { 'aria-label': 'Personagem', style: { maxWidth: '180px' }, onchange: e => { sc.ref = e.target.value; Store.saveEntity(ev, { silent: true }); } }, h('option', { value: '' }, 'Personagem…'), Store.list('character').map(c => h('option', { value: c.id, selected: sc.ref === c.id }, c.name))),
          h('select.input.sm', { 'aria-label': 'Atributo', style: { maxWidth: '180px' }, onchange: e => { sc.attrId = e.target.value; Store.saveEntity(ev, { silent: true }); } }, M.attributes.filter(a => Mech.isNumeric(a) && !a.derived).map(a => h('option', { value: a.id, selected: sc.attrId === a.id }, a.name))),
          h('input.input.sm', { type: 'number', step: 'any', value: sc.delta, style: { width: '80px' }, 'aria-label': 'Alteração', oninput: e => { sc.delta = Number(e.target.value); Store.saveEntity(ev, { silent: true }); } }),
          h('label.check.small', h('input', { type: 'checkbox', checked: sc.permanent !== false, onchange: e => { sc.permanent = e.target.checked; Store.saveEntity(ev, { silent: true }); } }), 'permanente'),
          sc.appliedAt ? h('span.pill.ok', 'aplicado') : btn('Aplicar', () => {
            const c = Store.get(sc.ref); const a = M.attributes.find(x => x.id === sc.attrId);
            if (!c || !a) { Toast.warn('Escolha personagem e atributo.'); return; }
            const m = Mech.ensureMech(c); m.enabled = true; const cur = m.attrs[a.id] = m.attrs[a.id] || {};
            if (sc.permanent !== false) { const old = Number(cur.base ?? a.default) || 0; cur.base = old + (Number(sc.delta) || 0); m.history.unshift({ id: U.id('h'), date: U.now(), text: a.name + ': ' + old + ' → ' + cur.base + ' (evento "' + ev.name + '")' }); }
            else { cur.temp = (Number(cur.temp) || 0) + (Number(sc.delta) || 0); m.history.unshift({ id: U.id('h'), date: U.now(), text: a.name + ': ' + (sc.delta > 0 ? '+' : '') + sc.delta + ' temporário (evento "' + ev.name + '")' }); }
            sc.appliedAt = U.now(); Store.saveEntity(c, { silent: true }); Store.saveEntity(ev, { silent: true }); render(); Toast.ok('Aplicado a ' + c.name + '.');
          }, { small: true }),
          btn('', () => { ev.statChanges.splice(i, 1); Store.saveEntity(ev, { silent: true }); render(); }, { ic: 'x', small: true, title: 'Remover' }))),
        btn('Adicionar alteração', () => { const a = M.attributes.find(x => Mech.isNumeric(x) && !x.derived); if (!a) { Toast.warn('Crie um atributo numérico primeiro.'); return; } ev.statChanges.push({ ref: (ev.fields.characterIds || [])[0] || '', attrId: a.id, delta: 1, permanent: true }); Store.saveEntity(ev, { silent: true }); render(); }, { small: true, ic: 'plus' })));
  };
  render();
  return box;
}
