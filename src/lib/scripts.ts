/**
 * Scripts de abordagem da pipeline de recuperação — conteúdo estruturado que a ficha do lead lê
 * e o WhatsApp/DM usa. Fonte de verdade no app; a origem editorial é docs/estrategia-prospeccao.md
 * §4 (documento narrativo paralelo, não lido em runtime).
 *
 * ponytail: uma fonte no app; conferência automática contra o doc só se a divergência virar dor real.
 *
 * Chaveado por nicho × passo da cadência (6 passos, alinhados a CADENCIA_DIAS = [0,1,3,7,14,21]).
 * Só o 1º toque (passo 0) muda por nicho; os 5 follow-ups são compartilhados — cada um muda o ângulo.
 * Templates usam `[empresa]` (sempre presente) e `[nome]` (quase nunca presente na recuperação);
 * `montarScript` resolve os dois e garante que nenhum `[placeholder]` cru sobra (SC-004).
 */

/** Rótulo humano de cada passo, para a ficha ("toque N de 6"). Índice = passoDoLead(). */
export const LABEL_PASSO: readonly string[] = [
  "1º toque",
  "Follow-up (D+1)",
  "Prova social (D+3)",
  "Novo ângulo (D+7)",
  "Condição (D+14)",
  "Despedida (D+21)",
];

// 1º toque por nicho (Fila A: industria/distribuidor · Fila B: ecommerce/lojas). Ver §2–§4.
const ABERTURAS: Record<string, string> = {
  industria:
    "Oi, [nome]! Trabalho com fita de lacre pra quem envia volume e vi a [empresa] aqui. A pergunta que " +
    "sempre faço: a fita de vocês aguenta a caixa empilhada até o cliente, ou levanta a aba no meio do " +
    "caminho? A gente tem a gomada reforçada com fios de nylon (vira parte da caixa) e a personalizada com " +
    "o nome de vocês no lacre pra identificar o volume. Quer que eu monte um orçamento rápido pro volume " +
    "que vocês fecham por mês?",
  distribuidor:
    "Oi, [nome]! Trabalho com fita de lacre pra quem movimenta muita carga e vi a [empresa]. Avaria sem " +
    "responsável definido e volume trocado entre cargas é dor comum aí? A gomada reforçada com fios de " +
    "nylon (pra abrir, tem que rasgar) e a personalizada com o nome de vocês no lacre resolvem os dois. " +
    "Quer um orçamento rápido pro volume que vocês giram por mês?",
  ecommerce:
    "Oi, [nome]! Vi a [empresa] aqui e queria te mostrar uma coisa rápida. Vocês despacham em caixa pardo " +
    "comum? A gente faz fita personalizada com a marca de vocês impressa. A caixa vira embalagem de marca " +
    "sem trocar de caixa, e o lacre ainda protege contra extravio na entrega. Posso te mandar uma prévia " +
    "da logo de vocês na fita, sem compromisso?",
  lojas:
    "Oi, [nome]! A [empresa] tem mais de uma unidade ou entrega em casa? A fita personalizada é o jeito " +
    "mais barato de padronizar o pacote em todas as unidades: a matriz compra em lote e distribui, o " +
    "gerente não escolhe nada. E na entrega local, identifica de qual loja veio. Posso te mostrar uma " +
    "prévia com a marca de vocês?",
};

// Fallback (Fila C — descobrir): lead sem nicho / nicho "outro". Abre descobrindo o perfil.
const ABERTURA_GENERICA =
  "Oi, [nome]! Trabalho com fita personalizada e de lacre e vi a [empresa]. Como vocês despacham hoje, em " +
  "caixa pardo comum? E a fita aguenta o transporte? Dependendo do que vocês enviam, dá pra puxar a marca " +
  "de vocês impressa na fita ou uma gomada reforçada pro volume. Posso te mandar uma prévia da sua marca " +
  "na fita pra ver como fica?";

// Follow-ups D+1..D+21 (passos 1..5), compartilhados entre nichos — cada toque muda o ângulo (§4.5).
const FOLLOWUPS: readonly string[] = [
  "Passando aqui de novo, [nome] 🙂 consigo te mandar hoje ainda uma prévia da marca de [empresa] " +
    "impressa na fita, se quiser dar uma olhada.",
  "Olha como ficou pra um cliente parecido com a [empresa]: a marca impressa no lacre, a caixa vira " +
    "embalagem sem trocar de caixa. Quer que eu faça uma prévia da sua pra comparar?",
  "Fechando o gancho, [nome]: além da marca na entrega, a fita certa segura o volume e evita extravio no " +
    "caminho. Faz sentido pro que a [empresa] despacha?",
  "Tô fechando o mês com uma condição boa pro primeiro pedido da [empresa]. Quer que eu reserve pra você?",
  "Vou parar de te incomodar por aqui 🙂 se um dia a [empresa] precisar de fita com a marca impressa, é " +
    "só me chamar. Sucesso!",
];

/** Passo da cadência (0..5) a partir do nº de toques já registrados. Satura no último (despedida). */
export function passoDoLead(nToques: number): number {
  return Math.min(Math.max(nToques, 0), 5);
}

/** Template do script para (nicho, passo). Fallback genérico se nicho ausente/não mapeado. */
export function scriptDoLead(nicho: string | null, nToques: number): string {
  const passo = passoDoLead(nToques);
  if (passo === 0) return ABERTURAS[nicho ?? ""] ?? ABERTURA_GENERICA;
  return FOLLOWUPS[passo - 1];
}

/**
 * Substitui `[empresa]`/`[nome]` e garante que nenhum `[placeholder]` cru sobra (SC-004).
 * Sem `nome` (o caso comum na recuperação), remove o vocativo sem deixar vírgula/espaço órfão.
 */
export function montarScript(template: string, ctx: { empresa: string; nome?: string }): string {
  let s = template.replaceAll("[empresa]", ctx.empresa.trim() || "a empresa");
  const nome = ctx.nome?.trim();
  if (nome) {
    s = s.replaceAll("[nome]", nome);
  } else {
    s = s.replace(/,?\s*\[nome\]/g, "");
  }
  return s
    .replace(/\[[^\]]*\]/g, "") // varredura de segurança: nenhum placeholder cru
    .replace(/\s+([!?.,;:])/g, "$1") // sem espaço órfão antes de pontuação
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** Respostas a objeções (referência exibida na ficha). Textos de §4.6. */
export const OBJECOES: readonly { pergunta: string; resposta: string }[] = [
  {
    pergunta: "Quanto custa?",
    resposta:
      "Puxa a spec antes do preço: “Depende do volume e se é 1 ou 2 cores. Fecha quantos rolos/mês, mais " +
      "ou menos? Aí te passo certinho.”",
  },
  {
    pergunta: "Já tenho fornecedor",
    resposta:
      "“Show. Só pra referência: quanto vocês pagam por rolo hoje? Muita gente troca quando vê a arte + o " +
      "preço no volume.”",
  },
  {
    pergunta: "É caro personalizar",
    resposta:
      "“A arte tem um custo único (o clichê, a partir de R$80) que fica guardado. Do 2º pedido em diante " +
      "você paga só a fita. Some rápido no volume.”",
  },
  {
    pergunta: "Me manda por e-mail",
    resposta: "Manda, mas mantém o WhatsApp: “Mandei! Qualquer dúvida respondo aqui mesmo, é mais rápido.”",
  },
] as const;
