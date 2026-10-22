# Fiction Studio

Estúdio pessoal para criar, documentar e conectar universos ficcionais: personagens, localidades, storylines, eventos, organizações, anotações, **moodboards** e biblioteca de referências visuais, relações e grafos — e, opcionalmente, sistemas de RPG completos (atributos, fórmulas, habilidades, árvores, classes, itens, efeitos e progressão).

HTML, CSS e JavaScript puros, **sem dependências externas** e sem etapa de build. Os dados ficam no IndexedDB do navegador.

---

## Como executar

**Mais simples:** dê dois cliques em `index.html` (Chrome, Edge ou Firefox recentes).

**Recomendado — servidor local (opcional):**

- Windows: dois cliques em **`iniciar.bat`**.
- macOS / Linux: `./iniciar.sh` (ou `python3 servidor.py`).

O navegador abre em `http://localhost:8000`. Precisa do Python 3 (python.org; no Windows marque "Add python.exe to PATH"). O servidor só serve os arquivos do app e, quando você cola um endereço web de imagem, baixa esse arquivo para contornar sites que bloqueiam o navegador (CORS). **Ele não pesquisa imagens e não usa chaves de API.**

> **Importante:** os dados ficam no navegador e no endereço usado para abrir o app. `file://` e `http://localhost:8000` têm bancos separados. Escolha uma forma e mantenha-a; para mudar, use Exportar num e Importar no outro. Exporte com regularidade como cópia de segurança.

> **Atualizando de uma versão anterior:** substitua os arquivos da pasta e recarregue a página (Ctrl+F5 se o navegador insistir na versão antiga). Os projetos existentes continuam abrindo; veja "Migração" abaixo.

Primeira vez? Clique em **Criar projeto de exemplo** na tela Início.

---

## Identidade visual e uso

- **Creative Dark Studio:** tema escuro grafite-azulado (padrão) e tema claro próprio, ambos definidos por tokens em `css/app.css` (`:root` e `[data-theme="light"]`). Nenhum componente usa cores soltas.
- **Cores com significado:** violeta = ação e seleção; ciano = conexões e dados técnicos; verde/amarelo/vermelho = sucesso/aviso/erro; rosa = vínculos afetivos; dourado = raridade. Cada categoria (personagens, localidades, storylines…) tem cor e ícone próprios, iguais em fichas, listas, grafo, cronologia e moodboards. As cores de categoria podem ser trocadas em **Configurações**.
- **Tipografia:** Inter (texto) e JetBrains Mono (fórmulas e códigos), carregadas do Google Fonts quando há internet; sem internet o app usa as fontes do sistema automaticamente.
- **Ícones:** um único conjunto vetorial no estilo Lucide (grade 24, traço 2), embutido em `js/core/util.js`. Emojis só aparecem quando você os escreve no conteúdo.
- **Navegação:** barra lateral recolhível (Início, Projetos, Biblioteca de referências, Modelos, Configurações; dentro de um projeto, as seções dele), trilha "Projetos › Projeto › Seção › Registro", botão **Criar** contextual (tecla **N**), pesquisa (tecla **/**). Filtros, buscas, rolagem e a última aba de cada ficha são preservados ao voltar.
- **Fichas em três áreas:** identidade (retrato, nome, função, resumo, tags), abas internas (para personagens: Visão geral, Aparência, Personalidade, História, Relacionamentos, Eventos, Combate e habilidades, Equipamentos, Referências, Notas) e conteúdo. A **Visão geral** junta identidade, destaques (campos marcados com estrela) e blocos relacionados — relacionamentos, eventos, localidades, storylines, organizações, referências — todos como atalhos para os registros originais. Os blocos podem ser ocultados em "Personalizar visão geral".
- **Resumida / Detalhada:** em qualquer ficha, Resumida mostra só o que está preenchido, para leitura (no combate: atributos principais e barras de recursos); Detalhada mostra todos os campos editáveis, modificadores e fórmulas. A escolha fica salva.
- **Editores visuais** (grafo, árvores de habilidades, ramificações, rotas, moodboards) compartilham os mesmos gestos — arrastar o fundo move, roda do mouse aproxima, clique seleciona, duplo clique abre — e o mesmo controle de zoom/enquadrar/ajuda no canto. O painel lateral de propriedades pode ser redimensionado (a largura fica salva).

---

## Moodboards e referências visuais

A antiga função "Gerar Referências" (pesquisa automática de imagens na internet) **foi removida**. Em seu lugar há um editor de moodboards para você reunir e compor as suas próprias referências.

**Moodboards** (Moodboards e referências → Moodboards, ou o botão de moodboard em qualquer ficha):

- Área de trabalho livre e ampla: arrastar, redimensionar (proporção mantida; Shift libera), girar (Shift = passos de 15°), camadas (`[` e `]`), seleção múltipla (Shift+clique ou Shift+arrastar no fundo), alinhar e distribuir, duplicar (Ctrl+D), remover (Delete), **desfazer/refazer** (Ctrl+Z / Ctrl+Shift+Z), zoom e enquadrar tudo (Ctrl+0).
- Imagens: do computador, arrastando arquivos para a área, **colando** (Ctrl+V), da biblioteca (gaveta lateral, clique ou arraste) ou por **endereço web**. Cada imagem tem ajuste (preencher, inteira, esticar) e enquadramento (zoom e posição; ou Alt+arrastar a imagem), legenda opcional e "Extrair paleta", que cria uma paleta com as cores principais da imagem.
- Objetos auxiliares: título, texto livre, nota adesiva, etiqueta, separador, bloco de cor, paleta e **cartões de referência** a personagens, localidades, storylines e eventos (duplo clique abre a ficha).
- Painel de propriedades: nome, descrição, categoria, tags, origem, link, observações e elementos relacionados **da imagem** (compartilhados em todo o projeto — o nome não depende do nome do arquivo) e, separadamente, legenda, posição, tamanho, rotação e camada **neste moodboard**. Renomeie também pelo próprio quadro (F2 ou duplo clique em textos).
- Tudo é salvo automaticamente — posições, tamanhos, rotação, camadas, textos e enquadramento — e o quadro reabre exatamente como ficou.
- **Exportar PNG:** moodboard completo, só a seleção ou a área visível; resolução 1× a 4× (limitada a 8192 px por lado); com ou sem legendas; ocultando ou não os elementos auxiliares; fundo da área, branco ou transparente. A exportação não altera o moodboard.

**Biblioteca de mídia** (uma por projeto): cada arquivo é guardado uma vez e usado por fichas, moodboards e coleções. Pesquisa por nome, filtros por categoria, tag, elemento associado e tipo; **imagens não utilizadas**; **duplicadas** (mesmo conteúdo, por impressão digital SHA-256) com "Manter esta", que junta todos os usos numa única imagem; **coleções**; adicionar a moodboards em lote; "Usada em" mostra onde cada imagem aparece. Remover uma imagem de uma ficha não apaga o arquivo; excluir da biblioteca avisa onde ela ainda está em uso. Miniaturas (≈420 px) e prévias (≈1600 px) são geradas na importação para manter tudo leve; o original é preservado.

**Importação por endereço web:** o app baixa o arquivo e o guarda no projeto. Se o site bloquear (CORS, login, página em vez de imagem), o app explica o motivo, não salva nada e sugere abrir a imagem numa aba para salvar e importar manualmente. Com o servidor local ativo, a maioria dos bloqueios de CORS é contornada.

**Migração:** coleções criadas pela pesquisa automática antiga são convertidas em coleções comuns marcadas "pesquisa antiga"; as imagens que eram só links aparecem com o selo **link externo** (não estão guardadas) e podem ser baixadas para o projeto pelo menu da coleção. Chaves de API antigas são apagadas das preferências.

---

## Estrutura dos arquivos

```
fiction-studio/
├── index.html            carrega os scripts na ordem
├── servidor.py           servidor local opcional: arquivos do app e download de imagens por endereço web
├── iniciar.bat / .sh     atalhos para abrir pelo servidor
├── css/app.css           tema escuro (padrão) e claro, via variáveis CSS
└── js/
    ├── core/             lógica sem interface
    │   ├── util.js       utilitários, DOM, ícones, menus, controle segmentado, toasts com desfazer, modais
    │   ├── db.js         IndexedDB (projects, entities, relations, images, tags, templates, settings)
    │   ├── store.js      estado do projeto aberto, salvamento automático, integridade referencial
    │   ├── schema.js     tipos de registro, campos, listas e tipos de relação padrão
    │   ├── formula.js    analisador e avaliador seguro de expressões
    │   ├── mech.js       cálculo de atributos, modificadores, XP, requisitos, validação de árvores
    │   ├── zip.js        leitura/escrita ZIP sem dependências
    │   └── io.js         exportar, importar, duplicar, modelos de sistema
    ├── ui/               componentes
    │   ├── components.js navegação, tags, seletores de registros, campos, exclusão com impacto
    │   ├── viz.js        pan/zoom, layouts (forças, camadas, círculo, grade), grafo, exportar PNG
    │   ├── nodeeditor.js editor de nós (árvores de habilidades e ramificações)
    │   └── gallery.js    mídia: importação (arquivo, colar, URL), miniaturas/prévias, duplicadas, aba Referências, lightbox
    ├── views/            telas (moodboard.js = editor de moodboards; library.js = biblioteca e coleções)
    └── app.js            rotas por hash, barra superior e lateral
```

## Modelo de dados

Todos os vínculos usam **identificadores estáveis**; renomear qualquer coisa não quebra nada.

- **Projeto** — dados gerais, tags, capa, `config` (listas editáveis, tipos de relação, layout das fichas, campos do projeto, módulos, posições do grafo) e `mechanics` (atributos, categorias, variáveis, tipos de dano, slots, tipos de nó, regras, progressão).
- **Registro** (`entities`) — um formato comum para todos os tipos: `{id, projectId, kind, name, tags, fields, custom, mainImageId, ...}`. `kind` é `character`, `location`, `storyline`, `event`, `organization`, `lore`, `skill`, `passive`, `class`, `item`, `effect`, `skilltree`, `moodboard` (com `items[]` posicionados e `view`) ou `refcollection` (coleção, com `imageIds[]`). Vínculos de campo (ex.: personagens de um evento) são listas de ids no registro dono; as fichas do outro lado calculam o inverso, sem cópias.
- **Relação** (`relations`) — `{typeId, fromId, toId, description, history, state, period, notes, tags}`. Uma só gravação serve as duas fichas; o tipo define rótulo, rótulo inverso, reciprocidade, categoria e papel na genealogia.
- **Imagem** (`images`) — Blob original + miniatura + prévia (ou só link remoto, marcado como externo), `hash`, metadados (nome, categoria, descrição, origem, tags…) e `links: [{entityId, category, order}]`. Moodboards e coleções apontam para o mesmo registro pelo `id`.
- **Tags** são globais (reutilizáveis entre projetos). **Modelos** de sistema são globais e, ao serem aplicados, copiados de forma independente.

Para adicionar um novo tipo de registro, inclua-o em `Schema.KINDS` (campos por seção, cor, ícone); listas, busca, grafo, exportação e integridade passam a tratá-lo automaticamente.

## Formato de exportação (`.fsproj.zip`, versão 1)

```
project.json        { format: "fiction-studio/project", version: 1, exportedAt,
                      project, entities[], relations[], images[] (metadados), tags[] }
images/<id>.<ext>   arquivo original
images/<id>_thumb.jpg  miniatura   (as prévias são regeneradas ao abrir)
LEIA-ME.txt
```

Também é aceito importar um `project.json` solto (sem imagens). A importação valida formato, versão, tipos e referências; descarta relações com extremidades inexistentes, mostra avisos, **gera ids novos para tudo** (nunca há conflito) e cria sempre um projeto novo — nada é sobrescrito. Tags são associadas por nome.

## Integridade

- Antes de excluir, o app lista as relações, fichas e imagens afetadas.
- Ao excluir, relações são removidas, vínculos nas outras fichas são limpos, imagens permanecem na biblioteca e tudo fica anotado em *Configurações → Integridade*.
- *Integridade* também procura vínculos quebrados (ex.: vindos de importações) e oferece correção.
- Avisos de nomes semelhantes ao criar ou renomear e de relações repetidas.
- Excluir uma tag em uso informa quantos projetos, registros e imagens a usam.

## Sistema de jogo (opcional)

Ative em *Configurações do projeto → Geral* ou em *Sistemas de RPG*, do zero ou a partir do modelo "RPG de fantasia (exemplo)". Cada subsistema pode ser ligado ou desligado.

- **Atributos** com tipo (inteiro, decimal, %, sim/não, escala, qualitativo), limites, unidade, categoria, ícone, destaque, recurso com valor atual, e **fórmulas** como `[Vitalidade] * 20 + nivel * 5`. Fórmulas são gravadas com ids, validadas na hora (sintaxe, referência inexistente, dependência circular) e recalculadas automaticamente. Funções: `min max floor ceil round abs sqrt pow log exp clamp se/if`; comparações e `&& ||`.
- **Valor final** de um atributo = base + crescimento das classes por nível + temporário + modificadores de itens equipados, passivas ativas e efeitos (fixo, % ou fórmula). A ficha mostra a composição de cada número.
- **Habilidades ativas** com tabela de níveis configurável, evoluções alternativas e requisitos estruturados; **passivas**, **itens** e **efeitos** com modificadores reais; **classes** com atributos iniciais, crescimento, subclasses e multiclasse (obrigatória, opcional ou apenas descritiva).
- **Árvores de habilidades**: editor visual (criar, arrastar, conectar, duplicar, ocultar, cores e tipos de nó próprios, grupos exclusivos, custos, nível mínimo, pontos acumulados, requisitos "todos" ou "qualquer um"), validação de ciclos, nós inalcançáveis e conexões inválidas, exportação PNG e **simulação** de desbloqueio com um personagem real, que pode conceder as habilidades à ficha.
- **Progressão** por fórmula ou tabela manual de XP, pontos por nível, botão "Subir de nível", marcos ligados a eventos.
- **Eventos** podem desbloquear habilidades/classes/itens e aplicar alterações permanentes ou temporárias de atributos, registradas no histórico do personagem.
- **Regras e fórmulas** do projeto com prévia calculada para qualquer personagem, ou apenas como texto.
- **Modelos**: salve o sistema do projeto para reutilizar; aplicar copia os dados (mesclando ou substituindo).

---

## Limitações conhecidas

- Os dados vivem em um navegador, num computador. Não há sincronização entre dispositivos; use exportar/importar.
- O "sistema compartilhado" entre projetos (um modelo vivo, alterado em um lugar e refletido em todos) não foi implementado: modelos são sempre copiados.
- Importar por endereço web depende do site permitir o download; páginas que exigem login não funcionam nem com o servidor local.
- A exportação PNG de moodboards deixa em branco imagens que estão só como link externo.
- Girar e redimensionar no moodboard são feitos com mouse/caneta; em telas de toque o editor funciona, mas foi pensado para computador.
- O grafo é SVG; acima de algumas centenas de nós visíveis fica mais lento. Use os filtros por tipo, categoria de conexão, tag, storyline ou "Só vizinhos".
- Reordenar por arrastar funciona com mouse; em telas de toque use as setas de subir/descer.
- Desfazer existe nos moodboards (Ctrl+Z) e para remoções rápidas (relações, imagens de uma ficha, objetos do quadro) pelo botão "Desfazer" da notificação; não há histórico global. Exclusões definitivas pedem confirmação e ficam registradas.

## Próximos passos sugeridos

1. Sincronização opcional (pasta local via File System Access API ou backend próprio).
2. Agrupar objetos no moodboard e guias de alinhamento magnéticas.
3. Histórico de versões e desfazer por registro.
4. Exportar fichas para Markdown/PDF e o roteiro das ramificações para formatos de motores (Ren'Py, Ink, Godot Dialogue Manager).
5. Árvore genealógica com casais agrupados em uma única linha de descendência.
6. Modelos de sistema compartilhados (vivos) entre projetos.
