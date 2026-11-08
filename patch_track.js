const fs = require('fs');
const path = 'frontend/src/pages/PublicTrackOrder.jsx';
let content = fs.readFileSync(path, 'utf8');

const targetImport = `import { PublicTrackOrderSkeleton } from '../components/common/Skeleton';`;
const replacementImport = `import { PublicTrackOrderSkeleton } from '../components/common/Skeleton';
import { isSubscriptionEnabled } from '../services/subscriptionService';`;

const targetWatermark = `{(!order.store?.subscription?.plan || ['TRIAL', 'STARTER'].includes(order.store?.subscription?.plan)) && (`;
const replacementWatermark = `{isSubscriptionEnabled() && (!order.store?.subscription?.plan || ['TRIAL', 'STARTER'].includes(order.store?.subscription?.plan)) && (`;

const normalize = s => s.replace(/\r\n/g, '\n');
let norm = normalize(content);

if (!norm.includes(normalize(targetImport))) {
  console.error('targetImport not found');
  process.exit(1);
}
if (!norm.includes(normalize(targetWatermark))) {
  console.error('targetWatermark not found');
  process.exit(1);
}

norm = norm.replace(normalize(targetImport), normalize(replacementImport));
norm = norm.replace(normalize(targetWatermark), normalize(replacementWatermark));

fs.writeFileSync(path, norm.replace(/\n/g, '\r\n'), 'utf8');
console.log('PublicTrackOrder.jsx updated successfully!');

