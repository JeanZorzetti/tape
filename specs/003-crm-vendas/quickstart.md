# Quickstart — Validação do CRM de Vendas (003)

Roteiro para provar a feature ponta a ponta. Assume o ambiente do `/admin` já descrito no
`handoff.md`. Não contém código de implementação — só como subir, rodar e o que esperar.

## Pré-requisitos

```bash
# Postgres descartável (mesmo do handoff)
docker run -d --name tapepro-pg -e POSTGRES_PASSWORD=teste -e POSTGRES_DB=tapepro \
  -p 55432:5432 postgres:16-alpine
# .env (raiz):
#   DATABASE_URL=postgres://postgres:teste@localhost:55432/tapepro
#   SESSION_SECRET=<32+ chars>  ADMIN_EMAIL=<voce>  ADMIN_SENHA=<senha>

npm install
npm run build            # gera dist/client + dist/server
node dist/server/entry.mjs   # sobe o server real (precisa das env vars)
```

O schema (incl. `tentativas`, `pedidos`, `transicoes`, `leads.nicho`, backfill) se aplica
sozinho na 1ª consulta. Faça login em `/admin/login` com `ADMIN_EMAIL`/`ADMIN_SENHA` (cria a
conta no 1º acesso).

> Testando POST via `curl`, envie `-H "Origin: http://127.0.0.1:<porta>"` ou o Astro devolve
> 403 (`security.allowedDomains`). Pelo navegador não precisa.

## Testes automatizados

```bash
npm test        # inclui cadencia.test.mjs, funil.test.mjs, crm-vendas.test.mjs
```

- `cadencia.test.mjs` — `proximaDataCadencia` devolve as datas certas para os 6 toques e
  `null` quando esgota; `cadenciaEsgotada` vira `true` no 6º.
- `funil.test.mjs` — as três taxas de coorte batem em cenários montados à mão; divisor zero
  ⇒ `null`.
- `crm-vendas.test.mjs` *(integração, exige build + `DATABASE_URL`)* — 1º pedido fecha o lead
  e agenda carteira +30d; 2º pedido só reagenda; `aplicarSchema` rodado 2× não duplica
  transições.

## Validação manual por user story

### US1 — Cadência de 1ª venda (P1)
1. Crie um lead (envie o formulário público `/orcamento` ou `POST /api/lead`).
2. Abra `/admin/<id>`. Registre uma **tentativa** (canal WhatsApp, resultado "sem resposta").
   → **Esperado**: a tentativa entra no histórico; o campo "próximo contato" já vem sugerido
   com a data do próximo toque (editável); status vira "Em contato".
3. Repita registrando 6 tentativas. → **Esperado**: após a 6ª, aparece o aviso de **cadência
   esgotada** sugerindo marcar "Perdido" (sem marcar sozinho).
4. Volte a `/admin` com a data de próximo contato no passado. → **Esperado**: o lead aparece
   com **follow-up vencido** destacado.

### US2 — Carteira pós-venda (P2)
1. No lead, registre um **pedido** (data de hoje, valor R$ 1.234,50, volume 200).
   → **Esperado**: status vira "Fechado"; a ficha mostra "última compra" e "próximo recontato"
   = hoje + 30 dias; o lead sai da fila de cadência.
2. Vá para `/admin?visao=carteira`. → **Esperado**: o cliente aparece na carteira, ordenado
   por próximo recontato.
3. Registre um 2º pedido com data mais recente. → **Esperado**: recontato reagenda para
   (nova data + 30d); status continua "Fechado".
4. Acione **pausar carteira**. → **Esperado**: some da fila de vencidos; histórico de pedidos
   e notas intacto.

### US3 — Funil (P3)
1. Abra `/admin/funil`. → **Esperado**: contagem por etapa (Novo/Em contato/Orçado/Fechado/
   Perdido) e as três taxas: **lead→fechado**, **em contato→fechado**, **orçado→fechado**.
2. Troque `?periodo=mes|ano|tudo`. → **Esperado**: contagens e taxas mudam com a coorte de
   `criado_em`; etapa sem base mostra "—", nunca erro.
3. **Backfill**: em um banco com leads pré-existentes (sem transições), suba o server e abra o
   funil. → **Esperado**: os leads antigos já contam na coorte (transição inicial semeada).

### US4 — Nicho (P4)
1. No lead, atribua um **nicho** (ex.: indústria). → **Esperado**: salvo, visível na ficha e
   na lista.
2. `/admin?nicho=industria`. → **Esperado**: só leads de indústria.
3. Em `/admin/funil`, veja a **distribuição por nicho** e troque `?nicho=` para ver a taxa de
   conversão daquele nicho. → **Esperado**: números batem com a lista filtrada.

## Critérios de aceite atendidos

SC-001 (todo lead ativo tem próximo passo) · SC-002 (registrar toque < 30 s) · SC-003
(cliente não passa do intervalo sem cair na fila) · SC-004 (funil < 5 s) · SC-005 (nicho
filtra exato) · SC-006 (etapa de maior perda visível) · SC-007 (telas atuais do `/admin`
seguem funcionando).

## Limpeza

```bash
docker rm -f tapepro-pg
# feche o `node dist/server/entry.mjs` (Ctrl-C) — ver gotcha de portas no handoff.md
```
