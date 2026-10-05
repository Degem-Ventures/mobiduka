import { useEffect, useRef, useState } from "react"
import { useColors } from "../utils/theme"
import { apiFetch, getClientSession, takeCreditorSaleIntent } from "../../lib/client-api"

type ProductItem = {
  id: string
  name: string
  price: number
  category: string
  stock: number
  recentUnitsSold: number
  emoji: string
  barcode?: string | null
}
type CreditCustomer = {
  id: string
  name: string
  phone: string
  balance: number
}
type CartItem = Pick<ProductItem, "id" | "name" | "price" | "emoji"> & {
  qty: number
}
type ActiveOperator = { id: string; name: string; shift: string }
type ReceiptInfo = {
  saleNumber: string
  createdAt: string
  cashierName: string
  businessName: string
  businessBranch: string | null
}
type HistoricalReceipt = {
  id: string
  saleNumber: string
  createdAt: string
  businessName: string
  businessBranch: string | null
  subtotal: number
  discountAmount: number
  total: number
  cashier: string
  customer: string | null
  paymentMethod: string
  items: Array<{
    id: string
    name: string
    price: number
    quantity: number
    total: number
    emoji: string
  }>
}
type ReceiptHistoryResponse = {
  receipts: HistoricalReceipt[]
  nextCursor: string | null
}
type PaymentSettingsResponse = {
  preferences: {
    mpesaEnabled: boolean
    paymentConfig: { methods: Record<string, boolean> } | null
  }
}
type PosDraft = {
  cart: CartItem[]
  view: "pos" | "cart" | "payment"
  paymentMethod: "cash" | "mpesa" | "credit"
  mpesaPhone: string
  discount: number
  selectedCreditor: { id: string; name: string; phone: string } | null
  selectedOperatorId: string
}

const cartDraftKey = (businessId: string, userId: string) =>
  `mobiduka.pos_draft.v1:${businessId}:${userId}`
const receiptPageSize = 10
const normalizePaymentMethod = (value: string) =>
  value.toLowerCase().replace(/[^a-z]/g, "")

interface Props {
  onNavigate: (screen: string) => void
  initialCartItem?: Omit<CartItem, "qty">
}

export default function POSScreen({ onNavigate, initialCartItem }: Props) {
  const [products, setProducts] = useState<ProductItem[]>([])
  const [categoryRows, setCategoryRows] = useState<Array<{
    id: string
    name: string
    emoji: string | null
  }>>([])
  const [creditCustomers, setCreditCustomers] = useState<CreditCustomer[]>([])
  const [dataError, setDataError] = useState("")
  const [search, setSearch] = useState("")
  const [category, setCategory] = useState("All")
  const [cart, setCart] = useState<CartItem[]>([])
  const [productView, setProductView] = useState<"grid" | "details">("grid")
  const [view, setView] = useState<
    "pos" | "cart" | "payment" | "receipt" | "history"
  >("pos")
  const [paymentMethod, setPaymentMethod] =
    useState<"cash" | "mpesa" | "credit">("cash")
  const [enabledPaymentMethods, setEnabledPaymentMethods] =
    useState<Record<"cash" | "mpesa" | "credit", boolean>>({
      cash: true,
      mpesa: false,
      credit: true,
    })
  const [mpesaPhone, setMpesaPhone] = useState("254")
  const [mpesaStatus, setMpesaStatus] = useState("")
  const [discount, setDiscount] = useState(0)
  // Credit customer picker state
  const [selectedCreditor, setSelectedCreditor] = useState<{
    id: string
    name: string
    phone: string
  } | null>(null)
  const [creditSearch, setCreditSearch] = useState("")
  const [showQuickAdd, setShowQuickAdd] = useState(false)
  const [quickName, setQuickName] = useState("")
  const [quickPhone, setQuickPhone] = useState("")
  const [activeOperators, setActiveOperators] = useState<ActiveOperator[]>([])
  const [selectedOperatorId, setSelectedOperatorId] = useState("")
  const [isCompletingSale, setIsCompletingSale] = useState(false)
  const [receiptInfo, setReceiptInfo] = useState<ReceiptInfo | null>(null)
  const [receiptHistory, setReceiptHistory] = useState<HistoricalReceipt[]>([])
  const [receiptHistoryCursor, setReceiptHistoryCursor] = useState<string | null>(null)
  const [receiptHistoryLoading, setReceiptHistoryLoading] = useState(false)
  const [receiptHistoryLoadingMore, setReceiptHistoryLoadingMore] = useState(false)
  const [receiptHistoryError, setReceiptHistoryError] = useState("")
  const [receiptHistoryRefresh, setReceiptHistoryRefresh] = useState(0)
  const [historicalReceipt, setHistoricalReceipt] = useState<HistoricalReceipt | null>(null)
  const [viewingPastReceipt, setViewingPastReceipt] = useState(false)
  const [isCartDraftReady, setIsCartDraftReady] = useState(false)
  const [hasLoadedPOSData, setHasLoadedPOSData] = useState(false)
  // Measured from the lower-left edge of the POS phone frame.
  const [cartBannerPosition, setCartBannerPosition] = useState({ x: 0, y: 68 })
  const cartBannerDrag = useRef<{ x: number; y: number } | null>(null)
  const cartBannerWasDragged = useRef(false)
  const c = useColors()
  const session = getClientSession()
  const currentBusinessId = session?.user.businessId ?? ""
  const currentUserId = session?.user.id ?? ""
  const categories = [{ name: "All", emoji: null }, ...categoryRows]

  useEffect(() => {
    if (!currentBusinessId) return
    void apiFetch<PaymentSettingsResponse>(
      `/api/settings?businessId=${encodeURIComponent(currentBusinessId)}`,
    )
      .then(({ preferences }) => {
        const methods = preferences.paymentConfig?.methods
        if (!methods) return
        const enabled = {
          cash: methods.cash !== false,
          mpesa: preferences.mpesaEnabled && methods.mpesa !== false,
          credit: methods.credit !== false,
        }
        setEnabledPaymentMethods(enabled)
        if (!enabled[paymentMethod])
          setPaymentMethod(
            enabled.cash ? "cash" : enabled.mpesa ? "mpesa" : "credit",
          )
      })
      .catch(() => undefined)
  }, [currentBusinessId])

  // POSScreen is intentionally allowed to unmount while the user visits
  // Dashboard or Stock. Restore the cashier's unfinished sale before writing
  // any state back to browser storage, so navigation never clears the cart.
  useEffect(() => {
    setIsCartDraftReady(false)
    if (!currentBusinessId || !currentUserId) {
      setIsCartDraftReady(true)
      return
    }
    try {
      const raw = window.localStorage.getItem(
        cartDraftKey(currentBusinessId, currentUserId),
      )
      const draft = raw ? JSON.parse(raw) as Partial<PosDraft> : null
      const cartItems = Array.isArray(draft?.cart)
        ? draft.cart.filter(
            (item): item is CartItem =>
              Boolean(item) &&
              typeof item.id === "string" &&
              typeof item.name === "string" &&
              Number.isFinite(Number(item.price)) &&
              Number.isInteger(item.qty) &&
              item.qty > 0,
          )
        : []
      setCart(cartItems)
      setView(
        draft?.view === "cart" || draft?.view === "payment"
          ? draft.view
          : "pos",
      )
      setPaymentMethod(
        draft?.paymentMethod === "mpesa" || draft?.paymentMethod === "credit"
          ? draft.paymentMethod
          : "cash",
      )
      setMpesaPhone(
        typeof draft?.mpesaPhone === "string" ? draft.mpesaPhone : "254",
      )
      setDiscount(
        [0, 5, 10, 15, 20].includes(Number(draft?.discount))
          ? Number(draft?.discount)
          : 0,
      )
      setSelectedCreditor(
        draft?.selectedCreditor?.id ? draft.selectedCreditor : null,
      )
      setSelectedOperatorId(
        typeof draft?.selectedOperatorId === "string"
          ? draft.selectedOperatorId
          : "",
      )
    } catch {
      window.localStorage.removeItem(
        cartDraftKey(currentBusinessId, currentUserId),
      )
    } finally {
      setIsCartDraftReady(true)
    }
  }, [currentBusinessId, currentUserId])

  useEffect(() => {
    if (!isCartDraftReady || !currentBusinessId || !currentUserId) return
    const key = cartDraftKey(currentBusinessId, currentUserId)
    // A completed receipt must never be restored as an unpaid cart.
    if (cart.length === 0 || (view === "receipt" && !viewingPastReceipt)) {
      window.localStorage.removeItem(key)
      return
    }
    const draft: PosDraft = {
      cart,
      view: view === "receipt" || view === "history" ? "pos" : view,
      paymentMethod,
      mpesaPhone,
      discount,
      selectedCreditor,
      selectedOperatorId,
    }
    window.localStorage.setItem(key, JSON.stringify(draft))
  }, [
    cart,
    currentBusinessId,
    currentUserId,
    discount,
    isCartDraftReady,
    mpesaPhone,
    paymentMethod,
    selectedCreditor,
    selectedOperatorId,
    viewingPastReceipt,
    view,
  ])

  useEffect(() => {
    if (view !== "history" || !currentBusinessId) return
    let cancelled = false
    setReceiptHistoryLoading(true)
    setReceiptHistoryError("")
    apiFetch<ReceiptHistoryResponse>(
      `/api/sales?businessId=${encodeURIComponent(currentBusinessId)}&limit=${receiptPageSize}`,
    )
      .then((response) => {
        if (cancelled) return
        setReceiptHistory(response.receipts)
        setReceiptHistoryCursor(response.nextCursor)
      })
      .catch((reason) => {
        if (cancelled) return
        setReceiptHistoryError(
          reason instanceof Error
            ? reason.message
            : "Unable to load receipt history.",
        )
      })
      .finally(() => {
        if (!cancelled) setReceiptHistoryLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [currentBusinessId, receiptHistoryRefresh, view])

  useEffect(() => {
    if (!session) {
      setDataError("Please sign in to load products and customers.")
      return
    }
    Promise.all([
      apiFetch<Array<{
        id: string
        name: string
        emoji: string | null
        barcode: string | null
        sellingPrice: number | null
        recentUnitsSold: number
        category: { id: string; name: string; emoji: string | null } | null
        inventory: { quantity: number } | null
      }>>(
        `/api/products?businessId=${encodeURIComponent(session.user.businessId)}`,
      ),
      apiFetch<Array<{ id: string; name: string; emoji: string | null }>>(
        `/api/categories?businessId=${encodeURIComponent(session.user.businessId)}`,
      ),
      apiFetch<Array<{
        id: string
        name: string
        phone: string | null
        creditAccount: { balance: number } | null
      }>>(
        `/api/customers?businessId=${encodeURIComponent(session.user.businessId)}`,
      ),
    ])
      .then(([productRows, categoryRows, customerRows]) => {
        setCategoryRows(categoryRows)
        setProducts(
          productRows.map((product) => ({
            id: product.id,
            name: product.name,
            price: Number(product.sellingPrice ?? 0),
            category: product.category?.name ?? "Uncategorized",
            stock: Number(product.inventory?.quantity ?? 0),
            recentUnitsSold: Number(product.recentUnitsSold ?? 0),
            emoji: product.emoji ?? product.category?.emoji ?? "📦",
            barcode: product.barcode,
          })),
        )
        setCreditCustomers(
          customerRows.map((customer) => ({
            id: customer.id,
            name: customer.name,
            phone: customer.phone ?? "No phone number",
            balance: Number(customer.creditAccount?.balance ?? 0),
          })),
        )
        setHasLoadedPOSData(true)
      })
      .catch((reason) =>
        {
          setHasLoadedPOSData(true)
          setDataError(
            reason instanceof Error ? reason.message : "Unable to load POS data.",
          )
        },
      )
  }, [session?.user.businessId])

  useEffect(() => {
    if (!isCartDraftReady || !hasLoadedPOSData || !currentBusinessId || !currentUserId) return
    const intent = takeCreditorSaleIntent(currentBusinessId, currentUserId)
    if (!intent) return
    const customer = creditCustomers.find((item) => item.id === intent.customerId)
    if (!customer) {
      setDataError("That customer could not be loaded. Choose the customer again and retry the sale.")
      return
    }
    setSelectedCreditor({ id: customer.id, name: customer.name, phone: customer.phone })
    setPaymentMethod("credit")
    setView("cart")
  }, [cart.length, creditCustomers, currentBusinessId, currentUserId, hasLoadedPOSData, isCartDraftReady])

  useEffect(() => {
    if (!initialCartItem) return
    setCart((previous) => {
      const existing = previous.find((item) => item.id === initialCartItem.id)
      if (existing)
        return previous.map((item) =>
          item.id === initialCartItem.id
            ? { ...item, qty: item.qty + 1 }
            : item,
        )
      return [...previous, { ...initialCartItem, qty: 1 }]
    })
    setView("cart")
  }, [initialCartItem])

  useEffect(() => {
    if (!session) return
    apiFetch<{
      sessions: Array<{
        closedAt: string | null
        cashier: {
          id: string
          fullName: string
          role: { name: string } | null
        } | null
        shift: { name: string } | null
        shiftType: string
      }>
    }>(
      `/api/cash/session?businessId=${encodeURIComponent(session.user.businessId)}`,
    )
      .then((response) => {
        const operators = response.sessions
          .filter(
            (item) =>
              !item.closedAt &&
              item.cashier &&
              ["CASHIER", "SUPERVISOR"].includes(
                item.cashier.role?.name?.toUpperCase() ?? "",
              ),
          )
          .map((item) => ({
            id: item.cashier!.id,
            name: item.cashier!.fullName,
            shift: item.shift?.name ?? item.shiftType,
          }))
          .filter(
            (operator, index, rows) =>
              rows.findIndex((candidate) => candidate.id === operator.id) ===
              index,
          )
        setActiveOperators(operators)
        if (operators.length === 1) setSelectedOperatorId(operators[0].id)
        else if (
          !operators.some((operator) => operator.id === selectedOperatorId)
        )
          setSelectedOperatorId("")
      })
      .catch(() => setActiveOperators([]))
  }, [session?.user.businessId])

  const normalizedSearch = search.trim().toLowerCase()
  const filtered = products.filter((p) => {
    const matchesSearch =
      !normalizedSearch ||
      [p.name, p.category, p.barcode ?? ""].some((value) =>
        value.toLowerCase().includes(normalizedSearch),
      )
    return p.stock > 0 && (category === "All" || p.category === category) && matchesSearch
  }).sort((left, right) => right.recentUnitsSold - left.recentUnitsSold)

  const addToCart = (p: typeof products[0]) => {
    setCart((prev) => {
      const existing = prev.find((x) => x.id === p.id)
      if (existing)
        return prev.map((x) => (x.id === p.id ? { ...x, qty: x.qty + 1 } : x))
      return [
        ...prev,
        { id: p.id, name: p.name, price: p.price, qty: 1, emoji: p.emoji },
      ]
    })
  }

  const addCustomer = async () => {
    if (!session || !quickName.trim() || !quickPhone.trim()) return
    try {
      const response = await apiFetch<{ customerId: string }>(
        "/api/customers",
        {
          method: "POST",
          body: JSON.stringify({
            businessId: session.user.businessId,
            name: quickName.trim(),
            phone: quickPhone.trim(),
          }),
        },
      )
      const customer = {
        id: response.customerId,
        name: quickName.trim(),
        phone: quickPhone.trim(),
      }
      setCreditCustomers((previous) => [
        ...previous,
        { ...customer, balance: 0 },
      ])
      setSelectedCreditor(customer)
      setShowQuickAdd(false)
      setQuickName("")
      setQuickPhone("")
    } catch (reason) {
      setDataError(
        reason instanceof Error ? reason.message : "Unable to add customer.",
      )
    }
  }

  const updateQty = (id: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((x) =>
          x.id === id ? { ...x, qty: Math.max(0, x.qty + delta) } : x,
        )
        .filter((x) => x.qty > 0),
    )
  }

  const clearCart = () => {
    setCart([])
    setDiscount(0)
    setSelectedCreditor(null)
    setCreditSearch("")
    setShowQuickAdd(false)
    setQuickName("")
    setQuickPhone("")
    setPaymentMethod((current) => (current === "credit" ? "cash" : current))
  }

  const subtotal = cart.reduce((s, x) => s + x.price * x.qty, 0)
  const discountAmt = Math.round((subtotal * discount) / 100)
  const total = subtotal - discountAmt
  const cartCount = cart.reduce((s, x) => s + x.qty, 0)

  const completeSale = async () => {
    if (
      !session ||
      !selectedOperatorId ||
      cart.length === 0 ||
      isCompletingSale
    )
      return
    setIsCompletingSale(true)
    setMpesaStatus("")
    try {
      let mpesaReceipt: string | undefined
      if (paymentMethod === "mpesa") {
        const enteredPhone = mpesaPhone.replace(/\s+/g, "").replace(/^\+/, "")
        const normalizedPhone = enteredPhone.startsWith("0")
          ? `254${enteredPhone.slice(1)}`
          : enteredPhone.startsWith("254")
            ? enteredPhone
            : `254${enteredPhone}`
        if (!/^254(?:7|1)\d{8}$/.test(normalizedPhone))
          throw new Error(
            "Enter a valid Kenyan phone number, for example 254712345678.",
          )
        setMpesaPhone(normalizedPhone)
        const confirmed = window.confirm(
          `Send an M-Pesa payment prompt?\n\nAmount: KSh ${total.toLocaleString()}\nCustomer phone: ${normalizedPhone}\n\nThe customer must enter their M-Pesa PIN before the sale is completed.`,
        )
        if (!confirmed) return
        setMpesaStatus("Sending STK prompt to the customer phone…")
        const push = await apiFetch<{
          success: boolean
          checkoutRequestId?: string
          darajaResult?: { CheckoutRequestID?: string }
          error?: string
        }>("/api/payments/stk-push", {
          method: "POST",
          body: JSON.stringify({
            phoneNumber: normalizedPhone,
            amount: total,
            businessId: currentBusinessId,
          }),
        })
        const checkoutRequestId =
          push.checkoutRequestId ?? push.darajaResult?.CheckoutRequestID
        if (!push.success || !checkoutRequestId)
          throw new Error(push.error ?? "Unable to start the M-Pesa payment.")

        for (let attempt = 0; attempt < 20; attempt += 1) {
          setMpesaStatus("Waiting for the customer to enter their M-Pesa PIN…")
          await new Promise((resolve) => window.setTimeout(resolve, 3000))
          const status = await apiFetch<{
            status: string
            receipt?: string
            message?: string
          }>("/api/payments/stk-query", {
            method: "POST",
            body: JSON.stringify({
              checkoutRequestId,
              businessId: currentBusinessId,
            }),
          })
          if (status.status === "SUCCESS") {
            mpesaReceipt = status.receipt
            setMpesaStatus("M-Pesa payment verified. Completing sale…")
            break
          }
          if (status.status === "FAILED" || status.status === "CANCELLED")
            throw new Error(
              status.message ?? "M-Pesa payment was not completed.",
            )
          if (attempt === 19)
            throw new Error(
              "M-Pesa verification timed out. Check the customer phone before retrying.",
            )
        }
      }

      const response = await apiFetch<{
        saleNumber: string
        createdAt: string
        cashier: { name: string }
        business: { name: string; branch: string | null }
      }>("/api/sales", {
        method: "POST",
        body: JSON.stringify({
          businessId: currentBusinessId,
          cashierId: selectedOperatorId,
          invoiceNo: `POS-${Date.now()}`,
          totalAmount: total,
          subtotal,
          discountAmount: discountAmt,
          paymentMode:
            paymentMethod === "mpesa"
              ? "MPESA"
              : paymentMethod === "credit"
                ? "CREDIT"
                : "CASH",
          mpesaRef: mpesaReceipt,
          customerId: paymentMethod === "credit" ? selectedCreditor?.id : null,
          items: cart.map((item) => ({
            productId: item.id,
            quantity: item.qty,
            unitPrice: item.price,
            total: item.price * item.qty,
          })),
        }),
      })
      window.dispatchEvent(new Event("mobiduka-notification"))
      setReceiptInfo({
        saleNumber: response.saleNumber,
        createdAt: response.createdAt,
        cashierName: response.cashier.name,
        businessName: response.business.name,
        businessBranch: response.business.branch,
      })
      setViewingPastReceipt(false)
      setHistoricalReceipt(null)
      setView("receipt")
    } catch (reason) {
      const message =
        reason instanceof Error ? reason.message : "Unable to complete sale."
      setDataError(message)
      setMpesaStatus("")
      window.setTimeout(
        () => setDataError((current) => (current === message ? "" : current)),
        6000,
      )
    } finally {
      setIsCompletingSale(false)
    }
  }

  const loadMoreReceiptHistory = async () => {
    if (!receiptHistoryCursor || receiptHistoryLoadingMore) return
    setReceiptHistoryLoadingMore(true)
    setReceiptHistoryError("")
    try {
      const response = await apiFetch<ReceiptHistoryResponse>(
        `/api/sales?businessId=${encodeURIComponent(currentBusinessId)}&limit=${receiptPageSize}&cursor=${encodeURIComponent(receiptHistoryCursor)}`,
      )
      setReceiptHistory((previous) => [...previous, ...response.receipts])
      setReceiptHistoryCursor(response.nextCursor)
    } catch (reason) {
      setReceiptHistoryError(
        reason instanceof Error
          ? reason.message
          : "Unable to load more receipt history.",
      )
    } finally {
      setReceiptHistoryLoadingMore(false)
    }
  }

  const pastReceipt = viewingPastReceipt ? historicalReceipt : null
  const displayedReceiptItems = pastReceipt
    ? pastReceipt.items.map((item) => ({
        id: item.id,
        name: item.name,
        price: item.price,
        qty: item.quantity,
        emoji: item.emoji,
      }))
    : cart
  const displayedReceiptSubtotal = pastReceipt?.subtotal ?? subtotal
  const displayedReceiptDiscountAmount =
    pastReceipt?.discountAmount ?? discountAmt
  const displayedReceiptTotal = pastReceipt?.total ?? total
  const displayedReceiptPaymentMethod =
    pastReceipt?.paymentMethod.toLowerCase() ?? paymentMethod
  const normalizedReceiptPaymentMethod = normalizePaymentMethod(
    displayedReceiptPaymentMethod,
  )
  const displayedReceiptCreatedAt =
    pastReceipt?.createdAt ?? receiptInfo?.createdAt ?? new Date().toISOString()
  const displayedReceiptNumber =
    pastReceipt?.saleNumber ?? receiptInfo?.saleNumber ?? "Pending"
  const displayedReceiptCashier =
    pastReceipt?.cashier ?? receiptInfo?.cashierName ?? "—"
  const displayedReceiptBusiness = pastReceipt
    ? [pastReceipt.businessName, pastReceipt.businessBranch]
        .filter(Boolean)
        .join(" · ")
    : [receiptInfo?.businessName, receiptInfo?.businessBranch]
        .filter(Boolean)
        .join(" · ")

  if (view === "receipt") {
    const receiptOperator = activeOperators.find(
      (operator) => operator.id === selectedOperatorId,
    )
    return (
      <div className="screen" style={{ background: c.bg }}>
        <div
          style={{
              background: viewingPastReceipt
                ? "linear-gradient(135deg, #0D1B3D, #123A8F)"
                : "linear-gradient(135deg, #2E7D32, #388E3C)",
              padding: "52px 20px 28px",
              flexShrink: 0,
            }}
          >
            <div style={{ textAlign: "center" }}>
              {viewingPastReceipt ? (
                <div
                  style={{
                    width: 44,
                    height: 44,
                    margin: "0 auto 8px",
                    borderRadius: 14,
                    background: "rgba(255,255,255,0.12)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <svg
                    aria-hidden="true"
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="white"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M6 2h12v20l-3-2-3 2-3-2-3 2Z" />
                    <path d="M9 8h6M9 12h6" />
                  </svg>
                </div>
              ) : (
                <div style={{ fontSize: 48, marginBottom: 8 }}>✅</div>
              )}
              <div style={{ color: "white", fontSize: 22, fontWeight: 800 }}>
                {viewingPastReceipt ? "Receipt Details" : "Sale Complete!"}
              </div>
            <div
              style={{
                color: "rgba(255,255,255,0.8)",
                fontSize: 14,
                marginTop: 4,
              }}
            >
              Receipt #{displayedReceiptNumber}
            </div>
          </div>
        </div>
        <div className="scroll-area" style={{ padding: "20px 16px 100px" }}>
          <div className="card" style={{ padding: "20px" }}>
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <div style={{ fontSize: 13, color: c.muted, marginBottom: 4 }}>
                {displayedReceiptBusiness || "Business"}
              </div>
              <div style={{ fontSize: 12, color: c.faint }}>
                {new Date(displayedReceiptCreatedAt).toLocaleString(
                  "en-KE",
                  {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: false,
                  },
                )}
              </div>
            </div>
            <div
              aria-label="Receipt details"
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1px 1fr 1px 1fr",
                alignItems: "stretch",
                padding: "10px 8px",
                marginBottom: 16,
                borderRadius: 10,
                background: c.cardAlt,
              }}
            >
              <div
                style={{ minWidth: 0, padding: "0 5px", textAlign: "center" }}
              >
                <div style={{ fontSize: 10, color: c.muted, marginBottom: 3 }}>
                  Cashier
                </div>
                <div
                  style={{
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    fontSize: 12,
                    fontWeight: 700,
                    color: c.text,
                  }}
                >
                  {displayedReceiptCashier ?? receiptOperator?.name ?? "—"}
                </div>
              </div>
              <div style={{ background: c.isDark ? "#1A3366" : "#E8ECF4" }} />
              <div
                style={{ minWidth: 0, padding: "0 5px", textAlign: "center" }}
              >
                <div style={{ fontSize: 10, color: c.muted, marginBottom: 3 }}>
                  Shift
                </div>
                <div
                  style={{
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    fontSize: 12,
                    fontWeight: 700,
                    color: c.text,
                  }}
                >
                  {viewingPastReceipt ? "—" : receiptOperator?.shift ?? "—"}
                </div>
              </div>
              <div style={{ background: c.isDark ? "#1A3366" : "#E8ECF4" }} />
              <div
                style={{ minWidth: 0, padding: "0 5px", textAlign: "center" }}
              >
                <div style={{ fontSize: 10, color: c.muted, marginBottom: 3 }}>
                  Receipt #
                </div>
                <div
                  style={{
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    fontSize: 12,
                    fontWeight: 700,
                    color: "#123A8F",
                    fontFamily: "monospace",
                  }}
                >
                  {displayedReceiptNumber}
                </div>
              </div>
            </div>
            <div
              style={{
                borderTop: "1px dashed #E8ECF4",
                paddingTop: 16,
                marginBottom: 16,
              }}
            >
              {displayedReceiptItems.map((item, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: 8,
                  }}
                >
                  <div style={{ fontSize: 13, color: c.text }}>
                    {item.name} × {item.qty}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: c.text }}>
                    KSh {item.price * item.qty}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ borderTop: "1px dashed #E8ECF4", paddingTop: 12 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: 6,
                }}
              >
                <div style={{ fontSize: 13, color: c.muted }}>Subtotal</div>
                <div style={{ fontSize: 13, color: c.text }}>
                  KSh {displayedReceiptSubtotal.toLocaleString()}
                </div>
              </div>
              {displayedReceiptDiscountAmount > 0 && (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: 6,
                  }}
                >
                  <div style={{ fontSize: 13, color: "#D32F2F" }}>
                    Discount
                  </div>
                  <div style={{ fontSize: 13, color: "#D32F2F" }}>
                    -KSh {displayedReceiptDiscountAmount.toLocaleString()}
                  </div>
                </div>
              )}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  paddingTop: 8,
                  borderTop: "2px solid #123A8F",
                  marginTop: 8,
                }}
              >
                <div style={{ fontSize: 16, fontWeight: 800, color: c.text }}>
                  TOTAL
                </div>
                <div
                  style={{ fontSize: 16, fontWeight: 800, color: "#123A8F" }}
                >
                  KSh {displayedReceiptTotal.toLocaleString()}
                </div>
              </div>
              <div
                style={{
                  marginTop: 8,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div style={{ fontSize: 12, color: c.muted }}>Payment</div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span
                    className={`badge ${
                      normalizedReceiptPaymentMethod.includes("mpesa")
                        ? "badge-success"
                        : normalizedReceiptPaymentMethod.includes("credit")
                          ? "badge-error"
                          : "badge-blue"
                    }`}
                  >
                    {normalizedReceiptPaymentMethod.includes("mpesa")
                      ? "M-Pesa"
                      : normalizedReceiptPaymentMethod.includes("credit")
                        ? "Credit / Tab"
                        : "Cash"}
                  </span>
                </div>
              </div>
              {normalizedReceiptPaymentMethod.includes("credit") &&
                (pastReceipt?.customer || selectedCreditor) && (
                <div
                  style={{
                    marginTop: 8,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div style={{ fontSize: 12, color: c.muted }}>Charged to</div>
                  <div
                    style={{ fontSize: 13, fontWeight: 700, color: "#D32F2F" }}
                  >
                    {pastReceipt?.customer ?? selectedCreditor?.name}
                  </div>
                </div>
              )}
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
            <button
              className="btn"
              aria-label="Receipt history"
              onClick={() => {
                setViewingPastReceipt(false)
                setView("history")
              }}
              style={{
                padding: "14px 12px",
                background: "rgba(13,27,61,0.08)",
                border: "1px solid #D0D7E8",
                borderRadius: 14,
                fontSize: 14,
                fontWeight: 600,
                color: c.muted,
                cursor: "pointer",
                fontFamily: "inherit",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
                <path d="M3 3v5h5" />
                <path d="M12 7v5l3 2" />
              </svg>
            </button>
            <button
              className="btn"
              style={{
                flex: 1,
                padding: "14px",
                background: "rgba(18,58,143,0.1)",
                border: "1px solid #123A8F",
                borderRadius: 14,
                fontSize: 14,
                fontWeight: 600,
                color: "#123A8F",
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              Print Receipt
            </button>
            <button
              className="btn"
              onClick={() => {
                if (viewingPastReceipt) {
                  setViewingPastReceipt(false)
                  setView("history")
                  return
                }
                setCart([])
                setView("pos")
                setDiscount(0)
                setSelectedCreditor(null)
                setCreditSearch("")
                setReceiptInfo(null)
              }}
              style={{
                flex: 1,
                padding: "14px",
                background: "linear-gradient(135deg, #123A8F, #1A4FBF)",
                border: "none",
                borderRadius: 14,
                fontSize: 14,
                fontWeight: 700,
                color: "white",
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              {viewingPastReceipt ? "Back to History" : "New Sale"}
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (view === "history") {
    const recordedTotal = receiptHistory.reduce(
      (sum, receipt) => sum + receipt.total,
      0,
    )
    return (
      <div className="screen" style={{ background: c.bg }}>
        <div
          style={{
            background: "linear-gradient(135deg, #0D1B3D, #123A8F)",
            padding: "52px 20px 24px",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <button
              className="btn"
              aria-label="Back to Point of Sale"
              onClick={() => setView("pos")}
              style={{
                background: "rgba(255,255,255,0.12)",
                border: "none",
                borderRadius: 10,
                width: 36,
                height: 36,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
              }}
            >
              <svg
                aria-hidden="true"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="2.5"
                strokeLinecap="round"
              >
                <path d="M19 12H5M12 5l-7 7 7 7" />
              </svg>
            </button>
            <div>
              <div style={{ color: "white", fontSize: 18, fontWeight: 700 }}>
                Receipt History
              </div>
              <div
                style={{
                  color: "rgba(255,255,255,0.6)",
                  fontSize: 12,
                  marginTop: 2,
                }}
              >
                Most recent first
              </div>
            </div>
            <div
              aria-hidden="true"
              style={{
                marginLeft: "auto",
                width: 38,
                height: 38,
                borderRadius: 12,
                background: "rgba(255,255,255,0.12)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg
                width="19"
                height="19"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M6 2h12v20l-3-2-3 2-3-2-3 2Z" />
                <path d="M9 8h6M9 12h6" />
              </svg>
            </div>
          </div>
        </div>
        <div className="scroll-area" style={{ padding: "16px", paddingBottom: 90 }}>
          {receiptHistoryError && (
            <div
              role="alert"
              style={{
                padding: "12px 14px",
                marginBottom: 14,
                borderRadius: 10,
                background: "#FFEBEE",
                color: "#C62828",
                fontSize: 12,
              }}
            >
              {receiptHistoryError}
              <button
                className="btn"
                onClick={() => setReceiptHistoryRefresh((value) => value + 1)}
                style={{
                  display: "block",
                  marginTop: 8,
                  padding: 0,
                  border: "none",
                  background: "none",
                  color: "#B71C1C",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Try again
              </button>
            </div>
          )}
          <div
            className="card"
            style={{
              padding: "14px 16px",
              marginBottom: 16,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
            }}
          >
            <div>
              <div style={{ fontSize: 11, color: c.muted }}>
                Receipts loaded
              </div>
              <div
                style={{
                  fontSize: 20,
                  fontWeight: 800,
                  color: c.text,
                  marginTop: 2,
                }}
              >
                {receiptHistory.length}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 11, color: c.muted }}>
                Loaded sales total
              </div>
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 800,
                  color: "#123A8F",
                  marginTop: 2,
                }}
              >
                KSh {recordedTotal.toLocaleString()}
              </div>
            </div>
          </div>
          {receiptHistoryLoading && receiptHistory.length === 0 ? (
            <div
              role="status"
              style={{
                padding: "44px 20px",
                textAlign: "center",
                color: c.muted,
                fontSize: 13,
              }}
            >
              Loading receipt history…
            </div>
          ) : receiptHistory.length === 0 && !receiptHistoryError ? (
            <div
              className="card"
              style={{ padding: "48px 20px", textAlign: "center" }}
            >
              <div
                style={{
                  width: 48,
                  height: 48,
                  margin: "0 auto 12px",
                  display: "grid",
                  placeItems: "center",
                  borderRadius: 14,
                  background: c.cardAlt,
                  color: c.muted,
                }}
              >
                <svg
                  aria-hidden="true"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M6 2h12v20l-3-2-3 2-3-2-3 2Z" />
                  <path d="M9 8h6M9 12h6" />
                </svg>
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: c.text }}>
                No receipts yet
              </div>
              <div style={{ marginTop: 4, fontSize: 12, color: c.muted }}>
                Completed sales will appear here.
              </div>
            </div>
          ) : (
            receiptHistory.map((receipt, index) => {
              const itemCount = receipt.items.reduce(
                (sum, item) => sum + item.quantity,
                0,
              )
              const paymentMethod = normalizePaymentMethod(
                receipt.paymentMethod,
              )
              const paymentLabel = paymentMethod.includes("mpesa")
                ? "M-Pesa"
                : paymentMethod.includes("credit")
                  ? "Credit / Tab"
                  : "Cash"
              return (
                <button
                  key={receipt.id}
                  className="btn card"
                  onClick={() => {
                    setHistoricalReceipt(receipt)
                    setViewingPastReceipt(true)
                    setView("receipt")
                  }}
                  style={{
                    width: "100%",
                    padding: "14px 16px",
                    marginBottom: 10,
                    border: "none",
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    textAlign: "left",
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  <div
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: 12,
                      background: index === 0 ? c.infoBg : c.cardAlt,
                      color: index === 0 ? "#123A8F" : c.muted,
                      display: "grid",
                      placeItems: "center",
                      flexShrink: 0,
                    }}
                  >
                    <svg
                      aria-hidden="true"
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M6 2h12v20l-3-2-3 2-3-2-3 2Z" />
                      <path d="M9 8h6M9 12h6" />
                    </svg>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 7,
                        marginBottom: 3,
                      }}
                    >
                      <div
                        style={{
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          fontSize: 13,
                          fontWeight: 700,
                          color: c.text,
                        }}
                      >
                        {receipt.saleNumber}
                      </div>
                      {index === 0 && (
                        <span className="badge badge-blue" style={{ fontSize: 9 }}>
                          Latest
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: c.muted }}>
                      {new Date(receipt.createdAt).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                      })}{" "}
                      ·{" "}
                      {new Date(receipt.createdAt).toLocaleTimeString("en-GB", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}{" "}
                      · {itemCount} {itemCount === 1 ? "item" : "items"}
                    </div>
                    <div
                      style={{
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        fontSize: 10,
                        color: c.faint,
                        marginTop: 3,
                      }}
                    >
                      {receipt.cashier} · {paymentLabel}
                    </div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 800,
                        color: c.text,
                      }}
                    >
                      KSh {receipt.total.toLocaleString()}
                    </div>
                    <svg
                      aria-hidden="true"
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke={c.faint}
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{ marginTop: 5, marginLeft: "auto" }}
                    >
                      <path d="m9 18 6-6-6-6" />
                    </svg>
                  </div>
                </button>
              )
            })
          )}
          {receiptHistoryCursor && (
            <button
              className="btn"
              onClick={() => void loadMoreReceiptHistory()}
              disabled={receiptHistoryLoadingMore}
              style={{
                width: "100%",
                padding: "13px 16px",
                marginTop: 4,
                border: `1px solid ${c.divider}`,
                borderRadius: 12,
                background: c.card,
                color: c.text,
                fontSize: 13,
                fontWeight: 700,
                cursor: receiptHistoryLoadingMore ? "wait" : "pointer",
                fontFamily: "inherit",
              }}
            >
              {receiptHistoryLoadingMore ? "Loading…" : "Load older receipts"}
            </button>
          )}
        </div>
      </div>
    )
  }

  if (view === "payment") {
    return (
      <div className="screen" style={{ background: c.bg }}>
        <div
          style={{
            background: "linear-gradient(135deg, #0D1B3D, #123A8F)",
            padding: "52px 20px 24px",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <button
              className="btn"
              onClick={() => setView("cart")}
              style={{
                background: "rgba(255,255,255,0.12)",
                border: "none",
                borderRadius: 10,
                width: 36,
                height: 36,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
              }}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="2.5"
                strokeLinecap="round"
              >
                <path d="M19 12H5M12 5l-7 7 7 7" />
              </svg>
            </button>
            <div style={{ color: "white", fontSize: 18, fontWeight: 700 }}>
              Payment
            </div>
          </div>
          <div style={{ textAlign: "center", marginTop: 20 }}>
            <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 13 }}>
              Total Amount Due
            </div>
            <div
              style={{
                color: "#D4AF37",
                fontSize: 38,
                fontWeight: 900,
                letterSpacing: -1,
              }}
            >
              KSh {total.toLocaleString()}
            </div>
            <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 12 }}>
              {cartCount} items
            </div>
          </div>
        </div>
        <div className="scroll-area" style={{ padding: "20px 16px 100px" }}>
          {dataError && (
            <div
              style={{
                marginBottom: 14,
                padding: "12px 14px",
                borderRadius: 10,
                background: "#FFF5F5",
                border: "1px solid #FFCDD2",
                color: "#B71C1C",
                fontSize: 13,
                lineHeight: 1.4,
              }}
            >
              {dataError}
            </div>
          )}
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: c.muted,
              marginBottom: 12,
              textTransform: "uppercase",
              letterSpacing: 0.5,
            }}
          >
            Select Payment Method
          </div>
          {[
            {
              key: "cash",
              label: "Cash",
              sub: "Physical cash payment",
              icon: "💵",
              color: "#123A8F",
            },
            {
              key: "mpesa",
              label: "M-Pesa",
              sub: "Mobile money transfer",
              icon: "📱",
              color: "#2E7D32",
            },
            {
              key: "credit",
              label: "Credit / Tab",
              sub: "Add to customer account",
              icon: "📋",
              color: "#D32F2F",
            },
          ]
            .filter(
              (m) =>
                enabledPaymentMethods[(m.key as "cash" | "mpesa" | "credit")],
            )
            .map((m) => (
              <button
                key={m.key}
                className="btn"
                onClick={() =>
                  setPaymentMethod(m.key as "cash" | "mpesa" | "credit")
                }
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  padding: "14px 16px",
                  marginBottom: 10,
                  borderRadius: 14,
                  background: paymentMethod === m.key ? `${m.color}12` : c.card,
                  border:
                    paymentMethod === m.key
                      ? `2px solid ${m.color}`
                      : "1.5px solid #E8ECF4",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  boxShadow:
                    paymentMethod === m.key
                      ? `0 0 0 4px ${m.color}10`
                      : "0 1px 4px rgba(0,0,0,0.06)",
                }}
              >
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    background: `${m.color}18`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 22,
                  }}
                >
                  {m.icon}
                </div>
                <div style={{ flex: 1, textAlign: "left" }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: c.text }}>
                    {m.label}
                  </div>
                  <div style={{ fontSize: 12, color: c.muted }}>{m.sub}</div>
                </div>
                {paymentMethod === m.key && (
                  <div
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: "50%",
                      background: m.color,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="white"
                      strokeWidth="3"
                    >
                      <polyline points="20,6 9,17 4,12" />
                    </svg>
                  </div>
                )}
              </button>
            ))}

          {/* Credit customer picker */}
          {paymentMethod === "credit" && (
            <div style={{ marginTop: 20 }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: c.muted,
                  marginBottom: 12,
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                }}
              >
                Customer Account
              </div>

              {selectedCreditor ? (
                <div
                  style={{
                    background: c.isDark
                      ? "rgba(18,58,143,0.25)"
                      : "rgba(18,58,143,0.08)",
                    border: "2px solid #123A8F",
                    borderRadius: 14,
                    padding: "12px 16px",
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: "50%",
                      background: "linear-gradient(135deg, #123A8F, #1A4FBF)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 14,
                      fontWeight: 800,
                      color: "white",
                      flexShrink: 0,
                    }}
                  >
                    {selectedCreditor.name
                      .split(" ")
                      .map((w: string) => w[0])
                      .join("")
                      .slice(0, 2)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div
                      style={{ fontSize: 14, fontWeight: 700, color: c.text }}
                    >
                      {selectedCreditor.name}
                    </div>
                    <div style={{ fontSize: 12, color: c.muted }}>
                      {selectedCreditor.phone}
                    </div>
                  </div>
                  <button
                    className="btn"
                    onClick={() => setSelectedCreditor(null)}
                    style={{
                      background: "none",
                      border: "none",
                      color: c.muted,
                      cursor: "pointer",
                      fontSize: 18,
                      lineHeight: 1,
                      padding: 4,
                    }}
                  >
                    ×
                  </button>
                </div>
              ) : (
                <div>
                  <input
                    className="input"
                    placeholder="🔍 Search customer by name or phone…"
                    value={creditSearch}
                    onChange={(e) => {
                      setCreditSearch(e.target.value)
                      setShowQuickAdd(false)
                    }}
                    style={{ marginBottom: 8 }}
                  />
                  <div
                    style={{
                      maxHeight: 180,
                      overflowY: "auto",
                      borderRadius: 12,
                      border: `1px solid ${c.isDark ? "#1A3366" : "#E8ECF4"}`,
                    }}
                  >
                    {creditCustomers
                      .filter(
                        (cu) =>
                          cu.name
                            .toLowerCase()
                            .includes(creditSearch.toLowerCase()) ||
                          cu.phone.includes(creditSearch),
                      )
                      .map((cu, i, arr) => (
                        <button
                          key={cu.id}
                          className="btn"
                          onClick={() => {
                            setSelectedCreditor({
                              id: cu.id,
                              name: cu.name,
                              phone: cu.phone,
                            })
                            setCreditSearch("")
                          }}
                          style={{
                            width: "100%",
                            display: "flex",
                            alignItems: "center",
                            gap: 12,
                            padding: "11px 14px",
                            border: "none",
                            borderBottom:
                              i < arr.length - 1 ? c.divider : "none",
                            background: "none",
                            cursor: "pointer",
                            fontFamily: "inherit",
                            textAlign: "left",
                          }}
                        >
                          <div
                            style={{
                              width: 36,
                              height: 36,
                              borderRadius: "50%",
                              background:
                                "linear-gradient(135deg, #123A8F, #1A4FBF)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: 12,
                              fontWeight: 700,
                              color: "white",
                              flexShrink: 0,
                            }}
                          >
                            {cu.name
                              .split(" ")
                              .map((w) => w[0])
                              .join("")
                              .slice(0, 2)}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div
                              style={{
                                fontSize: 13,
                                fontWeight: 600,
                                color: c.text,
                              }}
                            >
                              {cu.name}
                            </div>
                            <div style={{ fontSize: 11, color: c.muted }}>
                              {cu.phone}
                            </div>
                          </div>
                          {cu.balance > 0 && (
                            <span
                              style={{
                                fontSize: 10,
                                fontWeight: 700,
                                color: "#D32F2F",
                                background: c.errorBg,
                                padding: "2px 8px",
                                borderRadius: 100,
                              }}
                            >
                              Owes KSh {cu.balance.toLocaleString()}
                            </span>
                          )}
                        </button>
                      ))}
                    {creditCustomers.filter(
                      (cu) =>
                        cu.name
                          .toLowerCase()
                          .includes(creditSearch.toLowerCase()) ||
                        cu.phone.includes(creditSearch),
                    ).length === 0 && (
                      <div
                        style={{
                          padding: "14px 16px",
                          fontSize: 13,
                          color: c.muted,
                          textAlign: "center",
                        }}
                      >
                        No customers found
                      </div>
                    )}
                  </div>
                  {/* Quick Add */}
                  {!showQuickAdd ? (
                    <button
                      className="btn"
                      onClick={() => setShowQuickAdd(true)}
                      style={{
                        width: "100%",
                        marginTop: 8,
                        padding: "10px",
                        background: "none",
                        border: `1.5px dashed ${
                          c.isDark ? "#1A3366" : "#D0D7E8"
                        }`,
                        borderRadius: 12,
                        fontSize: 13,
                        fontWeight: 600,
                        color: "#123A8F",
                        cursor: "pointer",
                        fontFamily: "inherit",
                      }}
                    >
                      + Quick-add new customer
                    </button>
                  ) : (
                    <div
                      style={{
                        marginTop: 10,
                        background: c.cardAlt,
                        borderRadius: 12,
                        padding: "14px",
                      }}
                    >
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          color: c.muted,
                          marginBottom: 10,
                        }}
                      >
                        QUICK ADD
                      </div>
                      <input
                        className="input"
                        placeholder="Full Name *"
                        value={quickName}
                        onChange={(e) => setQuickName(e.target.value)}
                        style={{ marginBottom: 8 }}
                      />
                      <input
                        className="input"
                        placeholder="Phone Number *"
                        value={quickPhone}
                        onChange={(e) => setQuickPhone(e.target.value)}
                        type="tel"
                        style={{ marginBottom: 10 }}
                      />
                      <div style={{ display: "flex", gap: 8 }}>
                        <button
                          className="btn"
                          onClick={() => {
                            setShowQuickAdd(false)
                            setQuickName("")
                            setQuickPhone("")
                          }}
                          style={{
                            flex: 1,
                            padding: "10px",
                            background: "none",
                            border: `1px solid ${
                              c.isDark ? "#1A3366" : "#E8ECF4"
                            }`,
                            borderRadius: 10,
                            fontSize: 13,
                            fontWeight: 600,
                            color: c.muted,
                            cursor: "pointer",
                            fontFamily: "inherit",
                          }}
                        >
                          Cancel
                        </button>
                        <button
                          className="btn"
                          onClick={() => void addCustomer()}
                          disabled={!quickName || !quickPhone || !session}
                          style={{
                            flex: 2,
                            padding: "10px",
                            background:
                              quickName && quickPhone && session
                                ? "#123A8F"
                                : c.cardAlt,
                            border: "none",
                            borderRadius: 10,
                            fontSize: 13,
                            fontWeight: 700,
                            color:
                              quickName && quickPhone && session
                                ? "white"
                                : c.faint,
                            cursor:
                              quickName && quickPhone && session
                                ? "pointer"
                                : "not-allowed",
                            fontFamily: "inherit",
                          }}
                        >
                          Add &amp; Select
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {paymentMethod === "mpesa" && (
            <div style={{ marginTop: 20 }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: c.muted,
                  marginBottom: 8,
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                }}
              >
                Customer M-Pesa Phone
              </div>
              <input
                className="input"
                type="tel"
                inputMode="tel"
                placeholder="2547XXXXXXXX"
                value={mpesaPhone}
                onChange={(event) => setMpesaPhone(event.target.value)}
              />
              <div style={{ fontSize: 11, color: c.muted, marginTop: 6 }}>
                The customer will receive an STK prompt and must enter their
                PIN.
              </div>
            </div>
          )}

          <div style={{ marginTop: 20 }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: c.muted,
                marginBottom: 12,
                textTransform: "uppercase",
                letterSpacing: 0.5,
              }}
            >
              Discount
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {[0, 5, 10, 15, 20].map((d) => (
                <button
                  key={d}
                  className="btn"
                  onClick={() => setDiscount(d)}
                  style={{
                    flex: 1,
                    padding: "10px 4px",
                    borderRadius: 10,
                    background: discount === d ? "#123A8F" : c.card,
                    border: discount === d ? "none" : "1.5px solid #E8ECF4",
                    color: discount === d ? "white" : c.muted,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  {d}%
                </button>
              ))}
            </div>
          </div>

          {activeOperators.length > 0 && (
            <div style={{ marginTop: 20 }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: c.muted,
                  marginBottom: 12,
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                }}
              >
                Sale Attributed To
              </div>
              {activeOperators.map((operator) => (
                <button
                  key={operator.id}
                  className="btn"
                  onClick={() => setSelectedOperatorId(operator.id)}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "12px 14px",
                    marginBottom: 8,
                    borderRadius: 12,
                    background:
                      selectedOperatorId === operator.id
                        ? "rgba(18,58,143,0.08)"
                        : c.card,
                    border:
                      selectedOperatorId === operator.id
                        ? "2px solid #123A8F"
                        : `1px solid ${c.divider}`,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    textAlign: "left",
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div
                      style={{ fontSize: 13, fontWeight: 700, color: c.text }}
                    >
                      {operator.name}
                    </div>
                    <div style={{ fontSize: 11, color: c.muted }}>
                      {operator.shift} · Active
                    </div>
                  </div>
                  {selectedOperatorId === operator.id && (
                    <span style={{ color: "#123A8F", fontWeight: 800 }}>✓</span>
                  )}
                </button>
              ))}
            </div>
          )}

          {(() => {
            const canComplete =
              !!selectedOperatorId &&
              (paymentMethod !== "credit" || !!selectedCreditor) &&
              (paymentMethod !== "mpesa" ||
                mpesaPhone.replace(/\s+/g, "").length >= 10)
            return (
              <button
                className="btn"
                onClick={() => {
                  if (canComplete) void completeSale()
                }}
                disabled={!canComplete || isCompletingSale}
                style={{
                  width: "100%",
                  marginTop: 28,
                  padding: "18px",
                  background: canComplete
                    ? "linear-gradient(135deg, #123A8F, #1A4FBF)"
                    : c.isDark
                      ? "#162B5A"
                      : "#E3EAF8",
                  border: "none",
                  borderRadius: 16,
                  fontSize: 17,
                  fontWeight: 800,
                  color: canComplete ? "white" : c.muted,
                  cursor: canComplete ? "pointer" : "not-allowed",
                  fontFamily: "inherit",
                  boxShadow: canComplete
                    ? "0 6px 24px rgba(18,58,143,0.4)"
                    : "none",
                }}
              >
                {!selectedOperatorId
                  ? "Select an active shift operator"
                  : paymentMethod === "credit" && !selectedCreditor
                    ? "Select a customer to proceed"
                    : isCompletingSale
                      ? mpesaStatus || "Processing payment…"
                      : `Complete Sale · KSh ${total.toLocaleString()}`}
              </button>
            )
          })()}
        </div>
      </div>
    )
  }

  if (view === "cart") {
    return (
      <div className="screen" style={{ background: c.bg }}>
        <div
          style={{
            background: "linear-gradient(135deg, #0D1B3D, #123A8F)",
            padding: "52px 20px 24px",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <button
              className="btn"
              onClick={() => setView("pos")}
              style={{
                background: "rgba(255,255,255,0.12)",
                border: "none",
                borderRadius: 10,
                width: 36,
                height: 36,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
              }}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="2.5"
                strokeLinecap="round"
              >
                <path d="M19 12H5M12 5l-7 7 7 7" />
              </svg>
            </button>
            <div style={{ flex: 1, color: "white", fontSize: 18, fontWeight: 700 }}>
              Cart ({cartCount} items)
            </div>
            <button
              className="btn"
              onClick={clearCart}
              disabled={cart.length === 0}
              style={{
                minHeight: 36,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                padding: "0 11px",
                border: "1px solid rgba(255,138,128,0.32)",
                borderRadius: 10,
                background: cart.length === 0
                  ? "rgba(255,255,255,0.08)"
                  : "rgba(211,47,47,0.2)",
                color: cart.length === 0 ? "rgba(255,255,255,0.45)" : "#FFD0CC",
                fontSize: 12,
                fontWeight: 700,
                cursor: cart.length === 0 ? "not-allowed" : "pointer",
                fontFamily: "inherit",
                flexShrink: 0,
              }}
            >
              <svg
                aria-hidden="true"
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.9"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 6h18M8 6V4h8v2m3 0-.9 14H5.9L5 6m4 4v6m6-6v6" />
              </svg>
              Clear
            </button>
          </div>
        </div>
        <div className="scroll-area" style={{ padding: "16px", flex: 1 }}>
          {selectedCreditor && paymentMethod === "credit" && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 12px", marginBottom: 14, borderRadius: 10, background: "rgba(211,47,47,0.09)", color: "#B71C1C" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase" }}>Charged to customer</div>
                <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 14, fontWeight: 800 }}>{selectedCreditor.name}</div>
              </div>
              <button className="btn" onClick={() => setView("payment")} style={{ border: "none", borderRadius: 8, padding: "7px 10px", background: "white", color: "#B71C1C", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Change</button>
            </div>
          )}
          {selectedCreditor && paymentMethod === "credit" && (
            <button className="btn" onClick={() => setView("pos")} style={{ width: "100%", marginBottom: 12, padding: "10px 12px", border: "1px solid #123A8F", borderRadius: 10, background: "rgba(18,58,143,0.06)", color: "#123A8F", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
              + Add products
            </button>
          )}
          {cart.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "60px 20px",
                color: c.faint,
              }}
            >
              <div style={{ fontSize: 48, marginBottom: 12 }}>🛒</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: c.muted }}>
                Cart is empty
              </div>
            </div>
          ) : (
            cart.map((item) => (
              <div
                key={item.id}
                className="card"
                style={{
                  padding: "14px 16px",
                  marginBottom: 10,
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    background: c.iconBg,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 22,
                    flexShrink: 0,
                  }}
                >
                  {item.emoji}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: c.text }}>
                    {item.name}
                  </div>
                  <div style={{ fontSize: 12, color: c.muted }}>
                    KSh {item.price} each
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button
                    className="btn"
                    onClick={() => updateQty(item.id, -1)}
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 8,
                      background: "#F0F3F9",
                      border: "none",
                      cursor: "pointer",
                      fontSize: 16,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    −
                  </button>
                  <div
                    style={{
                      width: 24,
                      textAlign: "center",
                      fontSize: 15,
                      fontWeight: 700,
                      color: c.text,
                    }}
                  >
                    {item.qty}
                  </div>
                  <button
                    className="btn"
                    onClick={() => updateQty(item.id, 1)}
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 8,
                      background: "#123A8F",
                      border: "none",
                      cursor: "pointer",
                      fontSize: 16,
                      color: "white",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    +
                  </button>
                </div>
                <div
                  style={{
                    width: 70,
                    textAlign: "right",
                    fontSize: 13,
                    fontWeight: 700,
                    color: c.text,
                  }}
                >
                  KSh {(item.price * item.qty).toLocaleString()}
                </div>
              </div>
            ))
          )}
        </div>
        {/* Summary footer */}
        <div
          style={{
            background: c.card,
            borderTop: c.divider,
            padding: "16px",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: 6,
            }}
          >
            <div style={{ fontSize: 14, color: c.muted }}>
              Subtotal ({cartCount} items)
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: c.text }}>
              KSh {subtotal.toLocaleString()}
            </div>
          </div>
          <button
            className="btn"
            onClick={() => setView("payment")}
            disabled={cart.length === 0}
            style={{
              width: "100%",
              padding: "16px",
              background:
                cart.length === 0
                  ? "#E8ECF4"
                  : "linear-gradient(135deg, #123A8F, #1A4FBF)",
              border: "none",
              borderRadius: 14,
              fontSize: 16,
              fontWeight: 700,
              color: cart.length === 0 ? c.faint : "white",
              cursor: "pointer",
              fontFamily: "inherit",
              boxShadow:
                cart.length > 0 ? "0 4px 16px rgba(18,58,143,0.3)" : "none",
            }}
          >
            Proceed to Payment →
          </button>
        </div>
      </div>
    )
  }

  // Main POS view
  return (
    <div className="screen" style={{ background: c.bg }}>
      {dataError && (
        <div
          style={{
            margin: "12px 16px 0",
            padding: "10px 12px",
            borderRadius: 10,
            background: "#FFEBEE",
            color: "#C62828",
            fontSize: 12,
          }}
        >
          {dataError}
        </div>
      )}
      {/* Search header */}
      <div
        style={{
          background: "linear-gradient(135deg, #0D1B3D, #123A8F)",
          padding: "52px 16px 16px",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
          <div style={{ flex: 1, position: "relative" }}>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="rgba(255,255,255,0.5)"
              strokeWidth="2"
              style={{
                position: "absolute",
                left: 12,
                top: "50%",
                transform: "translateY(-50%)",
              }}
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search products by name, category, or barcode"
              placeholder="Search products..."
              style={{
                width: "100%",
                padding: "11px 40px 11px 36px",
                background: "rgba(255,255,255,0.12)",
                border: "1.5px solid rgba(255,255,255,0.2)",
                borderRadius: 12,
                color: "white",
                fontSize: 14,
                fontFamily: "inherit",
                outline: "none",
              }}
            />
            {search && (
              <button
                className="btn"
                type="button"
                onClick={() => setSearch("")}
                aria-label="Clear product search"
                title="Clear search"
                style={{
                  position: "absolute",
                  right: 8,
                  top: "50%",
                  transform: "translateY(-50%)",
                  width: 28,
                  height: 28,
                  padding: 0,
                  display: "grid",
                  placeItems: "center",
                  background: "transparent",
                  border: "none",
                  color: "rgba(255,255,255,0.72)",
                  cursor: "pointer",
                }}
              >
                <svg
                  aria-hidden="true"
                  width="17"
                  height="17"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                >
                  <path d="m6 6 12 12M18 6 6 18" />
                </svg>
              </button>
            )}
          </div>
          <button
            className="btn"
            type="button"
            onClick={() => onNavigate("scan")}
            aria-label="Open SmartScan"
            title="Open SmartScan"
            style={{
              width: 44,
              height: 44,
              background: "rgba(255,255,255,0.12)",
              border: "1.5px solid rgba(255,255,255,0.2)",
              borderRadius: 12,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              cursor: "pointer",
              fontSize: 19,
            }}
          >
            <svg
              width="21"
              height="21"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M4 7V5a1 1 0 0 1 1-1h2M17 4h2a1 1 0 0 1 1 1v2M20 17v2a1 1 0 0 1-1 1h-2M7 20H5a1 1 0 0 1-1-1v-2" />
              <path d="M8 9h8M8 12h8M8 15h5" />
            </svg>
          </button>
          <button
            className="btn"
            type="button"
            onClick={() => setView("history")}
            aria-label="Receipt history"
            title="Receipt history"
            style={{
              width: 44,
              height: 44,
              background: "rgba(255,255,255,0.12)",
              border: "1.5px solid rgba(255,255,255,0.2)",
              borderRadius: 12,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              cursor: "pointer",
              color: "white",
            }}
          >
            <svg
              aria-hidden="true"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.9"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M6 2h12v20l-3-2-3 2-3-2-3 2Z" />
              <path d="M9 8h6M9 12h6" />
            </svg>
          </button>
          <button
            className="btn"
            onClick={() => setView("cart")}
            style={{
              width: 44,
              height: 44,
              background: "#D4AF37",
              border: "none",
              borderRadius: 12,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              cursor: "pointer",
              position: "relative",
            }}
          >
            <svg
              width="21"
              height="21"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#0D1B3D"
              strokeWidth="2.3"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M3 3h2l2.4 11.2a2 2 0 0 0 2 1.6h7.9a2 2 0 0 0 1.9-1.4L21 7H6" />
              <circle cx="10" cy="20" r="1" />
              <circle cx="18" cy="20" r="1" />
            </svg>
            {cartCount > 0 && (
              <div
                style={{
                  position: "absolute",
                  top: -4,
                  right: -4,
                  width: 18,
                  height: 18,
                  background: "#D32F2F",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 10,
                  fontWeight: 700,
                  color: "white",
                }}
              >
                {cartCount}
              </div>
            )}
          </button>
        </div>

        {paymentMethod === "credit" && selectedCreditor && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", marginBottom: 10, borderRadius: 10, background: "rgba(211,47,47,0.1)", color: "#B71C1C", fontSize: 12, fontWeight: 700 }}>
            <span>Credit sale for {selectedCreditor.name}</span>
            <button className="btn" onClick={() => { setSelectedCreditor(null); setPaymentMethod("cash") }} style={{ marginLeft: "auto", border: "none", background: "transparent", color: "#B71C1C", font: "inherit", cursor: "pointer" }}>
              Change
            </button>
          </div>
        )}

        {/* Categories */}
        <div
          style={{
            display: "flex",
            gap: 8,
            overflowX: "auto",
            paddingBottom: 4,
          }}
        >
          {categories.map((cat) => (
            <button
              key={cat.name}
              className="btn"
              onClick={() => setCategory(cat.name)}
              style={{
                padding: "6px 14px",
                borderRadius: 100,
                flexShrink: 0,
                border: "none",
                background:
                  category === cat.name ? "#D4AF37" : "rgba(255,255,255,0.12)",
                color: category === cat.name ? c.text : "rgba(255,255,255,0.8)",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              {cat.emoji ? `${cat.emoji} ${cat.name}` : cat.name}
            </button>
          ))}
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 8,
            marginTop: 12,
          }}
        >
          {[
            { label: "Items", value: String(cartCount), color: "white" },
            {
              label: "Subtotal",
              value: `KSh ${subtotal.toLocaleString()}`,
              color: "#E0C35B",
            },
            {
              label: "Total",
              value: `KSh ${total.toLocaleString()}`,
              color: "#B8F0C3",
            },
          ].map((metric) => (
            <div
              key={metric.label}
              style={{
                minWidth: 0,
                padding: "9px 8px",
                borderRadius: 12,
                background: "rgba(255,255,255,0.12)",
                border: "1px solid rgba(255,255,255,0.12)",
              }}
            >
              <div
                style={{
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  color: metric.color,
                  fontSize: 12,
                  fontWeight: 800,
                }}
              >
                {metric.value}
              </div>
              <div
                style={{
                  marginTop: 3,
                  color: "rgba(255,255,255,0.68)",
                  fontSize: 10,
                }}
              >
                {metric.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Product grid / details view. Both use the same loaded catalogue and cart. */}
      <div
        className="scroll-area"
        style={{ padding: "12px", paddingBottom: 80 }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            marginBottom: 10,
          }}
        >
          <div
            style={{
              display: "flex",
              padding: 3,
              gap: 2,
              background: c.isDark ? "#162B5A" : "#F0F3F9",
              borderRadius: 10,
            }}
          >
            <button
              className="btn"
              type="button"
              aria-label="Grid product view"
              title="Grid view"
              onClick={() => setProductView("grid")}
              style={{
                width: 32,
                height: 30,
                borderRadius: 8,
                background: productView === "grid" ? "#123A8F" : "transparent",
                color: productView === "grid" ? "white" : c.muted,
              }}
            >
              ▦
            </button>
            <button
              className="btn"
              type="button"
              aria-label="Product details view"
              title="Details view"
              onClick={() => setProductView("details")}
              style={{
                width: 32,
                height: 30,
                borderRadius: 8,
                background:
                  productView === "details" ? "#123A8F" : "transparent",
                color: productView === "details" ? "white" : c.muted,
              }}
            >
              ☷
            </button>
          </div>
        </div>
        {filtered.length === 0 ? (
          <div
            className="card"
            style={{
              padding: "32px 18px",
              textAlign: "center",
              color: c.muted,
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 700, color: c.text }}>
              No products found
            </div>
            <div style={{ marginTop: 5, fontSize: 12 }}>
              {normalizedSearch
                ? `No products match "${search.trim()}".`
                : "No in-stock products are available in this category."}
            </div>
          </div>
        ) : productView === "grid" ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              gap: 10,
            }}
          >
            {filtered.map((p) => {
              const inCart = cart.find((x) => x.id === p.id)
              const cartQuantity = inCart?.qty ?? 0
              const remainingStock = p.stock - cartQuantity
              const overStock = remainingStock < 0
              const lowStock = remainingStock <= 5
              const stockLabel = cartQuantity > 0
                ? overStock
                  ? `${remainingStock} left · stock may be stale`
                  : remainingStock === 0
                    ? "0 left · at stock limit"
                    : `${p.stock} − ${cartQuantity} = ${remainingStock} left`
                : lowStock
                  ? `Low: ${p.stock}`
                  : `${p.stock} in stock`
              return (
                <button
                  key={p.id}
                  className="btn card"
                  onClick={() => addToCart(p)}
                  style={{
                    minHeight: 140,
                    padding: "10px",
                    cursor: "pointer",
                    border: "none",
                    position: "relative",
                    fontFamily: "inherit",
                    textAlign: "left",
                    outline: overStock
                      ? "2px solid #D32F2F"
                      : remainingStock === 0
                        ? "2px solid #F9A825"
                        : inCart
                          ? "2px solid #123A8F"
                          : "none",
                    outlineOffset: inCart ? "-2px" : "0",
                  }}
                >
                  {lowStock && (
                    <div
                      style={{
                        position: "absolute",
                        top: 6,
                        right: 6,
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: overStock ? "#D32F2F" : "#F9A825",
                      }}
                    />
                  )}
                  {inCart && (
                    <div style={{ position: "absolute", top: 6, left: 6 }}>
                      <span
                        className={`badge ${overStock ? "badge-error" : remainingStock === 0 ? "badge-warning" : "badge-blue"}`}
                        style={{ fontSize: 9 }}
                      >
                        ×{inCart.qty}
                      </span>
                    </div>
                  )}
                  <div
                    style={{
                      fontSize: 28,
                      marginBottom: 6,
                      textAlign: "center",
                    }}
                  >
                    {p.emoji}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: c.text,
                      lineHeight: 1.3,
                      marginBottom: 3,
                    }}
                  >
                    {p.name}
                  </div>
                  <div
                    style={{ fontSize: 13, fontWeight: 800, color: "#123A8F" }}
                  >
                    KSh {p.price}
                  </div>
                  <div
                    style={{
                      fontSize: 10,
                      color: overStock ? "#D32F2F" : lowStock ? "#F9A825" : c.muted,
                      marginTop: 2,
                      fontWeight: overStock || lowStock ? 700 : 400,
                    }}
                  >
                    {stockLabel}
                  </div>
                </button>
              )
            })}
          </div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {filtered.map((p) => {
              const inCart = cart.find((x) => x.id === p.id)
              const cartQuantity = inCart?.qty ?? 0
              const remainingStock = p.stock - cartQuantity
              const overStock = remainingStock < 0
              const lowStock = remainingStock <= 5
              const stockLabel = cartQuantity > 0
                ? overStock
                  ? `${remainingStock} left · stock may be stale`
                  : remainingStock === 0
                    ? "0 left · at stock limit"
                    : `${p.stock} − ${cartQuantity} = ${remainingStock} left`
                : lowStock
                  ? `Low: ${p.stock}`
                  : `${p.stock} in stock`
              return (
                <div
                  key={p.id}
                  className="card"
                  style={{
                    padding: 12,
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    border: overStock
                      ? "2px solid #D32F2F"
                      : remainingStock === 0
                        ? "2px solid #F9A825"
                        : inCart
                          ? "2px solid #123A8F"
                          : c.divider,
                  }}
                >
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 12,
                      background: c.iconBg,
                      display: "grid",
                      placeItems: "center",
                      fontSize: 22,
                      flexShrink: 0,
                    }}
                  >
                    {p.emoji}
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div
                      style={{
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        color: c.text,
                        fontSize: 13,
                        fontWeight: 800,
                      }}
                    >
                      {p.name}
                    </div>
                    <div style={{ marginTop: 3, color: c.muted, fontSize: 11 }}>
                      {p.category} ·{" "}
                      <span
                        style={{
                          color: overStock
                            ? "#D32F2F"
                            : lowStock
                              ? "#F9A825"
                              : c.muted,
                          fontWeight: overStock || lowStock ? 700 : 400,
                        }}
                      >
                        {stockLabel}
                      </span>
                    </div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div
                      style={{
                        color: "#123A8F",
                        fontSize: 13,
                        fontWeight: 800,
                      }}
                    >
                      KSh {p.price}
                    </div>
                    {inCart && (
                      <div
                        style={{
                          marginTop: 3,
                          color: "#123A8F",
                          fontSize: 10,
                          fontWeight: 700,
                        }}
                      >
                        ×{inCart.qty} in cart
                      </div>
                    )}
                  </div>
                  <button
                    className="btn"
                    type="button"
                    onClick={() => addToCart(p)}
                    style={{
                      flexShrink: 0,
                      padding: "8px 10px",
                      borderRadius: 10,
                      background: "#123A8F",
                      color: "white",
                      fontSize: 11,
                      fontWeight: 800,
                    }}
                  >
                    Add
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Bottom cart summary */}
      {cart.length > 0 && (
        <button
          className="btn"
          onPointerDown={(event) => {
            cartBannerDrag.current = { x: event.clientX, y: event.clientY }
            cartBannerWasDragged.current = false
            event.currentTarget.setPointerCapture(event.pointerId)
          }}
          onPointerMove={(event) => {
            const start = cartBannerDrag.current
            if (!start) return
            const deltaX = event.clientX - start.x
            const deltaY = event.clientY - start.y
            if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3)
              cartBannerWasDragged.current = true
            setCartBannerPosition((position) => ({
              x: Math.max(0, Math.min(24, position.x + deltaX)),
              y: Math.max(0, Math.min(680, position.y - deltaY)),
            }))
            cartBannerDrag.current = { x: event.clientX, y: event.clientY }
          }}
          onPointerUp={() => {
            cartBannerDrag.current = null
          }}
          onPointerCancel={() => {
            cartBannerDrag.current = null
          }}
          onClick={() => {
            if (cartBannerWasDragged.current) {
              cartBannerWasDragged.current = false
              return
            }
            setView("cart")
          }}
          style={{
            position: "absolute",
            bottom: cartBannerPosition.y,
            left: 12 + cartBannerPosition.x,
            width: "calc(100% - 48px)",
            padding: "14px 20px",
            background: "rgba(18,58,143,0.62)",
            backdropFilter: "blur(7px)",
            WebkitBackdropFilter: "blur(7px)",
            border: "1px solid rgba(255,255,255,0.22)",
            borderRadius: 16,
            cursor: "grab",
            touchAction: "none",
            userSelect: "none",
            fontFamily: "inherit",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            boxShadow: "0 4px 20px rgba(18,58,143,0.4)",
            zIndex: 50,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div
              style={{
                width: 24,
                height: 24,
                borderRadius: 6,
                background: "rgba(255,255,255,0.2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 12,
                fontWeight: 700,
                color: "white",
              }}
            >
              {cartCount}
            </div>
            <div
              style={{
                color: "rgba(255,255,255,0.9)",
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              View Cart
            </div>
          </div>
          <div style={{ color: "#D4AF37", fontSize: 16, fontWeight: 800 }}>
            KSh {subtotal.toLocaleString()}
          </div>
        </button>
      )}
    </div>
  )
}
