import { Stack, useRouter, useSegments } from 'expo-router'
import { useEffect } from 'react'
import { ActivityIndicator, View } from 'react-native'
import { AuthProvider, useAuth } from '../src/auth'
import { theme } from '../src/theme'

function Gate() {
  const { ready, session } = useAuth()
  const segments = useSegments()
  const router = useRouter()
  useEffect(() => {
    if (!ready) return
    const inAuth = segments[0] === '(auth)'
    if (!session && !inAuth) router.replace('/sign-in')
    if (session && inAuth) router.replace('/')
  }, [ready, session, segments, router])
  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.bg }}>
        <ActivityIndicator color={theme.accent} />
      </View>
    )
  }
  return <Stack screenOptions={{ headerShown: false }} />
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  )
}
