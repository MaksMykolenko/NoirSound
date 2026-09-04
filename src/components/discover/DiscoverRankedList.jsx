import React from 'react';
import TrackListItem from '../tracks/TrackListItem';

export default function DiscoverRankedList({ tracks = [], compact = false }) {
  return (
    <div className={`ns-discover-ranked-list ${compact ? 'ns-discover-ranked-list--compact' : ''}`}>
      {tracks.map((track, index) => (
        <TrackListItem
          key={track.id}
          track={track}
          index={index}
          tracksContext={tracks}
          compact={compact}
          showMobileLike
        />
      ))}
    </div>
  );
}
