// Testes do parsing puro de dataURL (mobile/src/lib/dataurl.ts), usado pelo
// compartilhamento de modelos .docx e arquivos de lei no app.
import { parseDataUrl } from '../../mobile/src/lib/dataurl';

describe('parseDataUrl', () => {
  it('separa o MIME e o base64 de um dataURL completo', () => {
    const { base64, mime } = parseDataUrl('data:application/pdf;base64,JVBERi0x');
    expect(mime).toBe('application/pdf');
    expect(base64).toBe('JVBERi0x');
  });

  it('reconhece outro MIME (png)', () => {
    expect(parseDataUrl('data:image/png;base64,iVBORw0KGgo').mime).toBe('image/png');
  });

  it('sem vírgula: devolve a string inteira como base64 e mime undefined', () => {
    const { base64, mime } = parseDataUrl('JVBERi0xLjc= ');
    expect(base64).toBe('JVBERi0xLjc= ');
    expect(mime).toBeUndefined();
  });

  it('sem MIME no cabeçalho: mime undefined, base64 preservado', () => {
    const { base64, mime } = parseDataUrl('data:;base64,YWJj');
    expect(mime).toBeUndefined();
    expect(base64).toBe('YWJj');
  });

  it('preserva vírgulas internas do payload (usa só a primeira)', () => {
    const { base64 } = parseDataUrl('data:text/plain;base64,YQ==,ZXh0cmE=');
    expect(base64).toBe('YQ==,ZXh0cmE=');
  });
});
