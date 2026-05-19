import { useState, useCallback, useMemo } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, SafeAreaView, Alert, TextInput, Modal,
} from 'react-native'
import MapView, { Polyline, Marker } from 'react-native-maps'
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router'
import { getTrack, getTrackPoints, updateTrack, deleteTrack, type Track, type TrackPoint } from '../../src/db'
import { fmtDistance, fmtDuration, fmtElevation, fmtDate } from '../../src/lib/format'

const C = {
  bg: '#0d1f1a', card: '#132920', border: '#1a3328',
  text: '#e8f5e9', soft: '#7aad8e', muted: '#4d6e5e',
  green: '#4ade80', accent: '#34d399', red: '#f87171',
}

export default function TrackDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const [track, setTrack] = useState<Track | null>(null)
  const [points, setPoints] = useState<TrackPoint[]>([])
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [editTags, setEditTags] = useState('')
  const [editNote, setEditNote] = useState('')

  useFocusEffect(useCallback(() => {
    const t = getTrack(Number(id))
    if (!t) { router.back(); return }
    setTrack(t)
    setEditName(t.name)
    setEditTags(t.tags)
    setEditNote(t.note)
    setPoints(getTrackPoints(t.id))
  }, [id]))

  const coords = useMemo(() =>
    points.map((p) => ({ latitude: p.lat, longitude: p.lon })),
    [points]
  )

  const region = useMemo(() => {
    if (coords.length === 0) return undefined
    const lats = coords.map((c) => c.latitude)
    const lons = coords.map((c) => c.longitude)
    const minLat = Math.min(...lats), maxLat = Math.max(...lats)
    const minLon = Math.min(...lons), maxLon = Math.max(...lons)
    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLon + maxLon) / 2,
      latitudeDelta: Math.max(0.005, (maxLat - minLat) * 1.4),
      longitudeDelta: Math.max(0.005, (maxLon - minLon) * 1.4),
    }
  }, [coords])

  function saveEdit() {
    if (!track) return
    updateTrack(track.id, { name: editName, tags: editTags, note: editNote })
    setTrack({ ...track, name: editName, tags: editTags, note: editNote })
    setEditing(false)
  }

  function confirmDelete() {
    Alert.alert('删除路线', `确定要删除「${track?.name}」吗？此操作不可恢复。`, [
      { text: '取消', style: 'cancel' },
      {
        text: '删除', style: 'destructive',
        onPress: () => {
          deleteTrack(Number(id))
          router.back()
        },
      },
    ])
  }

  if (!track) return null

  const tags = track.tags ? track.tags.split(',').filter(Boolean) : []

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.scroll} stickyHeaderIndices={[0]}>
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
            <Text style={s.backText}>‹ 返回</Text>
          </TouchableOpacity>
          <View style={s.headerActions}>
            <TouchableOpacity onPress={() => setEditing(true)} style={s.actionBtn}>
              <Text style={s.actionText}>编辑</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={confirmDelete} style={[s.actionBtn, s.deleteBtn]}>
              <Text style={s.deleteText}>删除</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Title + meta */}
        <View style={s.titleSection}>
          <Text style={s.trackName}>{track.name}</Text>
          <Text style={s.trackDate}>{fmtDate(track.date)}</Text>
          {tags.length > 0 && (
            <View style={s.tags}>
              {tags.map((tag) => (
                <View key={tag} style={s.tag}>
                  <Text style={s.tagText}>{tag}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Stats */}
        <View style={s.statsGrid}>
          <StatCard icon="📏" label="总距离" value={fmtDistance(track.distance)} />
          <StatCard icon="⬆" label="爬升" value={fmtElevation(track.elev_gain)} />
          <StatCard icon="⏱" label="用时" value={fmtDuration(track.duration)} />
          <StatCard icon="📍" label="轨迹点" value={String(points.length)} />
        </View>

        {/* Map */}
        {coords.length > 0 && region && (
          <View style={s.mapContainer}>
            <MapView
              style={s.map}
              region={region}
              mapType="terrain"
              showsCompass
            >
              <Polyline
                coordinates={coords}
                strokeColor="#4ade80"
                strokeWidth={3}
              />
              <Marker coordinate={coords[0]} title="起点" pinColor="green" />
              <Marker coordinate={coords[coords.length - 1]} title="终点" pinColor="red" />
            </MapView>
          </View>
        )}

        {/* Elevation mini-chart */}
        {points.length > 1 && (
          <ElevationChart points={points} />
        )}

        {/* Note */}
        {track.note ? (
          <View style={s.noteCard}>
            <Text style={s.noteLabel}>备注</Text>
            <Text style={s.noteText}>{track.note}</Text>
          </View>
        ) : null}
      </ScrollView>

      {/* Edit Modal */}
      <Modal visible={editing} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>编辑路线</Text>

            <Text style={s.fieldLabel}>名称</Text>
            <TextInput style={s.input} value={editName} onChangeText={setEditName} placeholderTextColor={C.muted} />

            <Text style={s.fieldLabel}>标签</Text>
            <TextInput style={s.input} value={editTags} onChangeText={setEditTags}
              placeholder="逗号分隔" placeholderTextColor={C.muted} />

            <Text style={s.fieldLabel}>备注</Text>
            <TextInput style={[s.input, s.textarea]} value={editNote} onChangeText={setEditNote}
              multiline numberOfLines={4} textAlignVertical="top" placeholderTextColor={C.muted} />

            <View style={s.modalActions}>
              <TouchableOpacity style={s.cancelBtn} onPress={() => setEditing(false)}>
                <Text style={s.cancelText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.saveBtn} onPress={saveEdit}>
                <Text style={s.saveText}>保存</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}

function StatCard({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={s.statCard}>
      <Text style={s.statIcon}>{icon}</Text>
      <Text style={s.statValue}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  )
}

function ElevationChart({ points }: { points: TrackPoint[] }) {
  const elevations = points.map((p) => p.elevation)
  const minE = Math.min(...elevations)
  const maxE = Math.max(...elevations)
  const range = Math.max(maxE - minE, 1)
  const H = 60
  const W = 320
  const step = W / (points.length - 1)

  const pathPoints = elevations.map((e, i) => {
    const x = i * step
    const y = H - ((e - minE) / range) * H
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')

  return (
    <View style={s.elevCard}>
      <Text style={s.elevLabel}>高程剖面  {fmtElevation(minE)} — {fmtElevation(maxE)}</Text>
      <View style={s.svgWrap}>
        <View style={s.svgContainer}>
          {/* SVG-like using Views (simplified) */}
          {elevations.map((e, i) => {
            if (i === 0) return null
            const prev = elevations[i - 1]
            const x1 = ((i - 1) / (points.length - 1)) * 100
            const x2 = (i / (points.length - 1)) * 100
            const y1 = 100 - ((prev - minE) / range) * 100
            const y2 = 100 - ((e - minE) / range) * 100
            const mid = (y1 + y2) / 2
            return (
              <View
                key={i}
                style={{
                  position: 'absolute',
                  left: `${x1}%` as unknown as number,
                  bottom: `${Math.min(y1, y2)}%` as unknown as number,
                  width: `${x2 - x1 + 0.5}%` as unknown as number,
                  height: Math.max(1, Math.abs(y1 - y2) * 0.5 + 1),
                  backgroundColor: C.green,
                  opacity: 0.7,
                }}
              />
            )
          })}
        </View>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  scroll: { gap: 14 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: C.bg,
  },
  backBtn: { paddingVertical: 6, paddingRight: 16 },
  backText: { fontSize: 17, color: C.soft },
  headerActions: { flexDirection: 'row', gap: 8 },
  actionBtn: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 8, borderWidth: 1, borderColor: C.border,
  },
  actionText: { fontSize: 13, color: C.soft },
  deleteBtn: { borderColor: '#5a2020' },
  deleteText: { fontSize: 13, color: C.red },

  titleSection: { paddingHorizontal: 16, gap: 6 },
  trackName: { fontSize: 22, fontWeight: '700', color: C.text },
  trackDate: { fontSize: 13, color: C.muted },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  tag: {
    backgroundColor: '#1a3a2a', borderRadius: 6,
    borderWidth: 1, borderColor: '#2a4a3a',
    paddingHorizontal: 8, paddingVertical: 3,
  },
  tagText: { fontSize: 12, color: C.accent },

  statsGrid: {
    flexDirection: 'row', marginHorizontal: 16,
    gap: 8,
  },
  statCard: {
    flex: 1, backgroundColor: C.card, borderRadius: 12,
    borderWidth: 1, borderColor: C.border,
    padding: 12, alignItems: 'center', gap: 4,
  },
  statIcon: { fontSize: 18 },
  statValue: { fontSize: 15, fontWeight: '700', color: C.green },
  statLabel: { fontSize: 10, color: C.muted },

  mapContainer: {
    marginHorizontal: 16, borderRadius: 16, overflow: 'hidden',
    borderWidth: 1, borderColor: C.border,
    height: 260,
  },
  map: { width: '100%', height: '100%' },

  elevCard: {
    marginHorizontal: 16, backgroundColor: C.card,
    borderRadius: 12, borderWidth: 1, borderColor: C.border,
    padding: 14, gap: 8,
  },
  elevLabel: { fontSize: 12, color: C.muted },
  svgWrap: { height: 60, position: 'relative' },
  svgContainer: { position: 'absolute', inset: 0 },

  noteCard: {
    marginHorizontal: 16, marginBottom: 24,
    backgroundColor: C.card, borderRadius: 12,
    borderWidth: 1, borderColor: C.border,
    padding: 14,
  },
  noteLabel: { fontSize: 11, color: C.muted, marginBottom: 6 },
  noteText: { fontSize: 14, color: C.soft, lineHeight: 20 },

  // Modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: C.card, borderTopLeftRadius: 20,
    borderTopRightRadius: 20, padding: 24, gap: 12,
    paddingBottom: 40,
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: C.text, marginBottom: 4 },
  fieldLabel: { fontSize: 13, color: C.soft },
  input: {
    backgroundColor: C.bg, borderRadius: 10,
    borderWidth: 1, borderColor: C.border,
    paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, color: C.text,
  },
  textarea: { minHeight: 80, paddingTop: 10 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  cancelBtn: {
    flex: 1, borderWidth: 1, borderColor: C.border, borderRadius: 10,
    paddingVertical: 13, alignItems: 'center',
  },
  cancelText: { fontSize: 14, color: C.muted },
  saveBtn: {
    flex: 2, backgroundColor: C.green, borderRadius: 10,
    paddingVertical: 13, alignItems: 'center',
  },
  saveText: { fontSize: 14, fontWeight: '700', color: '#0d1f1a' },
})
