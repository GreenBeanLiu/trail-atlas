import { Tabs } from 'expo-router'
import { Platform } from 'react-native'

const COLORS = {
  bg: '#0d1f1a',
  active: '#4ade80',
  inactive: '#4d6e5e',
  border: '#1a3328',
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: COLORS.bg,
          borderTopColor: COLORS.border,
          borderTopWidth: 1,
          height: Platform.OS === 'ios' ? 84 : 60,
          paddingBottom: Platform.OS === 'ios' ? 24 : 8,
        },
        tabBarActiveTintColor: COLORS.active,
        tabBarInactiveTintColor: COLORS.inactive,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '500' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: '路线',
          tabBarIcon: ({ color, size }) => <MapIcon color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="record"
        options={{
          title: '录制',
          tabBarIcon: ({ color, size }) => <RecordIcon color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="import"
        options={{
          title: '导入',
          tabBarIcon: ({ color, size }) => <ImportIcon color={color} size={size} />,
        }}
      />
    </Tabs>
  )
}

// Inline SVG-style icons using View/Text (no icon library needed)
import { View } from 'react-native'

function MapIcon({ color, size }: { color: string; size: number }) {
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{
        width: size * 0.7, height: size * 0.7,
        borderRadius: 3, borderWidth: 2, borderColor: color,
      }} />
      <View style={{
        position: 'absolute', bottom: 0,
        width: 2, height: size * 0.4,
        backgroundColor: color,
      }} />
    </View>
  )
}

function RecordIcon({ color, size }: { color: string; size: number }) {
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{
        width: size * 0.72, height: size * 0.72,
        borderRadius: size * 0.36,
        borderWidth: 2.5, borderColor: color,
        alignItems: 'center', justifyContent: 'center',
      }}>
        <View style={{
          width: size * 0.36, height: size * 0.36,
          borderRadius: size * 0.18,
          backgroundColor: color,
        }} />
      </View>
    </View>
  )
}

function ImportIcon({ color, size }: { color: string; size: number }) {
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{
        width: size * 0.55, height: size * 0.55,
        borderLeftWidth: 2, borderBottomWidth: 2,
        borderColor: color, transform: [{ rotate: '-45deg' }],
        marginTop: -4,
      }} />
      <View style={{
        width: size * 0.65, height: 2,
        backgroundColor: color, marginTop: 4,
      }} />
    </View>
  )
}
