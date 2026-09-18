export const recentScans = [
  { barcode: '6001234500012', name: 'Unga Jogoo 2kg', time: '14:28', status: 'found', emoji: '🌾' },
  { barcode: '6001234500034', name: 'Cooking Oil 1L', time: '14:15', status: 'found', emoji: '🫙' },
  { barcode: '9876543210123', name: 'Unknown Product', time: '13:52', status: 'unknown', emoji: '❓' },
  { barcode: '6001234500056', name: 'Blue Band 500g', time: '13:40', status: 'found', emoji: '🧈' },
] as const

export const stats = [
  { label: "Today's Sales", value: 'KSh 84,250', sub: '+12% vs yesterday', color: '#123A8F', icon: '📈', bg: 'linear-gradient(135deg, #123A8F 0%, #1A4FBF 100%)' },
  { label: "Today's Profit", value: 'KSh 22,100', sub: '26.2% margin', color: '#2E7D32', icon: '💰', bg: 'linear-gradient(135deg, #2E7D32 0%, #388E3C 100%)' },
  { label: 'Cash in Till', value: 'KSh 45,800', sub: 'Last count: 2h ago', color: '#D4AF37', icon: '💵', bg: 'linear-gradient(135deg, #D4AF37 0%, #F0D060 100%)' },
  { label: 'M-Pesa Sales', value: 'KSh 38,450', sub: '47 transactions', color: '#00A651', icon: '📱', bg: 'linear-gradient(135deg, #005F2E 0%, #00A651 100%)' },
] as const

export const quickStats = [
  { label: 'Credit Out', value: 'KSh 12,300', sub: '8 customers', icon: '🔴' },
  { label: 'Stock Value', value: 'KSh 312,000', sub: '486 SKUs', icon: '📦' },
  { label: 'Low Stock', value: '12 items', sub: 'Need reorder', icon: '⚠️' },
  { label: 'Transactions', value: '156', sub: 'Today', icon: '🧾' },
] as const

export const topProducts = [
  { name: 'Unga Jogoo 2kg', sold: 42, revenue: 'KSh 8,400', change: '+8%' },
  { name: 'Cooking Oil 1L', sold: 38, revenue: 'KSh 7,220', change: '+15%' },
  { name: 'Sugar 1kg', sold: 35, revenue: 'KSh 4,900', change: '-3%' },
  { name: 'Blue Band 500g', sold: 29, revenue: 'KSh 4,350', change: '+5%' },
  { name: 'Milk 500ml', sold: 27, revenue: 'KSh 2,700', change: '+22%' },
] as const

export const recentTransactions = [
  { time: '14:32', customer: 'Walk-in', amount: 'KSh 1,250', method: 'Cash', items: 5 },
  { time: '14:18', customer: 'Jane Mwangi', amount: 'KSh 3,400', method: 'M-Pesa', items: 8 },
  { time: '13:55', customer: 'Walk-in', amount: 'KSh 650', method: 'Cash', items: 2 },
  { time: '13:41', customer: 'Peter Otieno', amount: 'KSh 5,200', method: 'Credit', items: 14 },
] as const

