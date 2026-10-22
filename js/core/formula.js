/* Fiction Studio — avaliador seguro de expressões matemáticas.
   Sem eval/Function: tokenizador + parser descendente recursivo + interpretador de AST.
   Referências a atributos/variáveis ficam gravadas como $<id>, e são exibidas como [Nome]. */
'use strict';

const Formula = (() => {
  const FUNCS = {
    min: { n: [1, 99], f: (...a) => Math.min(...a) },
    max: { n: [1, 99], f: (...a) => Math.max(...a) },
    floor: { n: [1, 1], f: Math.floor },
    ceil: { n: [1, 1], f: Math.ceil },
    round: { n: [1, 2], f: (x, d = 0) => { const k = 10 ** d; return Math.round(x * k) / k; } },
    abs: { n: [1, 1], f: Math.abs },
    sqrt: { n: [1, 1], f: Math.sqrt },
    pow: { n: [2, 2], f: Math.pow },
    log: { n: [1, 1], f: Math.log },
    exp: { n: [1, 1], f: Math.exp },
    clamp: { n: [3, 3], f: (x, a, b) => Math.min(Math.max(x, a), b) },
    se: { n: [3, 3], f: (c, a, b) => (c ? a : b) },
    if: { n: [3, 3], f: (c, a, b) => (c ? a : b) },
  };
  const CONSTS = { pi: Math.PI, e: Math.E, verdadeiro: 1, falso: 0, true: 1, false: 0 };

  class FErr extends Error { constructor(msg, pos) { super(msg); this.pos = pos; } }

  function tokenize(src) {
    const s = String(src).replace(/×/g, '*').replace(/÷/g, '/');
    const toks = []; let i = 0;
    const isId = c => /[A-Za-zÀ-ÿ_]/.test(c);
    while (i < s.length) {
      const c = s[i];
      if (/\s/.test(c)) { i++; continue; }
      if (/[0-9.]/.test(c)) {
        const m = s.slice(i).match(/^(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?/);
        if (!m) throw new FErr('Número inválido', i);
        toks.push({ t: 'num', v: parseFloat(m[0]), p: i }); i += m[0].length; continue;
      }
      if (c === '$') {
        const m = s.slice(i + 1).match(/^[A-Za-z0-9_]+/);
        if (!m) throw new FErr('Referência inválida', i);
        toks.push({ t: 'var', v: '$' + m[0], p: i }); i += 1 + m[0].length; continue;
      }
      if (c === '[') {
        const j = s.indexOf(']', i);
        if (j < 0) throw new FErr('Colchete sem fechamento', i);
        toks.push({ t: 'name', v: s.slice(i + 1, j).trim(), p: i }); i = j + 1; continue;
      }
      if (isId(c)) {
        const m = s.slice(i).match(/^[A-Za-zÀ-ÿ_][A-Za-zÀ-ÿ0-9_]*/);
        const w = m[0]; const lw = w.toLowerCase();
        if (lw === 'and' || lw === 'e' && false) toks.push({ t: 'op', v: '&&', p: i });
        else if (lw === 'or' || lw === 'ou') toks.push({ t: 'op', v: '||', p: i });
        else if (lw === 'not' || lw === 'nao' || lw === 'não') toks.push({ t: 'op', v: '!', p: i });
        else toks.push({ t: 'id', v: w, p: i });
        i += w.length; continue;
      }
      const two = s.slice(i, i + 2);
      if (['<=', '>=', '==', '!=', '&&', '||'].includes(two)) { toks.push({ t: 'op', v: two, p: i }); i += 2; continue; }
      if ('+-*/%^(),<>!'.includes(c)) { toks.push({ t: 'op', v: c, p: i }); i++; continue; }
      throw new FErr('Caractere não permitido: "' + c + '"', i);
    }
    toks.push({ t: 'end', p: s.length });
    return toks;
  }

  function parse(src) {
    if (!String(src || '').trim()) throw new FErr('Fórmula vazia', 0);
    const toks = tokenize(src); let k = 0;
    const peek = () => toks[k];
    const isOp = v => peek().t === 'op' && peek().v === v;
    const eat = v => { if (!isOp(v)) throw new FErr('Esperado "' + v + '"', peek().p); k++; };
    function orE() { let l = andE(); while (isOp('||')) { k++; l = { t: 'bin', o: '||', l, r: andE() }; } return l; }
    function andE() { let l = cmpE(); while (isOp('&&')) { k++; l = { t: 'bin', o: '&&', l, r: cmpE() }; } return l; }
    function cmpE() {
      let l = addE();
      while (peek().t === 'op' && ['<', '>', '<=', '>=', '==', '!='].includes(peek().v)) { const o = toks[k++].v; l = { t: 'bin', o, l, r: addE() }; }
      return l;
    }
    function addE() {
      let l = mulE();
      while (peek().t === 'op' && (peek().v === '+' || peek().v === '-')) { const o = toks[k++].v; l = { t: 'bin', o, l, r: mulE() }; }
      return l;
    }
    function mulE() {
      let l = unE();
      while (peek().t === 'op' && ['*', '/', '%'].includes(peek().v)) { const o = toks[k++].v; l = { t: 'bin', o, l, r: unE() }; }
      return l;
    }
    function unE() {
      if (peek().t === 'op' && (peek().v === '-' || peek().v === '+' || peek().v === '!')) { const o = toks[k++].v; return { t: 'un', o, a: unE() }; }
      return powE();
    }
    function powE() {
      const b = prim();
      if (isOp('^')) { k++; return { t: 'bin', o: '^', l: b, r: unE() }; }
      return b;
    }
    function prim() {
      const tk = peek();
      if (tk.t === 'num') { k++; return { t: 'num', v: tk.v }; }
      if (tk.t === 'var') { k++; return { t: 'var', v: tk.v, p: tk.p }; }
      if (tk.t === 'name') { k++; return { t: 'name', v: tk.v, p: tk.p }; }
      if (tk.t === 'id') {
        k++;
        const lw = tk.v.toLowerCase();
        if (isOp('(')) {
          const fn = FUNCS[lw];
          if (!fn) throw new FErr('Função desconhecida: ' + tk.v, tk.p);
          k++; const args = [];
          if (!isOp(')')) { args.push(orE()); while (isOp(',')) { k++; args.push(orE()); } }
          eat(')');
          if (args.length < fn.n[0] || args.length > fn.n[1]) throw new FErr('Número de argumentos inválido em ' + tk.v + '()', tk.p);
          return { t: 'call', f: lw, args };
        }
        return { t: 'id', v: tk.v, p: tk.p };
      }
      if (isOp('(')) { k++; const e = orE(); eat(')'); return e; }
      throw new FErr(tk.t === 'end' ? 'Expressão incompleta' : 'Símbolo inesperado', tk.p);
    }
    const ast = orE();
    if (peek().t !== 'end') throw new FErr('Símbolo inesperado após a expressão', peek().p);
    return ast;
  }

  function refs(ast, out = new Set()) {
    if (!ast) return out;
    if (ast.t === 'var' || ast.t === 'name' || ast.t === 'id') out.add(ast.t === 'id' ? ast.v.toLowerCase() in CONSTS ? null : ast.v : ast.v);
    if (ast.l) refs(ast.l, out); if (ast.r) refs(ast.r, out); if (ast.a) refs(ast.a, out);
    if (ast.args) ast.args.forEach(a => refs(a, out));
    out.delete(null);
    return out;
  }

  function evaluate(ast, resolve) {
    switch (ast.t) {
      case 'num': return ast.v;
      case 'var': case 'name': return num(resolve(ast.v, ast.t), ast.v);
      case 'id': {
        const lw = ast.v.toLowerCase();
        if (lw in CONSTS) return CONSTS[lw];
        return num(resolve(ast.v, 'id'), ast.v);
      }
      case 'un': {
        const a = evaluate(ast.a, resolve);
        return ast.o === '-' ? -a : ast.o === '!' ? (a ? 0 : 1) : a;
      }
      case 'bin': {
        const l = evaluate(ast.l, resolve);
        if (ast.o === '&&') return l ? (evaluate(ast.r, resolve) ? 1 : 0) : 0;
        if (ast.o === '||') return l ? 1 : (evaluate(ast.r, resolve) ? 1 : 0);
        const r = evaluate(ast.r, resolve);
        switch (ast.o) {
          case '+': return l + r; case '-': return l - r; case '*': return l * r;
          case '/': if (r === 0) throw new FErr('Divisão por zero'); return l / r;
          case '%': if (r === 0) throw new FErr('Divisão por zero'); return l % r;
          case '^': return Math.pow(l, r);
          case '<': return l < r ? 1 : 0; case '>': return l > r ? 1 : 0;
          case '<=': return l <= r ? 1 : 0; case '>=': return l >= r ? 1 : 0;
          case '==': return l === r ? 1 : 0; case '!=': return l !== r ? 1 : 0;
        }
        throw new FErr('Operador inválido');
      }
      case 'call': return FUNCS[ast.f].f(...ast.args.map(a => evaluate(a, resolve)));
    }
    throw new FErr('Nó inválido');
  }
  function num(v, name) {
    if (typeof v === 'boolean') return v ? 1 : 0;
    if (typeof v !== 'number' || Number.isNaN(v)) throw new FErr('Valor não numérico para ' + name);
    return v;
  }

  /* symbols: [{id, name, code}] */
  function findSym(symbols, key) {
    const n = U.norm(key);
    return symbols.find(s => U.norm(s.name) === n || (s.code && U.norm(s.code) === n));
  }
  function toCanonical(text, symbols) {
    const unknown = [];
    let out = String(text || '').replace(/\[([^\]]+)\]/g, (m, name) => {
      const s = findSym(symbols, name.trim());
      if (!s) { unknown.push(name.trim()); return m; }
      return '$' + s.id;
    });
    // identificadores soltos que batem com o código de um símbolo
    out = out.replace(/(^|[^$A-Za-zÀ-ÿ0-9_])([A-Za-zÀ-ÿ_][A-Za-zÀ-ÿ0-9_]*)(?=\s*[^(\w]|\s*$)/g, (m, pre, w) => {
      if (FUNCS[w.toLowerCase()] || w.toLowerCase() in CONSTS) return m;
      const s = symbols.find(x => x.code && x.code === w);
      return s ? pre + '$' + s.id : m;
    });
    return { text: out, unknown };
  }
  function toDisplay(canon, symbols) {
    return String(canon || '').replace(/\$([A-Za-z0-9_]+)/g, (m, id) => {
      const s = symbols.find(x => x.id === id);
      return s ? '[' + s.name + ']' : '[?removido]';
    });
  }

  /* Verifica uma fórmula: sintaxe + referências conhecidas. builtins: nomes livres aceitos (ex.: nivel) */
  function check(canon, symbols, builtins = []) {
    try {
      const ast = parse(canon);
      const missing = [];
      for (const r of refs(ast)) {
        if (r.startsWith('$')) { if (!symbols.find(s => '$' + s.id === r)) missing.push('referência removida'); }
        else if (!builtins.map(U.norm).includes(U.norm(r)) && !findSym(symbols, r)) missing.push(r);
      }
      if (missing.length) return { ok: false, error: 'Referência inexistente: ' + U.uniq(missing).join(', ') };
      return { ok: true, ast };
    } catch (e) { return { ok: false, error: e.message + (e.pos != null ? ' (posição ' + (e.pos + 1) + ')' : '') }; }
  }

  function applyRounding(v, mode) {
    if (typeof v !== 'number' || !isFinite(v)) return v;
    switch (mode) {
      case 'floor': return Math.floor(v);
      case 'ceil': return Math.ceil(v);
      case 'round': return Math.round(v);
      case '1': return Math.round(v * 10) / 10;
      case '2': return Math.round(v * 100) / 100;
      default: return v;
    }
  }

  /* Calcula atributos derivados.
     defs: [{id,name,code,derived,formula,rounding,min,max,formulaEnabled}]
     base: {attrId: number} valores já com modificadores (não derivados)
     extra: {nomeLivre: number} (ex.: nivel)
     postMods(id, value) → valor final aplicando modificadores após a fórmula
     Retorna {values, errors, order, deps} */
  function computeAll(defs, base, extra = {}, postMods = null) {
    const symbols = defs.map(d => ({ id: d.id, name: d.name, code: d.code }));
    const values = {}; const errors = {}; const deps = {};
    const state = {};
    const extraN = {}; for (const [k, v] of Object.entries(extra)) extraN[U.norm(k)] = v;
    const byId = Object.fromEntries(defs.map(d => [d.id, d]));
    function resolveName(name) {
      if (name.startsWith('$')) return name.slice(1);
      const n = U.norm(name);
      if (n in extraN) return { extra: extraN[n] };
      const s = findSym(symbols, name);
      return s ? s.id : null;
    }
    function val(id, stack) {
      if (id in values) return values[id];
      const d = byId[id];
      if (!d) throw new FErr('Referência inexistente');
      if (!(d.derived && d.formulaEnabled !== false && d.formula)) {
        values[id] = typeof base[id] === 'number' ? base[id] : (Number(base[id]) || 0);
        return values[id];
      }
      if (state[id] === 'visiting') {
        const cyc = [...stack.slice(stack.indexOf(id)), id].map(x => byId[x] ? byId[x].name : '?').join(' → ');
        throw new FErr('Dependência circular: ' + cyc);
      }
      state[id] = 'visiting';
      try {
        const ast = parse(d.formula);
        deps[id] = [...refs(ast)].map(r => { const x = resolveName(r); return typeof x === 'string' ? x : null; }).filter(Boolean);
        let v = evaluate(ast, (name) => {
          const x = resolveName(name);
          if (x && typeof x === 'object') return x.extra;
          if (!x) throw new FErr('Referência inexistente: ' + name);
          return val(x, [...stack, id]);
        });
        v = applyRounding(v, d.rounding);
        if (postMods) v = postMods(id, v);
        if (d.min !== '' && d.min != null && !isNaN(d.min)) v = Math.max(Number(d.min), v);
        if (d.max !== '' && d.max != null && !isNaN(d.max)) v = Math.min(Number(d.max), v);
        values[id] = v;
        state[id] = 'done';
        return v;
      } catch (e) {
        state[id] = 'done';
        if (!errors[id]) errors[id] = e.message;
        values[id] = NaN;
        throw e;
      }
    }
    for (const d of defs) { try { val(d.id, []); } catch (e) { if (!errors[d.id]) errors[d.id] = e.message; } }
    return { values, errors, deps };
  }

  /* Avalia uma expressão avulsa com um mapa de símbolos → valores. Retorna {value, used:[{name,value}], error} */
  function run(canon, symbols, valuesById, extra = {}) {
    const used = [];
    try {
      const ast = parse(canon);
      const extraN = {}; for (const [k, v] of Object.entries(extra)) extraN[U.norm(k)] = v;
      const value = evaluate(ast, (name) => {
        let id = null;
        if (name.startsWith('$')) id = name.slice(1);
        else if (U.norm(name) in extraN) { const v = extraN[U.norm(name)]; used.push({ name, value: v }); return v; }
        else { const s = findSym(symbols, name); id = s && s.id; }
        const s = symbols.find(x => x.id === id);
        if (!s) throw new FErr('Referência inexistente: ' + (name.startsWith('$') ? 'removida' : name));
        const v = valuesById[id];
        used.push({ name: s.name, value: v });
        return typeof v === 'number' ? v : Number(v) || 0;
      });
      return { value, used: U.uniq(used.map(u => JSON.stringify(u))).map(x => JSON.parse(x)) };
    } catch (e) { return { error: e.message, used }; }
  }

  return { parse, evaluate, refs, check, toCanonical, toDisplay, computeAll, run, applyRounding, FUNCS: Object.keys(FUNCS) };
})();
