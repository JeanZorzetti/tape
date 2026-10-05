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
 * Posts irmãos de um post: mesmo produto ou mesmo segmento, a partir do post seguinte a ele na
 * ordem de `postsPublicados` (dando a volta). Evita página órfã sem curadoria manual de "leia também".
 *
 * ponytail: rodízio, não "mais recentes primeiro". Quase todo post divide produto com todos os outros,
 * então a ordem por data mandava os 3 links de cada post para os 3 mais novos (14 links cada em
 * 05/10/2026, 2 para os antigos). Com o rodízio cada post recebe ~`limite`.
 */
export const postsRelacionados = (
  posts: CollectionEntry<"blog">[],
  atual: CollectionEntry<"blog">,
  limite = 3,
) => {
  const i = posts.findIndex((p) => p.id === atual.id);
  return [...posts.slice(i + 1), ...posts.slice(0, Math.max(i, 0))]
    .filter(
      (p) =>
        p.id !== atual.id &&
        (p.data.produtosRelacionados.some((s) => atual.data.produtosRelacionados.includes(s)) ||
          p.data.segmentosRelacionados.some((s) => atual.data.segmentosRelacionados.includes(s))),
    )
    .slice(0, limite);
};
