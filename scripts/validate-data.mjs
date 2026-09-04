import { readFile } from 'node:fs/promises'

const manifest = JSON.parse(await readFile('public/data/manifest.json', 'utf8'))
const stationIds = new Set([
  'tokyo', 'kanda', 'akihabara', 'okachimachi', 'ueno', 'uguisudani', 'nippori', 'nishi-nippori',
  'tabata', 'komagome', 'sugamo', 'otsuka', 'ikebukuro', 'mejiro', 'takadanobaba', 'shin-okubo',
  'shinjuku', 'yoyogi', 'harajuku', 'shibuya', 'ebisu', 'meguro', 'gotanda', 'osaki', 'shinagawa',
  'takanawa-gateway', 'tamachi', 'hamamatsucho', 'shimbashi', 'yurakucho',
])

const entries = Object.entries(manifest.files).flatMap(([scheduleType, directions]) =>
  Object.entries(directions).map(([direction, file]) => ({ scheduleType, direction, file })),
)
const files = entries.map(({ file }) => file)
if (files.length !== 4) throw new Error(`Expected four timetable files, found ${files.length}`)
if (new Set(files).size !== 4) throw new Error('Timetable manifest contains duplicate files')

for (const { scheduleType, direction, file } of entries) {
  const data = JSON.parse(await readFile(`public/${file}`, 'utf8'))
  if (data.schemaVersion !== 1 || data.trains.length < 100) throw new Error(`${file} is incomplete`)
  if (data.scheduleType !== scheduleType || data.direction !== direction) {
    throw new Error(`${file} does not match its manifest entry`)
  }
  const seenStations = new Set(data.trains.flatMap((train) => train.stops.map((stop) => stop.station)))
  for (const station of stationIds) {
    if (!seenStations.has(station)) throw new Error(`${file} is missing ${station}`)
  }
  const ids = new Set(data.trains.map((train) => train.id))
  if (ids.size !== data.trains.length) throw new Error(`${file}: duplicate train id`)
  const predecessorCount = new Map()
  for (const train of data.trains) {
    if (train.continuesAs) {
      if (!ids.has(train.continuesAs)) throw new Error(`${file}: invalid continuation`)
      predecessorCount.set(train.continuesAs, (predecessorCount.get(train.continuesAs) ?? 0) + 1)
      const next = data.trains.find((candidate) => candidate.id === train.continuesAs)
      const end = train.stops.at(-1)
      const start = next.stops[0]
      const endTime = end.arrival ?? end.departure
      const startTime = start.departure ?? start.arrival
      if (end.station !== 'osaki' || start.station !== 'osaki' || startTime - endTime < 1 || startTime - endTime > 3) {
        throw new Error(`${file}: implausible continuation ${train.id}`)
      }
    }
    let previous = -1
    for (const stop of train.stops) {
      if (stop.arrival !== undefined && stop.departure !== undefined && stop.departure < stop.arrival) {
        throw new Error(`${file}: departure before arrival on ${train.id}`)
      }
      const time = stop.departure ?? stop.arrival
      if (time === undefined || time < previous) throw new Error(`${file}: non-monotonic ${train.id}`)
      previous = time
    }
  }
  if ([...predecessorCount.values()].some((count) => count > 1)) throw new Error(`${file}: continuation has multiple predecessors`)
  if (data.trains.filter((train) => train.continuesAs).length < 50) throw new Error(`${file}: too few vehicle continuations`)

  const byId = new Map(data.trains.map((train) => [train.id, train]))
  for (const train of data.trains) {
    const path = new Set()
    let current = train
    while (current?.continuesAs) {
      if (path.has(current.id)) throw new Error(`${file}: continuation cycle at ${current.id}`)
      path.add(current.id)
      current = byId.get(current.continuesAs)
    }
  }
  console.log(`${file}: ${data.trains.length} trains validated`)
}
