/**
 * Funil de orçamento — o caminho que dá dinheiro. Fala com o servidor real
 * por HTTP, como o formulário faz.
 *
 * Precisa de `npm run build` e de um Postgres descartável:
 *   docker run -d --name tapepro-pg -e POSTGRES_PASSWORD=teste \
 *     -e POSTGRES_DB=tapepro -p 55432:5432 postgres:16-alpine
 *   DATABASE_URL=postgres://postgres:teste@localhost:55432/tapepro
 *
 * Sem DATABASE_URL a suíte inteira é pulada, para `npm test` seguir verde
 * em quem só quer rodar os helpers.
 */
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import postgres from "postgres";
import { subirServidor } from "./servidor.mjs";

const DATABASE_URL = process.env.DATABASE_URL;

const LIMITE_CAMPO = 200;

const leadValido = {
  nome: "Ana Souza",
  empresa: "Acme Embalagens",
  email: "ana@acme.com.br",
  telefone: "62983443919",
  tipoFita: "gomada",
  quantidadeEstimada: "100 rolos",
};

describe("POST /api/lead", { skip: DATABASE_URL ? false : "DATABASE_URL não configurada" }, () => {
  let servidor;
  let sql;

  /** O Astro recusa POST cujo Origin não bate com allowedDomains — sem isto, 403. */
  const enviar = (campos, extras = {}) =>
    fetch(`${servidor.base}/api/lead`, {
      method: "POST",
      headers: { Origin: servidor.base },
      body: new URLSearchParams({ ...campos, ...extras }),
    });

  const contarLeads = async () => Number((await sql`select count(*) as n from leads`)[0].n);

  before(async () => {
    sql = postgres(DATABASE_URL, { max: 2 });
    servidor = await subirServidor();
  });

  after(async () => {
    await sql?.end({ timeout: 5 });
    await servidor?.encerrar();
  });

  test("grava o lead válido e devolve o id", async () => {
    const resposta = await enviar(leadValido, { paginaOrigem: "Página de produto" });
    assert.equal(resposta.status, 200);

    const corpo = await resposta.json();
    assert.equal(corpo.ok, true);
    assert.equal(typeof corpo.id, "number");

    const [gravado] = await sql`select * from leads where id = ${corpo.id}`;
    assert.equal(gravado.nome, leadValido.nome);
    assert.equal(gravado.email, leadValido.email);
    assert.equal(gravado.tipo_fita, leadValido.tipoFita);
    assert.equal(gravado.quantidade, leadValido.quantidadeEstimada);
    assert.equal(gravado.origem, "Página de produto");
    assert.equal(gravado.status, "novo", "lead novo entra na primeira coluna do CRM");
    assert.equal(gravado.cnpj, null, "CNPJ em branco grava NULL, não string vazia");
  });

  test("recusa quando falta campo obrigatório e nomeia todos os que faltam", async () => {
    const { nome, empresa, ...semDois } = leadValido;
    const resposta = await enviar(semDois);
    assert.equal(resposta.status, 400);

    const { ok, erro } = await resposta.json();
    assert.equal(ok, false);
    assert.match(erro, /nome/);
    assert.match(erro, /empresa/);
  });

  test("recusa e-mail malformado", async () => {
    const resposta = await enviar({ ...leadValido, email: "ana(arroba)acme" });
    assert.equal(resposta.status, 400);
    assert.match((await resposta.json()).erro, /mail/i);
  });

  test("recusa CNPJ com 13 dígitos, aceita com 14 e aceita em branco", async () => {
    const curto = await enviar({ ...leadValido, cnpj: "1234567890123" });
    assert.equal(curto.status, 400);
    assert.match((await curto.json()).erro, /14 d/);

    const certo = await enviar({ ...leadValido, cnpj: "12.345.678/0001-95" });
    assert.equal(certo.status, 200, "a máscara não conta como dígito");

    const vazio = await enviar({ ...leadValido, cnpj: "" });
    assert.equal(vazio.status, 200, "CNPJ é opcional");
  });

  test("honeypot descarta o envio mentindo que deu certo", async () => {
    const antes = await contarLeads();
    const resposta = await enviar(leadValido, { botcheck: "sou um bot" });

    assert.equal(resposta.status, 200);
    assert.deepEqual(await resposta.json(), { ok: true }, "a resposta mente de propósito");
    assert.equal(await contarLeads(), antes, "o bot não pode chegar ao banco");
  });

  test("trunca campo longo em vez de estourar", async () => {
    const resposta = await enviar({ ...leadValido, nome: "x".repeat(LIMITE_CAMPO + 50) });
    assert.equal(resposta.status, 200);

    const [gravado] = await sql`select nome from leads where id = ${(await resposta.json()).id}`;
    assert.equal(gravado.nome.length, LIMITE_CAMPO);
  });

  test("recusa POST sem Origin compatível", async () => {
    const resposta = await fetch(`${servidor.base}/api/lead`, {
      method: "POST",
      headers: { Origin: "https://site-de-outra-pessoa.com" },
      body: new URLSearchParams(leadValido),
    });
    assert.equal(resposta.status, 403);
  });
});
