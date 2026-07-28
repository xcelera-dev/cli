import { HttpResponse, http } from 'msw'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, expect, test } from 'vitest'

import { waitForAudit } from './audit-poll.js'
import { succeededAudit } from './test-utils.js'

const server = setupServer()
beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const AUDIT_URL = 'https://xcelera.dev/api/v1/audits/abc-123'

// Tests drive the loop by call count, not by elapsed time.
const noSleep = async () => Promise.resolve()

test('waits out a rate limit for as long as Retry-After asks', async () => {
  let calls = 0
  server.use(
    http.get(AUDIT_URL, () => {
      calls += 1
      if (calls === 1) {
        return HttpResponse.text('Too many requests', {
          status: 429,
          headers: { 'Retry-After': '45' }
        })
      }
      return HttpResponse.json({ success: true, data: succeededAudit() })
    })
  )

  const slept: number[] = []
  const result = await waitForAudit('abc-123', 'test-token', {
    timeoutSeconds: 600,
    intervalMs: 10_000,
    now: () => 0,
    sleep: async (ms) => {
      slept.push(ms)
    }
  })

  expect(result.done).toBe(true)
  expect(slept).toEqual([45_000])
})

test('caps a Retry-After that would overshoot the deadline', async () => {
  let calls = 0
  server.use(
    http.get(AUDIT_URL, () => {
      calls += 1
      if (calls === 1) {
        return HttpResponse.text('Too many requests', {
          status: 429,
          headers: { 'Retry-After': '300' }
        })
      }
      return HttpResponse.json({ success: true, data: succeededAudit() })
    })
  )

  const slept: number[] = []
  const result = await waitForAudit('abc-123', 'test-token', {
    timeoutSeconds: 60,
    intervalMs: 10_000,
    now: () => 0,
    sleep: async (ms) => {
      slept.push(ms)
    }
  })

  expect(result.done).toBe(true)
  expect(slept).toEqual([60_000])
})

test('rides out a few transient failures, then gives up', async () => {
  let calls = 0
  server.use(
    http.get(AUDIT_URL, () => {
      calls += 1
      return HttpResponse.text('Bad gateway', { status: 502 })
    })
  )

  const result = await waitForAudit('abc-123', 'test-token', {
    timeoutSeconds: 600,
    intervalMs: 0,
    now: () => 0,
    sleep: noSleep
  })

  expect(calls).toBe(4)
  expect(result).toEqual({
    done: false,
    error: expect.objectContaining({ code: 'http_error' })
  })
})

test('stops immediately on an error that will not resolve itself', async () => {
  let calls = 0
  server.use(
    http.get(AUDIT_URL, () => {
      calls += 1
      return HttpResponse.json(
        {
          success: false,
          error: { code: 'audit_not_found', message: 'No audit found.' }
        },
        { status: 404 }
      )
    })
  )

  const result = await waitForAudit('abc-123', 'test-token', {
    timeoutSeconds: 600,
    intervalMs: 0,
    now: () => 0,
    sleep: noSleep
  })

  expect(calls).toBe(1)
  expect(result).toEqual({
    done: false,
    error: expect.objectContaining({ code: 'audit_not_found' })
  })
})

test('reports each non-terminal status it observes, with elapsed time', async () => {
  const statuses = ['Scheduled', 'Running', 'Succeeded']
  server.use(
    http.get(AUDIT_URL, () =>
      HttpResponse.json({
        success: true,
        data: succeededAudit({ status: statuses.shift() as 'Running' })
      })
    )
  )

  const ticks: { status: string; elapsedMs: number }[] = []
  let clock = 0
  await waitForAudit('abc-123', 'test-token', {
    timeoutSeconds: 600,
    intervalMs: 0,
    now: () => clock,
    sleep: async () => {
      clock += 5_000
    },
    onTick: (tick) => ticks.push(tick)
  })

  expect(ticks).toEqual([
    { status: 'Scheduled', elapsedMs: 0 },
    { status: 'Running', elapsedMs: 5_000 }
  ])
})

test('a failed audit is a terminal status, not an error', async () => {
  server.use(
    http.get(AUDIT_URL, () =>
      HttpResponse.json({
        success: true,
        data: succeededAudit({ status: 'Failed' })
      })
    )
  )

  const result = await waitForAudit('abc-123', 'test-token', {
    timeoutSeconds: 600,
    intervalMs: 0,
    now: () => 0,
    sleep: noSleep
  })

  expect(result).toEqual({
    done: true,
    audit: expect.objectContaining({ status: 'Failed' })
  })
})
