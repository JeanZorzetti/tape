import type { ImageMetadata } from "astro";

import fitaPersonalizada from "../assets/produtos/fita-transparente-personalizada.png";
import fitaGomada from "../assets/produtos/fita-gomada.png";
import fitaComum from "../assets/produtos/fita-transparente-comum.png";

/**
 * Catálogo fechado: a TapePro só trabalha com estas 3 fitas (+ clichê, que é
 * custo de produção e vive dentro da página da fita personalizada).
 * Preço NÃO entra no site — o nicho inteiro vende por orçamento.
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
}

export const PRODUTOS: Produto[] = [
  {
    slug: "fita-transparente-personalizada",
    nome: "Fita Transparente Personalizada",
    h1: "Fita adesiva transparente personalizada",
    seoTitle: "Fita Adesiva Transparente Personalizada com Sua Marca | TapePro",
    seoDescription:
      "Fita adesiva transparente personalizada em BOPP 48mm × 100m, impressão em até 2 cores, a partir de 20 rolos. Sua marca impressa em cada caixa.",
    eyebrow: "BOPP cristal · impressa",
    chamada: "Sua marca impressa e o lacre continua discreto.",
    resumo:
      "A fita de lacre mais usada no Brasil, com a sua marca impressa ao longo de todo o rolo. O filme BOPP transparente mantém a caixa limpa e deixa a arte aparecer: logo, aviso de segurança ou os dois.",
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
  },
  {
    slug: "fita-gomada",
    nome: "Fita Gomada Reforçada",
    h1: "Fita gomada kraft reforçada com fios de nylon",
    seoTitle: "Fita Gomada Kraft Reforçada com Fios de Nylon 70mm | TapePro",
    seoDescription:
      "Fita gomada de papel kraft reforçada com fios de nylon, 70mm × 150m, ativada com água. Lacre inviolável para caixas pesadas, com personalização.",
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
      {
        titulo: "Vira parte da caixa",
        texto:
          "A goma ativada por água penetra nas fibras do papelão. Para abrir é preciso rasgar: a violação fica evidente.",
      },
      {
        titulo: "Aguenta peso",
        texto:
          "Os fios de nylon na estrutura do papel impedem que a fita rasgue sob tensão, mesmo em caixas cheias e empilhadas.",
      },
      {
        titulo: "Papel com papel",
        texto:
          "Kraft sobre papelão dá um acabamento coerente e sem plástico aparente no pacote.",
      },
    ],
    imagem: fitaGomada,
    alt: "Rolo de fita gomada de papel kraft reforçada com fios de nylon",
    contexto: "fita gomada kraft reforçada (70mm × 150m)",
    personalizavel: true,
  },
  {
    slug: "fita-transparente-comum",
    nome: "Fita Transparente Comum",
    h1: "Fita adesiva transparente comum",
    seoTitle: "Fita Adesiva Transparente Comum 48mm × 100m por Volume | TapePro",
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
    ],
    imagem: fitaComum,
    alt: "Rolo de fita adesiva transparente comum, sem impressão",
    contexto: "fita transparente comum (48mm × 100m)",
    personalizavel: false,
  },
];

export const getProduto = (slug: string) => PRODUTOS.find((p) => p.slug === slug);
