// Teste de TELA do Dashboard: renderiza a tela real e verifica o que o
// usuário vê (KPIs calculados dos processos, nome, badge de não lidas, banner
// de prazos). O acesso a dados (Firebase) e a navegação são mockados.
import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import { addDays, todayUTC, ymd } from '../../lib/dates';
import type { Processo } from '../../lib/types';

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));

const mockUseData = jest.fn();
jest.mock('../../data/DataContext', () => ({
  useData: () => mockUseData(),
}));

// Import DEPOIS dos jest.mock (o jest iça os mocks, mas deixamos explícito).
import { DashboardScreen } from '../DashboardScreen';

const dia = (offset: number) => ymd(addDays(todayUTC(), offset));

let seq = 0;
const proc = (over: Partial<Processo> = {}): Processo => ({
  id: ++seq,
  num: `P-${seq}`,
  int: 'Interessado',
  tipo: 'administrativo',
  obj: 'Objeto',
  stat: 'pendente',
  ent: dia(-1), // recente, para não disparar o alerta de inatividade (>20 dias)
  ...over,
});

// 3 pendentes (1 vencendo em 5 dias), 2 em análise, 4 finalizados.
// Os números renderizados precisam ser todos distintos (KPIs 3/2/1/4, badge 8,
// dias "5" na linha de próximos prazos) para os getByText não ambiguarem.
const PROCESSOS: Processo[] = [
  proc({ stat: 'pendente', prazo: dia(5) }),
  proc({ stat: 'pendente' }),
  proc({ stat: 'pendente' }),
  proc({ stat: 'em-analise' }),
  proc({ stat: 'em-analise' }),
  proc({ stat: 'finalizado' }),
  proc({ stat: 'finalizado' }),
  proc({ stat: 'finalizado' }),
  proc({ stat: 'finalizado' }),
];

const dataValue = (over: object = {}) => ({
  processos: PROCESSOS,
  userName: 'Dra. Ana',
  unread: 8,
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockUseData.mockReturnValue(dataValue());
});

describe('DashboardScreen', () => {
  it('mostra o nome do usuário e os KPIs calculados dos processos', () => {
    const { getByText } = render(<DashboardScreen />);
    expect(getByText('Dra. Ana')).toBeTruthy();

    // Rótulos dos cards
    expect(getByText('Pendentes')).toBeTruthy();
    expect(getByText('Em Análise')).toBeTruthy();
    expect(getByText('Vencendo (≤5 dias)')).toBeTruthy();
    expect(getByText('Finalizados')).toBeTruthy();

    // Valores (contagens distintas para não haver ambiguidade)
    expect(getByText('3')).toBeTruthy(); // pendentes
    expect(getByText('2')).toBeTruthy(); // em análise
    expect(getByText('1')).toBeTruthy(); // vencendo (prazo em 5 dias)
    expect(getByText('4')).toBeTruthy(); // finalizados
  });

  it('mostra o badge de notificações não lidas (e o teto 99+)', () => {
    const { getByText, rerender } = render(<DashboardScreen />);
    expect(getByText('8')).toBeTruthy();

    mockUseData.mockReturnValue(dataValue({ unread: 120 }));
    rerender(<DashboardScreen />);
    expect(getByText('99+')).toBeTruthy();
  });

  it('banner resume os prazos que vencem em 7 dias', () => {
    const { getByText } = render(<DashboardScreen />);
    expect(getByText('1 prazo vence em 7 dias')).toBeTruthy();
  });

  it('tocar no card "Pendentes" navega para Processos filtrado por status', () => {
    const { getByText } = render(<DashboardScreen />);
    fireEvent.press(getByText('Pendentes'));
    expect(mockNavigate).toHaveBeenCalledWith('Tabs', {
      screen: 'Processos',
      params: { status: 'pendente' },
    });
  });

  it('tocar no card "Vencendo" navega com o filtro de prazo em alerta', () => {
    const { getByText } = render(<DashboardScreen />);
    fireEvent.press(getByText('Vencendo (≤5 dias)'));
    expect(mockNavigate).toHaveBeenCalledWith('Tabs', {
      screen: 'Processos',
      params: { prazo: 'alerta' },
    });
  });

  it('lista os próximos prazos com o número do processo', () => {
    const { getByText } = render(<DashboardScreen />);
    // Só o P-1 tem prazo — a linha mostra "Proc. P-1 · Interessado".
    expect(getByText(/Proc\. P-1/)).toBeTruthy();
  });
});
