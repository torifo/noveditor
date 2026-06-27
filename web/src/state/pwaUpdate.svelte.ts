// Tracks whether a newer build of the app is waiting in the service worker, so
// the UI can offer an "更新" (apply now) affordance at a moment of the user's
// choosing. Mirrors `pwaInstall` — a dependency-free reactive singleton.
//
// Wiring lives in `src/main.ts`: with `registerType: 'prompt'`, a new service
// worker installs but waits; vite-plugin-pwa's `onNeedRefresh` then calls
// `bind()` with a closure that applies the update (`updateSW(true)` skips waiting
// and reloads). Until the user acts, the current version keeps running.
class PwaUpdate {
  needRefresh = $state(false)
  // The apply closure (`() => updateSW(true)`); null until an update is pending.
  #apply: (() => Promise<void>) | null = null

  /** Called from main.ts when a new version is waiting. */
  bind(apply: () => Promise<void>): void {
    this.#apply = apply
    this.needRefresh = true
  }

  /** Apply the pending update: activates the new SW and reloads the page. */
  async update(): Promise<void> {
    const apply = this.#apply
    if (!apply) return
    this.needRefresh = false
    await apply()
  }

  /** Postpone: hide the prompt; it reappears on the next visit while pending. */
  dismiss(): void {
    this.needRefresh = false
  }
}

export const pwaUpdate = new PwaUpdate()
