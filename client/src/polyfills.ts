import process from "process";
import { Buffer } from "buffer";

declare global {
  // simple-peer depends on a browser-global named `global`.
  // Vite/modern browsers do not expose it, so we alias it to globalThis.
  var global: typeof globalThis;
}

if (typeof globalThis.global === "undefined") {
  globalThis.global = globalThis;
}

// simple-peer pulls in readable-stream, which expects Node's `process`
// (process.nextTick) and `Buffer` to exist as browser globals. Without
// these, the Peer constructor throws as soon as a real remote peer connects.
if (typeof globalThis.process === "undefined") {
  globalThis.process = process;
}
if (typeof globalThis.Buffer === "undefined") {
  globalThis.Buffer = Buffer;
}
