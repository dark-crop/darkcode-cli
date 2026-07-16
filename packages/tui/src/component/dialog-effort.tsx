import { createMemo } from "solid-js"
import { useLocal } from "../context/local"
import { DialogSelect } from "../ui/dialog-select"
import { useDialog } from "../ui/dialog"
import { TIERS, composeDarkLlmModel, parseDarkLlmModel } from "../util/dark-llm"

/** Effort picker for the built-in dark-llm provider: low / med / high / ultra.
 * Keeps the current lane (default Chang) and only switches the tier. */
export function DialogEffort() {
  const local = useLocal()
  const dialog = useDialog()
  const parsed = createMemo(() => parseDarkLlmModel(local.model.current()))

  const options = createMemo(() =>
    TIERS.map((t) => ({
      value: t.tier,
      title: t.tier,
      description: t.description,
      onSelect: () => {
        dialog.clear()
        local.model.set(composeDarkLlmModel(parsed()?.family ?? "thor", t.tier), { recent: true })
      },
    })),
  )

  return <DialogSelect<string> options={options()} title="Select effort" current={parsed()?.tier} flat={true} />
}
