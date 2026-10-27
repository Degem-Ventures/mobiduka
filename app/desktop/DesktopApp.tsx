import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { ThemeProvider, useTheme } from '../context/ThemeContext'
import { useColors } from '../utils/theme'
import {
  clearClientSession,
  clearLastScreen,
  getClientSession,
  getLastScreen,
  saveLastScreen,
  type ClientSession,
} from '../../lib/client-api'
import { fetchCachedCollection, isNativeOfflineApp } from '../../lib/offline-store'
import LoginScreen from '../components/LoginScreen'
import Dashboard from '../components/Dashboard'
import POSScreen from '../components/POSScreen'
import InventoryScreen from '../components/InventoryScreen'
import ReportsScreen from '../components/ReportsScreen'
import CustomersScreen from '../components/CustomersScreen'
import MoreScreen from '../components/MoreScreen'
import SettingsScreen from '../components/SettingsScreen'
import PurchaseOrdersScreen from '../components/PurchaseOrdersScreen'
import SuppliersScreen from '../components/SuppliersScreen'
import CreditBookScreen from '../components/CreditBookScreen'
import ExpensesScreen from '../components/ExpensesScreen'
import EmployeesScreen from '../components/EmployeesScreen'
import NotificationsScreen from '../components/NotificationsScreen'
import BackupScreen from '../components/BackupScreen'
import UserProfileScreen from '../components/UserProfileScreen'
import SmartScanScreen from '../components/SmartScanScreen'
import ActiveSessionsScreen from '../components/ActiveSessionsScreen'
import TwoFactorScreen from '../components/TwoFactorScreen'
import AdminRegisterScreen from '../components/AdminRegisterScreen'
import ShiftsScreen from '../components/ShiftsScreen'
import PaymentMethodsScreen from '../components/PaymentMethodsScreen'
import ManageRolesScreen from '../components/ManageRolesScreen'
import ReceiptSettingsScreen from '../components/ReceiptSettingsScreen'
import TaxComplianceScreen from '../components/TaxComplianceScreen'
import OfflineSyncWorker from '../components/OfflineSyncWorker'
import AutomaticBackupWorker from '../components/AutomaticBackupWorker'
import SubscriptionRequiredToast from '../components/SubscriptionRequiredToast'
import './desktop.css'

type Screen =
  | 'dashboard' | 'pos' | 'inventory' | 'reports' | 'customers' | 'more'
  | 'settings' | 'purchases' | 'suppliers' | 'credit' | 'expenses'
  | 'employees' | 'notifications' | 'backup' | 'profile' | 'scan'
  | 'sessions' | 'twofa' | 'register' | 'shifts' | 'payments'
  | 'roles' | 'receiptsettings' | 'taxcompliance'

type IconName =
  | 'grid' | 'cart' | 'scan' | 'chart' | 'box' | 'truck' | 'clipboard'
  | 'wallet' | 'users' | 'user' | 'clock' | 'shield' | 'card' | 'receipt'
  | 'tax' | 'cloud' | 'bell' | 'settings' | 'dots' | 'search' | 'panel'
  | 'sun' | 'moon' | 'chevron' | 'logout' | 'store'

type NavItem = { key: Screen; label: string; icon: IconName; badge?: string }
type NavGroup = { label: string; items: NavItem[] }

const navGroups: NavGroup[] = [
  { label: 'Workspace', items: [
    { key: 'dashboard', label: 'Overview', icon: 'grid' },
    { key: 'pos', label: 'Point of Sale', icon: 'cart' },
    { key: 'scan', label: 'SmartScan', icon: 'scan' },
    { key: 'reports', label: 'Reports', icon: 'chart' },
  ]},
  { label: 'Commerce', items: [
    { key: 'inventory', label: 'Inventory', icon: 'box' },
    { key: 'purchases', label: 'Purchase Orders', icon: 'clipboard' },
    { key: 'suppliers', label: 'Suppliers', icon: 'truck' },
    { key: 'customers', label: 'Customers', icon: 'users' },
    { key: 'credit', label: 'Credit Book', icon: 'receipt' },
    { key: 'expenses', label: 'Expenses', icon: 'wallet' },
  ]},
  { label: 'Team & operations', items: [
    { key: 'employees', label: 'Employees', icon: 'users' },
    { key: 'register', label: 'Register Admin', icon: 'user' },
    { key: 'roles', label: 'Roles & Access', icon: 'shield' },
    { key: 'shifts', label: 'Shifts', icon: 'clock' },
  ]},
  { label: 'Store administration', items: [
    { key: 'payments', label: 'Payment Methods', icon: 'card' },
    { key: 'receiptsettings', label: 'Receipt Settings', icon: 'receipt' },
    { key: 'taxcompliance', label: 'Tax Compliance', icon: 'tax' },
    { key: 'backup', label: 'Backup & Sync', icon: 'cloud' },
    { key: 'notifications', label: 'Notifications', icon: 'bell' },
    { key: 'settings', label: 'Settings', icon: 'settings' },
    { key: 'profile', label: 'User Profile', icon: 'user' },
    { key: 'sessions', label: 'Active Sessions', icon: 'shield' },
    { key: 'twofa', label: 'Two-factor Auth', icon: 'shield' },
    { key: 'more', label: 'More', icon: 'dots' },
  ]},
]

const screenTitles = Object.fromEntries(
  navGroups.flatMap(group => group.items.map(item => [item.key, item.label])),
) as Record<Screen, string>

function Icon({ name, size = 19 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, ReactNode> = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></>,
    cart: <><circle cx="9" cy="20" r="1"/><circle cx="19" cy="20" r="1"/><path d="M3 4h2l2.6 10.4a2 2 0 0 0 2 1.6h7.8a2 2 0 0 0 2-1.6L21 8H6"/></>,
    scan: <><path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M7 12h10"/></>,
    chart: <><path d="M4 19V9M10 19V5M16 19v-7M22 19H2"/></>,
    box: <><path d="m21 8-9 5-9-5 9-5 9 5Z"/><path d="m3 8 9 5 9-5v8l-9 5-9-5V8Z"/></>,
    truck: <><path d="M3 6h11v11H3zM14 10h4l3 3v4h-7z"/><circle cx="7" cy="19" r="2"/><circle cx="18" cy="19" r="2"/></>,
    clipboard: <><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V2h6v2M9 9h6M9 13h6M9 17h4"/></>,
    wallet: <><path d="M4 6h15a2 2 0 0 1 2 2v10H4a2 2 0 0 1-2-2V6a3 3 0 0 1 3-3h13"/><path d="M16 11h5v4h-5a2 2 0 0 1 0-4Z"/></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/></>,
    user: <><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    shield: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/></>,
    card: <><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h4"/></>,
    receipt: <><path d="M6 2h12v20l-3-2-3 2-3-2-3 2V2Z"/><path d="M9 7h6M9 11h6M9 15h4"/></>,
    tax: <><path d="M4 3h16v18H4zM8 8h8M8 12h3M8 16h3M15 12v4"/></>,
    cloud: <><path d="M17.5 19H7a5 5 0 1 1 1-9.9A7 7 0 0 1 21 12a4 4 0 0 1-3.5 7Z"/><path d="m9 14 3-3 3 3M12 11v7"/></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M14 21h-4"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"/></>,
    dots: <><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></>,
    search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
    panel: <><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/></>,
    sun: <><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></>,
    moon: <path d="M20 15.5A8 8 0 0 1 8.5 4 8.5 8.5 0 1 0 20 15.5Z"/>,
    chevron: <path d="m9 18 6-6-6-6"/>,
    logout: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></>,
    store: <><path d="M3 9h18l-2-6H5L3 9Z"/><path d="M5 9v12h14V9M9 21v-7h6v7"/></>,
  }
  return <svg className="desktop-icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}

function DesktopInner() {
  const c = useColors()
  const { isDark, setTheme } = useTheme()
  const [loggedIn, setLoggedIn] = useState(false)
  const [isHydratingSession, setIsHydratingSession] = useState(true)
  const [session, setSession] = useState<ClientSession | null>(null)
  const [screen, setScreen] = useState<Screen>('dashboard')
  const [openStartShift, setOpenStartShift] = useState(false)
  const [inventoryBarcode, setInventoryBarcode] = useState<string | undefined>()
  const [inventoryProductId, setInventoryProductId] = useState<string | undefined>()
  const [posCartItem, setPosCartItem] = useState<{
    id: string
    name: string
    price: number
    emoji: string
  } | undefined>()
  const [collapsed, setCollapsed] = useState(false)
  const [navOpen, setNavOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeShiftLabel, setActiveShiftLabel] = useState('Loading shifts…')
  const searchInputRef = useRef<HTMLInputElement>(null)
  const offlineSession = session?.user.offline === true
  const visibleNavGroups = useMemo(
    () => offlineSession
      ? navGroups
        .map(group => ({ ...group, items: group.items.filter(item => item.key === 'pos' || item.key === 'scan') }))
        .filter(group => group.items.length)
      : navGroups,
    [offlineSession],
  )

  useEffect(() => {
    const restoredSession = getClientSession()
    const tokenParts = restoredSession?.token.split('.')
    let sessionIsValid = Boolean(restoredSession)
    if (restoredSession?.user.offline) {
      sessionIsValid = isNativeOfflineApp() && !navigator.onLine
    } else if (restoredSession && tokenParts?.[1]) {
      try {
        const claims = JSON.parse(
          atob(tokenParts[1].replace(/-/g, '+').replace(/_/g, '/')),
        ) as { exp?: number }
        sessionIsValid =
          typeof claims.exp !== 'number' || claims.exp > Date.now() / 1000
      } catch {
        sessionIsValid = false
      }
    }

    if (sessionIsValid && restoredSession) {
      const savedScreen = getLastScreen() as Screen | null
      const restoredScreen = restoredSession.user.offline
        ? 'pos'
        : savedScreen && Object.prototype.hasOwnProperty.call(screenTitles, savedScreen)
          ? savedScreen
          : 'dashboard'
      setSession(restoredSession)
      setLoggedIn(true)
      setScreen(restoredScreen)
    } else {
      clearClientSession()
      clearLastScreen()
    }
    setIsHydratingSession(false)
  }, [])

  useEffect(() => {
    if (!loggedIn || !session) {
      setActiveShiftLabel('No active shift')
      return
    }

    let cancelled = false
    const loadActiveShifts = async () => {
      try {
        const response = await fetchCachedCollection<{
          sessions: Array<{
            closedAt: string | null
            cashier: {
              fullName: string
              role: { name: string } | null
            } | null
          }>
        }>(
          session.user.businessId,
          'shifts.active-summary.v1',
          `/api/cash/session?businessId=${encodeURIComponent(session.user.businessId)}`,
        )
        if (cancelled) return
        const active = response.sessions.filter(
          item =>
            !item.closedAt &&
            ['CASHIER', 'SUPERVISOR'].includes(
              item.cashier?.role?.name?.toUpperCase() ?? '',
            ),
        )
        setActiveShiftLabel(
          active.length === 0
            ? 'No active shift'
            : active.length === 1
              ? active[0].cashier?.fullName ?? '1 active shift'
              : `${active.length} active shifts`,
        )
      } catch (error) {
        if (cancelled) return
        console.error('Unable to load active shifts.', error)
        setActiveShiftLabel('Shift status unavailable')
      }
    }

    void loadActiveShifts()
    const refreshTimer = window.setInterval(() => void loadActiveShifts(), 30000)
    window.addEventListener('mobiduka:shift-changed', loadActiveShifts)
    return () => {
      cancelled = true
      window.clearInterval(refreshTimer)
      window.removeEventListener('mobiduka:shift-changed', loadActiveShifts)
    }
  }, [loggedIn, session])

  useEffect(() => {
    const handleAuthExpired = () => {
      setSession(null)
      setLoggedIn(false)
      setScreen('dashboard')
    }
    const handleOnline = () => {
      if (!getClientSession()?.user.offline) return
      clearClientSession()
      clearLastScreen()
      setSession(null)
      setLoggedIn(false)
      setScreen('dashboard')
    }
    window.addEventListener('mobiduka-auth-expired', handleAuthExpired)
    window.addEventListener('online', handleOnline)
    return () => {
      window.removeEventListener('mobiduka-auth-expired', handleAuthExpired)
      window.removeEventListener('online', handleOnline)
    }
  }, [])

  useEffect(() => {
    const handleSearchShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        searchInputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handleSearchShortcut)
    return () => window.removeEventListener('keydown', handleSearchShortcut)
  }, [])

  const filteredGroups = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return []
    return visibleNavGroups
      .map(group => ({ ...group, items: group.items.filter(item => item.label.toLowerCase().includes(normalized)) }))
      .filter(group => group.items.length)
  }, [query, visibleNavGroups])

  const navigate = (
    next: string,
    options?: {
      barcode?: string
      productId?: string
      startNewShift?: boolean
      cartItem?: { id: string; name: string; price: number; emoji: string }
    },
  ) => {
    if (!Object.prototype.hasOwnProperty.call(screenTitles, next)) return
    const nextScreen = next as Screen
    if (offlineSession && nextScreen !== 'pos' && nextScreen !== 'scan') return
    setOpenStartShift(nextScreen === 'shifts' && options?.startNewShift === true)
    setInventoryBarcode(nextScreen === 'inventory' ? options?.barcode : undefined)
    setInventoryProductId(nextScreen === 'inventory' ? options?.productId : undefined)
    setPosCartItem(nextScreen === 'pos' ? options?.cartItem : undefined)
    setScreen(nextScreen)
    saveLastScreen(nextScreen)
    setQuery('')
    setNavOpen(false)
  }

  const handleLogin = () => {
    const nextSession = getClientSession()
    setSession(nextSession)
    setLoggedIn(true)
    const startScreen = nextSession?.user.offline ? 'pos' : 'dashboard'
    setScreen(startScreen)
    saveLastScreen(startScreen)
  }

  const handleLogout = () => {
    clearClientSession()
    clearLastScreen()
    setSession(null)
    setLoggedIn(false)
    setScreen('dashboard')
  }

  const renderScreen = () => {
    switch (screen) {
      case 'dashboard': return <Dashboard onNavigate={navigate} />
      case 'pos': return <POSScreen onNavigate={navigate} initialCartItem={posCartItem} />
      case 'inventory': return <InventoryScreen onNavigate={navigate} initialBarcode={inventoryBarcode} initialProductId={inventoryProductId} />
      case 'reports': return <ReportsScreen onNavigate={navigate} />
      case 'customers': return <CustomersScreen onNavigate={navigate} />
      case 'more': return <MoreScreen onLogout={handleLogout} onNavigate={navigate} />
      case 'settings': return <SettingsScreen onNavigate={navigate} />
      case 'purchases': return <PurchaseOrdersScreen onNavigate={navigate} />
      case 'suppliers': return <SuppliersScreen onNavigate={navigate} />
      case 'credit': return <CreditBookScreen onNavigate={navigate} />
      case 'expenses': return <ExpensesScreen onNavigate={navigate} />
      case 'employees': return <EmployeesScreen onNavigate={navigate} />
      case 'notifications': return <NotificationsScreen onNavigate={navigate} />
      case 'backup': return <BackupScreen onNavigate={navigate} />
      case 'profile': return <UserProfileScreen onNavigate={navigate} />
      case 'scan': return <SmartScanScreen onNavigate={navigate} />
      case 'sessions': return <ActiveSessionsScreen onNavigate={navigate} />
      case 'twofa': return <TwoFactorScreen onNavigate={navigate} />
      case 'register': return <AdminRegisterScreen onNavigate={navigate} />
      case 'shifts': return <ShiftsScreen onNavigate={navigate} openStartShift={openStartShift} />
      case 'payments': return <PaymentMethodsScreen onNavigate={navigate} />
      case 'roles': return <ManageRolesScreen onNavigate={navigate} />
      case 'receiptsettings': return <ReceiptSettingsScreen onNavigate={navigate} />
      case 'taxcompliance': return <TaxComplianceScreen onNavigate={navigate} />
    }
  }

  const desktopVars = {
    '--desktop-bg': c.bg,
    '--desktop-card': c.card,
    '--desktop-card-alt': c.cardAlt,
    '--desktop-text': c.text,
    '--desktop-muted': c.muted,
    '--desktop-faint': c.faint,
    '--desktop-border': c.border,
    '--desktop-primary': c.primary,
    '--desktop-primary-text': c.primaryText,
    '--desktop-header-text': c.onNavy,
    '--desktop-sidebar-muted': c.onNavyMuted,
    '--desktop-gold': c.gold,
    '--desktop-gold-text': c.goldText,
    '--desktop-sidebar-border': c.navyBorder,
    '--desktop-error': c.error,
    '--desktop-header': c.desktopSidebarGradient,
    '--desktop-shadow': c.shadow,
  } as CSSProperties

  if (isHydratingSession) return null

  if (!loggedIn) {
    return (
      <div className="desktop-login" data-theme={isDark ? 'dark' : 'light'} style={desktopVars}>
        <section className="desktop-login-story">
          <div className="desktop-login-brand"><span><img src="/icon.svg" alt=""/></span><strong>MobiDuka</strong><small>POS</small></div>
          <div className="desktop-login-copy">
            <span className="desktop-eyebrow">DESKTOP WORKSPACE</span>
            <h1>Run your whole store from one clear view.</h1>
            <p>Sales, stock, staff and business performance—built for the pace and precision of your back office.</p>
            <div className="desktop-login-metrics">
              <div><strong>24</strong><span>connected workflows</span></div>
              <div><strong>Live</strong><span>store operations</span></div>
              <div><strong>Secure</strong><span>admin controls</span></div>
            </div>
          </div>
          <div className="desktop-login-foot"><span className="status-dot"/> MobiDuka secure workspace</div>
        </section>
        <section className="desktop-login-form">
          <button className="desktop-theme-button" onClick={() => setTheme(isDark ? 'light' : 'dark')} aria-label="Toggle theme"><Icon name={isDark ? 'sun' : 'moon'}/></button>
          <div className="desktop-login-panel">
            <span className="desktop-eyebrow">WELCOME BACK</span>
            <h2>Sign in to your store</h2>
            <p>Use your MobiDuka administrator credentials.</p>
            <div className="desktop-login-mobile">
              <LoginScreen onLogin={handleLogin} />
            </div>
          </div>
          <div className="desktop-login-help">Protected by MobiDuka secure access</div>
        </section>
      </div>
    )
  }

  return (
    <>
    <OfflineSyncWorker enabled={loggedIn} />
    <AutomaticBackupWorker enabled={loggedIn} />
    <SubscriptionRequiredToast enabled={loggedIn} />
    <div className={`desktop-app ${collapsed ? 'sidebar-collapsed' : ''}`} data-theme={isDark ? 'dark' : 'light'} style={desktopVars}>
      {navOpen && <button className="desktop-nav-scrim" onClick={() => setNavOpen(false)} aria-label="Close navigation"/>}
      <aside className={`desktop-sidebar ${navOpen ? 'mobile-open' : ''}`}>
        <div className="desktop-brand">
          <span className="desktop-brand-mark"><img src="/icon.svg" alt=""/></span>
          <div className="desktop-brand-name"><strong>MobiDuka</strong><span>POS</span></div>
          <button className="desktop-collapse" onClick={() => setCollapsed(value => !value)} aria-label="Collapse navigation"><Icon name="panel"/></button>
        </div>
        <div className="desktop-store-switcher">
          <span className="desktop-store-avatar">MD</span>
          <div><strong>Connected store</strong><span>Business workspace</span></div>
          <Icon name="chevron" size={15}/>
        </div>
        <nav className="desktop-nav" aria-label="Desktop navigation">
          {visibleNavGroups.map(group => (
            <div className="desktop-nav-group" key={group.label}>
              <span className="desktop-nav-label">{group.label}</span>
              {group.items.map(item => (
                <button
                  key={item.key}
                  className={`desktop-nav-item ${screen === item.key ? 'active' : ''}`}
                  onClick={() => navigate(item.key)}
                  title={collapsed ? item.label : undefined}
                >
                  <Icon name={item.icon}/>
                  <span>{item.label}</span>
                  {item.badge && <small>{item.badge}</small>}
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div className="desktop-sidebar-foot">
          <button className="desktop-user" onClick={() => navigate('profile')}>
            <span className="desktop-user-avatar">{(session?.user.name || 'User').slice(0, 2).toUpperCase()}</span>
            <span><strong>{session?.user.name || 'Store user'}</strong><small>{session?.user.role || 'Team member'}</small></span>
            <Icon name="chevron" size={15}/>
          </button>
          <button className="desktop-logout" onClick={handleLogout}><Icon name="logout"/><span>Sign out</span></button>
        </div>
      </aside>

      <main className="desktop-main">
        <header className="desktop-topbar">
          <div className="desktop-title-block">
            <button className="desktop-mobile-menu" onClick={() => setNavOpen(true)} aria-label="Open navigation"><Icon name="panel"/></button>
            <div><span>STORE OPERATIONS</span><strong>{screenTitles[screen]}</strong></div>
          </div>
          <div className="desktop-search-wrap">
            <Icon name="search"/>
            <input ref={searchInputRef} value={query} onChange={event => setQuery(event.target.value)} placeholder="Search screens and tools"/>
            <kbd>⌘ K</kbd>
            {query && (
              <div className="desktop-search-results">
                {filteredGroups.length ? filteredGroups.map(group => (
                  <div key={group.label}>
                    <span>{group.label}</span>
                    {group.items.map(item => <button key={item.key} onClick={() => navigate(item.key)}><Icon name={item.icon}/><strong>{item.label}</strong><Icon name="chevron" size={14}/></button>)}
                  </div>
                )) : <p>No tools match “{query}”</p>}
              </div>
            )}
          </div>
          <div className="desktop-top-actions">
            <div className="desktop-shift"><span className="status-dot"/><div><small>ACTIVE SHIFT</small><strong>{activeShiftLabel}</strong></div></div>
            <button onClick={() => setTheme(isDark ? 'light' : 'dark')} aria-label="Toggle theme"><Icon name={isDark ? 'sun' : 'moon'}/></button>
            <button onClick={() => navigate('notifications')} aria-label="Notifications" className="desktop-notification"><Icon name="bell"/><span/></button>
          </div>
        </header>
        <div className="desktop-contextbar">
          <span>Workspace</span><Icon name="chevron" size={13}/><strong>{screenTitles[screen]}</strong>
          <div><span className="status-dot"/>{offlineSession ? 'Offline PIN session' : 'Workspace ready'}</div>
          {offlineSession && <button className="desktop-offline-action" onClick={handleLogout}>Sign in online</button>}
        </div>
        <section className="desktop-screen-host">
          {renderScreen()}
        </section>
      </main>
    </div>
    </>
  )
}

export default function DesktopApp() {
  return <ThemeProvider><DesktopInner/></ThemeProvider>
}
