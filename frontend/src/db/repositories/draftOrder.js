import { db } from '../../db.js';

const DRAFT_ID = 'current';

export const getDraftOrderQuery = () => db.draftOrder.get(DRAFT_ID);

export const updateDraftOrder = async (updates) => {
  const existing = await db.draftOrder.get(DRAFT_ID) || {};
  await db.draftOrder.put({ ...existing, id: DRAFT_ID, ...updates });
};

export const clearDraftOrder = async () => {
  await db.draftOrder.delete(DRAFT_ID);
};
