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
export const DARK_LLM_DEFAULT_MODEL_ID = "president-high"
export const DARK_LLM_ENV_KEY = "DARK_LLM_KEY"

type BuiltinModel = NonNullable<ConfigV1.Info["provider"]>[string]["models"] extends infer M
  ? M extends Record<string, infer V>
    ? V
    : never
  : never

const RELEASE_DATE = "2026-01-01"

type Tier = "low" | "med" | "high" | "ultra"

// One lane (Mr. President) now owns the whole KV cache: every tier gets the full native 262144-token window
// (256 x 1024). Tiers differ only in reasoning effort (output/reasoning budget), not context.
// Output budgets are the max_tokens sent per request. They must be large enough to hold the
// model's (often heavy) reasoning PLUS a full answer, or the answer gets truncated once the
// reasoning eats the budget. This is a CAP, not a target - the model still stops when done -
// so generous values only prevent truncation, they don't lengthen replies.
const TIERS: { key: Tier; context: number; output: number }[] = [
  { key: "low", context: 262_144, output: 16_384 },
  { key: "med", context: 262_144, output: 24_576 },
  { key: "high", context: 262_144, output: 32_000 },
  { key: "ultra", context: 262_144, output: 32_000 },
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
    // One native-vLLM chat lane owns all KV at full 262K. The "President" label here is only an
    // OFFLINE fallback; online the brand name comes from the gateway (/model/info display_name).
    ...tieredModels("president", "President", { reasoningTiers: ["high", "ultra"] }),
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

/**
 * OFFLINE-fallback display for a gateway model id, derived purely from the id
 * (e.g. "president-med" -> "President · med"). No brand name is hardcoded here -
 * online, the real display name comes from the gateway's /model/info `display_name`
 * (see the live reconcile in provider.ts), so renaming only ever touches the gateway.
 */
export function darkLlmDisplayName(id: string): string {
  const m = id.match(/^(.*)-(low|med|high|ultra)$/)
  if (!m) return id
  const lane = m[1].charAt(0).toUpperCase() + m[1].slice(1)
  return `${lane} · ${m[2]}`
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
    limit: { context: 262_144, output: 8_192 },
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
