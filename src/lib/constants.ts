// Fonte única de verdade para valores de negócio (regra Clean Code do CLAUDE.md).
export const NOME_MARCA = "TapePro";
export const TAGLINE = "Fitas Adesivas Personalizadas";

export const SITE_URL = "https://tapepro.roilabs.com.br";
// ponytail: e-mail ainda é placeholder — trocar pelo final antes do deploy.
export const EMAIL_CONTATO = "contato@tapepro.com.br";

export const WHATSAPP_NUMERO = "5562983443919"; // wa.me (só dígitos, com DDI 55)
export const WHATSAPP_DISPLAY = "(62) 98344-3919";

export const PEDIDO_MINIMO_ROLOS = 20;
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
