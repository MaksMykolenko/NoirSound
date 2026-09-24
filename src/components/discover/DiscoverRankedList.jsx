import React from 'react';
import TrackListItem from '../tracks/TrackListItem';

export default function DiscoverRankedList({ tracks = [], compact = false }) {
  const validTracks = (Array.isArray(tracks) ? tracks : []).filter(track => Boolean(track?.id));
  return <div className="ns-track-list ns-discover-ranked-tracks" role="list">
    {validTracks.map((track, index) => <TrackListItem key={track.id} track={track} index={index}
      tracksContext={validTracks} compact={compact} role="listitem" />)}
  </div>;
}
