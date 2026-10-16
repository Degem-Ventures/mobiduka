function safeCellValue(value: unknown) {
  if (value === null || value === undefined) return ""
  if (value instanceof Date) return value.toISOString()
  if (typeof value === "number") {
    if (!Number.isFinite(value))
      throw new TypeError("CSV values must be finite numbers.")
    return String(value)
  }
  if (typeof value === "boolean") return String(value)

  const text = String(value)
  return /^[\s\u0000-\u001f]*[=+\-@]/u.test(text) ? `'${text}` : text
}

export function toCsvRow(values: readonly unknown[]) {
  return `${values
    .map((value) => `"${safeCellValue(value).replace(/"/g, '""')}"`)
    .join(",")}\r\n`
}
