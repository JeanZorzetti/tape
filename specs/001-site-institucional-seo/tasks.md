---
description: "Task list — Site Institucional SEO-first (TapePro)"
---

# Tasks: Site Institucional SEO-first (TapePro — fitas adesivas)

**Input**: Design documents from `specs/001-site-institucional-seo/`

**Prerequisites**: plan.md, spec.md (US1–US4), research.md, data-model.md, contracts/

**Tests**: incluídos de forma enxuta (Playwright smoke/SEO/a11y + unit para WhatsApp/formulário + orçamento Lighthouse), conforme os Success Criteria e o quickstart. Não é TDD completo de UI.

**Organization**: tarefas agrupadas por história de usuário para implementação e teste independentes.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: pode rodar em paralelo (arquivos diferentes, sem dependência pendente)
- **[Story]**: US1–US4 (só nas fases de história)
- Caminhos de arquivo assumem site estático na raiz do repositório (ver plan.md)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: inicialização do projeto Astro e ferramentas.

- [x] T001 Inicializar projeto Astro (template minimal, TypeScript strict) na raiz — `astro.config.mjs`, `package.json`, `tsconfig.json`
- [x] T002 Adicionar integrações e deps: `npx astro add mdx sitemap`; instalar Tailwind v4 (`@tailwindcss/vite`) e fontes (`@fontsource-variable/archivo`, `ibm-plex-sans`, `ibm-plex-mono`) — atualizar `astro.config.mjs` e `package.json`
- [x] T003 [P] Configurar entrada do Tailwind v4 em `src/styles/global.css` e plugin `@tailwindcss/vite` no `astro.config.mjs`
- [ ] T004 [P] Configurar lint/format (ESLint + Prettier + `prettier-plugin-astro`) — `.eslintrc.cjs`, `.prettierrc`
- [ ] T005 [P] Configurar testes: Playwright (`playwright.config.ts`, pasta `tests/e2e/`) e orçamento Lighthouse (`lighthouserc.json` + script npm)
- [x] T006 Criar esqueleto de pastas conforme plan.md — `src/{components/{seo,quote,layout,ui},content,layouts,pages,lib,assets,styles}`, `public/`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: infraestrutura compartilhada por TODAS as histórias.

**⚠️ CRITICAL**: nenhuma história começa antes desta fase.

- [x] T007 [P] Definir design tokens em `src/styles/tokens.css` (paper/kraft/ink/amber/steel + escala de tipo + espaçamento) conforme research.md §3
- [x] T008 [P] Self-host das fontes (Archivo / IBM Plex Sans / IBM Plex Mono) e aplicação nos estilos base em `src/styles/global.css`
- [x] T009 Ligar o tema do Tailwind aos tokens (`@theme`/config) para as utilidades usarem as CSS vars — `src/styles/global.css` (depende de T007)
- [x] T010 [P] Criar `src/lib/constants.ts` (`WHATSAPP_NUMERO`, `PEDIDO_MINIMO_ROLOS=20`, `EMPRESAS_ATENDIDAS=1000`, `SITE_URL`, `NOME_MARCA`, e-mail de destino do lead)
- [x] T011 Criar schemas das coleções em `src/content.config.ts` (segmentos, blog, faq) — API nova do Astro 5 (`loader: glob()/file()`), não a sintaxe `type: 'content'` do contrato. `produtos` continua em `src/lib/produtos.ts`; no lugar de `reference('produtos')`, um `z.enum` dos slugs reais dá a mesma integridade no build
- [x] T012 [P] Criar componente `src/components/seo/Seo.astro` (title/description/canonical/OG/Twitter) conforme contracts/structured-data.md
- [x] T013 [P] Criar componente `src/components/seo/JsonLd.astro` com helpers Organization/Product/FAQPage/BlogPosting/BreadcrumbList
- [x] T014 [P] Criar `src/lib/whatsapp.ts` (montador do link `wa.me` com texto pré-preenchido + página de origem) e `src/components/quote/WhatsAppCta.astro`
- [x] T015 [P] Criar componente-assinatura `src/components/ui/TapeStrip.astro` (faixa diagonal de fita impressa; desliga animação com `prefers-reduced-motion`)
- [ ] T016 [P] Criar UI base: `src/components/ui/{Card,Eyebrow,SpecTable,Figure}.astro` (Figure força `alt` e `aspect-ratio`)
- [x] T017 [P] Criar `src/components/layout/Header.astro` + `Nav.astro` (menu mobile como ilha)
- [x] T018 [P] Criar `src/components/layout/Footer.astro` (contato, WhatsApp, mapa de links)
- [x] T019 Criar `src/layouts/BaseLayout.astro` (usa Seo + JsonLd Organization + Header/Footer + `lang="pt-BR"` + skip-link) — depende de T009, T012, T013, T017, T018
- [x] T020 [P] Configurar `@astrojs/sitemap` no `astro.config.mjs` e criar `public/robots.txt` conforme contracts/routing-seo.md
- [ ] T021 [P] Configurar pipeline de imagem do Astro e convenções em `src/assets/` (AVIF/WebP, dimensões obrigatórias) documentadas junto ao `Figure`

**Checkpoint**: fundação pronta — histórias podem começar.

---

## Phase 3: User Story 1 — Encontrar por long-tail e cair em página com SEO + CTA (Priority: P1) 🎯 MVP

**Goal**: capacidade de SEO técnico por página, provada na home, com o caminho para orçamento presente.

**Independent Test**: a home tem SEO completo (h1 único, title/meta/canonical/OG, JSON-LD Organization válido), está no sitemap e oferece caminho de orçamento — atinge Lighthouse ≥90 em SEO.

- [x] T022 [US1] Construir a home `src/pages/index.astro` com BaseLayout, hero com a assinatura TapeStrip, proposta de valor, teasers de produto, diferenciais e CTA (WhatsAppCta) — copy real
- [x] T023 [US1] Aplicar SEO completo na home: title/meta/canonical/OG via `Seo.astro` + JSON-LD Organization via `JsonLd.astro`
- [ ] T024 [P] [US1] Teste Playwright `tests/e2e/seo.spec.ts`: home tem um `<h1>`, title/meta/canonical/OG presentes, JSON-LD parseia como Organization, home aparece no sitemap
- [ ] T025 [P] [US1] Rodar Lighthouse na home (Perf/A11y/Best Practices/SEO ≥ 90) via script do T005

**Checkpoint**: home no ar, SEO por página validado e reutilizável pelas demais páginas.

---

## Phase 4: User Story 2 — Solicitar orçamento (WhatsApp + formulário) (Priority: P1)

**Goal**: funil de conversão confiável em ≤ 2 cliques de qualquer página.

**Independent Test**: de qualquer página, CTA leva a WhatsApp (link correto, mensagem pré-preenchida com origem) e ao formulário; envio válido entrega o lead e mostra sucesso; inválido mostra erro; honeypot descarta.

- [ ] T026 [P] [US2] Teste unit `tests/unit/whatsapp.test.ts` para `src/lib/whatsapp.ts` (encoding, origem, contexto de produto)
- [x] T027 [US2] Construir a ilha `src/components/quote/QuoteForm.astro` (+ TS mínimo): campos conforme contracts/quote-form.md, validação client-side (nativa + CNPJ 14 dígitos), honeypot, POST Web3Forms, estados de sucesso/erro, acessibilidade. Sem chave → fallback WhatsApp com os dados. Helpers em `src/lib/quoteForm.ts`.
- [x] T028 [US2] Construir `src/pages/orcamento.astro` (BaseLayout + QuoteForm + opção WhatsApp + JSON-LD Organization via BaseLayout)
- [x] T029 [US2] CTA de conversão: link `/orcamento` no Header (≤1 clique de qualquer página) + WhatsAppCta em todos os CTAs
- [ ] T030 [P] [US2] Teste Playwright `tests/e2e/quote.spec.ts`: CTA alcançável da home/produto em ≤2 cliques, link WhatsApp correto, formulário renderiza e valida, honeypot descarta — *verificado manualmente via Playwright evaluate; arquivo de teste não criado (sem test runner ainda)*
- [x] T031 [US2] ~~Access key do Web3Forms~~ **substituído**: o form grava direto no Postgres via `POST /api/lead` e os leads vivem no `/admin` (CRM próprio). `.env.example` documenta `DATABASE_URL`, `SESSION_SECRET`, `ADMIN_EMAIL`, `ADMIN_SENHA`.

**Checkpoint**: US1 + US2 = MVP de geração de leads publicável.

---

## Phase 5: User Story 3 — Avaliar produtos, diferenciais e credibilidade (Priority: P2)

**Goal**: páginas de produto ricas + institucional com prova social e diferenciais.

**Independent Test**: cada página de produto mostra specs, foto real (com alt) e aplicações, expõe Product JSON-LD válido e CTA; diferenciais (mín. 20 rolos, +1.000 empresas) visíveis e consistentes.

- [x] T032 [P] [US3] Autorar 3 entradas em `src/lib/produtos.ts` (specs, aplicações, benefícios, imagem/alt) — módulo TS tipado no lugar de content collection: 3 itens estáticos não pagam loader + zod; migra quando o blog (US4) chegar
- [x] T033 [US3] Construir índice `src/pages/produtos/index.astro` (lista da coleção em cards)
- [x] T034 [US3] Construir detalhe `src/pages/produtos/[slug].astro` (SpecTable, imagens via Figure, aplicações, JSON-LD Product + BreadcrumbList, CTA)
- [x] T035 [P] [US3] Construir institucional `src/pages/sobre.astro` (quem somos + diferenciais + prova social) usando constants.ts
- [x] T036 [P] [US3] Adicionar fotos reais dos produtos em `src/assets/` com `alt` correto (bloqueante: exige as fotos reais)
- [ ] T037 [P] [US3] Teste Playwright `tests/e2e/produtos.spec.ts`: cada produto tem specs, imagem+alt, Product JSON-LD válido e CTA presente

**Checkpoint**: produtos e institucional funcionais e testáveis.

---

## Phase 6: User Story 4 — Conteúdo educativo long-tail (blog + aplicações + FAQ) (Priority: P2)

**Goal**: profundidade de conteúdo que captura busca long-tail (a lacuna dos concorrentes) e alimenta as demais páginas com links internos.

**Independent Test**: segmentos, posts e FAQ publicados, cada um com SEO/JSON-LD do tipo certo, links internos para produtos e CTA; rascunhos ficam fora do sitemap.

- [x] T038 [P] [US4] Autorar 4 segmentos em `src/content/segmentos/{industria,distribuidor,e-commerce,lojas}.mdx` (dores, produtosRelacionados, imagem/alt)
- [x] T039 [US4] Construir `src/pages/segmentos/index.astro` + `src/pages/segmentos/[slug].astro` (BreadcrumbList JSON-LD, links para produtos, CTA)
- [x] T040 [P] [US4] Autorar 7 posts em `src/content/blog/*.mdx`, cada um mirando uma `intencao`/long-tail, com links internos e imagem/alt
- [x] T041 [US4] Construir `src/pages/blog/index.astro` + `src/pages/blog/[slug].astro` (JSON-LD BlogPosting + BreadcrumbList, produtos/segmentos relacionados, CTA)
- [x] T042 [P] [US4] Autorar itens de FAQ em `src/content/faq/perguntas.json` e construir `src/pages/perguntas-frequentes.astro` (JSON-LD FAQPage — único do site)
- [ ] T043 [P] [US4] Teste Playwright `tests/e2e/conteudo.spec.ts`: blog/segmento/FAQ com schema válido, links internos para produtos e CTA; rascunhos excluídos do sitemap — **segue aberta** (sem test runner instalado). Cobertura parcial por `npm run verificar` (`scripts/verificar-seo.mjs`): h1 único, JSON-LD parseável, canonical, description ≤ 160, alt, órfãs e links quebrados nas 21 páginas

**Checkpoint**: todas as histórias independentemente funcionais.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: acabamento que cruza histórias.

- [x] T044 [P] Construir `src/pages/404.astro` (noindex, links úteis/busca) — sem busca (21 páginas: lista resolve sem JS). Prop `noindex` nova no `Seo.astro`. Confirmado no servidor Node real: status 404 + `<meta robots noindex>`, fora do sitemap.
- [x] T045 Auditar linkagem interna e órfãs (produtos ↔ segmentos ↔ posts; nenhuma página indexável órfã) conforme contracts/routing-seo.md — `npm run verificar`: 22 páginas, nenhuma órfã, nenhum link interno quebrado. A `/404` é exceção declarada (não é linkada; em troca o script exige que ela seja noindex).
- [x] T046 [P] Passe de acessibilidade: foco de teclado visível, `prefers-reduced-motion` desliga a animação da TapeStrip, contraste WCAG AA nos tokens — **Lighthouse a11y 100** nas 3 páginas. Ver "Decisões de contraste" abaixo.
- [x] T047 [P] Auditar imagens em `dist/` (sem placeholder, sem imagem quebrada, dimensões setadas → CLS ok) — virou regra permanente no `verificar` (arquivo existe em disco, `width`/`height`, teto de 200 KB). Pegou o hero em 251 KB e o logo com aspecto errado (150×50 declarado, 1627×1167 real).
- [x] T048 Rodar orçamento Lighthouse em home + uma página de produto + um post (falha se abaixo das metas) — **home 93 · produto 95 · post 91**; a11y/best-practices/SEO **100** nas três. CLS ≤ 0,028, TBT 0 ms.
- [x] T049 [P] Deploy no **Easypanel (VPS)**: app Node via `Dockerfile` + serviço Postgres no mesmo projeto, env `DATABASE_URL`/`SESSION_SECRET`/`ADMIN_EMAIL`/`ADMIN_SENHA`, domínio `tapepro.roilabs.com.br` com TLS. (Cloudflare Pages saiu de cena: Worker não fala TCP com Postgres.) — no ar em https://tapepro.roilabs.com.br
- [x] T050 Executar os cenários de validação do quickstart.md ponta a ponta — validado contra produção. Falta só colar o JSON-LD no Rich Results Test do Google (cenário 1).

### Decisões de contraste (T046) — não reabrir sem medir

Os pares foram medidos com alpha composto sobre o fundo real, não estimados. Quatro reprovavam:

| Par | Antes | Depois |
| --- | --- | --- |
| Branco sobre a faixa laranja (CTA de 10 páginas + botão primário) | 2,71:1 | **navy sobre laranja, 4,53:1** |
| `text-orange` como texto em superfície clara (eyebrows) | 2,55:1 | **`--color-orange-800` #8f4408, 6,6:1** |
| `text-steel` sobre `kraft-100` | 4,29:1 | **#66635c, 4,84:1** |
| Anel de foco laranja sobre `paper` | 2,55:1 | **anel duplo: tinta + laranja, ≥ 4,53:1 nos 3 fundos** |

- O laranja da marca (`#f47c20`) continua intacto como **fundo** e como texto **sobre navy** (4,53:1). O que mudou é quem escreve em cima dele.
- `--color-orange-400` (#f89138) existe porque o hover do botão precisa **clarear**: o rótulo agora é navy, e escurecer para `orange-600` derrubaria o par para 3,55:1.
- A `TapeStrip` também passou a navy — é `aria-hidden`, mas é o mesmo par visual da faixa de CTA.
- Duas correções de a11y não-cromáticas que o axe pegou: `<td>` sem cabeçalho em duas tabelas de post (a 1ª coluna estava sob um `<th>` vazio → viraram "Critério") e `ink/60` a 4,43:1 na FAQ.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sem dependências — começa já.
- **Foundational (Phase 2)**: depende do Setup — BLOQUEIA todas as histórias. Ordem interna: T007→T009; T012/T013/T017/T018→T019.
- **User Stories (Phase 3–6)**: dependem da Foundational. US1 e US2 são P1 (US1 primeiro por ser MVP demonstrável; US2 completa o funil). US3 e US4 (P2) podem seguir em paralelo após a fundação.
- **Polish (Phase 7)**: depois das histórias desejadas.

### User Story Dependencies

- **US1 (P1)**: após Foundational. Sem dependência de outras histórias.
- **US2 (P1)**: após Foundational. Usa o WhatsAppCta (T014, foundational); independente de US1 para teste.
- **US3 (P2)**: após Foundational. Independente; consome componentes base.
- **US4 (P2)**: após Foundational. Usa `reference()` para produtos (T032 idealmente antes de T039/T041 para links internos resolverem; senão, links entram depois).

### Parallel Opportunities

- Setup: T003, T004, T005 em paralelo.
- Foundational: T007, T008, T010, T012, T013, T014, T015, T016, T017, T018, T020, T021 em paralelo (T009 e T019 são pontos de junção).
- Após a fundação: US3 e US4 por pessoas diferentes; dentro de cada história, tarefas [P] (autoria de conteúdo e testes) em paralelo.

---

## Parallel Example: Foundational

```bash
Task: "T007 tokens.css (design tokens)"
Task: "T008 self-host de fontes"
Task: "T012 Seo.astro"
Task: "T013 JsonLd.astro"
Task: "T014 whatsapp.ts + WhatsAppCta"
Task: "T015 TapeStrip (assinatura)"
# junção: T009 (tema Tailwind) e depois T019 (BaseLayout)
```

---

## Implementation Strategy

### MVP First

1. Phase 1 (Setup) → Phase 2 (Foundational).
2. Phase 3 (US1): home + SEO por página → **validar** (Lighthouse/schema).
3. Phase 4 (US2): funil de orçamento → **validar** envio/WhatsApp. **US1+US2 = primeiro deploy com valor real (captura leads).**

### Incremental Delivery

- +US3 (produtos/institucional) → deploy.
- +US4 (blog/segmentos/FAQ) → deploy (motor de SEO long-tail).
- Cada história adiciona valor sem quebrar as anteriores.

---

## Notes

- [P] = arquivos diferentes, sem dependência pendente.
- Conteúdo real e fotos reais são bloqueantes de publicação (sem placeholder — regra do CLAUDE.md e SC-006).
- Rodar `astro check` a cada bloco; commit por tarefa ou grupo lógico.
- Cada checkpoint permite validar a história isoladamente antes de seguir.
