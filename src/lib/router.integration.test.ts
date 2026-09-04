import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { TimetableData } from '../types'
import { recommendRoutes } from './router'

const load = (name: string): TimetableData =>
  JSON.parse(readFileSync(new URL(`../../public/data/2026-09/${name}.json`, import.meta.url), 'utf8')) as TimetableData

describe('暫定時刻表での経路探索', () => {
  const timetables = [load('weekday-inner'), load('weekday-outer')]

  it('東京から約2時間後に東京へ戻れる', () => {
    const routes = recommendRoutes(timetables, {
      origin: 'tokyo',
      destination: 'tokyo',
      startTime: 600,
      durationMinutes: 120,
    })
    expect(routes.length).toBeGreaterThan(0)
    expect(routes[0].route.arrivalTime).toBeGreaterThanOrEqual(700)
    expect(routes[0].route.transfers).toBe(0)
    expect(routes[0].route.legs[0].trainIds.length).toBeGreaterThan(1)
  })

  it('別駅を目的地にできる', () => {
    const routes = recommendRoutes(timetables, {
      origin: 'shinjuku',
      destination: 'shinagawa',
      startTime: 720,
      durationMinutes: 90,
    })
    expect(routes.length).toBeGreaterThan(0)
    expect(routes[0].route.legs.at(-1)?.alightStation).toBe('shinagawa')
  })
})
