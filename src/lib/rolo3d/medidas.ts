// Comprimentos de fita desenrolada que a página e o vídeo usam. Ficam fora de cena.ts
// para quem só precisa dos números não arrastar o three.js para o bundle principal.

/** Ponta logo abaixo da borda do quadro: é o quadro do pôster. */
export const COMPRIMENTO_REPOUSO = 4.6;
/** O puxão de entrada, depois que a cena assume o lugar do pôster. */
export const PUXAO_DE_ENTRADA = 1.6;
/** Quanto a fita sai enquanto o hero rola para fora da tela. */
export const CURSO_DA_ROLAGEM = 4.2;

/** Largura da tela a partir da qual a margem direita da página comporta a fita inteira. */
export const LARGURA_COM_MARGEM_PARA_A_FITA = 1340;
/** Largura de fita na viagem (px) = altura da etiqueta do CTA, para as duas se emendarem. */
export const LARGURA_DA_FITA_NA_VIAGEM = { larga: 56, estreita: 52 };
/** Raio da curva em que a fita vira para entrar na etiqueta (px). */
export const RAIO_DA_DOBRA = { larga: 90, estreita: 44 };
/** Quanto a fita entra por baixo da etiqueta: esconde a ponta e a emenda (px). */
export const ENCAIXE_NA_ETIQUETA = 44;
/** Onde a ponta fica enquanto a pessoa lê, como fração da altura da tela. */
export const LINHA_DE_LEITURA = 0.78;
/** Rolagem (frações da altura da tela) em que o rolo vira faixa: começa e termina. */
export const VIAGEM_COMECA_EM = 0.05;
export const VIAGEM_TERMINA_EM = 0.95;
