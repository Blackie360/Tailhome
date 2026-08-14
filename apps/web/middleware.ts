import type { NextFetchEvent, NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { downloadAssetFromPath, recordDownload } from "@/lib/downloads"

export function middleware(request: NextRequest, event: NextFetchEvent) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return NextResponse.next()
  }

  const asset = downloadAssetFromPath(request.nextUrl.pathname)
  if (asset && request.method === "GET") {
    event.waitUntil(recordDownload(asset).catch(() => undefined))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/install.sh", "/install.ps1", "/downloads/:path*"]
}
