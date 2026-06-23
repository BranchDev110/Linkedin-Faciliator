import type { ButtonHTMLAttributes, ReactNode } from 'react';
import './DisabledButtonWithTooltip.css';

interface DisabledButtonWithTooltipProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  disabledReason?: string;
  children: ReactNode;
}

export default function DisabledButtonWithTooltip({
  disabled = false,
  disabledReason,
  children,
  className,
  title,
  ...buttonProps
}: DisabledButtonWithTooltipProps) {
  const button = (
    <button
      {...buttonProps}
      className={className}
      disabled={disabled}
      title={disabled ? undefined : title}
    >
      {children}
    </button>
  );

  if (disabled && disabledReason) {
    return (
      <span className="disabled-button-tooltip-wrap" title={disabledReason}>
        {button}
      </span>
    );
  }

  return button;
}
