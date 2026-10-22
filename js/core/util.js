/* Fiction Studio — utilitários gerais, criação de DOM, toasts e modais. */
'use strict';

const U = {
  id(prefix = 'x') {
    const r = crypto.getRandomValues(new Uint32Array(2));
    return prefix + '_' + Date.now().toString(36) + r[0].toString(36) + r[1].toString(36).slice(0, 4);
  },
  now() { return Date.now(); },
  clone(o) { return o == null ? o : JSON.parse(JSON.stringify(o)); },
  esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  },
  norm(s) {
    return String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  },
  levenshtein(a, b) {
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;
    let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      const cur = [i];
      for (let j = 1; j <= b.length; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      }
      prev = cur;
    }
    return prev[b.length];
  },
  similar(a, b) {
    a = U.norm(a); b = U.norm(b);
    if (!a || !b) return false;
    if (a === b) return true;
    if (a.length > 3 && b.length > 3 && (a.includes(b) || b.includes(a))) return true;
    const d = U.levenshtein(a, b);
    return d <= (Math.max(a.length, b.length) > 6 ? 2 : 1);
  },
  debounce(fn, ms) {
    let t;
    const f = (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
    f.flush = (...a) => { clearTimeout(t); fn(...a); };
    return f;
  },
  fmtDate(ts) {
    if (!ts) return '—';
    const d = new Date(ts);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }) + ' ' +
      d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  },
  fmtBytes(n) {
    if (n < 1024) return n + ' B';
    if (n < 1048576) return (n / 1024).toFixed(1) + ' KB';
    return (n / 1048576).toFixed(1) + ' MB';
  },
  byName(a, b) { return String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR', { sensitivity: 'base' }); },
  download(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  },
  slug(s) { return U.norm(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'projeto'; },
  move(arr, from, to) {
    if (to < 0 || to >= arr.length) return arr;
    const [x] = arr.splice(from, 1); arr.splice(to, 0, x); return arr;
  },
  uniq(arr) { return [...new Set(arr)]; },
  plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); },
  pickFile({ accept = '', multiple = false } = {}) {
    return new Promise(resolve => {
      const inp = document.createElement('input');
      inp.type = 'file'; inp.accept = accept; inp.multiple = multiple;
      inp.onchange = () => resolve([...inp.files]);
      inp.click();
    });
  },
};

/* h('div.class#id', {props}, ...children) */
function h(sel, props, ...kids) {
  if (props == null || typeof props !== 'object' || props instanceof Node || Array.isArray(props)) {
    if (props !== undefined && props !== null) kids.unshift(props);
    props = {};
  }
  const m = sel.match(/^([a-z0-9-]+)?((?:[.#][^.#]+)*)$/i);
  const el = document.createElement((m && m[1]) || 'div');
  if (m && m[2]) {
    for (const part of m[2].match(/[.#][^.#]+/g)) {
      if (part[0] === '.') el.classList.add(part.slice(1)); else el.id = part.slice(1);
    }
  }
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className += (el.className ? ' ' : '') + v;
    else if (k === 'style' && typeof v === 'object') { for (const [sk, sv] of Object.entries(v)) { if (sv == null) continue; if (sk.startsWith('--')) el.style.setProperty(sk, sv); else el.style[sk] = sv; } }
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'value') el.value = v;
    else if (k === 'checked' || k === 'disabled' || k === 'selected' || k === 'hidden' || k === 'multiple' || k === 'open') el[k] = !!v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  appendKids(el, kids);
  return el;
}
function appendKids(el, kids) {
  for (const k of kids.flat(Infinity)) {
    if (k == null || k === false) continue;
    el.appendChild(k instanceof Node ? k : document.createTextNode(String(k)));
  }
}
function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }

/* Ícones vetoriais — conjunto único no estilo Lucide (grade 24, traço 2, pontas arredondadas).
   Formato: lista de formas. 'M…' = path; 'c x y r' = círculo; 'r x y w h rx' = retângulo; 'd x y r' = ponto preenchido. */
const ICONS = {
  home: ['M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8', 'M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z'],
  folder: ['M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z'],
  user: ['c 12 7 4', 'M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2'],
  users: ['M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2', 'c 9 7 4', 'M22 21v-2a4 4 0 0 0-3-3.87', 'M16 3.13a4 4 0 0 1 0 7.75'],
  pin: ['M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0', 'c 12 10 3'],
  book: ['M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z', 'M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z'],
  bolt: ['M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z'],
  image: ['r 3 3 18 18 2', 'c 9 9 2', 'm21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21'],
  images: ['M18 22H4a2 2 0 0 1-2-2V6', 'm22 13-1.296-1.296a2.41 2.41 0 0 0-3.408 0L11 18', 'c 12 8 2', 'r 6 2 16 16 2'],
  moodboard: ['r 3 3 7 9 1', 'r 14 3 7 5 1', 'r 14 12 7 9 1', 'r 3 16 7 5 1'],
  library: ['m16 6 4 14', 'M12 6v14', 'M8 8v12', 'M4 4v16'],
  graph: ['c 18 5 3', 'c 6 12 3', 'c 18 19 3', 'M8.59 13.51 15.42 17.49', 'M15.41 6.51 8.59 10.49'],
  family: ['r 16 16 6 6 1', 'r 2 16 6 6 1', 'r 9 2 6 6 1', 'M5 16v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3', 'M12 12V8'],
  tree: ['M6 3v12', 'c 18 6 3', 'c 6 18 3', 'M18 9a9 9 0 0 1-9 9'],
  note: ['M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z', 'M14 2v4a2 2 0 0 0 2 2h4', 'M10 9H8', 'M16 13H8', 'M16 17H8'],
  sticky: ['M16 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8Z', 'M15 3v4a2 2 0 0 0 2 2h4'],
  gear: ['M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z', 'c 12 12 3'],
  template: ['r 3 3 18 7 1', 'r 3 14 9 7 1', 'r 16 14 5 7 1'],
  flag: ['M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z', 'd 7.5 7.5 1.2'],
  sword: ['M14.5 17.5 3 6V3h3l11.5 11.5', 'M13 19l6-6', 'M16 16l4 4', 'M19 21l2-2', 'M14.5 6.5 18 3h3v3l-3.5 3.5', 'M5 14l4 4', 'M7 17l-3 3', 'M3 19l2 2'],
  gamepad: ['M6 12h4', 'M8 10v4', 'M15 13h.01', 'M18 11h.01', 'r 2 6 20 12 2'],
  formula: ['M18 7V5a1 1 0 0 0-1-1H6.5a.5.5 0 0 0-.4.8l4.5 6a2 2 0 0 1 0 2.4l-4.5 6a.5.5 0 0 0 .4.8H17a1 1 0 0 0 1-1v-2'],
  stats: ['M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2'],
  trending: ['M22 7 13.5 15.5 8.5 10.5 2 17', 'M16 7h6v6'],
  shield: ['M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z'],
  crown: ['M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z', 'M5 21h14'],
  gem: ['M6 3h12l4 6-10 13L2 9Z', 'M11 3 8 9l4 13 4-13-3-6', 'M2 9h20'],
  flame: ['M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z'],
  sparkles: ['M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z', 'M20 3v4', 'M22 5h-4'],
  layers: ['M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z', 'M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12', 'M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17'],
  box: ['M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z', 'M12 22V12', 'm3.3 7 7.703 4.734a2 2 0 0 0 1.994 0L20.7 7'],
  org: ['M3 22h18', 'M6 18v-7', 'M10 18v-7', 'M14 18v-7', 'M18 18v-7', 'M12 2 20 7H4z'],
  heart: ['M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z'],
  clock: ['c 12 12 10', 'M12 6v6l4 2'],
  search: ['c 11 11 8', 'm21 21-4.3-4.3'],
  filter: ['M22 3H2l8 9.46V19l4 2v-8.54z'],
  plus: ['M5 12h14', 'M12 5v14'],
  minus: ['M5 12h14'],
  x: ['M18 6 6 18', 'm6 6 12 12'],
  check: ['M20 6 9 17l-5-5'],
  trash: ['M3 6h18', 'M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6', 'M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2'],
  edit: ['M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z', 'm15 5 4 4'],
  copy: ['r 8 8 14 14 2', 'M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2'],
  archive: ['r 2 3 20 5 1', 'M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8', 'M10 12h4'],
  download: ['M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4', 'm7 10 5 5 5-5', 'M12 15V3'],
  upload: ['M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4', 'm17 8-5-5-5 5', 'M12 3v12'],
  star: ['M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z'],
  up: ['m5 12 7-7 7 7', 'M12 19V5'],
  down: ['M12 5v14', 'm19 12-7 7-7-7'],
  left: ['m15 18-6-6 6-6'],
  right: ['m9 18 6-6-6-6'],
  chevdown: ['m6 9 6 6 6-6'],
  link: ['M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71', 'M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71'],
  external: ['M15 3h6v6', 'M10 14 21 3', 'M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6'],
  globe: ['c 12 12 10', 'M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20', 'M2 12h20'],
  clipboard: ['r 8 2 8 4 1', 'M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2'],
  sun: ['c 12 12 4', 'M12 2v2', 'M12 20v2', 'm4.93 4.93 1.41 1.41', 'm17.66 17.66 1.41 1.41', 'M2 12h2', 'M20 12h2', 'm6.34 17.66-1.41 1.41', 'm19.07 4.93-1.41 1.41'],
  moon: ['M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z'],
  eye: ['M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0', 'c 12 12 3'],
  play: ['M6 3 20 12 6 21Z'],
  center: ['M3 7V5a2 2 0 0 1 2-2h2', 'M17 3h2a2 2 0 0 1 2 2v2', 'M21 17v2a2 2 0 0 1-2 2h-2', 'M7 21H5a2 2 0 0 1-2-2v-2'],
  zoomin: ['c 11 11 8', 'm21 21-4.35-4.35', 'M11 8v6', 'M8 11h6'],
  zoomout: ['c 11 11 8', 'm21 21-4.35-4.35', 'M8 11h6'],
  rotate: ['M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8', 'M21 3v5h-5'],
  undo: ['M3 7v6h6', 'M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13'],
  redo: ['M21 7v6h-6', 'M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7'],
  type: ['M4 7V4h16v3', 'M9 20h6', 'M12 4v16'],
  heading: ['M6 12h12', 'M6 20V4', 'M18 20V4'],
  palette: ['M12 22a1 1 0 0 1 0-20 10 9 0 0 1 10 9 5 5 0 0 1-5 5h-2.25a1.75 1.75 0 0 0-1.4 2.8l.3.4a1.75 1.75 0 0 1-1.4 2.8z', 'd 13.5 6.5 1', 'd 17.5 10.5 1', 'd 6.5 12.5 1', 'd 8.5 7.5 1'],
  square: ['r 3 3 18 18 2'],
  front: ['r 8 8 8 8 2', 'M4 10a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2', 'M14 20a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-4a2 2 0 0 0-2-2'],
  back: ['r 14 14 8 8 2', 'r 2 2 8 8 2', 'M7 14v1a2 2 0 0 0 2 2h1', 'M14 7h1a2 2 0 0 1 2 2v1'],
  crop: ['M6 2v14a2 2 0 0 0 2 2h14', 'M18 22V8a2 2 0 0 0-2-2H2'],
  pointer: ['M12.586 12.586 19 19', 'M3.688 3.037a.497.497 0 0 0-.651.651l6.5 15.999a.5.5 0 0 0 .947-.062l1.569-6.083a2 2 0 0 1 1.448-1.479l6.124-1.579a.5.5 0 0 0 .063-.947z'],
  panel: ['r 3 3 18 18 2', 'M9 3v18'],
  menu: ['M4 12h16', 'M4 6h16', 'M4 18h16'],
  more: ['d 12 12 1.4', 'd 19 12 1.4', 'd 5 12 1.4'],
  grip: ['d 9 12 1.2', 'd 9 5 1.2', 'd 9 19 1.2', 'd 15 12 1.2', 'd 15 5 1.2', 'd 15 19 1.2'],
  alert: ['m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3', 'M12 9v4', 'M12 17h.01'],
  info: ['c 12 12 10', 'M12 16v-4', 'M12 8h.01'],
  help: ['c 12 12 10', 'M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3', 'M12 17h.01'],
  route: ['c 6 19 3', 'M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15', 'c 18 5 3'],
  target: ['c 12 12 10', 'c 12 12 6', 'c 12 12 2'],
  lock: ['r 3 11 18 11 2', 'M7 11V7a5 5 0 0 1 10 0v4'],
  separator: ['M3 12h18', 'M8 8l-4 4 4 4', 'M16 8l4 4-4 4'],
  wand: ['M15 4V2', 'M15 16v-2', 'M8 9h2', 'M20 9h2', 'M17.8 11.8 19 13', 'M15 9h.01', 'M17.8 6.2 19 5', 'm3 21 9-9', 'M12.2 6.2 11 5'],
};
const SVGNS_ICON = 'http://www.w3.org/2000/svg';
function icon(name, size = 16) {
  const s = document.createElementNS(SVGNS_ICON, 'svg');
  s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('width', size); s.setAttribute('height', size);
  s.setAttribute('fill', 'none'); s.setAttribute('stroke', 'currentColor'); s.setAttribute('stroke-width', '2');
  s.setAttribute('stroke-linecap', 'round'); s.setAttribute('stroke-linejoin', 'round');
  s.setAttribute('aria-hidden', 'true'); s.classList.add('ico');
  for (const part of ICONS[name] || ICONS.box) {
    let el; const a = part.split(' ');
    if (a[0] === 'c' || a[0] === 'd') { el = document.createElementNS(SVGNS_ICON, 'circle'); el.setAttribute('cx', a[1]); el.setAttribute('cy', a[2]); el.setAttribute('r', a[3]); if (a[0] === 'd') { el.setAttribute('fill', 'currentColor'); el.setAttribute('stroke', 'none'); } }
    else if (a[0] === 'r') { el = document.createElementNS(SVGNS_ICON, 'rect'); el.setAttribute('x', a[1]); el.setAttribute('y', a[2]); el.setAttribute('width', a[3]); el.setAttribute('height', a[4]); el.setAttribute('rx', a[5] || 0); }
    else { el = document.createElementNS(SVGNS_ICON, 'path'); el.setAttribute('d', part); }
    s.appendChild(el);
  }
  return s;
}
/* Botão padrão. Botões só com ícone sempre recebem descrição acessível e dica ao passar o cursor. */
function btn(label, onClick, { kind = '', ic = null, title = null, small = false, disabled = false, pressed = null } = {}) {
  return h('button', {
    type: 'button', class: 'btn' + (kind ? ' btn-' + kind : '') + (small ? ' btn-sm' : '') + (!label ? ' btn-icon' : ''),
    title: title || null, 'aria-label': title || label || null, 'aria-pressed': pressed == null ? null : String(!!pressed), onclick: onClick, disabled,
  }, ic ? icon(ic, small ? 14 : 16) : null, label ? h('span', label) : null);
}
/* Controle segmentado (ex.: Resumida | Detalhada) */
function segmented(options, value, onChange, { label = '', small = true } = {}) {
  const wrap = h('div.seg', { role: 'radiogroup', 'aria-label': label || null });
  const render = () => {
    clear(wrap);
    for (const o of options) {
      wrap.appendChild(h('button.seg-btn' + (o.value === value ? '.on' : ''), { type: 'button', role: 'radio', 'aria-checked': String(o.value === value), title: o.title || null,
        onclick: () => { if (o.value === value) return; value = o.value; render(); onChange(value); } }, o.ic ? icon(o.ic, small ? 14 : 16) : null, o.label ? h('span', o.label) : null));
    }
  };
  render();
  return wrap;
}

/* Menus suspensos e de contexto. items: [{label, ic, onClick, danger, disabled, hint, sep, header}] */
const Menu = {
  current: null,
  close() { if (Menu.current) { Menu.current.el.remove(); document.removeEventListener('pointerdown', Menu.current.outside, true); document.removeEventListener('keydown', Menu.current.key, true); const r = Menu.current.restore; Menu.current = null; if (r && r.focus) r.focus(); } },
  open(anchorOrPoint, items, { align = 'start' } = {}) {
    Menu.close();
    const el = h('div.menu', { role: 'menu' });
    for (const it of items) {
      if (!it) continue;
      if (it.sep) { el.appendChild(h('div.menu-sep', { role: 'separator' })); continue; }
      if (it.header) { el.appendChild(h('div.menu-head', it.header)); continue; }
      el.appendChild(h('button.menu-item' + (it.danger ? '.danger' : ''), { type: 'button', role: 'menuitem', disabled: it.disabled,
        onclick: () => { Menu.close(); it.onClick && it.onClick(); } },
        it.ic ? icon(it.ic, 15) : h('span.menu-ic'), h('span.grow', it.label), it.hint ? h('span.menu-hint', it.hint) : null));
    }
    document.body.appendChild(el);
    const r = anchorOrPoint instanceof Element ? anchorOrPoint.getBoundingClientRect() : { left: anchorOrPoint.x, right: anchorOrPoint.x, top: anchorOrPoint.y, bottom: anchorOrPoint.y };
    const mw = el.offsetWidth, mh = el.offsetHeight;
    let x = align === 'end' ? r.right - mw : r.left; let y = r.bottom + 4;
    x = Math.max(8, Math.min(x, innerWidth - mw - 8));
    if (y + mh > innerHeight - 8) y = Math.max(8, r.top - mh - 4);
    el.style.left = x + 'px'; el.style.top = y + 'px';
    const outside = e => { if (!el.contains(e.target) && !(anchorOrPoint instanceof Element && anchorOrPoint.contains(e.target))) Menu.close(); };
    const key = e => {
      const btns = [...el.querySelectorAll('.menu-item:not(:disabled)')]; const i = btns.indexOf(document.activeElement);
      if (e.key === 'Escape') { e.stopPropagation(); Menu.close(); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); (btns[i + 1] || btns[0]).focus(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); (btns[i - 1] || btns[btns.length - 1]).focus(); }
      else if (e.key === 'Tab') Menu.close();
    };
    Menu.current = { el, outside, key, restore: anchorOrPoint instanceof Element ? anchorOrPoint : null };
    setTimeout(() => { document.addEventListener('pointerdown', outside, true); document.addEventListener('keydown', key, true); const f = el.querySelector('.menu-item:not(:disabled)'); if (f) f.focus(); }, 0);
  },
};

/* Toasts. Toast.action mostra um botão (ex.: Desfazer) por alguns segundos. */
const Toast = {
  box() {
    let box = document.getElementById('toasts');
    if (!box) { box = h('div#toasts', { role: 'status', 'aria-live': 'polite' }); document.body.appendChild(box); }
    return box;
  },
  show(msg, type = 'ok', ms = 3200, action = null) {
    const t = h('div.toast.toast-' + type, icon({ ok: 'check', err: 'alert', warn: 'alert', info: 'info' }[type] || 'info', 15), h('span.grow', msg),
      action ? h('button.toast-act', { type: 'button', onclick: () => { action.fn(); dismiss(); } }, action.label) : null);
    const dismiss = () => { t.classList.add('out'); setTimeout(() => t.remove(), 220); };
    Toast.box().appendChild(t);
    setTimeout(dismiss, ms);
  },
  ok(m) { Toast.show(m, 'ok'); },
  info(m) { Toast.show(m, 'info'); },
  err(m) { Toast.show(m, 'err', 6500); },
  warn(m) { Toast.show(m, 'warn', 5200); },
  action(m, label, fn, ms = 6000) { Toast.show(m, 'ok', ms, { label, fn }); },
};

/* Modais */
const Modal = {
  stack: [],
  open({ title, body, actions = [], wide = false, full = false, onClose = null }) {
    const back = h('div.modal-back');
    const restore = document.activeElement;
    const box = h('div.modal' + (wide ? '.modal-wide' : '') + (full ? '.modal-full' : ''), { role: 'dialog', 'aria-modal': 'true', 'aria-label': title });
    const close = () => {
      back.remove(); Modal.stack = Modal.stack.filter(x => x !== api);
      document.removeEventListener('keydown', onKey);
      if (onClose) onClose();
      if (restore && restore.focus && document.contains(restore)) restore.focus();
    };
    const onKey = e => { if (e.key === 'Escape' && Modal.stack[Modal.stack.length - 1] === api) close(); };
    const foot = h('div.modal-foot');
    for (const a of actions) {
      foot.appendChild(btn(a.label, async () => {
        const r = a.onClick ? await a.onClick() : undefined;
        if (r !== false) close();
      }, { kind: a.kind || '' }));
    }
    box.append(
      h('div.modal-head', h('h2', title), btn('', close, { ic: 'x', title: 'Fechar' })),
      h('div.modal-body', body),
      actions.length ? foot : null,
    );
    back.appendChild(box);
    back.addEventListener('mousedown', e => { if (e.target === back) close(); });
    document.addEventListener('keydown', onKey);
    document.body.appendChild(back);
    const api = { close, el: box, body: box.querySelector('.modal-body') };
    Modal.stack.push(api);
    setTimeout(() => { const f = box.querySelector('.modal-body input, .modal-body textarea, .modal-body select'); if (f) f.focus(); }, 30);
    return api;
  },
  confirm(title, message, { danger = false, okLabel = 'Confirmar' } = {}) {
    return new Promise(res => {
      let done = false;
      Modal.open({
        title, body: typeof message === 'string' ? h('p', message) : message,
        actions: [
          { label: 'Cancelar', onClick: () => { done = true; res(false); } },
          { label: okLabel, kind: danger ? 'danger' : 'primary', onClick: () => { done = true; res(true); } },
        ],
        onClose: () => { if (!done) res(false); },
      });
    });
  },
  prompt(title, label, value = '', { placeholder = '' } = {}) {
    return new Promise(res => {
      let done = false;
      const inp = h('input.input', { value, placeholder, 'aria-label': label });
      const m = Modal.open({
        title, body: h('label.field', h('span.lbl', label), inp),
        actions: [
          { label: 'Cancelar', onClick: () => { done = true; res(null); } },
          { label: 'OK', kind: 'primary', onClick: () => { done = true; res(inp.value.trim()); } },
        ],
        onClose: () => { if (!done) res(null); },
      });
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') { done = true; res(inp.value.trim()); m.close(); } });
    });
  },
};

/* Element.append aceitando listas aninhadas e ignorando null/false, para compor telas declarativamente. */
(() => {
  const native = Element.prototype.append;
  Element.prototype.append = function (...kids) { native.apply(this, kids.flat(Infinity).filter(k => k != null && k !== false)); };
})();
