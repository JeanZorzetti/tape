# Quickstart — validar a pipeline de recuperação

Guia de validação ponta a ponta. Não contém código de implementação; aponta para
[data-model.md](./data-model.md) e [contracts/crm-e-import.md](./contracts/crm-e-import.md).

## Pré-requisitos

- Node 22.18+ (type-stripping padrão), deps instaladas (`npm install`).
- Postgres descartável + `DATABASE_URL` (mesmo padrão de `tests/crm-vendas.test.mjs`):

  ```bash
  docker run -d --name tapepro-pg -e POSTGRES_PASSWORD=teste \
    -e POSTGRES_DB=tapepro -p 55432:5432 postgres:16-alpine
  export DATABASE_URL=postgres://postgres:teste@localhost:55432/tapepro
  ```

## 1. Testes automatizados (fecha o loop de lógica)

```bash
npm test                 # sem DATABASE_URL: unit (parser CSV, papéis) roda; integração pula
DATABASE_URL=... npm test # com banco: import idempotente + escopo por pipeline + papéis
```

Espera-se verde. O teste novo `tests/importar-recuperacao.test.mjs` cobre:
- parser de CSV com aspas/BOM (unit, sempre roda);
- import de amostra idempotente (2ª execução insere 0);
- leitura escopada (inbound × recuperação não vazam).

## 2. Importar a lista (apenas em banco de teste — NÃO em produção nesta feature)

```bash
DATABASE_URL=... node scripts/importar-recuperacao.mjs docs/leads-bruto.csv
# → inseridos: 502 · pulados: 0 · sem-empresa: 1   (ordem de grandeza)
DATABASE_URL=... node scripts/importar-recuperacao.mjs docs/leads-bruto.csv
# → inseridos: 0 · pulados: 502 · sem-empresa: 1    (idempotente)
```

## 3. Fluxo no `/admin` (manual)

```bash
npm run build && DATABASE_URL=... node dist/server/entry.mjs   # ou: npm run dev
```

1. **Seletor de pipeline**: no header, alternar **Inbound ↔ Recuperação**. Em Inbound, a tela é
   idêntica à de hoje (SC-002). Em Recuperação, a lista mostra os leads importados com ramo/cidade.
2. **Escopo**: confirmar que contadores por etapa, funil e carteira mudam com o seletor e que um
   lead nunca aparece na pipeline errada (SC-001).
3. **Etapas próprias**: abrir um lead de recuperação → dropdown de status oferece
   `a_contatar → contatado → interessado → recuperado → descartado`.
4. **Dados da prospecção**: a seção lista todas as 12 colunas; `arquivo`/`confianca` read-only;
   editar o WhatsApp, salvar, reabrir → valor persistiu e o botão "Chamar no WhatsApp" usa o novo
   número (SC-004).
5. **Cadência/carteira**: registrar 1º toque → status vai a `contatado`; registrar 1º pedido →
   status vai a `recuperado` e o lead entra na carteira da pipeline Recuperação.
6. **Inbound intacto**: um lead inbound **não** mostra a seção "Dados da prospecção".

## 4. Privacidade (checagem rápida)

- Nenhuma rota pública/sitemap expõe leads de recuperação (tudo sob `/admin`, `noindex`).
- `docs/leads-bruto.csv` não aparece em `dist/` público após `npm run build`.

## Mapa de aceite → critério

| passo | cobre |
|---|---|
| 1, 6 | SC-002, FR-002, FR-012 |
| 2 | SC-001, FR-003 |
| 3 | FR-004 |
| 4 | SC-004, FR-008..FR-011 |
| 5 | FR-005, FR-007 |
| 2 (script) | SC-005, FR-014..FR-019 |
| 4 (privacidade) | SC-006, FR-023, FR-024 |
