const NodeEnvironment = require('jest-environment-node').default

// Patch globalThis.localStorage before jest-environment-node tries to access it
// (Cursor/Electron exposes a broken localStorage that throws SecurityError)
;['localStorage', 'sessionStorage'].forEach((key) => {
  try {
    const desc = Object.getOwnPropertyDescriptor(globalThis, key)
    if (desc) {
      Object.defineProperty(globalThis, key, {
        configurable: true,
        enumerable: false,
        get: () => undefined,
        set: () => {},
      })
    }
  } catch (_) {}
})

class PatchedNodeEnvironment extends NodeEnvironment {}

module.exports = PatchedNodeEnvironment
