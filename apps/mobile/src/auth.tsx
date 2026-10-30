import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Platform } from 'react-native'
import { api, setToken, setUnauthorized, type Workspace } from './api'

type Session = { id: string; email: string; displayName: string; carddavUrl: string }

type AuthValue = {
  ready: boolean
  session: Session | null
  workspace: Workspace | null
  workspaces: Workspace[]
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, displayName: string) => Promise<void>
  signOut: () => Promise<void>
  refreshWorkspaces: () => Promise<void>
  selectWorkspace: (workspace: Workspace) => void
}

const AuthContext = createContext<AuthValue | null>(null)
const storageKey = 'rolodex.session'

function readStored() {
  if (Platform.OS !== 'web' || typeof sessionStorage === 'undefined') return null
  const raw = sessionStorage.getItem(storageKey)
  return raw ? (JSON.parse(raw) as { token: string; session: Session; workspaceId?: string }) : null
}

function writeStored(value: { token: string; session: Session; workspaceId?: string } | null) {
  if (Platform.OS !== 'web' || typeof sessionStorage === 'undefined') return
  if (!value) sessionStorage.removeItem(storageKey)
  else sessionStorage.setItem(storageKey, JSON.stringify(value))
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [token, setTokenState] = useState<string | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [workspace, setWorkspace] = useState<Workspace | null>(null)

  async function loadWorkspaces(authToken: string, sessionValue: Session, preferredId?: string) {
    setToken(authToken)
    const rows = await api<Workspace[]>('/api/workspaces')
    const next = rows.find((item) => item.id === preferredId) ?? rows[0] ?? null
    setWorkspaces(rows)
    setWorkspace(next)
    setSession(sessionValue)
    setTokenState(authToken)
    writeStored({ token: authToken, session: sessionValue, workspaceId: next?.id })
  }

  useEffect(() => {
    setUnauthorized(() => {
      setToken(null)
      setTokenState(null)
      setSession(null)
      setWorkspace(null)
      writeStored(null)
    })
    const stored = readStored()
    if (!stored) {
      setReady(true)
      return
    }
    setToken(stored.token)
    api<{ user: { id: string; email: string; displayName: string }; carddavUrl: string }>('/api/auth/me')
      .then((me) => loadWorkspaces(stored.token, { ...me.user, carddavUrl: me.carddavUrl }, stored.workspaceId))
      .catch(() => writeStored(null))
      .finally(() => setReady(true))
  }, [])

  const value = useMemo<AuthValue>(
    () => ({
      ready,
      session,
      workspace,
      workspaces,
      async signIn(email, password) {
        const result = await api<{ token: string; user: { id: string; email: string; displayName: string } }>('/api/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        })
        const me = await api<{ carddavUrl: string }>('/api/auth/me')
        await loadWorkspaces(result.token, { ...result.user, carddavUrl: me.carddavUrl })
      },
      async signUp(email, password, displayName) {
        const result = await api<{ token: string; user: { id: string; email: string; displayName: string } }>(
          '/api/auth/register',
          { method: 'POST', body: JSON.stringify({ email, password, displayName }) },
        )
        const me = await api<{ carddavUrl: string }>('/api/auth/me')
        await loadWorkspaces(result.token, { ...result.user, carddavUrl: me.carddavUrl })
      },
      async signOut() {
        try {
          await api('/api/auth/logout', { method: 'POST' })
        } finally {
          setToken(null)
          setTokenState(null)
          setSession(null)
          setWorkspace(null)
          writeStored(null)
        }
      },
      async refreshWorkspaces() {
        if (!token || !session) return
        await loadWorkspaces(token, session, workspace?.id)
      },
      selectWorkspace(next) {
        setWorkspace(next)
        if (token && session) writeStored({ token, session, workspaceId: next.id })
      },
    }),
    [ready, session, workspace, workspaces, token],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('AuthProvider is missing')
  return value
}
