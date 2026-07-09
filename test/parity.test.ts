// Teste de PARIDADE entre as duas implementações das funções de data:
//   web    → js/utils.js         (fmtBR, parse/diffDays/ymd)
//   mobile → mobile/src/lib/dates.ts
//
// As regras de prazo do produto dependem dessas funções em ambos os apps. Como
// a lógica foi copiada à mão (ver comentários em dates.ts: "espelhando o
// js/app.js"), nada garante hoje que elas continuem idênticas. Este arquivo
// falha no CI assim que uma das duas divergir da outra.
import webUtils from '../js/utils.js';
import * as mobile from '../mobile/src/lib/dates';

const AMOSTRAS = [
  '2024-01-01',
  '2024-02-29', // bissexto
  '2024-07-09',
  '2024-12-31',
  '2023-03-01',
  '2025-11-15',
];

describe('paridade web × mobile — datas', () => {
  it('fmtBR produz o mesmo dd/mm/aaaa nas duas implementações', () => {
    for (const s of AMOSTRAS) {
      expect(mobile.fmtBR(s)).toBe(webUtils.fmtBR(s));
    }
  });

  it('fmtBR concorda no caso ausente (travessão)', () => {
    expect(mobile.fmtBR(null)).toBe(webUtils.fmtBR(null));
    expect(mobile.fmtBR('')).toBe(webUtils.fmtBR(''));
  });

  it('parse (web) e parseYMD (mobile) geram o mesmo instante UTC', () => {
    for (const s of AMOSTRAS) {
      expect(mobile.parseYMD(s)!.getTime()).toBe(webUtils.parse(s).getTime());
    }
  });

  it('diffDays concorda entre os pares de amostras', () => {
    for (let i = 0; i < AMOSTRAS.length - 1; i++) {
      const a = AMOSTRAS[i];
      const b = AMOSTRAS[i + 1];
      const web = webUtils.diffDays(webUtils.parse(a), webUtils.parse(b));
      const mob = mobile.diffDays(mobile.parseYMD(a)!, mobile.parseYMD(b)!);
      expect(mob).toBe(web);
    }
  });

  // Nota: `ymd` NÃO é comparado aqui de propósito — o web usa horário local
  // (getFullYear/Month/Date) e o mobile usa UTC (getUTC*). São semânticas
  // diferentes; o round-trip de cada um é coberto no seu próprio arquivo.
});
