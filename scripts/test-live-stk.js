#!/usr/bin/env node

function parseArgs(argv) {
  const options = {}

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (!arg.startsWith('--')) continue

    const key = arg.slice(2)
    const next = argv[i + 1]

    if (next && !next.startsWith('--')) {
      options[key] = next
      i += 1
    } else {
      options[key] = true
    }
  }

  return options
}

function timestampNow() {
  const now = new Date()
  return [
    now.getUTCFullYear(),
    String(now.getUTCMonth() + 1).padStart(2, '0'),
    String(now.getUTCDate()).padStart(2, '0'),
    String(now.getUTCHours()).padStart(2, '0'),
    String(now.getUTCMinutes()).padStart(2, '0'),
    String(now.getUTCSeconds()).padStart(2, '0'),
  ].join('')
}

function buildPassword({ businessShortCode, passkey, timestamp }) {
  if (!businessShortCode || !passkey || !timestamp) {
    throw new Error('Missing BusinessShortCode, passkey, or timestamp.')
  }
  return Buffer.from(`${businessShortCode}${passkey}${timestamp}`, 'utf8').toString('base64')
}

async function getAccessToken() {
  const consumerKey = process.env.MPESA_CONSUMER_KEY
  const consumerSecret = process.env.MPESA_CONSUMER_SECRET

  if (!consumerKey || !consumerSecret) {
    throw new Error('Missing MPESA_CONSUMER_KEY or MPESA_CONSUMER_SECRET in environment.')
  }

  const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64')
  const response = await fetch('https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials', {
    method: 'GET',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Token request failed: ${response.status} ${body}`)
  }

  const text = await response.text()
  let payload
  try {
    payload = JSON.parse(text)
  } catch {
    throw new Error(`OAuth response was not valid JSON (HTTP ${response.status}): ${text || '<empty body>'}`)
  }

  if (!payload.access_token) {
    throw new Error(`No access_token returned from Safaricom (HTTP ${response.status}): ${text}`)
  }

  return payload.access_token
}

async function main() {
  const args = parseArgs(process.argv.slice(2))

  const config = {
    businessShortCode: args.shortcode ?? process.env.MPESA_SHORTCODE ?? '4221363',
    partyB: args['party-b'] ?? process.env.MPESA_TILL_NUMBER ?? '1787049',
    phoneNumber: args.phone ?? process.env.MPESA_PHONE_NUMBER ?? '254721478065',
    amount: Number(args.amount ?? process.env.MPESA_TEST_AMOUNT ?? '1'),
    accountReference: args.reference ?? process.env.MPESA_ACCOUNT_REFERENCE ?? 'MobiDuka',
    callbackUrl:
      args.callback ??
      process.env.MPESA_CALLBACK_URL ??
      'https://example.com/api/payments/mpesa-callback',
    transactionType: args.type ?? process.env.MPESA_TRANSACTION_TYPE ?? 'CustomerBuyGoodsOnline',
  }

  const passkey = process.env.MPESA_PASSKEY
  if (!passkey) {
    throw new Error('Missing MPESA_PASSKEY in environment.')
  }

  const timestamp = timestampNow()
  const password = buildPassword({
    businessShortCode: config.businessShortCode,
    passkey,
    timestamp,
  })

  const token = await getAccessToken()

  const response = await fetch('https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      BusinessShortCode: config.businessShortCode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: config.transactionType,
      Amount: config.amount,
      PartyA: config.phoneNumber,
      PartyB: config.partyB,
      PhoneNumber: config.phoneNumber,
      CallBackURL: config.callbackUrl,
      AccountReference: config.accountReference,
      TransactionDesc: 'MobiDuka live STK test',
    }),
  })

  const text = await response.text()
  let payload = null
  try {
    payload = JSON.parse(text)
  } catch {
    payload = text
  }

  console.log(JSON.stringify({
    ok: response.ok,
    status: response.status,
    request: {
      BusinessShortCode: config.businessShortCode,
      PartyB: config.partyB,
      TransactionType: config.transactionType,
      Amount: config.amount,
      PhoneNumber: config.phoneNumber,
      Timestamp: timestamp,
      AccountReference: config.accountReference,
      CallbackURL: config.callbackUrl,
      PasswordPreview: `${password.slice(0, 8)}...${password.slice(-8)}`,
    },
    response: payload,
  }, null, 2))
}

main().catch((error) => {
  console.error('Live STK test failed:')
  console.error(error.message)
  process.exit(1)
})
