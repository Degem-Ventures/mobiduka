"use client"

import { useEffect, useMemo, useState } from 'react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { chartData, getWorkspaceConfig } from './control-plane-data'
import ContactInbox from './ContactInbox'

const liveWorkspaces = new Set([
  'transactions',
  'sync-health',
  'devices',
  'tenant-health',
  'roles',
  'audit-logs',
  'subscriptions',
  'mpesa',
  'reconciliation',
  'payment-events',
  'backups',
  'notifications',
  'revenue',
  'integrations',
  'security',
  'system-settings',
])

type LiveWorkspaceData = {
  columns: string[]
  rows: string[][]
  total: number
  page: number
  pageSize: number
  metrics: Array<{ label: string; value: string; note: string }>
  generatedAt: string
}

function LiveAdminWorkspace({ workspace }: { workspace: string }) {
  const config = getWorkspaceConfig(workspace)
  const [page, setPage] = useState(1)
  const [query, setQuery] = useState('')
  const [data, setData] = useState<LiveWorkspaceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError('')
    setData(null)
    void fetch(`/api/admin/workspaces?workspace=${encodeURIComponent(workspace)}&page=${page}`, {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async (response) => {
        const result = await response.json() as LiveWorkspaceData & { error?: string }
        if (!response.ok) throw new Error(result.error ?? 'Unable to load admin workspace.')
        setData(result)
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return
        setError(reason instanceof Error ? reason.message : 'Unable to load admin workspace.')
        setData(null)
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [workspace, page, revision])

  const filtered = useMemo(
    () => (data?.rows ?? []).filter((row) => row.join(' ').toLowerCase().includes(query.toLowerCase())),
    [data, query],
  )
  const pageCount = Math.max(1, Math.ceil((data?.total ?? 0) / (data?.pageSize ?? 50)))

  const exportRows = () => {
    if (!data || !filtered.length) return
    const quote = (value: string) => `"${value.replace(/"/g, '""')}"`
    const csv = [
      data.columns.map(quote).join(','),
      ...filtered.map((row) => row.map(quote).join(',')),
    ].join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${workspace}-page-${page}.csv`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="admin-page-stack">
      <div className="ops-kpi-grid">
        {(data?.metrics ?? []).map((metric) => (
          <article className="ops-kpi" key={metric.label}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
            <div><i className="info"/>{metric.note}</div>
          </article>
        ))}
      </div>
      <section className="ops-table-panel">
        <div className="ops-table-toolbar">
          <div className="ops-search"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search this page of ${config.title.toLowerCase()}…`}/></div>
          <button onClick={() => setRevision((value) => value + 1)} disabled={loading}>Refresh live data</button>
          <button onClick={exportRows} disabled={!filtered.length}>Export this page</button>
        </div>
        {error && <div className="admin-empty-state" role="alert">{error}</div>}
        <div className="admin-table-scroll">
          <table className="admin-table ops-table">
            <thead><tr>{(data?.columns ?? []).map((column) => <th key={column}>{column}</th>)}</tr></thead>
            <tbody>
              {loading && <tr><td colSpan={Math.max(1, data?.columns.length ?? 1)}>Loading current database records…</td></tr>}
              {!loading && !error && filtered.map((row, rowIndex) => (
                <tr key={`${row[0]}-${rowIndex}`}>
                  {row.map((cell, index) => (
                    <td key={`${index}-${cell}`}>
                      {index === row.length - 1 || /ACTIVE|COMPLETED|PENDING|FAILED|UNMATCHED|MATCHED|EXPIRED|GRACE|TRIAL|CANCELLED|REVOKED|READ|UNREAD|ENABLED|DISABLED/.test(cell.toUpperCase())
                        ? <span className={`ops-badge ${statusTone(cell)}`}>{cell}</span>
                        : <span>{cell}</span>}
                    </td>
                  ))}
                </tr>
              ))}
              {!loading && !error && filtered.length === 0 && (
                <tr><td colSpan={Math.max(1, data?.columns.length ?? 1)}>No database records found on this page.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="admin-table-footer">
          <span>
            Showing {data?.total ? (page - 1) * (data?.pageSize ?? 50) + 1 : 0}–
            {Math.min(page * (data?.pageSize ?? 50), data?.total ?? 0)} of {data?.total ?? 0}
            {data && ` · Updated ${new Date(data.generatedAt).toLocaleString()}`}
          </span>
          <div>
            <button disabled={loading || page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</button>
            <span>{page} / {pageCount}</span>
            <button disabled={loading || page >= pageCount} onClick={() => setPage((value) => value + 1)}>Next</button>
          </div>
        </div>
      </section>
    </div>
  )
}


function statusTone(value: string) {
  const normalized = value.toUpperCase()
  if (/FAILED|CRITICAL|BLOCKED|UNMATCHED|TIMEOUT|HIGH/.test(normalized)) return 'critical'
  if (/PENDING|WARNING|ATTENTION|PARTIAL|REVIEW|GRACE|SYNCING/.test(normalized)) return 'warning'
  if (/SUCCESS|HEALTHY|ACTIVE|ONLINE|MATCHED|RECONCILED|COMPLETED|LOW/.test(normalized)) return 'healthy'
  return 'info'
}

export function AdminWorkspace({ workspace }: { workspace: string }) {
  if (workspace === 'support') return <ContactInbox />
  const config = getWorkspaceConfig(workspace)
  const [period, setPeriod] = useState('Today')
  const [selected, setSelected] = useState<string[] | null>(null)
  const [toast, setToast] = useState('')
  const [query, setQuery] = useState('')
  const filtered = useMemo(() => config.rows.filter(row => row.join(' ').toLowerCase().includes(query.toLowerCase())), [config.rows, query])
  const isMpesa = workspace === 'mpesa' || workspace === 'transactions'
  const isSync = workspace === 'sync-health'
  const isDevice = workspace === 'devices'
  const isReconciliation = workspace === 'reconciliation'
  const isSecurity = workspace === 'security'
  const isSupport = workspace === 'support'
  const isIncident = workspace === 'incidents'

  if (isSupport) return <ContactInbox />

  if (liveWorkspaces.has(workspace)) {
    return <LiveAdminWorkspace workspace={workspace} />
  }

  const runAction = () => {
    if (/export/i.test(config.action)) {
      const csv = [config.columns.join(','), ...filtered.map(row => row.join(','))].join('\n')
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `${workspace}-ledger.csv`
      anchor.click()
      URL.revokeObjectURL(url)
      setToast('Exported sample data; this is not a live database export.')
      return
    }
    setToast('This control is not connected to the backend. No changes were made.')
  }

  return (
    <div className="admin-page-stack">
      <div className="admin-empty-state" role="note">
        This workspace currently displays sample data. Its actions are not connected to backend services and do not change database records.
      </div>
      <div className="ops-attention-strip">
        <div><span className={`ops-status-dot ${config.attention[0]?.tone ?? 'healthy'}`}/><div><strong>{config.attention[0]?.title ?? 'No active alerts'}</strong><span>{config.attention[0]?.detail ?? 'All services are operating normally.'}</span></div></div>
        <button onClick={() => setSelected(config.rows[0])}>Inspect attention item</button>
      </div>

      <section className={`ops-kpi-grid ${config.kpis.length > 4 ? 'six' : ''}`}>
        {config.kpis.map(kpi => <article className="ops-kpi" key={kpi.label}><span>{kpi.label}</span><strong>{kpi.value}</strong><div><i className={kpi.tone ?? 'info'}/>{kpi.note}</div></article>)}
      </section>

      {(isMpesa || workspace === 'revenue' || workspace === 'billing-payments') && (
        <section className="ops-chart-panel">
          <div className="ops-panel-head">
            <div><span>SAMPLE TELEMETRY</span><h2>{isMpesa ? 'Transaction volume & authorization performance' : 'Operational trend'}</h2></div>
            <div className="ops-segmented">{['Today', '7 Days', '30 Days', '90 Days'].map(value => <button key={value} className={period === value ? 'active' : ''} onClick={() => setPeriod(value)}>{value}</button>)}</div>
          </div>
          <div className="ops-chart">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 15, left: -20, bottom: 0 }}>
                <defs><linearGradient id={`ops-${workspace}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#0288D1" stopOpacity={0.35}/><stop offset="100%" stopColor="#0288D1" stopOpacity={0}/></linearGradient></defs>
                <CartesianGrid stroke="rgba(255,255,255,.05)" vertical={false}/><XAxis dataKey="time" stroke="#60708E" tickLine={false} axisLine={false} fontSize={9}/><YAxis stroke="#60708E" tickLine={false} axisLine={false} fontSize={9}/><Tooltip contentStyle={{ background: '#0D1930', border: '1px solid rgba(255,255,255,.1)', borderRadius: 9, color: '#E8EEFC' }}/><Area type="monotone" dataKey="value" stroke="#0288D1" strokeWidth={2.4} fill={`url(#ops-${workspace})`}/>
              </AreaChart>
            </ResponsiveContainer>
          </div>
          {isMpesa && <div className="ops-method-breakdown">{[['M-PESA','73%'],['Cash','18%'],['Card','4%'],['Bank','3%'],['Credit','2%']].map(item => <div key={item[0]}><span>{item[0]}</span><strong>{item[1]}</strong></div>)}</div>}
        </section>
      )}

      {isSync && <div className="ops-pipeline">{['OFFLINE','QUEUED','UPLOADING','SERVER PROCESSING','RECONCILED'].map((stage, index) => <div key={stage}><span>{index + 1}</span><strong>{stage}</strong>{index < 4 && <i/>}</div>)}</div>}

      {(isSecurity || isSupport) && (
        <section className="ops-context-grid">
          {(isSecurity ? [
            ['2FA Coverage','96.8%','176 users require enrollment'],['Session Security','Healthy','42 stale sessions queued'],['API Credentials','Healthy','Rotated 11 days ago'],['M-PESA Credentials','Attention','8 credentials expire soon'],['Webhook Signatures','Critical','3 failures today'],['Encryption','AES-256','All tenant secrets encrypted'],['Audit Logging','Healthy','100% mutation coverage'],['Backup Status','Healthy','Last backup 18 min ago'],
          ] : [
            ['Tenant context','Barngetuny Plaza','T-002 · Growth plan'],['Device','POS-ELD-001','Online · v2.4.18'],['User','Grace Wanjiku','Cashier · 2FA enabled'],['Recent transactions','84','KSh 284,250 today'],['M-PESA events','79','1 callback pending'],['Sync errors','2','SKU-104 conflict'],['Subscription','Active','Renews 18 Nov'],['Recent logs','12','Last event 8 sec ago'],
          ]).map(item => <article key={item[0]}><span>{item[0]}</span><strong>{item[1]}</strong><small>{item[2]}</small></article>)}
        </section>
      )}

      <section className="ops-table-panel">
        <div className="ops-table-toolbar">
          <div className="ops-search"><span>⌕</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder={`Search ${config.title.toLowerCase()}…`}/></div>
          <button onClick={() => { const csv = [config.columns.join(','), ...filtered.map(row => row.join(','))].join('\n'); const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${workspace}-export.csv`; anchor.click(); URL.revokeObjectURL(url) }}>Export CSV</button>
          <button className="primary" onClick={runAction}>{config.action}</button>
        </div>
        <div className="admin-table-scroll">
          <table className="admin-table ops-table">
            <thead><tr>{config.columns.map(column => <th key={column}>{column}</th>)}<th>Action</th></tr></thead>
            <tbody>{filtered.map((row, rowIndex) => <tr key={`${row[0]}-${rowIndex}`} onClick={() => setSelected(row)}>{row.map((cell, index) => <td key={`${cell}-${index}`}>{index === row.length - 1 || /SUCCESS|FAILED|PENDING|ONLINE|SYNCING|ATTENTION|MATCHED|PARTIAL|ACTIVE|HEALTHY|REVIEW|TIMEOUT|REVERSED|BLOCKED|RECONCILED|OPERATIONAL/.test(cell) ? <span className={`ops-badge ${statusTone(cell)}`}>{cell}</span> : <span className={/ID|STK|POS-|UID|LIC-|T-\d|RCP-|ws_CO|INC-|SUP-/.test(cell) ? 'ops-mono' : ''}>{cell}</span>}</td>)}<td><button className="admin-row-button" onClick={event => {
              event.stopPropagation()
              if (workspace === 'feature-flags' || (workspace === 'jobs' && row.includes('FAILED'))) {
                setToast('This control is not connected to the backend. No changes were made.')
              } else {
                setSelected(row)
              }
            }}>{workspace === 'feature-flags' ? (row.at(-1) === 'ACTIVE' ? 'Disable' : 'Enable') : workspace === 'jobs' && row.includes('FAILED') ? 'Retry' : 'View'}</button></td></tr>)}</tbody>
          </table>
        </div>
      </section>

      {toast && <div className="ops-toast"><span>!</span><div><strong>Demo workspace</strong><small>{toast}</small></div><button onClick={() => setToast('')}>×</button></div>}

      {selected && (
        <div className="admin-drawer-overlay" onMouseDown={event => { if (event.target === event.currentTarget) setSelected(null) }}>
          <aside className="admin-drawer ops-inspector">
            <div className="admin-drawer-head"><div className="admin-store-avatar large">{config.title.slice(0,2).toUpperCase()}</div><div><span>CONTROL PLANE INSPECTOR</span><h2>{selected[1] ?? selected[0]}</h2><p>{selected[0]}</p></div><button className="admin-icon-button" onClick={() => setSelected(null)}>×</button></div>
            <div className="admin-drawer-body">
              {isMpesa && <>
                <div className="ops-inspector-title"><span>Transaction execution timeline</span><strong>{selected[1] ?? selected[0]}</strong></div>
                <div className="ops-timeline">{['STK Initiated','OAuth Authorized','STK Sent','Customer Prompt','Callback Received','Payment Confirmed','Receipt Created'].map((step, index) => <div className={index > 4 && selected.includes('PENDING') ? 'pending' : ''} key={step}><i>{index < 5 || !selected.includes('PENDING') ? '✓' : ''}</i><div><strong>{step}</strong><span>{index === 0 ? '10:42:18.221 EAT' : `+${(index * 0.48 + .2).toFixed(2)}s`}</span></div></div>)}</div>
                <div className="ops-code-block"><span>Daraja callback payload</span><code>{`{\n  "MerchantRequestID": "${selected.find(value => value.includes('ws_CO')) ?? selected[1]}",\n  "ResultCode": 0,\n  "Amount": "${selected.find(value => value.includes('KSh'))}",\n  "CallbackURL": "/api/payments/mpesa/callback"\n}`}</code></div>
              </>}
              {isSync && <><div className="ops-inspector-title"><span>Conflict detail</span><strong>Product SKU-104</strong></div><div className="ops-detail-grid">{[['Server Quantity','15'],['Terminal Quantity','10'],['Expected Quantity','15'],['Difference','−5']].map(item => <div key={item[0]}><span>{item[0]}</span><strong>{item[1]}</strong></div>)}</div></>}
              {isDevice && <><div className="ops-inspector-title"><span>Registered terminal</span><strong>{selected[0]}</strong></div><div className="admin-detail-list">{[['Hardware Signature','FINGERPRINT_PAD_ADB_902'],['Device ID',selected[0]],['OS','Android 14 · API 34'],['App Version',selected[2]],['Network',selected[5]],['Last Heartbeat',selected[3]],['Current User','Grace Wanjiku'],['Drawer Balance','KSh 14,000']].map(item => <div key={item[0]}><span>{item[0]}</span><strong className="ops-mono">{item[1]}</strong></div>)}</div></>}
              {isReconciliation && <><div className="ops-inspector-title"><span>Settlement comparison</span><strong>{selected[1]}</strong></div><div className="ops-detail-grid">{[['POS Expected',selected[2]],['M-PESA Received',selected[3]],['Variance',selected[4]],['Transactions',selected[5]]].map(item => <div key={item[0]}><span>{item[0]}</span><strong>{item[1]}</strong></div>)}</div></>}
              {(isSecurity || isSupport || isIncident || (!isMpesa && !isSync && !isDevice && !isReconciliation)) && <><div className="ops-inspector-title"><span>Operational record</span><strong>{selected[0]}</strong></div><div className="admin-detail-list">{config.columns.map((column, index) => <div key={column}><span>{column}</span><strong className="ops-mono">{selected[index]}</strong></div>)}</div></>}
            </div>
            <div className="admin-drawer-footer">
              <button className="admin-secondary-button" onClick={() => setSelected(null)}>Close</button>
              {(isDevice || isSync || isReconciliation) && <button className="admin-secondary-button" disabled title="Backend integration is not available">{isDevice ? 'Force Sync' : isSync ? 'Retry Operation' : 'Run Reconciliation'}</button>}
              <button className="admin-primary-button" disabled title="Backend integration is not available">{isIncident ? 'Resolve Incident' : isSupport ? 'Resolve Ticket' : 'Resolve & close'}</button>
            </div>
          </aside>
        </div>
      )}
    </div>
  )
}
