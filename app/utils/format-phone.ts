export function formatPhoneForDisplay(value: string) {
  const digits = value.replace(/\D/g, '')
  const localNumber = digits.startsWith('254') ? `0${digits.slice(3)}` : digits
  if (/^0\d{9}$/.test(localNumber)) return `${localNumber.slice(0, 4)} ${localNumber.slice(4, 7)} ${localNumber.slice(7)}`
  return value
}
