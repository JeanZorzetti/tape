# Contrato — Artefatos públicos de descoberta

**Fase 1** | Feature: `002-indexacao-descoberta` | Data: 2026-07-21

As interfaces externas desta feature são **arquivos servidos publicamente** e **uma requisição de saída**. Este contrato define o que cada um garante. `scripts/verificar-seo.mjs` confere os itens marcados com ✅ contra o `dist` gerado.

---

## 1. `GET /<chave>.txt` — arquivo de chave IndexNow

| Item | Garantia |
|------|----------|
| Status | `200` |
| Content-Type | `text/plain` |
| Corpo | exatamente a chave, sem outro conteúdo |
| Nome do arquivo | `<chave>.txt`, na raiz do domínio |

**Invariante**: nome do arquivo sem extensão == conteúdo do arquivo. É a única definição da chave — não há constante em `src/`.

✅ Verificado: existe exatamente um `*.txt` na raiz de `dist/client/` e seu conteúdo é igual ao nome sem a extensão.

---

## 2. `GET /robots.txt`

| Item | Garantia |
|------|----------|
| Status | `200` |
| `Sitemap:` | aponta para `https://tapepro.roilabs.com.br/sitemap-index.xml` |
| Bloqueio | `Disallow: /admin/` e `Disallow: /api/` valem para todo agente |
| Agentes de IA | bloco `Allow` explícito para os agentes listados em [research.md D9](../research.md) |
| `llms.txt` | referenciado em comentário apontando a URL absoluta |

✅ Verificado: `/admin/` e `/api/` bloqueados; linha `Sitemap:` presente.

**Invariante**: nenhuma regra pode liberar `/admin` ou `/api` para agente nenhum, nem por engano de ordenação de blocos.

---

## 3. `GET /llms.txt`

Formato llmstxt.org, gerado no build.

```text
# TapePro — Fitas adesivas personalizadas

> [uma linha: o que a empresa faz, para quem, condição de pedido]

## Produtos
- [Nome do produto](https://tapepro.roilabs.com.br/produtos/slug): resumo em uma linha

## Segmentos
- [Título do segmento](https://.../segmentos/slug): resumo

## Blog
- [Título do post](https://.../blog/slug): descrição

## Institucional
- [Sobre](https://.../sobre): ...
```

| Item | Garantia |
|------|----------|
| Status | `200`, `text/plain` |
| Links | todos absolutos, todos resolvem para rota existente no site |
| Cobertura | todo produto, segmento e post publicado aparece exatamente uma vez |
| Exclusão | nenhuma rota de `/admin`, `/api` ou post com `rascunho: true` |

✅ Verificado: cada link do `llms.txt` corresponde a uma rota presente no `dist`; contagem de posts bate com a de posts publicados.

---

## 4. `GET /rss.xml`

| Item | Garantia |
|------|----------|
| Status | `200`, `application/xml` |
| Raiz | `<rss version="2.0">` com `<channel>` contendo `title`, `description`, `link` |
| Itens | um `<item>` por post publicado, com `title`, `description`, `link` absoluto, `pubDate` |
| Ordem | `pubDate` decrescente |
| Rascunhos | ausentes |
| Sem posts | `<channel>` válido sem nenhum `<item>` — nunca erro |

✅ Verificado: arquivo existe no `dist`, contagem de `<item>` bate com a de posts publicados.

**No HTML de toda página** (`BaseLayout`):

```html
<link rel="alternate" type="application/rss+xml" title="Blog TapePro" href="https://tapepro.roilabs.com.br/rss.xml" />
```

✅ Verificado: presente em todo HTML gerado.

---

## 5. Saída — `POST https://api.indexnow.org/indexnow`

**Requisição**

```http
POST /indexnow HTTP/1.1
Host: api.indexnow.org
Content-Type: application/json; charset=utf-8

{
  "host": "tapepro.roilabs.com.br",
  "key": "<chave — nome do .txt em dist/client, sem extensão>",
  "keyLocation": "https://tapepro.roilabs.com.br/<chave>.txt",
  "urlList": ["https://tapepro.roilabs.com.br/", "..."]
}
```

**Respostas e tratamento** — nenhuma propaga erro para o processo do servidor:

| Status | Significado | Ação |
|--------|-------------|------|
| `200` | aceito | registra sucesso, grava marcador |
| `202` | aceito, chave em validação | registra sucesso, grava marcador |
| `400` | corpo inválido | registra erro com o corpo enviado |
| `403` | chave não confere com o arquivo publicado | registra erro apontando a divergência chave × arquivo |
| `422` | URL fora do host declarado | registra erro com as URLs recusadas |
| `429` | excesso de submissões | registra aviso, não tenta de novo neste ciclo |
| rede/timeout | serviço fora | registra aviso e encerra com sucesso |

**Pré-condições para disparar**:

1. O host derivado das URLs do sitemap é o domínio de produção — senão, pula.
2. `dist/.indexnow-enviado` não existe — senão, pula.
3. Existe exatamente um `*.txt` na raiz de `dist/client` — senão, registra e pula.
4. `urlList` não vazia após o filtro (fora `/admin`, `/api`, `.xml`, host estranho, duplicata) — senão, pula.

**Formato do log** (FR-006), uma linha por disparo:

```text
[indexnow] 31 URLs -> 200 OK
[indexnow] pulado: host localhost não é produção
[indexnow] pulado: já submetido neste container
[indexnow] falha: 403 (chave do arquivo não confere)
```

---

## 6. Passos manuais — Bing Webmaster Tools

Não é interface de código, mas é contrato operacional (FR-008). `docs/bing-webmaster.md` precisa cobrir, na ordem:

1. Entrar no Bing Webmaster Tools com a conta que administra o site.
2. **Importar do Google Search Console** (rota preferida — GSC já verificado).
3. Se a importação não estiver disponível: publicar `public/BingSiteAuth.xml` com o token do painel e verificar por arquivo.
4. Submeter `https://tapepro.roilabs.com.br/sitemap-index.xml`.
5. Onde conferir o recebimento das submissões IndexNow no painel e como ler as recusas.
