"use client"

import { useMemo, useState } from 'react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'


type Tone = 'healthy' | 'info' | 'warning' | 'critical'
type Kpi = { label: string; value: string; note: string; tone?: Tone }
type WorkspaceConfig = {
  eyebrow: string
  title: string
  description: string
  action: string
  kpis: Kpi[]
  columns: string[]
  rows: string[][]
  attention: { title: string; detail: string; tone: Tone }[]
}

const sharedKpis: Kpi[] = [
  { label: 'Operational records', value: '1,284', note: '+38 this month', tone: 'info' },
  { label: 'Healthy', value: '98.7%', note: 'Within SLO', tone: 'healthy' },
  { label: 'Requires attention', value: '17', note: '4 critical', tone: 'warning' },
  { label: 'Last refresh', value: '12s', note: 'Live data', tone: 'info' },
]

export const workspaceMeta: Record<string, { eyebrow: string; title: string; description: string }> = {
  transactions: { eyebrow: 'Operations', title: 'Transaction Telemetry', description: 'Platform-wide payment volume, authorization health, and execution inspection.' },
  'sync-health': { eyebrow: 'Offline resilience', title: 'Sync Control Center', description: 'Reconciliation pipelines, conflicts, retries, and terminal synchronization health.' },
  devices: { eyebrow: 'Terminal fleet', title: 'Device Management', description: 'Physical register health, heartbeat state, shifts, and remote controls.' },
  webhooks: { eyebrow: 'API observability', title: 'API & Webhook Monitoring', description: 'Endpoint availability, callback delivery, retries, and payload inspection.' },
  jobs: { eyebrow: 'Automation', title: 'Background Jobs', description: 'Worker execution, queues, retries, duration, and failure control.' },
  incidents: { eyebrow: 'Reliability', title: 'Incident Center', description: 'Coordinate platform incidents, tenant communication, root cause, and resolution.' },
  'tenant-health': { eyebrow: 'Tenant operations', title: 'Tenant Health', description: 'Cross-tenant service health, risk, activity, and intervention requirements.' },
  roles: { eyebrow: 'Identity & access', title: 'Roles & Permissions', description: 'Role policy, permission matrices, and platform clearance boundaries.' },
  sessions: { eyebrow: 'Identity & access', title: 'Active Sessions', description: 'Concurrent sessions, devices, token age, and access termination.' },
  'audit-logs': { eyebrow: 'Identity & access', title: 'Audit Logs', description: 'Search every sensitive platform mutation and administrative access event.' },
  subscriptions: { eyebrow: 'Billing', title: 'Subscriptions', description: 'Billing cycles, renewals, trials, grace periods, and recurring contracts.' },
  invoices: { eyebrow: 'Billing', title: 'Invoices', description: 'Invoice issuance, payment state, aging, and collection operations.' },
  'billing-payments': { eyebrow: 'Billing', title: 'Billing Payments', description: 'Subscription collections, failed charges, refunds, and payment allocation.' },
  revenue: { eyebrow: 'Billing', title: 'Revenue Intelligence', description: 'MRR, ARR, expansion, contraction, churn, and collection performance.' },
  mpesa: { eyebrow: 'Payments', title: 'M-PESA Operations', description: 'Real-time STK requests, callbacks, confirmations, reversals, and receipt creation.' },
  reconciliation: { eyebrow: 'Payments', title: 'Reconciliation Center', description: 'Match POS expectations against received M-PESA settlement records.' },
  'payment-events': { eyebrow: 'Payments', title: 'Payment Events', description: 'Immutable event stream across M-PESA, cash, card, bank, and credit.' },
  security: { eyebrow: 'Security & compliance', title: 'Security Center', description: 'Platform posture, credential hygiene, access risk, and encryption controls.' },
  compliance: { eyebrow: 'Security & compliance', title: 'KRA / VAT / eTIMS', description: 'Tenant tax compliance, eTIMS connectivity, VAT validation, and filing health.' },
  'security-events': { eyebrow: 'Security & compliance', title: 'Security Events', description: 'Suspicious access, failed signatures, token misuse, and credential incidents.' },
  'feature-flags': { eyebrow: 'Platform', title: 'Feature Flags', description: 'Controlled rollout by environment, tenant cohort, plan, and percentage.' },
  integrations: { eyebrow: 'Platform', title: 'Integration Control Center', description: 'Daraja, M-PESA, eTIMS, messaging, webhook, and external API health.' },
  notifications: { eyebrow: 'Platform', title: 'Notification Operations', description: 'Global push, SMS, email, targeting, templates, and delivery state.' },
  'system-settings': { eyebrow: 'Platform', title: 'System Settings', description: 'Global defaults, service limits, operational policy, and platform metadata.' },
  backups: { eyebrow: 'Data & recovery', title: 'Data & Recovery', description: 'Backups, restore points, retention, exports, imports, and disaster readiness.' },
  support: { eyebrow: 'Support', title: 'Support Center', description: 'Tenant-aware support operations with complete troubleshooting context.' },
  announcements: { eyebrow: 'Support', title: 'Announcements', description: 'Operational notices, maintenance communication, and targeted tenant updates.' },
  'system-status': { eyebrow: 'Support', title: 'System Status', description: 'Internal uptime history and current platform service availability.' },
}

const configs: Record<string, WorkspaceConfig> = {
  transactions: {
    ...workspaceMeta.transactions, action: 'Export transaction ledger',
    kpis: [
      { label: 'Total GTV', value: 'KSh 2.18B', note: '+14.2% vs prior period', tone: 'healthy' },
      { label: 'Transactions today', value: '148,392', note: '6,184 per hour', tone: 'info' },
      { label: 'Authorization success', value: '98.4%', note: 'SLO 98.0%', tone: 'healthy' },
      { label: 'Median authorization', value: '2.4s', note: 'P95 5.8s', tone: 'info' },
      { label: 'Failed', value: '1.6%', note: '2,374 transactions', tone: 'critical' },
      { label: 'Pending', value: '342', note: 'Oldest 41 seconds', tone: 'warning' },
    ],
    columns: ['Time', 'Reference', 'Tenant / Business', 'Method', 'Amount', 'Status', 'Duration'],
    rows: [
      ['10:42:18', 'STK_9K4H2A81', 'T-002 · Barngetuny Plaza', 'M-PESA', 'KSh 4,850', 'PENDING', '18.2s'],
      ['10:42:11', 'RCP-882104', 'T-018 · Tulia Mini Mart', 'CASH', 'KSh 1,250', 'SUCCESS', '0.4s'],
      ['10:41:56', 'STK_Q81MX902', 'T-041 · Jirani Stores', 'M-PESA', 'KSh 12,400', 'SUCCESS', '3.1s'],
      ['10:41:39', 'CRD_10CC721', 'T-077 · Pamoja Goods', 'CARD', 'KSh 8,900', 'FAILED', '7.8s'],
      ['10:41:22', 'BNK_PQ11409', 'T-102 · Taifa Supermarket', 'BANK', 'KSh 42,000', 'SUCCESS', '1.9s'],
    ],
    attention: [{ title: 'M-PESA callback latency elevated', detail: '18 transactions exceeded the 15-second callback SLO.', tone: 'warning' }],
  },
  mpesa: {
    ...workspaceMeta.mpesa, action: 'Open Daraja diagnostics',
    kpis: [
      { label: 'M-PESA volume today', value: 'KSh 84.2M', note: '109,418 payments', tone: 'healthy' },
      { label: 'STK success', value: '98.7%', note: '+0.4% today', tone: 'healthy' },
      { label: 'Callbacks pending', value: '184', note: 'Oldest 38 seconds', tone: 'warning' },
      { label: 'Reversals', value: '31', note: 'KSh 142,850', tone: 'info' },
    ],
    columns: ['Time', 'Tenant', 'Business', 'Amount', 'Phone', 'STK Request', 'Status', 'Callback', 'Duration'],
    rows: [
      ['10:42:18', 'T-002', 'Barngetuny Plaza', 'KSh 4,850', '254712•••418', 'ws_CO_09101842', 'PENDING', 'Awaiting', '18.2s'],
      ['10:42:02', 'T-018', 'Tulia Mini Mart', 'KSh 1,250', '254723•••901', 'ws_CO_09101831', 'SUCCESS', 'HTTP 200', '3.4s'],
      ['10:41:44', 'T-041', 'Jirani Stores', 'KSh 12,400', '254734•••220', 'ws_CO_09101792', 'FAILED', 'HTTP 400', '6.1s'],
      ['10:41:11', 'T-077', 'Pamoja Goods', 'KSh 890', '254710•••871', 'ws_CO_09101724', 'TIMEOUT', 'No callback', '31.8s'],
      ['10:40:52', 'T-102', 'Taifa Supermarket', 'KSh 6,200', '254745•••118', 'ws_CO_09101688', 'REVERSED', 'HTTP 200', '4.8s'],
    ],
    attention: [{ title: 'Daraja timeout concentration', detail: 'T-077 generated 12 timeout responses in the last 15 minutes.', tone: 'critical' }],
  },
  devices: {
    ...workspaceMeta.devices, action: 'Register device',
    kpis: [
      { label: 'Registered devices', value: '3,842', note: 'Across 1,284 tenants', tone: 'info' },
      { label: 'Online', value: '3,611', note: '94.0% fleet', tone: 'healthy' },
      { label: 'Offline', value: '184', note: '42 over 24 hours', tone: 'warning' },
      { label: 'Attention required', value: '47', note: '11 cash variances', tone: 'critical' },
    ],
    columns: ['Device', 'Tenant / Store', 'App', 'Heartbeat', 'Battery', 'Network', 'Sync Queue', 'Current Shift', 'Variance', 'Status'],
    rows: [
      ['POS-ELD-001', 'T-002 · Shop 18', 'v2.4.18', '8s ago', '86%', 'Safaricom 4G', '0', 'Morning · Grace W.', 'KSh 0', 'ONLINE'],
      ['POS-KSM-004', 'T-018 · Main Till', 'v2.4.17', '31s ago', '42%', 'Wi-Fi', '18', 'Morning · Faith O.', 'KSh -500', 'SYNCING'],
      ['POS-NKR-011', 'T-041 · Counter 2', 'v2.3.92', '2h ago', '18%', 'Offline', '86', 'Afternoon · Peter K.', 'KSh 1,200', 'ATTENTION'],
      ['POS-THK-002', 'T-077 · Main', 'v2.4.18', '3d ago', '—', 'Offline', '0', 'None', 'KSh 0', 'BLOCKED'],
    ],
    attention: [{ title: '11 registers have unresolved cash variance', detail: 'Combined unexplained variance is KSh 18,450.', tone: 'critical' }],
  },
  'sync-health': {
    ...workspaceMeta['sync-health'], action: 'Run global retry',
    kpis: [
      { label: 'Queued', value: '482', note: 'Oldest 4m 12s', tone: 'warning' },
      { label: 'Processing', value: '74', note: 'Across 28 workers', tone: 'info' },
      { label: 'Completed today', value: '1.84M', note: '99.92% reconciled', tone: 'healthy' },
      { label: 'Conflicts', value: '18', note: '6 stock collisions', tone: 'critical' },
      { label: 'Failed', value: '9', note: 'Automatic retry armed', tone: 'critical' },
    ],
    columns: ['Timestamp', 'Tenant', 'Device', 'Operation', 'Entity', 'Status', 'Retries'],
    rows: [
      ['10:42:18.221', 'T-002', 'POS-ELD-001', 'UPSERT', 'Sale RCP-882104', 'RECONCILED', '0'],
      ['10:42:17.918', 'T-018', 'POS-KSM-004', 'UPDATE', 'Product SKU-104', 'CONFLICT', '2'],
      ['10:42:14.441', 'T-041', 'POS-NKR-011', 'CREATE', 'Expense EXP-4011', 'PROCESSING', '1'],
      ['10:42:09.200', 'T-077', 'POS-THK-002', 'UPLOAD', 'Shift SFT-8901', 'FAILED', '5'],
    ],
    attention: [{ title: 'SKU-104 quantity conflict', detail: 'Server 15 · Terminal 10 · Expected 15 · Difference −5.', tone: 'critical' }],
  },
  reconciliation: {
    ...workspaceMeta.reconciliation, action: 'Run reconciliation',
    kpis: [
      { label: 'M-PESA received', value: 'KSh 84.2M', note: 'Today', tone: 'healthy' },
      { label: 'POS expected', value: 'KSh 84.17M', note: '109,418 transactions', tone: 'info' },
      { label: 'Matched', value: '99.82%', note: '109,221 records', tone: 'healthy' },
      { label: 'Unmatched', value: '197', note: 'KSh 32,480', tone: 'critical' },
      { label: 'Net variance', value: 'KSh 29,750', note: 'Requires review', tone: 'warning' },
    ],
    columns: ['Date', 'Tenant', 'POS Expected', 'M-PESA Received', 'Variance', 'Transactions', 'Status'],
    rows: [
      ['09 Oct 2026', 'T-002 · Barngetuny Plaza', 'KSh 284,250', 'KSh 284,250', 'KSh 0', '418', 'MATCHED'],
      ['09 Oct 2026', 'T-018 · Tulia Mini Mart', 'KSh 198,400', 'KSh 196,900', 'KSh -1,500', '291', 'PARTIAL'],
      ['09 Oct 2026', 'T-041 · Jirani Stores', 'KSh 142,800', 'KSh 0', 'KSh -142,800', '184', 'UNMATCHED'],
      ['08 Oct 2026', 'T-077 · Pamoja Goods', 'KSh 91,200', 'KSh 90,850', 'KSh -350', '117', 'REVIEW REQUIRED'],
    ],
    attention: [{ title: 'T-041 settlement file unavailable', detail: 'Daraja C2B settlement response has not arrived for the current window.', tone: 'critical' }],
  },
  security: {
    ...workspaceMeta.security, action: 'Run posture scan',
    kpis: [
      { label: 'Security posture', value: '94 / 100', note: '+2 this month', tone: 'healthy' },
      { label: '2FA coverage', value: '96.8%', note: '176 users missing', tone: 'warning' },
      { label: 'Stale sessions', value: '42', note: 'Older than 30 days', tone: 'warning' },
      { label: 'Critical events', value: '3', note: 'Last 24 hours', tone: 'critical' },
    ],
    columns: ['Time', 'User', 'Tenant', 'Event', 'IP', 'Device', 'Risk', 'Action'],
    rows: [
      ['10:41 EAT', 'Daniel Kamar', 'Platform', 'SUPER_ADMIN login', '102.68.14.22', 'Chrome · macOS', 'LOW', 'Verified'],
      ['10:18 EAT', 'Unknown', 'T-077', 'Invalid refresh token', '105.163.4.91', 'Android ADB-902', 'HIGH', 'Blocked'],
      ['09:56 EAT', 'Diana Kiplagat', 'T-002', 'M-PESA credential viewed', '41.90.72.18', 'Chrome · Windows', 'MEDIUM', 'Review'],
      ['09:22 EAT', 'Brian Kiptoo', 'T-018', 'Webhook signature failed', '197.248.10.6', 'API client', 'CRITICAL', 'Investigate'],
    ],
    attention: [
      { title: '3 failed webhook signatures', detail: 'Requests originated from an unrecognized IP range.', tone: 'critical' },
      { title: '176 users without 2FA', detail: 'Mostly cashier identities provisioned before policy enforcement.', tone: 'warning' },
    ],
  },
  support: {
    ...workspaceMeta.support, action: 'Create support ticket',
    kpis: [
      { label: 'Open tickets', value: '84', note: '−12 today', tone: 'info' },
      { label: 'P1 critical', value: '3', note: 'SLA 15 minutes', tone: 'critical' },
      { label: 'P2 high', value: '18', note: 'SLA 2 hours', tone: 'warning' },
      { label: 'Waiting for customer', value: '21', note: 'Oldest 3 days', tone: 'info' },
      { label: 'Resolved today', value: '47', note: 'Median 38 minutes', tone: 'healthy' },
    ],
    columns: ['Ticket', 'Tenant', 'Issue', 'Priority', 'Status', 'Assigned', 'Updated'],
    rows: [
      ['SUP-10482', 'T-002 · Barngetuny Plaza', 'M-PESA callback not updating receipt', 'P1', 'INVESTIGATING', 'Mercy N.', '2 min ago'],
      ['SUP-10479', 'T-018 · Tulia Mini Mart', 'Offline stock conflict after reconnect', 'P2', 'OPEN', 'Kevin O.', '18 min ago'],
      ['SUP-10468', 'T-041 · Jirani Stores', 'License renewal payment not allocated', 'P2', 'WAITING', 'Faith K.', '1h ago'],
      ['SUP-10422', 'T-077 · Pamoja Goods', 'Register cannot complete backup', 'P3', 'RESOLVED', 'Mercy N.', '3h ago'],
    ],
    attention: [{ title: 'P1 ticket SUP-10482 approaching SLA', detail: '13 of 15 response minutes consumed.', tone: 'critical' }],
  },
  incidents: {
    ...workspaceMeta.incidents, action: 'Create incident',
    kpis: [
      { label: 'Open incidents', value: '2', note: '1 actively mitigating', tone: 'warning' },
      { label: 'P1 critical', value: '0', note: 'No platform outage', tone: 'healthy' },
      { label: 'Affected tenants', value: '18', note: '1.4% of platform', tone: 'warning' },
      { label: 'MTTR · 30 days', value: '24m', note: '−8m improvement', tone: 'healthy' },
    ],
    columns: ['Incident', 'Severity', 'Status', 'Affected services', 'Tenants', 'Started', 'Commander'],
    rows: [
      ['INC-2026-041', 'P2 HIGH', 'MONITORING', 'Daraja callbacks', '18', '09:44 EAT', 'Daniel Kamar'],
      ['INC-2026-040', 'P3 MEDIUM', 'INVESTIGATING', 'Sync worker KE-WEST-02', '7', '08:19 EAT', 'Mercy Njeri'],
      ['INC-2026-039', 'P3 MEDIUM', 'RESOLVED', 'Email notifications', '84', 'Yesterday 16:12', 'Kevin Otieno'],
    ],
    attention: [{ title: 'Daraja callback latency', detail: 'Mitigation deployed. Monitoring callback P95 before resolution.', tone: 'warning' }],
  },
  webhooks: {
    ...workspaceMeta.webhooks, action: 'Replay failed webhooks',
    kpis: [{ label: 'Requests today', value: '18.4M', note: '2,840 req/min', tone: 'info' },{ label: 'Success rate', value: '99.94%', note: 'SLO 99.9%', tone: 'healthy' },{ label: 'Error rate', value: '0.06%', note: '11,042 errors', tone: 'warning' },{ label: 'P95 latency', value: '284ms', note: '−18ms today', tone: 'healthy' },{ label: 'Webhook success', value: '99.71%', note: '1.82M delivered', tone: 'healthy' },{ label: 'Webhook failures', value: '312', note: '81 retrying', tone: 'critical' }],
    columns: ['Endpoint / Webhook', 'Tenant', 'Event', 'Requests', 'Errors', 'P95 Latency', 'Retries', 'Status'],
    rows: [['POST /api/mpesa/callback','T-002','payment.confirmed','284,192','18','182ms','0','HEALTHY'],['POST /webhooks/tenant/T-018','T-018','sale.created','118,440','42','241ms','2','RETRYING'],['POST /api/etims/result','T-041','invoice.validated','42,198','8','390ms','1','HEALTHY'],['POST /webhooks/external','T-077','stock.adjusted','18,004','31','1.8s','5','FAILED']],
    attention: [{ title: 'Webhook endpoint T-077 repeatedly failing', detail: 'HTTP 401 returned across five retry attempts.', tone: 'critical' }],
  },
  jobs: {
    ...workspaceMeta.jobs, action: 'Run selected worker',
    kpis: [{ label: 'Running', value: '8', note: 'Across 12 workers', tone: 'info' },{ label: 'Completed today', value: '18,492', note: '99.8% success', tone: 'healthy' },{ label: 'Failed', value: '14', note: '3 exhausted retries', tone: 'critical' },{ label: 'Queued', value: '284', note: 'Oldest 48 seconds', tone: 'warning' }],
    columns: ['Job', 'Status', 'Started', 'Duration', 'Retries', 'Worker', 'Next run'],
    rows: [['Billing Warnings','COMPLETED','06:00 EAT','142ms','0','worker-billing-02','Tomorrow 06:00'],['Webhook Retries','RUNNING','10:41 EAT','38s','2','worker-hooks-04','Continuous'],['Sync Processor','RUNNING','10:42 EAT','11s','0','worker-sync-11','Continuous'],['Notifications','QUEUED','—','—','1','worker-push-03','In 12s'],['Report Generator','FAILED','10:18 EAT','4m 12s','5','worker-report-01','Manual retry'],['Backups','COMPLETED','02:00 EAT','18m 41s','0','worker-backup-02','Tomorrow 02:00']],
    attention: [{ title: 'Report Generator exhausted retries', detail: 'Tenant shard KE-WEST-02 returned a database pool timeout.', tone: 'critical' }],
  },
  roles: {
    ...workspaceMeta.roles, action: 'Create role policy',
    kpis: [{ label: 'Roles', value: '4', note: 'Platform defaults', tone: 'info' },{ label: 'Permissions', value: '48', note: '7 sensitive actions', tone: 'warning' },{ label: 'Assigned users', value: '5,527', note: 'Across all tenants', tone: 'healthy' },{ label: 'Policy changes', value: '3', note: 'Last 7 days', tone: 'info' }],
    columns: ['Role', 'Users', 'View', 'Create', 'Edit', 'Delete', 'Approve', 'Export', 'Admin'],
    rows: [['SUPER_ADMIN','4','YES','YES','YES','YES','YES','YES','YES'],['STORE_OWNER','1,284','YES','YES','YES','YES','YES','YES','NO'],['ACCOUNTANT','427','YES','YES','YES','NO','YES','YES','NO'],['CASHIER','3,812','YES','YES','LIMITED','NO','NO','NO','NO']],
    attention: [{ title: 'Permission review due', detail: 'STORE_OWNER destructive permissions have not been reviewed in 90 days.', tone: 'warning' }],
  },
  'audit-logs': {
    ...workspaceMeta['audit-logs'], action: 'Export audit ledger',
    kpis: [{ label: 'Events today', value: '482,104', note: '100% mutation coverage', tone: 'healthy' },{ label: 'Critical', value: '12', note: '8 reviewed', tone: 'critical' },{ label: 'Admin actions', value: '184', note: 'Across 4 admins', tone: 'info' },{ label: 'Retention', value: '7 years', note: 'Compliance policy', tone: 'healthy' }],
    columns: ['When', 'Who', 'What', 'Tenant', 'Where', 'Before → After', 'Request ID', 'Severity'],
    rows: [['10:42:18','Daniel Kamar','Tenant Suspended','T-077','102.68.14.22 · Chrome','active → suspended','REQ-88A10','HIGH'],['10:40:02','Diana Kiplagat','M-PESA Integration Changed','T-002','41.90.72.18 · Windows','Till 4360760 → 1787049','REQ-889F1','CRITICAL'],['10:38:41','Grace Wanjiku','Stock Adjusted','T-002','POS-ELD-001','SKU-104: 10 → 15','REQ-887C2','MEDIUM'],['10:22:11','Platform Worker','License Changed','T-041','worker-billing-02','trial → active','REQ-881B8','LOW']],
    attention: [{ title: 'Sensitive M-PESA configuration changed', detail: 'Till update requires secondary SUPER_ADMIN review.', tone: 'critical' }],
  },
  'feature-flags': {
    ...workspaceMeta['feature-flags'], action: 'Create feature flag',
    kpis: sharedKpis,
    columns: ['Feature', 'Description', 'Environment', 'Targeting', 'Rollout', 'Status'],
    rows: [['Offline Sync v2','Conflict-aware resilient sync pipeline','Production','Selected tenants','25%','ACTIVE'],['M-PESA Auto-Reconciliation','Automated settlement matching','Production','Enterprise','100%','ACTIVE'],['AI Sales Insights','Predictive merchant analytics','Staging','Internal','0%','INACTIVE'],['Receipt QR v2','Dynamic M-PESA payment QR','Production','Everyone','68%','ACTIVE']],
    attention: [{ title: 'Offline Sync v2 rollout paused', detail: 'Conflict rate exceeded 0.2% for cohort KE-WEST.', tone: 'warning' }],
  },
  integrations: {
    ...workspaceMeta.integrations, action: 'Add integration',
    kpis: [{ label: 'Connected', value: '8', note: '7 healthy', tone: 'healthy' },{ label: 'Production', value: '6', note: '2 sandbox', tone: 'info' },{ label: 'Failures today', value: '31', note: 'Mostly webhooks', tone: 'warning' },{ label: 'Credentials expiring', value: '8', note: 'Within 30 days', tone: 'critical' }],
    columns: ['Integration', 'Environment', 'Last success', 'Failure rate', 'Credentials', 'Configuration', 'Status'],
    rows: [['Safaricom Daraja','Production','8s ago','0.04%','Rotated 11d ago','1,241 tenant nodes','HEALTHY'],['M-PESA C2B','Production','4s ago','0.08%','Expires in 84d','Callback v2','HEALTHY'],['KRA eTIMS','Production','2m ago','0.21%','Valid','OSCU enabled','REVIEW'],['SMS · Africa’s Talking','Production','18s ago','0.01%','Valid','Transactional','HEALTHY'],['Push Notifications','Production','6s ago','0.12%','FCM valid','Android','HEALTHY'],['External APIs','Sandbox','31m ago','1.8%','3 active keys','Rate limited','WARNING']],
    attention: [{ title: '8 Daraja credentials expire soon', detail: 'Credential rotation is required before 08 Nov 2026.', tone: 'warning' }],
  },
  backups: {
    ...workspaceMeta.backups, action: 'Create restore point',
    kpis: [{ label: 'Last backup', value: '18m ago', note: 'Completed successfully', tone: 'healthy' },{ label: 'Backup health', value: 'Healthy', note: 'All tenant shards', tone: 'healthy' },{ label: 'Retention', value: '90 days', note: '7-year audit logs', tone: 'info' },{ label: 'Storage', value: '4.8 TB', note: '62% allocated', tone: 'warning' },{ label: 'Restore readiness', value: '100%', note: 'RTO 18 minutes', tone: 'healthy' }],
    columns: ['Restore Point', 'Scope', 'Created', 'Size', 'Retention', 'Encryption', 'Status'],
    rows: [['RST-2026-1009-0200','All tenant shards','Today 02:00','84.2 GB','90 days','AES-256','HEALTHY'],['RST-2026-1008-0200','All tenant shards','Yesterday 02:00','83.9 GB','90 days','AES-256','HEALTHY'],['RST-T002-1007','Tenant T-002','07 Oct 14:22','1.8 GB','30 days','AES-256','HEALTHY']],
    attention: [{ title: 'Quarterly disaster recovery drill due', detail: 'Production restore validation is scheduled for 14 Oct 2026.', tone: 'warning' }],
  },
  'system-status': {
    ...workspaceMeta['system-status'], action: 'Create status incident',
    kpis: [{ label: 'Overall uptime', value: '99.99%', note: 'Last 90 days', tone: 'healthy' },{ label: 'Operational', value: '8 / 8', note: 'All services', tone: 'healthy' },{ label: 'Incidents', value: '2', note: 'Last 30 days', tone: 'info' },{ label: 'Current status', value: 'Operational', note: 'No active outage', tone: 'healthy' }],
    columns: ['Service', 'Current status', '30-day uptime', '90-day uptime', 'P95 latency', 'Last incident'],
    rows: [['MobiDuka API','OPERATIONAL','99.99%','99.98%','182ms','18 days ago'],['Database','OPERATIONAL','100%','99.99%','21ms','42 days ago'],['M-PESA','OPERATIONAL','99.97%','99.94%','2.4s','Today 09:44'],['Sync Engine','OPERATIONAL','99.98%','99.96%','84ms','Today 08:19'],['Webhooks','OPERATIONAL','99.94%','99.92%','284ms','7 days ago'],['Notifications','OPERATIONAL','99.99%','99.97%','118ms','Yesterday'],['Authentication','OPERATIONAL','100%','99.99%','92ms','61 days ago'],['Backups','OPERATIONAL','100%','100%','—','None']],
    attention: [{ title: 'All systems operational', detail: 'No platform service currently has a degraded or outage state.', tone: 'healthy' }],
  },
}

const genericConfig = (key: string): WorkspaceConfig => {
  const meta = workspaceMeta[key] ?? { eyebrow: 'Control plane', title: 'Platform Operations', description: 'Operational records and administrative controls.' }
  const readable = meta.title
  return {
    ...meta,
    action: `Create ${readable.replace(/s$/, '')} record`,
    kpis: sharedKpis,
    columns: ['Identifier', 'Tenant / Scope', 'Operational state', 'Last activity', 'Owner', 'Status'],
    rows: [
      [`${key.toUpperCase().slice(0, 4)}-10482`, 'T-002 · Barngetuny Plaza', `${readable} primary record`, '2 min ago', 'Daniel Kamar', 'ACTIVE'],
      [`${key.toUpperCase().slice(0, 4)}-10479`, 'T-018 · Tulia Mini Mart', `${readable} secondary record`, '18 min ago', 'Mercy Njeri', 'REVIEW'],
      [`${key.toUpperCase().slice(0, 4)}-10468`, 'T-041 · Jirani Stores', `${readable} automated record`, '1h ago', 'Platform Worker', 'HEALTHY'],
      [`${key.toUpperCase().slice(0, 4)}-10422`, 'T-077 · Pamoja Goods', `${readable} archived record`, 'Yesterday', 'Faith Kamau', 'INACTIVE'],
    ],
    attention: [{ title: `${readable} requires review`, detail: 'One operational record has exceeded its configured service-level threshold.', tone: 'warning' }],
  }
}

const chartData = [
  { time: '06:00', value: 820 }, { time: '08:00', value: 1280 }, { time: '10:00', value: 2140 },
  { time: '12:00', value: 1860 }, { time: '14:00', value: 2480 }, { time: '16:00', value: 2320 },
  { time: '18:00', value: 2840 }, { time: '20:00', value: 1760 },
]

function statusTone(value: string) {
  const normalized = value.toUpperCase()
  if (/FAILED|CRITICAL|BLOCKED|UNMATCHED|TIMEOUT|HIGH/.test(normalized)) return 'critical'
  if (/PENDING|WARNING|ATTENTION|PARTIAL|REVIEW|GRACE|SYNCING/.test(normalized)) return 'warning'
  if (/SUCCESS|HEALTHY|ACTIVE|ONLINE|MATCHED|RECONCILED|COMPLETED|LOW/.test(normalized)) return 'healthy'
  return 'info'
}

export function AdminWorkspace({ workspace }: { workspace: string }) {
  const config = configs[workspace] ?? genericConfig(workspace)
  const [period, setPeriod] = useState('Today')
  const [rows, setRows] = useState(config.rows)
  const [selected, setSelected] = useState<string[] | null>(null)
  const [toast, setToast] = useState('')
  const [query, setQuery] = useState('')
  const filtered = useMemo(() => rows.filter(row => row.join(' ').toLowerCase().includes(query.toLowerCase())), [query, rows])
  const isMpesa = workspace === 'mpesa' || workspace === 'transactions'
  const isSync = workspace === 'sync-health'
  const isDevice = workspace === 'devices'
  const isReconciliation = workspace === 'reconciliation'
  const isSecurity = workspace === 'security'
  const isSupport = workspace === 'support'
  const isIncident = workspace === 'incidents'

  const runAction = () => {
    const id = `${workspace.toUpperCase().slice(0, 4)}-${Date.now().toString().slice(-6)}`
    if (/export/i.test(config.action)) {
      const csv = [config.columns.join(','), ...filtered.map(row => row.join(','))].join('\n')
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `${workspace}-ledger.csv`
      anchor.click()
      URL.revokeObjectURL(url)
    } else if (!/run|open|replay/i.test(config.action)) {
      const nextRow = config.columns.map((_, index) => index === 0 ? id : index === 1 ? 'Platform · Global' : index === config.columns.length - 1 ? 'ACTIVE' : 'Pending configuration')
      setRows(current => [nextRow, ...current])
    }
    setToast(`${config.action} completed · ${id}`)
  }

  return (
    <div className="admin-page-stack">
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
            <div><span>LIVE TELEMETRY</span><h2>{isMpesa ? 'Transaction volume & authorization performance' : 'Operational trend'}</h2></div>
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
              if (workspace === 'feature-flags') {
                setRows(current => current.map(record => record === row ? record.map((cell, index) => index === record.length - 1 ? (cell === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE') : cell) : record))
                setToast(`${row[0]} rollout ${row.at(-1) === 'ACTIVE' ? 'disabled' : 'enabled'}`)
              } else if (workspace === 'jobs' && row.includes('FAILED')) {
                setRows(current => current.map(record => record === row ? record.map(cell => cell === 'FAILED' ? 'RUNNING' : cell) : record))
                setToast(`${row[0]} manually retried`)
              } else setSelected(row)
            }}>{workspace === 'feature-flags' ? (row.at(-1) === 'ACTIVE' ? 'Disable' : 'Enable') : workspace === 'jobs' && row.includes('FAILED') ? 'Retry' : 'View'}</button></td></tr>)}</tbody>
          </table>
        </div>
      </section>

      {toast && <div className="ops-toast"><span>✓</span><div><strong>Operation completed</strong><small>{toast}</small></div><button onClick={() => setToast('')}>×</button></div>}

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
              {(isDevice || isSync || isReconciliation) && <button className="admin-secondary-button" onClick={() => setToast(`${isDevice ? 'Force sync' : isSync ? 'Retry' : 'Reconciliation'} queued for ${selected[0]}`)}>{isDevice ? 'Force Sync' : isSync ? 'Retry Operation' : 'Run Reconciliation'}</button>}
              <button className="admin-primary-button" onClick={() => { setRows(current => current.filter(row => row !== selected)); setSelected(null); setToast(`Record ${selected[0]} resolved`) }}>{isIncident ? 'Resolve Incident' : isSupport ? 'Resolve Ticket' : 'Resolve & close'}</button>
            </div>
          </aside>
        </div>
      )}
    </div>
  )
}
