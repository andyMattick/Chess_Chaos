/**
 * Writes docs/ART-PROMPTS.md from content/collections.ts, so the prompts
 * always match the skins in the game.   bun scripts/art-prompts.ts
 */
import { writeFileSync } from 'node:fs';
import { COLLECTIONS, SET_SKINS } from '../src/content/collections';
import { BASE_SKINS } from '../src/content/cosmetics';
const SKINS_LINE = BASE_SKINS.map((s) => `\`${s}\``).join(', ');

const STYLE = `Style: bold, rounded, cheerful cartoon characters for a children's chess game. Thick dark outlines (#2d2a3e), flat colours with one soft shade, big friendly eyes, simple shapes that read at small sizes, sticker look. Original characters only: they must not look like any existing cartoon, game or brand character. Nothing scary, no weapons that look real, no text or letters.`;

const LAYOUT = `Layout (exactly): one PNG, 1536 x 1024 pixels, transparent background, a 3 x 2 grid of equal 512 x 512 cells with no lines drawn. Top row, left to right: KING, QUEEN, ROOK. Bottom row, left to right: BISHOP, KNIGHT, PAWN. One full-body character per cell, standing, centred, facing the viewer, feet about 30 pixels above the bottom of its cell, nothing crossing into another cell, no floor and no shadow under the feet.`;

const HATS = `So kids can still read the board, every character wears its chess piece as a hat: KING a crown topped with a small cross (tallest character), QUEEN a pointed crown or tiara, ROOK a castle-turret hat with square battlements, BISHOP a tall mitre with a slit, KNIGHT a horse-head hood, PAWN a small round cap (shortest character). Sizes go king (tallest) > queen > rook > bishop = knight > pawn.`;

const SIDES = {
  light: 'LIGHT army: light, bright colours (cream, white, pastel and sunny tones) that stand out on dark green squares.',
  dark: 'DARK army: the same six characters, same poses, in deep rich colours (navy, plum, charcoal, dark red) with light details, so they stand out on cream squares.',
};

let md = `# Art prompts for collection skins

Made by \`scripts/art-prompts.ts\` from \`src/content/collections.ts\`. ${SET_SKINS.length} new skins, each needing two images (light army and dark army): ${SET_SKINS.length * 2} images.

All 22 skins are already drawn in code (src/ui/setSkins.tsx), light and dark armies, so **no art is needed**. These prompts are only for replacing a drawn skin with richer artwork later: an art sheet, once added, is used instead of the drawing.

## How to add a skin's art

1. Paste the prompt into ChatGPT (image generation). Do the **light** prompt first, then the **dark** prompt in the same chat so the characters match.
2. Check the picture: 3 columns × 2 rows, king-queen-rook on top, bishop-knight-pawn below, transparent background, nothing touching the edges of its cell. If the background isn't transparent, ask: "Same image with a transparent background, PNG."
3. Save the two files as \`public/skins/<slug>-light.png\` and \`public/skins/<slug>-dark.png\` (the slug is given for each skin below).
4. Add the slug to \`public/skins/manifest.json\`, for example \`["royal-court"]\` (that list tells the game which skins have art).
5. Commit and push. Vercel puts it live; the stand-in is replaced by the art.

Check the image tool's terms for selling art made with it before release.

## Improving any skin (originals and new ones)

Every skin has a reference picture in the exact layout the game reads: \`<slug>-light.png\` and \`<slug>-dark.png\`, 1536 x 1024, transparent background, six characters in a 3 x 2 grid (king, queen, rook / bishop, knight, pawn), each in the spot and size the game uses. Upload a reference picture and ask for a nicer version of the same thing.

- **Adobe Firefly:** Text to image → upload the reference under **Composition** (structure) reference, strength high. Aspect ratio Landscape 3:2. Then remove the background in Adobe Express before saving.
- **ChatGPT:** attach the reference picture and paste the prompt.

Prompt (same for every skin; add one line of what you'd like changed, if anything):

\`\`\`
Redraw this character sheet with more polish: same six characters, same layout (3 columns by 2 rows: king, queen, rook on top; bishop, knight, pawn below), each character in the same place and the same size in its square, same hats, same colours. Bold rounded cartoon style for a children's game, thick dark outlines, soft shading, big friendly eyes, a little more detail and personality. Transparent background, no text, no grid lines, no floor or shadows.
\`\`\`

Save the result with the same file name as the reference (for example \`gremlin-light.png\`) and follow the steps above. The originals' slugs: ${SKINS_LINE}.



- ${STYLE}
- ${LAYOUT}
- ${HATS}

`;

for (const s of SET_SKINS) {
  const set = COLLECTIONS.find((c) => c.skin === s.id)!;
  const slug = s.id.slice(4);
  md += `## ${s.name} (${set.rarity}) — slug \`${slug}\`\n\nCharacters: ${s.look}.\n\n`;
  for (const [side, text] of Object.entries(SIDES)) {
    md += `**${side === 'light' ? 'Light' : 'Dark'} army** → save as \`public/skins/${slug}-${side}.png\`\n\n\`\`\`\nCreate a sprite sheet of six chess-piece characters: ${s.look}.\n${text}\n${HATS}\n${LAYOUT}\n${STYLE}\n\`\`\`\n\n`;
  }
}
writeFileSync('docs/ART-PROMPTS.md', md);
console.log(`wrote ${SET_SKINS.length * 2} prompts`);
