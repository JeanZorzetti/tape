# Research — Site Institucional SEO-first (TapePro)

Fase 0. Cada decisão: **Decisão / Justificativa / Alternativas rejeitadas**. Nenhum `NEEDS CLARIFICATION` restante (posicionamento e alcance resolvidos na spec).

## 1. Framework e build

**Decisão**: Astro 5 em modo estático (SSG), TypeScript.
**Justificativa**: HTML estático = melhor SEO/Core Web Vitals; hidratação parcial (islands) mantém JS perto de zero; Content Collections dão conteúdo tipado sem CMS.
**Alternativas rejeitadas**: Next.js (peso de runtime React desnecessário para site de conteúdo); WordPress (o problema que estamos fugindo); site manual em HTML (perde tipagem de conteúdo e componibilidade).

## 2. Estilo — Tailwind v4

**Decisão**: Tailwind CSS v4 via `@tailwindcss/vite`, com **design tokens em CSS custom properties** (`src/styles/tokens.css`) consumidos pelo tema do Tailwind.
**Justificativa**: Tailwind é ferramenta, não é a "cara de IA" — o genérico vem dos defaults preguiçosos. Amarrar as utilidades a tokens próprios (cor/tipo/espaçamento) força a identidade e evita `blue-600`/`from-x-to-y`. v4 é mais rápido e config-light.
**Alternativas rejeitadas**: CSS puro (perde velocidade e consistência de escala); UI kit pronto (shadcn/DaisyUI) — reintroduz o visual de template.

## 3. Direção de design (token system) — ancorado em fita adesiva

Segue as regras do `CLAUDE.md`. Evita os 3 clichês de IA (cream+serif+terracota / preto+verde-ácido / broadsheet hairline) e o azul padrão. **Proposta revisável** — validar antes de codar.

**Color** (paleta REAL da marca — conferida nas fotos; ajustar hex exato a partir do arquivo do logo):
- `--paper` `#FAFAF7` — base off-white fria (não o cream #F4F1EA do clichê).
- `--navy` `#232C7A` — azul-marinho da marca (o "TAPE" do logo); cor estrutural e de texto forte.
- `--orange` `#F47C20` — laranja da marca (o "PRO" e o rolo); acento primário / CTAs.
- `--kraft` `#C8A97A` — kraft das caixas e da fita gomada; superfície-material com parcimônia.
- `--ink` `#1B1B1E` — texto near-black, nunca `#000`.
- `--steel` `#6E6B64` — neutro para metadados/labels.
- Status (success/warn/error) tunados, usados só para status e nunca só por cor.
- **Anti-clichê**: navy+laranja é a marca REAL (autêntico, não genérico). Para não cair no visual "esportivo/genérico": laranja como único acento vívido, navy profundo como base, kraft como textura-material, tipografia industrial e o motivo de fita impressa carregam a distinção; nunca `blue-600` nem gradiente azul→roxo.

**Type** (3 papéis — self-hosted, sem serifa de display para fugir do clichê):
- Display: **Archivo** (grotesca industrial, pesos wide/bold — sensação de rótulo estampado).
- Body: **IBM Plex Sans** (herança técnica/industrial, ótima leitura).
- Mono/dados: **IBM Plex Mono** para specs e números (tabular: 48mm × 100m, mín. 20 rolos).
Hierarquia por **peso e cor antes de tamanho**.

**Layout**: editorial-industrial. Grid assimétrico, colunas de leitura alinhadas à esquerda (nada de tudo centralizado). Specs em blocos mono tabulares. Cards só onde há agrupamento real; um acento, resto em grayscale.

**Signature (o elemento memorável)**: a **"tira de fita impressa"** — uma faixa diagonal que atravessa a hero como um pedaço de fita de embalagem com a marca/keyword repetida (como fita personalizada real), reaparecendo como eyebrow/divisor de seção. Movimento deliberado: desenrola no load; um "peel" revela no scroll. Uma coisa ousada só; o resto quieto. Respeita `prefers-reduced-motion` (sem a animação, a faixa fica estática).

**Nota de autocrítica**: o risco agora é navy+laranja escorregar pro visual esportivo/genérico — mitigado por laranja como único acento, navy profundo (não saturado tipo time), kraft como material, tipografia industrial e layout assimétrico. As fotos reais confirmam a assinatura: as tiras impressas dos clientes (Finaart, Lyon, Quemed, Yanmei…) SÃO fita personalizada de verdade; a faixa do site ecoa isso com a marca TapePro. Revisar por screenshot a cada passada.

## 4. Conteúdo — Content Collections

**Decisão**: 4 coleções (`produtos`, `segmentos`, `blog`, `faq`) em MDX/MD, schemas Zod em `src/content/config.ts` (detalhe em [data-model.md](./data-model.md)). Sem CMS no-code na v1; autoria em arquivos versionados.
**Justificativa**: tipagem + build estático + zero custo/infra; suficiente para um operador. MDX permite blocos ricos (SpecTable, CTA) dentro do conteúdo.
**Alternativas rejeitadas**: CMS headless (Sanity/Contentful) — infra e custo desnecessários na v1; pode entrar depois sem reescrever as páginas.

## 5. Formulário de orçamento (site estático)

**Decisão**: `<form>` HTML postando para **Web3Forms** (endpoint com access key), com **honeypot** + **Cloudflare Turnstile** opcional; entrega por e-mail ao representante. CTA paralelo de **WhatsApp** via deep-link `https://wa.me/<numero>?text=<msg pré-preenchida com página de origem>`.
**Justificativa**: mantém o site 100% estático (melhor SEO/perf), sem servidor a manter; anti-spam sem CAPTCHA intrusivo. Detalhe em [contracts/quote-form.md](./contracts/quote-form.md).
**Alternativas rejeitadas**: função serverless própria (mais infra p/ pouco ganho — ponytail); Netlify Forms (amarra ao host; Web3Forms é host-agnóstico); mailto: (frágil, sem validação/anti-spam).

## 6. SEO técnico

**Decisão**: componente `Seo.astro` (title/description/canonical/OG/Twitter por página) + `JsonLd.astro` injetando JSON-LD por tipo: **Organization** (site-wide), **Product** (produtos), **FAQPage** (FAQ), **BlogPosting** + **BreadcrumbList** (blog/segmentos). `@astrojs/sitemap` gera `sitemap-index.xml`; `robots.txt` estático aponta o sitemap. URLs limpas em PT. Detalhe em [contracts/structured-data.md](./contracts/structured-data.md) e [contracts/routing-seo.md](./contracts/routing-seo.md).
**Justificativa**: cobre os requisitos FR-002/003/004; **Organization** (não LocalBusiness) porque o alcance é nacional temático (FR-016).
**Alternativas rejeitadas**: LocalBusiness/páginas por cidade (fora de escopo — sem alvo local); libs pesadas de SEO (nativo do Astro basta).

## 7. Imagens

**Decisão**: componentes `<Image>/<Picture>` do Astro (sharp) sobre ativos reais em `src/assets/`; AVIF/WebP responsivos; `width`/`height`/`aspect-ratio` sempre setados; `alt` específico (decorativas com `alt=""`). **Nenhum placeholder** — página só publica quando a foto real existe (Assumption da spec).
**Justificativa**: FR-011/013 e SC-006; evita CLS e o "tell" de stock genérico.
**Alternativas rejeitadas**: serviços de placeholder (proibidos por regra); hotlink (proibido).

## 8. Hospedagem e analytics

**Decisão**: deploy em **Cloudflare Pages** (ou Netlify) — build estático, CDN de borda, TLS e preview grátis. Analytics: **Cloudflare Web Analytics** (cookieless, sem banner de consentimento).
**Justificativa**: custo zero, perf de borda, sem cookies = sem fricção legal/UX; forms host-agnósticos (Web3Forms) não prendem ao host.
**Alternativas rejeitadas**: Vercel (ok, mas sem vantagem aqui); GA4 (cookies + banner + peso).

## 9. Testes e qualidade

**Decisão**: `astro check` no CI; **Playwright** para smoke/a11y/schema/links/imagens; orçamento **Lighthouse** (falha se cair abaixo das metas). Unit (Vitest) só p/ `whatsapp.ts` e validação do formulário.
**Justificativa**: cobre SC-001/002/003/006/007 com o mínimo; sem suíte inflada (ponytail — um check runnable por lógica não-trivial).
**Alternativas rejeitadas**: TDD completo de UI (exagero para site de conteúdo); nenhum teste (deixa SEO/a11y regredir sem rede).
