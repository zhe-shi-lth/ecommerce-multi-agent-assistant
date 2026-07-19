import type { ReactNode } from "react";

interface AlertModalProps {
  open: boolean;
  title?: string;
  message: ReactNode;
  confirmText?: string;
  onClose: () => void;
}

export default function AlertModal({
  open,
  title = "提示",
  message,
  confirmText = "知道了",
  onClose,
}: AlertModalProps) {
  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" role="alertdialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">{title}</div>
        <div className="modal-body">{message}</div>
        <div className="modal-actions">
          <button className="btn btn-primary" onClick={onClose} autoFocus>
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
