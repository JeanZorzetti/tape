# Handoff — Phase 7: acabamento e deploy ✅ CONCLUÍDA

> Status: **feita em 2026-07-21**. T044–T050 fechadas. Site no ar: **https://tapepro.roilabs.com.br**
> Este documento virou registro do que foi decidido. O estado atual do projeto está em [`handoff.md`](handoff.md).

## O que foi feito

| Task | Resultado |
| --- | --- |
| **T044** `/404` | `src/pages/404.astro` com prop `noindex` nova no `Seo.astro`. Sem busca — 22 páginas, lista resolve sem JS. Confirmado no servidor Node real: status **404**, `noindex`, fora do sitemap. |
| **T045** linkagem | `npm run verificar`: nenhuma órfã, nenhum link quebrado. A `/404` é exceção declarada no script (não é linkada; em troca ele exige que seja noindex). |
| **T046** a11y | **Lighthouse a11y 100** nas 3 páginas (era 95/96). Detalhe abaixo. |
| **T047** imagens | Auditoria virou regra permanente do `verificar`. |
| **T048** Lighthouse | **home 93 · produto 95 · post 91**; a11y/BP/SEO **100** nas três. |
| **T049** deploy | Easypanel, no ar com TLS. |
| **T050** quickstart | Validado contra produção. `quickstart.md` corrigido (Web3Forms e Cloudflare Pages saíram). |

## Contraste — decisões que não se reabrem sem medir

Os pares foram medidos com alpha composto sobre o fundo real. **Quatro reprovavam no AA:**

| Par | Antes | Depois |
| --- | --- | --- |
| Branco sobre a faixa laranja (CTA de 10 páginas + botão primário) | 2,71:1 | **navy sobre laranja, 4,53:1** |
| `text-orange` como texto em superfície clara (eyebrows) | 2,55:1 | **`--color-orange-800` #8f4408, 6,6:1** |
| `text-steel` sobre `kraft-100` | 4,29:1 | **#66635c, 4,84:1** |
| Anel de foco laranja sobre `paper` | 2,55:1 | **anel duplo tinta+laranja, ≥ 4,53:1 nos 3 fundos** |

- O laranja da marca (`#f47c20`) **continua intacto** como fundo e como texto sobre navy (4,53:1). Mudou quem escreve em cima dele — que agora é navy, a dupla do próprio logo.
- `--color-orange-400` (#f89138) existe porque o hover do botão precisa **clarear**: com rótulo navy, escurecer para `orange-600` derrubaria o par para 3,55:1.
- A `TapeStrip` também foi para navy: é `aria-hidden`, mas é o mesmo par visual da faixa de CTA.
- Não-cromáticas que o axe pegou: `<td>` sem cabeçalho em 2 tabelas de post (1ª coluna sob `<th>` vazio → viraram "Critério") e `ink/60` a 4,43:1 na FAQ.

**Regra para conteúdo novo:** texto sobre laranja é **navy**, nunca branco. Eyebrow em superfície clara é **`text-orange-800`**; sobre navy segue `text-orange`.

## O que o `verificar` passou a cobrir (T047)

Além de h1/JSON-LD/canonical/description/alt/órfãs/links, agora barra:
- imagem cujo `src`/`srcset` **não existe** em `dist/client`;
- `<img>` **sem `width`/`height`** (CLS);
- qualquer variante **acima de 200 KB**.

Pegou duas coisas reais: o hero saía em 251 KB na variante 2560px (resolvido fixando `width={1920}`) e o logo declarava 150×50 sendo 1627×1167 — o browser reservava caixa 3:1 e o header pulava ao carregar.

## Performance — o que sobrou

Nenhum item bloqueia a meta, mas se for otimizar mais:
- **`uses-text-compression`** (~300–600 ms): gzip/brotli é responsabilidade do **proxy do Easypanel**, não do build. Maior ganho isolado que resta.
- **`render-blocking-resources`** (~307 ms): o CSS único de 57 KB, quase todo fontes self-hosted (Archivo + IBM Plex Sans + Mono). Cortar pesos não usados é o caminho.
- LCP 2,4–3,2 s medido em **throttling móvel do Lighthouse**, contra localhost.
