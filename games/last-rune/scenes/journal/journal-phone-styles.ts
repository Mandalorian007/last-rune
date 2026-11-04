/**
 * The journal on phones (chrome-polish-3, Gate 2 review 5). Kept with the scene, not in
 * ui/phone-styles.ts (which ws/port-altar-3 is retiring); appended after it, so these rules win.
 *
 * - The page arrows leave the pages: they flank FUSE's plate under the book, as a book's own
 *   page turns would, and the plate's line keeps clear of them (was: on the leaves' outer
 *   bottom corners, phone-styles mobile-6-chrome).
 * - No lamp dot before FUSE's line on the plate: on a phone it read as a stray bullet.
 */

const P = '.tc-overlay[data-phone]:not(#lr-none) .lr-journal';
/** n CSS px, as a design-px length (the overlay sets `--tc-css-px` on phones). */
const cpx = (n: number) => `calc(var(--tc-css-px, 1px) * ${n})`;

/** The plate's ends (design px, journal-scene DESK_LAYOUT.plate: x 1252, w 1080, y 926). */
const PLATE_L = 1252 - 540;
const PLATE_R = 1252 + 540;
const PLATE_Y = 926;

export const JOURNAL_PHONE_CSS = /* css */ `
${P} .lr-j-turn[aria-label="Previous page"],
${P} .lr-j-turn[aria-label="Next page"] {
  top: ${PLATE_Y}px !important; right: auto; transform: translate(-50%, -50%);
}
${P} .lr-j-turn[aria-label="Previous page"] { left: calc(${PLATE_L}px + ${cpx(26)}) !important; }
${P} .lr-j-turn[aria-label="Next page"] { left: calc(${PLATE_R}px - ${cpx(26)}) !important; }
${P} .lr-j-plate { padding: 0 ${cpx(56)}; }
${P} .lr-j-plate::before { display: none; }
`;
