import React from 'react';
import TrackCard from '../tracks/TrackCard';

export default function DiscoverTrackRail({ tracks = [], featured = false }) {
  return (
    <div className={`ns-discover-track-rail ${featured ? 'ns-discover-track-rail--featured' : ''}`}>
      {tracks.map((track) => (
        <div key={track.id} className="ns-discover-track-rail__item">
          <TrackCard track={track} tracksContext={tracks} />
        </div>
      ))}
    </div>
  );
}
