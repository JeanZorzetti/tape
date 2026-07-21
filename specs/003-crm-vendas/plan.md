# Implementation Plan: CRM de Vendas — cadência, follow-up, funil e categorias

**Branch**: `003-crm-vendas` | **Date**: 2026-07-21 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/003-crm-vendas/spec.md`

## Summary

Estender o CRM `/admin` existente (leads, status, próximo contato, notas — Postgres sem
ORM, zero JS no client, tudo por form POST + PRG) com quatro frentes: cadência de 6 toques
até a 1ª venda, carteira pós-venda por pedidos com recontato a cada 30 dias, funil de
conversão por coorte histórica e classificação de leads por nicho. **Sem dependências
novas**: 3 tabelas novas (`tentativas`, `pedidos`, `transicoes`), 1 coluna nova
(`leads.nicho`), extensões em `src/lib/crm.ts`/`adminUi.ts`, e uma página nova
(`/admin/funil`). Detalhe e lista do lead ganham painéis; a carteira é uma visão da própria
lista.

## Technical Context

**Language/Version**: TypeScript sobre **Astro 5** (SSR via `@astrojs/node` standalone), Node 20+

**Primary Dependencies**: `astro`, `postgres` (já instalados) — **nenhuma dependência nova**

**Storage**: PostgreSQL via pool único em `src/lib/crm.ts` (sem ORM, sem migration tool; schema aplicado com `create table if not exists` na 1ª consulta). Novas: tabelas `tentativas`, `pedidos`, `transicoes`; coluna `leads.nicho`

**Testing**: `node --test` (`tests/**/*.test.mjs`, runner já no `package.json`) — unit nos helpers puros (cadência, funil, carteira) + integração contra Postgres (build + `DATABASE_URL`, padrão já usado)

**Target Platform**: VPS Easypanel (Docker); rotas `/admin/*` e `/api/*` com `export const prerender = false`

**Project Type**: Web — projeto Astro único (site público SSG + `/admin` SSR). Sem front/back separados

**Performance Goals**: funil abre em < 5 s (SC-004); registrar tentativa e ver próximo passo em < 30 s (SC-002); dezenas a poucas centenas de leads

**Constraints**: **zero JavaScript no client** no `/admin` (form POST + redirect/PRG, como hoje); valores de pedido **nunca** expostos no site público; fuso `America/Sao_Paulo`; WCAG AA (foco visível, contraste medido — regras do `CLAUDE.md`)

**Scale/Scope**: 1 representante autenticado; ~1 nova rota, ~2 páginas estendidas, ~3 tabelas

## Constitution Check

*GATE: passar antes da Phase 0; reavaliar após a Phase 1.*

`.specify/memory/constitution.md` é o **template não preenchido** (placeholders) — sem
princípios ratificados. Os portões reais vêm do `CLAUDE.md` (clean code + anti-"cara de IA"
+ ponytail) e do `handoff.md` (arquitetura travada do `/admin`):

| Portão (fonte) | Regra | Status |
|---|---|---|
| Zero JS no client (handoff) | `/admin` é form POST + PRG, sem JS de client | ✅ mantido — todos os painéis novos são forms POST |
| Postgres sem ORM (handoff) | schema `create table if not exists`, idempotente, aplicado no 1º uso | ✅ tabelas novas seguem o mesmo `aplicarSchema` |
| DRY / fonte única (CLAUDE.md) | reusar `crm.ts`, `adminUi.ts`, `STATUS_LEAD`, padrões visuais | ✅ estende módulos existentes; `NICHOS` espelha `STATUS_LEAD` |
| Sem dependência nova (ponytail) | não adicionar libs para o que 3 tabelas + SQL resolvem | ✅ zero libs novas |
| Sem preço no público (CLAUDE.md/handoff) | valores de venda só no `/admin` | ✅ `pedidos` vivem sob sessão, `noindex` |
| a11y AA (CLAUDE.md) | foco visível, contraste medido, HTML semântico | ✅ reusa tokens/inputs já aprovados |

**Resultado: PASS** — nenhuma violação; nada a registrar em Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/003-crm-vendas/
├── plan.md              # Este arquivo
├── research.md          # Phase 0 — decisões de design
├── data-model.md        # Phase 1 — tabelas, colunas, transições
├── quickstart.md        # Phase 1 — roteiro de validação ponta a ponta
├── contracts/
│   └── crm-and-forms.md # Phase 1 — assinaturas de crm.ts + ações de form + rotas
└── checklists/
    └── requirements.md  # (do /speckit-specify)
```

### Source Code (repository root)

```text
src/
├── lib/
│   ├── crm.ts          # ESTENDER: schema (tentativas/pedidos/transicoes/nicho),
│   │                   #   registrarTentativa, inserirPedido, registrarTransicao,
│   │                   #   listarCarteira, contarCarteiraVencida, funilCoorte, backfill
│   ├── adminUi.ts      # ESTENDER: NICHOS[], nichoLabel, proximaDataCadencia,
│   │                   #   cadenciaEsgotada, formatarBRL, vencidoCarteira
│   └── quoteForm.ts    # (inalterado — tipoFitaLabel reusado)
├── pages/admin/
│   ├── index.astro     # ESTENDER: filtro por nicho + visão "carteira" + contadores
│   ├── [id].astro      # ESTENDER: painel cadência (tentativas), painel pedidos, seletor de nicho
│   └── funil.astro     # NOVO: contagens por etapa + 3 taxas + período + por nicho
├── layouts/
│   └── AdminLayout.astro # ESTENDER: link "Funil" no header do CRM
└── pages/api/
    └── lead.ts         # ESTENDER: gravar transicao inicial (novo) ao inserir lead

tests/
├── cadencia.test.mjs   # unit: proximaDataCadencia, cadenciaEsgotada
├── funil.test.mjs      # unit: cálculo das taxas de coorte (helper puro)
└── crm-vendas.test.mjs # integração: pedido fecha lead + agenda carteira; backfill idempotente
```

**Structure Decision**: projeto Astro único já existente. A feature **adiciona** a
`src/lib/crm.ts`/`adminUi.ts` e a `/admin/*`, sem novos diretórios nem nova arquitetura —
espelha o que já está no ar. A carteira e as categorias reusam a lista (`index.astro`) via
query param; só o funil ganha rota própria.

## Complexity Tracking

*Sem violações de constituição — seção não aplicável.*
