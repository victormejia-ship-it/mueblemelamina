'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Factory, FolderOpen, LayoutGrid, Store, type LucideIcon } from 'lucide-react';

const ITEMS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: '/', label: 'Catálogo', icon: LayoutGrid },
  { href: '/proyectos', label: 'Mis proyectos', icon: FolderOpen },
  { href: '/proveedores', label: 'Proveedores', icon: Store },
  { href: '/taller', label: 'Taller', icon: Factory },
];

/** Navegación principal: arriba en pantallas anchas, barra inferior con íconos en teléfono. */
export function MainNav({ variant }: { variant: 'top' | 'bottom' }) {
  const path = usePathname() ?? '/';
  const isActive = (href: string) => (href === '/' ? path === '/' || path.startsWith('/catalogo') : path.startsWith(href) || (href === '/proyectos' && path.startsWith('/editor')));
  if (variant === 'top') {
    return (
      <nav aria-label="Principal" className="hidden gap-1 text-[13px] sm:flex">
        {ITEMS.map((i) => (
          <Link key={i.href} href={i.href} aria-current={isActive(i.href) ? 'page' : undefined}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 ${isActive(i.href) ? 'bg-[#22313e] text-[#cfeff7]' : 'hover:bg-[#22313e]'}`}>
            <i.icon aria-hidden className="h-4 w-4" />{i.label}
          </Link>
        ))}
      </nav>
    );
  }
  return (
    <nav aria-label="Principal" className="no-print fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-line bg-[#18212b]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden">
      {ITEMS.map((i) => (
        <Link key={i.href} href={i.href} aria-current={isActive(i.href) ? 'page' : undefined}
          className={`flex flex-col items-center gap-0.5 py-2 text-[10.5px] font-semibold ${isActive(i.href) ? 'text-[#60c6db]' : 'text-muted'}`}>
          <i.icon aria-hidden className="h-5 w-5" />{i.label}
        </Link>
      ))}
    </nav>
  );
}
