import React from 'react';
import FeaturedTrack from '../tracks/FeaturedTrack';
export default function DiscoverSpotlight({ track, tracksContext = [] }) {
  if (!track?.id) return null;
  return <div data-testid="discover-spotlight"><FeaturedTrack track={track} tracksContext={tracksContext} /></div>;
}
