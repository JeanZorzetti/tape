# Quickstart — validar a Execução da prospecção

Roteiro de validação ponta a ponta. Detalhes de forma e assinatura estão em
[data-model.md](data-model.md) e [contracts/internal.md](contracts/internal.md); aqui é só como provar que
funciona.

## Pré-requisitos

- Node instalado; `npm install` feito.
- Postgres descartável para os passos de banco/UI (ver `docs/handoffs/handoff.md` → "Como rodar"):
  ```bash
  docker run -d --name tapepro-pg -e POSTGRES_PASSWORD=teste -e POSTGRES_DB=tapepro -p 55432:5432 postgres:16-alpine
  # DATABASE_URL=postgres://postgres:teste@localhost:55432/tapepro  + SESSION_SECRET/ADMIN_EMAIL/ADMIN_SENHA no .env
  ```

## 1. Testes automatizados (sem UI)

```bash
npm test
```

Esperado: verde. Cobre:
- **`scripts.test.mjs`** — `passoDoLead(0..99)` mapeia 0..5; `montarScript` não deixa `[placeholder]` cru
  (inclusive sem `nome`); `scriptDoLead` devolve texto para todo nicho e para `null`/"outro";
  `instagramUrl` normaliza `@x`, `x`, `instagram.com/x`, link completo, e devolve `null` para lixo.
- **`execucao-prospeccao.test.mjs`** (integração, pula sem `DATABASE_URL`) — `contarToquesHoje` conta só
  tentativas de hoje (America/Sao_Paulo) e só da pipeline pedida.

## 2. Build e verificação estrutural

```bash
npm run build && npm run verificar
```

Esperado: build OK; `verificar` OK (as páginas `/admin` são `noindex` e ficam fora do sitemap — a feature não
adiciona URL pública).

## 3. Scripts na ficha (US1) — manual, autenticado

Suba o server (`node dist/server/entry.mjs` com as env vars) e entre em `/admin/login`.

1. **1º toque, com WhatsApp**: abra um lead de recuperação com **nicho definido**, telefone e **0 tentativas**.
   - Esperado: bloco "Script de abordagem" com o texto do **1º toque** do nicho, **empresa preenchida**;
     botão **WhatsApp** que abre `wa.me` com essa mensagem.
2. **Avança com a cadência**: registre 1 toque e reabra a ficha.
   - Esperado: o script exibido agora é o **follow-up D+1** (passo 1), não o 1º toque.
3. **Cadência esgotada**: num lead com ≥6 tentativas.
   - Esperado: script de **despedida** (passo 5) + o aviso de "cadência esgotada" já existente.
4. **Sem nicho**: lead de recuperação sem nicho.
   - Esperado: script **genérico** utilizável + convite a classificar; nada quebra.
5. **Placeholder sem dado**: lead sem `nome`.
   - Esperado: a mensagem lê bem (saudação neutra), **sem `[nome]` cru**.
6. **Só Instagram**: lead sem telefone, com `@` em Dados da prospecção.
   - Esperado: **link "Abrir Instagram"** para o perfil + texto de DM copiável; sem botão de WhatsApp.
7. **Sem canal nenhum**: lead sem telefone e sem Instagram.
   - Esperado: só o texto copiável; sem botões de canal, sem erro.
8. **Objeções**: confira que as respostas (preço, fornecedor, clichê) estão acessíveis na tela.
9. **Inbound não afetado**: abra um lead **inbound** → o bloco de scripts **não** aparece.

## 4. Contador de toques do dia (US2) — manual

1. Sem nenhuma tentativa hoje, abra `/admin?pipeline=recuperacao`.
   - Esperado: **"0 / 20 toques hoje"** (ou a `META_TOQUES_DIA` vigente).
2. Registre 2 toques (em leads dessa pipeline) e volte à lista.
   - Esperado: **"2 / 20"**.
3. Alterne para a pipeline **inbound**.
   - Esperado: o contador reflete só os toques **inbound** de hoje (escopo por pipeline).
4. Atinja a meta.
   - Esperado: estado de **meta batida** sinalizado sem depender só de cor.
5. Virada do dia (ou uma tentativa com `criado_em` de ontem no fuso BR, via SQL de teste).
   - Esperado: o contador de "hoje" **não** inclui ontem.

## Sinais de regressão (o que NÃO pode mudar)

- Cadência, funil, carteira, ordenação da lista, notas e a seção "Dados da prospecção" seguem idênticos.
- Nenhuma URL pública nova; `/admin` continua `noindex` e autenticado.
- Zero JavaScript no client nas telas tocadas.
