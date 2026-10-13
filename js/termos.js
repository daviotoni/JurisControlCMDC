// js/termos.js
// Termos de Concordância: controle do envio, aos gabinetes, da via da Análise
// Prévia com o termo que o vereador autor devolve assinado (arquivamento ou
// conversão do anteprojeto em indicação). Funções PURAS — carregado como
// script clássico antes do app.js e testado em test/web/termos.test.js.
//
// Onde os dados ficam: no próprio processo, em `proc.termos` (lista). Cada
// item é um envio; só um fica ativo por vez (os cancelados ficam guardados).
//   {
//     id, desfecho: 'arquivamento' | 'conversao', fundamento,
//     apNumero, apData,                     // Análise Prévia (texto livre)
//     vereadorId, vereadorNome,             // nome guardado como estava no envio
//     dataEnvio: 'AAAA-MM-DD',              // data real da entrega
//     registradoEm (ISO), registradoPor,    // carimbo automático, nunca muda
//     statusAnterior,                       // status do processo antes do envio
//     guiaNumero, guiaSeq, guiaAno, guiaImpressaEm,
//     recebidoPor, recebidoEm,              // quem assinou a guia no gabinete
//     obs,
//     cobrancas: [{ id, data, obs, registradoEm, registradoPor }],
//     devolucao: null | { data, resposta: 'concorda' | 'nao-concorda', obs, registradoEm, registradoPor },
//     cancelamento: null | { motivo, em, por },
//     alteracoes: [{ em, por, campo, de, para }]  // correções feitas depois
//   }

(function (raiz) {
  'use strict';

  const DIA = 86400000;

  const DESFECHOS = { arquivamento: 'Arquivamento', conversao: 'Conversão em indicação' };
  const RESPOSTAS = { concorda: 'Concorda', 'nao-concorda': 'Não concorda' };
  const SITUACOES = { aguardando: 'Aguardando devolução', devolvido: 'Termo devolvido', cancelado: 'Cancelado' };

  // Campos do envio que podem ser corrigidos depois (com rastro).
  const CAMPOS_EDITAVEIS = {
    dataEnvio: 'Data do envio',
    vereadorNome: 'Vereador',
    desfecho: 'Desfecho proposto',
    fundamento: 'Fundamento',
    apNumero: 'Nº da Análise Prévia',
    apData: 'Data da Análise Prévia',
    recebidoPor: 'Recebido por',
    recebidoEm: 'Recebido em',
    obs: 'Observações',
    'devolucao.data': 'Data da devolução',
    'devolucao.resposta': 'Resposta do vereador',
    'devolucao.obs': 'Observações da devolução',
  };

  const dataUTC = (s) => {
    if (!s) return null;
    const [y, m, d] = String(s).slice(0, 10).split('-').map(Number);
    if (!y || !m || !d) return null;
    return new Date(Date.UTC(y, m - 1, d));
  };

  // Dias corridos entre duas datas AAAA-MM-DD (b - a). null se faltar data.
  function diasEntre(a, b) {
    const A = dataUTC(a), B = dataUTC(b);
    if (!A || !B) return null;
    return Math.round((B - A) / DIA);
  }

  // Minúsculas, sem acento e sem pontuação — para comparar nomes.
  function normalizar(s) {
    return String(s || '')
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function situacao(envio) {
    if (!envio) return null;
    if (envio.cancelamento) return 'cancelado';
    if (envio.devolucao) return 'devolvido';
    return 'aguardando';
  }

  // Envio que vale para o processo: o mais recente não cancelado.
  function envioAtivo(proc) {
    const lista = (proc && proc.termos) || [];
    for (let i = lista.length - 1; i >= 0; i--) if (!lista[i].cancelamento) return lista[i];
    return null;
  }

  // Todos os envios de todos os processos, como pares { proc, envio }.
  function listarEnvios(processos) {
    const out = [];
    (processos || []).forEach(proc => (proc.termos || []).forEach(envio => out.push({ proc, envio })));
    return out;
  }

  // Próximo número de guia do ano (NNNN/AAAA), a partir do maior já usado.
  function proximaGuia(processos, ano) {
    const seqs = listarEnvios(processos)
      .map(({ envio }) => envio)
      .filter(e => e.guiaAno === ano && typeof e.guiaSeq === 'number')
      .map(e => e.guiaSeq);
    const seq = (seqs.length ? Math.max(...seqs) : 0) + 1;
    return { seq, ano, numero: `${String(seq).padStart(4, '0')}/${ano}` };
  }

  // Envios que estão numa mesma guia (cancelados não saem na guia).
  function itensDaGuia(processos, guiaNumero) {
    if (!guiaNumero) return [];
    return listarEnvios(processos).filter(({ envio }) => envio.guiaNumero === guiaNumero && !envio.cancelamento);
  }

  // Guia a reaproveitar para um envio novo: a do mesmo gabinete, no mesmo
  // dia, que ainda não foi impressa. Depois de impressa, a folha assinada não
  // teria o processo novo — então ele ganha outra guia.
  function guiaReaproveitavel(processos, vereadorId, dataEnvio) {
    if (!vereadorId || !dataEnvio) return null;
    const mesmo = listarEnvios(processos).filter(({ envio }) =>
      !envio.cancelamento && envio.guiaNumero &&
      String(envio.vereadorId) === String(vereadorId) && envio.dataEnvio === dataEnvio);
    if (!mesmo.length) return null;
    const numero = mesmo[mesmo.length - 1].envio.guiaNumero;
    const daGuia = itensDaGuia(processos, numero);
    if (daGuia.some(({ envio }) => envio.guiaImpressaEm)) return null;
    const e = daGuia[0].envio;
    return { seq: e.guiaSeq, ano: e.guiaAno, numero };
  }

  // Sugere o vereador a partir do campo "Interessado" do processo: casa quando
  // todas as palavras do nome cadastrado aparecem no interessado, ou quando o
  // interessado (sem "vereador", "exmo." etc.) está contido no nome cadastrado.
  const TRATAMENTOS = new Set(['vereador', 'vereadora', 'ver', 'exmo', 'exma', 'sr', 'sra', 'gabinete', 'gab', 'do', 'da', 'de', 'dos', 'das', 'e']);
  function sugerirVereador(interessado, vereadores) {
    const alvo = normalizar(interessado);
    if (!alvo) return null;
    const palavrasAlvo = alvo.split(' ').filter(p => !TRATAMENTOS.has(p));
    if (!palavrasAlvo.length) return null;
    const ativos = (vereadores || []).filter(v => v && v.ativo !== false && v.nome);
    let melhor = null, melhorNota = 0;
    ativos.forEach(v => {
      const palavrasNome = normalizar(v.nome).split(' ').filter(p => !TRATAMENTOS.has(p));
      if (!palavrasNome.length) return;
      const todasNoAlvo = palavrasNome.every(p => palavrasAlvo.includes(p));
      const alvoNoNome = palavrasAlvo.every(p => palavrasNome.includes(p));
      const nota = todasNoAlvo || alvoNoNome ? Math.min(palavrasNome.length, palavrasAlvo.length) : 0;
      if (nota > melhorNota) { melhor = v; melhorNota = nota; }
    });
    return melhor;
  }

  // Status do processo sugerido quando o termo volta assinado.
  function sugerirStatusDevolucao(desfecho, resposta) {
    if (resposta === 'concorda') return desfecho === 'arquivamento' ? 'arquivado' : 'finalizado';
    return 'em-analise';
  }

  const ler = (obj, campo) => campo.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
  function escrever(obj, campo, valor) {
    const partes = campo.split('.');
    let o = obj;
    for (let i = 0; i < partes.length - 1; i++) { if (o[partes[i]] == null) return false; o = o[partes[i]]; }
    o[partes[partes.length - 1]] = valor;
    return true;
  }

  // Aplica correções a um envio guardando o valor antigo, o novo, quem mudou e
  // quando. Só mexe nos CAMPOS_EDITAVEIS; o carimbo de registro nunca muda.
  // `novos` = { campo: valor }. Devolve a lista de alterações feitas.
  function aplicarCorrecoes(envio, novos, usuario, agoraISO) {
    const feitas = [];
    Object.keys(novos || {}).forEach(campo => {
      if (!Object.prototype.hasOwnProperty.call(CAMPOS_EDITAVEIS, campo)) return;
      const de = ler(envio, campo) ?? '';
      const para = novos[campo] ?? '';
      if (String(de) === String(para)) return;
      if (!escrever(envio, campo, para)) return;
      feitas.push({ em: agoraISO, por: usuario, campo, de: String(de), para: String(para) });
    });
    if (feitas.length) envio.alteracoes = [...(envio.alteracoes || []), ...feitas];
    return feitas;
  }

  // Números do topo da aba: aguardando devolução, devolvidos no mês corrente e
  // o envio pendente mais antigo.
  function resumo(processos, hojeISO) {
    const mes = String(hojeISO).slice(0, 7);
    let aguardando = 0, devolvidosMes = 0, maisAntigo = null;
    listarEnvios(processos).forEach(({ proc, envio }) => {
      const sit = situacao(envio);
      if (sit === 'aguardando') {
        aguardando++;
        const dias = diasEntre(envio.dataEnvio, hojeISO);
        if (dias !== null && (!maisAntigo || dias > maisAntigo.dias)) maisAntigo = { dias, proc, envio };
      } else if (sit === 'devolvido' && String(envio.devolucao.data || '').slice(0, 7) === mes) {
        devolvidosMes++;
      }
    });
    return { aguardando, devolvidosMes, maisAntigo };
  }

  // Lista da aba: filtra por situação, vereador e texto; pendentes primeiro
  // (do envio mais antigo para o mais novo), depois os demais, mais recentes
  // primeiro.
  function filtrarEnvios(itens, { busca = '', situacao: sit = '', vereadorId = '' } = {}) {
    const t = normalizar(busca);
    let L = (itens || []).slice();
    if (sit) L = L.filter(({ envio }) => situacao(envio) === sit);
    else L = L.filter(({ envio }) => situacao(envio) !== 'cancelado');
    if (vereadorId) L = L.filter(({ envio }) => String(envio.vereadorId) === String(vereadorId));
    if (t) {
      L = L.filter(({ proc, envio }) => [proc.num, proc.int, proc.obj, envio.vereadorNome, envio.apNumero, envio.guiaNumero, envio.fundamento, envio.recebidoPor]
        .some(v => normalizar(v).includes(t)));
    }
    const peso = (e) => (situacao(e) === 'aguardando' ? 0 : 1);
    L.sort((a, b) => {
      const pa = peso(a.envio), pb = peso(b.envio);
      if (pa !== pb) return pa - pb;
      const da = String(a.envio.dataEnvio || ''), db = String(b.envio.dataEnvio || '');
      return pa === 0 ? da.localeCompare(db) : db.localeCompare(da);
    });
    return L;
  }

  const api = {
    DESFECHOS, RESPOSTAS, SITUACOES, CAMPOS_EDITAVEIS,
    diasEntre, normalizar, situacao, envioAtivo, listarEnvios, proximaGuia, itensDaGuia,
    guiaReaproveitavel, sugerirVereador, sugerirStatusDevolucao, aplicarCorrecoes, resumo, filtrarEnvios,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else raiz.Termos = api;
})(typeof window !== 'undefined' ? window : globalThis);
