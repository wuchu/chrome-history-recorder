import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import styles from '../cockpit.module.css';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  busy,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const { t } = useTranslation();

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className={styles.confirmOverlay} role="presentation" onClick={onCancel}>
      <div
        className={styles.confirmDialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cockpit-confirm-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className={styles.confirmTitle} id="cockpit-confirm-title">
          {title}
        </div>
        <div className={styles.confirmText}>{message}</div>
        <div className={styles.confirmActions}>
          <button type="button" className={styles.secondaryButton} onClick={onCancel}>
            {t('cockpit.confirm.cancel', '取消')}
          </button>
          <button type="button" className={styles.dangerButton} onClick={onConfirm} disabled={busy}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmDialog;
