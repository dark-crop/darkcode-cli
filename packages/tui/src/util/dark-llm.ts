// Lane/tier helpers for the built-in dark-llm provider's tiered model ids (`<family>-<tier>`).
// Nothing here hardcodes a model/lane name: families are parsed straight off the gateway-reported
// ids, and lane labels come from the live model display names (which the gateway owns). Only the
// effort TIERS (low/med/high/ultra) are fixed - they are effort levels, not model names.
export const DARK_LLM_PROVIDER_ID = "dark-llm"

export const TIERS = [
  { tier: "low", description: "thinking off - fastest, cleanest output" },
  { tier: "med", description: "thinking on - small reasoning budget" },
  { tier: "high", description: "thinking on - large reasoning budget" },
  { tier: "ultra", description: "thinking on - maximum reasoning budget" },
] as const

export type Tier = (typeof TIERS)[number]["tier"]
export type Lane = string

const TIER_SUFFIX = /-(low|med|high|ultra)$/

/** Parse a dark-llm model ref into { family, tier } with no hardcoded lane list -
 *  the family is whatever prefix precedes a valid effort tier. */
export function parseDarkLlmModel(model: { providerID: string; modelID: string } | undefined) {
  if (!model || model.providerID !== DARK_LLM_PROVIDER_ID) return undefined
  const m = model.modelID.match(/^(.+)-(low|med|high|ultra)$/)
  if (!m) return undefined
  return { family: m[1], tier: m[2] as Tier }
}

export function composeDarkLlmModel(family: Lane, tier: Tier) {
  return { providerID: DARK_LLM_PROVIDER_ID, modelID: `${family}-${tier}` }
}

/** Derive the available lanes from the LIVE dark-llm model set (one entry per family).
 *  Everything is gateway-owned: the display name and the context both come from the API.
 *  We split a trailing version off the name so the picker can show it separately, e.g.
 *  name "Mr. President 1.1" + context 262144  ->  title "Mr. President", desc "1.1 · 262K".
 *  Renaming/re-versioning on the gateway flows through with zero client changes. */
export function darkLlmLanes(models: Record<string, { name?: string; family?: string; limit?: { context?: number } }>) {
  const byFamily = new Map<string, { label: string; description: string }>()
  for (const [id, info] of Object.entries(models)) {
    const m = id.match(/^(.+)-(low|med|high|ultra)$/)
    if (!m) continue
    const family = info.family ?? m[1]
    if (byFamily.has(family)) continue
    // Title = the full gateway display name (incl. version), tier suffix stripped.
    const label = (info.name ?? id).replace(/\s*·\s*(low|med|high|ultra)\s*$/i, "").trim() || family
    // Description = curated flavor copy for the president lane; generic context for others.
    const ctx = info.limit?.context
    const description =
      family === "president"
        ? "256K context · Best for complex tasks · Unlocked for president level"
        : ctx
          ? `${Math.round(ctx / 1000)}K context`
          : ""
    byFamily.set(family, { label, description })
  }
  return [...byFamily].map(([family, v]) => ({ family, label: v.label, description: v.description }))
}
