// tutorial/sessionFlags.js
// Ephemeral, in‑memory flags that reset every app launch.
// Gate tutorial auto-start to the period *right after* Landing closes.

let landingSeenThisLaunch = false;

export function markLandingSeen() {
  landingSeenThisLaunch = true;
}

/** One-time window: allow auto-start exactly once after Landing. */
export function canAutoStartTutorial() {
  return landingSeenThisLaunch;
}

/** Consume the window so it can't auto-start again until next launch. */
export function consumeTutorialStartWindow() {
  landingSeenThisLaunch = false;
}
