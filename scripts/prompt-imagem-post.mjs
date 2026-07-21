/**
 * Imprime o prompt em inglês da capa de um post, pronto para colar no Gemini.
 *
 *   node scripts/prompt-imagem-post.mjs <slug>   # um post
 *   node scripts/prompt-imagem-post.mjs          # todos
 *
 * Não chama API nenhuma — o valor aqui é o invólucro de direção de arte, que é
 * fixo de propósito: 30 posts com a mesma luz, paleta e lista de proibições.
 * Quem escreve a cena (o campo `cenaImagem`) é o autor do post.
 * Ver handoff-imagens-blog.md.
 *
 * ponytail: regex no frontmatter em vez de um parser de YAML — `cenaImagem` é
 * sempre uma linha simples. Trocar por gray-matter se o campo virar multilinha.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const DIR_POSTS = "src/content/blog";

/** Direção de arte fixa. NÃO parametrizar — ela ser igual em todo post é o ponto. */
const molde = (cena) => `Editorial product photograph, 3:2 landscape aspect ratio.

SUBJECT: ${cena}

MATERIAL TRUTH: packaging adhesive tape as it really looks — glossy transparent BOPP
film with visible thickness at the cut edge of the roll, or matte brown kraft paper
gummed tape with a fibrous, slightly uneven surface. Corrugated cardboard with an
honest recycled-fibre texture, not clean white board. Show how the tape physically
behaves: tension across a box seam, a slight lift at a flap edge, an unspooled strip
curving under its own weight.

COLOUR: deep navy (#232c7a) and warm orange (#f47c20) are the only saturated accents,
and they must be carried by a real object — a roll, a printed band, a crate — never as
a background wash or gradient. Everything else is kraft brown, off-white and near-black.
Muted and material, not candy-coloured.

LIGHT: a single soft directional daylight source from the side, honest falloff, real
contact shadows. Warehouse or packing-bench ambience. Not studio seamless white, not
rim-lit hero product lighting.

CAMERA: 50mm, eye level or slight top-down, shallow depth of field, focus on the tape.

STRICTLY AVOID: any text, letters, numbers or writing anywhere in the frame, except a
word the SUBJECT explicitly asks to be printed — and that word must be spelled exactly
as written there and appear nowhere else; any logo, brand mark or watermark of any
other company; any human face; an object floating on a radial
spotlight or glowing disc; blue-to-purple gradients; a glossy 3D render or CGI look;
stock-photo staging with a smiling worker holding a clipboard; a centred symmetrical
composition.

The frame must read as a real photograph taken in a real packing area.`;

const lerCena = (slug) => {
  const src = readFileSync(join(DIR_POSTS, `${slug}.mdx`), "utf8");
  const frontmatter = src.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? "";
  return frontmatter.match(/^cenaImagem:\s*["']?(.+?)["']?\s*$/m)?.[1];
};

const slugs = process.argv[2]
  ? [process.argv[2].replace(/\.mdx$/, "")]
  : readdirSync(DIR_POSTS)
      .filter((n) => n.endsWith(".mdx"))
      .map((n) => n.replace(/\.mdx$/, ""));

let faltando = 0;
for (const slug of slugs) {
  const cena = lerCena(slug);
  if (!cena) {
    console.error(`AVISO  ${slug}: sem campo cenaImagem no frontmatter — pulando.`);
    faltando++;
    continue;
  }
  console.log(`\n===== ${slug} =====\n`);
  console.log(molde(cena));
}

if (faltando) process.exitCode = 1;
