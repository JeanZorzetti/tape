/**
 * Guarda do /admin. A propriedade que importa: o cookie de sessão é assinado
 * com HMAC e ninguém entra forjando um.
 *
 * Testado por HTTP contra o servidor real — é assim que um invasor chega.
 * Mesmas dependências do funil (build + Postgres); ver tests/api-lead.test.mjs.
 */
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { subirServidor } from "./servidor.mjs";

const DATABASE_URL = process.env.DATABASE_URL;

const COOKIE = "tp_sessao";
const SEGREDO = "segredo-de-teste-com-mais-de-32-caracteres";
const UM_DIA_MS = 24 * 60 * 60 * 1000;

/** Mesmo formato de src/lib/auth.ts: `id.expira.hmac(id.expira)`. */
const assinar = (corpo) => createHmac("sha256", SEGREDO).update(corpo).digest("hex");
const cookieValido = (id = 1, expiraEm = Date.now() + UM_DIA_MS) => {
  const corpo = `${id}.${expiraEm}`;
  return `${corpo}.${assinar(corpo)}`;
};

describe("guarda do /admin", { skip: DATABASE_URL ? false : "DATABASE_URL não configurada" }, () => {
  let servidor;

  /** `redirect: manual` para enxergar o 302 em vez de segui-lo até o login. */
  const abrirAdmin = (cookie) =>
    fetch(`${servidor.base}/admin`, {
      redirect: "manual",
      headers: cookie ? { Cookie: `${COOKIE}=${cookie}` } : {},
    });

  const mandaProLogin = async (cookie, motivo) => {
    const r = await abrirAdmin(cookie);
    assert.equal(r.status, 302, motivo);
    assert.equal(new URL(r.headers.get("location"), servidor.base).pathname, "/admin/login", motivo);
  };

  before(async () => {
    servidor = await subirServidor({ SESSION_SECRET: SEGREDO });
  });

  after(async () => {
    await servidor?.encerrar();
  });

  // Controle positivo: sem ele, os testes abaixo passariam mesmo com o /admin
  // quebrado por outro motivo qualquer.
  test("cookie assinado corretamente entra", async () => {
    const r = await abrirAdmin(cookieValido());
    assert.equal(r.status, 200);
  });

  test("sem cookie vai para o login", async () => {
    await mandaProLogin(undefined, "visitante anônimo não pode ver leads");
  });

  test("assinatura forjada não entra", async () => {
    const expira = Date.now() + UM_DIA_MS;
    await mandaProLogin(`1.${expira}.${"a".repeat(64)}`, "hex do tamanho certo, mas não é a assinatura");
  });

  test("trocar o id do usuário invalida a assinatura", async () => {
    const [, expira, assinatura] = cookieValido(1).split(".");
    await mandaProLogin(`99.${expira}.${assinatura}`, "assinatura é do id 1, não do 99");
  });

  test("esticar a validade invalida a assinatura", async () => {
    const [id, expira, assinatura] = cookieValido().split(".");
    await mandaProLogin(`${id}.${Number(expira) + UM_DIA_MS}.${assinatura}`, "expiração é assinada junto");
  });

  test("cookie vencido não entra, mesmo bem assinado", async () => {
    await mandaProLogin(cookieValido(1, Date.now() - 1000), "sessão expirada é sessão encerrada");
  });

  test("cookie malformado não derruba o servidor", async () => {
    for (const lixo of ["", "sem-pontos", "1.2", "....", "a.b.c"]) {
      const r = await abrirAdmin(lixo);
      assert.equal(r.status, 302, `cookie ${JSON.stringify(lixo)} deveria só mandar pro login`);
    }
  });
});
