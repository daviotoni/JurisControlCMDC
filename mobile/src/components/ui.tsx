import { Feather } from '@expo/vector-icons';
import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { fonts, shadow, statusByKey } from '../theme/tokens';

export type FeatherName = keyof typeof Feather.glyphMap;

/** Etiqueta de status: ponto na cor do status, texto em tinta sobre papel (como no web). */
export function StatusPill({ stat, short }: { stat: string; short?: boolean }) {
  const { isDark, colors } = useTheme();
  const def = statusByKey(stat);
  const color = isDark ? def.colorDark : def.color;
  const bg = isDark ? def.pillBgDark : def.pillBg;
  return (
    <View style={[styles.pill, styles.statusPill, { backgroundColor: bg }]}>
      <View style={[styles.statusDot, { backgroundColor: color }]} />
      <Text style={[styles.pillText, { color: colors.textSecondary }]} numberOfLines={1}>
        {short ? def.short : def.label}
      </Text>
    </View>
  );
}

export function Pill({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      <Text style={[styles.pillText, { color }]} numberOfLines={1}>{label}</Text>
    </View>
  );
}

/** Segmented control (Lista|Kanban, Mês|Semana|Dia, …) sobre o header navy. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  onNavy = true,
}: {
  options: { key: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  onNavy?: boolean;
}) {
  const { colors, isDark } = useTheme();
  const trackBg = onNavy ? 'rgba(255,255,255,.14)' : colors.input;
  const activeBg = isDark && onNavy ? '#eef2f8' : '#ffffff';
  return (
    <View style={[styles.segTrack, { backgroundColor: trackBg }]}>
      {options.map((o) => {
        const active = o.key === value;
        return (
          <Pressable
            key={o.key}
            onPress={() => onChange(o.key)}
            style={[styles.segItem, active && { backgroundColor: activeBg }]}
          >
            <Text
              style={{
                fontFamily: active ? fonts.bold : fonts.semibold,
                fontSize: 13,
                color: active ? '#16191d' : onNavy ? 'rgba(255,255,255,.72)' : colors.muted,
              }}
            >
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Botão flutuante "+" (56px, navy). */
export function Fab({ onPress, icon = 'plus' }: { onPress: () => void; icon?: FeatherName }) {
  const { isDark } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[styles.fab, shadow.fab, { backgroundColor: isDark ? '#2b3a4d' : '#0b2e55' }]}
    >
      <Feather name={icon} size={26} color="#fff" />
    </Pressable>
  );
}

/** Card branco padrão. */
export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle | ViewStyle[] }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.card, shadow.card, { backgroundColor: colors.card, borderColor: colors.border }, style]}>
      {children}
    </View>
  );
}

/** Título de seção com ação opcional ("Ver tudo"). */
export function SectionTitle({
  title,
  action,
  onAction,
  style,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
  style?: ViewStyle;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.sectionRow, style]}>
      <Text style={{ fontFamily: fonts.semibold, fontSize: 15.5, color: colors.text, letterSpacing: -0.2 }}>
        {title}
      </Text>
      {action ? (
        <Pressable onPress={onAction} hitSlop={8}>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 12.5, color: colors.primary }}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** Rótulo de grupo em caixa alta ("HOJE", "MÓDULOS"...). */
export function GroupLabel({ label, style }: { label: string; style?: TextStyle }) {
  const { colors } = useTheme();
  return (
    <Text
      style={[
        { fontFamily: fonts.medium, fontSize: 11, color: colors.muted, letterSpacing: 0.9, textTransform: 'uppercase' },
        style,
      ]}
    >
      {label}
    </Text>
  );
}

export function EmptyState({ icon = 'inbox', text }: { icon?: FeatherName; text: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.empty}>
      <Feather name={icon} size={30} color={colors.mutedLight} />
      <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.muted, marginTop: 8, textAlign: 'center' }}>
        {text}
      </Text>
    </View>
  );
}

export function LoadingState() {
  const { colors } = useTheme();
  return (
    <View style={styles.empty}>
      <ActivityIndicator color={colors.primary} />
    </View>
  );
}

/** Ícone quadrado colorido (linhas de lista, notificações). */
export function IconSquare({
  icon,
  color,
  bg,
  size = 40,
}: {
  icon: FeatherName;
  color: string;
  bg: string;
  size?: number;
}) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: 12,
        backgroundColor: bg,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Feather name={icon} size={size * 0.45} color={color} />
    </View>
  );
}

export function PrimaryButton({
  label,
  onPress,
  disabled,
  loading,
  style,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
}) {
  const { isDark } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        styles.btn,
        { backgroundColor: isDark ? '#2b3a4d' : '#0b2e55', opacity: disabled || loading ? 0.6 : 1 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color="#fff" size="small" />
      ) : (
        <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: '#fff' }}>{label}</Text>
      )}
    </Pressable>
  );
}

export function SecondaryButton({
  label,
  onPress,
  danger,
  style,
}: {
  label: string;
  onPress: () => void;
  danger?: boolean;
  style?: ViewStyle;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[styles.btn, { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: danger ? colors.danger : colors.border }, style]}
    >
      <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: danger ? colors.danger : colors.text }}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Avatar circular com iniciais. */
export function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: '#1d2a3b',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ fontFamily: fonts.serif, fontSize: size * 0.44, color: '#e6d9b8' }}>{initials || '?'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 3.5,
    alignSelf: 'flex-start',
    maxWidth: 150,
  },
  pillText: { fontFamily: fonts.medium, fontSize: 11 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 6, paddingHorizontal: 7 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  segTrack: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 3,
  },
  segItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 9,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 100,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 36,
    paddingHorizontal: 24,
  },
  btn: {
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
});
