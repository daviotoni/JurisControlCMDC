// Download/compartilhamento de arquivos no mobile (substitui o <a download>
// do web). Usa a API legada do expo-file-system por simplicidade.
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

/** Grava conteúdo num arquivo temporário e abre a folha de compartilhar. */
export async function saveAndShare(
  filename: string,
  content: string,
  opts: { base64?: boolean; mimeType?: string } = {}
): Promise<void> {
  const dir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
  if (!dir) throw new Error('Sem diretório de escrita disponível.');
  const uri = dir + filename;
  await FileSystem.writeAsStringAsync(uri, content, {
    encoding: opts.base64 ? FileSystem.EncodingType.Base64 : FileSystem.EncodingType.UTF8,
  });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: opts.mimeType, dialogTitle: filename });
  }
}

/** Compartilha um dataURL (modelos .docx e arquivos de lei do Firestore). */
export async function shareDataUrl(filename: string, dataUrl: string): Promise<void> {
  const comma = dataUrl.indexOf(',');
  const base64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  const mime = /^data:([^;]+);/.exec(dataUrl)?.[1];
  await saveAndShare(filename, base64, { base64: true, mimeType: mime });
}

/** Lê um arquivo escolhido pelo DocumentPicker como texto. */
export async function readFileAsText(uri: string): Promise<string> {
  return FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.UTF8 });
}

/** Lê um arquivo escolhido pelo DocumentPicker como dataURL base64. */
export async function readFileAsDataUrl(uri: string, mime: string): Promise<string> {
  const b64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
  return `data:${mime};base64,${b64}`;
}
