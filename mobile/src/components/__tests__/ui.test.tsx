// Testes de tela dos componentes de UI reutilizados (mobile/src/components/ui.tsx).
// Renderizam de verdade via @testing-library/react-native; o ThemeContext tem
// valor default (claro), então não precisa de provider.
import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import { Avatar, EmptyState, PrimaryButton, Segmented, StatusPill } from '../ui';

describe('StatusPill', () => {
  it('mostra o rótulo completo do status', () => {
    const { getByText } = render(<StatusPill stat="finalizado" />);
    expect(getByText('Finalizado')).toBeTruthy();
  });

  it('mostra o rótulo curto quando short', () => {
    const { getByText } = render(<StatusPill stat="aguardando-documentacao" short />);
    expect(getByText('Aguard. Doc.')).toBeTruthy();
  });

  it('status desconhecido cai no fallback (primeiro status: Pendente)', () => {
    const { getByText } = render(<StatusPill stat="nao-existe" />);
    expect(getByText('Pendente')).toBeTruthy();
  });
});

describe('Avatar', () => {
  it('mostra as iniciais (2 primeiras palavras) em maiúsculas', () => {
    const { getByText } = render(<Avatar name="ana beatriz costa" />);
    expect(getByText('AB')).toBeTruthy();
  });

  it('nome vazio vira "?"', () => {
    const { getByText } = render(<Avatar name="  " />);
    expect(getByText('?')).toBeTruthy();
  });
});

describe('Segmented', () => {
  it('dispara onChange com a chave da opção tocada', () => {
    const onChange = jest.fn();
    const { getByText } = render(
      <Segmented
        options={[{ key: 'lista', label: 'Lista' }, { key: 'kanban', label: 'Kanban' }]}
        value="lista"
        onChange={onChange}
      />
    );
    fireEvent.press(getByText('Kanban'));
    expect(onChange).toHaveBeenCalledWith('kanban');
  });
});

describe('EmptyState', () => {
  it('mostra o texto informado', () => {
    const { getByText } = render(<EmptyState text="Nenhum processo encontrado" />);
    expect(getByText('Nenhum processo encontrado')).toBeTruthy();
  });
});

describe('PrimaryButton', () => {
  it('dispara onPress no toque', () => {
    const onPress = jest.fn();
    const { getByText } = render(<PrimaryButton label="Salvar" onPress={onPress} />);
    fireEvent.press(getByText('Salvar'));
    expect(onPress).toHaveBeenCalled();
  });

  it('não dispara quando disabled', () => {
    const onPress = jest.fn();
    const { getByText } = render(<PrimaryButton label="Salvar" onPress={onPress} disabled />);
    fireEvent.press(getByText('Salvar'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('em loading esconde o rótulo (mostra o spinner)', () => {
    const { queryByText } = render(<PrimaryButton label="Salvar" onPress={() => {}} loading />);
    expect(queryByText('Salvar')).toBeNull();
  });
});
