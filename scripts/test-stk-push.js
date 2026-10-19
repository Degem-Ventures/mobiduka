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
    throw new Error('Missing BusinessShortCode, passkey, or Timestamp.')
  }

  return Buffer.from(`${businessShortCode}${passkey}${timestamp}`, 'utf8').toString('base64')
}

async function getAccessToken() {
  const consumerKey = process.env.MPESA_CONSUMER_KEY
  const consumerSecret = process.env.MPESA_CONSUMER_SECRET

  if (!consumerKey || !consumerSecret) {
    throw new Error('Missing MPESA_CONSUMER_KEY or MPESA_CONSUMER_SECRET in env.')
  }

  const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64')
  const response = await fetch('https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Token request failed: ${response.status} ${body}`)
  }

  const payload = await response.json()
  if (!payload.access_token) {
    throw new Error('No access_token in Safaricom response.')
  }

  return payload.access_token
}

async function pushStk({
  businessShortCode,
  partyB,
  passkey,
  phoneNumber,
  amount,
  accountReference,
  callbackUrl,
}) {
  const ts = timestampNow()
  const password = buildPassword({ businessShortCode, passkey, timestamp: ts })
  const token = await getAccessToken()

  const response = await fetch('https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      BusinessShortCode: businessShortCode,
      Password: password,
      Timestamp: ts,
      TransactionType: 'CustomerBuyGoodsOnline',
      Amount: amount,
      PartyA: phoneNumber,
      PartyB: partyB,
      PhoneNumber: phoneNumber,
      CallBackURL: callbackUrl,
      AccountReference: accountReference,
      TransactionDesc: 'MobiDuka test payment',
    }),
  })

  const text = await response.text()
  let payload = null
  try { payload = JSON.parse(text) } catch {}

  console.log(JSON.stringify({
    ok: response.ok,
    status: response.status,
    request: {
      BusinessShortCode: businessShortCode,
      PartyB: partyB,
      PhoneNumber: phoneNumber,
      Amount: amount,
      Timestamp: ts,
      TransactionType: 'CustomerBuyGoodsOnline',
      PasswordLength: password.length,
      PasswordPreview: `${password.slice(0, 8)}...${password.slice(-8)}`,
    },
    response: payload ?? text,
  }, null, 2))

  return { ok: response.ok, status: response.status, payload }
}

const businessShortCode = process.env.MPESA_SHORTCODE || '174379'
const partyB = process.env.MPESA_TILL_NUMBER || businessShortCode
const phoneNumber = process.env.MPESA_TEST_PHONE || '254708374149'
const amount = Number(process.env.MPESA_TEST_AMOUNT || '1')
const accountReference = process.env.MPESA_ACCOUNT_REFERENCE || 'MobiDuka'
const callbackUrl = process.env.MPESA_CALLBACK_URL || 'https://example.com/mpesa/callback'
const passkey = process.env.MPESA_PASSKEY

if (!passkey) {
  throw new Error('Set MPESA_PASSKEY in your .env before running this script.')
}

pushStk({
  businessShortCode,
  partyB,
  passkey,
  phoneNumber,
  amount,
  accountReference,
  callbackUrl,
})
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('STK push test failed:')
    console.error(error.message)
    process.exit(1)
  })
