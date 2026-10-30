import { createElement } from 'react'
import { Platform, Text } from 'react-native'

type Name = 'contacts' | 'plus' | 'more' | 'bell' | 'settings' | 'logout'

export function Icon({ name, color, size }: { name: Name; color: string; size: number }) {
  if (Platform.OS !== 'web') return <Text style={{ color, fontSize: size * 0.7, lineHeight: size }}>{fallback[name]}</Text>
  return createElement(
    'svg',
    { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: color, strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' },
    ...paths(name, color),
  )
}

const fallback: Record<Name, string> = {
  contacts: '•',
  plus: '+',
  more: '…',
  bell: '!',
  settings: '*',
  logout: '→',
}

function paths(name: Name, color: string) {
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
  return [0, 1, 2].map((dot) => createElement('circle', { key: dot, cx: 6 + dot * 6, cy: 12, r: 1.3, fill: color, stroke: 'none' }))
}
