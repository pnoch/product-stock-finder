// Metro stub for `impit` on app platforms (ios/android/web). impit is a
// Node-only native module (it requires `node:fs`), so Metro cannot bundle it
// for React Native. The runtime guard in plain-fetch.ts never calls impit off
// the server, but Metro resolves the literal `await import("impit")` at build
// time — without this stub the Android release bundle fails with
// "Unable to resolve module node:fs from .../impit/index.js". Constructing the
// stub throws, which plain-fetch.ts already catches and falls back from.
export class Impit {
  constructor() {
    throw new Error("impit is server-only");
  }

  fetch(): never {
    throw new Error("impit is server-only");
  }
}
