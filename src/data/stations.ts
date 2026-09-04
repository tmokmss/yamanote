import type { Station, StationId } from '../types'

export const stations: Station[] = [
  { id: 'tokyo', code: 'JY01', name: '東京', kana: 'とうきょう' },
  { id: 'kanda', code: 'JY02', name: '神田', kana: 'かんだ' },
  { id: 'akihabara', code: 'JY03', name: '秋葉原', kana: 'あきはばら' },
  { id: 'okachimachi', code: 'JY04', name: '御徒町', kana: 'おかちまち' },
  { id: 'ueno', code: 'JY05', name: '上野', kana: 'うえの' },
  { id: 'uguisudani', code: 'JY06', name: '鶯谷', kana: 'うぐいすだに' },
  { id: 'nippori', code: 'JY07', name: '日暮里', kana: 'にっぽり' },
  { id: 'nishi-nippori', code: 'JY08', name: '西日暮里', kana: 'にしにっぽり' },
  { id: 'tabata', code: 'JY09', name: '田端', kana: 'たばた' },
  { id: 'komagome', code: 'JY10', name: '駒込', kana: 'こまごめ' },
  { id: 'sugamo', code: 'JY11', name: '巣鴨', kana: 'すがも' },
  { id: 'otsuka', code: 'JY12', name: '大塚', kana: 'おおつか' },
  { id: 'ikebukuro', code: 'JY13', name: '池袋', kana: 'いけぶくろ' },
  { id: 'mejiro', code: 'JY14', name: '目白', kana: 'めじろ' },
  { id: 'takadanobaba', code: 'JY15', name: '高田馬場', kana: 'たかだのばば' },
  { id: 'shin-okubo', code: 'JY16', name: '新大久保', kana: 'しんおおくぼ' },
  { id: 'shinjuku', code: 'JY17', name: '新宿', kana: 'しんじゅく' },
  { id: 'yoyogi', code: 'JY18', name: '代々木', kana: 'よよぎ' },
  { id: 'harajuku', code: 'JY19', name: '原宿', kana: 'はらじゅく' },
  { id: 'shibuya', code: 'JY20', name: '渋谷', kana: 'しぶや' },
  { id: 'ebisu', code: 'JY21', name: '恵比寿', kana: 'えびす' },
  { id: 'meguro', code: 'JY22', name: '目黒', kana: 'めぐろ' },
  { id: 'gotanda', code: 'JY23', name: '五反田', kana: 'ごたんだ' },
  { id: 'osaki', code: 'JY24', name: '大崎', kana: 'おおさき' },
  { id: 'shinagawa', code: 'JY25', name: '品川', kana: 'しながわ' },
  { id: 'takanawa-gateway', code: 'JY26', name: '高輪ゲートウェイ', kana: 'たかなわげーとうぇい' },
  { id: 'tamachi', code: 'JY27', name: '田町', kana: 'たまち' },
  { id: 'hamamatsucho', code: 'JY28', name: '浜松町', kana: 'はままつちょう' },
  { id: 'shimbashi', code: 'JY29', name: '新橋', kana: 'しんばし' },
  { id: 'yurakucho', code: 'JY30', name: '有楽町', kana: 'ゆうらくちょう' },
]

export const stationById = Object.fromEntries(
  stations.map((station) => [station.id, station]),
) as Record<StationId, Station>

export const stationNameToId = Object.fromEntries(
  stations.map((station) => [station.name, station.id]),
) as Record<string, StationId>

export const isStationId = (value: string | null): value is StationId =>
  value !== null && value in stationById

export const stationCoordinates: Record<StationId, { latitude: number; longitude: number }> = {
  tokyo: { latitude: 35.681391, longitude: 139.766103 },
  kanda: { latitude: 35.691173, longitude: 139.770641 },
  akihabara: { latitude: 35.698619, longitude: 139.773288 },
  okachimachi: { latitude: 35.707282, longitude: 139.774727 },
  ueno: { latitude: 35.71379, longitude: 139.777043 },
  uguisudani: { latitude: 35.721484, longitude: 139.778015 },
  nippori: { latitude: 35.727908, longitude: 139.771287 },
  'nishi-nippori': { latitude: 35.731954, longitude: 139.766857 },
  tabata: { latitude: 35.737781, longitude: 139.761229 },
  komagome: { latitude: 35.736825, longitude: 139.748053 },
  sugamo: { latitude: 35.733445, longitude: 139.739303 },
  otsuka: { latitude: 35.731412, longitude: 139.728584 },
  ikebukuro: { latitude: 35.730256, longitude: 139.711085 },
  mejiro: { latitude: 35.720476, longitude: 139.706228 },
  takadanobaba: { latitude: 35.712677, longitude: 139.703715 },
  'shin-okubo': { latitude: 35.700875, longitude: 139.700261 },
  shinjuku: { latitude: 35.689729, longitude: 139.700464 },
  yoyogi: { latitude: 35.683061, longitude: 139.702042 },
  harajuku: { latitude: 35.670646, longitude: 139.702592 },
  shibuya: { latitude: 35.658871, longitude: 139.701238 },
  ebisu: { latitude: 35.646684, longitude: 139.71007 },
  meguro: { latitude: 35.633923, longitude: 139.715775 },
  gotanda: { latitude: 35.625974, longitude: 139.723822 },
  osaki: { latitude: 35.619772, longitude: 139.728439 },
  shinagawa: { latitude: 35.62876, longitude: 139.738999 },
  'takanawa-gateway': { latitude: 35.635476, longitude: 139.740651 },
  tamachi: { latitude: 35.645737, longitude: 139.747575 },
  hamamatsucho: { latitude: 35.655391, longitude: 139.757135 },
  shimbashi: { latitude: 35.666195, longitude: 139.758587 },
  yurakucho: { latitude: 35.675441, longitude: 139.763806 },
}
