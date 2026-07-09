// Parsing puro de dataURL (ex.: "data:application/pdf;base64,JVBER...").
// Extraído do files.ts para poder ser testado sem depender do expo (que só
// existe em runtime nativo). Espelha o base64ToArrayBuffer/getMimeType do web.

export interface ParsedDataUrl {
  /** Conteúdo após a vírgula (base64). Se não houver vírgula, a string toda. */
  base64: string;
  /** MIME declarado no cabeçalho do dataURL, ou undefined se ausente. */
  mime: string | undefined;
}

export function parseDataUrl(dataUrl: string): ParsedDataUrl {
  const comma = dataUrl.indexOf(',');
  const base64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  const mime = /^data:([^;]+);/.exec(dataUrl)?.[1];
  return { base64, mime };
}
