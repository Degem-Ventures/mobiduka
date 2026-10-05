export type ProductTypeOption = {
  id: string
  name: string
  categoryId: string
  emoji: string
  sizes: string[]
}

export type ProductTypeCategory = {
  id: string
  name: string
  emoji: string | null
}

export const productTypePresets = [
  { name: 'Soda', categories: ['Beverages', 'Soft Drinks'], emoji: '🥤', sizes: ['250ml', '500ml', '1L', '2L'] },
  { name: 'Water', categories: ['Beverages', 'Water'], emoji: '💧', sizes: ['250ml', '500ml'] },
  { name: 'Yoghurt', categories: ['Dairy', 'Yoghurt'], emoji: '🥣', sizes: ['150ml', '250ml', '500ml'] },
]

export const productTypesStorageKey = (businessId: string) => `mobiduka.product_types.v1:${businessId}`

export const defaultProductTypes = (categories: ProductTypeCategory[]): ProductTypeOption[] =>
  productTypePresets.map(preset => ({
    id: `preset-${preset.name.toLowerCase()}`,
    name: preset.name,
    categoryId: categories.find(category =>
      preset.categories.some(name => name.toLowerCase() === category.name.toLowerCase()),
    )?.id ?? '',
    emoji: preset.emoji,
    sizes: preset.sizes,
  }))

export const loadProductTypes = (
  categories: ProductTypeCategory[],
  raw: string | null,
): ProductTypeOption[] => {
  const defaults = defaultProductTypes(categories)
  if (!raw) return defaults

  const saved: unknown = JSON.parse(raw)
  const validSaved = Array.isArray(saved)
    ? saved.filter((type): type is ProductTypeOption =>
        Boolean(type) &&
        typeof type.id === 'string' &&
        typeof type.name === 'string' &&
        typeof type.categoryId === 'string' &&
        typeof type.emoji === 'string' &&
        Array.isArray(type.sizes) &&
        type.sizes.every((size: unknown) => typeof size === 'string'),
      )
    : []
  const mergedDefaults = defaults.map(type =>
    validSaved.find(savedType => savedType.name.toLowerCase() === type.name.toLowerCase()) ?? type,
  )
  const customTypes = validSaved.filter(type =>
    !defaults.some(defaultType => defaultType.name.toLowerCase() === type.name.toLowerCase()),
  )
  return [...mergedDefaults, ...customTypes]
}
