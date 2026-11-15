import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { AuthGate, AuthProvider, BackendBadge, UserMenu } from '@/components/Auth';
import { MainNav } from '@/components/MainNav';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Modular Studio', template: '%s · Modular Studio' },
  description: 'Diseño paramétrico, despiece, presupuesto y fabricación de muebles modulares (mm · MXN).',
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#10151c' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es-MX">
      <body className="min-h-screen font-sans">
        <AuthProvider>
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-accent focus:px-3 focus:py-1 focus:text-accent-ink">Saltar al contenido</a>
        <header className="no-print sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-line bg-[#18212b]/95 px-4 py-2.5 backdrop-blur sm:px-8 sm:py-3">
          <div className="flex items-center gap-6">
            <Link href="/" className="text-[17px] font-extrabold tracking-tight whitespace-nowrap sm:text-[19px]">MODULAR <span className="text-[#60c6db]">STUDIO</span></Link>
            <MainNav variant="top" />
          </div>
          <div className="flex items-center gap-2 text-[11.5px]">
            <BackendBadge />
            <UserMenu />
          </div>
        </header>
        <main id="main" className="px-3 pb-24 pt-4 sm:px-6 sm:pb-6"><AuthGate>{children}</AuthGate></main>
        <MainNav variant="bottom" />
        <footer className="no-print px-6 pb-6 pt-2 text-center text-[11.5px] text-muted">
          Medidas en mm · Revisar en taller antes de fabricar · Sin afiliación con proveedores
        </footer>
        </AuthProvider>
      </body>
    </html>
  );
}
