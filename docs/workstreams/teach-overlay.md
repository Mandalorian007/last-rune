# Workstream: teach-overlay (phones: the arrival card opens over the column, folds to a pill)

Finding (user, real iPhone in Brave, landscape, 2026-11-05): with the address bar and tab strip on screen the game gets about 852×270 CSS px. On Lift Shaft the Capacitor arrival card was squeezed into the lane under the tray, tiny, clipped mid-line and scrolling. "This needs to open over runes then be closable or minimize after a tiny bit of no interaction with interaction making it big."

## Do (phones only; desktop and iPad unchanged)
1. **Overlay, not squeeze.** The arrival/teach card and the dense-board-4 Rule-tab card open as a panel over the right column and tray. It may cover the tray, never the board's sockets or Strike, and should not cover gauge notes. Its words show in full at ≥14 px with no scrolling at the short viewport; page with Next rather than scroll.
2. **Closable.** "Got it" stays the close control, 44 px target.
3. **Auto-minimise.** About 4 s with no touch on it, the card folds to a pill in the column (gem picture plus name, ≥44 px). Tapping the pill opens it again. A touch on the card resets the clock. A tap on the board or a tray gem folds it at once, and the tap still acts. Reduced motion: no animation, same states.
4. **Teaching is never lost.** Folded is not dismissed: a first-sight card stays as the pill until "Got it". One pill at a time (the Rule tab waits while the card's pill stands).
5. **Short-viewport profile** (852×270, dpr 3, touch) in altar-column (card-fit walk included), dense-board, and a new spec for open → idle → fold → tap → open → Got it. Every arrival card fits without scrolling there and on the four phones.

Copy stays as is; placement logic untouched.

## Log

**2026-11-05, done (ws/teach-overlay).**
- **Panel.** On phones the arrival card and any pinned gem card (the Rule tab, a long press) are `data-over`: `position: fixed` inside the CSS overlay (the overlay's `contain: layout` is the containing block). It stands on the lane's foot, just above the foot row (Strike, FUSE). It grows up to under the title (and under the ☰ where it reaches below it), as tall as its words need. It is as wide as the free space between the board (slab, props, Gives/Needs notes) and the screen edge, at most 400 px (`placeCardPanel` in altar-column.ts). It is opaque and covers the tray, never sockets, labels or Strike. There is a 140 ms rise, off under reduced motion.
- **Fold.** `CARD_IDLE_SECS = 4` (dev override `window.__lrCardIdle` for specs). A touch on the panel resets it. A board or tray tap folds it (altar-edit) and still lands. Placing a gem folds it on phones (it fades as before elsewhere). Strike or verdict folds it. A pinned card closes after idle or when its panel is touched.
- **Pill.** `.lr-card-pill` in the lane: the gem's portrait (or a gold "?" for Goal, Gold ring, Strike ×2 and either-way pages) plus the page's name, 44 px tall. A tap opens the card again on the same page. It holds FUSE like the Rule tab (only one card owns the lane). Only "Got it" retires it.
- **Short lane (found at 852×270).** The arrival card was not the only thing cut short. The held gem's card with its Turn line, the dot legend and the verdict's Try line all clipped in a lane of about 114 px. A lane under `SHORT_LANE_PX = 130` (the four phones' lanes are taller) now does two things. It folds the held gem's card behind the dense-board-4 Rule tab, as the slim column does; the tab now exists on every phone column and shows only when slim or short. A verdict or legend that is cut short there also stands over the column as a panel (no touch target; a tap reaches the board below).
- **On phones a teach card no longer follows the held gem.** The open arrival card stays the arrival card even with another gem in hand (it is folded unless the player opens it). That changes D-040 add. 5's "the card names the gem in hand" for the open panel. PM to confirm.
- **Specs.**
  - `tests/e2e/phones.ts` holds `SHORT_PHONE`.
  - altar-column runs on five phones. The panel may cover tray, title and lane, not sockets, labels or buttons, and must stay on screen.
  - dense-board adds `short` with floors as measured. The Last Rune's pitch is 26 CSS px there, against 32 on the SE.
  - New: `teach-overlay.spec.ts` covers open, touch-keeps-open, idle fold, the pill, reopen, board-tap fold and Got it on short, iPhone and SE, plus "a tray pick keeps the pill" and `SHOTS=teach-overlay` shots.
  - Lift Shaft is met before Roof Array, the order in which its Capacitor card shows. In strict play order Lift Shaft shows no card, and neither does The Last Rune.
