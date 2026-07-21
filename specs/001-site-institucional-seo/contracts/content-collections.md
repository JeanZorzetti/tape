# Contract — Content Collections (Zod)

Forma esperada de `src/content/config.ts`. Contrato de dados; a implementação segue esta forma.

```ts
import { defineCollection, reference, z } from 'astro:content';

const seo = z.object({ title: z.string().optional(), description: z.string().max(160).optional() });

const produtos = defineCollection({
  type: 'content',
  schema: ({ image }) => z.object({
    titulo: z.string(),
    categoria: z.enum(['personalizada', 'gomada', 'comum']),
    resumo: z.string().max(160),
    specs: z.array(z.object({ rotulo: z.string(), valor: z.string() })).min(1),
    aplicacoes: z.array(z.string()).min(1),
    diferenciais: z.array(z.string()).default([]),
    imagem: image(),
    imagemAlt: z.string(),
    ordem: z.number().default(0),
    seo: seo.optional(),
  }),
});

const segmentos = defineCollection({
  type: 'content',
  schema: ({ image }) => z.object({
    titulo: z.string(),
    resumo: z.string().max(160),
    dores: z.array(z.string()).min(1),
    produtosRelacionados: z.array(reference('produtos')).min(1),
    imagem: image(),
    imagemAlt: z.string(),
    seo: seo.optional(),
  }),
});

const blog = defineCollection({
  type: 'content',
  schema: ({ image }) => z.object({
    titulo: z.string(),
    descricao: z.string().max(160),
    intencao: z.string(),                       // keyword/intenção-alvo
    publicadoEm: z.coerce.date(),
    atualizadoEm: z.coerce.date().optional(),
    imagem: image(),
    imagemAlt: z.string(),
    produtosRelacionados: z.array(reference('produtos')).default([]),
    rascunho: z.boolean().default(false),
  }),
});

const faq = defineCollection({
  type: 'data',
  schema: z.object({
    pergunta: z.string(),
    resposta: z.string(),
    grupo: z.enum(['pedido', 'produto', 'entrega', 'personalizacao']),
    ordem: z.number().default(0),
  }),
});

export const collections = { produtos, segmentos, blog, faq };
```

**Regras de contrato**
- `resumo`/`descricao` ≤ 160 chars → servem de meta description sem truncar.
- `imagem`+`imagemAlt` obrigatórios em produto/segmento/blog → nenhuma página publica sem foto real e alt (FR-011).
- `rascunho: true` → excluída de build indexável e do sitemap.
- `produtosRelacionados` usa `reference()` → integridade validada no build (link interno nunca aponta pra produto inexistente).
