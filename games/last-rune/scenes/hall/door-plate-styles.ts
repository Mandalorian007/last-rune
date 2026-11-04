/**
 * The hall's door plates on phones (chrome-polish-3, Gate 2 review 5). Kept with the hall, not in
 * ui/phone-styles.ts (which ws/port-altar-3 is retiring); these rules sit after it and outrank it.
 *
 * - A plate is never narrower than its longest word (with the padlock or ✓): "Capacitor" no
 *   longer spills out of its plate. A short last word ("Conveyor A", "Cell II") stays with the
 *   word before it (ui/hud.ts `doors`).
 */

const P = '.tc-overlay[data-phone]:not(#lr-none) .lr-doors';

export const DOOR_PLATE_CSS = /* css */ `
${P} .lr-door { min-width: min-content; }
${P} .lr-door-name { min-width: 0; }
`;
