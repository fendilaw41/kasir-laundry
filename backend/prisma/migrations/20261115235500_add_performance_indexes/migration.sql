-- CreateIndex: User lookup & role filtering
CREATE INDEX IF NOT EXISTS "User_username_idx" ON "User"("username");
CREATE INDEX IF NOT EXISTS "User_storeId_role_idx" ON "User"("storeId", "role");

-- CreateIndex: Pelanggan search & sort per store
CREATE INDEX IF NOT EXISTS "Pelanggan_storeId_createdAt_idx" ON "Pelanggan"("storeId", "createdAt");
CREATE INDEX IF NOT EXISTS "Pelanggan_storeId_hp_idx" ON "Pelanggan"("storeId", "hp");
CREATE INDEX IF NOT EXISTS "Pelanggan_storeId_nama_idx" ON "Pelanggan"("storeId", "nama");

-- CreateIndex: Order public tracking, foreign keys & chronological sorting per store
CREATE INDEX IF NOT EXISTS "Order_invoiceId_idx" ON "Order"("invoiceId");
CREATE INDEX IF NOT EXISTS "Order_userId_idx" ON "Order"("userId");
CREATE INDEX IF NOT EXISTS "Order_pelangganId_idx" ON "Order"("pelangganId");
CREATE INDEX IF NOT EXISTS "Order_storeId_createdAt_idx" ON "Order"("storeId", "createdAt" DESC);

-- CreateIndex: OrderItem & Chat foreign keys for fast joins and cascade/integrity checks
CREATE INDEX IF NOT EXISTS "OrderItem_productId_idx" ON "OrderItem"("productId");
CREATE INDEX IF NOT EXISTS "Conversation_createdById_idx" ON "Conversation"("createdById");
CREATE INDEX IF NOT EXISTS "Message_senderId_idx" ON "Message"("senderId");

