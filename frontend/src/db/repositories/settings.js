import { db } from '../../db.js';
import { withUpdatedSyncMeta } from '../syncMeta.js';

export const getSettingsQuery = () => db.settings.get(1);

export const updateSettings = async (data) => {
  return await db.settings.put(withUpdatedSyncMeta({ ...data, id: 1 }));
};
