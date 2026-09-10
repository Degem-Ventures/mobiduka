import { useState } from 'react'

const backupHistory = [
  { date: 'Today, 06:00 AM', type: 'Auto', status: 'success', size: '4.2 MB', records: '12,450' },
  { date: 'Yesterday, 06:00 AM', type: 'Auto', status: 'success', size: '4.1 MB', records: '12,287' },
  { date: '6 Jul, 06:00 AM', type: 'Auto', status: 'success', size: '3.9 MB', records: '12,102' },
  { date: '5 Jul, 14:20 PM', type: 'Manual', status: 'success', size: '3.8 MB', records: '11,980' },
  { date: '5 Jul, 06:00 AM', type: 'Auto', status: 'failed', size: '—', records: '—' },
  { date: '4 Jul, 06:00 AM', type: 'Auto', status: 'success', size: '3.7 MB', records: '11,842' },
]

interface Props { onNavigate: (s: string) => void }

export default function BackupScreen({ onNavigate }: Props) {
  const [syncing, setSyncing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [lastSync, setLastSync] = useState('Today, 06:00 AM')
  const [autoBackup, setAutoBackup] = useState(true)
  const [wifiOnly, setWifiOnly] = useState(true)
  const [provider, setProvider] = useState<'google' | 'dropbox' | 'local'>('google')

  const startBackup = () => {
    setSyncing(true)
    setProgress(0)
    const iv = setInterval(() => {
      setProgress(p => {
        if (p >= 100) { clearInterval(iv); setSyncing(false); setLastSync('Just now'); return 100 }
        return p + 8
      })
    }, 150)
  }

  const Toggle = ({ value, onChange }: { value: boolean; onChange: () => void }) => (
    <button className="btn" onClick={onChange} style={{ width: 46, height: 26, borderRadius: 13, background: value ? '#123A8F' : '#D0D7E8', border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 0.2s' }}>
      <div style={{ position: 'absolute', top: 3, left: value ? 23 : 3, width: 20, height: 20, borderRadius: '50%', background: 'white', transition: 'left 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.2)' }} />
    </button>
  )

  return (
    <div className="screen" style={{ background: '#F5F7FA' }}>
      <div style={{ background: 'linear-gradient(135deg, #0D1B3D, #0288D1)', padding: '52px 20px 24px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 }}>
          <button className="btn" onClick={() => onNavigate('more')} style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 10, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7" /></svg>
          </button>
          <div style={{ color: 'white', fontSize: 18, fontWeight: 700 }}>Backup & Cloud Sync</div>
        </div>

        {/* Cloud status card */}
        <div style={{ background: 'rgba(255,255,255,0.12)', borderRadius: 18, padding: '20px', border: '1px solid rgba(255,255,255,0.15)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ fontSize: 40 }}>☁️</div>
            <div style={{ flex: 1 }}>
              <div style={{ color: 'white', fontSize: 16, fontWeight: 700 }}>Cloud Backup</div>
              <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 2 }}>Last backup: {lastSync}</div>
              <div style={{ color: '#4CAF50', fontSize: 12, fontWeight: 600, marginTop: 2 }}>✓ All data synced</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11 }}>Used</div>
              <div style={{ color: 'white', fontSize: 16, fontWeight: 800 }}>4.2 MB</div>
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10 }}>of 15 GB</div>
            </div>
          </div>

          {/* Storage bar */}
          <div style={{ marginTop: 14 }}>
            <div style={{ height: 6, background: 'rgba(255,255,255,0.15)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ width: '0.3%', height: '100%', background: 'linear-gradient(90deg, #4CAF50, #81C784)', borderRadius: 3 }} />
            </div>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10, marginTop: 4 }}>4.2 MB of 15 GB used (0.03%)</div>
          </div>

          {/* Progress */}
          {syncing && (
            <div style={{ marginTop: 14 }}>
              <div style={{ height: 4, background: 'rgba(255,255,255,0.15)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ width: `${progress}%`, height: '100%', background: '#D4AF37', borderRadius: 2, transition: 'width 0.15s' }} />
              </div>
              <div style={{ color: '#D4AF37', fontSize: 12, marginTop: 6, fontWeight: 600 }}>Backing up... {progress}%</div>
            </div>
          )}
        </div>
      </div>

      <div className="scroll-area" style={{ padding: '16px', paddingBottom: 80 }}>
        {/* Backup now */}
        <button className="btn" onClick={startBackup} disabled={syncing} style={{ width: '100%', padding: '16px', marginBottom: 16, background: syncing ? '#E8ECF4' : 'linear-gradient(135deg, #0288D1, #0277BD)', border: 'none', borderRadius: 16, fontSize: 15, fontWeight: 700, color: syncing ? '#B0BAD3' : 'white', cursor: syncing ? 'default' : 'pointer', fontFamily: 'inherit', boxShadow: syncing ? 'none' : '0 4px 16px rgba(2,136,209,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
          <span style={{ fontSize: 20 }}>{syncing ? '⏳' : '☁️'}</span>
          {syncing ? `Backing Up... ${progress}%` : 'Backup Now'}
        </button>

        {/* Cloud Provider */}
        <div style={{ fontSize: 11, fontWeight: 700, color: '#6B7A99', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 8, marginLeft: 4 }}>Cloud Provider</div>
        <div className="card" style={{ padding: '0', marginBottom: 16, overflow: 'hidden' }}>
          {[
            { key: 'google', label: 'Google Drive', sub: 'admin@gmail.com · Connected', icon: '🔵' },
            { key: 'dropbox', label: 'Dropbox', sub: 'Not connected', icon: '🟦' },
            { key: 'local', label: 'Local Storage', sub: 'Device memory only', icon: '📱' },
          ].map((p, i, arr) => (
            <button key={p.key} className="btn" onClick={() => setProvider(p.key as 'google' | 'dropbox' | 'local')} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', border: 'none', borderBottom: i < arr.length - 1 ? '1px solid #F0F3F9' : 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: '#E3EAF8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>{p.icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#0D1B3D' }}>{p.label}</div>
                <div style={{ fontSize: 11, color: '#6B7A99', marginTop: 1 }}>{p.sub}</div>
              </div>
              {provider === p.key && <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#0288D1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20,6 9,17 4,12"/></svg>
              </div>}
            </button>
          ))}
        </div>

        {/* Settings */}
        <div style={{ fontSize: 11, fontWeight: 700, color: '#6B7A99', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 8, marginLeft: 4 }}>Sync Settings</div>
        <div className="card" style={{ padding: '0', marginBottom: 16, overflow: 'hidden' }}>
          {[
            { label: 'Auto Backup', sub: 'Backup automatically every day at 6:00 AM', value: autoBackup, onChange: () => setAutoBackup(v => !v) },
            { label: 'Wi-Fi Only', sub: 'Only sync when connected to Wi-Fi', value: wifiOnly, onChange: () => setWifiOnly(v => !v) },
          ].map((s, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', padding: '14px 16px', borderBottom: i === 0 ? '1px solid #F0F3F9' : 'none', gap: 14 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#0D1B3D' }}>{s.label}</div>
                <div style={{ fontSize: 11, color: '#6B7A99', marginTop: 2 }}>{s.sub}</div>
              </div>
              <Toggle value={s.value} onChange={s.onChange} />
            </div>
          ))}
        </div>

        {/* Backup history */}
        <div style={{ fontSize: 11, fontWeight: 700, color: '#6B7A99', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 8, marginLeft: 4 }}>Backup History</div>
        <div className="card" style={{ overflow: 'hidden' }}>
          {backupHistory.map((b, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: i < backupHistory.length - 1 ? '1px solid #F0F3F9' : 'none' }}>
              <div style={{ width: 34, height: 34, borderRadius: 9, background: b.status === 'success' ? '#E8F5E9' : '#FFEBEE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>
                {b.status === 'success' ? '✅' : '❌'}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#0D1B3D' }}>{b.date}</div>
                <div style={{ fontSize: 11, color: '#6B7A99', marginTop: 1 }}>
                  {b.status === 'success' ? `${b.records} records · ${b.size}` : 'Backup failed — retried'}
                </div>
              </div>
              <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 6, fontWeight: 700, background: b.type === 'Manual' ? '#E3EAF8' : '#F5F7FA', color: b.type === 'Manual' ? '#123A8F' : '#6B7A99' }}>{b.type}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
