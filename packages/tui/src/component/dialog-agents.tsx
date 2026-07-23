import { createMemo } from "solid-js"
import { DialogSelect } from "../ui/dialog-select"
import type { DialogContext } from "../ui/dialog"

export interface AgentSwitchOption {
  id: string
  title: string
  description?: string
}

/** Claude-style agent switcher: lists the main session plus every subagent (child) session,
 * with the active one marked. Selecting one jumps the view into that agent's live window.
 * Options are passed as a getter so the list stays live while the dialog is open (agents
 * finishing, new ones spawning). */
export function DialogAgents(props: {
  options: () => AgentSwitchOption[]
  current: string
  onSelect: (id: string) => void
}) {
  const options = createMemo(() =>
    props.options().map((o) => ({
      value: o.id,
      title: o.title,
      description: o.description,
      onSelect: (dialog: DialogContext) => {
        dialog.clear()
        props.onSelect(o.id)
      },
    })),
  )

  return <DialogSelect<string> options={options()} title="Switch agent" current={props.current} flat={true} />
}
