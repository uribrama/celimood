import { useEffect, useRef, useState } from 'react';
import { Screen } from '../../components/TabBar';
import { db } from '../../db/schema';
import { useLiveQuery } from '../../db/useLiveQuery';
import {
  applyImport,
  eraseAllData,
  exportBackup,
  parseBackupFile,
  previewImport,
  type ImportSummary,
} from '../../db/backupRepo';
import { BottomSheet } from '../../components/BottomSheet';
import { InlineConfirmation } from '../../components/InlineConfirmation';

const THEME_OPTIONS = [
  { value: 'system', label: 'Automático' },
  { value: 'light', label: 'Claro' },
  { value: 'dark', label: 'Oscuro' },
] as const;

const DAY_MS = 24 * 60 * 60 * 1000;

export function SettingsScreen() {
  const settings = useLiveQuery(() => db.settings.get('singleton'), []);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingImport, setPendingImport] = useState<{
    backup: Awaited<ReturnType<typeof parseBackupFile>>;
    summary: ImportSummary;
  } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [confirmErase, setConfirmErase] = useState(false);
  const [eraseText, setEraseText] = useState('');
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const actionMessageTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Import y borrado cierran su hoja al instante (SPEC.md §5.6) — sin esto,
  // esa desaparición inmediata no dice si la acción realmente pasó algo.
  function showActionMessage(message: string) {
    if (actionMessageTimeout.current) clearTimeout(actionMessageTimeout.current);
    setActionMessage(message);
    actionMessageTimeout.current = setTimeout(() => setActionMessage(null), 2500);
  }

  useEffect(() => () => {
    if (actionMessageTimeout.current) clearTimeout(actionMessageTimeout.current);
  }, []);

  async function setTheme(theme: 'system' | 'light' | 'dark') {
    await db.settings.update('singleton', { theme });
    document.documentElement.dataset.theme = theme === 'system' ? '' : theme;
  }

  async function toggleCycleTracking() {
    if (!settings) return;
    await db.settings.update('singleton', { cycleTrackingEnabled: !settings.cycleTrackingEnabled });
  }

  async function handleExport() {
    const backup = await exportBackup();
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const stamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `celimood-export-${stamp}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleFileSelected(file: File) {
    setImportError(null);
    try {
      const raw = await file.text();
      const backup = parseBackupFile(raw);
      const summary = await previewImport(backup);
      setPendingImport({ backup, summary });
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'No se pudo leer el archivo.');
    }
  }

  async function confirmApply(mode: 'merge' | 'replace') {
    if (!pendingImport) return;
    const { newDays, conflicts } = pendingImport.summary;
    await applyImport(pendingImport.backup, mode);
    setPendingImport(null);
    showActionMessage(
      mode === 'replace' ? 'Datos reemplazados' : `Importado: ${newDays + conflicts} días`,
    );
  }

  const daysSinceExport = settings?.lastExportAt
    ? Math.floor((Date.now() - settings.lastExportAt) / DAY_MS)
    : null;

  return (
    <Screen>
      <header className="pt-6 pb-4">
        <h1 className="text-2xl font-semibold">Ajustes</h1>
        {/* Import y borrado cierran su hoja al instante — esto es lo único
            que dice si la acción realmente pasó algo. */}
        <InlineConfirmation show={actionMessage !== null} message={actionMessage ?? ''} />
      </header>

      <section className="mb-6">
        <h2 className="text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
          Tema
        </h2>
        <div className="flex gap-2">
          {THEME_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setTheme(opt.value)}
              className="flex-1 py-2 rounded-lg text-sm font-medium border transition-all duration-150 hover:-translate-y-0.5 active:translate-y-0 active:scale-95"
              style={
                settings?.theme === opt.value
                  ? { backgroundColor: 'var(--text-primary)', color: 'var(--surface-1)', borderColor: 'var(--text-primary)' }
                  : { borderColor: 'var(--hairline)' }
              }
              onMouseEnter={(e) => {
                if (settings?.theme !== opt.value) e.currentTarget.style.backgroundColor = 'var(--surface-2)';
              }}
              onMouseLeave={(e) => {
                if (settings?.theme !== opt.value) e.currentTarget.style.backgroundColor = '';
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </section>

      <section className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-medium">Tracking de ciclo</h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Habilita el registro de período, síntomas y predicciones.
          </p>
        </div>
        <button
          type="button"
          onClick={toggleCycleTracking}
          role="switch"
          aria-checked={settings?.cycleTrackingEnabled ?? false}
          className="w-12 h-7 rounded-full relative shrink-0 transition-colors hover:brightness-95 active:scale-95"
          style={{ backgroundColor: settings?.cycleTrackingEnabled ? 'var(--mood-5)' : 'var(--hairline)' }}
        >
          <span
            className="absolute left-0 top-0.5 w-6 h-6 rounded-full transition-transform"
            style={{
              backgroundColor: 'var(--surface-1)',
              transform: settings?.cycleTrackingEnabled ? 'translateX(22px)' : 'translateX(2px)',
            }}
          />
        </button>
      </section>

      <section className="mb-6 space-y-2">
        <h2 className="text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
          Backup
        </h2>
        <button type="button" onClick={handleExport} className="card card-tappable w-full py-2.5 rounded-lg text-sm font-medium">
          Exportar JSON
        </button>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="card card-tappable w-full py-2.5 rounded-lg text-sm font-medium"
        >
          Importar JSON
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFileSelected(file);
            e.target.value = '';
          }}
        />
        {importError && (
          <p className="text-sm" style={{ color: 'var(--status-critical)' }}>
            {importError}
          </p>
        )}
        {daysSinceExport !== null && daysSinceExport > 30 && (
          <p className="text-xs" style={{ color: 'var(--status-warning)' }}>
            Hace {daysSinceExport} días que no hacés un backup.
          </p>
        )}
        {daysSinceExport === null && (
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Todavía no hiciste ningún backup.
          </p>
        )}
      </section>

      <section>
        <h2 className="text-sm font-medium mb-2" style={{ color: 'var(--status-critical)' }}>
          Zona de riesgo
        </h2>
        <button
          type="button"
          onClick={() => setConfirmErase(true)}
          className="w-full py-2.5 rounded-lg text-sm font-medium border transition-all duration-150 hover:-translate-y-0.5 active:translate-y-0 active:scale-95"
          style={{ borderColor: 'var(--status-critical)', color: 'var(--status-critical)' }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'color-mix(in srgb, var(--status-critical) 10%, transparent)')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '')}
        >
          Borrar todos los datos
        </button>
      </section>

      <BottomSheet
        open={pendingImport !== null}
        onClose={() => setPendingImport(null)}
        title="Importar backup"
      >
        {pendingImport && (
          <div className="space-y-4">
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              {pendingImport.summary.newDays} días nuevos, {pendingImport.summary.conflicts} en
              conflicto, {pendingImport.summary.unchanged} sin cambios.
            </p>
            <button
              type="button"
              onClick={() => confirmApply('merge')}
              className="w-full py-2.5 rounded-lg text-sm font-medium transition-all duration-150 hover:-translate-y-0.5 hover:brightness-110 active:translate-y-0 active:scale-95"
              style={{ backgroundColor: 'var(--text-primary)', color: 'var(--surface-1)', boxShadow: 'var(--shadow-sm)' }}
            >
              Fusionar (recomendado)
            </button>
            <button
              type="button"
              onClick={() => confirmApply('replace')}
              className="w-full py-2.5 rounded-lg text-sm font-medium border transition-all duration-150 hover:-translate-y-0.5 active:translate-y-0 active:scale-95"
              style={{ borderColor: 'var(--status-critical)', color: 'var(--status-critical)' }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'color-mix(in srgb, var(--status-critical) 10%, transparent)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '')}
            >
              Reemplazar todo lo local
            </button>
          </div>
        )}
      </BottomSheet>

      <BottomSheet open={confirmErase} onClose={() => setConfirmErase(false)} title="Borrar todos los datos">
        <div className="space-y-4">
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Esto borra todo el humor y el ciclo registrados, sin vuelta atrás. Escribí{' '}
            <strong>borrar</strong> para confirmar.
          </p>
          <input
            value={eraseText}
            onChange={(e) => setEraseText(e.target.value)}
            className="w-full rounded-lg p-2.5 text-sm"
            style={{ border: '1px solid var(--hairline)', backgroundColor: 'var(--surface-2)' }}
          />
          <button
            type="button"
            disabled={eraseText !== 'borrar'}
            onClick={async () => {
              await eraseAllData();
              setConfirmErase(false);
              setEraseText('');
              showActionMessage('Datos borrados');
            }}
            className="w-full py-2.5 rounded-lg text-sm font-medium disabled:opacity-40 transition-all duration-150 enabled:hover:-translate-y-0.5 enabled:hover:brightness-110 enabled:active:translate-y-0 enabled:active:scale-95"
            style={{ backgroundColor: 'var(--status-critical)', color: 'white', boxShadow: 'var(--shadow-sm)' }}
          >
            Borrar definitivamente
          </button>
        </div>
      </BottomSheet>
    </Screen>
  );
}
