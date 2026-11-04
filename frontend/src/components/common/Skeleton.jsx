import React from 'react';

/**
 * Base atomic Skeleton element
 */
export const Skeleton = ({
  width = '100%',
  height = '14px',
  borderRadius = '8px',
  circle = false,
  className = '',
  style = {},
}) => {
  return (
    <span
      className={`skeleton-box ${circle ? 'skeleton-circle' : ''} ${className}`}
      style={{
        width,
        height,
        borderRadius: circle ? '50%' : borderRadius,
        ...style,
      }}
    />
  );
};

/**
 * Product Card Grid Skeleton (for Product page)
 */
export const ProductListSkeleton = ({ count = 6 }) => {
  return (
    <div className="row g-2">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="col-6">
          <div className="card h-100 border-0 shadow-sm rounded-4 overflow-hidden p-2 skeleton-card">
            <Skeleton height="110px" borderRadius="12px" className="w-100 mb-2" />
            <div className="p-1">
              <Skeleton width="45%" height="10px" className="mb-2" />
              <Skeleton width="80%" height="14px" className="mb-2" />
              <Skeleton width="60%" height="16px" className="mb-3" />
              <Skeleton height="32px" borderRadius="20px" className="w-100" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

/**
 * Order List Skeleton (for DataOrder & Home orders)
 */
export const OrderListSkeleton = ({ count = 3 }) => {
  return (
    <div className="d-flex flex-column gap-3">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="card shadow-sm border-0 p-3 skeleton-card">
          <div className="d-flex justify-content-between align-items-center mb-2">
            <div className="d-flex align-items-center gap-2">
              <Skeleton width="80px" height="14px" />
              <Skeleton width="50px" height="12px" borderRadius="10px" />
            </div>
            <Skeleton width="90px" height="12px" />
          </div>
          <div className="d-flex justify-content-between align-items-center mb-2">
            <Skeleton width="120px" height="16px" />
            <Skeleton width="70px" height="16px" />
          </div>
          <div className="d-flex justify-content-between align-items-center mb-3">
            <Skeleton width="70px" height="12px" />
            <Skeleton width="80px" height="12px" />
          </div>
          <div className="d-flex gap-2 mb-3">
            <Skeleton width="60px" height="18px" borderRadius="12px" />
            <Skeleton width="75px" height="18px" borderRadius="12px" />
          </div>
          <div className="row g-2">
            <div className="col-4">
              <Skeleton height="30px" borderRadius="8px" className="w-100" />
            </div>
            <div className="col-4">
              <Skeleton height="30px" borderRadius="8px" className="w-100" />
            </div>
            <div className="col-4">
              <Skeleton height="30px" borderRadius="8px" className="w-100" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

/**
 * Order Detail Skeleton (for OrderDetail page)
 */
export const OrderDetailSkeleton = () => {
  return (
    <div className="order-detail-skeleton pb-5">
      {/* Top Header Card */}
      <div className="card border-0 shadow-sm mb-3 p-3 skeleton-card">
        <div className="d-flex justify-content-between align-items-center mb-2">
          <Skeleton width="100px" height="18px" />
          <Skeleton width="70px" height="22px" borderRadius="12px" />
        </div>
        <div className="d-flex justify-content-between align-items-center">
          <Skeleton width="130px" height="12px" />
          <Skeleton width="80px" height="12px" />
        </div>
      </div>

      {/* Stepper Status Skeleton */}
      <div className="card border-0 shadow-sm mb-3 p-3 skeleton-card">
        <div className="row g-2">
          <div className="col-3">
            <Skeleton height="50px" borderRadius="12px" className="w-100" />
          </div>
          <div className="col-3">
            <Skeleton height="50px" borderRadius="12px" className="w-100" />
          </div>
          <div className="col-3">
            <Skeleton height="50px" borderRadius="12px" className="w-100" />
          </div>
          <div className="col-3">
            <Skeleton height="50px" borderRadius="12px" className="w-100" />
          </div>
        </div>
      </div>

      {/* Customer Info Card */}
      <div className="card border-0 shadow-sm mb-3 p-3 skeleton-card">
        <div className="d-flex align-items-center gap-3">
          <Skeleton width="48px" height="48px" circle />
          <div className="flex-grow-1">
            <Skeleton width="120px" height="16px" className="mb-2" />
            <Skeleton width="90px" height="12px" />
          </div>
        </div>
      </div>

      {/* Items List Card */}
      <div className="card border-0 shadow-sm mb-3 p-3 skeleton-card">
        <Skeleton width="90px" height="14px" className="mb-3" />
        <div className="d-flex justify-content-between align-items-center mb-2">
          <Skeleton width="140px" height="14px" />
          <Skeleton width="60px" height="14px" />
        </div>
        <div className="d-flex justify-content-between align-items-center mb-3">
          <Skeleton width="110px" height="14px" />
          <Skeleton width="50px" height="14px" />
        </div>
        <hr className="my-2 opacity-25" />
        <div className="d-flex justify-content-between align-items-center mt-2">
          <Skeleton width="70px" height="16px" />
          <Skeleton width="90px" height="18px" />
        </div>
      </div>

      {/* Action Buttons */}
      <div className="row g-2">
        <div className="col-6">
          <Skeleton height="45px" borderRadius="12px" className="w-100" />
        </div>
        <div className="col-6">
          <Skeleton height="45px" borderRadius="12px" className="w-100" />
        </div>
        <div className="col-12 mt-2">
          <Skeleton height="45px" borderRadius="12px" className="w-100" />
        </div>
      </div>
    </div>
  );
};

/**
 * Setting Skeleton (for Setting page)
 */
export const SettingSkeleton = () => {
  return (
    <div className="setting-skeleton pb-5">
      <span className="visually-hidden">Memuat data pengaturan...</span>
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <Skeleton width="100px" height="20px" className="mb-1" />
          <Skeleton width="140px" height="12px" />
        </div>
        <Skeleton width="80px" height="24px" borderRadius="20px" />
      </div>

      {/* Segmented Tabs */}
      <div className="card border-0 shadow-sm mb-4 p-1 rounded-pill skeleton-card">
        <div className="d-flex gap-1">
          <Skeleton height="36px" borderRadius="20px" className="flex-fill" />
          <Skeleton height="36px" borderRadius="20px" className="flex-fill" />
          <Skeleton height="36px" borderRadius="20px" className="flex-fill" />
          <Skeleton height="36px" borderRadius="20px" className="flex-fill" />
        </div>
      </div>

      {/* Profile / Setting Form Card */}
      <div className="card border-0 shadow-sm p-4 skeleton-card">
        <div className="d-flex align-items-center gap-3 mb-4">
          <Skeleton width="54px" height="54px" circle />
          <div className="flex-grow-1">
            <Skeleton width="130px" height="16px" className="mb-2" />
            <Skeleton width="90px" height="12px" />
          </div>
        </div>

        <div className="mb-3">
          <Skeleton width="80px" height="12px" className="mb-2" />
          <Skeleton height="40px" borderRadius="10px" className="w-100" />
        </div>

        <div className="mb-3">
          <Skeleton width="100px" height="12px" className="mb-2" />
          <Skeleton height="40px" borderRadius="10px" className="w-100" />
        </div>

        <div className="mb-4">
          <Skeleton width="70px" height="12px" className="mb-2" />
          <Skeleton height="70px" borderRadius="10px" className="w-100" />
        </div>

        <Skeleton height="44px" borderRadius="24px" className="w-100" />
      </div>
    </div>
  );
};

/**
 * Public Track Order Skeleton (for PublicTrackOrder page)
 */
export const PublicTrackOrderSkeleton = () => {
  return (
    <div className="public-track-page py-4">
      <span className="visually-hidden">Memuat Data Pesanan...</span>
      <div className="container" style={{ maxWidth: '520px' }}>
        {/* Store Card Header */}
        <div className="card border-0 shadow-sm rounded-4 p-3 mb-3 text-center skeleton-card">
          <Skeleton width="48px" height="48px" circle className="mx-auto mb-2" />
          <Skeleton width="160px" height="18px" className="mx-auto mb-1" />
          <Skeleton width="220px" height="12px" className="mx-auto" />
        </div>

        {/* Invoice & Status Stepper Card */}
        <div className="card border-0 shadow-sm rounded-4 p-4 mb-3 skeleton-card">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <Skeleton width="110px" height="20px" />
            <Skeleton width="70px" height="22px" borderRadius="12px" />
          </div>
          <Skeleton height="10px" borderRadius="5px" className="w-100 mb-4" />
          <div className="d-flex justify-content-between">
            <Skeleton width="60px" height="12px" />
            <Skeleton width="60px" height="12px" />
            <Skeleton width="60px" height="12px" />
            <Skeleton width="60px" height="12px" />
          </div>
        </div>

        {/* Order Items Card */}
        <div className="card border-0 shadow-sm rounded-4 p-3 mb-3 skeleton-card">
          <Skeleton width="120px" height="14px" className="mb-3" />
          <div className="d-flex justify-content-between align-items-center mb-2">
            <Skeleton width="140px" height="14px" />
            <Skeleton width="70px" height="14px" />
          </div>
          <div className="d-flex justify-content-between align-items-center mb-3">
            <Skeleton width="120px" height="14px" />
            <Skeleton width="60px" height="14px" />
          </div>
          <hr className="my-2 opacity-25" />
          <div className="d-flex justify-content-between align-items-center mt-2">
            <Skeleton width="60px" height="16px" />
            <Skeleton width="80px" height="18px" />
          </div>
        </div>

        {/* CTA Contact Button */}
        <Skeleton height="46px" borderRadius="24px" className="w-100" />
      </div>
    </div>
  );
};

/**
 * Customer List Skeleton (for Home customer modal & Transaksi modal)
 */
export const CustomerListSkeleton = ({ count = 4 }) => {
  return (
    <div className="d-flex flex-column gap-2">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="card border-0 rounded-4 shadow-sm p-3 skeleton-card">
          <div className="d-flex align-items-center">
            <Skeleton width="46px" height="46px" circle className="me-3" />
            <div className="flex-grow-1">
              <Skeleton width="130px" height="15px" className="mb-2" />
              <Skeleton width="90px" height="12px" />
            </div>
            <Skeleton width="32px" height="32px" circle />
          </div>
        </div>
      ))}
    </div>
  );
};

/**
 * Inventory List Skeleton (for Home inventory modal & Transaksi scroller)
 */
export const InventoryListSkeleton = ({ count = 4 }) => {
  return (
    <div className="d-flex flex-column gap-2">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="card border-0 rounded-4 shadow-sm p-3 skeleton-card">
          <div className="d-flex justify-content-between align-items-center">
            <div className="d-flex align-items-center">
              <Skeleton width="42px" height="42px" borderRadius="12px" className="me-3" />
              <div>
                <Skeleton width="110px" height="14px" className="mb-2" />
                <Skeleton width="65px" height="12px" borderRadius="10px" />
              </div>
            </div>
            <Skeleton width="60px" height="28px" borderRadius="14px" />
          </div>
        </div>
      ))}
    </div>
  );
};

/**
 * Transaction List Skeleton (for Reports page)
 */
export const TransactionListSkeleton = ({ count = 4 }) => {
  return (
    <div className="d-flex flex-column gap-2">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="card border-0 shadow-sm p-3 skeleton-card">
          <div className="d-flex justify-content-between align-items-center mb-2">
            <Skeleton width="110px" height="14px" />
            <Skeleton width="70px" height="14px" />
          </div>
          <div className="d-flex justify-content-between align-items-center">
            <Skeleton width="140px" height="12px" />
            <Skeleton width="60px" height="18px" borderRadius="10px" />
          </div>
        </div>
      ))}
    </div>
  );
};

/**
 * Chat Messages Skeleton (for ChatRoom)
 */
export const ChatMessagesSkeleton = ({ count = 4 }) => {
  return (
    <div className="d-flex flex-column gap-3 p-3">
      {Array.from({ length: count }).map((_, index) => {
        const isMe = index % 2 === 1;
        return (
          <div
            key={index}
            className={`d-flex ${isMe ? 'justify-content-end' : 'justify-content-start'}`}
          >
            <div style={{ maxWidth: '70%', width: isMe ? '220px' : '200px' }}>
              <Skeleton
                height={index % 3 === 0 ? '60px' : '40px'}
                borderRadius="16px"
                className="w-100 mb-1"
              />
              <div className={`d-flex ${isMe ? 'justify-content-end' : 'justify-content-start'}`}>
                <Skeleton width="40px" height="10px" />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

/**
 * Contact List Skeleton (for NewChatModal)
 */
export const ContactListSkeleton = ({ count = 4 }) => {
  return (
    <div className="d-flex flex-column gap-2">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="d-flex align-items-center gap-3 p-2 border-0 rounded-3">
          <Skeleton width="40px" height="40px" circle />
          <div className="flex-grow-1">
            <Skeleton width="120px" height="14px" className="mb-2" />
            <Skeleton width="80px" height="11px" />
          </div>
        </div>
      ))}
    </div>
  );
};

export default Skeleton;

