"use client";

import React, { JSX, useState } from "react";
import { ThemeProvider, useTheme } from "./context/ThemeContext";
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
import SmartScanScreen from "./components/SmartScanScreen";
import ActiveSessionsScreen from "./components/ActiveSessionsScreen";
import TwoFactorScreen from "./components/TwoFactorScreen";

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
  | "profile"
  | "scan"
  | "sessions"
  | "twofa";

type SideNavItem = {
  key: Screen;
  label: string;
  // icon: (active: boolean) => React.ReactElement;
  icon: (active: boolean) => JSX.Element;

};

const leftNavItems: SideNavItem[] = [
  {
    key: "dashboard",
    label: "Home",
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
];

const rightNavItems: SideNavItem[] = [
  {
    key: "inventory",
    label: "Stock",
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

const showNavFor: Screen[] = [
  "dashboard",
  "pos",
  "inventory",
  "customers",
  "more",
  "scan",
];

function AppInner() {
  const { isDark } = useTheme();
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
        return (
          <MoreScreen onLogout={handleLogout} onNavigate={handleNavigate} />
        );
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
      case "scan":
        return <SmartScanScreen onNavigate={handleNavigate} />;
      case "sessions":
        return <ActiveSessionsScreen onNavigate={handleNavigate} />;
      case "twofa":
        return <TwoFactorScreen onNavigate={handleNavigate} />;
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
      {/* Phone frame */}
      <div className="phone-frame" data-theme={isDark ? "dark" : "light"}>
        {/* Notch */}
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
          <div
            style={{ height: "100%", display: "flex", flexDirection: "column" }}
          >
            <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>
              {renderScreen()}
            </div>

            {showNav && (
              <div
                className="bottom-nav"
                style={{ position: "relative", overflow: "visible" }}
              >
                {leftNavItems.map((item) => {
                  const isActive = screen === item.key;
                  return (
                    <button
                      key={item.key}
                      className={`bottom-nav-item btn ${isActive ? "active" : ""}`}
                      onClick={() => setScreen(item.key)}
                      style={{ position: "relative" }}
                    >
                      {item.icon(isActive)}
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

                {/* Centre SCAN FAB */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    position: "relative",
                    marginTop: -22,
                  }}
                >
                  <button
                    className="btn"
                    onClick={() => setScreen("scan")}
                    style={{
                      width: 58,
                      height: 58,
                      borderRadius: "50%",
                      background:
                        screen === "scan"
                          ? "linear-gradient(135deg, #D4AF37 0%, #F0D060 100%)"
                          : "linear-gradient(135deg, #123A8F 0%, #1A4FBF 100%)",
                      border: "3px solid white",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                      boxShadow: "0 4px 20px rgba(18,58,143,0.45)",
                      transition: "all 0.2s",
                    }}
                  >
                    <svg
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="white"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M3 7V5a2 2 0 0 1 2-2h2" />
                      <path d="M17 3h2a2 2 0 0 1 2 2v2" />
                      <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
                      <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
                      <line x1="7" y1="12" x2="17" y2="12" />
                    </svg>
                  </button>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: screen === "scan" ? 700 : 600,
                      color: screen === "scan" ? "#D4AF37" : "#123A8F",
                      marginTop: 3,
                    }}
                  >
                    SCAN
                  </span>
                </div>

                {rightNavItems.map((item) => {
                  const isActive = screen === item.key;
                  return (
                    <button
                      key={item.key}
                      className={`bottom-nav-item btn ${isActive ? "active" : ""}`}
                      onClick={() => setScreen(item.key)}
                      style={{ position: "relative" }}
                    >
                      {item.icon(isActive)}
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

      {/* App info */}
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

export default function App() {
  return (
    <ThemeProvider>
      <AppInner />
    </ThemeProvider>
  );
}
