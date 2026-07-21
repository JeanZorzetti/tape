# Implementation Plan: Indexação rápida e descoberta por buscadores e motores de IA

**Branch**: `002-indexacao-descoberta` | **Date**: 2026-07-21 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/002-indexacao-descoberta/spec.md`

## Summary

Quatro artefatos públicos e um disparo automático, todos derivados do conteúdo que já existe no repositório:

1. **IndexNow** — arquivo de chave em `public/`, e um script que lê o sitemap já gerado e submete as URLs para `api.indexnow.org`. Dispara **na subida do container** (não no build da imagem), em background, com marcador de idempotência dentro do `dist` para não repetir a submissão a cada restart.
2. **Bing Webmaster** — verificação preferencialmente por **importação do Google Search Console** (já verificado, zero mudança no repo); arquivo de verificação em `public/` como plano B. Passos manuais documentados em `docs/`.
3. **llms.txt** — endpoint estático gerado das coleções e do catálogo, mais regras explícitas de crawler de IA no `robots.txt` estático.
4. **RSS** — endpoint `/rss.xml` com `@astrojs/rss`, reusando `postsPublicados()`, com `<link rel="alternate">` no `BaseLayout`.

Nada disso precisa de banco, credencial ou runtime novo. A única dependência nova é `@astrojs/rss`.

## Technical Context

**Language/Version**: TypeScript / JavaScript (ESM), Node 22 (imagem `node:22-alpine`)

**Primary Dependencies**: Astro 5, `@astrojs/sitemap` (já instalado, fonte das URLs), `@astrojs/rss` (**única dependência nova**), `@astrojs/node` (adapter standalone). Submissão HTTP via `fetch` nativo do Node — sem cliente HTTP novo.

**Storage**: N/A. O único estado é um arquivo marcador dentro do `dist` do container, que nasce e morre com o container.

**Testing**: `node --test tests/**/*.test.mjs` (já configurado, `npm test`) para a lógica de seleção de URLs; `scripts/verificar-seo.mjs` (`npm run verificar`) estendido para conferir os artefatos gerados no `dist`.

**Target Platform**: container Linux no Easypanel, servindo `https://tapepro.roilabs.com.br`; saída estática com `/admin` e `/api` em SSR.

**Project Type**: site estático Astro com rotas SSR pontuais — projeto único, sem separação front/back.

**Performance Goals**: a submissão não pode atrasar a subida do servidor (roda desanexada do processo que responde ao health check). Geração de `llms.txt` e `rss.xml` é build-time, custo desprezível.

**Constraints**:

- Falha de rede na submissão **nunca** derruba build nem container (FR-004).
- Submissão só no domínio de produção (FR-005).
- Nenhuma credencial no repositório — a chave IndexNow é pública por definição do protocolo (FR-001).
- Área administrativa fora de todo artefato público (FR-003, FR-012).

**Scale/Scope**: ~30 URLs públicas hoje (3 produtos, segmentos, posts, páginas institucionais). Ordem de grandeza que torna trivial submeter o conjunto recente a cada deploy.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` está **com o template não preenchido** — nenhum princípio foi ratificado. Os gates efetivos são as regras do [CLAUDE.md](../../CLAUDE.md) do projeto:

| Regra do projeto | Como este plano atende | Status |
|------------------|------------------------|--------|
| DRY / fonte única de verdade | URLs vêm do sitemap já gerado; posts vêm de `postsPublicados()`; produtos de `PRODUTOS`. Nenhuma segunda lista de rotas. | ✅ |
| Constantes sobre valores mágicos | `SITE_URL` já existe em `src/lib/constants.ts`; chave e endpoint entram como constantes nomeadas. | ✅ |
| Responsabilidade única / funções pequenas | O script de submissão faz três coisas nomeadas: ler sitemap, filtrar, enviar. | ✅ |
| Sem dependência nova onde poucas linhas resolvem | `fetch` nativo em vez de cliente HTTP; regex sobre `<loc>` em vez de parser XML. Só `@astrojs/rss` entra, e é o gerador oficial do framework. | ✅ |
| Testes cobrindo casos de borda | `node --test` cobre a seleção de URLs (exclusão de `/admin`, guarda de domínio, idempotência). | ✅ |
| Piso de qualidade (a11y, responsivo, foco visível) | Nenhuma mudança visual além de uma tag `<link>` no `<head>`. | ✅ |

**Sem violações. Complexity Tracking fica vazio.**

**Re-check pós-Fase 1**: o design não introduziu abstração, camada nem dependência além das listadas. Os quatro artefatos são arquivos gerados; a automação é um script de ~60 linhas. Gates seguem verdes.

## Project Structure

### Documentation (this feature)

```text
specs/002-indexacao-descoberta/
├── plan.md              # Este arquivo
├── spec.md              # O que e por quê
├── research.md          # Decisões técnicas resolvidas (Fase 0)
├── data-model.md        # Entidades e formatos (Fase 1)
├── quickstart.md        # Como validar ponta a ponta (Fase 1)
├── contracts/
│   └── artefatos-descoberta.md   # Contrato dos arquivos públicos e da submissão
├── checklists/
│   └── requirements.md  # Checklist de qualidade da spec
└── tasks.md             # Gerado pelo /speckit-tasks — NÃO por este comando
```

### Source Code (repository root)

```text
public/
├── robots.txt                    # MODIFICADO: agentes de IA + bloqueio de /admin e /api
├── <chave-indexnow>.txt          # NOVO: arquivo de chave (conteúdo = a própria chave)
└── BingSiteAuth.xml              # NOVO (plano B): só se a importação do GSC falhar

src/
├── pages/
│   ├── llms.txt.ts               # NOVO: endpoint estático gerado das coleções
│   └── rss.xml.ts                # NOVO: feed do blog
├── layouts/
│   └── BaseLayout.astro          # MODIFICADO: <link rel="alternate"> do feed
└── lib/
    ├── constants.ts              # MODIFICADO: CHAVE_INDEXNOW, FEED_URL
    └── conteudo.ts               # REUSADO: postsPublicados() alimenta feed e llms.txt

scripts/
├── indexnow.mjs                  # NOVO: lê sitemap do dist, filtra, submete
└── verificar-seo.mjs             # MODIFICADO: confere rss.xml, llms.txt e robots no dist

tests/
└── indexnow.test.mjs             # NOVO: seleção de URLs e guardas

docs/
└── bing-webmaster.md             # NOVO: passos manuais do painel

Dockerfile                        # MODIFICADO: copia scripts/, dispara o ping na subida
```

**Structure Decision**: projeto único Astro, sem novos diretórios além de `docs/`. Cada artefato novo mora onde seu tipo já mora: páginas geradas em `src/pages/`, arquivos estáticos em `public/`, automação em `scripts/`, testes em `tests/`. `src/lib/conteudo.ts` é reusado como fonte dos posts, em vez de refazer a consulta e o filtro de rascunho em dois lugares novos.

## Complexity Tracking

> Sem violações do Constitution Check. Seção intencionalmente vazia.
