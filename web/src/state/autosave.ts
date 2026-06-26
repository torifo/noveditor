/**
 * Trailing-edge debounce helper used for autosave.
 *
 * `schedule()` (re)starts the timer; the callback fires once the caller stops editing for
 * `delayMs`. `flush()` runs a pending callback immediately (used before switching/deleting so the
 * current buffer is persisted first). `cancel()` drops a pending callback.
 */
export class Debouncer {
  private timer: ReturnType<typeof setTimeout> | null = null

  constructor(
    private readonly delayMs: number,
    private readonly fn: () => void,
  ) {}

  schedule(): void {
    this.cancel()
    this.timer = setTimeout(() => {
      this.timer = null
      this.fn()
    }, this.delayMs)
  }

  /** Run a pending callback now (no-op if nothing scheduled). */
  flush(): void {
    if (this.timer !== null) {
      this.cancel()
      this.fn()
    }
  }

  cancel(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer)
      this.timer = null
    }
  }

  get pending(): boolean {
    return this.timer !== null
  }
}
