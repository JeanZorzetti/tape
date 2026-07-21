# Handoff — Qualidade e acabamento pós-lançamento

> Documento de passagem entre sessões. Leia junto com [`handoff.md`](handoff.md).
> Criado em **2026-07-21**, depois do site entrar no ar. Status: **não iniciado**.
> Nada aqui bloqueia a operação — o site está publicado e validado. É dívida assumida, escrita para não virar "later means never".

**Ordem sugerida: 2 → 3 → 1.** A compressão é config de 5 minutos com ganho imediato; o favicon é visível em todo link compartilhado; os testes são o maior investimento e o que mais rende se o site continuar evoluindo.

---

## 1. Testes — não existe nenhum (T024, T025, T026, T030, T037, T043)

**Este é o item que importa.** Todo o comportamento do site foi verificado **à mão, uma vez**, e não tem rede de segurança. Quem mexer daqui a três meses não tem como saber se quebrou o funil de orçamento sem refazer tudo na mão.

O que já existe e **não** precisa ser reescrito: `scripts/verificar-seo.mjs` (`npm run verificar`) cobre h1 único, JSON-LD parseável, canonical, description ≤160, alt, placeholder, órfãs, links quebrados, imagens (existe em disco, `width`/`height`, teto de 200 KB) e a regra de `FAQPage` em página única. **Ele é a especificação executável do que o SEO precisa** — leia antes de escrever qualquer teste de SEO, e não duplique o que ele já faz.

### Instalar

```bash
npm i -D @playwright/test
npx playwright install chromium
```

Um único runner resolve tudo: Playwright roda os testes de browser **e** os unitários (`expect` sem página). Não instalar Vitest só para dois helpers puros.

### O que testar, em ordem de valor

**a) Funil de orçamento (T030) — o que dá dinheiro.** É o caminho crítico e o único fluxo com estado real.
- `POST /api/lead` com dados válidos → `{"ok":true,"id":N}` e o lead aparece em `/admin`.
- Obrigatórios faltando → recusa. **CNPJ**: se preenchido, exige exatamente 14 dígitos ([lead.ts:38](src/pages/api/lead.ts#L38)) — mande 13 e confirme a recusa.
- **Honeypot**: campo `botcheck` preenchido → responde `{"ok":true}` e **não grava** ([lead.ts:19](src/pages/api/lead.ts#L19)). O teste tem que checar o banco, não a resposta — a resposta mente de propósito.
- Fallback: se o POST falha, o form abre WhatsApp com os dados preenchidos.

**b) Helpers puros (T026) — barato e sem infra.** `src/lib/whatsapp.ts` e `src/lib/quoteForm.ts` são funções puras, testáveis sem browser nem banco:
- `whatsappParaNumero("62983443919")` → prefixa `55`; `"5562..."` → não duplica.
- `whatsappLink(contexto, paginaOrigem)` → mensagem com a origem entre parênteses, texto URL-encoded.
- `tipoFitaLabel("valor_inexistente")` → cai no fallback `"fitas personalizadas"`.
- `whatsappFromLead({})` → não quebra com campos vazios (tem `(sem nome)`/`a definir`).

**c) Auth do admin.** `src/lib/auth.ts`: cookie assinado com HMAC — adulterar o cookie tem que ser rejeitado. Throttle de 8 tentativas / 15 min é **em memória** ([auth.ts:17-18](src/lib/auth.ts#L17-L18)): reinício do processo zera, e com mais de uma réplica cada uma conta a sua. Se o teste for flaky, é isso.

**d) SEO/produtos/conteúdo (T024/T037/T043).** Só o que o `verificar` **não** vê: se os links internos são *relevantes*, não só presentes. Baixo valor em teste automatizado — considere pular e manter como revisão editorial.

**e) Lighthouse em CI (T025).** Só vale se houver CI. Hoje não há. Provavelmente YAGNI: o `verificar` já barra as regressões de imagem que derrubam o score.

### Gotchas que vão custar tempo (todos já custaram)

- **CSRF:** o Astro recusa POST sem `Origin` compatível. Com `curl`, mande `-H "Origin: http://127.0.0.1:<porta>"` ou leva **403**. Ver `security.allowedDomains` no `astro.config.mjs`.
- **Postgres para `/admin` e `/api`:** o site estático builda sem banco, mas esses testes precisam dele. Descartável em Docker:
  ```bash
  docker run -d --name tapepro-pg -e POSTGRES_PASSWORD=teste -e POSTGRES_DB=tapepro -p 55432:5432 postgres:16-alpine
  # DATABASE_URL=postgres://postgres:teste@localhost:55432/tapepro
  ```
  O schema se cria sozinho na primeira consulta (`create table if not exists`).
- **Primeiro login cria a conta** — só enquanto a tabela `usuarios` estiver vazia. O teste de "primeiro acesso" precisa de banco limpo; rodar duas vezes seguidas falha a segunda.
- **Teste contra o build, não o `astro dev`.** `npm run build && node dist/server/entry.mjs`. O `/404` só devolve status 404 de verdade no servidor Node — no dev funciona diferente.
- **Portas 4321/4399 ocupadas** por outro projeto nesta máquina. Fixe a porta do teste (`PORT=4455`) em vez de presumir.

---

## 2. Compressão no proxy do Easypanel — 5 minutos, maior ganho restante

**Confirmado em 2026-07-21:** `curl -H "Accept-Encoding: gzip, br" -D - https://tapepro.roilabs.com.br/` não devolve `content-encoding`. **Está servindo sem compressão.**

O Lighthouse aponta ~300–600 ms de economia (`uses-text-compression`), a maior parte no CSS único de 57 KB. É **config de infra, não de código** — ligar gzip/brotli no proxy do Easypanel. Depois de ligar, confirmar com o mesmo `curl` e rodar o Lighthouse de novo.

O segundo item de performance é `render-blocking-resources` (~307 ms): o CSS de 57 KB é quase todo fonte self-hosted (Archivo 500/700/800 + IBM Plex Sans 400/500/600 + Mono 400/500 = **8 pesos**). Se quiser mais, o caminho é cortar pesos que ninguém usa — conferir no `global.css` quais realmente aparecem no design antes de remover.

---

## 3. Favicon e OG definitivos

Ambos são provisórios e **eu que desenhei** — não são a marca:
- `public/favicon.svg` — quadrado navy com um anel laranja. Genérico, aparece na aba do browser.
- `public/og-default.png` (126 KB) — aparece em **todo link compartilhado no WhatsApp**, que é o canal principal deste negócio. Vale mais do que parece.

O logo real está em `src/assets/marca/logo-tapepro.png` (1627×1167). Receitas de `sharp` no fim do [`handoff.md`](handoff.md). Para o OG: 1200×630, com o wordmark e a fita laranja — não repetir o hero, que fica ilegível em miniatura.

---

## 4. Frente aberta separada

[`handoff-imagens-blog.md`](handoff-imagens-blog.md) — harness de prompt (Gemini) para gerar as capas dos posts. Não iniciado, é melhoria de conteúdo. O schema do blog já tem o campo `cenaImagem` reservado para isso (`src/content.config.ts`).

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
