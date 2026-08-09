//go:build !windows

package main

import "os"

func shouldUseSudo() bool {
	if os.Getenv("TAILHOME_USE_SUDO") == "0" {
		return false
	}
	return os.Geteuid() != 0
}
