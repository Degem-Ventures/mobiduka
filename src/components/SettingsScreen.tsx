import { useState } from 'react'

interface Props {
  onNavigate: (s: string) => void
}

export default function SettingsScreen({ onNavigate }: Props) {
  const [receiptPrint, setReceiptPrint] = useState(true)
  const [lowStockAlerts, setLowStockAlerts] = useState(true)
  const [dailyReport, setDailyReport] = useState(false)
  const [autoBackup, setAutoBackup] = useState(true)
  const [mpesaEnabled, setMpesaEnabled] = useState(true)

  const Toggle = ({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) => (
    <button className="btn" onClick={() => onChange(!value)} style={{
      width: 46, height: 26, borderRadius: 13,
      background: value ? '#123A8F' : '#D0D7E8',
      border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 0.2s'
    }}>
      <div style={{
        position: 'absolute', top: 3, left: value ? 23 : 3,
        width: 20, height: 20, borderRadius: '50%',
        background: 'white', transition: 'left 0.2s',
        boxShadow: '0 1px 4px rgba(0,0,0,0.2)'
      }} />
    </button>
  )

  return (
    <div className="screen" style={{ background: '#F5F7FA' }}>
      <div style={{ background: 'linear-gradient(135deg, #0D1B3D, #123A8F)', padding: '52px 20px 24px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button className="btn" onClick={() => onNavigate('more')} style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 10, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7" /></svg>
          </button>
          <div style={{ color: 'white', fontSize: 20, fontWeight: 800 }}>Settings</div>
        </div>
      </div>

      <div className="scroll-area" style={{ padding: '16px', paddingBottom: 80 }}>
        {/* Business Info */}
        <div style={{ fontSize: 11, fontWeight: 700, color: '#6B7A99', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8, marginLeft: 4 }}>Business Information</div>
        <div className="card" style={{ padding: '0', marginBottom: 16, overflow: 'hidden' }}>
          {[
            { label: 'Business Name', value: 'MobiDuka Store' },
            { label: 'Location', value: 'Nairobi CBD, Kenya' },
            { label: 'Phone', value: '+254 712 345 678' },
            { label: 'Tax PIN', value: 'A123456789B' },
            { label: 'Currency', value: 'KES (Kenyan Shilling)' },
          ].map((item, i, arr) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', borderBottom: i < arr.length - 1 ? '1px solid #F0F3F9' : 'none' }}>
              <div style={{ fontSize: 13, color: '#6B7A99' }}>{item.label}</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#0D1B3D' }}>{item.value}</div>
            </div>
          ))}
        </div>

        {/* Preferences */}
        <div style={{ fontSize: 11, fontWeight: 700, color: '#6B7A99', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8, marginLeft: 4 }}>Preferences</div>
        <div className="card" style={{ padding: '0', marginBottom: 16, overflow: 'hidden' }}>
          {[
            { label: 'Auto-print Receipt', sub: 'Print receipt after every sale', value: receiptPrint, onChange: setReceiptPrint },
            { label: 'Low Stock Alerts', sub: 'Notify when stock is below reorder level', value: lowStockAlerts, onChange: setLowStockAlerts },
            { label: 'Daily Report Email', sub: 'Send end-of-day report to email', value: dailyReport, onChange: setDailyReport },
            { label: 'Auto Cloud Backup', sub: 'Backup data daily at midnight', value: autoBackup, onChange: setAutoBackup },
            { label: 'M-Pesa Integration', sub: 'Accept M-Pesa payments', value: mpesaEnabled, onChange: setMpesaEnabled },
          ].map((item, i, arr) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', padding: '14px 16px', borderBottom: i < arr.length - 1 ? '1px solid #F0F3F9' : 'none', gap: 14 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#0D1B3D' }}>{item.label}</div>
                <div style={{ fontSize: 11, color: '#6B7A99', marginTop: 2 }}>{item.sub}</div>
              </div>
              <Toggle value={item.value} onChange={item.onChange} />
            </div>
          ))}
        </div>

        {/* Payment Methods */}
        <div style={{ fontSize: 11, fontWeight: 700, color: '#6B7A99', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8, marginLeft: 4 }}>Payment Methods</div>
        <div className="card" style={{ padding: '0', marginBottom: 16, overflow: 'hidden' }}>
          {[
            { label: 'Cash', icon: '💵', color: '#2E7D32', enabled: true },
            { label: 'M-Pesa', icon: '📱', color: '#2E7D32', enabled: mpesaEnabled },
            { label: 'Credit / Tab', icon: '📋', color: '#D32F2F', enabled: true },
            { label: 'Bank Transfer', icon: '🏦', color: '#123A8F', enabled: false },
          ].map((method, i, arr) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', padding: '13px 16px', borderBottom: i < arr.length - 1 ? '1px solid #F0F3F9' : 'none', gap: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: `${method.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>{method.icon}</div>
              <div style={{ flex: 1, fontSize: 13, fontWeight: 600, color: '#0D1B3D' }}>{method.label}</div>
              <span className={`badge ${method.enabled ? 'badge-success' : 'badge-error'}`}>{method.enabled ? 'Active' : 'Inactive'}</span>
            </div>
          ))}
        </div>

        {/* Data management */}
        <div style={{ fontSize: 11, fontWeight: 700, color: '#6B7A99', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8, marginLeft: 4 }}>Data Management</div>
        <div className="card" style={{ overflow: 'hidden', marginBottom: 16 }}>
          {[
            { label: 'Backup Now', sub: 'Last backup: Today 06:00 AM', icon: '☁️', color: '#0288D1' },
            { label: 'Export Data (CSV)', sub: 'Download all transactions', icon: '📤', color: '#2E7D32' },
            { label: 'Clear Cache', sub: '12.4 MB used', icon: '🗑️', color: '#F57C00' },
          ].map((item, i, arr) => (
            <button key={i} className="btn" style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px',
              border: 'none', borderBottom: i < arr.length - 1 ? '1px solid #F0F3F9' : 'none',
              background: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left'
            }}>
              <div style={{ width: 40, height: 40, borderRadius: 11, background: `${item.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>{item.icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#0D1B3D' }}>{item.label}</div>
                <div style={{ fontSize: 11, color: '#6B7A99', marginTop: 1 }}>{item.sub}</div>
              </div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#B0BAD3" strokeWidth="2.5"><path d="M9 18l6-6-6-6"/></svg>
            </button>
          ))}
        </div>

        <div style={{ textAlign: 'center', padding: '8px 0 16px' }}>
          <div style={{ fontSize: 12, color: '#B0BAD3' }}>MobiDuka POS v2.4.1 · Build 20260708</div>
        </div>
      </div>
    </div>
  )
}
