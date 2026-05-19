import { useState, useEffect, useRef, useCallback } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet,
  SafeAreaView, Alert, Platform,
} from 'react-native'
import * as Location from 'expo-location'
import { useRouter } from 'expo-router'
import { insertTrack, insertTrackPoints } from '../../src/db'
import { fmtDistance, fmtDuration, fmtElevation } from '../../src/lib/format'

const C = {
  bg: '#0d1f1a', card: '#132920', border: '#1a3328',
  text: '#e8f5e9', soft: '#7aad8e', muted: '#4d6e5e',
  green: '#4ade80', red: '#f87171',
}

type RecordPoint = {
  lat: number
  lon: number
  elevation: number
  timestamp: string
}

type RecordingState = 'idle' | 'recording' | 'paused'

export default function RecordScreen() {
  const router = useRouter()
  const [state, setState] = useState<RecordingState>('idle')
  const [permission, setPermission] = useState<boolean | null>(null)
  const [points, setPoints] = useState<RecordPoint[]>([])
  const [elapsed, setElapsed] = useState(0)
  const [currentPos, setCurrentPos] = useState<RecordPoint | null>(null)

  const locationSub = useRef<Location.LocationSubscription | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startTimeRef = useRef<number>(0)

  // Request permissions on mount
  useEffect(() => {
    Location.requestForegroundPermissionsAsync().then(({ status }) => {
      setPermission(status === 'granted')
    })
    return () => {
      locationSub.current?.remove()
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  const startRecording = useCallback(async () => {
    if (!permission) {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') {
        Alert.alert('需要位置权限', '请在系统设置中开启定位权限')
        return
      }
      setPermission(true)
    }

    setPoints([])
    setElapsed(0)
    startTimeRef.current = Date.now()
    setState('recording')

    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000))
    }, 1000)

    locationSub.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.BestForNavigation,
        distanceInterval: 5,   // record every 5 m of movement
        timeInterval: 3000,    // or every 3s
      },
      (loc) => {
        const pt: RecordPoint = {
          lat: loc.coords.latitude,
          lon: loc.coords.longitude,
          elevation: loc.coords.altitude ?? 0,
          timestamp: new Date(loc.timestamp).toISOString(),
        }
        setCurrentPos(pt)
        setPoints((prev) => [...prev, pt])
      }
    )
  }, [permission])

  const pauseRecording = useCallback(() => {
    locationSub.current?.remove()
    locationSub.current = null
    if (timerRef.current) clearInterval(timerRef.current)
    setState('paused')
  }, [])

  const resumeRecording = useCallback(async () => {
    startTimeRef.current = Date.now() - elapsed * 1000
    setState('recording')
    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000))
    }, 1000)
    locationSub.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.BestForNavigation, distanceInterval: 5, timeInterval: 3000 },
      (loc) => {
        const pt: RecordPoint = {
          lat: loc.coords.latitude,
          lon: loc.coords.longitude,
          elevation: loc.coords.altitude ?? 0,
          timestamp: new Date(loc.timestamp).toISOString(),
        }
        setCurrentPos(pt)
        setPoints((prev) => [...prev, pt])
      }
    )
  }, [elapsed])

  const stopAndSave = useCallback(() => {
    if (points.length < 2) {
      Alert.alert('轨迹太短', '需要至少 2 个轨迹点才能保存')
      return
    }

    Alert.prompt(
      '保存路线',
      '为这条路线起个名字',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '保存',
          onPress: (name: string | undefined) => {
            locationSub.current?.remove()
            if (timerRef.current) clearInterval(timerRef.current)

            // Calc stats
            const { distance, elevGain } = calcStats(points)
            const trackId = insertTrack({
              name: name?.trim() || `录制 ${new Date().toLocaleDateString('zh-CN')}`,
              note: '', tags: '',
              distance, elev_gain: elevGain,
              duration: elapsed,
              date: points[0].timestamp,
            })
            insertTrackPoints(trackId, points.map((p, i) => ({
              lat: p.lat, lon: p.lon,
              elevation: p.elevation,
              timestamp: p.timestamp,
              seq: i,
            })))

            setState('idle')
            setPoints([])
            setElapsed(0)
            router.replace('/')
          },
        },
      ],
      'plain-text',
      `录制 ${new Date().toLocaleDateString('zh-CN')}`
    )
  }, [points, elapsed, router])

  const discard = useCallback(() => {
    Alert.alert('放弃录制', '确定要放弃当前录制吗？', [
      { text: '继续录制', style: 'cancel' },
      {
        text: '放弃', style: 'destructive',
        onPress: () => {
          locationSub.current?.remove()
          if (timerRef.current) clearInterval(timerRef.current)
          setState('idle')
          setPoints([])
          setElapsed(0)
        },
      },
    ])
  }, [])

  const { distance, elevGain } = calcStats(points)

  if (permission === false) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.center}>
          <Text style={s.permIcon}>📍</Text>
          <Text style={s.permTitle}>需要位置权限</Text>
          <Text style={s.permText}>请在系统设置中开启"位置信息"权限，才能录制 GPS 轨迹</Text>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Text style={s.title}>GPS 录制</Text>
        {state !== 'idle' && (
          <View style={[s.statusDot, { backgroundColor: state === 'recording' ? C.green : '#facc15' }]} />
        )}
      </View>

      {/* Stats panel */}
      <View style={s.statsPanel}>
        <StatBlock label="时长" value={fmtDuration(elapsed)} big />
        <View style={s.statsDivider} />
        <StatBlock label="距离" value={fmtDistance(distance)} />
        <View style={s.statsDivider} />
        <StatBlock label="爬升" value={fmtElevation(elevGain)} />
        <View style={s.statsDivider} />
        <StatBlock label="轨迹点" value={String(points.length)} />
      </View>

      {/* Current position */}
      {currentPos && (
        <View style={s.posCard}>
          <Text style={s.posLabel}>当前位置</Text>
          <Text style={s.posCoords}>
            {currentPos.lat.toFixed(5)}, {currentPos.lon.toFixed(5)}
          </Text>
          <Text style={s.posElev}>海拔 {Math.round(currentPos.elevation)} m</Text>
        </View>
      )}

      <View style={s.spacer} />

      {/* Controls */}
      <View style={s.controls}>
        {state === 'idle' ? (
          <TouchableOpacity style={s.startBtn} onPress={startRecording} activeOpacity={0.8}>
            <View style={s.startDot} />
            <Text style={s.startText}>开始录制</Text>
          </TouchableOpacity>
        ) : (
          <>
            <TouchableOpacity style={s.discardBtn} onPress={discard}>
              <Text style={s.discardText}>放弃</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[s.pauseBtn, state === 'paused' && s.resumeBtn]}
              onPress={state === 'recording' ? pauseRecording : resumeRecording}
            >
              <Text style={s.pauseText}>{state === 'recording' ? '暂停' : '继续'}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={s.stopBtn} onPress={stopAndSave}>
              <View style={s.stopSquare} />
              <Text style={s.stopText}>完成</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </SafeAreaView>
  )
}

function StatBlock({ label, value, big }: { label: string; value: string; big?: boolean }) {
  return (
    <View style={s.statBlock}>
      <Text style={[s.statValue, big && s.statValueBig]}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  )
}

function calcStats(points: RecordPoint[]): { distance: number; elevGain: number } {
  if (points.length < 2) return { distance: 0, elevGain: 0 }

  const R = 6371000
  let dist = 0, gain = 0

  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i]
    const φ1 = (a.lat * Math.PI) / 180
    const φ2 = (b.lat * Math.PI) / 180
    const Δφ = ((b.lat - a.lat) * Math.PI) / 180
    const Δλ = ((b.lon - a.lon) * Math.PI) / 180
    const s = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2
    dist += R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s))
    if (b.elevation > a.elevation) gain += b.elevation - a.elevation
  }

  return { distance: Math.round(dist) / 1000, elevGain: Math.round(gain) }
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12,
  },
  title: { fontSize: 22, fontWeight: '700', color: C.text },
  statusDot: { width: 10, height: 10, borderRadius: 5 },

  statsPanel: {
    flexDirection: 'row', marginHorizontal: 16,
    backgroundColor: C.card, borderRadius: 14,
    borderWidth: 1, borderColor: C.border,
    padding: 16, alignItems: 'center',
  },
  statBlock: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 16, fontWeight: '700', color: C.green },
  statValueBig: { fontSize: 22 },
  statLabel: { fontSize: 11, color: C.muted, marginTop: 3 },
  statsDivider: { width: 1, height: 32, backgroundColor: C.border },

  posCard: {
    marginHorizontal: 16, marginTop: 12,
    backgroundColor: C.card, borderRadius: 12,
    borderWidth: 1, borderColor: C.border,
    padding: 14,
  },
  posLabel: { fontSize: 11, color: C.muted, marginBottom: 4 },
  posCoords: { fontSize: 13, color: C.soft, fontVariant: ['tabular-nums'] },
  posElev: { fontSize: 12, color: C.muted, marginTop: 3 },

  spacer: { flex: 1 },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 16 },
  permIcon: { fontSize: 48 },
  permTitle: { fontSize: 18, fontWeight: '600', color: C.soft },
  permText: { fontSize: 14, color: C.muted, textAlign: 'center', lineHeight: 20 },

  controls: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 24, paddingBottom: Platform.OS === 'ios' ? 20 : 24,
    paddingTop: 16, gap: 12,
  },
  startBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, backgroundColor: C.green, borderRadius: 16,
    paddingVertical: 18,
  },
  startDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#0d1f1a' },
  startText: { fontSize: 17, fontWeight: '700', color: '#0d1f1a' },

  discardBtn: {
    paddingHorizontal: 18, paddingVertical: 14,
    borderRadius: 12, borderWidth: 1, borderColor: C.border,
  },
  discardText: { fontSize: 14, color: C.muted },
  pauseBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 14,
    borderRadius: 12, borderWidth: 1.5, borderColor: C.soft,
  },
  resumeBtn: { borderColor: '#facc15' },
  pauseText: { fontSize: 15, fontWeight: '600', color: C.soft },
  stopBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 8,
    backgroundColor: C.green, borderRadius: 12, paddingVertical: 14,
  },
  stopSquare: { width: 10, height: 10, borderRadius: 2, backgroundColor: '#0d1f1a' },
  stopText: { fontSize: 15, fontWeight: '700', color: '#0d1f1a' },
})
