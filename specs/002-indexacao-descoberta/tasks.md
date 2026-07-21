---

description: "Task list for 002-indexacao-descoberta"
---

# Tasks: Indexação rápida e descoberta por buscadores e motores de IA

**Input**: Design documents from `/specs/002-indexacao-descoberta/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/artefatos-descoberta.md](contracts/artefatos-descoberta.md)

**Tests**: incluídos. [research.md D11](research.md) define dois níveis — `node --test` para a lógica de seleção de URLs (a única parte que quebra em silêncio) e `npm run verificar` estendido para os artefatos gerados. Sem framework novo.

**Organization**: agrupadas por user story, cada uma entregável e testável sozinha.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: pode rodar em paralelo (arquivo diferente, sem dependência pendente)
- **[Story]**: US1 (IndexNow) · US2 (Bing) · US3 (IA/llms.txt) · US4 (RSS)

## Path Conventions

Projeto único Astro na raiz: `src/`, `public/`, `scripts/`, `tests/`, `docs/`.

---

## Phase 1: Setup

**Purpose**: dependência e diretório que as stories usam

- [ ] T001 Instalar `@astrojs/rss` com `npm install @astrojs/rss` e confirmar que é a única dependência nova em `package.json`
- [ ] T002 [P] Criar `docs/` na raiz do repositório (diretório novo, ainda sem conteúdo)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: constantes compartilhadas. Ficam aqui porque US1 e US4 editariam o **mesmo arquivo** — resolvendo antes, as stories seguem sem conflito.

**⚠️ CRITICAL**: nenhuma user story começa antes desta fase

- [ ] T003 Adicionar em `src/lib/constants.ts`: `CHAVE_INDEXNOW` (hex de 32 caracteres, gerado uma vez — valor público por definição do protocolo, ver [data-model.md](data-model.md)), `INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow"` e `FEED_URL = SITE_URL + "/rss.xml"`, cada um com comentário de uma linha explicando o porquê

**Checkpoint**: constantes prontas — as quatro stories podem seguir em paralelo

---

## Phase 3: User Story 1 - Conteúdo novo indexado em horas (Priority: P1) 🎯 MVP

**Goal**: todo deploy avisa os buscadores compatíveis quais URLs existem, sem nunca poder derrubar build ou container.

**Independent Test**: subir o container e ver `[indexnow] N URLs -> 200 OK` no log; reiniciar sem novo build e ver o disparo ser pulado.

### Tests for User Story 1 ⚠️

> Escreva primeiro e confirme que falham antes de implementar.

- [ ] T004 [P] [US1] Criar `tests/indexnow.test.mjs` com casos que falham: extrai todas as `<loc>` de um XML de sitemap de exemplo; descarta URLs contendo `/admin` ou `/api`; descarta URL de outro host; remove duplicatas; lista vazia não é erro
- [ ] T005 [P] [US1] Acrescentar em `tests/indexnow.test.mjs` os casos de guarda: host diferente do de produção resulta em "pulado"; marcador já existente resulta em "pulado"

### Implementation for User Story 1

- [ ] T006 [US1] Criar `public/<valor de CHAVE_INDEXNOW>.txt` contendo exatamente a chave — nome do arquivo e conteúdo derivados de `CHAVE_INDEXNOW` (T003); divergência causa `403` na submissão
- [ ] T007 [US1] Criar `scripts/indexnow.mjs` exportando as funções puras que os testes de T004/T005 consomem: `urlsDoSitemap(xml)` (regex sobre `<loc>`), `filtrarPublicas(urls, siteUrl)` (descarta `/admin`, `/api`, host estranho, duplicata) e `deveSubmeter({ siteUrl, marcadorExiste, urls })`
- [ ] T008 [US1] Implementar em `scripts/indexnow.mjs` o fluxo principal: ler `dist/client/sitemap-*.xml`, aplicar as funções de T007, montar o corpo `{ host, key, keyLocation, urlList }` e `POST` via `fetch` nativo para `INDEXNOW_ENDPOINT`
- [ ] T009 [US1] Implementar o tratamento de resposta e log de uma linha por disparo conforme [contracts §5](contracts/artefatos-descoberta.md) (`200`/`202` sucesso, `400`/`403`/`422`/`429` e falha de rede registrados) — **nenhum caminho pode sair com código diferente de 0** (FR-004)
- [ ] T010 [US1] Gravar `dist/.indexnow-enviado` após submissão aceita e pular quando ele já existir; falha ao gravar o marcador não interrompe o script
- [ ] T011 [US1] Adicionar o script `"indexnow": "node scripts/indexnow.mjs"` em `package.json` para execução manual e depuração
- [ ] T012 [US1] Ajustar o `Dockerfile`: copiar `scripts/` para a imagem de runtime e trocar o `CMD` por forma shell que dispare o ping em background após ~15s e mantenha o servidor no PID principal (`exec`) — o disparo é na **subida do container**, nunca no estágio de build ([research.md D1](research.md))
- [ ] T013 [US1] Acrescentar em `scripts/verificar-seo.mjs` a checagem de que o arquivo de chave existe em `dist/client/` e seu conteúdo bate com `CHAVE_INDEXNOW`

**Checkpoint**: US1 funciona sozinha — o site já é submetido a cada deploy mesmo sem nenhuma das outras stories

---

## Phase 4: User Story 2 - Domínio verificado no Bing (Priority: P2)

**Goal**: enxergar no painel do Bing o resultado do que a US1 dispara.

**Independent Test**: propriedade aparece verificada no painel e o sitemap consta como processado.

### Implementation for User Story 2

- [ ] T014 [P] [US2] Criar `docs/bing-webmaster.md` com os cinco passos de [contracts §6](contracts/artefatos-descoberta.md), deixando explícito que a **importação do Google Search Console** é a rota preferida porque o GSC já está verificado e não exige mudança no repositório
- [ ] T015 [US2] Executar a verificação no painel do Bing pela importação do GSC e registrar em `docs/bing-webmaster.md` a data e o método que funcionou
- [ ] T016 [US2] Se — e somente se — a importação não estiver disponível: criar `public/BingSiteAuth.xml` com o token do painel e verificar por arquivo, anotando o motivo do plano B em `docs/bing-webmaster.md`
- [ ] T017 [US2] Submeter `https://tapepro.roilabs.com.br/sitemap-index.xml` no painel e registrar em `docs/bing-webmaster.md` o número de URLs descobertas

**Checkpoint**: US1 e US2 funcionam independentes — agora o disparo é observável

---

## Phase 5: User Story 3 - Site legível e citável por motores de IA (Priority: P2)

**Goal**: crawlers de IA com permissão explícita e um índice de conteúdo que se mantém sozinho.

**Independent Test**: `curl` em `/llms.txt` e `/robots.txt` devolve o conteúdo esperado com as rotas reais.

### Implementation for User Story 3

- [ ] T018 [P] [US3] Criar `src/pages/llms.txt.ts` gerando o formato llmstxt.org de [contracts §3](contracts/artefatos-descoberta.md), com as seções Produtos, Segmentos, Blog e Institucional
- [ ] T019 [US3] Alimentar `src/pages/llms.txt.ts` das fontes reais — `PRODUTOS` de `src/lib/produtos.ts`, coleção `segmentos`, e `postsPublicados()` de `src/lib/conteudo.ts` (que já filtra rascunho) — sem nenhuma lista de rotas escrita à mão (FR-010)
- [ ] T020 [P] [US3] Atualizar `public/robots.txt`: `Disallow: /admin/` e `Disallow: /api/` para `User-agent: *`, blocos `Allow` explícitos para os agentes listados em [research.md D9](research.md), e comentário apontando a URL absoluta do `llms.txt`
- [ ] T021 [US3] Acrescentar em `scripts/verificar-seo.mjs`: `llms.txt` existe no `dist`, todo link dele resolve para uma rota realmente presente no build, e `robots.txt` bloqueia `/admin/` e `/api/`

**Checkpoint**: as três primeiras stories funcionam independentes

---

## Phase 6: User Story 4 - Blog acompanhável por feed (Priority: P3)

**Goal**: feed do blog publicado e referenciado em todas as páginas.

**Independent Test**: abrir `/rss.xml` num leitor de RSS e ver os posts publicados na ordem certa.

### Implementation for User Story 4

- [ ] T022 [P] [US4] Criar `src/pages/rss.xml.ts` com `@astrojs/rss`, alimentado por `postsPublicados()` — o helper já exclui rascunho e ordena por `publicadoEm` decrescente, cobrindo FR-013 e FR-014 sem filtro novo
- [ ] T023 [US4] Mapear os campos conforme [data-model.md](data-model.md) (`titulo`→`title`, `descricao`→`description`, `/blog/{id}` absolutizado com `SITE_URL`→`link`, `publicadoEm`→`pubDate`)
- [ ] T024 [US4] Adicionar `<link rel="alternate" type="application/rss+xml" title="Blog TapePro" href={FEED_URL} />` no `<head>` de `src/layouts/BaseLayout.astro`
- [ ] T025 [US4] Acrescentar em `scripts/verificar-seo.mjs`: `rss.xml` existe no `dist`, a contagem de `<item>` bate com a de posts publicados, e todo HTML gerado traz a tag `rel="alternate"`

**Checkpoint**: as quatro stories entregues

---

## Phase 7: Polish & Cross-Cutting

- [ ] T026 Rodar `npm test` e `npm run build && npm run verificar` e confirmar que passam sem falha — evidência antes de qualquer afirmação de "pronto"
- [ ] T027 Executar `node scripts/indexnow.mjs` localmente e confirmar que **pula sem fazer requisição de rede** (FR-005), conforme [quickstart.md §3](quickstart.md)
- [ ] T028 [P] Atualizar `handoff.md` com o estado desta feature: o que ficou automático, o que exige painel, e o teto conhecido do marcador de idempotência
- [ ] T029 Após o deploy, percorrer [quickstart.md §4 e §5](quickstart.md) contra produção e registrar o resultado real do log do container

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (T001–T002)**: sem dependência
- **Foundational (T003)**: depende do Setup — **bloqueia todas as stories**
- **US1 (T004–T013)**: depende de T003
- **US2 (T014–T017)**: depende de T003; T015 e T017 exigem o site publicado, então na prática vêm depois do primeiro deploy com US1
- **US3 (T018–T021)**: depende de T003
- **US4 (T022–T025)**: depende de T001 e T003
- **Polish (T026–T029)**: depende das stories desejadas

### Within Each User Story

- Testes de US1 (T004, T005) são escritos e falham antes de T007
- T007 (funções puras) antes de T008 (fluxo que as usa)
- T018 antes de T019 (estrutura antes das fontes)
- T022 antes de T023 antes de T024

### Conflitos de arquivo a respeitar

`scripts/verificar-seo.mjs` é tocado por T013, T021 e T025 — **não paralelizar entre si**. Foi o motivo de T003 concentrar as constantes: sem isso, US1 e US4 disputariam `src/lib/constants.ts`.

### Parallel Opportunities

- T001 e T002 juntos
- Depois de T003, as quatro stories podem correr em paralelo por pessoas diferentes
- Dentro de US1: T004 e T005 juntos
- Entre stories: T014, T018, T020 e T022 são arquivos distintos e independentes

---

## Parallel Example: depois do checkpoint da Fase 2

```bash
Task: "Criar tests/indexnow.test.mjs com os casos de extração e filtro"   # T004 [US1]
Task: "Criar docs/bing-webmaster.md com os passos do painel"              # T014 [US2]
Task: "Criar src/pages/llms.txt.ts no formato llmstxt.org"                # T018 [US3]
Task: "Criar src/pages/rss.xml.ts com @astrojs/rss"                       # T022 [US4]
```

---

## Implementation Strategy

### MVP (só US1)

1. Fase 1 → Fase 2 → Fase 3
2. **PARE E VALIDE**: `npm test` verde, deploy feito, log do container mostrando a submissão
3. Já entrega o valor central — indexação em horas — sem nenhuma outra story

### Entrega incremental

1. US1 → deploy → confirmar o log (MVP)
2. US2 → painel do Bing verificado → agora o resultado da US1 é observável
3. US3 → `/llms.txt` e `robots.txt` no ar → lane GEO/AEO aberto
4. US4 → `/rss.xml` no ar

US2 é a que mais paga quando vem logo depois da US1: sem ela, a submissão funciona mas ninguém consegue conferir.

---

## Notes

- `[P]` = arquivos diferentes, sem dependência pendente
- Commit por task ou por grupo lógico
- T015, T016 e T017 são passos de painel — o output deles é documentação, não código
- Nenhuma task adiciona dependência além do `@astrojs/rss` da T001
