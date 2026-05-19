import { useRef, useState, useCallback, useEffect } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import {
  Map,
  Camera,
  GeoJSONSource,
  Layer,
  type CameraRef,
  type StyleSpecification,
} from '@maplibre/maplibre-react-native'
import { TILE_LAYERS, getTileLayer, DEFAULT_TILE_LAYER_ID, type TileLayer } from '../lib/tiles'

export type LatLon = { lat: number; lon: number }

type Props = {
  points: LatLon[]
  style?: object
}

const C = {
  bg: '#0d1f1a', card: '#132920', border: '#1a3328',
  text: '#e8f5e9', muted: '#4d6e5e',
}

function buildStyle(layer: TileLayer): StyleSpecification {
  return {
    version: 8,
    sources: {
      'raster-tiles': {
        type: 'raster',
        tiles: [layer.rasterUrl!],
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
        source: 'raster-tiles',
      },
    ],
  } as StyleSpecification
}

export default function TrailMap({ points, style }: Props) {
  const [activeLayerId, setActiveLayerId] = useState(DEFAULT_TILE_LAYER_ID)
  const [showPicker, setShowPicker] = useState(false)
  const cameraRef = useRef<CameraRef>(null)
  const [mapReady, setMapReady] = useState(false)

  const activeLayer = getTileLayer(activeLayerId)
  const mapStyle = buildStyle(activeLayer)

  const fitToTrack = useCallback(() => {
    if (points.length < 2 || !cameraRef.current) return
    const lats = points.map((p) => p.lat)
    const lons = points.map((p) => p.lon)
    const west = Math.min(...lons)
    const east = Math.max(...lons)
    const south = Math.min(...lats)
    const north = Math.max(...lats)
    // LngLatBounds = [west, south, east, north]
    cameraRef.current.fitBounds([west, south, east, north], {
      padding: { top: 50, bottom: 50, left: 50, right: 50 },
      duration: 500,
    })
  }, [points])

  useEffect(() => {
    if (mapReady) fitToTrack()
  }, [mapReady, fitToTrack])

  const initialCenter: [number, number] = points.length > 0
    ? [points[Math.floor(points.length / 2)].lon, points[Math.floor(points.length / 2)].lat]
    : [116.4, 39.9]

  // GeoJSON for track line
  const lineData = {
    type: 'FeatureCollection' as const,
    features: points.length > 1 ? [{
      type: 'Feature' as const,
      geometry: {
        type: 'LineString' as const,
        coordinates: points.map((p) => [p.lon, p.lat]),
      },
      properties: {},
    }] : [],
  }

  // GeoJSON for start/end markers
  const markerData = {
    type: 'FeatureCollection' as const,
    features: [
      ...(points.length > 0 ? [{
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [points[0].lon, points[0].lat] },
        properties: { kind: 'start' },
      }] : []),
      ...(points.length > 1 ? [{
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [points[points.length - 1].lon, points[points.length - 1].lat] },
        properties: { kind: 'end' },
      }] : []),
    ],
  }

  return (
    <View style={[s.container, style]}>
      <Map
        mapStyle={mapStyle}
        style={s.map}
        onDidFinishLoadingMap={() => setMapReady(true)}
      >
        <Camera
          ref={cameraRef}
          initialViewState={{
            center: initialCenter,
            zoom: 11,
          }}
        />

        {/* Track polyline */}
        <GeoJSONSource id="track-source" data={lineData}>
          <Layer
            id="track-outline"
            type="line"
            paint={{ 'line-color': '#000000', 'line-width': 5, 'line-opacity': 0.25 }}
            layout={{ 'line-cap': 'round', 'line-join': 'round' }}
          />
          <Layer
            id="track-line"
            type="line"
            paint={{ 'line-color': '#4ade80', 'line-width': 3 }}
            layout={{ 'line-cap': 'round', 'line-join': 'round' }}
          />
        </GeoJSONSource>

        {/* Start / end markers */}
        <GeoJSONSource id="markers-source" data={markerData}>
          <Layer
            id="marker-halo"
            type="circle"
            paint={{ 'circle-radius': 10, 'circle-color': '#000000', 'circle-opacity': 0.2 }}
          />
          <Layer
            id="marker-dot"
            type="circle"
            paint={{
              'circle-radius': 7,
              'circle-color': ['match', ['get', 'kind'], 'start', '#4ade80', '#f87171'] as unknown as string,
              'circle-stroke-width': 2,
              'circle-stroke-color': '#ffffff',
            }}
          />
        </GeoJSONSource>
      </Map>

      {/* Layer switcher */}
      <TouchableOpacity
        style={s.layerBtn}
        onPress={() => setShowPicker(!showPicker)}
        activeOpacity={0.8}
      >
        <Text style={s.layerBtnText}>🗺 {activeLayer.name}</Text>
      </TouchableOpacity>

      {showPicker && (
        <View style={s.picker}>
          <Text style={s.pickerTitle}>选择地图图层</Text>
          {TILE_LAYERS.map((layer) => (
            <TouchableOpacity
              key={layer.id}
              style={[s.pickerItem, activeLayerId === layer.id && s.pickerItemActive]}
              onPress={() => { setActiveLayerId(layer.id); setShowPicker(false) }}
            >
              <View style={s.pickerContent}>
                <View style={s.pickerRow}>
                  <Text style={s.pickerName}>{layer.name}</Text>
                  {layer.hasContours && (
                    <View style={s.badge}>
                      <Text style={s.badgeText}>等高线</Text>
                    </View>
                  )}
                  {activeLayerId === layer.id && <Text style={s.check}>✓</Text>}
                </View>
                <Text style={s.pickerDesc}>{layer.description}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Fit to track */}
      <TouchableOpacity style={s.fitBtn} onPress={fitToTrack}>
        <Text style={s.fitText}>⊞</Text>
      </TouchableOpacity>
    </View>
  )
}

const s = StyleSheet.create({
  container: { position: 'relative', overflow: 'hidden' },
  map: { flex: 1 },

  layerBtn: {
    position: 'absolute', top: 10, left: 10,
    backgroundColor: 'rgba(13,31,26,0.9)',
    borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7,
    borderWidth: 1, borderColor: 'rgba(74,222,128,0.3)',
  },
  layerBtnText: { fontSize: 12, fontWeight: '600', color: '#e8f5e9' },

  picker: {
    position: 'absolute', top: 46, left: 10, right: 10,
    backgroundColor: 'rgba(13,31,26,0.97)',
    borderRadius: 12, borderWidth: 1, borderColor: C.border,
    overflow: 'hidden',
  },
  pickerTitle: {
    fontSize: 11, fontWeight: '600', color: C.muted,
    paddingHorizontal: 12, paddingTop: 10, paddingBottom: 6,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  pickerItem: {
    paddingHorizontal: 12, paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: C.border,
  },
  pickerItemActive: { backgroundColor: 'rgba(74,222,128,0.08)' },
  pickerContent: { gap: 2 },
  pickerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pickerName: { fontSize: 13, fontWeight: '600', color: '#e8f5e9' },
  pickerDesc: { fontSize: 11, color: C.muted },
  badge: {
    backgroundColor: 'rgba(74,222,128,0.15)', borderRadius: 4,
    paddingHorizontal: 5, paddingVertical: 1,
    borderWidth: 1, borderColor: 'rgba(74,222,128,0.3)',
  },
  badgeText: { fontSize: 9, color: '#4ade80' },
  check: { fontSize: 13, color: '#4ade80', fontWeight: '700', marginLeft: 'auto' },

  fitBtn: {
    position: 'absolute', bottom: 10, right: 10,
    width: 36, height: 36, borderRadius: 8,
    backgroundColor: 'rgba(13,31,26,0.9)',
    borderWidth: 1, borderColor: 'rgba(74,222,128,0.3)',
    alignItems: 'center', justifyContent: 'center',
  },
  fitText: { fontSize: 18, color: '#e8f5e9' },
})
