import { useSyncExternalStore } from 'react';
import { load, subscribe, type SaveData } from '../storage/storage';

export function useSave(): SaveData {
  return useSyncExternalStore(subscribe, load, load);
}
