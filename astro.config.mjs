import { readFileSync, readdirSync } from 'node:fs';

import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import node from '@astrojs/node';
import tailwindcss from '@tailwindcss/vite';

// `lastmod` é o único sinal de atualização que o Google aceita para página
// comum (o IndexNow ele não usa). Só as rotas de blog levam: institucionais e
// de produto mudam junto com o deploy inteiro, e carimbar todas com a data do
// build seria ruído, não sinal.
//
// Este arquivo não acessa `astro:content`, então as datas saem do frontmatter.
// ponytail: regex em vez de parser de YAML — o formato dessas datas é gerado
// pelo nosso próprio schema. Migrar para leitura da coleção se ficar irregular.
const DIR_BLOG = './src/content/blog';
const LASTMOD_POR_SLUG = new Map(
  readdirSync(DIR_BLOG)
    .filter((nome) => nome.endsWith('.mdx'))
    .map((nome) => {
      const frontmatter = readFileSync(`${DIR_BLOG}/${nome}`, 'utf8').split(/^---$/m)[1] ?? '';
      const campo = (chave) => frontmatter.match(new RegExp(`^${chave}:\\s*["']?(\\d{4}-\\d{2}-\\d{2})`, 'm'))?.[1];
      return [nome.replace(/\.mdx$/, ''), campo('atualizadoEm') ?? campo('publicadoEm')];
    })
    .filter(([, data]) => data),
);

// O site continua estático (output padrão). Só as rotas que declaram
// `export const prerender = false` (/admin e /api) rodam no servidor Node.
export default defineConfig({
  site: 'https://tapepro.roilabs.com.br',
  adapter: node({ mode: 'standalone' }),
  // Sem allowedDomains o Astro descarta o header Host, monta a URL como
  // http://localhost e recusa TODO POST de formulário com 403 atrás do proxy
  // do Easypanel. Estes são os hosts em que o app pode se reconhecer.
  security: {
    allowedDomains: [
      { protocol: 'https', hostname: 'tapepro.roilabs.com.br' },
      { protocol: 'http', hostname: 'localhost' },
      { protocol: 'http', hostname: '127.0.0.1' },
    ],
  },
  integrations: [
    mdx(),
    sitemap({
      filter: (page) => !page.includes('/admin'),
      serialize(item) {
        const slug = item.url.match(/\/blog\/([^/]+)\/?$/)?.[1];
        const data = slug && LASTMOD_POR_SLUG.get(slug);
        if (data) item.lastmod = new Date(data).toISOString();
        return item;
      },
    }),
  ],
  vite: { plugins: [tailwindcss()] },
});
