export type DemoNotification = {
  type: "critical" | "warning" | "success" | "info";
  title: string;
  message: string;
  createdAt: string;
  isRead: boolean;
};

export const demoNotifications: DemoNotification[] = [
  { type: "critical", title: "Critical Stock Alert", message: "Panadol 500mg has only 3 units remaining. Reorder level is 50 units.", createdAt: "2026-09-20T14:30:00.000Z", isRead: false },
  { type: "warning", title: "Low Stock Warning", message: "Royco 75g is running low (5 units). Consider placing a purchase order.", createdAt: "2026-09-20T13:55:00.000Z", isRead: false },
  { type: "success", title: "Daily Sales Target Achieved", message: "Today's sales of KSh 84,250 exceeded the daily target of KSh 70,000.", createdAt: "2026-09-20T13:00:00.000Z", isRead: false },
  { type: "info", title: "New Purchase Order Received", message: "PO-2026-083 from Bidco Africa has been marked as delivered. 4 items received.", createdAt: "2026-09-20T11:20:00.000Z", isRead: true },
  { type: "warning", title: "Credit Account Overdue", message: "Grace Achieng's credit balance of KSh 9,600 is overdue by 5 days.", createdAt: "2026-09-20T09:00:00.000Z", isRead: true },
  { type: "info", title: "Backup Completed", message: "Your data has been successfully backed up to the cloud. All records are safe.", createdAt: "2026-09-20T06:00:00.000Z", isRead: true },
  { type: "success", title: "New Customer Registered", message: "Grace Achieng has been added as a new customer to your database.", createdAt: "2026-09-19T15:30:00.000Z", isRead: true },
  { type: "info", title: "Monthly Report Available", message: "Your June 2026 monthly sales and profit report is ready to view.", createdAt: "2026-09-19T07:00:00.000Z", isRead: true },
  { type: "warning", title: "Low Cash in Till", message: "Cash in till is below KSh 20,000. Consider topping up or depositing excess.", createdAt: "2026-07-06T16:00:00.000Z", isRead: true },
  { type: "critical", title: "Expired Product Alert", message: "Dawa Product Batch #DW2209 is approaching expiry in 7 days. Check pharmacy stock.", createdAt: "2026-07-06T10:00:00.000Z", isRead: true },
];