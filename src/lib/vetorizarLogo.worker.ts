/**
 * Vetoriza a logo anexada na prévia da página de produto, fora da thread da página (o traçado
 * leva centenas de ms no celular). Só é baixado quando alguém anexa uma logo.
 */
import { vetorizarPixels, type PedidoVetorizacao } from "./vetorizarLogo.ts";

export type { PedidoVetorizacao };

export interface RespostaVetorizacao {
  svg: string | null;
}

self.onmessage = (evento: MessageEvent<PedidoVetorizacao>) => {
  self.postMessage({ svg: vetorizarPixels(evento.data) } satisfies RespostaVetorizacao);
};
