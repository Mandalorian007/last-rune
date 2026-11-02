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
