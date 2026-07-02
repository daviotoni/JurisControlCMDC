import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useData } from '../data/DataContext';
import { useTheme } from '../theme/ThemeContext';
import { AgendaScreen } from '../screens/AgendaScreen';
import { ConfiguracoesScreen } from '../screens/ConfiguracoesScreen';
import { DashboardScreen } from '../screens/DashboardScreen';
import { DocumentosScreen } from '../screens/DocumentosScreen';
import { LeisScreen } from '../screens/LeisScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { NotificacoesScreen } from '../screens/NotificacoesScreen';
import { PerfilScreen } from '../screens/PerfilScreen';
import { ProcessoDetalheScreen } from '../screens/ProcessoDetalheScreen';
import { ProcessoFormScreen } from '../screens/ProcessoFormScreen';
import { ProcessosScreen } from '../screens/ProcessosScreen';
import { TabBar } from './TabBar';
import { RootStackParamList, TabParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

function Tabs() {
  return (
    <Tab.Navigator
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <TabBar {...props} />}
    >
      <Tab.Screen name="Inicio" component={DashboardScreen} />
      <Tab.Screen name="Processos" component={ProcessosScreen} />
      <Tab.Screen name="Agenda" component={AgendaScreen} />
      <Tab.Screen name="Alertas" component={NotificacoesScreen} />
      <Tab.Screen name="Perfil" component={PerfilScreen} />
    </Tab.Navigator>
  );
}

export function RootNavigator() {
  const { user, authReady } = useData();
  const { colors, isDark } = useTheme();

  const navTheme = {
    ...DefaultTheme,
    dark: isDark,
    colors: {
      ...DefaultTheme.colors,
      background: colors.bg,
      card: colors.card,
      text: colors.text,
      primary: colors.primary,
      border: colors.border,
    },
  };

  if (!authReady) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#082f57' }}>
        <ActivityIndicator color="#fff" />
      </View>
    );
  }

  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
        {!user ? (
          <Stack.Screen name="Tabs" component={LoginScreen} options={{ animation: 'fade' }} />
        ) : (
          <>
            <Stack.Screen name="Tabs" component={Tabs} options={{ animation: 'fade' }} />
            <Stack.Screen name="ProcessoDetalhe" component={ProcessoDetalheScreen} />
            <Stack.Screen
              name="ProcessoForm"
              component={ProcessoFormScreen}
              options={{ animation: 'slide_from_bottom' }}
            />
            <Stack.Screen name="Documentos" component={DocumentosScreen} />
            <Stack.Screen name="Leis" component={LeisScreen} />
            <Stack.Screen name="Configuracoes" component={ConfiguracoesScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
