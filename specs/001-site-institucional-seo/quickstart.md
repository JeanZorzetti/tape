# Quickstart — Site Institucional SEO-first (TapePro)

Guia para rodar e **validar** a feature ponta a ponta.

> **Status: implementado e no ar** em https://tapepro.roilabs.com.br — 22 páginas.
> O bloco de Setup era o scaffold inicial e não precisa mais ser executado; `npm install` basta.

## Pré-requisitos
- Node 22+, npm.
- Número de WhatsApp do representante → `src/lib/constants.ts`.
- Para `/admin` e `/api/lead` (só em runtime, o build estático não precisa): `DATABASE_URL`, `SESSION_SECRET`, `ADMIN_EMAIL`, `ADMIN_SENHA`. Ver `.env.example`.
- Fotos reais dos produtos (sem elas, a página do produto não publica).

## Rodar
```bash
npm install
npm run dev                    # dev (confira a porta no log — 4321 costuma estar ocupada)
npm run build                  # gera dist/client (estático) + dist/server (Node)
npm run verificar              # confere o dist contra os contratos de SEO, links e imagens
node dist/server/entry.mjs     # servidor real; precisa das env vars
```

`npx astro check` pede instalar `@astrojs/check` + `typescript` e abre prompt interativo — não roda hoje.

## Cenários de validação (provam os requisitos da spec)

1. **SEO por página (FR-002/003/004, SC-001)** — no build, cada rota indexável tem:
   - um único `<h1>`, `<title>` e meta description únicos, canonical, OG/Twitter;
   - JSON-LD válido do tipo certo (Organization/Product/FAQPage/BlogPosting) — colar no Rich Results Test;
   - presença no `sitemap-index.xml`; `robots.txt` referencia o sitemap.
   *Verificação*: Playwright percorre as rotas e assere esses elementos; validação de schema por parser de JSON-LD.

2. **Funil de orçamento (FR-005/006/007/008, SC-003/004)**:
   - de qualquer página, o CTA leva a WhatsApp (link `wa.me` com texto pré-preenchido incl. página de origem) **e** ao formulário em ≤ 2 cliques;
   - enviar o formulário com dados válidos → mensagem de sucesso e lead **gravado no Postgres** via `POST /api/lead`, visível em `/admin`;
   - enviar inválido → erros de campo; honeypot preenchido → descartado em silêncio; se o POST falhar, cai no fallback de WhatsApp com os dados preenchidos.
   *Verificação*: manual contra o deploy. **Web3Forms saiu** — os leads vivem no CRM próprio.

3. **Produtos e conteúdo (FR-001/009/010, SC-005)**:
   - 3 produtos, 4 segmentos, FAQ e ≥ 6 posts publicados, cada um com CTA de orçamento e links internos;
   - diferenciais (mín. 20 rolos, +1.000 empresas) visíveis e consistentes.

4. **Imagens (FR-011, SC-006)**: nenhuma imagem quebrada/placeholder em `dist/`; toda `<img>` informativa tem `alt`; dimensões setadas (sem CLS). *Verificação*: Playwright audita `alt`/broken images; Lighthouse mede CLS.

5. **Performance e acessibilidade (FR-012/013, SC-002/007)**: Lighthouse ≥ 90 em Perf/A11y/Best Practices/SEO na home, numa página de produto e num post; foco de teclado visível; `prefers-reduced-motion` desliga a animação da tira.

6. **Identidade visual (FR-014)**: revisão contra as regras do `CLAUDE.md` — sem template genérico, sem azul padrão/gradiente previsível; a tira de fita (assinatura) presente; screenshots por breakpoint (Playwright) para autocrítica.

## Deploy — Easypanel (VPS)

**Cloudflare Pages saiu de cena**: o site deixou de ser 100% estático (`/admin` e `/api` rodam no adapter Node) e um Worker não abre conexão TCP com Postgres.

1. Serviço **Postgres** no projeto → copiar a connection string interna.
2. Serviço **App** por **Dockerfile** (na raiz do repo).
3. Env: `DATABASE_URL`, `SESSION_SECRET` (≥32 chars), `ADMIN_EMAIL`, `ADMIN_SENHA`.
4. Domínio na porta **4321**, TLS ligado.
5. Primeiro login em `/admin/login` **cria a conta** (só enquanto a tabela `usuarios` estiver vazia).

⚠️ O domínio de produção precisa estar em `security.allowedDomains` no `astro.config.mjs`. Sem isso o Astro descarta o header `Host` e responde **403 em todo POST** atrás do proxy — formulário e admin quebram juntos.
