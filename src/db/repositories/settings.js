import { db } from '../../db.js';

export const getSettingsQuery = () => db.settings.get(1);

export const updateSettings = async (data) => {
  return await db.settings.put({ ...data, id: 1 });
};
