function normalized(value: string | null | undefined) {
  return (value ?? "").trim().replace(/\s+/g, " ")
}

export function composeProductDisplayName(
  brand: string | null | undefined,
  productType: string | null | undefined,
  packSize: string | null | undefined,
) {
  const cleanBrand = normalized(brand)
  const cleanType = normalized(productType)
  const cleanSize = normalized(packSize)
  const lowerType = cleanType.toLocaleLowerCase()
  const lowerBrand = cleanBrand.toLocaleLowerCase()

  const name =
    cleanBrand &&
    lowerType !== lowerBrand &&
    !lowerType.startsWith(`${lowerBrand} `)
      ? [cleanBrand, cleanType].filter(Boolean).join(" ")
      : cleanType || cleanBrand

  if (
    !cleanSize ||
    name.toLocaleLowerCase().endsWith(cleanSize.toLocaleLowerCase())
  ) {
    return name
  }
  return [name, cleanSize].filter(Boolean).join(" ")
}
