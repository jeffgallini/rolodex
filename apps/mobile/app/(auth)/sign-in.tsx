import { Link } from 'expo-router'
import { useState } from 'react'
import { StyleSheet, Text } from 'react-native'
import { ApiError } from '../../src/api'
import { AuthFrame } from '../../src/auth-screen'
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
    <AuthFrame
      title="Sign in"
      subtitle="Welcome back"
      busy={pending}
      footer={
        <Text style={styles.footer}>
          Don't have an account? <Link href="/sign-up" style={styles.link}>Create one</Link>
        </Text>
      }
    >
      {error ? <Notice text={error} /> : null}
      <Field label="Email" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} placeholder="you@email.com" />
      <Field label="Password" secureTextEntry value={password} onChangeText={setPassword} />
      <Button label={pending ? 'Signing in' : 'Sign in'} onPress={submit} disabled={pending} />
    </AuthFrame>
  )
}

const styles = StyleSheet.create({
  footer: { fontFamily: font, color: theme.muted, textAlign: 'center', marginTop: 4 },
  link: { fontFamily: font, color: theme.text, fontWeight: '700' },
})
