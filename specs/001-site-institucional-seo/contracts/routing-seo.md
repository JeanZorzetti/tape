# Contract — Rotas, URLs e SEO estrutural

URLs limpas em PT-BR (FR-002). Mapa de rotas → arquivos em `src/pages/`.

## Mapa de rotas

| URL | Arquivo | Fonte | JSON-LD |
|---|---|---|---|
| `/` | `index.astro` | estático + destaques das coleções | Organization |
| `/produtos/` | `produtos/index.astro` | coleção `produtos` | Organization |
| `/produtos/{slug}` | `produtos/[slug].astro` | entrada `produtos` | Product + Breadcrumb |
| `/segmentos/` | `segmentos/index.astro` | coleção `segmentos` | Organization |
| `/segmentos/{slug}` | `segmentos/[slug].astro` | entrada `segmentos` | Breadcrumb |
| `/blog/` | `blog/index.astro` | coleção `blog` (não-rascunho) | Organization |
| `/blog/{slug}` | `blog/[slug].astro` | entrada `blog` | BlogPosting + Breadcrumb |
| `/perguntas-frequentes` | `perguntas-frequentes.astro` | coleção `faq` | FAQPage |
| `/sobre` | `sobre.astro` | estático (institucional/prova social) | Organization |
| `/orcamento` | `orcamento.astro` | formulário + WhatsApp | Organization |
| `/sitemap-index.xml` | `@astrojs/sitemap` | automático | — |
| `/robots.txt` | `public/robots.txt` | estático | — |

Slugs sugeridos de produto: `fita-personalizada`, `fita-gomada`, `fita-transparente`.
Slugs de segmento: `industria`, `distribuidor`, `e-commerce`, `lojas`.

## Regras de SEO estrutural
- **Slugs**: minúsculos, hífen, sem acento, estáveis (nunca renomear sem redirect).
- **Canonical**: toda página aponta pra própria URL absoluta; sem parâmetros.
- **Breadcrumb**: produto/segmento/post expõem `BreadcrumbList` + trilha visível.
- **Links internos**: todo produto linka segmentos/posts relacionados e vice-versa (reduz órfãs — Acceptance US1/US4).
- **`robots.txt`**:
  ```
  User-agent: *
  Allow: /
  Sitemap: {SITE_URL}/sitemap-index.xml
  ```
- **Rascunhos** (`rascunho: true`): fora do build indexável e do sitemap.
- **404**: `404.astro` com busca/links úteis, `noindex`.
- **Sem órfãs**: toda página indexável alcançável por navegação ou índice de coleção (SC-001 / Acceptance US1).
