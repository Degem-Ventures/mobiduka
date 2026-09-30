export const PERMISSIONS = [
  { key: "pos", label: "Process Sales (POS)", section: "Sales" },
  { key: "discount", label: "Apply Discounts", section: "Sales" },
  { key: "void", label: "Void / Refund Sales", section: "Sales" },
  { key: "credit", label: "Record Credit Sales", section: "Sales" },
  { key: "inventory_v", label: "View Inventory", section: "Inventory" },
  { key: "inventory_e", label: "Edit / Add Products", section: "Inventory" },
  { key: "categories", label: "Manage Categories", section: "Inventory" },
  { key: "reports", label: "View Reports", section: "Reports" },
  { key: "export", label: "Export Data", section: "Reports" },
  { key: "customers", label: "Manage Customers", section: "CRM" },
  { key: "suppliers", label: "Manage Suppliers", section: "CRM" },
  { key: "expenses", label: "Record Expenses", section: "Finance" },
  { key: "credit_book", label: "View Credit Book", section: "Finance" },
  { key: "employees", label: "Manage Employees", section: "Admin" },
  { key: "register", label: "Register New Users", section: "Admin" },
  { key: "settings", label: "Change App Settings", section: "Admin" },
  { key: "payments", label: "Configure Payment Methods", section: "Admin" },
  { key: "roles", label: "Manage Roles & Permissions", section: "Admin" },
  { key: "shifts", label: "Manage Shifts", section: "Shifts" },
  { key: "shifts_v", label: "View Shift Reports", section: "Shifts" },
] as const;

export const PERMISSION_KEYS = new Set<string>(PERMISSIONS.map(permission => permission.key));

export const SYSTEM_ROLES = [
  { name: "Admin", icon: "👑", color: "#D4AF37", permissions: PERMISSIONS.map(permission => permission.key) },
  { name: "Manager", icon: "🏪", color: "#0288D1", permissions: ["pos", "discount", "inventory_v", "inventory_e", "categories", "reports", "export", "customers", "suppliers", "expenses", "credit_book", "shifts_v"] },
  { name: "Cashier", icon: "💳", color: "#2E7D32", permissions: ["pos", "discount", "credit", "customers"] },
  { name: "Supervisor", icon: "🔍", color: "#5E35B1", permissions: ["pos", "discount", "void", "inventory_v", "reports", "shifts", "shifts_v"] },
  { name: "Accountant", icon: "📊", color: "#F57C00", permissions: ["reports", "export", "expenses", "credit_book"] },
] as const;

export function canonicalRoleName(value: string) {
  const name = value.trim().toUpperCase();
  if (name === "OWNER" || name === "ADMIN") return "Admin";
  if (name === "MANAGER") return "Manager";
  if (name === "CASHIER") return "Cashier";
  if (name === "SUPERVISOR") return "Supervisor";
  if (name === "ACCOUNTANT") return "Accountant";
  return value.trim();
}

export function systemRole(name: string) {
  return SYSTEM_ROLES.find(role => role.name === canonicalRoleName(name));
}
