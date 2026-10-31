/**
 * Ponto de entrada de produção (Dockerfile) e dos testes de integração.
 *
 * Sobe o servidor HTTP no lugar do `dist/server/entry.mjs`: importa o handler
 * do adapter com a subida automática desligada e põe `criarOuvinte` na frente.
 * HOST e PORT seguem as mesmas variáveis do adapter.
 */
import http from "node:http";
import { fileURLToPath } from "node:url";

import { carregarMarkdown, criarOuvinte } from "./ouvinte.mjs";

const RAIZ = new URL("../", import.meta.url);
const PORTA_PADRAO = 4321;

process.env.ASTRO_NODE_AUTOSTART = "disabled";
const { handler } = await import(new URL("dist/server/entry.mjs", RAIZ).href);

const paginasMarkdown = carregarMarkdown(fileURLToPath(new URL("dist/markdown/", RAIZ)));
const porta = Number(process.env.PORT ?? PORTA_PADRAO);
const host = process.env.HOST ?? "localhost";

const servidor = http.createServer(criarOuvinte({ handler, paginasMarkdown }));
servidor.listen(porta, host, () => {
  console.log(`TapePro no ar em http://${host}:${porta} (${paginasMarkdown.size} páginas em Markdown)`);
});

// PID 1 no container: sem isto o SIGTERM do orquestrador espera o prazo e vira SIGKILL.
for (const sinal of ["SIGTERM", "SIGINT"]) {
  process.on(sinal, () => {
    servidor.close(() => process.exit(0));
    servidor.closeIdleConnections();
  });
}
