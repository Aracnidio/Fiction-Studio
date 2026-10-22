/* Fiction Studio — esquema dos tipos de registro, listas padrão e tipos de relação.
   Tudo aqui é ponto de partida: listas e rótulos são copiados para cada projeto e podem ser editados. */
'use strict';

const Schema = (() => {
  const T = (key, label, extra = {}) => ({ key, label, type: 'text', ...extra });
  const A = (key, label, extra = {}) => ({ key, label, type: 'textarea', ...extra });
  const SEL = (key, label, list, extra = {}) => ({ key, label, type: 'select', list, ...extra });
  const REF = (key, label, kind, edge, extra = {}) => ({ key, label, type: 'ref', kind, edge, ...extra });
  const REFS = (key, label, kind, edge, extra = {}) => ({ key, label, type: 'refs', kind, edge, ...extra });

  const KINDS = {
    character: {
      label: 'Personagem', plural: 'Personagens', icon: 'user', color: '#A78BFA', galleryCats: 'imgCatCharacter', refs: true,
      sections: [
        { id: 'basic', tab: 'overview', title: 'Identidade', open: true, fields: [
          T('surname', 'Sobrenome'), T('fullName', 'Nome completo'), T('nicknames', 'Apelidos'), T('titles', 'Títulos'),
          T('age', 'Idade'), T('birthDate', 'Data de nascimento'), T('gender', 'Gênero ou identidade'),
          T('species', 'Espécie ou raça'), T('nationality', 'Nacionalidade'),
          REF('originId', 'Local de origem', 'location', { label: 'é originário(a) de', cat: 'geografia' }),
          T('occupation', 'Ocupação ou profissão'), T('narrativeFunction', 'Função narrativa'),
          SEL('storyRole', 'Papel na história', 'storyRoles'),
          REFS('orgIds', 'Grupo, facção ou organização', 'organization', { label: 'pertence a', cat: 'organizacao' }),
          SEL('status', 'Status do personagem', 'characterStatus'),
          A('summary', 'Descrição resumida', { wide: true }), A('bio', 'Biografia completa', { wide: true, rows: 8 }),
        ] },
        { id: 'look', tab: 'aparencia', title: 'Aparência física', open: true, fields: [
          T('height', 'Altura'), T('build', 'Constituição física'), T('skin', 'Tom de pele'), T('eyes', 'Cor dos olhos'),
          T('hairColor', 'Cor do cabelo'), T('hairLength', 'Comprimento do cabelo'), T('hairStyle', 'Estilo do cabelo'),
          T('faceShape', 'Formato do rosto'), A('facialFeatures', 'Traços faciais'), A('clothing', 'Vestimentas'),
          A('accessories', 'Acessórios'), A('marks', 'Marcas, cicatrizes e tatuagens'), A('distinctive', 'Características distintivas'),
          A('posture', 'Postura e linguagem corporal'), A('expressions', 'Expressões faciais características'),
          A('appearancePhases', 'Aparência em diferentes fases da história', { wide: true }),
          A('visualDescription', 'Descrição visual livre', { wide: true, rows: 6, hint: 'Como você imagina o personagem.' }),
        ] },
        { id: 'mind', tab: 'personalidade', title: 'Personalidade e psicologia', open: true, fields: [
          A('traits', 'Traços de personalidade'), A('qualities', 'Qualidades'), A('flaws', 'Defeitos'), A('virtues', 'Virtudes'),
          A('fears', 'Medos'), A('desires', 'Desejos'), A('goals', 'Objetivos'), A('motivations', 'Motivações'),
          A('insecurities', 'Inseguranças'), A('values', 'Valores'), A('beliefs', 'Crenças'), A('contradictions', 'Contradições internas'),
          A('habits', 'Hábitos'), A('mannerisms', 'Maneirismos'), A('socialSkills', 'Habilidades sociais'),
          A('relationWorld', 'Relação com o mundo'), A('relationSelf', 'Relação consigo mesmo'), A('secrets', 'Segredos'),
          A('innerConflicts', 'Conflitos internos'), A('arc', 'Arco de desenvolvimento', { wide: true }),
          A('quotes', 'Frases marcantes', { wide: true }), A('dialogueExamples', 'Exemplos de diálogo', { wide: true, rows: 5 }),
          A('speechNotes', 'Como fala e se comporta', { wide: true }),
        ] },
        { id: 'story', tab: 'historia', title: 'História e função narrativa', open: true, fields: [
          A('past', 'Passado'), A('childhood', 'Infância'), A('familyOrigin', 'Família de origem'), A('keyEvents', 'Acontecimentos importantes'),
          A('education', 'Formação'), A('trauma', 'Experiências traumáticas (se pertinentes)'), A('initialGoal', 'Objetivo inicial'),
          A('finalGoal', 'Objetivo final'), A('mainConflict', 'Conflito principal'), A('obstacles', 'Obstáculos'),
          A('evolution', 'Evolução ao longo da obra'), A('plotRole', 'Participação no enredo'), A('relationProtagonist', 'Relação com o protagonista'),
          A('roleStart', 'Papel no início'), A('roleMiddle', 'Papel no desenvolvimento'), A('roleEnd', 'Papel no final'),
        ] },
        { id: 'places', tab: 'overview', title: 'Lugares', fields: [
          REFS('residenceIds', 'Vive em', 'location', { label: 'vive em', cat: 'geografia' }),
          REFS('visitedIds', 'Visitou', 'location', { label: 'visitou', cat: 'geografia' }),
        ] },
        { id: 'spoilers', tab: 'historia', title: 'Spoilers e informações reservadas', spoiler: true, fields: [
          A('spoilers', 'Spoilers', { wide: true, rows: 6, hint: 'Ficam ocultos até você clicar para revelar.' }),
        ] },
        { id: 'notes', tab: 'notas', title: 'Notas do autor', open: true, fields: [
          A('privateNotes', 'Observações privadas do autor', { wide: true, rows: 8, private: true }),
        ] },
      ],
    },
    location: {
      label: 'Localidade', plural: 'Localidades', icon: 'pin', color: '#2DD4BF', galleryCats: 'imgCatLocation', refs: true,
      sections: [
        { id: 'basic', tab: 'overview', title: 'Informações gerais', open: true, fields: [
          T('altName', 'Nome alternativo'), SEL('locType', 'Tipo de localidade', 'locationTypes'),
          REF('parentId', 'Faz parte de / localizada em', 'location', { label: 'faz parte de', cat: 'geografia' }),
          REF('controlledById', 'Controlada por', 'organization', { label: 'é controlada por', cat: 'organizacao' }),
          REFS('orgIds', 'Organizações presentes', 'organization', { label: 'abriga', cat: 'organizacao' }),
          T('condition', 'Condição atual'),
          A('summary', 'Descrição resumida', { wide: true }), A('description', 'Descrição completa', { wide: true, rows: 6 }),
          A('history', 'História', { wide: true }), A('importance', 'Importância narrativa', { wide: true }),
        ] },
        { id: 'env', tab: 'ambiente', title: 'Características do ambiente', open: true, fields: [
          A('geography', 'Geografia'), A('climate', 'Clima'), A('vegetation', 'Vegetação'), A('architecture', 'Arquitetura'),
          A('lighting', 'Iluminação'), T('palette', 'Paleta de cores'), A('sounds', 'Sons característicos'), A('atmosphere', 'Atmosfera'),
          A('culture', 'Cultura'), T('population', 'População'), T('languages', 'Idiomas'), A('economy', 'Economia'), A('politics', 'Política'),
          A('religion', 'Religião ou crenças'), A('technology', 'Tecnologia'), A('security', 'Segurança'),
          A('supernatural', 'Elementos sobrenaturais'), A('visualDetails', 'Detalhes visuais importantes', { wide: true }),
        ] },
        { id: 'changes', tab: 'historico', title: 'Histórico ao longo da narrativa', open: true, fields: [
          A('changes', 'Alterações importantes no ambiente', { wide: true }), A('timelineNotes', 'Histórico do local na narrativa', { wide: true }),
        ] },
        { id: 'notes', tab: 'notas', title: 'Observações', open: true, fields: [A('notes', 'Observações', { wide: true, rows: 8 })] },
      ],
    },
    storyline: {
      label: 'Storyline', plural: 'Storylines', icon: 'book', color: '#60A5FA', galleryCats: 'imgCatStoryline', refs: true,
      sections: [
        { id: 'basic', tab: 'overview', title: 'Informações gerais', open: true, fields: [
          SEL('slType', 'Tipo de storyline', 'storylineTypes'), SEL('status', 'Status', 'storylineStatus'),
          T('theme', 'Tema'), T('genre', 'Gênero'), T('startPlanned', 'Início previsto'), T('endPlanned', 'Conclusão prevista'),
          A('summary', 'Descrição', { wide: true }), A('synopsis', 'Sinopse', { wide: true, rows: 6 }),
          A('objective', 'Objetivo narrativo'), A('conflict', 'Conflito central'),
          REFS('characterIds', 'Personagens envolvidos', 'character', { label: 'envolve', cat: 'storyline' }),
          REFS('locationIds', 'Localidades envolvidas', 'location', { label: 'utiliza', cat: 'storyline' }),
        ] },
        { id: 'notes', tab: 'notas', title: 'Observações', open: true, fields: [A('notes', 'Observações', { wide: true, rows: 8 })] },
      ],
    },
    event: {
      label: 'Evento', plural: 'Eventos', icon: 'bolt', color: '#F5A524', galleryCats: 'imgCatEvent', refs: true,
      sections: [
        { id: 'basic', tab: 'overview', title: 'Informações gerais', open: true, fields: [
          SEL('evType', 'Tipo', 'eventTypes'), SEL('status', 'Estado do evento', 'eventStatus'),
          T('chronoLabel', 'Momento cronológico', { hint: 'Texto livre: "Ano 1203", "Infância de Aria", "Dia 3".' }),
          { key: 'chronoOrder', label: 'Posição na cronologia do universo', type: 'number', hint: 'Número para ordenar. Pode usar decimais.' },
          { key: 'narrativeOrder', label: 'Ordem de apresentação ao público', type: 'number', hint: 'Em que ponto o leitor/jogador vê este evento.' },
          T('chapter', 'Capítulos, cenas ou rotas'),
          A('summary', 'Descrição', { wide: true, rows: 5 }),
          REFS('characterIds', 'Personagens envolvidos', 'character', { label: 'envolve', cat: 'evento' }),
          REFS('locationIds', 'Localidades', 'location', { label: 'ocorre em', cat: 'evento' }),
          REFS('storylineIds', 'Storylines', 'storyline', { label: 'faz parte de', cat: 'evento' }),
          REFS('causeEventIds', 'Eventos que o causam', 'event', { label: 'é causado por', cat: 'evento' }),
          A('causes', 'Causas'), A('consequences', 'Consequências'),
        ] },
        { id: 'notes', tab: 'notas', title: 'Observações', open: true, fields: [A('notes', 'Observações', { wide: true, rows: 8 })] },
      ],
    },
    organization: {
      label: 'Organização', plural: 'Organizações', icon: 'org', color: '#818CF8', galleryCats: 'imgCatOrganization', refs: true,
      sections: [
        { id: 'basic', tab: 'overview', title: 'Informações gerais', open: true, fields: [
          SEL('orgType', 'Tipo', 'orgTypes'),
          REF('leaderId', 'Liderança', 'character', { label: 'é liderada por', cat: 'organizacao' }),
          REF('baseId', 'Sede', 'location', { label: 'tem sede em', cat: 'organizacao' }),
          A('summary', 'Descrição resumida', { wide: true }), A('goals', 'Objetivos'), A('history', 'História'),
        ] },
        { id: 'notes', tab: 'notas', title: 'Observações', open: true, fields: [A('notes', 'Observações', { wide: true, rows: 8 })] },
      ],
    },
    lore: {
      label: 'Anotação', plural: 'Anotações', icon: 'note', color: '#A1A1B5',
      sections: [
        { id: 'basic', tab: 'overview', title: 'Conteúdo', open: true, fields: [
          SEL('category', 'Categoria', 'loreCategories'),
          A('content', 'Texto', { wide: true, rows: 16 }),
        ] },
      ],
    },
    /* Módulo mecânico */
    skill: {
      label: 'Habilidade ativa', plural: 'Habilidades ativas', icon: 'sword', color: '#E879F9', mech: true,
      sections: [
        { id: 'basic', tab: 'overview', title: 'Ficha da habilidade', open: true, fields: [
          T('iconText', 'Ícone (emoji ou símbolo)'), SEL('category', 'Categoria', 'skillCategories'), T('skillType', 'Tipo de habilidade'),
          A('summary', 'Descrição', { wide: true }), A('effect', 'Efeito principal', { wide: true }),
          T('cost', 'Custo de utilização'), T('cooldown', 'Tempo de recarga'), T('range', 'Alcance'), T('area', 'Área de efeito'),
          T('duration', 'Duração'), { key: 'damageTypeId', label: 'Tipo de dano', type: 'mechlist', list: 'damageTypes' },
          T('multiplier', 'Multiplicador de dano'), A('extraEffects', 'Efeitos adicionais'),
          T('animation', 'Animação ou referência visual'), T('sfx', 'Efeitos sonoros'),
          { key: 'level', label: 'Nível da habilidade', type: 'number' }, { key: 'maxLevel', label: 'Limite de evolução', type: 'number' },
          A('requirementsText', 'Requisitos (descrição)'),
          REFS('prereqSkillIds', 'Depende de (habilidades)', 'skill', { label: 'depende de', cat: 'mecanica' }),
        ] },
        { id: 'notes', tab: 'notas', title: 'Observações', open: true, fields: [A('notes', 'Observações', { wide: true, rows: 8 })] },
      ],
    },
    passive: {
      label: 'Habilidade passiva', plural: 'Habilidades passivas', icon: 'shield', color: '#C084FC', mech: true,
      sections: [
        { id: 'basic', tab: 'overview', title: 'Ficha da passiva', open: true, fields: [
          T('iconText', 'Ícone (emoji ou símbolo)'), SEL('category', 'Categoria', 'passiveCategories'),
          { key: 'activation', label: 'Funcionamento', type: 'select', list: 'passiveActivation' },
          A('summary', 'Descrição', { wide: true }), A('effect', 'Efeito', { wide: true }),
          A('condition', 'Condições de ativação'), A('requirementsText', 'Requisitos'), T('duration', 'Duração'),
          REFS('compatibleIds', 'Compatível com', 'passive', { label: 'combina com', cat: 'mecanica' }),
          REFS('conflictIds', 'Conflita com', 'passive', { label: 'conflita com', cat: 'mecanica' }),
          T('origin', 'Origem da habilidade'),
        ] },
        { id: 'notes', tab: 'notas', title: 'Observações', open: true, fields: [A('notes', 'Observações', { wide: true, rows: 8 })] },
      ],
    },
    class: {
      label: 'Classe', plural: 'Classes', icon: 'crown', color: '#F0ABFC', mech: true,
      sections: [
        { id: 'basic', tab: 'overview', title: 'Ficha da classe', open: true, fields: [
          REF('parentClassId', 'Subclasse / especialização de', 'class', { label: 'é especialização de', cat: 'mecanica' }),
          A('summary', 'Descrição', { wide: true }),
          REFS('skillIds', 'Habilidades disponíveis', 'skill', { label: 'oferece', cat: 'mecanica' }),
          REFS('exclusiveSkillIds', 'Habilidades exclusivas', 'skill', { label: 'tem exclusiva', cat: 'mecanica' }),
          REFS('passiveIds', 'Passivas próprias', 'passive', { label: 'concede', cat: 'mecanica' }),
          REFS('itemIds', 'Equipamentos permitidos', 'item', { label: 'pode usar', cat: 'mecanica' }),
          REF('treeId', 'Árvore de habilidades', 'skilltree', { label: 'usa a árvore', cat: 'mecanica' }),
          A('requirementsText', 'Requisitos'), A('restrictions', 'Restrições'), A('progressionRules', 'Regras de progressão', { wide: true }),
        ] },
        { id: 'notes', tab: 'notas', title: 'Observações', open: true, fields: [A('notes', 'Observações', { wide: true, rows: 8 })] },
      ],
    },
    item: {
      label: 'Equipamento ou item', plural: 'Equipamentos e itens', icon: 'gem', color: '#F5C76A', mech: true,
      sections: [
        { id: 'basic', tab: 'overview', title: 'Ficha do item', open: true, fields: [
          SEL('category', 'Categoria', 'itemCategories'), SEL('rarity', 'Raridade', 'itemRarities'),
          { key: 'slotId', label: 'Slot de equipamento', type: 'mechlist', list: 'slots' },
          A('summary', 'Descrição', { wide: true }),
          REFS('passiveIds', 'Passivas concedidas', 'passive', { label: 'concede', cat: 'mecanica' }),
          REFS('skillIds', 'Habilidades concedidas', 'skill', { label: 'concede', cat: 'mecanica' }),
          A('requirementsText', 'Requisitos'),
        ] },
        { id: 'notes', tab: 'notas', title: 'Observações', open: true, fields: [A('notes', 'Observações', { wide: true, rows: 8 })] },
      ],
    },
    effect: {
      label: 'Efeito de status', plural: 'Efeitos de status', icon: 'flame', color: '#FB923C', mech: true,
      sections: [
        { id: 'basic', tab: 'overview', title: 'Ficha do efeito', open: true, fields: [
          T('iconText', 'Ícone (emoji ou símbolo)'), SEL('polarity', 'Natureza', 'effectPolarity'),
          A('summary', 'Descrição', { wide: true }), T('duration', 'Duração'), T('intensity', 'Intensidade'),
          A('applyConditions', 'Condições de aplicação'), A('perTurn', 'Efeitos por turno'),
          { key: 'stackable', label: 'Acumula', type: 'bool' }, { key: 'maxStacks', label: 'Acúmulo máximo', type: 'number' },
          A('removal', 'Métodos de remoção'),
        ] },
        { id: 'notes', tab: 'notas', title: 'Observações', open: true, fields: [A('notes', 'Observações', { wide: true, rows: 8 })] },
      ],
    },
    skilltree: {
      label: 'Árvore de habilidades', plural: 'Árvores de habilidades', icon: 'tree', color: '#D946EF', mech: true, sections: [],
    },
    refcollection: { label: 'Coleção', plural: 'Coleções', icon: 'images', color: '#A1A1B5', media: true, sections: [] },
    moodboard: { label: 'Moodboard', plural: 'Moodboards', icon: 'moodboard', color: '#C4B5FD', media: true, sections: [] },
  };

  const NARRATIVE_KINDS = ['character', 'location', 'storyline', 'event', 'organization'];
  const TAB_LABELS = { overview: 'Visão geral', aparencia: 'Aparência', personalidade: 'Personalidade', historia: 'História', ambiente: 'Ambiente', historico: 'Histórico', notas: 'Notas' };
  const DEFAULT_COLORS = Object.fromEntries(Object.entries(KINDS).map(([k, v]) => [k, v.color]));
  /* Cores de categoria escolhidas pelo usuário (globais) */
  function applyKindColors(overrides = {}) {
    for (const [k, v] of Object.entries(KINDS)) v.color = overrides[k] || DEFAULT_COLORS[k];
    const root = document.documentElement;
    for (const [k, v] of Object.entries(KINDS)) root.style.setProperty('--k-' + k, v.color);
  }
  const MECH_KINDS = ['skill', 'passive', 'class', 'item', 'effect', 'skilltree'];

  function defaultLists() {
    return {
      storyRoles: ['Protagonista', 'Deuteragonista', 'Antagonista', 'Coadjuvante', 'Mentor', 'Interesse romântico', 'Rival', 'Figurante'],
      characterStatus: ['Vivo', 'Morto', 'Desaparecido', 'Desconhecido', 'Em planejamento'],
      locationTypes: ['País', 'Continente', 'Reino', 'Cidade', 'Vila', 'Bairro', 'Região', 'Floresta', 'Montanha', 'Masmorra', 'Castelo', 'Casa', 'Escola', 'Universidade', 'Hospital', 'Loja', 'Taverna', 'Base militar', 'Planeta', 'Dimensão', 'Localidade sobrenatural', 'Outro'],
      storylineStatus: ['Ideia', 'Em planejamento', 'Em desenvolvimento', 'Em revisão', 'Concluída', 'Arquivada'],
      storylineTypes: ['Trama principal', 'Subtrama', 'Arco de personagem', 'Romance', 'Investigação', 'Conflito político', 'Mistério', 'Jornada', 'Vingança', 'Desenvolvimento de mundo', 'Trama secundária', 'Rota (visual novel)'],
      eventTypes: ['Primeira aparição', 'Encontro', 'Revelação', 'Início de relacionamento', 'Confronto', 'Morte', 'Mudança de personalidade', 'Aquisição de habilidade', 'Ruptura familiar', 'Batalha', 'Viagem', 'Flashback', 'Outro'],
      eventStatus: ['Ideia', 'Planejado', 'Escrito', 'Revisado', 'Descartado'],
      orgTypes: ['Facção', 'Guilda', 'Família', 'Governo', 'Exército', 'Religião', 'Empresa', 'Escola', 'Sociedade secreta', 'Outro'],
      loreCategories: ['Regras do mundo', 'Sistemas de magia', 'Sistemas tecnológicos', 'História do universo', 'Cronologia geral', 'Culturas', 'Povos e espécies', 'Organizações', 'Facções', 'Sistemas políticos', 'Religiões e crenças', 'Economia', 'Vocabulário próprio', 'Regras de continuidade', 'Ideias futuras', 'Informações ainda não definidas'],
      stepStatus: ['Ideia', 'Rascunho', 'Escrito', 'Revisado'],
      narrativeUnits: ['Arco', 'Capítulo', 'Cena'],
      imgCatCharacter: ['Aparência', 'Roupas', 'Expressões', 'Poses', 'Acessórios', 'Outros'],
      imgCatLocation: ['Arquitetura', 'Interiores', 'Paisagens', 'Iluminação', 'Decoração', 'Outros'],
      imgCatStoryline: ['Clima', 'Cenas importantes', 'Composição', 'Cenários', 'Inspiração estética', 'Outros'],
      imgCatEvent: ['Cena', 'Composição', 'Outros'],
      imgCatOrganization: ['Símbolos', 'Uniformes', 'Sedes', 'Outros'],
      mediaCategories: ['Aparência', 'Roupas', 'Expressões', 'Poses', 'Arquitetura', 'Paisagens', 'Interiores', 'Iluminação', 'Paleta', 'Armas e equipamentos', 'Atmosfera', 'Composição', 'Outros'],
      skillCategories: ['Ataque físico', 'Ataque mágico', 'Ataque à distância', 'Defesa', 'Cura', 'Suporte', 'Invocação', 'Mobilidade', 'Controle de grupo', 'Contra-ataque', 'Transformação', 'Manipulação temporal', 'Habilidade especial', 'Habilidade definitiva'],
      passiveCategories: ['Atributo', 'Sobrevivência', 'Ofensiva', 'Defensiva', 'Economia de recursos', 'Social', 'Exploração', 'Condicional'],
      passiveActivation: ['Permanente', 'Depende de condição', 'Ativada por evento', 'Exige recurso'],
      itemCategories: ['Arma', 'Armadura', 'Escudo', 'Acessório', 'Relíquia', 'Artefato', 'Consumível', 'Item mágico'],
      itemRarities: ['Comum', 'Incomum', 'Raro', 'Épico', 'Lendário', 'Único'],
      effectPolarity: ['Negativo', 'Positivo', 'Neutro'],
    };
  }

  /* Tipos de relação. genealogy: parent|spouse|sibling (alimenta a árvore genealógica) */
  function defaultRelationTypes() {
    const R = (id, label, reverse, cat, opts = {}) => ({ id, label, reverse: reverse || label, symmetric: !reverse, cat, from: opts.from || ['character'], to: opts.to || ['character'], genealogy: opts.g || null });
    return [
      R('rt_parent', 'é pai/mãe de', 'é filho(a) de', 'familia', { g: 'parent' }),
      R('rt_father', 'é pai de', 'é filho(a) de', 'familia', { g: 'parent' }),
      R('rt_mother', 'é mãe de', 'é filho(a) de', 'familia', { g: 'parent' }),
      R('rt_sibling', 'é irmão/irmã de', null, 'familia', { g: 'sibling' }),
      R('rt_halfsibling', 'é meio-irmão(ã) de', null, 'familia', { g: 'sibling' }),
      R('rt_grand', 'é avô/avó de', 'é neto(a) de', 'familia'),
      R('rt_uncle', 'é tio/tia de', 'é sobrinho(a) de', 'familia'),
      R('rt_cousin', 'é primo(a) de', null, 'familia'),
      R('rt_spouse', 'é cônjuge de', null, 'familia', { g: 'spouse' }),
      R('rt_dating', 'namora', null, 'romance'),
      R('rt_ex', 'teve um relacionamento com', null, 'romance'),
      R('rt_friend', 'é amigo(a) de', null, 'social'),
      R('rt_rival', 'é rival de', null, 'social'),
      R('rt_enemy', 'é inimigo(a) de', null, 'social'),
      R('rt_ally', 'é aliado(a) de', null, 'social'),
      R('rt_mentor', 'é mentor(a) de', 'é aprendiz de', 'hierarquia'),
      R('rt_boss', 'é superior de', 'é subordinado(a) de', 'hierarquia'),
      R('rt_sameorg', 'é da mesma organização que', null, 'organizacao'),
      R('rt_member', 'é membro de', 'tem como membro', 'organizacao', { to: ['organization'] }),
      R('rt_passage', 'está conectada por passagem a', null, 'geografia', { from: ['location'], to: ['location'] }),
      R('rt_controls', 'controla', 'é controlada por', 'organizacao', { from: ['organization'], to: ['location'] }),
      R('rt_slrelated', 'está relacionada a', null, 'storyline', { from: ['storyline'], to: ['storyline'] }),
      R('rt_orgrel', 'tem aliança com', null, 'organizacao', { from: ['organization'], to: ['organization'] }),
      R('rt_generic', 'está ligado(a) a', null, 'outro', { from: ['*'], to: ['*'] }),
    ];
  }

  const EDGE_CATS = {
    familia: 'Família', romance: 'Romance', social: 'Social', hierarquia: 'Hierarquia', organizacao: 'Organizações',
    geografia: 'Geografia', evento: 'Eventos', storyline: 'Storylines', mecanica: 'Mecânica', referencias: 'Referências visuais', outro: 'Outras',
  };

  function defaultNodeTypes() {
    const N = (id, label, color, shape) => ({ id, label, color, shape });
    return [
      N('nt_active', 'Habilidade ativa', '#f07a4a', 'round'), N('nt_passive', 'Habilidade passiva', '#c58af0', 'round'),
      N('nt_attr', 'Atributo', '#5aa0e6', 'rect'), N('nt_attrup', 'Melhoria de atributo', '#4ac4e0', 'rect'),
      N('nt_spec', 'Especialização', '#6fc36f', 'hex'), N('nt_class', 'Classe', '#57b05a', 'hex'), N('nt_subclass', 'Subclasse', '#8fd08f', 'hex'),
      N('nt_power', 'Poder especial', '#e0a03c', 'diamond'), N('nt_transform', 'Transformação', '#e46a8a', 'diamond'),
      N('nt_equip', 'Desbloqueio de equipamento', '#d6c14a', 'rect'), N('nt_ultimate', 'Habilidade definitiva', '#ff5d5d', 'diamond'),
      N('nt_req', 'Nó de requisito', '#9aa3b5', 'rect'), N('nt_story', 'Nó narrativo', '#b08968', 'round'), N('nt_custom', 'Nó personalizado', '#8b7cf6', 'round'),
    ];
  }

  function defaultMechanics() {
    return {
      enabled: false,
      modules: { attributes: true, resources: true, actives: true, passives: true, tree: true, classes: true, items: true, resist: true, effects: true, progression: true, rules: true, history: true },
      attrCategories: [], attributes: [], variables: [], damageTypes: [], slots: [], nodeTypes: defaultNodeTypes(),
      rules: [],
      progression: { useLevels: true, maxLevel: 50, xpMode: 'formula', xpFormula: '100 * nivel ^ 1.5', xpTable: [], attrPointsPerLevel: 3, skillPointsPerLevel: 1, specPointsPerLevel: 0, notes: '' },
      skillLevelColumns: ['Efeito', 'Multiplicador', 'Custo', 'Duração', 'Alcance'],
    };
  }

  function defaultConfig() {
    return {
      lists: defaultLists(),
      relationTypes: defaultRelationTypes(),
      layout: {},            /* layout[kind] = {labels:{key:txt}, hidden:{key:true}, sectionOrder:[ids]} */
      customFieldDefs: {},   /* customFieldDefs[kind] = [{id,label,type}] aplicados a todos os registros do tipo */
      modules: { organizations: true, branching: true },
      graphPositions: {},
      minRefs: 3,
    };
  }

  const WORK_TYPES = ['Visual Novel', 'Light Novel', 'Mangá', 'Livro', 'Conto', 'Jogo eletrônico', 'RPG', 'Webcomic', 'Série', 'Filme', 'História interativa', 'Outro'];

  /* Campos efetivos de um tipo no projeto (respeita rótulos e campos ocultos) */
  function sections(kind, project) {
    const k = KINDS[kind]; if (!k) return [];
    const lay = (project && project.config.layout[kind]) || {};
    let secs = k.sections.map(s => ({ ...s, fields: s.fields.map(f => ({ ...f, label: (lay.labels && lay.labels[f.key]) || f.label, hidden: !!(lay.hidden && lay.hidden[f.key]) })) }));
    if (lay.sectionOrder && lay.sectionOrder.length) {
      secs.sort((a, b) => {
        const ia = lay.sectionOrder.indexOf(a.id), ib = lay.sectionOrder.indexOf(b.id);
        return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
      });
    }
    return secs;
  }
  function allFields(kind) { return (KINDS[kind] ? KINDS[kind].sections : []).flatMap(s => s.fields); }
  function refFields(kind) { return allFields(kind).filter(f => f.type === 'ref' || f.type === 'refs'); }
  function kindLabel(kind, plural = false) { const k = KINDS[kind]; return k ? (plural ? k.plural : k.label) : kind; }

  return { KINDS, TAB_LABELS, DEFAULT_COLORS, applyKindColors, NARRATIVE_KINDS, MECH_KINDS, EDGE_CATS, WORK_TYPES, defaultConfig, defaultMechanics, defaultLists, defaultRelationTypes, defaultNodeTypes, sections, allFields, refFields, kindLabel };
})();
