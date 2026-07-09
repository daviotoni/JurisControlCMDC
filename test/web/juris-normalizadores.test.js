// Testes dos normalizadores da Cloud Function `juris` (functions/normalizadores.js).
// São funções puras: recebem a resposta crua da fonte (LexML XML / Datajud JSON)
// e devolvem o formato único consumido pelo painel de jurisprudência.
import { describe, expect, it } from 'vitest';
import {
  extrairTags,
  formatarNumeroCNJ,
  normalizarDatajud,
  normalizarLexml,
  tribunalDaUrn,
} from '../../functions/normalizadores.js';

const XML_LEXML = `<?xml version="1.0" encoding="UTF-8"?>
<srw:searchRetrieveResponse xmlns:srw="http://www.loc.gov/zing/srw/">
  <srw:numberOfRecords>2</srw:numberOfRecords>
  <srw:records>
    <srw:record>
      <srw:recordData>
        <srw_dc:dc xmlns:srw_dc="info:srw/schema/1/dc-schema" xmlns:dc="http://purl.org/dc/elements/1.1/">
          <dc:title>Recurso Extraordin&#225;rio 123456</dc:title>
          <dc:date>2019-05-20</dc:date>
          <dc:type>Jurisprud&#234;ncia</dc:type>
          <dc:description>EMENTA: Dispensa de licita&#231;&#227;o. Requisitos. &lt;destaque&gt;</dc:description>
          <urn>urn:lex:br:supremo.tribunal.federal:acordao:2019-05-20;re-123456</urn>
        </srw_dc:dc>
      </srw:recordData>
    </srw:record>
    <srw:record>
      <srw:recordData>
        <srw_dc:dc xmlns:dc="http://purl.org/dc/elements/1.1/">
          <dc:title>Recurso Especial 98765 &amp; agravo</dc:title>
          <dc:date>2021-03-11</dc:date>
          <urn>urn:lex:br:superior.tribunal.justica:acordao:2021;resp-98765</urn>
        </srw_dc:dc>
      </srw:recordData>
    </srw:record>
  </srw:records>
</srw:searchRetrieveResponse>`;

describe('normalizarLexml', () => {
  it('extrai título, data, descrição, tribunal e monta a URL da URN', () => {
    const r = normalizarLexml(XML_LEXML);
    expect(r).toHaveLength(2);
    expect(r[0]).toMatchObject({
      fonte: 'lexml',
      titulo: 'Recurso Extraordinário 123456',
      tribunal: 'STF',
      data: '2019-05-20',
      classe: 'Jurisprudência',
    });
    expect(r[0].ementa).toContain('Dispensa de licitação');
    expect(r[0].url).toBe('https://www.lexml.gov.br/urn/urn:lex:br:supremo.tribunal.federal:acordao:2019-05-20;re-123456');
    // Entidades XML decodificadas (&amp; → &) e tribunal deduzido da URN
    expect(r[1].titulo).toBe('Recurso Especial 98765 & agravo');
    expect(r[1].tribunal).toBe('STJ');
  });

  it('não lança com entradas inesperadas', () => {
    expect(normalizarLexml('')).toEqual([]);
    expect(normalizarLexml('<xml>quebrado')).toEqual([]);
    expect(normalizarLexml(null)).toEqual([]);
    expect(normalizarLexml('<srw:records><srw:record><x/></srw:record></srw:records>')).toEqual([]);
  });
});

describe('normalizarDatajud', () => {
  const RESPOSTA = {
    hits: {
      hits: [
        {
          _source: {
            numeroProcesso: '00029349820188190064',
            classe: { codigo: 198, nome: 'Apelação Cível' },
            orgaoJulgador: { nome: 'Sétima Câmara de Direito Público' },
            tribunal: 'TJRJ',
            dataAjuizamento: '2018-02-15T00:00:00.000Z',
            assuntos: [{ codigo: 1, nome: 'Improbidade Administrativa' }, { codigo: 2, nome: 'Dispensa de Licitação' }],
          },
        },
        { _source: {} }, // hit sem número é descartado... (numero vazio → formatar devolve '')
      ],
    },
  };

  it('normaliza número CNJ, classe, tribunal e assuntos', () => {
    const r = normalizarDatajud(RESPOSTA, 'tjrj');
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({
      fonte: 'datajud',
      numero: '0002934-98.2018.8.19.0064',
      classe: 'Apelação Cível',
      tribunal: 'TJRJ',
      data: '2018-02-15',
    });
    expect(r[0].titulo).toBe('Apelação Cível 0002934-98.2018.8.19.0064');
    expect(r[0].ementa).toContain('Dispensa de Licitação');
  });

  it('não lança com entradas inesperadas', () => {
    expect(normalizarDatajud(null, 'tjrj')).toEqual([]);
    expect(normalizarDatajud({}, 'tjrj')).toEqual([]);
    expect(normalizarDatajud({ hits: { hits: 'x' } }, 'tjrj')).toEqual([]);
  });
});

describe('auxiliares', () => {
  it('formatarNumeroCNJ aplica a máscara NNNNNNN-DD.AAAA.J.TR.OOOO', () => {
    expect(formatarNumeroCNJ('00029349820188190064')).toBe('0002934-98.2018.8.19.0064');
    expect(formatarNumeroCNJ('0002934-98.2018.8.19.0064')).toBe('0002934-98.2018.8.19.0064');
    expect(formatarNumeroCNJ('123')).toBe('123'); // curto demais: devolve como veio
    expect(formatarNumeroCNJ(undefined)).toBe('');
  });

  it('extrairTags aceita tags com e sem prefixo de namespace', () => {
    expect(extrairTags('<dc:title>A</dc:title><title>B</title>', 'title')).toEqual(['A', 'B']);
  });

  it('tribunalDaUrn deduz a sigla', () => {
    expect(tribunalDaUrn('urn:lex:br:superior.tribunal.justica:x')).toBe('STJ');
    expect(tribunalDaUrn('urn:lex:br:camara.municipal:x')).toBe('');
  });
});
