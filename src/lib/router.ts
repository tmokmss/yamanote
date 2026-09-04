import type {
  Direction,
  RouteLeg,
  RouteOption,
  RouteRecommendation,
  RunStop,
  SearchInput,
  StationId,
  TimetableData,
  TimetableTrain,
  VehicleRun,
} from '../types'

const stopTime = (stop: RunStop): number | undefined => stop.arrival ?? stop.departure

const appendSegment = (stops: RunStop[], train: TimetableTrain): void => {
  for (const stop of train.stops) {
    const current: RunStop = { ...stop, trainId: train.id }
    const previous = stops.at(-1)
    if (
      previous &&
      previous.station === current.station &&
      previous.arrival !== undefined &&
      current.departure !== undefined &&
      current.departure - previous.arrival <= 3
    ) {
      previous.departure = current.departure
      previous.trainId = current.trainId
    } else {
      stops.push(current)
    }
  }
}

export const buildVehicleRuns = (data: TimetableData): VehicleRun[] => {
  const trains = new Map(data.trains.map((train) => [train.id, train]))
  const hasPredecessor = new Set(data.trains.flatMap((train) => (train.continuesAs ? [train.continuesAs] : [])))
  const roots = data.trains.filter((train) => !hasPredecessor.has(train.id))
  const runs: VehicleRun[] = []
  const consumed = new Set<string>()

  for (const root of roots) {
    const stops: RunStop[] = []
    const ids: string[] = []
    let train: TimetableTrain | undefined = root
    while (train && !consumed.has(train.id)) {
      consumed.add(train.id)
      ids.push(train.id)
      appendSegment(stops, train)
      train = train.continuesAs ? trains.get(train.continuesAs) : undefined
    }
    if (stops.length > 1) {
      runs.push({ id: `${data.direction}:${ids.join('+')}`, direction: data.direction, stops })
    }
  }

  // Keep malformed/orphaned segments usable instead of silently dropping data.
  for (const train of data.trains) {
    if (consumed.has(train.id)) continue
    const stops: RunStop[] = []
    appendSegment(stops, train)
    if (stops.length > 1) runs.push({ id: `${data.direction}:${train.id}`, direction: data.direction, stops })
  }
  return runs
}

interface Departure {
  run: VehicleRun
  index: number
  time: number
}

interface SearchState {
  run: VehicleRun
  boardIndex: number
  previousLegs: RouteLeg[]
  initialWait: number
  transferWait: number
  usedRuns: Set<string>
}

const buildDepartureIndex = (runs: VehicleRun[]): Map<StationId, Departure[]> => {
  const index = new Map<StationId, Departure[]>()
  for (const run of runs) {
    run.stops.forEach((stop, stopIndex) => {
      if (stop.departure === undefined || stopIndex === run.stops.length - 1) return
      const departures = index.get(stop.station) ?? []
      departures.push({ run, index: stopIndex, time: stop.departure })
      index.set(stop.station, departures)
    })
  }
  for (const departures of index.values()) departures.sort((a, b) => a.time - b.time)
  return index
}

const makeLeg = (run: VehicleRun, from: number, to: number): RouteLeg => {
  const board = run.stops[from]
  const alight = run.stops[to]
  const trainIds = [...new Set(run.stops.slice(from, to + 1).map((stop) => stop.trainId))]
  return {
    runId: run.id,
    direction: run.direction,
    boardStation: board.station,
    boardTime: board.departure ?? stopTime(board)!,
    alightStation: alight.station,
    alightTime: stopTime(alight)!,
    trainIds,
    stopCount: to - from,
  }
}

const nextDepartures = (
  index: Map<StationId, Departure[]>,
  station: StationId,
  after: number,
  before: number,
  excluded: Set<string>,
): Departure[] => {
  const byDirection = new Map<Direction, Departure[]>()
  for (const departure of index.get(station) ?? []) {
    if (departure.time < after || departure.time > before || excluded.has(departure.run.id)) continue
    const matches = byDirection.get(departure.run.direction) ?? []
    if (matches.length < 2) matches.push(departure)
    byDirection.set(departure.run.direction, matches)
  }
  return [...byDirection.values()].flat()
}

const optionKey = (option: RouteOption): string =>
  option.legs.map((leg) => `${leg.runId}:${leg.boardTime}-${leg.alightTime}`).join('|')

export const findRouteOptions = (timetables: TimetableData[], input: SearchInput): RouteOption[] => {
  const runs = timetables.flatMap(buildVehicleRuns)
  const departureIndex = buildDepartureIndex(runs)
  const targetTime = input.startTime + input.durationMinutes
  const horizon = targetTime + 75
  const initial = (departureIndex.get(input.origin) ?? [])
    .filter((departure) => departure.time >= input.startTime && departure.time <= input.startTime + 30)
    .filter((departure, position, all) => {
      const sameDirectionBefore = all
        .slice(0, position)
        .filter((candidate) => candidate.run.direction === departure.run.direction).length
      return sameDirectionBefore < 8
    })

  const queue: SearchState[] = initial.map((departure) => ({
    run: departure.run,
    boardIndex: departure.index,
    previousLegs: [],
    initialWait: departure.time - input.startTime,
    transferWait: 0,
    usedRuns: new Set([departure.run.id]),
  }))
  const visited = new Map<string, number>()
  const options = new Map<string, RouteOption>()

  while (queue.length > 0) {
    const state = queue.shift()!
    const board = state.run.stops[state.boardIndex]
    const boardTime = board.departure ?? stopTime(board)
    if (boardTime === undefined || boardTime > horizon) continue

    for (let index = state.boardIndex + 1; index < state.run.stops.length; index += 1) {
      const stop = state.run.stops[index]
      const arrival = stopTime(stop)
      if (arrival === undefined) continue
      if (arrival > horizon) break

      if (stop.station === input.destination) {
        const legs = [...state.previousLegs, makeLeg(state.run, state.boardIndex, index)]
        const departureTime = legs[0].boardTime
        const seatedMinutes = legs.reduce((total, leg) => total + leg.alightTime - leg.boardTime, 0)
        const option: RouteOption = {
          id: optionKey({ legs } as RouteOption),
          departureTime,
          arrivalTime: arrival,
          targetTime,
          initialWait: state.initialWait,
          transferWait: state.transferWait,
          seatedMinutes,
          transfers: legs.length - 1,
          legs,
        }
        options.set(optionKey(option), option)
      }

      if (state.previousLegs.length >= 2 || arrival > targetTime + 20) continue
      const transfers = nextDepartures(
        departureIndex,
        stop.station,
        arrival + 1,
        Math.min(arrival + 12, horizon),
        state.usedRuns,
      )
      for (const departure of transfers) {
        const depth = state.previousLegs.length + 1
        const visitKey = `${departure.run.id}:${departure.index}:${depth}`
        const totalWait = state.transferWait + departure.time - arrival
        if ((visited.get(visitKey) ?? Number.POSITIVE_INFINITY) <= totalWait) continue
        visited.set(visitKey, totalWait)
        queue.push({
          run: departure.run,
          boardIndex: departure.index,
          previousLegs: [...state.previousLegs, makeLeg(state.run, state.boardIndex, index)],
          initialWait: state.initialWait,
          transferWait: totalWait,
          usedRuns: new Set([...state.usedRuns, departure.run.id]),
        })
      }
    }
  }

  return [...options.values()].filter((option) => option.arrivalTime >= input.startTime + 5)
}

const difference = (option: RouteOption): number => option.arrivalTime - option.targetTime
const timePenalty = (option: RouteOption): number => {
  const delta = difference(option)
  return delta < 0 ? Math.abs(delta) * 1.35 : delta
}

const uniqueRecommendations = (
  candidates: Array<Omit<RouteRecommendation, 'route'> & { route?: RouteOption }>,
): RouteRecommendation[] => {
  const used = new Set<string>()
  return candidates.flatMap((candidate) => {
    if (!candidate.route || used.has(candidate.route.id)) return []
    used.add(candidate.route.id)
    return [candidate as RouteRecommendation]
  })
}

export const recommendRoutes = (timetables: TimetableData[], input: SearchInput): RouteRecommendation[] => {
  const options = findRouteOptions(timetables, input)
  const sensible = options.filter((option) => Math.abs(difference(option)) <= 60)
  const pool = sensible.length > 0 ? sensible : options

  const balanced = [...pool].sort(
    (a, b) =>
      timePenalty(a) * 3 + a.transfers * 60 + a.initialWait + a.transferWait -
      (timePenalty(b) * 3 + b.transfers * 60 + b.initialWait + b.transferWait),
  )[0]
  const seated = [...pool]
    .filter((option) => Math.abs(difference(option)) <= 35)
    .sort(
      (a, b) =>
        a.transfers - b.transfers ||
        b.seatedMinutes - a.seatedMinutes ||
        Math.abs(difference(a)) - Math.abs(difference(b)),
    )[0]
  const punctual = [...pool].sort(
    (a, b) =>
      Math.abs(difference(a)) - Math.abs(difference(b)) ||
      a.transfers - b.transfers ||
      a.initialWait - b.initialWait,
  )[0]

  return uniqueRecommendations([
    {
      kind: 'balanced',
      label: 'おすすめ',
      description: '時間の正確さと、乗り換えの少なさを両立',
      route: balanced,
    },
    {
      kind: 'seated',
      label: '座りっぱなし優先',
      description: '希望時間の近くで、できるだけ同じ車両に乗車',
      route: seated,
    },
    {
      kind: 'punctual',
      label: '時間ぴったり優先',
      description: '乗り換えが増えても終了時刻を優先',
      route: punctual,
    },
  ])
}
