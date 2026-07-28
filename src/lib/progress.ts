/** A sink for output as it happens, so a long command isn't silent. */
export type Progress = {
  /** A finished line of output. */
  line(text: string): void
  /** Transient status, replaced in place by the next call. */
  status(text: string): void
  /** Clears any status still on screen. Safe to call more than once. */
  finish(): void
}

/** The default: buffer everything, print nothing. What the Action wants. */
export const silentProgress: Progress = {
  line: noop,
  status: noop,
  finish: noop
}

/**
 * Streams lines to stdout as they are produced, and renders the status as a
 * spinner on stderr so a redirected stdout stays clean. Off a TTY the status is
 * dropped entirely rather than repeated once per tick.
 */
export function createConsoleProgress(out: Out, err: Out): Progress {
  let text = ''
  let frame = 0
  let timer: NodeJS.Timeout | undefined

  function render(): void {
    err.write(`\r${CLEAR_LINE}${FRAMES[frame]} ${text}`)
    frame = (frame + 1) % FRAMES.length
  }

  return {
    line(value) {
      if (timer) err.write(`\r${CLEAR_LINE}`)
      out.write(`${value}\n`)
      if (timer) render()
    },

    status(value) {
      if (!err.isTTY) return
      text = value
      if (!timer) {
        // Unref'd so a spinner can never hold the process open.
        timer = setInterval(render, FRAME_MS)
        timer.unref()
      }
      render()
    },

    finish() {
      if (!timer) return
      clearInterval(timer)
      timer = undefined
      err.write(`\r${CLEAR_LINE}`)
    }
  }
}

function noop(): void {
  // The caller buffers instead; there is nothing to render.
}

type Out = {
  write(chunk: string): void
  isTTY?: boolean
}

const FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
const FRAME_MS = 80
const CLEAR_LINE = '\x1b[K'
