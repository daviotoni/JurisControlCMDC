// Setup dos testes de tela (jest-expo + @testing-library/react-native).
//
// react-native-safe-area-context precisa do provider nativo; a própria lib
// fornece um mock oficial para Jest (insets zerados) — sem ele, qualquer tela
// com NavyHeader (useSafeAreaInsets) quebraria.
jest.mock('react-native-safe-area-context', () =>
  // O mock oficial usa `export default {...}` — sem o .default, o objeto
  // embrulhado não expõe useSafeAreaInsets e as telas com NavyHeader quebram.
  require('react-native-safe-area-context/jest/mock').default
);

// AsyncStorage é módulo nativo (não existe no Jest); a lib fornece o mock
// oficial em memória — usado pelo ThemeContext para persistir o tema.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
