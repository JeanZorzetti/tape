/**
 * Avisa os buscadores compatíveis com IndexNow quais URLs existem, a cada
 * subida de container. Roda desanexado do servidor (ver Dockerfile) e
 * **nunca** encerra com código diferente de 0: uma falha de rede aqui não pode
 * derrubar o site (FR-004).
 *
 * Lê tudo do `dist` — URLs, host e chave — porque a imagem de runtime copia
 * apenas `dist`, `node_modules` e `package.json`. Não há `src/` para importar
 * nem transpilação de TypeScript aqui: qualquer import de `src/lib` quebraria
 * em produção, onde ninguém está olhando. Ver research.md D4.
 */
import { existsSync, readdirSync, readFileSync, writeFileSync, realpathSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const HOST_PRODUCAO = "tapepro.roilabs.com.br";
const ENDPOINT = "https://api.indexnow.org/indexnow";
const DIR_CLIENTE = "dist/client";
const MARCADOR = "dist/.indexnow-enviado";

/** Rotas que não podem sair do site nem por engano (FR-003). */
const PRIVADAS = /^\/(admin|api)(\/|$)/;

const DIAGNOSTICO = {
  400: "corpo inválido",
  403: "chave do arquivo não confere",
  422: "URL fora do host declarado",
  429: "excesso de submissões",
};

/** Todas as `<loc>` de um sitemap. Regex basta: o XML é gerado por nós. */
export const urlsDoSitemap = (xml) => [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());

/**
 * URLs submissíveis: mesmo host, fora de /admin e /api, sem duplicata e sem
 * arquivo `.xml` — o `<loc>` do sitemap-index aponta para o sitemap-0, que
 * entraria na lista como se fosse página.
 */
export const filtrarPublicas = (urls, host) => [
  ...new Set(
    urls.filter((bruta) => {
      if (bruta.endsWith(".xml")) return false;
      let url;
      try {
        url = new URL(bruta);
      } catch {
        return false;
      }
      return url.host === host && !PRIVADAS.test(url.pathname);
    }),
  ),
];

/**
 * Pré-condições do contrato §5. Pular nunca é erro.
 *
 * O host **não** basta como guarda de ambiente: ele sai do sitemap, que carrega
 * o domínio de produção mesmo num `npm run build` local. Quem separa os dois é
 * o `NODE_ENV=production` que só o estágio de runtime do Dockerfile define —
 * sem ele, um build na máquina de alguém submeteria de verdade (FR-005).
 */
export const deveSubmeter = ({ host, ambiente, marcadorExiste, urls }) => {
  if (ambiente !== "production") return { ok: false, motivo: `ambiente ${ambiente || "local"} não é produção` };
  if (host !== HOST_PRODUCAO) return { ok: false, motivo: `host ${host} não é produção` };
  if (marcadorExiste) return { ok: false, motivo: "já submetido neste container" };
  if (!urls.length) return { ok: false, motivo: "nada a submeter" };
  return { ok: true };
};

/**
 * A chave é o `*.txt` da raiz do site cujo conteúdo é igual ao próprio nome —
 * a mesma invariante que o buscador confere para responder 200 em vez de 403.
 * Descobrir e validar são a mesma operação, então `robots.txt` e `llms.txt`
 * ficam de fora sem precisar de lista de exceções.
 */
export const lerChave = (dirCliente, host) => {
  if (!existsSync(dirCliente)) return null;
  const arquivos = readdirSync(dirCliente)
    .filter((nome) => nome.endsWith(".txt"))
    .filter((nome) => readFileSync(join(dirCliente, nome), "utf8").trim() === nome.slice(0, -".txt".length));
  if (arquivos.length !== 1) return null;
  return { chave: arquivos[0].slice(0, -".txt".length), keyLocation: `https://${host}/${arquivos[0]}` };
};

/** Submete e traduz a resposta em uma linha de log. Não lança em nenhum caminho. */
export const submeter = async (corpo, fetchImpl = fetch) => {
  try {
    const resposta = await fetchImpl(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify(corpo),
    });
    if (resposta.ok) return { aceito: true, linha: `${corpo.urlList.length} URLs -> ${resposta.status} OK` };
    return {
      aceito: false,
      linha: `falha: ${resposta.status} (${DIAGNOSTICO[resposta.status] ?? "resposta inesperada"})`,
    };
  } catch (e) {
    return { aceito: false, linha: `aviso: serviço inacessível (${e.message})` };
  }
};

const main = async () => {
  const sitemaps = existsSync(DIR_CLIENTE) ? readdirSync(DIR_CLIENTE).filter((n) => n.endsWith(".xml")) : [];
  const brutas = sitemaps.flatMap((nome) => urlsDoSitemap(readFileSync(join(DIR_CLIENTE, nome), "utf8")));

  // O host sai das próprias URLs do sitemap: é o que o serviço vai comparar
  // com o `host` declarado no corpo da submissão.
  const host = brutas.length ? new URL(brutas[0]).host : "(sem sitemap)";
  const urls = filtrarPublicas(brutas, host);

  const permissao = deveSubmeter({
    host,
    ambiente: process.env.NODE_ENV,
    marcadorExiste: existsSync(MARCADOR),
    urls,
  });
  if (!permissao.ok) return `pulado: ${permissao.motivo}`;

  const chave = lerChave(DIR_CLIENTE, host);
  if (!chave) return "pulado: arquivo de chave ausente ou com conteúdo divergente do nome";

  const { aceito, linha } = await submeter({ host, key: chave.chave, keyLocation: chave.keyLocation, urlList: urls });
  if (aceito) {
    try {
      writeFileSync(MARCADOR, "");
    } catch {
      // Marcador é otimização, não correção: no pior caso sai uma submissão
      // extra no próximo restart deste container.
    }
  }
  return linha;
};

const executadoDireto =
  process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));

if (executadoDireto) {
  // Sem `process.exit(1)` em nenhum caminho, inclusive no erro inesperado.
  main()
    .catch((e) => `aviso: erro inesperado (${e.message})`)
    .then((linha) => console.log(`[indexnow] ${linha}`));
}
