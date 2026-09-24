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
    let needsMeasure = true;
    let lastTime = null;
    let current = null;
    let target = null;
    const originalVisibility = avatar.style.visibility;

    const update = (time) => {
      frame = null;
      if (needsMeasure) {
        needsMeasure = false;
        // Measure only after scroll/resize, not on every settling animation frame.
        const source = avatar.getBoundingClientRect();
        const bounds = header.getBoundingClientRect();
        const scrollBounds = scroller.getBoundingClientRect();
        const restingTop = source.top - scrollBounds.top + scroller.scrollTop;
        // Short mobile banners still leave the full avatar intact at scroll top.
        const distance = Math.min(Math.max(120, source.width * 1.5), Math.max(1, restingTop - 12 - 24));
        const rawProgress = Math.min(1, Math.max(0, (scrollBounds.top + 12 + distance - source.top) / distance));
        // Smoothstep makes both ends of the scroll-linked morph ease into place.
        const progress = reducedMotion.matches ? Number(rawProgress === 1) : rawProgress * rawProgress * (3 - 2 * rawProgress);
        const sourceX = source.left - bounds.left;
        const sourceY = source.top - scrollBounds.top;
        target = {
          x: sourceX + (12 - sourceX) * progress,
          y: sourceY + (12 - sourceY) * progress,
          size: source.width + (40 - source.width) * progress,
          progress,
        };
        bar.style.setProperty('--profile-bar-top', `${scrollBounds.top}px`);
        bar.style.setProperty('--profile-bar-left', `${bounds.left}px`);
        bar.style.setProperty('--profile-bar-width', `${bounds.width}px`);
      }

      // Ease the complete pose, so wheel steps cannot jerk position independently
      // of scale. Time-based damping behaves consistently on 60/120 Hz displays.
      const elapsed = lastTime === null ? 1000 / 60 : Math.min(time - lastTime, 64);
      const blend = 1 - Math.exp(-elapsed / 85);
      if (!current || reducedMotion.matches || (current.progress === 0 && target.progress === 0)) {
        current = { ...target };
      } else {
        for (const key of ['x', 'y', 'size', 'progress']) {
          current[key] += (target[key] - current[key]) * blend;
        }
      }
      const settled = Math.abs(current.x - target.x) < 0.1
        && Math.abs(current.y - target.y) < 0.1
        && Math.abs(current.size - target.size) < 0.1
        && Math.abs(current.progress - target.progress) < 0.001;
      if (settled) current = { ...target };
      const { x, y, size, progress } = current;
      const labelProgress = Math.max(0, (progress - 0.6) / 0.4);

      bar.style.setProperty('--profile-scroll-progress', String(progress));
      bar.style.setProperty('--profile-avatar-x', `${x}px`);
      bar.style.setProperty('--profile-avatar-y', `${y}px`);
      bar.style.setProperty('--profile-avatar-scale', String(size / 40));
      bar.style.setProperty('--profile-label-left', `${x + size + 12}px`);
      bar.style.setProperty('--profile-label-opacity', String(labelProgress * labelProgress * (3 - 2 * labelProgress)));
      bar.dataset.visible = String(progress > 0);
      bar.dataset.moving = String(!settled);
      avatar.style.visibility = progress > 0 ? 'hidden' : originalVisibility;
      const nextPinned = settled && target.progress === 1;
      if (nextPinned !== pinned) {
        pinned = nextPinned;
        setIsPinned(nextPinned);
      }
      lastTime = settled ? null : time;
      if (!settled) frame = requestAnimationFrame(update);
    };
    const schedule = () => {
      needsMeasure = true;
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
