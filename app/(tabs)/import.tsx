import { useState } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet,
  SafeAreaView, ActivityIndicator, ScrollView, TextInput, Alert,
} from 'react-native'
import * as DocumentPicker from 'expo-document-picker'
import * as FileSystem from 'expo-file-system'
import { useRouter } from 'expo-router'
import { parseGpx, type ParsedTrack } from '../../src/lib/gpx'
import { insertTrack, insertTrackPoints } from '../../src/db'
import { fmtDistance, fmtDuration, fmtElevation } from '../../src/lib/format'

const C = {
  bg: '#0d1f1a', card: '#132920', border: '#1a3328',
  text: '#e8f5e9', soft: '#7aad8e', muted: '#4d6e5e',
  green: '#4ade80', accent: '#34d399', error: '#f87171',
}

type State =
  | { phase: 'idle' }
  | { phase: 'loading' }
  | { phase: 'preview'; parsed: ParsedTrack; name: string; tags: string; note: string }
  | { phase: 'error'; message: string }

export default function ImportScreen() {
  const router = useRouter()
  const [state, setState] = useState<State>({ phase: 'idle' })

  async function pickFile() {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['*/*'],
      copyToCacheDirectory: true,
    })
    if (result.canceled) return

    const file = result.assets[0]
    if (!file.name.match(/\.(gpx|kml)$/i)) {
      setState({ phase: 'error', message: '只支持 .gpx 文件' })
      return
    }

    setState({ phase: 'loading' })

    try {
      const content = await FileSystem.readAsStringAsync(file.uri, {
        encoding: 'utf8',
      })
      const parsed = parseGpx(content)
      if (!parsed || parsed.points.length === 0) {
        setState({ phase: 'error', message: 'GPX 文件格式不正确或没有轨迹点' })
        return
      }
      setState({ phase: 'preview', parsed, name: parsed.name, tags: '', note: '' })
    } catch (e) {
      setState({ phase: 'error', message: String(e) })
    }
  }

  function save() {
    if (state.phase !== 'preview') return
    const { parsed, name, tags, note } = state

    const trackId = insertTrack({
      name: name.trim() || parsed.name,
      note: note.trim(),
      tags: tags.trim(),
      distance: parsed.distance,
      elev_gain: parsed.elevGain,
      duration: parsed.duration,
      date: parsed.date,
    })

    insertTrackPoints(trackId, parsed.points.map((p, i) => ({
      lat: p.lat,
      lon: p.lon,
      elevation: p.elevation,
      timestamp: p.timestamp,
      seq: i,
    })))

    Alert.alert('导入成功', `「${name || parsed.name}」已保存`, [
      { text: '查看路线', onPress: () => router.replace('/') },
    ])
    setState({ phase: 'idle' })
  }

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <Text style={s.title}>导入路线</Text>
        <Text style={s.subtitle}>支持 GPX 格式（来自 Strava、佳明、AllTrails 等）</Text>

        {state.phase === 'idle' || state.phase === 'error' ? (
          <>
            <TouchableOpacity style={s.dropzone} onPress={pickFile} activeOpacity={0.7}>
              <Text style={s.dropzoneIcon}>📂</Text>
              <Text style={s.dropzoneText}>选择 GPX 文件</Text>
              <Text style={s.dropzoneSub}>点击选取 .gpx 文件</Text>
            </TouchableOpacity>

            {state.phase === 'error' && (
              <View style={s.errorBox}>
                <Text style={s.errorText}>{state.message}</Text>
              </View>
            )}
          </>
        ) : state.phase === 'loading' ? (
          <View style={s.loading}>
            <ActivityIndicator color={C.green} size="large" />
            <Text style={s.loadingText}>解析中…</Text>
          </View>
        ) : (
          <View style={s.preview}>
            <Text style={s.sectionLabel}>解析结果</Text>

            <View style={s.statsRow}>
              <StatChip icon="📏" label="距离" value={fmtDistance(state.parsed.distance)} />
              <StatChip icon="⬆" label="爬升" value={fmtElevation(state.parsed.elevGain)} />
              <StatChip icon="⏱" label="时长" value={fmtDuration(state.parsed.duration)} />
              <StatChip icon="📍" label="轨迹点" value={String(state.parsed.points.length)} />
            </View>

            <Text style={s.fieldLabel}>路线名称</Text>
            <TextInput
              style={s.input}
              value={state.name}
              onChangeText={(v) => setState({ ...state, name: v })}
              placeholder="路线名称"
              placeholderTextColor={C.muted}
            />

            <Text style={s.fieldLabel}>标签（逗号分隔）</Text>
            <TextInput
              style={s.input}
              value={state.tags}
              onChangeText={(v) => setState({ ...state, tags: v })}
              placeholder="如：休闲,周末,南山"
              placeholderTextColor={C.muted}
            />

            <Text style={s.fieldLabel}>备注</Text>
            <TextInput
              style={[s.input, s.textarea]}
              value={state.note}
              onChangeText={(v) => setState({ ...state, note: v })}
              placeholder="路线描述、难度、注意事项…"
              placeholderTextColor={C.muted}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />

            <View style={s.actions}>
              <TouchableOpacity
                style={s.cancelBtn}
                onPress={() => setState({ phase: 'idle' })}
              >
                <Text style={s.cancelText}>重新选择</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.saveBtn} onPress={save}>
                <Text style={s.saveText}>保存路线</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

function StatChip({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={s.chip}>
      <Text style={s.chipIcon}>{icon}</Text>
      <Text style={s.chipValue}>{value}</Text>
      <Text style={s.chipLabel}>{label}</Text>
    </View>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  content: { padding: 20, gap: 16 },
  title: { fontSize: 22, fontWeight: '700', color: C.text },
  subtitle: { fontSize: 13, color: C.muted, marginTop: -8 },

  dropzone: {
    borderWidth: 2, borderStyle: 'dashed', borderColor: C.border,
    borderRadius: 16, padding: 40,
    alignItems: 'center', gap: 8, backgroundColor: C.card,
  },
  dropzoneIcon: { fontSize: 40 },
  dropzoneText: { fontSize: 16, fontWeight: '600', color: C.soft },
  dropzoneSub: { fontSize: 13, color: C.muted },

  errorBox: {
    backgroundColor: '#2d1515', borderRadius: 10,
    borderWidth: 1, borderColor: '#5a2020',
    padding: 14,
  },
  errorText: { fontSize: 14, color: C.error },

  loading: { alignItems: 'center', paddingVertical: 60, gap: 16 },
  loadingText: { fontSize: 14, color: C.muted },

  preview: { gap: 12 },
  sectionLabel: { fontSize: 13, fontWeight: '600', color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5 },

  statsRow: { flexDirection: 'row', gap: 8 },
  chip: {
    flex: 1, backgroundColor: C.card, borderRadius: 10,
    borderWidth: 1, borderColor: C.border,
    padding: 10, alignItems: 'center', gap: 3,
  },
  chipIcon: { fontSize: 16 },
  chipValue: { fontSize: 14, fontWeight: '700', color: C.green },
  chipLabel: { fontSize: 10, color: C.muted },

  fieldLabel: { fontSize: 13, color: C.soft, marginBottom: -6 },
  input: {
    backgroundColor: C.card, borderRadius: 10,
    borderWidth: 1, borderColor: C.border,
    paddingHorizontal: 14, paddingVertical: 11,
    fontSize: 14, color: C.text,
  },
  textarea: { minHeight: 80, paddingTop: 12 },

  actions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  cancelBtn: {
    flex: 1, borderWidth: 1, borderColor: C.border, borderRadius: 12,
    paddingVertical: 14, alignItems: 'center',
  },
  cancelText: { fontSize: 15, fontWeight: '500', color: C.soft },
  saveBtn: {
    flex: 2, backgroundColor: C.green, borderRadius: 12,
    paddingVertical: 14, alignItems: 'center',
  },
  saveText: { fontSize: 15, fontWeight: '700', color: '#0d1f1a' },
})
