/**
 * FR-016: sem nenhum post publicado o feed continua sendo XML válido, com
 * <channel> e zero <item> — nunca um erro.
 *
 * `src/pages/rss.xml.ts` importa `astro:content`, que só existe dentro do
 * build, então o teste exercita a mesma chamada de `@astrojs/rss` que ele faz.
 * É a afirmação "vale por construção" virando verificação.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import rss from "@astrojs/rss";

const feedVazio = () =>
  rss({
    title: "Blog TapePro",
    description: "Como escolher, especificar e personalizar fita adesiva para a sua operação.",
    site: "https://tapepro.roilabs.com.br",
    items: [],
  });

test("feed sem posts responde XML válido com <channel> e sem <item>", async () => {
  const resposta = await feedVazio();
  const xml = await resposta.text();

  assert.match(xml, /<rss version="2.0"/);
  assert.match(xml, /<channel>/);
  assert.match(xml, /<\/channel>/);
  assert.equal(xml.includes("<item>"), false);
});
