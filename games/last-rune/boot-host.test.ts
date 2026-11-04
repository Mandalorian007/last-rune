// @vitest-environment happy-dom
import { defaultHost, setDefaultHost } from '@thunderclap/engine/host';
import type { ThunderclapBridge } from '@thunderclap/host-electron';
import { afterEach, describe, expect, it } from 'vitest';
import { bootHost } from './boot-host';

const g = window as unknown as { thunderclap?: ThunderclapBridge };

function fakeBridge(): ThunderclapBridge & { closed: number } {
  const b = {
    closed: 0,
    version: 1,
    platform: 'darwin',
    openExternal: async () => true,
    copyText: async () => true,
    fullscreen: {
      get: async () => false,
      set: async (on: boolean) => on,
      onChange: () => () => {},
    },
    window: {
      minimize: () => {},
      toggleMaximize: () => {},
      close: () => {
        b.closed++;
      },
      setTitle: () => {},
    },
  };
  return b;
}

afterEach(() => {
  delete g.thunderclap;
  setDefaultHost(null);
});

describe('bootHost', () => {
  it('leaves the web host to createGame outside the desktop shell', async () => {
    expect(await bootHost()).toBeUndefined();
    expect(defaultHost().kind).toBe('web');
  });

  it('boots on the Electron host in the shell, as the default host too', async () => {
    const bridge = fakeBridge();
    g.thunderclap = bridge;
    const host = await bootHost();
    expect(host?.kind).toBe('electron');
    expect(defaultHost()).toBe(host);
    // The settings panel's Quit entry is gated on this.
    host?.window?.close();
    expect(bridge.closed).toBe(1);
  });

  it('ignores a stray global that is not the bridge', async () => {
    (g as Record<string, unknown>).thunderclap = { version: 1 };
    expect(await bootHost()).toBeUndefined();
  });
});
