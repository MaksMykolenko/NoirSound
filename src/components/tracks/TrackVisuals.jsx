import React from 'react';
import { CircleCheck, CirclePlus } from 'lucide-react';

export function TrackSaveIcon({ saved, size = 20 }) {
  return saved
    ? <CircleCheck size={size} className="ns-track-saved-icon" aria-hidden="true" />
    : <CirclePlus size={size} aria-hidden="true" />;
}

export function TrackPlayingIndicator({ className = '' }) {
  return <span className={`ns-track-equalizer ${className}`} aria-hidden="true"><i /><i /><i /><i /></span>;
}
