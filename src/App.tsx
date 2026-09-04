import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { isStationId, stationById, stations } from './data/stations'
import { loadManifest, loadTimetables } from './lib/data'
import { formatDistance, nearestYamanoteStation } from './lib/location'
import { recommendRoutes } from './lib/router'
import {
  formatDifference,
  formatDuration,
  formatMinute,
  nowForInput,
  parseDateTimeInput,
  scheduleTypeFor,
} from './lib/time'
import type { Direction, RouteRecommendation, StationId, TimetableManifest } from './types'

const durationPresets = [30, 60, 90, 120, 180]

const initialParams = new URLSearchParams(window.location.search)
const originParam = initialParams.get('from')
const destinationParam = initialParams.get('to')
const initialOrigin: StationId = isStationId(originParam) ? originParam : 'tokyo'
const initialDestination: StationId = isStationId(destinationParam) ? destinationParam : initialOrigin
const initialMinutes = Math.min(360, Math.max(15, Number(initialParams.get('minutes')) || 60))
const initialAt = initialParams.get('at')?.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
  ? initialParams.get('at')!
  : nowForInput()

const directionLabel: Record<Direction, string> = {
  inner: '内回り',
  outer: '外回り',
}

const formatUpdatedAt = (value: string) =>
  new Intl.DateTimeFormat('ja-JP', { dateStyle: 'medium' }).format(new Date(value))

function StationSelect({
  id,
  label,
  value,
  onChange,
  action,
  hint,
}: {
  id: string
  label: string
  value: StationId
  onChange: (station: StationId) => void
  action?: ReactNode
  hint?: ReactNode
}) {
  return (
    <div className="field">
      <div className="field-heading">
        <label htmlFor={id}>{label}</label>
        {action}
      </div>
      <span className="select-wrap">
        <select id={id} value={value} onChange={(event) => onChange(event.target.value as StationId)}>
          {stations.map((station) => (
            <option value={station.id} key={station.id}>
              {station.code}　{station.name}
            </option>
          ))}
        </select>
      </span>
      {hint}
    </div>
  )
}

function RouteCard({ recommendation }: { recommendation: RouteRecommendation }) {
  const { route } = recommendation
  const difference = route.arrivalTime - route.targetTime
  return (
    <article className={`route-card route-card--${recommendation.kind}`}>
      <div className="route-card__heading">
        <div>
          <span className="route-card__eyebrow">{recommendation.label}</span>
          <h3>
            {formatMinute(route.departureTime)} <span aria-hidden="true">→</span>{' '}
            {formatMinute(route.arrivalTime)}
          </h3>
        </div>
        <span className={`difference ${difference === 0 ? 'difference--exact' : ''}`}>
          {formatDifference(difference)}
        </span>
      </div>

      <p className="route-card__description">{recommendation.description}</p>
      <dl className="route-stats">
        <div>
          <dt>乗り換え</dt>
          <dd>{route.transfers === 0 ? 'なし' : `${route.transfers}回`}</dd>
        </div>
        <div>
          <dt>乗車時間</dt>
          <dd>{formatDuration(route.seatedMinutes)}</dd>
        </div>
        <div>
          <dt>乗車まで</dt>
          <dd>{route.initialWait === 0 ? 'すぐ' : `${route.initialWait}分`}</dd>
        </div>
      </dl>

      <ol className="legs" aria-label="乗車手順">
        {route.legs.map((leg, index) => {
          const nextLeg = route.legs[index + 1]
          const wait = nextLeg ? nextLeg.boardTime - leg.alightTime : 0
          return (
          <li key={`${leg.runId}-${leg.boardTime}`}>
            <span className="leg-marker" aria-hidden="true">{index + 1}</span>
            <div className="leg-content">
              <div className="leg-copy">
                <strong>
                  {formatMinute(leg.boardTime)} {stationById[leg.boardStation].name}から{directionLabel[leg.direction]}
                </strong>
                <span>
                  {formatMinute(leg.alightTime)} {stationById[leg.alightStation].name}まで・{leg.stopCount}駅
                </span>
              </div>
              {nextLeg && (
                <div className="transfer-wait">
                  <strong>{wait}分待ち</strong>
                </div>
              )}
            </div>
          </li>
          )
        })}
      </ol>
    </article>
  )
}

export default function App() {
  const [origin, setOrigin] = useState<StationId>(initialOrigin)
  const [destination, setDestination] = useState<StationId>(initialDestination)
  const [hasDestination, setHasDestination] = useState(initialDestination !== initialOrigin)
  const [duration, setDuration] = useState(initialMinutes)
  const [dateTime, setDateTime] = useState(initialAt)
  const [recommendations, setRecommendations] = useState<RouteRecommendation[] | null>(null)
  const [manifest, setManifest] = useState<TimetableManifest | null>(null)
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [error, setError] = useState('')
  const [locationStatus, setLocationStatus] = useState<'idle' | 'locating' | 'success' | 'error'>('idle')
  const [locationMessage, setLocationMessage] = useState('')

  useEffect(() => {
    loadManifest().then(setManifest).catch(() => undefined)
  }, [])

  const effectiveDestination = hasDestination ? destination : origin
  const targetLabel = useMemo(() => {
    const { minutes } = parseDateTimeInput(dateTime)
    return formatMinute(minutes + duration)
  }, [dateTime, duration])

  const locateNearestStation = () => {
    if (!navigator.geolocation) {
      setLocationStatus('error')
      setLocationMessage('このブラウザでは位置情報を利用できません。')
      return
    }
    setLocationStatus('locating')
    setLocationMessage('現在地を確認しています…')
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const nearest = nearestYamanoteStation(coords.latitude, coords.longitude)
        setOrigin(nearest.station.id)
        setLocationStatus('success')
        setLocationMessage(`最寄りの山手線駅は${nearest.station.name}（${formatDistance(nearest.distanceMeters)}）です。`)
      },
      (positionError) => {
        setLocationStatus('error')
        setLocationMessage(positionError.code === positionError.PERMISSION_DENIED
          ? '位置情報が許可されていません。ブラウザの設定を確認してください。'
          : '現在地を取得できませんでした。駅を手動で選んでください。')
      },
      { enableHighAccuracy: false, timeout: 8_000, maximumAge: 300_000 },
    )
  }

  const search = async (event: FormEvent) => {
    event.preventDefault()
    setStatus('loading')
    setError('')
    try {
      const parsed = parseDateTimeInput(dateTime)
      const timetables = await loadTimetables(scheduleTypeFor(parsed.date))
      const result = recommendRoutes(timetables, {
        origin,
        destination: effectiveDestination,
        startTime: parsed.minutes,
        durationMinutes: duration,
      })
      setRecommendations(result)
      setStatus('idle')

      const params = new URLSearchParams({
        from: origin,
        minutes: String(duration),
        at: dateTime,
      })
      if (hasDestination) params.set('to', destination)
      window.history.replaceState(null, '', `${window.location.pathname}?${params}`)
      requestAnimationFrame(() => document.getElementById('results')?.scrollIntoView({ behavior: 'smooth' }))
    } catch (caught) {
      setStatus('error')
      setError(caught instanceof Error ? caught.message : '検索に失敗しました')
    }
  }

  return (
    <>
      <header className="hero">
        <div className="hero__loop" aria-hidden="true"><span>JY</span></div>
        <div className="hero__copy">
          <p className="kicker">YAMANOTE LOOP PLANNER</p>
          <h1>ヤマノテループ</h1>
          <p>山手線を、いちばんラクな待合室に。</p>
        </div>
      </header>

      <main>
        {manifest?.provisional && (
          <aside className="notice" aria-label="データについて">
            <span className="notice__dot" aria-hidden="true" />
            <p><strong>試験運転中</strong> 暫定時刻表（{formatUpdatedAt(manifest.generatedAt)}更新）を使っています。</p>
          </aside>
        )}
        {manifest?.provider && (
          <aside className="notice notice--provider" aria-label="データ提供元">
            <span className="notice__dot" aria-hidden="true" />
            <p>
              交通データ提供元: {manifest.provider}（{formatUpdatedAt(manifest.generatedAt)}取得）。正確性・完全性は保証されません。データ内容について交通事業者へ直接問い合わせないでください。
              {manifest.contactEmail && <> お問い合わせは<a href={`mailto:${manifest.contactEmail}`}>{manifest.contactEmail}</a>へ。</>}
            </p>
          </aside>
        )}

        <section className="search-panel" aria-labelledby="search-title">
          <div className="section-heading">
            <span className="step">01</span>
            <div>
              <h2 id="search-title">どこで、どれくらい？</h2>
              <p>今から乗れる電車を探します</p>
            </div>
          </div>

          <form onSubmit={search}>
            <StationSelect
              id="origin"
              label="今いる駅"
              value={origin}
              onChange={setOrigin}
              action={(
                <button className="location-button" type="button" onClick={locateNearestStation} disabled={locationStatus === 'locating'}>
                  <span aria-hidden="true">◎</span>{locationStatus === 'locating' ? '取得中…' : '現在地から選ぶ'}
                </button>
              )}
              hint={locationMessage && (
                <p className={`location-message location-message--${locationStatus}`} role={locationStatus === 'error' ? 'alert' : 'status'}>
                  {locationMessage}
                </p>
              )}
            />

            <fieldset className="field duration-field">
              <legend>つぶしたい時間</legend>
              <div className="duration-presets">
                {durationPresets.map((minutes) => (
                  <button
                    type="button"
                    className={duration === minutes ? 'is-selected' : ''}
                    aria-pressed={duration === minutes}
                    onClick={() => setDuration(minutes)}
                    key={minutes}
                  >
                    {minutes < 60 ? `${minutes}分` : formatDuration(minutes)}
                  </button>
                ))}
              </div>
              <label className="custom-duration">
                <span>細かく指定</span>
                <span><input type="number" min="15" max="360" step="5" value={duration} onChange={(event) => {
                  if (Number.isFinite(event.currentTarget.valueAsNumber)) {
                    setDuration(Math.min(360, Math.max(15, event.currentTarget.valueAsNumber)))
                  }
                }} /> 分</span>
              </label>
            </fieldset>

            <label className="toggle-row">
              <span>
                <strong>別の駅で降りる</strong>
                <small>オフなら同じ駅に戻ります</small>
              </span>
              <input type="checkbox" checked={hasDestination} onChange={(event) => setHasDestination(event.target.checked)} />
              <span className="toggle" aria-hidden="true" />
            </label>

            {hasDestination && <StationSelect id="destination" label="降りたい駅" value={destination} onChange={setDestination} />}

            <details className="time-details">
              <summary>出発日時を変更 <span>{dateTime.replace('T', ' ')}</span></summary>
              <label htmlFor="departure-at">出発日時</label>
              <input id="departure-at" type="datetime-local" value={dateTime} onChange={(event) => setDateTime(event.target.value)} required />
            </details>

            <button className="search-button" type="submit" disabled={status === 'loading'}>
              {status === 'loading' ? 'いい乗り方を計算中…' : `${targetLabel}ごろまでの乗り方を見る`}
              <span aria-hidden="true">→</span>
            </button>
            {status === 'error' && <p className="error" role="alert">{error}</p>}
          </form>
        </section>

        {recommendations && (
          <section className="results" id="results" aria-labelledby="results-title" aria-live="polite">
            <div className="section-heading">
              <span className="step">02</span>
              <div>
                <h2 id="results-title">この乗り方がよさそう</h2>
                <p>{stationById[origin].name}から{targetLabel}ごろまで</p>
              </div>
            </div>
            {recommendations.length > 0 ? (
              <div className="route-list">
                {recommendations.map((recommendation) => <RouteCard recommendation={recommendation} key={recommendation.kind} />)}
              </div>
            ) : (
              <div className="empty-state">
                <strong>条件に合う電車が見つかりませんでした</strong>
                <p>出発時刻を早めるか、時間を短くして試してください。</p>
              </div>
            )}
          </section>
        )}

        <section className="tips" aria-labelledby="tips-title">
          <p className="kicker">BEFORE YOU RIDE</p>
          <h2 id="tips-title">乗る前に</h2>
          <ul>
            <li>「座りっぱなし」は同じ車両で移動できる意味です。着席を保証するものではありません。</li>
            <li>遅延・運休・臨時ダイヤは反映されません。駅の案内を優先してください。</li>
            <li>同じ駅に戻る乗車や長時間の乗車は、改札を出る前に係員へ運賃をご確認ください。</li>
          </ul>
        </section>
      </main>

      <footer>
        <div className="footer-mark" aria-hidden="true">JY</div>
        <div>
          <p>ヤマノテループは非公式の乗車プラン提案ツールです。</p>
          <p>駅座標: <a href="https://www.heartrails-express.com/" target="_blank" rel="noreferrer">HeartRails Express</a></p>
        </div>
      </footer>
    </>
  )
}
