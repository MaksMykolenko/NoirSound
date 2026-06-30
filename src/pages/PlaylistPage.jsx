import React from 'react';
import { ArrowLeft, Clock, Pause, Play } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { usePlaylist } from '../hooks/queries/usePlaylists';
import { usePlayerStore } from '../store/playerStore';
import TrackListItem from '../components/tracks/TrackListItem';
import EmptyState from '../components/ui/EmptyState';
import ErrorState from '../components/ui/ErrorState';
import LoadingState from '../components/ui/LoadingState';
import FallbackCover from '../components/ui/FallbackCover';
import { dedupeById } from '../utils/presentation';

function formatPlaylistDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return 'Duration unavailable';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours > 0 ? `${hours} hr ${minutes} min` : `${minutes} min`;
}

export default function PlaylistPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: playlist, isLoading, error } = usePlaylist(id);
  const { currentTrack, isPlaying, playTrack, togglePlay } = usePlayerStore();

  if (isLoading) return <LoadingState type="list" count={5} />;
  if (error) {
    if (error.status === 404) {
      return (
        <EmptyState
          iconName="ListMusic"
          title="Playlist not found"
          description="This playlist does not exist or is no longer public."
          actionText="Return Home"
          onAction={() => navigate('/')}
        />
      );
    }
    return <ErrorState title="Playlist unavailable" message={error.message} />;
  }
  if (!playlist) {
    return (
      <EmptyState
        iconName="ListMusic"
        title="Playlist not found"
        description="This playlist does not exist or is no longer public."
      />
    );
  }

  const tracks = dedupeById(playlist.tracks || []);
  const playableTracks = tracks.filter(
    (track) => track.isStreamable ?? Boolean(track.audioUrl)
  );
  const totalDuration = tracks.reduce(
    (total, track) => total + Number(track.duration || 0),
    0
  );
  const isPlaylistPlaying = Boolean(
    isPlaying && currentTrack && tracks.some((track) => track.id === currentTrack.id)
  );

  const handlePlay = () => {
    if (playableTracks.length === 0) return;
    if (currentTrack && playableTracks.some((track) => track.id === currentTrack.id)) {
      togglePlay();
      return;
    }
    playTrack(playableTracks[0], playableTracks);
  };

  return (
    <div className="ns-page-stack animate-fade-in pb-16">
      <button
        onClick={() => navigate(-1)}
        className="min-h-11 px-2 flex items-center gap-2 text-zinc-400 hover:text-white text-xs font-bold uppercase tracking-wider"
      >
        <ArrowLeft size={14} />
        <span>Back</span>
      </button>

      <section className="flex flex-col md:flex-row gap-6 md:gap-8 items-center md:items-end p-5 sm:p-6 md:p-8 rounded-[1.75rem] ns-card">
        <div className="w-48 h-48 md:w-56 md:h-56 rounded-2xl overflow-hidden border border-zinc-800 bg-zinc-900 shrink-0">
          <FallbackCover
            src={playlist.coverUrl}
            title={playlist.name}
            artistName={playlist.creator}
            genre="Playlist"
            className="w-full h-full"
            imageClassName="object-cover"
          />
        </div>

        <div className="flex-1 space-y-4 text-center md:text-left min-w-0">
          <span className="inline-block text-[11px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full bg-brand-red/10 border border-brand-red/30 text-rose-300">
            Public playlist
          </span>
          <div>
            <h1 className="ns-page-title break-words">{playlist.name}</h1>
            <p className="text-sm text-zinc-400 mt-2">
              {playlist.description || 'No description provided.'}
            </p>
          </div>
          <div className="flex flex-wrap justify-center md:justify-start items-center gap-3 text-xs text-zinc-400">
            <span>By {playlist.creator}</span>
            <span>{tracks.length} tracks</span>
            <span className="flex items-center gap-1">
              <Clock size={12} />
              {formatPlaylistDuration(totalDuration)}
            </span>
          </div>
          {playableTracks.length > 0 ? (
            <button onClick={handlePlay} className="ns-button-primary px-6 inline-flex items-center gap-2">
              {isPlaylistPlaying ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
              <span>{isPlaylistPlaying ? 'Pause' : 'Play Playlist'}</span>
            </button>
          ) : tracks.length > 0 ? (
            <p className="text-xs text-zinc-500">Audio is not available for these releases yet.</p>
          ) : null}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="ns-eyebrow px-1">Tracks</h2>
        {tracks.length === 0 ? (
          <EmptyState
            iconName="Music2"
            title="This playlist is empty"
            description="Tracks will appear here after the owner adds them."
          />
        ) : (
          <div className="ns-card p-2 sm:p-4 space-y-1">
            {tracks.map((track, index) => (
              <TrackListItem
                key={track.id}
                track={track}
                index={index}
                tracksContext={tracks}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
