import type { ReactNode } from "react";

interface AlertModalProps {
  open: boolean;
  title?: string;
  message: ReactNode;
  confirmText?: string;
  cancelText?: string;
  onClose: () => void;
  onConfirm?: () => void;
}

export default function AlertModal({
  open,
  title = "提示",
  message,
  confirmText,
  cancelText = "取消",
  onClose,
  onConfirm,
}: AlertModalProps) {
  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" role="alertdialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">{title}</div>
        <div className="modal-body">{message}</div>
        <div className="modal-actions">
          {onConfirm && (
            <button className="btn btn-secondary" onClick={onClose}>
              {cancelText}
            </button>
          )}
          <button
            className={`btn ${onConfirm ? "btn-danger" : "btn-primary"}`}
            onClick={onConfirm ?? onClose}
            autoFocus
          >
            {confirmText ?? (onConfirm ? "确认" : "知道了")}
          </button>
        </div>
      </div>
    </div>
  );
}
