# Data Model — Site Institucional SEO-first (TapePro)

Sem banco de dados. "Dados" = Content Collections (arquivos validados por Zod no build) + o payload do Lead (em trânsito, não persistido). Schemas concretos em [contracts/content-collections.md](./contracts/content-collections.md).

## Entidades de conteúdo (build-time)

### Produto  (`src/content/produtos/*.mdx`)
Um tipo de fita comercializado.

| Campo | Tipo | Regra |
|---|---|---|
| `titulo` | string | obrigatório |
| `slug` | string (derivado do arquivo) | único; URL `/produtos/{slug}` |
| `categoria` | enum `personalizada` \| `gomada` \| `comum` | obrigatório |
| `resumo` | string | ≤ 160 chars (serve de meta description) |
| `specs` | array de `{ rotulo, valor }` | ≥ 1 (ex.: `{Largura, 48mm}`, `{Comprimento, 100m}`, `{Cores, até 2}`) |
| `aplicacoes` | string[] | ≥ 1 |
| `diferenciais` | string[] | opcional |
| `imagem` | image() | obrigatório (foto real; sem placeholder) |
| `imagemAlt` | string | obrigatório |
| `ordem` | number | ordenação na listagem |
| `seo` | `{ title?, description? }` | opcional (fallback: titulo/resumo) |

Relacionamentos: referenciado por `Segmento.produtosRelacionados` e `BlogPost.produtosRelacionados`.

### Segmento / Aplicação  (`src/content/segmentos/*.mdx`)
Caso de uso por perfil de cliente (indústria, distribuidor, e-commerce, lojas).

| Campo | Tipo | Regra |
|---|---|---|
| `titulo` | string | obrigatório |
| `slug` | string | único; URL `/segmentos/{slug}` |
| `resumo` | string | ≤ 160 chars |
| `dores` | string[] | ≥ 1 (problemas do segmento) |
| `produtosRelacionados` | reference[] → Produto | ≥ 1 |
| `imagem` | image() | obrigatório |
| `imagemAlt` | string | obrigatório |
| `seo` | `{ title?, description? }` | opcional |

### BlogPost  (`src/content/blog/*.mdx`)
Artigo educativo long-tail.

| Campo | Tipo | Regra |
|---|---|---|
| `titulo` | string | obrigatório |
| `slug` | string | único; URL `/blog/{slug}` |
| `descricao` | string | obrigatório, ≤ 160 chars (meta description) |
| `intencao` | string | obrigatório (keyword/intenção-alvo — documenta o porquê da página) |
| `publicadoEm` | date | obrigatório |
| `atualizadoEm` | date | opcional |
| `imagem` | image() | obrigatório |
| `imagemAlt` | string | obrigatório |
| `produtosRelacionados` | reference[] → Produto | opcional |
| `rascunho` | boolean | default false (não indexa se true) |

### FAQItem  (`src/content/faq/*.md` ou um JSON)
Pergunta e resposta.

| Campo | Tipo | Regra |
|---|---|---|
| `pergunta` | string | obrigatório |
| `resposta` | string/markdown | obrigatório |
| `grupo` | enum (ex.: `pedido`, `produto`, `entrega`, `personalizacao`) | obrigatório |
| `ordem` | number | ordenação |

Uso: alimenta a página `/perguntas-frequentes` e o JSON-LD `FAQPage`.

## Entidade em trânsito

### Lead de Orçamento  (payload do formulário — não persistido no site)
Enviado ao serviço de formulário → e-mail do representante. Contrato completo em [contracts/quote-form.md](./contracts/quote-form.md).

| Campo | Tipo | Regra |
|---|---|---|
| `nome` | string | obrigatório |
| `empresa` | string | obrigatório |
| `cnpj` | string | opcional; se preenchido, formato CNPJ válido |
| `email` | string | obrigatório; formato e-mail |
| `telefone` | string | obrigatório |
| `tipoFita` | enum (categorias de Produto) + `nao_sei` | obrigatório |
| `quantidadeEstimada` | string/number | obrigatório |
| `mensagem` | string | opcional |
| `paginaOrigem` | string (hidden) | preenchido automaticamente (rastreio de origem) |
| `_honeypot` | string (hidden) | DEVE ficar vazio (descarta se preenchido) |

## Constantes (fonte única — `src/lib/constants.ts`)
Valores de negócio fora do conteúdo, para não virar "magic number" (regra CLAUDE.md):
`WHATSAPP_NUMERO`, `PEDIDO_MINIMO_ROLOS = 20`, `EMPRESAS_ATENDIDAS = 1000`, `SITE_URL`, `NOME_MARCA = "TapePro"`, specs padrão dos produtos, e-mail de destino do lead.
