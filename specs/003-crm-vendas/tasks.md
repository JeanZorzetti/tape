---
description: "Task list for CRM de Vendas (003)"
---

# Tasks: CRM de Vendas — cadência, follow-up, funil e categorias

**Input**: Design documents from `specs/003-crm-vendas/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/crm-and-forms.md](contracts/crm-and-forms.md)

**Tests**: incluídos apenas onde o plano/quickstart pediram — os helpers puros de cadência e funil (unit) e a regra de negócio do 1º pedido (integração). Não há suíte por função; cada lógica não-trivial deixa uma verificação runnable.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: pode rodar em paralelo (arquivo diferente, sem dependência pendente)
- **[Story]**: US1–US4 (mapeia as user stories do spec.md)
- Caminhos de arquivo são absolutos ao repo (raiz do projeto)

**Realidade do codebase**: a maioria das tarefas edita `src/lib/crm.ts`, `src/lib/adminUi.ts` e `src/pages/admin/[id].astro` — arquivos compartilhados. Por isso o paralelismo real é baixo: `[P]` só aparece entre arquivos distintos (helpers × schema × testes × páginas).

---

## Phase 1: Setup

**Purpose**: ambiente para desenvolver e validar o `/admin` localmente

- [ ] T001 Subir Postgres descartável e preencher `.env` (DATABASE_URL, SESSION_SECRET, ADMIN_EMAIL, ADMIN_SENHA) conforme [quickstart.md](quickstart.md) — sem isso nenhuma story valida

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: constantes compartilhadas + o log de transições de etapa (espinha usada por US1/US2/US3). Registrar transições desde já faz o funil (US3) ter histórico real mesmo se entregar depois.

**⚠️ CRITICAL**: nenhuma user story começa antes desta fase.

- [ ] T002 Adicionar constantes e formatador de dinheiro em `src/lib/adminUi.ts`: `NICHOS` (industria, distribuidor, ecommerce, lojas, outro), `CANAIS`, `RESULTADOS`, `CADENCIA_DIAS = [0,1,3,7,14,21]`, `RECONTATO_CARTEIRA_DIAS = 30`, `nichoLabel(v)`, `formatarBRL(centavos)` — mesmo formato de `STATUS_LEAD`
- [ ] T003 Adicionar tabela `transicoes` + índices (`_lead_idx`, `_para_idx`) ao `aplicarSchema()` em `src/lib/crm.ts` (schema por `create table if not exists`)
- [ ] T004 Implementar `registrarTransicao(leadId, de, para)` em `src/lib/crm.ts`
- [ ] T005 Registrar transição no ciclo de vida do lead em `src/lib/crm.ts`: `inserirLead` grava `null → 'novo'`; `atualizarLead` grava a transição **só quando o status muda de fato**
- [ ] T006 Adicionar backfill idempotente (`null → status atual`, `criado_em = lead.criado_em`, `where not exists`) ao `aplicarSchema()` em `src/lib/crm.ts` — semeia leads pré-existentes uma única vez

**Checkpoint**: fundação pronta — as user stories podem começar.

---

## Phase 3: User Story 1 — Fluxo de cadência até a 1ª venda (Priority: P1) 🎯 MVP

**Goal**: sequência disciplinada de 6 toques que sempre aponta o próximo passo; nenhum lead ativo sem próximo contato.

**Independent Test**: cadastrar lead → registrar tentativas em sequência → cada tentativa fica no histórico, o próximo contato é sugerido e editável, o lead aparece como vencido quando a data passa, e após o 6º toque o sistema sinaliza cadência esgotada (sem marcar Perdido sozinho).

- [ ] T007 [US1] Adicionar tabela `tentativas` + índice `tentativas_lead_idx` ao `aplicarSchema()` em `src/lib/crm.ts`
- [ ] T008 [P] [US1] Implementar `proximaDataCadencia(nToques, baseISO)` (retorna `null` quando esgota) e `cadenciaEsgotada(nToques)` em `src/lib/adminUi.ts`
- [ ] T009 [P] [US1] Unit test dos helpers de cadência em `tests/cadencia.test.mjs`: as 6 datas D+0,+1,+3,+7,+14,+21; `null` após o 6º; `cadenciaEsgotada` vira `true` no 6º
- [ ] T010 [US1] Implementar `registrarTentativa(leadId, canal, resultado, observacao?, proximoContato?)` e `contarTentativas(leadId)` em `src/lib/crm.ts` (depende de T007)
- [ ] T011 [US1] Painel de cadência em `src/pages/admin/[id].astro`: form (canal, resultado, observacao, `proximoContato` **pré-preenchido com a data sugerida**, editável), timeline das tentativas, aviso de "cadência esgotada" após o 6º toque
- [ ] T012 [US1] Tratar `POST acao=tentativa` em `src/pages/admin/[id].astro`: validar `canal`/`resultado` contra as constantes, `observacao` ≤ 500, status → `em_contato` no 1º toque, atualizar `proximo_contato`, PRG

**Checkpoint**: US1 funcional e testável sozinha — MVP entregável.

---

## Phase 4: User Story 2 — Follow-up pós-venda / carteira (Priority: P2)

**Goal**: registrar pedidos (data + R$ + volume), transformar o lead em cliente ao 1º pedido e manter recontato de carteira a cada 30 dias.

**Independent Test**: registrar o 1º pedido fecha o lead e agenda recontato +30d; ele aparece em `?visao=carteira`; um 2º pedido reagenda; pausar carteira o tira da fila sem perder histórico.

- [ ] T013 [US2] Adicionar tabela `pedidos` + índice `pedidos_lead_idx` ao `aplicarSchema()` em `src/lib/crm.ts`
- [ ] T014 [P] [US2] Implementar `vencidoCarteira(proximoContato, temPedido, hoje)` em `src/lib/adminUi.ts`
- [ ] T015 [US2] Implementar `inserirPedido(leadId, data, valorCentavos, volumeRolos)` como **transação** em `src/lib/crm.ts`: se 1º pedido → status `fechado` + `registrarTransicao(...,'fechado')` + `proximo_contato = data + 30`; senão → `proximo_contato = max(data) + 30` (depende de T013, T004)
- [ ] T016 [US2] Implementar `listarPedidos`, `listarCarteira({nicho?})` (filtro `nicho` **condicional** — só anexa a cláusula quando fornecido, para não referenciar `leads.nicho` antes de T025), `contarCarteiraVencida`, `pausarCarteira`, `reagendarCarteira` em `src/lib/crm.ts`
- [ ] T017 [P] [US2] Teste de integração em `tests/crm-vendas.test.mjs` (build + `DATABASE_URL`): 1º pedido fecha e agenda +30d; 2º só reagenda; `aplicarSchema` rodado 2× não duplica transições
- [ ] T018 [US2] Painel de pedidos em `src/pages/admin/[id].astro`: form (`data` default hoje, `valor` em R$ → centavos no servidor, `volume`), histórico de pedidos, "última compra" + "próximo recontato", botões **"registrar recontato"** e **"pausar carteira"**; tratar `acao=pedido`, `acao=recontato-carteira` e `acao=pausar-carteira` (PRG)
- [ ] T019 [US2] Visão carteira em `src/pages/admin/index.astro`: `?visao=carteira` (clientes ordenados por `proximo_contato`, vencidos destacados via `vencidoCarteira`) + contador de carteira vencida

**Checkpoint**: US1 e US2 funcionam independentemente.

---

## Phase 5: User Story 3 — Funil de vendas por coorte (Priority: P3)

**Goal**: contagem por etapa e as três taxas (lead→fechado, em contato→fechado, orçado→fechado) por coorte histórica, com período.

**Independent Test**: abrir `/admin/funil` mostra contagem por etapa + 3 taxas; trocar `?periodo` muda a coorte; etapa sem base mostra "—"; leads pré-existentes contam (backfill).

- [ ] T020 [P] [US3] Implementar helper puro `taxasFunil(counts)` em `src/lib/adminUi.ts` (3 taxas; divisor zero → `null`)
- [ ] T021 [P] [US3] Unit test de `taxasFunil` em `tests/funil.test.mjs` (taxas corretas em cenários montados; zero → `null`)
- [ ] T022 [US3] Implementar `funilCoorte(periodo)` em `src/lib/crm.ts`: contagem por status + "chegou à etapa" via `transicoes`, coorte por `leads.criado_em`; usa `taxasFunil` (depende da fundação — `transicoes`)
- [ ] T023 [US3] Criar `src/pages/admin/funil.astro`: contagem por etapa, 3 taxas, alternância `?periodo=mes|ano|tudo` (default `mes`), estado vazio/"—"; `noindex` via AdminLayout + guarda de sessão
- [ ] T024 [P] [US3] Adicionar link "Funil" no header do CRM em `src/layouts/AdminLayout.astro`

**Checkpoint**: US1, US2 e US3 independentes.

---

## Phase 6: User Story 4 — Categorias por nicho (Priority: P4)

**Goal**: classificar leads por nicho, filtrar a lista e cruzar o funil por nicho.

**Independent Test**: atribuir nicho a um lead → filtrar `?nicho=` retorna só ele; ver distribuição por nicho; no funil, filtrar por nicho recalcula as taxas.

- [ ] T025 [US4] Adicionar coluna `leads.nicho` (`add column if not exists`) ao `aplicarSchema()` em `src/lib/crm.ts`
- [ ] T026 [US4] Implementar `definirNicho(leadId, nicho)` (valida contra `NICHOS`) e estender `listarLeads` para aceitar filtro `nicho` em `src/lib/crm.ts`
- [ ] T027 [US4] Implementar `distribuicaoPorNicho(periodo?)` em `src/lib/crm.ts` (`group by nicho`)
- [ ] T028 [US4] Adicionar `<select>` de nicho ao painel "Situação" em `src/pages/admin/[id].astro`; persistir **junto no `acao=salvar`** (handler chama `definirNicho`), validando contra `NICHOS`
- [ ] T029 [US4] Filtro por nicho em `src/pages/admin/index.astro` (`?nicho=`) + contadores de distribuição por nicho
- [ ] T030 [US4] Estender `funilCoorte` para aceitar `nicho` opcional (`src/lib/crm.ts`) e adicionar controle de nicho a `src/pages/admin/funil.astro` (funil por nicho) — depende de T022, T023, T025

**Checkpoint**: todas as quatro user stories independentes e funcionais.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [ ] T031 [P] Rodar a validação ponta a ponta do [quickstart.md](quickstart.md) (US1–US4) contra o Postgres local
- [ ] T032 [P] Passada visual/a11y nos painéis novos e no funil em 1440/1024/390 (Playwright): sem overflow horizontal, foco de teclado visível, contraste WCAG AA, 1 `h1` por página — piso do `CLAUDE.md`
- [ ] T033 `npm run build` + `npm run verificar` (confirmar que `/admin` segue `noindex` e as páginas públicas/SEO não regrediram) + `npm test`
- [ ] T034 Atualizar a seção "CRM `/admin`" do `handoff.md` com as tabelas novas (`tentativas`/`pedidos`/`transicoes`), `leads.nicho` e a rota `/admin/funil`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sem dependências.
- **Foundational (Phase 2)**: depende do Setup — **bloqueia todas as user stories** (constantes + log de transições).
- **User Stories (Phase 3–6)**: dependem da Foundational. Podem então seguir em ordem de prioridade (P1→P2→P3→P4) ou em paralelo se houver braços — mas editam arquivos comuns (`crm.ts`, `adminUi.ts`, `[id].astro`), então paralelismo real é limitado.
- **Polish (Phase 7)**: depende das stories desejadas estarem prontas.

### User Story Dependencies

- **US1 (P1)**: só depende da Foundational. É o MVP.
- **US2 (P2)**: depende da Foundational (usa `registrarTransicao` no `inserirPedido`). Independente de US1.
- **US3 (P3)**: depende da Foundational (lê `transicoes`). Independente de US1/US2 — mesmo sem US2, fechar status manual já loga transição e o funil funciona.
- **US4 (P4)**: núcleo (coluna + filtro + distribuição) independente. Só **T030** (funil por nicho) depende de US3 (`funil.astro`, `funilCoorte`).

### Within Each Story

- Schema (tabela/coluna) antes das funções de `crm.ts` que a usam.
- Helpers puros de `adminUi.ts` e seus testes antes ou em paralelo à UI que os consome.
- Funções de `crm.ts` antes das páginas que as chamam.

### Parallel Opportunities

- Foundational: T002 (adminUi) é arquivo diferente de T003–T006 (crm) — mas T003–T006 são sequenciais entre si.
- Testes (`tests/*.test.mjs`) são sempre `[P]` — arquivos próprios.
- `AdminLayout.astro` (T024) é `[P]` frente a tudo em `crm.ts`.
- Dentro de uma story, o helper em `adminUi.ts` roda `[P]` com o schema em `crm.ts`.

## Parallel Example: User Story 1

```text
# Após a Foundational, estes tocam arquivos distintos e rodam juntos:
T007  tabela tentativas         → src/lib/crm.ts
T008  helpers de cadência       → src/lib/adminUi.ts        [P]
T009  unit test da cadência     → tests/cadencia.test.mjs   [P]
# T010→T012 são sequenciais (crm.ts depois [id].astro).
```

---

## Implementation Strategy

### MVP First (só US1)

1. Phase 1 (Setup) → Phase 2 (Foundational) → Phase 3 (US1).
2. **PARE e valide** US1 pelo teste independente + quickstart §US1.
3. Deploy/demo: já entrega disciplina de cadência de 1ª venda.

### Incremental Delivery

Foundational pronta → US1 (MVP) → US2 (carteira) → US3 (funil) → US4 (nicho). Cada story
soma valor sem quebrar as anteriores; valide e faça deploy a cada checkpoint.

## Notes

- `[P]` = arquivo diferente, sem dependência pendente.
- Commit após cada task ou grupo lógico (padrão do projeto: subir para `main`).
- Dinheiro sempre em centavos inteiros; nunca float (money path).
- Zero JS no client em todo o `/admin` — tudo form POST + redirect (PRG).
- Verificar os testes falharem antes de implementar (T009, T017, T021).
