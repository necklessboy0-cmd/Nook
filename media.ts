import * as MediaLibrary from 'expo-media-library/legacy';
import { Platform } from 'react-native';

export type MediaItem = {
  id: string;
  uri: string;
  filename: string;
  mediaType: 'photo' | 'video';
  width: number;
  height: number;
  /** Milliseconds. */
  creationTime: number;
  /** Seconds; 0 for photos. */
  duration: number;
};

export type MediaPage = {
  items: MediaItem[];
  hasMore: boolean;
  endCursor?: string;
};

export type PermissionState = 'granted' | 'limited' | 'denied' | 'unavailable';

function toItem(asset: MediaLibrary.Asset): MediaItem {
  return {
    id: asset.id,
    uri: asset.uri,
    filename: asset.filename,
    mediaType: asset.mediaType === 'video' ? 'video' : 'photo',
    width: asset.width,
    height: asset.height,
    creationTime: asset.creationTime,
    duration: asset.duration ?? 0,
  };
}

/** Asks for read access to the phone's photos and videos. */
export async function requestMediaPermission(): Promise<PermissionState> {
  try {
    const available = await MediaLibrary.isAvailableAsync();
    if (!available) return 'unavailable';
    const current = await MediaLibrary.getPermissionsAsync();
    if (current.granted) return current.accessPrivileges === 'limited' ? 'limited' : 'granted';
    if (!current.canAskAgain) return 'denied';
    const asked = await MediaLibrary.requestPermissionsAsync();
    if (!asked.granted) return 'denied';
    return asked.accessPrivileges === 'limited' ? 'limited' : 'granted';
  } catch {
    return 'unavailable';
  }
}

export async function getPermissionState(): Promise<PermissionState> {
  try {
    const available = await MediaLibrary.isAvailableAsync();
    if (!available) return 'unavailable';
    const current = await MediaLibrary.getPermissionsAsync();
    if (!current.granted) return current.canAskAgain ? 'denied' : 'denied';
    return current.accessPrivileges === 'limited' ? 'limited' : 'granted';
  } catch {
    return 'unavailable';
  }
}

/**
 * One page of the phone's photos and videos, newest first. `after` is the cursor from
 * the previous page.
 */
export async function loadMediaPage(after?: string, pageSize = 60): Promise<MediaPage> {
  const page = await MediaLibrary.getAssetsAsync({
    first: pageSize,
    after,
    mediaType: ['photo', 'video'],
    sortBy: [['creationTime', false]],
  });
  return {
    items: page.assets.map(toItem),
    hasMore: page.hasNextPage,
    endCursor: page.endCursor,
  };
}

/** Looks up assets by id, skipping any that no longer exist. */
export async function itemsByIds(ids: string[]): Promise<MediaItem[]> {
  const out: MediaItem[] = [];
  for (const id of ids) {
    try {
      const info = await MediaLibrary.getAssetInfoAsync(id);
      if (info) out.push(toItem(info));
    } catch {
      // Deleted from the phone since it was selected; skip it.
    }
  }
  return out;
}

/** A file:// path the app can read, share or re-encode. */
export async function localUriFor(item: MediaItem): Promise<string> {
  if (Platform.OS === 'ios' && item.uri.startsWith('ph://')) {
    const info = await MediaLibrary.getAssetInfoAsync(item.id);
    return info.localUri ?? item.uri;
  }
  if (item.uri.startsWith('content://')) {
    const info = await MediaLibrary.getAssetInfoAsync(item.id);
    return info.localUri ?? item.uri;
  }
  return item.uri;
}

/** Deletes from the phone's library. The app's own trash is separate. */
export async function deleteFromDevice(ids: string[]): Promise<boolean> {
  try {
    return await MediaLibrary.deleteAssetsAsync(ids);
  } catch {
    return false;
  }
}

/** Saves a file the app produced back into the phone's gallery. */
export async function saveToDevice(uri: string): Promise<boolean> {
  try {
    await MediaLibrary.saveToLibraryAsync(uri);
    return true;
  } catch {
    return false;
  }
}

/** Rough byte size of a media file, or null when it cannot be read. */
export async function sizeOf(item: MediaItem): Promise<number | null> {
  try {
    const info = await MediaLibrary.getAssetInfoAsync(item.id);
    const local = info.localUri;
    if (!local) return null;
    const res = await fetch(local);
    const blob = await res.blob();
    return blob.size;
  } catch {
    return null;
  }
}
