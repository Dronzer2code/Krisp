import { useEffect, useRef, useState } from 'react';
import { registerPasscodePrompt } from '../../api/client';
import { Dialog } from '../../ui/Dialog';

// docs/PRD.md F11. Opens when a backend call returns 401 (or before the first network action); the
// passcode is kept for the browser session. Beat making, mixing and AI work without it.

export function PasscodeGate() {
  const [open, setOpen] = useState(false);
  const [wrong, setWrong] = useState(false);
  const resolver = useRef<((v: string | null) => void) | null>(null);
  const asked = useRef(0);

  useEffect(() => {
    registerPasscodePrompt(
      () =>
        new Promise<string | null>((resolve) => {
          setWrong(asked.current > 0);
          asked.current++;
          resolver.current = resolve;
          setOpen(true);
        }),
    );
    return () => registerPasscodePrompt(null);
  }, []);

  const finish = (value: string | null) => {
    resolver.current?.(value);
    resolver.current = null;
    setOpen(false);
  };

  return (
    <Dialog
      open={open}
      title="Studio passcode"
      onClose={() => finish(null)}
      width={400}
      actions={
        <>
          <button className="btn" onClick={() => finish(null)}>Not now</button>
          <button className="btn btn-primary" type="submit" form="passcode-form">Unlock</button>
        </>
      }
    >
      <form
        id="passcode-form"
        onSubmit={(e) => {
          e.preventDefault();
          const v = String(new FormData(e.currentTarget).get('passcode') ?? '').trim();
          finish(v || null);
        }}
      >
        <p className="mb-s4">Enter the studio passcode to save and use the sound library.</p>
        <label className="label mb-s2 block" htmlFor="passcode">Passcode</label>
        <input id="passcode" name="passcode" type="password" autoComplete="current-password" data-autofocus className="field" />
        {wrong && <p role="alert" className="mt-s2 text-[12px] text-[#B3261E]">That passcode didn’t work. Try again.</p>}
      </form>
    </Dialog>
  );
}
