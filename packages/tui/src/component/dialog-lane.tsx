import { createMemo } from "solid-js"
import { useLocal } from "../context/local"
import { DialogSelect } from "../ui/dialog-select"
import { useDialog } from "../ui/dialog"
import { LANES, composeDarkLlmModel, parseDarkLlmModel } from "../util/dark-llm"

/** Lane picker for the built-in dark-llm provider: Singto / Chang / Talay.
 * Keeps the current effort tier (default med) and only switches the lane. */
export function DialogLane() {
  const local = useLocal()
  const dialog = useDialog()
  const parsed = createMemo(() => parseDarkLlmModel(local.model.current()))

  const options = createMemo(() =>
    LANES.map((lane) => ({
      value: lane.family,
      title: lane.label,
      description: lane.description,
      onSelect: () => {
        dialog.clear()
        local.model.set(composeDarkLlmModel(lane.family, parsed()?.tier ?? "med"), { recent: true })
      },
    })),
  )

  return <DialogSelect<string> options={options()} title="Select model" current={parsed()?.family} flat={true} />
}
