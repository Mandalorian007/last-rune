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

### 2026-11-04: teach-6 (copy, dots, legend, two-strike rule, Gate card)

**1. Gauge dots: one explained system, sure to be seen.**
- The hollow ring is gone: a gauge shows no mark until the route reaches it (strike-styles: `.lr-need-lamp:not([data-on])` hidden). Nothing reads as "0 Needs 4" any more. Lit = cyan, red = will trip, as before.
- Legend (moments.ts `DOT_LEGEND`): head "The dot on a gauge:" + **Got it**; rows "No dot: no charge yet" (no dot drawn), "Lit: charge reaches it" (was "some charge…"; it wrapped to an orphan "it" on SE), "Red: Strike would trip it". No amount and no "enough" (D-043); a unit test bans digits/enough/exact/hollow.
- It now shows with a gem in hand: a gem's chip (tray/board tip, not the arrival card, not a long-press pin) steps aside for it (`data-yield`, arrangeColumn). It still waits for the arrival card, a pinned card, the verdict and a live Capacitor read-out. Its rows wrap with a hanging indent rather than clip, and FUSE holds his line while it is up (on the SE his caption cut it). "Got it" (44 px hit area) retires it for the game (`retireDotLegend` → `flow.tellDot()`); Strike still does too.

**2. Two-strike rule.**
- Gauge note "in one strike" → **"in either strike"** (pulses 3+: "in any one strike"); verdict: "Got 0, then 16; needs 8 in either strike." (`needNote` in strike.ts, kept together by nowrap).
- First multi-strike altar gets a new page after the strikes page, **"Either strike"**: "A gauge wakes when one of the two strikes brings exactly its number. A strike that brings more trips it." (the sim's rule: first exact strike wakes it; an over strike before then trips it).
- Strikes page: "One tap sends two strikes, each lighting a mark. A miss resets for free." (as long as before: the SE card had no more room) and its title "Strike ×2" wears the same two unlit marks as the Strike button (gold rings), so the ○○ is named where it is shown.
- Capacitor strip: "Strike 1: keeps 8, sends nothing." / "Strike 2: sends 8 + 8 = 16."
- Result labels: on multi-strike altars north/south cards now stack after Strike ("Needs 8 / got 16"), like east/west (`data-multi`; layout already reserves two lines for them). **Compromise:** one-strike north/south cards stay inline "Needs 2 · got 0": layout.ts gives them one line and dense-board-3 owns it. So within one altar the layout is now consistent; across altars it is not.

**3. Gate card.** The phone's fixed-Gate page names the sides as its (turned) picture shows them, including the lost side (`gateSides(rot)` in teach.ts). Relay Tower: "Built in. Feed it from above and below in the same strike; the sum leaves to the right. From the left: lost." Codex chip: "Feed both sides beside the arrow at once; sum goes out." (the SE column fits no more on the Crane's turn page) (rule unchanged: it already said "beside the arrow"; codex word limit). No "flat sides": the Gate is a pentagon.

**4. Minors.** Amplify card: "Doubles the charge, once per path." / "A second Amplify doesn't double again."
- **Not done, PM call:** FUSE's "amber/magenta/emerald" lines. 10 of them are verbatim from docs/design/pitch-v0.3.md (content.test pins pitch lines; the pitch itself lists "Split · magenta, Amplify · amber, Gate · emerald"). Renaming only the 7 non-pitch lines would leave FUSE half on colours, half on names, so all are left as they were. Proposal: amend the pitch's FUSE lines to gem names (e.g. "Amplify before Split", "An Amplify doubles the charge…", "A Gate. Good."), then lines.ts + script.md follow in one change.

**Note for polish-8:** shots.spec never sets `flags.dotTold`, so every held-gem phone shot now shows the dot legend instead of the gem card (the legend outranks a chip). Set dotTold after the first altar's shots.

**Gates.** `pnpm check` (598 unit + engine/host), check:boundaries and build: green. Full `test:e2e` (E2E_PORT_OFFSET=617): 178 passed, 20 skipped, 3 failed that pass alone with `--workers=1` (flakes, none in teach-6 code): ending.spec:23, glyph-truth.spec:143, layout-fit.spec:174 (relay one-arm at 1920). altar-column.spec and dense-board.spec pass; altar-column + mobile-teach rerun green after the last copy trim (34 passed).

**Baseline** (`pnpm baseline`, not updated): 18 fail, all the three multi-strike altars (capacitor-bay, roof-array, the-last-rune; empty and solved; desktop-720/1080 and iPad; 0.18 to 0.37%). The diff is the gauge labels only: "in either strike" in place of "in one strike". 2 first-try flakes passed on retry (desktop-720 splitter-mill empty, iPad relay-tower empty). Everything else is under tolerance.

**Shots** (`SHOTS=teach-6`, docs/design/screens/local/teach-6/{se,android}/): 10-, 12-, 13-, 14-, 15-capacitor-*, relay-tower-*, storm-cell-2-*. Read as a newcomer: the Capacitor gauges say "Needs 8 in either strike" and the strikes page names the ○○; Relay Tower's Gate card reads above and below in, out to the right, ✕ on the left, which matches its picture; the Storm Cell 2 legend shows with Channel in hand. The SE showed "Lit: some charge reaches it" wrapping to a lone "it", so it was trimmed to "Lit: charge reaches it".
