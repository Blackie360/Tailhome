import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

function Empty ({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'flex min-h-32 flex-col items-center justify-center gap-2 rounded-xl border border-dashed p-6 text-center',
        className
      )}
      {...props}
    />
  )
}

function EmptyTitle ({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn('text-sm font-semibold', className)} {...props} />
}

function EmptyDescription ({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('max-w-sm text-sm text-muted-foreground', className)} {...props} />
}

export { Empty, EmptyTitle, EmptyDescription }
