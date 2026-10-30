import { useRouter, usePathname } from 'expo-router'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Platform, Pressable, ScrollView, StyleSheet, Text, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { agendaLines } from './agenda'
import { api, type Agenda } from './api'
import { useAuth } from './auth'
import { Icon } from './icons'
import { RolodexMark } from './logo'
import { font, theme } from './theme'

type Menu = 'notifications' | 'profile' | 'more' | null

const moreLinks = [
  { href: '/organizations', label: 'Organizations' },
  { href: '/interactions', label: 'Interactions' },
  { href: '/tasks', label: 'Tasks' },
  { href: '/books', label: 'Address books' },
  { href: '/members', label: 'Members' },
  { href: '/settings', label: 'Settings' },
] as const

export function MobileShell({ children }: { children: ReactNode }) {
  const { session, workspace, workspaces, selectWorkspace, signOut } = useAuth()
  const canManage = workspace?.role === 'owner' || workspace?.role === 'administrator'
  const menuLinks = [...moreLinks.slice(0, -1), ...(canManage ? [{ href: '/admin', label: 'Admin' }] : []), moreLinks[moreLinks.length - 1]]
  const router = useRouter()
  const path = usePathname()
  const insets = useSafeAreaInsets()
  const [menu, setMenu] = useState<Menu>(null)
  const [agenda, setAgenda] = useState<Agenda | null>(null)
  const [shown, setShown] = useState(true)
  const lastY = useRef(0)

  useEffect(() => {
    setMenu(null)
  }, [path])

  useEffect(() => {
    if (menu !== 'notifications' || !workspace) return
    api<Agenda>(`/api/workspaces/${workspace.id}/agenda`).then(setAgenda).catch(() => setAgenda({ dates: [], tasks: [], reminders: [], reachOuts: [] }))
  }, [menu, workspace])

  function toggle(next: Menu) {
    setMenu((current) => (current === next ? null : next))
  }

  function onScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const y = event.nativeEvent.contentOffset.y
    const delta = y - lastY.current
    if (y < 8) setShown(true)
    else if (delta > 10) {
      setShown(false)
      setMenu((current) => (current === 'more' ? current : null))
    } else if (delta < -10) setShown(true)
    lastY.current = y
  }

  const initial = (session?.displayName || '?').slice(0, 1).toUpperCase()

  return (
    <View style={styles.shell}>
      {menu ? <Pressable style={styles.backdrop} onPress={() => setMenu(null)} /> : null}
      <View style={[styles.headerClip, { height: shown ? 64 + insets.top : 0, paddingTop: shown ? insets.top : 0 }]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.push('/')} style={styles.logoButton}>
            <RolodexMark size={28} tone="paper" />
          </Pressable>
          <View style={styles.headerActions}>
            <Pressable onPress={() => toggle('notifications')} style={[styles.iconButton, menu === 'notifications' && styles.iconButtonOn]}>
              <Icon name="bell" color={theme.text} size={20} />
            </Pressable>
            <Pressable onPress={() => toggle('profile')} style={[styles.avatar, menu === 'profile' && styles.avatarOn]}>
              <Text style={styles.avatarText}>{initial}</Text>
            </Pressable>
          </View>
        </View>
      </View>
      {menu === 'notifications' ? (
        <View style={[styles.popover, styles.popoverRight, { top: 64 + insets.top + 8 }]}>
          <Text style={styles.popoverTitle}>Notifications</Text>
          {agenda && agendaLines(agenda).length ? agendaLines(agenda).map((line) => (
            <Pressable key={line.key} onPress={() => router.push(line.href)} style={styles.row}>
              <Text style={styles.rowText}>{line.label}</Text>
            </Pressable>
          )) : <Text style={styles.muted}>Nothing new.</Text>}
        </View>
      ) : null}
      {menu === 'profile' ? (
        <View style={[styles.popover, styles.popoverRight, { top: 64 + insets.top + 8 }]}>
          <View style={styles.identity}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initial}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{session?.displayName}</Text>
              <Text style={styles.role}>{workspace?.role}</Text>
              <Text style={styles.muted}>{session?.email}</Text>
            </View>
          </View>
          {workspaces.length > 1 ? (
            <View style={styles.section}>
              {workspaces.map((item) => (
                <Pressable key={item.id} onPress={() => selectWorkspace(item)} style={styles.row}>
                  <Text style={[styles.rowText, item.id === workspace?.id && styles.rowTextOn]}>{item.name}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          {canManage ? (
            <Pressable
              onPress={() => {
                setMenu(null)
                router.push('/admin')
              }}
              style={styles.row}
            >
              <Icon name="settings" color={theme.text} size={18} />
              <Text style={styles.rowText}>Admin</Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={() => {
              setMenu(null)
              router.push('/settings')
            }}
            style={styles.row}
          >
            <Icon name="settings" color={theme.text} size={18} />
            <Text style={styles.rowText}>Settings</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              void signOut().then(() => router.replace('/sign-in'))
            }}
            style={styles.row}
          >
            <Icon name="logout" color={theme.danger} size={18} />
            <Text style={styles.danger}>Sign out</Text>
          </Pressable>
        </View>
      ) : null}
      <ScrollView onScroll={onScroll} scrollEventThrottle={16} style={styles.main} contentContainerStyle={styles.content}>
        {children}
      </ScrollView>
      {menu === 'more' ? (
        <View style={[styles.popover, styles.morePopover, { bottom: 92 + insets.bottom }]}>
          {menuLinks.map((link) => {
            const active = path.startsWith(link.href)
            return (
              <Pressable key={link.href} onPress={() => router.push(link.href)} style={styles.row}>
                <Text style={[styles.rowText, active && styles.rowTextOn]}>{link.label}</Text>
              </Pressable>
            )
          })}
        </View>
      ) : null}
      <View style={[styles.dockWrap, { bottom: 16 + insets.bottom }]}>
        <View style={styles.dock}>
          <Pressable onPress={() => router.push('/')} style={[styles.dockHit, path === '/' && styles.dockHitOn]}>
            <Icon name="contacts" color={path === '/' ? '#fff' : '#737373'} size={22} />
          </Pressable>
          <Pressable onPress={() => router.push('/contacts/new')} style={styles.plus}>
            <Icon name="plus" color="#fff" size={26} />
          </Pressable>
          <Pressable onPress={() => toggle('more')} style={[styles.dockHit, menu === 'more' && styles.dockHitOn]}>
            <Icon name="more" color={menu === 'more' ? '#fff' : '#737373'} size={22} />
          </Pressable>
        </View>
      </View>
    </View>
  )
}

const glass = Platform.OS === 'web'
  ? ({
      backgroundColor: 'rgba(255,255,255,0.62)',
      backdropFilter: 'blur(22px)',
      WebkitBackdropFilter: 'blur(22px)',
      boxShadow: '0 18px 50px rgba(17,17,17,0.14)',
    } as object)
  : { backgroundColor: 'rgba(255,255,255,0.94)' }

const styles = StyleSheet.create({
  shell: { flex: 1, backgroundColor: theme.bg },
  backdrop: { ...StyleSheet.absoluteFill, zIndex: 2 },
  headerClip: { overflow: 'hidden', zIndex: 4, backgroundColor: 'rgba(255,255,255,0.9)' },
  header: { height: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  logoButton: { width: 44, height: 44, borderRadius: 14, backgroundColor: theme.ink, alignItems: 'center', justifyContent: 'center' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#f3f3f3', alignItems: 'center', justifyContent: 'center' },
  iconButtonOn: { backgroundColor: '#e7e7e7' },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#2a2a2a', alignItems: 'center', justifyContent: 'center' },
  avatarOn: { backgroundColor: theme.ink },
  avatarText: { color: '#fff', fontFamily: font, fontWeight: '700', fontSize: 16 },
  main: { flex: 1, zIndex: 1 },
  content: { padding: 16, paddingBottom: 120, gap: 16 },
  dockWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center', zIndex: 4 },
  dock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.8)',
  },
  dockHit: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  dockHitOn: { backgroundColor: theme.ink },
  plus: { width: 58, height: 58, borderRadius: 29, backgroundColor: theme.ink, alignItems: 'center', justifyContent: 'center', marginTop: -16 },
  popover: { position: 'absolute', width: 280, borderRadius: 22, borderWidth: 1, borderColor: 'rgba(255,255,255,0.7)', padding: 14, gap: 8, zIndex: 5, ...glass },
  popoverRight: { right: 12 },
  morePopover: { right: 24 },
  popoverTitle: { fontFamily: font, fontSize: 16, fontWeight: '700', color: theme.text },
  identity: { flexDirection: 'row', gap: 12, alignItems: 'center', paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(17,17,17,0.08)' },
  name: { fontFamily: font, fontSize: 16, fontWeight: '700', color: theme.text },
  role: { fontFamily: font, fontSize: 11, letterSpacing: 0.8, textTransform: 'uppercase', color: theme.muted },
  muted: { fontFamily: font, color: theme.muted, fontSize: 13 },
  section: { gap: 2, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(17,17,17,0.08)' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  rowText: { fontFamily: font, color: theme.text, fontSize: 15 },
  rowTextOn: { fontWeight: '700' },
  danger: { fontFamily: font, color: theme.danger, fontSize: 15, fontWeight: '600' },
})
