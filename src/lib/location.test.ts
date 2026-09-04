import { describe, expect, it } from 'vitest'
import { distanceMeters, formatDistance, nearestYamanoteStation } from './location'

describe('nearestYamanoteStation', () => {
  it('東京駅付近から東京駅を選ぶ', () => {
    const result = nearestYamanoteStation(35.6815, 139.7662)
    expect(result.station.id).toBe('tokyo')
    expect(result.distanceMeters).toBeLessThan(50)
  })

  it('渋谷駅付近から渋谷駅を選ぶ', () => {
    expect(nearestYamanoteStation(35.659, 139.7009).station.id).toBe('shibuya')
  })
})

describe('distanceMeters', () => {
  it('同じ座標の距離は0', () => {
    expect(distanceMeters({ latitude: 35, longitude: 139 }, { latitude: 35, longitude: 139 })).toBe(0)
  })

  it('距離を読みやすく丸める', () => {
    expect(formatDistance(478)).toBe('約500m')
    expect(formatDistance(1_240)).toBe('約1.2km')
  })
})
