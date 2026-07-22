---
description: "Task list — Multi-pipeline: pipeline de recuperação outbound"
---

# Tasks: Multi-pipeline — pipeline de recuperação outbound

**Input**: Design documents from `specs/004-pipeline-recuperacao/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/crm-e-import.md](./contracts/crm-e-import.md)

**Tests**: incluídos — o projeto tem suíte `node:test` (`tests/`) e o handoff pede teste de import idempotente. Testes de integração pulam sem `DATABASE_URL` (padrão de `tests/crm-vendas.test.mjs`).

**Organização**: tarefas agrupadas por user story (P1 → P2 → P3), cada uma independentemente testável.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: pode rodar em paralelo (arquivos diferentes, sem dependência pendente)
- **[Story]**: US1 / US2 / US3 (mapeia à spec)
- Caminhos de arquivo exatos nas descrições

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: baseline verde antes de mexer. Sem dependências novas, sem scaffolding (a feature estende arquivos existentes).

- [X] T001 Rodar `npm test` e `npm run build` para confirmar baseline verde antes de qualquer mudança (documenta o ponto de partida; nenhuma dependência a instalar — o parser de CSV é próprio, ver [research.md](./research.md) D2).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: o discriminador de pipeline, a config de etapas/papéis e o schema. **Bloqueia todas as user stories.**

**⚠️ CRITICAL**: nenhuma US começa antes desta fase.

- [X] T002 [Foundational] Em [src/lib/adminUi.ts](../../src/lib/adminUi.ts): adicionar `PIPELINES` (config `{ label, stages[], roles }` para `inbound` e `recuperacao`), tipos `Pipeline`/`Stage`/`Roles`, helpers `isPipeline`, `statusesDaPipeline`, `rolesDaPipeline`, o `Set` `TERMINAIS` (todos os `ganho`+`perdido`), 5 entradas novas em `CLS_STATUS` (`a_contatar/contatado/interessado/recuperado/descartado`), e trocar em `estaAtrasado`/`vencidoCarteira` o teste literal `status !== 'fechado' && status !== 'perdido'` por `!TERMINAIS.has(status)`. (ver [data-model.md](./data-model.md) e [contracts/crm-e-import.md](./contracts/crm-e-import.md) §4)
- [X] T003 [Foundational] Em [src/lib/crm.ts](../../src/lib/crm.ts): (a) schema delta idempotente em `aplicarSchema` (colunas `pipeline`/`dados_import`/`import_ref`, índices, `drop not null` de `nome`/`tipo_fita`/`quantidade` — DDL da [data-model.md](./data-model.md)); (b) estender interface `Lead` com `pipeline` e `dados_import` (e `nome`/`tipo_fita`/`quantidade` nullable); (c) sourcing da taxonomia a partir de `PIPELINES` do adminUi: `STATUS_LEAD = PIPELINES.inbound.stages`, `isStatus(v, pipeline?)`, `statusLabel(v)` global. Depende de T002.

**Checkpoint**: schema e config prontos — US1/US2/US3 podem começar.

---

## Phase 3: User Story 1 — Pipeline de recuperação como funil separado (Priority: P1) 🎯 MVP

**Goal**: seletor de pipeline no header e todas as visões (lista, contadores, funil, carteira, cadência) escopadas por pipeline, com etapas próprias da recuperação.

**Independent Test**: com 1 lead inbound + 1 lead de recuperação no banco, alternar o seletor e confirmar que cada visão mostra só a pipeline selecionada; avançar etapa de um lead de recuperação oferece `a_contatar → … → descartado`.

### Implementation for User Story 1

- [X] T004 [US1] Em [src/lib/crm.ts](../../src/lib/crm.ts): escopar por `pipeline` (param default `'inbound'`) as 7 leituras — `listarLeads` (novo `ORDER BY` de "tem canal"→`confianca=alta`→`criado_em`, ver [research.md](./research.md) D5; validar `status` contra a pipeline), `contarPorStatus`, `contarAtrasados` (excluir terminais da pipeline via papéis/`TERMINAIS`), `listarCarteira`, `contarCarteiraVencida`, `funilCoorte` (param `pipeline`; `bool_or` usa `roles.primeiro_toque/meio/ganho` da pipeline), `distribuicaoPorNicho`. Depende de T003.
- [X] T005 [US1] Em [src/lib/crm.ts](../../src/lib/crm.ts): escritas por papel — `registrarTentativa` promove `roles.inicial → roles.primeiro_toque` da pipeline do lead (hoje `'novo'→'em_contato'`); `inserirPedido` seta `roles.ganho` do lead no 1º pedido (hoje `'fechado'`). Depende de T003 (mesmo arquivo que T004 → após T004).
- [X] T006 [P] [US1] Em [src/layouts/AdminLayout.astro](../../src/layouts/AdminLayout.astro): seletor de pipeline no header (Inbound × Recuperação, troca `?pipeline=`, default ausente = inbound); propagar `?pipeline=` nos links de nav (Leads/Carteira/Funil). Depende de T003.
- [X] T007 [US1] Em [src/pages/admin/index.astro](../../src/pages/admin/index.astro): ler `?pipeline=`; repassar às leituras escopadas; iterar `statusesDaPipeline(pipeline)` nos chips/filtros de status; mostrar `ramo`/`cidade_uf` (de `dados_import`) na linha quando `recuperacao`; `linkAdmin` preserva `pipeline`. Depende de T004, T006.
- [X] T008 [US1] Em [src/pages/admin/funil.astro](../../src/pages/admin/funil.astro): ler `?pipeline=`; `funilCoorte(periodo, pipeline, nicho)` **e** `distribuicaoPorNicho(periodo, pipeline)`; iterar `statusesDaPipeline(pipeline)` na contagem por etapa; rótulos das 3 taxas derivados dos labels das etapas da pipeline; `linkFunil` preserva `pipeline`. Depende de T004, T006.
- [X] T009 [P] [US1] Criar [tests/pipeline-recuperacao.test.mjs](../../tests/pipeline-recuperacao.test.mjs): integração (pula sem `DATABASE_URL`) — escopo não vaza entre inbound×recuperação; 1º toque num lead `recuperacao` leva `a_contatar → contatado`; 1º pedido leva a `recuperado` e agenda carteira +30d. Depende de T004, T005.

**Checkpoint**: US1 funcional e testável — MVP.

---

## Phase 4: User Story 2 — Dados da prospecção editáveis no detalhe (Priority: P2)

**Goal**: no detalhe de um lead de recuperação, seção "Dados da prospecção" com todas as colunas da planilha como campos pré-preenchidos e editáveis (exceto `arquivo`/`confianca`), salvando e ressincronizando os campos operacionais.

**Independent Test**: abrir um lead de recuperação, editar o WhatsApp, salvar, reabrir → valor persistiu e o botão "Chamar no WhatsApp" usa o novo número; lead inbound não mostra a seção.

### Implementation for User Story 2

- [X] T010 [US2] Em [src/lib/crm.ts](../../src/lib/crm.ts): `salvarDadosImport(id, dados)` — grava `dados_import` (merge, preservando `arquivo`/`confianca`) e ressincroniza `empresa`, `telefone` (`whatsapp||telefone`), `email`, `cnpj` (ver [contracts/crm-e-import.md](./contracts/crm-e-import.md) §3). Depende de T003 (mesmo arquivo → após T005).
- [X] T011 [US2] Em [src/pages/admin/[id].astro](../../src/pages/admin/[id].astro): ficha/saudação pipeline-aware (tratar `nome`/`tipo_fita` nulos na recuperação); dropdown de status usa `statusesDaPipeline(lead.pipeline)`; renderizar seção "Dados da prospecção" quando `lead.pipeline === 'recuperacao'` (um campo por chave, rótulo humano + Title-case p/ desconhecidas, `arquivo`/`confianca` read-only); tratar `acao=dados-import` no POST (PRG). Depende de T010, T003.
- [X] T012 [P] [US2] Estender [tests/pipeline-recuperacao.test.mjs](../../tests/pipeline-recuperacao.test.mjs): `salvarDadosImport` persiste `dados_import` e ressincroniza `empresa/telefone/email/cnpj`. Depende de T010.

**Checkpoint**: US1 e US2 funcionam independentemente.

---

## Phase 5: User Story 3 — Script de importação idempotente (Priority: P3)

**Goal**: script re-executável que importa a planilha bruta como leads `recuperacao/a_contatar`, idempotente, com relatório. **Não** executado contra produção nesta feature.

**Independent Test**: rodar contra banco de teste com amostra (aspas internas, linha sem empresa, empresa repetida) → contagem correta; 2ª execução insere 0.

### Implementation for User Story 3

- [X] T013 [P] [US3] Criar [scripts/importar-recuperacao.mjs](../../scripts/importar-recuperacao.mjs): `parseCsv(texto)` puro (descarta BOM; respeita aspas duplas, `""` escapado e vírgula/quebra internas); para cada linha com `empresa`, `insert into leads (...) on conflict (import_ref) do nothing returning id` com `pipeline='recuperacao'`, `status='a_contatar'`, `dados_import` = 12 colunas, `import_ref=arquivo|empresa`, colunas espelhadas mapeadas; `registrarTransicao(id, null, 'a_contatar')` por id inserido; relatório `inseridos/pulados/sem-empresa`. Reusa `db`/`registrarTransicao` de `src/lib/crm.ts` (ver [contracts/crm-e-import.md](./contracts/crm-e-import.md) §6). Depende de T003.
- [X] T014 [P] [US3] Criar [tests/importar-recuperacao.test.mjs](../../tests/importar-recuperacao.test.mjs): unit `parseCsv` (self-check `assert`, sempre roda) — linha `ALKAN,"CORTINAS, PERSIANAS, TOLDOS, TAPETES",…` vira ramo único; integração (pula sem `DATABASE_URL`) — import de amostra idempotente (2ª execução insere 0), linha sem empresa pulada. Depende de T013.

**Checkpoint**: as 3 user stories funcionais e independentes.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T015 [P] Conferir privacidade: `docs/leads-bruto.csv` **não** aparece em `dist/` público após `npm run build`; `/admin` mantém `noindex` (FR-023/FR-024, SC-006).
- [X] T016 Atualizar handoff: registrar o estado da pipeline de recuperação em `docs/handoffs/` (o `handoff.md` da raiz foi movido para lá), marcando que o import **não** foi rodado em produção.
- [X] T017 Rodar [quickstart.md](./quickstart.md) fim a fim + `npm test` (com e sem `DATABASE_URL`) + `npm run build` — tudo verde.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (T001)**: sem dependências.
- **Foundational (T002→T003)**: T003 depende de T002. **Bloqueia todas as US.**
- **US1 (T004–T009)**, **US2 (T010–T012)**, **US3 (T013–T014)**: começam após Foundational.
  - US3 depende só de T003 → pode rodar **em paralelo** com US1/US2 (arquivos diferentes: script + teste).
- **Polish (T015–T017)**: após as US desejadas.

### Within crm.ts (mesmo arquivo — sequencial)

T003 → T004 → T005 → T010 (todas em `src/lib/crm.ts`, sem `[P]` entre si).

### Parallel Opportunities

- T006 (AdminLayout), T009 (teste US1), T013/T014 (script+teste US3), T012 (teste US2), T015 (privacidade) tocam arquivos distintos → `[P]` conforme marcado.
- Após T003, um dev toca US1 (crm+páginas) enquanto outro toca US3 (script) sem conflito.

---

## Parallel Example: após Foundational

```bash
# Story P1 (crm.ts + páginas) e Story P3 (script) em paralelo:
Task T004/T005/T007/T008: escopo por pipeline + páginas admin
Task T013: scripts/importar-recuperacao.mjs (parser + upsert idempotente)
```

---

## Implementation Strategy

### MVP First (US1)

1. T001 (baseline) → T002/T003 (Foundational) → T004–T009 (US1).
2. **PARAR e VALIDAR**: seletor + escopo + etapas próprias funcionando isolados.

### Incremental Delivery

Foundational → US1 (MVP: funil separado) → US2 (enriquecimento no detalhe) → US3 (import em massa). Cada uma agrega valor sem quebrar a anterior; o inbound permanece idêntico (SC-002) o tempo todo.

---

## Notes

- `[P]` = arquivos diferentes, sem dependência pendente.
- Testes de integração pulam sem `DATABASE_URL` — `npm test` fica verde só com os unit.
- Commit após cada task ou grupo lógico.
- Evitar: dependências cruzadas entre US que quebrem a independência; edições concorrentes no mesmo arquivo (`crm.ts` é sequencial).
