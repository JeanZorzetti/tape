// Site público FORA DO AR a pedido (14/10/2026): toda rota pública responde 503.
// O CRM (/admin) continua de pé porque é onde a equipe trabalha os leads que já
// entraram; /_astro/ fica aberto só porque o CSS e o JS do /admin moram lá.
// O formulário (/api/lead) cai junto com o site: sem página pública, não há
// de onde chegar lead novo.
//
// Voltar ao ar = reverter o commit que trocou o CMD do Dockerfile para este arquivo.
import { createServer } from 'node:http';

// Sem isso o entry do adapter (modo standalone) sobe o próprio servidor na
// importação, e as páginas estáticas sairiam sem passar por aqui.
process.env.ASTRO_NODE_AUTOSTART = 'disabled';
const { handler } = await import('../dist/server/entry.mjs');

const PREFIXOS_ABERTOS = ['/admin/', '/_astro/'];

const PAGINA_FORA_DO_AR = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Fora do ar</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;font-family:system-ui,sans-serif;background:#f6f5f2;color:#1d1f24}p{margin:0;padding:24px}</style>
</head><body><p>Este site está fora do ar.</p></body></html>`;

function estaAberto(caminho) {
  return caminho === '/admin' || PREFIXOS_ABERTOS.some((prefixo) => caminho.startsWith(prefixo));
}

const servidor = createServer((req, res) => {
  const caminho = new URL(req.url ?? '/', 'http://localhost').pathname;
  if (estaAberto(caminho)) return handler(req, res);
  res.writeHead(503, {
    'content-type': 'text/html; charset=utf-8',
    'cache-control': 'no-store',
    'x-robots-tag': 'noindex',
  });
  res.end(req.method === 'HEAD' ? undefined : PAGINA_FORA_DO_AR);
});

servidor.listen(Number(process.env.PORT ?? 4321), process.env.HOST ?? '0.0.0.0');
process.on('SIGTERM', () => servidor.close(() => process.exit(0)));
