// Testes dos helpers de arquivo do web (js/utils.js): decodificação base64 e
// detecção de MIME por extensão. Usados no download de modelos/anexos.
import utils from '../../js/utils.js';

const { base64ToArrayBuffer, getMimeType } = utils;

// "Hello" em base64 = SGVsbG8=
const bytesOf = (buf) => Array.from(new Uint8Array(buf));

describe('base64ToArrayBuffer', () => {
  it('decodifica o trecho após a vírgula de um dataURL', () => {
    const buf = base64ToArrayBuffer('data:text/plain;base64,SGVsbG8=');
    expect(bytesOf(buf)).toEqual([72, 101, 108, 108, 111]); // H e l l o
  });

  it('retorna buffer vazio para entrada sem vírgula (base64 cru)', () => {
    // A função sempre usa split(',')[1]; sem vírgula isso vira undefined e falha.
    const buf = base64ToArrayBuffer('SGVsbG8=');
    expect(buf.byteLength).toBe(0);
  });

  it('retorna buffer vazio para base64 inválido (não lança)', () => {
    const buf = base64ToArrayBuffer('data:x;base64,@@@nao-e-base64@@@');
    expect(buf.byteLength).toBe(0);
  });
});

describe('getMimeType', () => {
  it('.doc → msword', () => {
    expect(getMimeType('parecer.doc')).toBe('application/msword');
  });

  it('.pdf → pdf', () => {
    expect(getMimeType('processo.pdf')).toBe('application/pdf');
  });

  it('é insensível a maiúsculas na extensão', () => {
    expect(getMimeType('DOCUMENTO.PDF')).toBe('application/pdf');
  });

  it('extensão desconhecida ou ausente → fallback .docx', () => {
    const docx = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    expect(getMimeType('modelo.docx')).toBe(docx);
    expect(getMimeType('modelo.xyz')).toBe(docx);
    expect(getMimeType('semextensao')).toBe(docx);
  });

  it('usa a última extensão em nomes com vários pontos', () => {
    expect(getMimeType('arquivo.v2.final.pdf')).toBe('application/pdf');
  });
});
