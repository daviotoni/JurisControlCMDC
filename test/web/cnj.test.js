// Testes do número CNJ → tribunal do Datajud (js/utils.js).
import utils from '../../js/utils.js';

const { numeroCNJValido, tribunalDoCNJ } = utils;

describe('numeroCNJValido', () => {
  it('confere o dígito verificador (módulo 97)', () => {
    expect(numeroCNJValido('0012345-90.2024.8.19.0021')).toBe(true);
    expect(numeroCNJValido('00123459020248190021')).toBe(true);
    expect(numeroCNJValido('0012345-91.2024.8.19.0021')).toBe(false); // DV errado
    expect(numeroCNJValido('1234/2026')).toBe(false);
  });
});

describe('tribunalDoCNJ', () => {
  it('identifica justiça estadual, federal, do trabalho e STJ', () => {
    expect(tribunalDoCNJ('0012345-90.2024.8.19.0021')).toBe('tjrj');
    expect(tribunalDoCNJ('5001234-54.2023.4.02.5101')).toBe('trf2');
    expect(tribunalDoCNJ('0100123-13.2025.5.01.0281')).toBe('trt1');
    expect(tribunalDoCNJ('1234567-33.2022.3.00.0000')).toBe('stj');
  });

  it('devolve null para número que não é CNJ', () => {
    expect(tribunalDoCNJ('5678/2025')).toBeNull();
    expect(tribunalDoCNJ('')).toBeNull();
  });
});
