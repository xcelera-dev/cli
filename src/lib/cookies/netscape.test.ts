import { writeFileSync } from 'node:fs'

import { describe, expect, test } from '@jest/globals'
import { withTempDir } from '../test-utils.js'
import {
  parseNetscapeCookieFileContents,
  readNetscapeCookieFileSync
} from './netscape.js'

describe('netscape cookie parser', () => {
  test('parses a valid Netscape cookie line', () => {
    const contents =
      '.example.com\tTRUE\t/\tFALSE\t9999999999\tsession\tabc123\n'

    const result = parseNetscapeCookieFileContents(
      contents,
      'cookies.txt',
      new Date('2020-01-01T00:00:00Z')
    )

    expect(result.warnings).toEqual([])
    expect(result.cookies).toEqual([
      {
        name: 'session',
        value: 'abc123',
        domain: '.example.com',
        path: '/'
      }
    ])
  })

  test('ignores comments and blank lines', () => {
    const contents = [
      '# Netscape HTTP Cookie File',
      '',
      '   ',
      '.example.com\tTRUE\t/\tFALSE\t9999999999\ta\t1'
    ].join('\n')

    const result = parseNetscapeCookieFileContents(
      contents,
      'cookies.txt',
      new Date('2020-01-01T00:00:00Z')
    )

    expect(result.cookies).toHaveLength(1)
    expect(result.cookies[0]?.name).toBe('a')
  })

  test('supports #HttpOnly_ domain prefix', () => {
    const contents =
      '#HttpOnly_.example.com\tTRUE\t/\tFALSE\t9999999999\thttp\tval\n'

    const result = parseNetscapeCookieFileContents(
      contents,
      'cookies.txt',
      new Date('2020-01-01T00:00:00Z')
    )

    expect(result.cookies).toEqual([
      {
        name: 'http',
        value: 'val',
        domain: '.example.com',
        path: '/',
        httpOnly: true
      }
    ])
  })

  test('sets secure=true when secure field is TRUE', () => {
    const contents = '.example.com\tTRUE\t/\tTRUE\t9999999999\ts\tv\n'

    const result = parseNetscapeCookieFileContents(
      contents,
      'cookies.txt',
      new Date('2020-01-01T00:00:00Z')
    )

    expect(result.cookies).toEqual([
      {
        name: 's',
        value: 'v',
        domain: '.example.com',
        path: '/',
        secure: true
      }
    ])
  })

  test('drops expired cookies and returns a warning', () => {
    const now = new Date('2020-01-01T00:00:00Z')
    const nowEpochSeconds = Math.floor(now.getTime() / 1000)

    const contents = [
      `.example.com\tTRUE\t/\tFALSE\t${nowEpochSeconds - 10}\texpired\tnope`,
      `.example.com\tTRUE\t/\tFALSE\t${nowEpochSeconds + 9999}\tok\tyes`
    ].join('\n')

    const result = parseNetscapeCookieFileContents(contents, 'cookies.txt', now)

    expect(result.cookies.map((c) => c.name)).toEqual(['ok'])
    expect(result.warnings).toHaveLength(1)
    expect(result.warnings[0]).toMatch(
      /Dropped 1 expired cookie\(s\) from cookies\.txt/
    )
  })

  test('does not treat expiry=0 as expired', () => {
    const contents = '.example.com\tTRUE\t/\tFALSE\t0\tsession\tabc123\n'

    const result = parseNetscapeCookieFileContents(
      contents,
      'cookies.txt',
      new Date('2050-01-01T00:00:00Z')
    )

    expect(result.cookies).toHaveLength(1)
    expect(result.warnings).toEqual([])
  })

  test('throws on invalid field count', () => {
    expect(() =>
      parseNetscapeCookieFileContents(
        'not\ta\tvalid\tnetscape\tline',
        'cookies.txt'
      )
    ).toThrow(/expected 7 tab-separated fields/)
  })

  test('throws on invalid expiration', () => {
    const contents = '.example.com\tTRUE\t/\tFALSE\tnope\ta\t1\n'

    expect(() =>
      parseNetscapeCookieFileContents(contents, 'cookies.txt')
    ).toThrow(/Invalid expiration epoch seconds/)
  })

  test('readNetscapeCookieFileSync throws a helpful error when file is missing', async () => {
    await withTempDir(async () => {
      expect(() => readNetscapeCookieFileSync('missing.txt')).toThrow(
        /Unable to read cookie file "missing\.txt"/
      )
    })
  })

  test('readNetscapeCookieFileSync reads from disk and parses', async () => {
    await withTempDir(async () => {
      writeFileSync(
        'cookies.txt',
        '.example.com\tTRUE\t/\tFALSE\t9999999999\tsession\tabc123\n',
        'utf8'
      )

      const result = readNetscapeCookieFileSync(
        'cookies.txt',
        new Date('2020-01-01T00:00:00Z')
      )

      expect(result.cookies).toHaveLength(1)
      expect(result.cookies[0]?.name).toBe('session')
    })
  })
})
