import { stationById, stations } from '../data/stations'
import {
  arrowsForTrace,
  labelPosition,
  mapGeometry,
  pathFromPoints,
  pointOnLoop,
  routeMapSummary,
  traceStrokeWidth,
  tracePointsForLeg,
} from '../lib/route-map'
import type { RouteOption, StationId } from '../types'

const traceColors = ['#56ad2b', '#d99716', '#287d62']

const stationPoint = (station: StationId) => pointOnLoop(stations.findIndex((candidate) => candidate.id === station))

export default function RouteMap({ route }: { route: RouteOption }) {
  const traces = route.legs.map((leg) => {
    const points = tracePointsForLeg(leg)
    return { leg, points, path: pathFromPoints(points), strokeWidth: traceStrokeWidth(leg) }
  })
  const start = route.legs[0].boardStation
  const finish = route.legs.at(-1)!.alightStation
  const terminals = new Set([start, finish])

  return (
    <figure className="route-map">
      <figcaption className="route-map__heading">
        <strong>乗る経路</strong>
        <span>{routeMapSummary(route)}</span>
      </figcaption>
      <svg
        className="route-map__svg"
        viewBox={`0 0 ${mapGeometry.width} ${mapGeometry.height}`}
        role="img"
        aria-label={`${stationById[start].name}から${stationById[finish].name}まで、${routeMapSummary(route)}`}
      >
        <ellipse
          className="route-map__rail"
          cx={mapGeometry.centerX}
          cy={mapGeometry.centerY}
          rx={mapGeometry.radiusX}
          ry={mapGeometry.radiusY}
        />

        {traces.map(({ leg, points, path, strokeWidth }, legIndex) => {
          const color = traceColors[legIndex % traceColors.length]
          return (
            <g key={`${leg.runId}-${leg.boardTime}`}>
              <path
                className="route-map__trace"
                d={path}
                pathLength="1"
                stroke={color}
                style={{ strokeWidth, animationDelay: `${legIndex * 180}ms` }}
              />
              {arrowsForTrace(points, leg.stopCount).map((arrow, arrowIndex) => (
                <path
                  className="route-map__arrow"
                  d="M-8 -5 L0 0 L-8 5"
                  stroke={color}
                  transform={`translate(${arrow.x} ${arrow.y}) rotate(${arrow.angle})`}
                  style={{ animationDelay: `${700 + legIndex * 180 + arrowIndex * 35}ms` }}
                  key={arrowIndex}
                />
              ))}
            </g>
          )
        })}

        <g aria-hidden="true">
          {stations.map((station, index) => {
            const point = pointOnLoop(index)
            const label = labelPosition(index)
            const isTerminal = terminals.has(station.id)
            return (
              <g key={station.id}>
                <circle
                  className={`route-map__station ${isTerminal ? 'is-terminal' : ''}`}
                  cx={point.x}
                  cy={point.y}
                  r={isTerminal ? 8 : 5.5}
                />
                <text
                  className={`route-map__label ${isTerminal ? 'is-terminal' : ''}`}
                  x={label.x}
                  y={label.y}
                  textAnchor={label.textAnchor}
                  dominantBaseline="middle"
                >
                  {station.name}
                </text>
              </g>
            )
          })}
        </g>

        {start === finish && (() => {
          const point = stationPoint(start)
          return <circle className="route-map__terminal-ring" cx={point.x} cy={point.y} r="13" />
        })()}

        {route.legs.slice(0, -1).map((leg, index) => {
          const wait = route.legs[index + 1].boardTime - leg.alightTime
          const stationIndex = stations.findIndex((station) => station.id === leg.alightStation)
          const point = pointOnLoop(stationIndex)
          const badge = pointOnLoop(stationIndex, 0.72)
          return (
            <g className="route-map__transfer" key={`${leg.runId}-transfer`}>
              <circle cx={point.x} cy={point.y} r="10" />
              <line x1={point.x} y1={point.y} x2={badge.x} y2={badge.y} />
              <rect x={badge.x - 31} y={badge.y - 12} width="62" height="24" rx="12" />
              <text x={badge.x} y={badge.y} textAnchor="middle" dominantBaseline="middle">{wait}分待ち</text>
            </g>
          )
        })}
      </svg>
      <p className="route-map__key"><span aria-hidden="true" />矢印に沿って乗車</p>
    </figure>
  )
}
