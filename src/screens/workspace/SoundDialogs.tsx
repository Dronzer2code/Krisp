import { useState } from 'react';
import { Dialog } from '../../ui/Dialog';

// Small dialogs shared by the Library: ask for a name, confirm a delete.

export function NameDialog({ open, title, label, initial, submit, onSubmit, onClose }: {
  open: boolean;
  title: string;
  label: string;
  initial: string;
  submit: string;
  onSubmit: (name: string) => void | Promise<void>;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const formId = `name-dialog-${title.replace(/\W+/g, '-')}`;
  return (
    <Dialog
      open={open}
      title={title}
      onClose={onClose}
      width={400}
      actions={
        <>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" type="submit" form={formId} disabled={busy}>{busy ? 'Saving…' : submit}</button>
        </>
      }
    >
      <form
        id={formId}
        onSubmit={async (e) => {
          e.preventDefault();
          const v = String(new FormData(e.currentTarget).get('name') ?? '').trim();
          if (!v) return;
          setBusy(true);
          try {
            await onSubmit(v);
          } finally {
            setBusy(false);
            onClose();
          }
        }}
      >
        <label className="label mb-s2 block" htmlFor={`${formId}-input`}>{label}</label>
        <input id={`${formId}-input`} name="name" data-autofocus className="field" defaultValue={initial} maxLength={100} />
      </form>
    </Dialog>
  );
}

export function ConfirmDialog({ open, title, body, confirm, onConfirm, onClose }: {
  open: boolean;
  title: string;
  body: string;
  confirm: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={open}
      title={title}
      onClose={onClose}
      width={420}
      actions={
        <>
          <button className="btn" data-autofocus onClick={onClose}>Cancel</button>
          <button className="btn btn-danger" onClick={() => { onClose(); onConfirm(); }}>{confirm}</button>
        </>
      }
    >
      <p>{body}</p>
    </Dialog>
  );
}
