import React, { useEffect, useRef, useState } from "react";

interface SelectProps {
  value?: string | number;
  onChange: (e: { target: { value: string } }) => void;
  children?: React.ReactNode;
  className?: string;
  ariaLabel?: string;
  disabled?: boolean;
}

interface Opt {
  value: string;
  label: string;
  disabled?: boolean;
}

function optionLabel(children: React.ReactNode): string {
  if (children == null || typeof children === "boolean") return "";
  if (typeof children === "string" || typeof children === "number") return String(children);
  if (Array.isArray(children)) return children.map(optionLabel).join("");
  if (React.isValidElement(children)) return optionLabel((children.props as { children?: React.ReactNode }).children);
  return String(children);
}

export default function Select({ value, onChange, children, className, ariaLabel, disabled }: SelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const strValue = value === undefined || value === null ? "" : String(value);

  const options: Opt[] = React.Children.toArray(children)
    .filter((c): c is React.ReactElement => React.isValidElement(c) && c.type === "option")
    .map((c) => {
      const p = c.props as { value?: string | number; children?: React.ReactNode; disabled?: boolean };
      return {
        value: p.value === undefined ? "" : String(p.value),
        label: optionLabel(p.children),
        disabled: !!p.disabled,
      };
    });

  const selected = options.find((o) => o.value === strValue);
  const label = selected ? selected.label : strValue;

  useEffect(() => {
    if (!open) return;
    function onDocMouse(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocMouse);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocMouse);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="ui-select" ref={ref}>
      <button
        type="button"
        className={"ui-select-trigger" + (className ? " " + className : "")}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="ui-select-value">{label || "请选择"}</span>
      </button>
      {open && (
        <div className="ui-select-panel" role="listbox">
          {options.map((o) => (
            <button
              type="button"
              key={o.value}
              role="option"
              aria-selected={o.value === strValue}
              disabled={o.disabled}
              className={"ui-select-option" + (o.value === value ? " selected" : "")}
              onClick={() => {
                if (o.disabled) return;
                onChange({ target: { value: o.value } });
                setOpen(false);
              }}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
