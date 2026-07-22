# Implementation Plan: Multi-pipeline — pipeline de recuperação outbound

**Branch**: `004-pipeline-recuperacao` | **Date**: 2026-07-22 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/004-pipeline-recuperacao/spec.md`

## Summary

Adicionar uma **segunda pipeline lógica** (`recuperacao`) ao CRM existente sem criar CRM nem
tabela nova. A abordagem é um **discriminador `pipeline`** na tabela `leads` + `dados_import`
(JSONB com a linha crua da planilha) + `import_ref` (chave de idempotência). Toda a máquina que já
existe — cadência de 6 toques, carteira, funil por coorte, notas, transições — é **reusada**,
apenas **escopada por pipeline** nas leituras.

O ponto técnico central: a decisão do usuário de **etapas próprias por pipeline** bate em funções
que hoje têm etapas *hardcoded* (`funilCoorte`, `registrarTentativa`, `inserirPedido`,
`contarAtrasados`). Como as duas pipelines têm correspondência **1:1 de papéis** (inicial /
primeiro-toque / meio / ganho / perdido), a solução mínima é uma tabela de configuração
`PIPELINES` mapeando pipeline → (etapas, papéis), e trocar os literais por lookup de papel. Nenhuma
lógica de negócio é duplicada.

## Technical Context

**Language/Version**: TypeScript (Astro components + `src/lib`), Node 22.18 ESM para scripts `.mjs`, SQL (PostgreSQL). Node 22.18 faz *type-stripping* por padrão — scripts `.mjs` importam `.ts` direto (é assim que os testes já rodam).

**Primary Dependencies**: Astro 5 (SSR via `@astrojs/node`), Tailwind 4, `postgres` (postgres.js). Sem novas dependências (parser CSV é ~25 linhas próprias — não há lib de CSV instalada e um `split(",")` quebra em campos com aspas).

**Storage**: PostgreSQL. Uma tabela `leads` **estendida** (3 colunas novas + 3 `not null` afrouxados); zero migração de dados (default cobre os existentes).

**Testing**: `node --test tests/**/*.test.mjs`. Testes de integração batem no data-layer (`crm.ts`) contra um Postgres descartável; **pulam** sem `DATABASE_URL` (padrão de `crm-vendas.test.mjs`). Parser CSV com self-check `assert` no próprio script.

**Target Platform**: Servidor Node (SSR do `/admin`) + build estático do site público.

**Project Type**: Web app — site SEO estático + CRM SSR sob `/admin` (sessão, `noindex`), zero-JS no cliente (form POST + PRG).

**Performance Goals**: N/A operacional (um operador, ~500 leads outbound + inbound). Listas já limitadas a 300; nenhuma tela nova de volume.

**Constraints**: `/admin` zero-JS e `noindex` (mantido); import é **script CLI**, **não** executado contra produção nesta feature; dado de prospecção nunca em rota pública/sitemap/build.

**Scale/Scope**: ~503 leads de recuperação + inbound atual. 7 funções de leitura escopadas, 3 funções de escrita ajustadas por papel, 1 função nova (`salvarDadosImport`), 1 ação de form nova (`dados-import`), 1 seletor no header, 1 seção no detalhe, 1 script de import.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` está **não preenchido** (só o template com placeholders) — não há
princípios ratificados que imponham gates. Nenhuma violação a rastrear. As diretrizes efetivas do
projeto vêm do `CLAUDE.md` (clean code, zero-JS no `/admin`, reuso antes de reescrever) e são
respeitadas por construção: a feature **reusa** a máquina do CRM em vez de duplicá-la.

**Resultado**: PASS (sem gates). Nenhuma entrada em Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/004-pipeline-recuperacao/
├── plan.md              # Este arquivo
├── spec.md              # Especificação (já criada)
├── research.md          # Fase 0 (este comando)
├── data-model.md        # Fase 1 (este comando)
├── quickstart.md        # Fase 1 (este comando)
├── contracts/
│   └── crm-e-import.md   # Fase 1: assinaturas de crm.ts, ação de form, contrato do script
└── checklists/
    └── requirements.md  # Já criado no /speckit-specify
```

### Source Code (repository root)

```text
src/
├── lib/
│   ├── adminUi.ts      # ALTERAR: PIPELINES + papéis + helpers + TERMINAIS (lar da config,
│   │                   #         evita ciclo de import); CLS_STATUS + 5 etapas novas;
│   │                   #         estaAtrasado/vencido passam a usar TERMINAIS
│   └── crm.ts          # ALTERAR: schema delta; reexporta STATUS_LEAD/isStatus/statusLabel de
│                       #         PIPELINES; escopar 7 leituras; ajustar 3 escritas por papel;
│                       #         salvarDadosImport() nova; Lead ganha pipeline/dados_import
├── layouts/
│   └── AdminLayout.astro # ALTERAR: seletor de pipeline (Inbound × Recuperação) no header,
│                         #          preserva ?pipeline= nos links de nav
└── pages/
    └── admin/
        ├── index.astro   # ALTERAR: thread ?pipeline=; lista mostra ramo/cidade_uf na
        │                 #          recuperação; chips/contadores escopados
        ├── [id].astro    # ALTERAR: status por pipeline; ficha/saudação pipeline-aware;
        │                 #          seção "Dados da prospecção" + acao=dados-import
        └── funil.astro   # ALTERAR: thread ?pipeline=; etapas e rótulos das taxas por pipeline

scripts/
└── importar-recuperacao.mjs # NOVO: parser CSV (aspas+BOM) + upsert idempotente por import_ref

tests/
├── importar-recuperacao.test.mjs # NOVO: parser (unit, sempre roda) + import idempotente
│                                 #       (integração, pula sem DATABASE_URL)
└── crm-vendas.test.mjs           # (existente; referência de padrão de teste de integração)
```

**Structure Decision**: Projeto Astro único já existente. Nenhuma estrutura nova de diretórios — a
feature vive nos arquivos que já implementam o CRM (`src/lib/crm.ts`, `src/lib/adminUi.ts`, as 3
páginas de `/admin`, o `AdminLayout`) + 1 script e 1 teste novos. Isso concretiza a decisão do
handoff de reusar o CRM agnóstico de pipeline via discriminador.

## Complexity Tracking

> Sem violações de constituição — seção vazia por design (não há gates ratificados).
