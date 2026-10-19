function buildDarajaPassword({ businessShortCode, passkey, timestamp }) {
  if (!businessShortCode || !passkey || !timestamp) {
    throw new Error('Missing businessShortCode, passkey, or timestamp.')
  }

  const raw = `${businessShortCode}${passkey}${timestamp}`
  return Buffer.from(raw, 'utf8').toString('base64')
}

function resolveMpesaPasskey() {
  const passkey = process.env.MPESA_PASSKEY
  if (!passkey) {
    throw new Error('MPESA_PASSKEY is not set in process.env.')
  }
  return passkey
}

function getMpesaPassword({
  businessShortCode,
  timestamp,
  passkey = resolveMpesaPasskey(),
}) {
  return buildDarajaPassword({ businessShortCode, passkey, timestamp })
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const businessShortCode =
    process.env.MPESA_SHORTCODE || process.argv[2] || '1316920'
  const timestamp =
    process.argv[3] ||
    new Date()
      .toISOString()
      .replace(/[-:]/g, '')
      .replace(/\.\d+Z$/, 'Z')
      .replace('T', '')
      .replace('Z', '')
      .slice(0, 14)

  const passkey = resolveMpesaPasskey()
  const password = getMpesaPassword({ businessShortCode, timestamp, passkey })

  console.log(JSON.stringify({
    ok: true,
    businessShortCode,
    timestamp,
    passkeyPresent: Boolean(passkey),
    passwordLength: password.length,
    passwordPreview: `${password.slice(0, 6)}...${password.slice(-6)}`,
  }, null, 2))
}

export { buildDarajaPassword, resolveMpesaPasskey, getMpesaPassword }
