import { useEffect, useRef, useState } from 'react'
import { useColors } from '../utils/theme'
import { apiFetch, getClientSession } from '../../lib/client-api'
import {
  commitOfflineCashExpense,
  fetchCachedCollection,
  getOfflineExpenseSyncStatus,
  getQueuedOfflineExpenses,
  isNativeOfflineApp,
  readOfflineCollectionUpdatedAt,
  retryFailedOfflineRecords,
} from '../../lib/offline-store'
import { useAutoDismissMessage } from '../../lib/use-auto-dismiss-message'

type Expense = { id: string; description: string; category: string | null; amount: number; createdAt: string; paymentMethod: string | null; icon: string | null; recurring: boolean; isPendingSync?: boolean; syncStatus?: 'PENDING' | 'FAILED'; syncError?: string | null }
type ExpenseToast = { message: string; tone: 'success' | 'error' }
type ExpenseSyncStatus = { pending: number; failed: number; lastError: string | null }

const categoryColors: Record<string, string> = {
  Utilities: '#0288D1', Payroll: '#5E35B1', Rent: '#2E7D32', Supplies: '#F57C00', Logistics: '#D32F2F'
}

const normalizeCategory = (category: string | null) => {
  const value = category?.trim() ?? ''
  const known = Object.keys(categoryColors).find(option => option.toLowerCase() === value.toLowerCase())
  return known ?? (value ? value.charAt(0).toUpperCase() + value.slice(1).toLowerCase() : 'Uncategorized')
}

const getExpenseMethod = (expense: Expense) => {
  if (expense.paymentMethod) return expense.paymentMethod
  const text = `${expense.description} ${expense.category ?? ''}`.toLowerCase()
  if (text.includes('rent') || text.includes('salary') || text.includes('payroll') || text.includes('nhif')) return 'Bank'
  if (text.includes('electric') || text.includes('water') || text.includes('utilit') || text.includes('internet') || text.includes('data')) return 'M-Pesa'
  return 'Cash'
}

const getExpenseIcon = (expense: Expense) => {
  if (expense.icon) return expense.icon
  const text = `${expense.description} ${expense.category ?? ''}`.toLowerCase()
  if (text.includes('rent')) return '🏪'
  if (text.includes('salary') || text.includes('payroll') || text.includes('nhif')) return '👥'
  if (text.includes('transport') || text.includes('delivery')) return '🚚'
  if (text.includes('clean')) return '🧹'
  if (text.includes('packag') || text.includes('suppl')) return '🛍️'
  if (text.includes('internet') || text.includes('data')) return '📶'
  if (text.includes('electric') || text.includes('water') || text.includes('utilit')) return '⚡'
  return '💸'
}

const formatExpenseDate = (value: string) => {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Date unavailable' : new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(date)
}

interface Props { onNavigate: (s: string) => void }

export default function ExpensesScreen({ onNavigate }: Props) {
  const c = useColors()
  const session = getClientSession()
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [isOfflineSnapshot, setIsOfflineSnapshot] = useState(false)
  const [snapshotUpdatedAt, setSnapshotUpdatedAt] = useState<string | null>(null)
  const [cat, setCat] = useState('All')
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ desc: '', amount: '', category: 'Utilities', categoryOther: '', method: 'Cash', date: new Date().toISOString().slice(0, 10), recurring: false })
  const [dataError, setDataError] = useAutoDismissMessage()
  const [saving, setSaving] = useState(false)
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [toast, setToast] = useState<ExpenseToast | null>(null)
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine,
  )
  const [expenseSyncStatus, setExpenseSyncStatus] = useState<ExpenseSyncStatus>({ pending: 0, failed: 0, lastError: null })
  const [fabPosition, setFabPosition] = useState<{ x: number; y: number } | null>(null)
  const expenseScreenRef = useRef<HTMLDivElement | null>(null)
  const toastTimeout = useRef<number | null>(null)
  const fabDragStart = useRef<{ pointerId: number; pointerX: number; pointerY: number; x: number; y: number } | null>(null)
  const fabWasDragged = useRef(false)
  const fabClickReset = useRef<number | null>(null)
  const emptyExpenseForm = () => ({ desc: '', amount: '', category: 'Utilities', categoryOther: '', method: 'Cash', date: new Date().toISOString().slice(0, 10), recurring: false })
  const offlineReadOnly = isNativeOfflineApp() && (!isOnline || session?.user.offline === true)

  const notify = (message: string, tone: ExpenseToast['tone']) => {
    if (toastTimeout.current !== null) window.clearTimeout(toastTimeout.current)
    setToast({ message, tone })
    toastTimeout.current = window.setTimeout(() => {
      setToast(null)
      toastTimeout.current = null
    }, 4000)
  }

  useEffect(() => () => {
    if (toastTimeout.current !== null) window.clearTimeout(toastTimeout.current)
  }, [])

  const toastNode = toast && (
    <div
      role={toast.tone === 'error' ? 'alert' : 'status'}
      aria-live={toast.tone === 'error' ? 'assertive' : 'polite'}
      style={{
        position: 'fixed',
        top: 18,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 2000,
        maxWidth: 'calc(100vw - 32px)',
        padding: '12px 16px',
        borderRadius: 12,
        background: toast.tone === 'success' ? '#2E7D32' : '#B71C1C',
        color: 'white',
        fontSize: 13,
        fontWeight: 700,
        boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
      }}
    >
      {toast.message}
    </div>
  )

  const openAdd = () => {
    setForm(emptyExpenseForm())
    setEditingExpense(null)
    setConfirmDeleteId(null)
    setShowAdd(true)
  }

  const startFabDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!expenseScreenRef.current) return
    if (fabClickReset.current !== null) {
      window.clearTimeout(fabClickReset.current)
      fabClickReset.current = null
    }
    const screenRect = expenseScreenRef.current.getBoundingClientRect()
    const buttonRect = event.currentTarget.getBoundingClientRect()
    const x = fabPosition?.x ?? buttonRect.left - screenRect.left
    const y = fabPosition?.y ?? buttonRect.top - screenRect.top
    fabDragStart.current = {
      pointerId: event.pointerId,
      pointerX: event.clientX,
      pointerY: event.clientY,
      x,
      y,
    }
    fabWasDragged.current = false
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const moveFab = (event: React.PointerEvent<HTMLButtonElement>) => {
    const start = fabDragStart.current
    const screen = expenseScreenRef.current
    if (!start || !screen || start.pointerId !== event.pointerId) return
    const deltaX = event.clientX - start.pointerX
    const deltaY = event.clientY - start.pointerY
    if (Math.abs(deltaX) + Math.abs(deltaY) > 6) fabWasDragged.current = true
    if (!fabWasDragged.current) return
    const width = event.currentTarget.offsetWidth
    const height = event.currentTarget.offsetHeight
    const maxY = Math.max(132, screen.clientHeight - height - 80)
    setFabPosition({
      x: Math.max(12, Math.min(screen.clientWidth - width - 12, start.x + deltaX)),
      y: Math.max(132, Math.min(maxY, start.y + deltaY)),
    })
  }

  const endFabDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (fabDragStart.current?.pointerId !== event.pointerId) return
    fabDragStart.current = null
    if (event.type === 'pointercancel') {
      fabWasDragged.current = false
      return
    }
    if (fabWasDragged.current) {
      fabClickReset.current = window.setTimeout(() => {
        fabWasDragged.current = false
        fabClickReset.current = null
      }, 500)
    }
  }

  const loadExpenses = async () => {
    if (!session) { setDataError('Please sign in to load expenses.'); return }
    const cacheKey = 'expenses.list.v1'
    let previousUpdatedAt: string | null = null
    try {
      previousUpdatedAt = await readOfflineCollectionUpdatedAt(session.user.businessId, cacheKey)
    } catch (reason) {
      console.error('Unable to read the expense snapshot timestamp.', reason)
    }
    try {
      const rows = await fetchCachedCollection<Expense[]>(
        session.user.businessId,
        cacheKey,
        `/api/expenses?businessId=${encodeURIComponent(session.user.businessId)}`,
      )
      const [queued, syncStatus] = isNativeOfflineApp()
        ? await Promise.all([
            getQueuedOfflineExpenses(session.user.businessId),
            getOfflineExpenseSyncStatus(session.user.businessId),
          ])
        : [[], { pending: 0, failed: 0, lastError: null }]
      setExpenseSyncStatus(syncStatus)
      const queuedById = new Map(queued.map(record => [record.id, record]))
      const merged = rows.map(expense => {
        const record = queuedById.get(expense.id)
        if (!record) return { ...expense, isPendingSync: false, syncStatus: undefined, syncError: null }
        queuedById.delete(expense.id)
        return { ...expense, isPendingSync: true, syncStatus: record.status, syncError: record.lastError }
      })
      for (const record of queuedById.values()) {
        merged.unshift({
          id: record.id,
          description: record.payload.description,
          category: record.payload.category,
          amount: record.payload.amount,
          createdAt: record.payload.date,
          paymentMethod: 'Cash',
          icon: null,
          recurring: record.payload.recurring,
          isPendingSync: true,
          syncStatus: record.status,
          syncError: record.lastError,
        })
      }
      setExpenses(merged)
      let updatedAt: string | null = null
      try {
        updatedAt = await readOfflineCollectionUpdatedAt(session.user.businessId, cacheKey)
      } catch (reason) {
        console.error('Unable to read the expense snapshot timestamp.', reason)
      }
      setSnapshotUpdatedAt(updatedAt)
      setIsOfflineSnapshot(
        isNativeOfflineApp() &&
        (!navigator.onLine || (updatedAt !== null && previousUpdatedAt === updatedAt)),
      )
      setDataError('')
    } catch (reason) {
      setDataError(reason instanceof Error ? reason.message : 'Unable to load expenses.')
    }
  }

  useEffect(() => {
    void loadExpenses()
    const handleOnline = () => {
      setIsOnline(true)
      void loadExpenses()
    }
    const handleOffline = () => {
      setIsOnline(false)
      setForm(current => ({ ...current, method: 'Cash' }))
      if (editingExpense) {
        setEditingExpense(null)
        setShowAdd(false)
      }
    }
    const handleSyncStatus = () => {
      if (navigator.onLine) void loadExpenses()
    }
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    window.addEventListener('mobiduka-offline-sync-status', handleSyncStatus)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('mobiduka-offline-sync-status', handleSyncStatus)
    }
  }, [session?.user.businessId, editingExpense])

  const saveExpense = async () => {
    if (!session || !form.desc.trim() || !form.amount) return
    const category = form.category === 'Other' ? form.categoryOther.trim() : form.category
    if (offlineReadOnly) {
      if (editingExpense || form.method !== 'Cash') {
        setDataError('Only new cash expenses can be saved offline. Edits and other payment methods require an online sign-in.')
        return
      }
      setSaving(true)
      setDataError('')
      try {
        await commitOfflineCashExpense(session.user.businessId, {
          description: form.desc.trim(),
          amount: Number(form.amount),
          category,
          recurring: form.recurring,
          date: form.date,
          userId: session.user.id,
        })
        await loadExpenses()
        setForm(emptyExpenseForm())
        setShowAdd(false)
        setEditingExpense(null)
        notify('Cash expense saved on this device and queued to sync.', 'success')
      } catch (reason) {
        const message = reason instanceof Error ? reason.message : 'Unable to save cash expense offline.'
        setDataError(message)
        notify(message, 'error')
      } finally {
        setSaving(false)
      }
      return
    }
    setSaving(true)
    setDataError('')
    try {
      await apiFetch('/api/expenses', {
        method: editingExpense ? 'PATCH' : 'POST',
        body: JSON.stringify({
          businessId: session.user.businessId,
          ...(editingExpense ? { id: editingExpense.id } : {}),
          userId: session.user.id,
          description: form.desc.trim(),
          amount: Number(form.amount),
          category,
          paymentMethod: form.method,
          recurring: form.recurring,
          date: form.date,
        }),
      })
      await loadExpenses()
      setForm(emptyExpenseForm())
      setShowAdd(false)
      setEditingExpense(null)
      notify(editingExpense ? 'Expense updated successfully.' : 'Expense added successfully.', 'success')
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : 'Unable to save expense.'
      setDataError(message)
      notify(message, 'error')
    }
    finally { setSaving(false) }
  }

  const startEdit = (expense: Expense) => {
    if (offlineReadOnly) {
      setDataError('Expense changes require an online sign-in. Only new cash expenses can be saved offline.')
      return
    }
    const category = normalizeCategory(expense.category)
    const standard = ['Utilities', 'Payroll', 'Rent', 'Supplies', 'Logistics']
    setForm({ desc: expense.description, amount: String(expense.amount), category: standard.includes(category) ? category : 'Other', categoryOther: standard.includes(category) ? '' : category, method: getExpenseMethod(expense), date: new Date(expense.createdAt).toISOString().slice(0, 10), recurring: expense.recurring })
    setEditingExpense(expense); setConfirmDeleteId(null); setShowAdd(true)
  }

  const deleteExpense = async (expense: Expense) => {
    if (offlineReadOnly || expense.isPendingSync) {
      setDataError(expense.isPendingSync
        ? 'This expense is still waiting to sync and cannot be deleted yet.'
        : 'Expense changes require an online sign-in.')
      return
    }
    if (!session) return
    setSaving(true); setDataError('')
    try {
      await apiFetch(`/api/expenses?id=${encodeURIComponent(expense.id)}&businessId=${encodeURIComponent(session.user.businessId)}`, { method: 'DELETE' })
      setExpenses(previous => previous.filter(item => item.id !== expense.id))
      notify('Expense deleted successfully.', 'success')
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : 'Unable to delete expense.'
      setDataError(message)
      notify(message, 'error')
    }
    finally { setSaving(false); setConfirmDeleteId(null) }
  }

  const retryFailedExpenses = async () => {
    if (!session || !isOnline || session.user.offline) {
      setDataError('Sign in online and connect to the internet before retrying queued expenses.')
      return
    }
    try {
      await retryFailedOfflineRecords(session.user.businessId, 'Expense')
      window.dispatchEvent(new Event('online'))
    } catch (reason) {
      setDataError(reason instanceof Error ? reason.message : 'Unable to retry queued expenses.')
    }
  }

  const categories = ['All', ...Array.from(new Set(expenses.map(expense => normalizeCategory(expense.category))))]
  const filtered = expenses.filter(e => cat === 'All' || normalizeCategory(e.category) === cat)
  const total = filtered.reduce((s, e) => s + e.amount, 0)
  const now = new Date()
  const monthTotal = expenses
    .filter(expense => {
      const date = new Date(expense.createdAt)
      return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth()
    })
    .reduce((s, e) => s + e.amount, 0)

  if (showAdd) {
    return (
      <div ref={expenseScreenRef} className="screen" style={{ background: c.bg, position: 'relative' }}>
        {toastNode}
        <div style={{ background: 'linear-gradient(135deg, #0D1B3D, #123A8F)', padding: '52px 20px 24px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <button className="btn" onClick={() => { setShowAdd(false); setEditingExpense(null); setForm(emptyExpenseForm()) }} style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 10, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7" /></svg>
            </button>
            <div style={{ color: 'white', fontSize: 18, fontWeight: 700 }}>{editingExpense ? 'Edit Expense' : 'Add Expense'}</div>
          </div>
        </div>
        <div className="scroll-area" style={{ padding: '20px 16px 100px' }}>
          {dataError && <div style={{ marginBottom: 16, padding: '10px 12px', borderRadius: 10, background: '#FFEBEE', color: '#C62828', fontSize: 12 }}>{dataError}</div>}
          {offlineReadOnly && !editingExpense && (
            <div role="status" style={{ marginBottom: 14, padding: '10px 12px', borderRadius: 10, background: '#FFF8E1', color: '#795548', fontSize: 12, lineHeight: 1.5 }}>
              Offline expense entry is available for cash only. New expenses are saved on this device and queued for synchronization; edits require an online sign-in.
            </div>
          )}
          <div className="card" style={{ padding: '20px' }}>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: c.muted, display: 'block', marginBottom: 6 }}>Description *</label>
              <input className="input" placeholder="e.g. Electricity Bill" value={form.desc} onChange={e => setForm(f => ({ ...f, desc: e.target.value }))} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: c.muted, display: 'block', marginBottom: 6 }}>Amount (KSh) *</label>
              <input className="input" type="number" placeholder="0.00" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} style={{ fontSize: 24, fontWeight: 800, textAlign: 'center' }} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: c.muted, display: 'block', marginBottom: 6 }}>Category *</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: form.category === 'Other' ? 10 : 0 }}>
                {['Utilities', 'Payroll', 'Rent', 'Supplies', 'Logistics', 'Other'].map(catOpt => (
                  <button key={catOpt} className="btn" onClick={() => setForm(f => ({ ...f, category: catOpt }))} style={{ padding: '7px 14px', borderRadius: 100, border: form.category === catOpt ? 'none' : '1.5px solid #E8ECF4', background: form.category === catOpt ? '#123A8F' : c.card, color: form.category === catOpt ? 'white' : c.muted, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>{catOpt}</button>
                ))}
              </div>
              {form.category === 'Other' && (
                <div style={{ marginTop: 10 }}>
                  <input className="input" placeholder="Specify category (e.g. Marketing, Insurance…)" value={form.categoryOther} onChange={e => setForm(f => ({ ...f, categoryOther: e.target.value }))} />
                </div>
              )}
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: c.muted, display: 'block', marginBottom: 6 }}>Payment Method</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {['Cash', 'M-Pesa', 'Bank'].filter(method => !offlineReadOnly || method === 'Cash').map(m => (
                  <button key={m} className="btn" onClick={() => setForm(f => ({ ...f, method: m }))} style={{ flex: 1, padding: '10px', borderRadius: 10, border: form.method === m ? '2px solid #123A8F' : '1.5px solid #E8ECF4', background: form.method === m ? 'rgba(18,58,143,0.08)' : c.card, color: form.method === m ? '#123A8F' : c.muted, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>{m}</button>
                ))}
              </div>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: c.muted, display: 'block', marginBottom: 6 }}>Date</label>
              <input className="input" type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px', background: c.cardAlt, borderRadius: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: c.text }}>Recurring Expense</div>
                <div style={{ fontSize: 11, color: c.muted, marginTop: 2 }}>Repeats monthly</div>
              </div>
              <button className="btn" onClick={() => setForm(f => ({ ...f, recurring: !f.recurring }))} style={{ width: 46, height: 26, borderRadius: 13, background: form.recurring ? '#123A8F' : '#D0D7E8', border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 0.2s' }}>
                <div style={{ position: 'absolute', top: 3, left: form.recurring ? 23 : 3, width: 20, height: 20, borderRadius: '50%', background: 'white', transition: 'left 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.2)' }} />
              </button>
            </div>
          </div>
          <button className="btn" disabled={saving || !form.desc.trim() || !form.amount || (form.category === 'Other' && !form.categoryOther.trim())} onClick={() => void saveExpense()} style={{ width: '100%', marginTop: 20, padding: '16px', background: 'linear-gradient(135deg, #D32F2F, #B71C1C)', border: 'none', borderRadius: 16, fontSize: 16, fontWeight: 700, color: 'white', cursor: saving ? 'wait' : 'pointer', fontFamily: 'inherit', boxShadow: '0 4px 16px rgba(211,47,47,0.35)', opacity: saving ? 0.7 : 1 }}>
            {editingExpense ? 'Save Changes' : 'Save Expense'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div ref={expenseScreenRef} className="screen" style={{ background: c.bg, position: 'relative' }}>
      {toastNode}
      <div style={{ background: 'linear-gradient(135deg, #0D1B3D, #123A8F)', padding: '52px 16px 16px', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div>
            <button className="btn" onClick={() => onNavigate('more')} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7" /></svg>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>Back</span>
            </button>
            <div style={{ color: 'white', fontSize: 20, fontWeight: 800 }}>Expense Tracking</div>
          </div>
          <button className="btn" onClick={openAdd} style={{ background: '#D4AF37', border: 'none', borderRadius: 12, padding: '9px 14px', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontFamily: 'inherit' }}>
            <span style={{ fontSize: 18, color: '#0D1B3D', lineHeight: 1 }}>+</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#0D1B3D' }}>Add</span>
          </button>
        </div>
        <div style={{ background: 'rgba(211,47,47,0.2)', border: '1px solid rgba(239,154,154,0.3)', borderRadius: 14, padding: '12px 16px', marginBottom: 14 }}>
          <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11 }}>Total Expenses This Month</div>
          <div style={{ color: '#FF6B6B', fontSize: 28, fontWeight: 900, marginTop: 2 }}>KSh {monthTotal.toLocaleString()}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
          {categories.map(catOpt => (
            <button key={catOpt} className="btn" onClick={() => setCat(catOpt)} style={{ padding: '6px 14px', borderRadius: 100, border: 'none', background: cat === catOpt ? '#D4AF37' : 'rgba(255,255,255,0.12)', color: cat === catOpt ? '#0D1B3D' : 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>{catOpt}</button>
          ))}
        </div>
      </div>
      <div className="scroll-area" style={{ padding: '12px', paddingBottom: 80 }}>
        {isOfflineSnapshot && (
          <div role="status" style={{ background: '#FFF8E1', color: '#795548', borderRadius: 10, padding: '9px 12px', marginBottom: 12, fontSize: 12 }}>
            Offline · showing saved expense data{snapshotUpdatedAt ? ` from ${new Date(snapshotUpdatedAt).toLocaleString()}` : ''}. Only new cash expenses can be saved offline; edits require internet.
          </div>
        )}
        {(expenseSyncStatus.pending > 0 || expenseSyncStatus.failed > 0) && (
          <div role="status" style={{ background: c.warningBg, color: c.isDark ? '#F0D060' : '#795548', borderRadius: 10, padding: '10px 12px', marginBottom: 12, fontSize: 12, lineHeight: 1.5 }}>
            {expenseSyncStatus.pending} cash expense{expenseSyncStatus.pending === 1 ? '' : 's'} waiting to sync
            {expenseSyncStatus.failed > 0 && ` · ${expenseSyncStatus.failed} failed`}
            {expenseSyncStatus.failed > 0 && (
              <>
                {expenseSyncStatus.lastError && <div style={{ marginTop: 4 }}>{expenseSyncStatus.lastError}</div>}
                {isOnline && !session?.user.offline && (
                  <button className="btn" onClick={() => void retryFailedExpenses()} style={{ marginTop: 6, border: 0, padding: 0, background: 'transparent', color: 'inherit', font: 'inherit', fontWeight: 700, textDecoration: 'underline' }}>
                    Retry failed expenses
                  </button>
                )}
              </>
            )}
          </div>
        )}
        {dataError && <div style={{ margin: 12, marginBottom: 0, padding: '10px 12px', borderRadius: 10, background: '#FFEBEE', color: '#C62828', fontSize: 12 }}>{dataError}</div>}
        <div style={{ fontSize: 12, fontWeight: 700, color: c.muted, marginBottom: 8, letterSpacing: 0.4 }}>
          {cat === 'All' ? 'All Expenses' : cat} · KSh {total.toLocaleString()}
        </div>
        {filtered.map(e => (
          <div key={e.id} className="card" style={{ width: '100%', minWidth: 0, boxSizing: 'border-box', padding: '14px 16px', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: c.tint(categoryColors[normalizeCategory(e.category)] || '#6B7A99'), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>{getExpenseIcon(e)}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, minWidth: 0 }}>
                  <div style={{ minWidth: 0, overflowWrap: 'anywhere', fontSize: 13, fontWeight: 700, color: c.text }}>{e.description}</div>
                  {e.recurring && <span style={{ fontSize: 9, background: c.iconBg, color: '#123A8F', padding: '2px 6px', borderRadius: 6, fontWeight: 700, flexShrink: 0 }}>RECURRING</span>}
                  {e.isPendingSync && <span style={{ fontSize: 9, background: e.syncStatus === 'FAILED' ? c.errorBg : c.warningBg, color: e.syncStatus === 'FAILED' ? '#B71C1C' : '#795548', padding: '2px 6px', borderRadius: 6, fontWeight: 700, flexShrink: 0 }}>{e.syncStatus === 'FAILED' ? 'SYNC FAILED' : 'PENDING SYNC'}</span>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 4, minWidth: 0 }}>
                  <span style={{ minWidth: 0, overflowWrap: 'anywhere', fontSize: 11, color: c.muted }}>{normalizeCategory(e.category)}</span>
                  <span
                    className={`badge ${
                      getExpenseMethod(e).toLowerCase().includes('mpesa')
                        ? 'badge-success'
                        : 'badge-blue'
                    }`}
                    style={{ fontSize: 10, flexShrink: 0 }}
                  >
                    {getExpenseMethod(e)}
                  </span>
                </div>
              </div>
              <div style={{ flexShrink: 0, whiteSpace: 'nowrap', fontSize: 15, fontWeight: 800, color: '#D32F2F' }}>KSh {e.amount.toLocaleString()}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, minWidth: 0, marginTop: 10 }}>
              <div style={{ minWidth: 0, overflowWrap: 'anywhere', fontSize: 11, color: c.muted }}>{formatExpenseDate(e.createdAt)}</div>
              {confirmDeleteId !== e.id && !offlineReadOnly && !e.isPendingSync && <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, flexShrink: 0 }}>
                <button className="btn" onClick={() => startEdit(e)} aria-label={`Edit ${e.description}`} style={{ width: 30, height: 30, borderRadius: 8, background: c.iconBg, border: 'none', display: 'grid', placeItems: 'center', cursor: 'pointer' }}><svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#123A8F" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
                <button className="btn" onClick={() => setConfirmDeleteId(e.id)} aria-label={`Delete ${e.description}`} style={{ width: 30, height: 30, borderRadius: 8, background: c.errorBg, border: 'none', display: 'grid', placeItems: 'center', cursor: 'pointer' }}><svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#D32F2F" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg></button>
              </div>}
            </div>
            {e.syncStatus === 'FAILED' && e.syncError && (
              <div role="note" style={{ marginTop: 8, color: '#B71C1C', fontSize: 11, lineHeight: 1.4 }}>
                Sync failed: {e.syncError}
              </div>
            )}
            {confirmDeleteId === e.id ? (
              <div role="alert" style={{ marginTop: 12, paddingTop: 12, borderTop: c.divider }}>
                <div style={{ fontSize: 12, color: '#B71C1C', fontWeight: 700, marginBottom: 9 }}>Delete &quot;{e.description}&quot;?</div>
                <div style={{ display: 'flex', gap: 8 }}><button className="btn" onClick={() => setConfirmDeleteId(null)} style={{ flex: 1, padding: 8, border: 'none', borderRadius: 8, background: c.iconBg, cursor: 'pointer' }}>Cancel</button><button className="btn" disabled={saving} onClick={() => void deleteExpense(e)} style={{ flex: 1, padding: 8, border: 'none', borderRadius: 8, background: '#D32F2F', color: 'white', cursor: 'pointer' }}>Delete</button></div>
              </div>
            ) : null}
          </div>
        ))}
      </div>
      <div style={{ position: 'absolute', zIndex: 20, ...(fabPosition ? { left: fabPosition.x, top: fabPosition.y } : { bottom: 80, right: 16 }) }}>
        <button
          className="btn"
          type="button"
          draggable={false}
          aria-label="Add expense (drag to reposition)"
          title="Drag to reposition · tap to add expense"
          onPointerDown={startFabDrag}
          onPointerMove={moveFab}
          onPointerUp={endFabDrag}
          onPointerCancel={endFabDrag}
          onDragStart={event => event.preventDefault()}
          onClick={event => {
            if (fabWasDragged.current) {
              event.preventDefault()
              event.stopPropagation()
              fabWasDragged.current = false
              if (fabClickReset.current !== null) {
                window.clearTimeout(fabClickReset.current)
                fabClickReset.current = null
              }
              return
            }
            openAdd()
          }}
          style={{
            width: 52,
            height: 52,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #D32F2F, #B71C1C)',
            border: 'none',
            fontSize: 24,
            color: 'white',
            boxShadow: '0 4px 16px rgba(211,47,47,0.45)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            touchAction: 'none',
            userSelect: 'none',
            WebkitUserSelect: 'none',
          }}
        >+</button>
      </div>
    </div>
  )
}
