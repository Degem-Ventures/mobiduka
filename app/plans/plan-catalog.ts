export type PlanCatalogEntry = {
  name: 'Basic' | 'Growth' | 'Enterprise'
  monthlyPriceKsh: number
  publicMonthlyPriceKsh: number | null
  annualPriceKsh: number | null
  priceSuffix?: '+'
  subtitle: string
  audience: string
  tenants: number
  color: 'blue' | 'green' | 'gold'
  adminFeatures: string[]
  marketingFeatures: string[]
  featured: boolean
  cta: string
  upgradeRulesEnabled: boolean
}

export const planCatalog: PlanCatalogEntry[] = [
  {
    name: 'Basic',
    monthlyPriceKsh: 2500,
    publicMonthlyPriceKsh: null,
    annualPriceKsh: null,
    subtitle: 'Standard Duka',
    audience: 'Small dukas and kiosks',
    tenants: 734,
    color: 'blue',
    adminFeatures: ['1 store · 3 users', 'Core POS & inventory', 'Standard support'],
    marketingFeatures: ['Sales management', 'Product and stock tracking', 'Essential business reports', 'Staff access controls'],
    featured: false,
    cta: 'Choose Basic',
    upgradeRulesEnabled: true,
  },
  {
    name: 'Growth',
    monthlyPriceKsh: 5500,
    publicMonthlyPriceKsh: null,
    annualPriceKsh: null,
    subtitle: 'Multi-store operator',
    audience: 'Busy shops and expanding retailers',
    tenants: 421,
    color: 'green',
    adminFeatures: ['3 stores · 15 users', 'Reports & staff controls', 'Priority support'],
    marketingFeatures: ['Everything in Basic', 'Expanded reports and insights', 'More comprehensive workflows', 'Support for growing teams'],
    featured: true,
    cta: 'Choose Growth',
    upgradeRulesEnabled: true,
  },
  {
    name: 'Enterprise',
    monthlyPriceKsh: 12500,
    publicMonthlyPriceKsh: null,
    annualPriceKsh: null,
    priceSuffix: '+',
    subtitle: 'Mega-supermarket',
    audience: 'Larger and multi-branch retailers',
    tenants: 129,
    color: 'gold',
    adminFeatures: ['Unlimited terminals', 'Advanced IAM & API', 'Dedicated success manager'],
    marketingFeatures: ['Advanced business oversight', 'Expanded team management', 'Multi-branch options where supported', 'Enterprise onboarding'],
    featured: false,
    cta: 'Contact Sales',
    upgradeRulesEnabled: false,
  },
]

export function formatPlanPrice(plan: PlanCatalogEntry) {
  return `${plan.monthlyPriceKsh.toLocaleString()}${plan.priceSuffix ?? ''}`
}

export function formatPublicPlanPrice(plan: PlanCatalogEntry, annual: boolean) {
  const price = annual ? plan.annualPriceKsh : plan.publicMonthlyPriceKsh
  if (price === null) return 'Price on request'
  const amount = annual ? `${price.toLocaleString()}` : formatPlanPrice(plan)
  return `KSh ${amount}`
}
