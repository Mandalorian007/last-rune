# Workstream: teach-6 (Gate 2, blind review 8: D-040 add. 9 a, b, c)

Screens: /Users/matthewfontana/repos/last-rune/docs/design/screens/local/gate8/{se,iphone,promax,android}/ (git-ignored; read from the main repo). Rules: D-027 (newcomer clarity; visuals match rules), D-043: **no live "would get N" and no "will be met" signal before Strike.** The dot means only "charge reaches this gauge". Reviewers asked for numeric previews; that is declined.

## Findings (all four reviewers)
1. **Gauge dots.** The shots never show the cyan-dot legend: card-fit makes it wait while a gem card is up, so in practice a player may never see it. Three of four reviewers guessed cyan means "exact / will be met", which is wrong and dangerous. The hollow ring before "Needs" reads as a zero ("0 Needs 4"). Only red ("this gauge will trip") gets a caption.
   - Make the dot language one explained system the player is sure to see once: hollow/none = no charge reaches yet, lit = charge reaches (not "enough"), red = will trip.
   - Consider dropping the hollow ring and showing a mark only when charge reaches, so nothing reads as 0.
   - The legend must appear the first time a dot lights, even if a gem is held (e.g. it replaces the gem card for that moment, or docks in FUSE's line). It must never clip (altar-column.spec).
2. **Two-strike rule** (10-capacitor-bay, 15-capacitor-teach*, 13-capacitor-bay-*, 10-roof-array, 10-lift-shaft, 10-the-last-rune).
   - "Needs 8 in one strike" is ambiguous (every strike? at least one? never over?). Say the real rule in words a player can't misread, and keep it short.
   - The ○○ on "Strike ×2" is unexplained and reads as "00": label or explain it once.
   - The Capacitor card's "Strike 1: stores 8 →" dangles. Use e.g. "Strike 1: keeps 8, sends nothing. Strike 2: sends 8 + 8 = 16."
   - Result labels use two layouts ("Needs 2 · got 0" vs stacked "Needs 8 / got 16"): pick one.
3. **Gate card** (10-relay-tower, 10-foundry, 14-relay-tower-teach): "Charge both sides of the arrow" is ambiguous and breaks badly. Name the sides concretely, e.g. "Feed both flat sides in the same strike; the sum leaves by the arrow." It must match the picture exactly, including the ✕ side.
4. **Minors.**
   - One name per gem: FUSE says "Amber" where the game says Amplify (06-menu-altar, 20-solve).
   - Furnace's "A second Amplify on the same path: 8 → 8." should read e.g. "A second Amplify doesn't double again."

Stay in copy, the teach/legend cards, gauge labels and the Strike button. ws/dense-board-3 is changing layout.ts and the loupe in parallel: don't change board fit or column width. ws/glyph-truth-3 owns gem art; ws/polish-8 owns hall, title, menu and shots.spec.

## Done when
check, check:boundaries, build and test:e2e are green; altar-column.spec and dense-board.spec hold. Run `pnpm baseline` and list intended diffs (don't update). Regenerate `SHOTS=teach-6` and look at the Capacitor, Relay Tower and Storm Cell 2 shots on SE and Android as a first-time player. Commit to ws/teach-6 and never merge. Log here.

## Log
