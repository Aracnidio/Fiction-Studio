/* Fiction Studio — inicialização, rotas por hash, barra superior (trilha, busca, criação rápida) e barra lateral. */
'use strict';

const SECTION_LABELS = {
  '': 'Visão geral', characters: 'Personagens', locations: 'Localidades', storylines: 'Storylines', events: 'Eventos', organizations: 'Organizações',
  graph: 'Grafo do universo', mech: 'Sistemas de RPG', refs: 'Moodboards e referências', timeline: 'Cronologia', notes: 'Notas e documentação',
  settings: 'Configurações do projeto', search: 'Pesquisa',
};

const App = {
  root: null, main: null, sidebar: null, _headerRenderer: null, keyHandler: null, pasteHandler: null, _leave: [], _scroll: new Map(),
  async start() {
    this.root = document.getElementById('app');
    try { await Store.init(); }
    catch (e) {
      this.root.innerHTML = '';
      this.root.appendChild(h('div.page', h('h1', 'Não foi possível abrir o armazenamento'), h('p', e.message), h('p.muted', 'O aplicativo precisa do IndexedDB. Em janelas privadas ou com dados de site bloqueados ele pode não estar disponível. Tente outro navegador ou abra pelo iniciar.bat (veja o README).')));
      return;
    }
    Schema.applyKindColors(Store.ui().kindColors || {});
    this.setTheme(Store.S.settings.theme || 'dark', false);
    this.buildShell();
    Store.on('status', s => this.renderStatus(s));
    Store.on('change', U.debounce(() => { this.renderSidebar(); }, 200));
    window.addEventListener('hashchange', () => this.route());
    document.addEventListener('keydown', e => this.onKey(e));
    document.addEventListener('paste', e => { if (this.pasteHandler && !Modal.stack.length) this.pasteHandler(e); });
    this.route();
  },
  onLeave(fn) { this._leave.push(fn); },
  setTheme(t, persist = true) {
    document.documentElement.dataset.theme = t;
    Store.S.settings.theme = t;
    if (persist) Store.saveSettings();
    if (this.themeBtn) { clear(this.themeBtn); this.themeBtn.appendChild(icon(t === 'dark' ? 'sun' : 'moon')); this.themeBtn.title = t === 'dark' ? 'Usar tema claro' : 'Usar tema escuro'; this.themeBtn.setAttribute('aria-label', this.themeBtn.title); }
  },
  setCollapsed(v) { Store.ui().sidebarCollapsed = v; Store.saveSettings(); this.root.classList.toggle('collapsed', v); this.renderSidebar(); },
  buildShell() {
    clear(this.root);
    this.root.classList.toggle('collapsed', !!Store.ui().sidebarCollapsed);
    this.statusEl = h('span.savestate', { role: 'status' }, h('span.dot'), h('span', 'Salvo'));
    this.crumbs = h('nav.crumbs', { 'aria-label': 'Você está em' });
    this.searchIn = h('input.input', { type: 'search', placeholder: 'Pesquisar no projeto', 'aria-label': 'Pesquisar no projeto' });
    this.searchIn.addEventListener('keydown', e => { if (e.key === 'Enter' && Store.S.p) { searchState.q = this.searchIn.value; Nav.go('/p/' + Store.S.p.id + '/search'); } });
    this.searchWrap = h('div.top-search', icon('search', 15), this.searchIn, h('span.kbd', '/'));
    this.themeBtn = btn('', () => this.setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'), { ic: 'sun', title: 'Alternar tema', kind: 'ghost' });
    this.setTheme(document.documentElement.dataset.theme, false);
    const menuBtn = btn('', () => this.sidebar.classList.toggle('open'), { ic: 'menu', title: 'Menu', kind: 'ghost' }); menuBtn.classList.add('menu-btn');
    this.createBtn = btn('Criar', e => this.quickCreate(e.currentTarget), { ic: 'plus', kind: 'primary', title: 'Criar (atalho: N)' });
    const top = h('header.topbar', menuBtn,
      h('a.brand', { href: '#/', 'aria-label': 'Fiction Studio — início' }, h('span.brand-mark', icon('sparkles', 15)), h('span.brand-name', 'Fiction Studio')),
      h('span.crumbs-sep', { style: { width: '6px' } }), this.crumbs, h('span.spacer'), this.searchWrap, this.createBtn, this.statusEl, this.themeBtn);
    this.sidebar = h('nav.sidebar', { 'aria-label': 'Navegação' });
    this.main = h('main.main', { id: 'main' });
    this.root.append(top, h('div.shell', this.sidebar, this.main));
  },
  renderStatus({ status, detail }) {
    this.statusEl.className = 'savestate ' + status;
    this.statusEl.lastChild.textContent = { saved: 'Salvo', saving: 'Salvando…', dirty: 'Pendente', error: 'Erro ao salvar' }[status] || status;
    this.statusEl.title = detail || (status === 'saved' ? 'Tudo gravado neste navegador' : '');
  },
  parse() { return location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent); },
  onKey(e) {
    const a = document.activeElement;
    const typing = a && (a.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName));
    if (this.keyHandler) { this.keyHandler(e); if (e.defaultPrevented) return; }
    if (typing || Modal.stack.length || Menu.current || e.altKey) return;
    if (e.key === '/' || (e.key.toLowerCase() === 'k' && (e.ctrlKey || e.metaKey))) { if (Store.S.p) { e.preventDefault(); this.searchIn.focus(); this.searchIn.select(); } }
    else if (e.key.toLowerCase() === 'n' && !e.ctrlKey && !e.metaKey) { e.preventDefault(); this.quickCreate(this.createBtn); }
  },
  async route() {
    for (const fn of this._leave.splice(0)) { try { fn(); } catch (err) { console.error(err); } }
    if (this._lastView) this._scroll.set(this._lastView, this.main.scrollTop);
    this.keyHandler = null; this.pasteHandler = null; this._headerRenderer = null; Menu.close();
    const parts = this.parse();
    this.sidebar.classList.remove('open');
    if (parts[0] !== 'p') {
      if (Store.S.p) { await Store.flush(); Store.closeProject(); }
      this.current = parts; this.searchWrap.hidden = true;
      this.renderSidebar(); this.renderCrumbs();
      clear(this.main);
      const v = parts[0] || '';
      try {
        if (v === 'projects') await Views.dashboard(this.main);
        else if (v === 'library') await Views.globalLibrary(this.main);
        else if (v === 'templates') await Views.templates(this.main);
        else if (v === 'settings') await Views.appSettings(this.main);
        else await Views.home(this.main);
      } catch (err) { console.error(err); this.main.appendChild(h('div.page', h('div.notice.err', 'Erro ao exibir esta tela: ' + err.message))); }
      document.title = 'Fiction Studio';
      this.restoreScroll();
      return;
    }
    const pid = parts[1];
    if (!Store.S.p || Store.S.p.id !== pid) {
      const p = await Store.openProject(pid);
      if (!p) { Toast.warn('Projeto não encontrado.'); Nav.go('/projects'); return; }
    }
    this.searchWrap.hidden = false;
    this.current = parts.slice(2);
    if (this.current[0] === 'library') this.current = ['refs', 'library'];
    if (this.current[0] === 'moodboards') this.current = ['refs'];
    document.title = Store.S.p.name + ' — Fiction Studio';
    this.renderSidebar(); this.renderCrumbs();
    clear(this.main);
    try { this.renderView(this.current); }
    catch (e) { console.error(e); this.main.appendChild(h('div.page', h('div.notice.err', 'Erro ao exibir esta tela: ' + e.message))); }
    this.restoreScroll();
  },
  restoreScroll() {
    const key = location.hash; const y = this._scroll.get(key);
    this.main.scrollTop = 0;
    if (y) requestAnimationFrame(() => { this.main.scrollTop = y; });
    this._lastView = key;
  },
  renderView(parts) {
    const [sec, a, b] = parts;
    const m = this.main;
    switch (sec || '') {
      case '': return Views.overview(m);
      case 'characters': return Views.list(m, 'character');
      case 'locations': return Views.list(m, 'location');
      case 'storylines': return Views.list(m, 'storyline');
      case 'events': return Views.list(m, 'event');
      case 'organizations': return Views.list(m, 'organization');
      case 'timeline': return Views.timeline(m);
      case 'refs': return Views.refs(m, a || 'boards');
      case 'graph': return Views.graph(m, a || 'all', b || null);
      case 'notes': return Views.notes(m);
      case 'settings': return Views.settings(m, a || 'general');
      case 'search': return Views.search(m);
      case 'mech': return Views.mech(m, a || 'overview');
      case 'e': return Views.entity(m, a, b);
      default: return Views.overview(m);
    }
  },
  refresh() { this.route(); },
  refreshHeader() { if (this._headerRenderer) this._headerRenderer(); },
  /* Trilha: Projeto › Seção › Registro */
  renderCrumbs() {
    clear(this.crumbs);
    const parts = this.current || [];
    const items = [];
    const sep = () => h('span.sep', { 'aria-hidden': 'true' }, icon('right', 13));
    if (!Store.S.p) {
      const g = { '': 'Início', projects: 'Projetos', library: 'Biblioteca de referências', templates: 'Modelos', settings: 'Configurações' }[parts[0] || ''];
      items.push(['#/' + (parts[0] || ''), g || 'Início']);
    } else {
      const p = Store.S.p; const base = '#/p/' + p.id;
      items.push(['#/projects', 'Projetos'], [base, p.name]);
      const [sec, a] = parts;
      if (sec === 'e') {
        const e = Store.get(a);
        if (e) {
          const s = KIND_SECTION[e.kind] || '';
          const top = s.split('/')[0];
          items.push([base + '/' + top, SECTION_LABELS[top] || Schema.kindLabel(e.kind, true)]);
          if (top === 'mech') items.push([base + '/' + s, Schema.kindLabel(e.kind, true)]);
          items.push([base + '/e/' + e.id, e.name]);
        }
      } else if (sec) {
        items.push([base + '/' + sec, SECTION_LABELS[sec] || sec]);
        if (sec === 'mech' && a) { const m = MECH_SUBS.find(x => x[0] === a); if (m && a !== 'overview') items.push([base + '/mech/' + a, m[1]]); }
      }
    }
    items.forEach(([href, label], i) => { if (i) this.crumbs.appendChild(sep()); this.crumbs.appendChild(h('a', { href, 'aria-current': i === items.length - 1 ? 'page' : null }, label)); });
  },
  /* Criação rápida, de acordo com o contexto */
  quickCreate(anchor) {
    const p = Store.S.p;
    const parts = this.current || [];
    const cur = p && parts[0] === 'e' ? Store.get(parts[1]) : null;
    const link = cur && Schema.NARRATIVE_KINDS.includes(cur.kind) ? cur : null;
    const evFieldFor = { character: 'characterIds', location: 'locationIds', storyline: 'storylineIds' };
    const items = [{ label: 'Projeto', ic: 'folder', onClick: () => projectForm() }];
    if (p) {
      items.push({ sep: true }, { header: 'Em ' + p.name },
        { label: 'Personagem', ic: 'user', onClick: () => quickCreate('character') },
        { label: 'Localidade', ic: 'pin', onClick: () => quickCreate('location', '', { fields: link && link.kind === 'location' ? { parentId: link.id } : {} }), hint: link && link.kind === 'location' ? 'dentro de ' + link.name : null },
        { label: 'Storyline', ic: 'book', onClick: () => quickCreate('storyline', '', { fields: link && link.kind === 'character' ? { characterIds: [link.id] } : {} }) },
        { label: 'Evento', ic: 'bolt', onClick: () => quickCreate('event', '', { fields: link && evFieldFor[link.kind] ? { [evFieldFor[link.kind]]: [link.id] } : {} }), hint: link && evFieldFor[link.kind] ? 'ligado a ' + link.name : null },
        p.config.modules.organizations ? { label: 'Organização', ic: 'org', onClick: () => quickCreate('organization') } : null,
        { label: 'Moodboard', ic: 'moodboard', onClick: () => link ? Boards.createFor(link) : Boards.create(), hint: link ? 'para ' + link.name : null },
        { label: 'Nota', ic: 'note', onClick: () => quickCreate('lore') },
        p.mechanics.enabled ? { sep: true } : null,
        p.mechanics.enabled ? { label: 'Habilidade', ic: 'sword', onClick: () => quickCreate('skill') } : null,
        p.mechanics.enabled ? { label: 'Árvore de habilidades', ic: 'tree', onClick: () => quickCreate('skilltree') } : null);
    } else items.push({ sep: true }, { label: 'Abra um projeto para criar personagens, moodboards e mais', ic: 'info', disabled: true });
    Menu.open(anchor, items, { align: 'end' });
  },
  renderSidebar() {
    if (!this.sidebar) return;
    const p = Store.S.p;
    const [sec, a] = this.current || [];
    const curEnt = p && sec === 'e' ? Store.get(a) : null;
    const activeKey = curEnt ? (KIND_SECTION[curEnt.kind] || '') : (sec || '') + (sec === 'mech' && a ? '/' + a : '');
    const collapsed = !!Store.ui().sidebarCollapsed;
    clear(this.sidebar);
    const link = (href, key, label, ic, { count = null, kind = null, sub = false, match = null } = {}) => {
      const active = match ? match(activeKey) : activeKey === key;
      const i = icon(ic); if (kind) { i.style.color = kc(kind); }
      return h('a.navlink' + (active ? '.active' : '') + (sub ? '.sub' : ''), { href, title: collapsed ? label : null, 'aria-current': active ? 'page' : null }, i, h('span', label), count != null && count !== 0 ? h('span.count', String(count)) : null);
    };
    const out = [];
    if (p) {
      const base = '#/p/' + p.id + '/';
      const cover = h('div.side-cover', icon('book', 18));
      if (p.coverImageId && Store.S.imgs.get(p.coverImageId)) { clear(cover); cover.appendChild(h('img', { src: Store.imgURL(Store.S.imgs.get(p.coverImageId)), alt: '' })); }
      const n = k => Store.list(k).length;
      const inMech = activeKey.startsWith('mech');
      out.push(
        h('div.side-head', { title: collapsed ? p.name : null }, cover, h('div', { style: { minWidth: 0 } }, h('div.side-title', p.name), h('div.side-sub', p.workType))),
        link(base, '', 'Visão geral', 'home'),
        h('div.side-group', h('span.lbl', 'Universo')),
        link(base + 'characters', 'characters', 'Personagens', 'user', { count: n('character'), kind: 'character' }),
        link(base + 'locations', 'locations', 'Localidades', 'pin', { count: n('location'), kind: 'location' }),
        link(base + 'storylines', 'storylines', 'Storylines', 'book', { count: n('storyline'), kind: 'storyline' }),
        link(base + 'events', 'events', 'Eventos', 'bolt', { count: n('event'), kind: 'event' }),
        p.config.modules.organizations ? link(base + 'organizations', 'organizations', 'Organizações', 'org', { count: n('organization'), kind: 'organization' }) : null,
        h('div.side-group', h('span.lbl', 'Visualizar')),
        link(base + 'graph', 'graph', 'Grafo do universo', 'graph', { match: k => k.startsWith('graph') }),
        link(base + 'timeline', 'timeline', 'Cronologia', 'clock'),
        link(base + 'refs', 'refs', 'Moodboards e referências', 'moodboard', { count: n('moodboard') || null, match: k => k.startsWith('refs') }),
        h('div.side-group', h('span.lbl', 'Sistemas')),
        link(base + 'mech', 'mech', 'Sistemas de RPG', 'gamepad', { match: k => k.startsWith('mech') }),
        p.mechanics.enabled && inMech && !collapsed ? MECH_SUBS.filter(([id, , , mod]) => id !== 'overview' && (!mod || p.mechanics.modules[mod] !== false)).map(([id, l, ic]) => {
          const kind = MECH_KIND_BY_SUB[id] || (id === 'effects' ? 'effect' : null);
          return link(base + 'mech/' + id, 'mech/' + id, l, ic, { sub: true, count: kind ? n(kind) : (id === 'attributes' ? p.mechanics.attributes.length : null) });
        }) : null,
        link(base + 'notes', 'notes', 'Notas e documentação', 'note', { count: n('lore') }),
        link(base + 'settings', 'settings', 'Configurações do projeto', 'gear'),
        h('div.side-group', h('span.lbl', 'Estúdio')),
      );
    }
    const g = !p ? (this.current || [])[0] || '' : null;
    out.push(
      !p ? h('div.side-group', { style: { marginTop: '4px' } }, h('span.lbl', 'Estúdio')) : null,
      h('a.navlink' + (g === '' ? '.active' : ''), { href: '#/', title: collapsed ? 'Início' : null }, icon('home'), h('span', 'Início')),
      h('a.navlink' + (g === 'projects' ? '.active' : ''), { href: '#/projects', title: collapsed ? 'Projetos' : null }, icon('folder'), h('span', 'Projetos')),
      h('a.navlink' + (g === 'library' ? '.active' : ''), { href: '#/library', title: collapsed ? 'Biblioteca de referências' : null }, icon('library'), h('span', 'Biblioteca de referências')),
      h('a.navlink' + (g === 'templates' ? '.active' : ''), { href: '#/templates', title: collapsed ? 'Modelos' : null }, icon('template'), h('span', 'Modelos')),
      h('a.navlink' + (g === 'settings' ? '.active' : ''), { href: '#/settings', title: collapsed ? 'Configurações' : null }, icon('gear'), h('span', 'Configurações')),
      h('div.side-collapse', h('button.navlink.collapse-btn', { type: 'button', title: collapsed ? 'Expandir barra lateral' : 'Recolher barra lateral', 'aria-label': collapsed ? 'Expandir barra lateral' : 'Recolher barra lateral', onclick: () => this.setCollapsed(!collapsed) }, icon('panel'), h('span', 'Recolher'))));
    appendKids(this.sidebar, out);
  },
};

/* Rotas das seções mecânicas */
KIND_SECTION.skill = 'mech/skills'; KIND_SECTION.passive = 'mech/passives'; KIND_SECTION.class = 'mech/classes';
KIND_SECTION.item = 'mech/items'; KIND_SECTION.effect = 'mech/effects'; KIND_SECTION.skilltree = 'mech/trees';

document.addEventListener('DOMContentLoaded', () => App.start());
