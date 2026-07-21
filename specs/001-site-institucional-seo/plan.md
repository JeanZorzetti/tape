# Implementation Plan: Site Institucional SEO-first (TapePro — fitas adesivas)

**Branch**: `001-site-institucional-seo` | **Date**: 2026-07-21 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/001-site-institucional-seo/spec.md`

## Summary

Site estático SEO-first para o representante comercial **oficial autorizado** da TapePro (fitas adesivas personalizadas, B2B). Não há transação online: a conversão é geração de lead por orçamento (WhatsApp com mensagem pré-preenchida + formulário entregue a um serviço de formulário). O ganho competitivo é profundidade de conteúdo long-tail (blog, páginas de aplicação por segmento, FAQ) que nem o site oficial nem os concorrentes líderes têm. Abordagem técnica: **Astro (SSG) + Tailwind v4**, conteúdo em Content Collections (Markdown/MDX validadas por Zod), JS mínimo (ilhas só para formulário, menu mobile e a animação-assinatura), SEO técnico completo (JSON-LD, sitemap, canonical, OG), imagens reais otimizadas pelo pipeline do Astro, alcance **nacional temático** (schema de Organização, sem páginas locais).

## Technical Context

**Language/Version**: TypeScript 5.x sobre Node 22; Astro 5.x

**Primary Dependencies**: Astro 5, Tailwind CSS v4 (`@tailwindcss/vite`), `@astrojs/sitemap`, `@astrojs/mdx`, `sharp` (otimização de imagem, embutido), fontes self-hosted via `@fontsource-variable/*`. Envio de formulário via serviço externo (Web3Forms) — sem backend próprio.

**Storage**: Nenhum banco. Conteúdo em arquivos (Content Collections). Leads não são persistidos pelo site: vão para e-mail do representante (via serviço de formulário) e/ou WhatsApp.

**Testing**: `astro check` (tipos/conteúdo) + Playwright e2e (smoke por rota, um `<h1>`, metas presentes, JSON-LD válido, `alt` em imagens, link de WhatsApp correto, sem imagem quebrada) + orçamento de Lighthouse (Perf/A11y/SEO/Best Practices). Teste unitário só para lógica não-trivial (montador de link do WhatsApp, validação do formulário).

**Target Platform**: Hospedagem estática de borda (Cloudflare Pages ou Netlify) + navegadores modernos; mobile-first.

**Project Type**: Web — site de conteúdo estático (SSG), sem servidor de aplicação.

**Performance Goals**: Core Web Vitals no "bom" (LCP < 2.5s, CLS < 0.1, INP < 200ms em 4G móvel); Lighthouse ≥ 90 nas 4 categorias; JS de rota comum próximo de 0 (ilhas sob demanda).

**Constraints**: JS mínimo (hidratação parcial), sem layout shift, WCAG AA, `prefers-reduced-motion` respeitado, PT-BR, sem placeholders de imagem, identidade visual conforme regras anti-"cara de IA" do `CLAUDE.md`.

**Scale/Scope**: Lançamento ~20–30 páginas (home, 3 produtos + índice, 4 segmentos + índice, FAQ, sobre, orçamento, ≥6 posts + índice do blog). Cresce por adição de posts/produtos sem mudança estrutural.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` ainda é o template não preenchido — **não há princípios ratificados/gates formais**. Na ausência dele, adoto o `CLAUDE.md` do projeto como guardrail de fato:

| Guardrail (CLAUDE.md) | Como o plano atende |
|---|---|
| Clean Code — Constants Over Magic Numbers | `src/lib/constants.ts` central (WhatsApp, pedido mínimo, +1.000 empresas, specs) |
| Design anti-"cara de IA" | Token system ancorado em fita adesiva (ver research.md), sem template genérico/azul/gradiente |
| Simplicidade (ponytail) | SSG puro, zero backend, deps mínimas; formulário via serviço externo em vez de servidor próprio |
| DRY / Single Responsibility | Componentes de SEO/JSON-LD e layouts reutilizáveis; uma fonte de verdade por entidade de conteúdo |

**Resultado do gate**: PASS (sem violações a justificar). Complexity Tracking vazio.

## Project Structure

### Documentation (this feature)

```text
specs/001-site-institucional-seo/
├── plan.md              # Este arquivo
├── research.md          # Fase 0 — decisões técnicas + token system de design
├── data-model.md        # Fase 1 — Content Collections + entidade Lead
├── quickstart.md        # Fase 1 — como scaffoldar, rodar e validar
├── contracts/           # Fase 1 — contratos de conteúdo, formulário, dados estruturados, rotas/SEO
│   ├── content-collections.md
│   ├── quote-form.md
│   ├── structured-data.md
│   └── routing-seo.md
└── tasks.md             # Fase 2 — gerado por /speckit-tasks (NÃO por /speckit-plan)
```

### Source Code (repository root)

O site vive na raiz do repositório (o projeto é o próprio site). O clone `awesome-cursorrules/` é referência e fica fora do build.

```text
astro.config.mjs
package.json
tsconfig.json
public/
├── robots.txt
├── favicon / og estáticos
└── (assets que não passam por otimização)
src/
├── assets/                 # fotos REAIS dos produtos (otimizadas pelo Astro)
├── components/
│   ├── seo/                # Seo.astro, JsonLd.astro
│   ├── quote/              # QuoteForm (ilha), WhatsAppCta.astro
│   ├── layout/             # Header, Nav (menu mobile = ilha), Footer
│   └── ui/                 # TapeStrip (assinatura), SpecTable, Card, Eyebrow
├── content/
│   ├── config.ts           # schemas Zod das coleções
│   ├── produtos/           # 3 produtos (MDX)
│   ├── segmentos/          # indústria, distribuidor, e-commerce, lojas (MDX)
│   ├── blog/               # posts long-tail (MDX)
│   └── faq/                # itens de FAQ (MD/JSON)
├── layouts/                # BaseLayout, ProductLayout, ArticleLayout
├── pages/                  # rotas com URLs limpas em PT (ver contracts/routing-seo.md)
├── styles/                 # tokens.css (design tokens), global.css
└── lib/                    # constants.ts, whatsapp.ts, seo.ts
tests/
└── e2e/                    # Playwright: smoke, a11y, schema, links, imagens
```

**Structure Decision**: single project (site estático). Coleções de conteúdo separam produto/segmento/blog/FAQ; rotas dinâmicas (`[slug].astro`) geram páginas a partir das coleções. Ilhas de cliente restritas a formulário, menu mobile e à animação-assinatura; todo o resto é HTML estático.

## Complexity Tracking

> Sem violações de constituição — nada a justificar.
