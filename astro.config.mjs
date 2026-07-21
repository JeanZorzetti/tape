import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import node from '@astrojs/node';
import tailwindcss from '@tailwindcss/vite';

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
  integrations: [mdx(), sitemap({ filter: (page) => !page.includes('/admin') })],
  vite: { plugins: [tailwindcss()] },
});
