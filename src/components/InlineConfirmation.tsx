import { AnimatePresence, motion } from 'framer-motion';

type InlineConfirmationProps = {
  show: boolean;
  message: string;
};

/**
 * Confirmación breve para acciones que no cambian nada visible por sí solas
 * (guardar una nota, importar un backup) — a diferencia de un chip, que ya
 * muestra su propio cambio de estado al tocarlo y no necesita esto.
 */
export function InlineConfirmation({ show, message }: InlineConfirmationProps) {
  return (
    <AnimatePresence>
      {show && (
        <motion.p
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="text-sm font-semibold mt-2"
          style={{ color: 'var(--status-good)' }}
        >
          ✓ {message}
        </motion.p>
      )}
    </AnimatePresence>
  );
}
