import { planCatalog } from '../plans/plan-catalog'

export { planCatalog }

export type MarketingIconName = 'arrow' | 'check' | 'menu' | 'close' | 'scan' | 'stock' | 'mpesa' | 'offline' | 'report' | 'team' | 'shield' | 'printer' | 'sun' | 'moon' | 'monitor'

export const industryPhotos = [
  'https://images.unsplash.com/photo-1762232621825-a719d413537c?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=80&w=900',
  'https://images.unsplash.com/photo-1701241284338-823f1c5aa943?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=80&w=900',
  'https://images.unsplash.com/photo-1696861308115-54a5e5a134b0?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=80&w=900',
  'https://images.unsplash.com/photo-1607240204413-e51a4afa6f12?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=80&w=900',
  'https://images.unsplash.com/photo-1677058272033-6fc5a7c5aef1?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=80&w=900',
  'https://images.unsplash.com/photo-1781579239593-c76d875c55cd?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=80&w=900',
]

export const faqItems = [
  ['What is MobiDuka POS?', 'MobiDuka is a retail management platform that brings sales, stock, expenses, staff workflows and business reporting into one practical system.'],
  ['Which businesses can use it?', 'It is designed for dukas, kiosks, mini-markets, pharmacies, agrovets, convenience stores and growing retail chains.'],
  ['Does it support offline workflows?', 'Supported retail workflows can continue during connectivity interruptions, with queued records synchronizing when connectivity returns.'],
  ['Does it support M-PESA?', 'MobiDuka supports M-PESA configuration and payment-status workflows. Availability depends on the merchant’s approved Daraja setup.'],
  ['Can I scan barcodes and print receipts?', 'Yes. SmartScan supports compatible barcode workflows, and receipts can be printed using compatible Bluetooth thermal printers.'],
  ['Is there an Android app?', 'An Android APK distribution option is planned. The download button will be connected when an approved distribution URL is available.'],
  ['Is the iOS app available?', 'The iOS experience is in preparation. Contact the MobiDuka team for current availability.'],
  ['What packages are offered?', 'Basic, Growth and Enterprise packages are planned. Public prices and final entitlements remain editable until commercially approved.'],
]

export const marketingNavItems = ['features', 'how-it-works', 'app-screens', 'packages', 'industries', 'faq']

export const benefitItems: { icon: MarketingIconName; label: string }[] = [
  { icon: 'offline', label: 'Offline-first workflows' },
  { icon: 'mpesa', label: 'M-PESA payment status' },
  { icon: 'stock', label: 'Inventory visibility' },
  { icon: 'scan', label: 'SmartScan barcode tools' },
  { icon: 'printer', label: 'Bluetooth receipts' },
  { icon: 'report', label: 'Business insights' },
]

export const featureItems: { icon: MarketingIconName; title: string; description: string }[] = [
  { icon: 'offline', title: 'Keep Serving Customers When Connectivity Drops.', description: 'Supported offline workflows continue during interruptions and synchronize queued records when the connection returns.' },
  { icon: 'stock', title: 'Know What Is Selling. Know What Needs Restocking.', description: 'Monitor product quantities, low-stock warnings, adjustments, suppliers and purchase-order workflows.' },
  { icon: 'mpesa', title: 'Bring Sales and Payment Status Together.', description: 'Follow supported payment progression from initiation to customer prompt and confirmation response.' },
  { icon: 'scan', title: 'Find Products Faster With SmartScan.', description: 'Use compatible barcode workflows to identify products and add them to a sale with fewer steps.' },
  { icon: 'printer', title: 'Professional Receipts, Straight From Your Phone.', description: 'Connect compatible Bluetooth thermal printers and provide customers with clear receipts.' },
  { icon: 'report', title: 'See More Than Your Daily Sales.', description: 'Review revenue, cost of goods, expenses, inventory valuation, trends and profitability.' },
  { icon: 'team', title: 'Give Your Team the Right Access.', description: 'Assign business owners, supervisors, cashiers and accountants the permissions they need.' },
  { icon: 'shield', title: 'Business Access and Data Protection in Mind.', description: 'Use business-scoped operations, role permissions and protected handling of integration credentials.' },
]

export const industryItems = [
  { name: 'Dukas and kiosks', description: 'Keep sales and stock organized without slowing down the counter.' },
  { name: 'Mini-markets', description: 'Keep sales and stock organized without slowing down the counter.' },
  { name: 'Pharmacies and chemists', description: 'Track specialized products, stock movement and staff activity.' },
  { name: 'Agrovets', description: 'Track specialized products, stock movement and staff activity.' },
  { name: 'Convenience stores', description: 'Build consistent retail operations with room to expand.' },
  { name: 'Growing retail chains', description: 'Build consistent retail operations with room to expand.' },
]

export const onboardingSteps = [
  { number: '01', title: 'Set Up Your Business', description: 'Create an account and configure products, staff and business settings.' },
  { number: '02', title: 'Start Selling', description: 'Record sales, manage stock and use supported payment workflows.' },
  { number: '03', title: 'Understand Your Business', description: 'Review reports, expenses, inventory and profitability.' },
]

export const securityItems = [
  'Business-scoped access',
  'Role-based permissions',
  'Secure employee PIN hashes',
  'Tenant-scoped operations',
  'Protected M-PESA credential handling',
]

export const footerGroups = [
  { title: 'Product', links: ['Features', 'Android app', 'iOS availability', 'Web dashboard'] },
  { title: 'Company', links: ['Packages', 'Contact', 'Support', 'System status'] },
  { title: 'Legal', links: ['Privacy Policy', 'Terms of Service', 'API documentation'] },
]
