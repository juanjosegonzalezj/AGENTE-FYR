'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { clsx } from 'clsx';
import {
  LayoutDashboard, Calendar, Users, Trophy,
  BarChart3, Settings, LogOut, Zap,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

const navItems = [
  { href: '/dashboard',              icon: LayoutDashboard, label: 'Resumen' },
  { href: '/dashboard/reservations', icon: Calendar,        label: 'Reservas' },
  { href: '/dashboard/courts',       icon: Trophy,          label: 'Pistas' },
  { href: '/dashboard/players',      icon: Users,           label: 'Jugadores' },
  { href: '/dashboard/analytics',    icon: BarChart3,       label: 'Analíticas' },
  { href: '/dashboard/ai',           icon: Zap,             label: 'Asistente IA' },
  { href: '/dashboard/settings',     icon: Settings,        label: 'Configuración' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  return (
    <aside className="w-64 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-brand-600 rounded-xl flex items-center justify-center">
            <span className="text-xl">🎾</span>
          </div>
          <div>
            <p className="font-bold text-gray-900 text-sm">Find Your Rival</p>
            <p className="text-xs text-gray-500">Panel de Control</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                active
                  ? 'bg-brand-50 text-brand-700'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              )}
            >
              <Icon size={18} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="p-4 border-t border-gray-200">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2 w-full rounded-lg text-sm font-medium text-gray-600 hover:bg-red-50 hover:text-red-700 transition-colors"
        >
          <LogOut size={18} />
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
