import { Link } from 'expo-router'
import { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { ApiError } from '../../src/api'
import { useAuth } from '../../src/auth'
import { font, theme } from '../../src/theme'
import { Button, Field, Notice } from '../../src/ui'

export default function SignUp() {
  const { signUp } = useAuth()
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  async function submit() {
    setPending(true)
    setError('')
    try {
      await signUp(email.trim(), password, displayName.trim())
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not create the account')
    } finally {
      setPending(false)
    }
  }

  return (
    <View style={styles.page}>
      <View style={styles.card}>
        <Text style={styles.brand}>Create your Rolodex</Text>
        <Text style={styles.subtitle}>A personal workspace and address book are created with the account.</Text>
        {error ? <Notice text={error} /> : null}
        <Field label="Name" value={displayName} onChangeText={setDisplayName} />
        <Field label="Email" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
        <Field label="Password" secureTextEntry value={password} onChangeText={setPassword} />
        <Button label={pending ? 'Creating' : 'Create account'} onPress={submit} disabled={pending} />
        <Link href="/sign-in" style={styles.link}>
          Already have an account
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
