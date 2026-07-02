import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';

/**
 * Cabeçalho "Navy Hero": gradiente navy 165°, cantos inferiores
 * arredondados 28px, respeitando a status bar nativa.
 */
export function NavyHeader({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  return (
    <LinearGradient
      colors={colors.heroGradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 0.35, y: 1 }}
      style={[styles.header, { paddingTop: insets.top + 10 }, style]}
    >
      {children}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  header: {
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    paddingHorizontal: 20,
    paddingBottom: 18,
  },
});
