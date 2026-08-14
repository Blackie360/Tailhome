import { Moon, Sun } from 'lucide-react'
import { Switch } from '@/components/ui/switch'

type ThemeToggleProps = {
  isDark: boolean
  onCheckedChange: (checked: boolean) => void
}

export function ThemeToggle ({ isDark, onCheckedChange }: ThemeToggleProps) {
  return (
    <div className="flex items-center gap-2 [&_svg]:size-4">
      <Sun aria-hidden="true" />
      <Switch
        checked={isDark}
        onCheckedChange={onCheckedChange}
        aria-label="Use dark theme"
      />
      <Moon aria-hidden="true" />
    </div>
  )
}
