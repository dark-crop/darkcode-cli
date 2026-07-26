import { createMemo, onMount } from "solid-js"
import { useLocal } from "../context/local"
import { useTheme } from "../context/theme"
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
  const { theme } = useTheme()
  // Wider modal so the (gateway-owned) lane descriptions have room to breathe.
  onMount(() => dialog.setSize("large"))
  const parsed = createMemo(() => parseDarkLlmModel(local.model.current()))

  const lanes = createMemo(() => {
    const provider = sync.data.provider.find((p) => p.id === DARK_LLM_PROVIDER_ID)
    return provider ? darkLlmLanes(provider.models) : []
  })

  const options = createMemo(() =>
    lanes().map((lane) => {
      // Offline lanes are synced from the gateway's /app/models status page: render the name in red
      // and leave onSelect undefined so Enter is inert - you cannot switch to a lane whose backend
      // is down. Online lanes keep the muted inline description (same line as the name).
      const offline = lane.online === false
      return {
        value: lane.family,
        title: lane.label,
        titleView: offline ? <text fg={theme.error}>{lane.label} (offline)</text> : undefined,
        // DialogSelect's Option renders `description` as a muted span right after the title; `details`
        // would instead drop it onto a separate line below, which is not what we want here.
        description: lane.description,
        onSelect: offline
          ? undefined
          : () => {
              dialog.clear()
              local.model.set(composeDarkLlmModel(lane.family, parsed()?.tier ?? "high"), { recent: true })
            },
      }
    }),
  )

  return <DialogSelect<string> options={options()} title="Select model" current={parsed()?.family} flat={true} />
}
