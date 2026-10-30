import { Link, Slot, usePathname, useRouter } from 'expo-router'
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native'
import { useAuth } from '../../src/auth'
import { font, theme } from '../../src/theme'

const links = [
  { href: '/', label: 'Contacts' },
  { href: '/books', label: 'Address books' },
  { href: '/members', label: 'Members' },
  { href: '/settings', label: 'Settings' },
] as const

export default function AppLayout() {
  const { session, workspace, workspaces, selectWorkspace, signOut } = useAuth()
  const path = usePathname()
  const router = useRouter()
  const wide = useWindowDimensions().width >= 880

  return (
    <View style={[styles.shell, !wide && styles.stacked]}>
      <View style={[styles.nav, !wide && styles.navNarrow]}>
        <Text style={styles.brand}>Rolodex</Text>
        <Text style={styles.workspace}>{workspace?.name ?? 'Workspace'}</Text>
        {workspaces.length > 1 ? (
          <View style={styles.switcher}>
            {workspaces.map((item) => (
              <Pressable key={item.id} onPress={() => selectWorkspace(item)}>
                <Text style={[styles.switch, item.id === workspace?.id && styles.switchActive]}>{item.name}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        <View style={styles.links}>
          {links.map((link) => {
            const active = link.href === '/' ? path === '/' : path.startsWith(link.href)
            return (
              <Link key={link.href} href={link.href} style={[styles.link, active && styles.linkActive]}>
                {link.label}
              </Link>
            )
          })}
        </View>
        <Text style={styles.user}>{session?.displayName}</Text>
        <Pressable
          onPress={() => {
            void signOut().then(() => router.replace('/sign-in'))
          }}
        >
          <Text style={styles.signOut}>Sign out</Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.content} style={styles.main}>
        <Slot />
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  shell: { flex: 1, flexDirection: 'row', backgroundColor: theme.bg },
  stacked: { flexDirection: 'column' },
  nav: { width: 232, backgroundColor: '#111418', padding: 20, gap: 12 },
  navNarrow: { width: '100%', paddingVertical: 14 },
  brand: { color: '#fff', fontFamily: font, fontSize: 20, fontWeight: '700' },
  workspace: { color: '#c5ccd6', fontFamily: font, fontSize: 13 },
  switcher: { gap: 4 },
  switch: { color: '#9aa3b2', fontFamily: font, fontSize: 13 },
  switchActive: { color: '#fff' },
  links: { gap: 4, marginTop: 8 },
  link: { color: '#d5dbe3', fontFamily: font, fontSize: 14, paddingVertical: 8, paddingHorizontal: 8, borderRadius: 8 },
  linkActive: { backgroundColor: '#243044', color: '#fff' },
  user: { color: '#9aa3b2', fontFamily: font, marginTop: 'auto', fontSize: 13 },
  signOut: { color: '#d5dbe3', fontFamily: font, fontSize: 13 },
  main: { flex: 1 },
  content: { padding: 28, gap: 16, maxWidth: 980, width: '100%', alignSelf: 'center' },
})
