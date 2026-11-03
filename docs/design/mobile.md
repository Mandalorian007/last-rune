# Phones: what runs, how well, and what to check on a real device

Owner: mobile-perf (D-039). Layout, touch and wording on phones belong to mobile-ui.
Researched 2026-11-03.

## 1. WebGPU on phones: the support matrix

| Platform / browser | WebGPU on by default? | Since | Notes |
|---|---|---|---|
| **iPhone, Safari** | Yes | Safari 26.0 / iOS 26 (15 Sep 2025) [1][2] | iOS 26 runs on iPhone 11 and newer and on the SE (2nd gen) and newer, so A13 is the floor [3]. |
| **iPad, Safari** | Yes | iPadOS 26 [1][2] | iPadOS reports itself as a Mac, so the game treats it as a tablet, not a handheld. |
| iPhone/iPad, Chrome, Edge, Firefox | Probably, on iOS 26 | — | Every iOS browser uses WebKit. That claim comes from a secondary source only. Not verified. |
| iOS in-app browsers (WKWebView) | Unknown | — | Our copy says "open the link in Safari". |
| **Android, Chrome** | Yes, on Android 12+ with Qualcomm or ARM (Mali) GPUs | Chrome 121 (Jan 2024) [4][2] | The gpuweb wiki also lists Intel. Imagination (PowerVR) GPUs need Chrome 139+ on Android 16+ [5][6]. Samsung Xclipse (Exynos) is not listed. Android 11 and older: no. |
| Android, Samsung Internet | Listed from v24 [7] | — | Samsung's community forums report it broken on some One UI 7 devices [8]. Treat it as unreliable. |
| Android, Opera Mobile | Listed from v80 [7] | — | Chromium-based. Untested. |
| Android, Edge | Unknown | — | Chromium-based. Untested. |
| Android, Firefox | **No** | — | Not shipped on Android [2]. |
| Android WebView, in-app browsers | **No** | — | [2]. The unsupported screen says "open the link in Chrome". |

Caveats that matter for us:
- **A device can be lost at any time.** Mobile GPUs lose devices more often: backgrounding, memory pressure, driver resets. There are reports of device loss on Safari 26 under load [9]. We show the existing "The lights went out" Reload screen. The save is flushed first.
- **Low Power Mode on iOS caps `requestAnimationFrame` at about 30 fps** [10]. That is the same steady 30 we fall back to, so nothing breaks.
- **Timestamp queries:** Chrome rounds them to 100 µs. We found no source on whether Safari for iOS exposes `timestamp-query`. Without it, the game falls back to queue latency, which reads high. The steady-30 rule is gated on real frame intervals so that fallback cannot trigger it on its own (section 3).
- **The silent switch mutes Web Audio on iOS** [11]. Pages default to `navigator.audioSession.type = 'ambient'`: it obeys the switch and mixes with other apps. `'playback'` ignores the switch but pauses the player's music or podcast [12][13]. We keep the default. Whether to switch is a PM decision (section 5).
- **iOS has no documented per-tab memory limit.** Section 4 has our footprint.

Sources:
1. WebKit, "WebKit Features in Safari 26.0": https://webkit.org/blog/17333/webkit-features-in-safari-26-0/
2. gpuweb wiki, Implementation Status: https://github.com/gpuweb/gpuweb/wiki/Implementation-Status
3. Apple, iOS 26 compatible devices: https://support.apple.com/en-us/123705
4. Chrome, "What's New in WebGPU (Chrome 121)": https://developer.chrome.com/blog/new-in-webgpu-121
5. Chromium commit enabling WebGPU on Imagination GPUs: https://chromium.googlesource.com/chromium/src/+/472e65391d0736097e9aa13f0cce7849876abe2a
6. Dawn commit (Android GPU allowlist): https://dawn.googlesource.com/dawn/+/14aabfca88e5956630dc96ce06ef0c8eefd4afe5
7. caniuse, WebGPU: https://caniuse.com/webgpu
8. Samsung Community thread on WebGPU in Samsung Internet on One UI 7 (user reports, not official)
9. Dear ImGui issue 9103 (WebGPU device lost on Safari 26): https://github.com/ocornut/imgui/issues/9103
10. WebKit bug 215745 (rAF throttled in Low Power Mode): https://bugs.webkit.org/show_bug.cgi?id=215745
11. WebKit bug 237322 (Web Audio muted by the ringer switch): https://bugs.webkit.org/show_bug.cgi?id=237322
12. MDN, `AudioSession.type`: https://developer.mozilla.org/en-US/docs/Web/API/AudioSession/type
13. WebKit bug 264473 (`transient` audio session types follow the switch): https://bugs.webkit.org/show_bug.cgi?id=264473
14. MDN, `BaseAudioContext.state` (the iOS `interrupted` state): https://developer.mozilla.org/en-US/docs/Web/API/BaseAudioContext/state
15. WebKit bug 276016 (audio silent after backgrounding; suspend then resume fixes it): https://bugs.webkit.org/show_bug.cgi?id=276016

## 2. What emulation can and can't tell us

The only GPU here is an Apple M4 running headless Chromium. `PERF_MOBILE=1` sets an
852×393 CSS-px landscape screen at DPR 3, with touch and a coarse pointer. That tests:
- pixel counts;
- the DPR cap;
- which tier Auto picks;
- touch unlock;
- media queries;
- whether the lifecycle code and orientation flips leak.

It does **not** test:
- **phone GPU speed.** Estimate an A13–A15 or a mid-range Adreno/Mali as 2–5× slower than the M4 per pixel. `PERF_CPU=4` throttles the CPU only. It also inflates the `ts` numbers here (the GPU work queues behind a slowed main thread), so read those as contention, not as phone GPU time;
- thermal throttling;
- Safari's WebGPU (Metal through WebKit, not Dawn);
- iOS memory kills;
- the iOS audio session, interruptions or the silent switch;
- real background freezing or discarding.

Those need the real-device checklist (section 6).

## 3. GPU budget on phones

What changed (phones only; desktop and tablets unchanged):
- **Auto starts on Low on a handheld.** A handheld is a coarse pointer plus a screen whose short side is ≤ 600 CSS px. Phones are 320–440, the smallest tablets 744. Low's 1280×720 budget (0.92 MP) is already about 1.5× DPR on a phone's 852×393 landscape screen. Low also cuts bloom levels, god-ray samples, fog octaves and particles, and composites at scene resolution. The canvas DPR stays capped at 2 (existing `Surface` default), and Low's pixel budget caps the scene well below that.
- **Dynamic resolution stays on** (floor 0.6). It reacts to thermal slowdown by lowering the scene scale.
- **Steady 30.** On Low with dynamic resolution, three conditions must hold for 4 s:
  - the scale sits at its floor;
  - the GPU is over its 14 ms budget;
  - the median frame interval is over 20 ms.

  When they do, the game caps at 30 fps for the session (`GameLoop.maxFps`; it skips every other vsync, so the fixed-step simulation keeps time). The GPU budget then doubles to 28 ms, so resolution climbs back. Changing Graphics in Settings lifts the cap. Requiring slow real frames means a pessimistic GPU timer alone cannot trigger it.

Numbers (M4, headless Chromium; `ts` = GPU timestamp ms p50/p95; every frame p50 was 16.7):

Phone emulation: 852×393 CSS px at DPR 3. The canvas is 1398×786 (letterboxed to 16:9 and capped at DPR 2).

| Scene | Before, CPU×4 (Auto→High, 1398×786) | After, CPU×4 (Auto→Low, 1280×720) | Before, CPU×1 | After, CPU×1 |
|---|---|---|---|---|
| Title | 5.24 / 6.25 | 4.46 / 5.26 | 2.21 / 4.19 | 4.51 / 6.09 |
| Hall, start | 13.85 / 16.80 | **5.49 / 6.61** | 6.36 / 12.40 | 5.79 / 7.77 |
| Hall, all restored | 13.15 / 15.32 | **5.90 / 9.12** | 5.67 / 7.86 | 5.35 / 6.45 |
| Altar | 8.96 / 11.60 | 3.43 / 3.54 | 3.95 / 5.17 | 4.12 / 4.63 |
| Strike | 7.14 / 12.15 | 4.03 / 7.31 | 3.98 / 9.80 | 4.34 / 6.05 |
| Ending, door (700×394 cap) | 7.81 / 12.90 | 3.71 / 5.52 | 2.13 / 7.30 | 2.85 / 3.45 |
| Ending, flood | 1.73 / 4.31 | 3.58 / 5.24 | 1.81 / 4.18 | 2.46 / 3.16 |

How to read this:
- The M4 holds 60 either way, so the useful number is the ratio. Low costs about 0.4–0.9× High in the heavy scenes (the hall: scene pass plus bloom), and its p95 is much tighter.
- At the low end of our 2–5× phone estimate, the hall at High (6–14 ms here) becomes 12–70 ms, often over 16.7 ms. At Low (5.5–6 ms here) it is 11–30 ms. Dynamic resolution (down to 0.6, which is 0.36× the pixels) brings most phones to 60. The weakest settle on the steady 30.
- Under CPU×4, the strike's frame p95 is 33.3 both before and after. That is main-thread work from the CPU throttle, not GPU.
- Small differences of 1–2 ms between runs (the title, the ending flood) are noise from other GPU clients on this machine.

**Desktop is unchanged** (1920×1080, DPR 1; `ts` p50/p95). Same tier, scene size, pixel budget and draw count in every scene. Before and after were taken minutes apart with other agents using the GPU, so the `ts` differences are noise.

| Scene | High, before | High, after | Auto, before | Auto, after |
|---|---|---|---|---|
| Title | 5.28 / 6.77 | 6.61 / 14.07 | 8.53 / 9.81 | 5.59 / 6.63 |
| Hall, start | 10.69 / 13.12 | 9.92 / 10.82 | 12.36 / 13.90 | 10.52 / 10.95 |
| Hall, all restored | 10.80 / 12.62 | 9.54 / 10.23 | 11.60 / 16.96 | 8.86 / 10.18 |
| Altar | 4.21 / 5.89 | 6.48 / 8.37 | 8.17 / 9.46 | 5.38 / 7.95 |
| Strike | 4.59 / 7.35 | 5.95 / 8.73 | 8.90 / 10.59 | 5.14 / 7.84 |
| Ending, door | 11.40 / 18.20 | 10.48 / 11.42 | 14.17 / 17.83 | 10.51 / 11.47 |
| Ending, flood | 10.29 / 14.82 | 7.65 / 9.37 | 6.81 / 8.05 | 7.65 / 9.26 |

Tier in every desktop run, before and after: High→high@1.00 and Auto→high. Auto's hall at 0.80 scale before was the dynamic resolution reacting to contention.

## 4. Memory

`PERF_MEM=1` (`scripts/perf/mem.spec.ts`). Phone emulation, after everything has loaded:

| | Before (Auto→High) | After (Auto→Low) | Desktop 1080p |
|---|---|---|---|
| Decoded audio | 53.3 MiB, 60 buffers | 53.3 MiB (unchanged) | 53.3 MiB |
| ArrayBuffers, peak during the audio pre-render | 123.5 MiB | 122.4 MiB | 128.3 MiB |
| ArrayBuffers after GC | 4.3 MiB | 4.3 MiB | 4.3 MiB |
| GPU textures in the hall (declared size) | 10, 46.5 MiB | 11, 46.5 MiB | 10, 65.7 MiB |
| GPU buffers | 2.8 MiB | 2.8 MiB | 2.8 MiB |
| JS heap | 8.9 MiB | 8.5 MiB | 8.9 MiB |
| After 10 landscape↔portrait flips | 10 textures, 46.5 MiB | 11 textures, 46.5 MiB | 10, 65.7 MiB |

Not counted: the swapchain (2–3 × about 4 MiB) and driver overhead.

Where the GPU memory goes:
- the two rgba16f scene targets at canvas size;
- the stone-wall albedo and normal maps (7.9 MiB each, a fixed 1920×1080);
- the emboss mask (4.9 MiB);
- bloom and rays;
- the floor maps.

Low swaps a slightly smaller scene for an upscale target, so the total barely moves.

**Verdict: no reduction on phones.** The steady state is about 110–125 MB: 53 audio, 47 textures, 9 heap, plus the swapchain. Every phone that runs WebGPU has 4 GB or more (iOS 26 starts at the iPhone 11; Android 12 flagships). Safari tabs commonly use several hundred MB before iOS steps in. Halving the ambience and pads would save about 12 MiB, at the cost of a second audio path. The real lever is the **transient** peak of about 120 MiB in ArrayBuffers while the bank renders. Rendering fewer sounds at once on phones would lower it. That is left open until a real device shows trouble. Desktop sound is untouched.

## 5. Audio and lifecycle on phones

Audio (`engine/audio/audio.ts`):
- **Unlock** listens for `pointerdown`, `pointerup`, `touchend`, `mousedown`, `click` and `keydown`, and plays a silent buffer inside the gesture (the iOS trick). Unchanged.
- **iOS interruptions** (call, Siri, alarm) put the context into `interrupted` [14]. That used to map to `unavailable`, which silenced the game until a reload. Now `interrupted` and `suspended` both count as a pause, and only `closed` is final.
- **Re-arm.** Whenever the context is not running but should be (interrupted, suspended by the OS in the background, a resume refused), the gesture listeners are armed again, so the next tap brings sound back. `pageshow`, `focus` and `resume` also try a resume without a tap.
- **Backgrounding.** The game suspends audio on `visibilitychange`, `pagehide` and `freeze`, and resumes on return. Suspend-then-resume is also the workaround for WebKit's silent-after-background bug [15].
- **The silent switch** mutes us on iOS, the same as most web games (ambient session). Proposal for the PM: leave it. `'playback'` would play through the switch but pause the player's own music.

Lifecycle (`watchLifecycle` in `engine/platform/environment.ts`, used by `game/ctx.ts`):
- `visibilitychange`→hidden, `pagehide` (even while still "visible", as on an iOS app switch) and `freeze` (Chrome on Android) all stop the loop, commit play time and flush the save. `visibilitychange`→visible, `pageshow` and `resume` start it again.
- The save store also flushes on `freeze` (it already flushed on `pagehide` and hidden).
- Device loss: unchanged. The loop and audio halt, the save flushes, and the Reload screen shows. Re-creating the device in place is left open.
- Orientation flips: ten landscape↔portrait flips leave exactly the same GPU textures and bytes live (section 4).
- Covered by `tests/e2e/lifecycle.spec.ts`: hide/show, pagehide/pageshow and freeze/resume each flush the save, stop and restart frames, and suspend and resume audio.

## 6. Real-device checklist (for the user)

Use an iPhone on iOS 26+ in Safari and, if possible, an Android 12+ phone in Chrome. Play in landscape. Phone not on a charger, Low Power Mode off unless a step says otherwise.

**Perf**
- [ ] The title appears within about 5 s on Wi-Fi. No "WebGPU is not available" screen.
- [ ] The hall feels smooth: a steady 60, or a steady 30 with no stutter. Not jumpy.
- [ ] The ending (gold flood) does not stall.

**Audio**
- [ ] Ringer on: sound starts on the first tap.
- [ ] Ringer (silent switch) off: no sound. This is expected; note it.
- [ ] During play, trigger Siri, or call the phone and decline. Sound comes back on its own, or on the next tap.
- [ ] Play music in another app, then open the game. Note whether the music pauses.

**Backgrounding**
- [ ] Mid-hall, go to the home screen for 30 s, then come back. The game is where you left it, with sound.
- [ ] Do the same for 10 min with other apps open. If the page reloads, progress (placements, pages found) is still there.
- [ ] Lock the screen, unlock, and come back. Same result.
- [ ] Rotate to portrait and back several times. No crash, no black screen.

**Battery and thermal (10 min)**
- [ ] Play continuously for 10 min. Note battery % before and after (rough guide: under ~8%).
- [ ] The phone gets warm but not hot. The frame rate does not degrade into stutter; a steady 30 is fine.
- [ ] Turn Low Power Mode on and play for a minute. It should be a steady 30 and still playable.

**If anything fails:** note the phone model, OS version, browser, and what you saw. On Android, `chrome://gpu` shows the GPU.
