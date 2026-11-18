import { DEFAULT_APPEARANCE, type Appearance } from '@/constants/theme';
import { usePersistentState } from '@/hooks/use-persistent-state';

import type { MediaItem } from './media';

/** A media item the app has kept a reference to (favourite, vault, trash). */
export type SavedItem = MediaItem & { savedAt: number };

export type Folder = {
  id: string;
  name: string;
  createdAt: number;
  items: SavedItem[];
};

export type TrashEntry = SavedItem & {
  deletedAt: number;
  /** Purged automatically after this moment. */
  expiresAt: number;
  /** Where it came from, shown in the trash list. */
  from: string;
};

export type VaultEntry = SavedItem & { addedAt: number };

/** Days a deleted item stays in the trash before it is purged. */
export const TRASH_DAYS = 30;

export function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function toSaved(item: MediaItem): SavedItem {
  return { ...item, savedAt: Date.now() };
}

/** Appearance settings, shared by every screen. */
export function useAppearance() {
  return usePersistentState<Appearance>('appearance', DEFAULT_APPEARANCE);
}

/** Favourite folders. */
export function useFolders() {
  return usePersistentState<Folder[]>('folders', []);
}

/** Recently deleted items, newest first. */
export function useTrash() {
  return usePersistentState<TrashEntry[]>('trash', []);
}

/** The hidden vault. */
export function useVault() {
  return usePersistentState<VaultEntry[]>('vault', []);
}

/** Ids the user has favourited, so the front grid can leave them out. */
export function favouritedIds(folders: Folder[]): Set<string> {
  const ids = new Set<string>();
  for (const folder of folders) {
    for (const item of folder.items) ids.add(item.id);
  }
  return ids;
}

/** Drops trash entries whose 30 days are up. */
export function purgeExpired(entries: TrashEntry[]): TrashEntry[] {
  const now = Date.now();
  return entries.filter((entry) => entry.expiresAt > now);
}
