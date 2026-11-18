# Art prompts for collection skins

Made by `scripts/art-prompts.ts` from `src/content/collections.ts`. 22 new skins, each needing two images (light army and dark army): 44 images.

All 22 skins are already drawn in code (src/ui/setSkins.tsx), light and dark armies, so **no art is needed**. These prompts are only for replacing a drawn skin with richer artwork later: an art sheet, once added, is used instead of the drawing.

## How to add a skin's art

1. Paste the prompt into ChatGPT (image generation). Do the **light** prompt first, then the **dark** prompt in the same chat so the characters match.
2. Check the picture: 3 columns × 2 rows, king-queen-rook on top, bishop-knight-pawn below, transparent background, nothing touching the edges of its cell. If the background isn't transparent, ask: "Same image with a transparent background, PNG."
3. Save the two files as `public/skins/<slug>-light.png` and `public/skins/<slug>-dark.png` (the slug is given for each skin below).
4. Add the slug to `public/skins/manifest.json`, for example `["royal-court"]` (that list tells the game which skins have art).
5. Commit and push. Vercel puts it live; the stand-in is replaced by the art.

Check the image tool's terms for selling art made with it before release.

## Shared text (already inside every prompt)

- Style: bold, rounded, cheerful cartoon characters for a children's chess game. Thick dark outlines (#2d2a3e), flat colours with one soft shade, big friendly eyes, simple shapes that read at small sizes, sticker look. Original characters only: they must not look like any existing cartoon, game or brand character. Nothing scary, no weapons that look real, no text or letters.
- Layout (exactly): one PNG, 1536 x 1024 pixels, transparent background, a 3 x 2 grid of equal 512 x 512 cells with no lines drawn. Top row, left to right: KING, QUEEN, ROOK. Bottom row, left to right: BISHOP, KNIGHT, PAWN. One full-body character per cell, standing, centred, facing the viewer, feet about 30 pixels above the bottom of its cell, nothing crossing into another cell, no floor and no shadow under the feet.
- So kids can still read the board, every character wears its chess piece as a hat: KING a crown topped with a small cross (tallest character), QUEEN a pointed crown or tiara, ROOK a castle-turret hat with square battlements, BISHOP a tall mitre with a slit, KNIGHT a horse-head hood, PAWN a small round cap (shortest character). Sizes go king (tallest) > queen > rook > bishop = knight > pawn.

## Royal Court (Rare) — slug `royal-court`

Characters: cheerful courtiers in velvet capes and lace collars.

**Light army** → save as `public/skins/royal-court-light.png`

```
Create a sprite sheet of six chess-piece characters: cheerful courtiers in velvet capes and lace collars.
LIGHT army: light, bright colours (cream, white, pastel and sunny tones) that stand out on dark green squares.
So kids can still read the board, every character wears its chess piece as a hat: KING a crown topped with a small cross (tallest character), QUEEN a pointed crown or tiara, ROOK a castle-turret hat with square battlements, BISHOP a tall mitre with a slit, KNIGHT a horse-head hood, PAWN a small round cap (shortest character). Sizes go king (tallest) > queen > rook > bishop = knight > pawn.
Layout (exactly): one PNG, 1536 x 1024 pixels, transparent background, a 3 x 2 grid of equal 512 x 512 cells with no lines drawn. Top row, left to right: KING, QUEEN, ROOK. Bottom row, left to right: BISHOP, KNIGHT, PAWN. One full-body character per cell, standing, centred, facing the viewer, feet about 30 pixels above the bottom of its cell, nothing crossing into another cell, no floor and no shadow under the feet.
Style: bold, rounded, cheerful cartoon characters for a children's chess game. Thick dark outlines (#2d2a3e), flat colours with one soft shade, big friendly eyes, simple shapes that read at small sizes, sticker look. Original characters only: they must not look like any existing cartoon, game or brand character. Nothing scary, no weapons that look real, no text or letters.
```

**Dark army** → save as `public/skins/royal-court-dark.png`

```
Create a sprite sheet of six chess-piece characters: cheerful courtiers in velvet capes and lace collars.
DARK army: the same six characters, same poses, in deep rich colours (navy, plum, charcoal, dark red) with light details, so they stand out on cream squares.
So kids can still read the board, every character wears its chess piece as a hat: KING a crown topped with a small cross (tallest character), QUEEN a pointed crown or tiara, ROOK a castle-turret hat with square battlements, BISHOP a tall mitre with a slit, KNIGHT a horse-head hood, PAWN a small round cap (shortest character). Sizes go king (tallest) > queen > rook > bishop = knight > pawn.
Layout (exactly): one PNG, 1536 x 1024 pixels, transparent background, a 3 x 2 grid of equal 512 x 512 cells with no lines drawn. Top row, left to right: KING, QUEEN, ROOK. Bottom row, left to right: BISHOP, KNIGHT, PAWN. One full-body character per cell, standing, centred, facing the viewer, feet about 30 pixels above the bottom of its cell, nothing crossing into another cell, no floor and no shadow under the feet.
Style: bold, rounded, cheerful cartoon characters for a children's chess game. Thick dark outlines (#2d2a3e), flat colours with one soft shade, big friendly eyes, simple shapes that read at small sizes, sticker look. Original characters only: they must not look like any existing cartoon, game or brand character. Nothing scary, no weapons that look real, no text or letters.
```

## High Council (Rare) — slug `high-council`

Characters: wise owls in long robes with tiny spectacles.

**Light army** → save as `public/skins/high-council-light.png`

```
Create a sprite sheet of six chess-piece characters: wise owls in long robes with tiny spectacles.
LIGHT army: light, bright colours (cream, white, pastel and sunny tones) that stand out on dark green squares.
So kids can still read the board, every character wears its chess piece as a hat: KING a crown topped with a small cross (tallest character), QUEEN a pointed crown or tiara, ROOK a castle-turret hat with square battlements, BISHOP a tall mitre with a slit, KNIGHT a horse-head hood, PAWN a small round cap (shortest character). Sizes go king (tallest) > queen > rook > bishop = knight > pawn.
Layout (exactly): one PNG, 1536 x 1024 pixels, transparent background, a 3 x 2 grid of equal 512 x 512 cells with no lines drawn. Top row, left to right: KING, QUEEN, ROOK. Bottom row, left to right: BISHOP, KNIGHT, PAWN. One full-body character per cell, standing, centred, facing the viewer, feet about 30 pixels above the bottom of its cell, nothing crossing into another cell, no floor and no shadow under the feet.
Style: bold, rounded, cheerful cartoon characters for a children's chess game. Thick dark outlines (#2d2a3e), flat colours with one soft shade, big friendly eyes, simple shapes that read at small sizes, sticker look. Original characters only: they must not look like any existing cartoon, game or brand character. Nothing scary, no weapons that look real, no text or letters.
```

**Dark army** → save as `public/skins/high-council-dark.png`

```
Create a sprite sheet of six chess-piece characters: wise owls in long robes with tiny spectacles.
DARK army: the same six characters, same poses, in deep rich colours (navy, plum, charcoal, dark red) with light details, so they stand out on cream squares.
So kids can still read the board, every character wears its chess piece as a hat: KING a crown topped with a small cross (tallest character), QUEEN a pointed crown or tiara, ROOK a castle-turret hat with square battlements, BISHOP a tall mitre with a slit, KNIGHT a horse-head hood, PAWN a small round cap (shortest character). Sizes go king (tallest) > queen > rook > bishop = knight > pawn.
Layout (exactly): one PNG, 1536 x 1024 pixels, transparent background, a 3 x 2 grid of equal 512 x 512 cells with no lines drawn. Top row, left to right: KING, QUEEN, ROOK. Bottom row, left to right: BISHOP, KNIGHT, PAWN. One full-body character per cell, standing, centred, facing the viewer, feet about 30 pixels above the bottom of its cell, nothing crossing into another cell, no floor and no shadow under the feet.
Style: bold, rounded, cheerful cartoon characters for a children's chess game. Thick dark outlines (#2d2a3e), flat colours with one soft shade, big friendly eyes, simple shapes that read at small sizes, sticker look. Original characters only: they must not look like any existing cartoon, game or brand character. Nothing scary, no weapons that look real, no text or letters.
```

## War Council (Rare) — slug `war-council`

Characters: wind-up toy soldiers with painted cheeks and drums.

**Light army** → save as `public/skins/war-council-light.png`

```
Create a sprite sheet of six chess-piece characters: wind-up toy soldiers with painted cheeks and drums.
LIGHT army: light, bright colours (cream, white, pastel and sunny tones) that stand out on dark green squares.
So kids can still read the board, every character wears its chess piece as a hat: KING a crown topped with a small cross (tallest character), QUEEN a pointed crown or tiara, ROOK a castle-turret hat with square battlements, BISHOP a tall mitre with a slit, KNIGHT a horse-head hood, PAWN a small round cap (shortest character). Sizes go king (tallest) > queen > rook > bishop = knight > pawn.
Layout (exactly): one PNG, 1536 x 1024 pixels, transparent background, a 3 x 2 grid of equal 512 x 512 cells with no lines drawn. Top row, left to right: KING, QUEEN, ROOK. Bottom row, left to right: BISHOP, KNIGHT, PAWN. One full-body character per cell, standing, centred, facing the viewer, feet about 30 pixels above the bottom of its cell, nothing crossing into another cell, no floor and no shadow under the feet.
Style: bold, rounded, cheerful cartoon characters for a children's chess game. Thick dark outlines (#2d2a3e), flat colours with one soft shade, big friendly eyes, simple shapes that read at small sizes, sticker look. Original characters only: they must not look like any existing cartoon, game or brand character. Nothing scary, no weapons that look real, no text or letters.
```

**Dark army** → save as `public/skins/war-council-dark.png`

```
Create a sprite sheet of six chess-piece characters: wind-up toy soldiers with painted cheeks and drums.
DARK army: the same six characters, same poses, in deep rich colours (navy, plum, charcoal, dark red) with light details, so they stand out on cream squares.
So kids can still read the board, every character wears its chess piece as a hat: KING a crown topped with a small cross (tallest character), QUEEN a pointed crown or tiara, ROOK a castle-turret hat with square battlements, BISHOP a tall mitre with a slit, KNIGHT a horse-head hood, PAWN a small round cap (shortest character). Sizes go king (tallest) > queen > rook > bishop = knight > pawn.
Layout (exactly): one PNG, 1536 x 1024 pixels, transparent background, a 3 x 2 grid of equal 512 x 512 cells with no lines drawn. Top row, left to right: KING, QUEEN, ROOK. Bottom row, left to right: BISHOP, KNIGHT, PAWN. One full-body character per cell, standing, centred, facing the viewer, feet about 30 pixels above the bottom of its cell, nothing crossing into another cell, no floor and no shadow under the feet.
Style: bold, rounded, cheerful cartoon characters for a children's chess game. Thick dark outlines (#2d2a3e), flat colours with one soft shade, big friendly eyes, simple shapes that read at small sizes, sticker look. Original characters only: they must not look like any existing cartoon, game or brand character. Nothing scary, no weapons that look real, no text or letters.
```

## Kingdom Builders (Rare) — slug `kingdom-builders`

Characters: busy beavers in hard hats with little tools.

**Light army** → save as `public/skins/kingdom-builders-light.png`

```
Create a sprite sheet of six chess-piece characters: busy beavers in hard hats with little tools.
LIGHT army: light, bright colours (cream, white, pastel and sunny tones) that stand out on dark green squares.
So kids can still read the board, every character wears its chess piece as a hat: KING a crown topped with a small cross (tallest character), QUEEN a pointed crown or tiara, ROOK a castle-turret hat with square battlements, BISHOP a tall mitre with a slit, KNIGHT a horse-head hood, PAWN a small round cap (shortest character). Sizes go king (tallest) > queen > rook > bishop = knight > pawn.
Layout (exactly): one PNG, 1536 x 1024 pixels, transparent background, a 3 x 2 grid of equal 512 x 512 cells with no lines drawn. Top row, left to right: KING, QUEEN, ROOK. Bottom row, left to right: BISHOP, KNIGHT, PAWN. One full-body character per cell, standing, centred, facing the viewer, feet about 30 pixels above the bottom of its cell, nothing crossing into another cell, no floor and no shadow under the feet.
Style: bold, rounded, cheerful cartoon characters for a children's chess game. Thick dark outlines (#2d2a3e), flat colours with one soft shade, big friendly eyes, simple shapes that read at small sizes, sticker look. Original characters only: they must not look like any existing cartoon, game or brand character. Nothing scary, no weapons that look real, no text or letters.
```

**Dark army** → save as `public/skins/kingdom-builders-dark.png`

```
Create a sprite sheet of six chess-piece characters: busy beavers in hard hats with little tools.
DARK army: the same six characters, same poses, in deep rich colours (navy, plum, charcoal, dark red) with light details, so they stand out on cream squares.
So kids can still read the board, every character wears its chess piece as a hat: KING a crown topped with a small cross (tallest character), QUEEN a pointed crown or tiara, ROOK a castle-turret hat with square battlements, BISHOP a tall mitre with a slit, KNIGHT a horse-head hood, PAWN a small round cap (shortest character). Sizes go king (tallest) > queen > rook > bishop = knight > pawn.
Layout (exactly): one PNG, 1536 x 1024 pixels, transparent background, a 3 x 2 grid of equal 512 x 512 cells with no lines drawn. Top row, left to right: KING, QUEEN, ROOK. Bottom row, left to right: BISHOP, KNIGHT, PAWN. One full-body character per cell, standing, centred, facing the viewer, feet about 30 pixels above the bottom of its cell, nothing crossing into another cell, no floor and no shadow under the feet.
Style: bold, rounded, cheerful cartoon characters for a children's chess game. Thick dark outlines (#2d2a3e), flat colours with one soft shade, big friendly eyes, simple shapes that read at small sizes, sticker look. Original characters only: they must not look like any existing cartoon, game or brand character. Nothing scary, no weapons that look real, no text or letters.
```

## Back Row Heroes (Rare) — slug `back-row-heroes`

Characters: kid superheroes in capes and masks.

**Light army** → save as `public/skins/back-row-heroes-light.png`

```
Create a sprite sheet of six chess-piece characters: kid superheroes in capes and masks.
LIGHT army: light, bright colours (cream, white, pastel and sunny tones) that stand out on dark green squares.
So kids can still read the board, every character wears its chess piece as a hat: KING a crown topped with a small cross (tallest character), QUEEN a pointed crown or tiara, ROOK a castle-turret hat with square battlements, BISHOP a tall mitre with a slit, KNIGHT a horse-head hood, PAWN a small round cap (shortest character). Sizes go king (tallest) > queen > rook > bishop = knight > pawn.
Layout (exactly): one PNG, 1536 x 1024 pixels, transparent background, a 3 x 2 grid of equal 512 x 512 cells with no lines drawn. Top row, left to right: KING, QUEEN, ROOK. Bottom row, left to right: BISHOP, KNIGHT, PAWN. One full-body character per cell, standing, centred, facing the viewer, feet about 30 pixels above the bottom of its cell, nothing crossing into another cell, no floor and no shadow under the feet.
Style: bold, rounded, cheerful cartoon characters for a children's chess game. Thick dark outlines (#2d2a3e), flat colours with one soft shade, big friendly eyes, simple shapes that read at small sizes, sticker look. Original characters only: they must not look like any existing cartoon, game or brand character. Nothing scary, no weapons that look real, no text or letters.
```

**Dark army** → save as `public/skins/back-row-heroes-dark.png`

```
Create a sprite sheet of six chess-piece characters: kid superheroes in capes and masks.
DARK army: the same six characters, same poses, in deep rich colours (navy, plum, charcoal, dark red) with light details, so they stand out on cream squares.
So kids can still read the board, every character wears its chess piece as a hat: KING a crown topped with a small cross (tallest character), QUEEN a pointed crown or tiara, ROOK a castle-turret hat with square battlements, BISHOP a tall mitre with a slit, KNIGHT a horse-head hood, PAWN a small round cap (shortest character). Sizes go king (tallest) > queen > rook > bishop = knight > pawn.
Layout (exactly): one PNG, 1536 x 1024 pixels, transparent background, a 3 x 2 grid of equal 512 x 512 cells with no lines drawn. Top row, left to right: KING, QUEEN, ROOK. Bottom row, left to right: BISHOP, KNIGHT, PAWN. One full-body character per cell, standing, centred, facing the viewer, feet about 30 pixels above the bottom of its cell, nothing crossing into another cell, no floor and no shadow under the feet.
Style: bold, rounded, cheerful cartoon characters for a children's chess game. Thick dark outlines (#2d2a3e), flat colours with one soft shade, big friendly eyes, simple shapes that read at small sizes, sticker look. Original characters only: they must not look like any existing cartoon, game or brand character. Nothing scary, no weapons that look real, no text or letters.
```

## Pawn's Promise (Rare) — slug `pawns-promise`

Characters: sprouting plant people, seedlings to tall trees.

**Light army** → save as `public/skins/pawns-promise-light.png`

```
Create a sprite sheet of six chess-piece characters: sprouting plant people, seedlings to tall trees.
LIGHT army: light, bright colours (cream, white, pastel and sunny tones) that stand out on dark green squares.
So kids can still read the board, every character wears its chess piece as a hat: KING a crown topped with a small cross (tallest character), QUEEN a pointed crown or tiara, ROOK a castle-turret hat with square battlements, BISHOP a tall mitre with a slit, KNIGHT a horse-head hood, PAWN a small round cap (shortest character). Sizes go king (tallest) > queen > rook > bishop = knight > pawn.
Layout (exactly): one PNG, 1536 x 1024 pixels, transparent background, a 3 x 2 grid of equal 512 x 512 cells with no lines drawn. Top row, left to right: KING, QUEEN, ROOK. Bottom row, left to right: BISHOP, KNIGHT, PAWN. One full-body character per cell, standing, centred, facing the viewer, feet about 30 pixels above the bottom of its cell, nothing crossing into another cell, no floor and no shadow under the feet.
Style: bold, rounded, cheerful cartoon characters for a children's chess game. Thick dark outlines (#2d2a3e), flat colours with one soft shade, big friendly eyes, simple shapes that read at small sizes, sticker look. Original characters only: they must not look like any existing cartoon, game or brand character. Nothing scary, no weapons that look real, no text or letters.
```

**Dark army** → save as `public/skins/pawns-promise-dark.png`

```
Create a sprite sheet of six chess-piece characters: sprouting plant people, seedlings to tall trees.
DARK army: the same six characters, same poses, in deep rich colours (navy, plum, charcoal, dark red) with light details, so they stand out on cream squares.
So kids can still read the board, every character wears its chess piece as a hat: KING a crown topped with a small cross (tallest character), QUEEN a pointed crown or tiara, ROOK a castle-turret hat with square battlements, BISHOP a tall mitre with a slit, KNIGHT a horse-head hood, PAWN a small round cap (shortest character). Sizes go king (tallest) > queen > rook > bishop = knight > pawn.
Layout (exactly): one PNG, 1536 x 1024 pixels, transparent background, a 3 x 2 grid of equal 512 x 512 cells with no lines drawn. Top row, left to right: KING, QUEEN, ROOK. Bottom row, left to right: BISHOP, KNIGHT, PAWN. One full-body character per cell, standing, centred, facing the viewer, feet about 30 pixels above the bottom of its cell, nothing crossing into another cell, no floor and no shadow under the feet.
Style: bold, rounded, cheerful cartoon characters for a children's chess game. Thick dark outlines (#2d2a3e), flat colours with one soft shade, big friendly eyes, simple shapes that read at small sizes, sticker look. Original characters only: they must not look like any existing cartoon, game or brand character. Nothing scary, no weapons that look real, no text or letters.
```

## Knight's Tale (Rare) — slug `knights-tale`

Characters: storybook paper cut-out characters.

**Light army** → save as `public/skins/knights-tale-light.png`

```
Create a sprite sheet of six chess-piece characters: storybook paper cut-out characters.
LIGHT army: light, bright colours (cream, white, pastel and sunny tones) that stand out on dark green squares.
So kids can still read the board, every character wears its chess piece as a hat: KING a crown topped with a small cross (tallest character), QUEEN a pointed crown or tiara, ROOK a castle-turret hat with square battlements, BISHOP a tall mitre with a slit, KNIGHT a horse-head hood, PAWN a small round cap (shortest character). Sizes go king (tallest) > queen > rook > bishop = knight > pawn.
Layout (exactly): one PNG, 1536 x 1024 pixels, transparent background, a 3 x 2 grid of equal 512 x 512 cells with no lines drawn. Top row, left to right: KING, QUEEN, ROOK. Bottom row, left to right: BISHOP, KNIGHT, PAWN. One full-body character per cell, standing, centred, facing the viewer, feet about 30 pixels above the bottom of its cell, nothing crossing into another cell, no floor and no shadow under the feet.
Style: bold, rounded, cheerful cartoon characters for a children's chess game. Thick dark outlines (#2d2a3e), flat colours with one soft shade, big friendly eyes, simple shapes that read at small sizes, sticker look. Original characters only: they must not look like any existing cartoon, game or brand character. Nothing scary, no weapons that look real, no text or letters.
```

**Dark army** → save as `public/skins/knights-tale-dark.png`

```
Create a sprite sheet of six chess-piece characters: storybook paper cut-out characters.
DARK army: the same six characters, same poses, in deep rich colours (navy, plum, charcoal, dark red) with light details, so they stand out on cream squares.
So kids can still read the board, every character wears its chess piece as a hat: KING a crown topped with a small cross (tallest character), QUEEN a pointed crown or tiara, ROOK a castle-turret hat with square battlements, BISHOP a tall mitre with a slit, KNIGHT a horse-head hood, PAWN a small round cap (shortest character). Sizes go king (tallest) > queen > rook > bishop = knight > pawn.
Layout (exactly): one PNG, 1536 x 1024 pixels, transparent background, a 3 x 2 grid of equal 512 x 512 cells with no lines drawn. Top row, left to right: KING, QUEEN, ROOK. Bottom row, left to right: BISHOP, KNIGHT, PAWN. One full-body character per cell, standing, centred, facing the viewer, feet about 30 pixels above the bottom of its cell, nothing crossing into another cell, no floor and no shadow under the feet.
Style: bold, rounded, cheerful cartoon characters for a children's chess game. Thick dark outlines (#2d2a3e), flat colours with one soft shade, big friendly eyes, simple shapes that read at small sizes, sticker look. Original characters only: they must not look like any existing cartoon, game or brand character. Nothing scary, no weapons that look real, no text or letters.
```

## Small but Mighty (Rare) — slug `small-but-mighty`

Characters: brave mice in acorn-cap helmets.

**Light army** → save as `public/skins/small-but-mighty-light.png`

```
Create a sprite sheet of six chess-piece characters: brave mice in acorn-cap helmets.
LIGHT army: light, bright colours (cream, white, pastel and sunny tones) that stand out on dark green squares.
So kids can still read the board, every character wears its chess piece as a hat: KING a crown topped with a small cross (tallest character), QUEEN a pointed crown or tiara, ROOK a castle-turret hat with square battlements, BISHOP a tall mitre with a slit, KNIGHT a horse-head hood, PAWN a small round cap (shortest character). Sizes go king (tallest) > queen > rook > bishop = knight > pawn.
Layout (exactly): one PNG, 1536 x 1024 pixels, transparent background, a 3 x 2 grid of equal 512 x 512 cells with no lines drawn. Top row, left to right: KING, QUEEN, ROOK. Bottom row, left to right: BISHOP, KNIGHT, PAWN. One full-body character per cell, standing, centred, facing the viewer, feet about 30 pixels above the bottom of its cell, nothing crossing into another cell, no floor and no shadow under the feet.
Style: bold, rounded, cheerful cartoon characters for a children's chess game. Thick dark outlines (#2d2a3e), flat colours with one soft shade, big friendly eyes, simple shapes that read at small sizes, sticker look. Original characters only: they must not look like any existing cartoon, game or brand character. Nothing scary, no weapons that look real, no text or letters.
```

**Dark army** → save as `public/skins/small-but-mighty-dark.png`

```
Create a sprite sheet of six chess-piece characters: brave mice in acorn-cap helmets.
DARK army: the same six characters, same poses, in deep rich colours (navy, plum, charcoal, dark red) with light details, so they stand out on cream squares.
So kids can still read the board, every character wears its chess piece as a hat: KING a crown topped with a small cross (tallest character), QUEEN a pointed crown or tiara, ROOK a castle-turret hat with square battlements, BISHOP a tall mitre with a slit, KNIGHT a horse-head hood, PAWN a small round cap (shortest character). Sizes go king (tallest) > queen > rook > bishop = knight > pawn.
Layout (exactly): one PNG, 1536 x 1024 pixels, transparent background, a 3 x 2 grid of equal 512 x 512 cells with no lines drawn. Top row, left to right: KING, QUEEN, ROOK. Bottom row, left to right: BISHOP, KNIGHT, PAWN. One full-body character per cell, standing, centred, facing the viewer, feet about 30 pixels above the bottom of its cell, nothing crossing into another cell, no floor and no shadow under the feet.
Style: bold, rounded, cheerful cartoon characters for a children's chess game. Thick dark outlines (#2d2a3e), flat colours with one soft shade, big friendly eyes, simple shapes that read at small sizes, sticker look. Original characters only: they must not look like any existing cartoon, game or brand character. Nothing scary, no weapons that look real, no text or letters.
```

## Tactics Squad (Rare) — slug `tactics-squad`

Characters: ninja frogs with headbands.

**Light army** → save as `public/skins/tactics-squad-light.png`

```
Create a sprite sheet of six chess-piece characters: ninja frogs with headbands.
LIGHT army: light, bright colours (cream, white, pastel and sunny tones) that stand out on dark green squares.
So kids can still read the board, every character wears its chess piece as a hat: KING a crown topped with a small cross (tallest character), QUEEN a pointed crown or tiara, ROOK a castle-turret hat with square battlements, BISHOP a tall mitre with a slit, KNIGHT a horse-head hood, PAWN a small round cap (shortest character). Sizes go king (tallest) > queen > rook > bishop = knight > pawn.
Layout (exactly): one PNG, 1536 x 1024 pixels, transparent background, a 3 x 2 grid of equal 512 x 512 cells with no lines drawn. Top row, left to right: KING, QUEEN, ROOK. Bottom row, left to right: BISHOP, KNIGHT, PAWN. One full-body character per cell, standing, centred, facing the viewer, feet about 30 pixels above the bottom of its cell, nothing crossing into another cell, no floor and no shadow under the feet.
Style: bold, rounded, cheerful cartoon characters for a children's chess game. Thick dark outlines (#2d2a3e), flat colours with one soft shade, big friendly eyes, simple shapes that read at small sizes, sticker look. Original characters only: they must not look like any existing cartoon, game or brand character. Nothing scary, no weapons that look real, no text or letters.
```

**Dark army** → save as `public/skins/tactics-squad-dark.png`

```
Create a sprite sheet of six chess-piece characters: ninja frogs with headbands.
DARK army: the same six characters, same poses, in deep rich colours (navy, plum, charcoal, dark red) with light details, so they stand out on cream squares.
So kids can still read the board, every character wears its chess piece as a hat: KING a crown topped with a small cross (tallest character), QUEEN a pointed crown or tiara, ROOK a castle-turret hat with square battlements, BISHOP a tall mitre with a slit, KNIGHT a horse-head hood, PAWN a small round cap (shortest character). Sizes go king (tallest) > queen > rook > bishop = knight > pawn.
Layout (exactly): one PNG, 1536 x 1024 pixels, transparent background, a 3 x 2 grid of equal 512 x 512 cells with no lines drawn. Top row, left to right: KING, QUEEN, ROOK. Bottom row, left to right: BISHOP, KNIGHT, PAWN. One full-body character per cell, standing, centred, facing the viewer, feet about 30 pixels above the bottom of its cell, nothing crossing into another cell, no floor and no shadow under the feet.
Style: bold, rounded, cheerful cartoon characters for a children's chess game. Thick dark outlines (#2d2a3e), flat colours with one soft shade, big friendly eyes, simple shapes that read at small sizes, sticker look. Original characters only: they must not look like any existing cartoon, game or brand character. Nothing scary, no weapons that look real, no text or letters.
```

## Iron Fortress (Rare) — slug `iron-fortress`

Characters: friendly stone golems with mossy shoulders.

**Light army** → save as `public/skins/iron-fortress-light.png`

```
Create a sprite sheet of six chess-piece characters: friendly stone golems with mossy shoulders.
LIGHT army: light, bright colours (cream, white, pastel and sunny tones) that stand out on dark green squares.
So kids can still read the board, every character wears its chess piece as a hat: KING a crown topped with a small cross (tallest character), QUEEN a pointed crown or tiara, ROOK a castle-turret hat with square battlements, BISHOP a tall mitre with a slit, KNIGHT a horse-head hood, PAWN a small round cap (shortest character). Sizes go king (tallest) > queen > rook > bishop = knight > pawn.
Layout (exactly): one PNG, 1536 x 1024 pixels, transparent background, a 3 x 2 grid of equal 512 x 512 cells with no lines drawn. Top row, left to right: KING, QUEEN, ROOK. Bottom row, left to right: BISHOP, KNIGHT, PAWN. One full-body character per cell, standing, centred, facing the viewer, feet about 30 pixels above the bottom of its cell, nothing crossing into another cell, no floor and no shadow under the feet.
Style: bold, rounded, cheerful cartoon characters for a children's chess game. Thick dark outlines (#2d2a3e), flat colours with one soft shade, big friendly eyes, simple shapes that read at small sizes, sticker look. Original characters only: they must not look like any existing cartoon, game or brand character. Nothing scary, no weapons that look real, no text or letters.
```

**Dark army** → save as `public/skins/iron-fortress-dark.png`

```
Create a sprite sheet of six chess-piece characters: friendly stone golems with mossy shoulders.
DARK army: the same six characters, same poses, in deep rich colours (navy, plum, charcoal, dark red) with light details, so they stand out on cream squares.
So kids can still read the board, every character wears its chess piece as a hat: KING a crown topped with a small cross (tallest character), QUEEN a pointed crown or tiara, ROOK a castle-turret hat with square battlements, BISHOP a tall mitre with a slit, KNIGHT a horse-head hood, PAWN a small round cap (shortest character). Sizes go king (tallest) > queen > rook > bishop = knight > pawn.
Layout (exactly): one PNG, 1536 x 1024 pixels, transparent background, a 3 x 2 grid of equal 512 x 512 cells with no lines drawn. Top row, left to right: KING, QUEEN, ROOK. Bottom row, left to right: BISHOP, KNIGHT, PAWN. One full-body character per cell, standing, centred, facing the viewer, feet about 30 pixels above the bottom of its cell, nothing crossing into another cell, no floor and no shadow under the feet.
Style: bold, rounded, cheerful cartoon characters for a children's chess game. Thick dark outlines (#2d2a3e), flat colours with one soft shade, big friendly eyes, simple shapes that read at small sizes, sticker look. Original characters only: they must not look like any existing cartoon, game or brand character. Nothing scary, no weapons that look real, no text or letters.
```

## Old Castle (Rare) — slug `old-castle`

Characters: cute bats carrying glowing lanterns.

**Light army** → save as `public/skins/old-castle-light.png`

```
Create a sprite sheet of six chess-piece characters: cute bats carrying glowing lanterns.
LIGHT army: light, bright colours (cream, white, pastel and sunny tones) that stand out on dark green squares.
So kids can still read the board, every character wears its chess piece as a hat: KING a crown topped with a small cross (tallest character), QUEEN a pointed crown or tiara, ROOK a castle-turret hat with square battlements, BISHOP a tall mitre with a slit, KNIGHT a horse-head hood, PAWN a small round cap (shortest character). Sizes go king (tallest) > queen > rook > bishop = knight > pawn.
Layout (exactly): one PNG, 1536 x 1024 pixels, transparent background, a 3 x 2 grid of equal 512 x 512 cells with no lines drawn. Top row, left to right: KING, QUEEN, ROOK. Bottom row, left to right: BISHOP, KNIGHT, PAWN. One full-body character per cell, standing, centred, facing the viewer, feet about 30 pixels above the bottom of its cell, nothing crossing into another cell, no floor and no shadow under the feet.
Style: bold, rounded, cheerful cartoon characters for a children's chess game. Thick dark outlines (#2d2a3e), flat colours with one soft shade, big friendly eyes, simple shapes that read at small sizes, sticker look. Original characters only: they must not look like any existing cartoon, game or brand character. Nothing scary, no weapons that look real, no text or letters.
```

**Dark army** → save as `public/skins/old-castle-dark.png`

```
Create a sprite sheet of six chess-piece characters: cute bats carrying glowing lanterns.
DARK army: the same six characters, same poses, in deep rich colours (navy, plum, charcoal, dark red) with light details, so they stand out on cream squares.
So kids can still read the board, every character wears its chess piece as a hat: KING a crown topped with a small cross (tallest character), QUEEN a pointed crown or tiara, ROOK a castle-turret hat with square battlements, BISHOP a tall mitre with a slit, KNIGHT a horse-head hood, PAWN a small round cap (shortest character). Sizes go king (tallest) > queen > rook > bishop = knight > pawn.
Layout (exactly): one PNG, 1536 x 1024 pixels, transparent background, a 3 x 2 grid of equal 512 x 512 cells with no lines drawn. Top row, left to right: KING, QUEEN, ROOK. Bottom row, left to right: BISHOP, KNIGHT, PAWN. One full-body character per cell, standing, centred, facing the viewer, feet about 30 pixels above the bottom of its cell, nothing crossing into another cell, no floor and no shadow under the feet.
Style: bold, rounded, cheerful cartoon characters for a children's chess game. Thick dark outlines (#2d2a3e), flat colours with one soft shade, big friendly eyes, simple shapes that read at small sizes, sticker look. Original characters only: they must not look like any existing cartoon, game or brand character. Nothing scary, no weapons that look real, no text or letters.
```

## Long-Range Battery (Rare) — slug `long-range-battery`

Characters: little astronauts and rocket ships.

**Light army** → save as `public/skins/long-range-battery-light.png`

```
Create a sprite sheet of six chess-piece characters: little astronauts and rocket ships.
LIGHT army: light, bright colours (cream, white, pastel and sunny tones) that stand out on dark green squares.
So kids can still read the board, every character wears its chess piece as a hat: KING a crown topped with a small cross (tallest character), QUEEN a pointed crown or tiara, ROOK a castle-turret hat with square battlements, BISHOP a tall mitre with a slit, KNIGHT a horse-head hood, PAWN a small round cap (shortest character). Sizes go king (tallest) > queen > rook > bishop = knight > pawn.
Layout (exactly): one PNG, 1536 x 1024 pixels, transparent background, a 3 x 2 grid of equal 512 x 512 cells with no lines drawn. Top row, left to right: KING, QUEEN, ROOK. Bottom row, left to right: BISHOP, KNIGHT, PAWN. One full-body character per cell, standing, centred, facing the viewer, feet about 30 pixels above the bottom of its cell, nothing crossing into another cell, no floor and no shadow under the feet.
Style: bold, rounded, cheerful cartoon characters for a children's chess game. Thick dark outlines (#2d2a3e), flat colours with one soft shade, big friendly eyes, simple shapes that read at small sizes, sticker look. Original characters only: they must not look like any existing cartoon, game or brand character. Nothing scary, no weapons that look real, no text or letters.
```

**Dark army** → save as `public/skins/long-range-battery-dark.png`

```
Create a sprite sheet of six chess-piece characters: little astronauts and rocket ships.
DARK army: the same six characters, same poses, in deep rich colours (navy, plum, charcoal, dark red) with light details, so they stand out on cream squares.
So kids can still read the board, every character wears its chess piece as a hat: KING a crown topped with a small cross (tallest character), QUEEN a pointed crown or tiara, ROOK a castle-turret hat with square battlements, BISHOP a tall mitre with a slit, KNIGHT a horse-head hood, PAWN a small round cap (shortest character). Sizes go king (tallest) > queen > rook > bishop = knight > pawn.
Layout (exactly): one PNG, 1536 x 1024 pixels, transparent background, a 3 x 2 grid of equal 512 x 512 cells with no lines drawn. Top row, left to right: KING, QUEEN, ROOK. Bottom row, left to right: BISHOP, KNIGHT, PAWN. One full-body character per cell, standing, centred, facing the viewer, feet about 30 pixels above the bottom of its cell, nothing crossing into another cell, no floor and no shadow under the feet.
Style: bold, rounded, cheerful cartoon characters for a children's chess game. Thick dark outlines (#2d2a3e), flat colours with one soft shade, big friendly eyes, simple shapes that read at small sizes, sticker look. Original characters only: they must not look like any existing cartoon, game or brand character. Nothing scary, no weapons that look real, no text or letters.
```

## Castle Defenders (Rare) — slug `castle-defenders`

Characters: hedgehogs with round shields.

**Light army** → save as `public/skins/castle-defenders-light.png`

```
Create a sprite sheet of six chess-piece characters: hedgehogs with round shields.
LIGHT army: light, bright colours (cream, white, pastel and sunny tones) that stand out on dark green squares.
So kids can still read the board, every character wears its chess piece as a hat: KING a crown topped with a small cross (tallest character), QUEEN a pointed crown or tiara, ROOK a castle-turret hat with square battlements, BISHOP a tall mitre with a slit, KNIGHT a horse-head hood, PAWN a small round cap (shortest character). Sizes go king (tallest) > queen > rook > bishop = knight > pawn.
Layout (exactly): one PNG, 1536 x 1024 pixels, transparent background, a 3 x 2 grid of equal 512 x 512 cells with no lines drawn. Top row, left to right: KING, QUEEN, ROOK. Bottom row, left to right: BISHOP, KNIGHT, PAWN. One full-body character per cell, standing, centred, facing the viewer, feet about 30 pixels above the bottom of its cell, nothing crossing into another cell, no floor and no shadow under the feet.
Style: bold, rounded, cheerful cartoon characters for a children's chess game. Thick dark outlines (#2d2a3e), flat colours with one soft shade, big friendly eyes, simple shapes that read at small sizes, sticker look. Original characters only: they must not look like any existing cartoon, game or brand character. Nothing scary, no weapons that look real, no text or letters.
```

**Dark army** → save as `public/skins/castle-defenders-dark.png`

```
Create a sprite sheet of six chess-piece characters: hedgehogs with round shields.
DARK army: the same six characters, same poses, in deep rich colours (navy, plum, charcoal, dark red) with light details, so they stand out on cream squares.
So kids can still read the board, every character wears its chess piece as a hat: KING a crown topped with a small cross (tallest character), QUEEN a pointed crown or tiara, ROOK a castle-turret hat with square battlements, BISHOP a tall mitre with a slit, KNIGHT a horse-head hood, PAWN a small round cap (shortest character). Sizes go king (tallest) > queen > rook > bishop = knight > pawn.
Layout (exactly): one PNG, 1536 x 1024 pixels, transparent background, a 3 x 2 grid of equal 512 x 512 cells with no lines drawn. Top row, left to right: KING, QUEEN, ROOK. Bottom row, left to right: BISHOP, KNIGHT, PAWN. One full-body character per cell, standing, centred, facing the viewer, feet about 30 pixels above the bottom of its cell, nothing crossing into another cell, no floor and no shadow under the feet.
Style: bold, rounded, cheerful cartoon characters for a children's chess game. Thick dark outlines (#2d2a3e), flat colours with one soft shade, big friendly eyes, simple shapes that read at small sizes, sticker look. Original characters only: they must not look like any existing cartoon, game or brand character. Nothing scary, no weapons that look real, no text or letters.
```

## Storm Troop (Rare) — slug `storm-troop`

Characters: puffy storm clouds with lightning hair.

**Light army** → save as `public/skins/storm-troop-light.png`

```
Create a sprite sheet of six chess-piece characters: puffy storm clouds with lightning hair.
LIGHT army: light, bright colours (cream, white, pastel and sunny tones) that stand out on dark green squares.
So kids can still read the board, every character wears its chess piece as a hat: KING a crown topped with a small cross (tallest character), QUEEN a pointed crown or tiara, ROOK a castle-turret hat with square battlements, BISHOP a tall mitre with a slit, KNIGHT a horse-head hood, PAWN a small round cap (shortest character). Sizes go king (tallest) > queen > rook > bishop = knight > pawn.
Layout (exactly): one PNG, 1536 x 1024 pixels, transparent background, a 3 x 2 grid of equal 512 x 512 cells with no lines drawn. Top row, left to right: KING, QUEEN, ROOK. Bottom row, left to right: BISHOP, KNIGHT, PAWN. One full-body character per cell, standing, centred, facing the viewer, feet about 30 pixels above the bottom of its cell, nothing crossing into another cell, no floor and no shadow under the feet.
Style: bold, rounded, cheerful cartoon characters for a children's chess game. Thick dark outlines (#2d2a3e), flat colours with one soft shade, big friendly eyes, simple shapes that read at small sizes, sticker look. Original characters only: they must not look like any existing cartoon, game or brand character. Nothing scary, no weapons that look real, no text or letters.
```

**Dark army** → save as `public/skins/storm-troop-dark.png`

```
Create a sprite sheet of six chess-piece characters: puffy storm clouds with lightning hair.
DARK army: the same six characters, same poses, in deep rich colours (navy, plum, charcoal, dark red) with light details, so they stand out on cream squares.
So kids can still read the board, every character wears its chess piece as a hat: KING a crown topped with a small cross (tallest character), QUEEN a pointed crown or tiara, ROOK a castle-turret hat with square battlements, BISHOP a tall mitre with a slit, KNIGHT a horse-head hood, PAWN a small round cap (shortest character). Sizes go king (tallest) > queen > rook > bishop = knight > pawn.
Layout (exactly): one PNG, 1536 x 1024 pixels, transparent background, a 3 x 2 grid of equal 512 x 512 cells with no lines drawn. Top row, left to right: KING, QUEEN, ROOK. Bottom row, left to right: BISHOP, KNIGHT, PAWN. One full-body character per cell, standing, centred, facing the viewer, feet about 30 pixels above the bottom of its cell, nothing crossing into another cell, no floor and no shadow under the feet.
Style: bold, rounded, cheerful cartoon characters for a children's chess game. Thick dark outlines (#2d2a3e), flat colours with one soft shade, big friendly eyes, simple shapes that read at small sizes, sticker look. Original characters only: they must not look like any existing cartoon, game or brand character. Nothing scary, no weapons that look real, no text or letters.
```

## Army Without a Crown (Rare) — slug `army-without-a-crown`

Characters: friendly cartoon pirates with eye patches.

**Light army** → save as `public/skins/army-without-a-crown-light.png`

```
Create a sprite sheet of six chess-piece characters: friendly cartoon pirates with eye patches.
LIGHT army: light, bright colours (cream, white, pastel and sunny tones) that stand out on dark green squares.
So kids can still read the board, every character wears its chess piece as a hat: KING a crown topped with a small cross (tallest character), QUEEN a pointed crown or tiara, ROOK a castle-turret hat with square battlements, BISHOP a tall mitre with a slit, KNIGHT a horse-head hood, PAWN a small round cap (shortest character). Sizes go king (tallest) > queen > rook > bishop = knight > pawn.
Layout (exactly): one PNG, 1536 x 1024 pixels, transparent background, a 3 x 2 grid of equal 512 x 512 cells with no lines drawn. Top row, left to right: KING, QUEEN, ROOK. Bottom row, left to right: BISHOP, KNIGHT, PAWN. One full-body character per cell, standing, centred, facing the viewer, feet about 30 pixels above the bottom of its cell, nothing crossing into another cell, no floor and no shadow under the feet.
Style: bold, rounded, cheerful cartoon characters for a children's chess game. Thick dark outlines (#2d2a3e), flat colours with one soft shade, big friendly eyes, simple shapes that read at small sizes, sticker look. Original characters only: they must not look like any existing cartoon, game or brand character. Nothing scary, no weapons that look real, no text or letters.
```

**Dark army** → save as `public/skins/army-without-a-crown-dark.png`

```
Create a sprite sheet of six chess-piece characters: friendly cartoon pirates with eye patches.
DARK army: the same six characters, same poses, in deep rich colours (navy, plum, charcoal, dark red) with light details, so they stand out on cream squares.
So kids can still read the board, every character wears its chess piece as a hat: KING a crown topped with a small cross (tallest character), QUEEN a pointed crown or tiara, ROOK a castle-turret hat with square battlements, BISHOP a tall mitre with a slit, KNIGHT a horse-head hood, PAWN a small round cap (shortest character). Sizes go king (tallest) > queen > rook > bishop = knight > pawn.
Layout (exactly): one PNG, 1536 x 1024 pixels, transparent background, a 3 x 2 grid of equal 512 x 512 cells with no lines drawn. Top row, left to right: KING, QUEEN, ROOK. Bottom row, left to right: BISHOP, KNIGHT, PAWN. One full-body character per cell, standing, centred, facing the viewer, feet about 30 pixels above the bottom of its cell, nothing crossing into another cell, no floor and no shadow under the feet.
Style: bold, rounded, cheerful cartoon characters for a children's chess game. Thick dark outlines (#2d2a3e), flat colours with one soft shade, big friendly eyes, simple shapes that read at small sizes, sticker look. Original characters only: they must not look like any existing cartoon, game or brand character. Nothing scary, no weapons that look real, no text or letters.
```

## Nobles' Ball (Epic) — slug `nobles-ball`

Characters: cats in masquerade masks and ball gowns.

**Light army** → save as `public/skins/nobles-ball-light.png`

```
Create a sprite sheet of six chess-piece characters: cats in masquerade masks and ball gowns.
LIGHT army: light, bright colours (cream, white, pastel and sunny tones) that stand out on dark green squares.
So kids can still read the board, every character wears its chess piece as a hat: KING a crown topped with a small cross (tallest character), QUEEN a pointed crown or tiara, ROOK a castle-turret hat with square battlements, BISHOP a tall mitre with a slit, KNIGHT a horse-head hood, PAWN a small round cap (shortest character). Sizes go king (tallest) > queen > rook > bishop = knight > pawn.
Layout (exactly): one PNG, 1536 x 1024 pixels, transparent background, a 3 x 2 grid of equal 512 x 512 cells with no lines drawn. Top row, left to right: KING, QUEEN, ROOK. Bottom row, left to right: BISHOP, KNIGHT, PAWN. One full-body character per cell, standing, centred, facing the viewer, feet about 30 pixels above the bottom of its cell, nothing crossing into another cell, no floor and no shadow under the feet.
Style: bold, rounded, cheerful cartoon characters for a children's chess game. Thick dark outlines (#2d2a3e), flat colours with one soft shade, big friendly eyes, simple shapes that read at small sizes, sticker look. Original characters only: they must not look like any existing cartoon, game or brand character. Nothing scary, no weapons that look real, no text or letters.
```

**Dark army** → save as `public/skins/nobles-ball-dark.png`

```
Create a sprite sheet of six chess-piece characters: cats in masquerade masks and ball gowns.
DARK army: the same six characters, same poses, in deep rich colours (navy, plum, charcoal, dark red) with light details, so they stand out on cream squares.
So kids can still read the board, every character wears its chess piece as a hat: KING a crown topped with a small cross (tallest character), QUEEN a pointed crown or tiara, ROOK a castle-turret hat with square battlements, BISHOP a tall mitre with a slit, KNIGHT a horse-head hood, PAWN a small round cap (shortest character). Sizes go king (tallest) > queen > rook > bishop = knight > pawn.
Layout (exactly): one PNG, 1536 x 1024 pixels, transparent background, a 3 x 2 grid of equal 512 x 512 cells with no lines drawn. Top row, left to right: KING, QUEEN, ROOK. Bottom row, left to right: BISHOP, KNIGHT, PAWN. One full-body character per cell, standing, centred, facing the viewer, feet about 30 pixels above the bottom of its cell, nothing crossing into another cell, no floor and no shadow under the feet.
Style: bold, rounded, cheerful cartoon characters for a children's chess game. Thick dark outlines (#2d2a3e), flat colours with one soft shade, big friendly eyes, simple shapes that read at small sizes, sticker look. Original characters only: they must not look like any existing cartoon, game or brand character. Nothing scary, no weapons that look real, no text or letters.
```

## Open Field (Epic) — slug `open-field`

Characters: patchwork scarecrows with straw hair.

**Light army** → save as `public/skins/open-field-light.png`

```
Create a sprite sheet of six chess-piece characters: patchwork scarecrows with straw hair.
LIGHT army: light, bright colours (cream, white, pastel and sunny tones) that stand out on dark green squares.
So kids can still read the board, every character wears its chess piece as a hat: KING a crown topped with a small cross (tallest character), QUEEN a pointed crown or tiara, ROOK a castle-turret hat with square battlements, BISHOP a tall mitre with a slit, KNIGHT a horse-head hood, PAWN a small round cap (shortest character). Sizes go king (tallest) > queen > rook > bishop = knight > pawn.
Layout (exactly): one PNG, 1536 x 1024 pixels, transparent background, a 3 x 2 grid of equal 512 x 512 cells with no lines drawn. Top row, left to right: KING, QUEEN, ROOK. Bottom row, left to right: BISHOP, KNIGHT, PAWN. One full-body character per cell, standing, centred, facing the viewer, feet about 30 pixels above the bottom of its cell, nothing crossing into another cell, no floor and no shadow under the feet.
Style: bold, rounded, cheerful cartoon characters for a children's chess game. Thick dark outlines (#2d2a3e), flat colours with one soft shade, big friendly eyes, simple shapes that read at small sizes, sticker look. Original characters only: they must not look like any existing cartoon, game or brand character. Nothing scary, no weapons that look real, no text or letters.
```

**Dark army** → save as `public/skins/open-field-dark.png`

```
Create a sprite sheet of six chess-piece characters: patchwork scarecrows with straw hair.
DARK army: the same six characters, same poses, in deep rich colours (navy, plum, charcoal, dark red) with light details, so they stand out on cream squares.
So kids can still read the board, every character wears its chess piece as a hat: KING a crown topped with a small cross (tallest character), QUEEN a pointed crown or tiara, ROOK a castle-turret hat with square battlements, BISHOP a tall mitre with a slit, KNIGHT a horse-head hood, PAWN a small round cap (shortest character). Sizes go king (tallest) > queen > rook > bishop = knight > pawn.
Layout (exactly): one PNG, 1536 x 1024 pixels, transparent background, a 3 x 2 grid of equal 512 x 512 cells with no lines drawn. Top row, left to right: KING, QUEEN, ROOK. Bottom row, left to right: BISHOP, KNIGHT, PAWN. One full-body character per cell, standing, centred, facing the viewer, feet about 30 pixels above the bottom of its cell, nothing crossing into another cell, no floor and no shadow under the feet.
Style: bold, rounded, cheerful cartoon characters for a children's chess game. Thick dark outlines (#2d2a3e), flat colours with one soft shade, big friendly eyes, simple shapes that read at small sizes, sticker look. Original characters only: they must not look like any existing cartoon, game or brand character. Nothing scary, no weapons that look real, no text or letters.
```

## Straight Shooters (Epic) — slug `straight-shooters`

Characters: penguin archers with feathered caps.

**Light army** → save as `public/skins/straight-shooters-light.png`

```
Create a sprite sheet of six chess-piece characters: penguin archers with feathered caps.
LIGHT army: light, bright colours (cream, white, pastel and sunny tones) that stand out on dark green squares.
So kids can still read the board, every character wears its chess piece as a hat: KING a crown topped with a small cross (tallest character), QUEEN a pointed crown or tiara, ROOK a castle-turret hat with square battlements, BISHOP a tall mitre with a slit, KNIGHT a horse-head hood, PAWN a small round cap (shortest character). Sizes go king (tallest) > queen > rook > bishop = knight > pawn.
Layout (exactly): one PNG, 1536 x 1024 pixels, transparent background, a 3 x 2 grid of equal 512 x 512 cells with no lines drawn. Top row, left to right: KING, QUEEN, ROOK. Bottom row, left to right: BISHOP, KNIGHT, PAWN. One full-body character per cell, standing, centred, facing the viewer, feet about 30 pixels above the bottom of its cell, nothing crossing into another cell, no floor and no shadow under the feet.
Style: bold, rounded, cheerful cartoon characters for a children's chess game. Thick dark outlines (#2d2a3e), flat colours with one soft shade, big friendly eyes, simple shapes that read at small sizes, sticker look. Original characters only: they must not look like any existing cartoon, game or brand character. Nothing scary, no weapons that look real, no text or letters.
```

**Dark army** → save as `public/skins/straight-shooters-dark.png`

```
Create a sprite sheet of six chess-piece characters: penguin archers with feathered caps.
DARK army: the same six characters, same poses, in deep rich colours (navy, plum, charcoal, dark red) with light details, so they stand out on cream squares.
So kids can still read the board, every character wears its chess piece as a hat: KING a crown topped with a small cross (tallest character), QUEEN a pointed crown or tiara, ROOK a castle-turret hat with square battlements, BISHOP a tall mitre with a slit, KNIGHT a horse-head hood, PAWN a small round cap (shortest character). Sizes go king (tallest) > queen > rook > bishop = knight > pawn.
Layout (exactly): one PNG, 1536 x 1024 pixels, transparent background, a 3 x 2 grid of equal 512 x 512 cells with no lines drawn. Top row, left to right: KING, QUEEN, ROOK. Bottom row, left to right: BISHOP, KNIGHT, PAWN. One full-body character per cell, standing, centred, facing the viewer, feet about 30 pixels above the bottom of its cell, nothing crossing into another cell, no floor and no shadow under the feet.
Style: bold, rounded, cheerful cartoon characters for a children's chess game. Thick dark outlines (#2d2a3e), flat colours with one soft shade, big friendly eyes, simple shapes that read at small sizes, sticker look. Original characters only: they must not look like any existing cartoon, game or brand character. Nothing scary, no weapons that look real, no text or letters.
```

## Iron Will (Epic) — slug `iron-will`

Characters: clockwork wind-up toys with brass keys.

**Light army** → save as `public/skins/iron-will-light.png`

```
Create a sprite sheet of six chess-piece characters: clockwork wind-up toys with brass keys.
LIGHT army: light, bright colours (cream, white, pastel and sunny tones) that stand out on dark green squares.
So kids can still read the board, every character wears its chess piece as a hat: KING a crown topped with a small cross (tallest character), QUEEN a pointed crown or tiara, ROOK a castle-turret hat with square battlements, BISHOP a tall mitre with a slit, KNIGHT a horse-head hood, PAWN a small round cap (shortest character). Sizes go king (tallest) > queen > rook > bishop = knight > pawn.
Layout (exactly): one PNG, 1536 x 1024 pixels, transparent background, a 3 x 2 grid of equal 512 x 512 cells with no lines drawn. Top row, left to right: KING, QUEEN, ROOK. Bottom row, left to right: BISHOP, KNIGHT, PAWN. One full-body character per cell, standing, centred, facing the viewer, feet about 30 pixels above the bottom of its cell, nothing crossing into another cell, no floor and no shadow under the feet.
Style: bold, rounded, cheerful cartoon characters for a children's chess game. Thick dark outlines (#2d2a3e), flat colours with one soft shade, big friendly eyes, simple shapes that read at small sizes, sticker look. Original characters only: they must not look like any existing cartoon, game or brand character. Nothing scary, no weapons that look real, no text or letters.
```

**Dark army** → save as `public/skins/iron-will-dark.png`

```
Create a sprite sheet of six chess-piece characters: clockwork wind-up toys with brass keys.
DARK army: the same six characters, same poses, in deep rich colours (navy, plum, charcoal, dark red) with light details, so they stand out on cream squares.
So kids can still read the board, every character wears its chess piece as a hat: KING a crown topped with a small cross (tallest character), QUEEN a pointed crown or tiara, ROOK a castle-turret hat with square battlements, BISHOP a tall mitre with a slit, KNIGHT a horse-head hood, PAWN a small round cap (shortest character). Sizes go king (tallest) > queen > rook > bishop = knight > pawn.
Layout (exactly): one PNG, 1536 x 1024 pixels, transparent background, a 3 x 2 grid of equal 512 x 512 cells with no lines drawn. Top row, left to right: KING, QUEEN, ROOK. Bottom row, left to right: BISHOP, KNIGHT, PAWN. One full-body character per cell, standing, centred, facing the viewer, feet about 30 pixels above the bottom of its cell, nothing crossing into another cell, no floor and no shadow under the feet.
Style: bold, rounded, cheerful cartoon characters for a children's chess game. Thick dark outlines (#2d2a3e), flat colours with one soft shade, big friendly eyes, simple shapes that read at small sizes, sticker look. Original characters only: they must not look like any existing cartoon, game or brand character. Nothing scary, no weapons that look real, no text or letters.
```

## King's Quest (Epic) — slug `kings-quest`

Characters: small friendly dragons.

**Light army** → save as `public/skins/kings-quest-light.png`

```
Create a sprite sheet of six chess-piece characters: small friendly dragons.
LIGHT army: light, bright colours (cream, white, pastel and sunny tones) that stand out on dark green squares.
So kids can still read the board, every character wears its chess piece as a hat: KING a crown topped with a small cross (tallest character), QUEEN a pointed crown or tiara, ROOK a castle-turret hat with square battlements, BISHOP a tall mitre with a slit, KNIGHT a horse-head hood, PAWN a small round cap (shortest character). Sizes go king (tallest) > queen > rook > bishop = knight > pawn.
Layout (exactly): one PNG, 1536 x 1024 pixels, transparent background, a 3 x 2 grid of equal 512 x 512 cells with no lines drawn. Top row, left to right: KING, QUEEN, ROOK. Bottom row, left to right: BISHOP, KNIGHT, PAWN. One full-body character per cell, standing, centred, facing the viewer, feet about 30 pixels above the bottom of its cell, nothing crossing into another cell, no floor and no shadow under the feet.
Style: bold, rounded, cheerful cartoon characters for a children's chess game. Thick dark outlines (#2d2a3e), flat colours with one soft shade, big friendly eyes, simple shapes that read at small sizes, sticker look. Original characters only: they must not look like any existing cartoon, game or brand character. Nothing scary, no weapons that look real, no text or letters.
```

**Dark army** → save as `public/skins/kings-quest-dark.png`

```
Create a sprite sheet of six chess-piece characters: small friendly dragons.
DARK army: the same six characters, same poses, in deep rich colours (navy, plum, charcoal, dark red) with light details, so they stand out on cream squares.
So kids can still read the board, every character wears its chess piece as a hat: KING a crown topped with a small cross (tallest character), QUEEN a pointed crown or tiara, ROOK a castle-turret hat with square battlements, BISHOP a tall mitre with a slit, KNIGHT a horse-head hood, PAWN a small round cap (shortest character). Sizes go king (tallest) > queen > rook > bishop = knight > pawn.
Layout (exactly): one PNG, 1536 x 1024 pixels, transparent background, a 3 x 2 grid of equal 512 x 512 cells with no lines drawn. Top row, left to right: KING, QUEEN, ROOK. Bottom row, left to right: BISHOP, KNIGHT, PAWN. One full-body character per cell, standing, centred, facing the viewer, feet about 30 pixels above the bottom of its cell, nothing crossing into another cell, no floor and no shadow under the feet.
Style: bold, rounded, cheerful cartoon characters for a children's chess game. Thick dark outlines (#2d2a3e), flat colours with one soft shade, big friendly eyes, simple shapes that read at small sizes, sticker look. Original characters only: they must not look like any existing cartoon, game or brand character. Nothing scary, no weapons that look real, no text or letters.
```

## The Rebellion (Epic) — slug `the-rebellion`

Characters: raccoon rebels in bandanas.

**Light army** → save as `public/skins/the-rebellion-light.png`

```
Create a sprite sheet of six chess-piece characters: raccoon rebels in bandanas.
LIGHT army: light, bright colours (cream, white, pastel and sunny tones) that stand out on dark green squares.
So kids can still read the board, every character wears its chess piece as a hat: KING a crown topped with a small cross (tallest character), QUEEN a pointed crown or tiara, ROOK a castle-turret hat with square battlements, BISHOP a tall mitre with a slit, KNIGHT a horse-head hood, PAWN a small round cap (shortest character). Sizes go king (tallest) > queen > rook > bishop = knight > pawn.
Layout (exactly): one PNG, 1536 x 1024 pixels, transparent background, a 3 x 2 grid of equal 512 x 512 cells with no lines drawn. Top row, left to right: KING, QUEEN, ROOK. Bottom row, left to right: BISHOP, KNIGHT, PAWN. One full-body character per cell, standing, centred, facing the viewer, feet about 30 pixels above the bottom of its cell, nothing crossing into another cell, no floor and no shadow under the feet.
Style: bold, rounded, cheerful cartoon characters for a children's chess game. Thick dark outlines (#2d2a3e), flat colours with one soft shade, big friendly eyes, simple shapes that read at small sizes, sticker look. Original characters only: they must not look like any existing cartoon, game or brand character. Nothing scary, no weapons that look real, no text or letters.
```

**Dark army** → save as `public/skins/the-rebellion-dark.png`

```
Create a sprite sheet of six chess-piece characters: raccoon rebels in bandanas.
DARK army: the same six characters, same poses, in deep rich colours (navy, plum, charcoal, dark red) with light details, so they stand out on cream squares.
So kids can still read the board, every character wears its chess piece as a hat: KING a crown topped with a small cross (tallest character), QUEEN a pointed crown or tiara, ROOK a castle-turret hat with square battlements, BISHOP a tall mitre with a slit, KNIGHT a horse-head hood, PAWN a small round cap (shortest character). Sizes go king (tallest) > queen > rook > bishop = knight > pawn.
Layout (exactly): one PNG, 1536 x 1024 pixels, transparent background, a 3 x 2 grid of equal 512 x 512 cells with no lines drawn. Top row, left to right: KING, QUEEN, ROOK. Bottom row, left to right: BISHOP, KNIGHT, PAWN. One full-body character per cell, standing, centred, facing the viewer, feet about 30 pixels above the bottom of its cell, nothing crossing into another cell, no floor and no shadow under the feet.
Style: bold, rounded, cheerful cartoon characters for a children's chess game. Thick dark outlines (#2d2a3e), flat colours with one soft shade, big friendly eyes, simple shapes that read at small sizes, sticker look. Original characters only: they must not look like any existing cartoon, game or brand character. Nothing scary, no weapons that look real, no text or letters.
```

## Chess Chaos Crown (Legendary) — slug `chess-chaos-crown`

Characters: a shining golden crystal army, every piece wearing a jewelled crown.

**Light army** → save as `public/skins/chess-chaos-crown-light.png`

```
Create a sprite sheet of six chess-piece characters: a shining golden crystal army, every piece wearing a jewelled crown.
LIGHT army: light, bright colours (cream, white, pastel and sunny tones) that stand out on dark green squares.
So kids can still read the board, every character wears its chess piece as a hat: KING a crown topped with a small cross (tallest character), QUEEN a pointed crown or tiara, ROOK a castle-turret hat with square battlements, BISHOP a tall mitre with a slit, KNIGHT a horse-head hood, PAWN a small round cap (shortest character). Sizes go king (tallest) > queen > rook > bishop = knight > pawn.
Layout (exactly): one PNG, 1536 x 1024 pixels, transparent background, a 3 x 2 grid of equal 512 x 512 cells with no lines drawn. Top row, left to right: KING, QUEEN, ROOK. Bottom row, left to right: BISHOP, KNIGHT, PAWN. One full-body character per cell, standing, centred, facing the viewer, feet about 30 pixels above the bottom of its cell, nothing crossing into another cell, no floor and no shadow under the feet.
Style: bold, rounded, cheerful cartoon characters for a children's chess game. Thick dark outlines (#2d2a3e), flat colours with one soft shade, big friendly eyes, simple shapes that read at small sizes, sticker look. Original characters only: they must not look like any existing cartoon, game or brand character. Nothing scary, no weapons that look real, no text or letters.
```

**Dark army** → save as `public/skins/chess-chaos-crown-dark.png`

```
Create a sprite sheet of six chess-piece characters: a shining golden crystal army, every piece wearing a jewelled crown.
DARK army: the same six characters, same poses, in deep rich colours (navy, plum, charcoal, dark red) with light details, so they stand out on cream squares.
So kids can still read the board, every character wears its chess piece as a hat: KING a crown topped with a small cross (tallest character), QUEEN a pointed crown or tiara, ROOK a castle-turret hat with square battlements, BISHOP a tall mitre with a slit, KNIGHT a horse-head hood, PAWN a small round cap (shortest character). Sizes go king (tallest) > queen > rook > bishop = knight > pawn.
Layout (exactly): one PNG, 1536 x 1024 pixels, transparent background, a 3 x 2 grid of equal 512 x 512 cells with no lines drawn. Top row, left to right: KING, QUEEN, ROOK. Bottom row, left to right: BISHOP, KNIGHT, PAWN. One full-body character per cell, standing, centred, facing the viewer, feet about 30 pixels above the bottom of its cell, nothing crossing into another cell, no floor and no shadow under the feet.
Style: bold, rounded, cheerful cartoon characters for a children's chess game. Thick dark outlines (#2d2a3e), flat colours with one soft shade, big friendly eyes, simple shapes that read at small sizes, sticker look. Original characters only: they must not look like any existing cartoon, game or brand character. Nothing scary, no weapons that look real, no text or letters.
```

