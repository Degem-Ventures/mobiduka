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
  const passkey = process.env.MPESA_PASSKEY

  if (!consumerKey || !consumerSecret || !passkey) {
    throw new Error('Missing MPESA_CONSUMER_KEY, MPESA_CONSUMER_SECRET, or MPESA_PASSKEY in environment.')
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

  const payload = await response.json()
  if (!payload.access_token) {
    throw new Error('No access_token returned from Safaricom.')
  }

  return payload.access_token
}

async function runProductionStk() {
  const businessShortCode = '4221363'
  const partyB = '1787049'
  const phoneNumber = '254721478065'
  const amount = Number('1')
  const accountReference = 'MobiDuka'
  const callbackUrl = 'https://fuzzy-spork-wr5v4j97pxprf67q-3000.app.github.dev/api/payments/mpesa-callback'
  const passkey = process.env.MPESA_PASSKEY
  if (!passkey) {
    throw new Error('MPESA_PASSKEY is required in env; do not print it.')
  }

  const timestamp = timestampNow()
  const password = buildPassword({ businessShortCode, passkey, timestamp })
  const token = await getAccessToken()

  const response = await fetch('https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      BusinessShortCode: businessShortCode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerBuyGoodsOnline',
      Amount: amount,
      PartyA: phoneNumber,
      PartyB: partyB,
      PhoneNumber: phoneNumber,
      CallBackURL: callbackUrl,
      AccountReference: accountReference,
      TransactionDesc: 'MobiDuka production test',
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
      BusinessShortCode: businessShortCode,
      PartyB: partyB,
      TransactionType: 'CustomerBuyGoodsOnline',
      Amount: amount,
      PhoneNumber: phoneNumber,
      Timestamp: timestamp,
      AccountReference: accountReference,
      CallbackURL: callbackUrl,
      PasswordPreview: `${password.slice(0, 8)}...${password.slice(-8)}`,
    },
    response: payload,
  }, null, 2))

  return { ok: response.ok, status: response.status, payload }
}

runProductionStk().catch((error) => {
  console.error('Production STK test failed:')
  console.error(error.message)
  process.exit(1)
})
