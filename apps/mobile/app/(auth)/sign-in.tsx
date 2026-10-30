import { Link } from 'expo-router'
import { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { ApiError } from '../../src/api'
import { useAuth } from '../../src/auth'
import { font, theme } from '../../src/theme'
import { Button, Field, Notice } from '../../src/ui'

export default function SignIn() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  async function submit() {
    setPending(true)
    setError('')
    try {
      await signIn(email.trim(), password)
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not sign in')
    } finally {
      setPending(false)
    }
  }

  return (
    <View style={styles.page}>
      <View style={styles.card}>
        <Text style={styles.brand}>Rolodex</Text>
        <Text style={styles.subtitle}>Sign in to your address book.</Text>
        {error ? <Notice text={error} /> : null}
        <Field label="Email" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
        <Field label="Password" secureTextEntry value={password} onChangeText={setPassword} />
        <Button label={pending ? 'Signing in' : 'Sign in'} onPress={submit} disabled={pending} />
        <Link href="/sign-up" style={styles.link}>
          Create an account
        </Link>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: theme.bg, alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 420, backgroundColor: theme.surface, borderRadius: 16, padding: 28, gap: 14, borderWidth: 1, borderColor: theme.border },
  brand: { fontFamily: font, fontSize: 28, fontWeight: '700', color: theme.text },
  subtitle: { fontFamily: font, color: theme.muted, marginBottom: 8 },
  link: { fontFamily: font, color: theme.accent, textAlign: 'center' },
})
