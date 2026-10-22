/* Fiction Studio — aba "Combate e Progressão" da ficha de personagem. Valores calculados de verdade a partir das regras do projeto. */
'use strict';

function combatTab(ch, part = 'combat') {
  const p = Store.S.p; const M = p.mechanics; const mods = M.modules;
  const m = Mech.ensureMech(ch);
  const wrap = h('div.col', { style: { gap: '0' } });
  if (!m.enabled) {
    wrap.appendChild(h('div.panel', h('h3', 'Este personagem não usa o sistema de jogo'), h('p.muted', 'Personagens de livros, mangás ou visual novels podem ignorar esta seção. Ativar não altera nada na ficha narrativa.'),
      btn('Ativar ficha de jogo para ' + ch.name, () => {
        m.enabled = true;
        for (const a of M.attributes) if (!a.derived && !(a.id in m.attrs)) m.attrs[a.id] = { base: a.default };
        Store.saveEntity(ch, { silent: true }); App.refresh();
      }, { kind: 'primary' })));
    return wrap;
  }
  const save = U.debounce(() => { Store.saveEntity(ch, { silent: true }); }, 250);
  const log = (text) => { if (mods.history) { m.history.unshift({ id: U.id('h'), date: U.now(), text }); m.history = m.history.slice(0, 300); Store.saveEntity(ch, { silent: true }); } };
  const valuesBox = h('div');
  const panel = (title, ...kids) => h('div.panel', h('div.panel-title', h('h3', title)), ...kids);

  function renderValues() {
    clear(valuesBox);
    const r = Mech.compute(ch);
    const visible = M.attributes.filter(a => a.visible !== false);
    if (!visible.length) { valuesBox.appendChild(panel('Atributos e status', h('p.muted.small', 'Nenhum atributo no projeto. '), btn('Criar atributos', () => Nav.section('mech/attributes'), { small: true }))); return; }
    const groups = {};
    for (const a of visible) {
      if (a.isResource && !mods.resources) continue;
      if (!a.isResource && !mods.attributes) continue;
      const g = a.isResource ? '__res' : (a.categoryId || '__none');
      (groups[g] = groups[g] || []).push(a);
    }
    const order = ['__res', ...M.attrCategories.map(c => c.id), '__none'];
    for (const g of order) {
      if (!groups[g]) continue;
      const title = g === '__res' ? 'Recursos de combate' : g === '__none' ? 'Atributos' : (M.attrCategories.find(c => c.id === g) || {}).name;
      valuesBox.appendChild(panel(title, h('div.attr-grid', groups[g].sort((a, b) => (b.highlight ? 1 : 0) - (a.highlight ? 1 : 0)).map(a => attrTile(a, r)))));
    }
  }
  function attrTile(a, r) {
    const st = m.attrs[a.id] = m.attrs[a.id] || {};
    const v = r.values[a.id];
    let input = null;
    if (!a.derived) {
      if (a.dataType === 'qualitative') input = h('select.input.sm', { 'aria-label': a.name, onchange: e => { const old = st.base; st.base = e.target.value; save(); log(a.name + ': ' + (old ?? a.default) + ' → ' + st.base); renderValues(); } }, (a.options || []).map(o => h('option', { value: o, selected: (st.base ?? a.default) === o }, o)));
      else if (a.dataType === 'bool') input = h('label.check.small', h('input', { type: 'checkbox', checked: !!(st.base ?? a.default), onchange: e => { st.base = e.target.checked; save(); log(a.name + ': ' + (st.base ? 'sim' : 'não')); renderValues(); } }), 'ativo');
      else {
        const old = st.base ?? a.default;
        input = h('div.row.nowrap', { style: { gap: '4px' } },
          h('input.input.sm', { type: 'number', step: a.dataType === 'int' ? 1 : 'any', value: st.base ?? a.default ?? '', min: a.min, max: a.max, style: { width: '72px' }, 'aria-label': 'Base de ' + a.name, title: 'Valor base',
            onchange: e => { const nv = e.target.value === '' ? '' : Number(e.target.value); st.base = nv; save(); log(a.name + ': ' + old + ' → ' + nv); renderValues(); } }),
          h('input.input.sm', { type: 'number', step: 'any', value: st.temp ?? '', placeholder: 'temp', style: { width: '62px' }, 'aria-label': 'Temporário de ' + a.name, title: 'Modificador temporário',
            onchange: e => { st.temp = e.target.value === '' ? null : Number(e.target.value); save(); renderValues(); } }));
      }
    }
    let current = null;
    if (a.isResource && typeof v === 'number' && !isNaN(v)) {
      const cur = st.current == null ? v : Math.min(st.current, v);
      current = h('div.row.nowrap', { style: { gap: '4px' } }, h('span.small.muted', 'atual'),
        h('input.input.sm', { type: 'number', value: cur, style: { width: '76px' }, 'aria-label': 'Valor atual de ' + a.name, onchange: e => { st.current = Math.max(Number(a.min) || 0, Math.min(Number(e.target.value), v)); save(); renderValues(); } }),
        h('span.small.muted', '/ ' + Mech.fmt(v)));
    }
    return h('div.attr' + (a.highlight ? '.hl' : ''),
      h('div.n', a.icon ? h('span', a.icon) : null, a.name, a.derived ? h('span.pill.ac', { style: { height: '16px', fontSize: '10px' } }, 'calc') : null),
      h('div.v', a.isResource && current ? null : Mech.display(a, v, st.base)), current, input,
      r.errors[a.id] ? h('div.err', r.errors[a.id]) : h('div.bd', (r.breakdown[a.id] || []).map(b => b.text).join(' · ')));
  }

  /* progressão */
  const prog = () => {
    const pr = M.progression;
    if (!mods.progression || pr.useLevels === false) return null;
    const next = Mech.xpForLevel((Number(m.level) || 1) + 1);
    const F = (k, label) => h('label.field', h('span.lbl', label), h('input.input.sm', { type: 'number', value: m[k] ?? 0, 'aria-label': label, onchange: e => { const old = m[k]; m[k] = Number(e.target.value); save(); if (k === 'level') { log('Nível: ' + old + ' → ' + m[k]); renderValues(); App.refresh(); } } }));
    return panel('Progressão',
      h('div.form-grid', F('level', 'Nível atual'), h('div.field', h('span.lbl', 'Nível máximo'), h('div', String(pr.maxLevel || '—'))), F('xp', 'Experiência atual'),
        h('div.field', h('span.lbl', 'XP para o próximo nível'), h('div', next == null ? '—' : next.toLocaleString('pt-BR') + (m.xp >= next ? '  ✓ pode subir' : ' (faltam ' + (next - m.xp).toLocaleString('pt-BR') + ')'))),
        F('attrPoints', 'Pontos de atributo'), F('skillPoints', 'Pontos de habilidade'), F('specPoints', 'Pontos de especialização')),
      next != null && m.xp >= next && m.level < (pr.maxLevel || 999) ? btn('Subir de nível', () => {
        const old = m.level; m.level = old + 1; m.attrPoints += Number(pr.attrPointsPerLevel) || 0; m.skillPoints += Number(pr.skillPointsPerLevel) || 0; m.specPoints += Number(pr.specPointsPerLevel) || 0;
        m.history.unshift({ id: U.id('h'), date: U.now(), text: 'Subiu do nível ' + old + ' para ' + m.level + '.' }); Store.saveEntity(ch, { silent: true }); App.refresh();
      }, { kind: 'primary', small: true }) : null,
      milestonesEditor());
  };
  function milestonesEditor() {
    const box = h('div', { style: { marginTop: '12px' } });
    const render = () => {
      clear(box);
      box.append(h('div.lbl', 'Marcos de evolução e evoluções narrativas'));
      m.milestones.forEach((ms, i) => box.appendChild(h('div.linkrow', { style: { marginTop: '5px' } },
        h('input.input.sm', { value: ms.title || '', placeholder: 'Marco (ex.: Desperta o Véu)', 'aria-label': 'Marco', oninput: e => { ms.title = e.target.value; save(); } }),
        h('input.input.sm', { type: 'number', value: ms.level ?? '', placeholder: 'nível', style: { width: '70px' }, 'aria-label': 'Nível', oninput: e => { ms.level = e.target.value === '' ? null : Number(e.target.value); save(); } }),
        h('div', { style: { minWidth: '180px' } }, refPicker({ kind: 'event', multi: false, value: ms.eventId, allowCreate: false, placeholder: 'Evento…', onChange: v => { ms.eventId = v; save(); } })),
        btn('', () => { m.milestones.splice(i, 1); save(); render(); }, { ic: 'x', small: true, title: 'Remover' }))));
      box.appendChild(btn('Adicionar marco', () => { m.milestones.push({ id: U.id('ms'), title: '', level: null, eventId: null }); save(); render(); }, { small: true, ic: 'plus' }));
    };
    render(); return box;
  }

  /* listas de vínculos */
  function linkList(title, arr, kind, extra, onAdd) {
    const box = h('div.col', { style: { gap: '6px' } });
    const render = () => {
      clear(box);
      arr.forEach((x, i) => { const ent = Store.get(x.ref); box.appendChild(h('div.linkrow', ent && ent.fields.iconText ? h('span', ent.fields.iconText) : kindDot(kind), h('div.grow', entityLink(x.ref), ent && ent.fields.summary ? h('div.small.muted', ent.fields.summary.slice(0, 120)) : null, extra ? extra(x, ent) : null),
        btn('', () => { arr.splice(i, 1); save(); log(title + ': removido ' + (ent ? ent.name : '?')); renderValues(); render(); }, { ic: 'x', small: true, title: 'Remover' }))); });
      box.appendChild(refPicker({ kind, multi: true, value: [], placeholder: 'Adicionar ' + Schema.kindLabel(kind).toLowerCase() + '…', exclude: arr.map(x => x.ref), onChange: ids => { for (const id of ids) if (!arr.some(x => x.ref === id)) { const item = { ref: id }; if (onAdd) onAdd(item); arr.push(item); log(title + ': adicionado ' + Store.get(id).name); } save(); renderValues(); render(); } }));
    };
    render();
    return panel(title, box);
  }
  const skillExtra = (x, s) => {
    if (!s) return null;
    const lvl = h('input.input.sm', { type: 'number', min: 1, max: s.fields.maxLevel || 99, value: x.level || 1, style: { width: '64px' }, 'aria-label': 'Nível', onchange: e => { x.level = Math.min(Number(s.fields.maxLevel) || 99, Math.max(1, Number(e.target.value))); save(); log(s.name + ': nível ' + x.level); App.refresh(); } });
    const row = (s.levels || []).find(l => l.level === (x.level || 1));
    return h('div.row.small', 'Nível', lvl, s.fields.maxLevel ? h('span.muted', 'de ' + s.fields.maxLevel) : null, row ? h('span.muted', Object.entries(row.values || {}).filter(([, v]) => v).map(([k, v]) => k + ': ' + v).join(' · ')) : null,
      [s.fields.cost, s.fields.cooldown, s.fields.range].filter(Boolean).length ? h('span.muted', [s.fields.cost, s.fields.cooldown && 'recarga ' + s.fields.cooldown, s.fields.range && 'alcance ' + s.fields.range].filter(Boolean).join(' · ')) : null);
  };
  const passiveExtra = (x) => h('label.check.small', h('input', { type: 'checkbox', checked: x.active !== false, onchange: e => { x.active = e.target.checked; save(); renderValues(); } }), 'ativa agora (modificadores aplicados)');
  const classExtra = (x, c) => h('div.row.small', h('select.input.sm', { style: { width: 'auto' }, 'aria-label': 'Uso da classe', onchange: e => { x.mode = e.target.value; save(); renderValues(); } }, [['obrigatória', 'Obrigatória'], ['opcional', 'Opcional'], ['descritiva', 'Apenas descritiva']].map(([v, l]) => h('option', { value: v, selected: (x.mode || 'opcional') === v }, l))),
    c && c.startAttrs && Object.keys(c.startAttrs).length ? btn('Aplicar atributos iniciais', () => { for (const [aid, v] of Object.entries(c.startAttrs)) { m.attrs[aid] = m.attrs[aid] || {}; m.attrs[aid].base = v; } log('Atributos iniciais da classe ' + c.name + ' aplicados.'); save(); renderValues(); }, { small: true }) : null,
    c && c.fields.parentClassId ? h('span.muted', 'especialização de ' + (Store.get(c.fields.parentClassId) || {}).name) : null);
  const effectExtra = (x, e) => h('div.row.small', 'Acúmulos', h('input.input.sm', { type: 'number', min: 1, max: e && e.fields.maxStacks || 99, value: x.stacks || 1, style: { width: '60px' }, 'aria-label': 'Acúmulos', disabled: e && !e.fields.stackable, onchange: ev => { x.stacks = Math.max(1, Number(ev.target.value)); save(); renderValues(); } }), e && e.fields.duration ? h('span.muted', 'duração ' + e.fields.duration) : null);

  function equipmentPanel() {
    const slots = M.slots;
    const items = Store.list('item');
    const eq = h('div.form-grid', slots.length ? slots.map(sl => h('label.field', h('span.lbl', sl.name),
      h('select.input.sm', { 'aria-label': sl.name, onchange: e => { const old = Store.get(m.equipment[sl.id]); if (e.target.value) m.equipment[sl.id] = e.target.value; else delete m.equipment[sl.id]; save(); log(sl.name + ': ' + (old ? old.name : 'vazio') + ' → ' + (Store.get(e.target.value) || { name: 'vazio' }).name); renderValues(); } },
        h('option', { value: '' }, '— vazio —'), items.filter(it => !it.fields.slotId || it.fields.slotId === sl.id).map(it => h('option', { value: it.id, selected: m.equipment[sl.id] === it.id }, it.name))))) : h('p.muted.small', 'Defina slots em Sistema de jogo → Efeitos, dano e slots.'));
    const inv = h('div.col', { style: { gap: '5px' } });
    const renderInv = () => {
      clear(inv);
      m.inventory.forEach((x, i) => inv.appendChild(h('div.linkrow', h('div.grow', entityLink(x.ref)),
        h('select.input.sm', { style: { width: 'auto' }, 'aria-label': 'Situação', onchange: e => { x.status = e.target.value; save(); } }, ['possui', 'desejado', 'obtido em evento'].map(s => h('option', { value: s, selected: x.status === s }, s))),
        x.status === 'obtido em evento' ? h('div', { style: { minWidth: '170px' } }, refPicker({ kind: 'event', multi: false, value: x.eventId, allowCreate: false, onChange: v => { x.eventId = v; save(); } })) : null,
        h('input.input.sm', { type: 'number', min: 1, value: x.qty || 1, style: { width: '56px' }, 'aria-label': 'Quantidade', onchange: e => { x.qty = Number(e.target.value); save(); } }),
        btn('', () => { m.inventory.splice(i, 1); save(); renderInv(); }, { ic: 'x', small: true, title: 'Remover' }))));
      inv.appendChild(refPicker({ kind: 'item', multi: true, value: [], placeholder: 'Adicionar item ao inventário…', onChange: ids => { ids.forEach(id => m.inventory.push({ ref: id, status: 'possui', qty: 1 })); save(); renderInv(); } }));
    };
    renderInv();
    return panel('Equipamentos e inventário', h('div.lbl', 'Equipado (modificadores aplicados)'), eq, h('div.lbl', { style: { marginTop: '12px' } }, 'Inventário, desejados e obtidos em eventos'), inv);
  }
  function resistPanel() {
    const box = h('div.col', { style: { gap: '5px' } });
    const render = () => {
      clear(box);
      if (!M.damageTypes.length) { box.appendChild(h('p.muted.small', 'Defina tipos de dano em Sistema de jogo → Efeitos, dano e slots.')); return; }
      m.resist.forEach((x, i) => box.appendChild(h('div.linkrow',
        h('select.input.sm', { 'aria-label': 'Tipo de dano', style: { maxWidth: '170px' }, onchange: e => { x.damageTypeId = e.target.value; save(); } }, M.damageTypes.map(d => h('option', { value: d.id, selected: x.damageTypeId === d.id }, d.name))),
        h('select.input.sm', { 'aria-label': 'Natureza', style: { maxWidth: '150px' }, onchange: e => { x.kind = e.target.value; save(); render(); } }, [['resist', 'Resistência'], ['weak', 'Fraqueza'], ['vuln', 'Vulnerabilidade'], ['immune', 'Imunidade']].map(([v, l]) => h('option', { value: v, selected: x.kind === v }, l))),
        x.kind === 'immune' ? h('span.muted.small', '100%') : h('input.input.sm', { value: x.value ?? '', placeholder: '50% ou Alta', style: { width: '100px' }, 'aria-label': 'Valor', oninput: e => { x.value = e.target.value; save(); } }),
        btn('', () => { m.resist.splice(i, 1); save(); render(); }, { ic: 'x', small: true, title: 'Remover' }))));
      box.appendChild(btn('Adicionar', () => { m.resist.push({ damageTypeId: M.damageTypes[0].id, kind: 'resist', value: '' }); save(); render(); }, { small: true, ic: 'plus' }));
    };
    render();
    return panel('Resistências e fraquezas', box);
  }
  function treesPanel() {
    const trees = Store.list('skilltree').filter(t => t.fields.ownerId === ch.id || m.treeIds.includes(t.id) || m.classes.some(c => (Store.get(c.ref) || { fields: {} }).fields.treeId === t.id));
    return panel('Árvores de habilidades', trees.length ? h('div.linklist', trees.map(t => h('div.row', entityLink(t.id), h('span.muted.small', U.plural((t.nodes || []).length, 'nó', 'nós')), btn('Simular com ' + ch.name, () => Nav.go('/p/' + p.id + '/e/' + t.id + '/sim:' + ch.id), { small: true })))) : h('p.muted.small', 'Nenhuma árvore associada.'),
      h('div', { style: { marginTop: '8px' } }, refPicker({ kind: 'skilltree', multi: true, value: m.treeIds, placeholder: 'Associar árvore…', onChange: v => { m.treeIds = v; save(); App.refresh(); } })));
  }
  function historyPanel() {
    const box = h('div');
    const render = () => {
      clear(box);
      const note = h('input.input.sm', { placeholder: 'Anotar uma alteração manual…', 'aria-label': 'Nova anotação' });
      box.append(h('div.row.nowrap', note, btn('Anotar', () => { if (note.value.trim()) { m.history.unshift({ id: U.id('h'), date: U.now(), text: note.value.trim() }); save(); render(); } }, { small: true })),
        m.history.length ? h('div.table-wrap', { style: { maxHeight: '260px', overflowY: 'auto', marginTop: '8px' } }, h('table.table', h('tbody', m.history.slice(0, 100).map(x => h('tr', h('td.small.muted', { style: { whiteSpace: 'nowrap' } }, U.fmtDate(x.date)), h('td.small', x.text)))))) : h('p.muted.small', 'Alterações de atributos, nível, classes e equipamentos ficam registradas aqui automaticamente.'));
    };
    render(); return panel('Histórico de alterações', box);
  }

  if (detailMode() === 'summary') return combatSummary(ch, part);
  if (part === 'equipment') {
    wrap.append(mods.items ? equipmentPanel() : emptyState('Equipamentos desativados', 'Ative o subsistema em Configurações do projeto.', null, 'gem'));
    return wrap;
  }
  wrap.append(
    h('div.row', { style: { marginBottom: '10px' } }, h('span.meta', 'Valores finais = base + crescimento de classe + temporários + equipamentos, passivas e efeitos. As fórmulas vêm de Sistemas de RPG → Atributos.'), h('span.spacer'),
      btn('Desativar ficha de jogo', async () => { if (await Modal.confirm('Desativar', 'Ocultar a ficha de jogo deste personagem? Os dados ficam guardados.', { okLabel: 'Desativar' })) { m.enabled = false; Store.saveEntity(ch, { silent: true }); App.refresh(); } }, { small: true, kind: 'ghost' })),
    prog(), valuesBox,
    mods.classes ? linkList('Classes e especializações', m.classes, 'class', classExtra, x => x.mode = 'opcional') : null,
    mods.actives ? linkList('Habilidades ativas', m.skills, 'skill', skillExtra, x => x.level = 1) : null,
    mods.passives ? linkList('Habilidades passivas', m.passives, 'passive', passiveExtra, x => x.active = true) : null,
    mods.tree ? treesPanel() : null,
    mods.resist ? resistPanel() : null,
    mods.effects ? linkList('Efeitos de status ativos', m.effects, 'effect', effectExtra, x => x.stacks = 1) : null,
    mods.history ? historyPanel() : null);
  renderValues();
  return wrap;
}

/* Visão resumida: os números principais, sem controles de edição */
function combatSummary(ch, part) {
  const p = Store.S.p; const M = p.mechanics; const m = Mech.ensureMech(ch);
  const r = Mech.compute(ch);
  const names = (arr) => arr.map(x => Store.get(x.ref)).filter(Boolean);
  const chipList = (title, list, extra) => list.length ? h('section.panel', h('div.panel-title', h('h3', title), h('span.meta', String(list.length))), h('div.chips', list.map(e => h('span.chip', kindDot(e.kind), h('a.elink', { href: Nav.href(e.id), onclick: ev => { ev.preventDefault(); Nav.entity(e.id); } }, e.name), extra ? extra(e) : null)))) : null;
  if (part === 'equipment') {
    const eq = M.slots.map(sl => [sl, Store.get(m.equipment[sl.id])]).filter(x => x[1]);
    return h('div', eq.length ? h('section.panel', h('div.panel-title', h('h3', 'Equipado')), h('div.read', eq.map(([sl, it]) => h('div.ri', h('span.lbl', sl.name), h('div.v', entityLink(it.id), it.fields.rarity ? h('span.pill.gold', { style: { marginLeft: '6px' } }, it.fields.rarity) : null))))) : emptyState('Nada equipado', 'Use a visão Detalhada para equipar itens.', null, 'gem'),
      chipList('Inventário', m.inventory.map(x => Store.get(x.ref)).filter(Boolean)));
  }
  const key = M.attributes.filter(a => a.visible !== false && (a.highlight || a.isResource));
  const prim = M.attributes.filter(a => a.visible !== false && !a.highlight && !a.isResource && !a.derived).slice(0, 8);
  const tile = a => h('div.attr' + (a.highlight ? '.hl' : ''), h('div.n', a.icon ? h('span', a.icon) : null, a.name), h('div.v', Mech.display(a, r.values[a.id], ((m.attrs || {})[a.id] || {}).base)),
    a.isResource && typeof r.values[a.id] === 'number' ? (() => { const cur = (m.attrs[a.id] || {}).current ?? r.values[a.id]; return h('div.bar', { title: Mech.fmt(cur) + ' / ' + Mech.fmt(r.values[a.id]) }, h('i', { style: { width: Math.max(0, Math.min(100, cur / (r.values[a.id] || 1) * 100)) + '%' } })); })() : null);
  if (!m.enabled) return emptyState('Sem ficha de jogo', 'Este personagem não usa o sistema de jogo. Mude para Detalhada para ativar.', null, 'sword');
  const next = Mech.xpForLevel((Number(m.level) || 1) + 1);
  return h('div',
    M.progression.useLevels !== false ? h('section.panel', h('div.row', h('div', h('div.lbl', 'Nível'), h('div', { style: { fontSize: '28px', fontWeight: 700 } }, String(m.level || 1))),
      next != null ? h('div.grow', { style: { maxWidth: '360px' } }, h('div.meta', 'XP ' + (m.xp || 0).toLocaleString('pt-BR') + ' / ' + next.toLocaleString('pt-BR')), h('div.bar', h('i', { style: { width: Math.min(100, (m.xp || 0) / next * 100) + '%' } }))) : null,
      h('span.spacer'), h('span.meta', 'Pontos: ' + m.attrPoints + ' atributo · ' + m.skillPoints + ' habilidade'))) : null,
    key.length ? h('section.panel', h('div.panel-title', h('h3', 'Principais')), h('div.attr-grid', key.map(tile))) : null,
    prim.length ? h('section.panel', h('div.panel-title', h('h3', 'Atributos')), h('div.attr-grid', prim.map(tile))) : null,
    chipList('Classes', names(m.classes)), chipList('Habilidades ativas', names(m.skills), e => { const x = m.skills.find(s => s.ref === e.id); return x && x.level > 1 ? h('span.meta', 'nv ' + x.level) : null; }),
    chipList('Passivas', names(m.passives.filter(x => x.active !== false))), chipList('Efeitos ativos', names(m.effects)),
    h('p.meta', 'Modificadores, fórmulas e valores temporários aparecem na visão Detalhada.'));
}
