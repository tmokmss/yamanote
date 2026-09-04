import { describe, expect, it } from 'vitest'
import type { TimetableData } from '../types'
import { buildVehicleRuns, recommendRoutes } from './router'

const timetable: TimetableData = {
  schemaVersion: 1,
  provisional: true,
  revision: 'test',
  generatedAt: '2026-09-04T00:00:00Z',
  scheduleType: 'weekday',
  direction: 'outer',
  trains: [
    {
      id: '101G',
      continuesAs: '201G',
      stops: [
        { station: 'tokyo', departure: 600 },
        { station: 'osaki', arrival: 630 },
      ],
    },
    {
      id: '201G',
      stops: [
        { station: 'osaki', departure: 631 },
        { station: 'tokyo', arrival: 661 },
      ],
    },
  ],
}

describe('buildVehicleRuns', () => {
  it('大崎をまたぐ同一車両をひとつの運行としてつなぐ', () => {
    const [run] = buildVehicleRuns(timetable)
    expect(run.stops).toHaveLength(3)
    expect(run.stops[1]).toMatchObject({ station: 'osaki', arrival: 630, departure: 631 })
  })
})

describe('recommendRoutes', () => {
  it('乗り換えず元の駅へ戻る候補を返す', () => {
    const [recommendation] = recommendRoutes([timetable], {
      origin: 'tokyo',
      destination: 'tokyo',
      startTime: 595,
      durationMinutes: 65,
    })
    expect(recommendation.route.transfers).toBe(0)
    expect(recommendation.route.arrivalTime).toBe(661)
    expect(recommendation.route.legs[0].trainIds).toEqual(['101G', '201G'])
  })
})
