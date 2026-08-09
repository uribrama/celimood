import type { ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

type BottomSheetProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
};

export function BottomSheet({ open, onClose, title, children }: BottomSheetProps) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-black/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            aria-hidden="true"
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            // Tope de altura + scroll interno: sin esto, un contenido largo
            // (el editor completo de un día) podía ocupar el 100% de la
            // pantalla y no dejar nada del fondo para tocar y cerrar — la
            // X de abajo es el cierre que no depende de que quede algo de
            // fondo visible ni de cuánto se haya scrolleado el contenido.
            className="fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl p-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] max-w-lg mx-auto max-h-[85vh] overflow-y-auto"
            style={{ backgroundColor: 'var(--surface-1)' }}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              className="w-10 h-1.5 rounded-full mx-auto mb-3 block"
              style={{ backgroundColor: 'var(--hairline)' }}
            />
            <div className="flex items-center justify-between mb-3 gap-3">
              <h2 className="text-lg font-semibold truncate">{title}</h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Cerrar"
                className="shrink-0 min-w-[36px] min-h-[36px] -mr-1.5 rounded-full flex items-center justify-center text-lg transition-colors hover:bg-[var(--surface-2)] active:scale-90"
                style={{ color: 'var(--text-secondary)' }}
              >
                ✕
              </button>
            </div>
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
