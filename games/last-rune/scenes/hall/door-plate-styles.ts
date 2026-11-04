/**
 * The hall's door plates on phones (chrome-polish-3, Gate 2 review 5). Appended to the phone
 * sheet after the hall's other phone rules (game/ctx.ts SCENE_PHONE_CSS), so these win.
 *
 * - A plate is never narrower than its longest word (with the padlock or ✓): "Capacitor" no
 *   longer spills out of its plate. A short last word ("Conveyor A", "Cell II") stays with the
 *   word before it (ui/hud.ts `doors`).
 */
import { P as PHONE } from '../../ui/phone-base';

const P = `${PHONE} .lr-doors`;

export const DOOR_PLATE_CSS = /* css */ `
${P} .lr-door { min-width: min-content; }
${P} .lr-door-name { min-width: 0; }
`;
