/* Fiction Studio — estado em memória do projeto aberto, salvamento automático e integridade referencial. */
'use strict';

const Store = (() => {
  const S = {
    settings: { id: 'app', theme: 'dark', workTypes: [], ui: {} },
    tags: new Map(),
    templates: [],
    p: null,              // projeto aberto
    ents: new Map(),
    rels: new Map(),
    imgs: new Map(),
    urlCache: new Map(),  // imageId:thumb|full → object URL
  };
  const listeners = {};
  function on(evt, fn) { (listeners[evt] = listeners[evt] || []).push(fn); return () => { listeners[evt] = listeners[evt].filter(f => f !== fn); }; }
  function emit(evt, data) { (listeners[evt] || []).forEach(f => { try { f(data); } catch (e) { console.error(e); } }); }

  /* ---------- fila de gravação ---------- */
  const pending = new Map();
  let status = 'saved';
  function setStatus(s, detail) { status = s; emit('status', { status: s, detail }); }
  function queue(store, value) { pending.set(store + ':' + value.id, { store, op: 'put', value }); setStatus('dirty'); flushSoon(); }
  function queueDel(store, id) { pending.set(store + ':' + id, { store, op: 'del', id }); setStatus('dirty'); flushSoon(); }
  const flushSoon = U.debounce(() => flush(), 350);
  let flushing = null;
  async function flush() {
    if (flushing) { await flushing; }
    if (!pending.size) { if (status !== 'error') setStatus('saved'); return; }
    const writes = [...pending.values()]; pending.clear();
    setStatus('saving');
    flushing = DB.batch(writes).then(() => { setStatus('saved'); }).catch(err => {
      console.error(err);
      for (const w of writes) { const k = w.store + ':' + (w.value ? w.value.id : w.id); if (!pending.has(k)) pending.set(k, w); }
      setStatus('error', err && err.name === 'QuotaExceededError' ? 'Sem espaço de armazenamento no navegador.' : (err && err.message) || 'Erro ao gravar');
      Toast.err('Não foi possível salvar: ' + ((err && err.message) || 'erro desconhecido') + '. As alterações continuam na memória; tente exportar o projeto.');
    }).finally(() => { flushing = null; });
    await flushing;
  }
  window.addEventListener('beforeunload', e => { if (pending.size || status === 'saving') { flush(); e.preventDefault(); e.returnValue = ''; } });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });

  /* ---------- inicialização global ---------- */
  async function init() {
    await DB.open();
    const st = await DB.get('settings', 'app');
    if (st) S.settings = { ...S.settings, ...st };
    // a pesquisa automática de imagens foi removida: limpa chaves e preferências antigas
    let cleaned = false;
    for (const k of ['apiKeys', 'providers']) if (k in S.settings) { delete S.settings[k]; cleaned = true; }
    S.settings.ui = { detail: 'detailed', listViews: {}, panelWidths: {}, kindColors: {}, sidebarCollapsed: false, ...(S.settings.ui || {}) };
    if (cleaned) saveSettings();
    for (const t of await DB.all('tags')) S.tags.set(t.id, t);
    S.templates = await DB.all('templates');
    DB.persist();
  }
  function saveSettings() { queue('settings', S.settings); }
  function ui() { return S.settings.ui || (S.settings.ui = {}); }

  /* ---------- tags (globais, reutilizáveis entre projetos) ---------- */
  const TAG_COLORS = ['#8b7cf6', '#2fb8a6', '#e0a03c', '#e46a8a', '#5aa0e6', '#6fc36f', '#c58af0', '#f07a4a', '#4ac4e0', '#d6c14a'];
  function tagByName(name) { const n = U.norm(name); return [...S.tags.values()].find(t => U.norm(t.name) === n); }
  function ensureTag(name) {
    name = String(name).trim(); if (!name) return null;
    let t = tagByName(name);
    if (!t) { t = { id: U.id('t'), name, color: TAG_COLORS[S.tags.size % TAG_COLORS.length], createdAt: U.now() }; S.tags.set(t.id, t); queue('tags', t); emit('tags'); }
    return t;
  }
  function saveTag(t) { S.tags.set(t.id, t); queue('tags', t); emit('tags'); }
  async function tagUsage(tagId) {
    const projects = (await DB.all('projects')).filter(p => (p.tags || []).includes(tagId));
    const ents = (await DB.all('entities')).filter(e => (e.tags || []).includes(tagId));
    const imgs = (await DB.all('images')).filter(i => (i.tags || []).includes(tagId));
    return { projects, ents, imgs, total: projects.length + ents.length + imgs.length };
  }
  async function deleteTag(tagId) {
    await flush();
    const u = await tagUsage(tagId);
    const writes = [{ store: 'tags', op: 'del', id: tagId }];
    for (const p of u.projects) { p.tags = p.tags.filter(x => x !== tagId); writes.push({ store: 'projects', op: 'put', value: p }); }
    for (const e of u.ents) { e.tags = e.tags.filter(x => x !== tagId); writes.push({ store: 'entities', op: 'put', value: e }); }
    for (const i of u.imgs) { i.tags = i.tags.filter(x => x !== tagId); writes.push({ store: 'images', op: 'put', value: i }); }
    await DB.batch(writes);
    S.tags.delete(tagId);
    if (S.p) {
      S.p.tags = (S.p.tags || []).filter(x => x !== tagId);
      for (const e of S.ents.values()) e.tags = (e.tags || []).filter(x => x !== tagId);
      for (const i of S.imgs.values()) i.tags = (i.tags || []).filter(x => x !== tagId);
    }
    emit('tags'); emit('change', {});
    return u.total;
  }
  function tagName(id) { const t = S.tags.get(id); return t ? t.name : null; }

  /* ---------- projetos ---------- */
  function newProjectRecord(data = {}) {
    return {
      id: U.id('p'), name: 'Novo projeto', altTitle: '', workType: 'Visual Novel', description: '', synopsis: '', notes: '',
      tags: [], coverImageId: null, archived: false, createdAt: U.now(), updatedAt: U.now(),
      config: Schema.defaultConfig(), mechanics: Schema.defaultMechanics(), integrityLog: [], ...data,
    };
  }
  async function listProjects() { return (await DB.all('projects')).sort((a, b) => b.updatedAt - a.updatedAt); }
  async function projectCounts(pid) {
    const c = {};
    for (const k of ['character', 'location', 'storyline', 'event']) c[k] = await DB.countKind(pid, k);
    return c;
  }
  async function createProject(data) {
    const p = newProjectRecord(data);
    await DB.put('projects', p);
    return p;
  }
  async function putProject(p) { p.updatedAt = U.now(); await DB.put('projects', p); }
  function touchProject() { if (!S.p) return; S.p.updatedAt = U.now(); queue('projects', S.p); }
  function saveProject() { touchProject(); emit('project'); }

  async function openProject(pid) {
    await flush();
    const p = await DB.get('projects', pid);
    if (!p) return null;
    // migração suave de projetos antigos/importados
    const defCfg = Schema.defaultConfig();
    p.config = { ...defCfg, ...(p.config || {}) };
    p.config.lists = { ...defCfg.lists, ...(p.config.lists || {}) };
    p.config.modules = { ...defCfg.modules, ...(p.config.modules || {}) };
    p.mechanics = { ...Schema.defaultMechanics(), ...(p.mechanics || {}) };
    p.mechanics.modules = { ...Schema.defaultMechanics().modules, ...(p.mechanics.modules || {}) };
    p.integrityLog = p.integrityLog || [];
    S.p = p;
    S.ents = new Map((await DB.byProject('entities', pid)).map(e => [e.id, e]));
    S.rels = new Map((await DB.byProject('relations', pid)).map(r => [r.id, r]));
    for (const u of S.urlCache.values()) URL.revokeObjectURL(u);
    S.urlCache.clear();
    S.imgs = new Map((await DB.byProject('images', pid)).map(i => [i.id, i]));
    migrateProject();
    emit('open', p);
    return p;
  }
  /* Migrações suaves: dados antigos continuam abrindo e editáveis. */
  function migrateProject() {
    let n = 0;
    for (const c of [...S.ents.values()].filter(e => e.kind === 'refcollection')) {
      if (Array.isArray(c.results) && !Array.isArray(c.imageIds)) {
        // coleções da antiga pesquisa automática: os resultados viram registros de mídia marcados como link externo
        c.imageIds = [];
        for (const r of c.results) {
          if (!r || !(r.full || r.thumb)) continue;
          const img = { id: U.id('img'), projectId: S.p.id, blob: null, thumb: null, mime: '', size: 0, title: r.title || 'Imagem', description: r.query ? 'Pesquisa antiga: "' + r.query + '"' : '', category: '',
            source: [r.site, r.provider].filter(Boolean).join(' via '), sourceUrl: r.sourceUrl || '', creator: r.creator || '', license: r.license || '', notes: '', tags: [], links: [], remoteUrl: r.full || r.thumb, remoteThumb: r.thumb || r.full, createdAt: c.createdAt || U.now() };
          S.imgs.set(img.id, img); queue('images', img); c.imageIds.push(img.id);
        }
        c.fields = { description: (c.fields && c.fields.notes) || '', legacyQueries: (c.fields && c.fields.queries) || [], linkedIds: c.fields && c.fields.entityId ? [c.fields.entityId] : [] };
        delete c.results; c.legacy = true; queue('entities', c); n++;
      }
      c.imageIds = c.imageIds || [];
    }
    for (const m of [...S.ents.values()].filter(e => e.kind === 'moodboard')) { m.items = m.items || []; m.fields.linkedIds = m.fields.linkedIds || []; }
    if (n) addLog(n + ' coleção(ões) da pesquisa automática antiga foram convertidas: as imagens ficaram na biblioteca como links externos.');
  }
  function closeProject() { S.p = null; S.ents = new Map(); S.rels = new Map(); S.imgs = new Map(); }

  /* ---------- entidades ---------- */
  function list(kind) { return [...S.ents.values()].filter(e => e.kind === kind); }
  function get(id) { return S.ents.get(id) || null; }
  function newEntity(kind, data = {}) {
    const e = { id: U.id(kind.slice(0, 3)), projectId: S.p.id, kind, name: data.name || 'Sem nome', tags: [], fields: {}, custom: [], mainImageId: null, createdAt: U.now(), updatedAt: U.now(), ...data };
    e.fields = { ...(data.fields || {}) };
    S.ents.set(e.id, e); queue('entities', e); touchProject();
    emit('change', { kind, id: e.id });
    return e;
  }
  function saveEntity(e, { silent = false } = {}) {
    e.updatedAt = U.now(); S.ents.set(e.id, e); queue('entities', e); touchProject();
    if (!silent) emit('change', { kind: e.kind, id: e.id });
  }
  function findSimilar(kind, name, exceptId = null) {
    return list(kind).filter(e => e.id !== exceptId && U.similar(e.name, name));
  }

  /* Caminha por um objeto procurando referências ao id. */
  function containsRef(obj, id) {
    if (obj == null) return false;
    if (typeof obj === 'string') return obj === id;
    if (Array.isArray(obj)) return obj.some(x => containsRef(x, id));
    if (typeof obj === 'object') { for (const [k, v] of Object.entries(obj)) { if (k === 'id' || k === 'projectId') continue; if (containsRef(v, id)) return true; } }
    return false;
  }
  function stripRef(obj, id) {
    if (Array.isArray(obj)) {
      for (let i = obj.length - 1; i >= 0; i--) {
        const x = obj[i];
        if (x === id || (x && typeof x === 'object' && x.ref === id)) obj.splice(i, 1);
        else if (x && typeof x === 'object') stripRef(x, id);
      }
    } else if (obj && typeof obj === 'object') {
      for (const [k, v] of Object.entries(obj)) {
        if (k === 'id' || k === 'projectId') continue;
        if (v === id) obj[k] = null;
        else if (v && typeof v === 'object') stripRef(v, id);
      }
    }
  }
  function referrers(id) { return [...S.ents.values()].filter(e => e.id !== id && containsRef(e, id)); }
  function relationsOf(id) { return [...S.rels.values()].filter(r => r.fromId === id || r.toId === id); }
  function impactOf(id) {
    return {
      relations: relationsOf(id),
      referrers: referrers(id),
      images: imagesOf(id),
      exclusiveImages: imagesOf(id).filter(i => i.links.length === 1),
    };
  }
  function deleteEntity(id, { keepImages = true } = {}) {
    const e = S.ents.get(id); if (!e) return;
    const imp = impactOf(id);
    const log = [];
    for (const r of imp.relations) {
      const other = get(r.fromId === id ? r.toId : r.fromId);
      log.push(`Relação "${relLabel(r, r.fromId === id ? r.toId : r.fromId)}" com "${other ? other.name : '?'}" removida junto com "${e.name}".`);
      S.rels.delete(r.id); queueDel('relations', r.id);
    }
    for (const ref of imp.referrers) {
      stripRef(ref, id); saveEntity(ref, { silent: true });
      log.push(`"${ref.name}" (${Schema.kindLabel(ref.kind)}) perdeu o vínculo com "${e.name}".`);
    }
    for (const img of imp.images) {
      img.links = img.links.filter(l => l.entityId !== id);
      if (!img.links.length && !keepImages) { deleteImageRecord(img.id); }
      else saveImage(img);
    }
    if (S.p.config.graphPositions) delete S.p.config.graphPositions[id];
    S.ents.delete(id); queueDel('entities', id);
    if (log.length) addLog(log);
    touchProject();
    emit('change', { kind: e.kind, id, deleted: true });
  }
  function addLog(lines) {
    const date = U.now();
    for (const text of [].concat(lines)) S.p.integrityLog.unshift({ id: U.id('log'), date, text });
    S.p.integrityLog = S.p.integrityLog.slice(0, 500);
  }
  function duplicateEntity(id) {
    const src = get(id); if (!src) return null;
    const copy = U.clone(src); delete copy.id;
    copy.name = src.name + ' (cópia)'; copy.createdAt = copy.updatedAt = U.now();
    const e = newEntity(src.kind, copy);
    for (const img of imagesOf(id)) { const l = img.links.find(x => x.entityId === id); img.links.push({ ...l, entityId: e.id }); saveImage(img); }
    return e;
  }

  /* ---------- relações ---------- */
  function relTypes() { return S.p.config.relationTypes; }
  function relType(id) { return relTypes().find(t => t.id === id) || { id, label: 'relação removida', reverse: 'relação removida', symmetric: true, cat: 'outro' }; }
  /* rótulo do ponto de vista de "fromPerspectiveId"; se o id for o destino, usa o rótulo inverso */
  function relLabel(r, otherId) {
    const t = relType(r.typeId);
    if (t.symmetric) return t.label;
    return r.toId === otherId ? t.label : t.reverse;
  }
  function findDuplicateRelation(rel) {
    const t = relType(rel.typeId);
    return [...S.rels.values()].find(r => r.id !== rel.id && r.typeId === rel.typeId &&
      ((r.fromId === rel.fromId && r.toId === rel.toId) || (t.symmetric && r.fromId === rel.toId && r.toId === rel.fromId)));
  }
  function saveRelation(r) {
    if (!r.id) { r.id = U.id('r'); r.createdAt = U.now(); }
    r.projectId = S.p.id; r.updatedAt = U.now();
    S.rels.set(r.id, r); queue('relations', r); touchProject();
    emit('change', { kind: 'relation', id: r.id });
    return r;
  }
  function deleteRelation(id) { S.rels.delete(id); queueDel('relations', id); touchProject(); emit('change', { kind: 'relation', id }); }

  /* ---------- imagens ---------- */
  function imagesOf(entityId) {
    return [...S.imgs.values()].filter(i => i.links && i.links.some(l => l.entityId === entityId))
      .sort((a, b) => (a.links.find(l => l.entityId === entityId).order || 0) - (b.links.find(l => l.entityId === entityId).order || 0));
  }
  function saveImage(img) { img.projectId = img.projectId || (S.p && S.p.id); S.imgs.set(img.id, img); queue('images', img); touchProject(); emit('images'); }
  /* Onde uma imagem é usada: fichas (vínculos), moodboards e coleções. */
  function mediaUsage(id) {
    const img = S.imgs.get(id);
    const ents = img ? (img.links || []).map(l => get(l.entityId)).filter(Boolean) : [];
    const boards = [...S.ents.values()].filter(e => e.kind === 'moodboard' && ((e.items || []).some(it => it.imageId === id) || e.fields.coverImageId === id));
    const cols = [...S.ents.values()].filter(e => e.kind === 'refcollection' && (e.imageIds || []).includes(id));
    const mains = [...S.ents.values()].filter(e => e.mainImageId === id);
    return { ents, boards, cols, mains, used: ents.length + boards.length > 0 || (S.p && S.p.coverImageId === id) };
  }
  function deleteImageRecord(id) {
    S.imgs.delete(id); queueDel('images', id);
    for (const e of S.ents.values()) {
      let ch = false;
      if (e.mainImageId === id) { e.mainImageId = null; ch = true; }
      if (e.kind === 'moodboard') {
        const before = (e.items || []).length; e.items = (e.items || []).filter(it => it.imageId !== id); if (e.items.length !== before) ch = true;
        if (e.fields.coverImageId === id) { e.fields.coverImageId = null; ch = true; }
      }
      if (e.kind === 'refcollection' && (e.imageIds || []).includes(id)) { e.imageIds = e.imageIds.filter(x => x !== id); ch = true; }
      if (ch) saveEntity(e, { silent: true });
    }
    for (const k of ['thumb', 'full', 'preview']) { const u = S.urlCache.get(id + ':' + k); if (u) { URL.revokeObjectURL(u); S.urlCache.delete(id + ':' + k); } }
    touchProject(); emit('images');
  }
  /* size: true/'thumb' (≈420px), 'preview' (≈1600px), false/'full' (original) */
  function imgURL(img, size = true) {
    if (!img) return null;
    const mode = size === true ? 'thumb' : size === false ? 'full' : size;
    const key = img.id + ':' + mode;
    if (S.urlCache.has(key)) return S.urlCache.get(key);
    const blob = mode === 'thumb' ? (img.thumb || img.preview || img.blob) : mode === 'preview' ? (img.preview || img.blob || img.thumb) : (img.blob || img.preview || img.thumb);
    const thumb = mode === 'thumb';
    if (blob instanceof Blob) { const u = URL.createObjectURL(blob); S.urlCache.set(key, u); return u; }
    return thumb ? (img.remoteThumb || img.remoteUrl) : (img.remoteUrl || img.remoteThumb);
  }
  function mainImage(e) {
    if (!e) return null;
    if (e.mainImageId && S.imgs.has(e.mainImageId)) return S.imgs.get(e.mainImageId);
    const imgs = imagesOf(e.id);
    return imgs[0] || null;
  }

  /* ---------- verificação de integridade ---------- */
  function integrityScan() {
    const problems = [];
    const ids = new Set(S.ents.keys());
    for (const e of S.ents.values()) {
      for (const f of Schema.refFields(e.kind)) {
        const v = e.fields[f.key];
        const arr = f.type === 'refs' ? (v || []) : (v ? [v] : []);
        for (const id of arr) if (!ids.has(id)) problems.push({ entity: e, text: `"${e.name}": campo "${f.label}" aponta para um registro inexistente.`, fix: () => { if (f.type === 'refs') e.fields[f.key] = (e.fields[f.key] || []).filter(x => ids.has(x)); else e.fields[f.key] = null; saveEntity(e, { silent: true }); } });
      }
      if (e.mainImageId && !S.imgs.has(e.mainImageId)) problems.push({ entity: e, text: `"${e.name}": imagem principal não existe mais.`, fix: () => { e.mainImageId = null; saveEntity(e, { silent: true }); } });
    }
    for (const r of S.rels.values()) {
      if (!ids.has(r.fromId) || !ids.has(r.toId)) problems.push({ text: 'Relação com extremidade inexistente.', fix: () => deleteRelation(r.id) });
      else if (!relTypes().find(t => t.id === r.typeId)) problems.push({ text: `Relação entre "${get(r.fromId).name}" e "${get(r.toId).name}" usa um tipo de relação excluído.`, fix: null });
    }
    for (const i of S.imgs.values()) {
      const bad = (i.links || []).filter(l => !ids.has(l.entityId));
      if (bad.length) problems.push({ text: `Imagem "${i.title || i.id}" ligada a registro inexistente.`, fix: () => { i.links = i.links.filter(l => ids.has(l.entityId)); saveImage(i); } });
    }
    return problems;
  }

  /* ---------- modelos (templates) ---------- */
  function saveTemplate(t) { const i = S.templates.findIndex(x => x.id === t.id); if (i >= 0) S.templates[i] = t; else S.templates.push(t); queue('templates', t); }
  function deleteTemplate(id) { S.templates = S.templates.filter(t => t.id !== id); queueDel('templates', id); }

  /* ---------- listas configuráveis ---------- */
  function listValues(key) { return (S.p && S.p.config.lists[key]) || []; }
  function addListValue(key, value) {
    value = String(value || '').trim(); if (!value) return;
    const l = S.p.config.lists[key] = S.p.config.lists[key] || [];
    if (!l.some(v => U.norm(v) === U.norm(value))) { l.push(value); saveProject(); }
  }
  function workTypes() { return U.uniq([...Schema.WORK_TYPES, ...(S.settings.workTypes || [])]); }

  return {
    S, on, emit, init, flush, get status() { return status; }, saveSettings,
    tagByName, ensureTag, saveTag, deleteTag, tagUsage, tagName,
    newProjectRecord, listProjects, projectCounts, createProject, putProject, openProject, closeProject, saveProject, touchProject,
    list, get, newEntity, saveEntity, deleteEntity, duplicateEntity, findSimilar, referrers, relationsOf, impactOf, addLog, containsRef,
    relTypes, relType, relLabel, findDuplicateRelation, saveRelation, deleteRelation,
    imagesOf, saveImage, deleteImageRecord, imgURL, mainImage,
    integrityScan, saveTemplate, deleteTemplate, ui, mediaUsage, listValues, addListValue, workTypes, queue, queueDel,
  };
})();
