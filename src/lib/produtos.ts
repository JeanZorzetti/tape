import type { ImageMetadata } from "astro";

import fitaPersonalizada from "../assets/produtos/fita-transparente-personalizada.png";
import fitaGomada from "../assets/produtos/fita-gomada.png";
import fitaComum from "../assets/produtos/fita-transparente-comum.png";

/**
 * Catálogo fechado: a TapePro só trabalha com estas 3 fitas (+ clichê, que é
 * custo de produção e vive dentro da página da fita personalizada).
 * Preço: só o "a partir de" por rolo (decisão do dono, 28/09/2026), porque o
 * snippet de produto do Google exige `offers`. O fechado continua por orçamento.
 *
 * ponytail: dados em TS, não content collection. 3 itens estáticos não pagam
 * loader + zod; migrar para `src/content.config.ts` quando o blog (US4) chegar.
 */
export interface Spec {
  label: string;
  valor: string;
}

export interface Produto {
  slug: string;
  nome: string;
  h1: string;
  seoTitle: string;
  seoDescription: string;
  eyebrow: string;
  resumo: string;
  /** Frase curta de vitrine (índice e home). */
  chamada: string;
  specs: Spec[];
  aplicacoes: string[];
  beneficios: { titulo: string; texto: string }[];
  imagem: ImageMetadata;
  alt: string;
  /** Assunto injetado na mensagem do WhatsApp. */
  contexto: string;
  personalizavel: boolean;
  /** Menor preço por rolo da tabela oficial da TapePro (20/07/2026) com o reajuste de 20%
   *  de 17/10/2026, e quando ele vale. A tabela original está em docs/handoffs/handoff.md. */
  preco: { aPartirDe: number; condicao?: string };
  /** Preço por rolo no pedido mínimo, da mesma tabela: é o que paga quem compra pouco. */
  precoNoMinimo?: { rolos: number; porRolo: number };
  /** Todas as faixas de quantidade da mesma tabela, da menor para a maior. */
  faixas: { rolos: string; porRolo: number }[];
}

export const PRODUTOS: Produto[] = [
  {
    slug: "fita-transparente-personalizada",
    nome: "Fita Transparente Personalizada",
    h1: "Fita adesiva transparente personalizada com logomarca: impressa com a logo ou o nome da empresa",
    seoTitle: "Fita Adesiva Transparente Personalizada: Preço | TapePro",
    seoDescription:
      "Fita adesiva transparente personalizada em BOPP 48mm × 100m, impressão em até 2 cores, a partir de 20 rolos. Sua marca impressa em cada caixa.",
    eyebrow: "BOPP cristal · impressa",
    chamada: "Sua marca impressa e o lacre continua discreto.",
    resumo:
      "Fita de lacre em BOPP com a sua marca impressa ao longo de todo o rolo. O filme BOPP transparente mantém a caixa limpa e deixa a arte aparecer: logo, aviso de segurança ou os dois.",
    specs: [
      { label: "Largura", valor: "48 mm" },
      { label: "Comprimento", valor: "100 m" },
      { label: "Material", valor: "BOPP transparente" },
      { label: "Impressão", valor: "Até 2 cores" },
      { label: "Pedido mínimo", valor: "20 rolos" },
    ],
    aplicacoes: [
      "E-commerce que quer caixa branca e marca visível na fita",
      "Distribuidoras e transportadoras com aviso de volume conferido",
      "Indústria e expedição de alto volume",
      "Lojas e franquias que padronizam o pacote",
    ],
    beneficios: [
      {
        titulo: "Marca em movimento",
        texto:
          "Cada caixa lacrada circula com o seu logo pelo transportador, pelo cliente e por quem estiver por perto na hora da entrega.",
      },
      {
        titulo: "Segurança impressa",
        texto:
          "Avisos como “esta fita é sua garantia”, “cuidado, frágil” e “volume conferido” reduzem extravio e contestação de entrega.",
      },
      {
        titulo: "Entra sem mudar a operação",
        texto:
          "Mesma largura e mesma adesão da fita comum: seu pessoal e suas seladoras não precisam de nenhuma adaptação.",
      },
    ],
    imagem: fitaPersonalizada,
    alt: "Rolo de fita adesiva transparente com a marca TAPE PRO impressa em laranja e azul",
    contexto: "fita transparente personalizada (48mm × 100m)",
    personalizavel: true,
    preco: { aPartirDe: 12.12, condicao: "em pedidos de 200 rolos ou mais" },
    precoNoMinimo: { rolos: 20, porRolo: 19.44 },
    faixas: [
      { rolos: "20 a 49", porRolo: 19.44 },
      { rolos: "50 a 99", porRolo: 16.68 },
      { rolos: "100 a 199", porRolo: 12.6 },
      { rolos: "200 ou mais", porRolo: 12.12 },
    ],
  },
  {
    slug: "fita-gomada",
    nome: "Fita Gomada Reforçada",
    h1: "Fita adesiva gomada personalizada e impressa direto da fábrica, de papel kraft marrom reforçada com fios de nylon, 70mm, para caixa de papelão",
    seoTitle: "Fita gomada personalizada kraft: preço por rolo | TapePro",
    seoDescription:
      "Fita adesiva gomada personalizada, de papel kraft com reforço de nylon, 70mm × 150m, ativada com água. Lacre inviolável para caixa pesada, mín. 15 rolos.",
    eyebrow: "Kraft · fios de nylon",
    chamada: "Lacre inviolável para caixa pesada.",
    resumo:
      "Papel kraft gomado com fios de nylon na estrutura, ativado com água: a cola penetra na fibra do papelão e vira parte da caixa. É o lacre que não se descola sem deixar marca, e o mais indicado para volumes pesados.",
    specs: [
      { label: "Largura", valor: "70 mm" },
      { label: "Comprimento", valor: "150 m" },
      { label: "Material", valor: "Papel kraft gomado" },
      { label: "Reforço", valor: "Fios de nylon" },
      { label: "Ativação", valor: "Com água" },
      { label: "Pedido mínimo", valor: "15 rolos" },
    ],
    aplicacoes: [
      "Caixas pesadas e volumes que viajam longas distâncias",
      "Marcas que querem embalagem de papel, sem plástico à vista",
      "Produtos de alto valor que precisam de lacre inviolável",
      "Kits e presentes com acabamento premium",
    ],
    beneficios: [
      // Um subtema buscado por bloco (plano SEO 057): cada texto se sustenta fora da página.
      {
        titulo: "Fita gomada com reforço de fios de nylon",
        texto:
          "A fita gomada com reforço leva fios de nylon na estrutura do papel, que impedem a fita de rasgar sob tensão, mesmo em caixa cheia e empilhada. A TapePro trabalha só com a versão reforçada: é ela que segura volume pesado.",
      },
      {
        titulo: "Fita gomada de papel kraft, ativada com água",
        texto:
          "Na fita gomada de papel kraft, a goma ativada por água penetra nas fibras do papelão e vira parte da caixa. Para abrir é preciso rasgar, então a violação fica evidente. Kraft marrom sobre papelão ainda deixa o pacote sem plástico à vista.",
      },
      {
        titulo: "Fita gomada personalizada com a sua marca",
        texto:
          "A fita gomada personalizada sai com a sua arte impressa ao longo do rolo, em até 2 cores, a partir de 15 rolos. A matriz de impressão (o clichê) é paga uma vez e fica guardada para as reposições.",
      },
    ],
    imagem: fitaGomada,
    alt: "Rolo de fita gomada de papel kraft reforçada com fios de nylon",
    contexto: "fita gomada kraft reforçada (70mm × 150m)",
    personalizavel: true,
    preco: { aPartirDe: 38.64, condicao: "em pedidos acima de 100 rolos" },
    precoNoMinimo: { rolos: 15, porRolo: 44.64 },
    faixas: [
      { rolos: "15 a 100", porRolo: 44.64 },
      { rolos: "acima de 100", porRolo: 38.64 },
    ],
  },
  {
    slug: "fita-transparente-comum",
    nome: "Fita Transparente Comum",
    h1: "Fita adesiva transparente comum, larga, 48mm x 100m, para embalagem",
    seoTitle: "Fita adesiva transparente 48mm: preço por rolo | TapePro",
    seoDescription:
      "Fita adesiva transparente comum sem impressão, 48mm × 100m, em BOPP de alta adesão. Fornecimento por volume para expedição e indústria. Peça orçamento.",
    eyebrow: "BOPP cristal · sem impressão",
    chamada: "Lacre bem feito, com custo de escala.",
    resumo:
      "A mesma base BOPP e a mesma adesão da fita personalizada, sem impressão. Para quando o volume é o que manda e a caixa não precisa comunicar nada além de estar bem lacrada.",
    specs: [
      { label: "Largura", valor: "48 mm" },
      { label: "Comprimento", valor: "100 m" },
      { label: "Material", valor: "BOPP transparente" },
      { label: "Impressão", valor: "Sem impressão" },
      { label: "Fornecimento", valor: "Por volume" },
    ],
    aplicacoes: [
      "Expedição de alto giro",
      "Complemento da fita personalizada em caixas internas",
      "Reforço de fundo de caixa e montagem",
      "Uso geral em almoxarifado e estoque",
    ],
    beneficios: [
      {
        titulo: "Mesma qualidade de adesão",
        texto: "Não é fita de segunda linha: é a mesma base da personalizada, só sem a impressão.",
      },
      {
        titulo: "Custo por escala",
        texto: "Quanto maior o volume, melhor o preço por rolo. O orçamento é fechado sobre a sua quantidade.",
      },
      {
        titulo: "Compra junto",
        texto: "Muita empresa usa a personalizada no lacre externo e a comum na montagem. Dá para orçar as duas juntas.",
      },
      // Um subtema buscado por bloco (plano de SEO de 18/10/2026), como na gomada.
      {
        titulo: "Fita adesiva transparente larga, de 48mm",
        texto:
          "A largura de 48mm cobre a emenda das abas de uma caixa comum e ainda desce pelas laterais, onde a fita segura a aba quando a caixa é apertada. É a medida que aplicadores de mão e seladoras já esperam: a fita entra na operação sem ajuste de máquina.",
      },
      {
        titulo: "Quantas caixas fecha um rolo de 100m",
        texto:
          "Regra prática: uma caixa média gasta perto de 1,5m de fita, fechada em cima e embaixo. Um rolo de 100m fecha, então, perto de 66 caixas. Para a compra do mês, some de 10% a 15% de perda com pontas e erros de aplicação.",
      },
      {
        titulo: "Fita adesiva transparente: preço por rolo",
        texto:
          "O preço de tabela é R$ 9,48 o rolo de 48mm × 100m. Na comparação com outro fornecedor, compare por metro, não por rolo: um rolo mais barato com metade do comprimento sai mais caro na caixa fechada.",
      },
      {
        titulo: "Quando trocar pela fita gomada",
        texto:
          "A cola da fita transparente trabalha na superfície do papelão. Em caixa pesada, cheia ou empilhada em palete, a tensão constante faz essa junta escorregar devagar até a aba abrir. Nesses casos a indicação é a fita gomada kraft, que cola dentro da fibra da caixa.",
      },
      {
        titulo: "Como guardar os rolos",
        texto:
          "Guarde os rolos em pé, em lugar seco e fresco, longe do sol e do calor, que amolecem a cola. Use primeiro os rolos mais antigos. Rolo guardado deitado e empilhado pode deformar nas bordas e enroscar no aplicador. Na dúvida sobre quanto estocar, faça a conta pelo consumo do mês.",
      },
    ],
    imagem: fitaComum,
    alt: "Rolo de fita adesiva transparente comum, sem impressão",
    contexto: "fita transparente comum (48mm × 100m)",
    personalizavel: false,
    preco: { aPartirDe: 9.48 },
    faixas: [{ rolos: "preço único da tabela", porRolo: 9.48 }],
  },
];

export const getProduto = (slug: string) => PRODUTOS.find((p) => p.slug === slug);
