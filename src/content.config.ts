import { defineCollection, z } from "astro:content";
import { glob, file } from "astro/loaders";

import { PRODUTOS } from "./lib/produtos";

/**
 * API nova do Astro 5 (`loader`), não a antiga `type: 'content'` do contrato
 * em specs/.../contracts/content-collections.md.
 *
 * `produtos` NÃO é coleção: o catálogo fechado de 3 fitas vive em
 * `src/lib/produtos.ts`. Para manter a integridade que o `reference()` daria,
 * os links internos são validados contra os slugs reais no build.
 */
const slugsDeProduto = PRODUTOS.map((p) => p.slug) as [string, ...string[]];
const produtoRelacionado = z.enum(slugsDeProduto);

const seo = z.object({ title: z.string().optional(), description: z.string().max(160).optional() });

const segmentos = defineCollection({
  loader: glob({ pattern: "**/*.mdx", base: "./src/content/segmentos" }),
  schema: ({ image }) =>
    z.object({
      titulo: z.string(),
      h1: z.string(),
      eyebrow: z.string(),
      resumo: z.string().max(160),
      /** Frase de vitrine no índice. */
      chamada: z.string(),
      dores: z.array(z.object({ titulo: z.string(), texto: z.string() })).min(1),
      produtosRelacionados: z.array(produtoRelacionado).min(1),
      /** Assunto injetado na mensagem do WhatsApp. */
      contexto: z.string(),
      imagem: image(),
      imagemAlt: z.string(),
      ordem: z.number().default(0),
      seo: seo.optional(),
    }),
});

const blog = defineCollection({
  loader: glob({ pattern: "**/*.mdx", base: "./src/content/blog" }),
  schema: ({ image }) =>
    z.object({
      titulo: z.string(),
      h1: z.string(),
      descricao: z.string().max(160),
      /** Long-tail que o post mira — uma por post, sem canibalizar. */
      intencao: z.string(),
      /** Abre o post: a resposta curta antes do desenvolvimento. */
      resumo: z.string(),
      publicadoEm: z.coerce.date(),
      atualizadoEm: z.coerce.date().optional(),
      tempoLeituraMin: z.number().int().positive(),
      imagem: image(),
      imagemAlt: z.string(),
      /** Uma linha em inglês descrevendo a cena — entra no prompt do Gemini.
       *  Ver scripts/prompt-imagem-post.mjs e handoff-imagens-blog.md. */
      cenaImagem: z.string().optional(),
      produtosRelacionados: z.array(produtoRelacionado).default([]),
      segmentosRelacionados: z.array(z.string()).default([]),
      rascunho: z.boolean().default(false),
    }),
});

const faq = defineCollection({
  loader: file("./src/content/faq/perguntas.json"),
  schema: z.object({
    pergunta: z.string(),
    resposta: z.string(),
    grupo: z.enum(["pedido", "produto", "entrega", "personalizacao"]),
    ordem: z.number().default(0),
  }),
});

export const collections = { segmentos, blog, faq };
