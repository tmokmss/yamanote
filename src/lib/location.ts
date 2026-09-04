import { stationById, stationCoordinates } from '../data/stations'
import type { Station } from '../types'

const earthRadiusMeters = 6_371_000
const radians = (degrees: number) => degrees * Math.PI / 180

export const distanceMeters = (
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
): number => {
  const latitudeDelta = radians(to.latitude - from.latitude)
  const longitudeDelta = radians(to.longitude - from.longitude)
  const fromLatitude = radians(from.latitude)
  const toLatitude = radians(to.latitude)
  const haversine = Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(fromLatitude) * Math.cos(toLatitude) * Math.sin(longitudeDelta / 2) ** 2
  return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
}

export const nearestYamanoteStation = (
  latitude: number,
  longitude: number,
): { station: Station; distanceMeters: number } => {
  const position = { latitude, longitude }
  const nearest = Object.entries(stationCoordinates)
    .map(([id, coordinates]) => ({
      station: stationById[id as keyof typeof stationById],
      distanceMeters: distanceMeters(position, coordinates),
    }))
    .sort((a, b) => a.distanceMeters - b.distanceMeters)[0]
  return nearest
}

export const formatDistance = (meters: number): string => {
  if (meters < 1_000) return `約${Math.max(50, Math.round(meters / 50) * 50)}m`
  return `約${(meters / 1_000).toFixed(1)}km`
}
