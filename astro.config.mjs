import { readFileSync, readdirSync } from 'node:fs';

import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import node from '@astrojs/node';
import tailwindcss from '@tailwindcss/vite';

// `lastmod` é o único sinal de atualização que o Google aceita para página
// comum (o IndexNow ele não usa). Só as rotas de blog e os guias levam: institucionais e
// de produto mudam junto com o deploy inteiro, e carimbar todas com a data do
// build seria ruído, não sinal.
//
// Este arquivo não acessa `astro:content`, então as datas saem do frontmatter.
// ponytail: regex em vez de parser de YAML — o formato dessas datas é gerado
// pelo nosso próprio schema. Migrar para leitura da coleção se ficar irregular.
const DIR_BLOG = './src/content/blog';
const DIR_GUIAS = './src/content/guias';
const datasDoFrontmatter = (dir) =>
  readdirSync(dir)
    .filter((nome) => nome.endsWith('.mdx'))
    .map((nome) => {
      const frontmatter = readFileSync(`${dir}/${nome}`, 'utf8').split(/^---$/m)[1] ?? '';
      const campo = (chave) => frontmatter.match(new RegExp(`^${chave}:\\s*["']?(\\d{4}-\\d{2}-\\d{2})`, 'm'))?.[1];
      return [nome.replace(/\.mdx$/, ''), campo('atualizadoEm') ?? campo('publicadoEm')];
    })
    .filter(([, data]) => data);
const LASTMOD_POR_SLUG = new Map(datasDoFrontmatter(DIR_BLOG));
// Os guias de fita moram na raiz (/fita-kraft/) e também carregam a data de atualização.
const LASTMOD_POR_GUIA = new Map(datasDoFrontmatter(DIR_GUIAS));

// URLs do site oficial que ocupava tapeprofitas.com.br até 17/10/2026 (lidas do
// sitemap dele): cada uma vai para a página daqui que cobre o mesmo assunto,
// para o que o Google e os links já conhecem não cair em 404.
const URLS_DO_SITE_ANTERIOR = {
  '/fita-bopp-personalizada': '/produtos/fita-transparente-personalizada/',
  '/fita-transparente-personalizada': '/produtos/fita-transparente-personalizada/',
  '/fita-gomada-personalizada': '/produtos/fita-gomada/',
  '/direto-da-fabrica': '/sobre/',
  '/grande-volume': '/produtos/',
  '/industria': '/segmentos/industria/',
  '/alimentos': '/segmentos/industria/',
  '/cosmeticos': '/segmentos/industria/',
  '/farmaceutica': '/segmentos/industria/',
  '/distribuidoras': '/segmentos/distribuidor/',
  '/atacadistas': '/segmentos/distribuidor/',
  '/graficas': '/segmentos/distribuidor/',
  '/e-commerce': '/segmentos/e-commerce/',
  '/dropshipping': '/segmentos/e-commerce/',
  '/marketplaces': '/segmentos/e-commerce/',
  '/transportadoras': '/blog/fita-adesiva-colorida-para-logistica/',
};

// O site continua estático (output padrão). Só as rotas que declaram
// `export const prerender = false` (/admin e /api) rodam no servidor Node.
export default defineConfig({
  site: 'https://tapeprofitas.com.br',
  // Uma URL por página: sem barra responde 301 para com barra (o adapter node faz o redirect).
  // Com as duas em 200 o Google escolheu a sem barra como canônica, contra a tag e o sitemap.
  trailingSlash: 'always',
  redirects: Object.fromEntries(
    Object.entries(URLS_DO_SITE_ANTERIOR).map(([de, para]) => [de, { status: 301, destination: para }]),
  ),
  adapter: node({ mode: 'standalone' }),
  // Sem allowedDomains o Astro descarta o header Host, monta a URL como
  // http://localhost e recusa TODO POST de formulário com 403 atrás do proxy
  // do Easypanel. Estes são os hosts em que o app pode se reconhecer.
  security: {
    allowedDomains: [
      { protocol: 'https', hostname: 'tapeprofitas.com.br' },
      { protocol: 'https', hostname: 'www.tapeprofitas.com.br' },
      { protocol: 'http', hostname: 'localhost' },
      { protocol: 'http', hostname: '127.0.0.1' },
    ],
  },
  integrations: [
    mdx(),
    sitemap({
      // /orcamento/ é formulário (150 palavras) e fica noindex: o sitemap só leva conteúdo que deve indexar.
      filter: (page) => !page.includes('/admin') && !page.endsWith('/orcamento/'),
      serialize(item) {
        const slug = item.url.match(/\/blog\/([^/]+)\/?$/)?.[1];
        const raiz = new URL(item.url).pathname.match(/^\/([^/]+)\/$/)?.[1];
        const data = (slug && LASTMOD_POR_SLUG.get(slug)) || (raiz && LASTMOD_POR_GUIA.get(raiz));
        if (data) item.lastmod = new Date(data).toISOString();
        return item;
      },
    }),
  ],
  vite: { plugins: [tailwindcss()] },
});
