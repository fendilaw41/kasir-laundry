// Helper untuk melengkapi record baru/updated dengan metadata sync (uuid, updatedAt).
// Dipakai di semua repository supaya konsisten dan gampang dipakai backend NestJS/Prisma nanti.

export const withNewSyncMeta = (data) => ({
  ...data,
  uuid: crypto.randomUUID(),
  updatedAt: new Date(),
  isDirty: 1,
});

export const withUpdatedSyncMeta = (data) => ({
  ...data,
  updatedAt: new Date(),
  isDirty: 1,
});
