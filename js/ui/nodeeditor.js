/* Fiction Studio — editor visual de nós (árvores de habilidades e ramificações de visual novel). */
'use strict';

/* Controles padrão (zoom, enquadrar, ajuda) para editores de nós. */
function attachNodeControls(ed, box, extraHelp = []) {
  const ctl = canvasControls({ zoomIn: () => ed.vp.zoom(1.25), zoomOut: () => ed.vp.zoom(0.8), fit: () => ed.fit(), getZoom: () => ed.vp.k, setZoom: k => ed.vp.zoom(k / ed.vp.k),
    help: [...COMMON_CANVAS_HELP, ['Duplo clique no fundo', 'criar nó'], ['Ponto ciano', 'arrastar até outro nó para conectar'], ['Delete', 'remover seleção'], ...extraHelp] });
  box.appendChild(ctl);
  const orig = ed.vp.apply.bind(ed.vp); ed.vp.apply = () => { orig(); ctl.update(); };
  return ctl;
}
class NodeEditor {
  /* doc: {nodes:[{id,type,label,x,y,...}], edges:[{id,from,to,label}]}
     opts: {types:[{id,label,color,shape}], onChange(), onSelect(sel), sub(node)→string, statusClass(node)→string, onNodeClick(node)→bool, onCreateAt(x,y)} */
  constructor(container, doc, opts = {}) {
    this.c = container; this.doc = doc; this.o = opts;
    this.W = 176; this.H = 56;
    this.svg = s('svg', { class: 'viz', role: 'application', 'aria-label': 'Editor de nós', tabindex: 0 });
    this.markerId = 'ne-arrow-' + (NodeEditor.n = (NodeEditor.n || 0) + 1);
    this.svg.appendChild(s('defs', {}, s('marker', { id: this.markerId, viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 8, markerHeight: 8, orient: 'auto-start-reverse' }, s('path', { d: 'M0,0 L10,5 L0,10 z', style: 'fill: var(--fg-2)' }))));
    this.layer = s('g'); this.edgeLayer = s('g'); this.nodeLayer = s('g'); this.tempLayer = s('g');
    this.layer.append(this.edgeLayer, this.nodeLayer, this.tempLayer); this.svg.appendChild(this.layer);
    this.vp = new Viewport(this.svg, this.layer, { onBackgroundClick: () => { this.connectFrom = null; this.select(null); } });
    this.sel = null; this.connectMode = false; this.connectFrom = null; this.filter = null; this.errNodes = new Set(); this.errEdges = new Set();
    this.svg.addEventListener('dblclick', e => {
      if (e.target.closest('[data-node],[data-edge]')) return;
      const w = this.vp.toWorld(e.clientX, e.clientY);
      if (this.o.onCreateAt) this.o.onCreateAt(w.x - this.W / 2, w.y - this.H / 2);
    });
    this.svg.addEventListener('keydown', e => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && this.sel && !this.o.readOnly && !/input|textarea|select/i.test(document.activeElement.tagName)) { e.preventDefault(); this.deleteSelection(); }
    });
    container.appendChild(this.svg);
    this.render();
  }
  type(n) { return (this.o.types || []).find(t => t.id === n.type) || { color: '#8b7cf6', shape: 'rect', label: '' }; }
  render() {
    clear(this.edgeLayer); clear(this.nodeLayer);
    this.nodeEls = {};
    const byId = Object.fromEntries(this.doc.nodes.map(n => [n.id, n]));
    for (const e of this.doc.edges) {
      const a = byId[e.from], b = byId[e.to]; if (!a || !b) continue;
      const g = s('g', { class: 'gedge' + (this.sel && this.sel.edge === e.id ? ' sel' : '') + (this.errEdges.has(e.id) ? ' err' : ''), 'data-edge': e.id });
      const d = this.edgePath(a, b);
      const hit = s('path', { class: 'hit', d });
      const path = s('path', { d, 'marker-end': `url(#${this.markerId})`, style: this.errEdges.has(e.id) ? 'stroke: var(--err)' : (e.color ? 'stroke:' + e.color : null) });
      g.append(hit, path);
      if (e.label) { const m = this.mid(a, b); g.appendChild(s('text', { x: m.x, y: m.y - 4, 'text-anchor': 'middle', style: 'font-size:11.5px' }, e.label.length > 34 ? e.label.slice(0, 33) + '…' : e.label)); }
      g.addEventListener('pointerdown', ev => ev.stopPropagation());
      g.addEventListener('click', ev => { ev.stopPropagation(); this.select({ edge: e.id }); });
      this.edgeLayer.appendChild(g);
    }
    for (const n of this.doc.nodes) this.nodeLayer.appendChild(this.nodeEl(n));
  }
  edgePath(a, b) {
    const x1 = a.x + this.W / 2, y1 = a.y + this.H, x2 = b.x + this.W / 2, y2 = b.y - 2;
    if (y2 > y1 + 10) { const dy = Math.max(30, (y2 - y1) / 2); return `M${x1},${y1} C${x1},${y1 + dy} ${x2},${y2 - dy} ${x2},${y2}`; }
    // destino acima/ao lado: liga pelas laterais
    const sx = a.x + (b.x > a.x ? this.W : 0), sy = a.y + this.H / 2, ex = b.x + (b.x > a.x ? 0 : this.W), ey = b.y + this.H / 2;
    const dx = Math.max(40, Math.abs(ex - sx) / 2) * (b.x > a.x ? 1 : -1);
    return `M${sx},${sy} C${sx + dx},${sy} ${ex - dx},${ey} ${ex},${ey}`;
  }
  mid(a, b) { return { x: (a.x + b.x) / 2 + this.W / 2, y: (a.y + this.H + b.y) / 2 }; }
  nodeEl(n) {
    const t = this.type(n); const W = this.W, H = this.H;
    const status = this.o.statusClass ? this.o.statusClass(n) : '';
    const dim = this.filter && !this.filter(n);
    const g = s('g', { class: 'tnode' + (this.sel && this.sel.node === n.id ? ' sel' : '') + (this.errNodes.has(n.id) ? ' err' : '') + (n.hidden ? ' hiddenNode' : '') + (status ? ' ' + status : ''), 'data-node': n.id, transform: `translate(${n.x},${n.y})`, style: dim ? 'opacity:.15' : null });
    const color = n.color || t.color;
    let card;
    if (t.shape === 'diamond') card = s('path', { class: 'card', d: `M14,0 H${W - 14} L${W},${H / 2} L${W - 14},${H} H14 L0,${H / 2} Z` });
    else if (t.shape === 'hex') card = s('path', { class: 'card', d: `M10,0 H${W - 10} L${W},${H / 2} L${W - 10},${H} H10 L0,${H / 2} Z` });
    else card = s('rect', { class: 'card', width: W, height: H, rx: t.shape === 'round' ? H / 2 : 7 });
    g.appendChild(card);
    g.appendChild(s('rect', { x: t.shape === 'round' ? 20 : 12, y: 0, width: W - (t.shape === 'round' ? 40 : 24), height: 3.5, rx: 2, fill: color }));
    g.appendChild(s('circle', { cx: 24, cy: H / 2, r: 14, fill: color, 'fill-opacity': .22, stroke: color, 'stroke-width': 1.4 }));
    g.appendChild(s('text', { x: 24, y: H / 2 + 5, 'text-anchor': 'middle', style: 'font-size:14px;font-weight:700' }, (n.icon || (t.label || '?')[0] || '?').slice(0, 2)));
    const label = n.label || 'Sem nome';
    g.appendChild(s('text', { x: 46, y: 24, style: 'font-size:13px;font-weight:600' }, label.length > 19 ? label.slice(0, 18) + '…' : label));
    const sub = this.o.sub ? this.o.sub(n) : t.label;
    g.appendChild(s('text', { x: 46, y: 41, style: 'font-size:11px;fill:var(--muted)' }, sub && sub.length > 26 ? sub.slice(0, 25) + '…' : (sub || '')));
    if (n.isRoot) g.appendChild(s('text', { x: W - 10, y: 16, 'text-anchor': 'end', style: 'font-size:10px;fill:var(--cyan);font-weight:700' }, 'INÍCIO'));
    if (n.hidden) g.appendChild(s('text', { x: W - 10, y: H - 8, 'text-anchor': 'end', style: 'font-size:10px;fill:var(--muted)' }, 'oculto'));
    if (!this.o.readOnly) {
      const port = s('circle', { class: 'port', cx: W / 2, cy: H, r: 7, 'data-port': n.id });
      g.appendChild(port);
      this.attachPort(port, n);
    }
    this.attachDrag(g, n);
    this.nodeEls[n.id] = g;
    return g;
  }
  attachDrag(g, n) {
    let st = null;
    g.addEventListener('pointerdown', ev => {
      if (ev.button !== 0 || ev.target.dataset.port) return;
      ev.stopPropagation();
      const w = this.vp.toWorld(ev.clientX, ev.clientY);
      st = { dx: w.x - n.x, dy: w.y - n.y, moved: false };
      g.setPointerCapture(ev.pointerId);
    });
    g.addEventListener('pointermove', ev => {
      if (!st || this.o.readOnly) return;
      const w = this.vp.toWorld(ev.clientX, ev.clientY);
      const nx = Math.round((w.x - st.dx) / 8) * 8, ny = Math.round((w.y - st.dy) / 8) * 8;
      if (nx !== n.x || ny !== n.y) { st.moved = true; n.x = nx; n.y = ny; g.setAttribute('transform', `translate(${n.x},${n.y})`); this.renderEdgesOnly(); }
    });
    const up = () => {
      if (!st) return;
      const moved = st.moved; st = null;
      if (moved) { this.o.onChange && this.o.onChange('move'); return; }
      if (this.o.onNodeClick && this.o.onNodeClick(n)) return;
      if (this.connectMode) {
        if (!this.connectFrom) { this.connectFrom = n.id; this.select({ node: n.id }); Toast.show('Agora clique no nó de destino.', 'ok', 1800); }
        else { this.addEdge(this.connectFrom, n.id); this.connectFrom = null; }
        return;
      }
      this.select({ node: n.id });
    };
    g.addEventListener('pointerup', up); g.addEventListener('pointercancel', () => { st = null; });
  }
  attachPort(port, n) {
    let line = null;
    port.addEventListener('pointerdown', ev => {
      ev.stopPropagation(); port.setPointerCapture(ev.pointerId);
      line = s('path', { style: 'stroke: var(--cyan); stroke-width: 2; fill: none; stroke-dasharray: 5 4', 'marker-end': `url(#${this.markerId})` });
      this.tempLayer.appendChild(line);
    });
    port.addEventListener('pointermove', ev => {
      if (!line) return;
      const w = this.vp.toWorld(ev.clientX, ev.clientY);
      const x1 = n.x + this.W / 2, y1 = n.y + this.H;
      line.setAttribute('d', `M${x1},${y1} C${x1},${y1 + 40} ${w.x},${w.y - 40} ${w.x},${w.y}`);
    });
    port.addEventListener('pointerup', ev => {
      if (!line) return; line.remove(); line = null;
      const w = this.vp.toWorld(ev.clientX, ev.clientY);
      const target = this.doc.nodes.find(m => m.id !== n.id && w.x >= m.x && w.x <= m.x + this.W && w.y >= m.y && w.y <= m.y + this.H);
      if (target) this.addEdge(n.id, target.id);
    });
  }
  renderEdgesOnly() {
    const byId = Object.fromEntries(this.doc.nodes.map(n => [n.id, n]));
    for (const g of this.edgeLayer.children) {
      const e = this.doc.edges.find(x => x.id === g.dataset.edge); if (!e) continue;
      const a = byId[e.from], b = byId[e.to]; if (!a || !b) continue;
      const d = this.edgePath(a, b);
      g.querySelectorAll('path').forEach(p => p.setAttribute('d', d));
      const t = g.querySelector('text'); if (t) { const m = this.mid(a, b); t.setAttribute('x', m.x); t.setAttribute('y', m.y - 4); }
    }
  }
  addEdge(from, to) {
    if (from === to) { Toast.warn('Um nó não pode depender de si mesmo.'); return; }
    if (this.doc.edges.some(e => e.from === from && e.to === to)) { Toast.warn('Essa conexão já existe.'); return; }
    const e = { id: U.id('ed'), from, to, label: '' };
    this.doc.edges.push(e);
    this.render(); this.select({ edge: e.id });
    this.o.onChange && this.o.onChange('edge');
  }
  deleteSelection() {
    if (!this.sel) return;
    if (this.sel.edge) this.doc.edges = this.doc.edges.filter(e => e.id !== this.sel.edge);
    if (this.sel.node) { const id = this.sel.node; this.doc.nodes = this.doc.nodes.filter(n => n.id !== id); this.doc.edges = this.doc.edges.filter(e => e.from !== id && e.to !== id); }
    this.sel = null; this.render(); this.o.onChange && this.o.onChange('delete'); this.o.onSelect && this.o.onSelect(null);
  }
  select(sel) { this.sel = sel; this.render(); this.o.onSelect && this.o.onSelect(sel); }
  bbox() {
    if (!this.doc.nodes.length) return null;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of this.doc.nodes) { minX = Math.min(minX, n.x); minY = Math.min(minY, n.y); maxX = Math.max(maxX, n.x + this.W); maxY = Math.max(maxY, n.y + this.H + 20); }
    return { minX, minY, maxX, maxY };
  }
  fit() { this.vp.fit(this.bbox()); }
  centerView() { const b = this.bbox(); if (b) this.vp.centerOn((b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2); }
  focusNode(id) { const n = this.doc.nodes.find(x => x.id === id); if (n) { this.vp.centerOn(n.x + this.W / 2, n.y + this.H / 2); this.select({ node: id }); } }
  autoLayout() {
    const pos = Layout.layered(this.doc.nodes.map(n => ({ id: n.id })), this.doc.edges.map(e => ({ source: e.from, target: e.to })), { gapX: this.W + 40, gapY: this.H + 70 });
    for (const n of this.doc.nodes) if (pos[n.id]) { n.x = Math.round(pos[n.id].x); n.y = Math.round(pos[n.id].y); }
    this.render(); this.fit(); this.o.onChange && this.o.onChange('layout');
  }
  nextFreePos() {
    const b = this.bbox(); if (!b) return { x: 0, y: 0 };
    const r = this.svg.getBoundingClientRect();
    const w = this.vp.toWorld(r.left + r.width / 2, r.top + r.height / 2);
    let x = Math.round(w.x - this.W / 2), y = Math.round(w.y - this.H / 2);
    while (this.doc.nodes.some(n => Math.abs(n.x - x) < this.W && Math.abs(n.y - y) < this.H + 10)) y += this.H + 24;
    return { x, y };
  }
}
