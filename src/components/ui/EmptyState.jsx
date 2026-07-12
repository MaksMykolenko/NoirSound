import React from 'react';
import * as Icons from 'lucide-react';

export default function EmptyState({
  iconName = 'Music',
  title,
  description,
  actionText,
  onAction,
  secondaryActionText,
  onSecondaryAction,
  className = '',
}) {
  const Icon = Icons[iconName] || Icons.Music;

  return (
    <div className={`ns-state-panel !p-6 flex max-w-lg flex-col items-center justify-center text-center mx-auto my-5 ${className}`}>
      <div className="mb-3 rounded-md border border-brand-red/20 bg-brand-red/5 p-2.5 text-brand-red">
        <Icon size={24} />
      </div>
      <h3 className="mb-1 text-base font-semibold tracking-tight text-zinc-200">{title}</h3>
      <p className="text-sm leading-relaxed text-zinc-400 mb-5 max-w-sm">{description}</p>
      {(actionText && onAction) || (secondaryActionText && onSecondaryAction) ? (
        <div className="flex flex-col min-[420px]:flex-row items-stretch min-[420px]:items-center justify-center gap-2.5 w-full min-[420px]:w-auto">
          {actionText && onAction && (
            <button
              type="button"
              onClick={onAction}
              className="ns-button-primary px-5 text-[13px] uppercase tracking-wider cursor-pointer"
            >
              {actionText}
            </button>
          )}
          {secondaryActionText && onSecondaryAction && (
            <button
              type="button"
              onClick={onSecondaryAction}
              className="ns-button-secondary px-5 text-[13px] uppercase tracking-wider cursor-pointer"
            >
              {secondaryActionText}
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}
