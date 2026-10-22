/* Fiction Studio — dashboard de projetos, formulário de projeto, tags globais, configurações gerais e dados de exemplo. */
'use strict';

const Views = {};

const coverUrls = new Map();
async function coverURL(p) {
  if (!p.coverImageId) return null;
  if (coverUrls.has(p.coverImageId)) return coverUrls.get(p.coverImageId);
  const img = await DB.get('images', p.coverImageId);
  if (!img) return null;
  const b = img.thumb || img.blob; if (!(b instanceof Blob)) return img.remoteThumb || null;
  const u = URL.createObjectURL(b); coverUrls.set(p.coverImageId, u); return u;
}
async function setProjectCover(p, file) {
  const t = await Images.makeThumb(file, 900);
  const img = { id: U.id('img'), projectId: p.id, blob: file, thumb: t.thumb, mime: file.type, size: file.size, width: t.width, height: t.height, title: 'Capa', role: 'cover', source: 'Arquivo local: ' + file.name, tags: [], links: [], createdAt: U.now() };
  const writes = [{ store: 'images', op: 'put', value: img }];
  if (p.coverImageId) writes.push({ store: 'images', op: 'del', id: p.coverImageId });
  await DB.batch(writes);
  if (Store.S.p && Store.S.p.id === p.id) { Store.S.imgs.set(img.id, img); if (p.coverImageId) Store.S.imgs.delete(p.coverImageId); }
  p.coverImageId = img.id;
}

const dashState = { filter: 'active', q: '', sort: 'updated' };

Views.dashboard = async function (main) {
  const page = h('div.page');
  main.appendChild(page);
  const projects = await Store.listProjects();
  const counts = {}; for (const p of projects) counts[p.id] = await Store.projectCounts(p.id);
  const grid = h('div.cards');
  const searchIn = h('input.input', { placeholder: 'Filtrar por nome, tipo ou tag', value: dashState.q, 'aria-label': 'Filtrar projetos', style: { maxWidth: '280px' } });
  function render() {
    clear(grid);
    const q = U.norm(dashState.q);
    let list = projects.filter(p => dashState.filter === 'all' || (dashState.filter === 'archived' ? p.archived : !p.archived));
    if (q) list = list.filter(p => U.norm([p.name, p.altTitle, p.workType, p.description, ...(p.tags || []).map(Store.tagName)].join(' ')).includes(q));
    list.sort(dashState.sort === 'name' ? U.byName : dashState.sort === 'created' ? (a, b) => b.createdAt - a.createdAt : (a, b) => b.updatedAt - a.updatedAt);
    if (!projects.length) {
      grid.replaceWith(grid);
      grid.appendChild(h('div', { style: { gridColumn: '1 / -1' } }, emptyState('Nenhum projeto ainda', 'Cada obra tem seu próprio espaço: personagens, lugares, histórias, eventos e imagens. Comece criando um projeto, ou crie um com dados de exemplo para explorar a ferramenta.',
        h('div.row', { style: { justifyContent: 'center', marginTop: '10px' } }, btn('Novo projeto', () => projectForm(), { kind: 'primary', ic: 'plus' }), btn('Criar projeto de exemplo', async () => { const p = await createDemoProject(); Nav.go('/p/' + p.id); }, { ic: 'sparkles' })))));
      return;
    }
    if (!list.length) grid.appendChild(h('div', { style: { gridColumn: '1 / -1' } }, emptyState('Nada encontrado', 'Nenhum projeto corresponde ao filtro.')));
    for (const p of list) grid.appendChild(projectCard(p, counts[p.id]));
  }
  searchIn.addEventListener('input', () => { dashState.q = searchIn.value; render(); });
  page.append(
    h('div.page-head',
      h('div.titles', h('h1', 'Projetos'), h('p', U.plural(projects.filter(p => !p.archived).length, 'projeto ativo', 'projetos ativos') + (projects.some(p => p.archived) ? ' · ' + projects.filter(p => p.archived).length + ' arquivado(s)' : ''))),
      h('div.row', btn('Importar projeto', importFlow, { ic: 'upload' }), btn('Tags', tagManager, { ic: 'flag' }), btn('Novo projeto', () => projectForm(), { kind: 'primary', ic: 'plus' }))),
    h('div.toolbar', searchIn,
      h('select.input', { 'aria-label': 'Mostrar', onchange: e => { dashState.filter = e.target.value; render(); } }, [['active', 'Ativos'], ['archived', 'Arquivados'], ['all', 'Todos']].map(([v, l]) => h('option', { value: v, selected: dashState.filter === v }, l))),
      h('select.input', { 'aria-label': 'Ordenar', onchange: e => { dashState.sort = e.target.value; render(); } }, [['updated', 'Última modificação'], ['name', 'Nome'], ['created', 'Criação']].map(([v, l]) => h('option', { value: v, selected: dashState.sort === v }, l)))),
    grid);
  render();
};

function projectCard(p, c) {
  const cover = h('div.cover', h('div.ph', (p.name || '?').slice(0, 1).toUpperCase()));
  coverURL(p).then(u => { if (u) { clear(cover); cover.appendChild(h('img', { src: u, alt: '' })); } });
  const stop = fn => e => { e.stopPropagation(); fn(); };
  const tagNames = (p.tags || []).map(id => tagChip(id)).filter(Boolean).slice(0, 4);
  return h('article.pcard' + (p.archived ? '.archived' : ''), { tabindex: 0, onclick: () => Nav.go('/p/' + p.id), onkeydown: e => { if (e.key === 'Enter' && e.target === e.currentTarget) Nav.go('/p/' + p.id); } },
    cover,
    h('div.body',
      h('div.row', h('span.type', p.workType || 'Projeto'), p.archived ? h('span.pill', 'Arquivado') : null),
      h('h3', p.name), p.altTitle ? h('div.muted.small', p.altTitle) : null,
      p.description ? h('div.desc', p.description) : null,
      tagNames.length ? h('div.chips', tagNames) : null,
      h('div.stats', [['character', 'personagens'], ['location', 'localidades'], ['storyline', 'storylines'], ['event', 'eventos']].map(([k, l]) => h('div', h('b', c[k]), l))),
      h('div.foot', icon('clock', 12), U.fmtDate(p.updatedAt), h('span.spacer'),
        btn('', stop(() => projectForm(p)), { ic: 'edit', small: true, title: 'Editar projeto', kind: 'ghost' }),
        btn('', e => { e.stopPropagation(); Menu.open(e.currentTarget, [
          { label: 'Abrir', ic: 'right', onClick: () => Nav.go('/p/' + p.id) },
          { label: 'Editar dados', ic: 'edit', onClick: () => projectForm(p) },
          { label: 'Alterar capa', ic: 'image', onClick: async () => { const f = await U.pickFile({ accept: 'image/*' }); if (f[0]) { await setProjectCover(p, f[0]); await Store.putProject(p); Toast.ok('Capa atualizada.'); App.route(); } } },
          { label: 'Pesquisar conteúdo', ic: 'search', onClick: () => Nav.go('/p/' + p.id + '/search') },
          { label: 'Estatísticas', ic: 'stats', onClick: () => projectStats(p.id) },
          { sep: true },
          { label: 'Duplicar', ic: 'copy', onClick: async () => { const d = await IO.duplicateProject(p.id); Toast.ok('Cópia independente criada: ' + d.name); App.route(); } },
          { label: 'Exportar', ic: 'download', onClick: async () => { try { const n = await IO.exportProject(p.id); Toast.ok('Projeto exportado (' + U.fmtBytes(n) + ').'); } catch (err) { Toast.err('Falha ao exportar: ' + err.message); } } },
          { label: p.archived ? 'Desarquivar' : 'Arquivar', ic: 'archive', onClick: async () => { p.archived = !p.archived; await Store.putProject(p); Toast.ok(p.archived ? 'Projeto arquivado.' : 'Projeto restaurado.'); App.route(); } },
          { sep: true },
          { label: 'Excluir…', ic: 'trash', danger: true, onClick: () => deleteProjectFlow(p) },
        ], { align: 'end' }); }, { ic: 'more', small: true, title: 'Ações do projeto', kind: 'ghost' }))));
}

async function deleteProjectFlow(p) {
  const c = await Store.projectCounts(p.id);
  const input = h('input.input', { placeholder: p.name, 'aria-label': 'Digite o nome do projeto' });
  const ok = await Modal.confirm('Excluir projeto', h('div',
    h('p', 'Isto apaga "' + p.name + '" e todo o seu conteúdo: ' + c.character + ' personagens, ' + c.location + ' localidades, ' + c.storyline + ' storylines, ' + c.event + ' eventos, relações e imagens. Outros projetos não são afetados.'),
    h('p', 'Se quiser guardar uma cópia, exporte o projeto antes.'), h('label.field', h('span.lbl', 'Para confirmar, digite o nome do projeto'), input)), { danger: true, okLabel: 'Excluir definitivamente' });
  if (!ok) return;
  if (input.value.trim() !== p.name) { Toast.warn('O nome digitado não confere. Nada foi excluído.'); return; }
  await Store.flush(); await DB.deleteProject(p.id); Toast.ok('Projeto excluído.'); App.route();
}

async function projectStats(pid) {
  const ents = await DB.byProject('entities', pid); const rels = await DB.byProject('relations', pid); const imgs = await DB.byProject('images', pid);
  const byKind = {}; ents.forEach(e => byKind[e.kind] = (byKind[e.kind] || 0) + 1);
  const bytes = imgs.reduce((s, i) => s + (i.blob ? i.blob.size : 0) + (i.thumb ? i.thumb.size : 0), 0);
  const est = await DB.estimate();
  Modal.open({
    title: 'Estatísticas', body: h('div.col',
      h('table.table', h('tbody', Object.keys(Schema.KINDS).filter(k => byKind[k]).map(k => h('tr', h('td', Schema.kindLabel(k, true)), h('td.num', byKind[k]))),
        h('tr', h('td', 'Relações'), h('td.num', rels.length)), h('tr', h('td', 'Imagens'), h('td.num', imgs.length + ' (' + U.fmtBytes(bytes) + ')')))),
      est ? h('p.muted.small', 'Armazenamento do navegador em uso por este app: ' + U.fmtBytes(est.usage || 0) + (est.quota ? ' de ' + U.fmtBytes(est.quota) + ' disponíveis' : '') + '.') : null),
    actions: [{ label: 'Fechar' }],
  });
}

/* Formulário de criação/edição */
function projectForm(existing = null) {
  const d = existing ? U.clone({ ...existing }) : { name: '', altTitle: '', workType: 'Visual Novel', description: '', synopsis: '', notes: '', tags: [] };
  let coverFile = null, template = '', demo = false;
  const wt = h('select.input', { id: 'pf-type', 'aria-label': 'Tipo de obra' });
  const fillWT = () => { clear(wt); for (const t of Store.workTypes()) wt.appendChild(h('option', { value: t, selected: t === d.workType }, t)); wt.appendChild(h('option', { value: '__new' }, '+ Novo tipo de obra…')); };
  fillWT();
  wt.addEventListener('change', async () => {
    if (wt.value === '__new') { const v = await Modal.prompt('Novo tipo de obra', 'Nome'); if (v) { Store.S.settings.workTypes = U.uniq([...(Store.S.settings.workTypes || []), v]); Store.saveSettings(); d.workType = v; } fillWT(); }
    else d.workType = wt.value;
  });
  const coverLbl = h('span.muted.small', existing && existing.coverImageId ? 'Capa atual mantida' : 'Nenhuma imagem');
  const F = (k, label, ta, rows) => fieldControl({ key: k, label, type: ta ? 'textarea' : 'text', rows, wide: ta }, d, v => d[k] = v);
  const body = h('div.col',
    h('div.form-grid', F('name', 'Nome do projeto'), F('altTitle', 'Título alternativo'), h('label.field', { for: 'pf-type' }, h('span.lbl', 'Tipo de obra'), wt),
      F('description', 'Descrição', true, 3), F('synopsis', 'Sinopse', true, 4), F('notes', 'Observações gerais', true, 2)),
    h('label.field', h('span.lbl', 'Tags: estilo, gênero, ambientação, identidade visual'), tagInput(d.tags, v => d.tags = v, { placeholder: 'Ex.: Fantasia sombria, Anime, Preto e branco…' }),
      h('span.hint', 'Reutilizáveis entre projetos e registros.')),
    h('div.field', h('span.lbl', 'Imagem de capa'), h('div.row', btn('Escolher imagem', async () => { const f = await U.pickFile({ accept: 'image/*' }); if (f[0]) { coverFile = f[0]; coverLbl.textContent = f[0].name; } }, { ic: 'image', small: true }), coverLbl)),
    !existing ? h('div.field', h('span.lbl', 'Sistema de jogo (opcional)'),
      h('select.input', { onchange: e => template = e.target.value, 'aria-label': 'Modelo de sistema' }, h('option', { value: '' }, 'Começar do zero (sem atributos/combate)'), IO.allTemplates().map(t => h('option', { value: t.id }, 'Usar modelo: ' + t.name))),
      h('span.hint', 'Para RPGs e jogos. Pode ser ativado ou trocado depois em Sistema de jogo.')) : null,
    !existing ? h('label.check', h('input', { type: 'checkbox', onchange: e => demo = e.target.checked }), 'Incluir dados de exemplo (marcados como exemplo e removíveis em Configurações)') : null,
  );
  Modal.open({
    title: existing ? 'Editar projeto' : 'Novo projeto', body, wide: true,
    actions: [{ label: 'Cancelar' }, { label: existing ? 'Salvar' : 'Criar projeto', kind: 'primary', onClick: async () => {
      if (!d.name.trim()) { Toast.warn('Dê um nome ao projeto.'); return false; }
      let p;
      if (existing) {
        p = Store.S.p && Store.S.p.id === existing.id ? Store.S.p : await DB.get('projects', existing.id);
        Object.assign(p, { name: d.name.trim(), altTitle: d.altTitle, workType: d.workType, description: d.description, synopsis: d.synopsis, notes: d.notes, tags: d.tags });
      } else {
        const all = await Store.listProjects();
        if (all.some(x => U.norm(x.name) === U.norm(d.name))) { if (!await Modal.confirm('Nome repetido', 'Já existe um projeto chamado "' + d.name + '". Criar outro com o mesmo nome?', { okLabel: 'Criar mesmo assim' })) return false; }
        p = Store.newProjectRecord({ name: d.name.trim(), altTitle: d.altTitle, workType: d.workType, description: d.description, synopsis: d.synopsis, notes: d.notes, tags: d.tags });
      }
      if (coverFile) await setProjectCover(p, coverFile);
      await Store.putProject(p);
      if (!existing) {
        if (template || demo) {
          await Store.openProject(p.id);
          if (template) { const t = IO.allTemplates().find(x => x.id === template); IO.applyTemplate(t, { replace: true }); }
          if (demo) addDemoContent();
          await Store.flush();
        }
        Toast.ok('Projeto criado.'); Nav.go('/p/' + p.id);
      } else { if (Store.S.p && Store.S.p.id === p.id) Store.saveProject(); Toast.ok('Projeto atualizado.'); App.route(); }
    } }],
  });
}

async function importFlow() {
  const [file] = await U.pickFile({ accept: '.zip,.json,application/zip,application/json' });
  if (!file) return;
  let pkg;
  try { pkg = await IO.readPackage(file); } catch (e) { Toast.err('Não foi possível ler o arquivo: ' + e.message); return; }
  if (pkg.errors.length) { Modal.open({ title: 'Arquivo inválido', body: h('div', h('p', 'O arquivo não pôde ser importado:'), h('ul.impact', pkg.errors.map(t => h('li', t)))), actions: [{ label: 'Fechar' }] }); return; }
  const m = pkg.manifest;
  const all = await Store.listProjects();
  const clash = all.find(p => U.norm(p.name) === U.norm(m.project.name));
  const nameIn = h('input.input', { value: clash ? m.project.name + ' (importado)' : m.project.name, 'aria-label': 'Nome do projeto importado' });
  const kinds = {}; m.entities.forEach(e => kinds[e.kind] = (kinds[e.kind] || 0) + 1);
  const ok = await Modal.confirm('Importar projeto', h('div.col',
    h('p', 'Conteúdo de "' + m.project.name + '", exportado em ' + (m.exportedAt ? new Date(m.exportedAt).toLocaleString('pt-BR') : 'data desconhecida') + ':'),
    h('ul', Object.entries(kinds).map(([k, n]) => h('li', n + ' ' + Schema.kindLabel(k, true).toLowerCase())), h('li', m.relations.length + ' relações'), h('li', m.images.length + ' imagens')),
    clash ? h('div.notice.warn', 'Já existe um projeto com esse nome. O importado será criado separadamente — nada existente é sobrescrito.') : null,
    pkg.warnings.length ? h('div.notice.warn', h('b', 'Avisos de validação:'), h('ul.impact', pkg.warnings.slice(0, 20).map(w => h('li', w)))) : null,
    h('label.field', h('span.lbl', 'Nome do novo projeto'), nameIn),
    h('p.muted.small', 'Todos os identificadores são regenerados, então não há conflito com projetos existentes.')), { okLabel: 'Importar' });
  if (!ok) return;
  try {
    const r = await IO.importPackage(pkg, { rename: nameIn.value.trim() || m.project.name });
    Toast.ok('Importado: ' + r.counts.entities + ' registros, ' + r.counts.relations + ' relações, ' + r.counts.images + ' imagens.');
    if (r.warnings.length > pkg.warnings.length) Toast.warn(r.warnings.slice(pkg.warnings.length).join(' '));
    Nav.go('/p/' + r.project.id);
  } catch (e) { Toast.err('Falha na importação: ' + e.message); }
}

function tagManager() {
  const body = h('div.col');
  async function render() {
    clear(body);
    const tags = [...Store.S.tags.values()].sort(U.byName);
    body.append(h('p.muted', 'Tags são compartilhadas entre todos os projetos e registros. Renomear aqui renomeia em todos os lugares.'),
      h('div.row', btn('Nova tag', async () => { const n = await Modal.prompt('Nova tag', 'Nome'); if (n) { if (Store.tagByName(n)) Toast.warn('Essa tag já existe.'); else Store.ensureTag(n); render(); } }, { ic: 'plus', small: true })));
    if (!tags.length) { body.appendChild(emptyState('Nenhuma tag', 'Crie tags aqui ou digitando no campo de tags de qualquer ficha.')); return; }
    body.appendChild(h('div.linklist', tags.map(t => h('div.linkrow',
      h('input', { type: 'color', value: t.color, 'aria-label': 'Cor da tag', style: { width: '28px', height: '24px', border: 0, background: 'none', padding: 0 }, onchange: e => { t.color = e.target.value; Store.saveTag(t); } }),
      h('div.grow', t.name),
      btn('', async () => { const n = await Modal.prompt('Renomear tag', 'Novo nome', t.name); if (n && n !== t.name) { const other = Store.tagByName(n); if (other && other.id !== t.id) { Toast.warn('Já existe uma tag com esse nome.'); return; } t.name = n; Store.saveTag(t); render(); } }, { ic: 'edit', small: true, title: 'Renomear' }),
      btn('', async () => {
        const u = await Store.tagUsage(t.id);
        const ok = await Modal.confirm('Excluir tag', u.total ? 'A tag "' + t.name + '" está em uso em ' + u.projects.length + ' projeto(s), ' + u.ents.length + ' registro(s) e ' + u.imgs.length + ' imagem(ns). Ela será retirada de todos.' : 'Excluir a tag "' + t.name + '"? Ela não está em uso.', { danger: true, okLabel: 'Excluir' });
        if (ok) { await Store.deleteTag(t.id); Toast.ok('Tag excluída.'); render(); }
      }, { ic: 'trash', small: true, title: 'Excluir' })))));
  }
  render();
  Modal.open({ title: 'Tags', body, actions: [{ label: 'Fechar', onClick: () => App.refresh() }] });
}

function globalSettings() { Nav.go('/settings'); }

/* ---------- Início ---------- */
Views.home = async function (main) {
  const page = h('div.page'); main.appendChild(page);
  const projects = (await Store.listProjects()).filter(p => !p.archived);
  const recent = projects.slice(0, 4);
  const counts = {}; for (const p of recent) counts[p.id] = await Store.projectCounts(p.id);
  const hour = new Date().getHours();
  page.append(
    h('div.page-head', h('div.titles', h('div.eyebrow', 'Fiction Studio'), h('h1', hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite'), h('p', projects.length ? 'Continue de onde parou ou comece algo novo.' : 'Um estúdio para criar personagens, mundos, histórias e sistemas de jogo — tudo conectado.')),
      h('div.row', btn('Importar projeto', importFlow, { ic: 'upload' }), btn('Novo projeto', () => projectForm(), { kind: 'primary', ic: 'plus' }))),
    recent.length ? h('div', h('div.panel-title', h('h3', 'Continuar trabalhando'), h('a.small', { href: '#/projects' }, 'Todos os projetos')), h('div.cards', recent.map(p => projectCard(p, counts[p.id])))) :
      emptyState('Nenhum projeto ainda', 'Cada obra tem seu próprio espaço: personagens, lugares, histórias, eventos, moodboards e sistemas de jogo. Comece do zero ou explore um projeto de exemplo.',
        [btn('Novo projeto', () => projectForm(), { kind: 'primary', ic: 'plus' }), btn('Criar projeto de exemplo', async () => { const p = await createDemoProject(); Nav.go('/p/' + p.id); }, { ic: 'sparkles' })], 'folder'),
    h('div.stat-row', { style: { marginTop: '26px' } },
      [['#/projects', 'folder', 'Projetos', 'Abrir, duplicar, arquivar e exportar'], ['#/library', 'library', 'Biblioteca de referências', 'Imagens de todos os projetos'], ['#/templates', 'template', 'Modelos', 'Sistemas de RPG reutilizáveis'], ['#/settings', 'gear', 'Configurações', 'Tema, cores de categorias, dados']].map(([href, ic, t, d]) =>
        h('a.stat', { href, style: { textDecoration: 'none', color: 'inherit' } }, h('span', icon(ic, 15), h('b', { style: { fontSize: '14px', display: 'inline', color: 'var(--fg)' } }, t)), h('div.meta', { style: { marginTop: '4px' } }, d)))),
    h('p.meta', { style: { marginTop: '24px' } }, 'Atalhos: ', h('span.kbd', 'N'), ' criar · ', h('span.kbd', '/'), ' pesquisar no projeto · ', h('span.kbd', 'Esc'), ' fechar janelas.'));
};

/* ---------- Modelos (globais) ---------- */
Views.templates = async function (main) {
  const page = h('div.page'); main.appendChild(page);
  const projects = (await Store.listProjects()).filter(p => !p.archived);
  const list = h('div.col', { style: { gap: '12px' } });
  const render = () => {
    clear(list);
    for (const t of IO.allTemplates()) {
      const kinds = {}; (t.entities || []).forEach(e => kinds[e.kind] = (kinds[e.kind] || 0) + 1);
      list.appendChild(h('section.panel', h('div.panel-title', icon('template'), h('h3', t.name), t.builtin ? h('span.pill', 'incluso') : h('span.meta', 'atualizado ' + U.fmtDate(t.updatedAt))),
        t.description ? h('p.small', t.description) : null,
        h('p.meta', (t.mechanics.attributes || []).length + ' atributos · ' + (t.mechanics.damageTypes || []).length + ' tipos de dano · ' + (t.mechanics.slots || []).length + ' slots' + (Object.keys(kinds).length ? ' · ' + Object.entries(kinds).map(([k, n]) => n + ' ' + Schema.kindLabel(k, n !== 1).toLowerCase()).join(' · ') : '')),
        h('div.row', { style: { marginTop: '8px' } },
          projects.length ? btn('Aplicar a um projeto…', ev => Menu.open(ev.currentTarget, projects.map(p => ({ label: p.name, ic: 'folder', onClick: async () => {
            await Store.openProject(p.id);
            const n = IO.applyTemplate(t, { replace: !Store.S.p.mechanics.attributes.length });
            await Store.flush(); Toast.ok('Modelo aplicado a "' + p.name + '" (' + n + ' registros criados; personagens não foram alterados).'); Nav.go('/p/' + p.id + '/mech');
          } }))), { small: true, kind: 'primary' }) : null,
          !t.builtin ? btn('Renomear', async () => { const n = await Modal.prompt('Renomear modelo', 'Nome', t.name); if (n) { t.name = n; t.updatedAt = U.now(); Store.saveTemplate(t); render(); } }, { small: true }) : null,
          !t.builtin ? btn('Descrição', async () => { const n = await Modal.prompt('Descrição do modelo', 'Descrição', t.description || ''); if (n != null) { t.description = n; t.updatedAt = U.now(); Store.saveTemplate(t); render(); } }, { small: true }) : null,
          !t.builtin ? btn('Excluir', async () => { if (await Modal.confirm('Excluir modelo', 'Excluir "' + t.name + '"? Projetos que já o usaram não são afetados.', { danger: true, okLabel: 'Excluir' })) { Store.deleteTemplate(t.id); await Store.flush(); render(); } }, { small: true, kind: 'danger' }) : null)));
    }
  };
  page.append(pageHead('Modelos', 'Sistemas de RPG reutilizáveis: atributos, categorias, tipos de dano, efeitos, progressão, classes, habilidades e árvores. Para criar um modelo, monte o sistema num projeto e use Sistemas de RPG → Modelos → "Salvar sistema atual como modelo". Aplicar copia os dados; os projetos não ficam ligados entre si.'), list);
  render();
};

/* ---------- Configurações gerais ---------- */
Views.appSettings = async function (main) {
  const page = h('div.page'); main.appendChild(page);
  const ui = Store.ui();
  const colorsBox = h('div.form-grid');
  const kinds = ['character', 'location', 'storyline', 'event', 'organization', 'skill', 'passive', 'class', 'item', 'effect', 'skilltree', 'moodboard', 'lore'];
  const renderColors = () => {
    clear(colorsBox);
    for (const k of kinds) colorsBox.appendChild(h('label.field', h('span.lbl', Schema.kindLabel(k, true)), h('div.row.nowrap', kindIcon(k, 18),
      h('input', { type: 'color', value: Schema.KINDS[k].color, 'aria-label': 'Cor de ' + Schema.kindLabel(k, true), onchange: e => { ui.kindColors = ui.kindColors || {}; ui.kindColors[k] = e.target.value; Schema.applyKindColors(ui.kindColors); Store.saveSettings(); App.renderSidebar(); renderColors(); } }),
      ui.kindColors && ui.kindColors[k] ? btn('', () => { delete ui.kindColors[k]; Schema.applyKindColors(ui.kindColors); Store.saveSettings(); App.renderSidebar(); renderColors(); }, { ic: 'undo', small: true, title: 'Voltar à cor padrão' }) : null)));
  };
  renderColors();
  const est = await DB.estimate();
  const persisted = navigator.storage && navigator.storage.persisted ? await navigator.storage.persisted().catch(() => false) : false;
  const srv = await Images.server();
  page.append(pageHead('Configurações', 'Preferências deste navegador, válidas para todos os projetos.'),
    h('section.panel', h('div.panel-title', icon('sun'), h('h3', 'Aparência')),
      h('div.form-grid', h('div.field', h('span.lbl', 'Tema'), segmented([{ value: 'dark', label: 'Escuro', ic: 'moon' }, { value: 'light', label: 'Claro', ic: 'sun' }], Store.S.settings.theme, v => App.setTheme(v), { label: 'Tema' })),
        h('div.field', h('span.lbl', 'Fichas abrem em'), segmented([{ value: 'summary', label: 'Resumida' }, { value: 'detailed', label: 'Detalhada' }], ui.detail || 'detailed', v => { ui.detail = v; Store.saveSettings(); }, { label: 'Visão padrão das fichas' })),
        h('div.field', h('span.lbl', 'Barra lateral'), segmented([{ value: false, label: 'Expandida' }, { value: true, label: 'Recolhida' }], !!ui.sidebarCollapsed, v => App.setCollapsed(v), { label: 'Barra lateral' })))),
    h('section.panel', h('div.panel-title', icon('palette'), h('h3', 'Cores das categorias'), Object.keys(ui.kindColors || {}).length ? btn('Restaurar todas', () => { ui.kindColors = {}; Schema.applyKindColors({}); Store.saveSettings(); App.renderSidebar(); renderColors(); }, { small: true }) : null),
      h('p.meta', { style: { marginBottom: '12px' } }, 'Usadas em ícones, marcadores, nós do grafo, linha do tempo e etiquetas. As cores de estado (sucesso, aviso, erro) não mudam.'), colorsBox),
    h('section.panel', h('div.panel-title', icon('flag'), h('h3', 'Tags')), h('p.small.muted', 'Tags são compartilhadas entre todos os projetos.'), btn('Gerenciar tags', tagManager, { small: true })),
    h('section.panel', h('div.panel-title', icon('archive'), h('h3', 'Armazenamento')),
      h('p.small', 'Os dados ficam no IndexedDB deste navegador, neste computador' + (est ? ' — em uso: ' + U.fmtBytes(est.usage || 0) + (est.quota ? ' de ' + U.fmtBytes(est.quota) + ' disponíveis' : '') : '') + '.'),
      h('p.small', persisted ? h('span.pill.ok', 'Armazenamento persistente concedido') : h('span.pill.warn', 'O navegador pode limpar os dados se faltar espaço'), ' Exporte seus projetos com regularidade como cópia de segurança.'),
      h('p.small', srv.ok ? h('span.pill.ok', 'Servidor local ativo') : h('span.pill', 'Servidor local não detectado'), ' O servidor local (iniciar.bat) é opcional; ele permite importar imagens por endereço web de sites que bloqueiam o navegador.')),
    h('section.panel', h('div.panel-title', icon('help'), h('h3', 'Atalhos')), h('div.read', [['N', 'Criar (menu contextual)'], ['/', 'Pesquisar no projeto'], ['Esc', 'Fechar janelas e menus'], ['Ctrl+Z / Ctrl+Shift+Z', 'Desfazer / refazer no moodboard'], ['Ctrl+V', 'Colar imagens no moodboard, na biblioteca e em Referências']].map(([k, d]) => h('div.ri', h('span.kbd', k), h('div.v.small', d))))));
};

/* ---------- dados de exemplo (marcados com demo:true) ---------- */
function addDemoContent() {
  const D = (kind, name, fields = {}, extra = {}) => Store.newEntity(kind, { name, fields, demo: true, tags: [Store.ensureTag('Exemplo').id], ...extra });
  const capital = D('location', 'Cidadela de Varn', { locType: 'Cidade', summary: 'Capital murada no alto de um penhasco, sempre coberta por névoa.', architecture: 'Torres góticas de pedra escura', climate: 'Frio e úmido', atmosphere: 'Opressiva, silenciosa à noite' });
  const torre = D('location', 'Torre do Arquivo', { locType: 'Castelo', parentId: capital.id, summary: 'Biblioteca proibida onde se guardam os registros da linhagem real.', lighting: 'Velas e vitrais', architecture: 'Gótica' });
  const vila = D('location', 'Vila de Ébano', { locType: 'Vila', summary: 'Aldeia de lenhadores na borda da floresta.' });
  const ordem = D('organization', 'Ordem do Véu', { orgType: 'Sociedade secreta', summary: 'Guardiões dos segredos da coroa.', baseId: torre.id });
  const aria = D('character', 'Aria Venn', { age: '19', species: 'Humana', gender: 'Feminino', occupation: 'Arquivista', storyRole: 'Protagonista', status: 'Vivo', hairColor: 'branco', hairLength: 'longo', eyes: 'vermelhos', clothing: 'manto escuro e luvas de couro', summary: 'Arquivista que descobre ser herdeira de uma linhagem apagada.', originId: vila.id, residenceIds: [torre.id], orgIds: [ordem.id] });
  const corvin = D('character', 'Corvin Venn', { age: '52', species: 'Humano', gender: 'Masculino', occupation: 'Lenhador', storyRole: 'Mentor', status: 'Morto', summary: 'Pai adotivo de Aria. Guardava o segredo do nascimento dela.', residenceIds: [vila.id] });
  const lysa = D('character', 'Lysa Marr', { age: '21', species: 'Elfa', gender: 'Feminino', occupation: 'Caçadora', storyRole: 'Rival', status: 'Vivo', summary: 'Caçadora da Ordem enviada para vigiar Aria.', orgIds: [ordem.id] });
  const main = D('storyline', 'A linhagem apagada', { slType: 'Trama principal', status: 'Em desenvolvimento', theme: 'Identidade', genre: 'Fantasia sombria', summary: 'Aria descobre sua origem e precisa decidir se reivindica a coroa.', characterIds: [aria.id, lysa.id, corvin.id], locationIds: [capital.id, torre.id] },
    { steps: [
      { id: U.id('st'), title: 'O registro rasgado', unit: 'Capítulo', description: 'Aria encontra uma página arrancada do livro de linhagens.', status: 'Escrito', characterIds: [aria.id], locationIds: [torre.id], eventIds: [] },
      { id: U.id('st'), title: 'A morte de Corvin', unit: 'Capítulo', description: 'Corvin é assassinado antes de revelar tudo.', status: 'Rascunho', characterIds: [aria.id, corvin.id], locationIds: [vila.id], eventIds: [] },
      { id: U.id('st'), title: 'Encontro na névoa', unit: 'Cena', description: 'Lysa confronta Aria nas muralhas.', status: 'Ideia', characterIds: [aria.id, lysa.id], locationIds: [capital.id], eventIds: [] },
    ] });
  const ev1 = D('event', 'Nascimento oculto de Aria', { evType: 'Revelação', chronoLabel: 'Ano 1184', chronoOrder: 1, narrativeOrder: 3, summary: 'Aria nasce na corte e é levada às escondidas para a Vila de Ébano.', characterIds: [aria.id, corvin.id], locationIds: [capital.id, vila.id], storylineIds: [main.id], chapter: 'Cap. 10 (flashback)' });
  const ev2 = D('event', 'Descoberta da página rasgada', { evType: 'Revelação', chronoLabel: 'Ano 1203', chronoOrder: 2, narrativeOrder: 1, summary: 'Aria encontra a página arrancada.', characterIds: [aria.id], locationIds: [torre.id], storylineIds: [main.id], chapter: 'Cap. 1', causeEventIds: [ev1.id] });
  const ev3 = D('event', 'Assassinato de Corvin', { evType: 'Morte', chronoLabel: 'Ano 1203', chronoOrder: 3, narrativeOrder: 2, summary: 'Corvin morre protegendo o segredo.', characterIds: [corvin.id, aria.id], locationIds: [vila.id], storylineIds: [main.id], chapter: 'Cap. 3', causeEventIds: [ev2.id] });
  main.steps[0].eventIds = [ev2.id]; main.steps[1].eventIds = [ev3.id]; Store.saveEntity(main, { silent: true });
  const R = (typeId, fromId, toId, description = '') => Store.saveRelation({ typeId, fromId, toId, description, history: '', state: '', period: '', notes: '', tags: [], demo: true });
  R('rt_father', corvin.id, aria.id, 'Pai adotivo.'); R('rt_rival', aria.id, lysa.id, 'Desconfiança mútua que vira respeito.'); R('rt_mentor', corvin.id, aria.id, 'Ensinou-a a ler os registros antigos.');
  D('lore', 'O Véu', { category: 'Sistemas de magia', content: 'A névoa de Varn é uma magia antiga que apaga memórias de quem a atravessa sem permissão.' });
  const p = Store.S.p;
  if (p.mechanics.enabled) {
    const fire = Store.list('skill')[0];
    if (fire) { Mech.ensureMech(aria); aria.mech.enabled = true; for (const a of p.mechanics.attributes) if (!a.derived) aria.mech.attrs[a.id] = { base: a.default }; aria.mech.attrs.a_int = { base: 14 }; aria.mech.skills.push({ ref: fire.id, level: 1 }); aria.mech.level = 3; Store.saveEntity(aria, { silent: true }); ev2.unlocks = [{ ref: fire.id }]; Store.saveEntity(ev2, { silent: true }); }
  }
  Store.saveProject();
}
async function createDemoProject() {
  const p = await Store.createProject({ name: 'Exemplo — A Linhagem Apagada', workType: 'Mangá', description: 'Projeto de demonstração. Pode ser apagado a qualquer momento.', tags: [Store.ensureTag('Fantasia sombria').id, Store.ensureTag('Mangá').id, Store.ensureTag('Medieval').id] });
  await Store.openProject(p.id);
  IO.applyTemplate(IO.allTemplates()[0], { replace: true });
  addDemoContent();
  await Store.flush();
  return p;
}
