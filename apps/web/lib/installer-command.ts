export function validateHostname(value: string): string | null {
  if (!value) return "Enter a hostname.";
  if (value.length > 63) return "Hostname must be 63 characters or fewer.";
  if (!/^[A-Za-z0-9-]+$/.test(value)) {
    return "Use only letters, numbers, and hyphens (no spaces or punctuation).";
  }
  if (!/^[A-Za-z0-9].*[A-Za-z0-9]$/.test(value) && value.length > 1) {
    return "Hostname must start and end with a letter or number.";
  }
  return null;
}

export function validateCidr(value: string): string | null {
  if (!value) return null;
  const slash = value.lastIndexOf("/");
  if (slash <= 0 || slash === value.length - 1) return "Enter a CIDR, such as 192.168.1.0/24.";

  const address = value.slice(0, slash);
  const prefixText = value.slice(slash + 1);
  if (!/^\d+$/.test(prefixText)) return "CIDR prefix must be a number.";
  const prefix = Number(prefixText);

  if (address.includes(":")) {
    if (!isIpv6(address) || prefix > 128) return "Enter a valid IPv6 CIDR with a prefix from 0 to 128.";
    return null;
  }

  const octets = address.split(".");
  if (
    octets.length !== 4 ||
    octets.some((part) => !/^\d{1,3}$/.test(part) || Number(part) > 255) ||
    prefix > 32
  ) {
    return "Enter a valid IPv4 CIDR with a prefix from 0 to 32.";
  }
  return null;
}

function isIpv6(address: string): boolean {
  if (!/^[0-9A-Fa-f:]+$/.test(address) || address.includes(":::")) return false;
  const halves = address.split("::");
  if (halves.length > 2) return false;
  const groups = address.split(":").filter(Boolean);
  if (groups.some((group) => group.length > 4)) return false;
  return halves.length === 2 ? groups.length < 8 : groups.length === 8;
}

/** Quotes one value for a POSIX shell without allowing it to become an option or command. */
export function shellValue(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}
