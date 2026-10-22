/* Fiction Studio — exportação/importação (.fsproj.zip), duplicação de projetos e modelos mecânicos. */
'use strict';

const IO = (() => {
  const FORMAT = 'fiction-studio/project';
  const VERSION = 1;

  function extOf(mime) {
    return ({ 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif', 'image/svg+xml': 'svg', 'image/avif': 'avif' })[mime] || 'bin';
  }

  async function loadProjectData(pid) {
    await Store.flush();
    const project = await DB.get('projects', pid);
    const entities = await DB.byProject('entities', pid);
    const relations = await DB.byProject('relations', pid);
    const images = await DB.byProject('images', pid);
    if (project.coverImageId) {
      const cov = await DB.get('images', project.coverImageId);
      if (cov && !images.find(i => i.id === cov.id)) images.push(cov);
    }
    return { project, entities, relations, images };
  }

  function usedTagIds(data) {
    const ids = new Set(data.project.tags || []);
    for (const e of data.entities) (e.tags || []).forEach(t => ids.add(t));
    for (const i of data.images) (i.tags || []).forEach(t => ids.add(t));
    for (const r of data.relations) (r.tags || []).forEach(t => ids.add(t));
    return [...ids];
  }

  async function exportProject(pid) {
    const data = await loadProjectData(pid);
    const files = [];
    const imagesMeta = [];
    for (const img of data.images) {
      const meta = { ...img }; delete meta.blob; delete meta.thumb; delete meta.preview; delete meta._noPreview;
      if (img.blob instanceof Blob) { meta.file = 'images/' + img.id + '.' + extOf(img.blob.type || img.mime); files.push({ name: meta.file, data: img.blob, compress: false }); }
      if (img.thumb instanceof Blob) { meta.thumbFile = 'images/' + img.id + '_thumb.jpg'; files.push({ name: meta.thumbFile, data: img.thumb, compress: false }); }
      imagesMeta.push(meta);
    }
    const manifest = {
      format: FORMAT, version: VERSION, app: 'Fiction Studio', exportedAt: new Date().toISOString(),
      project: data.project, entities: data.entities, relations: data.relations, images: imagesMeta,
      tags: usedTagIds(data).map(id => Store.S.tags.get(id)).filter(Boolean),
    };
    files.unshift({ name: 'project.json', data: JSON.stringify(manifest, null, 1) });
    files.push({ name: 'LEIA-ME.txt', data: 'Exportação do Fiction Studio.\nproject.json contém os registros (formato ' + FORMAT + ' v' + VERSION + ').\nA pasta images/ contém as imagens originais e as miniaturas.\nPara restaurar: Dashboard → Importar projeto.\n' });
    const blob = await Zip.create(files);
    U.download(blob, U.slug(data.project.name) + '.fsproj.zip');
    return blob.size;
  }

  /* Gera novos ids para tudo que é chave no banco e substitui as ocorrências exatas em profundidade. */
  function remapIds(data, tagMap = {}) {
    const map = { ...tagMap };
    map[data.project.id] = U.id('p');
    for (const e of data.entities) map[e.id] = U.id((e.kind || 'ent').slice(0, 3));
    for (const r of data.relations) map[r.id] = U.id('r');
    for (const i of data.images) map[i.id] = U.id('img');
    const walk = (v) => {
      if (typeof v === 'string') return Object.prototype.hasOwnProperty.call(map, v) ? map[v] : v;
      if (Array.isArray(v)) return v.map(walk);
      if (v instanceof Blob) return v;
      if (v && typeof v === 'object') {
        const o = {};
        for (const [k, x] of Object.entries(v)) {
          // chaves de objeto também podem ser ids (ex.: graphPositions)
          const nk = Object.prototype.hasOwnProperty.call(map, k) ? map[k] : k;
          o[nk] = walk(x);
        }
        return o;
      }
      return v;
    };
    return {
      project: walk(data.project),
      entities: data.entities.map(walk),
      relations: data.relations.map(walk),
      images: data.images.map(walk),
    };
  }

  async function writeProjectData(d) {
    const writes = [{ store: 'projects', op: 'put', value: d.project }];
    for (const e of d.entities) writes.push({ store: 'entities', op: 'put', value: e });
    for (const r of d.relations) writes.push({ store: 'relations', op: 'put', value: r });
    for (const i of d.images) writes.push({ store: 'images', op: 'put', value: i });
    await DB.batch(writes);
  }

  async function duplicateProject(pid) {
    const data = await loadProjectData(pid);
    const d = remapIds(data);
    d.project.name = data.project.name + ' (cópia)';
    d.project.createdAt = d.project.updatedAt = U.now();
    d.project.archived = false;
    for (const x of [...d.entities, ...d.relations, ...d.images]) x.projectId = d.project.id;
    await writeProjectData(d);
    return d.project;
  }

  /* Valida o manifesto. Retorna {errors, warnings, manifest} */
  function validate(m) {
    const errors = [], warnings = [];
    if (!m || typeof m !== 'object') { errors.push('project.json não contém um objeto.'); return { errors, warnings }; }
    if (m.format !== FORMAT) errors.push('Formato desconhecido ("' + (m.format || 'sem formato') + '"). Esperado: ' + FORMAT + '.');
    if (typeof m.version !== 'number' || m.version > VERSION) errors.push('Versão ' + m.version + ' não é suportada por esta versão do aplicativo.');
    if (!m.project || typeof m.project.id !== 'string' || !m.project.name) errors.push('Projeto sem identificador ou nome.');
    for (const k of ['entities', 'relations', 'images']) if (!Array.isArray(m[k])) errors.push('Lista "' + k + '" ausente ou inválida.');
    if (errors.length) return { errors, warnings };
    const ids = new Set();
    m.entities = m.entities.filter(e => {
      if (!e || typeof e.id !== 'string' || !Schema.KINDS[e.kind]) { warnings.push('Registro inválido ignorado (' + ((e && e.name) || 'sem nome') + ').'); return false; }
      if (ids.has(e.id)) { warnings.push('Registro duplicado ignorado: ' + e.name); return false; }
      ids.add(e.id); e.fields = e.fields || {}; e.tags = e.tags || []; e.custom = e.custom || [];
      return true;
    });
    m.relations = m.relations.filter(r => {
      const ok = r && ids.has(r.fromId) && ids.has(r.toId);
      if (!ok) warnings.push('Relação com extremidade inexistente ignorada.');
      return ok;
    });
    for (const i of m.images) { i.links = (i.links || []).filter(l => ids.has(l.entityId)); }
    return { errors, warnings, manifest: m };
  }

  async function readPackage(file) {
    let manifest, entries = null;
    if (/\.json$/i.test(file.name)) manifest = JSON.parse(await file.text());
    else {
      entries = await Zip.read(file);
      const pj = entries.get('project.json');
      if (!pj) throw new Error('O pacote não contém project.json.');
      manifest = JSON.parse(await pj.text());
    }
    const v = validate(manifest);
    return { ...v, entries };
  }

  /* Importa sempre como projeto novo (ids novos), sem sobrescrever nada. */
  async function importPackage(pkg, { rename = null } = {}) {
    const m = pkg.manifest;
    const warnings = [...pkg.warnings];
    // imagens: reconstrói blobs
    for (const img of m.images) {
      try {
        if (img.file && pkg.entries && pkg.entries.get(img.file)) img.blob = new Blob([await pkg.entries.get(img.file).bytes()], { type: img.mime || 'image/jpeg' });
        if (img.thumbFile && pkg.entries && pkg.entries.get(img.thumbFile)) img.thumb = new Blob([await pkg.entries.get(img.thumbFile).bytes()], { type: 'image/jpeg' });
      } catch (e) { warnings.push('Imagem "' + (img.title || img.id) + '" não pôde ser lida: ' + e.message); }
      delete img.file; delete img.thumbFile;
    }
    // tags por nome
    const tagMap = {};
    for (const t of m.tags || []) { if (t && t.id && t.name) tagMap[t.id] = Store.ensureTag(t.name).id; }
    const d = remapIds({ project: m.project, entities: m.entities, relations: m.relations, images: m.images }, tagMap);
    if (rename) d.project.name = rename;
    d.project.updatedAt = U.now();
    for (const x of [...d.entities, ...d.relations, ...d.images]) x.projectId = d.project.id;
    // descarta tags desconhecidas
    const known = id => Store.S.tags.has(id);
    d.project.tags = (d.project.tags || []).filter(known);
    for (const e of d.entities) e.tags = (e.tags || []).filter(known);
    await Store.flush();
    await writeProjectData(d);
    return { project: d.project, warnings, counts: { entities: d.entities.length, relations: d.relations.length, images: d.images.length } };
  }

  /* ---------- modelos de sistema mecânico ---------- */
  const MECH_LIST_KEYS = ['skillCategories', 'passiveCategories', 'passiveActivation', 'itemCategories', 'itemRarities', 'effectPolarity'];
  function templateFromProject(name, description) {
    const p = Store.S.p;
    const entities = Schema.MECH_KINDS.flatMap(k => Store.list(k)).map(e => {
      const c = U.clone(e); delete c.projectId; c.tags = []; c.mainImageId = null; return c;
    });
    const lists = {}; for (const k of MECH_LIST_KEYS) lists[k] = U.clone(p.config.lists[k] || []);
    return { id: U.id('tpl'), name, description, createdAt: U.now(), updatedAt: U.now(), mechanics: U.clone(p.mechanics), lists, entities };
  }
  /* Copia o modelo para o projeto aberto, com ids novos para os registros. Personagens não são tocados. */
  function applyTemplate(tpl, { replace = false } = {}) {
    const p = Store.S.p;
    const mech = U.clone(tpl.mechanics);
    if (replace || !p.mechanics.attributes.length) {
      p.mechanics = { ...Schema.defaultMechanics(), ...mech, enabled: true };
    } else {
      // mescla: acrescenta itens de configuração cujos ids ainda não existem
      for (const key of ['attrCategories', 'attributes', 'variables', 'damageTypes', 'slots', 'nodeTypes', 'rules']) {
        const have = new Set((p.mechanics[key] || []).map(x => x.id));
        p.mechanics[key] = [...(p.mechanics[key] || []), ...(mech[key] || []).filter(x => !have.has(x.id))];
      }
      p.mechanics.enabled = true;
    }
    for (const [k, vals] of Object.entries(tpl.lists || {})) for (const v of vals) Store.addListValue(k, v);
    const map = {}; for (const e of tpl.entities) map[e.id] = U.id(e.kind.slice(0, 3));
    const walk = v => typeof v === 'string' ? (map[v] || v) : Array.isArray(v) ? v.map(walk) : (v && typeof v === 'object') ? Object.fromEntries(Object.entries(v).map(([k, x]) => [map[k] || k, walk(x)])) : v;
    for (const e of tpl.entities) {
      const c = walk(U.clone(e));
      Store.newEntity(c.kind, { ...c, id: map[e.id] });
    }
    Store.saveProject();
    return tpl.entities.length;
  }

  function builtinTemplates() {
    const cat = (id, name) => ({ id, name });
    const at = (id, name, code, categoryId, extra = {}) => ({ id, name, code, categoryId, description: '', icon: '', dataType: 'int', min: 0, max: 99, default: 10, unit: '', derived: false, formula: '', formulaEnabled: true, rounding: 'round', visible: true, highlight: false, combat: true, evolution: '', changeRules: '', options: [], ...extra });
    const fantasy = {
      id: 'tpl_builtin_fantasy', builtin: true, name: 'RPG de fantasia (exemplo)', description: 'Atributos clássicos, recursos derivados, tipos de dano, efeitos e slots. Ponto de partida editável.',
      mechanics: {
        ...Schema.defaultMechanics(), enabled: true,
        attrCategories: [cat('ac_prim', 'Atributos primários'), cat('ac_res', 'Recursos de combate'), cat('ac_off', 'Estatísticas ofensivas'), cat('ac_def', 'Estatísticas defensivas'), cat('ac_soc', 'Atributos sociais')],
        attributes: [
          at('a_str', 'Força', 'FOR', 'ac_prim'), at('a_dex', 'Destreza', 'DES', 'ac_prim'), at('a_int', 'Inteligência', 'INT', 'ac_prim'),
          at('a_vit', 'Vitalidade', 'VIT', 'ac_prim'), at('a_luk', 'Sorte', 'SOR', 'ac_prim'), at('a_cha', 'Carisma', 'CAR', 'ac_soc'),
          at('a_hp', 'Vida máxima', 'HP', 'ac_res', { derived: true, formula: '$a_vit * 20 + nivel * 5', max: 99999, highlight: true }),
          at('a_mp', 'Mana máxima', 'MP', 'ac_res', { derived: true, formula: '$a_int * 15', max: 99999, highlight: true }),
          at('a_patk', 'Dano físico', 'ATQ', 'ac_off', { derived: true, formula: '$a_str * 2 + $a_dex', max: 9999 }),
          at('a_crit', 'Chance crítica', 'CRIT', 'ac_off', { derived: true, formula: 'min($a_luk * 0.5, 75)', dataType: 'percent', unit: '%', rounding: '1', max: 100 }),
          at('a_def', 'Defesa física', 'DEF', 'ac_def', { derived: true, formula: '$a_vit + $a_str / 2', max: 9999 }),
          at('a_corr', 'Nível de corrupção', 'CORR', 'ac_soc', { dataType: 'qualitative', options: ['Baixo', 'Médio', 'Alto', 'Crítico'], default: 'Baixo', combat: false }),
        ],
        variables: [{ id: 'v_movmult', name: 'Multiplicador de movimento', code: 'MULTMOV', value: 1.2 }],
        damageTypes: ['Físico', 'Cortante', 'Perfurante', 'Contundente', 'Fogo', 'Gelo', 'Eletricidade', 'Veneno', 'Sombrio', 'Sagrado', 'Psíquico', 'Dano verdadeiro'].map((n, i) => ({ id: 'dt_' + i, name: n })),
        slots: ['Arma principal', 'Arma secundária', 'Cabeça', 'Peito', 'Mãos', 'Pernas', 'Acessório 1', 'Acessório 2'].map((n, i) => ({ id: 'sl_' + i, name: n })),
        rules: [
          { id: 'ru_dmg', name: 'Dano final', description: 'Dano físico após a defesa do alvo (exemplo com defesa fixa 10).', formula: 'max(1, $a_patk - 10)', textOnly: false },
          { id: 'ru_hit', name: 'Chance de acerto', description: 'Percentual base.', formula: 'clamp(75 + $a_dex - 10, 5, 95)', textOnly: false },
        ],
      },
      lists: {},
      entities: [
        { id: 'tpl_e_fire', kind: 'skill', name: 'Bola de fogo', fields: { iconText: '🔥', category: 'Ataque mágico', cost: '20 MP', cooldown: '2 turnos', range: '8 m', damageTypeId: 'dt_4', multiplier: '1.5 × INT', summary: 'Projétil explosivo.', level: 1, maxLevel: 5 }, levels: [1, 2, 3, 4, 5].map(l => ({ level: l, values: { Efeito: 'Dano de fogo', Multiplicador: (100 + (l - 1) * 25) + '%', Custo: (20 + (l - 1) * 2) + ' MP' } })), evolutions: [{ id: 'ev1', name: 'Chuva de meteoros', description: 'Área maior, mais custo.', requirement: 'Nível 5 + escolher Caminho do Fogo' }], tags: [], custom: [] },
        { id: 'tpl_e_cleave', kind: 'skill', name: 'Golpe giratório', fields: { iconText: '⚔', category: 'Ataque físico', cost: '15 Estamina', cooldown: '1 turno', area: 'Raio 2 m', damageTypeId: 'dt_1', summary: 'Atinge todos ao redor.', level: 1, maxLevel: 3 }, levels: [], evolutions: [], tags: [], custom: [] },
        { id: 'tpl_e_tough', kind: 'passive', name: 'Pele de ferro', fields: { iconText: '🛡', category: 'Defensiva', activation: 'Permanente', summary: 'Defesa +10%.' }, modifiers: [{ attrId: 'a_def', mode: 'percent', value: 10 }], tags: [], custom: [] },
        { id: 'tpl_e_warrior', kind: 'class', name: 'Guerreiro', fields: { summary: 'Combatente corpo a corpo.', skillIds: ['tpl_e_cleave'], passiveIds: ['tpl_e_tough'] }, startAttrs: { a_str: 14, a_vit: 13, a_dex: 10, a_int: 8 }, growth: { a_str: 2, a_vit: 2 }, tags: [], custom: [] },
        { id: 'tpl_e_mage', kind: 'class', name: 'Mago', fields: { summary: 'Usuário de magia arcana.', skillIds: ['tpl_e_fire'] }, startAttrs: { a_int: 15, a_vit: 8, a_str: 7 }, growth: { a_int: 3 }, tags: [], custom: [] },
        { id: 'tpl_e_sword', kind: 'item', name: 'Espada longa', fields: { category: 'Arma', rarity: 'Comum', slotId: 'sl_0', summary: 'Lâmina equilibrada.' }, modifiers: [{ attrId: 'a_str', mode: 'flat', value: 2 }], tags: [], custom: [] },
        { id: 'tpl_e_burn', kind: 'effect', name: 'Queimadura', fields: { iconText: '🔥', polarity: 'Negativo', duration: '3 turnos', perTurn: '5% da vida máxima', stackable: true, maxStacks: 3, removal: 'Água, magia de gelo ou poção' }, modifiers: [{ attrId: 'a_def', mode: 'percent', value: -10 }], tags: [], custom: [] },
      ],
    };
    return [fantasy];
  }
  function allTemplates() { return [...builtinTemplates(), ...Store.S.templates]; }

  return { exportProject, readPackage, importPackage, duplicateProject, remapIds, templateFromProject, applyTemplate, allTemplates, FORMAT, VERSION };
})();
