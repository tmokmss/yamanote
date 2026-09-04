export type StationId =
  | 'tokyo'
  | 'kanda'
  | 'akihabara'
  | 'okachimachi'
  | 'ueno'
  | 'uguisudani'
  | 'nippori'
  | 'nishi-nippori'
  | 'tabata'
  | 'komagome'
  | 'sugamo'
  | 'otsuka'
  | 'ikebukuro'
  | 'mejiro'
  | 'takadanobaba'
  | 'shin-okubo'
  | 'shinjuku'
  | 'yoyogi'
  | 'harajuku'
  | 'shibuya'
  | 'ebisu'
  | 'meguro'
  | 'gotanda'
  | 'osaki'
  | 'shinagawa'
  | 'takanawa-gateway'
  | 'tamachi'
  | 'hamamatsucho'
  | 'shimbashi'
  | 'yurakucho'

export type Direction = 'inner' | 'outer'
export type ScheduleType = 'weekday' | 'holiday'

export interface Station {
  id: StationId
  code: string
  name: string
  kana: string
}

export interface TimetableStop {
  station: StationId
  arrival?: number
  departure?: number
}

export interface TimetableTrain {
  id: string
  stops: TimetableStop[]
  continuesAs?: string
}

export interface TimetableData {
  schemaVersion: 1
  provisional: boolean
  revision: string
  generatedAt: string
  scheduleType: ScheduleType
  direction: Direction
  trains: TimetableTrain[]
}

export interface TimetableManifest {
  schemaVersion: 1
  provisional: boolean
  revision: string
  generatedAt: string
  provider?: string
  contactEmail?: string
  files: Record<ScheduleType, Record<Direction, string>>
}

export interface RunStop extends TimetableStop {
  trainId: string
}

export interface VehicleRun {
  id: string
  direction: Direction
  stops: RunStop[]
}

export interface RouteLeg {
  runId: string
  direction: Direction
  boardStation: StationId
  boardTime: number
  alightStation: StationId
  alightTime: number
  trainIds: string[]
  stopCount: number
}

export interface RouteOption {
  id: string
  departureTime: number
  arrivalTime: number
  targetTime: number
  initialWait: number
  transferWait: number
  seatedMinutes: number
  transfers: number
  legs: RouteLeg[]
}

export interface RouteRecommendation {
  kind: 'balanced' | 'seated' | 'punctual'
  label: string
  description: string
  route: RouteOption
}

export interface SearchInput {
  origin: StationId
  destination: StationId
  startTime: number
  durationMinutes: number
}
