import { expect, test, vi } from 'vitest'

import { createConsoleProgress, silentProgress } from './progress.js'

function fakeStream(isTTY: boolean) {
  const chunks: string[] = []
  return {
    chunks,
    isTTY,
    write(chunk: string) {
      chunks.push(chunk)
    }
  }
}

test('lines go to stdout as they are written', () => {
  const out = fakeStream(false)
  const err = fakeStream(true)

  const progress = createConsoleProgress(out, err)
  progress.line('first')
  progress.line('second')

  expect(out.chunks).toEqual(['first\n', 'second\n'])
  expect(err.chunks).toEqual([])
})

test('the status line is rendered on stderr, not stdout', () => {
  const out = fakeStream(false)
  const err = fakeStream(true)

  const progress = createConsoleProgress(out, err)
  progress.status('Running')
  progress.finish()

  expect(out.chunks).toEqual([])
  expect(err.chunks[0]).toContain('Running')
})

test('a line clears the status and redraws it', () => {
  const out = fakeStream(false)
  const err = fakeStream(true)

  const progress = createConsoleProgress(out, err)
  progress.status('Running')
  err.chunks.length = 0

  progress.line('a report line')
  progress.finish()

  expect(out.chunks).toEqual(['a report line\n'])
  expect(err.chunks[0]).toBe('\r\x1b[K')
  expect(err.chunks[1]).toContain('Running')
})

test('the spinner advances on a timer', () => {
  vi.useFakeTimers()
  const out = fakeStream(false)
  const err = fakeStream(true)

  const progress = createConsoleProgress(out, err)
  progress.status('Running')
  const first = err.chunks[0]

  vi.advanceTimersByTime(80)
  expect(err.chunks[1]).toContain('Running')
  expect(err.chunks[1]).not.toBe(first)

  progress.finish()
  vi.advanceTimersByTime(1000)
  expect(err.chunks.at(-1)).toBe('\r\x1b[K')
  vi.useRealTimers()
})

test('no status is written when stderr is not a TTY', () => {
  vi.useFakeTimers()
  const out = fakeStream(false)
  const err = fakeStream(false)

  const progress = createConsoleProgress(out, err)
  progress.status('Running')
  vi.advanceTimersByTime(1000)
  progress.finish()

  expect(err.chunks).toEqual([])
  vi.useRealTimers()
})

test('silentProgress writes nothing anywhere', () => {
  expect(() => {
    silentProgress.line('ignored')
    silentProgress.status('ignored')
    silentProgress.finish()
  }).not.toThrow()
})
