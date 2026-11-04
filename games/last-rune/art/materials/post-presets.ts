/**
 * Post-stack presets per scene (see `docs/design/art-direction.md` §4).
 * Apply with `post.set(POST_PRESETS.altar)`. Each preset sets every section, so switching
 * scenes never leaks settings from the previous one.
 */
import type { PostSettingsPatch } from '@thunderclap/engine/post';

export type PostPresetName = 'title' | 'hall' | 'altar' | 'codex' | 'journal' | 'ending';

const MIST: [number, number, number] = [0.1, 0.125, 0.19];

export const POST_PRESETS: Readonly<Record<PostPresetName, PostSettingsPatch>> = {
  title: {
    bloom: { enabled: true, intensity: 1.1, threshold: 1.3, scatter: 0.8, emissiveWeight: 1 },
    fog: {
      enabled: true,
      color: MIST,
      density: 0.75,
      top: 0.5,
      bottom: 1.0,
      falloff: 1.5,
      noiseScale: 2.6,
      speed: 0.05,
      lightScatter: 0.9,
    },
    godRays: { enabled: true, x: 960, y: -120, intensity: 0.3, bloomSource: 0.15 },
    vignette: {
      enabled: true,
      intensity: 0.8,
      radius: 0.5,
      softness: 0.6,
      color: [0.01, 0.01, 0.03],
    },
    grade: {
      enabled: true,
      exposure: 1.05,
      saturation: 1.2,
      contrast: 1.06,
      lift: [0.004, 0.004, 0.012],
      gamma: [1, 1, 1],
      gain: [1.04, 1.0, 0.96],
    },
  },
  hall: {
    bloom: { enabled: true, intensity: 0.9, threshold: 1.3, scatter: 0.75, emissiveWeight: 1 },
    fog: {
      enabled: true,
      color: MIST,
      density: 0.7,
      top: 0.62,
      bottom: 1.0,
      falloff: 1.7,
      noiseScale: 3.0,
      speed: 0.04,
      lightScatter: 0.8,
    },
    godRays: { enabled: true, x: 960, y: -80, intensity: 0.4, bloomSource: 0.2 },
    // Lifted a touch (was 0.7 / 0.55) so the corner niches and floor props read.
    vignette: {
      enabled: true,
      intensity: 0.6,
      radius: 0.6,
      softness: 0.55,
      color: [0.01, 0.01, 0.03],
    },
    grade: {
      enabled: true,
      exposure: 1,
      saturation: 1.15,
      contrast: 1.05,
      lift: [0.0, 0.004, 0.014],
      gamma: [1, 1, 1],
      gain: [1, 1, 1],
    },
  },
  altar: {
    bloom: { enabled: true, intensity: 0.85, threshold: 1.4, scatter: 0.7, emissiveWeight: 1 },
    fog: {
      enabled: true,
      color: MIST,
      density: 0.55,
      top: 0.72,
      bottom: 1.0,
      falloff: 1.8,
      noiseScale: 3.2,
      speed: 0.04,
      lightScatter: 0.7,
    },
    godRays: { enabled: true, x: 960, y: -160, intensity: 0.18, bloomSource: 0.08 },
    vignette: {
      enabled: true,
      intensity: 0.7,
      radius: 0.55,
      softness: 0.55,
      color: [0.01, 0.01, 0.03],
    },
    grade: {
      enabled: true,
      exposure: 1,
      saturation: 1.15,
      contrast: 1.05,
      lift: [0.002, 0.003, 0.01],
      gamma: [1, 1, 1],
      gain: [1.02, 1, 0.98],
    },
  },
  codex: {
    bloom: { enabled: true, intensity: 0.7, threshold: 1.5, scatter: 0.65, emissiveWeight: 0.9 },
    fog: { enabled: false },
    godRays: { enabled: false },
    vignette: {
      enabled: true,
      intensity: 0.85,
      radius: 0.45,
      softness: 0.6,
      color: [0.01, 0.008, 0.02],
    },
    grade: {
      enabled: true,
      exposure: 0.95,
      saturation: 1.05,
      contrast: 1.04,
      lift: [0.004, 0.003, 0.008],
      gamma: [1, 1, 1],
      gain: [1.03, 1, 0.95],
    },
  },
  journal: {
    bloom: { enabled: true, intensity: 0.6, threshold: 1.5, scatter: 0.7, emissiveWeight: 0.9 },
    fog: { enabled: false },
    godRays: { enabled: false },
    vignette: {
      enabled: true,
      intensity: 0.85,
      radius: 0.45,
      softness: 0.65,
      color: [0.03, 0.012, 0.004],
    },
    grade: {
      enabled: true,
      exposure: 1.05,
      saturation: 1.0,
      contrast: 1.05,
      lift: [0.012, 0.006, 0.0],
      gamma: [1, 1, 1],
      gain: [1.08, 1.0, 0.88],
    },
  },
  ending: {
    bloom: { enabled: true, intensity: 1.4, threshold: 1.1, scatter: 0.85, emissiveWeight: 1.1 },
    fog: {
      enabled: true,
      color: [0.22, 0.16, 0.08],
      density: 0.6,
      top: 0.55,
      bottom: 1.0,
      falloff: 1.5,
      noiseScale: 2.6,
      speed: 0.05,
      lightScatter: 1.2,
    },
    godRays: {
      enabled: true,
      x: 960,
      y: 520,
      intensity: 0.7,
      color: [1.0, 0.8, 0.45],
      sourceRadius: 220,
      bloomSource: 0.4,
    },
    vignette: {
      enabled: true,
      intensity: 0.45,
      radius: 0.6,
      softness: 0.55,
      color: [0.02, 0.01, 0.0],
    },
    grade: {
      enabled: true,
      exposure: 1.1,
      saturation: 1.25,
      contrast: 1.05,
      lift: [0.01, 0.006, 0.0],
      gamma: [1, 1, 1],
      gain: [1.08, 1.0, 0.9],
    },
  },
};
