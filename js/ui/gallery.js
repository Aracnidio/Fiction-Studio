/* Fiction Studio — mídia: importação (arquivo, arrastar, colar, endereço web), miniaturas e prévias,
   impressão digital para achar duplicadas, painel de referências das fichas, lightbox e edição de metadados.
   Uma imagem é sempre um único registro; fichas, moodboards e coleções apontam para ele. */
'use strict';

const Images = {
  THUMB: 420, PREVIEW: 1600,
  async scaled(blob, max, quality = 0.85) {
    const bmp = await createImageBitmap(blob);
    const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const cv = document.createElement('canvas'); cv.width = Math.max(1, Math.round(bmp.width * k)); cv.height = Math.max(1, Math.round(bmp.height * k));
    cv.getContext('2d').drawImage(bmp, 0, 0, cv.width, cv.height);
    const out = await new Promise(r => cv.toBlob(r, 'image/jpeg', quality));
    const res = { blob: out, width: bmp.width, height: bmp.height, scaled: k < 1 };
    if (bmp.close) bmp.close();
    return res;
  },
  async makeThumb(blob, max = Images.THUMB) {
    try { const r = await Images.scaled(blob, max, 0.84); return { thumb: r.blob, width: r.width, height: r.height }; }
    catch (e) { return { thumb: null, width: null, height: null }; }
  },
  async hash(blob) {
    const buf = await blob.arrayBuffer();
    try { if (crypto.subtle) { const d = await crypto.subtle.digest('SHA-256', buf); return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, '0')).join(''); } } catch (e) { /* contexto sem subtle */ }
    const a = new Uint8Array(buf); let h1 = 0x811c9dc5;
    for (let i = 0; i < a.length; i++) { h1 ^= a[i]; h1 = Math.imul(h1, 16777619) >>> 0; }
    return 'fnv' + h1.toString(16) + '-' + a.length;
  },
  async fromBlob(blob, meta = {}) {
    if (!blob || !String(blob.type).startsWith('image/')) throw new Error('O arquivo não é uma imagem.');
    let thumb = null, preview = null, width = null, height = null;
    try {
      const t = await Images.scaled(blob, Images.THUMB, 0.84); thumb = t.blob; width = t.width; height = t.height;
      if (Math.max(width, height) > Images.PREVIEW * 1.15) preview = (await Images.scaled(blob, Images.PREVIEW, 0.88)).blob;
    } catch (e) { if (blob.type !== 'image/svg+xml') throw new Error('O navegador não conseguiu ler esta imagem.'); }
    const hash = await Images.hash(blob).catch(() => null);
    return {
      id: U.id('img'), projectId: Store.S.p.id, blob, thumb, preview, mime: blob.type, size: blob.size, width, height, hash,
      title: '', description: '', category: '', source: 'Arquivo local', sourceUrl: '', license: '', creator: '', notes: '', tags: [], createdAt: U.now(), links: [], ...meta,
    };
  },
  /* Importa arquivos; a mensagem de sucesso só aparece depois de gravado. */
  async importFiles(files, { entityId = null, category = '', quiet = false } = {}) {
    const out = []; let failed = 0;
    for (const f of files) {
      try {
        const img = await Images.fromBlob(f, { title: (f.name || 'Imagem colada').replace(/\.[^.]+$/, ''), source: f.name ? 'Arquivo local: ' + f.name : 'Área de transferência' });
        if (entityId) img.links.push({ entityId, category, order: Store.imagesOf(entityId).length + out.length });
        Store.saveImage(img); out.push(img);
      } catch (e) { failed++; }
    }
    if (out.length) await Store.flush();
    if (failed) Toast.warn(failed + ' arquivo(s) não eram imagens válidas e foram ignorados.');
    if (out.length && !quiet) Toast.ok(U.plural(out.length, 'imagem adicionada', 'imagens adicionadas') + ' ao projeto.');
    return out;
  },
  /* Servidor local opcional (servidor.py): baixa imagens de sites que bloqueiam o navegador (CORS). */
  _srv: null,
  async server() {
    if (Images._srv) return Images._srv;
    if (!/^https?:$/.test(location.protocol)) return (Images._srv = { ok: false });
    try {
      const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 2000);
      const r = await fetch('/api/status', { signal: ctl.signal, cache: 'no-store' }); clearTimeout(t);
      const j = r.ok ? await r.json().catch(() => null) : null;
      Images._srv = { ok: !!(j && j.ok) };
    } catch (e) { Images._srv = { ok: false }; }
    return Images._srv;
  },
  /* Busca o arquivo de um endereço web. Retorna {blob} ou {error, reason}. Nunca finge ter salvo. */
  async fetchURL(url) {
    let u;
    try { u = new URL(url.trim()); if (!/^https?:$/.test(u.protocol)) throw 0; } catch (e) { return { error: 'O endereço precisa começar com http:// ou https://.', reason: 'invalid' }; }
    const attempt = async (target) => {
      const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 20000);
      try {
        const r = await fetch(target, { mode: 'cors', signal: ctl.signal, credentials: 'omit' });
        if (!r.ok) return { error: 'O site respondeu com erro ' + r.status + '.', reason: r.status === 401 || r.status === 403 ? 'auth' : 'http' };
        const b = await r.blob();
        if (!String(b.type).startsWith('image/')) return { error: 'O endereço não aponta diretamente para um arquivo de imagem (é uma página?). Abra a imagem sozinha e copie o endereço dela.', reason: 'notimage' };
        return { blob: b };
      } catch (e) { return { error: e.name === 'AbortError' ? 'O site demorou demais para responder.' : 'O site não permite que o navegador baixe a imagem diretamente (bloqueio CORS) ou está fora do ar.', reason: e.name === 'AbortError' ? 'timeout' : 'cors' }; }
      finally { clearTimeout(t); }
    };
    let r = await attempt(u.href);
    if (r.blob) return r;
    const srv = await Images.server();
    if (srv.ok) {
      const r2 = await attempt('/api/image?url=' + encodeURIComponent(u.href));
      if (r2.blob) return r2;
      return { error: r.reason === 'cors' ? 'Nem o navegador nem o servidor local conseguiram baixar a imagem. O site pode exigir login ou bloquear downloads.' : r.error, reason: r.reason };
    }
    if (r.reason === 'cors') r.error += ' Abrindo o app pelo servidor local (iniciar.bat) esse bloqueio costuma ser contornado.';
    return r;
  },
  /* Janela de importação por endereço web. onDone recebe o registro de mídia criado. */
  urlModal(onDone, { entityId = null } = {}) {
    const inp = h('input.input', { type: 'url', placeholder: 'https://exemplo.com/imagem.jpg', 'aria-label': 'Endereço da imagem' });
    const name = h('input.input', { placeholder: 'Opcional', 'aria-label': 'Nome da imagem' });
    const out = h('div');
    let busy = false;
    const go = async () => {
      if (busy) return false; busy = true; clear(out); out.appendChild(h('div.notice.info', 'Baixando…'));
      const r = await Images.fetchURL(inp.value);
      busy = false; clear(out);
      if (r.error) {
        out.appendChild(h('div.notice.err', h('b', 'Não foi possível importar. '), r.error,
          r.reason !== 'invalid' ? h('div', { style: { marginTop: '8px' } }, 'Alternativa: ', h('a', { href: inp.value, target: '_blank', rel: 'noopener noreferrer' }, 'abra a imagem numa nova aba'), ', salve-a no computador e use "Adicionar do computador". Nada foi salvo no projeto.') : null));
        return false;
      }
      try {
        const u = new URL(inp.value);
        const img = await Images.fromBlob(r.blob, { title: name.value.trim() || decodeURIComponent(u.pathname.split('/').pop() || 'Imagem').replace(/\.[^.]+$/, '').slice(0, 80), source: u.hostname, sourceUrl: u.href });
        if (entityId) img.links.push({ entityId, category: '', order: Store.imagesOf(entityId).length });
        Store.saveImage(img); await Store.flush();
        Toast.ok('Imagem baixada e guardada no projeto.');
        if (onDone) onDone(img);
        return true;
      } catch (e) { out.appendChild(h('div.notice.err', e.message)); return false; }
    };
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); go().then(ok => { if (ok) m.close(); }); } });
    const m = Modal.open({
      title: 'Importar imagem por endereço web', wide: false,
      body: h('div.col', h('label.field', h('span.lbl', 'Endereço do arquivo de imagem'), inp, h('span.hint', 'Cole o endereço da própria imagem (termina em .jpg, .png, .webp…). A imagem é baixada e passa a ficar guardada no projeto.')),
        h('label.field', h('span.lbl', 'Nome no projeto'), name), out),
      actions: [{ label: 'Cancelar' }, { label: 'Importar', kind: 'primary', onClick: go }],
    });
  },
  async downloadRemote(img) {
    const r = await Images.fetchURL(img.remoteUrl || img.remoteThumb || '');
    if (r.error) { Toast.warn('Não foi possível baixar: ' + r.error + ' A imagem continua como link externo.'); return false; }
    const fresh = await Images.fromBlob(r.blob, {});
    Object.assign(img, { blob: fresh.blob, thumb: fresh.thumb, preview: fresh.preview, mime: fresh.mime, size: fresh.size, width: fresh.width, height: fresh.height, hash: fresh.hash });
    for (const k of ['thumb', 'preview', 'full']) { const u = Store.S.urlCache.get(img.id + ':' + k); if (u) { URL.revokeObjectURL(u); Store.S.urlCache.delete(img.id + ':' + k); } }
    Store.saveImage(img); await Store.flush(); Toast.ok('Imagem guardada no projeto.');
    return true;
  },
  /* Gera a prévia de imagens grandes importadas antes desta versão (uma vez). */
  async ensurePreview(img) {
    if (!img || !img.blob || img.preview || img._noPreview) return false;
    if (!img.width || Math.max(img.width, img.height) <= Images.PREVIEW * 1.15) { img._noPreview = true; return false; }
    try { img.preview = (await Images.scaled(img.blob, Images.PREVIEW, 0.88)).blob; Store.saveImage(img); return true; } catch (e) { img._noPreview = true; return false; }
  },
  async ensureHash(img) { if (img.hash || !img.blob) return img.hash || null; img.hash = await Images.hash(img.blob); Store.saveImage(img); return img.hash; },
  categoriesFor(kind) { const key = (Schema.KINDS[kind] || {}).galleryCats; return key ? Store.listValues(key) : Store.listValues('mediaCategories'); },
  allCategories() {
    const l = Store.S.p.config.lists;
    const used = [...Store.S.imgs.values()].flatMap(i => [i.category, ...(i.links || []).map(x => x.category)]);
    return U.uniq([...(l.mediaCategories || []), ...Object.keys(l).filter(k => k.startsWith('imgCat')).flatMap(k => l[k]), ...used].filter(Boolean)).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  },
  imagesFromClipboard(e) { return [...((e.clipboardData && e.clipboardData.files) || [])].filter(f => String(f.type).startsWith('image/')); },
  isRemoteOnly(img) { return !img.blob && !!(img.remoteUrl || img.remoteThumb); },
};

const Lightbox = {
  open(list, index = 0) {
    let i = index;
    const imgEl = h('img', { alt: '' });
    const meta = h('div.lb-meta');
    const title = h('div.grow', { style: { fontWeight: 600 } });
    const box = h('div.lightbox', { role: 'dialog', 'aria-label': 'Visualizar imagem' },
      h('div.lb-top', title, list.length > 1 ? [btn('', () => go(-1), { ic: 'left', title: 'Anterior (←)' }), btn('', () => go(1), { ic: 'right', title: 'Próxima (→)' })] : null, btn('Fechar', () => close(), { ic: 'x' })),
      h('div.lb-img', { onclick: e => { if (e.target.classList.contains('lb-img')) close(); } }, imgEl), meta);
    function show() {
      const it = list[i];
      imgEl.src = it.full || it.thumb; imgEl.alt = it.title || '';
      title.textContent = (it.title || 'Imagem') + (list.length > 1 ? `  ·  ${i + 1} de ${list.length}` : '');
      clear(meta);
      const bits = [];
      if (it.remote) bits.push(h('div', { style: { color: '#fbbf24' } }, 'Link externo — esta imagem não está guardada no projeto.'));
      if (it.description) bits.push(h('div', it.description));
      const src = [it.source, it.creator ? 'autor: ' + it.creator : null, it.license ? 'licença: ' + it.license : null].filter(Boolean).join(' · ');
      if (src) bits.push(h('div', src));
      if (it.sourceUrl) bits.push(h('a', { href: it.sourceUrl, target: '_blank', rel: 'noopener noreferrer' }, 'Abrir página de origem'));
      appendKids(meta, bits);
    }
    function go(d) { i = (i + d + list.length) % list.length; show(); }
    function close() { box.remove(); document.removeEventListener('keydown', key, true); }
    function key(e) { if (e.key === 'Escape') { e.stopPropagation(); close(); } if (e.key === 'ArrowLeft') go(-1); if (e.key === 'ArrowRight') go(1); }
    document.addEventListener('keydown', key, true);
    document.body.appendChild(box); show();
  },
  fromImages(imgs, index) {
    Lightbox.open(imgs.map(im => ({ full: Store.imgURL(im, 'preview'), thumb: Store.imgURL(im, true), title: im.title, description: im.description, source: im.source, sourceUrl: im.sourceUrl, license: im.license, creator: im.creator, remote: Images.isRemoteOnly(im) })), index);
  },
};

/* Lista "Usada em" de uma imagem */
function usageList(imgId) {
  const u = Store.mediaUsage(imgId);
  const rows = [
    ...u.ents.map(e => h('div.row.nowrap', entityLink(e.id, { showKind: true }), u.mains.includes(e) ? h('span.pill.ac', 'principal') : null)),
    ...u.boards.map(b => h('div.row.nowrap', entityLink(b.id, { showKind: true }))),
    ...u.cols.map(c => h('div.row.nowrap', entityLink(c.id, { showKind: true }))),
  ];
  return rows.length ? h('div.col', { style: { gap: '4px' } }, rows) : h('p.muted.small', 'Ainda não usada em nenhuma ficha, moodboard ou coleção.');
}

/* Detalhes de uma imagem (informações compartilhadas por todos os lugares que a usam) */
function editImageModal(img, entityId = null) {
  const draft = U.clone({ ...img, blob: undefined, thumb: undefined, preview: undefined });
  draft.links = draft.links || []; draft.tags = draft.tags || [];
  const fields = [['title', 'Nome'], ['category', 'Categoria'], ['description', 'Descrição', true], ['source', 'Origem'], ['sourceUrl', 'Link de origem'], ['creator', 'Autor'], ['license', 'Licença'], ['notes', 'Observações', true]];
  const linksBox = h('div.col', { style: { gap: '6px' } });
  function renderLinks() {
    clear(linksBox);
    linksBox.append(h('span.lbl', 'Elementos relacionados'),
      draft.links.length ? h('div.linklist', draft.links.map((l, i) => {
        const e = Store.get(l.entityId);
        const cats = e ? Images.categoriesFor(e.kind) : [];
        return h('div.linkrow', h('div.grow', entityLink(l.entityId, { showKind: true })),
          h('select.input.sm', { style: { width: '150px' }, 'aria-label': 'Categoria nesta ficha', onchange: ev => { l.category = ev.target.value; } }, h('option', { value: '' }, 'Sem categoria'), cats.map(c => h('option', { value: c, selected: c === l.category }, c))),
          btn('', () => { draft.links.splice(i, 1); renderLinks(); }, { ic: 'x', small: true, title: 'Desassociar' }));
      })) : h('p.muted.small', 'Nenhum vínculo.'),
      refPicker({ kinds: Schema.NARRATIVE_KINDS, multi: true, value: [], allowCreate: false, placeholder: 'Associar a personagem, local, storyline, evento…', onChange: v => { for (const id of v) if (!draft.links.some(l => l.entityId === id)) draft.links.push({ entityId: id, category: '', order: Store.imagesOf(id).length }); renderLinks(); } }));
  }
  renderLinks();
  const catList = 'imgcats-' + img.id;
  const body = h('div.col',
    h('div.row', { style: { alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap' } },
      h('div', { style: { width: '170px', flex: 'none' } }, h('img', { src: Store.imgURL(img), alt: '', style: { width: '100%', borderRadius: '8px', cursor: 'zoom-in' }, onclick: () => Lightbox.fromImages([img], 0) }),
        h('div.meta', { style: { marginTop: '6px' } }, [img.width ? img.width + '×' + img.height + ' px' : null, img.size ? U.fmtBytes(img.size) : null].filter(Boolean).join(' · ')),
        h('div.meta', 'Incluída em ' + U.fmtDate(img.createdAt))),
      h('div.form-grid.grow', { style: { minWidth: '260px' } }, fields.map(([k, label, wide]) => {
        const f = fieldControl({ key: k, label, type: wide ? 'textarea' : 'text', wide, rows: 2 }, draft, v => draft[k] = v);
        if (k === 'category') { const i = f.querySelector('input'); i.setAttribute('list', catList); f.appendChild(h('datalist#' + catList, Images.allCategories().map(c => h('option', { value: c })))); }
        return f;
      }))),
    h('p.meta', 'O nome é independente do arquivo original. Estas informações aparecem em todas as fichas e moodboards que usam a imagem.'),
    h('label.field', h('span.lbl', 'Tags'), tagInput(draft.tags, v => draft.tags = v)),
    linksBox,
    h('div.field', h('span.lbl', 'Usada em'), usageList(img.id)),
    Images.isRemoteOnly(img) ? h('div.notice.warn', h('b', 'Link externo. '), 'Esta imagem não está guardada no projeto e pode deixar de existir na origem. ', btn('Tentar baixar para o projeto', async () => { if (await Images.downloadRemote(img)) { m.close(); App.refresh(); } }, { small: true })) : null,
  );
  const m = Modal.open({
    title: 'Detalhes da imagem', body, wide: true,
    actions: [
      { label: 'Excluir da biblioteca', kind: 'danger', onClick: async () => { const ok = await confirmDeleteImages([img.id]); if (!ok) return false; App.refresh(); } },
      { label: 'Cancelar' },
      { label: 'Salvar', kind: 'primary', onClick: async () => {
        for (const [k] of fields) img[k] = draft[k];
        img.tags = draft.tags; img.links = draft.links;
        Store.saveImage(img); await Store.flush(); Toast.ok('Imagem atualizada.'); App.refresh();
      } },
    ],
  });
}

/* Exclusão definitiva de imagens, informando onde estão em uso */
async function confirmDeleteImages(ids) {
  const uses = ids.map(id => Store.mediaUsage(id));
  const ents = U.uniq(uses.flatMap(u => u.ents.map(e => e.name)));
  const boards = U.uniq(uses.flatMap(u => u.boards.map(e => e.name)));
  const body = h('div', h('p', ids.length === 1 ? 'Excluir esta imagem do projeto? O arquivo é apagado.' : 'Excluir ' + ids.length + ' imagens do projeto? Os arquivos são apagados.'),
    ents.length || boards.length ? h('div.notice.warn', h('b', 'Ainda em uso. '), [ents.length ? 'Fichas: ' + ents.slice(0, 8).join(', ') + (ents.length > 8 ? '…' : '') + '. ' : '', boards.length ? 'Moodboards: ' + boards.slice(0, 6).join(', ') + ' (a imagem sai da composição).' : ''].join('')) : null,
    h('p.meta', 'Para tirar a imagem só de uma ficha, use "Remover desta ficha" — o arquivo continua na biblioteca.'));
  const ok = await Modal.confirm('Excluir imagens', body, { danger: true, okLabel: 'Excluir' });
  if (!ok) return false;
  ids.forEach(id => Store.deleteImageRecord(id)); await Store.flush();
  Toast.ok(U.plural(ids.length, 'imagem excluída', 'imagens excluídas') + '.');
  return true;
}

/* Seletor de imagens da biblioteca (não duplica arquivos). */
function pickImages({ title = 'Escolher da biblioteca', exclude = [], confirmLabel = 'Adicionar selecionadas', onPick }) {
  const all = [...Store.S.imgs.values()].filter(i => !exclude.includes(i.id) && i.role !== 'cover').sort((a, b) => b.createdAt - a.createdAt);
  const chosen = new Set(); let q = '';
  const grid = h('div');
  const render = () => {
    clear(grid);
    const nq = U.norm(q);
    const list = all.filter(im => !nq || U.norm([im.title, im.category, ...(im.tags || []).map(Store.tagName), ...(im.links || []).map(l => (Store.get(l.entityId) || {}).name)].join(' ')).includes(nq));
    if (!list.length) { grid.appendChild(emptyState(all.length ? 'Nada encontrado' : 'Biblioteca vazia', all.length ? 'Tente outro termo.' : 'Importe imagens do computador primeiro.', null, 'image')); return; }
    grid.appendChild(h('div.gallery', list.map(im => {
      const el = h('div.gitem' + (chosen.has(im.id) ? '.sel' : ''), { tabindex: 0, role: 'checkbox', 'aria-checked': String(chosen.has(im.id)), 'aria-label': im.title || 'Imagem',
        onclick: () => { chosen.has(im.id) ? chosen.delete(im.id) : chosen.add(im.id); el.classList.toggle('sel'); el.setAttribute('aria-checked', String(chosen.has(im.id))); },
        onkeydown: e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); el.click(); } } },
        h('img', { src: Store.imgURL(im), alt: '', loading: 'lazy' }), Images.isRemoteOnly(im) ? h('span.badge.remote', 'link') : null, im.title ? h('div.cap', im.title) : null);
      return el;
    })));
  };
  render();
  Modal.open({
    title, wide: true,
    body: h('div.col', searchInput('', v => { q = v; render(); }, 'Buscar por nome, categoria, tag ou ficha'), h('p.meta', 'A imagem não é copiada: o mesmo registro passa a ser usado em mais um lugar.'), grid),
    actions: [{ label: 'Cancelar' }, { label: confirmLabel, kind: 'primary', onClick: () => { if (chosen.size) onPick([...chosen]); } }],
  });
}

/* Aba "Referências" das fichas: moodboards ligados ao registro + imagens associadas */
function galleryPanel(entity) {
  const cats = Images.categoriesFor(entity.kind);
  let filter = '';
  const wrap = h('div.col', { style: { gap: '18px' } });
  const addTo = async (files) => { if (files.length) { await Images.importFiles(files, { entityId: entity.id, category: filter }); render(); App.refreshHeader(); } };
  function boardsSection() {
    const boards = Boards.forEntity(entity.id);
    return h('div',
      h('div.panel-title', icon('moodboard'), h('h3', 'Moodboards'), btn('Novo moodboard', () => Boards.createFor(entity), { small: true, ic: 'plus', kind: 'primary' })),
      boards.length ? h('div.mbcards', boards.map(b => Boards.card(b))) : h('div.notice', 'Nenhum moodboard ligado a ' + entity.name + '. Um moodboard novo já começa com as imagens desta ficha e um cartão de referência a ela.'));
  }
  function render() {
    clear(wrap);
    const imgs = Store.imagesOf(entity.id);
    const shown = imgs.filter(im => !filter || ((im.links.find(l => l.entityId === entity.id) || {}).category || '') === filter);
    const drop = h('div.dropfiles', icon('upload', 15), ' Arraste imagens do computador para cá ou cole com Ctrl+V.');
    drop.addEventListener('dragover', e => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); drop.classList.add('over'); } });
    drop.addEventListener('dragleave', () => drop.classList.remove('over'));
    drop.addEventListener('drop', e => { e.preventDefault(); drop.classList.remove('over'); addTo([...e.dataTransfer.files]); });
    const gal = h('div.col', { style: { gap: '12px' } },
      h('div.panel-title', { style: { marginBottom: 0 } }, icon('image'), h('h3', 'Imagens associadas'), h('span.meta', U.plural(imgs.length, 'imagem', 'imagens'))),
      h('div.row',
        btn('Adicionar do computador', async () => addTo(await U.pickFile({ accept: 'image/*', multiple: true })), { ic: 'upload' }),
        btn('Da biblioteca', () => pickImages({ exclude: imgs.map(i => i.id), onPick: async ids => { let order = imgs.length; for (const id of ids) { const im = Store.S.imgs.get(id); im.links.push({ entityId: entity.id, category: filter, order: order++ }); Store.saveImage(im); } await Store.flush(); Toast.ok(U.plural(ids.length, 'imagem associada', 'imagens associadas') + '.'); render(); App.refreshHeader(); } }), { ic: 'library' }),
        btn('Por endereço web', () => Images.urlModal(() => { render(); App.refreshHeader(); }, { entityId: entity.id }), { ic: 'globe' })),
      h('div.subtabs', [['', 'Todas']].concat(cats.map(c => [c, c])).map(([v, l]) => {
        const n = v ? imgs.filter(im => (im.links.find(x => x.entityId === entity.id) || {}).category === v).length : imgs.length;
        return h('span.chip.click' + (filter === v ? '.on' : ''), { role: 'button', tabindex: 0, onclick: () => { filter = v; render(); }, onkeydown: e => { if (e.key === 'Enter') { filter = v; render(); } } }, l + (n ? ' · ' + n : ''));
      })));
    if (!shown.length) gal.append(drop, emptyState(filter ? 'Nada nesta categoria' : 'Sem imagens ainda', 'Reúna aqui as suas referências: arquivos do computador, imagens coladas ou endereços web.', null, 'image'));
    else {
      const grid = h('div.gallery', shown.map((im, idx) => {
        const l = im.links.find(x => x.entityId === entity.id);
        const isMain = entity.mainImageId === im.id || (!entity.mainImageId && idx === 0 && !filter);
        return h('div.gitem', { tabindex: 0, onclick: e => { if (!e.target.closest('.tools')) Lightbox.fromImages(shown, idx); }, onkeydown: e => { if (e.key === 'Enter') Lightbox.fromImages(shown, idx); } },
          h('img', { src: Store.imgURL(im), alt: im.title || '', loading: 'lazy' }),
          isMain ? h('span.badge', 'Principal') : (Images.isRemoteOnly(im) ? h('span.badge.remote', 'link externo') : null),
          h('div.cap', [l.category, im.title].filter(Boolean).join(' · ') || ' '),
          h('div.tools',
            h('button', { type: 'button', title: 'Usar como imagem principal', 'aria-label': 'Usar como imagem principal', onclick: () => { entity.mainImageId = im.id; Store.saveEntity(entity); render(); App.refreshHeader(); } }, icon('star', 13)),
            h('button', { type: 'button', title: 'Nome, categoria e detalhes', 'aria-label': 'Editar detalhes', onclick: () => editImageModal(im, entity.id) }, icon('edit', 13)),
            h('button', { type: 'button', title: 'Remover desta ficha (a imagem continua na biblioteca)', 'aria-label': 'Remover desta ficha', onclick: () => {
              const prevLinks = U.clone(im.links); const wasMain = entity.mainImageId === im.id;
              im.links = im.links.filter(x => x.entityId !== entity.id); Store.saveImage(im);
              if (wasMain) { entity.mainImageId = null; Store.saveEntity(entity); }
              render(); App.refreshHeader();
              Toast.action('Imagem removida desta ficha. Ela continua na biblioteca.', 'Desfazer', () => { im.links = prevLinks; Store.saveImage(im); if (wasMain) { entity.mainImageId = im.id; Store.saveEntity(entity); } render(); App.refreshHeader(); });
            } }, icon('x', 13))));
      }));
      makeSortable(grid, '.gitem', (from, to) => {
        const ordered = [...shown]; U.move(ordered, from, to);
        const full = Store.imagesOf(entity.id); const others = full.filter(x => !ordered.includes(x));
        [...ordered, ...others].forEach((im, i) => { im.links.find(x => x.entityId === entity.id).order = i; Store.saveImage(im); });
        render();
      });
      gal.append(grid, drop, h('p.meta', 'Arraste as miniaturas para reordenar. Clique para ampliar.'));
    }
    const cols = Store.list('refcollection').filter(c => (c.fields.linkedIds || []).includes(entity.id));
    wrap.append(boardsSection(), gal,
      cols.length ? h('div', h('div.panel-title', icon('images'), h('h3', 'Coleções')), h('div.linklist', cols.map(c => h('div.linkrow', icon('images'), h('div.grow', h('a.elink', { onclick: () => Nav.go('/p/' + Store.S.p.id + '/refs/collections') }, c.name), h('div.meta', U.plural((c.imageIds || []).length, 'imagem', 'imagens'))))))) : null);
  }
  render();
  return wrap;
}
