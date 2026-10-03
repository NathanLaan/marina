// Stand-in for the `electron` module when an app's preload.js runs under
// Tauri. scripts/bundle-tauri-preload.mjs bundles the preload with
// `electron` aliased to this file, and the Rust host injects the result as
// a webview initialization script — so `window.api` has the same shape in
// both builds and the renderer doesn't know which shell it's in.
//
// Wire format (matches marina-tauri's `ipc` command):
//   ipcRenderer.invoke(channel, ...args) → invoke('ipc', { channel, args })
//   webContents.send(channel, payload)   → Tauri event named `channel`
// Binary values cross as { __marinaBytes: <base64> } in both directions. A
// handler may also return raw bytes as its whole reply, which arrives as an
// ArrayBuffer and is surfaced as a Uint8Array, like an Electron Buffer;
// markers nested inside a JSON reply become ArrayBuffers (what Electron
// delivers for `buffer.buffer`).

import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

function toBase64(bytes) {
  let bin = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}

function encode(value) {
  if (value instanceof ArrayBuffer) return { __marinaBytes: toBase64(new Uint8Array(value)) };
  if (ArrayBuffer.isView(value)) {
    return { __marinaBytes: toBase64(new Uint8Array(value.buffer, value.byteOffset, value.byteLength)) };
  }
  if (Array.isArray(value)) return value.map(encode);
  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (v !== undefined) out[k] = encode(v);
    }
    return out;
  }
  // structured-clone drops these in Electron; JSON would turn them into null.
  if (value === undefined || typeof value === 'function') return null;
  return value;
}

function fromBase64(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function decodeNested(value) {
  if (Array.isArray(value)) return value.map(decodeNested);
  if (value && typeof value === 'object') {
    if (typeof value.__marinaBytes === 'string' && Object.keys(value).length === 1) {
      return fromBase64(value.__marinaBytes).buffer;
    }
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = decodeNested(v);
    return out;
  }
  return value;
}

function decode(value) {
  return value instanceof ArrayBuffer ? new Uint8Array(value) : decodeNested(value);
}

function toError(channel, err) {
  if (err instanceof Error) return err;
  const msg = typeof err === 'string' ? err : (err?.message ?? JSON.stringify(err));
  return new Error(`Error invoking remote method '${channel}': ${msg}`);
}

// channel → Map(handler → Promise<unlisten>)
const listeners = new Map();

export const ipcRenderer = {
  invoke(channel, ...args) {
    return invoke('ipc', { channel, args: args.map(encode) }).then(decode, (err) => {
      throw toError(channel, err);
    });
  },
  send(channel, ...args) {
    ipcRenderer.invoke(channel, ...args).catch((err) => console.error(err));
  },
  on(channel, handler) {
    let byHandler = listeners.get(channel);
    if (!byHandler) listeners.set(channel, (byHandler = new Map()));
    const unlisten = listen(channel, (event) => handler({ sender: ipcRenderer }, event.payload));
    byHandler.set(handler, unlisten);
    return ipcRenderer;
  },
  once(channel, handler) {
    const wrapped = (...a) => { ipcRenderer.removeListener(channel, wrapped); handler(...a); };
    return ipcRenderer.on(channel, wrapped);
  },
  removeListener(channel, handler) {
    const byHandler = listeners.get(channel);
    const unlisten = byHandler?.get(handler);
    if (unlisten) {
      byHandler.delete(handler);
      unlisten.then((fn) => fn());
    }
    return ipcRenderer;
  },
  removeAllListeners(channel) {
    for (const handler of [...(listeners.get(channel)?.keys() ?? [])]) {
      ipcRenderer.removeListener(channel, handler);
    }
    return ipcRenderer;
  },
};

export const contextBridge = {
  exposeInMainWorld(key, api) {
    window[key] = api;
  },
};

// WebKitGTK gives dropped/picked File objects no filesystem path.
export const webUtils = {
  getPathForFile: (file) => file?.path ?? '',
};

export default { ipcRenderer, contextBridge, webUtils };
