"use client";

import { JSX, useState } from "react";
import LoginScreen from "./components/LoginScreen";
import Dashboard from "./components/Dashboard";
import POSScreen from "./components/POSScreen";
import InventoryScreen from "./components/InventoryScreen";
import ReportsScreen from "./components/ReportsScreen";
import CustomersScreen from "./components/CustomersScreen";
import MoreScreen from "./components/MoreScreen";
import SettingsScreen from "./components/SettingsScreen";
import PurchaseOrdersScreen from "./components/PurchaseOrdersScreen";
import SuppliersScreen from "./components/SuppliersScreen";
import CreditBookScreen from "./components/CreditBookScreen";
import ExpensesScreen from "./components/ExpensesScreen";
import EmployeesScreen from "./components/EmployeesScreen";
import NotificationsScreen from "./components/NotificationsScreen";
import BackupScreen from "./components/BackupScreen";
import UserProfileScreen from "./components/UserProfileScreen";

type Screen =
  | "login"
  | "dashboard"
  | "pos"
  | "inventory"
  | "reports"
  | "customers"
  | "more"
  | "settings"
  | "purchases"
  | "suppliers"
  | "credit"
  | "expenses"
  | "employees"
  | "notifications"
  | "backup"
  | "profile";

const navItems: {
  key: Screen;
  label: string;
  icon: (active: boolean) => JSX.Element;
}[] = [
  {
    key: "dashboard",
    label: "Dashboard",
    icon: (active) => (
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke={active ? "#123A8F" : "#9AA3B8"}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </svg>
    ),
  },
  {
    key: "pos",
    label: "POS",
    icon: (active) => (
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke={active ? "#123A8F" : "#9AA3B8"}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
        <line x1="3" y1="6" x2="21" y2="6" />
        <path d="M16 10a4 4 0 0 1-8 0" />
      </svg>
    ),
  },
  {
    key: "inventory",
    label: "Inventory",
    icon: (active) => (
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke={active ? "#123A8F" : "#9AA3B8"}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
        <polyline points="3.27,6.96 12,12.01 20.73,6.96" />
        <line x1="12" y1="22.08" x2="12" y2="12" />
      </svg>
    ),
  },
  {
    key: "customers",
    label: "Customers",
    icon: (active) => (
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke={active ? "#123A8F" : "#9AA3B8"}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    key: "more",
    label: "More",
    icon: (active) => (
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke={active ? "#123A8F" : "#9AA3B8"}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <line x1="3" y1="6" x2="21" y2="6" />
        <line x1="3" y1="12" x2="21" y2="12" />
        <line x1="3" y1="18" x2="21" y2="18" />
      </svg>
    ),
  },
];

const navScreens: Screen[] = ["dashboard", "pos", "inventory", "customers", "more"];

const showNavFor: Screen[] = ["dashboard", "pos", "inventory", "customers", "more"];

export default function Page() {
  const [screen, setScreen] = useState<Screen>("login");
  const [loggedIn, setLoggedIn] = useState(false);

  const handleLogin = () => {
    setLoggedIn(true);
    setScreen("dashboard");
  };

  const handleLogout = () => {
    setLoggedIn(false);
    setScreen("login");
  };

  const handleNavigate = (s: string) => setScreen(s as Screen);

  const activeNav = navScreens.includes(screen) ? screen : null;
  const showNav = showNavFor.includes(screen);

  const renderScreen = () => {
    switch (screen) {
      case "dashboard":
        return <Dashboard onNavigate={handleNavigate} />;
      case "pos":
        return <POSScreen onNavigate={handleNavigate} />;
      case "inventory":
        return <InventoryScreen onNavigate={handleNavigate} />;
      case "reports":
        return <ReportsScreen onNavigate={handleNavigate} />;
      case "customers":
        return <CustomersScreen onNavigate={handleNavigate} />;
      case "more":
        return <MoreScreen onLogout={handleLogout} onNavigate={handleNavigate} />;
      case "settings":
        return <SettingsScreen onNavigate={handleNavigate} />;
      case "purchases":
        return <PurchaseOrdersScreen onNavigate={handleNavigate} />;
      case "suppliers":
        return <SuppliersScreen onNavigate={handleNavigate} />;
      case "credit":
        return <CreditBookScreen onNavigate={handleNavigate} />;
      case "expenses":
        return <ExpensesScreen onNavigate={handleNavigate} />;
      case "employees":
        return <EmployeesScreen onNavigate={handleNavigate} />;
      case "notifications":
        return <NotificationsScreen onNavigate={handleNavigate} />;
      case "backup":
        return <BackupScreen onNavigate={handleNavigate} />;
      case "profile":
        return <UserProfileScreen onNavigate={handleNavigate} />;
      default:
        return null;
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #0D1B3D 0%, #123A8F 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
      }}
    >
      <div className="phone-frame">
        <div
          style={{
            position: "absolute",
            top: 0,
            left: "50%",
            transform: "translateX(-50%)",
            width: 120,
            height: 34,
            background: "#0a0a0a",
            borderRadius: "0 0 20px 20px",
            zIndex: 200,
          }}
        />

        {screen === "login" && <LoginScreen onLogin={handleLogin} />}

        {loggedIn && screen !== "login" && (
          <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
            <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>
              {renderScreen()}
            </div>

            {showNav && (
              <div className="bottom-nav">
                {navItems.map((item) => {
                  const isActive = activeNav === item.key;
                  return (
                    <button
                      key={item.key}
                      className={`bottom-nav-item btn ${isActive ? "active" : ""}`}
                      onClick={() => setScreen(item.key)}
                      style={{ position: "relative" }}
                    >
                      {item.icon(isActive)}
                      {item.key === "pos" && (
                        <div
                          style={{
                            position: "absolute",
                            top: 6,
                            right: 8,
                            width: 7,
                            height: 7,
                            borderRadius: "50%",
                            background: "#D4AF37",
                          }}
                        />
                      )}
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: isActive ? 700 : 500,
                          color: isActive ? "#123A8F" : "#9AA3B8",
                        }}
                      >
                        {item.label}
                      </span>
                      {isActive && (
                        <div
                          style={{
                            position: "absolute",
                            bottom: -4,
                            width: 20,
                            height: 3,
                            borderRadius: "2px 2px 0 0",
                            background: "#123A8F",
                          }}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      <div
        style={{
          position: "fixed",
          bottom: 24,
          left: "50%",
          transform: "translateX(-50%)",
          textAlign: "center",
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            color: "rgba(255,255,255,0.35)",
            fontSize: 12,
            fontWeight: 500,
            letterSpacing: 0.5,
          }}
        >
          MobiDuka POS · Interactive Prototype
        </div>
        <div
          style={{ color: "rgba(255,255,255,0.2)", fontSize: 11, marginTop: 2 }}
        >
          25+ screens · Android UI · Material Design 3
        </div>
      </div>
    </div>
  );
}
