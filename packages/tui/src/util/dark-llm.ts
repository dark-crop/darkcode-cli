// Lane/tier helpers for the built-in dark-llm provider's tiered model ids
// (`<family>-<tier>`, e.g. "chang-code-med"). Mirrors the model set seeded by
// packages/opencode/src/config/builtin-provider.ts.
export const DARK_LLM_PROVIDER_ID = "dark-llm"

// The vision lane (Qwen2.5-VL) is a single flat model id with no effort tiers, so it is
// not a `<family>-<tier>` pair. `VISION_MODEL_ID` is both its family key and its model id.
export const VISION_MODEL_ID = "qwen-vl"

export const LANES = [
  {
    family: "loki",
    label: "Loki",
    description: "fast lane - 35B-A3B MoE, quick answers and cheap fan-out",
  },
  {
    family: "thor",
    label: "Thor",
    description: "coding - 27B, the default workhorse (also thor-1m-* for ~1M context)",
  },
  {
    family: VISION_MODEL_ID,
    label: "Ta",
    description: "vision - Qwen2.5-VL-7B, reads images (no effort tiers)",
  },
] as const

export const TIERS = [
  { tier: "low", description: "thinking off - fastest, cleanest output" },
  { tier: "med", description: "thinking on - small reasoning budget" },
  { tier: "high", description: "thinking on - large reasoning budget" },
  { tier: "ultra", description: "thinking on - maximum reasoning budget" },
] as const

export type Lane = (typeof LANES)[number]["family"]
export type Tier = (typeof TIERS)[number]["tier"]

export function parseDarkLlmModel(model: { providerID: string; modelID: string } | undefined) {
  if (!model || model.providerID !== DARK_LLM_PROVIDER_ID) return undefined
  // Vision lane: a flat id, no tier.
  if (model.modelID === VISION_MODEL_ID) return { family: VISION_MODEL_ID as Lane, tier: undefined }
  for (const lane of LANES) {
    const prefix = lane.family + "-"
    if (model.modelID.startsWith(prefix)) {
      const tier = model.modelID.slice(prefix.length)
      if (TIERS.some((t) => t.tier === tier)) return { family: lane.family, tier: tier as Tier }
    }
  }
  return undefined
}

export function composeDarkLlmModel(family: Lane, tier: Tier) {
  // The vision lane ignores the effort tier (it has none), so /effort is a no-op on it.
  if (family === VISION_MODEL_ID) return { providerID: DARK_LLM_PROVIDER_ID, modelID: VISION_MODEL_ID }
  return { providerID: DARK_LLM_PROVIDER_ID, modelID: `${family}-${tier}` }
}
