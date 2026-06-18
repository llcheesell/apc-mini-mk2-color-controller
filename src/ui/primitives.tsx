import type { CSSProperties, ReactNode } from "react";
import type { AnimationParamSpec, AnimationParamValue } from "../types";

export function IconButton({
  active = false,
  danger = false,
  children,
  onClick,
  title,
  disabled = false,
}: {
  active?: boolean;
  danger?: boolean;
  children: ReactNode;
  onClick: () => void;
  title: string;
  disabled?: boolean;
}) {
  const classes = ["iconButton"];
  if (active) classes.push("active");
  if (danger) classes.push("danger");
  return (
    <button className={classes.join(" ")} onClick={onClick} title={title} aria-label={title} disabled={disabled}>
      {children}
    </button>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  size = "md",
}: {
  options: Array<{ value: T; label: string; icon?: ReactNode }>;
  value: T;
  onChange: (value: T) => void;
  size?: "sm" | "md";
}) {
  return (
    <div className={`segmented ${size}`} role="tablist">
      {options.map((option) => (
        <button
          key={option.value}
          role="tab"
          aria-selected={value === option.value}
          className={value === option.value ? "active" : ""}
          onClick={() => onChange(option.value)}
        >
          {option.icon}
          <span>{option.label}</span>
        </button>
      ))}
    </div>
  );
}

export function Slider({
  label,
  min,
  max,
  step = 1,
  value,
  onChange,
  display,
}: {
  label: string;
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (value: number) => void;
  display?: string;
}) {
  return (
    <label className="sliderRow">
      <span className="sliderLabel">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <strong className="sliderValue">{display ?? value}</strong>
    </label>
  );
}

export function Toggle({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="toggleRow">
      <span>{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        className={`toggleSwitch${checked ? " on" : ""}`}
        onClick={() => onChange(!checked)}
      >
        <span className="toggleKnob" />
      </button>
    </label>
  );
}

export function Swatch({
  color,
  active = false,
  onClick,
  title,
}: {
  color: string;
  active?: boolean;
  onClick: () => void;
  title?: string;
}) {
  return (
    <button
      type="button"
      className={`swatch${active ? " active" : ""}`}
      style={{ "--swatch": color } as CSSProperties}
      onClick={onClick}
      title={title ?? color}
    />
  );
}

export function SectionEyebrow({ children }: { children: ReactNode }) {
  return <div className="eyebrow">{children}</div>;
}

export function ParamControl({
  spec,
  value,
  onChange,
}: {
  spec: AnimationParamSpec;
  value: AnimationParamValue | undefined;
  onChange: (value: AnimationParamValue) => void;
}) {
  if (spec.kind === "number") {
    const current = typeof value === "number" ? value : spec.default;
    return (
      <Slider
        label={spec.label}
        min={spec.min}
        max={spec.max}
        step={spec.step}
        value={current}
        onChange={onChange}
      />
    );
  }
  if (spec.kind === "bool") {
    const current = typeof value === "boolean" ? value : spec.default;
    return <Toggle label={spec.label} checked={current} onChange={onChange} />;
  }
  const current = typeof value === "string" ? value : spec.default;
  return (
    <div className="paramEnum">
      <span className="sliderLabel">{spec.label}</span>
      <Segmented
        size="sm"
        options={spec.options.map((option) => ({ value: option.value, label: option.label }))}
        value={current}
        onChange={onChange}
      />
    </div>
  );
}
