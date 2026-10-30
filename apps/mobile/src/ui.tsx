import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps, type ViewProps } from 'react-native'
import { useAccent } from './accent'
import { font, theme } from './theme'

export function Field({ label, style, ...props }: { label: string; style?: ViewProps['style'] } & TextInputProps) {
  return (
    <View style={[styles.field, style]}>
      <Text style={styles.label}>{label}</Text>
      <TextInput placeholderTextColor={theme.muted} style={styles.input} {...props} />
    </View>
  )
}

export function Button({
  label,
  onPress,
  tone = 'primary',
  disabled,
}: {
  label: string
  onPress: () => void
  tone?: 'primary' | 'ghost' | 'danger'
  disabled?: boolean
}) {
  const { accent, onAccent } = useAccent()
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={[styles.button, tone === 'primary' ? { backgroundColor: accent } : tone === 'danger' ? styles.danger : styles.ghost, disabled && styles.disabled]}
    >
      <Text style={[styles.buttonText, tone === 'primary' && { color: onAccent }, tone === 'ghost' && styles.ghostText]}>{label}</Text>
    </Pressable>
  )
}

export function Panel({ children, style }: ViewProps) {
  return <View style={[styles.panel, style]}>{children}</View>
}

export function Notice({ text }: { text: string }) {
  return <Text style={styles.notice}>{text}</Text>
}

const styles = StyleSheet.create({
  field: { gap: 6 },
  label: { color: theme.muted, fontSize: 11, fontFamily: font, letterSpacing: 0.8, textTransform: 'uppercase' },
  input: {
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.surface,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: theme.text,
    fontFamily: font,
  },
  button: { borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, alignItems: 'center' },
  danger: { backgroundColor: theme.danger },
  ghost: { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border },
  disabled: { opacity: 0.5 },
  buttonText: { color: '#fff', fontFamily: font, fontSize: 14, fontWeight: '600' },
  ghostText: { color: theme.text },
  panel: {
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 22,
    padding: 18,
  },
  notice: { color: theme.danger, fontFamily: font, fontSize: 14 },
})
