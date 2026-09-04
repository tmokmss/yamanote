import { describe, expect, it } from 'vitest'
import { formatDifference, formatDuration, formatMinute, parseDateTimeInput, scheduleTypeFor } from './time'

describe('scheduleTypeFor', () => {
  it('平日・土休日・祝日を判定する', () => {
    expect(scheduleTypeFor(new Date(2026, 8, 4))).toBe('weekday')
    expect(scheduleTypeFor(new Date(2026, 8, 5))).toBe('holiday')
    expect(scheduleTypeFor(new Date(2026, 8, 21))).toBe('holiday')
  })
})

describe('表示用フォーマット', () => {
  it('翌日表記を時計時刻に戻す', () => expect(formatMinute(25 * 60 + 7)).toBe('01:07'))
  it('時間と差分を日本語にする', () => {
    expect(formatDuration(125)).toBe('2時間5分')
    expect(formatDifference(-3)).toBe('3分早着')
  })
})

describe('深夜の営業日', () => {
  it('午前3時より前は前日のダイヤとして扱う', () => {
    const parsed = parseDateTimeInput('2026-09-05T01:07')
    expect(parsed.date.getDate()).toBe(4)
    expect(parsed.minutes).toBe(25 * 60 + 7)
  })
})
