import { db } from '../../db.js';
import { withUpdatedSyncMeta } from '../syncMeta.js';
import { syncSettingsToBackend } from '../../services/syncService.js';

export const getSettingsQuery = () => db.settings.get(1);

export const updateSettings = async (data) => {
  const result = await db.settings.put(withUpdatedSyncMeta({ ...data, id: 1 }));
  
  // Trigger sync settings ke backend secara asynchronous
  syncSettingsToBackend().catch(err => console.warn('Sync settings failed:', err));

  return result;
};

