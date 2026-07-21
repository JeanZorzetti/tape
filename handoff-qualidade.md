# Handoff — Qualidade e acabamento pós-lançamento

> Documento de passagem entre sessões. Leia junto com [`handoff.md`](handoff.md).
> Criado em **2026-07-21**, depois do site entrar no ar. Status: **não iniciado**.
> Nada aqui bloqueia a operação — o site está publicado e validado. É dívida assumida, escrita para não virar "later means never".

**Ordem sugerida: 2 → 3 → 1.** A compressão é config de 5 minutos com ganho imediato; o favicon é visível em todo link compartilhado; os testes são o maior investimento e o que mais rende se o site continuar evoluindo.

**Atualização 2026-07-21:** itens 3 e 1 concluídos (o 1 em parte — ver abaixo). Resta o **item 2**, que é config de infra e não sai daqui.

---

## 1. Testes — EXISTEM (25), com buracos conhecidos

Feito em 2026-07-21. **25 testes, zero dependências novas** — runner nativo (`node --test`), `node:assert`, `fetch`. Playwright e Vitest não foram instalados e não precisam ser: os helpers são funções puras e o resto se testa por HTTP contra o servidor real.

```bash
npm test                       # 18 testes; pula a suíte que precisa de banco
DATABASE_URL=... npm test      # 25 testes
```

O Node 22.18+ remove os tipos sozinho, então os `.ts` de `src/lib` são importados direto. **Preço disso:** o resolvedor ESM do Node não completa extensão, então `src/lib/whatsapp.ts` e `src/lib/quoteForm.ts` importam `"./constants.ts"` com extensão explícita. Se alguém "limpar" essas duas linhas, os testes de helper quebram.

`scripts/verificar-seo.mjs` (`npm run verificar`) continua sendo a especificação executável do SEO e **não** foi duplicado.

### O que está coberto

| Arquivo | Cobre |
|---|---|
| `tests/helpers.test.mjs` (11) | `whatsappParaNumero` (DDI, máscara), `whatsappLink` (origem, fallback), `tipoFitaLabel`, `whatsappFromLead` com lead vazio |
| `tests/api-lead.test.mjs` (7) | lead válido gravado, obrigatórios, e-mail, CNPJ 13/14/vazio, honeypot, truncamento, Origin cross-site |
| `tests/admin-auth.test.mjs` (7) | cookie válido entra; sem cookie, assinatura forjada, id trocado, validade esticada, vencido e malformado vão pro login |
| `tests/servidor.mjs` | sobe `dist/server/entry.mjs` em porta efêmera (não é teste) |

Os três casos que mais importam foram **verificados por mutação** — desligando a lógica no código e confirmando que o teste fica vermelho: DDI do WhatsApp (1 falha), honeypot (1), verificação de HMAC (3). Se mexer neles, repita isso; teste que não falha quando deveria é pior que nenhum.

### Buracos deixados de propósito

- **Fallback do form para WhatsApp quando o POST falha** — é JS de browser, é o único que justificaria Playwright. Único caminho do funil sem cobertura.
- **Throttle de login** (8 tentativas / 15 min, [auth.ts:17-18](src/lib/auth.ts#L17-L18)): é **em memória**, some no restart e cada réplica conta a sua. Testar exigiria 8 POSTs e travaria o estado do processo para os testes seguintes. Baixo valor.
- **Primeiro login cria a conta** — só enquanto `usuarios` estiver vazia, então o teste só passa uma vez por banco. Precisaria de `truncate` no setup; não valeu.
- **d) SEO/conteúdo (T024/T037/T043)** e **e) Lighthouse em CI (T025)** — mantidos como estavam: revisão editorial e YAGNI (não há CI).

### Gotchas que vão custar tempo (todos já custaram)

- **NÃO fixe a porta do teste.** Custou uma hora nesta sessão. Havia um `dist/server/entry.mjs` esquecido de outra sessão ocupando a 4455; o nosso servidor morria com EADDRINUSE e a suíte conversava com o processo do estranho. Os testes de validação passavam (é o mesmo código) e **todo INSERT dava 500**, porque o zombie não tinha `DATABASE_URL`. `tests/servidor.mjs` agora pede porta efêmera ao SO e aborta se o processo filho morrer.
- **Repasse o stderr do servidor** (`tests/servidor.mjs` faz isso). Sem ele, um 500 aparece como `500 !== 200` e você fica adivinhando.
- **CSRF:** o Astro recusa POST sem `Origin` compatível. Com `curl`, mande `-H "Origin: http://127.0.0.1:<porta>"` ou leva **403**. Ver `security.allowedDomains` no `astro.config.mjs`.
- **Postgres para `/admin` e `/api`:** o site estático builda sem banco, mas esses testes precisam dele. Descartável em Docker:
  ```bash
  docker run -d --name tapepro-pg -e POSTGRES_PASSWORD=teste -e POSTGRES_DB=tapepro -p 55432:5432 postgres:16-alpine
  # DATABASE_URL=postgres://postgres:teste@localhost:55432/tapepro
  ```
  O schema se cria sozinho na primeira consulta (`create table if not exists`) — a primeira rodada num banco novo é a que cria as tabelas.
- **Teste contra o build, não o `astro dev`.** As suítes de integração rodam `dist/server/entry.mjs`, então **`npm run build` antes** ou você testa código velho. O `/404` só devolve 404 de verdade no servidor Node.

---

## 2. Compressão no proxy do Easypanel — 5 minutos, maior ganho restante

**Confirmado em 2026-07-21:** `curl -H "Accept-Encoding: gzip, br" -D - https://tapepro.roilabs.com.br/` não devolve `content-encoding`. **Está servindo sem compressão.**

O Lighthouse aponta ~300–600 ms de economia (`uses-text-compression`), a maior parte no CSS único de 57 KB. É **config de infra, não de código** — ligar gzip/brotli no proxy do Easypanel. Depois de ligar, confirmar com o mesmo `curl` e rodar o Lighthouse de novo.

O segundo item de performance é `render-blocking-resources` (~307 ms): o CSS de 57 KB é quase todo fonte self-hosted (Archivo 500/700/800 + IBM Plex Sans 400/500/600 + Mono 400/500 = **8 pesos**). Se quiser mais, o caminho é cortar pesos que ninguém usa — conferir no `global.css` quais realmente aparecem no design antes de remover.

---

## 3. Favicon e OG definitivos — CONCLUÍDO em 2026-07-21

**`public/favicon.svg`** — deixou de ser o anel laranja genérico. Agora é o rolo visto de frente: anel laranja (`#f47c20`) + miolo kraft (`#c8a97a`) sobre o quadrado navy. As duas cores de material dizem "fita adesiva"; um anel sozinho dizia "alvo".

> Tentativa descartada, para não se repetir: copiar o "O" do PRO do logo (anel + tira diagonal saindo tangente). Em 16–32 px a tira gruda no anel e o ícone **lê como um "Q"**. Verificado renderizando em 16/32/64 px ampliado com `kernel: 'nearest'` — vale repetir esse teste antes de mexer no favicon de novo.

**`public/og-default.png`** — reconstruído, 93 KB (era 126 KB, um logo centralizado sobre papel). Agora: painel de marca à esquerda (logo real + duas linhas de spec) e foto real do produto à direita, separados por um filete laranja. Assimétrico de propósito.

Gerado por **`scripts/gerar-og.mjs`** (`node scripts/gerar-og.mjs`) — mexer lá, não no PNG.
- A foto é `src/assets/conteudo/rolos-tapepro-prateleira.jpg` — rolos kraft com TAPE PRO impresso em laranja, profundidade de campo curta. É o melhor ativo: mostra qualidade de impressão e ainda lê em miniatura. Não repete o hero da home (`deposito-tapepro.jpg`).
- **Gotcha de peso:** `png({ palette: true })` sem `colors` gera **250 KB**. Com `colors: 128` cai para **93 KB** sem banding visível (a foto é quase toda kraft/laranja/cinza). Entre 128 e 160 o arquivo pula de 98 KB para 219 KB — não existe meio-termo, é o limiar do quantizador.
- **Fontes:** o `sharp`/librsvg no Windows só enxerga fontes do sistema — Archivo e IBM Plex são `@fontsource` em `node_modules` e **não** carregam. As linhas de spec usam `Segoe UI, Arial`. Não vale instalar fonte no sistema por causa disso; o wordmark da marca já vem do PNG real.

---

## 4. Frente separada — CONCLUÍDA

[`handoff-imagens-blog.md`](handoff-imagens-blog.md) — harness de prompt (Gemini) para as capas dos posts. **Concluído:** `scripts/prompt-imagem-post.mjs` e `scripts/normalizar-imagem-post.mjs` existem e as 7 capas já foram trocadas. Aquele doc é a fonte da verdade sobre o fluxo e sobre a exceção que ele abre no `CLAUDE.md`.

> Esta seção dizia "não iniciado" até 2026-07-21 e induziu ao erro numa sessão seguinte. **Confira o repositório antes de confiar no status escrito aqui.**

---

## Também aberto, e provavelmente deve continuar assim

- **T016 — componentes base (Card/Eyebrow/SpecTable/Figure).** O padrão está repetido inline entre `/produtos/[slug]`, `/segmentos/[slug]` e `/blog/[slug]`. **Extrair só se aparecer uma quarta página com o mesmo formato** — com três, a abstração custa mais do que a repetição.
- **T004 — ESLint/Prettier.** Não instalados. Projeto de um dev só, estilo consistente. Instalar quando entrar mais gente.
- **T021 — pipeline de imagem.** Hoje é script manual com `sharp`; as receitas estão no `handoff.md` e funcionam. Automatizar só se a frequência de imagens novas subir.
- **`astro check`** não roda: pede instalar `@astrojs/check` + `typescript` e abre prompt interativo.

## Decisão registrada — `Product` sem `offers` é erro esperado no Rich Results Test

As 3 páginas de produto aparecem como "item inválido" no teste do Google: `Product` precisa de `offers`/`review`/`aggregateRating` para virar rich snippet. **Isso não se corrige e não é bug:**

- `offers` exige **preço**, e o site não mostra preço (decisão comercial travada — o nicho vende por orçamento).
- Marcar preço no JSON-LD que não aparece na página **viola as diretrizes do Google** (structured data tem que refletir o conteúdo visível) e pode gerar ação manual. Inventar `review`/`aggregateRating` é pior.
- Efeito real: essa página não ganha o card enriquecido. Indexa e ranqueia normalmente, e o `Product` segue sendo lido pelo Google e por motores de IA.
- O `BreadcrumbList` da mesma página é válido e **esse** aparece na SERP. `FAQPage` e `BlogPosting` passaram.

O único incômodo é cosmético: o relatório "Produtos" no Search Console vai listar 3 itens com erro para sempre. Se um dia isso incomodar mais do que o markup vale, remover o bloco `Product` das 3 páginas resolve — mas a leitura por IA piora.
