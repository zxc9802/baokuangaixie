'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  House,
  MagnifyingGlass,
  Article,
  Package,
  FileText,
} from '@phosphor-icons/react';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/', label: '概览', icon: House },
  { href: '/capture', label: '抓取', icon: MagnifyingGlass },
  { href: '/topics', label: '选题库', icon: Article },
  { href: '/products', label: '产品库', icon: Package },
  { href: '/scripts', label: '脚本库', icon: FileText },
];

export function Nav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1 p-3">
      {navItems.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
              active
                ? 'bg-muted text-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            {active && (
              <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-accent" />
            )}
            <item.icon
              className={cn(
                'h-5 w-5 transition-colors',
                active ? 'text-accent' : 'text-muted-foreground group-hover:text-foreground'
              )}
              weight={active ? 'bold' : 'regular'}
            />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
