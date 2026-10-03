import { useUi } from '../../store/ui';
import { CloseIcon } from '../../ui/icons';
import { Tabs } from '../../ui/Tabs';

// docs/UI_DESIGN.md → Side panel: [SOUNDS | AI]. Sound Browser lands in T8, AI tools in T10.

export function SidePanel({ onClose }: { onClose?: () => void }) {
  const tab = useUi((s) => s.sidePanel);
  return (
    <section className="panel flex h-full min-h-[480px] flex-col gap-s4 p-s4" aria-label="Side panel">
      <div className="flex items-center gap-s2">
        <Tabs label="Side panel" idPrefix="side" className="flex-1" value={tab} onChange={(v) => useUi.getState().set({ sidePanel: v })}
          items={[{ value: 'SOUNDS', label: 'Sounds' }, { value: 'AI', label: 'AI' }]} />
        {onClose && <button className="icon-btn" aria-label="Close panel" onClick={onClose}><CloseIcon /></button>}
      </div>
      <div role="tabpanel" id={`side-panel-${tab}`} aria-labelledby={`side-tab-${tab}`} className="min-h-0 flex-1">
        <p className="label">{tab === 'SOUNDS' ? 'Sound Browser' : 'AI tools'}</p>
      </div>
    </section>
  );
}
