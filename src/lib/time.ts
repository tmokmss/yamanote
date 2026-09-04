import holidayJp from '@holiday-jp/holiday_jp'
import type { ScheduleType } from '../types'

export const parseDateTimeInput = (value: string): { date: Date; minutes: number } => {
  const [datePart, timePart] = value.split('T')
  const [year, month, day] = datePart.split('-').map(Number)
  const [hour, minute] = timePart.split(':').map(Number)
  const date = new Date(year, month - 1, day)
  // Timetables treat trains after midnight as part of the previous service day.
  // The imported data therefore represents 01:00 as minute 1500.
  if (hour < 3) date.setDate(date.getDate() - 1)
  return { date, minutes: (hour < 3 ? hour + 24 : hour) * 60 + minute }
}

export const scheduleTypeFor = (date: Date): ScheduleType => {
  const day = date.getDay()
  return day === 0 || day === 6 || holidayJp.isHoliday(date) ? 'holiday' : 'weekday'
}

export const toDateTimeInput = (date: Date): string => {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export const nowForInput = (): string => {
  const now = new Date()
  now.setSeconds(0, 0)
  return toDateTimeInput(now)
}

export const formatMinute = (minutes: number): string => {
  const normalized = ((minutes % 1440) + 1440) % 1440
  const hour = Math.floor(normalized / 60)
  const minute = normalized % 60
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

export const formatDuration = (minutes: number): string => {
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours === 0) return `${rest}分`
  if (rest === 0) return `${hours}時間`
  return `${hours}時間${rest}分`
}

export const formatDifference = (minutes: number): string => {
  if (minutes === 0) return 'ぴったり'
  return `${Math.abs(minutes)}分${minutes < 0 ? '早着' : '超過'}`
}
