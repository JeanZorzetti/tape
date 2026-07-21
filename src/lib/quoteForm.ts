import { WHATSAPP_NUMERO } from "./constants.ts";

// Opções de tipo de fita — fonte única (select do form + rótulos das mensagens).
export const TIPOS_FITA = [
  { value: "personalizada", label: "Fita transparente personalizada" },
  { value: "gomada", label: "Fita gomada (kraft)" },
  { value: "comum", label: "Fita transparente comum" },
  { value: "nao_sei", label: "Não sei ainda, preciso de orientação" },
] as const;

export type TipoFita = (typeof TIPOS_FITA)[number]["value"];

export function tipoFitaLabel(value: string): string {
  return TIPOS_FITA.find((t) => t.value === value)?.label ?? "fitas personalizadas";
}

export interface LeadResumo {
  nome: string;
  empresa: string;
  tipoFita: string;
  quantidadeEstimada: string;
  mensagem?: string;
}

/** Link do WhatsApp com os dados do lead — usado quando o e-mail não está configurado ou o envio falha. */
export function whatsappFromLead(lead: LeadResumo): string {
  const linhas = [
    `Olá! Sou ${lead.nome || "(sem nome)"} da ${lead.empresa || "(sem empresa)"}.`,
    `Quero um orçamento de ${tipoFitaLabel(lead.tipoFita)}.`,
    `Quantidade estimada: ${lead.quantidadeEstimada || "a definir"}.`,
  ];
  if (lead.mensagem) linhas.push(lead.mensagem);
  return `https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent(linhas.join(" "))}`;
}
