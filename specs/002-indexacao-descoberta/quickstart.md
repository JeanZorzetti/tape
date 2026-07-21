# Quickstart — validar a indexação e a descoberta

**Fase 1** | Feature: `002-indexacao-descoberta` | Data: 2026-07-21

Como provar que a feature funciona, do local à produção. Detalhes de formato estão em [contracts/artefatos-descoberta.md](contracts/artefatos-descoberta.md); estrutura dos dados em [data-model.md](data-model.md).

## Pré-requisitos

- Node 22, `npm ci` rodado.
- `@astrojs/rss` instalado (única dependência nova).
- Acesso ao painel do Bing Webmaster Tools para os passos 4 e 5.

---

## 1. Testes de unidade — lógica de submissão

```bash
npm test
```

**Esperado**: `tests/indexnow.test.mjs` passa, cobrindo:

- extrai todas as `<loc>` de um sitemap de exemplo;
- descarta URLs sob `/admin` e `/api`;
- descarta URLs de outro host;
- pula quando o host não é o de produção;
- pula quando o marcador já existe;
- lista vazia encerra com sucesso, não com erro.

---

## 2. Build local — os quatro artefatos existem

```bash
npm run build
npm run verificar
```

**Esperado**: `npm run verificar` termina sem falhas, incluindo as checagens novas. Conferência manual rápida:

```bash
ls dist/client/rss.xml dist/client/llms.txt dist/client/*.txt
grep -c "<item>" dist/client/rss.xml          # bate com o nº de posts publicados
grep -E "Disallow: /(admin|api)/" dist/client/robots.txt
grep -c "rel=\"alternate\"" dist/client/index.html   # 1
```

**Esperado adicional**: nenhuma URL de `/admin` ou `/api` aparece em `dist/client/llms.txt` nem em `dist/client/sitemap-0.xml`.

---

## 3. Submissão local — precisa ser pulada

```bash
node scripts/indexnow.mjs
```

**Esperado**: `[indexnow] pulado: ...` e código de saída `0`. **Nenhuma requisição sai** rodando fora do domínio de produção (FR-005). Confirme que não houve chamada de rede antes de seguir.

Para exercitar o caminho de erro sem afetar produção, force uma falha de rede (host inacessível) e confirme que o script continua saindo com `0` e registra o aviso — é o comportamento que impede o container de cair (FR-004).

---

## 4. Deploy — submissão real

Faça o deploy e acompanhe o log do container no Easypanel.

**Esperado**, dentro de ~15s da subida, uma linha:

```text
[indexnow] 31 URLs -> 200 OK
```

Reinicie o container **sem novo build**.

**Esperado**: `[indexnow] pulado: já submetido neste container` — sem segunda submissão.

Confirme também que o arquivo de chave responde em produção:

```bash
curl -s https://tapepro.roilabs.com.br/<CHAVE>.txt   # devolve a própria chave
curl -s https://tapepro.roilabs.com.br/llms.txt | head -5
curl -sI https://tapepro.roilabs.com.br/rss.xml      # 200, application/xml
```

Se o log trouxer `403`, a chave da constante e o nome/conteúdo do arquivo divergiram.

---

## 5. Bing Webmaster — verificação e recebimento

Seguindo `docs/bing-webmaster.md`:

1. Importar o site do Google Search Console.
2. **Esperado**: propriedade aparece como verificada, sem alteração no repositório.
3. Submeter `https://tapepro.roilabs.com.br/sitemap-index.xml`.
4. **Esperado**: sitemap consta como processado, com o número de URLs descobertas batendo com o `dist`.
5. Na seção de IndexNow do painel, **esperado**: as URLs submetidas no passo 4 aparecem como recebidas.

---

## 6. Critério final (SC-001)

Publique uma página nova, faça o deploy e verifique no painel do Bing em até 48h.

**Esperado**: a URL nova aparece indexada — o resultado que a feature inteira existe para produzir.
