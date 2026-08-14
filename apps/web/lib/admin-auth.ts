import { createHmac, timingSafeEqual } from "crypto"
import { cookies } from "next/headers"

const COOKIE_NAME = "tailhome_admin"
const MAX_AGE_SECONDS = 60 * 60 * 24 * 14

function sessionSecret(): string {
  const secret = process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PASSWORD
  if (!secret) {
    throw new Error("ADMIN_SESSION_SECRET is not configured")
  }
  return secret
}

function sign(value: string): string {
  return createHmac("sha256", sessionSecret()).update(value).digest("hex")
}

export function verifyAdminPassword(password: string): boolean {
  const expected = process.env.ADMIN_PASSWORD
  if (!expected) {
    return false
  }
  const left = Buffer.from(password)
  const right = Buffer.from(expected)
  if (left.length !== right.length) {
    return false
  }
  return timingSafeEqual(left, right)
}

export function createAdminSessionToken(): string {
  const issuedAt = String(Date.now())
  return `${issuedAt}.${sign(issuedAt)}`
}

export function isAdminSessionToken(token: string | undefined): boolean {
  if (!token) {
    return false
  }
  const [issuedAt, signature] = token.split(".")
  if (!issuedAt || !signature) {
    return false
  }
  const expected = sign(issuedAt)
  const left = Buffer.from(signature)
  const right = Buffer.from(expected)
  if (left.length !== right.length || !timingSafeEqual(left, right)) {
    return false
  }
  const ageMs = Date.now() - Number(issuedAt)
  return Number.isFinite(ageMs) && ageMs >= 0 && ageMs <= MAX_AGE_SECONDS * 1000
}

export async function isAdminAuthenticated(): Promise<boolean> {
  const token = cookies().get(COOKIE_NAME)?.value
  return isAdminSessionToken(token)
}

export function adminCookieOptions(token: string) {
  return {
    name: COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS
  }
}

export function clearAdminCookieOptions() {
  return {
    name: COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0
  }
}
