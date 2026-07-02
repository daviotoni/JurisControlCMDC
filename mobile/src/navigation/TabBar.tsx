import { Feather } from '@expo/vector-icons';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useData } from '../data/DataContext';
import { useTheme } from '../theme/ThemeContext';
import { fonts, shadow } from '../theme/tokens';
import { FeatherName } from '../components/ui';

const ICONS: Record<string, FeatherName> = {
  Inicio: 'grid',
  Processos: 'clipboard',
  Agenda: 'calendar',
  Alertas: 'bell',
  Perfil: 'user',
};

const LABELS: Record<string, string> = {
  Inicio: 'Início',
  Processos: 'Processos',
  Agenda: 'Agenda',
  Alertas: 'Alertas',
  Perfil: 'Perfil',
};

/** Barra inferior flutuante em pílula (Navy Hero). */
export function TabBar({ state, navigation }: BottomTabBarProps) {
  const { colors } = useTheme();
  const { unread } = useData();
  return (
    <View style={[styles.bar, shadow.float, { backgroundColor: colors.navBar }]}>
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const color = focused ? colors.navActive : colors.navInactive;
        return (
          <Pressable
            key={route.key}
            style={styles.item}
            onPress={() => {
              const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
            }}
          >
            <View>
              <Feather name={ICONS[route.name] ?? 'circle'} size={21} color={color} />
              {route.name === 'Alertas' && unread > 0 ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{unread > 99 ? '99+' : unread}</Text>
                </View>
              ) : null}
            </View>
            <Text style={[styles.label, { color }]}>{LABELS[route.name] ?? route.name}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 18,
    height: 66,
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    height: '100%',
  },
  label: {
    fontFamily: fonts.semibold,
    fontSize: 9.5,
  },
  badge: {
    position: 'absolute',
    top: -5,
    right: -9,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#e0574f',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    fontFamily: fonts.bold,
    fontSize: 9,
    color: '#fff',
  },
});
