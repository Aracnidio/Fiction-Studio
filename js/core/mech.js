/* Fiction Studio — cálculo das mecânicas: atributos finais, modificadores, XP e requisitos. */
'use strict';

const Mech = (() => {
  const M = () => Store.S.p.mechanics;
  const defs = () => M().attributes || [];
  const symbols = () => [...defs().map(d => ({ id: d.id, name: d.name, code: d.code })), ...(M().variables || []).map(v => ({ id: v.id, name: v.name, code: v.code }))];
  const isNumeric = d => !['qualitative', 'bool', 'text'].includes(d.dataType);

  function ensureMech(ch) {
    if (!ch.mech) ch.mech = {};
    const m = ch.mech;
    m.attrs = m.attrs || {}; m.skills = m.skills || []; m.passives = m.passives || []; m.classes = m.classes || [];
    m.equipment = m.equipment || {}; m.inventory = m.inventory || []; m.resist = m.resist || []; m.effects = m.effects || [];
    m.milestones = m.milestones || []; m.history = m.history || []; m.treeIds = m.treeIds || [];
    if (m.level == null) m.level = 1;
    if (m.xp == null) m.xp = 0;
    ['attrPoints', 'skillPoints', 'specPoints'].forEach(k => { if (m[k] == null) m[k] = 0; });
    return m;
  }

  function numericOf(d, raw) {
    if (d.dataType === 'qualitative') { const i = (d.options || []).indexOf(raw); return i < 0 ? 0 : i; }
    if (d.dataType === 'bool') return raw ? 1 : 0;
    const n = Number(raw); return isNaN(n) ? 0 : n;
  }

  /* Coleta modificadores ativos de itens equipados, passivas e efeitos. */
  function modifierSources(ch) {
    const m = ensureMech(ch); const out = [];
    for (const itemId of Object.values(m.equipment)) {
      const it = Store.get(itemId); if (!it) continue;
      (it.modifiers || []).forEach(x => out.push({ ...x, source: it.name, kind: 'item' }));
      (it.fields.passiveIds || []).forEach(pid => { const p = Store.get(pid); if (p) (p.modifiers || []).forEach(x => out.push({ ...x, source: p.name + ' (via ' + it.name + ')', kind: 'passive' })); });
    }
    for (const pp of m.passives) {
      if (pp.active === false) continue;
      const p = Store.get(pp.ref); if (!p) continue;
      (p.modifiers || []).forEach(x => out.push({ ...x, source: p.name, kind: 'passive' }));
    }
    for (const c of m.classes) {
      if (c.mode === 'descritiva') continue;
      const cl = Store.get(c.ref); if (!cl) continue;
      (cl.fields.passiveIds || []).forEach(pid => { const p = Store.get(pid); if (p) (p.modifiers || []).forEach(x => out.push({ ...x, source: p.name + ' (classe ' + cl.name + ')', kind: 'passive' })); });
    }
    for (const ef of m.effects) {
      const e = Store.get(ef.ref); if (!e) continue;
      const stacks = Math.max(1, Number(ef.stacks) || 1);
      (e.modifiers || []).forEach(x => out.push({ ...x, value: Number(x.value) * stacks, source: e.name + (stacks > 1 ? ' ×' + stacks : ''), kind: 'effect' }));
    }
    return out;
  }

  /* Valores finais de todos os atributos do personagem. */
  function compute(ch) {
    const m = ensureMech(ch);
    const ds = defs();
    const level = Number(m.level) || 1;
    const breakdown = {};
    const base = {};
    const growth = {};
    for (const c of m.classes) {
      if (c.mode === 'descritiva') continue;
      const cl = Store.get(c.ref); if (!cl || !cl.growth) continue;
      for (const [aid, g] of Object.entries(cl.growth)) growth[aid] = (growth[aid] || 0) + (Number(g) || 0) * (level - 1);
    }
    const mods = modifierSources(ch);
    const vars = {}; for (const v of M().variables || []) vars[v.id] = Number(v.value) || 0;
    const extra = { nivel: level, level, xp: Number(m.xp) || 0 };
    function applyMods(id, v, numericBase) {
      const lines = breakdown[id] || (breakdown[id] = []);
      let flat = 0, pct = 0;
      for (const x of mods.filter(x => x.attrId === id)) {
        let val = Number(x.value) || 0;
        if (x.mode === 'formula') {
          const r = Formula.run(x.formula || '0', symbols(), { ...numericBase, ...vars }, extra);
          val = r.error ? 0 : r.value;
          lines.push({ text: (val >= 0 ? '+' : '') + fmt(val) + ' de ' + x.source + (r.error ? ' (erro na fórmula: ' + r.error + ')' : ' (fórmula)') });
          flat += val; continue;
        }
        if (x.mode === 'percent') { pct += val; lines.push({ text: (val >= 0 ? '+' : '') + val + '% de ' + x.source }); }
        else { flat += val; lines.push({ text: (val >= 0 ? '+' : '') + val + ' de ' + x.source }); }
      }
      return (v + flat) * (1 + pct / 100);
    }
    const numericBase = {};
    for (const d of ds) {
      if (d.derived) continue;
      const a = m.attrs[d.id] || {};
      const raw = a.base !== undefined && a.base !== '' ? a.base : d.default;
      if (!isNumeric(d)) { base[d.id] = numericOf(d, raw); numericBase[d.id] = base[d.id]; continue; }
      let v = numericOf(d, raw) + (growth[d.id] || 0) + (Number(a.temp) || 0);
      const lines = breakdown[d.id] = [{ text: 'base ' + fmt(numericOf(d, raw)) }];
      if (growth[d.id]) lines.push({ text: '+' + fmt(growth[d.id]) + ' de crescimento por nível' });
      if (Number(a.temp)) lines.push({ text: (a.temp > 0 ? '+' : '') + a.temp + ' temporário' });
      numericBase[d.id] = v;
    }
    for (const d of ds) {
      if (d.derived || !isNumeric(d)) continue;
      let v = applyMods(d.id, numericBase[d.id], numericBase);
      v = Formula.applyRounding(v, d.rounding);
      if (d.min !== '' && d.min != null && !isNaN(d.min)) v = Math.max(Number(d.min), v);
      if (d.max !== '' && d.max != null && !isNaN(d.max)) v = Math.min(Number(d.max), v);
      base[d.id] = v;
    }
    for (const v of M().variables || []) base[v.id] = Number(v.value) || 0;
    const allDefs = [...ds, ...(M().variables || []).map(v => ({ id: v.id, name: v.name, code: v.code, derived: false }))];
    const res = Formula.computeAll(allDefs, base, extra, (id, v) => applyMods(id, v, base));
    for (const d of ds) if (d.derived && !res.errors[d.id]) (breakdown[d.id] = breakdown[d.id] || []).unshift({ text: 'fórmula: ' + Formula.toDisplay(d.formula, symbols()) });
    return { values: res.values, errors: res.errors, breakdown, level };
  }
  function fmt(v) { return typeof v === 'number' ? (Number.isInteger(v) ? String(v) : v.toFixed(2).replace(/\.?0+$/, '')) : String(v); }
  function display(d, v, raw) {
    if (d.dataType === 'qualitative') return raw !== undefined && raw !== '' ? raw : (d.default || (d.options || [])[0] || '—');
    if (d.dataType === 'bool') return v ? 'Sim' : 'Não';
    if (typeof v !== 'number' || isNaN(v)) return '—';
    return fmt(v) + (d.unit ? (d.dataType === 'percent' && d.unit === '%' ? '%' : ' ' + d.unit) : (d.dataType === 'percent' ? '%' : ''));
  }

  /* Validação de fórmulas de todos os atributos (sem personagem). */
  function validateAll() {
    const out = {};
    const syms = symbols();
    const base = {}; for (const d of defs()) base[d.id] = Number(d.default) || 0;
    for (const v of M().variables || []) base[v.id] = Number(v.value) || 0;
    for (const d of defs()) if (d.derived && d.formula) { const c = Formula.check(d.formula, syms, ['nivel', 'level', 'xp']); if (!c.ok) out[d.id] = c.error; }
    const allDefs = [...defs(), ...(M().variables || []).map(v => ({ id: v.id, name: v.name, code: v.code }))];
    const r = Formula.computeAll(allDefs, base, { nivel: 1, level: 1, xp: 0 });
    for (const [id, e] of Object.entries(r.errors)) if (!out[id]) out[id] = e;
    return out;
  }

  function xpForLevel(level) {
    const pr = M().progression;
    if (pr.xpMode === 'table') { const row = (pr.xpTable || []).find(r => Number(r.level) === Number(level)); return row ? Number(row.xp) : null; }
    const r = Formula.run(pr.xpFormula || '0', symbols(), {}, { nivel: level, level });
    return r.error ? null : Math.round(r.value);
  }

  /* Requisitos: [{type, ref, op, value, text}] avaliados contra um contexto de simulação. */
  const REQ_TYPES = {
    node: 'Ter desbloqueado o nó', level: 'Nível mínimo', attr: 'Atributo', points: 'Pontos disponíveis', item: 'Possuir item',
    event: 'Evento concluído', choice: 'Escolha narrativa', class: 'Pertencer à classe', skill: 'Conhecer habilidade', text: 'Condição livre',
  };
  function reqLabel(r, nodesById = {}) {
    const ent = r.ref && Store.get(r.ref);
    switch (r.type) {
      case 'node': return 'Nó: ' + ((nodesById[r.ref] && nodesById[r.ref].label) || '?');
      case 'level': return 'Nível ≥ ' + r.value;
      case 'attr': { const d = defs().find(x => x.id === r.ref); return (d ? d.name : '?') + ' ' + (r.op || '>=') + ' ' + r.value; }
      case 'points': return r.value + ' pontos';
      case 'item': case 'event': case 'class': case 'skill': return REQ_TYPES[r.type] + ': ' + (ent ? ent.name : '?');
      default: return r.text || REQ_TYPES[r.type] || r.type;
    }
  }
  function checkReq(r, ctx) {
    switch (r.type) {
      case 'node': return ctx.unlocked.has(r.ref);
      case 'level': return (ctx.level || 1) >= Number(r.value);
      case 'attr': {
        const v = ctx.values ? ctx.values[r.ref] : undefined; const t = Number(r.value);
        if (typeof v !== 'number') return false;
        return ({ '>=': v >= t, '>': v > t, '<=': v <= t, '<': v < t, '==': v === t, '!=': v !== t })[r.op || '>='];
      }
      case 'points': return ctx.pointsLeft >= Number(r.value);
      case 'item': return ctx.items.has(r.ref);
      case 'class': return ctx.classes.has(r.ref);
      case 'skill': return ctx.skills.has(r.ref);
      case 'event': case 'choice': case 'text': return ctx.flags.has(r.id);
      default: return false;
    }
  }
  function charContext(ch) {
    if (!ch) return { level: 1, values: {}, items: new Set(), classes: new Set(), skills: new Set() };
    const m = ensureMech(ch); const c = compute(ch);
    return {
      level: Number(m.level) || 1, values: c.values,
      items: new Set([...Object.values(m.equipment), ...m.inventory.filter(i => i.status !== 'desejado').map(i => i.ref)]),
      classes: new Set(m.classes.map(x => x.ref)), skills: new Set([...m.skills.map(s => s.ref), ...m.passives.map(p => p.ref)]),
    };
  }

  /* Validação estrutural de uma árvore: ciclos, inalcançáveis, conexões inválidas, exclusividade. */
  function validateTree(tree) {
    const issues = [];
    const nodes = tree.nodes || [], edges = tree.edges || [];
    const ids = new Set(nodes.map(n => n.id));
    const seen = new Set();
    for (const e of edges) {
      if (!ids.has(e.from) || !ids.has(e.to)) issues.push({ level: 'erro', text: 'Conexão aponta para um nó inexistente.', edge: e.id });
      if (e.from === e.to) issues.push({ level: 'erro', text: 'Nó conectado a si mesmo.', edge: e.id });
      const k = e.from + '>' + e.to; if (seen.has(k)) issues.push({ level: 'aviso', text: 'Conexão repetida.', edge: e.id }); seen.add(k);
    }
    const out = {}; nodes.forEach(n => out[n.id] = []);
    edges.forEach(e => { if (out[e.from] && ids.has(e.to)) out[e.from].push(e.to); });
    // ciclos
    const state = {}; const cycles = [];
    const dfs = (id, stack) => {
      state[id] = 1; stack.push(id);
      for (const nx of out[id] || []) {
        if (state[nx] === 1) cycles.push(stack.slice(stack.indexOf(nx)).concat(nx));
        else if (!state[nx]) dfs(nx, stack);
      }
      stack.pop(); state[id] = 2;
    };
    nodes.forEach(n => { if (!state[n.id]) dfs(n.id, []); });
    const nameOf = id => (nodes.find(n => n.id === id) || {}).label || '?';
    for (const c of cycles) issues.push({ level: 'erro', text: 'Requisito circular: ' + c.map(nameOf).join(' → '), nodes: c });
    // alcançabilidade
    const incoming = {}; nodes.forEach(n => incoming[n.id] = 0);
    edges.forEach(e => { if (incoming[e.to] != null && ids.has(e.from)) incoming[e.to]++; });
    let roots = nodes.filter(n => n.isRoot).map(n => n.id);
    if (!roots.length) roots = nodes.filter(n => incoming[n.id] === 0).map(n => n.id);
    const reach = new Set(); const q = [...roots];
    while (q.length) { const x = q.shift(); if (reach.has(x)) continue; reach.add(x); (out[x] || []).forEach(y => q.push(y)); }
    for (const n of nodes) if (!reach.has(n.id)) issues.push({ level: 'erro', text: `"${n.label}" não pode ser alcançado a partir do início da árvore.`, nodes: [n.id] });
    // exclusividade: nós do mesmo grupo não podem depender um do outro
    const groups = {};
    nodes.filter(n => n.exclusiveGroup).forEach(n => (groups[n.exclusiveGroup] = groups[n.exclusiveGroup] || []).push(n.id));
    for (const [g, members] of Object.entries(groups)) {
      if (members.length < 2) issues.push({ level: 'aviso', text: `Grupo exclusivo "${g}" tem só um nó.`, nodes: members });
      for (const e of edges) if (members.includes(e.from) && members.includes(e.to)) issues.push({ level: 'erro', text: `Nós do grupo exclusivo "${g}" não podem depender um do outro.`, edge: e.id });
    }
    // requisitos apontando para coisas removidas
    for (const n of nodes) for (const r of n.reqs || []) {
      if (r.type === 'node' && !ids.has(r.ref)) issues.push({ level: 'erro', text: `"${n.label}": requisito aponta para nó removido.`, nodes: [n.id] });
      if (['item', 'event', 'class', 'skill'].includes(r.type) && r.ref && !Store.get(r.ref)) issues.push({ level: 'erro', text: `"${n.label}": requisito aponta para registro removido.`, nodes: [n.id] });
      if (r.type === 'attr' && !defs().find(d => d.id === r.ref)) issues.push({ level: 'erro', text: `"${n.label}": requisito usa atributo inexistente.`, nodes: [n.id] });
    }
    if (n0(nodes) && !roots.length) issues.push({ level: 'aviso', text: 'Nenhum ponto de início definido.' });
    return { issues, roots, reach };
  }
  function n0(a) { return a.length > 0; }

  /* Pode desbloquear o nó no estado de simulação? Retorna {ok, missing:[]} */
  function canUnlock(tree, node, sim) {
    const missing = [];
    if (sim.unlocked.has(node.id)) return { ok: false, missing: ['já desbloqueado'] };
    const byId = Object.fromEntries(tree.nodes.map(n => [n.id, n]));
    const parents = (tree.edges || []).filter(e => e.to === node.id).map(e => e.from).filter(p => byId[p]);
    const mode = node.reqMode || 'all';
    const conds = [
      ...parents.map(p => ({ label: 'desbloquear "' + byId[p].label + '"', ok: sim.unlocked.has(p) })),
      ...(node.reqs || []).map(r => ({ label: reqLabel(r, byId), ok: checkReq(r, sim) })),
    ];
    if (conds.length) {
      if (mode === 'all') conds.filter(c => !c.ok).forEach(c => missing.push(c.label));
      else if (!conds.some(c => c.ok)) missing.push('ao menos um: ' + conds.map(c => c.label).join(' / '));
    }
    if (node.minLevel && (sim.level || 1) < Number(node.minLevel)) missing.push('nível ' + node.minLevel);
    if (node.pointsInTree && (sim.spent || 0) < Number(node.pointsInTree)) missing.push(node.pointsInTree + ' pontos já gastos na árvore (gastos: ' + (sim.spent || 0) + ')');
    const cost = Number(node.cost) || 0;
    if (cost > sim.pointsLeft) missing.push(cost + ' pontos (restam ' + sim.pointsLeft + ')');
    if (node.exclusiveGroup) {
      const taken = tree.nodes.find(n => n.id !== node.id && n.exclusiveGroup === node.exclusiveGroup && sim.unlocked.has(n.id));
      if (taken) missing.push('exclusivo com "' + taken.label + '"');
    }
    return { ok: !missing.length, missing };
  }

  return { ensureMech, compute, display, fmt, validateAll, xpForLevel, symbols, defs, isNumeric, REQ_TYPES, reqLabel, checkReq, charContext, validateTree, canUnlock, modifierSources };
})();
