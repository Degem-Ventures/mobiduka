import { NextResponse } from "next/server.js"
import { prisma } from "@/lib/prisma"

export async function POST(request: Request) {
  let body: Record<string, unknown>
  try {
    body = await request.json() as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 })
  }

  const fullName = typeof body.fullName === "string" ? body.fullName.trim() : ""
  const businessName = typeof body.businessName === "string" ? body.businessName.trim() : ""
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : ""
  const phone = typeof body.phone === "string" ? body.phone.trim() : ""
  const businessType = typeof body.businessType === "string" ? body.businessType.trim() : ""
  const message = typeof body.message === "string" ? body.message.trim() : ""

  if (
    !fullName || fullName.length > 120 ||
    !businessName || businessName.length > 160 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 ||
    !phone || phone.length > 40 ||
    businessType.length > 80 ||
    !message || message.length > 3000
  ) {
    return NextResponse.json({ error: "Please check the contact details and message, then try again." }, { status: 400 })
  }

  let contactMessage: { id: string }
  try {
    contactMessage = await prisma.websiteContactMessage.create({
      data: {
        fullName,
        businessName,
        email,
        phone,
        businessType: businessType || null,
        message,
      },
      select: { id: true },
    })
  } catch (error) {
    console.error("Website contact request could not be saved:", error)
    return NextResponse.json({ error: "Unable to save your request right now. Please try again later." }, { status: 500 })
  }

  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.CONTACT_EMAIL_FROM || process.env.BILLING_EMAIL_FROM
  const to = process.env.CONTACT_EMAIL_TO || "owner@mobiduka.com"
  if (!apiKey || !from) {
    console.error("Contact form email is not configured.")
    return NextResponse.json({ success: true, emailDelivered: false }, { status: 201 })
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        reply_to: email,
        subject: `Website contact request from ${fullName}`,
        text: [
          "A new contact request was submitted on the MobiDuka website.",
          "",
          `Name: ${fullName}`,
          `Business: ${businessName}`,
          `Email: ${email}`,
          `Phone: ${phone}`,
          `Business type: ${businessType || "Not specified"}`,
          "",
          "Message:",
          message,
        ].join("\n"),
      }),
    })

    if (!response.ok) {
      console.error(`Resend rejected a contact form email (HTTP ${response.status}).`)
      return NextResponse.json({ success: true, emailDelivered: false }, { status: 201 })
    }

    await prisma.websiteContactMessage.update({
      where: { id: contactMessage.id },
      data: { emailSentAt: new Date() },
    })
    return NextResponse.json({ success: true, emailDelivered: true }, { status: 201 })
  } catch (error) {
    console.error("Contact form email delivery failed:", error)
    return NextResponse.json({ success: true, emailDelivered: false }, { status: 201 })
  }
}
