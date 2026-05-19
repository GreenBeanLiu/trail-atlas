import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useEffect } from 'react'
import { getDb } from '../src/db'

export default function RootLayout() {
  useEffect(() => {
    // Initialize DB on app start
    getDb()
  }, [])

  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  )
}
