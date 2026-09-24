import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import FallbackAvatar from '../ui/FallbackAvatar';

export default function ProfileScrollIdentity({ headerRef, avatarRef, user, displayName, onAvatarClick }) {
  const { t } = useTranslation();
  const barRef = useRef(null);
  const [isPinned, setIsPinned] = useState(false);

  useEffect(() => {
    const header = headerRef.current;
    const avatar = avatarRef.current;
    const bar = barRef.current;
    const scroller = header?.closest('.ns-main-scroll');
    if (!scroller || !avatar || !bar) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame = null;
    let pinned = false;
    const originalVisibility = avatar.style.visibility;

    const update = () => {
      frame = null;
      // Read the unchanged avatar slot before writing the floating presentation.
      const source = avatar.getBoundingClientRect();
      const bounds = header.getBoundingClientRect();
      const scrollBounds = scroller.getBoundingClientRect();
      const targetTop = scrollBounds.top + 12;
      const distance = Math.max(80, source.width);
      const rawProgress = Math.min(1, Math.max(0, (targetTop + distance - source.top) / distance));
      const progress = reducedMotion.matches ? Number(rawProgress === 1) : rawProgress;
      const size = source.width + (40 - source.width) * progress;
      const x = source.left - bounds.left + (12 - (source.left - bounds.left)) * progress;
      const y = source.top - scrollBounds.top + (12 - (source.top - scrollBounds.top)) * progress;

      bar.style.setProperty('--profile-bar-top', `${scrollBounds.top}px`);
      bar.style.setProperty('--profile-bar-left', `${bounds.left}px`);
      bar.style.setProperty('--profile-bar-width', `${bounds.width}px`);
      bar.style.setProperty('--profile-scroll-progress', String(progress));
      bar.style.setProperty('--profile-avatar-x', `${x}px`);
      bar.style.setProperty('--profile-avatar-y', `${y}px`);
      bar.style.setProperty('--profile-avatar-scale', String(size / 40));
      bar.style.setProperty('--profile-label-left', `${x + size + 12}px`);
      bar.style.setProperty('--profile-label-opacity', String(Math.max(0, (progress - 0.6) / 0.4)));
      bar.dataset.visible = String(progress > 0);
      avatar.style.visibility = progress > 0 ? 'hidden' : originalVisibility;
      const nextPinned = progress === 1;
      if (nextPinned !== pinned) {
        pinned = nextPinned;
        setIsPinned(nextPinned);
      }
    };
    const schedule = () => {
      if (frame === null) frame = requestAnimationFrame(update);
    };
    const observer = new ResizeObserver(schedule);
    observer.observe(header);
    observer.observe(avatar);
    observer.observe(scroller);
    scroller.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    reducedMotion.addEventListener('change', schedule);
    schedule();
    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
      observer.disconnect();
      scroller.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      reducedMotion.removeEventListener('change', schedule);
      avatar.style.visibility = originalVisibility;
    };
  }, [headerRef, avatarRef]);

  return (
    <div ref={barRef} className="ns-profile-scroll" data-testid="profile-scroll-identity"
      data-visible="false" data-pinned={isPinned} aria-hidden={!isPinned} inert={!isPinned}>
      <div className="ns-profile-scroll__surface" />
      <div className="ns-profile-scroll__name">
        <span className="block truncate font-semibold" title={displayName}>{displayName}</span>
        {user.username && <span className="block truncate text-xs text-zinc-400">@{user.username}</span>}
      </div>
      <div className="ns-profile-scroll__avatar">
        {onAvatarClick ? (
          <button type="button" onClick={onAvatarClick} tabIndex={isPinned ? 0 : -1}
            className="block h-full w-full cursor-pointer overflow-hidden rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-red"
            aria-label={t('profile.changeAvatar', 'Change photo & settings')}>
            <FallbackAvatar src={user.avatarUrl} name={displayName} className="h-full w-full" imageClassName="object-cover" semanticFallback />
          </button>
        ) : <FallbackAvatar src={user.avatarUrl} name={displayName} className="h-full w-full" imageClassName="object-cover" semanticFallback />}
      </div>
    </div>
  );
}
