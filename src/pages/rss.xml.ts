import rss from "@astrojs/rss";
import type { APIRoute } from "astro";

import { postsPublicados } from "../lib/conteudo";
import { NOME_MARCA, SITE_URL } from "../lib/constants";

/**
 * Feed do blog. `postsPublicados()` já exclui rascunho e já ordena por
 * `publicadoEm` decrescente — reusar o helper é o que garante que o feed nunca
 * divirja do que /blog mostra. Sem posts, sai um <channel> válido sem <item>.
 */
export const GET: APIRoute = async () => {
  const posts = await postsPublicados();

  return rss({
    title: `Blog ${NOME_MARCA}`,
    description: "Como escolher, especificar e personalizar fita adesiva para a sua operação.",
    site: SITE_URL,
    items: posts.map((post) => ({
      title: post.data.titulo,
      description: post.data.descricao,
      link: `${SITE_URL}/blog/${post.id}/`,
      pubDate: post.data.publicadoEm,
    })),
  });
};
