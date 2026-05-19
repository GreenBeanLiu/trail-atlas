import { useCallback, useState } from 'react'
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, SafeAreaView, RefreshControl,
} from 'react-native'
import { useRouter, useFocusEffect } from 'expo-router'
import { listTracks, type Track } from '../../src/db'
import { fmtDistance, fmtDuration, fmtElevation, fmtDate } from '../../src/lib/format'

const C = {
  bg: '#0d1f1a',
  card: '#132920',
  border: '#1a3328',
  text: '#e8f5e9',
  soft: '#7aad8e',
  muted: '#4d6e5e',
  green: '#4ade80',
  accent: '#34d399',
}

export default function TrailListScreen() {
  const router = useRouter()
  const [tracks, setTracks] = useState<Track[]>([])
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(() => {
    setTracks(listTracks())
  }, [])

  useFocusEffect(useCallback(() => {
    load()
  }, [load]))

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    load()
    setRefreshing(false)
  }, [load])

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>我的路线</Text>
        <Text style={styles.count}>{tracks.length} 条</Text>
      </View>

      {tracks.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>🏔</Text>
          <Text style={styles.emptyTitle}>还没有路线</Text>
          <Text style={styles.emptyText}>导入 GPX 文件，或开始录制一条新路线</Text>
        </View>
      ) : (
        <FlatList
          data={tracks}
          keyExtractor={(t) => String(t.id)}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.green} />}
          renderItem={({ item }) => (
            <TrackCard track={item} onPress={() => router.push(`/track/${item.id}`)} />
          )}
        />
      )}
    </SafeAreaView>
  )
}

function TrackCard({ track, onPress }: { track: Track; onPress: () => void }) {
  const tags = track.tags ? track.tags.split(',').filter(Boolean) : []

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.cardTop}>
        <Text style={styles.cardName} numberOfLines={1}>{track.name}</Text>
        <Text style={styles.cardDate}>{fmtDate(track.date)}</Text>
      </View>

      <View style={styles.stats}>
        <StatItem label="距离" value={fmtDistance(track.distance)} />
        <StatDivider />
        <StatItem label="爬升" value={fmtElevation(track.elev_gain)} />
        <StatDivider />
        <StatItem label="时长" value={fmtDuration(track.duration)} />
        {(track.point_count ?? 0) > 0 && (
          <>
            <StatDivider />
            <StatItem label="轨迹点" value={String(track.point_count)} />
          </>
        )}
      </View>

      {tags.length > 0 && (
        <View style={styles.tags}>
          {tags.map((tag) => (
            <View key={tag} style={styles.tag}>
              <Text style={styles.tagText}>{tag}</Text>
            </View>
          ))}
        </View>
      )}

      {track.note ? (
        <Text style={styles.note} numberOfLines={2}>{track.note}</Text>
      ) : null}
    </TouchableOpacity>
  )
}

function StatItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  )
}

function StatDivider() {
  return <View style={styles.statDivider} />
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row', alignItems: 'baseline',
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12,
    gap: 8,
  },
  title: { fontSize: 22, fontWeight: '700', color: C.text },
  count: { fontSize: 14, color: C.muted },
  list: { paddingHorizontal: 16, paddingBottom: 24, gap: 10 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 80 },
  emptyIcon: { fontSize: 52, marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: C.soft, marginBottom: 8 },
  emptyText: { fontSize: 14, color: C.muted, textAlign: 'center', paddingHorizontal: 40, lineHeight: 20 },

  card: {
    backgroundColor: C.card,
    borderRadius: 14, borderWidth: 1, borderColor: C.border,
    padding: 16, gap: 10,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardName: { fontSize: 16, fontWeight: '600', color: C.text, flex: 1, marginRight: 8 },
  cardDate: { fontSize: 12, color: C.muted },

  stats: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stat: { alignItems: 'center' },
  statValue: { fontSize: 15, fontWeight: '600', color: C.green },
  statLabel: { fontSize: 11, color: C.muted, marginTop: 2 },
  statDivider: { width: 1, height: 24, backgroundColor: C.border },

  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: {
    backgroundColor: '#1a3a2a', borderRadius: 6, borderWidth: 1, borderColor: '#2a4a3a',
    paddingHorizontal: 8, paddingVertical: 3,
  },
  tagText: { fontSize: 11, color: C.accent },
  note: { fontSize: 13, color: C.muted, lineHeight: 18 },
})
