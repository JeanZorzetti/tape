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

## 3. Plano B — arquivo de verificação

Só se a importação não estiver disponível na conta.

1. No painel, `Adicionar site manualmente` → aba `Arquivo XML` → copiar o token.
2. Criar `public/BingSiteAuth.xml` com o conteúdo que o painel fornece.
3. Deploy, e conferir que `https://tapepro.roilabs.com.br/BingSiteAuth.xml`
   responde 200.
4. Voltar ao painel e clicar em `Verificar`.
5. Anotar na seção *Registro* abaixo por que a importação não serviu.

## 4. Submeter o sitemap

`Sitemaps` → `Enviar sitemap` →
`https://tapepro.roilabs.com.br/sitemap-index.xml`.

**Esperado**: estado `Sucesso` e um número de URLs descobertas batendo com o que
o build gera (`npm run build && npm run verificar` imprime o total de páginas).

## 5. Conferir o recebimento das submissões IndexNow

`Configurar meu site` → `IndexNow`.

O painel lista as URLs recebidas, a data e o estado de cada uma. Como ler:

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
| Data da verificação | _pendente_ |
| Método que funcionou | _pendente (importação do GSC ou arquivo XML)_ |
| Motivo do plano B, se usado | _n/a_ |
| URLs descobertas no sitemap | _pendente_ |
