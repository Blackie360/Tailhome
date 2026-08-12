#!/usr/bin/env bash
set -Eeuo pipefail

if ! command -v ss >/dev/null 2>&1; then
  printf 'ss not found; skipping port check.\n'
  exit 0
fi

failed=0

profile_enabled() {
  local profile="$1"
  [[ ",${TAILHOME_PROFILES:-}," == *",${profile},"* ]]
}

tcp_ports=(3000 8088 8443)
udp_ports=()
if profile_enabled monitoring; then
  tcp_ports+=(3001 9090 9100)
fi
if profile_enabled uptime; then
  tcp_ports+=(3002)
fi
if profile_enabled management; then
  tcp_ports+=(9443)
fi
if profile_enabled dns; then
  tcp_ports+=(53 8080)
  udp_ports+=(53)
fi

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
  local sockets

  case "${protocol}" in
    tcp)
      sockets="${tcp_sockets}"
      ;;
    udp)
      sockets="${udp_sockets}"
      ;;
    *)
      return 1
      ;;
  esac

  port_addresses "${sockets}" "${port}" | awk 'NF { found = 1 } END { exit found ? 0 : 1 }'
}

port_addresses() {
  local sockets="$1"
  local port="$2"

  printf '%s\n' "${sockets}" | awk -v port="${port}" '
    {
      address = $4
      if (address !~ "[:.]" port "$") {
        next
      }
      sub("[:.]" port "$", "", address)
      gsub(/^\[/, "", address)
      gsub(/\]$/, "", address)
      print address
    }
  '
}

address_is_loopback() {
  local address="$1"

  case "${address}" in
    127.*|::1|localhost)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

check_dns_port() {
  local protocol="$1"
  local sockets addresses address host_wide=0

  if [[ "${protocol}" == "tcp" ]]; then
    sockets="${tcp_sockets}"
  else
    sockets="${udp_sockets}"
  fi

  addresses="$(port_addresses "${sockets}" 53)"
  if [[ -z "${addresses}" ]]; then
    printf '[free] %s/53\n' "${protocol}"
    return
  fi

  while IFS= read -r address; do
    [[ -n "${address}" ]] || continue
    if ! address_is_loopback "${address}"; then
      host_wide=1
    fi
  done <<< "${addresses}"

  if [[ "${host_wide}" -eq 1 ]]; then
    printf '[warn] %s/53 has a host-wide listener; Pi-hole may be disabled during stack start.\n' "${protocol}" >&2
  else
    printf '[warn] %s/53 has only loopback listeners; continuing because this is usually systemd-resolved.\n' "${protocol}" >&2
  fi
}

for port in "${tcp_ports[@]}"; do
  if [[ "${port}" -eq 53 ]]; then
    check_dns_port tcp
    continue
  fi
  if port_in_use tcp "${port}"; then
    printf '[busy] tcp/%s\n' "${port}" >&2
    failed=1
  else
    printf '[free] tcp/%s\n' "${port}"
  fi
done

for port in "${udp_ports[@]}"; do
  if [[ "${port}" -eq 53 ]]; then
    check_dns_port udp
    continue
  fi
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
