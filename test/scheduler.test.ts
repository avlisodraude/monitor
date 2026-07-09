import { parseInterval } from '../src/scheduler.js'

// parseInterval builds each unit from an independent, non-anchored regex
// (/(\d+)h/, /(\d+)m/, /(\d+)s/) and sums whatever matches. That means it
// only ever validates that *some* recognized unit is present somewhere in
// the string — it never validates that the *whole* string is a well-formed
// interval. The passing cases below pin that actual behaviour, including
// the accidental leniency (plural/abbreviated units happen to parse only
// because the regex ignores trailing garbage). The .skip cases at the
// bottom are cases where that leniency crosses from "harmless" to
// "silently wrong" — see the comment on each.

describe('parseInterval — valid formats', () => {
  test.each([
    ['30s', 30_000],
    ['5m', 300_000],
    ['1h', 3_600_000],
    ['2h30m', 9_000_000],
    ['1h5m30s', 3_930_000],
  ])('%s -> %dms', (input, expected) => {
    expect(parseInterval(input)).toBe(expected)
  })
})

describe('parseInterval — whitespace', () => {
  test.each([
    [' 5m ', 300_000],
    ['1h 30m', 5_400_000],
    ['  1h  30m  ', 5_400_000],
  ])('%j -> %dms', (input, expected) => {
    expect(parseInterval(input)).toBe(expected)
  })
})

describe('parseInterval — case sensitivity', () => {
  test.each([
    ['1H', 3_600_000],
    ['5M', 300_000],
    ['30S', 30_000],
  ])('%s -> %dms', (input, expected) => {
    expect(parseInterval(input)).toBe(expected)
  })
})

// These are not "supported plural forms" by design — the function has no
// notion of a unit word boundary. It matches the leading digit+letter
// (e.g. "5m" inside "5mins") and silently discards whatever text follows.
// Pinning this documents the accident so a future refactor notices if it
// changes, without asserting it's the *desired* behaviour.
describe('parseInterval — incidental leniency (trailing text after a valid unit is ignored)', () => {
  test.each([
    ['5mins', 300_000],
    ['2hours', 7_200_000],
    ['30secs', 30_000],
    ['2hrs', 7_200_000],
  ])('%s -> %dms (trailing chars silently dropped)', (input, expected) => {
    expect(parseInterval(input)).toBe(expected)
  })
})

describe('parseInterval — rejects input with no recognizable unit', () => {
  test.each([
    ['90x'],
    ['abc'],
    ['h'],
    ['m5'],
    [''],
    ['   '],
    ['0'],
  ])('%j throws', (input) => {
    expect(() => parseInterval(input)).toThrow(/Invalid interval/)
  })
})

describe('parseInterval — zero-duration with an explicit unit', () => {
  // "0s"/"0m"/"0h" are well-formed (a real unit, a real number) but the
  // total is 0ms, which the function can't distinguish from "nothing
  // matched" — it throws the same generic "Invalid interval" error as
  // garbage input like "90x". Documenting current behaviour; whether a
  // zero-duration interval should be its own distinct error (or valid,
  // e.g. for tests) is a product decision, not something to silently fix here.
  test.each([['0s'], ['0m'], ['0h']])('%j throws the generic invalid-interval error', (input) => {
    expect(() => parseInterval(input)).toThrow(/Invalid interval/)
  })
})

describe('parseInterval — known-wrong behaviour (documented, not fixed here)', () => {
  // Bug 1: a valid unit followed by garbage is silently accepted, ignoring
  // the garbage entirely, instead of being rejected as a malformed interval.
  test.skip('1h5x should be rejected as malformed, not silently parsed as "1h"', () => {
    expect(() => parseInterval('1h5x')).toThrow(/Invalid interval/)
  })

  // Bug 2: a leading "-" is not part of \d+, so "-5m" matches "5m" and the
  // sign is silently dropped — parseInterval('-5m') currently returns
  // +300_000, the same as '5m'. A negative interval should be rejected,
  // not silently turned positive (a scheduler that accepts this could end
  // up scheduling based on a magnitude the caller never intended).
  test.skip('-5m should be rejected, not silently treated as +5m', () => {
    expect(() => parseInterval('-5m')).toThrow(/Invalid interval/)
  })

  // Bug 3: the regex has no decimal-point awareness, so "1.5h" is not
  // parsed as 1.5 hours. Instead /(\d+)h/ matches the "5h" substring at
  // the end of "1.5h" and the "1." is silently discarded — parseInterval
  // returns 18_000_000ms (5 hours), not the ~5_400_000ms (1.5 hours) a
  // caller would reasonably expect. This is the most dangerous case found:
  // there's no thrown error at all, just a wrong answer, and it's off by
  // more than 3x in this example.
  test.skip('1.5h should parse as 1.5 hours (5_400_000ms), not silently as 5h', () => {
    expect(parseInterval('1.5h')).toBe(5_400_000)
  })
})
