import { stations } from '../data/stations'
import type { RouteLeg, RouteOption, StationId } from '../types'

export interface MapPoint {
  x: number
  y: number
}

export type LabelAnchor = 'start' | 'middle' | 'end'

export interface StationLabel extends MapPoint {
  textAnchor: LabelAnchor
}

export const mapGeometry = {
  width: 640,
  height: 664,
  centerX: 320,
  centerY: 328,
  radiusX: 168,
  radiusY: 188,
  labelPad: 94,
  labelStagger: 20,
  labelFontSize: 15,
  startAngle: 25 * Math.PI / 180,
}

// 渦の形。内回りは基準線の内側、外回りは外側へ、周回ごとに lapStep 分だけ半径を離す。
const traceShape = {
  innerBase: 0.9,
  outerBase: 1.08,
  lapStep: 0.08,
  spiralMax: 0.3,
  strokeMax: 7,
  strokeMin: 4.5,
  strokeGap: 4,
}

const stationCount = stations.length
const stationIndex = new Map<StationId, number>(stations.map((station, index) => [station.id, index]))

// stations は内回り順に並んでいるので、外回りは添字を戻る向きに進む。
const stepFor = (direction: RouteLeg['direction']): number => (direction === 'outer' ? -1 : 1)

export const angleForIndex = (index: number): number =>
  mapGeometry.startAngle - index / stationCount * Math.PI * 2

export const pointOnLoop = (index: number, scale = 1): MapPoint => {
  const angle = angleForIndex(index)
  return {
    x: mapGeometry.centerX + Math.cos(angle) * mapGeometry.radiusX * scale,
    y: mapGeometry.centerY + Math.sin(angle) * mapGeometry.radiusY * scale,
  }
}

export const labelPosition = (index: number): StationLabel => {
  const angle = angleForIndex(index)
  const sine = Math.sin(angle)
  const cosine = Math.cos(angle)
  const stagger = Math.abs(sine) > 0.72 && index % 2 ? mapGeometry.labelStagger : 0
  return {
    x: mapGeometry.centerX + cosine * (mapGeometry.radiusX + mapGeometry.labelPad + stagger),
    y: mapGeometry.centerY + sine * (mapGeometry.radiusY + mapGeometry.labelPad + stagger),
    textAnchor: cosine > 0.28 ? 'start' : cosine < -0.28 ? 'end' : 'middle',
  }
}

const turnsOf = (leg: RouteLeg): number => leg.stopCount / stationCount

// 1周以内なら軌跡は自分自身と重ならないので渦にしない。
const spiralOf = (leg: RouteLeg): number => {
  const turns = turnsOf(leg)
  if (turns <= 1) return 0
  return Math.min(traceShape.spiralMax, traceShape.lapStep * turns)
}

// 隣り合う周と周の間隔。半径が短いx方向が最も詰まる。
export const lapSeparation = (leg: RouteLeg): number => {
  const turns = turnsOf(leg)
  if (turns <= 1) return Infinity
  return spiralOf(leg) / turns * mapGeometry.radiusX
}

// 周が多いほど線を細くして、渦が塗りつぶしにならないようにする。
export const traceStrokeWidth = (leg: RouteLeg): number => {
  const separation = lapSeparation(leg)
  if (!Number.isFinite(separation)) return traceShape.strokeMax
  return Math.min(traceShape.strokeMax, Math.max(traceShape.strokeMin, separation - traceShape.strokeGap))
}

const traceScale = (leg: RouteLeg, progress: number): number => {
  const spiral = spiralOf(leg)
  const base = leg.direction === 'inner' ? traceShape.innerBase : traceShape.outerBase
  const target = leg.direction === 'inner' ? base - spiral : base + spiral
  let scale = base + (target - base) * progress

  // 乗降駅では基準線に寄せて、乗り換え時に内側と外側の軌跡がつながるようにする。
  const connector = Math.min(0.08, 0.7 / Math.max(1, leg.stopCount))
  if (progress < connector) scale = 1 + (scale - 1) * progress / connector
  if (progress > 1 - connector) scale += (1 - scale) * (progress - (1 - connector)) / connector
  return scale
}

export const tracePointsForLeg = (leg: RouteLeg): MapPoint[] => {
  const origin = stationIndex.get(leg.boardStation)
  if (origin === undefined) return []
  const segmentCount = Math.max(24, leg.stopCount * 8)
  return Array.from({ length: segmentCount + 1 }, (_, index) => {
    const progress = index / segmentCount
    const signedStops = leg.stopCount * progress * stepFor(leg.direction)
    return pointOnLoop(origin + signedStops, traceScale(leg, progress))
  })
}

export const pathFromPoints = (points: MapPoint[]): string =>
  points.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' ')

export const arrowsForTrace = (points: MapPoint[], stopCount: number) => {
  const count = Math.min(9, Math.max(2, Math.ceil(stopCount / 8)))
  return Array.from({ length: count }, (_, index) => {
    const progress = (index + 1) / (count + 1)
    const pointIndex = Math.min(points.length - 2, Math.round(progress * (points.length - 1)))
    const point = points[pointIndex]
    const next = points[pointIndex + 1]
    return { ...point, angle: Math.atan2(next.y - point.y, next.x - point.x) * 180 / Math.PI }
  })
}

const directionName = { inner: '内回り', outer: '外回り' }

export const routeMapSummary = (route: RouteOption): string => {
  const directions = [...new Set(route.legs.map((leg) => leg.direction))]
  if (directions.length > 1) return directions.map((direction) => directionName[direction]).join(' → ')
  const stops = route.legs.reduce((total, leg) => total + leg.stopCount, 0)
  const laps = Math.floor(stops / stationCount)
  const remainder = stops % stationCount
  if (laps === 0) return `${directionName[directions[0]]}・${stops}駅`
  return `${directionName[directions[0]]}・${laps}周${remainder ? `＋${remainder}駅` : ''}`
}
