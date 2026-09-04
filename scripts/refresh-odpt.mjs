import { mkdir, writeFile } from 'node:fs/promises'

const token = process.env.ODPT_API_TOKEN
const contactEmail = process.env.ODPT_CONTACT_EMAIL
if (!token) throw new Error('ODPT_API_TOKEN is required')
if (!contactEmail) throw new Error('ODPT_CONTACT_EMAIL is required by the ODPT publication guideline')

const stationIds = {
  Tokyo: 'tokyo', Kanda: 'kanda', Akihabara: 'akihabara', Okachimachi: 'okachimachi',
  Ueno: 'ueno', Uguisudani: 'uguisudani', Nippori: 'nippori', NishiNippori: 'nishi-nippori',
  Tabata: 'tabata', Komagome: 'komagome', Sugamo: 'sugamo', Otsuka: 'otsuka',
  Ikebukuro: 'ikebukuro', Mejiro: 'mejiro', Takadanobaba: 'takadanobaba',
  ShinOkubo: 'shin-okubo', Shinjuku: 'shinjuku', Yoyogi: 'yoyogi', Harajuku: 'harajuku',
  Shibuya: 'shibuya', Ebisu: 'ebisu', Meguro: 'meguro', Gotanda: 'gotanda', Osaki: 'osaki',
  Shinagawa: 'shinagawa', TakanawaGateway: 'takanawa-gateway', Tamachi: 'tamachi',
  Hamamatsucho: 'hamamatsucho', Shimbashi: 'shimbashi', Shinbashi: 'shimbashi',
  Yurakucho: 'yurakucho',
}

const suffix = (uri) => uri?.split('.').at(-1)
const stationId = (uri) => stationIds[suffix(uri)]

const directionOf = (uri = '') => {
  const value = uri.toLowerCase()
  if (value.includes('innerloop')) return 'inner'
  if (value.includes('outerloop')) return 'outer'
  return undefined
}

const scheduleOf = (uri = '') => {
  const value = uri.toLowerCase()
  if (value.endsWith('weekday')) return 'weekday'
  if (value.includes('holiday')) return 'holiday'
  return undefined
}

const clockMinute = (value, previous = 0) => {
  if (!/^\d{1,2}:\d{2}$/.test(value ?? '')) return undefined
  const [hour, minute] = value.split(':').map(Number)
  let result = (hour < 3 ? hour + 24 : hour) * 60 + minute
  while (result < previous - 180) result += 1440
  return result
}

const timetableStops = (objects) => {
  const stops = []
  let previous = 0
  const setStop = (station, kind, value) => {
    const id = stationId(station)
    const time = clockMinute(value, previous)
    if (!id || time === undefined) return
    previous = time
    let stop = stops.at(-1)
    if (!stop || stop.station !== id) {
      stop = { station: id }
      stops.push(stop)
    }
    stop[kind] = time
  }
  for (const item of objects ?? []) {
    setStop(item['odpt:arrivalStation'], 'arrival', item['odpt:arrivalTime'])
    setStop(item['odpt:departureStation'], 'departure', item['odpt:departureTime'])
  }
  return stops
}

const vehicleKey = (number) => {
  const match = number.match(/^(\d+)(\D.*)$/)
  return match ? `${Number(match[1]) % 100}${match[2]}` : undefined
}

const api = new URL('https://api.odpt.org/api/v4/odpt:TrainTimetable')
api.searchParams.set('acl:consumerKey', token)
api.searchParams.set('odpt:railway', 'odpt.Railway:JR-East.Yamanote')
const response = await fetch(api, { headers: { accept: 'application/json' } })
if (!response.ok) throw new Error(`ODPT API request failed (${response.status})`)
const source = await response.json()
if (!Array.isArray(source)) throw new Error('ODPT API returned an unexpected payload')

const groups = new Map([
  ['weekday-inner', []], ['weekday-outer', []], ['holiday-inner', []], ['holiday-outer', []],
])
const usedIds = new Map()
const unknown = new Set()

for (const item of source) {
  const direction = directionOf(item['odpt:railDirection'])
  const schedule = scheduleOf(item['odpt:calendar'])
  if (!direction || !schedule) {
    unknown.add(`${item['odpt:railDirection']} / ${item['odpt:calendar']}`)
    continue
  }
  const number = String(item['odpt:trainNumber'] ?? '').trim()
  const stops = timetableStops(item['odpt:trainTimetableObject'])
  if (!number || stops.length < 2) continue
  const groupKey = `${schedule}-${direction}`
  const duplicateKey = `${groupKey}:${number}`
  const sequence = (usedIds.get(duplicateKey) ?? 0) + 1
  usedIds.set(duplicateKey, sequence)
  groups.get(groupKey).push({ id: sequence === 1 ? number : `${number}-${sequence}`, number, stops })
}

if (unknown.size) console.warn(`Skipped unknown calendars/directions: ${[...unknown].join(', ')}`)

const generatedAt = new Date().toISOString()
const revision = source.map((item) => item['dct:issued']).filter(Boolean).sort().at(-1) ?? generatedAt.slice(0, 10)
const outputDir = 'public/data/current'
const files = { weekday: {}, holiday: {} }

for (const [groupKey, trains] of groups) {
  const [scheduleType, direction] = groupKey.split('-')
  if (trains.length < 100) throw new Error(`${groupKey} contains only ${trains.length} usable trains; keeping existing data`)

  for (const train of trains) {
    const end = train.stops.at(-1)
    const endTime = end?.arrival ?? end?.departure
    const key = vehicleKey(train.number)
    if (end?.station !== 'osaki' || endTime === undefined || !key) continue
    const candidate = trains.find((next) => {
      const start = next.stops[0]
      const startTime = start?.departure ?? start?.arrival
      return next.id !== train.id && vehicleKey(next.number) === key && start?.station === 'osaki' &&
        startTime !== undefined && startTime > endTime && startTime - endTime <= 3
    })
    if (candidate) train.continuesAs = candidate.id
  }

  trains.sort((a, b) => (a.stops[0].departure ?? a.stops[0].arrival) - (b.stops[0].departure ?? b.stops[0].arrival))
  const cleanTrains = trains.map(({ number: _, ...train }) => train)
  const filename = `${groupKey}.json`
  const output = {
    schemaVersion: 1,
    provisional: false,
    revision,
    generatedAt,
    scheduleType,
    direction,
    trains: cleanTrains,
  }
  await mkdir(outputDir, { recursive: true })
  await writeFile(`${outputDir}/${filename}`, `${JSON.stringify(output)}\n`)
  files[scheduleType][direction] = `data/current/${filename}`
  console.log(`${filename}: ${cleanTrains.length} trains`)
}

const manifest = {
  schemaVersion: 1,
  provisional: false,
  revision,
  generatedAt,
  provider: '公共交通オープンデータセンター',
  contactEmail,
  files,
}
await writeFile('public/data/manifest.json', `${JSON.stringify(manifest, null, 2)}\n`)
