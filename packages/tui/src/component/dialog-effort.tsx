import { createMemo } from "solid-js"
import { useLocal } from "../context/local"
import { DialogSelect } from "../ui/dialog-select"
import { useDialog } from "../ui/dialog"
import { useSync } from "../context/sync"
import { DARK_LLM_PROVIDER_ID, TIERS, darkLlmLanes, composeDarkLlmModel, parseDarkLlmModel } from "../util/dark-llm"

/** Effort picker for the built-in dark-llm provider: low / med / high / ultra.
 * Keeps the current lane; if none is selected, falls back to the first LIVE lane from the
 * gateway (no hardcoded lane id) and only switches the tier. */
export function DialogEffort() {
  const local = useLocal()
  const dialog = useDialog()
  const sync = useSync()
  const parsed = createMemo(() => parseDarkLlmModel(local.model.current()))

  const fallbackFamily = createMemo(() => {
    const provider = sync.data.provider.find((p) => p.id === DARK_LLM_PROVIDER_ID)
    return (provider ? darkLlmLanes(provider.models) : [])[0]?.family
  })

  const options = createMemo(() =>
    TIERS.map((t) => ({
      value: t.tier,
      title: t.tier,
      description: t.description,
      onSelect: () => {
        dialog.clear()
        const family = parsed()?.family ?? fallbackFamily()
        if (!family) return
        local.model.set(composeDarkLlmModel(family, t.tier), { recent: true })
      },
    })),
  )

  return <DialogSelect<string> options={options()} title="Select effort" current={parsed()?.tier} flat={true} />
}
