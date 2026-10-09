// js/prazos.js
// Contagem de prazos em dias úteis ou corridos, com o calendário de feriados
// que vale para a Câmara Municipal de Duque de Caxias. Funções PURAS (só
// dependem dos argumentos) — carregado como script clássico antes do app.js e
// testado em test/web/prazos.test.js.
//
// Feriados embutidos (conferidos em fonte oficial):
//   - Nacionais: Lei 662/1949 e Lei 6.802/1980 (datas fixas), Lei 9.093/1995
//     (Sexta-feira Santa) e Lei 14.759/2023 (Consciência Negra).
//   - Estado do RJ: Lei 5.198/2008 (São Jorge, 23/04) e Lei 5.243/2008
//     (terça-feira de Carnaval). Consciência Negra já era estadual no RJ
//     (Lei 4.007/2002), por isso vale em todos os anos.
//   - Duque de Caxias: Santo Antônio, padroeiro (13/06, Deliberação 1.543/1970).
// Pontos facultativos (segunda de Carnaval, Quarta-feira de Cinzas, Corpus
// Christi) e qualquer outra data só entram se forem ligados em Configurações:
// na dúvida o dia conta como útil, para o prazo nunca ficar mais longo do que é.

(function (raiz) {
  'use strict';

  const DIA = 86400000;
  const chave = (d) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
  const dataUTC = (s) => { if (!s) return null; const [y, m, d] = String(s).split('-').map(Number); if (!y || !m || !d) return null; return new Date(Date.UTC(y, m - 1, d)); };
  const somaDias = (d, n) => new Date(d.getTime() + n * DIA);

  // Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher, calendário gregoriano).
  function pascoa(ano) {
    const a = ano % 19, b = Math.floor(ano / 100), c = ano % 100;
    const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const mes = Math.floor((h + l - 7 * m + 114) / 31), dia = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(Date.UTC(ano, mes - 1, dia));
  }

  // Pontos facultativos que a Procuradoria pode ligar em Configurações.
  const PONTOS_FACULTATIVOS = [
    { id: 'carnavalSegunda', nome: 'Segunda-feira de Carnaval', delta: -48 },
    { id: 'cinzas', nome: 'Quarta-feira de Cinzas', delta: -46 },
    { id: 'corpusChristi', nome: 'Corpus Christi', delta: 60 },
  ];

  // Lista de feriados do ano: [{ data:'YYYY-MM-DD', nome, esfera }].
  // opcoes.pontos = { carnavalSegunda:bool, cinzas:bool, corpusChristi:bool }
  // opcoes.extras = [{ data:'YYYY-MM-DD', desc }] (datas avulsas cadastradas)
  function feriadosDoAno(ano, opcoes = {}) {
    const p = pascoa(ano);
    const fixo = (mm, dd) => `${ano}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
    const movel = (delta) => chave(somaDias(p, delta));
    const lista = [
      { data: fixo(1, 1), nome: 'Confraternização Universal', esfera: 'Nacional' },
      { data: movel(-2), nome: 'Sexta-feira Santa', esfera: 'Nacional' },
      { data: fixo(4, 21), nome: 'Tiradentes', esfera: 'Nacional' },
      { data: fixo(5, 1), nome: 'Dia do Trabalho', esfera: 'Nacional' },
      { data: fixo(9, 7), nome: 'Independência do Brasil', esfera: 'Nacional' },
      { data: fixo(10, 12), nome: 'Nossa Senhora Aparecida', esfera: 'Nacional' },
      { data: fixo(11, 2), nome: 'Finados', esfera: 'Nacional' },
      { data: fixo(11, 15), nome: 'Proclamação da República', esfera: 'Nacional' },
      { data: fixo(11, 20), nome: 'Dia da Consciência Negra', esfera: ano >= 2024 ? 'Nacional' : 'Estadual (RJ)' },
      { data: fixo(12, 25), nome: 'Natal', esfera: 'Nacional' },
      { data: fixo(6, 13), nome: 'Santo Antônio (padroeiro)', esfera: 'Municipal (Duque de Caxias)' },
    ];
    if (ano >= 2008) {
      lista.push({ data: movel(-47), nome: 'Terça-feira de Carnaval', esfera: 'Estadual (RJ)' });
      lista.push({ data: fixo(4, 23), nome: 'São Jorge', esfera: 'Estadual (RJ)' });
    }
    const pontos = opcoes.pontos || {};
    PONTOS_FACULTATIVOS.forEach(pf => {
      if (pontos[pf.id]) lista.push({ data: movel(pf.delta), nome: pf.nome, esfera: 'Ponto facultativo' });
    });
    (opcoes.extras || []).forEach(x => {
      if (x && typeof x.data === 'string' && x.data.startsWith(`${ano}-`)) lista.push({ data: x.data, nome: x.desc || 'Sem expediente', esfera: 'Cadastrado' });
    });
    return lista.sort((a, b) => a.data.localeCompare(b.data));
  }

  // Recesso forense (CPC, art. 220): prazos processuais suspensos de 20/12 a 20/01, inclusive.
  function emRecessoForense(d) {
    const m = d.getUTCMonth() + 1, dia = d.getUTCDate();
    return (m === 12 && dia >= 20) || (m === 1 && dia <= 20);
  }

  // Monta um verificador "por que este dia não é útil?" com cache por ano.
  function criarCalendario(opcoes = {}) {
    const porAno = new Map();
    const feriadoEm = (d) => {
      const ano = d.getUTCFullYear();
      if (!porAno.has(ano)) porAno.set(ano, new Map(feriadosDoAno(ano, opcoes).map(f => [f.data, f.nome])));
      return porAno.get(ano).get(chave(d)) || null;
    };
    // Retorna null se o dia é útil, ou o motivo (texto) se não é.
    return function motivoNaoUtil(d) {
      const f = feriadoEm(d);
      if (f) return f;
      if (opcoes.recesso && emRecessoForense(d)) return 'Recesso forense';
      const dow = d.getUTCDay();
      if (dow === 0 || dow === 6) return 'fim de semana';
      return null;
    };
  }

  // Calcula o vencimento.
  //   inicio:   'YYYY-MM-DD' — dia da ciência/intimação (não entra na contagem)
  //   dias:     quantidade de dias do prazo
  //   contagem: 'uteis' | 'corridos'
  //   opcoes:   { pontos, extras, recesso }
  // Regras (CPC, arts. 219, 220 e 224; Lei 9.784/1999, art. 66): exclui o dia do
  // começo e inclui o do vencimento; em dias úteis só contam os dias com
  // expediente; em dias corridos, se o último dia cair sem expediente, o prazo
  // vai para o próximo dia útil. No recesso forense o prazo fica suspenso.
  // Retorna { vencimento:'YYYY-MM-DD', pulados:[{ data, motivo }], prorrogado:bool } ou null.
  function calcularPrazo(inicio, dias, contagem = 'uteis', opcoes = {}) {
    const ini = dataUTC(inicio), n = Math.floor(Number(dias));
    if (!ini || !Number.isFinite(n) || n < 1 || n > 3650) return null;
    const motivo = criarCalendario(opcoes);
    const pulados = [];
    let d = ini, prorrogado = false;
    if (contagem === 'corridos') {
      let restantes = n;
      while (restantes > 0) {
        d = somaDias(d, 1);
        // Recesso suspende também o prazo em dias corridos.
        if (opcoes.recesso && emRecessoForense(d)) { pulados.push({ data: chave(d), motivo: 'Recesso forense' }); continue; }
        restantes--;
      }
      let m = motivo(d);
      while (m) { pulados.push({ data: chave(d), motivo: m }); prorrogado = true; d = somaDias(d, 1); m = motivo(d); }
    } else {
      let contados = 0;
      while (contados < n) {
        d = somaDias(d, 1);
        const m = motivo(d);
        if (m) pulados.push({ data: chave(d), motivo: m });
        else contados++;
      }
    }
    return { vencimento: chave(d), pulados, prorrogado };
  }

  const api = { pascoa, feriadosDoAno, emRecessoForense, criarCalendario, calcularPrazo, PONTOS_FACULTATIVOS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else raiz.Prazos = api;
})(typeof window !== 'undefined' ? window : globalThis);
