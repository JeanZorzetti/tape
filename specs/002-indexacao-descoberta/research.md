# Research — Indexação rápida e descoberta

**Fase 0** | Feature: `002-indexacao-descoberta` | Data: 2026-07-21

Nenhum `NEEDS CLARIFICATION` sobreviveu à spec. As decisões abaixo resolvem as escolhas técnicas que a spec deixou em aberto de propósito.

---

## D1 — Quando disparar a submissão IndexNow

**Decision**: na **subida do container**, em background, ~15s após o processo iniciar, com marcador de idempotência em `dist/.indexnow-enviado`.

**Rationale**: o `Dockerfile` roda `npm run build` no estágio de build da imagem. Nesse momento o conteúdo novo **ainda não está no ar** — avisar o buscador ali faz o rastreador chegar e encontrar a versão antiga. A subida do container é o primeiro instante em que o conteúdo novo existe publicamente. Rodar desanexado do processo do servidor evita atrasar o health check, e o marcador impede que um restart do mesmo container (crash, reinício do Easypanel) vire uma nova submissão do mesmo conteúdo.

**Alternatives considered**:

- *Ping no `postbuild` do npm*: mais simples, mas submete conteúdo que ainda não está publicado, e um rebuild sem deploy mentiria para o buscador.
- *Middleware do Astro na primeira requisição*: as páginas estáticas não passam pelo middleware neste modo híbrido, então o disparo dependeria de alguém abrir `/admin` ou postar um lead — gatilho não confiável.
- *Bloquear a subida até a submissão terminar*: acopla o health check a uma rede externa. Viola FR-004 na prática.

**Ceiling** (`ponytail:`): se o Easypanel recriar o container sem novo build, sai uma submissão a mais. Custo nulo neste volume. Se um dia doer, o marcador passa a guardar o hash do conjunto de URLs em vez de existir/não existir.

---

## D2 — Quais URLs submeter

**Decision**: todas as `<loc>` dos sitemaps gerados em `dist/client/`, extraídas por regex, com filtro que descarta qualquer coisa sob `/admin` ou `/api` **e qualquer `<loc>` terminada em `.xml`**.

**O filtro de `.xml` não é decorativo**: o `@astrojs/sitemap` gera `sitemap-index.xml` **e** `sitemap-0.xml`, e o `<loc>` do índice aponta para o outro sitemap. Ler os dois e submeter tudo mandaria a URL de um arquivo XML como se fosse página.

**Rationale**: o sitemap já é a fonte de verdade das URLs públicas e já exclui `/admin` pelo `filter` em `astro.config.mjs` — reusá-lo evita manter uma segunda lista de rotas (DRY). O filtro extra é cinto e suspensório barato para FR-003: se alguém afrouxar o filtro do sitemap, a submissão continua limpa. Regex sobre `<loc>` dispensa parser de XML para um arquivo que nós mesmos geramos.

**Alternatives considered**:

- *Só as URLs alteradas*: o protocolo recomenda, mas com ~30 URLs e submissão por deploy (D1) o conjunto completo é aceitável e honesto — um deploy só acontece quando o conteúdo muda. O `lastmod` que D7 passou a emitir cobre só as rotas de blog, insuficiente para filtrar o site inteiro.
- *Lista manual de URLs importantes*: segunda fonte de verdade, apodrece no primeiro post novo.

---

## D3 — Endpoint e formato da submissão

**Decision**: um único `POST https://api.indexnow.org/indexnow`, `Content-Type: application/json`, corpo `{ host, key, keyLocation, urlList }`.

**Rationale**: o endpoint genérico replica a submissão para todos os buscadores participantes (Bing, Yandex, Seznam, Naver) — uma chamada em vez de uma por buscador. O formato JSON em lote manda todas as URLs de uma vez (limite do protocolo: 10.000 por requisição, muito acima do nosso volume). `fetch` nativo do Node 22 cobre isso sem dependência.

**Respostas a tratar**: `200` aceito · `202` aceito, chave em validação · `400` corpo inválido · `403` chave não confere com o arquivo publicado · `422` URLs não pertencem ao host · `429` excesso. Todas são **registradas e engolidas** — nenhuma derruba o container (FR-004, FR-006).

---

## D4 — A chave IndexNow

**Decision**: string hexadecimal de 32 caracteres, gerada uma vez, existindo em **um único lugar**: `public/<chave>.txt`, cujo nome sem extensão é igual ao conteúdo. O script descobre a chave localizando o único `*.txt` na raiz de `dist/client`.

**Rationale**: o protocolo exige que a chave seja publicamente legível na raiz do domínio — é justamente assim que o buscador prova que quem submeteu controla o site. Não é segredo e não conta como credencial no repositório.

Uma constante em `src/lib/constants.ts` **não funcionaria**: o `Dockerfile` copia para a imagem de runtime apenas `dist`, `node_modules` e `package.json`. Não existe `src/` para o `scripts/indexnow.mjs` importar, e ele é `.mjs` puro — não há transpilação de TypeScript no runtime. Derivar tudo do `dist` elimina o acoplamento em vez de contorná-lo.

**Alternatives considered**:

- *Constante em `src/lib/constants.ts`*: quebra na primeira execução dentro do container, e quebraria em produção, onde ninguém está olhando.
- *Copiar `src/` para a imagem de runtime*: engorda a imagem e ainda deixa o problema do import de TypeScript.
- *Chave em variável de ambiente*: acrescenta um ponto de configuração no Easypanel para um valor que precisa ser público de qualquer forma.

---

## D5 — Guarda de domínio de produção

**Decision**: o script só submete se o host derivado de `SITE_URL` for o domínio de produção; em qualquer outro caso registra "pulado" e sai com código 0.

**Rationale**: FR-005. Impede que um `npm run build` local ou um ambiente de preview envie URLs que o buscador vai rejeitar (ou pior, aceitar apontando para lugar errado). Sair com 0 mantém a regra de nunca quebrar o fluxo.

---

## D6 — Verificação no Bing Webmaster Tools

**Decision**: **importar o site do Google Search Console** pelo próprio painel do Bing. Arquivo `public/BingSiteAuth.xml` fica como plano B, só se a importação não estiver disponível.

**Rationale**: o GSC já está verificado (declarado pelo usuário). A importação transfere a verificação, os sitemaps e o histórico sem tocar no repositório — é a rota de menor esforço e menor superfície. A meta tag por página foi descartada: adiciona bytes a todo HTML do site para resolver algo que um arquivo estático resolve uma vez.

**Passo manual, e isso é aceitável**: não existe API pública de verificação de propriedade que justifique automatizar. Fica documentado em `docs/bing-webmaster.md` (FR-008).

---

## D7 — Google Search Console: sem API, mas com `lastmod`

**Decision**: submissão programática fora de escopo. **Passar a emitir `lastmod` nas rotas `/blog/*`** (T031).

**Rationale**: a Indexing API do Google aceita apenas `JobPosting` e `BroadcastEvent` — nenhum dos dois existe neste site. Para páginas comuns, o Google só oferece sitemap e a inspeção manual de URL no painel. O IndexNow **não** é aceito pelo Google.

Resta o `lastmod`, e aqui a versão anterior deste documento se contradizia: afirmava que "o gerador de sitemap já faz", quando [astro.config.mjs](../../astro.config.mjs) não configura `serialize` nem `lastmod` — o `@astrojs/sitemap` **não** emite `lastmod` por padrão. Como é o único sinal de atualização que temos para o Google, passa a ser emitido de verdade.

**Escopo do `lastmod`**: só as rotas de blog, a partir de `atualizadoEm ?? publicadoEm`. As páginas institucionais e de produto mudam junto com o deploy inteiro — carimbar todas com a data do build seria ruído, não sinal.

**Implementação**: o `astro.config.mjs` não acessa `astro:content`, então as datas saem de `fs` + regex sobre o frontmatter de `src/content/blog/*.mdx`, com o slug vindo do nome do arquivo.

`ponytail:` regex sobre frontmatter em vez de parser de YAML — o formato dessas datas é gerado pelo nosso próprio schema. Migrar para leitura da coleção se o frontmatter ficar irregular.

---

## D8 — Formato do `llms.txt`

**Decision**: endpoint `src/pages/llms.txt.ts` que gera o formato do llmstxt.org — `# título`, `> resumo em uma linha`, e seções `##` com links markdown e descrição curta por item. Gerado de `PRODUTOS`, da coleção `segmentos`, de `postsPublicados()` e das páginas institucionais.

**Rationale**: gerar como endpoint (e não como arquivo estático em `public/`) é o que garante FR-010: uma página nova entra na listagem sozinha, sem edição manual. Como o site é estático, o Astro emite o arquivo no build — custo zero em runtime.

**Alternatives considered**: arquivo estático escrito à mão — desatualiza no primeiro post novo, exatamente o que FR-010 proíbe.

---

## D9 — Agentes de IA no `robots.txt`

**Decision**: manter o `robots.txt` estático em `public/` e acrescentar blocos explícitos de `Allow` para os agentes de busca generativa e de treinamento, mais `Disallow: /admin/` e `Disallow: /api/` para `User-agent: *`.

**Agentes cobertos**: `GPTBot`, `OAI-SearchBot`, `ChatGPT-User` (OpenAI), `ClaudeBot`, `Claude-User`, `Claude-SearchBot` (Anthropic), `PerplexityBot`, `Perplexity-User` (Perplexity), `Google-Extended` (token de uso em IA generativa do Google, não é rastreador), `Applebot-Extended`, `meta-externalagent`, `CCBot`.

**Rationale**: o `Allow: /` genérico já permitiria todos, mas a permissão explícita é o sinal que as ferramentas de auditoria de GEO/AEO leem, e documenta a decisão para quem mexer depois. O bloqueio de `/admin` e `/api` fecha FR-012 — hoje o `robots.txt` não bloqueia nada, e só o sitemap exclui o admin.

**Alternatives considered**: gerar o `robots.txt` como endpoint — a lista de agentes não deriva de conteúdo, então seria código para um arquivo que muda uma vez por ano.

---

## D10 — Feed RSS

**Decision**: `@astrojs/rss` em `src/pages/rss.xml.ts`, alimentado por `postsPublicados()`; `<link rel="alternate" type="application/rss+xml">` no `<head>` do `BaseLayout`.

**Rationale**: é o gerador oficial do framework, aprovado como única dependência nova. `postsPublicados()` já filtra rascunho e já ordena por data decrescente — cobre FR-013 e FR-014 sem código novo de filtragem, e garante que o feed nunca divirja do que `/blog` mostra. Feed vazio sai como XML válido sem item, o que atende FR-016 por construção.

---

## D11 — Como verificar sem framework de teste novo

**Decision**: dois níveis, ambos em ferramenta que já existe no projeto.

1. `tests/indexnow.test.mjs` (`node --test`, já em `npm test`) para a lógica que pode quebrar em silêncio: extração de `<loc>`, exclusão de `/admin` e `/api`, guarda de domínio, idempotência do marcador.
2. `scripts/verificar-seo.mjs` (`npm run verificar`) estendido para conferir, no `dist` gerado: `rss.xml` existe e tem itens, `llms.txt` existe e lista as rotas reais, `robots.txt` bloqueia `/admin` e `/api`, e o arquivo de chave está presente.

**Rationale**: o projeto já usa esses dois caminhos, e o script de verificação já varre o `dist` — acrescentar quatro checagens ali é menor que criar um harness novo.
