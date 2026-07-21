# Data Model — Indexação rápida e descoberta

**Fase 1** | Feature: `002-indexacao-descoberta` | Data: 2026-07-21

Esta feature **não cria nem altera nenhuma tabela**. O banco (leads/CRM) não é tocado. As "entidades" abaixo são estruturas em memória e arquivos gerados — documentadas porque a spec as nomeia e porque os testes as usam.

---

## Chave IndexNow

Valor público que prova controle sobre o domínio.

| Campo | Regra |
|-------|-------|
| valor | 8–128 caracteres, apenas `a-z A-Z 0-9 -`. Usamos 32 hex. |
| localização | `https://tapepro.roilabs.com.br/<valor>.txt` |
| conteúdo do arquivo | exatamente o valor, sem espaço, quebra de linha final tolerada |

**Fonte de verdade**: o **nome do arquivo** em `public/`. O conteúdo precisa ser igual ao nome sem a extensão — se divergirem, o buscador responde `403` e a submissão é registrada como falha.

**Não existe constante em `src/`.** `scripts/indexnow.mjs` roda na imagem de runtime, que copia apenas `dist`, `node_modules` e `package.json` — não há `src/` para importar, e o script é `.mjs` puro, sem transpilação de TypeScript. O script descobre a chave localizando o único `*.txt` na raiz de `dist/client`.

**Não é segredo.** Por definição do protocolo precisa ser legível por qualquer um.

---

## Conjunto de submissão

Montado a cada disparo, nunca persistido.

| Campo | Origem | Validação |
|-------|--------|-----------|
| `host` | host das próprias URLs do sitemap | precisa ser o domínio de produção, senão o disparo é pulado |
| `key` | nome do único `*.txt` na raiz de `dist/client`, sem extensão | não vazio; conteúdo do arquivo tem que bater com o nome |
| `keyLocation` | `https://<host>/<chave>.txt` | absoluto |
| `urlList` | `<loc>` dos sitemaps em `dist/client/` | toda URL começa com o host; nenhuma contém `/admin` ou `/api`; **nenhuma termina em `.xml`**; lista não vazia (vazia = pular, não erro) |

**Regras derivadas dos requisitos**:

- URL fora do host declarado → descartada (o serviço responderia `422` para o lote inteiro).
- URL terminada em `.xml` → descartada. O `sitemap-index.xml` é lido junto com o `sitemap-0.xml` e seu `<loc>` aponta para outro sitemap — sem esse filtro, a URL de um arquivo XML entraria na lista como se fosse página.
- Lista vazia após o filtro → registra "nada a submeter" e encerra com sucesso.
- Duplicatas → removidas antes do envio.

---

## Marcador de submissão

Arquivo vazio em `dist/.indexnow-enviado`.

| Estado | Significado | Ação |
|--------|-------------|------|
| ausente | container novo, imagem nova, conteúdo novo | submeter, depois criar |
| presente | este container já submeteu | pular |

Vive dentro do `dist` do container: some quando uma imagem nova é construída (deploy = conteúdo novo = submeter) e sobrevive a restart do mesmo container (restart ≠ conteúdo novo = não submeter). Não requer volume persistente.

Falha ao escrever o marcador não é erro fatal — no pior caso sai uma submissão extra no próximo restart.

---

## Item do feed

Derivado de `postsPublicados()` (`src/lib/conteudo.ts`), sem estrutura nova.

| Campo do feed | Campo do post | Observação |
|---------------|---------------|------------|
| `title` | `titulo` | |
| `description` | `descricao` | máx. 160 no schema |
| `link` | `/blog/{id}` | absolutizado com `SITE_URL` |
| `pubDate` | `publicadoEm` | ordenação decrescente já vem do helper |

Posts com `rascunho: true` não entram — o filtro já está no helper, não é reimplementado.

---

## Entrada do índice para IA (`llms.txt`)

Derivada, nunca mantida à mão.

| Seção | Origem | Item |
|-------|--------|------|
| Produtos | `PRODUTOS` (`src/lib/produtos.ts`) | nome + `/produtos/{slug}` + linha de resumo |
| Segmentos | coleção `segmentos` | `titulo` + `/segmentos/{id}` + `resumo` |
| Blog | `postsPublicados()` | `titulo` + `/blog/{id}` + `descricao` |
| Institucional | rotas fixas conhecidas | `/sobre`, `/orcamento`, `/perguntas-frequentes` |

Todos os links absolutos, prefixados por `SITE_URL`. Nenhuma rota de `/admin` ou `/api` aparece — elas não existem em nenhuma dessas fontes.
