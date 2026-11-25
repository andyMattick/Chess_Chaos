/**
 * Fonts ship with the app (owner, 2026-11-25: design review). Nothing is
 * loaded from a font server, so headings never fall back to a serif on a
 * school network or offline, and a kids' app makes no third-party requests.
 * All three are SIL Open Font License, packaged by Fontsource.
 *
 * Andika: body text and buttons. Made for children learning to read.
 * Baloo 2: screen titles and big numbers only.
 * Bangers: in-game moments only (CHECK!, YOUR TURN!).
 */
import '@fontsource/andika/400.css';
import '@fontsource/andika/700.css';
import '@fontsource/baloo-2/700.css';
import '@fontsource/baloo-2/800.css';
import '@fontsource/bangers/400.css';
