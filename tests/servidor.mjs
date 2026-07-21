/**
 * Sobe o servidor real (`dist/server/entry.mjs`) para os testes de integração.
 * Contra o build, não contra `astro dev`: só o servidor Node devolve os status
 * de verdade (o /404, por exemplo).
 *
 * Precisa de `npm run build` antes.
 */
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";

const PRAZO_BOOT_MS = 30_000;
const INTERVALO_SONDA_MS = 250;

/**
 * Porta efêmera em vez de uma fixa. Já custou uma hora: um servidor esquecido
 * de outra sessão ocupava a porta fixa, o nosso morria com EADDRINUSE e a suíte
 * testava o processo do estranho — a validação passava (é o mesmo código) e todo
 * INSERT dava 500 (o zombie não tinha DATABASE_URL). Não fixe a porta.
 */
function portaLivre() {
  return new Promise((resolve, reject) => {
    const sonda = createServer();
    sonda.on("error", reject);
    sonda.listen(0, "127.0.0.1", () => {
      const { port } = sonda.address();
      sonda.close(() => resolve(port));
    });
  });
}

async function esperarNoAr(processo, base, limite) {
  while (Date.now() < limite) {
    // Se o processo morreu, não adianta insistir — e pior, quem responder
    // na porta pode não ser ele.
    if (processo.exitCode !== null) throw new Error(`servidor saiu com código ${processo.exitCode}`);
    try {
      if ((await fetch(base, { signal: AbortSignal.timeout(1000) })).ok) return;
    } catch {
      // ainda subindo
    }
    await new Promise((r) => setTimeout(r, INTERVALO_SONDA_MS));
  }
  throw new Error(`servidor não respondeu em ${base} dentro do prazo`);
}

/** Retorna `{ base, encerrar }`. `base` é a URL raiz, já no ar. */
export async function subirServidor(env = {}) {
  const porta = await portaLivre();
  const base = `http://127.0.0.1:${porta}`;

  const processo = spawn(process.execPath, ["dist/server/entry.mjs"], {
    env: { ...process.env, ...env, HOST: "127.0.0.1", PORT: String(porta) },
    stdio: ["ignore", "ignore", "pipe"],
  });
  // Sem repassar o stderr, um 500 do servidor vira só "500 !== 200".
  processo.stderr.on("data", (b) => console.error("[servidor]", String(b).trim()));

  await esperarNoAr(processo, base, Date.now() + PRAZO_BOOT_MS);

  return {
    base,
    async encerrar() {
      if (processo.exitCode !== null) return;
      processo.kill();
      await once(processo, "exit");
    },
  };
}
