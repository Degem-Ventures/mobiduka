import { useState, type ReactNode } from "react"
import { useColors } from "../utils/theme"

interface Props {
  onNavigate: (screen: string) => void
}

type IconName = "arrow-left" | "cloud" | "database" | "device" | "refresh" | "shield" | "check" | "clock" | "chevron" | "restore"

type BackupRecord = {
  id: number
  date: string
  label: string
  meta: string
  type: "Auto" | "Manual"
}

const initialBackupHistory: BackupRecord[] = [
  {
    id: 1,
    date: "Today, 6:00 AM",
    label: "Business cloud backup",
    meta: "12,450 records · 4.2 MB",
    type: "Auto",
  },
  {
    id: 2,
    date: "Yesterday, 6:00 AM",
    label: "Device snapshot",
    meta: "12,287 records · 4.1 MB",
    type: "Auto",
  },
  {
    id: 3,
    date: "6 Jul, 2:20 PM",
    label: "Business cloud backup",
    meta: "12,102 records · 3.9 MB",
    type: "Manual",
  },
]

function Icon({
  name,
  size = 20,
  color = "currentColor",
}: {
  name: IconName
  size?: number
  color?: string
}) {
  const paths: Record<IconName, ReactNode> = {
    "arrow-left": (
      <>
        <path d="M19 12H5" />
        <path d="m12 19-7-7 7-7" />
      </>
    ),
    cloud: <path d="M17.5 19H9a7 7 0 1 1 6.7-9h1.8a4.5 4.5 0 1 1 0 9Z" />,
    database: (
      <>
        <ellipse cx="12" cy="5" rx="8" ry="3" />
        <path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5" />
        <path d="M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" />
      </>
    ),
    device: (
      <>
        <rect x="6" y="2" width="12" height="20" rx="2" />
        <path d="M10 18h4" />
      </>
    ),
    refresh: (
      <>
        <path d="M20 11a8.1 8.1 0 0 0-15.5-2M4 4v5h5" />
        <path d="M4 13a8.1 8.1 0 0 0 15.5 2M20 20v-5h-5" />
      </>
    ),
    shield: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />,
    check: <path d="m5 12 4 4L19 6" />,
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    chevron: <path d="m9 18 6-6-6-6" />,
    restore: (
      <>
        <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
        <path d="M3 3v5h5" />
      </>
    ),
  }

  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  )
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: () => void
  label: string
}) {
  const c = useColors()

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className="btn"
      onClick={onChange}
      style={{
        width: 44,
        height: 26,
        padding: 3,
        border: "none",
        borderRadius: 999,
        background: checked ? c.primary : c.iconBg,
        display: "flex",
        justifyContent: checked ? "flex-end" : "flex-start",
        alignItems: "center",
        flexShrink: 0,
      }}
    >
      <span
        style={{
          width: 20,
          height: 20,
          borderRadius: "50%",
          background: c.onNavy,
          boxShadow: "0 1px 4px rgba(13,27,61,0.24)",
        }}
      />
    </button>
  )
}

export default function BackupScreen({ onNavigate }: Props) {
  const c = useColors()
  const [backingUp, setBackingUp] = useState(false)
  const [progress, setProgress] = useState(0)
  const [lastBackup, setLastBackup] = useState("Today, 6:00 AM")
  const [autoBackup, setAutoBackup] = useState(true)
  const [wifiOnly, setWifiOnly] = useState(true)
  const [backupHistory, setBackupHistory] = useState(initialBackupHistory)
  const [syncing, setSyncing] = useState(false)
  const [autoSync, setAutoSync] = useState(false)
  const [queuedSales, setQueuedSales] = useState(2)
  const [lastSalesSync, setLastSalesSync] = useState("5 min ago")
  const [restoreOpen, setRestoreOpen] = useState(false)
  const [selectedBackupId, setSelectedBackupId] = useState(
    initialBackupHistory[0].id,
  )
  const [restoring, setRestoring] = useState(false)
  const [restoreMessage, setRestoreMessage] = useState("")

  const startBackup = () => {
    if (backingUp) return
    setBackingUp(true)
    setProgress(8)

    const interval = window.setInterval(() => {
      setProgress((current) => {
        const next = Math.min(current + 8, 100)
        if (next === 100) {
          window.clearInterval(interval)
          window.setTimeout(() => {
            setBackingUp(false)
            setLastBackup("Just now")
            setBackupHistory((current) => [
              {
                id: Date.now(),
                date: "Just now",
                label: "Business cloud backup",
                meta: "12,450 records · 4.2 MB",
                type: "Manual",
              },
              ...current,
            ])
          }, 350)
        }
        return next
      })
    }, 140)
  }

  const syncSales = () => {
    if (syncing) return
    setSyncing(true)
    window.setTimeout(() => {
      setQueuedSales(0)
      setLastSalesSync("Just now")
      setSyncing(false)
    }, 1500)
  }

  const restoreBackup = () => {
    if (restoring) return
    const selectedBackup = backupHistory.find(
      (backup) => backup.id === selectedBackupId,
    )
    if (!selectedBackup) return

    setRestoring(true)
    setRestoreMessage("")
    window.setTimeout(() => {
      setRestoring(false)
      setRestoreMessage(
        `Restored ${selectedBackup.label.toLowerCase()} from ${selectedBackup.date}.`,
      )
    }, 1800)
  }

  const sectionLabel = {
    color: c.muted,
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: 0.8,
    textTransform: "uppercase" as const,
    margin: "0 4px 8px",
  }

  return (
    <div className="screen" style={{ background: c.bg }}>
      <header
        style={{
          padding: "52px 20px 24px",
          background: c.headerGradient,
          flexShrink: 0,
          color: c.onNavy,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 22,
          }}
        >
          <button
            type="button"
            aria-label="Go back"
            className="btn"
            onClick={() => onNavigate("more")}
            style={{
              width: 38,
              height: 38,
              border: `1px solid ${c.navyBorder}`,
              borderRadius: 12,
              background: c.navySurface,
              display: "grid",
              placeItems: "center",
            }}
          >
            <Icon name="arrow-left" size={18} color={c.onNavy} />
          </button>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: -0.2 }}>
              Backup & sync
            </div>
            <div style={{ marginTop: 2, color: c.onNavyMuted, fontSize: 11 }}>
              Business protection center
            </div>
          </div>
          <div
            style={{
              marginLeft: "auto",
              display: "flex",
              alignItems: "center",
              gap: 6,
              color: c.gold,
              fontSize: 11,
              fontWeight: 700,
            }}
          >
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: c.gold,
              }}
            />
            Protected
          </div>
        </div>

        <div
          style={{
            padding: 18,
            borderRadius: 20,
            background: c.navySurface,
            border: `1px solid ${c.navyBorder}`,
            boxShadow: c.shadow,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div
              style={{
                width: 46,
                height: 46,
                borderRadius: 15,
                display: "grid",
                placeItems: "center",
                color: c.gold,
                background: c.navySurface,
                border: `1px solid ${c.navyBorder}`,
              }}
            >
              <Icon name="shield" size={24} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 800 }}>
                Your data is protected
              </div>
              <div style={{ marginTop: 4, color: c.onNavyMuted, fontSize: 11 }}>
                Latest encrypted backup · {lastBackup}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 17, fontWeight: 800 }}>4.2 MB</div>
              <div style={{ color: c.onNavyFaint, fontSize: 10 }}>
                encrypted
              </div>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              marginTop: 16,
              paddingTop: 14,
              borderTop: `1px solid ${c.navyDivider}`,
            }}
          >
            {[
              ["Cloud", "Current"],
              ["Device", "Ready"],
              [
                "Sync",
                syncing
                  ? "Syncing"
                  : queuedSales > 0
                    ? `${queuedSales} queued`
                    : "Complete",
              ],
            ].map(([label, value], index) => (
              <div
                key={label}
                style={{
                  textAlign: "center",
                  borderRight:
                    index < 2 ? `1px solid ${c.navyDivider}` : "none",
                }}
              >
                <div
                  style={{
                    color: c.onNavyFaint,
                    fontSize: 9,
                    textTransform: "uppercase",
                    letterSpacing: 0.7,
                  }}
                >
                  {label}
                </div>
                <div style={{ marginTop: 3, fontSize: 11, fontWeight: 700 }}>
                  {value}
                </div>
              </div>
            ))}
          </div>

          {backingUp && (
            <div aria-live="polite" style={{ marginTop: 14 }}>
              <div
                style={{
                  height: 5,
                  borderRadius: 999,
                  overflow: "hidden",
                  background: c.navyDivider,
                }}
              >
                <div
                  style={{
                    width: `${progress}%`,
                    height: "100%",
                    borderRadius: 999,
                    background: c.successGradient,
                    transition: "width 160ms ease",
                  }}
                />
              </div>
              <div
                style={{
                  marginTop: 6,
                  color: c.gold,
                  fontSize: 10,
                  fontWeight: 700,
                }}
              >
                Creating secure snapshot · {progress}%
              </div>
            </div>
          )}
        </div>
      </header>

      <main className="scroll-area" style={{ padding: 16, paddingBottom: 80 }}>
        <button
          type="button"
          className="btn"
          onClick={startBackup}
          disabled={backingUp}
          style={{
            width: "100%",
            minHeight: 50,
            border: "none",
            borderRadius: 15,
            background: backingUp ? c.cardAlt : c.primaryGradient,
            color: backingUp ? c.muted : c.onNavy,
            boxShadow: backingUp ? "none" : c.shadow,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 9,
            fontFamily: "inherit",
            fontSize: 14,
            fontWeight: 800,
          }}
        >
          <Icon name={backingUp ? "refresh" : "cloud"} size={19} />
          {backingUp ? `Backing up · ${progress}%` : "Back up now"}
        </button>

        <div style={{ marginTop: 22, ...sectionLabel }}>Protection</div>
        <section
          className="card"
          aria-label="Backup protection"
          style={{ marginBottom: 20 }}
        >
          {[
            {
              icon: "database" as IconName,
              title: "Business cloud backup",
              detail: "12,450 records · Today, 6:00 AM",
              status: "Current",
              tone: c.success,
              background: c.successBg,
            },
            {
              icon: "device" as IconName,
              title: "Offline data on this device",
              detail: "16 datasets ready",
              status: "Ready",
              tone: c.primary,
              background: c.infoBg,
            },
            {
              icon: "refresh" as IconName,
              title: "Sales sync",
              detail: syncing
                ? "Uploading queued cash sales…"
                : queuedSales > 0
                  ? `${queuedSales} sales waiting · Last sync ${lastSalesSync}`
                  : `All sales uploaded · ${lastSalesSync}`,
              status: syncing
                ? "Syncing"
                : queuedSales > 0
                  ? "Sync now"
                  : "Synced",
              tone: syncing || queuedSales > 0 ? c.warning : c.success,
              background:
                syncing || queuedSales > 0 ? c.warningBg : c.successBg,
              action: syncSales,
            },
          ].map((item, index) => (
            <div
              key={item.title}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "14px 15px",
                borderBottom: index < 2 ? c.divider : "none",
              }}
            >
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 12,
                  flexShrink: 0,
                  display: "grid",
                  placeItems: "center",
                  color: item.tone,
                  background: item.background,
                }}
              >
                <Icon name={item.icon} size={19} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: c.text, fontSize: 12, fontWeight: 700 }}>
                  {item.title}
                </div>
                <div style={{ marginTop: 2, color: c.muted, fontSize: 10 }}>
                  {item.detail}
                </div>
              </div>
              {"action" in item ? (
                <button
                  type="button"
                  className="btn"
                  onClick={item.action}
                  disabled={syncing}
                  style={{
                    padding: "6px 9px",
                    border: "none",
                    borderRadius: 999,
                    color: item.tone,
                    background: item.background,
                    fontFamily: "inherit",
                    fontSize: 9,
                    fontWeight: 800,
                  }}
                >
                  {item.status}
                </button>
              ) : (
                <div
                  style={{
                    padding: "4px 8px",
                    borderRadius: 999,
                    color: item.tone,
                    background: item.background,
                    fontSize: 9,
                    fontWeight: 800,
                  }}
                >
                  {item.status}
                </div>
              )}
            </div>
          ))}
        </section>

        <div style={sectionLabel}>Automatic protection</div>
        <section
          className="card"
          aria-label="Automatic backup settings"
          style={{ marginBottom: 20 }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "15px",
            }}
          >
            <div style={{ flex: 1 }}>
              <div style={{ color: c.text, fontSize: 13, fontWeight: 700 }}>
                Automatic backups
              </div>
              <div style={{ marginTop: 3, color: c.muted, fontSize: 10 }}>
                Daily at 6:00 AM
              </div>
            </div>
            <Toggle
              checked={autoBackup}
              onChange={() => setAutoBackup((value) => !value)}
              label="Automatic backups"
            />
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "15px",
              borderTop: c.divider,
            }}
          >
            <div style={{ flex: 1 }}>
              <div style={{ color: c.text, fontSize: 13, fontWeight: 700 }}>
                Wi-Fi only
              </div>
              <div style={{ marginTop: 3, color: c.muted, fontSize: 10 }}>
                Avoid mobile data for device copies
              </div>
            </div>
            <Toggle
              checked={wifiOnly}
              onChange={() => setWifiOnly((value) => !value)}
              label="Wi-Fi only"
            />
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "15px",
              borderTop: c.divider,
            }}
          >
            <div style={{ flex: 1 }}>
              <div style={{ color: c.text, fontSize: 13, fontWeight: 700 }}>
                Automatic sales sync
              </div>
              <div style={{ marginTop: 3, color: c.muted, fontSize: 10 }}>
                {autoSync
                  ? "On · syncs when internet returns"
                  : "Off · use Sync now in Protection"}
              </div>
            </div>
            <Toggle
              checked={autoSync}
              onChange={() => {
                const nextValue = !autoSync
                setAutoSync(nextValue)
                if (nextValue && queuedSales > 0)
                  window.setTimeout(syncSales, 300)
              }}
              label="Automatic sales sync"
            />
          </div>
        </section>

        <div style={sectionLabel}>Recovery</div>
        <section
          className="card"
          aria-label="Restore data"
          style={{
            marginBottom: 20,
            overflow: "hidden",
          }}
        >
          <button
            type="button"
            className="btn"
            onClick={() => setRestoreOpen((open) => !open)}
            style={{
              width: "100%",
              padding: 15,
              border: "none",
              background: "none",
              display: "flex",
              alignItems: "center",
              gap: 12,
              textAlign: "left",
              fontFamily: "inherit",
            }}
          >
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                background: c.infoBg,
                color: c.primary,
                display: "grid",
                placeItems: "center",
                flexShrink: 0,
              }}
            >
              <Icon name="restore" size={20} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ color: c.text, fontSize: 13, fontWeight: 700 }}>
                Restore from a backup
              </div>
              <div style={{ marginTop: 3, color: c.muted, fontSize: 10 }}>
                Choose a secure restore point
              </div>
            </div>
            <span
              style={{
                width: 34,
                height: 34,
                borderRadius: 11,
                background: c.cardAlt,
                color: c.muted,
                display: "grid",
                placeItems: "center",
                transform: restoreOpen ? "rotate(90deg)" : "none",
                transition: "transform 160ms ease",
              }}
            >
              <Icon name="chevron" size={17} />
            </span>
          </button>

          {restoreOpen && (
            <div style={{ padding: "0 15px 15px", borderTop: c.divider }}>
              <div
                style={{
                  padding: "12px 0 7px",
                  color: c.muted,
                  fontSize: 10,
                  fontWeight: 700,
                }}
              >
                Select a backup
              </div>
              {backupHistory.slice(0, 3).map((backup) => {
                const selected = selectedBackupId === backup.id
                return (
                  <button
                    key={backup.label + backup.id.toLocaleString()}
                    type="button"
                    className="btn"
                    onClick={() => setSelectedBackupId(backup.id)}
                    style={{
                      width: "100%",
                      padding: "10px 0",
                      border: "none",
                      borderTop: c.divider,
                      background: "none",
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      textAlign: "left",
                      fontFamily: "inherit",
                    }}
                  >
                    <span
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: "50%",
                        border: `2px solid ${selected ? c.primary : c.faint}`,
                        display: "grid",
                        placeItems: "center",
                        flexShrink: 0,
                      }}
                    >
                      {selected && (
                        <span
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            background: c.primary,
                          }}
                        />
                      )}
                    </span>
                    <span style={{ flex: 1 }}>
                      <span
                        style={{
                          display: "block",
                          color: c.text,
                          fontSize: 11,
                          fontWeight: 700,
                        }}
                      >
                        {backup.label}
                      </span>
                      <span
                        style={{
                          display: "block",
                          marginTop: 2,
                          color: c.muted,
                          fontSize: 9,
                        }}
                      >
                        {backup.date} · {backup.meta}
                      </span>
                    </span>
                    <span
                      style={{
                        padding: "3px 7px",
                        borderRadius: 999,
                        color: backup.type === "Manual" ? c.primary : c.muted,
                        background:
                          backup.type === "Manual" ? c.infoBg : c.cardAlt,
                        fontSize: 9,
                        fontWeight: 800,
                      }}
                    >
                      {backup.type}
                    </span>
                  </button>
                )
              })}
              <button
                type="button"
                className="btn"
                onClick={restoreBackup}
                disabled={restoring}
                style={{
                  width: "100%",
                  minHeight: 42,
                  marginTop: 8,
                  border: "none",
                  borderRadius: 12,
                  background: restoring ? c.cardAlt : c.primaryGradient,
                  color: restoring ? c.muted : c.onNavy,
                  fontFamily: "inherit",
                  fontSize: 12,
                  fontWeight: 800,
                }}
              >
                {restoring
                  ? "Restoring secure backup…"
                  : "Restore selected backup"}
              </button>
              {restoreMessage && (
                <div
                  role="status"
                  style={{
                    marginTop: 9,
                    color: c.success,
                    fontSize: 10,
                    lineHeight: 1.4,
                  }}
                >
                  {restoreMessage}
                </div>
              )}
            </div>
          )}
        </section>

        <div style={sectionLabel}>Backup history</div>
        <section
          className="card"
          aria-label="Backup history"
          style={{ marginBottom: 14 }}
        >
          {backupHistory.slice(0, 5).map((item, index) => (
            <div
              key={item.label + index}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 11,
                padding: "13px 15px",
                borderBottom:
                  index < Math.min(backupHistory.length, 5) - 1
                    ? c.divider
                    : "none",
              }}
            >
              <div
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: "50%",
                  background: c.successBg,
                  color: c.success,
                  display: "grid",
                  placeItems: "center",
                  flexShrink: 0,
                }}
              >
                <Icon name="check" size={15} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: c.text, fontSize: 11, fontWeight: 700 }}>
                  {item.label}
                </div>
                <div style={{ marginTop: 3, color: c.muted, fontSize: 9 }}>
                  {item.meta}
                </div>
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-end",
                  gap: 4,
                  whiteSpace: "nowrap",
                }}
              >
                <span
                  style={{
                    padding: "3px 7px",
                    borderRadius: 999,
                    color: item.type === "Manual" ? c.primary : c.muted,
                    background: item.type === "Manual" ? c.infoBg : c.cardAlt,
                    fontSize: 9,
                    fontWeight: 800,
                  }}
                >
                  {item.type}
                </span>
                <span style={{ color: c.faint, fontSize: 9 }}>{item.date}</span>
              </div>
            </div>
          ))}
        </section>

        <div
          role="note"
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 9,
            padding: "12px 13px",
            borderRadius: 13,
            color: c.muted,
            background: c.cardAlt,
            fontSize: 10,
            lineHeight: 1.5,
          }}
        >
          <span style={{ color: c.primary, flexShrink: 0, marginTop: 1 }}>
            <Icon name="shield" size={15} />
          </span>
          Backups are encrypted. Offline data stays on this device; cloud copies
          protect you if the device is lost.
        </div>
      </main>
    </div>
  )
}
