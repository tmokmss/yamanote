import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from 'react'
import RouteMap from './components/RouteMap'
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

type View = 'search' | 'results'

const directionLabel: Record<Direction, string> = {
  inner: '内回り',
  outer: '外回り',
}

const formatUpdatedAt = (value: string) =>
  new Intl.DateTimeFormat('ja-JP', { dateStyle: 'medium' }).format(new Date(value))

// 1行に5つ並べるので「1時間30分」より短い表記にする
const presetLabel = (minutes: number) => {
  if (minutes < 60) return `${minutes}分`
  const hours = minutes / 60
  return `${Number.isInteger(hours) ? hours : hours.toFixed(1)}時間`
}

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

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

function RoutePanel({ recommendation }: { recommendation: RouteRecommendation }) {
  const { route } = recommendation
  const difference = route.arrivalTime - route.targetTime
  return (
    <div className={`route-card route-card--${recommendation.kind}`}>
      <div className="route-card__heading">
        <div>
          <h3>
            {formatMinute(route.departureTime)} <span aria-hidden="true">→</span>{' '}
            {formatMinute(route.arrivalTime)}
          </h3>
          <p className="route-card__description">{recommendation.description}</p>
        </div>
        <span className={`difference ${difference === 0 ? 'difference--exact' : ''}`}>
          {formatDifference(difference)}
        </span>
      </div>

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

      <RouteMap route={route} />

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
    </div>
  )
}

// 候補を横並びにして、スワイプ（scroll-snap）で1枚ずつ切り替える
function RouteDeck({ recommendations }: { recommendations: RouteRecommendation[] }) {
  const deckRef = useRef<HTMLDivElement>(null)
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])
  const [active, setActive] = useState(0)
  const [revealed, setRevealed] = useState<Set<string>>(() => new Set())

  // 新しい結果が来たら先頭カードへ戻す
  useEffect(() => {
    deckRef.current?.scrollTo({ left: 0, behavior: 'auto' })
    setActive(0)
    setRevealed(new Set())
  }, [recommendations])

  // スクロール位置から表示中のカードを求める
  useEffect(() => {
    const deck = deckRef.current
    if (!deck) return
    let frame = 0
    const onScroll = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        setActive(Math.max(0, Math.min(recommendations.length - 1, Math.round(deck.scrollLeft / deck.clientWidth))))
      })
    }
    deck.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      deck.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(frame)
    }
  }, [recommendations.length])

  // 画面に入ったカードから路線図の描画アニメーションを始める
  useEffect(() => {
    const deck = deckRef.current
    if (!deck) return
    if (!('IntersectionObserver' in window)) {
      setRevealed(new Set(recommendations.map((recommendation) => recommendation.kind)))
      return
    }
    const observer = new IntersectionObserver(
      (entries) => {
        const seen = entries
          .filter((entry) => entry.isIntersecting)
          .map((entry) => (entry.target as HTMLElement).dataset.kind!)
        if (seen.length === 0) return
        setRevealed((previous) => {
          const next = new Set(previous)
          seen.forEach((kind) => next.add(kind))
          return next
        })
      },
      { root: deck, threshold: 0.35 },
    )
    for (const cell of deck.children) observer.observe(cell)
    return () => observer.disconnect()
  }, [recommendations])

  const goTo = (index: number) => {
    const deck = deckRef.current
    if (!deck) return
    const target = Math.max(0, Math.min(recommendations.length - 1, index))
    deck.scrollTo({ left: target * deck.clientWidth, behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
    tabRefs.current[target]?.focus()
  }

  const onTabKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowRight') goTo(active + 1)
    else if (event.key === 'ArrowLeft') goTo(active - 1)
    else if (event.key === 'Home') goTo(0)
    else if (event.key === 'End') goTo(recommendations.length - 1)
    else return
    event.preventDefault()
  }

  return (
    <>
      <div className="deck-tabs" role="tablist" aria-label="乗り方の候補" onKeyDown={onTabKeyDown}>
        {recommendations.map((recommendation, index) => (
          <button
            type="button"
            role="tab"
            id={`tab-${recommendation.kind}`}
            aria-selected={index === active}
            aria-controls={`panel-${recommendation.kind}`}
            tabIndex={index === active ? 0 : -1}
            onClick={() => goTo(index)}
            ref={(element) => {
              tabRefs.current[index] = element
            }}
            key={recommendation.kind}
          >
            <span className="deck-tabs__index" aria-hidden="true">{index + 1}</span>
            {recommendation.label}
          </button>
        ))}
      </div>
      {recommendations.length > 1 && (
        <p className={`deck-hint ${revealed.size > 1 ? 'is-done' : ''}`} aria-hidden="true">
          横にスワイプで他の乗り方
        </p>
      )}
      <div className="deck" ref={deckRef}>
        {recommendations.map((recommendation) => (
          <article
            className={`deck__cell ${revealed.has(recommendation.kind) ? 'is-revealed' : ''}`}
            role="tabpanel"
            id={`panel-${recommendation.kind}`}
            aria-labelledby={`tab-${recommendation.kind}`}
            data-kind={recommendation.kind}
            key={recommendation.kind}
          >
            <RoutePanel recommendation={recommendation} />
          </article>
        ))}
      </div>
    </>
  )
}

export default function App() {
  const [view, setView] = useState<View>('search')
  const [origin, setOrigin] = useState<StationId>(initialOrigin)
  const [destination, setDestination] = useState<StationId>(initialDestination)
  const [hasDestination, setHasDestination] = useState(initialDestination !== initialOrigin)
  const [duration, setDuration] = useState(initialMinutes)
  const [dateTime, setDateTime] = useState(initialAt)
  const [recommendations, setRecommendations] = useState<RouteRecommendation[] | null>(null)
  const [searched, setSearched] = useState<{ origin: StationId; destination: StationId; target: string } | null>(null)
  const [manifest, setManifest] = useState<TimetableManifest | null>(null)
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [error, setError] = useState('')
  const [locationStatus, setLocationStatus] = useState<'idle' | 'locating' | 'success' | 'error'>('idle')
  const [locationMessage, setLocationMessage] = useState('')
  const resultsTitleRef = useRef<HTMLHeadingElement>(null)
  const recommendationsRef = useRef(recommendations)
  recommendationsRef.current = recommendations

  useEffect(() => {
    loadManifest().then(setManifest).catch(() => undefined)
  }, [])

  // 結果画面は履歴に積むので、ブラウザの「戻る」で検索画面へ帰れる
  useEffect(() => {
    window.history.replaceState(null, '', window.location.href)
    const onPopState = (event: PopStateEvent) => {
      setView(event.state?.view === 'results' && recommendationsRef.current ? 'results' : 'search')
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  useEffect(() => {
    if (view === 'results') {
      const timer = window.setTimeout(() => resultsTitleRef.current?.focus({ preventScroll: true }), 380)
      return () => window.clearTimeout(timer)
    }
  }, [view, recommendations])

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

  // pushHistory が真なら結果画面を履歴に積む。共有URLから開いた直後は積まない
  const runSearch = async (pushHistory: boolean) => {
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
      setSearched({ origin, destination: effectiveDestination, target: targetLabel })
      setStatus('idle')

      const params = new URLSearchParams({
        from: origin,
        minutes: String(duration),
        at: dateTime,
      })
      if (hasDestination) params.set('to', destination)
      const url = `${window.location.pathname}?${params}`
      if (!pushHistory) window.history.replaceState(null, '', url)
      else if (window.history.state?.view === 'results') window.history.replaceState({ view: 'results' }, '', url)
      else window.history.pushState({ view: 'results' }, '', url)
      setView('results')
    } catch (caught) {
      setStatus('error')
      setError(caught instanceof Error ? caught.message : '検索に失敗しました')
    }
  }

  const search = (event: FormEvent) => {
    event.preventDefault()
    void runSearch(true)
  }

  // 条件入りのURLで開いたら、そのまま結果を出す
  useEffect(() => {
    if (initialParams.has('from') && initialParams.has('minutes')) void runSearch(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const showSearch = () => {
    if (window.history.state?.view === 'results') window.history.back()
    else setView('search')
  }

  return (
    <div className={`stage stage--${view}`}>
      <div className="stage__track">
        <section className="screen screen--search" aria-hidden={view !== 'search'} inert={view !== 'search'}>
          <header className="topbar">
            <div className="brand">
              <span className="brand__loop" aria-hidden="true">JY</span>
              <div>
                <p className="kicker">YAMANOTE LOOP PLANNER</p>
                <h1>ヤマノテループ</h1>
              </div>
            </div>
            {manifest?.provisional && (
              <p className="pill" title={`${formatUpdatedAt(manifest.generatedAt)}更新の暫定時刻表を使っています`}>
                <span className="pill__dot" aria-hidden="true" />
                試験運転中<span className="pill__detail">・{formatUpdatedAt(manifest.generatedAt)}の暫定時刻表</span>
              </p>
            )}
          </header>

          <div className="screen__body">
            <div className="screen__inner">
              {manifest?.provider && (
                <aside className="notice" aria-label="データ提供元">
                  <span className="pill__dot" aria-hidden="true" />
                  <p>
                    交通データ提供元: {manifest.provider}（{formatUpdatedAt(manifest.generatedAt)}取得）。正確性・完全性は保証されません。データ内容について交通事業者へ直接問い合わせないでください。
                    {manifest.contactEmail && <> お問い合わせは<a href={`mailto:${manifest.contactEmail}`}>{manifest.contactEmail}</a>へ。</>}
                  </p>
                </aside>
              )}

              <form className="search-form" onSubmit={search} aria-label="乗り方を探す">
                <p className="search-form__lead">山手線を、いちばんラクな待合室に。</p>

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
                        {presetLabel(minutes)}
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

              <details className="about">
                <summary>乗る前の注意とデータについて</summary>
                <ul>
                  <li>「座りっぱなし」は同じ車両で移動できる意味です。着席を保証するものではありません。</li>
                  <li>遅延・運休・臨時ダイヤは反映されません。駅の案内を優先してください。</li>
                  <li>同じ駅に戻る乗り方や一周以上の乗り方は通常運賃では認められていないため、<a href="https://www.jreast.co.jp/tickets/info.aspx?GoodsCd=2485" target="_blank" rel="noreferrer">都区内パス</a>などのフリーきっぷを買ってから乗ってください。途中下車はできません。</li>
                  <li>ヤマノテループは非公式の乗車プラン提案ツールです。運賃規則の適用は各鉄道事業者の案内に従ってください。駅座標: <a href="https://www.heartrails-express.com/" target="_blank" rel="noreferrer">HeartRails Express</a></li>
                </ul>
              </details>
            </div>
          </div>
        </section>

        <section className="screen screen--results" aria-hidden={view !== 'results'} inert={view !== 'results'}>
          <header className="topbar topbar--results">
            <button className="back-button" type="button" onClick={showSearch}>
              <span aria-hidden="true">‹</span>条件を変える
            </button>
            <h2 className="results-title" ref={resultsTitleRef} tabIndex={-1}>
              {searched && (
                <>
                  <span>{stationById[searched.origin].name}から</span>
                  {searched.destination !== searched.origin && <span>{stationById[searched.destination].name}へ</span>}
                  <span>{searched.target}ごろまで</span>
                </>
              )}
            </h2>
          </header>

          {recommendations && recommendations.length > 0 ? (
            <RouteDeck recommendations={recommendations} />
          ) : (
            <div className="screen__body">
              <div className="screen__inner">
                <div className="empty-state">
                  <strong>条件に合う電車が見つかりませんでした</strong>
                  <p>出発時刻を早めるか、時間を短くして試してください。</p>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
