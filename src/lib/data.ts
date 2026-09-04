import type { Direction, ScheduleType, TimetableData, TimetableManifest } from '../types'

const json = async <T>(path: string): Promise<T> => {
  const response = await fetch(`${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`, {
    cache: 'no-cache',
  })
  if (!response.ok) throw new Error(`データを読み込めませんでした (${response.status})`)
  return response.json() as Promise<T>
}

let manifestPromise: Promise<TimetableManifest> | undefined
const timetableCache = new Map<string, Promise<TimetableData>>()

export const loadManifest = (): Promise<TimetableManifest> => {
  manifestPromise ??= json<TimetableManifest>('data/manifest.json')
  return manifestPromise
}

export const loadTimetables = async (scheduleType: ScheduleType): Promise<[TimetableData, TimetableData]> => {
  const manifest = await loadManifest()
  const loadDirection = (direction: Direction) => {
    const path = manifest.files[scheduleType][direction]
    let request = timetableCache.get(path)
    if (!request) {
      request = json<TimetableData>(path)
      timetableCache.set(path, request)
    }
    return request
  }
  return Promise.all([loadDirection('inner'), loadDirection('outer')])
}
