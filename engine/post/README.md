# engine/post

`PostStack` turns the renderer's HDR colour and emissive targets into the final swapchain
image. Every pass can be toggled, and every parameter can change at runtime.

```ts
import { PostStack } from '@engine/post';

const post = new PostStack(renderer, {
  godRays: { x: 960, y: -60 },   // light point in logical px (may be off-screen)
  fog: { density: 0.7 },
});
renderer.post = post;

post.set({ bloom: { intensity: 1.2 }, grade: { saturation: 1.2 } }); // merges per section
post.settings.fog.enabled = false;                                   // or mutate directly
```

Settings are packed into one uniform buffer each frame. Changing them never rebuilds
pipelines or bind groups.

## Passes, in order

| Pass | Where | Key settings |
|---|---|---|
| Bloom prefilter | half res | `threshold`, `knee` (soft knee on scene colour), `emissiveWeight` (the emissive target always blooms). Karis average to stop fireflies. |
| Bloom down/up | half-res mip chain, `levels` deep | 13-tap downsample, 9-tap tent upsample blended by `scatter` |
| God rays | half res | `x, y` light point, `intensity`, `decay`, `density`, `weight`, `color`. Marches 64 samples radially over a light disc (`sourceRadius`, `sourceIntensity`) plus `bloomSource` × bloom, so bright things in the scene also cast shafts. |
| Composite | full res → swapchain | colour + emissive + `bloom.intensity` × bloom + rays, then fog, exposure, tonemap, grade, vignette, dither |

- **Fog** is a screen-space floor mist: a height band from `top` to `bottom` (0..1 of the
  screen, measured down) shaped by `falloff`. Animated fbm sets `noiseScale` and `speed`.
  `lightScatter` tints the mist with nearby bloom so glowing objects light it up.
- **Tonemap** is `'aces'` (the default), `'reinhard'`, or `'none'`, applied after `exposure`.
- **Grade** applies `lift`, `gamma`, and `gain` (RGB each), then `saturation` and `contrast`.
  It runs in display space after tonemapping.
- **Vignette** takes `intensity`, `radius`, `softness`, and `color`.
- **Dither** adds ±½ LSB of noise to hide banding in dark gradients.

When bloom is disabled the bloom chain is skipped. It still runs if god rays need it
(`bloomSource > 0`).

## Notes

- `defaultPostSettings()` is tuned for a dark, jewel-toned scene: a strong emissive glow, a
  cool mist on the floor, and pale storm rays from above.
- Output is encoded to sRGB in the shader because the swapchain is `bgra8unorm`.
- All intermediate textures are reallocated only on resize.
- Write your own processor by implementing `PostProcessor { resize(w, h); encode(encoder,
  inputs, outputView) }` and assigning it to `renderer.post`.
