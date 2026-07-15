import { createSignal, onCleanup, onMount } from "solid-js"

// Claude Code-style rotating "working" verbs shown while the model is generating.
const WORKING_VERBS = [
  "Thinking",
  "Pondering",
  "Brewing",
  "Percolating",
  "Conjuring",
  "Weaving",
  "Crunching",
  "Distilling",
  "Scheming",
  "Tinkering",
  "Simmering",
  "Untangling",
  "Composing",
  "Sketching",
  "Forging",
  "Mulling",
  "Noodling",
  "Cooking",
]

/** A rotating working verb plus elapsed seconds, e.g. "Brewing" / 12. */
export function useWorkingVerb() {
  const [verb, setVerb] = createSignal(WORKING_VERBS[0]!)
  const [seconds, setSeconds] = createSignal(0)
  onMount(() => {
    const pick = () => setVerb(WORKING_VERBS[Math.floor(Math.random() * WORKING_VERBS.length)]!)
    pick()
    const started = Date.now()
    const tick = setInterval(() => setSeconds(Math.floor((Date.now() - started) / 1000)), 1000)
    const rotate = setInterval(pick, 12000)
    onCleanup(() => {
      clearInterval(tick)
      clearInterval(rotate)
    })
  })
  return { verb, seconds }
}
