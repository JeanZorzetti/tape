import type { APIRoute } from "astro";
import { inserirLead } from "../../lib/crm";

export const prerender = false;

const LIMITE_TEXTO = 2000;
const LIMITE_CAMPO = 200;

const limpar = (v: FormDataEntryValue | null, max = LIMITE_CAMPO) =>
  typeof v === "string" ? v.trim().slice(0, max) : "";

const json = (dados: unknown, status = 200) =>
  new Response(JSON.stringify(dados), { status, headers: { "content-type": "application/json" } });

export const POST: APIRoute = async ({ request }) => {
  const form = await request.formData();

  // Honeypot: bot preencheu campo invisível — responde ok e descarta.
  if (limpar(form.get("botcheck"))) return json({ ok: true });

  const lead = {
    nome: limpar(form.get("nome")),
    empresa: limpar(form.get("empresa")),
    email: limpar(form.get("email")),
    telefone: limpar(form.get("telefone")),
    cnpj: limpar(form.get("cnpj")) || null,
    tipo_fita: limpar(form.get("tipoFita")),
    quantidade: limpar(form.get("quantidadeEstimada")),
    mensagem: limpar(form.get("mensagem"), LIMITE_TEXTO) || null,
    origem: limpar(form.get("paginaOrigem"), 500) || null,
  };

  const faltando = ["nome", "empresa", "email", "telefone", "tipo_fita", "quantidade"].filter(
    (campo) => !lead[campo as keyof typeof lead],
  );
  if (faltando.length) return json({ ok: false, erro: `Campos obrigatórios: ${faltando.join(", ")}` }, 400);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(lead.email)) return json({ ok: false, erro: "E-mail inválido" }, 400);
  if (lead.cnpj && lead.cnpj.replace(/\D/g, "").length !== 14) {
    return json({ ok: false, erro: "CNPJ deve ter 14 dígitos" }, 400);
  }

  try {
    const id = await inserirLead(lead);
    return json({ ok: true, id });
  } catch (erro) {
    console.error("[lead] falha ao gravar", erro);
    return json({ ok: false, erro: "Não foi possível registrar agora" }, 500);
  }
};
