# Proposta de 24/11/2026 (o que a equipe já respondeu, e o pós-venda), NÃO aplicada

Origem: `roilabs/docs/auditoria-conversas/diagnostico-2026-11.md`. O atendente da TapePro vive só na Polaris (agente
`d7eb2acb`, conta da casa). A instrução atual foi lida em 24/11 e está em `instrucao-polaris-20261124.md` (4.226).

## O que muda (`instrucao-proposta-20261124-equipe.md`, 4.987/8.000)

1. **Pós-venda sem abertura de venda.** Quem já comprou (pedido, entrega, atraso, retirada, comprovante, nota) não
   recebe «Envie sua logo…». A IA diz que vai ver, escreve «a equipe confirma isso pra você aqui» (a frase que avisa) e
   pede uma vez o orçamento ou o CNPJ. Origem: 6 de 7 pós-vendas receberam a abertura de venda (caec5060 m28,
   644d4739 m5, 2bd3e0cc m2…).
2. **O que a equipe já respondeu vira o que a IA sabe.** Nota fiscal (b055cf54 m43, m82), 50% de entrada e 50% no fim
   da produção (b055cf54 m77, f5e066b6 m38), boleto à vista e cartão parcelado a partir de 50 rolos (b055cf54 m81, m86),
   CPF quando não há CNPJ (b5648707 m18). **Confirmar as quatro com a TapePro antes de aplicar**: a fonte é a fala da
   equipe na conversa, não um documento.
3. **«ok», «obrigado» e «certo»** recebem uma frase curta, sem repetir o combinado (b055cf54 m21–24, m71–76).

Fica fora: a IA se apresenta como «Jean» e, perguntada, diz que é IA (641930d2 m13). A decisão é do Jean.

## Casos e saídas (rota local, sem enviar)

- `casos-20261124-equipe.jsonl` (8), com o motor de preço em texto (`base-motor-texto.md`, as faixas que o motor
  respondeu nas conversas).
- Antes (`saidas-antes-20261124-equipe-local.jsonl`): 4/8. Falham posvenda-002 (abertura de venda a quem reclama do
  vendedor), pagamento-001 («o Pix é o único meio»), boleto-001 («não temos boleto») e semcnpj-001 (manda o CPF para a
  equipe).
- Depois (`saidas-depois-20261124-equipe-local.jsonl`): 8/8. A abertura de venda segue igual (abertura-001).
- Observação: no depois, pagamento-001 saiu com `**negrito**` de markdown. No WhatsApp aparece com os asteriscos dobrados.

O executor é o da rota local da Sala, sem o filtro de clubes (scratchpad da sessão de 24/11). Para aplicar: PATCH do
agente na Polaris, conferir que ficou igual e rodar os 8 casos pela rota real `/atendente/responder`.
