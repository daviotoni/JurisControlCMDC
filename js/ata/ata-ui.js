/* =============================================================================
 * ata-ui.js — aba "Atas" do JurisControl.
 *
 * Fluxo (100% no navegador, sem servidor):
 *   Word (.docx) da empresa  ->  mammoth (texto)  ->  AtaParser (dados)
 *   ->  ata-render + doc-page dentro de um IFRAME isolado (design A4 fiel)
 *   ->  "Imprimir / Salvar PDF" (motor de impressão do navegador = PDF vetorial).
 *
 * O iframe é isolado de propósito: o doc-page injeta regras @page/print no
 * documento onde vive, então renderizar a ata fora do app evita conflito com o
 * layout do JurisControl e garante que a impressão saia só a ata, fiel.
 * =========================================================================== */
(function (global) {
  'use strict';

  var bound = false;
  var lastData = null;

  function $(sel) { return document.querySelector(sel); }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function safeFileName(meta) {
    meta = meta || {};
    var reuniao = meta.reuniao || '';
    var prefixo = /^ata\b/i.test(reuniao) ? '' : 'Ata ';
    var base = prefixo + reuniao + (meta.dataCurta ? ' ' + meta.dataCurta : '');
    base = base.replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim();
    return base || 'Ata';
  }

  // Monta o documento isolado da ata dentro do iframe, apontando a <base> para
  // js/ata/ para que fonts.css, doc-page.js, ata-render.js e assets/shield.png
  // resolvam sem precisar embutir nada.
  function renderNoIframe(iframe, data) {
    var base = new URL('js/ata/', document.baseURI).href;
    var title = esc(safeFileName(data && data.meta));
    var payload = JSON.stringify(data).replace(/</g, '\\u003c');
    var html =
      '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8">' +
      '<base href="' + base + '">' +
      '<title>' + title + '</title>' +
      '<link rel="stylesheet" href="fonts.css">' +
      '<style>html,body{margin:0;padding:0}body{background:#d9d7cd}' +
      'doc-page:not(:defined){visibility:hidden}' +
      '.ata-body{font-variant-numeric:oldstyle-nums}' +
      '.ata-just{text-align:justify;text-justify:inter-word;hyphens:auto}</style>' +
      '<script src="doc-page.js"><\/script>' +
      '<script src="ata-render.js"><\/script>' +
      '</head><body>' +
      '<doc-page size="a4" margin="16mm" class="ata-body" ' +
      'style="font-family:\'Source Serif 4\',Georgia,serif;color:#17160f;font-size:10.2pt;line-height:1.5"></doc-page>' +
      '<script>window.ATA_DATA=' + payload + ';' +
      'renderAta(document.querySelector(\'doc-page\'),window.ATA_DATA,' +
      '{minuta:false,mostrarFicha:true,mostrarQuadro:true});<\/script>' +
      '</body></html>';
    var doc = iframe.contentDocument || (iframe.contentWindow && iframe.contentWindow.document);
    if (!doc) return;
    doc.open();
    doc.write(html);
    doc.close();
  }

  function renderAvisos(warnings) {
    var box = $('#ataAvisos');
    if (!box) return;
    if (!warnings || !warnings.length) { box.style.display = 'none'; box.innerHTML = ''; return; }
    var items = warnings.map(function (w) { return '<li>' + esc(w) + '</li>'; }).join('');
    box.innerHTML =
      '<div class="ata-avisos-inner">' +
      '<strong>Confira antes de imprimir</strong>' +
      '<p>O Word da empresa é texto livre; alguns campos podem precisar de ajuste. ' +
      'A ata é montada automaticamente, mas a conferência final é humana.</p>' +
      '<ul>' + items + '</ul>' +
      '</div>';
    box.style.display = 'block';
  }

  function showResult(data, warnings, filename) {
    lastData = data;
    var nameEl = $('#ataFileName');
    if (nameEl) nameEl.textContent = filename || '';
    renderAvisos(warnings);
    var wrap = $('#ataPreviewWrap');
    var iframe = $('#ataPreview');
    if (wrap) wrap.style.display = 'block';
    if (iframe) renderNoIframe(iframe, data);
    var tb = $('#ataToolbar');
    if (tb) tb.style.display = 'flex';
  }

  function fail(msg) {
    var box = $('#ataAvisos');
    if (box) {
      box.innerHTML = '<div class="ata-avisos-inner ata-erro"><strong>Não consegui processar</strong><p>' + esc(msg) + '</p></div>';
      box.style.display = 'block';
    }
  }

  function handleFile(file) {
    if (!file) return;
    if (!/\.docx$/i.test(file.name)) { fail('Envie um arquivo .docx (o Word da sessão).'); return; }
    if (typeof mammoth === 'undefined') { fail('Biblioteca de leitura de Word (mammoth) não carregou.'); return; }
    if (!global.AtaParser) { fail('Motor de leitura da ata não carregou.'); return; }
    var nameEl = $('#ataFileName');
    if (nameEl) nameEl.textContent = 'Lendo ' + file.name + '…';
    var reader = new FileReader();
    reader.onload = function (ev) {
      mammoth.extractRawText({ arrayBuffer: ev.target.result })
        .then(function (res) {
          var out;
          try {
            out = global.AtaParser.parseFromText(res.value);
          } catch (e) {
            fail('Erro ao interpretar o texto da ata: ' + (e && e.message ? e.message : e));
            return;
          }
          showResult(out.data, out.warnings, file.name);
        })
        .catch(function (e) {
          fail('Não consegui ler este Word: ' + (e && e.message ? e.message : e));
        });
    };
    reader.onerror = function () { fail('Falha ao ler o arquivo.'); };
    reader.readAsArrayBuffer(file);
  }

  function imprimir() {
    var iframe = $('#ataPreview');
    if (!iframe || !iframe.contentWindow) return;
    try {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    } catch (e) {
      // fallback: imprime a página (raro)
      window.print();
    }
  }

  function limpar() {
    lastData = null;
    var f = $('#ataFile'); if (f) f.value = '';
    var nameEl = $('#ataFileName'); if (nameEl) nameEl.textContent = '';
    var box = $('#ataAvisos'); if (box) { box.style.display = 'none'; box.innerHTML = ''; }
    var tb = $('#ataToolbar'); if (tb) tb.style.display = 'none';
    var wrap = $('#ataPreviewWrap'); if (wrap) wrap.style.display = 'none';
    var iframe = $('#ataPreview');
    if (iframe) { var d = iframe.contentDocument; if (d) { d.open(); d.write(''); d.close(); } }
  }

  // Carrega o exemplo (dados reais de 16/06) sob demanda, para não pesar o load.
  function verExemplo() {
    var nameEl = $('#ataFileName');
    function go() {
      if (global.ATA_EXEMPLO_16) {
        showResult(global.ATA_EXEMPLO_16, [], 'Exemplo — 4ª Reunião Ordinária (16.06.2026)');
      } else {
        fail('Não consegui carregar o exemplo.');
      }
    }
    if (global.ATA_EXEMPLO_16) { go(); return; }
    if (nameEl) nameEl.textContent = 'Carregando exemplo…';
    var s = document.createElement('script');
    s.src = 'js/ata/exemplo-16-06.js?v=20260705-atas';
    s.onload = go;
    s.onerror = function () { fail('Não consegui carregar o exemplo.'); };
    document.head.appendChild(s);
  }

  function onShow() {
    if (bound) return;
    bound = true;
    var input = $('#ataFile');
    if (input) input.addEventListener('change', function (e) {
      var f = e.target.files && e.target.files[0];
      handleFile(f);
    });
    var ex = $('#ataExemplo'); if (ex) ex.addEventListener('click', verExemplo);
    var pr = $('#ataImprimir'); if (pr) pr.addEventListener('click', imprimir);
    var lp = $('#ataLimpar'); if (lp) lp.addEventListener('click', limpar);
  }

  global.AtaUI = { onShow: onShow, imprimir: imprimir, limpar: limpar };
})(typeof window !== 'undefined' ? window : this);
