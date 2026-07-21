# Bing Webmaster Tools — verificação e sitemap

Passos manuais que fecham FR-008. São de painel, não de código: nada aqui é
automatizável, porque não existe API pública de verificação de propriedade.

O que este documento habilita: **enxergar o resultado do que
[`scripts/indexnow.mjs`](../scripts/indexnow.mjs) dispara a cada deploy**. Sem a
propriedade verificada, a submissão continua funcionando, mas ninguém consegue
conferir se foi aceita.

---

## 1. Entrar no painel

<https://www.bing.com/webmasters> com a conta que administra o site.

## 2. Importar do Google Search Console — rota preferida

**Faça por aqui.** O GSC já está verificado, e a importação transfere
verificação, sitemaps e histórico **sem nenhuma alteração no repositório**.

`Adicionar site` → `Importar do Google Search Console` → autorizar → escolher
`https://tapepro.roilabs.com.br`.

**Esperado**: a propriedade aparece como verificada em minutos.

## 3. Plano B — arquivo de verificação ← **foi por aqui**

Usado quando a importação não serve. É o caminho que este site seguiu.

O painel oferece três métodos com **o mesmo token**: meta tag, arquivo XML e
registro DNS. Ficamos no **arquivo XML** — a meta tag resolveria igual, mas
somaria bytes ao `<head>` de *todas* as páginas para um efeito que um arquivo
estático entrega uma vez (research.md D6).

1. No painel, `Adicionar site manualmente` → copiar o token.
2. Criar `public/BingSiteAuth.xml` com o token dentro de `<users><user>`.
3. Deploy, e conferir que `https://tapepro.roilabs.com.br/BingSiteAuth.xml`
   responde 200.
4. Voltar ao painel e clicar em `Verificar`.

⚠️ **O passo 4 só funciona depois do deploy.** O Bing busca o arquivo no
domínio de produção; verificar antes de publicar falha e o painel pede para
tentar de novo.

## 4. Submeter o sitemap

`Sitemaps` → `Enviar sitemap` →
`https://tapepro.roilabs.com.br/sitemap-index.xml`.

**Esperado**: estado `Sucesso` e um número de URLs descobertas batendo com o que
o build gera (`npm run build && npm run verificar` imprime o total de páginas).

## 5. Conferir o recebimento das submissões IndexNow

Três caminhos, da resposta mais rápida à mais informativa. **Comece pelos dois
primeiros** — eles respondem em segundos e não dependem do painel.

### 5a. A resposta HTTP (imediata)

```bash
NODE_ENV=production npm run indexnow    # apaga dist/.indexnow-enviado antes, se quiser repetir
```

`200` é aceito **com a chave já validada**; `202` é aceito com a chave ainda em
validação — normal logo depois de publicar a chave pela primeira vez. Os
códigos de erro estão na tabela do [contrato §5](../specs/002-indexacao-descoberta/contracts/artefatos-descoberta.md).

### 5b. O log do container (uma linha por deploy)

No Easypanel, ~15s após a subida: `[indexnow] 21 URLs -> 200 OK`. É o lugar de
olhar na rotina.

### 5c. O painel — `Reports & Data` → `IndexNow`

O único que mostra o que o Bing **fez** com as URLs, não só se recebeu:

- últimas **1000 URLs submetidas**, com status de indexação, data da primeira
  indexação e se a submissão foi tardia;
- **origem** da submissão (Cloudflare, WordPress, manual, API — a nossa é API);
- amostra quase em tempo real das submissões recentes, feita para validar
  integração;
- aba **"Important URLs Missing"**: links recebendo cliques que não apareceram
  no IndexNow recentemente.

⏱️ **Os dados levam até ~24h para consolidar.** A amostra recente aparece antes,
mas o status de indexação não é instantâneo — não tire conclusões no mesmo dia.

Como ler o que aparece:

| O que aparece | Significado |
|---------------|-------------|
| URLs listadas após um deploy | o disparo do container chegou — é o caminho feliz |
| Nenhuma URL, mas a chave consta | submissão não saiu: ver o log do container por `[indexnow]` |
| Chave inválida / não encontrada | o arquivo `<chave>.txt` na raiz do domínio não responde 200 ou o conteúdo diverge do nome |
| URL recusada | quase sempre host fora do declarado — o filtro em `filtrarPublicas` deveria ter barrado |

O log do container no Easypanel traz uma linha por subida, no formato
`[indexnow] 31 URLs -> 200 OK`. É a primeira coisa a olhar quando o painel não
mostra nada.

---

## Registro

Preencher ao executar — é o que prova que os passos 2 a 4 aconteceram.

| Item | Valor |
|------|-------|
| Token da propriedade | `9E40520DFE09119E7EB8E15A8ED12DEB` |
| Arquivo publicado | [`public/BingSiteAuth.xml`](../public/BingSiteAuth.xml) — commit de 2026-07-21 |
| Método escolhido | Arquivo XML (plano B), não a importação do GSC |
| Motivo do plano B | O usuário pegou o token de verificação manual direto no painel. Entre os três métodos manuais, o arquivo evita somar bytes ao `<head>` de todas as páginas. |
| Data da verificação | **2026-07-21 — verificada** |
| URLs descobertas no sitemap | _aguardando o processamento do Bing; o `sitemap-0.xml` publica **21 URLs**, com `lastmod` nos 7 posts_ |

⚠️ **O botão `Verificar` do bloco "Marca Meta HTML" nunca vai passar** — a home
não tem a meta tag de propósito. Clicar nele devolve um `Erro: ocorreu um erro
inesperado` genérico, que não diz qual é o problema. Use o `Verificar` do bloco
do **arquivo XML**, logo acima dele no painel.

> O token é **público por natureza** (o Bing precisa lê-lo sem autenticação),
> como a chave do IndexNow. Não é credencial e pode ficar versionado.
