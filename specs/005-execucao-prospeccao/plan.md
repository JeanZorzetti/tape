# Implementation Plan: Execução da prospecção — scripts na ficha e ritmo do dia

**Branch**: `005-execucao-prospeccao` | **Date**: 2026-07-23 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/005-execucao-prospeccao/spec.md`

## Summary

Colocar o playbook de prospecção dentro do CRM: (1) na ficha de um lead da pipeline **recuperação**,
mostrar o script de abordagem do **nicho** e do **passo da cadência** atual (derivado de `tentativas.length`),
com empresa/nome preenchidos, um botão de WhatsApp com a mensagem pronta e — para leads só de Instagram —
link do perfil + DM copiável; (2) na lista do `/admin`, um contador de **toques do dia** (tentativas de hoje
na pipeline selecionada) vs. **meta diária**. Abordagem técnica: **conteúdo estruturado num módulo novo**
(`src/lib/scripts.ts`), **uma função de leitura nova** em `crm.ts` (`contarToquesHoje`), e display por cima
da ficha e da lista existentes. **Sem mudança de schema, sem nova dependência, zero-JS no client.**

## Technical Context

**Language/Version**: TypeScript, Astro 5 (SSG + adapter Node `@astrojs/node` standalone para `/admin` e `/api`)

**Primary Dependencies**: Astro, Tailwind v4, `postgres` (sem ORM). **Nenhuma dependência nova.**

**Storage**: PostgreSQL. **Sem alteração de esquema** — reusa a tabela `tentativas` (spec 003) para ambas as
frentes: `tentativas.length` por lead dirige o script; a contagem de hoje por pipeline dirige o contador.

**Testing**: `node --test` em `tests/` (unit dos helpers puros; integração com `DATABASE_URL` para a query
do contador). Verificação visual manual via Playwright MCP, como nas features anteriores.

**Target Platform**: Web (páginas `/admin/*` renderizadas no servidor Node; deploy Easypanel/VPS).

**Project Type**: Web app single-project (Astro).

**Performance Goals**: N/A crítico — operação de um representante, dezenas–centenas de leads. Uma query
extra de contagem por carregamento da lista (índice já existente por pipeline).

**Constraints**: **Zero-JS no client** (form POST + PRG, ou links `<a>`). Tudo sob `/admin` autenticado e
`noindex`. Fuso America/Sao_Paulo. Sem placeholders crus em mensagens. WCAG AA e foco visível (padrão do CRM).

**Scale/Scope**: 2 páginas tocadas (`[id].astro`, `index.astro`), 1 módulo novo (`scripts.ts`), +1 função de
leitura e 1–2 constantes/helpers em `adminUi.ts`/`crm.ts`. Sem migração de dados.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

A constituição do projeto (`.specify/memory/constitution.md`) está em estado de **template não ratificado**
(sem princípios preenchidos), então não impõe gates formais. Valem as convenções do projeto (`CLAUDE.md`) e o
padrão das specs 003/004, contra os quais este plano é avaliado:

| Princípio de fato (CLAUDE.md / specs 003–004) | Status | Observação |
|---|---|---|
| Reusar a máquina existente, não duplicar | ✅ | Reusa `tentativas`, `NICHOS`, `CADENCIA_DIAS`, `whatsappParaNumero`; nada de tabela/CRM novo. |
| Zero-JS no client (PRG) | ✅ | Scripts e contador são display + links `<a>`; sem nova ação de escrita. |
| Sem nova dependência | ✅ | Só TS/Astro/Tailwind já presentes. |
| Sob `/admin`, autenticado, `noindex` | ✅ | Ambas as frentes vivem em páginas `/admin` já protegidas. |
| Teste para lógica não-trivial | ✅ | Mapa passo→script, substituição de placeholder e query do contador ganham teste. |
| Ponytail (mínimo que funciona) | ✅ | Scripts como constante no app (decisão travada no clarify); sem conferência contra o doc até doer. |

**Gate: PASS.** Nenhuma violação a justificar (Complexity Tracking vazio).

## Project Structure

### Documentation (this feature)

```text
specs/005-execucao-prospeccao/
├── plan.md              # Este arquivo
├── research.md          # Phase 0 — decisões (mapa de passo, "hoje" no fuso, Instagram URL, placeholders)
├── data-model.md        # Phase 1 — entidades (scripts no app, meta, reuso de tentativa/nicho); sem DDL
├── quickstart.md        # Phase 1 — roteiro de validação ponta a ponta
├── contracts/
│   └── internal.md      # Phase 1 — contratos internos: scripts.ts, crm.contarToquesHoje, adições de UI
└── tasks.md             # Phase 2 — /speckit-tasks (não criado aqui)
```

### Source Code (repository root)

```text
src/
├── lib/
│   ├── scripts.ts       # NOVO — conteúdo estruturado: SCRIPTS[nicho][passo], objeções, fallback;
│   │                    #        montarScript() (substitui placeholders com degradação), passoDoLead().
│   ├── adminUi.ts       # +META_TOQUES_DIA (default 20, override por env) e instagramUrl() (helper puro).
│   ├── crm.ts           # +contarToquesHoje(pipeline) — tentativas de hoje (America/Sao_Paulo) por pipeline.
│   └── whatsapp.ts      # reuso de whatsappParaNumero(telefone, texto) — sem mudança.
└── pages/admin/
    ├── [id].astro       # +bloco "Script de abordagem" (só recuperação): texto do passo atual, botão de
    │                    #  WhatsApp com a msg pronta, link de Instagram quando só há @, objeções.
    └── index.astro      # +contador "N / meta toques hoje" no cabeçalho da lista (pipeline selecionada).

tests/
├── scripts.test.mjs             # NOVO — passoDoLead, montarScript (sem [placeholder] cru), cobertura de nichos.
└── execucao-prospeccao.test.mjs # NOVO — integração: contarToquesHoje conta só hoje/pipeline; zera na virada.
```

**Structure Decision**: Single-project Astro. A feature é uma **camada de leitura/apresentação** sobre a ficha
([`src/pages/admin/[id].astro`](../../src/pages/admin/[id].astro)) e a lista
([`src/pages/admin/index.astro`](../../src/pages/admin/index.astro)) existentes, com a lógica pura isolada em
`src/lib/scripts.ts` e um único acréscimo de query em [`src/lib/crm.ts`](../../src/lib/crm.ts). Segue o padrão
das specs 003/004: helpers puros em `lib/` (testáveis sem banco), leituras em `crm.ts`, render nas páginas.

## Complexity Tracking

> Sem violações de constituição — nada a justificar.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |
