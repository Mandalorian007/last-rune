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
