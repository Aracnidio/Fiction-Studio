/* Fiction Studio — componentes reutilizáveis: navegação, tags, seletores de registros, campos. */
'use strict';

const Nav = {
  go(path) { if (location.hash !== '#' + path) location.hash = path; else App.route(); },
  pid() { return Store.S.p && Store.S.p.id; },
  section(sec) { Nav.go('/p/' + Nav.pid() + '/' + sec); },
  entity(id, tab) { const e = Store.get(id); if (!e) return; Nav.go('/p/' + Nav.pid() + '/e/' + id + (tab ? '/' + tab : '')); },
  href(id) { return '#/p/' + Nav.pid() + '/e/' + id; },
};

const KIND_SECTION = { character: 'characters', location: 'locations', storyline: 'storylines', event: 'events', organization: 'organizations', lore: 'notes', skill: 'mech/skills', passive: 'mech/passives', class: 'mech/classes', item: 'mech/items', effect: 'mech/effects', skilltree: 'mech/trees', moodboard: 'refs', refcollection: 'refs/collections' };

function kc(kind) { return 'var(--k-' + kind + ', var(--muted))'; }
function kindDot(kind) { return h('span.kind-dot', { style: { '--k': kc(kind) }, title: Schema.kindLabel(kind) }); }
function kindIcon(kind, size = 16) { const i = icon((Schema.KINDS[kind] || {}).icon || 'box', size); i.style.color = kc(kind); return i; }
function kindChip(kind, label) { return h('span.kind-chip', { style: { '--k': kc(kind) } }, icon((Schema.KINDS[kind] || {}).icon || 'box', 13), label || Schema.kindLabel(kind)); }
/* Miniatura de um registro: imagem principal ou ícone da categoria */
function entityThumb(e, size = 20) {
  const im = Store.mainImage(e);
  if (im && Store.imgURL(im)) return h('img', { src: Store.imgURL(im), alt: '', loading: 'lazy' });
  return icon((Schema.KINDS[e.kind] || {}).icon || 'box', size);
}

function entityLink(id, { showKind = false } = {}) {
  const e = Store.get(id);
  if (!e) return h('span.muted', '(registro removido)');
  return h('span.row.nowrap', { style: { gap: '6px', display: 'inline-flex', minWidth: 0 } }, kindDot(e.kind),
    h('a.elink', { href: Nav.href(id), onclick: ev => { ev.preventDefault(); Nav.entity(id); } }, e.name),
    showKind ? h('span.muted.small', Schema.kindLabel(e.kind)) : null);
}

function tagChip(id, onRemove) {
  const t = Store.S.tags.get(id); if (!t) return null;
  return h('span.chip.tag', { style: { '--tc': t.color } }, t.name, onRemove ? h('button', { type: 'button', title: 'Remover tag', 'aria-label': 'Remover ' + t.name, onclick: onRemove }, icon('x', 12)) : null);
}
function tagChips(ids) { return h('div.chips', (ids || []).map(id => tagChip(id))); }

/* Campo de tags com sugestões e criação */
function tagInput(ids, onChange, { placeholder = 'Adicionar tag…' } = {}) {
  ids = [...(ids || [])];
  const wrap = h('div.taginput');
  const input = h('input', { placeholder, 'aria-label': 'Adicionar tag' });
  const sug = h('div.suggest', { hidden: true });
  let hl = 0, opts = [];
  function render() {
    clear(wrap);
    ids.forEach(id => { const c = tagChip(id, () => { ids = ids.filter(x => x !== id); onChange(ids); render(); }); if (c) wrap.appendChild(c); });
    wrap.append(input, sug);
  }
  function add(name) {
    const t = Store.ensureTag(name); if (!t) return;
    if (!ids.includes(t.id)) { ids.push(t.id); onChange(ids); }
    input.value = ''; sug.hidden = true; render(); input.focus();
  }
  function showSug() {
    const q = U.norm(input.value);
    opts = [...Store.S.tags.values()].filter(t => !ids.includes(t.id) && (!q || U.norm(t.name).includes(q))).sort(U.byName).slice(0, 12);
    clear(sug);
    opts.forEach((t, i) => sug.appendChild(h('div' + (i === hl ? '.hl' : ''), { onmousedown: e => { e.preventDefault(); add(t.name); } }, h('span.kind-dot', { style: { background: t.color } }), t.name)));
    if (q && !opts.some(t => U.norm(t.name) === q)) sug.appendChild(h('div', { onmousedown: e => { e.preventDefault(); add(input.value); } }, icon('plus', 13), 'Criar tag "' + input.value.trim() + '"'));
    sug.hidden = !sug.children.length;
  }
  input.addEventListener('input', () => { hl = 0; showSug(); });
  input.addEventListener('focus', showSug);
  input.addEventListener('blur', () => setTimeout(() => sug.hidden = true, 120));
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      if (input.value.trim()) add(opts[hl] && U.norm(opts[hl].name).startsWith(U.norm(input.value)) ? opts[hl].name : input.value);
    }
    else if (e.key === 'ArrowDown') { hl = Math.min(hl + 1, opts.length - 1); showSug(); }
    else if (e.key === 'ArrowUp') { hl = Math.max(hl - 1, 0); showSug(); }
    else if (e.key === 'Backspace' && !input.value && ids.length) { ids.pop(); onChange(ids); render(); input.focus(); }
  });
  render();
  return wrap;
}

/* Seletor de registros (um ou vários), com criação rápida */
function refPicker({ kind, kinds, multi = true, value, onChange, exclude = [], placeholder, allowCreate = true }) {
  kinds = kinds || [kind];
  let ids = multi ? [...(value || [])] : (value ? [value] : []);
  const wrap = h('div.taginput');
  const input = h('input', { placeholder: placeholder || (multi ? 'Vincular ' : 'Escolher ') + kinds.map(k => Schema.kindLabel(k).toLowerCase()).join('/') + '…', 'aria-label': 'Buscar registro' });
  const sug = h('div.suggest', { hidden: true });
  let opts = [], hl = 0;
  const emit = () => onChange(multi ? [...ids] : (ids[0] || null));
  function render() {
    clear(wrap);
    for (const id of ids) {
      const e = Store.get(id);
      wrap.appendChild(h('span.chip', e ? kindDot(e.kind) : null,
        e ? h('a.elink', { href: Nav.href(id), onclick: ev => { ev.preventDefault(); Nav.entity(id); }, style: { fontWeight: 500 } }, e.name) : h('span.muted', 'removido'),
        h('button', { type: 'button', 'aria-label': 'Desvincular', title: 'Desvincular', onclick: () => { ids = ids.filter(x => x !== id); emit(); render(); } }, icon('x', 12))));
    }
    if (multi || !ids.length) wrap.append(input, sug);
  }
  function pick(id) { if (!multi) ids = [id]; else if (!ids.includes(id)) ids.push(id); input.value = ''; sug.hidden = true; emit(); render(); if (multi) input.focus(); }
  function showSug() {
    const q = U.norm(input.value);
    opts = kinds.flatMap(k => Store.list(k)).filter(e => !ids.includes(e.id) && !exclude.includes(e.id) && (!q || U.norm(e.name).includes(q))).sort(U.byName).slice(0, 14);
    clear(sug);
    opts.forEach((e, i) => sug.appendChild(h('div' + (i === hl ? '.hl' : ''), { onmousedown: ev => { ev.preventDefault(); pick(e.id); } }, kindDot(e.kind), e.name, kinds.length > 1 ? h('span.muted.small', Schema.kindLabel(e.kind)) : null)));
    if (allowCreate && q && kinds.length === 1 && !opts.some(e => U.norm(e.name) === q)) {
      sug.appendChild(h('div', { onmousedown: async ev => { ev.preventDefault(); const name = input.value.trim(); const e = await quickCreate(kinds[0], name, { navigate: false }); if (e) pick(e.id); } }, icon('plus', 13), 'Criar ' + Schema.kindLabel(kinds[0]).toLowerCase() + ' "' + input.value.trim() + '"'));
    }
    if (!sug.children.length) sug.appendChild(h('div.muted', { style: { cursor: 'default' } }, q ? 'Nada encontrado' : 'Nenhum registro deste tipo ainda'));
    sug.hidden = false;
  }
  input.addEventListener('input', () => { hl = 0; showSug(); });
  input.addEventListener('focus', showSug);
  input.addEventListener('blur', () => setTimeout(() => sug.hidden = true, 150));
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); if (opts[hl]) pick(opts[hl].id); }
    else if (e.key === 'ArrowDown') { hl = Math.min(hl + 1, opts.length - 1); showSug(); }
    else if (e.key === 'ArrowUp') { hl = Math.max(hl - 1, 0); showSug(); }
  });
  render();
  return wrap;
}

/* Select com opções da lista configurável do projeto + "nova opção" */
function listSelect(listKey, value, onChange, { allowEmpty = true, id = null } = {}) {
  const sel = h('select.input', { id, 'aria-label': listKey });
  function fill() {
    clear(sel);
    if (allowEmpty) sel.appendChild(h('option', { value: '' }, '—'));
    const vals = Store.listValues(listKey);
    for (const v of vals) sel.appendChild(h('option', { value: v, selected: v === value }, v));
    if (value && !vals.includes(value)) sel.appendChild(h('option', { value, selected: true }, value + ' (fora da lista)'));
    sel.appendChild(h('option', { value: '__new' }, '+ Nova opção…'));
  }
  sel.addEventListener('change', async () => {
    if (sel.value === '__new') {
      const v = await Modal.prompt('Nova opção', 'Nome da opção');
      if (v) { Store.addListValue(listKey, v); value = v; onChange(v); }
      fill(); sel.value = value || '';
    } else { value = sel.value; onChange(value); }
  });
  fill();
  return sel;
}

/* Select a partir de listas de objetos {id,name} da mecânica (tipos de dano, slots) */
function mechSelect(listName, value, onChange) {
  const items = Store.S.p.mechanics[listName] || [];
  const sel = h('select.input', { onchange: () => onChange(sel.value || null), 'aria-label': listName },
    h('option', { value: '' }, '—'), items.map(x => h('option', { value: x.id, selected: x.id === value }, x.name)));
  return sel;
}

/* Controle de formulário para um campo do esquema */
function fieldControl(f, obj, onChange, { fav = null } = {}) {
  const v = obj[f.key];
  const id = 'f_' + f.key + '_' + Math.random().toString(36).slice(2, 7);
  let ctl;
  switch (f.type) {
    case 'textarea': ctl = h('textarea.input', { id, rows: f.rows || 3, value: v || '' }); ctl.addEventListener('input', () => onChange(ctl.value)); break;
    case 'number': ctl = h('input.input', { id, type: 'number', step: 'any', value: v ?? '' }); ctl.addEventListener('input', () => onChange(ctl.value === '' ? null : Number(ctl.value))); break;
    case 'bool': ctl = h('label.check', h('input', { id, type: 'checkbox', checked: !!v, onchange: e => onChange(e.target.checked) }), 'Sim'); break;
    case 'select': ctl = listSelect(f.list, v || '', onChange, { id }); break;
    case 'mechlist': ctl = mechSelect(f.list, v, onChange); break;
    case 'ref': ctl = refPicker({ kind: f.kind, multi: false, value: v, onChange, exclude: [obj.__selfId] }); break;
    case 'refs': ctl = refPicker({ kind: f.kind, multi: true, value: v || [], onChange, exclude: [obj.__selfId] }); break;
    default: ctl = h('input.input', { id, value: v || '' }); ctl.addEventListener('input', () => onChange(ctl.value));
  }
  const favBtn = fav ? h('button.fav' + (fav.on ? '.on' : ''), { type: 'button', title: fav.on ? 'Remover dos destaques da visão geral' : 'Destacar na visão geral', 'aria-label': 'Destacar ' + f.label, 'aria-pressed': String(!!fav.on), onclick: e => { e.preventDefault(); fav.on = !fav.on; e.currentTarget.classList.toggle('on', fav.on); e.currentTarget.setAttribute('aria-pressed', String(fav.on)); fav.toggle(fav.on); } }, icon('star', 13)) : null;
  return h('label.field' + (f.wide ? '.wide' : ''), { for: id }, h('span.field-head', h('span.lbl', f.label), favBtn), ctl, f.hint ? h('span.hint', f.hint) : null);
}

/* Criação rápida de registro com aviso de nomes semelhantes */
async function quickCreate(kind, name = '', { navigate = true, fields = {}, extra = {} } = {}) {
  if (!name) {
    name = await Modal.prompt('Novo(a) ' + Schema.kindLabel(kind).toLowerCase(), 'Nome', '', { placeholder: 'Você pode preencher o resto depois' });
    if (!name) return null;
  }
  const sim = Store.findSimilar(kind, name);
  if (sim.length) {
    const ok = await Modal.confirm('Nome parecido já existe', h('div', h('p', 'Já existe ' + Schema.kindLabel(kind).toLowerCase() + ' com nome semelhante:'),
      h('ul', sim.slice(0, 6).map(e => h('li', e.name))), h('p', 'Criar mesmo assim?')), { okLabel: 'Criar mesmo assim' });
    if (!ok) return null;
  }
  const e = Store.newEntity(kind, { name, fields: { ...fields }, ...extra });
  if (kind === 'skilltree') { e.nodes = []; e.edges = []; Store.saveEntity(e, { silent: true }); }
  if (kind === 'moodboard') { e.items = e.items || []; e.view = null; Store.saveEntity(e, { silent: true }); }
  if (navigate) Nav.entity(e.id);
  else Toast.ok(Schema.kindLabel(kind) + ' "' + name + '" criado(a).');
  if (navigate) Toast.ok(Schema.kindLabel(kind) + ' criado(a).');
  return e;
}

/* Exclusão com relatório de impacto */
async function confirmDeleteEntity(id) {
  const e = Store.get(id); if (!e) return false;
  const imp = Store.impactOf(id);
  const items = [];
  imp.relations.forEach(r => { const o = Store.get(r.fromId === id ? r.toId : r.fromId); items.push('Relação "' + Store.relLabel(r, r.fromId === id ? r.toId : r.fromId) + '" com ' + (o ? o.name : '?') + ' será removida.'); });
  imp.referrers.forEach(r => items.push(Schema.kindLabel(r.kind) + ' "' + r.name + '" perderá o vínculo (o registro continua existindo).'));
  if (imp.images.length) items.push(imp.images.length + ' imagem(ns) deixarão de estar ligadas a este registro (' + imp.exclusiveImages.length + ' só estão aqui e continuarão na biblioteca, sem vínculo).');
  const body = h('div',
    h('p', 'Excluir ' + Schema.kindLabel(e.kind).toLowerCase() + ' "' + e.name + '"? Esta ação não pode ser desfeita.'),
    items.length ? [h('p.lbl', 'O que será afetado'), h('ul.impact', items.map(t => h('li', t))), h('p.muted.small', 'As alterações ficam registradas em Configurações → Integridade, para você corrigir depois.')] : h('p.muted', 'Este registro não tem conexões.'),
  );
  const ok = await Modal.confirm('Excluir registro', body, { danger: true, okLabel: 'Excluir' });
  if (ok) { Store.deleteEntity(id); Toast.ok('"' + e.name + '" excluído.'); }
  return ok;
}

/* Reordenação por arrastar e soltar em listas */
function makeSortable(container, itemSelector, onDrop) {
  let dragEl = null;
  container.querySelectorAll(itemSelector).forEach((el, i) => {
    el.draggable = true; el.dataset.idx = i;
    el.addEventListener('dragstart', e => { dragEl = el; el.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(i)); });
    el.addEventListener('dragend', () => { el.classList.remove('dragging'); container.querySelectorAll('.dropzone').forEach(x => x.classList.remove('dropzone')); });
    el.addEventListener('dragover', e => { if (!dragEl) return; e.preventDefault(); el.classList.add('dropzone'); });
    el.addEventListener('dragleave', () => el.classList.remove('dropzone'));
    el.addEventListener('drop', e => {
      e.preventDefault(); el.classList.remove('dropzone');
      if (!dragEl || dragEl === el) return;
      onDrop(Number(dragEl.dataset.idx), Number(el.dataset.idx)); dragEl = null;
    });
  });
}

function emptyState(title, text, action, ic = 'sparkles') {
  return h('div.empty', h('div.empty-ic', icon(ic, 20)), h('h3', title), text ? h('p', text) : null, action ? h('div.row', { style: { justifyContent: 'center', marginTop: '12px' } }, action) : null);
}
function pageHead(title, sub, ...actions) {
  return h('div.page-head', h('div.titles', h('h1', title), sub ? h('p', sub) : null), h('div.row', actions));
}
/* Campo de busca com ícone */
function searchInput(value, onInput, placeholder, width = '260px') {
  const inp = h('input.input', { value: value || '', placeholder, 'aria-label': placeholder, type: 'search' });
  inp.addEventListener('input', () => onInput(inp.value));
  return h('div.search-box', { style: { width, maxWidth: '100%' } }, icon('search', 15), inp);
}
/* Painel lateral redimensionável; a largura fica salva nas preferências. */
function resizableSide(side, key, def = 320, min = 240, max = 560) {
  const prefs = Store.ui();
  const w = Math.min(max, Math.max(min, (prefs.panelWidths || {})[key] || def));
  side.style.setProperty('--pw', w + 'px');
  const handle = h('div.resizer', { role: 'separator', 'aria-orientation': 'vertical', 'aria-label': 'Redimensionar painel', tabindex: 0, title: 'Arraste para redimensionar' });
  let st = null;
  const set = (nw) => { nw = Math.round(Math.min(max, Math.max(min, nw))); side.style.setProperty('--pw', nw + 'px'); return nw; };
  const save = (nw) => { const u = Store.ui(); u.panelWidths = u.panelWidths || {}; u.panelWidths[key] = nw; Store.saveSettings(); window.dispatchEvent(new Event('resize')); };
  handle.addEventListener('pointerdown', e => { st = { x: e.clientX, w: side.getBoundingClientRect().width }; handle.setPointerCapture(e.pointerId); handle.classList.add('drag'); });
  handle.addEventListener('pointermove', e => { if (st) set(st.w - (e.clientX - st.x)); });
  handle.addEventListener('pointerup', () => { if (!st) return; st = null; handle.classList.remove('drag'); save(side.getBoundingClientRect().width); });
  handle.addEventListener('keydown', e => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); save(set(side.getBoundingClientRect().width + (e.key === 'ArrowLeft' ? 24 : -24))); } });
  return handle;
}
/* Controles comuns das áreas de trabalho: zoom, enquadrar, desfazer e ajuda. */
function canvasControls({ zoomIn, zoomOut, fit, getZoom, setZoom, undo, redo, canUndo, canRedo, help }) {
  const val = h('button.zoomval', { type: 'button', title: 'Voltar a 100%', 'aria-label': 'Zoom atual; clique para 100%', onclick: () => { setZoom ? setZoom(1) : null; upd(); } });
  const u = undo ? btn('', () => { undo(); upd(); }, { ic: 'undo', title: 'Desfazer (Ctrl+Z)' }) : null;
  const r = redo ? btn('', () => { redo(); upd(); }, { ic: 'redo', title: 'Refazer (Ctrl+Shift+Z)' }) : null;
  let pop = null;
  const helpBtn = help ? btn('', () => { if (pop) { pop.remove(); pop = null; return; } pop = h('div.help-pop', h('h4', 'Atalhos e gestos'), h('dl', help.map(([k, d]) => [h('dt', h('span.kbd', k)), h('dd', d)]))); el.parentElement.appendChild(pop); }, { ic: 'help', title: 'Ajuda' }) : null;
  const el = h('div.cctl', u, r, u ? h('span.div') : null,
    btn('', () => { zoomOut(); upd(); }, { ic: 'zoomout', title: 'Afastar (−)' }), val, btn('', () => { zoomIn(); upd(); }, { ic: 'zoomin', title: 'Aproximar (+)' }),
    btn('', () => { fit(); upd(); }, { ic: 'center', title: 'Enquadrar tudo (Ctrl+0)' }), helpBtn ? h('span.div') : null, helpBtn);
  function upd() { val.textContent = Math.round((getZoom() || 1) * 100) + '%'; if (u) u.disabled = !canUndo(); if (r) r.disabled = !canRedo(); }
  el.update = upd; setTimeout(upd, 0);
  return el;
}
const COMMON_CANVAS_HELP = [['Arrastar o fundo', 'mover a área de trabalho'], ['Roda do mouse', 'aproximar e afastar'], ['Clique', 'selecionar'], ['Duplo clique', 'abrir ou editar']];
function statusPill(text) {
  if (!text) return null;
  const n = U.norm(text);
  const cls = /conclu|revisad|vivo|escrito|ativo/.test(n) ? 'ok' : /morto|descart|arquiv/.test(n) ? 'err' : /planej|ideia|rascunho/.test(n) ? 'cy' : /desenvolv|revis/.test(n) ? 'warn' : '';
  return h('span.pill' + (cls ? '.' + cls : ''), text);
}
