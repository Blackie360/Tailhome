declare module "@/lib/download-asset.mjs" {
  export function downloadAssetFromPath(pathname: string): string | null
}

declare module "./download-asset.mjs" {
  export function downloadAssetFromPath(pathname: string): string | null
}
