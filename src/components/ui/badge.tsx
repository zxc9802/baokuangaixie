import * as React from 'react';
import { cn } from '@/lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'secondary' | 'outline' | 'success' | 'danger' | 'warning';
}

function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        {
          'bg-accent text-accent-foreground': variant === 'default',
          'bg-muted text-muted-foreground': variant === 'secondary',
          'border border-border text-foreground': variant === 'outline',
          'bg-success/10 text-success': variant === 'success',
          'bg-danger/10 text-danger': variant === 'danger',
          'bg-warning/10 text-warning': variant === 'warning',
        },
        className
      )}
      {...props}
    />
  );
}

export { Badge };
