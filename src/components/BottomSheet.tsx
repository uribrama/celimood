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
            className="fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl p-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] max-w-lg mx-auto"
            style={{ backgroundColor: 'var(--surface-1)' }}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            <div className="w-10 h-1.5 rounded-full mx-auto mb-4" style={{ backgroundColor: 'var(--hairline)' }} />
            {title && <h2 className="text-lg font-semibold mb-3">{title}</h2>}
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
