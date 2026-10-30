import { Link } from 'expo-router'
import { useState } from 'react'
import { StyleSheet, Text } from 'react-native'
import { ApiError } from '../../src/api'
import { AuthFrame } from '../../src/auth-screen'
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
    <AuthFrame
      title="Create account"
      subtitle="A personal workspace and address book come with it."
      busy={pending}
      footer={
        <Text style={styles.footer}>
          Already have an account? <Link href="/sign-in" style={styles.link}>Sign in</Link>
        </Text>
      }
    >
      {error ? <Notice text={error} /> : null}
      <Field label="Name" value={displayName} onChangeText={setDisplayName} />
      <Field label="Email" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} placeholder="you@email.com" />
      <Field label="Password" secureTextEntry value={password} onChangeText={setPassword} />
      <Button label={pending ? 'Creating' : 'Create account'} onPress={submit} disabled={pending} />
    </AuthFrame>
  )
}

const styles = StyleSheet.create({
  footer: { fontFamily: font, color: theme.muted, textAlign: 'center', marginTop: 4 },
  link: { fontFamily: font, color: theme.text, fontWeight: '700' },
})
