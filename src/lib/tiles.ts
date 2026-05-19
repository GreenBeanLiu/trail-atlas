// Map tile layer definitions
// All sources are free / open, no API key required by default.
// 天地图 requires a free key from tianditu.gov.cn

export type TileLayer = {
  id: string
  name: string
  description: string
  styleUrl?: string        // MapLibre GL style (vector)
  rasterUrl?: string       // XYZ raster tile template
  attribution: string
  minZoom: number
  maxZoom: number
  hasContours: boolean
}

// 天地图 token placeholder — user configures in settings if they want it
let _tiandituKey = ''
export function setTiandituKey(key: string) { _tiandituKey = key }
export function getTiandituKey() { return _tiandituKey }

export const TILE_LAYERS: TileLayer[] = [
  {
    id: 'opentopomap',
    name: 'OpenTopoMap',
    description: '等高线地形图 · OSM + SRTM',
    rasterUrl: 'https://tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: '© OpenTopoMap (CC-BY-SA)',
    minZoom: 1,
    maxZoom: 17,
    hasContours: true,
  },
  {
    id: 'esri-topo',
    name: 'ESRI 地形图',
    description: '等高线 · 全球地形数据',
    rasterUrl: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
    attribution: '© Esri',
    minZoom: 1,
    maxZoom: 18,
    hasContours: true,
  },
  {
    id: 'amap-street',
    name: '高德地图',
    description: '中国路网 · 速度快',
    rasterUrl: 'https://webrd01.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=7&x={x}&y={y}&z={z}',
    attribution: '© 高德地图',
    minZoom: 1,
    maxZoom: 18,
    hasContours: false,
  },
  {
    id: 'amap-satellite',
    name: '高德卫星',
    description: '卫星图 + 道路标注',
    rasterUrl: 'https://webst01.is.autonavi.com/appmaptile?style=6&x={x}&y={y}&z={z}',
    attribution: '© 高德地图',
    minZoom: 1,
    maxZoom: 18,
    hasContours: false,
  },
  {
    id: 'osm',
    name: 'OpenStreetMap',
    description: '开源街道地图',
    rasterUrl: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '© OpenStreetMap contributors',
    minZoom: 1,
    maxZoom: 19,
    hasContours: false,
  },
]

export const DEFAULT_TILE_LAYER_ID = 'opentopomap'

export function getTileLayer(id: string): TileLayer {
  return TILE_LAYERS.find((l) => l.id === id) ?? TILE_LAYERS[0]
}

// Build MapLibre GL style JSON from a raster tile URL
export function buildRasterStyle(layer: TileLayer): object {
  const url = layer.rasterUrl!
  // MapLibre expects {x} {y} {z} but some sources use different templates
  const tileUrl = url
    .replace('{x}', '{x}')
    .replace('{y}', '{y}')
    .replace('{z}', '{z}')

  return {
    version: 8,
    sources: {
      raster: {
        type: 'raster',
        tiles: [tileUrl],
        tileSize: 256,
        minzoom: layer.minZoom,
        maxzoom: layer.maxZoom,
        attribution: layer.attribution,
      },
    },
    layers: [
      {
        id: 'raster-layer',
        type: 'raster',
        source: 'raster',
      },
    ],
  }
}
