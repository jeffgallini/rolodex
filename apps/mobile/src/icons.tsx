import { createElement } from 'react'
import { Platform, Text } from 'react-native'

type Name = 'home' | 'contacts' | 'plus' | 'more' | 'bell' | 'settings' | 'logout' | 'phone' | 'mail' | 'pin' | 'briefcase' | 'building' | 'gift' | 'interactions' | 'task'

export function Icon({ name, color, size }: { name: Name; color: string; size: number }) {
  if (Platform.OS !== 'web') return <Text style={{ color, fontSize: size * 0.7, lineHeight: size }}>{fallback[name]}</Text>
  return createElement(
    'svg',
    { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: color, strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' },
    ...paths(name, color),
  )
}

const fallback: Record<Name, string> = {
  home: '⌂',
  contacts: '•',
  plus: '+',
  more: '…',
  bell: '!',
  settings: '*',
  logout: '→',
  phone: '☎',
  mail: '@',
  pin: '•',
  briefcase: '□',
  building: '⌂',
  gift: '✶',
  interactions: '✎',
  task: '✓',
}

function paths(name: Name, color: string) {
  if (name === 'home') return [createElement('path', { key: 'h', d: 'M4 11.2 12 4.5l8 6.7V20a1 1 0 0 1-1 1h-5.2v-5.6H10.2V21H5a1 1 0 0 1-1-1z' })]
  if (name === 'contacts') {
    return [
      createElement('circle', { key: 'h', cx: 12, cy: 8, r: 3.2 }),
      createElement('path', { key: 'b', d: 'M5.5 19.2c1.3-3.3 3.6-4.8 6.5-4.8s5.2 1.5 6.5 4.8' }),
    ]
  }
  if (name === 'plus') return [createElement('path', { key: 'p', d: 'M12 5v14M5 12h14' })]
  if (name === 'bell') {
    return [
      createElement('path', { key: 'b', d: 'M6 9.2a6 6 0 0 1 12 0c0 4.2 1.6 5.6 1.6 5.6H4.4S6 13.4 6 9.2z' }),
      createElement('path', { key: 'c', d: 'M10 18.2a2 2 0 0 0 4 0' }),
    ]
  }
  if (name === 'settings') {
    return [
      createElement('circle', { key: 'c', cx: 12, cy: 12, r: 3 }),
      createElement('path', { key: 'g', d: 'M12 3.2v2.2M12 18.6v2.2M3.2 12h2.2M18.6 12h2.2M5.8 5.8l1.6 1.6M16.6 16.6l1.6 1.6M18.2 5.8l-1.6 1.6M7.4 16.6l-1.6 1.6' }),
    ]
  }
  if (name === 'logout') return [createElement('path', { key: 'l', d: 'M10 7V5.5A1.5 1.5 0 0 1 11.5 4h6A1.5 1.5 0 0 1 19 5.5v13a1.5 1.5 0 0 1-1.5 1.5h-6A1.5 1.5 0 0 1 10 18.5V17M4 12h10M11 9l3 3-3 3' })]
  if (name === 'phone') return [createElement('path', { key: 'p', d: 'M8 4.5h2.2l1.1 2.6-1.5 1a12 12 0 0 0 5.1 5.1l1-1.5 2.6 1.1V15a2 2 0 0 1-2.2 2A13.5 13.5 0 0 1 6 6.7 2 2 0 0 1 8 4.5z' })]
  if (name === 'mail') return [createElement('path', { key: 'm', d: 'M4 7.5h16v10H4zM4 8l8 6 8-6' })]
  if (name === 'pin') return [createElement('path', { key: 'n', d: 'M12 21s6-5.2 6-10a6 6 0 1 0-12 0c0 4.8 6 10 6 10z' }), createElement('circle', { key: 'c', cx: 12, cy: 11, r: 2 })]
  if (name === 'briefcase') return [createElement('path', { key: 'b', d: 'M9 7V5.8A1.8 1.8 0 0 1 10.8 4h2.4A1.8 1.8 0 0 1 15 5.8V7M4.5 7h15v11h-15zM4.5 12h15' })]
  if (name === 'building') return [createElement('path', { key: 'b', d: 'M5 20V5.5A1.5 1.5 0 0 1 6.5 4h7A1.5 1.5 0 0 1 15 5.5V20M15 10h3.2A1.3 1.3 0 0 1 19.5 11.3V20M3.5 20h17M8 8h2M8 12h2M8 16h2' })]
  if (name === 'gift') return [createElement('path', { key: 'g', d: 'M5 11h14v9H5zM4 8h16v3H4zM12 8v12M12 8c-1.5-2.5-4.5-2.2-4.5 0S12 8 12 8zM12 8c1.5-2.5 4.5-2.2 4.5 0S12 8 12 8z' })]
  if (name === 'interactions') return [createElement('path', { key: 'i', d: 'M5 6.5h14v8.5H8.2L5 18.2z' })]
  if (name === 'task') return [createElement('path', { key: 't', d: 'M8 6.5h8M8 4.8h8A1.5 1.5 0 0 1 17.5 6.3V19L12 16.2 6.5 19V6.3A1.5 1.5 0 0 1 8 4.8zM9 10.5l2 2 4-4' })]
  return [0, 1, 2].map((dot) => createElement('circle', { key: dot, cx: 6 + dot * 6, cy: 12, r: 1.3, fill: color, stroke: 'none' }))
}
