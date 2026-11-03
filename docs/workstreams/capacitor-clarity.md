# Workstream: capacitor-clarity (wave 5, top priority, D-027)

## User feedback (verbatim, 2026-11-02)
> Smooth gameplay up to unlocking capacitor. How it works is not super clear with the double striking thing. Should improve intuitiveness or provide additional guidance

## Context
- Rules: `docs/design/rules.md` §4/§5. A Capacitor stores the first bolt it gets, with nothing coming out. On the next strike it releases stored + incoming. Some altars have `pulses: 2` (two strikes).
- First altar: `content/puzzles/capacitor-bay.ts` (fixed Capacitor, 2 strikes). It is followed by lift-shaft and roof-array.
- Today: one Strike button. With 2 pulses, the strike plays both, and machines are judged on… (find out exactly how: per strike? on the last one?). The preview chips show 4 going into the Capacitor (onboarding-2).

## Goal
A first-time player understands the following before pressing Strike, and can see each of them happen while it plays:
- "this altar strikes twice";
- "the ice keeps strike 1";
- "strike 2 gets stored + new".

Reproduce as a newcomer first, at capacitor-bay, lift-shaft and roof-array. Write down what's unclear, then fix it. Ideas, not mandates:
- **Strike count:** show it explicitly, e.g. "Strikes: 2" next to "Gives N" and pips on the Strike button. The machine's Needs card should say which strike it's judged on, if that matters.
- **Strike playback:** play strike 1 and strike 2 as visibly separate beats with a label ("Strike 1 of 2"). Fill the Capacitor visibly on strike 1 with a charge readout ("holding 4"), and release it on strike 2 with "4 + 4 → 8".
- **Preview:** before striking, show both strikes' charges at the Capacitor (e.g. "1st: stores 2 · 2nd: 2 + 2 → 4").
- **Verdict:** a wrong result should say what happened on each strike in plain words.
- **Teaching:** a short arrival card or FUSE line on the first capacitor altar, if still needed. Plain UI text; FUSE stays in voice (`content/lines.ts`, `docs/design/script.md`).

Visuals must match the rules exactly. Don't change puzzle rules. Small puzzle tweaks need solver checks.

## Done means
- `pnpm check`, `pnpm build` and `pnpm test:e2e` all green, plus an e2e covering the strike labels or preview.
- Before and after fresh-eyes screenshot sequences (arrive → build → strike 1 → strike 2 → verdict) for capacitor-bay and lift-shaft, at 1920 and at 1280 with 150% text, in your scratchpad, listed in your report.

## Log
### 2026-11-02: done (branch `worktree-agent-a33da6297fadff34b`)
**What a newcomer saw (before).**
- "2 strikes" appeared only in the small subtitle.
- The fixed Capacitor's card said only "Stores the first bolt it gets."
- The preview stopped at the ice with an "8" chip, so the machine looked fed with 8.
- Strike 1 ended at the ice with no read-out, and the 0.9 s gap blurred the two strikes together.
- Strike 2 showed "16" without "8 + 8".
- The verdict "Breaker tripped: needs 8, got 16" gave no reason.
- At lift-shaft without the ice, "got 8" on both strikes invited the guess that strikes add up.

**Changes (scene only; no rule, content or engine changes).**
- Strike count:
  - the Gives card gets a row with a pip per strike and "2 strikes", which reads "Strike k of 2" during playback;
  - the Strike button gets matching pips, and they light per strike;
  - the Strike button's aria-label says "2 strikes";
  - on multi-strike altars, Needs cards add "in one strike".
- Capacitor read-out (`.lr-altar-cap`):
  - **Plan:** a dashed label shows both strikes for the board as built, for example "Strike 1: keeps 8 / Strike 2: 8 + 8 → 16". It also covers "keeps N, never let out".
  - **Playback:** each line appears as its bolt reaches the ice, and the newest line is highlighted.
  - It is driven by `capacitorBeats` / `capBeatText` (circuit-model.ts), read off the sim trace.
- The rest between strikes on multi-strike altars goes from 0.9 s to 1.4 s.
- Verdict:
  - `failText` names the strike: "Breaker tripped on strike 2: needs 8, got 16" and "Not enough: needs 12, got 8 each strike".
  - `strikeStory` adds a line under it: "Strike 1: the Capacitor kept 8. Strike 2: the Capacitor let out 8 + 8 = 16." With no Capacitor in play it reads "Each strike is read on its own: strikes never add up."
  - Single-strike wording is unchanged.
- The arrival or info card shows the Capacitor's full Codex rule, not just its first sentence (scene-side; codex.ts untouched).
- Tests:
  - `scenes/altar/capacitor.test.ts` (unit);
  - `tests/e2e/capacitor.spec.ts` (labels, plan, playback, verdict);
  - `scripts/playtest/capacitor.spec.ts` (filmstrips).

**PM decisions proposed.**
1. The Capacitor plan read-out shows charge in the edit preview. That is an exception to "preview shows direction only", limited to Capacitors.
2. The "in one strike" note on Needs cards for multi-strike altars.
3. A 1.4 s pulse gap on multi-strike altars.
4. The full Capacitor rule on its card.
5. rules.md mentions storm pips. They now exist as DOM pips on the Gives card, not on the storm cell.
6. FUSE line: not added. The UI now carries the explanation; revisit after a playtest.
