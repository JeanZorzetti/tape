// Fonte única de verdade para valores de negócio (regra Clean Code do CLAUDE.md).
export const NOME_MARCA = "TapePro";
export const TAGLINE = "Fitas Adesivas Personalizadas";

export const SITE_URL = "https://tapeprofitas.com.br";
export const FEED_URL = SITE_URL + "/rss.xml";
export const EMAIL_CONTATO = "tapeprofitas@gmail.com";
export const RAZAO_SOCIAL = "Tape Pro LTDA";
// Conferido na Receita (BrasilAPI) em 27/10/2026: TAPE PRO LTDA, ativa desde 27/07/2026. O 44.724.076/0001-35 de antes era de outra empresa.
export const CNPJ = "68.236.740/0001-65";

export const WHATSAPP_NUMERO = "5562983443919"; // wa.me (só dígitos, com DDI 55)
export const WHATSAPP_DISPLAY = "(62) 98344-3919";

export const PEDIDO_MINIMO_ROLOS = 20;
// Fonte: registro de vendas interno da TapePro (confirmado pelo Jean em 17/10/2026).
export const EMPRESAS_ATENDIDAS = 1000;

// Clientes reais (prova social autorizada). Ver specs/.../assets.md
export const CLIENTES = [
  "Nature's Prime",
  "Halyee",
  "Yanmei",
  "Lyon Peças Automotivas",
  "Finaart Jeans Wear",
  "Comando Auto Peças",
  "Quemed",
] as const;
