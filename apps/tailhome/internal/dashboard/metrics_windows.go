//go:build windows

package dashboard

func diskUsage(path string) (total, available uint64) {
	return 0, 0
}
