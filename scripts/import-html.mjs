import { load } from 'cheerio'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

const stationIds = {
  東京: 'tokyo', 神田: 'kanda', 秋葉原: 'akihabara', 御徒町: 'okachimachi', 上野: 'ueno',
  鶯谷: 'uguisudani', 日暮里: 'nippori', 西日暮里: 'nishi-nippori', 田端: 'tabata',
  駒込: 'komagome', 巣鴨: 'sugamo', 大塚: 'otsuka', 池袋: 'ikebukuro', 目白: 'mejiro',
  高田馬場: 'takadanobaba', 新大久保: 'shin-okubo', 新宿: 'shinjuku', 代々木: 'yoyogi',
  原宿: 'harajuku', 渋谷: 'shibuya', 恵比寿: 'ebisu', 目黒: 'meguro', 五反田: 'gotanda',
  大崎: 'osaki', 品川: 'shinagawa', 高輪ゲートウェイ: 'takanawa-gateway', 田町: 'tamachi',
  浜松町: 'hamamatsucho', 新橋: 'shimbashi', 有楽町: 'yurakucho',
}

const args = Object.fromEntries(
  process.argv.slice(2).map((argument) => {
    const [key, ...value] = argument.replace(/^--/, '').split('=')
    return [key, value.join('=')]
  }),
)

for (const name of ['input', 'output', 'direction', 'schedule', 'revision', 'generated-at']) {
  if (!args[name]) throw new Error(`Missing --${name}=...`)
}
if (!['inner', 'outer'].includes(args.direction)) throw new Error('direction must be inner or outer')
if (!['weekday', 'holiday'].includes(args.schedule)) throw new Error('schedule must be weekday or holiday')

const parseTime = (value) => {
  const match = value.replaceAll(':', '').match(/\d{3,4}/)
  if (!match) return undefined
  const padded = match[0].padStart(4, '0')
  const hour = Number(padded.slice(0, 2))
  const minute = Number(padded.slice(2))
  return (hour < 3 ? hour + 24 : hour) * 60 + minute
}

const html = await readFile(args.input, 'utf8')
const $ = load(html)
const table = $('.paper_table').first()
if (table.length === 0) throw new Error('No timetable found in input')

const trainIds = table
  .find('tr.tableTr_trainNumber td')
  .map((_, cell) => $(cell).text().trim())
  .get()
  .filter(Boolean)

const rows = []
table.find('tr').each((_, row) => {
  const headers = $(row).find('th')
  const name = headers.eq(0).text().trim()
  const station = stationIds[name]
  const event = headers.eq(1).text().trim()
  if (!station || !['着', '発'].includes(event)) return
  rows.push({
    station,
    event,
    // Array#map keeps empty timetable cells in place. Cheerio#map drops
    // undefined values, which would shift every later train into the wrong
    // column on arrival-only rows.
    times: $(row)
      .find('td')
      .toArray()
      .map((cell) => parseTime($(cell).text().trim())),
  })
})

if (trainIds.length < 10 || rows.length < 30) {
  throw new Error(`Input looks incomplete (${trainIds.length} trains, ${rows.length} station rows)`)
}

const trains = trainIds.flatMap((id, trainIndex) => {
  const stops = []
  for (const row of rows) {
    const time = row.times[trainIndex]
    if (time === undefined) continue
    let stop = stops.at(-1)
    if (!stop || stop.station !== row.station) {
      stop = { station: row.station }
      stops.push(stop)
    }
    if (row.event === '着') stop.arrival = time
    if (row.event === '発') stop.departure = time
  }
  return stops.length > 1 ? [{ id, stops }] : []
})

const vehicleKey = (id) => {
  const match = id.match(/^(\d+)(\D.*)$/)
  return match ? `${Number(match[1]) % 100}${match[2]}` : undefined
}

for (const train of trains) {
  const end = train.stops.at(-1)
  const endTime = end?.arrival ?? end?.departure
  if (end?.station !== 'osaki' || endTime === undefined) continue
  const key = vehicleKey(train.id)
  const candidate = trains.find((next) => {
    if (next.id === train.id || vehicleKey(next.id) !== key) return false
    const start = next.stops[0]
    const startTime = start?.departure ?? start?.arrival
    return start?.station === 'osaki' && startTime !== undefined && startTime > endTime && startTime - endTime <= 3
  })
  if (candidate) train.continuesAs = candidate.id
}

trains.sort((a, b) => {
  const aTime = a.stops[0].departure ?? a.stops[0].arrival ?? 0
  const bTime = b.stops[0].departure ?? b.stops[0].arrival ?? 0
  return aTime - bTime
})

const output = {
  schemaVersion: 1,
  provisional: true,
  revision: args.revision,
  generatedAt: args['generated-at'],
  scheduleType: args.schedule,
  direction: args.direction,
  trains,
}

await mkdir(dirname(args.output), { recursive: true })
await writeFile(args.output, `${JSON.stringify(output)}\n`)
console.log(`${args.output}: ${trains.length} trains, ${trains.filter((train) => train.continuesAs).length} continuations`)
