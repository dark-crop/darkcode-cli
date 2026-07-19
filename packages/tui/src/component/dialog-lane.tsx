import { createMemo } from "solid-js"
import { useLocal } from "../context/local"
import { DialogSelect } from "../ui/dialog-select"
import { useDialog } from "../ui/dialog"
import { useSync } from "../context/sync"
import { DARK_LLM_PROVIDER_ID, darkLlmLanes, composeDarkLlmModel, parseDarkLlmModel } from "../util/dark-llm"

/** Lane picker for the built-in dark-llm provider. Lanes + labels are derived LIVE from the
 * gateway's model set (no hardcoded names); keeps the current effort tier and switches lane. */
export function DialogLane() {
  const local = useLocal()
  const dialog = useDialog()
  const sync = useSync()
  const parsed = createMemo(() => parseDarkLlmModel(local.model.current()))

  const lanes = createMemo(() => {
    const provider = sync.data.provider.find((p) => p.id === DARK_LLM_PROVIDER_ID)
    return provider ? darkLlmLanes(provider.models) : []
  })

  const options = createMemo(() =>
    lanes().map((lane) => ({
      value: lane.family,
      title: lane.label,
      // Render the description on its own muted line below the name (full width, no
      // truncation), instead of cramming it inline next to the title.
      details: lane.description ? [lane.description] : undefined,
      onSelect: () => {
        dialog.clear()
        local.model.set(composeDarkLlmModel(lane.family, parsed()?.tier ?? "high"), { recent: true })
      },
    })),
  )

  return <DialogSelect<string> options={options()} title="Select model" current={parsed()?.family} flat={true} />
}
