const INSTALLER_URL =
  "https://raw.githubusercontent.com/Blackie360/Tailhome/main/install.sh";

export const dynamic = "force-dynamic";

export async function GET() {
  const response = await fetch(INSTALLER_URL, {
    cache: "no-store",
    headers: {
      "User-Agent": "TailHome installer route"
    }
  });

  if (!response.ok) {
    return new Response("TailHome installer is temporarily unavailable.\n", {
      status: 502,
      headers: {
        "Content-Type": "text/plain; charset=utf-8"
      }
    });
  }

  const installer = await response.text();

  return new Response(installer, {
    headers: {
      "Cache-Control": "public, max-age=300, s-maxage=300",
      "Content-Disposition": 'inline; filename="install.sh"',
      "Content-Type": "text/x-shellscript; charset=utf-8"
    }
  });
}
