declare global {
  const OPENCODE_VERSION: string
  const OPENCODE_CHANNEL: string
}

// darkcode has no build step (it runs from source), so the upstream build-time `OPENCODE_VERSION`
// define is never present and the version would always read "local". The launcher stamps the install's
// git short-hash into DARKCODE_VERSION so `darkcode --version` shows something checkable (e.g. f3fee01).
// The CHANNEL stays "local" - that correctly gates the source-install auto-update behaviour.
export const InstallationVersion =
  typeof OPENCODE_VERSION === "string" ? OPENCODE_VERSION : process.env["DARKCODE_VERSION"] || "local"
export const InstallationChannel = typeof OPENCODE_CHANNEL === "string" ? OPENCODE_CHANNEL : "local"
export const InstallationLocal = InstallationChannel === "local"
