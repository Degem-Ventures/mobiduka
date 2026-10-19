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

async function queryStkStatus({ businessShortCode, checkoutRequestId, passkey }) {
  const ts = timestampNow()
  const password = buildPassword({ businessShortCode, passkey, timestamp: ts })
  const token = await getAccessToken()

  const response = await fetch('https://sandbox.safaricom.co.ke/mpesa/stkpushquery/v1/query', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      BusinessShortCode: businessShortCode,
      Password: password,
      Timestamp: ts,
      CheckoutRequestID: checkoutRequestId,
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
      Timestamp: ts,
      CheckoutRequestID: checkoutRequestId,
      PasswordLength: password.length,
      PasswordPreview: `${password.slice(0, 8)}...${password.slice(-8)}`,
    },
    response: payload ?? text,
  }, null, 2))

  return { ok: response.ok, status: response.status, payload }
}

const businessShortCode = process.env.MPESA_SHORTCODE || '174379'
const checkoutRequestId = process.env.MPESA_CHECKOUT_REQUEST_ID || 'ws_CO_000000000000000000000000000000000000'
const passkey = process.env.MPESA_PASSKEY

if (!passkey) {
  throw new Error('Set MPESA_PASSKEY in your .env before running this script.')
}

queryStkStatus({
  businessShortCode,
  checkoutRequestId,
  passkey,
})
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('STK query test failed:')
    console.error(error.message)
    process.exit(1)
  })
