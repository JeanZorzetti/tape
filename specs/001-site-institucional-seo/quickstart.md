# Quickstart — Site Institucional SEO-first (TapePro)

Guia para scaffoldar, rodar e **validar** a feature ponta a ponta. Não contém a implementação (essa vem em `tasks.md` + fase de implementação).

## Pré-requisitos
- Node 22+ (já presente), npm/bun.
- Access key do serviço de formulário (Web3Forms) e número de WhatsApp do representante → em `src/lib/constants.ts` / variáveis de ambiente.
- Fotos reais dos produtos (sem elas, a página do produto não publica).

## Setup
```bash
npm create astro@latest -- --template minimal --typescript strict .
npx astro add mdx sitemap
npm i -D tailwindcss @tailwindcss/vite @fontsource-variable/archivo @fontsource-variable/ibm-plex-sans @fontsource-variable/ibm-plex-mono
# tokens de design em src/styles/tokens.css; Tailwind aponta o tema para eles
```

## Rodar
```bash
npm run dev      # servidor local
npm run build    # gera site estático em dist/
npm run preview  # serve o build
npx astro check  # valida tipos e schemas de conteúdo
```

## Cenários de validação (provam os requisitos da spec)

1. **SEO por página (FR-002/003/004, SC-001)** — no build, cada rota indexável tem:
   - um único `<h1>`, `<title>` e meta description únicos, canonical, OG/Twitter;
   - JSON-LD válido do tipo certo (Organization/Product/FAQPage/BlogPosting) — colar no Rich Results Test;
   - presença no `sitemap-index.xml`; `robots.txt` referencia o sitemap.
   *Verificação*: Playwright percorre as rotas e assere esses elementos; validação de schema por parser de JSON-LD.

2. **Funil de orçamento (FR-005/006/007/008, SC-003/004)**:
   - de qualquer página, o CTA leva a WhatsApp (link `wa.me` com texto pré-preenchido incl. página de origem) **e** ao formulário em ≤ 2 cliques;
   - enviar o formulário com dados válidos → mensagem de sucesso e lead entregue (testar com a key real em staging);
   - enviar inválido → erros de campo; honeypot preenchido → descartado.
   *Verificação*: Playwright (render + link do WhatsApp + validação); teste manual do envio real em staging.

3. **Produtos e conteúdo (FR-001/009/010, SC-005)**:
   - 3 produtos, 4 segmentos, FAQ e ≥ 6 posts publicados, cada um com CTA de orçamento e links internos;
   - diferenciais (mín. 20 rolos, +1.000 empresas) visíveis e consistentes.

4. **Imagens (FR-011, SC-006)**: nenhuma imagem quebrada/placeholder em `dist/`; toda `<img>` informativa tem `alt`; dimensões setadas (sem CLS). *Verificação*: Playwright audita `alt`/broken images; Lighthouse mede CLS.

5. **Performance e acessibilidade (FR-012/013, SC-002/007)**: Lighthouse ≥ 90 em Perf/A11y/Best Practices/SEO na home, numa página de produto e num post; foco de teclado visível; `prefers-reduced-motion` desliga a animação da tira.

6. **Identidade visual (FR-014)**: revisão contra as regras do `CLAUDE.md` — sem template genérico, sem azul padrão/gradiente previsível; a tira de fita (assinatura) presente; screenshots por breakpoint (Playwright) para autocrítica.

## Deploy
Build estático → Cloudflare Pages (ou Netlify). Configurar variável da access key do formulário e o domínio. `robots.txt`/sitemap servidos do estático.
