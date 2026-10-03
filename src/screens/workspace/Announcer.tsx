import { useUi } from '../../store/ui';
import { CloseIcon } from '../../ui/icons';

// Live region (docs/UI_DESIGN.md → ACCESSIBILITY) + toasts (errors, confirmations).

export function Announcer() {
  const announcement = useUi((s) => s.announcement);
  const toasts = useUi((s) => s.toasts);
  return (
    <>
      <div aria-live="polite" role="status" className="sr-only">{announcement}</div>
      <div className="pointer-events-none fixed bottom-s4 left-1/2 z-[60] flex -translate-x-1/2 flex-col items-center gap-s2">
        {toasts.map((t) => (
          <div key={t.id} role={t.tone === 'error' ? 'alert' : 'status'} className="lcd-tip pointer-events-auto flex items-center gap-s3 px-s4 py-s2 text-[12px]" style={t.tone === 'error' ? { color: '#FF8A80' } : undefined}>
            <span>{t.text}</span>
            <button className="opacity-70 hover:opacity-100" aria-label="Dismiss" onClick={() => useUi.getState().dismissToast(t.id)}>
              <CloseIcon size={12} />
            </button>
          </div>
        ))}
      </div>
    </>
  );
}
