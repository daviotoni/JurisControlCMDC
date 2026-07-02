// Variante WEB: download via Blob + <a download>, como o sistema desktop.

export async function saveAndShare(
  filename: string,
  content: string,
  opts: { base64?: boolean; mimeType?: string } = {}
): Promise<void> {
  let blob: Blob;
  if (opts.base64) {
    const bin = atob(content);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    blob = new Blob([bytes], { type: opts.mimeType || 'application/octet-stream' });
  } else {
    blob = new Blob([content], { type: opts.mimeType || 'text/plain;charset=utf-8' });
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function shareDataUrl(filename: string, dataUrl: string): Promise<void> {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/** Lê um arquivo escolhido pelo DocumentPicker como texto. */
export async function readFileAsText(uri: string): Promise<string> {
  const res = await fetch(uri);
  return res.text();
}

/** Lê um arquivo escolhido pelo DocumentPicker como dataURL base64. */
export async function readFileAsDataUrl(uri: string, _mime: string): Promise<string> {
  const res = await fetch(uri);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = () => reject(fr.error);
    fr.readAsDataURL(blob);
  });
}
