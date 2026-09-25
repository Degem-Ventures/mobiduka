"use client";

import { JSX, useEffect, useState } from "react";
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
import AdminRegisterScreen from "./components/AdminRegisterScreen";
import ShiftsScreen from "./components/ShiftsScreen";
import PaymentMethodsScreen from "./components/PaymentMethodsScreen";
import { apiFetch, clearClientSession, clearLastScreen, getClientSession, getLastScreen, saveLastScreen } from "../lib/client-api";

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
  | "twofa"
  | "register"
  | "shifts"
  | "payments";

type SideNavItem = {
  key: Screen;
  label: string;
  icon: (active: boolean) => JSX.Element;
};

const leftNavItems: SideNavItem[] = [
  {
    key: "dashboard",
    label: "Home",
    icon: () => (
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
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
    icon: () => (
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M5 8h14l-1 12H6L5 8Z" />
        <path d="M9 9V6a3 3 0 0 1 6 0v3" />
      </svg>
    ),
  },
];

const rightNavItems: SideNavItem[] = [
  {
    key: "inventory",
    label: "Stock",
    icon: () => (
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="m4 7 8-4 8 4-8 4-8-4Z" />
        <path d="M4 7v10l8 4 8-4V7" />
        <path d="M12 11v10" />
      </svg>
    ),
  },
  {
    key: "more",
    label: "More",
    icon: () => (
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
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
  const [isHydratingSession, setIsHydratingSession] = useState(true);
  const [activeShiftCount, setActiveShiftCount] = useState(0);
  const [activeShiftNames, setActiveShiftNames] = useState<string[]>([]);
  const [inventoryBarcode, setInventoryBarcode] = useState<string | undefined>();
  const [inventoryProductId, setInventoryProductId] = useState<string | undefined>();
  const [posCartItem, setPosCartItem] = useState<{ id: string; name: string; price: number; emoji: string } | undefined>();

  useEffect(() => {
    const session = getClientSession();
    const tokenParts = session?.token.split(".");
    let sessionIsValid = Boolean(session);
    if (session && tokenParts?.[1]) {
      try {
        const claims = JSON.parse(atob(tokenParts[1].replace(/-/g, "+").replace(/_/g, "/"))) as { exp?: number };
        sessionIsValid = typeof claims.exp !== "number" || claims.exp > Date.now() / 1000;
      } catch {
        sessionIsValid = false;
      }
    }
    if (sessionIsValid) {
      const savedScreen = getLastScreen() as Screen | null;
      const restoredScreen = savedScreen && savedScreen !== "login" ? savedScreen : "dashboard";
      setLoggedIn(true);
      setScreen(restoredScreen);
    } else {
      clearClientSession();
      clearLastScreen();
    }
    setIsHydratingSession(false);
  }, []);

  useEffect(() => {
    const handleAuthExpired = () => {
      setLoggedIn(false);
      setScreen("login");
    };
    window.addEventListener("mobiduka-auth-expired", handleAuthExpired);
    return () => window.removeEventListener("mobiduka-auth-expired", handleAuthExpired);
  }, []);

  useEffect(() => {
    if (!loggedIn) {
      setActiveShiftCount(0);
      setActiveShiftNames([]);
      return;
    }

    let cancelled = false;
    const loadActiveShifts = async () => {
      const clientSession = getClientSession();
      if (!clientSession) return;
      try {
        const response = await apiFetch<{
          sessions: Array<{ closedAt: string | null; cashier: { fullName: string; role: { name: string } | null } | null }>;
        }>(`/api/cash/session?businessId=${encodeURIComponent(clientSession.user.businessId)}`);
        if (cancelled) return;
        const active = response.sessions.filter((session) =>
          !session.closedAt &&
          ['CASHIER', 'SUPERVISOR'].includes(session.cashier?.role?.name?.toUpperCase() ?? ''),
        );
        setActiveShiftCount(active.length);
        setActiveShiftNames(active.map((session) => session.cashier?.fullName ?? "Unassigned"));
      } catch {
        if (!cancelled) {
          setActiveShiftCount(0);
          setActiveShiftNames([]);
        }
      }
    };

    void loadActiveShifts();
    const refreshTimer = window.setInterval(() => void loadActiveShifts(), 30000);
    window.addEventListener('mobiduka:shift-changed', loadActiveShifts);
    return () => {
      cancelled = true;
      window.clearInterval(refreshTimer);
      window.removeEventListener('mobiduka:shift-changed', loadActiveShifts);
    };
  }, [loggedIn, screen]);

  const handleLogin = () => {
    setLoggedIn(true);
    setScreen("dashboard");
    saveLastScreen("dashboard");
  };

  const handleLogout = () => {
    clearClientSession();
    clearLastScreen();
    setLoggedIn(false);
    setScreen("login");
  };

  const handleNavigate = (s: string, options?: { barcode?: string; productId?: string; cartItem?: { id: string; name: string; price: number; emoji: string } }) => {
    const nextScreen = s as Screen;
    setInventoryBarcode(nextScreen === "inventory" ? options?.barcode : undefined);
    setInventoryProductId(nextScreen === "inventory" ? options?.productId : undefined);
    setPosCartItem(nextScreen === "pos" ? options?.cartItem : undefined);
    setScreen(nextScreen);
    if (nextScreen !== "login") saveLastScreen(nextScreen);
  };

  const showNav = showNavFor.includes(screen);
  const navActiveColor = isDark ? "#8FB3FF" : "#123A8F";
  const navInactiveColor = isDark ? "#A8B8D8" : "#6B7A99";

  const renderScreen = () => {
    switch (screen) {
      case "dashboard":
        return <Dashboard onNavigate={handleNavigate} />;
      case "pos":
        return <POSScreen onNavigate={handleNavigate} initialCartItem={posCartItem} />;
      case "inventory":
        return <InventoryScreen onNavigate={handleNavigate} initialBarcode={inventoryBarcode} initialProductId={inventoryProductId} />;
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
      case "register":
        return <AdminRegisterScreen onNavigate={handleNavigate} />;
      case "shifts":
        return <ShiftsScreen onNavigate={handleNavigate} />;
      case "payments":
        return <PaymentMethodsScreen onNavigate={handleNavigate} />;
      default:
        return null;
    }
  };

  if (isHydratingSession) return null;

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
            {activeShiftCount > 0 && (
              <button
                className="btn"
                onClick={() => handleNavigate("shifts")}
                style={{
                  width: "100%",
                  border: "none",
                  borderBottom: "1px solid rgba(46,125,50,0.2)",
                  background: isDark ? "#17351E" : "#E8F5E9",
                  color: isDark ? "#A5D6A7" : "#2E7D32",
                  padding: "9px 16px",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  textAlign: "left",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                <span style={{ fontSize: 14 }}>●</span>
                <span style={{ flex: 1 }}>
                  {activeShiftCount} shift{activeShiftCount === 1 ? "" : "s"} in progress
                  {activeShiftNames.length > 0 ? ` · ${activeShiftNames.join(", ")}` : ""}
                </span>
                <span>Manage ›</span>
              </button>
            )}
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
                      onClick={() => handleNavigate(item.key)}
                      style={{
                        position: "relative",
                        color: isActive ? navActiveColor : navInactiveColor,
                      }}
                    >
                      {item.icon(isActive)}
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: isActive ? 700 : 500,
                          color: "inherit",
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
                            background: navActiveColor,
                          }}
                        />
                      )}
                    </button>
                  );
                })}

                {/* Centre SCAN FAB — absolute so it doesn't shrink adjacent slots */}
                {/* <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    position: "relative",
                    marginTop: -22,
                  }}
                > */}
                  <div
                  style={{
                    position: "relative",
                    width: 64,
                    flexShrink: 0,
                    alignSelf: "stretch",
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      left: "50%",
                      transform: "translateX(-50%)",
                      bottom: 4,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      zIndex: 10,
                    }}
                  >
                  <button
                    className="btn"
                    onClick={() => handleNavigate("scan")}
                    style={{
                      width: 58,
                      height: 58,
                      borderRadius: "50%",
                      background:
                        screen === "scan"
                          ? "linear-gradient(135deg, #D4AF37 0%, #F0D060 100%)"
                          : "linear-gradient(135deg, #123A8F 0%, #1A4FBF 100%)",
                      border: `3px solid ${isDark ? "#0F2040" : "white"}`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                      boxShadow: "0 4px 20px rgba(18,58,143,0.45)",
                      transition: "all 0.2s",
                    }}
                  >
                    <svg
                      width="22"
                      height="22"
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
                      color: screen === "scan" ? "#F0D060" : navActiveColor,
                      marginTop: 3,
                    }}
                  >
                    SCAN
                  </span>
                </div>
                </div>

                {rightNavItems.map((item) => {
                  const isActive = screen === item.key;
                  return (
                    <button
                      key={item.key}
                      className={`bottom-nav-item btn ${isActive ? "active" : ""}`}
                      onClick={() => handleNavigate(item.key)}
                      style={{
                        position: "relative",
                        color: isActive ? navActiveColor : navInactiveColor,
                      }}
                    >
                      {item.icon(isActive)}
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: isActive ? 700 : 500,
                          color: "inherit",
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
                            background: navActiveColor,
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
