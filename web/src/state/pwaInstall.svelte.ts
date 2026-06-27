// Captures the browser's deferred PWA install prompt so the UI can offer an
// "アプリをインストール" affordance at a moment of the user's choosing.
//
// `beforeinstallprompt` is non-standard and not present in the default DOM lib
// types, so the event is handled as a plain `Event` and cast where its custom
// `prompt()` method is needed. This keeps the module dependency-free and
// type-clean for `pnpm build`.
class PwaInstall {
  #deferred: any = null
  canInstall = $state(false)

  constructor() {
    if (typeof window === 'undefined') return
    window.addEventListener('beforeinstallprompt', (e: Event) => {
      // Prevent the default mini-infobar so we can surface our own affordance.
      e.preventDefault()
      this.#deferred = e
      this.canInstall = true
    })
    window.addEventListener('appinstalled', () => {
      this.canInstall = false
      this.#deferred = null
    })
  }

  async prompt(): Promise<void> {
    const e = this.#deferred
    if (!e) return
    // The prompt can only be used once; release it regardless of outcome.
    this.#deferred = null
    this.canInstall = false
    try {
      await e.prompt()
    } catch {
      /* user dismissed */
    }
  }
}

export const pwaInstall = new PwaInstall()
