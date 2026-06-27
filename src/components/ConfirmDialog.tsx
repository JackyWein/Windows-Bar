import { useState, useEffect, useRef, useCallback } from 'react';

export interface ConfirmOptions {
  readonly title: string;
  readonly message: string;
  readonly confirmLabel?: string;
  readonly cancelLabel?: string;
  readonly destructive?: boolean;
}

interface ConfirmDialogProps {
  readonly options: ConfirmOptions;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

function ConfirmDialog({ options, onConfirm, onCancel }: ConfirmDialogProps) {
  const confirmBtnRef = useRef<HTMLButtonElement>(null);
  const [selected, setSelected] = useState<'cancel' | 'confirm'>('cancel');

  useEffect(() => {
    confirmBtnRef.current?.focus();
  }, []);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      setSelected((prev) => (prev === 'cancel' ? 'confirm' : 'cancel'));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selected === 'confirm') onConfirm();
      else onCancel();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      setSelected((prev) => (prev === 'cancel' ? 'confirm' : 'cancel'));
    }
  }, [selected, onConfirm, onCancel]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onCancel();
  }, [onCancel]);

  const confirmLabel = options.confirmLabel ?? 'Confirm';
  const cancelLabel = options.cancelLabel ?? 'Cancel';

  return (
    <div className="confirm-backdrop" onClick={handleBackdropClick}>
      <div className="confirm-card">
        <div className="confirm-title">{options.title}</div>
        <div className="confirm-message">{options.message}</div>
        <div className="confirm-actions">
          <button
            ref={selected === 'cancel' ? undefined : confirmBtnRef}
            className={`confirm-btn${selected === 'confirm' ? ' selected' : ''}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
          <button
            ref={selected === 'cancel' ? confirmBtnRef : undefined}
            className={`confirm-btn cancel${selected === 'cancel' ? ' selected' : ''}`}
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
        </div>
        <div className="confirm-hints">
          <span><kbd>Tab</kbd> / <kbd>←→</kbd> Switch</span>
          <span><kbd>Enter</kbd> Select</span>
          <span><kbd>Esc</kbd> Cancel</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Hook that provides a confirm dialog without external browser popups.
 * Returns [dialogElement, showConfirm] where showConfirm returns a promise.
 */
export function useConfirm(): [
  React.ReactNode,
  (options: ConfirmOptions) => Promise<boolean>,
] {
  const [state, setState] = useState<{
    options: ConfirmOptions;
    resolve: (value: boolean) => void;
  } | null>(null);

  const showConfirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      setState({ options, resolve });
    });
  }, []);

  const handleConfirm = useCallback(() => {
    setState((prev) => {
      prev?.resolve(true);
      return null;
    });
  }, []);

  const handleCancel = useCallback(() => {
    setState((prev) => {
      prev?.resolve(false);
      return null;
    });
  }, []);

  const dialog = state ? (
    <ConfirmDialog
      key={Date.now()}
      options={state.options}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
    />
  ) : null;

  return [dialog, showConfirm];
}
