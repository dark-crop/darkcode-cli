import { For } from "solid-js"
import { MASCOT_SPRITE, MASCOT_MINI } from "./mascot-sprite"

/**
 * The darkcode character: a purple-blob pixel sprite rendered as full terminal cells (one space
 * with a background color per pixel, like the source .ans). On a terminal (chars are ~1:2) the
 * 40x20 canvas reads ~1:1, so the blob stays round instead of stretched.
 *
 * Single source of truth - import this anywhere the mascot is shown (welcome screen, etc.) so
 * every surface renders the exact same character from the same sprite data.
 */
export function Mascot(props: { mini?: boolean }) {
  const sprite = props.mini ? MASCOT_MINI : MASCOT_SPRITE
  return (
    <box flexShrink={0}>
      <For each={sprite}>
        {(row) => (
          <text>
            <For each={row}>{(bg) => <span style={bg ? { bg } : {}}> </span>}</For>
          </text>
        )}
      </For>
    </box>
  )
}
