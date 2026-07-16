import type { ConfigV1 } from "@opencode-ai/core/v1/config/config"

/**
 * The "dark-llm" provider is baked into darkcode as a zero-config default: a fresh
 * install can list/use these models without the user writing any provider config.
 * User config (global `opencode.json`, project `.opencode/opencode.json`, etc.) is
 * layered on top of this at merge time, so any of this can still be overridden -
 * including disabling it entirely via `disabled_providers: ["dark-llm"]`.
 */
export const DARK_LLM_PROVIDER_ID = "dark-llm"
export const DARK_LLM_BASE_URL = "https://dark-llm.cropbinary.com/v1"
export const DARK_LLM_DEFAULT_MODEL_ID = "thor-med"
export const DARK_LLM_ENV_KEY = "DARK_LLM_KEY"

type BuiltinModel = NonNullable<ConfigV1.Info["provider"]>[string]["models"] extends infer M
  ? M extends Record<string, infer V>
    ? V
    : never
  : never

const RELEASE_DATE = "2026-01-01"

type Tier = "low" | "med" | "high" | "ultra"

const TIERS: { key: Tier; context: number; output: number }[] = [
  { key: "low", context: 64_000, output: 4_096 },
  { key: "med", context: 128_000, output: 8_192 },
  { key: "high", context: 200_000, output: 16_384 },
  { key: "ultra", context: 256_000, output: 32_768 },
]

function textModel(name: string, family: string, tier: (typeof TIERS)[number], reasoning: boolean): BuiltinModel {
  return {
    name,
    family,
    release_date: RELEASE_DATE,
    // The chat lanes are vision-capable (llama.cpp mmproj projector), so they accept images.
    attachment: true,
    reasoning,
    temperature: true,
    tool_call: true,
    limit: { context: tier.context, output: tier.output },
    modalities: { input: ["text", "image"], output: ["text"] },
  }
}

function tieredModels(
  family: string,
  label: string,
  opts: { reasoningTiers?: Tier[] } = {},
): Record<string, BuiltinModel> {
  const reasoningTiers = new Set(opts.reasoningTiers ?? [])
  const out: Record<string, BuiltinModel> = {}
  for (const tier of TIERS) {
    out[`${family}-${tier.key}`] = textModel(`${label} · ${tier.key}`, family, tier, reasoningTiers.has(tier.key))
  }
  return out
}

export function darkLlmModels(): Record<string, BuiltinModel> {
  return {
    ...tieredModels("loki", "Loki"),
    ...tieredModels("thor", "Thor", { reasoningTiers: ["high", "ultra"] }),
    "z-image": {
      name: "Z Image",
      family: "z-image",
      release_date: RELEASE_DATE,
      attachment: false,
      reasoning: false,
      temperature: false,
      tool_call: false,
      modalities: { input: ["text"], output: ["image"] },
    },
  }
}

const LANE_LABELS: Record<string, string> = {
  "loki": "Loki",
  "thor": "Thor",
}

/** Human display name for a gateway model id (e.g. "thor-med" -> "Thor · med"). */
export function darkLlmDisplayName(id: string): string {
  for (const [family, label] of Object.entries(LANE_LABELS)) {
    if (id.startsWith(family + "-")) return `${label} · ${id.slice(family.length + 1)}`
  }
  return id
}

/**
 * Model entry for a gateway-reported id. Reuses the rich static definition when the
 * id is one we know; otherwise derives a reasonable entry so live-discovered models
 * still appear in the picker.
 */
export function darkLlmModelFor(id: string): BuiltinModel {
  const known = darkLlmModels()[id]
  if (known) return known
  return {
    name: darkLlmDisplayName(id),
    family: id.replace(/-(low|med|high|ultra)$/, ""),
    release_date: RELEASE_DATE,
    attachment: true,
    reasoning: /-(high|ultra)$/.test(id),
    temperature: true,
    tool_call: true,
    limit: { context: 128_000, output: 8_192 },
    modalities: { input: ["text", "image"], output: ["text"] },
  }
}

/** Built-in config layer seeded as the lowest-priority base before any user config is merged in. */
export function darkLlmBuiltinConfig(): ConfigV1.Info {
  return {
    model: `${DARK_LLM_PROVIDER_ID}/${DARK_LLM_DEFAULT_MODEL_ID}`,
    provider: {
      [DARK_LLM_PROVIDER_ID]: {
        name: "Dark LLM",
        npm: "@ai-sdk/openai-compatible",
        api: DARK_LLM_BASE_URL,
        env: [DARK_LLM_ENV_KEY],
        models: darkLlmModels(),
      },
    },
  }
}
