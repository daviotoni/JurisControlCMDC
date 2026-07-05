/* =============================================================================
 * ata-parser.js — porte para o navegador do converter.py (JurisControl / CMDC)
 *
 * Lê o TEXTO CORRIDO do Word cru da empresa (extraído via mammoth) e separa em
 * dados estruturados para o ata-render.js: meta, chamada, quórum, expediente
 * (vetos/projetos/indicações/requerimentos), Tribuna e Ordem do Dia.
 *
 * Como é texto livre, o resultado precisa de uma CONFERIDA humana — o parser
 * devolve `warnings` apontando onde teve de assumir um padrão.
 *
 * Uso:
 *   const { data, warnings } = AtaParser.parseFromText(rawTextoDoWord);
 *   renderAta(docPage, data, { minuta:false, mostrarFicha:true, mostrarQuadro:true });
 *
 * Fidelidade: tradução 1:1 do converter.py. Alguns trechos (quadro de votações
 * da sessão de 16/06, rótulo "Vetos e Pareceres") são específicos daquele
 * formato — servem de ponto de partida e são ajustados na conferida.
 * =========================================================================== */
(function (global) {
  'use strict';

  var CORPO_KW = 'instituindo|concedendo|solicitando|denominando|outorgando|consignando|' +
    'dispondo|que dispõe|autorizando|desafeta|criando|vedando|reconhecendo|' +
    'alterando|acrescentando|revogando|estabelecendo|proibindo|determinando';

  var MES = { 'janeiro': '01', 'fevereiro': '02', 'março': '03', 'abril': '04', 'maio': '05', 'junho': '06',
    'julho': '07', 'agosto': '08', 'setembro': '09', 'outubro': '10', 'novembro': '11', 'dezembro': '12' };

  var LABEL = { PL: 'Projeto de Lei', PDL: 'Decreto Legislativo', PR: 'Projeto de Resolução',
    IND: 'Indicação', REQ: 'Requerimento', VETO: 'Veto' };

  function norm(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); }

  // Menor índice, a partir de `from`, entre vários marcadores possíveis (ou -1).
  function firstIndexOf(s, markers, from) {
    from = from || 0;
    var best = -1;
    for (var i = 0; i < markers.length; i++) {
      var idx = s.indexOf(markers[i], from);
      if (idx >= 0 && (best < 0 || idx < best)) best = idx;
    }
    return best;
  }

  // Limpa o nome capturado: tira o " e" final (junção de lista) e prefixos que
  // não são nome (ex.: "Os Vereadores ...", "e o Vereador ..."), comuns quando
  // um grupo de vereadores registra presença no meio da lista.
  function cleanNome(s) {
    s = norm(s).replace(/[ e]+$/, '');
    s = s.replace(/^(?:e\s+)?[Oo]s?\s+Vereador(?:es|as|a)?\s+/, '');
    return s.trim();
  }

  // "Nome (Apelido), Nome (Apelido) e Nome (Apelido)" -> [{nome, apelido}]
  function splitPeople(segment) {
    var out = [];
    var re = /([A-ZÀ-Ú][^(,]+?)\s*\(([^)]+)\)/g, m;
    while ((m = re.exec(segment))) {
      out.push({ nome: cleanNome(m[1]), apelido: norm(m[2]) });
    }
    return out;
  }

  function splitAutorCorpo(rest) {
    rest = String(rest || '').trim().replace(/^,/, '').trim();
    // autor = Executivo
    if (/^d[oa]s?\s+Ex[mM][ºoª]?\.?\s+Sr[ª]?\.?\s+Prefeito/.test(rest)) {
      var rest2 = rest.replace(/^d[oa]s?\s+Ex[mM][ºoª]?\.?\s+Sr[ª]?\.?\s+Prefeito[,]?\s*/, '');
      return ['Chefe do Poder Executivo', norm(rest2)];
    }
    // autor = Vereador(a) NOME
    var mv = rest.match(/^d[oa]s?\s+Ex[mM][ºoª]?\.?\s+Sr[ª]?\.?\s+Vereador[a]?\s+([\s\S]+)/);
    if (mv) {
      var tail = mv[1];
      var m = tail.match(new RegExp('\\b(' + CORPO_KW + ')\\b'));
      if (m) {
        return [norm(tail.slice(0, m.index).replace(/[ ,]+$/, '')), norm(tail.slice(m.index))];
      }
      var idx = tail.indexOf(',');
      if (idx >= 0) return [norm(tail.slice(0, idx)), norm(tail.slice(idx + 1))];
      return [norm(tail), ''];
    }
    // sem autor explícito
    return ['', norm(rest)];
  }

  function classify(a) {
    if (a.indexOf('Mensagem') === 0) return 'VETO';
    if (a.indexOf('Projeto de Lei') === 0) return 'PL';
    if (a.indexOf('Projeto de Decreto') === 0) return 'PDL';
    if (a.indexOf('Projeto de Resolução') === 0) return 'PR';
    if (a.indexOf('Indicação') === 0) return 'IND';
    return 'REQ';
  }

  // Localiza as "âncoras" (Mensagem/Projeto/Indicação/Requerimento nº …) e monta
  // uma linha por matéria a partir do trecho entre âncoras.
  function itemsFrom(text, vetoOnly) {
    var anchor = /(Mensagem n[ºo]\.?\s*\d+\/GP\/\d+|Projeto de Lei n[ºo]\.?\s*[\d.\/]+|Projeto de Decreto Legislativo n[ºo]\.?\s*[\d.\/]+|Projeto de Resolução n[ºo]\.?\s*[\d.\/]+|Indicação n[ºo]\.?\s*[\d.\/]+|Requerimento n[ºo]\.?\s*[\d.\/]+)/g;
    var hits = [], m;
    while ((m = anchor.exec(text))) {
      hits.push({ t: m[1], start: m.index, end: m.index + m[0].length });
    }
    // um "Projeto de Lei nº X" logo após "encaminhando"/"ao" é objeto de uma Mensagem, não item próprio
    hits = hits.filter(function (h) {
      if (h.t.indexOf('Projeto de Lei') === 0) {
        var before = text.slice(Math.max(0, h.start - 16), h.start);
        if (/(encaminhando|ao)\s*$/.test(before)) return false;
      }
      return true;
    });
    if (vetoOnly) hits = hits.filter(function (h) { return h.t.indexOf('Mensagem') === 0; });

    var rows = [];
    for (var i = 0; i < hits.length; i++) {
      var h = hits[i];
      var seg = text.slice(h.end, i + 1 < hits.length ? hits[i + 1].start : text.length);
      var kind = classify(h.t);
      var numM = h.t.match(/([\d]+\/\d{4}|\d+\/GP\/\d+)/);
      var num = numM ? numM[1] : '';
      // "Mensagem" sem a palavra VETO = mensagem do Executivo encaminhando projeto (não é veto)
      var isVeto = kind === 'VETO' && /VETO/i.test(seg);
      if (kind === 'VETO' && !isVeto) {
        var pl = seg.match(/Projeto de Lei n[ºo]\.?\s*([\d\/]+)/);
        var que = seg.match(/\bque\b[\s\S]*/);
        rows.push({ tag: 'PL', label: 'Projeto de Lei (Executivo)',
          num: pl ? pl[1] : num,
          autor: 'Chefe do Poder Executivo (Mensagem ' + num + ')',
          corpo: que ? norm(que[0]) : norm(seg) });
        continue;
      }
      var ac = splitAutorCorpo(seg);
      var row = { tag: kind, label: LABEL[kind], num: num, autor: ac[0], corpo: ac[1] };
      if (isVeto) {
        var vt = seg.match(/VETO (TOTAL|PARCIAL)/i);
        var cap = vt ? (vt[1].charAt(0).toUpperCase() + vt[1].slice(1).toLowerCase()) : 'Total';
        row.label = 'Veto ' + cap;
        row.autor = 'Chefe do Poder Executivo';
      }
      rows.push(row);
    }
    return rows;
  }

  // Recebe a LISTA de parágrafos (não-vazios, já aparados) do Word.
  function parse(paras) {
    paras = (paras || []).map(function (p) { return String(p); });
    var header = paras.slice(0, 9);
    var body = paras.length > 2 ? norm(paras[2]) : norm(paras.join(' '));
    var warn = [];
    var data = {};

    // ---- meta ----
    var reuniao = header.length
      ? norm(header[0]).replace(/\.+$/, '').replace(/^Ata\s+d[ao]\s+/, '')
      : '';
    var m = body.match(/(Aos [\s\S]+? de dois mil e vinte e [A-Za-zÀ-ÿ]+),?\s*reuni/);
    var dpe = m ? m[1] : '';
    var hj = header.join(' ');
    m = hj.match(/Realizada no dia ([\s\S]+?)\./);
    var dataExt = m ? norm(m[1]) : '';
    m = body.match(/Presidência do Vereador ([\s\S]+?)\s*\(([\s\S]+?)\)\s*e secretariando os trabalhos (o|a) Vereador[a]?\s+([\s\S]+?)\s*\(([\s\S]+?)\)\./);
    var pres = {}, sec = {}, fem = false, emEx = false;
    if (m) {
      pres = { nome: norm(m[1]), apelido: norm(m[2]) };
      sec = { nome: norm(m[4]), apelido: norm(m[5]) };
      fem = m[3] === 'a';
      var endp = m.index + m[0].length;
      emEx = body.slice(endp, endp + 30).toLowerCase().indexOf('em exercício') >= 0;
    }
    var dc = '';
    var md = dataExt.match(/(\d{1,2}) de ([A-Za-zÀ-ÿ]+) de (\d{4})/);
    if (md) {
      var dd = ('0' + parseInt(md[1], 10)).slice(-2);
      dc = dd + '.' + (MES[md[2].toLowerCase()] || '00') + '.' + md[3];
    }
    data.meta = {
      reuniao: reuniao, legislatura: 'Vigésima Legislatura (20ª)',
      dataExtenso: dataExt, dataCurta: dc, dataPorExtenso: norm(dpe),
      odResumo: 'Vetos e Pareceres',
      secretarioCargo: (fem ? 'Secretária' : 'Secretário') + (emEx ? ' em exercício' : ''),
      secretarioArtigo: (fem ? 'a Vereadora' : 'o Vereador'),
      secretarioEmExercicio: emEx,
      presidente: pres, secretario: sec,
      redator: { nome: 'Davi Otoni da Silva Viana Leite', matricula: '9363696' }
    };
    warn.push('Redator veio EM BRANCO no Word da empresa — preenchido com o padrão (Davi Otoni). REVISAR.');

    // ---- chamada ----
    m = body.match(/os seguintes Vereadores:([\s\S]+?)Havendo número legal/);
    data.chamada = m ? splitPeople(m[1]) : [];

    // ---- expediente ----
    var sExp = body.indexOf('Expediente:');
    var eExp = body.indexOf('Terminada a leitura do Expediente');
    var exp = body.slice(sExp < 0 ? 0 : sExp, eExp < 0 ? body.length : eExp);
    var expRows = itemsFrom(exp, false);
    data.vetos = expRows.filter(function (r) { return r.tag === 'VETO'; });
    data.projetos = expRows.filter(function (r) { return r.tag === 'PL' || r.tag === 'PDL' || r.tag === 'PR'; });
    data.indicacoes = expRows.filter(function (r) { return r.tag === 'IND'; })
      .map(function (r) { return { num: r.num, autor: r.autor, corpo: r.corpo }; });
    data.requerimentos = expRows.filter(function (r) { return r.tag === 'REQ'; })
      .map(function (r) { return { num: r.num, autor: r.autor, corpo: r.corpo }; });

    // ---- tribuna ----
    // A Tribuna termina onde começa a Ordem do Dia OU o Expediente Final OU o
    // encerramento — nem toda sessão tem "ORDEM DO DIA" (ex.: só Expediente +
    // Tribuna). Usa o marcador que aparecer primeiro após o início da Tribuna.
    var sT = body.indexOf('franqueou a Tribuna');
    var eT = firstIndexOf(body, ['ORDEM DO DIA', 'EXPEDIENTE FINAL',
      'Não havendo Vereador inscrito', 'Não havendo mais Vereador'], sT < 0 ? 0 : sT + 1);
    var trib = body.slice(sT < 0 ? 0 : sT, eT < 0 ? body.length : eT);
    // O nome do orador é curto: limitá-lo (2..60 caracteres, sem "(" nem ":")
    // impede que a regex "engula" o discurso inteiro quando o próprio orador
    // menciona "Vereador(a)" no meio da fala.
    var speaker = /Vereador[a]?\s+([A-ZÀ-Ú][^:(]{1,59}?)\s*\(([^)]+)\):\s*/g;
    var marks = [], mk;
    while ((mk = speaker.exec(trib))) {
      marks.push({ nome: mk[1], apelido: mk[2], head: mk[0], start: mk.index, end: mk.index + mk[0].length });
    }
    var tribuna = [];
    for (var i = 0; i < marks.length; i++) {
      var fala = trib.slice(marks[i].end, i + 1 < marks.length ? marks[i + 1].start : trib.length);
      fala = fala.replace(/(?:Por ordem de inscri[çc][ãa]o|Líder de Governo)[,]?\s*$/, '').trim();
      // O papel ("Por ordem de inscrição" / "Líder de Governo") é anunciado
      // ANTES do "Vereador ..." — olha a janela imediatamente anterior.
      var antes = trib.slice(Math.max(0, marks[i].start - 45), marks[i].start);
      var papel = /Líder de Governo/.test(antes) ? 'Líder de Governo' : 'Por ordem de inscrição';
      tribuna.push({ n: i + 1, nome: norm(marks[i].nome), apelido: norm(marks[i].apelido),
        papel: papel, segmentos: [{ tipo: 'fala', texto: norm(fala) }] });
    }
    data.tribuna = tribuna;

    // ---- ordem do dia ----
    // Se a sessão não tem Ordem do Dia formal, `od` fica vazio e as seções de
    // quórum/grupos/debates/votações saem vazias (não inventamos a partir do
    // Expediente).
    var sOd = body.indexOf('ORDEM DO DIA');
    var od = sOd < 0 ? '' : body.slice(sOd);
    m = od.match(/Registrou-se um total de\s+(\d+)\s+Vereadores presentes[^:]*:([\s\S]+?)(?:A Secretári|O Secretári)/);
    data.quorum = m ? splitPeople(m[2]) : [];

    // grupos de leitura da OD
    var grupos = [];
    var g1 = od.match(/\(Discussão Única\):([\s\S]+?)Feita a leitura/);
    if (g1) grupos.push({ titulo: 'Vetos', subtitulo: 'Discussão Única', items: itemsFrom(g1[1], true) });
    var g2 = od.match(/\(1ª Discussão dos Pareceres\):([\s\S]+?)Feita a leitura/);
    if (g2) grupos.push({ titulo: 'Pareceres', subtitulo: '1ª Discussão', items: itemsFrom(g2[1], false) });
    data.odGrupos = grupos;

    // debates ("... discute a matéria: ..." / "O Presidente retoma a palavra ...: ...")
    var debates = [];
    var debRe = /(?:Mensagem|Projeto)[^.]*?, em Discussão\.\s*([\s\S]+?)Não havendo mais quem queira discutir,\s*([\s\S]+?)(?:Aprovad[ao][\s\S]*?\.)/g;
    var dm;
    while ((dm = debRe.exec(od))) {
      var bloco = dm[1];
      var falas = [];
      var falaRe = /Vereador[a]?\s+([A-ZÀ-Ú][^:(]+?)(?:\s*\(([^)]+)\))?(?:,\s*(Líder de Governo))?\s*discute a matéria:\s*([\s\S]+?)(?=Vereador[a]?\s+[A-ZÀ-Ú][^:(]+?(?:\s*\([^)]+\))?(?:,\s*Líder de Governo)?\s*discute a matéria:|O Presidente retoma|$)/g;
      var f;
      while ((f = falaRe.exec(bloco))) {
        falas.push({ nome: norm(f[1]), apelido: norm(f[2] || ''), papel: f[3] || '', texto: norm(f[4]) });
      }
      var presM = bloco.match(/O Presidente retoma a palavra[^:]*:\s*([\s\S]+)/);
      if (presM) {
        falas.push({ nome: data.meta.presidente.nome || '', apelido: data.meta.presidente.apelido || '',
          papel: 'Presidente — resumo', texto: norm(presM[1]) });
      }
      var full = dm[0];
      var cut = full.indexOf(', em Discussão');
      var materia = norm(cut >= 0 ? full.slice(0, cut) : full);
      debates.push({ materia: materia, falas: falas, desfecho: '' });
    }
    data.debates = debates;

    // votações (resumo) — trechos específicos da sessão de 16/06 (conferir/ajustar)
    var votacoes = [];
    var v14 = od.match(/Mensagem nº 014\/GP\/2026[\s\S]*?Aprovada por (\d+) votos favoráveis e (\d+) contra[^.]*?do Vereador ([^.]+)\./);
    var vre = /Mensagem nº (\d+\/GP\/\d+), encaminhando Projeto de Lei nº ([\d\/]+),[\s\S]*?(Aprovad[ao][^.]*)\./g;
    var vm;
    while ((vm = vre.exec(od))) {
      var res = norm(vm[3]);
      if (vm[1] === '014/GP/2026' && v14) {
        res = 'Aprovada — ' + v14[1] + ' a ' + v14[2] + ' (contra: Ver. ' + norm(v14[3]) + ')';
      }
      votacoes.push({ materia: 'Veto — Msg ' + vm[1] + ' (PL ' + vm[2] + ')',
        tipo: 'Discussão Única', resultado: res });
    }
    if (/Segunda Discussão e Votação Extraordinária/.test(od)) {
      votacoes.push({ materia: 'Pareceres (PL 13, PL 126, PDL 307–321, PR 024–025)',
        tipo: '1ª e 2ª Discussão (Extraordinária)', resultado: 'Aprovados por unanimidade' });
    }
    data.votacoes = votacoes;

    // avisos de conferida (além do redator)
    if (!pres.nome) warn.push('Não identifiquei a Presidência/Secretaria no preâmbulo — CONFERIR.');
    if (!data.chamada.length) warn.push('Chamada regimental veio vazia — CONFERIR o Word.');
    if (!data.quorum.length) warn.push('Quórum da Ordem do Dia veio vazio — CONFERIR.');
    if (!dataExt) warn.push('Data por extenso da sessão não foi encontrada — CONFERIR.');

    return { data: data, warnings: warn };
  }

  // Quebra o texto cru (mammoth.extractRawText) em parágrafos não-vazios.
  function paragraphsFromText(raw) {
    return String(raw || '')
      .split(/\r?\n/)
      .map(function (s) { return s.replace(/\s+/g, ' ').trim(); })
      .filter(function (s) { return s.length > 0; });
  }

  function parseFromText(raw) {
    return parse(paragraphsFromText(raw));
  }

  global.AtaParser = {
    parse: parse,
    parseFromText: parseFromText,
    paragraphsFromText: paragraphsFromText
  };
})(typeof window !== 'undefined' ? window : this);
