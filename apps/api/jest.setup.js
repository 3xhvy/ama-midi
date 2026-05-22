// Prevent macOS/Electron localStorage from leaking into jest-environment-node
try {
  delete global.localStorage
} catch (_) {}
try {
  delete global.sessionStorage
} catch (_) {}
