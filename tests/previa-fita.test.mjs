/**
 * Prévia "sua logo na fita" (página de produto): quem anexou a logo avisa na mensagem do WhatsApp
 * que vai mandar o arquivo, porque o link não leva anexo. Roda no runner nativo (`node --test`).
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { comLogoNaPrevia, comFonte, whatsappLink, FRASE_LOGO_NA_PREVIA } from "../src/lib/whatsapp.ts";

const textoDe = (url) => new URL(url).searchParams.get("text");
const BASE = whatsappLink("fita transparente personalizada (48mm × 100m)", "Prévia · Fita Transparente Personalizada");

test("comLogoNaPrevia acrescenta o aviso do arquivo no fim do texto", () => {
  assert.equal(
    textoDe(comLogoNaPrevia(BASE)),
    `Olá! Vim pelo site da TapePro (Prévia · Fita Transparente Personalizada) e quero um orçamento de fita transparente personalizada (48mm × 100m). ${FRASE_LOGO_NA_PREVIA}`,
  );
});

test("comLogoNaPrevia sem texto devolve o link como estava", () => {
  assert.equal(comLogoNaPrevia("https://wa.me/5562983443919"), "https://wa.me/5562983443919");
});

test("a fonte da visita entra depois do aviso da logo", () => {
  assert.match(textoDe(comFonte(comLogoNaPrevia(BASE), "Google")), /enviar o arquivo aqui\. Achei vocês pelo Google\.$/);
});
