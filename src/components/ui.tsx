import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";

/** 分段选择控件，对应 .segmented */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  disabled,
}: {
  value: T;
  options: ReadonlyArray<{ value: T; label: ReactNode }>;
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  return (
    <div className={`segmented${disabled ? " disabled" : ""}`} aria-disabled={disabled}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={option.value === value ? "active" : undefined}
          disabled={disabled}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/** 开关，对应 .switch */
export function Switch({
  on,
  onChange,
  disabled,
  label,
}: {
  on: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  label?: string;
}) {
  const classes = ["switch", on ? "on" : null, disabled ? "disabled" : null]
    .filter(Boolean)
    .join(" ");
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      className={classes}
      disabled={disabled}
      onClick={() => !disabled && onChange(!on)}
    />
  );
}

/** 进度条，对应 .progress */
export function ProgressBar({
  done,
  total,
  indeterminate,
}: {
  done: number;
  total: number;
  indeterminate?: boolean;
}) {
  const pct = total > 0 ? Math.min(100, Math.max(0, (done / total) * 100)) : 0;
  return (
    <div className={`progress${indeterminate ? " indeterminate" : ""}`}>
      <div className="progress-fill" style={{ width: `${pct}%` }} />
    </div>
  );
}

/** 字段容器，对应 .field */
export function Field({
  label,
  hint,
  children,
}: {
  label: ReactNode;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint ? <span className="field-hint">{hint}</span> : null}
    </label>
  );
}

/** 行内加载图标 */
export function Spinner({ size = 14 }: { size?: number }) {
  return <Loader2 size={size} className="spin" />;
}
