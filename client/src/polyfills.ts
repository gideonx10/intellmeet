declare global {
  // simple-peer depends on a browser-global named `global`.
  // Vite/modern browsers do not expose it, so we alias it to globalThis.
  var global: typeof globalThis;
}

if (typeof globalThis.global === "undefined") {
  globalThis.global = globalThis;
}
