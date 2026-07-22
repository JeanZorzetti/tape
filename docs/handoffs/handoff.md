# Handoff — Site TapePro (fitas adesivas personalizadas)

> Documento de passagem entre sessões. **Leia isto primeiro**, junto com `CLAUDE.md` e `specs/001-site-institucional-seo/`.
> Última atualização: **2026-07-21**. Status: **no ar em https://tapepro.roilabs.com.br** — todas as fases da spec (T001–T050) fechadas.
> Repositório: **https://github.com/JeanZorzetti/tape** (público — nada de segredo commitado).

## 📌 Frentes

| Documento | Frente | Status |
| --- | --- | --- |
| [`handoff-qualidade.md`](handoff-qualidade.md) | **Testes, compressão no proxy, favicon/OG** — dívida assumida no lançamento | ← **próxima sessão** |
| [`handoff-phase-7.md`](handoff-phase-7.md) | Acabamento e deploy (T044–T050) | ✅ feita — vale como registro das decisões de contraste |
| [`handoff-imagens-blog.md`](handoff-imagens-blog.md) | Harness de prompt de imagem (Gemini) para as capas do blog | não iniciado |

---

## 🎯 Próximo passo

**Lançamento fechado.** ✅ Search Console verificado e sitemap submetido · ✅ Rich Results Test rodado (o "erro" de `Product` é esperado — explicação em [`handoff-qualidade.md`](handoff-qualidade.md)) · ✅ `EMAIL_CONTATO` real no ar.

O que resta é **dívida assumida**, toda em [`handoff-qualidade.md`](handoff-qualidade.md):

1. **Testes** — não existe nenhum. Todo o comportamento foi verificado à mão, uma vez. É o item que mais importa se o site continuar evoluindo.
2. **Compressão no proxy do Easypanel** — confirmado desligado; ~300–600 ms de ganho por uma chave no painel.
3. **Favicon e OG definitivos** — os atuais são provisórios; o OG aparece em todo link compartilhado no WhatsApp.

## ✅ 002 — Indexação e descoberta (feita nesta sessão)

Spec em `specs/002-indexacao-descoberta/`. Quatro artefatos públicos + um disparo automático, todos derivados do conteúdo que já existe. Única dependência nova: `@astrojs/rss`.

**Automático, não precisa de ninguém:**
- `scripts/indexnow.mjs` — a cada **subida de container** lê os sitemaps do `dist`, filtra e submete as URLs para `api.indexnow.org` (Bing, Yandex, Seznam, Naver). Dispara ~15s após o start, desanexado, e **nunca** sai com código ≠ 0: falha de rede aqui não pode derrubar o site.
- `/llms.txt` — endpoint gerado de `PRODUTOS` + coleção `segmentos` + `postsPublicados()`. Página nova entra sozinha, sem edição manual.
- `/rss.xml` — `@astrojs/rss` sobre `postsPublicados()` (já exclui rascunho e ordena por data). `<link rel="alternate">` no `BaseLayout`.
- `public/robots.txt` — bloqueia `/admin/` e `/api/`, libera explicitamente os 12 agentes de IA (GPTBot, ClaudeBot, PerplexityBot, Google-Extended…).
- `astro.config.mjs` — `lastmod` no sitemap **só nas rotas `/blog/*`**, de `atualizadoEm ?? publicadoEm`. É o único sinal de atualização que o Google aceita (ele não usa IndexNow).

**Exige painel — ainda pendente:** verificar o domínio no **Bing Webmaster Tools** e submeter o sitemap. Passos em [`docs/bing-webmaster.md`](docs/bing-webmaster.md), com uma tabela *Registro* para preencher. Rota preferida é **importar do Google Search Console** (já verificado, zero mudança no repo). Sem isso a submissão funciona mas ninguém consegue conferir o resultado.

**⚠️ Duas armadilhas que já morderam:**
1. **A guarda de ambiente é o `NODE_ENV`, não o host.** O host sai do sitemap e diz `tapepro.roilabs.com.br` mesmo num build local — a spec original mandava usar o host como guarda, e com isso um `npm run build` na máquina de alguém submeteu de verdade (aconteceu). Quem separa local de container é o `NODE_ENV=production` do estágio de runtime do `Dockerfile`. **Não trocar por uma checagem de host.**
2. **A chave IndexNow é descoberta pelo conteúdo, não por contagem.** `public/<chave>.txt` é o único lugar onde a chave existe (nada em `src/` — a imagem de runtime não copia `src/`). O contrato dizia "o único `*.txt` na raiz do `dist`", mas `robots.txt` e `llms.txt` também moram lá. A regra real, em `lerChave()` e no `verificar`, é *o `.txt` cujo conteúdo é igual ao próprio nome* — que é a mesma invariante que o buscador confere para responder 200 em vez de 403.

**Teto conhecido (aceito):** o marcador de idempotência é `dist/.indexnow-enviado`, dentro do container. Some quando uma imagem nova é construída (deploy = conteúdo novo = submeter) e sobrevive a restart do mesmo container. **Se o Easypanel recriar o container sem novo build, sai uma submissão a mais** — custo nulo neste volume. Se um dia doer, o marcador passa a guardar o hash do conjunto de URLs em vez de existir/não existir.

**Verificado:** `npm test` = 30 testes passando · `npm run build && npm run verificar` = TUDO OK (22 páginas, 17 links no `llms.txt` cobrindo as 14 páginas de conteúdo, 7 `<item>` no feed para 7 posts) · `node scripts/indexnow.mjs` local = `pulado: ambiente local não é produção`, sem requisição de rede. **Falta o passo de produção**: conferir o log do container após o deploy (`[indexnow] N URLs -> 200 OK`) e o §6 do quickstart (página nova indexada em 48h).

## ✅ US4 — FEITA nesta sessão (T011, T038–T042)

**O motor de SEO long-tail está no ar.** 14 páginas novas: 4 segmentos, 7 posts, índices de blog/segmentos e a FAQ.

**Arquivos:**
- `src/content.config.ts` — **T011**. API nova do Astro 5 (`loader: glob()` / `file()`), não a sintaxe `type: 'content'` do contrato. Coleções: `segmentos`, `blog`, `faq`.
  - **`produtos` continua fora de collection** (segue em `src/lib/produtos.ts`). No lugar de `reference('produtos')`, o schema usa `z.enum` montado a partir dos slugs reais — mesma integridade no build, sem migrar o catálogo.
- `src/content/segmentos/*.mdx` (4) — industria, distribuidor, e-commerce, lojas. Frontmatter traz `dores[]` (título + texto), `produtosRelacionados`, `chamada`, `contexto` de WhatsApp.
- `src/content/blog/*.mdx` (7) — long-tails: caixa pesada · gomada × BOPP · clichê flexográfico · quanto custa · quantos rolos/mês · aviso de segurança · por que descola.
- `src/content/faq/perguntas.json` — 18 perguntas em 4 grupos (pedido, produto, personalizacao, entrega).
- `src/pages/segmentos/{index,[slug]}.astro`, `src/pages/blog/{index,[slug]}.astro`, `src/pages/perguntas-frequentes.astro`.
- `src/lib/conteudo.ts` — `formatarData`, `postsPublicados()` (exclui rascunho), `postsRelacionados()`.
- `src/assets/conteudo/*.jpg` (9) — fotos reais recortadas em 3:2 (receita nova no fim do doc).
- `scripts/verificar-seo.mjs` + `npm run verificar` — confere o `dist/` contra os contratos.
- `.prosa` em `global.css` — estilo do corpo MDX (no lugar do plugin typography).

**Linkagem interna fechada (nenhuma órfã):**
- Header: Produtos · Segmentos · Blog · Sobre · Orçamento (breakpoint do menu passou de `md` para `lg` — 5 links não cabiam a 768px).
- Footer ganhou Segmentos, Blog e Perguntas frequentes.
- Home ganhou seção de segmentos + 3 posts recentes + link para a FAQ.
- `/produtos/[slug]` ganhou "Quem costuma usar" (segmentos) e "Antes de decidir" (posts) — a contrapartida dos links conteúdo → produto.

**Decisões desta sessão (não reabrir):**
1. **`FAQPage` só em `/perguntas-frequentes`.** A FAQ do clichê em `/produtos/fita-transparente-personalizada` continua **sem JSON-LD de propósito**; agora ela linka para a FAQ completa.
2. **Sem preço, como combinado.** Os posts falam de *formação* de preço (quantidade, cores, material, clichê) e de faixa de volume, nunca de R$.
3. **`description` ≤ 160 virou regra checada.** O `verificar` reprovou 7 páginas (inclusive home, /orcamento, /produtos, /sobre, que já estavam longas antes) — todas encurtadas.

**Verificado:** `astro build` passa (21 páginas, 21 URLs no sitemap); `npm run verificar` = TUDO OK; visual conferido no Playwright em 1440/1024/390 — sem overflow horizontal, 1 `h1` por página, header em uma linha a 1024px, `<details>` da FAQ abre sem JS.

### Regras que continuam valendo para conteúdo novo
- **Não duplicar `FAQPage`** — ele vive só em `/perguntas-frequentes`.
- **Produtos não são collection.** Para linkar conteúdo → produto use o slug (`fita-transparente-personalizada`, `fita-gomada`, `fita-transparente-comum`); o `z.enum` do `content.config.ts` quebra o build se o slug não existir.
- **Sem preço em lugar nenhum.** Faixa de volume e "custo único do clichê", nunca R$.
- **Nada de conteúdo genérico de IA.** O diferencial é profundidade técnica real: adesão × cisalhamento, BOPP × kraft gomado, por que a aba levanta, o que a fita comunica na entrega. Se o post pudesse ser escrito sobre qualquer produto, ele não serve.
- **`descricao`/`resumo` ≤ 160 chars** (o zod barra, e o `verificar` confere no HTML).
- Copy de confiança oficial: *"Trabalhamos apenas com as fitas da tabela acima — transparentes com ou sem personalização e gomada reforçada com fios de nylon, garantindo mais resistência e segurança para caixas mais pesadas."*

### Padrões visuais a reaproveitar (não reinventar)
Ver `/produtos/[slug]` e `/segmentos/[slug]` como referência: hero em faixa navy + `TapeStrip`, eyebrow em `font-mono uppercase tracking-[0.28em]`, `h2` navy, corpo `text-ink/75`, superfícies `kraft-100`, CTA final em faixa laranja. Componentes prontos: `WhatsAppCta`, `TapeStrip`, `JsonLd`, `BaseLayout`. Corpo de MDX = classe `.prosa`.

⚠️ **Regras de cor com contraste medido (T046) — seguir, não improvisar:**
- Texto sobre a **faixa laranja é navy**, nunca branco (branco dá 2,71:1 e reprova no AA).
- **Eyebrow em superfície clara** = `text-orange-800`; **sobre navy** = `text-orange`. São tokens diferentes de propósito.
- Hover de botão laranja **clareia** (`orange-400`), não escurece — o rótulo é navy.
- Detalhes e a tabela completa em [`handoff-phase-7.md`](handoff-phase-7.md).

⚠️ Imagens de produto **não têm transparência** — o card em volta precisa ser **branco**, senão aparece um retângulo branco sobre o kraft.

## ✅ US3 — feita na sessão anterior

`/produtos`, `/produtos/[slug]` (×3) e `/sobre` no ar. `astro build` passa, **7 páginas**, 7 URLs no sitemap.

**Decisões comerciais tomadas pelo usuário (não reabrir):**
1. **Sem preço no site.** Nenhuma página exibe valor — só specs + CTA de orçamento. Por isso o `Product` JSON-LD sai **sem `offers`** (Offer sem `price` é schema inválido); no lugar vão `additionalProperty` com as specs.
2. **Clichê não é produto.** Virou seção "O clichê flexográfico" + FAQ de 5 perguntas (`<details>`, sem JS) **dentro** de `/produtos/fita-transparente-personalizada`. Renderiza só quando `produto.personalizavel`.

**Arquivos:**
- `src/lib/produtos.ts` — fonte única do catálogo (slug, h1, seoTitle/Description, specs, aplicações, benefícios, imagem+alt, contexto do WhatsApp). **Módulo TS, não content collection** — ver ponytail comment no topo.
- `src/pages/produtos/index.astro` — linhas editoriais (foto + specs em mono tabular), `BreadcrumbList` + `ItemList`.
- `src/pages/produtos/[slug].astro` — hero navy + TapeStrip, ficha técnica em `<dl>`, aplicações, benefícios, bloco clichê/FAQ, cross-link para as outras fitas, CTA. `Product` + `BreadcrumbList`.
- `src/pages/sobre.astro` — institucional + prova social (`CLIENTES`) + catálogo em uma linha cada.
- Home, Header e Footer agora consomem `PRODUTOS` e linkam para as páginas (**a divergência da gomada sumiu** — a copy vem do módulo). Nav = Produtos · Portfólio · Sobre · Orçamento; rodapé ganhou coluna "Fitas".

**Aberto:** T037 (teste Playwright de produtos) — segue sem test runner instalado. Verificação foi manual: build + screenshot desktop/mobile, sem overflow horizontal, 1 `h1` por página, JSON-LD `Organization`/`Product`/`BreadcrumbList` presentes.
**Gotcha visual:** os PNGs de produto **não têm transparência** (vieram de recorte de JPEG) — o fundo do card precisa ser **branco**, senão aparece um retângulo branco sobre o kraft.

### Catálogo — FECHADO (confirmado pelo usuário)
Só vendem **3 produtos + o Clichê**. Fonte: `imagens/com fundo/WhatsApp Image 2026-07-20 at 23.51.19.jpeg` (tabela de preços oficial).

| Produto | Specs | Preço unitário |
|---|---|---|
| **Fita Adesiva Transparente Personalizada** | logo em até **2 cores** · **48mm × 100m** | 20–49 rolos R$16,20 · 50–99 R$13,90 · 100–199 R$10,50 · 200+ R$10,10 |
| **Fita Gomada** (reforçada com **fios de nylon**) | **70mm × 150m** | 15–100 rolos R$37,20 · 100+ R$32,20 |
| **Fita Transparente Comum** | sem impressão · **48mm × 100m** | R$7,90 |
| **Clichê Flexográfico** | matriz usada para imprimir a marca na fita — **custo único** | a partir de **R$80,00** |

Rodapé oficial da tabela (usar como copy de confiança):
> "Trabalhamos apenas com as fitas da tabela acima — transparentes com ou sem personalização e gomada reforçada com fios de nylon, garantindo mais resistência e segurança para caixas mais pesadas."

### Fotos reais já recortadas → `src/assets/produtos/`
- `fita-transparente-personalizada.png` (235×232) — rolo transparente com TAPE PRO impresso
- `fita-gomada.png` (235×166) — rolo kraft
- `fita-transparente-comum.png` (235×120) — rolo transparente liso
- `cliche-flexografico.png` (235×110) — ilustração navy do clichê

### Nota técnica — Content Collections
✅ **T011 feita.** `src/content.config.ts` usa a API nova (`loader: glob()`/`file()`). Os schemas em `specs/.../contracts/content-collections.md` estão na **sintaxe antiga** (`type: 'content'`) — ficaram desatualizados de propósito; o arquivo real é a fonte de verdade.

---

## O que é o projeto
- Site **institucional SEO-first** para o **representante comercial oficial** da TapePro (fitas adesivas personalizadas), **B2B**.
- Objetivo: superar o SEO fraco do site oficial (tapeprofitas.com.br) e capturar long-tail que os líderes (fitpel.com.br, artfixfitas.com.br) não cobrem — nenhum tem blog/páginas de aplicação.
- **Sem carrinho/checkout.** Conversão = orçamento por **WhatsApp + formulário**.

## Decisões travadas (não reabrir sem motivo)
- Stack: **Astro 5 (SSG) + Tailwind v4**, TypeScript. Estático, JS mínimo.
- Posicionamento: **representante oficial autorizado** — pode usar marca/fotos TapePro e mirar o termo "TapePro".
- SEO: **nacional temático** (sem páginas por cidade; schema **Organization**, não LocalBusiness).
- Portfólio: **autorizado** a publicar cases reais (Nature's, Halyee, Lyon, Finaart, Comando, Yanmei, Quemed). **Excluir `imagens/**/sua-marca-aqui.png`** (marca de outro fornecedor — Chimas).
- WhatsApp: **+55 62 98344-3919** (`src/lib/constants.ts` → `5562983443919`).

## Paleta e tipografia
`src/styles/global.css` (bloco `@theme`):
- `--color-navy #232c7a` · `--color-orange #f47c20` · `--color-kraft #c8a97a` · `--color-kraft-100 #efe6d6` · `--color-paper #faf8f4` · `--color-ink #1b1b1e` · `--color-steel #6e6b64`.
- Fontes self-hosted: **Archivo** (display), **IBM Plex Sans** (body), **IBM Plex Mono** (dados/eyebrows).

## 🎨 Histórico de design — NÃO repetir o que foi reprovado
O hero da home passou por 3 versões. **A atual está APROVADA — não mexer sem pedido.**
- ❌ **Reprovado:** rolo laranja recortado flutuando sobre **spotlight radial** claro (virou "disco/prato").
- ❌ **Reprovado:** direção **editorial/tipográfica** em fundo paper (manchete gigante navy + faixa de fita como selo).
- ✅ **APROVADO — hero cinematográfico dramático:** foto full-bleed do galpão logístico + scrim navy escuro (esquerda + base + darken), manchete branca `Sua marca sela cada caixa que sai.`, CTAs, prova social, `TapeStrip` laranja como base.
  - Asset: `imagens/com fundo/Design sem nome (11).svg` (raster embutido 5692×3200) → `src/assets/marca/deposito-tapepro.jpg` (2560px, 441KB; Astro gera webp 53–179KB).
  - `hero-rolo-laranja.png` **não é mais usado** (segue em `src/assets/marca/` caso queira).

Regra: seguir as diretrizes anti-"cara de IA" do `CLAUDE.md`, carregar a skill `frontend-design`, e **iterar com screenshot via Playwright MCP** a cada passada.

## Estado do código
`astro build` passa. **22 páginas** (21 no sitemap — a `/404` fica fora). `npm run verificar` passa. Lighthouse: home 93 · produto 95 · post 91, a11y/BP/SEO 100.

- **Setup + Foundational + US1 (home) + US2 (orçamento) + US3 (produtos/sobre) + US4 (segmentos/blog/FAQ) + Phase 7 (polish e deploy)** feitos.
- Arquivos-chave:
  - `astro.config.mjs` (site, mdx, sitemap, tailwind vite, `security.allowedDomains`)
  - `src/styles/global.css` (tokens + base + foco de duas cores + `prefers-reduced-motion`)
  - `src/pages/404.astro` (noindex, servida pelo servidor Node)
  - `src/content.config.ts` (coleções segmentos/blog/faq — API nova)
  - `src/lib/constants.ts`, `src/lib/whatsapp.ts`, `src/lib/quoteForm.ts`, `src/lib/produtos.ts`, `src/lib/conteudo.ts`
  - `src/components/seo/{Seo,JsonLd}.astro`
  - `src/components/layout/{Header,Footer}.astro` (menu mobile = `<details>`, sem JS; breakpoint `lg`)
  - `src/components/quote/{WhatsAppCta,QuoteForm}.astro`
  - `src/components/ui/TapeStrip.astro` (assinatura: faixa de fita impressa rolando)
  - `src/layouts/BaseLayout.astro` (SEO + JSON-LD Organization + Header/Footer + skip-link)
  - `src/pages/index.astro` (home), `src/pages/orcamento.astro`, `src/pages/sobre.astro`, `src/pages/perguntas-frequentes.astro`, `src/pages/{produtos,segmentos,blog}/{index,[slug]}.astro`
  - `src/content/{segmentos/*.mdx, blog/*.mdx, faq/perguntas.json}`
  - `scripts/verificar-seo.mjs` (`npm run verificar` — SEO, links, órfãs **e imagens**: arquivo existe, `width`/`height`, teto de 200 KB)
  - `public/robots.txt`, `public/favicon.svg`, `public/og-default.png`
- Assets: `src/assets/marca/` (deposito-tapepro.jpg, hero-rolo-laranja.png, logo-tapepro.png) · `src/assets/portfolio/` (7 cases) · `src/assets/produtos/` (4 recortes novos).

### Formulário de orçamento (US2) — como funciona
`src/components/quote/QuoteForm.astro` + helpers puros em `src/lib/quoteForm.ts`.
- Validação **nativa do HTML** (`required`, `type=email`, `reportValidity()`) + regra extra: CNPJ, se preenchido, exige **14 dígitos**.
- Honeypot `botcheck` (descarta silenciosamente). Estados: enviando / sucesso / erro (erro oferece WhatsApp e preserva o que foi digitado).
- Submit faz `POST /api/lead` → grava no Postgres. Se o POST falhar, cai no **fallback WhatsApp** com os dados preenchidos.
- **Web3Forms foi removido** (`PUBLIC_WEB3FORMS_KEY` não existe mais) — os leads agora vivem no CRM próprio.

## 🗄️ CRM `/admin` — arquitetura

O site **não é 100% estático**. Continua SSG nas páginas públicas; `/admin/*` e `/api/*` declaram `export const prerender = false` e rodam no **adapter Node** (`@astrojs/node`, modo standalone). É por isso que a `/404` funciona de verdade: o servidor a serve com status 404.
**Deploy no Easypanel (VPS)** — Cloudflare Pages saiu porque Worker não abre conexão TCP com Postgres. `Dockerfile` + `.dockerignore` na raiz; o Postgres é um serviço separado no mesmo projeto do Easypanel.

**Variáveis de ambiente** (ver `.env.example`): `DATABASE_URL`, `SESSION_SECRET` (≥32 chars), `ADMIN_EMAIL`, `ADMIN_SENHA`.

**Arquivos:**
- `src/lib/crm.ts` — conexão `postgres` (sem ORM), schema aplicado sozinho no primeiro uso (`create table if not exists`: `usuarios`, `leads`, `notas`, **`tentativas`**, **`pedidos`**, **`transicoes`** + coluna **`leads.nicho`**), status e consultas. O bootstrap do schema roda sob **lock consultivo por transação** (`pg_advisory_xact_lock`) — dois processos aplicando o schema num banco pristino (testes em paralelo, réplicas) não colidem mais no catálogo.
- `src/lib/auth.ts` — scrypt + cookie assinado com HMAC, tudo em `node:crypto`. Throttle de login **em memória** (8 tentativas / 15 min).
- `src/lib/adminUi.ts` — datas pt-BR, follow-up vencido, e os helpers **puros** do CRM de vendas: `NICHOS`/`CANAIS`/`RESULTADOS`, `CADENCIA_DIAS = [0,1,3,7,14,21]`, `proximaDataCadencia`/`cadenciaEsgotada`, `vencidoCarteira`, `taxasFunil`, `formatarBRL`/`reaisParaCentavos` (money path em centavos inteiros).
- `src/pages/api/lead.ts` — POST público do formulário (valida, honeypot, limita tamanho). `inserirLead` já grava a transição inicial `null → novo`.
- `src/pages/admin/{login,index,[id],funil,sair}` + `src/layouts/AdminLayout.astro` (`noindex`, header com **Leads / Carteira / Funil**).

**Como funciona na prática:** primeiro login com `ADMIN_EMAIL`/`ADMIN_SENHA` **cria a conta** (só enquanto a tabela `usuarios` estiver vazia) — sem script, sem shell na VPS. Lista com filtro por status/**nicho** e busca, contadores, badge de follow-up vencido; detalhe com ficha, botão de WhatsApp já com saudação, status, próximo contato e anotações. **Zero JavaScript no client** — tudo form POST + redirect (PRG).

**CRM de vendas (feature 003):** o detalhe do lead (`/admin/[id]`) ganhou três frentes, todas por form POST:
- **Cadência de 1ª venda (US1):** régua de 6 toques (`tentativas`); o 1º toque promove `novo → em_contato`; o próximo contato vem **sugerido e editável**; após o 6º, aviso de "cadência esgotada" (não marca Perdido sozinho).
- **Carteira / pedidos (US2):** registrar pedido (`pedidos`, data + R$→centavos + volume) em **transação**; o 1º pedido fecha o lead e agenda recontato **+30d**; pedidos seguintes reagendam por `max(data)+30`; botões **registrar recontato** e **pausar carteira**. Visão `/admin?visao=carteira` lista clientes por próximo recontato.
- **Funil por coorte (US3)** em `/admin/funil`: contagem por etapa + 3 taxas (lead→fechado, em contato→fechado, orçado→fechado) via `transicoes`, com `?periodo=mes|ano|tudo` e `?nicho=`. Backfill idempotente semeia `transicoes` de leads pré-existentes no 1º start.
- **Nicho (US4):** coluna `leads.nicho` (indústria/distribuidor/e-commerce/lojas/outro), filtro na lista, distribuição e recorte do funil por nicho.

### ⚠️ Armadilha que já custou tempo: `security.allowedDomains`
Sem esse bloco no `astro.config.mjs`, o Astro **descarta o header `Host`**, monta a URL como `http://localhost` e responde **403 "Cross-site POST form submissions are forbidden"** em *todo* POST atrás do proxy do Easypanel — form e admin quebrados. O domínio de produção precisa estar na lista. Ao trocar de domínio, **atualizar lá também**.

**Verificado ponta a ponta** contra um Postgres 16 em Docker: lead válido grava (`{"ok":true,"id":1}`), obrigatórios/CNPJ/e-mail barrados, honeypot descartado em silêncio, `/admin` sem sessão redireciona, senha errada nega, primeiro login cria o usuário, cookie adulterado é rejeitado, status + follow-up + nota persistem, filtro e busca funcionam, logout limpa a sessão. **CRM de vendas (003):** suíte `npm test` verde (58 testes) — unit de cadência/funil/dinheiro + integração `crm-vendas.test.mjs` (1º pedido fecha + agenda +30d, 2º só reagenda, backfill idempotente) — e smoke autenticado por HTTP: login → lead → tentativa (vira "Em contato") → pedido (vira "Fechado", entra na carteira) → funil.

## Pendências (ordem sugerida)
1. ~~Rework visual da home~~ ✅ hero cinematográfico aprovado.
2. ~~US2 — `/orcamento` + `QuoteForm`~~ ✅ (T027–T031).
3. ~~US3 — páginas de produto + /sobre~~ ✅ (T032–T036).
4. ~~US4 — segmentos, blog, FAQ~~ ✅ (T011, T038–T042).
5. ~~Phase 7 — polish e deploy~~ ✅ (T044–T050). Site no ar.
6. **Operação** ← *agora*: Search Console (verificar domínio + submeter sitemap), `EMAIL_CONTATO` real, Rich Results Test, compressão no proxy do Easypanel.
7. **Qualidade (opcional)**: T016 (UI base Card/Eyebrow/SpecTable/Figure — o padrão está repetido inline entre `/produtos/[slug]`, `/segmentos/[slug]` e `/blog/[slug]`; extrair só se aparecer uma quarta página igual), T021 (pipeline de imagem). **Testes não existem** — T024/T025/T026/T030/T037/T043. **Não há test runner instalado**; ESLint/Prettier (T004) também não. Instalar Playwright uma vez e escrever os de Playwright juntos — `scripts/verificar-seo.mjs` já cobre o estrutural e serve de espec.
8. **Placeholders restantes**: `EMAIL_CONTATO` (`constants.ts`), favicon e OG definitivos. ✅ Domínio já é **`https://tapepro.roilabs.com.br`** em `constants.ts`, `astro.config.mjs` e `robots.txt`.
9. **Multi-pipeline (próxima feature)** — pipeline outbound de **recuperação** a partir de [`docs/leads-bruto.csv`](docs/leads-bruto.csv) (503 empresas), separada do funil inbound; modal do lead com todas as colunas da planilha como campo. Plano completo em [`handoff-multi-pipeline.md`](handoff-multi-pipeline.md) → implementar via Spec Kit.

Progresso com `[x]` em `specs/001-site-institucional-seo/tasks.md`. O projeto tem `.specify/` → **usar fluxo Spec Kit** (`/speckit-implement`), não superpowers, conforme regra global.

## Assets — receitas (para regenerar)
`sharp` já está em devDeps. Rodar com **Node**, da raiz do projeto.

**1. SVGs "sem fundo"** (`imagens/Sem fundo/Design sem nome (1..9).svg`) — cada um embute **PNG de cor + PNG de máscara alpha**. Extrair só o base64 maior dá imagem SEM transparência (bug já ocorrido). Rasterize com sharp (ele compõe a máscara):
```js
import sharp from "sharp"; import { readFileSync } from "node:fs";
await sharp(readFileSync("imagens/Sem fundo/Design sem nome (1).svg"))
  .trim({ threshold: 12 }).png().toFile("src/assets/marca/hero-rolo-laranja.png");
```
Mapa: 1=hero rolo laranja · 2=logo wordmark · 3=natures · 4=halyee · 5=yanmei(kraft) · 6=lyon · 7=finaart · 8=comando · 9=quemed(kraft).

**2. SVG "com fundo" (cena do galpão, nº 11)** — raster nativo é 5692×3200; salvar reduzido senão vira PNG de 28MB:
```js
await sharp(readFileSync("imagens/com fundo/Design sem nome (11).svg"), { density: 300 })
  .resize({ width: 2560, withoutEnlargement: true })
  .jpeg({ quality: 85, mozjpeg: true }).toFile("src/assets/marca/deposito-tapepro.jpg");
```

**3. Recortes da tabela de preços** (`imagens/com fundo/WhatsApp Image 2026-07-20 at 23.51.19.jpeg`, **853×1280**) — regiões usadas:
```js
{ "fita-transparente-personalizada": { left: 30, top: 300,  width: 235, height: 232 },
  "fita-gomada":                     { left: 30, top: 592,  width: 235, height: 166 },
  "fita-transparente-comum":         { left: 30, top: 816,  width: 235, height: 120 },
  "cliche-flexografico":             { left: 30, top: 1004, width: 235, height: 110 } }
```
⚠️ **Gotcha:** `.trim()` **não funciona** nesses recortes (o branco do JPEG tem ruído e o conteúdo encosta nas bordas) — ele devolve o mesmo tamanho. Aperte o `extract` na mão e **confira lendo o PNG de volta**; se a altura sobrar, o corte pega a borda arredondada da célula de baixo.

**4. Capas de conteúdo 3:2** (`src/assets/conteudo/*.jpg`, 1200×800) — as fotos de cena são retrato alto (1206×2144) e um `object-cover` numa caixa larga corta fora a fita. O que resolve é deixar o sharp achar o assunto: `position: sharp.strategy.attention` acerta a fita impressa contra a parede de folhagem uniforme.
```js
await sharp(`imagens/com fundo/${src}`)
  .resize({ width: 1200, height: 800, fit: "cover", position: sharp.strategy.attention })
  .jpeg({ quality: 82, mozjpeg: true }).toFile(`src/assets/conteudo/${dest}`);
```
Mapa: comando · natures · gomada-quemed · lyon · halyee · gomada-yanmei · rolo-tapepro · volume-conferido · caixas-lacradas.
⚠️ Duas exceções ao `attention`:
- **`volume-conferido`**: o `attention` corta o texto "VOLUME CONFERIDO" ao meio — usar `position: "center"`.
- **`caixas-lacradas`** (`SaveClip_..._723100504_...`): tem um adesivo "Entregas 🚚" colado embaixo. Cortar antes com `.extract({ left: 0, top: 430, width: 1206, height: 1280 })`.

## Gotchas do ambiente (Windows)
- **Feche o `astro dev` ao terminar a sessão.** Quem ocupa as portas é o próprio TapePro, não outro projeto: cada sessão sobe um dev server, encontra a porta da anterior ocupada, pula para a próxima e ninguém fecha. Em 2026-07-21 havia **quatro** dev servers do TapePro vivos (4322, 4399, 4400, 4500) de sessões do mesmo dia, mais dois builds do Meridian (3111/3112) parados havia cinco dias. **Confira a porta real no log**, não presuma — e limpe antes de sair:
  ```powershell
  Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
    Where-Object { $_.CommandLine -like '*Tapepro*' } |
    Select-Object ProcessId, CommandLine
  ```
  Processo esquecido não é só porta ocupada: um `dist/server/entry.mjs` zumbi **sem `DATABASE_URL`** fez a suíte de testes conversar com ele em vez do servidor recém-subido — validação passava e todo INSERT dava 500. Ver `handoff-qualidade.md`, seção 1.
- **`python` no Git Bash é stub vazio da Microsoft Store** (não roda). Use **PowerShell** para Python, ou Node para scripts (sharp).
- **cwd da sessão** pode ficar em subpasta — use caminhos absolutos ou `cd` no comando.
- **Screenshots do Playwright saem em branco** se as imagens não decodificaram: rode `await Promise.all([...document.images].map(i=>i.decode().catch(()=>{})))` via `browser_evaluate` antes do `browser_take_screenshot`. Use `loading="eager"` em imagens críticas.
- Screenshots do Playwright caem na **raiz do projeto** (+ pasta `.playwright-mcp/`) — **apagar depois**, não versionar.
- Para testar lógica de form no browser: `browser_evaluate` com `form.requestSubmit()` e stub de `window.open` funciona bem (foi assim que US2 foi validada).
- MCP Playwright/Figma/Stitch **ativos**. Figma em seat **View** (leitura ok; escrever design pode falhar). Gmail/Drive/Notion/Stripe precisam de auth (irrelevantes aqui).

## Como rodar
```bash
npm install
npm run dev                          # dev (confira a porta no log!)
npm run build                        # gera dist/client + dist/server
npm run verificar                    # confere o dist contra os contratos de SEO
npm run indexnow                     # submissão IndexNow (pula fora de NODE_ENV=production)
npm test                             # 30 testes (as suítes de integração pedem build + DATABASE_URL)
node dist/server/entry.mjs           # server real (precisa das env vars)
```

Para mexer no `/admin` local, suba um Postgres descartável e aponte o `.env`:
```bash
docker run -d --name tapepro-pg -e POSTGRES_PASSWORD=teste -e POSTGRES_DB=tapepro -p 55432:5432 postgres:16-alpine
# DATABASE_URL=postgres://postgres:teste@localhost:55432/tapepro
```
O schema se cria sozinho na primeira consulta. Testando com `curl`, mande `-H "Origin: http://127.0.0.1:<porta>"` ou o Astro devolve 403.

## Deploy no Easypanel — passo a passo
1. Serviço **Postgres** no projeto → copiar a connection string interna.
2. Serviço **App** apontando para este repositório, build por **Dockerfile** (já está na raiz).
3. Env vars: `DATABASE_URL`, `SESSION_SECRET` (`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`), `ADMIN_EMAIL`, `ADMIN_SENHA`.
4. Domínio `tapepro.roilabs.com.br` na porta **4321**, TLS ligado. Conferir que o proxy manda `X-Forwarded-Proto`/`X-Forwarded-Host`.
5. Abrir `/admin/login` e entrar com `ADMIN_EMAIL`/`ADMIN_SENHA` — esse primeiro login cria a conta.
