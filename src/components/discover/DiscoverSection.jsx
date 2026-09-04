import React from 'react';

export default function DiscoverSection({
  id,
  sectionRef,
  tabIndex,
  title,
  description,
  action,
  testId,
  className = '',
  children,
}) {
  return (
    <section id={id} ref={sectionRef} tabIndex={tabIndex} aria-labelledby={id ? `${id}-title` : undefined} className={`ns-discover-section ${className}`} data-testid={testId}>
      <div className="ns-section-header-row">
        <div className="min-w-0">
          <h2 id={id ? `${id}-title` : undefined} className="ns-section-title">{title}</h2>
          {description && <p className="mt-1 text-sm text-zinc-500">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
