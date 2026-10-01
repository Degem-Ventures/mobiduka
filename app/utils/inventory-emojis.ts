/**
 * Shared, curated icon set for products and categories.
 * Keeping this list here makes the Inventory, SmartScan and future mobile
 * pickers present the same familiar choices without storing labels in the DB.
 */
export const INVENTORY_EMOJIS = [
  // Food & groceries
  '🍞', '🥖', '🥐', '🥚', '🍚', '🌾', '🥫', '🫙', '🧂', '🧈', '🧀', '🥛', '🥮',
  '☕', '🍵', '🫖', '🍫', '🍬', '🍭', '🍪', '🍿', '🥜', '🌶️', '🍯', '🧃', '🔖',
  '🥤', '🧋', '💧', '🍌', '🍎', '🍊', '🥭', '🍅', '🥑', '🥬', '🥔', '🧅', '🍟',
  // Household & personal care
  '🧴', '🧼', '🪥', '💈',  '🧻', '🧹', '🧺', '🛒', '🛍️', '🪣', '🧽', '🕯️', '🔋','🏿',
  '💡', '🔌', '✏️', '🖊️', '📓', '📦',
  // Health, baby & clothing
  '💊', '🩹', '🧪', '🍼', '👶', '🧑', '🩲', '🧷', '👕', '👚', '🧦', '👟', '👜', '😷',
  // General retail
  '🎁', '🔧', '🔒', '📱', '🎮', '⚽', '🐾', '🌸', '✨', '⭐', '⚡', '🏷️',
] as const

export const DEFAULT_INVENTORY_EMOJI = '📦'
