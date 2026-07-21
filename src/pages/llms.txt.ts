import type { APIRoute } from "astro";
import { getCollection } from "astro:content";

import { PRODUTOS } from "../lib/produtos";
import { postsPublicados } from "../lib/conteudo";
import { NOME_MARCA, SITE_URL, PEDIDO_MINIMO_ROLOS } from "../lib/constants";

/**
 * Índice do site no formato llmstxt.org, para motores de busca generativa.
 *
 * É endpoint e não arquivo em `public/` de propósito: assim uma página nova
 * entra na listagem sozinha, sem ninguém lembrar de editar (FR-010). Tudo aqui
 * deriva das mesmas fontes que as páginas usam — nenhuma rota escrita à mão,
 * exceto as institucionais, que são fixas e não têm coleção por trás.
 */

const RESUMO =
  "Fabricação de fitas adesivas personalizadas com a marca do cliente impressa no rolo: " +
  `fita BOPP transparente, fita gomada kraft reforçada e fita comum. Venda B2B sob orçamento, ` +
  `por volume, a partir de ${PEDIDO_MINIMO_ROLOS} rolos.`;

/** Rotas sem coleção por trás — as únicas listadas explicitamente. */
const INSTITUCIONAL = [
  { titulo: "Sobre", caminho: "/sobre/", resumo: "Quem é a TapePro e como funciona o atendimento por representante." },
  { titulo: "Orçamento", caminho: "/orcamento/", resumo: "Formulário de pedido de orçamento por volume e tipo de fita." },
  {
    titulo: "Perguntas frequentes",
    caminho: "/perguntas-frequentes/",
    resumo: "Pedido mínimo, prazo, clichê, personalização e entrega.",
  },
];

const item = (titulo: string, caminho: string, resumo: string) => `- [${titulo}](${SITE_URL}${caminho}): ${resumo}`;

const secao = (titulo: string, itens: string[]) => `## ${titulo}\n\n${itens.join("\n")}`;

export const GET: APIRoute = async () => {
  const segmentos = (await getCollection("segmentos")).sort((a, b) => a.data.ordem - b.data.ordem);
  const posts = await postsPublicados();

  const corpo = [
    `# ${NOME_MARCA} — Fitas adesivas personalizadas`,
    `> ${RESUMO}`,
    secao(
      "Produtos",
      PRODUTOS.map((p) => item(p.nome, `/produtos/${p.slug}/`, p.chamada)),
    ),
    secao(
      "Segmentos",
      segmentos.map((s) => item(s.data.titulo, `/segmentos/${s.id}/`, s.data.resumo)),
    ),
    secao(
      "Blog",
      posts.map((p) => item(p.data.titulo, `/blog/${p.id}/`, p.data.descricao)),
    ),
    secao(
      "Institucional",
      INSTITUCIONAL.map((i) => item(i.titulo, i.caminho, i.resumo)),
    ),
  ].join("\n\n");

  return new Response(corpo + "\n", { headers: { "Content-Type": "text/plain; charset=utf-8" } });
};
