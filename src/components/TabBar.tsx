import type { ReactNode } from 'react';
import { motion } from 'framer-motion';

export type TabId = 'today' | 'calendar' | 'insights' | 'settings';

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'today', label: 'Hoy', icon: '📝' },
  { id: 'calendar', label: 'Calendario', icon: '📅' },
  { id: 'insights', label: 'Insights', icon: '📊' },
  { id: 'settings', label: 'Ajustes', icon: '⚙️' },
];

type TabBarProps = {
  active: TabId;
  onChange: (tab: TabId) => void;
};

/**
 * Barra flotante con un pill animado detrás del tab activo (layoutId de
 * Framer Motion: al cambiar de tab, el mismo elemento "viaja" en vez de
 * aparecer/desaparecer). Reemplaza la barra plana pegada al borde.
 */
export function TabBar({ active, onChange }: TabBarProps) {
  return (
    <nav
      className="fixed left-1/2 -translate-x-1/2 z-30 flex gap-1 p-2 rounded-full"
      style={{
        bottom: 'calc(env(safe-area-inset-bottom) + 0.875rem)',
        backgroundColor: 'color-mix(in srgb, var(--surface-1) 88%, transparent)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        boxShadow: 'var(--shadow-lg)',
        border: '1px solid var(--border)',
      }}
    >
      {TABS.map((tab) => {
        const isActive = active === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            aria-current={isActive}
            aria-label={tab.label}
            className="relative flex flex-col items-center justify-center gap-0.5 px-5 py-2 min-w-[70px] min-h-[52px] rounded-full transition-colors"
            style={{ color: isActive ? 'var(--brand-accent)' : 'var(--text-muted)' }}
          >
            {isActive && (
              <motion.div
                layoutId="tab-pill"
                className="absolute inset-0 rounded-full"
                style={{
                  backgroundColor: 'color-mix(in srgb, var(--brand-accent) 16%, var(--surface-2))',
                  boxShadow: 'var(--shadow-sm)',
                }}
                transition={{ type: 'spring', stiffness: 500, damping: 35 }}
              />
            )}
            <motion.span
              aria-hidden="true"
              className="relative text-xl"
              animate={isActive ? { scale: 1.15, y: -1 } : { scale: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 20 }}
            >
              {tab.icon}
            </motion.span>
            <span className="relative text-xs font-semibold">{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

export function Screen({ children }: { children: ReactNode }) {
  return (
    <main className="pb-32 pt-[calc(env(safe-area-inset-top)+0.75rem)] min-h-screen px-4 max-w-lg mx-auto">
      {children}
    </main>
  );
}
