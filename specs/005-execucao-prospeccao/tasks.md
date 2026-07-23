---
description: "Task list — Execução da prospecção (scripts na ficha e ritmo do dia)"
---

# Tasks: Execução da prospecção — scripts na ficha e ritmo do dia

**Input**: Design documents from `specs/005-execucao-prospeccao/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/internal.md](contracts/internal.md), [quickstart.md](quickstart.md)

**Tests**: Incluídos — o projeto mantém suíte `node --test` (specs 003/004) e a lógica desta feature (mapa
passo→script, substituição de placeholder, query do contador) é não-trivial. Escrever o teste antes da
implementação em cada caso.

**Organization**: Agrupadas por user story. US1 (scripts) é o MVP; US2 (ritmo) é increment independente.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: pode rodar em paralelo (arquivos diferentes, sem dependência pendente)
- **[Story]**: US1 | US2

## Path Conventions

Single-project Astro: `src/lib/`, `src/pages/admin/`, `tests/` na raiz. Caminhos conforme
[plan.md](plan.md) → Project Structure.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Âncora de regressão antes de tocar qualquer arquivo.

- [ ] T001 Rodar `npm test` e `npm run build` e confirmar verdes; confirmar que **nenhuma dependência nova**
  e **nenhuma mudança de schema** são necessárias (a feature reusa `tentativas`).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: O único arquivo tocado por ambas as stories (`src/lib/adminUi.ts`) — editado uma vez aqui para
evitar conflito entre as fases.

**⚠️ CRITICAL**: US1 usa `instagramUrl`; US2 usa `META_TOQUES_DIA`. Fazer antes das duas.

- [ ] T002 Adicionar em `src/lib/adminUi.ts`: `META_TOQUES_DIA` (default **20**, override por env
  `META_TOQUES_DIA`, garantido `> 0`) e o helper puro `instagramUrl(bruto: string | null): string | null`
  (normaliza `@x` / `x` / `instagram.com/x` / link → `https://instagram.com/x`; `null` se implausível).

**Checkpoint**: Helpers compartilhados prontos — US1 e US2 podem seguir em paralelo (arquivos distintos).

---

## Phase 3: User Story 1 - Script certo na ficha do lead (Priority: P1) 🎯 MVP

**Goal**: Na ficha de um lead de recuperação, mostrar o script do nicho e do passo atual, com empresa/nome
preenchidos e ação de contato pronta (WhatsApp com msg, ou link de Instagram + DM copiável).

**Independent Test**: Abrir um lead de recuperação com nicho e 0 tentativas → vê o 1º toque com empresa
preenchida e WhatsApp pronto; registrar 1 tentativa → o script vira o follow-up D+1.

### Tests for User Story 1

- [ ] T003 [P] [US1] Criar `tests/scripts.test.mjs`: `passoDoLead` (0→0, 1→1, 6→5, 99→5); `montarScript` não
  deixa `[placeholder]` cru (com e sem `nome`); `scriptDoLead` retorna texto não-vazio para **todo** valor de
  `NICHOS` + `null` + `"outro"`; `instagramUrl` cobre formatos mistos → URL / `null`. Devem falhar antes de T004.

### Implementation for User Story 1

- [ ] T004 [US1] Criar `src/lib/scripts.ts`: `passoDoLead(nToques)`, `montarScript(template, {empresa, nome?})`
  (degradação sem placeholder cru), `scriptDoLead(nicho, nToques)` (mapa por nicho × 6 passos + `generico`),
  `OBJECOES`. Textos derivados de [`docs/estrategia-prospeccao.md`](../../docs/estrategia-prospeccao.md) §4.
  Faz T003 passar.
- [ ] T005 [US1] Em `src/pages/admin/[id].astro`, renderizar o bloco **"Script de abordagem"** só quando
  `lead.pipeline === "recuperacao"`: `montarScript(scriptDoLead(lead.nicho, nToques), { empresa: lead.empresa,
  nome: lead.nome ?? undefined })`, com rótulo do passo (1º toque … despedida) coerente com "toque N de 6".
- [ ] T006 [US1] Na mesma seção, a **ação de contato** na ordem: `lead.telefone` → botão WhatsApp
  `whatsappParaNumero(lead.telefone, <script>)`; senão `instagramUrl(lead.dados_import?.instagram)` → link
  "Abrir Instagram" + texto de DM copiável; senão só o texto copiável. Sem erro em nenhum caso.
- [ ] T007 [US1] Exibir as `OBJECOES` como referência na mesma seção (`<details>`, zero-JS); garantir que o
  bloco **não** aparece para inbound e não altera nenhum form/ação existente da página.

**Checkpoint**: US1 funcional e testável sozinha — é o MVP; pode ser demonstrada/entregue.

---

## Phase 4: User Story 2 - Ritmo do dia: toques feitos vs. meta (Priority: P2)

**Goal**: Na lista do `/admin`, mostrar as tentativas de hoje na pipeline selecionada vs. a meta diária.

**Independent Test**: Sem toques hoje → "0 / 20"; registrar 2 toques → "2 / 20"; alternar pipeline muda o
número (escopo); virada do dia → volta a 0.

### Tests for User Story 2

- [ ] T008 [P] [US2] Criar `tests/execucao-prospeccao.test.mjs` (integração; pula sem `DATABASE_URL`):
  `contarToquesHoje` conta só tentativas de **hoje** (America/Sao_Paulo) e só da **pipeline** dada; tentativa
  de ontem no fuso local e de outra pipeline não contam. Deve falhar antes de T009.

### Implementation for User Story 2

- [ ] T009 [US2] Adicionar `contarToquesHoje(pipeline?: Pipeline): Promise<number>` em `src/lib/crm.ts` —
  `count` em `tentativas` com `join leads`, filtro `(criado_em at time zone 'America/Sao_Paulo')::date =
  (now() at time zone 'America/Sao_Paulo')::date` e `pipeline`. Padrão de `contarAtrasados`. Faz T008 passar.
- [ ] T010 [US2] Em `src/pages/admin/index.astro`, ler `contarToquesHoje(pipelineSelecionada)` e exibir
  **"N / META_TOQUES_DIA toques hoje"** no cabeçalho da lista, escopado à pipeline já selecionada; sem divisão
  por zero.
- [ ] T011 [US2] Comunicar o estado **"meta batida"** (`N >= META_TOQUES_DIA`) por rótulo/ícone além de cor
  (FR-012, acessibilidade).

**Checkpoint**: US1 e US2 funcionam independentes.

---

## Phase 5: Polish & Cross-Cutting Concerns

- [ ] T012 Rodar o roteiro de [quickstart.md](quickstart.md) (US1: 9 checagens; US2: 5) e confirmar
  **regressão zero** em cadência, funil, carteira, ordenação, notas e "Dados da prospecção".
- [ ] T013 [P] Verificação visual via Playwright em 1440 e 390 (bloco de scripts e contador): sem overflow
  horizontal, foco visível, contraste AA, `<details>` das objeções abre sem JS.
- [ ] T014 [P] Atualizar [`docs/handoffs/handoff.md`](../../docs/handoffs/handoff.md) (seção CRM `/admin`) com
  a feature 005 e apontar o `/admin/estrategia` como o playbook irmão.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (T001)**: sem dependências.
- **Foundational (T002)**: depende de T001; **bloqueia** US1 e US2 (ambas usam `adminUi.ts`).
- **US1 (T003–T007)** e **US2 (T008–T011)**: dependem de T002; entre si são **independentes** (arquivos
  distintos: `scripts.ts`/`[id].astro` × `crm.ts`/`index.astro`).
- **Polish (T012–T014)**: depende das stories desejadas prontas.

### Within Each User Story

- US1: T003 (teste) → T004 (scripts.ts) → T005 → T006 → T007 (mesma página, sequenciais).
- US2: T008 (teste) → T009 (crm) → T010 → T011 (mesma página, sequenciais).

### Parallel Opportunities

- T003 e T008 (testes de stories diferentes) podem ser escritos em paralelo.
- Depois de T002, US1 e US2 rodam em paralelo (equipes/sessões diferentes) — nenhum arquivo em comum.
- Na Polish, T013 e T014 são `[P]`.

---

## Parallel Example: após T002

```text
# Sessão A (MVP):
T003 → T004 → T005 → T006 → T007   (scripts na ficha)

# Sessão B (em paralelo):
T008 → T009 → T010 → T011          (contador de ritmo)
```

---

## Implementation Strategy

### MVP First (US1)

1. T001 (Setup) → T002 (Foundational) → T003–T007 (US1).
2. **PARAR e VALIDAR**: testar US1 pelo quickstart (scripts na ficha, WhatsApp/Instagram, cadência avança).
3. Deploy/demo — já entrega valor sozinho.

### Incremental Delivery

1. Setup + Foundational → base pronta.
2. US1 → validar → deploy (MVP).
3. US2 → validar → deploy.
4. Polish → quickstart completo + handoff.

---

## Notes

- Total: **14 tarefas** — Setup 1, Foundational 1, US1 5, US2 4, Polish 3.
- `[P]` = arquivos diferentes, sem dependência pendente.
- Sem schema novo, sem dependência nova, zero-JS no client — reusa `tentativas`, `NICHOS`, `CADENCIA_DIAS`,
  `whatsappParaNumero`.
- Commitar após cada tarefa ou grupo lógico; parar em qualquer checkpoint para validar a story isolada.
