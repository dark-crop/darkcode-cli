#!/usr/bin/env bun
// Re-applies darkcode's patched @opentui/core native library (Thai / complex-script width fix +
// terminal-native contiguous rendering + alt-scroll disable) after install. A plain `bun install`
// pulls the unpatched upstream binary, so we copy our vendored, pre-built dylib back over it.
//
// - darwin-arm64 only (that's the platform we built); no-op everywhere else.
// - Pinned to @opentui/core 0.4.5 (the version the dylib's ABI matches). If the catalog is bumped,
//   this stops matching and safely does nothing instead of risking an ABI mismatch/crash.
// - Idempotent, best-effort: never fails the install.
import path from "node:path"
import fs from "node:fs"
import { $, Glob } from "bun"

async function main() {
  if (process.platform !== "darwin" || process.arch !== "arm64") return

  const root = path.join(import.meta.dir, "..")
  const vendored = path.join(root, "vendor", "opentui", "libopentui-darwin-arm64.dylib")
  if (!fs.existsSync(vendored)) return

  const glob = new Glob("node_modules/.bun/@opentui+core-darwin-arm64@0.4.5*/node_modules/@opentui/core-darwin-arm64/libopentui.dylib")
  let patched = 0
  // dot: true so it descends into the hidden `.bun` store directory.
  for await (const rel of glob.scan({ cwd: root, dot: true })) {
    const target = path.join(root, rel)
    try {
      fs.copyFileSync(vendored, target)
      await $`codesign --force -s - ${target}`.quiet().nothrow() // ad-hoc sign so macOS loads it
      patched++
    } catch {}
  }
  if (patched) console.log(`darkcode: applied opentui Thai/render fix to ${patched} native lib(s)`)
}

main().catch(() => {})
