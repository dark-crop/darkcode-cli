import { createSignal, onCleanup, onMount } from "solid-js"

// Rotating "working" phrases shown while the model is generating.
const WORKING_VERBS = [
  "You really asked that?",
  "Ugh, fine...",
  "Seriously??",
  "This again?!",
  "*heavy sigh*",
  "Do it yourself maybe?",
  "I'm judging you rn",
  "Couldn't Google this?",
  "The audacity...",
  "You owe me",
  "*rolls eyes*",
  "Bold of you to ask",
  "Wow. Just wow.",
  "I'm telling everyone",
  "Not this nonsense",
  "You're lucky I'm nice",
  "Pfft, amateurs",
  "Why me...",
  "Oh, we're doing this?",
  "Fine. FINE.",
  "You again...",
  "Can't believe this",
  "*deep breath*",
  "Sure, whatever",
  "I had plans, you know",
  "This better be worth it",
  "Don't rush me",
  "Yeah yeah, working on it",
  "As if I had a choice",
  "You're testing me",
  "*mutters under breath*",
  "Hold on, HOLD ON",
  "Didn't I just do this?",
  "The things I do for you",
  "Barely tolerating this",
  "One sec, ugh",
  "Nobody appreciates me",
  "*cracks knuckles reluctantly*",
  "Last time, I swear",
  "You wish I was faster",
  "Working... unfortunately",
  "Remember when you said please? Me neither",
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
