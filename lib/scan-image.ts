import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { Platform } from 'react-native';

const MAX_SIDE = 2048;
const MAX_BYTES = 10 * 1024 * 1024;

/** Create a separate JPEG for upload; never write to the selected original. */
export async function prepareScanImage(uri: string) {
  const context = ImageManipulator.manipulate(uri, { maxWidth: MAX_SIDE, maxHeight: MAX_SIDE });
  let outputUri: string | undefined;
  const release = () => {
    if (!outputUri || outputUri === uri) return;
    try {
      if (Platform.OS === 'web') {
        if (outputUri.startsWith('blob:')) URL.revokeObjectURL(outputUri);
      } else {
        const file = new File(outputUri);
        if (file.exists) file.delete();
      }
    } catch { /* cache cleanup is best effort */ }
    outputUri = undefined;
  };
  try {
    const original = await context.renderAsync();
    const { width, height } = original;
    original.release();
    if (width > MAX_SIDE || height > MAX_SIDE) {
      context.resize(width >= height ? { width: MAX_SIDE, height: null } : { width: null, height: MAX_SIDE });
    }
    const rendered = await context.renderAsync();
    try {
      const result = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.85 });
      outputUri = result.uri;
      if (result.width > MAX_SIDE || result.height > MAX_SIDE || result.uri === uri) {
        throw new Error('Foto tidak dapat diproses dengan aman.');
      }
      const size = Platform.OS === 'web'
        ? (await (await fetch(result.uri)).blob()).size
        : new File(result.uri).size;
      if (!Number.isFinite(size) || size <= 0 || size > MAX_BYTES) {
        throw new Error('Foto hasil pemrosesan melebihi 10 MB atau tidak dapat dibaca.');
      }
      return { uri: result.uri, mimeType: 'image/jpeg', release };
    } finally {
      rendered.release();
    }
  } catch (error) {
    release();
    throw error;
  } finally {
    context.release();
  }
}
