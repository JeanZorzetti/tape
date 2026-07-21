# Contract — Dados Estruturados (JSON-LD) e metadados

Cobre FR-002/003. Alcance nacional → **Organization**, não LocalBusiness (FR-016). Um `<script type="application/ld+json">` por página, pelo componente `JsonLd.astro`.

## Organization (site-wide, no layout base)
```json
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "TapePro",
  "url": "{SITE_URL}",
  "logo": "{SITE_URL}/logo.png",
  "description": "Fitas adesivas personalizadas para embalagem — representante comercial oficial.",
  "contactPoint": {
    "@type": "ContactPoint",
    "contactType": "sales",
    "areaServed": "BR",
    "availableLanguage": "pt-BR"
  },
  "sameAs": ["{instagram}", "{whatsapp}"]
}
```

## Product (páginas de produto)
```json
{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "{titulo}",
  "description": "{resumo}",
  "image": "{url absoluta da imagem}",
  "brand": { "@type": "Brand", "name": "TapePro" },
  "category": "Fita adesiva",
  "additionalProperty": [
    { "@type": "PropertyValue", "name": "Largura", "value": "48mm" },
    { "@type": "PropertyValue", "name": "Comprimento", "value": "100m" }
  ]
}
```
> Sem `offers`/preço: venda é por orçamento (sem preço público). Não declarar preço falso.

## FAQPage (/perguntas-frequentes)
```json
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    { "@type": "Question", "name": "{pergunta}",
      "acceptedAnswer": { "@type": "Answer", "text": "{resposta}" } }
  ]
}
```

## BlogPosting + BreadcrumbList (posts e segmentos)
```json
{
  "@context": "https://schema.org",
  "@type": "BlogPosting",
  "headline": "{titulo}",
  "description": "{descricao}",
  "image": "{url absoluta}",
  "datePublished": "{publicadoEm ISO}",
  "dateModified": "{atualizadoEm ou publicadoEm}",
  "author": { "@type": "Organization", "name": "TapePro" },
  "mainEntityOfPage": "{url canônica}"
}
```

## Metadados por página (componente `Seo.astro`)
| Tag | Regra |
|---|---|
| `<title>` | único por página; padrão `{Página} — TapePro` |
| `meta description` | do `resumo`/`descricao` (≤ 160) |
| `<link rel="canonical">` | URL absoluta autossuficiente |
| Open Graph | `og:title/description/image/type/url` |
| Twitter | `summary_large_image` |
| `<html lang="pt-BR">` | fixo |

**Regras**: exatamente um `<h1>` por página; imagem de OG absoluta e existente; JSON-LD validado no Rich Results Test antes do go-live (SC-001).
