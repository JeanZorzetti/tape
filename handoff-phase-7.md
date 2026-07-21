# Handoff — Phase 7: acabamento e deploy

> Documento de passagem entre sessões. Leia junto com [`handoff.md`](handoff.md) e `specs/001-site-institucional-seo/tasks.md`.
> Criado em **2026-07-21**. Status: **não iniciado**. Tarefas **T044–T050**.
> Pré-requisito: US1–US4 feitas ✅ — 21 páginas, `astro build` passa, `npm run verificar` passa.

---

## Estado de onde se parte

```bash
npm run build        # 21 páginas, 21 URLs no sitemap
npm run verificar    # TUDO OK — h1, JSON-LD, canonical, description ≤160, alt, órfãs, links
```

Rotas no ar: `/` · `/produtos` + 3 · `/segmentos` + 4 · `/blog` + 7 · `/perguntas-frequentes` · `/sobre` · `/orcamento` · `/admin/*` (noindex, SSR).

---

## T044 — `/404` (a única rota do contrato que falta)

`src/pages/404.astro`. `contracts/routing-seo.md` pede: **`noindex`**, links úteis, e que não fique órfã do próprio layout.

- `<meta name="robots" content="noindex">` — o `Seo.astro` **não** tem prop para isso hoje. Adicionar uma prop `noindex?: boolean` (o `AdminLayout` já resolve noindex por conta própria — vale checar se dá para unificar em vez de ter dois caminhos).
- Conteúdo: os 3 produtos, os 4 segmentos, blog e o CTA de WhatsApp. Sem busca — o site tem 21 páginas, uma lista resolve melhor que um campo de busca que exigiria JS.
- Reaproveitar o padrão visual: hero navy + `TapeStrip`, CTA laranja no fim.
- ⚠️ O adapter é Node em modo standalone: confirmar que o 404 aparece de verdade em rota inexistente no servidor real (`node dist/server/entry.mjs`), não só no `astro dev`.

## T045 — auditar linkagem interna e órfãs

**Já coberto por `npm run verificar`**, que hoje reporta `Órfãs: nenhuma` e `Links internos quebrados: nenhum` nas 21 páginas.

O que sobra é o julgamento que script não faz: se os links internos são *relevantes* e não só presentes. Passar o olho em `contracts/routing-seo.md` ("todo produto linka segmentos/posts relacionados e vice-versa") e confirmar que a reciprocidade produto ↔ segmento ↔ post faz sentido editorial. Ao criar o `/404`, rodar o `verificar` de novo — ele vai passar a contar a rota nova.

## T046 — passe de acessibilidade

- **Foco de teclado**: `:focus-visible` global já existe em `global.css` (outline laranja, offset 3px). Testar navegando de Tab pela home, por um post e pelo formulário — atenção aos `<details>` (menu mobile e FAQ) e ao skip-link.
- **Contraste WCAG AA**: medir os pares reais, não os tokens no vácuo. Os suspeitos são os textos esmaecidos: `text-ink/70` e `text-ink/75` sobre `paper`/`kraft-100`, `text-white/55` e `text-white/75` sobre `navy`, e `text-steel` nos eyebrows pequenos. Texto pequeno precisa de **4.5:1**.
- **`prefers-reduced-motion`**: a `TapeStrip` já respeita (regra própria + a global que zera animações). Confirmar no DevTools com a emulação ligada.
- **Semântica antes de ARIA**: já é o padrão do projeto (menu e FAQ em `<details>`, sem JS). Conferir que todo `<section>` com papel de navegação tem `aria-label` — os breadcrumbs e as navs já têm.

## T047 — auditar imagens no `dist/`

O `verificar` já barra `<img>` sem `alt` e uso de placeholder. Falta:

- **Nenhuma imagem quebrada** — varrer o `dist/client` conferindo que todo `src` de `<img>`/`srcset` existe em disco.
- **Dimensões setadas (CLS)** — o componente `<Image>` do Astro emite `width`/`height` sozinho; confirmar que nenhuma `<img>` escrita à mão escapou.
- **Peso** — as capas 3:2 saem em ~26–157 KB por variante webp. Vale conferir se alguma passou de ~200 KB.
- ⚠️ Se o [handoff de imagens do blog](handoff-imagens-blog.md) rodar antes desta task, auditar as capas novas junto.

## T048 — Lighthouse

Meta: **≥ 90** em Performance / A11y / Best Practices / SEO, em três páginas — home, uma de produto e **um post** (o post é o pior caso: mais texto, sidebar e 4+ imagens).

Rodar contra o build servido, não contra o `astro dev`:

```bash
npm run build
node dist/server/entry.mjs        # precisa das env vars
npx lighthouse http://localhost:4321/ --view
```

Pontos de atenção conhecidos: as fontes self-hosted (Archivo + IBM Plex Sans + Mono, vários pesos) são o maior custo de render-blocking do projeto; se Performance ficar abaixo da meta, o primeiro lugar para olhar é quantos pesos estão sendo carregados de fato.

## T049 — deploy no Easypanel

Passo a passo completo no fim do [`handoff.md`](handoff.md). O essencial e o que costuma morder:

1. Serviço **Postgres** no projeto → copiar a connection string interna.
2. Serviço **App** por **Dockerfile** (já está na raiz).
3. Env: `DATABASE_URL`, `SESSION_SECRET` (≥32 chars), `ADMIN_EMAIL`, `ADMIN_SENHA`.
4. Domínio `tapepro.roilabs.com.br` na porta **4321**, TLS ligado.
5. Primeiro login em `/admin/login` **cria a conta** (só enquanto a tabela `usuarios` estiver vazia).

⚠️ **`security.allowedDomains` no `astro.config.mjs`** — sem o domínio de produção nessa lista, o Astro descarta o header `Host` e responde **403 "Cross-site POST form submissions are forbidden"** em *todo* POST atrás do proxy. Formulário e admin quebram juntos. Já está configurado para `tapepro.roilabs.com.br`; **ao trocar de domínio, atualizar lá também.**

## T050 — cenários do quickstart ponta a ponta

`specs/001-site-institucional-seo/quickstart.md`, seção "Cenários de validação". Os 6 cenários, contra o **deploy real**:

1. SEO por página — o `verificar` cobre a estrutura; falta colar o JSON-LD no **Rich Results Test** do Google (Product, FAQPage, BlogPosting, BreadcrumbList).
2. Funil de orçamento — CTA leva a WhatsApp e ao formulário em ≤ 2 cliques; envio válido grava lead; inválido barra; honeypot descarta.
3. Produtos e conteúdo — 3 produtos, 4 segmentos, FAQ e ≥6 posts, todos com CTA e links internos. ✅ (7 posts)
4. Imagens — cobre a T047.
5. Performance e a11y — cobre T046/T048.
6. Identidade visual — revisão contra o `CLAUDE.md`, com screenshot por breakpoint.

⚠️ O quickstart está **desatualizado em dois pontos**: fala de **Web3Forms** (removido — os leads vão para o Postgres via `/api/lead`) e de deploy em **Cloudflare Pages** (trocado por Easypanel, porque Worker não abre TCP com Postgres). Corrigir o arquivo ao executar a task.

---

## Fora da Phase 7, mas ainda aberto

- **Testes — nenhum existe.** T024 (Playwright SEO), T025 (Lighthouse), T026 (unit whatsapp), T030 (quote), T037 (produtos), T043 (conteúdo). **Não há test runner instalado.** Instalar Playwright uma vez e escrever as cinco de Playwright juntas — `scripts/verificar-seo.mjs` já cobre a parte estrutural e serve de especificação do que assertar.
- **T004** — ESLint/Prettier não instalados.
- **T016** — componentes base (Card/Eyebrow/SpecTable/Figure). O padrão hoje está repetido inline entre `/produtos/[slug]`, `/segmentos/[slug]` e `/blog/[slug]`; extrair só se aparecer uma quarta página com o mesmo formato.
- **T021** — pipeline de imagem (hoje é script manual com `sharp`; receitas no `handoff.md`).
- **Placeholders**: `EMAIL_CONTATO` em `constants.ts` ainda é `contato@tapepro.com.br`; favicon e OG definitivos.
- **`astro check`** não roda: pede instalar `@astrojs/check` + `typescript` e abre prompt interativo.

## Ordem sugerida

**T044** (fecha o contrato de rotas) → **T046/T047** (baratas, e mexem no que a T048 mede) → **T048** (Lighthouse já com a11y e imagens resolvidas) → **T049** (deploy) → **T050** (validação contra produção, que é o único lugar onde alguns cenários provam alguma coisa).
