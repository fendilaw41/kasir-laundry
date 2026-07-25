import { db } from '../../db.js';

export const getChatLogQuery = () => db.chatLog.orderBy('timestamp').toArray();
