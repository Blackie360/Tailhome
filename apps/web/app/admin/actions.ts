"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import {
  adminCookieOptions,
  clearAdminCookieOptions,
  createAdminSessionToken,
  isAdminAuthenticated,
  verifyAdminPassword
} from "@/lib/admin-auth"
import { setPublishDownloadStats } from "@/lib/downloads"

export async function loginAdmin(formData: FormData) {
  const password = String(formData.get("password") || "")
  if (!verifyAdminPassword(password)) {
    redirect("/admin?error=1")
  }
  cookies().set(adminCookieOptions(createAdminSessionToken()))
  redirect("/admin")
}

export async function logoutAdmin() {
  cookies().set(clearAdminCookieOptions())
  redirect("/admin")
}

export async function updatePublishStats(formData: FormData) {
  if (!(await isAdminAuthenticated())) {
    redirect("/admin?error=1")
  }
  const publish = formData.get("publish") === "1"
  await setPublishDownloadStats(publish)
  redirect("/admin")
}
