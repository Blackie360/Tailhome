#!/usr/bin/env bash
set -Eeuo pipefail

if ! command -v ss >/dev/null 2>&1; then
  printf 'ss not found; skipping port check.\n'
  exit 0
fi

failed=0

tcp_ports=(53 3000 3001 3002 8080 8088 8443 9090 9443)
udp_ports=(53)

if ! tcp_sockets="$(ss -H -ltn 2>/dev/null)"; then
  printf 'Unable to read TCP listening sockets; skipping port check.\n' >&2
  exit 0
fi

if ! udp_sockets="$(ss -H -lun 2>/dev/null)"; then
  printf 'Unable to read UDP listening sockets; skipping port check.\n' >&2
  exit 0
fi

port_in_use() {
  local protocol="$1"
  local port="$2"

  case "${protocol}" in
    tcp)
      printf '%s\n' "${tcp_sockets}" | awk '{print $4}' | grep -Eq "[:.]${port}$"
      ;;
    udp)
      printf '%s\n' "${udp_sockets}" | awk '{print $4}' | grep -Eq "[:.]${port}$"
      ;;
    *)
      return 1
      ;;
  esac
}

for port in "${tcp_ports[@]}"; do
  if port_in_use tcp "${port}"; then
    printf '[busy] tcp/%s\n' "${port}" >&2
    failed=1
  else
    printf '[free] tcp/%s\n' "${port}"
  fi
done

for port in "${udp_ports[@]}"; do
  if port_in_use udp "${port}"; then
    printf '[busy] udp/%s\n' "${port}" >&2
    failed=1
  else
    printf '[free] udp/%s\n' "${port}"
  fi
done

if [[ "${failed}" -ne 0 ]]; then
  cat >&2 <<'MSG'

One or more required ports are already in use.
Stop the conflicting service, change the TailHome ports in docker-compose.yml,
or rerun with TAILHOME_SKIP_PORT_CHECK=1 if you know the conflict is harmless.
MSG
fi

exit "${failed}"
