import { getCollection, type CollectionEntry } from "astro:content";

/** Helpers compartilhados por /blog, /blog/[slug], /segmentos/[slug] e a home. */

const FUSO = "America/Sao_Paulo";

/** Data por extenso — o formato numérico do /admin não serve para leitura de post. */
export const formatarData = (d: Date) =>
  d.toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric", timeZone: FUSO });

/** Rascunho fica fora do build indexável e do sitemap (contracts/routing-seo.md). */
export const postsPublicados = async (): Promise<CollectionEntry<"blog">[]> =>
  (await getCollection("blog", ({ data }) => !data.rascunho)).sort(
    (a, b) => b.data.publicadoEm.getTime() - a.data.publicadoEm.getTime(),
  );

/**
 * Posts irmãos de um post: mesmo produto ou mesmo segmento, mais recentes primeiro.
 * Evita página órfã sem exigir curadoria manual de "leia também" em cada arquivo.
 */
export const postsRelacionados = (
  posts: CollectionEntry<"blog">[],
  atual: CollectionEntry<"blog">,
  limite = 3,
) =>
  posts
    .filter(
      (p) =>
        p.id !== atual.id &&
        (p.data.produtosRelacionados.some((s) => atual.data.produtosRelacionados.includes(s)) ||
          p.data.segmentosRelacionados.some((s) => atual.data.segmentosRelacionados.includes(s))),
    )
    .slice(0, limite);
