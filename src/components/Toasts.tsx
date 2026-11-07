import { AlertCircle, CheckCircle2, Info } from "lucide-react";

import { useApp, type Toast } from "../store/app";

const ICONS = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
} as const;

function ToastItem({ toast }: { toast: Toast }) {
  const dismiss = useApp((s) => s.dismissToast);
  const Icon = ICONS[toast.kind];
  return (
    <button type="button" className={`toast ${toast.kind}`} onClick={() => dismiss(toast.id)}>
      <Icon size={16} />
      <span>{toast.text}</span>
    </button>
  );
}

export function Toasts() {
  const toasts = useApp((s) => s.toasts);
  if (!toasts.length) return null;
  return (
    <div className="toasts">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  );
}
