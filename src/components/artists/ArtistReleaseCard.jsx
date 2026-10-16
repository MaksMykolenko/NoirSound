import React from 'react';
import TrackCard from '../tracks/TrackCard';

function releaseYear(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.getUTCFullYear();
}

export default function ArtistReleaseCard({ track, tracksContext, queueSource }) {
  if (!track?.id) return null;
  return <TrackCard track={track} tracksContext={tracksContext} queueSource={queueSource}
    variant="release" releaseYear={releaseYear(track.releaseDate) ?? releaseYear(track.createdAt)} />;
}
