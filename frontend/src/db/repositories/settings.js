import { db } from '../../db.js';
import { withUpdatedSyncMeta } from '../syncMeta.js';
import { syncSettingsToBackend } from '../../services/syncService.js';

export const getSettingsQuery = () => db.settings.get(1);

export const updateSettings = async (data) => {
  const current = (await db.settings.get(1)) || {};
  const merged = { ...current, ...data, id: 1 };
  const result = await db.settings.put(withUpdatedSyncMeta(merged));
  
  // Trigger sync settings ke backend secara asynchronous
  syncSettingsToBackend().catch(err => console.warn('Sync settings failed:', err));

  return result;
};

