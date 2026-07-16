// Lane/tier helpers for the built-in dark-llm provider's tiered model ids
// (`<family>-<tier>`, e.g. "chang-code-med"). Mirrors the model set seeded by
// packages/opencode/src/config/builtin-provider.ts.
export const DARK_LLM_PROVIDER_ID = "dark-llm"

// Every chat lane reads images via its own mmproj, so there is no separate vision lane.
export const LANES = [
  {
    family: "loki",
    label: "Loki",
    description: "quick and cheap",
  },
  {
    family: "thor",
    label: "Thor",
    description: "the workhorse",
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
  return { providerID: DARK_LLM_PROVIDER_ID, modelID: `${family}-${tier}` }
}
