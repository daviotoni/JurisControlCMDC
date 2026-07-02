import {
  IBMPlexSans_400Regular,
  IBMPlexSans_500Medium,
  IBMPlexSans_600SemiBold,
  IBMPlexSans_700Bold,
  useFonts,
} from '@expo-google-fonts/ibm-plex-sans';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect } from 'react';
import { Platform, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { DataProvider } from './src/data/DataContext';
import { RootNavigator } from './src/navigation';
import { ThemeProvider } from './src/theme/ThemeContext';

SplashScreen.preventAutoHideAsync().catch(() => {});

// Na web, /app/ é a versão mobile do site: se o navegador se apresenta como
// desktop (ex.: toggle "Site para computador" ligado, ou um PC de verdade),
// volta para a versão desktop na raiz. Escape para testes: ?mobile=1
if (
  Platform.OS === 'web' &&
  typeof window !== 'undefined' &&
  !/Mobi|iPhone|iPod/i.test(window.navigator.userAgent) &&
  window.location.search.indexOf('mobile=1') === -1
) {
  window.location.replace('/');
}

export default function App() {
  const [fontsLoaded] = useFonts({
    IBMPlexSans_400Regular,
    IBMPlexSans_500Medium,
    IBMPlexSans_600SemiBold,
    IBMPlexSans_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  const app = (
    <SafeAreaProvider>
      <ThemeProvider>
        <DataProvider>
          {/* Cabeçalhos são sempre navy — status bar clara em todas as telas */}
          <StatusBar style="light" />
          <RootNavigator />
        </DataProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );

  // Na web (juriscontrolcmdc.com.br/app/), limita à largura de um celular
  // e centraliza — em telas grandes o app não fica esticado.
  if (Platform.OS === 'web') {
    return (
      <View style={{ flex: 1, alignItems: 'center', backgroundColor: '#071f3c' }}>
        <View style={{ flex: 1, width: '100%', maxWidth: 480 }}>{app}</View>
      </View>
    );
  }

  return app;
}
