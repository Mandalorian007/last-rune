# Workstream: art-props (wave 2 early start)

**Owns:** `games/last-rune/art/props/`, `games/last-rune/shaders/` (fuse, storm, bolt, machine; prefix files to avoid clashing with art-materials), `games/last-rune/scenes/_demo/props-demo.ts`.
**Depends on:** merged engine render API (`engine/render/README.md`, `engine/post/README.md`, `engine/fx`, template `scenes/_demo/render-demo.ts`).

## Deliver (all procedural, D-001)
1. **FUSE** (pitch §3): riveted brass and iron foreman robot, one warm amber eye (the other dead), clamps for hands, clipboard. Built from SDF shapes in a shader or a layered sprite rig. Animations: idle bob/hum, eye flicker, "talking" pulse, look-at (eye tracks a point), roll in/out, and a "quiet" state for Tier 3. Portrait variant for the corner caption card. His eye is a warm light source (expose its position/intensity).
2. **Storm cell**: brass-ringed crackling core. The pitch wants "a real crackling fluid, not a sprite": an animated noise/curl-flow shader with arcs, intensity for 1×/2×/4× strength (rings: 1/2/4).
3. **Bolt ribbon renderer**: draws an energised path as a glowing ribbon that changes colour at each gem. Input: a generic polyline of points with per-segment colour, charge (width/brightness), and t0/t1 timing (animates the bolt travelling). Keep it engine-agnostic of gems: the game adapts the sim trace (`rules` C2 `SimResult.trace`, segments `{from,to,charge,colour,pulse,t0,t1}`) to it. Include crackle jitter, sparks emitted along it (engine fx), an "over/breaker" variant (violent flash then sputter), and an "under" variant (fizzles out).
4. **Machine**: riveted iron box with a real gauge (needle animates to a fraction; pins at 100% on solve; red zone over 100% for breaker), dead/awake states (awake blazes cyan).
5. **Locked door / alcove plate**: a stone alcove with empty dotted sockets in the colours it needs plus a padlock (for the hall).
6. `?demo=props` (dev only) showing all of the above animating, including a fake bolt travelling a colourful path and a solve flash. Verify with Playwright screenshots (headless Chromium + `--enable-unsafe-webgpu` works on this Mac, per engine-render's log) and iterate.

Coordinate palette with `docs/design/art-direction.md` (art-materials is writing it in parallel; until it lands, use the pitch palette names and keep colours in one constants file you own: `art/props/palette.ts` → PM reconciles).

## Log

### 2026-11-02: all six deliverables done (branch `worktree-agent-a8504d5de22e236a0`)

**Files.** `art/props/{palette,lighting,fuse,fuse-portrait,storm,bolt,machine,alcove}.ts`, `shaders/{fuse,storm,bolt,machine,alcove}-shaders.ts`, `scenes/_demo/props-demo.ts` (DEV-only dynamic import in `main.ts`; verified absent from `pnpm build` output).

**API.** Every prop has `update(dt)` and `draw(frame, lights)`. `lights` is a `PropLightRig` from `lighting.ts`: up to 6 point lights shared by all prop shaders. Each prop exposes a `light`/`eye` `{x,y,intensity,color}` for feeding the rig.
- `new Fuse(renderer,{x,y,scale,facing})`: `mood` ('idle'|'talk'|'quiet'), `speak(s)`, `lookAt(x,y)|lookAt(null)`, `rollTo(x)`, `place(x)`, `eye` (light source), `state` (rig state).
- `createFusePortrait(renderer,{size,zoom})` → `{canvas, render(state?, talking?), snapshot(): Promise<ImageBitmap>}`. Pass `canvas` as `caption.say(..., {portrait})`.
- `new StormCell(renderer,{x,y,size,strength:1|2|4})`: `strength` (1/2/4 rings), `surge(k)`, `boltOrigin`, `sphere`, `light`, `destroy()`. The plasma is a 256² curl-advected feedback sim run in a prePass.
- `new BoltRibbon(renderer,{particles,width,jitter})`: `play(segs, 'exact'|'over'|'under')`, `flash()`, `fadeOut(s)`, `clear()`, `done`, `duration`, `head`, `glow`. Build segments with `boltSegmentsFromTrace(trace, cellToPx, {timeScale})` (structural `TraceSegmentLike {from,to,charge,colour,t0,t1}`; colour is a `GemKind`) or with `boltSegmentsFromPolyline(points,{colours,charges,speed})`.
- `new Machine(renderer,{x,y,size,awake})`: `gauge` (0..1.25; the needle springs to it), `awake`, `solve()` (pins at 100% and blazes cyan), `breaker()` (slams into the red zone, then drops), `reset()`, `terminal` (bolt end point), `light`.
- `new Alcove(renderer,{x,y,size})`: `setNeeds(Capability[])` (dotted sockets in gem colour; storm = zigzag; altar = square), `unlock()` (≈1.6 s: lock shakes and drops, grate lifts, sockets fill), `restore()` (warm interior, gold keystone rune), `lock()`, `set(state)`.
- Colours: `palette.ts` (`PITCH`, `PROP`, `GEM_COLOUR` kind→colour name, `pitch()`, `prop()`). The PM should reconcile this with art-direction.md.

**Demo.** `?demo=props`. It auto-cycles exact → over → under bolts. Keys: 1/2/3 fire a mode, S storm strength, F FUSE mood, R reset, C caption, H HUD. URL params: `shot=fuse|storm|machine|alcove|bolt|portrait`, `mode`, `strength`, `t`, `hold`, `nohud`, `caption`.

**Screens.** `docs/design/screens/props-{scene,fuse,caption,portrait,storm-1x,storm-4x,bolt-over,bolt-under,machine,alcove}.png`.

**Perf.** Full scene: 6 draw calls plus 1 sim prePass and particles. Holds 60 fps in headless Chromium with 0 GPU validation errors. Materials for machine and alcove are shared per renderer (consecutive draws batch). FUSE, storm and bolt each own a material because their uniforms are per-instance state.

**Engine gaps (worked around game-side; engine untouched).**
- Material uniforms are per material, and the last `setUniforms` in a frame wins. So every storm and bolt instance needs its own material, and per-sprite state goes through `params`/`tint`. An engine-side per-draw uniform slice or a larger per-instance block would help.
- No ping-pong texture helper: the storm sim writes B, then `copyTextureToTexture` B→A.
- Lighting: there is no engine light list, so props use their own 6-light `PropLightRig`. It should merge with art-materials' lighting helper.
- `SimResult.trace` isn't in `rules/types.ts` yet. `bolt.ts` uses a structural `TraceSegmentLike`; swap in the real type when C2 lands.

**Open issues.**
- The over-mode flash deliberately whites out the frame for ~0.3 s. Dial down `blow` in `bolt-shaders.ts` if it's too much (photosensitivity: consider an accessibility toggle).
- The FUSE portrait renders through its own canvas context. It's cheap, but call `render()` only while the caption shows.
- A locked alcove in a dark hall reads mostly by its socket plate. The final hall lighting (art-materials) should rake it.
