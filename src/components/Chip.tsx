type ChipProps = {
  label: string;
  selected?: boolean;
  onClick?: () => void;
  count?: number;
};

export function Chip({ label, selected, onClick, count }: ChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`px-3 py-1.5 rounded-full text-[15px] font-medium whitespace-nowrap min-h-[38px] border transition-all duration-150 hover:-translate-y-0.5 active:translate-y-0 active:scale-95 ${
        selected ? '' : 'bg-[var(--surface-1)] hover:bg-[var(--surface-2)]'
      }`}
      style={
        selected
          ? {
              backgroundColor: 'var(--text-primary)',
              color: 'var(--surface-1)',
              borderColor: 'var(--text-primary)',
              boxShadow: 'var(--shadow-sm)',
            }
          : { color: 'var(--text-primary)', borderColor: 'var(--hairline)' }
      }
    >
      {label}
      {count !== undefined && (
        <span className="ml-1 tabular-nums" style={{ opacity: 0.7 }}>
          {count}
        </span>
      )}
    </button>
  );
}
