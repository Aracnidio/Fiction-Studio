/* Fiction Studio — visualização: viewport com pan/zoom, algoritmos de layout, grafo interativo e exportação PNG. */
'use strict';

const SVGNS = 'http://www.w3.org/2000/svg';
function s(tag, attrs = {}, ...kids) {
  const el = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null && v !== false) el.setAttribute(k, v);
  for (const k of kids.flat()) if (k != null) el.appendChild(typeof k === 'string' ? document.createTextNode(k) : k);
  return el;
}

/* Pan e zoom sobre um <g> dentro de um <svg>. */
class Viewport {
  constructor(svg, layer, { onBackgroundClick = null, minZoom = 0.12, maxZoom = 3 } = {}) {
    this.svg = svg; this.layer = layer; this.x = 0; this.y = 0; this.k = 1; this.min = minZoom; this.max = maxZoom;
    this.onBackgroundClick = onBackgroundClick;
    let start = null, moved = false;
    svg.addEventListener('pointerdown', e => {
      if (e.button !== 0 || e.target.closest('[data-node],[data-edge],[data-port]')) return;
      start = { x: e.clientX, y: e.clientY, ox: this.x, oy: this.y }; moved = false;
      svg.setPointerCapture(e.pointerId); svg.classList.add('panning');
    });
    svg.addEventListener('pointermove', e => {
      if (!start) return;
      const dx = e.clientX - start.x, dy = e.clientY - start.y;
      if (Math.abs(dx) + Math.abs(dy) > 3) moved = true;
      this.x = start.ox + dx; this.y = start.oy + dy; this.apply();
    });
    const end = e => {
      if (!start) return;
      svg.classList.remove('panning');
      if (!moved && this.onBackgroundClick) this.onBackgroundClick(e);
      start = null;
    };
    svg.addEventListener('pointerup', end); svg.addEventListener('pointercancel', end);
    svg.addEventListener('wheel', e => {
      e.preventDefault();
      const r = svg.getBoundingClientRect();
      this.zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * 0.0015));
    }, { passive: false });
  }
  apply() { this.layer.setAttribute('transform', `translate(${this.x},${this.y}) scale(${this.k})`); }
  zoomAt(px, py, f) {
    const k = Math.min(this.max, Math.max(this.min, this.k * f));
    const wx = (px - this.x) / this.k, wy = (py - this.y) / this.k;
    this.k = k; this.x = px - wx * k; this.y = py - wy * k; this.apply();
  }
  zoom(f) { const r = this.svg.getBoundingClientRect(); this.zoomAt(r.width / 2, r.height / 2, f); }
  toWorld(clientX, clientY) { const r = this.svg.getBoundingClientRect(); return { x: (clientX - r.left - this.x) / this.k, y: (clientY - r.top - this.y) / this.k }; }
  fit(bbox, pad = 100) {
    const r = this.svg.getBoundingClientRect();
    if (!bbox || !isFinite(bbox.minX) || r.width === 0) { this.x = r.width / 2; this.y = r.height / 2; this.k = 1; this.apply(); return; }
    const w = Math.max(bbox.maxX - bbox.minX, 1), hgt = Math.max(bbox.maxY - bbox.minY, 1);
    this.k = Math.min(this.max, Math.max(this.min, Math.min((r.width - pad * 2) / w, (r.height - pad * 2) / hgt, 1.4)));
    this.x = r.width / 2 - (bbox.minX + w / 2) * this.k; this.y = r.height / 2 - (bbox.minY + hgt / 2) * this.k; this.apply();
  }
  centerOn(x, y) { const r = this.svg.getBoundingClientRect(); this.x = r.width / 2 - x * this.k; this.y = r.height / 2 - y * this.k; this.apply(); }
}

/* ---------- layouts ---------- */
const Layout = {
  bbox(pos, ids) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const id of ids || Object.keys(pos)) { const p = pos[id]; if (!p) continue; minX = Math.min(minX, p.x); minY = Math.min(minY, p.y); maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y); }
    return { minX, minY, maxX, maxY };
  },
  circle(nodes) {
    const pos = {}; const n = nodes.length; const R = Math.max(120, n * 22);
    nodes.forEach((nd, i) => { const a = (i / n) * Math.PI * 2 - Math.PI / 2; pos[nd.id] = { x: Math.cos(a) * R, y: Math.sin(a) * R }; });
    return pos;
  },
  grid(nodes) {
    const pos = {}; const cols = Math.ceil(Math.sqrt(nodes.length));
    nodes.forEach((nd, i) => { pos[nd.id] = { x: (i % cols) * 170, y: Math.floor(i / cols) * 120 }; });
    return pos;
  },
  /* Fruchterman–Reingold com resfriamento; respeita posições fixas */
  force(nodes, edges, { fixed = {}, seed = {}, iterations } = {}) {
    const n = nodes.length; const pos = {};
    if (!n) return pos;
    const K = n < 40 ? 170 : n < 150 ? 130 : 110;
    nodes.forEach((nd, i) => {
      const p = seed[nd.id] || fixed[nd.id];
      pos[nd.id] = p ? { x: p.x, y: p.y } : { x: Math.cos(i * 2.4) * (30 + i * 9), y: Math.sin(i * 2.4) * (30 + i * 9) };
    });
    const ids = nodes.map(x => x.id); const idx = Object.fromEntries(ids.map((id, i) => [id, i]));
    const E = edges.filter(e => idx[e.source] != null && idx[e.target] != null && e.source !== e.target);
    const it = iterations || (n > 400 ? 120 : n > 150 ? 220 : 340);
    let temp = K * 2.5;
    const disp = ids.map(() => ({ x: 0, y: 0 }));
    for (let t = 0; t < it; t++) {
      for (const d of disp) { d.x = 0; d.y = 0; }
      for (let i = 0; i < n; i++) {
        const pi = pos[ids[i]];
        for (let j = i + 1; j < n; j++) {
          const pj = pos[ids[j]];
          let dx = pi.x - pj.x, dy = pi.y - pj.y; let d2 = dx * dx + dy * dy;
          if (d2 < 0.01) { dx = Math.random() - .5; dy = Math.random() - .5; d2 = 0.25; }
          if (d2 > 640000) continue;
          const f = (K * K) / d2;
          disp[i].x += dx * f; disp[i].y += dy * f; disp[j].x -= dx * f; disp[j].y -= dy * f;
        }
      }
      for (const e of E) {
        const a = idx[e.source], b = idx[e.target]; const pa = pos[ids[a]], pb = pos[ids[b]];
        const dx = pa.x - pb.x, dy = pa.y - pb.y; const d = Math.sqrt(dx * dx + dy * dy) || 0.01;
        const f = d / K; disp[a].x -= dx * f; disp[a].y -= dy * f; disp[b].x += dx * f; disp[b].y += dy * f;
      }
      for (let i = 0; i < n; i++) {
        if (fixed[ids[i]]) continue;
        const p = pos[ids[i]]; const d = disp[i];
        d.x -= p.x * 0.012; d.y -= p.y * 0.012; // gravidade leve
        const len = Math.sqrt(d.x * d.x + d.y * d.y) || 1;
        p.x += (d.x / len) * Math.min(len, temp); p.y += (d.y / len) * Math.min(len, temp);
      }
      temp = Math.max(2, temp * 0.975);
    }
    return pos;
  },
  /* Camadas (Sugiyama simplificado): níveis pelo caminho mais longo + ordenação por baricentro. */
  layered(nodes, edges, { dir = 'TB', gapX = 190, gapY = 130, rankOf = null } = {}) {
    const ids = nodes.map(n => n.id); const set = new Set(ids);
    const E = edges.filter(e => set.has(e.source) && set.has(e.target) && e.source !== e.target);
    const out = {}, inc = {}; ids.forEach(id => { out[id] = []; inc[id] = []; });
    E.forEach(e => { out[e.source].push(e.target); inc[e.target].push(e.source); });
    let rank = {};
    if (rankOf) ids.forEach(id => rank[id] = rankOf(id));
    else {
      // remove ciclos visitando em DFS e ignorando arestas de retorno
      const state = {}; const back = new Set();
      const dfs = id => { state[id] = 1; for (const t of out[id]) { if (state[t] === 1) back.add(id + '>' + t); else if (!state[t]) dfs(t); } state[id] = 2; };
      ids.forEach(id => { if (!state[id]) dfs(id); });
      const memo = {};
      const rk = (id, guard = 0) => {
        if (memo[id] != null) return memo[id];
        if (guard > ids.length) return 0;
        const ps = inc[id].filter(p => !back.has(p + '>' + id));
        memo[id] = ps.length ? Math.max(...ps.map(p => rk(p, guard + 1))) + 1 : 0;
        return memo[id];
      };
      ids.forEach(id => rank[id] = rk(id));
    }
    const layers = {};
    ids.forEach(id => (layers[rank[id]] = layers[rank[id]] || []).push(id));
    const keys = Object.keys(layers).map(Number).sort((a, b) => a - b);
    const order = {};
    keys.forEach(k => layers[k].forEach((id, i) => order[id] = i));
    for (let sweep = 0; sweep < 4; sweep++) {
      for (const k of (sweep % 2 ? [...keys].reverse() : keys)) {
        const nb = id => (sweep % 2 ? out[id] : inc[id]);
        layers[k].sort((a, b) => {
          const ba = nb(a).length ? nb(a).reduce((s, x) => s + order[x], 0) / nb(a).length : order[a];
          const bb = nb(b).length ? nb(b).reduce((s, x) => s + order[x], 0) / nb(b).length : order[b];
          return ba - bb;
        });
        layers[k].forEach((id, i) => order[id] = i);
      }
    }
    const pos = {};
    keys.forEach((k, li) => {
      const L = layers[k]; const w = (L.length - 1) * gapX;
      L.forEach((id, i) => {
        const a = i * gapX - w / 2, b = li * gapY;
        pos[id] = dir === 'LR' ? { x: b * (gapX / gapY), y: a * (gapY / gapX) } : { x: a, y: b };
      });
    });
    return pos;
  },
};

/* ---------- grafo interativo ---------- */
/* nodes: [{id,label,color,shape,img,sub}], edges: [{id,source,target,label,directed,dashed,color}] */
class GraphView {
  constructor(container, { onSelect, onOpen, onMove, showLabels = true } = {}) {
    this.c = container; this.onSelect = onSelect; this.onOpen = onOpen; this.onMove = onMove; this.showLabels = showLabels;
    this.svg = s('svg', { class: 'viz', role: 'img', 'aria-label': 'Grafo de relacionamentos' });
    const defs = s('defs');
    defs.appendChild(s('marker', { id: 'arrow-' + (GraphView.n = (GraphView.n || 0) + 1), viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' }, s('path', { d: 'M0,0 L10,5 L0,10 z', style: 'fill: var(--muted)' })));
    this.markerId = 'arrow-' + GraphView.n;
    this.svg.appendChild(defs); this.defs = defs;
    this.layer = s('g'); this.edgeLayer = s('g'); this.nodeLayer = s('g');
    this.layer.append(this.edgeLayer, this.nodeLayer); this.svg.appendChild(this.layer);
    this.vp = new Viewport(this.svg, this.layer, { onBackgroundClick: () => this.select(null) });
    container.appendChild(this.svg);
    this.nodes = []; this.edges = []; this.pos = {}; this.selected = null;
  }
  setData(nodes, edges, pos) { this.nodes = nodes; this.edges = edges; this.pos = pos; this.render(); }
  radius(n) { return n.size || 18; }
  shapeEl(n) {
    const r = this.radius(n); const fill = n.color || '#888';
    const common = { class: 'shape', fill, stroke: 'rgba(0,0,0,.25)', 'stroke-width': 1.5 };
    switch (n.shape) {
      case 'rect': return s('rect', { ...common, x: -r, y: -r, width: r * 2, height: r * 2, rx: 6 });
      case 'diamond': return s('path', { ...common, d: `M0,${-r * 1.2} L${r * 1.2},0 L0,${r * 1.2} L${-r * 1.2},0 Z` });
      case 'hex': { const p = [0, 1, 2, 3, 4, 5].map(i => { const a = Math.PI / 3 * i; return (Math.cos(a) * r * 1.1).toFixed(1) + ',' + (Math.sin(a) * r * 1.1).toFixed(1); }); return s('polygon', { ...common, points: p.join(' ') }); }
      case 'tri': return s('path', { ...common, d: `M0,${-r * 1.2} L${r * 1.1},${r * .8} L${-r * 1.1},${r * .8} Z` });
      default: return s('circle', { ...common, r });
    }
  }
  render() {
    clear(this.edgeLayer); clear(this.nodeLayer);
    this.nodeEls = {}; this.edgeEls = [];
    const pairCount = {};
    for (const e of this.edges) {
      const key = [e.source, e.target].sort().join('|'); pairCount[key] = (pairCount[key] || 0) + 1; e._k = pairCount[key];
    }
    for (const e of this.edges) {
      if (!this.pos[e.source] || !this.pos[e.target]) continue;
      const path = s('path', { style: e.color ? 'stroke:' + e.color : null, 'stroke-dasharray': e.dashed ? '5 4' : null, 'marker-end': e.directed ? `url(#${this.markerId})` : null });
      const hit = s('path', { class: 'hit' });
      const text = this.showLabels && e.label ? s('text', { 'text-anchor': 'middle' }, e.label) : null;
      const g = s('g', { class: 'gedge', 'data-edge': e.id }, hit, path, text);
      g.addEventListener('click', ev => { ev.stopPropagation(); if (this.onEdge) this.onEdge(e); });
      this.edgeLayer.appendChild(g);
      this.edgeEls.push({ e, g, path, hit, text });
    }
    for (const n of this.nodes) {
      const g = s('g', { class: 'gnode', 'data-node': n.id, tabindex: 0 });
      const r = this.radius(n);
      g.appendChild(this.shapeEl(n));
      if (n.img) {
        const cid = 'clip-' + n.id.replace(/[^a-z0-9_-]/gi, '');
        if (!this.defs.querySelector('#' + cid)) this.defs.appendChild(s('clipPath', { id: cid }, s('circle', { r: r - 3 })));
        g.appendChild(s('image', { href: n.img, x: -(r - 3), y: -(r - 3), width: (r - 3) * 2, height: (r - 3) * 2, 'clip-path': `url(#${cid})`, preserveAspectRatio: 'xMidYMid slice' }));
      } else if (n.glyph) {
        g.appendChild(s('text', { 'text-anchor': 'middle', y: 4, style: 'stroke:none;font-weight:700;fill:#fff;font-size:12px' }, n.glyph));
      }
      g.appendChild(s('text', { 'text-anchor': 'middle', y: r + 15 }, n.label.length > 28 ? n.label.slice(0, 27) + '…' : n.label));
      this.attachDrag(g, n);
      g.addEventListener('dblclick', ev => { ev.stopPropagation(); if (this.onOpen) this.onOpen(n); });
      g.addEventListener('keydown', ev => { if (ev.key === 'Enter') this.onOpen && this.onOpen(n); if (ev.key === ' ') { ev.preventDefault(); this.select(n.id); } });
      this.nodeLayer.appendChild(g);
      this.nodeEls[n.id] = g;
    }
    this.update();
    if (this.selected && !this.nodeEls[this.selected]) this.selected = null;
    this.highlight();
  }
  attachDrag(g, n) {
    let st = null;
    g.addEventListener('pointerdown', ev => {
      if (ev.button !== 0) return; ev.stopPropagation();
      const w = this.vp.toWorld(ev.clientX, ev.clientY);
      st = { dx: w.x - this.pos[n.id].x, dy: w.y - this.pos[n.id].y, moved: false };
      g.setPointerCapture(ev.pointerId);
    });
    g.addEventListener('pointermove', ev => {
      if (!st) return;
      const w = this.vp.toWorld(ev.clientX, ev.clientY);
      const nx = w.x - st.dx, ny = w.y - st.dy;
      if (Math.abs(nx - this.pos[n.id].x) + Math.abs(ny - this.pos[n.id].y) > 0.5) st.moved = true;
      this.pos[n.id] = { x: nx, y: ny }; this.update(n.id);
    });
    const up = () => {
      if (!st) return;
      if (st.moved) { if (this.onMove) this.onMove(n.id, this.pos[n.id]); }
      else this.select(n.id);
      st = null;
    };
    g.addEventListener('pointerup', up); g.addEventListener('pointercancel', up);
  }
  update(onlyId = null) {
    for (const n of this.nodes) {
      if (onlyId && n.id !== onlyId) continue;
      const p = this.pos[n.id]; if (p) this.nodeEls[n.id].setAttribute('transform', `translate(${p.x.toFixed(1)},${p.y.toFixed(1)})`);
    }
    for (const x of this.edgeEls) {
      if (onlyId && x.e.source !== onlyId && x.e.target !== onlyId) continue;
      const a = this.pos[x.e.source], b = this.pos[x.e.target];
      const na = this.nodes.find(n => n.id === x.e.source), nb = this.nodes.find(n => n.id === x.e.target);
      const dx = b.x - a.x, dy = b.y - a.y; const len = Math.sqrt(dx * dx + dy * dy) || 1;
      const ra = this.radius(na || {}) + 2, rb = this.radius(nb || {}) + 5;
      const sx = a.x + dx / len * ra, sy = a.y + dy / len * ra, ex = b.x - dx / len * rb, ey = b.y - dy / len * rb;
      const k = x.e._k - 1; const off = k ? (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 26 : 0;
      const mx = (sx + ex) / 2 - dy / len * off, my = (sy + ey) / 2 + dx / len * off;
      const d = off ? `M${sx},${sy} Q${mx},${my} ${ex},${ey}` : `M${sx},${sy} L${ex},${ey}`;
      x.path.setAttribute('d', d); x.hit.setAttribute('d', d);
      if (x.text) { x.text.setAttribute('x', off ? (sx + 2 * mx + ex) / 4 : mx); x.text.setAttribute('y', (off ? (sy + 2 * my + ey) / 4 : my) - 4); }
    }
  }
  select(id) { this.selected = id; this.highlight(); if (this.onSelect) this.onSelect(id ? this.nodes.find(n => n.id === id) : null); }
  highlight() {
    const id = this.selected;
    const nb = new Set(id ? [id] : []);
    if (id) for (const e of this.edges) { if (e.source === id) nb.add(e.target); if (e.target === id) nb.add(e.source); }
    for (const [nid, g] of Object.entries(this.nodeEls)) { g.classList.toggle('dim', !!id && !nb.has(nid)); g.classList.toggle('hl', nid === id); }
    for (const x of this.edgeEls) { const on = id && (x.e.source === id || x.e.target === id); x.g.classList.toggle('hl', !!on); x.g.classList.toggle('dim', !!id && !on); }
  }
  fit() { this.vp.fit(Layout.bbox(this.pos, this.nodes.map(n => n.id))); }
  focus(id) { const p = this.pos[id]; if (p) { this.vp.k = Math.max(this.vp.k, 1); this.vp.centerOn(p.x, p.y); this.select(id); } }
}

/* Exporta um <svg> para PNG copiando estilos calculados (inclui variáveis CSS resolvidas). */
async function svgToPng(svgEl, filename, { bbox = null, scale = 2 } = {}) {
  const clone = svgEl.cloneNode(true);
  const srcAll = [svgEl, ...svgEl.querySelectorAll('*')]; const dstAll = [clone, ...clone.querySelectorAll('*')];
  const props = ['fill', 'stroke', 'stroke-width', 'stroke-dasharray', 'opacity', 'font-size', 'font-family', 'font-weight', 'paint-order', 'stroke-linejoin', 'display'];
  srcAll.forEach((el, i) => { const cs = getComputedStyle(el); dstAll[i].setAttribute('style', props.map(p => p + ':' + cs.getPropertyValue(p)).join(';')); });
  const layer = clone.querySelector('g');
  const b = bbox || (() => { const r = svgEl.querySelector('g').getBBox(); return { minX: r.x, minY: r.y, maxX: r.x + r.width, maxY: r.y + r.height }; })();
  const pad = 40; const w = Math.ceil(b.maxX - b.minX + pad * 2), hgt = Math.ceil(b.maxY - b.minY + pad * 2);
  layer.setAttribute('transform', `translate(${pad - b.minX},${pad - b.minY})`);
  clone.setAttribute('width', w); clone.setAttribute('height', hgt); clone.setAttribute('viewBox', `0 0 ${w} ${hgt}`);
  clone.setAttribute('xmlns', SVGNS);
  // imagens com blob: precisam virar data URI para entrar no canvas
  for (const im of clone.querySelectorAll('image')) {
    try { const href = im.getAttribute('href'); if (href && href.startsWith('blob:')) { const bl = await (await fetch(href)).blob(); im.setAttribute('href', await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(bl); })); } } catch (e) { im.remove(); }
  }
  const bg = getComputedStyle(document.body).backgroundColor;
  clone.insertBefore(s('rect', { x: 0, y: 0, width: w, height: hgt, fill: bg }), clone.firstChild);
  const xml = new XMLSerializer().serializeToString(clone);
  const img = new Image();
  const url = URL.createObjectURL(new Blob([xml], { type: 'image/svg+xml' }));
  await new Promise((res, rej) => { img.onload = res; img.onerror = () => rej(new Error('Falha ao rasterizar o SVG')); img.src = url; });
  const cv = document.createElement('canvas'); cv.width = w * scale; cv.height = hgt * scale;
  const ctx = cv.getContext('2d'); ctx.scale(scale, scale); ctx.drawImage(img, 0, 0);
  URL.revokeObjectURL(url);
  const blob = await new Promise(r => cv.toBlob(r, 'image/png'));
  U.download(blob, filename);
}
