/* =============================================================================
 * ata-render.js — motor de renderização da Ata (Câmara Municipal de Duque de Caxias)
 *
 * Recriação fiel do design do Claude Design, sem o runtime da ferramenta.
 * Monta o documento inteiro a partir de um objeto de dados e pagina em A4
 * via <doc-page>. Um mesmo motor atende qualquer sessão — basta trocar os
 * dados (ata09-data.js, ata11-data.js, …).
 *
 * Uso:
 *   renderAta(document.querySelector('doc-page'), DADOS, { minuta:false });
 *
 * Esquema de dados (todos os campos de lista são opcionais e seções vazias
 * são omitidas):
 *   meta          { reuniao, legislatura, dataExtenso, dataCurta, dataPorExtenso,
 *                   odResumo?, presidente:{nome,apelido}, secretario:{…}, redator:{nome,matricula} }
 *   chamada[]     { nome, apelido }
 *   quorum[]      { nome, apelido }
 *   vetos[]       { label, num, corpo }
 *   projetos[]    { tag, label, num, autor, corpo }   (ou via groups.PL/PDL/PR)
 *   indicacoes[]  { num, autor, corpo }                (ou via groups.IND)
 *   requerimentos[] { num, autor, corpo }              (ou via groups.REQ)
 *   groups        { PL[], PDL[], PR[], IND[], REQ[] }  (forma alternativa do expediente)
 *   odItems[]     { tag, label, num, autor, corpo }
 *   discussao     { modo:'box'|'paragrafo', titulo?, html }
 *   votacoes[]    { materia, tipo, resultado }
 *   tribuna[]     { n?, nome, apelido, papel, fala? | segmentos:[
 *                     {tipo:'fala',texto} | {tipo:'aparte',nome,apelido,texto} | {tipo:'retoma',texto} ] }
 * =========================================================================== */
(function (global) {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function raw(s) { return String(s == null ? '' : s); }

  /* ---- Normalização: aceita as duas formas de dados de sessão ------------ */
  function normalize(D) {
    D = D || {};
    var g = D.groups || null;
    var projetos = D.projetos || (g ? [].concat(g.PL || [], g.PDL || [], g.PR || []) : []);
    var indicacoes = D.indicacoes || (g ? (g.IND || []) : []);
    var requerimentos = D.requerimentos || (g ? (g.REQ || []) : []);
    var tribuna = (D.tribuna || []).map(function (s, i) {
      var segmentos = s.segmentos;
      if (!segmentos) {
        // Forma simples: uma única fala corrida (sessão sem apartes).
        segmentos = s.fala ? [{ tipo: 'fala', texto: s.fala }] : [];
      }
      return {
        n: s.n != null ? s.n : (i + 1),
        nome: s.nome, apelido: s.apelido, papel: s.papel || '',
        segmentos: segmentos
      };
    });
    return {
      meta: D.meta || {},
      chamada: D.chamada || [],
      quorum: D.quorum || [],
      vetos: D.vetos || [],
      projetos: projetos,
      indicacoes: indicacoes,
      requerimentos: requerimentos,
      odItems: D.odItems || [],
      odGrupos: D.odGrupos || null,
      debates: D.debates || [],
      votacoes: D.votacoes || [],
      discussao: D.discussao || null,
      tribuna: tribuna
    };
  }

  /* ---- Blocos reutilizáveis --------------------------------------------- */
  function sectionBand(num, titulo, meta) {
    return '<div style="display: flex; align-items: baseline; gap: 14px; background: #17160f; color: #f4f2e9; padding: 10px 16px; margin: 30px 0 0; break-inside: avoid; break-after: avoid;">' +
      '<span style="font-family: \'Archivo\', sans-serif; font-weight: 900; font-size: 20pt; line-height: 1;">' + esc(num) + '</span>' +
      '<span style="font-family: \'Archivo\', sans-serif; font-weight: 700; font-size: 12.5pt; letter-spacing: 0.12em; text-transform: uppercase;">' + esc(titulo) + '</span>' +
      (meta ? '<span style="margin-left: auto; font-family: \'Spline Sans Mono\', monospace; font-size: 6.6pt; letter-spacing: 0.14em; text-transform: uppercase; color: #b3b1a2;">' + esc(meta) + '</span>' : '') +
    '</div>';
  }
  function subHead(titulo, count) {
    return '<h3 style="font-family: \'Archivo\', sans-serif; font-weight: 700; font-size: 9pt; letter-spacing: 0.16em; text-transform: uppercase; margin: 22px 0 2px; padding-bottom: 5px; border-bottom: 1pt solid #17160f; display: flex; justify-content: space-between; align-items: baseline; break-after: avoid;">' +
      '<span>' + esc(titulo) + '</span><span style="font-family: \'Spline Sans Mono\', monospace; font-weight: 500; font-size: 7.5pt; color: #6a695e;">' + esc(count) + '</span>' +
    '</h3>';
  }
  function tagRow(tag, num, bodyHtml) {
    return '<div style="display: grid; grid-template-columns: 76px 1fr; gap: 14px; padding: 6px 0; border-bottom: 0.6pt solid #e6e4d8; break-inside: avoid;">' +
      '<div style="display: flex; flex-direction: column; gap: 3px; align-items: flex-start;">' +
        '<span style="font-family: \'Spline Sans Mono\', monospace; font-weight: 600; font-size: 7.6pt; letter-spacing: 0.05em; border: 1pt solid #17160f; padding: 1px 6px;">' + esc(tag) + '</span>' +
        '<span style="font-family: \'Spline Sans Mono\', monospace; font-weight: 500; font-size: 7.4pt; color: #45443b;">' + esc(num) + '</span>' +
      '</div>' +
      '<div class="ata-just">' + raw(bodyHtml) + '</div>' +
    '</div>';
  }
  // Solid-chip row (projetos / OD) or veto (dark-red chip)
  function chipRow(tag, num, label, bodyHtml, opts) {
    opts = opts || {};
    var colW = opts.colW || '76px';
    var chipBg = opts.chipBg || '#17160f';
    var chipFs = opts.chipFs || '8pt';
    var numFs = opts.numFs || '7.8pt';
    var upper = opts.upper ? ' text-transform: uppercase;' : '';
    return '<div style="display: grid; grid-template-columns: ' + colW + ' 1fr; gap: 14px; padding: 8px 0; border-bottom: 0.6pt solid #e0ded1; break-inside: avoid;">' +
      '<div style="display: flex; flex-direction: column; gap: 4px; align-items: flex-start;">' +
        '<span style="font-family: \'Spline Sans Mono\', monospace; font-weight: 600; font-size: ' + chipFs + '; letter-spacing: 0.05em; background: ' + chipBg + '; color: #f4f2e9; padding: 2px 7px;' + upper + '">' + esc(tag) + '</span>' +
        '<span style="font-family: \'Spline Sans Mono\', monospace; font-weight: 500; font-size: ' + numFs + '; color: #45443b;">' + esc(num) + '</span>' +
      '</div>' +
      '<div class="ata-just">' +
        (label ? '<span style="font-family: \'Spline Sans Mono\', monospace; font-size: 6.4pt; font-weight: 500; letter-spacing: 0.12em; text-transform: uppercase; color: #8a8879; display: block; margin-bottom: 2px;">' + raw(label) + '</span>' : '') +
        raw(bodyHtml) +
      '</div>' +
    '</div>';
  }
  function rosterGrid(list, minH, apFs, nmFs) {
    var h = '<div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 0; border: 1pt solid #17160f; break-inside: avoid;">';
    list.forEach(function (v) {
      h += '<div style="padding: ' + (minH === 34 ? '7px 10px' : '6px 10px') + '; border-right: 0.6pt solid #e0ded1; border-bottom: 0.6pt solid #e0ded1; display: flex; flex-direction: column; gap: 1px; min-height: ' + minH + 'px;">' +
        '<span style="font-family: \'Archivo\', sans-serif; font-weight: 700; font-size: ' + apFs + '; line-height: 1.15;">' + esc(v.apelido) + '</span>' +
        '<span style="font-size: ' + nmFs + '; color: #6a695e; line-height: 1.15;">' + esc(v.nome) + '</span>' +
      '</div>';
    });
    return h + '</div>';
  }

  /* ---- Documento --------------------------------------------------------- */
  function buildHTML(Draw, config) {
    var D = normalize(Draw);
    var meta = D.meta, pres = meta.presidente || {}, sec = meta.secretario || {}, red = meta.redator || {};
    var cfg = config || {};
    var minuta = !!cfg.minuta, mostrarFicha = cfg.mostrarFicha !== false, mostrarQuadro = cfg.mostrarQuadro !== false;

    var totalMaterias = D.vetos.length + D.projetos.length + D.indicacoes.length + D.requerimentos.length;
    var nApartes = 0;
    D.tribuna.forEach(function (o) { o.segmentos.forEach(function (s) { if (s.tipo === 'aparte') nApartes++; }); });

    var dpe = esc(meta.dataPorExtenso || '');
    var dropCap = dpe.charAt(0), dropRest = dpe.slice(1);

    // Secretário(a) — trata variações: "Secretário em exercício" vs "Secretária" etc.
    var secCargo = meta.secretarioCargo || 'Secretário em exercício';
    var secFem = /^Secret[áa]ria/.test(secCargo);
    var secArtigo = meta.secretarioArtigo || (secFem ? 'a Vereadora' : 'o Vereador');
    var secEmEx = meta.secretarioEmExercicio !== undefined ? meta.secretarioEmExercicio : /em exerc/i.test(secCargo);
    var secExSuf = secEmEx ? ' em exercício' : '';
    var secFecho = secFem ? 'pela Senhora Secretária' : ('pelo Senhor Secretário' + secExSuf);
    var secObjExp = secFem ? 'à Secretária' : ('ao Secretário' + secExSuf); // "solicita ___"
    // Corpo "autor — texto" com autor opcional
    var autorCorpo = function (autor, corpo) {
      return (autor ? '<strong style="font-weight: 600;">' + esc(autor) + '</strong> — ' : '') + esc(corpo);
    };

    var html = '';

    // Numeração de seções dinâmica: só numera as seções que realmente saem
    // (uma sessão sem Ordem do Dia não deixa buraco no "01, 02, 04").
    var _sec = 0;
    function nextSec() { _sec++; return _sec < 10 ? '0' + _sec : String(_sec); }
    var hasOD = (D.quorum && D.quorum.length) || (D.odGrupos && D.odGrupos.length) ||
      (D.odItems && D.odItems.length) || (D.debates && D.debates.length) ||
      (D.votacoes && D.votacoes.length) || !!D.discussao;

    /* HEADER / FOOTER */
    html +=
      '<div slot="header" style="display: flex; align-items: center; justify-content: space-between; border-bottom: 0.6pt solid #17160f; padding-bottom: 5px; font-family: \'Spline Sans Mono\', monospace; font-size: 7pt; letter-spacing: 0.06em; text-transform: uppercase; color: #45443b;">' +
        '<span style="display: flex; align-items: center; gap: 7px;">' +
          '<img src="assets/shield.png" alt="" style="height: 15px; width: auto; display: block;">' +
          '<span style="font-weight: 600; color: #17160f;">Câmara Municipal de Duque de Caxias</span>' +
        '</span>' +
        '<span>Ata · ' + esc(meta.reuniao) + ' · ' + esc(meta.dataCurta) + '</span>' +
      '</div>';
    html +=
      '<div slot="footer" style="display: flex; align-items: center; justify-content: space-between; border-top: 0.6pt solid #17160f; padding-top: 5px; font-family: \'Spline Sans Mono\', monospace; font-size: 7pt; letter-spacing: 0.05em; text-transform: uppercase; color: #45443b;">' +
        '<span>Estado do Rio de Janeiro · Poder Legislativo</span>' +
        '<span>Sessão de ' + esc(meta.dataExtenso) + '</span>' +
      '</div>';

    /* MASTHEAD */
    html +=
      '<header style="text-align: center; padding-bottom: 18px; margin-bottom: 20px; border-bottom: 2.4pt solid #17160f;">' +
        '<img src="assets/shield.png" alt="Brasão da Câmara Municipal de Duque de Caxias" style="height: 82px; width: auto; display: inline-block; margin-bottom: 12px;">' +
        '<div style="font-family: \'Spline Sans Mono\', monospace; font-size: 8.5pt; font-weight: 600; letter-spacing: 0.34em; text-transform: uppercase; color: #17160f; padding-left: 0.34em;">Câmara Municipal</div>' +
        '<div style="font-family: \'Archivo\', sans-serif; font-size: 21pt; font-weight: 800; letter-spacing: 0.02em; text-transform: uppercase; line-height: 1.05; margin-top: 3px;">Duque de Caxias</div>' +
        '<div style="font-family: \'Spline Sans Mono\', monospace; font-size: 7pt; font-weight: 500; letter-spacing: 0.22em; text-transform: uppercase; color: #6a695e; margin-top: 5px;">Estado do Rio de Janeiro · Poder Legislativo Municipal</div>' +
        '<div style="display: flex; align-items: center; justify-content: center; gap: 16px; margin: 20px auto 0; max-width: 460px;">' +
          '<span style="flex: 1; height: 0.6pt; background: #b7b5a8;"></span>' +
          '<span style="font-family: \'Archivo\', sans-serif; font-size: 46pt; font-weight: 900; letter-spacing: 0.08em; line-height: 1; text-transform: uppercase; padding-left: 0.08em;">Ata</span>' +
          '<span style="flex: 1; height: 0.6pt; background: #b7b5a8;"></span>' +
        '</div>' +
        '<div style="font-family: \'Archivo\', sans-serif; font-size: 14pt; font-weight: 600; letter-spacing: 0.01em; margin-top: 8px;">' + esc(meta.reuniao) + '</div>' +
        '<div style="font-family: \'Spline Sans Mono\', monospace; font-size: 8pt; font-weight: 500; letter-spacing: 0.14em; text-transform: uppercase; color: #6a695e; margin-top: 7px;">' + esc(meta.legislatura) + ' &nbsp;·&nbsp; ' + esc(meta.dataExtenso) + '</div>' +
      '</header>';

    /* MINUTA */
    if (minuta) {
      html += '<div style="display: flex; align-items: center; justify-content: center; gap: 12px; border: 1.4pt dashed #17160f; padding: 7px 14px; margin-bottom: 20px; font-family: \'Spline Sans Mono\', monospace; font-size: 8pt; font-weight: 600; letter-spacing: 0.22em; text-transform: uppercase;">' +
        '<span>◆</span><span>Minuta — sujeita à revisão da Mesa Diretora</span><span>◆</span></div>';
    }

    /* FICHA */
    if (mostrarFicha) {
      var fichaRow = function (dt, dd, last) {
        var bb = last ? '' : ' border-bottom: 0.6pt solid #e0ded1;';
        return '<dt style="font-family: \'Spline Sans Mono\', monospace; font-size: 7.5pt; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: #6a695e; padding: 8px 14px;' + bb + '">' + dt + '</dt>' +
               '<dd style="margin: 0; padding: 8px 14px;' + bb + '">' + dd + '</dd>';
      };
      html += '<section style="break-inside: avoid; border: 1pt solid #17160f; margin-bottom: 22px;">' +
          '<div style="background: #17160f; color: #f4f2e9; font-family: \'Spline Sans Mono\', monospace; font-size: 7.5pt; font-weight: 600; letter-spacing: 0.2em; text-transform: uppercase; padding: 6px 14px;">Ficha da Sessão</div>' +
          '<dl style="margin: 0; display: grid; grid-template-columns: 148px 1fr; gap: 0;">' +
            fichaRow('Presidência', '<strong style="font-weight: 600;">' + esc(pres.nome) + '</strong> <span style="color: #6a695e;">(' + esc(pres.apelido) + ')</span>') +
            fichaRow('SECRETARIA(O)', '<strong style="font-weight: 600;">' + esc(sec.nome) + '</strong> <span style="color: #6a695e;">(' + esc(sec.apelido) + ')' + (secEmEx ? ' — em exercício' : '') + '</span>') +
            fichaRow('Data', dpe) +
            fichaRow('Redação', esc(red.nome) + ' <span style="color: #6a695e;">— Matrícula ' + esc(red.matricula) + '</span>') +
            fichaRow('Presença', '<strong style="font-weight: 600;">' + D.chamada.length + '</strong> Vereadores à chamada regimental' + (D.quorum.length ? ' &nbsp;·&nbsp; <strong style="font-weight: 600;">' + D.quorum.length + '</strong> na verificação da Ordem do Dia' : ''), true) +
          '</dl>' +
        '</section>';
    }

    /* PREÂMBULO */
    html += '<p class="ata-just" style="margin: 0 0 12px;"><span style="font-family: \'Archivo\', sans-serif; font-weight: 800; font-size: 13pt; float: left; line-height: 0.82; margin: 4px 8px 0 0;">' + dropCap + '</span>' + dropRest + ', reuniu-se a Câmara Municipal de Duque de Caxias, sob a Presidência do Vereador <strong style="font-weight: 600;">' + esc(pres.nome) + '</strong> (' + esc(pres.apelido) + ') e secretariando os trabalhos ' + secArtigo + ' <strong style="font-weight: 600;">' + esc(sec.nome) + '</strong> (' + esc(sec.apelido) + ')' + secExSuf + '. Presentes estavam e responderam à chamada regimental os seguintes Vereadores:</p>';
    html += rosterGrid(D.chamada, 34, '8.6pt', '7.2pt');
    html += '<p class="ata-just" style="margin: 14px 0 0;">Havendo número legal, o Senhor Presidente declara aberta a sessão:</p>' +
      '<blockquote style="margin: 10px 0 0; padding: 12px 18px; border-left: 2.4pt solid #17160f; background: #efede2; font-family: \'Source Serif 4\', serif; font-style: italic; font-size: 11.5pt; line-height: 1.4;">“Sob a proteção de Deus, iniciamos os nossos trabalhos. Está aberta a sessão.”</blockquote>';

    /* EXPEDIENTE */
    html += sectionBand(nextSec(), 'Expediente Inicial', totalMaterias + ' matérias lidas');
    html += '<p class="ata-just" style="margin: 12px 0 0;">Em seguida, o Presidente solicita ' + secObjExp + ' que faça a leitura do Expediente — <em>' + esc(meta.legislatura || '') + ', ' + esc(meta.reuniao) + ' de ' + esc(meta.dataExtenso) + '</em>.</p>';

    if (D.vetos.length) {
      html += subHead('Vetos do Executivo', D.vetos.length);
      D.vetos.forEach(function (p) {
        html += chipRow(p.label, p.num, 'Chefe do Poder Executivo', esc(p.corpo),
          { colW: '118px', chipBg: '#7a2318', chipFs: '7.4pt', numFs: '7.4pt', upper: true });
      });
    }
    if (D.projetos.length) {
      html += subHead('Projetos', D.projetos.length);
      D.projetos.forEach(function (p) {
        html += chipRow(p.tag, p.num, esc(p.label), autorCorpo(p.autor, p.corpo));
      });
    }
    if (D.indicacoes.length) {
      html += subHead('Indicações', D.indicacoes.length);
      D.indicacoes.forEach(function (i) {
        html += tagRow('IND', i.num, '<strong style="font-weight: 600;">' + esc(i.autor) + '</strong> — ' + esc(i.corpo));
      });
    }
    if (D.requerimentos.length) {
      html += subHead('Requerimentos e Moções', D.requerimentos.length);
      D.requerimentos.forEach(function (r) {
        html += tagRow('REQ', r.num, '<strong style="font-weight: 600;">' + esc(r.autor) + '</strong> — ' + esc(r.corpo));
      });
    }
    html += '<p class="ata-just" style="margin: 12px 0 0; color: #45443b; font-style: italic;">' + (secFem ? 'A Secretária' : 'O Secretário' + secExSuf) + ' encerra a leitura: “Este é o Expediente, Senhor Presidente.”</p>';

    /* 02 TRIBUNA */
    if (D.tribuna.length) {
      html += sectionBand(nextSec(), 'Tribuna', D.tribuna.length + ' oradores' + (nApartes ? ' · ' + nApartes + ' apartes' : ''));
      html += '<p class="ata-just" style="margin: 12px 0 0;">Terminada a leitura do Expediente, o Presidente abriu, durante um minuto, inscrições para o uso da palavra e, em seguida, franqueou a Tribuna aos oradores inscritos, admitidos os apartes na forma regimental.</p>';

      if (nApartes) {
        html += '<div style="display: flex; align-items: stretch; gap: 0; border: 1pt solid #17160f; margin-top: 12px; break-inside: avoid;">' +
            '<div style="flex: 1; padding: 8px 12px; border-right: 0.6pt solid #e0ded1;">' +
              '<span style="font-family: \'Spline Sans Mono\', monospace; font-size: 6.4pt; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: #8a8879; display: block; margin-bottom: 3px;">Como ler esta seção</span>' +
              '<span style="font-size: 8.4pt; color: #45443b;">O texto corrido é a <strong style="font-weight: 600;">fala do orador</strong>. Os trechos recuados, à direita, são <strong style="font-weight: 600;">apartes</strong> — intervenções concedidas a outro Vereador.</span>' +
            '</div>' +
            '<div style="width: 150px; padding: 8px 12px; display: flex; align-items: center; gap: 8px;">' +
              '<span style="width: 3px; align-self: stretch; background: #7a5a1a;"></span>' +
              '<span style="font-family: \'Spline Sans Mono\', monospace; font-size: 6.6pt; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: #7a5a1a; line-height: 1.3;">Aparte<br>concedido</span>' +
            '</div>' +
          '</div>';
      }

      D.tribuna.forEach(function (s) {
        html += '<div style="margin-top: 20px;">';
        html += '<div style="display: flex; align-items: center; gap: 12px; border-bottom: 1.4pt solid #17160f; padding-bottom: 7px; margin-bottom: 9px; break-after: avoid; break-inside: avoid;">' +
            '<span style="font-family: \'Archivo\', sans-serif; font-weight: 900; font-size: 13pt; line-height: 1; border: 1.4pt solid #17160f; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">' + esc(s.n) + '</span>' +
            '<span style="flex: 1;">' +
              '<span style="font-family: \'Archivo\', sans-serif; font-weight: 700; font-size: 11pt; display: block; line-height: 1.1;">' + esc(s.nome) + '</span>' +
              '<span style="font-family: \'Spline Sans Mono\', monospace; font-size: 7.4pt; letter-spacing: 0.06em; text-transform: uppercase; color: #6a695e;">' + esc(s.apelido) + '</span>' +
            '</span>' +
            (s.papel ? '<span style="font-family: \'Spline Sans Mono\', monospace; font-size: 6.8pt; letter-spacing: 0.14em; text-transform: uppercase; color: #8a8879; text-align: right;">' + esc(s.papel) + '</span>' : '') +
          '</div>';
        s.segmentos.forEach(function (seg) {
          if (seg.tipo === 'fala') {
            html += '<p class="ata-just" style="margin: 0 0 8px;">' + esc(seg.texto) + '</p>';
          } else if (seg.tipo === 'aparte') {
            html += '<div style="margin: 4px 0 10px 28px; border-left: 3px solid #7a5a1a; background: #f2eee2; padding: 9px 14px; break-inside: avoid;">' +
                '<div style="display: flex; align-items: baseline; gap: 8px; margin-bottom: 4px;">' +
                  '<span style="font-family: \'Spline Sans Mono\', monospace; font-size: 6.4pt; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; color: #7a5a1a;">Aparte</span>' +
                  '<span style="font-family: \'Archivo\', sans-serif; font-weight: 700; font-size: 9pt; color: #17160f;">' + esc(seg.nome) + '</span>' +
                  '<span style="font-family: \'Spline Sans Mono\', monospace; font-size: 7pt; color: #6a695e;">(' + esc(seg.apelido) + ')</span>' +
                '</div>' +
                '<p class="ata-just" style="margin: 0; font-style: italic; font-size: 9.6pt; line-height: 1.45;">' + esc(seg.texto) + '</p>' +
              '</div>';
          } else if (seg.tipo === 'retoma') {
            html += '<div style="font-family: \'Spline Sans Mono\', monospace; font-size: 6.4pt; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; color: #8a8879; margin: 0 0 4px; display: flex; align-items: center; gap: 8px;">' +
                '<span style="flex: 0 0 auto;">↩ O orador retoma a palavra</span>' +
                '<span style="flex: 1; height: 0.6pt; background: #d7d4c6;"></span>' +
              '</div>' +
              '<p class="ata-just" style="margin: 0 0 8px;">' + esc(seg.texto) + '</p>';
          }
        });
        html += '</div>';
      });
    }

    /* ORDEM DO DIA (só quando a sessão tem OD: quórum, grupos, itens ou debates) */
    if (hasOD) {
      html += sectionBand(nextSec(), 'Ordem do Dia', meta.odResumo || 'Primeira Discussão dos Pareceres');
      if (D.quorum.length) {
        html += '<p class="ata-just" style="margin: 12px 0 0;">Não havendo mais oradores inscritos, o Presidente solicitou ' + secObjExp + ' a verificação de quórum. Registrou-se um total de <strong style="font-weight: 600;">' + D.quorum.length + ' Vereadores</strong> presentes, número em conformidade ao quantitativo regimental:</p>';
        html += '<div style="margin-top: 10px;">' + rosterGrid(D.quorum, 32, '8.4pt', '7pt') + '</div>';
      }

      if (D.odGrupos && D.odGrupos.length) {
        // Ordem do Dia em grupos (ex.: Vetos — Discussão Única; Pareceres — 1ª Discussão)
        html += '<p class="ata-just" style="margin: 14px 0 0;">Em seguida, procedeu-se à leitura das matérias da Ordem do Dia:</p>';
        D.odGrupos.forEach(function (g) {
          html += subHead(g.titulo, g.subtitulo || (g.items || []).length);
          (g.items || []).forEach(function (o) {
            html += chipRow(o.tag, o.num, esc(o.label), autorCorpo(o.autor, o.corpo));
          });
        });
      } else if (D.odItems.length) {
        html += '<p class="ata-just" style="margin: 14px 0 0;">' + (secFem ? 'A Secretária' : 'O Secretário' + secExSuf) + ' procedeu à leitura da Ordem do Dia <span style="color: #6a695e;">(Primeira Discussão dos Pareceres)</span>:</p>';
        D.odItems.forEach(function (o) {
          html += chipRow(o.tag, o.num, esc(o.label), autorCorpo(o.autor, o.corpo));
        });
      }
    }

    /* DEBATES / DISCUSSÃO DE MATÉRIAS (falas dos vereadores na Ordem do Dia) */
    if (D.debates && D.debates.length) {
      html += '<div style="display: flex; align-items: baseline; gap: 10px; border-bottom: 1pt solid #17160f; margin: 22px 0 4px; padding-bottom: 5px; break-after: avoid;">' +
          '<span style="font-family: \'Archivo\', sans-serif; font-weight: 700; font-size: 9pt; letter-spacing: 0.16em; text-transform: uppercase;">Discussão de Matérias</span>' +
          '<span style="margin-left: auto; font-family: \'Spline Sans Mono\', monospace; font-size: 7pt; color: #6a695e;">' + D.debates.length + '</span>' +
        '</div>';
      D.debates.forEach(function (db) {
        html += '<div style="margin-top: 12px; break-inside: avoid;">' +
            '<div style="background: #efede2; border-left: 2.4pt solid #17160f; padding: 7px 12px; margin-bottom: 8px; break-after: avoid;">' +
              '<span style="font-family: \'Spline Sans Mono\', monospace; font-size: 6.4pt; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; color: #8a8879; display: block; margin-bottom: 2px;">Matéria em discussão</span>' +
              '<span style="font-family: \'Archivo\', sans-serif; font-weight: 700; font-size: 9.6pt;">' + esc(db.materia) + '</span>' +
            '</div>';
        (db.falas || []).forEach(function (f) {
          html += '<div style="margin: 0 0 8px;">' +
              '<div style="display: flex; align-items: baseline; gap: 8px; margin-bottom: 2px;">' +
                '<span style="font-family: \'Archivo\', sans-serif; font-weight: 700; font-size: 9.4pt;">' + esc(f.nome) + '</span>' +
                (f.apelido ? '<span style="font-family: \'Spline Sans Mono\', monospace; font-size: 7pt; color: #6a695e;">(' + esc(f.apelido) + ')</span>' : '') +
                (f.papel ? '<span style="margin-left: auto; font-family: \'Spline Sans Mono\', monospace; font-size: 6.6pt; letter-spacing: 0.12em; text-transform: uppercase; color: #8a8879;">' + esc(f.papel) + '</span>' : '') +
              '</div>' +
              '<p class="ata-just" style="margin: 0;">' + esc(f.texto) + '</p>' +
            '</div>';
        });
        if (db.desfecho) {
          html += '<div style="font-family: \'Spline Sans Mono\', monospace; font-size: 7pt; font-weight: 600; letter-spacing: 0.06em; color: #17160f; border-top: 0.6pt solid #d7d4c6; padding-top: 5px; margin-bottom: 4px;">▸ ' + esc(db.desfecho) + '</div>';
        }
        html += '</div>';
      });
    }

    /* DISCUSSÃO DA MATÉRIA (data-driven) */
    if (D.discussao) {
      if (D.discussao.modo === 'box') {
        html += '<div style="margin-top: 16px; border: 1pt solid #17160f; break-inside: avoid;">' +
            '<div style="background: #17160f; color: #f4f2e9; font-family: \'Spline Sans Mono\', monospace; font-size: 7pt; font-weight: 600; letter-spacing: 0.16em; text-transform: uppercase; padding: 6px 14px;">' + esc(D.discussao.titulo || 'Discussão e Votação da Matéria') + '</div>' +
            '<div class="ata-just" style="padding: 12px 14px;">' + raw(D.discussao.html) + '</div>' +
          '</div>';
      } else {
        html += '<p class="ata-just" style="margin: 16px 0 0;">' + raw(D.discussao.html) + '</p>';
      }
    }

    /* QUADRO-RESUMO */
    if (mostrarQuadro && D.votacoes.length) {
      html += '<div style="break-inside: avoid; margin-top: 20px;">' +
          '<h3 style="font-family: \'Archivo\', sans-serif; font-weight: 700; font-size: 9pt; letter-spacing: 0.16em; text-transform: uppercase; margin: 0 0 8px; break-after: avoid;">Quadro-Resumo das Votações</h3>' +
          '<table style="width: 100%; border-collapse: collapse; font-size: 9pt; border: 1pt solid #17160f;"><thead>' +
            '<tr style="background: #17160f; color: #f4f2e9; font-family: \'Spline Sans Mono\', monospace; font-size: 7pt; letter-spacing: 0.1em; text-transform: uppercase;">' +
              '<th style="text-align: left; padding: 7px 12px; font-weight: 600;">Matéria</th>' +
              '<th style="text-align: left; padding: 7px 12px; font-weight: 600;">Deliberação</th>' +
              '<th style="text-align: left; padding: 7px 12px; font-weight: 600; white-space: nowrap;">Resultado</th>' +
            '</tr></thead><tbody>';
      D.votacoes.forEach(function (vo) {
        html += '<tr style="break-inside: avoid;">' +
            '<td style="padding: 8px 12px; border-bottom: 0.6pt solid #e0ded1; border-right: 0.6pt solid #e0ded1; font-family: \'Spline Sans Mono\', monospace; font-size: 8pt; vertical-align: top;">' + esc(vo.materia) + '</td>' +
            '<td style="padding: 8px 12px; border-bottom: 0.6pt solid #e0ded1; border-right: 0.6pt solid #e0ded1; vertical-align: top;">' + esc(vo.tipo) + '</td>' +
            '<td style="padding: 8px 12px; border-bottom: 0.6pt solid #e0ded1; vertical-align: top; font-weight: 600;">' + esc(vo.resultado) + '</td>' +
          '</tr>';
      });
      html += '</tbody></table></div>';
    }

    /* EXPEDIENTE FINAL */
    html += sectionBand(nextSec(), 'Expediente Final', 'Encerramento e lavratura');
    html += '<p class="ata-just" style="margin: 12px 0 18px;">Não havendo mais Vereador inscrito, tampouco outros assuntos a tratar, o Presidente deu por encerrada a sessão. Eu,  <strong style="font-weight: 600;">' + esc(red.nome) + '</strong>, Matrícula ' + esc(red.matricula) + ', lavrei a presente ata, que segue assinada pelo Senhor Presidente e ' + secFecho + '.</p>';

    /* ASSINATURAS */
    html += '<section style="break-inside: avoid; margin-top: 34px;">' +
        '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 56px; margin-top: 46px;">' +
          sigBlock(pres.nome, pres.apelido, 'Presidente', true) +
          sigBlock(sec.nome, sec.apelido, secCargo, true) +
        '</div>' +
        '<div style="text-align: center; margin-top: 34px;">' +
          '<div style="display: inline-block; min-width: 300px; text-align: center;">' +
            '<div style="border-top: 0.8pt solid #8a8879; padding-top: 8px;">' +
              '<div style="font-family: \'Archivo\', sans-serif; font-weight: 600; font-size: 9pt;">' + esc(red.nome) + '</div>' +
              '<div style="font-family: \'Spline Sans Mono\', monospace; font-size: 7pt; letter-spacing: 0.16em; text-transform: uppercase; color: #6a695e; margin-top: 4px;">Redator · Matrícula ' + esc(red.matricula) + '</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</section>';

    return html;
  }

  function sigBlock(nome, apelido, cargo) {
    return '<div style="text-align: center;">' +
        '<div style="border-top: 1pt solid #17160f; padding-top: 8px;">' +
          '<div style="font-family: \'Archivo\', sans-serif; font-weight: 700; font-size: 10pt;">' + esc(nome) + '</div>' +
          '<div style="font-size: 8.4pt; color: #6a695e;">' + esc(apelido) + '</div>' +
          '<div style="font-family: \'Spline Sans Mono\', monospace; font-size: 7pt; letter-spacing: 0.16em; text-transform: uppercase; margin-top: 5px;">' + esc(cargo) + '</div>' +
        '</div>' +
      '</div>';
  }

  function renderAta(page, data, config) {
    if (!page) return;
    page.innerHTML = buildHTML(data, config);
  }

  global.renderAta = renderAta;
})(typeof window !== 'undefined' ? window : this);
