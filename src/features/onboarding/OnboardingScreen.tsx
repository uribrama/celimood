import { motion } from 'framer-motion';

const STEPS = [
  {
    icon: '📝',
    title: 'Un tap y listo',
    text: 'Tocá una cara para registrar cómo estuvo tu día. Tags, energía y notas son opcionales — nada te obliga a completar más de lo que quieras.',
  },
  {
    icon: '📅',
    title: 'El patrón aparece solo',
    text: 'El calendario y los insights muestran tendencias con el tiempo — humor por tag, por fase del ciclo, por día de la semana.',
  },
  {
    icon: '🔒',
    title: '100% en tu teléfono',
    text: 'Sin cuenta, sin servidor. Tu humor y tu ciclo nunca salen del dispositivo.',
  },
];

export function OnboardingScreen({ onDone }: { onDone: () => void }) {
  return (
    <main
      className="min-h-screen flex flex-col px-6 pb-8"
      style={{ paddingTop: 'calc(env(safe-area-inset-top) + 2.5rem)' }}
    >
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-8"
      >
        <span className="text-5xl" aria-hidden="true">🙂</span>
        <h1 className="text-2xl font-semibold mt-3">¡Hola! Esto es Celimood</h1>
        <p className="text-sm mt-1.5" style={{ color: 'var(--text-secondary)' }}>
          Antes de arrancar, tres cosas rápidas.
        </p>
      </motion.div>

      <div className="flex-1 space-y-3">
        {STEPS.map((step, i) => (
          <motion.div
            key={step.title}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.1, type: 'spring', stiffness: 300, damping: 25 }}
            className="card rounded-2xl p-4 flex items-start gap-3"
          >
            <span className="text-2xl shrink-0" aria-hidden="true">{step.icon}</span>
            <div>
              <h2 className="text-sm font-semibold">{step.title}</h2>
              <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                {step.text}
              </p>
            </div>
          </motion.div>
        ))}
      </div>

      <motion.button
        type="button"
        onClick={onDone}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        whileTap={{ scale: 0.97 }}
        className="w-full py-3.5 rounded-xl text-sm font-semibold mt-6"
        style={{ backgroundColor: 'var(--brand-accent)', color: 'white', boxShadow: 'var(--shadow-md)' }}
      >
        Empezar
      </motion.button>
    </main>
  );
}
