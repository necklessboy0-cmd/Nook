import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';
import { Video as VideoCompressor } from 'react-native-compressor';

import type { MediaItem } from './media';
import { localUriFor } from './media';

export type ResizeMode = 'longest' | 'width' | 'height' | 'percent';

export type CompressSettings = {
  /** Target size for the longest side, or the given side, in pixels. */
  targetPx: number;
  resizeMode: ResizeMode;
  /** 0.1 – 1.0. Images only. */
  quality: number;
  /** Output format for images. */
  format: 'jpeg' | 'webp' | 'png';
  /** Video bitrate in bits per second. */
  videoBitrate: number;
  /** Remove the audio track from videos. */
  stripAudio: boolean;
  /** Keep the original file's dimensions and only re-encode. */
  keepDimensions: boolean;
};

export const DEFAULT_SETTINGS: CompressSettings = {
  targetPx: 1920,
  resizeMode: 'longest',
  quality: 0.8,
  format: 'jpeg',
  videoBitrate: 4_000_000,
  stripAudio: false,
  keepDimensions: false,
};

export type CompressResult = {
  uri: string;
  width: number;
  height: number;
  bytes: number;
  /** Original size, when it could be read. */
  originalBytes: number | null;
};

/** Works out the output dimensions for an image. */
export function targetDimensions(
  width: number,
  height: number,
  settings: CompressSettings,
): { width: number; height: number } {
  if (settings.keepDimensions) return { width, height };
  const longest = Math.max(width, height);
  let scale = 1;
  if (settings.resizeMode === 'percent') {
    scale = Math.min(1, Math.max(0.05, settings.targetPx / 100));
  } else if (settings.resizeMode === 'width') {
    scale = Math.min(1, settings.targetPx / width);
  } else if (settings.resizeMode === 'height') {
    scale = Math.min(1, settings.targetPx / height);
  } else {
    scale = Math.min(1, settings.targetPx / longest);
  }
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function formatFor(format: CompressSettings['format']): SaveFormat {
  if (format === 'png') return SaveFormat.PNG;
  if (format === 'webp') return SaveFormat.WEBP;
  return SaveFormat.JPEG;
}

function sizeOfFile(uri: string): number | null {
  try {
    const file = new File(uri);
    return file.exists ? file.size : null;
  } catch {
    return null;
  }
}

/** Re-encodes one image at the chosen size and quality. */
export async function compressImage(
  item: MediaItem,
  settings: CompressSettings,
): Promise<CompressResult> {
  const source = await localUriFor(item);
  const dims = targetDimensions(item.width, item.height, settings);

  const context = ImageManipulator.manipulate(source);
  if (!settings.keepDimensions) {
    context.resize({ width: dims.width, height: dims.height });
  }
  const rendered = await context.renderAsync();
  const saved = await rendered.saveAsync({
    compress: settings.quality,
    format: formatFor(settings.format),
  });

  return {
    uri: saved.uri,
    width: saved.width,
    height: saved.height,
    bytes: sizeOfFile(saved.uri) ?? 0,
    originalBytes: sizeOfFile(source),
  };
}

/** Re-encodes one video at the chosen resolution and bitrate. */
export async function compressVideo(
  item: MediaItem,
  settings: CompressSettings,
  onProgress?: (progress: number) => void,
): Promise<CompressResult> {
  if (Platform.OS === 'web') {
    throw new Error('Video compression needs the phone app, not the web preview.');
  }
  const source = await localUriFor(item);
  const longest = Math.max(item.width, item.height);
  const maxSize = settings.keepDimensions
    ? longest
    : Math.min(longest, Math.max(240, settings.targetPx));

  const output = await VideoCompressor.compress(
    source,
    {
      compressionMethod: 'manual',
      maxSize,
      bitrate: settings.videoBitrate,
      stripAudio: settings.stripAudio,
      minimumFileSizeForCompress: 0,
    },
    onProgress,
  );

  const scale = longest > 0 ? Math.min(1, maxSize / longest) : 1;
  return {
    uri: output,
    width: Math.round(item.width * scale),
    height: Math.round(item.height * scale),
    bytes: sizeOfFile(output) ?? 0,
    originalBytes: sizeOfFile(source),
  };
}

export async function compressItem(
  item: MediaItem,
  settings: CompressSettings,
  onProgress?: (progress: number) => void,
): Promise<CompressResult> {
  return item.mediaType === 'video'
    ? compressVideo(item, settings, onProgress)
    : compressImage(item, settings);
}

/** Copies a produced file into the app's own folder so it survives cache cleanup. */
export function keepResult(uri: string, name: string): string {
  try {
    const dir = new Directory(Paths.document, 'compressed');
    if (!dir.exists) dir.create({ intermediates: true });
    const source = new File(uri);
    const target = new File(dir, name);
    if (target.exists) target.delete();
    source.copySync(target);
    return target.uri;
  } catch {
    return uri;
  }
}

/** Rough estimate of the output size, for the preview line. */
export function estimateBytes(
  item: MediaItem,
  settings: CompressSettings,
  originalBytes: number | null,
): number | null {
  if (item.mediaType === 'video') {
    if (!item.duration) return null;
    return Math.round((settings.videoBitrate / 8) * item.duration);
  }
  if (!originalBytes) return null;
  const dims = targetDimensions(item.width, item.height, settings);
  const ratio = (dims.width * dims.height) / Math.max(1, item.width * item.height);
  return Math.round(originalBytes * ratio * settings.quality);
}
