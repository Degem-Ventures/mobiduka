"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { useTheme } from "../context/ThemeContext";
import {
  benefitItems,
  faqItems,
  featureItems,
  footerGroups,
  industryItems,
  industryPhotos,
  marketingNavItems,
  onboardingSteps,
  securityItems,
  type MarketingIconName,
} from "./marketing-data";

type PublicPlan = {
  name: string
  publicMonthlyPriceKsh: number | null
  estimatedMonthlyPriceKsh: number | null
  annualPriceKsh: number | null
  estimatedAnnualPriceKsh: number | null
  subtitle: string
  audience: string
  color: string
  marketingFeatures: string[]
  featured: boolean
  cta: string
  onlineCheckoutEnabled: boolean
}

async function readJsonResponse<T extends { error?: string }>(
  response: Response,
  failureMessage: string,
): Promise<T> {
  const body = await response.text()
  if (!body.trim()) {
    throw new Error(response.ok
      ? `${failureMessage} The server returned an empty response. Check the Support inbox before submitting again.`
      : `${failureMessage} The server returned HTTP ${response.status} without an error message.`)
  }

  let result: T
  try {
    result = JSON.parse(body) as T
  } catch {
    throw new Error(response.ok
      ? `${failureMessage} The server returned an invalid response. Check the Support inbox before submitting again.`
      : `${failureMessage} The server returned HTTP ${response.status} with an invalid response.`)
  }
  if (!response.ok) throw new Error(result.error ?? `${failureMessage} (HTTP ${response.status}).`)
  return result
}

function MarketingIcon({ name, size = 20 }: { name: MarketingIconName; size?: number }) {
  const paths: Record<MarketingIconName, ReactNode> = {
    arrow: <><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></>,
    check: <path d="m5 12 4 4L19 6"/>,
    menu: <><path d="M4 7h16M4 12h16M4 17h16"/></>,
    close: <><path d="m6 6 12 12M18 6 6 18"/></>,
    scan: <><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3"/><path d="M7 12h10"/></>,
    stock: <><path d="m12 2 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5M3 17l9 5 9-5"/></>,
    mpesa: <><rect x="5" y="2" width="14" height="20" rx="3"/><path d="M9 18h6M8 11l3 3 5-6"/></>,
    offline: <><path d="M5 12.6A8 8 0 0 1 18.4 9M2 8.8A12 12 0 0 1 20.5 6"/><path d="m3 3 18 18M8.5 16.5A5 5 0 0 1 14 15l2 2M12 20h.01"/></>,
    report: <><path d="M4 19V9M10 19V5M16 19v-7M22 19H2"/></>,
    team: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6M16 11h6"/></>,
    shield: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/><path d="m9 12 2 2 4-4"/></>,
    printer: <><path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v8H6z"/></>,
    sun: <><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/></>,
    moon: <path d="M20.9 13A9 9 0 0 1 11 3.1 9 9 0 1 0 20.9 13Z"/>,
    monitor: <><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4"/></>,
    android: <><path d="M7 8a5 5 0 0 1 10 0"/><path d="M6 8h12v7a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V8Z"/><path d="m8 4 1.5 2M16 4l-1.5 2M3.5 10v4M20.5 10v4M9 17v3M15 17v3"/><circle cx="9" cy="10.5" r=".5"/><circle cx="15" cy="10.5" r=".5"/></>,
    apple: <><path d="M12 8.3c-1.3 0-2-.7-3.1-.7-1.9 0-3.6 1.7-3.6 4.5 0 2.6 1.7 6.2 3.5 6.2.9 0 1.3-.6 2.5-.6 1.2 0 1.5.6 2.5.6 1.2 0 2.1-1.3 2.8-2.6-1.8-.9-2.4-3.1-1-4.5.5-.5 1-.7 1.5-.8-.8-1.5-2.1-2.4-3.5-2.4-1.1 0-1.6.3-2.6.3Z"/><path d="M12.4 6.7c.1-1.5 1.2-2.6 2.7-2.7 0 1.5-1.1 2.7-2.7 2.7Z"/></>,
  }
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}

const dashboardScreen = "/mobiduka-dashboard.png";
const shiftsScreen = "/mobiduka-shifts.png";
const shopkeeperPhoto = "/kenyan-shopkeeper.png";
const footerRoutes: Record<string, string> = {
  "Android app": "/download",
  "Web dashboard": "/app",
  "Privacy Policy": "/privacy",
  "Terms of Service": "/terms",
  "API documentation": "/api-docs",
};

function PhoneMockup({ src, alt, className = '' }: { src: string; alt: string; className?: string }) {
  return <div className={`mk-phone ${className}`}><img src={src} alt={alt}/></div>
}

function WebDashboardMockup() {
  return (
    <div className="mk-laptop">
      <div className="mk-laptop-screen">
        <div className="mk-web-sidebar"><div className="mk-mini-logo"><img src="/mobiduka_icon.svg" alt=""/></div>{['Overview','Sales','Inventory','Reports','Team'].map((item, index) => <span className={index === 0 ? 'active' : ''} key={item}>{item}</span>)}</div>
        <div className="mk-web-main">
          <div className="mk-web-head"><div><small>BUSINESS OVERVIEW</small><strong>Good morning, Edwin</strong></div><span>Live data</span></div>
          <div className="mk-web-kpis">{[['Today’s sales','KSh 84,250'],['Net profit','KSh 18,940'],['Stock value','KSh 1.26M']].map(item => <div key={item[0]}><span>{item[0]}</span><strong>{item[1]}</strong><i/></div>)}</div>
          <div className="mk-web-chart"><div><span>Sales performance</span><strong>KSh 482,400</strong></div><svg viewBox="0 0 500 150" preserveAspectRatio="none"><path d="M0 128 C35 110 48 120 72 91 S120 118 145 82 S190 96 218 60 S267 82 296 52 S342 70 370 35 S421 54 500 12" fill="none" stroke="#123A8F" strokeWidth="5"/><path d="M0 128 C35 110 48 120 72 91 S120 118 145 82 S190 96 218 60 S267 82 296 52 S342 70 370 35 S421 54 500 12 L500 150 L0 150Z" fill="url(#heroChart)"/><defs><linearGradient id="heroChart" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#123A8F" stopOpacity=".22"/><stop offset="1" stopColor="#123A8F" stopOpacity="0"/></linearGradient></defs></svg></div>
        </div>
      </div>
      <div className="mk-laptop-base"/>
    </div>
  )
}

export default function MarketingPage({
  registrationEnabled = true,
}: {
  registrationEnabled?: boolean
}) {
  const { theme, isDark, setTheme } = useTheme()
  const [mobileMenu, setMobileMenu] = useState(false)
  const [themeMenuOpen, setThemeMenuOpen] = useState(false)
  const [experience, setExperience] = useState<'android' | 'ios' | 'web'>('android')
  const [annual, setAnnual] = useState(false)
  const [openFaq, setOpenFaq] = useState(0)
  const [contactOpen, setContactOpen] = useState(false)
  const [contactSubmitting, setContactSubmitting] = useState(false)
  const [contactError, setContactError] = useState("")
  const [notice, setNotice] = useState('')
  const [planCatalog, setPlanCatalog] = useState<PublicPlan[]>([])
  const [planLoadError, setPlanLoadError] = useState("")

  useEffect(() => {
    const controller = new AbortController()
    void fetch("/api/plans", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const result = await response.json() as { plans?: PublicPlan[]; error?: string }
        if (!response.ok) throw new Error(result.error ?? "Unable to load plans.")
        setPlanCatalog(result.plans ?? [])
      })
      .catch((reason: unknown) => {
        if (reason instanceof Error && reason.name === "AbortError") return
        setPlanLoadError(reason instanceof Error ? reason.message : "Unable to load plans.")
      })
    return () => controller.abort()
  }, [])

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
    setMobileMenu(false)
  }
  const comingSoon = (message: string) => {
    setNotice(message)
    window.setTimeout(() => setNotice(''), 3200)
  }
  const submitContactRequest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setContactSubmitting(true)
    setContactError("")
    const formData = new FormData(event.currentTarget)
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: formData.get("fullName"),
          businessName: formData.get("businessName"),
          email: formData.get("email"),
          phone: formData.get("phone"),
          businessType: formData.get("businessType"),
          message: formData.get("message"),
        }),
      })
      const result = await readJsonResponse<{ error?: string; emailDelivered?: boolean }>(
        response,
        "Unable to send your request.",
      )
      setContactOpen(false)
      comingSoon(result.emailDelivered
        ? "Thanks for reaching out. Your request was sent to the MobiDuka team."
        : "Your request was saved for the MobiDuka team, but the email alert could not be sent.")
    } catch (reason) {
      setContactError(reason instanceof Error ? reason.message : "Unable to send your request.")
    } finally {
      setContactSubmitting(false)
    }
  }

  return (
    <div className="marketing-page" data-theme={isDark ? 'dark' : 'light'}>
      <header className="mk-nav">
        <div className="mk-container mk-nav-inner">
          <button className="mk-brand" onClick={() => scrollTo('top')}><span><img src="/mobiduka_icon.svg" alt=""/></span><div><strong>MobiDuka</strong><small>POS</small></div></button>
          <nav className={mobileMenu ? 'open' : ''}>
            {marketingNavItems.map(item => <button key={item} onClick={() => scrollTo(item)}>{item.split('-').map(word => word[0].toUpperCase() + word.slice(1)).join(' ')}</button>)}
            <div className="mk-platform-links" aria-label="Mobile apps">
              <Link className="mk-platform-icon" href="/download" aria-label="Download Android app" title="Download Android app"><MarketingIcon name="android" size={18}/></Link>
              <button className="mk-platform-icon is-disabled" type="button" disabled aria-label="iOS app not available yet" title="iOS app not available yet"><MarketingIcon name="apple" size={18}/></button>
            </div>
          </nav>
          <div className="mk-nav-actions">
            <div className="mk-theme-anchor">
              <button className={`mk-theme-toggle ${isDark ? 'is-dark' : 'is-light'}`} onClick={() => setThemeMenuOpen(value => !value)} aria-label="Choose color theme" aria-expanded={themeMenuOpen} aria-haspopup="menu" title="Choose color theme">
                <MarketingIcon name={theme === 'auto' ? 'monitor' : isDark ? 'sun' : 'moon'} size={17}/>
              </button>
              {themeMenuOpen && (
                <div className="mk-theme-menu" role="menu" aria-label="Color theme">
                  {(['light', 'dark', 'auto'] as const).map(mode => (
                    <button key={mode} role="menuitemradio" aria-checked={theme === mode} className={theme === mode ? 'active' : ''} onClick={() => { setTheme(mode); setThemeMenuOpen(false) }}>
                      <MarketingIcon name={mode === 'light' ? 'sun' : mode === 'dark' ? 'moon' : 'monitor'} size={15}/>
                      <span>{mode === 'auto' ? 'System' : mode === 'light' ? 'Light' : 'Dark'}</span>
                      {theme === mode && <MarketingIcon name="check" size={14}/>}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <Link href="/login">Log in</Link>
            <Link className="mk-primary small" href="/signup">Get Started</Link>
          </div>
          <button className="mk-mobile-toggle" onClick={() => setMobileMenu(value => !value)} aria-label="Toggle menu"><MarketingIcon name={mobileMenu ? 'close' : 'menu'}/></button>
        </div>
      </header>

      <main id="top">
        <section className="mk-hero">
          <div className="mk-container mk-hero-grid">
            <div className="mk-hero-copy">
              {!registrationEnabled && (
                <p role="status" style={{ fontSize: 13, lineHeight: 1.5 }}>
                  New business registration is paused.{" "}
                  <Link href="/login">Existing customers can log in.</Link>
                </p>
              )}
              <div className="mk-eyebrow"><span/> Retail management, reimagined</div>
              <h1>Your Shop. Your Stock. Your Sales. <em>Under Control.</em></h1>
              <p>Say goodbye to scattered records and guesswork. MobiDuka helps you record sales, track inventory, manage payments and understand your business performance.</p>
              <div className="mk-hero-actions"><Link className="mk-primary" href="/signup">Get Started <MarketingIcon name="arrow" size={17}/></Link><button className="mk-secondary" onClick={() => scrollTo('how-it-works')}>See How It Works</button><Link className="mk-secondary mk-desktop-link" href="/desktop"><MarketingIcon name="monitor" size={17}/> Open Desktop Workspace</Link></div>
              <div className="mk-hero-trust"><div className="mk-avatar-stack"><span>DK</span><span>GW</span><span>AM</span></div><p>Designed for Kenyan dukas, mini-shops and growing retailers.</p></div>
            </div>
            <div className="mk-hero-visual">
              <WebDashboardMockup/>
              <PhoneMockup src={dashboardScreen} alt="MobiDuka mobile dashboard" className="hero-phone"/>
              <div className="mk-float-card sale"><span><MarketingIcon name="check" size={15}/></span><div><small>SALE COMPLETED</small><strong>KSh 1,250</strong></div></div>
              <div className="mk-float-card stock"><span><MarketingIcon name="stock" size={15}/></span><div><small>STOCK ALERT</small><strong>1 item running low</strong></div></div>
              <div className="mk-float-card pay"><span><MarketingIcon name="mpesa" size={15}/></span><div><small>M-PESA</small><strong>Payment confirmed</strong></div></div>
            </div>
          </div>
        </section>

        <section className="mk-benefit-bar"><div className="mk-container">{benefitItems.map(item => <div key={item.label}><MarketingIcon name={item.icon}/><span>{item.label}</span></div>)}</div></section>

        <section className="mk-section mk-experience" id="app-screens">
          <div className="mk-container">
            <div className="mk-section-head centered"><span>WORK ACROSS DEVICES</span><h2>One Powerful Retail Platform. Multiple Ways to Work.</h2><p>Explore the MobiDuka experience across mobile and web.</p></div>
            <div className="mk-tabs">{(['android','ios','web'] as const).map(tab => <button key={tab} className={experience === tab ? 'active' : ''} onClick={() => setExperience(tab)}>{tab === 'android' ? 'Android APK' : tab === 'ios' ? 'iOS App' : 'Web Dashboard'}</button>)}</div>
            <div className="mk-experience-stage">
              <div className="mk-experience-copy">
                <div className="mk-product-badge">{experience === 'android' ? 'ANDROID' : experience === 'ios' ? 'iPHONE' : 'WEB'}</div>
                <h3>{experience === 'android' ? 'Your complete shop counter, in your hand.' : experience === 'ios' ? 'A focused mobile view for business oversight.' : 'A wider view of performance, stock and profitability.'}</h3>
                <p>{experience === 'android' ? 'Record sales, search products, scan barcodes, manage shifts and track payment status from one practical Android workflow.' : experience === 'ios' ? 'Review dashboards, checkout activity, inventory and sales analytics with safe-area-aware mobile design.' : 'Monitor revenue, expenses, inventory valuation, low-stock alerts and recent transactions from a responsive browser dashboard.'}</p>
                <ul>{(experience === 'android' ? ['POS checkout and cart','SmartScan barcode workflows','Inventory and shift management','Compatible receipt printing'] : experience === 'ios' ? ['Business dashboard','Product catalogue','Payment status','Sales analytics'] : ['Revenue and sales trends','Expense summaries','Inventory valuation','Profitability reporting']).map(item => <li key={item}><MarketingIcon name="check" size={14}/>{item}</li>)}</ul>
                {experience === 'android' ? <Link className="mk-primary" href="/download">Download Android app <MarketingIcon name="arrow" size={17}/></Link> : experience === 'ios' ? <button className="mk-secondary" onClick={() => setContactOpen(true)}>Contact us for availability</button> : <Link className="mk-primary" href="/app">Explore Web Access</Link>}
              </div>
              <div className={`mk-device-stage ${experience}`}>
                {experience === 'android' && <><PhoneMockup src={dashboardScreen} alt="MobiDuka Android dashboard"/><PhoneMockup src={shiftsScreen} alt="MobiDuka Android shift management" className="secondary-phone"/></>}
                {experience === 'ios' && <PhoneMockup src={dashboardScreen} alt="MobiDuka iOS availability preview" className="ios-phone"/>}
                {experience === 'web' && <WebDashboardMockup/>}
              </div>
            </div>
          </div>
        </section>

        <section className="mk-section mk-action-story">
          <div className="mk-container mk-story-grid">
            <div className="mk-story-photo"><img src={shopkeeperPhoto} alt="Kenyan shopkeeper using a smartphone while managing handwritten retail records"/><div className="mk-photo-note"><span><MarketingIcon name="offline" size={16}/></span><div><strong>Built for retail reality</strong><small>Practical workflows for busy Kenyan shops</small></div></div></div>
            <div className="mk-story-copy"><span>MOBIDUKA IN ACTION</span><h2>Move From Handwritten Guesswork to Clear Business Decisions.</h2><p>MobiDuka brings the daily work of selling, counting stock, tracking expenses and checking business performance into one connected retail workspace.</p><div className="mk-story-points">{[['offline','Keep serving during interruptions','Supported offline workflows queue records for synchronization when connectivity returns.'],['mpesa','Follow payment status','Bring checkout and supported M-PESA payment progression into one operational view.'],['report','Understand performance','Review revenue, costs, expenses, inventory value and profitability with KSh-formatted reports.']].map(item => <div key={item[1]}><span><MarketingIcon name={item[0] as MarketingIconName}/></span><div><strong>{item[1]}</strong><p>{item[2]}</p></div></div>)}</div></div>
          </div>
        </section>

        <section className="mk-section" id="features">
          <div className="mk-container">
            <div className="mk-section-head"><span>CAPABILITIES</span><h2>Everything You Need to Run a Better Retail Business.</h2><p>Practical tools for the counter, the stockroom and the decisions that shape tomorrow.</p></div>
            <div className="mk-feature-grid">{featureItems.map(item => <article key={item.title}><span><MarketingIcon name={item.icon}/></span><h3>{item.title}</h3><p>{item.description}</p><button onClick={() => scrollTo('app-screens')}>See the product <MarketingIcon name="arrow" size={14}/></button></article>)}</div>
          </div>
        </section>

        <section className="mk-section mk-industries" id="industries">
          <div className="mk-container">
            <div className="mk-section-head centered"><span>BUILT FOR KENYAN RETAIL</span><h2>Built for the Way Kenyan Businesses Trade.</h2><p>From one busy counter to a growing network of retail branches.</p></div>
            <div className="mk-industry-grid">{industryItems.map((item,index) => <article key={item.name}><img src={industryPhotos[index]} alt={`${item.name} retail environment`}/><div><h3>{item.name}</h3><p>{item.description}</p><button onClick={() => setContactOpen(true)}>Explore solutions <MarketingIcon name="arrow" size={13}/></button></div></article>)}</div>
          </div>
        </section>

        <section className="mk-section mk-how" id="how-it-works">
          <div className="mk-container">
            <div className="mk-section-head centered"><span>SIMPLE ONBOARDING</span><h2>Get Started in Three Simple Steps.</h2></div>
            <div className="mk-steps">{onboardingSteps.map(step => <article key={step.number}><span>{step.number}</span><h3>{step.title}</h3><p>{step.description}</p></article>)}</div>
            <div className="mk-center-action"><Link className="mk-primary" href="/signup">Get Started <MarketingIcon name="arrow" size={16}/></Link></div>
          </div>
        </section>

        <section className="mk-section mk-pricing" id="packages">
          <div className="mk-container">
            <div className="mk-section-head centered"><span>PACKAGES</span><h2>Simple Packages. Smarter Retail.</h2><p>Choose the tools that fit your business today, with room to grow.</p></div>
            <div className="mk-billing-toggle"><button className={!annual ? 'active' : ''} onClick={() => setAnnual(false)}>Monthly billing</button><button className={annual ? 'active' : ''} onClick={() => setAnnual(true)}>Annual billing</button></div>
            {planLoadError && <p role="alert">{planLoadError}</p>}
            <div className="mk-price-grid">{planCatalog.map(plan => {
              const isEstimatedMonthlyPrice =
                !annual && plan.publicMonthlyPriceKsh === null && plan.estimatedMonthlyPriceKsh !== null
              const isEstimatedAnnualPrice =
                annual && plan.annualPriceKsh === null && plan.estimatedAnnualPriceKsh !== null
              const publicPrice = annual
                ? plan.annualPriceKsh ?? plan.estimatedAnnualPriceKsh
                : plan.publicMonthlyPriceKsh ?? plan.estimatedMonthlyPriceKsh
              const actualSelectedPrice = annual ? plan.annualPriceKsh : plan.publicMonthlyPriceKsh
              const checkoutAvailable = plan.name === "Basic" || (plan.onlineCheckoutEnabled && actualSelectedPrice !== null)
              const signupBilling = plan.name === "Basic" ? "monthly" : annual ? "annual" : "monthly"
              const signupHref = `/signup?plan=${encodeURIComponent(plan.name)}&billing=${signupBilling}`
              return <article className={plan.featured ? 'featured' : ''} key={plan.name}>{plan.featured && <div className="mk-recommended">Recommended</div>}<span>{plan.audience}</span><h3>{plan.name}</h3><div className="mk-price"><strong>{publicPrice === null ? "Price on request" : `${isEstimatedMonthlyPrice || isEstimatedAnnualPrice ? "≈ " : ""}KSh ${publicPrice.toLocaleString()}`}</strong>{publicPrice !== null && <small>/ {annual ? 'year' : 'month'}</small>}</div>{isEstimatedMonthlyPrice && <small className="mk-estimate-note">Approximate monthly equivalent, derived from annual pricing.</small>}{isEstimatedAnnualPrice && <small className="mk-estimate-note">Approximate annual equivalent, derived from monthly pricing.</small>}<p>{checkoutAvailable ? "Secure your subscription with M-PESA checkout." : "Contact our team for current pricing and availability."}</p><ul>{plan.marketingFeatures.map(feature => <li key={feature}><MarketingIcon name="check" size={13}/>{feature}</li>)}</ul>{checkoutAvailable ? <Link className={plan.featured ? 'mk-primary' : 'mk-secondary'} href={signupHref}>{plan.name === "Basic" ? "Start 14-day Basic trial" : "Choose plan"}</Link> : <button className={plan.featured ? 'mk-primary' : 'mk-secondary'} onClick={() => setContactOpen(true)}>{plan.cta}</button>}</article>
            })}</div>
            <div className="mk-pricing-note">Package information is shared with the admin license catalog. Public prices and exact entitlements remain unpublished until formally approved.</div>
          </div>
        </section>

        <section className="mk-section mk-security">
          <div className="mk-container mk-security-inner"><div><span><MarketingIcon name="shield" size={24}/></span><div><small>SECURITY & TRUST</small><h2>Built With Business Access and Data Protection in Mind.</h2></div></div><div className="mk-security-list">{securityItems.map(item => <span key={item}><MarketingIcon name="check" size={13}/>{item}</span>)}</div></div>
        </section>

        <section className="mk-section mk-faq" id="faq">
          <div className="mk-container mk-faq-grid"><div className="mk-section-head"><span>FAQ</span><h2>Clear Answers Before You Get Started.</h2><p>Need help choosing a package or checking compatibility? Talk to our team.</p><button className="mk-secondary" onClick={() => setContactOpen(true)}>Contact MobiDuka</button></div><div>{faqItems.map((faq,index) => <article className={openFaq === index ? 'open' : ''} key={faq[0]}><button onClick={() => setOpenFaq(openFaq === index ? -1 : index)}><span>{faq[0]}</span><i>{openFaq === index ? '−' : '+'}</i></button>{openFaq === index && <p>{faq[1]}</p>}</article>)}</div></div>
        </section>

        <section className="mk-final-cta"><div className="mk-container"><div><span>READY WHEN YOU ARE</span><h2>Ready to Run Your Shop Smarter?</h2><p>Bring sales, stock, expenses and business insights together with MobiDuka POS.</p><div><Link className="mk-primary light" href="/signup">Get Started <MarketingIcon name="arrow" size={16}/></Link><button className="mk-ghost" onClick={() => setContactOpen(true)}>Talk to Our Team</button></div></div><PhoneMockup src={dashboardScreen} alt="MobiDuka POS app dashboard"/></div></section>
      </main>

      <footer className="mk-footer">
        <div className="mk-container">
          <div className="mk-footer-brand">
            <button className="mk-brand" onClick={() => scrollTo("top")}>
              <span><img src="/mobiduka_icon.svg" alt="" /></span>
              <div><strong>MobiDuka</strong><small>POS</small></div>
            </button>
            <p>Smart Retail Management for Modern Kenyan Businesses.</p>
          </div>
          {footerGroups.map((group) => (
            <div key={group.title}>
              <strong>{group.title}</strong>
              {group.links.map((item) => {
                if (item === "Packages") {
                  return (
                    <button key={item} onClick={() => scrollTo("packages")}>
                      {item}
                    </button>
                  )
                }
                const href = footerRoutes[item]
                return href ? (
                  <Link key={item} href={href}>{item}</Link>
                ) : (
                  <button key={item} onClick={() => setContactOpen(true)}>
                    {item}
                  </button>
                )
              })}
            </div>
          ))}
        </div>
        <div className="mk-container mk-footer-bottom">
          <span>© 2026 MobiDuka POS. Product preview.</span>
          <span>Built for Kenyan retail.</span>
        </div>
      </footer>

      {contactOpen && <div className="mk-modal-overlay" onMouseDown={event => { if (event.target === event.currentTarget) setContactOpen(false) }}><form className="mk-contact-modal" onSubmit={submitContactRequest}><div><span>START WITH MOBIDUKA</span><h2 id="mk-contact-title">Tell Us About Your Business.</h2><p>We’ll help you understand package fit, device compatibility and onboarding.</p><button type="button" aria-label="Close contact form" onClick={() => setContactOpen(false)}><MarketingIcon name="close"/></button></div><label><span>Full name</span><input name="fullName" autoComplete="name" required maxLength={120} placeholder="Your name"/></label><label><span>Business name</span><input name="businessName" required maxLength={160} placeholder="e.g. Jirani Mini Mart"/></label><label><span>Email address</span><input name="email" type="email" autoComplete="email" required maxLength={254} placeholder="you@example.com"/></label><div><label><span>Phone number</span><input name="phone" type="tel" autoComplete="tel" required maxLength={40} placeholder="07XX XXX XXX"/></label><label><span>Business type</span><select name="businessType" defaultValue=""><option value="">Select business type</option><option>Duka or kiosk</option><option>Mini-market</option><option>Pharmacy</option><option>Agrovet</option><option>Retail chain</option></select></label></div><label><span>What would you like help with?</span><textarea name="message" required maxLength={3000} placeholder="Packages, Android availability, M-PESA setup, multi-branch onboarding…"/></label>{contactError && <p role="alert" className="mk-contact-error">{contactError}</p>}<button className="mk-primary" disabled={contactSubmitting}>{contactSubmitting ? "Sending…" : "Request a Conversation"} {!contactSubmitting && <MarketingIcon name="arrow" size={15}/>}</button></form></div>}
      {notice && <div className="mk-toast"><MarketingIcon name="check" size={16}/><span>{notice}</span><button onClick={() => setNotice('')}>×</button></div>}
    </div>
  )
}
