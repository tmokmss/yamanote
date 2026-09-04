import { describe, expect, it } from 'vitest'
import { stations } from '../data/stations'
import type { RouteLeg, RouteOption } from '../types'
import {
  labelPosition,
  mapGeometry,
  pathFromPoints,
  pointOnLoop,
  routeMapSummary,
  traceStrokeWidth,
  tracePointsForLeg,
} from './route-map'

const leg = (direction: 'inner' | 'outer', stopCount: number): RouteLeg => ({
  runId: 'test',
  direction,
  boardStation: 'tokyo',
  boardTime: 600,
  alightStation: stopCount % 30 === 0 ? 'tokyo' : 'ueno',
  alightTime: 720,
  trainIds: ['1G'],
  stopCount,
})

const radiusFromCenter = (point: { x: number; y: number }) =>
  Math.hypot(
    (point.x - mapGeometry.centerX) / mapGeometry.radiusX,
    (point.y - mapGeometry.centerY) / mapGeometry.radiusY,
  )

// 駅名は全角なので、1文字をfont-size分の幅として見積もる
const labelBox = (index: number) => {
  const label = labelPosition(index)
  const width = stations[index].name.length * mapGeometry.labelFontSize
  const x =
    label.textAnchor === 'start' ? label.x : label.textAnchor === 'end' ? label.x - width : label.x - width / 2
  return {
    x0: x,
    x1: x + width,
    y0: label.y - mapGeometry.labelFontSize * 0.6,
    y1: label.y + mapGeometry.labelFontSize * 0.6,
  }
}

const labelBoxes = stations.map((_, index) => labelBox(index))

const distanceToLabels = (point: { x: number; y: number }) =>
  Math.min(
    ...labelBoxes.map((box) =>
      Math.hypot(Math.max(box.x0 - point.x, 0, point.x - box.x1), Math.max(box.y0 - point.y, 0, point.y - box.y1)),
    ),
  )

// 1周分ずれた2点の距離。渦が何pxずつ離れて巻いているかを測る。
const lapSeparation = (target: RouteLeg) => {
  const points = tracePointsForLeg(target)
  const turns = target.stopCount / stations.length
  const perLap = Math.round((points.length - 1) / turns)
  const margin = Math.round(perLap * 0.15)
  let min = Infinity
  for (let index = margin; index + perLap < points.length - margin; index++) {
    const a = points[index]
    const b = points[index + perLap]
    min = Math.min(min, Math.hypot(a.x - b.x, a.y - b.y))
  }
  return min
}

const lapCounts = [2, 3, 4, 5, 6]

describe('route map geometry', () => {
  it('内回りを内側、外回りを外側へ描く', () => {
    const inner = tracePointsForLeg(leg('inner', 30))
    const outer = tracePointsForLeg(leg('outer', 30))
    expect(radiusFromCenter(inner[Math.floor(inner.length / 2)])).toBeLessThan(1)
    expect(radiusFromCenter(outer[Math.floor(outer.length / 2)])).toBeGreaterThan(1)
  })

  it('軌跡の終点が降車駅に一致する（外回りは駅の並びを戻る）', () => {
    const cases = [
      { direction: 'outer' as const, stopCount: 9, alight: 'meguro' },
      { direction: 'inner' as const, stopCount: 9, alight: 'komagome' },
      { direction: 'outer' as const, stopCount: 38, alight: 'gotanda' },
      { direction: 'inner' as const, stopCount: 38, alight: 'tabata' },
    ]
    for (const testCase of cases) {
      const end = tracePointsForLeg(leg(testCase.direction, testCase.stopCount)).at(-1)!
      const expected = pointOnLoop(stations.findIndex((station) => station.id === testCase.alight))
      expect(Math.hypot(end.x - expected.x, end.y - expected.y), `${testCase.direction}/${testCase.stopCount}駅`)
        .toBeLessThan(1)
    }
  })

  it('二周目は一周目より中心側へ巻く', () => {
    const points = tracePointsForLeg(leg('inner', 60))
    expect(radiusFromCenter(points[Math.floor(points.length * 0.72)]))
      .toBeLessThan(radiusFromCenter(points[Math.floor(points.length * 0.28)]))
  })

  it('SVG pathと周回表示を生成する', () => {
    const route = { legs: [leg('inner', 60)] } as RouteOption
    expect(pathFromPoints(tracePointsForLeg(route.legs[0]))).toMatch(/^M/)
    expect(routeMapSummary(route)).toBe('内回り・2周')
  })

  it('一周以内は自分と重ならないので渦にしない', () => {
    for (const direction of ['inner', 'outer'] as const) {
      const radii = tracePointsForLeg(leg(direction, 30)).map(radiusFromCenter)
      const band = Math.max(...radii) - Math.min(...radii)
      expect(band).toBeLessThan(0.11)
    }
  })

  it('駅名ラベルは重ならず、viewBoxに収まる', () => {
    for (let i = 0; i < labelBoxes.length; i++) {
      for (let j = i + 1; j < labelBoxes.length; j++) {
        const a = labelBoxes[i]
        const b = labelBoxes[j]
        const overlapX = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)
        const overlapY = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0)
        expect(
          overlapX <= 0 || overlapY <= 0,
          `${stations[i].name} と ${stations[j].name} のラベルが重なる`,
        ).toBe(true)
      }
    }
    for (const box of labelBoxes) {
      expect(box.x0).toBeGreaterThanOrEqual(0)
      expect(box.y0).toBeGreaterThanOrEqual(0)
      expect(box.x1).toBeLessThanOrEqual(mapGeometry.width)
      expect(box.y1).toBeLessThanOrEqual(mapGeometry.height)
    }
  })

  it('外回りの軌跡が駅名ラベルへ食い込まない', () => {
    for (const laps of [1, ...lapCounts]) {
      const target = leg('outer', laps * stations.length)
      const halfStroke = traceStrokeWidth(target) / 2
      const clearance = Math.min(...tracePointsForLeg(target).map(distanceToLabels)) - halfStroke
      expect(clearance, `外回り${laps}周がラベルに近すぎる`).toBeGreaterThan(4)
    }
  })

  it('周と周のあいだに線幅より広い隙間を残す', () => {
    for (const laps of lapCounts) {
      for (const direction of ['inner', 'outer'] as const) {
        const target = leg(direction, laps * stations.length)
        const gap = lapSeparation(target) - traceStrokeWidth(target)
        expect(gap, `${direction}${laps}周の渦が潰れている`).toBeGreaterThan(2)
      }
    }
  })

  it('周が増えるほど線を細くする', () => {
    expect(traceStrokeWidth(leg('outer', 60))).toBeGreaterThan(traceStrokeWidth(leg('outer', 180)))
  })
})
