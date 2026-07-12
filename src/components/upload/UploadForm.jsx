import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { UploadCloud, CheckCircle, FileAudio, Image as ImageIcon, Music, AlertCircle } from 'lucide-react';
import { useUploadTrack, pollUploadStatus } from '../../hooks/mutations/useUploadTrack';
import { useUserStore } from '../../store/userStore';
import { useToastStore } from '../../store/toastStore';
import { ensureMyArtistProfile } from '../../api/user';
import LoadingState from '../ui/LoadingState';
import GenrePicker from '../ui/GenrePicker';
import { getLocalizedGenre } from '../../i18n/genreLabels';
import LyricsEditor from '../lyrics/LyricsEditor';
import { lyricsCounts, MAX_LYRICS_LINES } from '../lyrics/lyricsUtils';

export default function UploadForm() {
  const { t } = useTranslation();
  const { user, authHydrated, setAuthModalOpen, fetchCurrentUser } = useUserStore();
  const addToast = useToastStore((state) => state.addToast);
  const [profileSetupStatus, setProfileSetupStatus] = useState('idle'); // idle | loading

  async function handleCreateMyArtistProfile() {
    setProfileSetupStatus('loading');
    try {
      await ensureMyArtistProfile();
      await fetchCurrentUser();
      addToast(t('uploadForm.artistProfileReadyToast', { defaultValue: 'Artist profile created — you can upload now.' }), 'success');
    } catch (err) {
      addToast(err.message || t('uploadForm.artistProfileCreateFailed', { defaultValue: 'Could not create your artist profile.' }), 'error');
    } finally {
      setProfileSetupStatus('idle');
    }
  }
  const [title, setTitle] = useState('');
  const [genre, setGenre] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [rightsChecked, setRightsChecked] = useState(false);
  const [lyricsForm, setLyricsForm] = useState({
    lyricsText: '',
    lyricsType: 'NONE',
    lyricsLanguage: '',
    lyricsRightsConfirmed: false,
  });
  const [audioFile, setAudioFile] = useState(null);
  const [coverFile, setCoverFile] = useState(null);
  const [coverPreviewUrl, setCoverPreviewUrl] = useState('');

  const [uploadStatus, setUploadStatus] = useState('idle'); // idle | uploading | processing | generating | success | error
  const [uploadProgress, setUploadProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const [uploadId, setUploadId] = useState(null);

  const uploadMutation = useUploadTrack();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!audioFile) return setErrorMsg('Please select an audio file to upload.');
    if (!coverFile) return setErrorMsg('Please select a cover image.');
    if (!title.trim()) return setErrorMsg('Please enter a track title.');
    if (!genre) return setErrorMsg('Please choose a genre for your track.');
    if (!rightsChecked) return setErrorMsg('You must confirm ownership rights to publish.');
    if (lyricsCounts(lyricsForm.lyricsText).lines > MAX_LYRICS_LINES) {
      return setErrorMsg(t('lyrics.tooLong'));
    }
    if (lyricsForm.lyricsText.trim() && !lyricsForm.lyricsRightsConfirmed) {
      return setErrorMsg(t('lyrics.rightsRequired'));
    }

    setUploadStatus('uploading');
    setUploadProgress(0);

    try {
      // 1. Execute upload (gets S3 urls and puts them)
      const res = await uploadMutation.mutateAsync({
        title, genre, description, tags: tags.split(',').map(t => t.trim()).filter(Boolean),
        audioFile,
        coverFile,
        copyrightConfirmed: rightsChecked,
        ...lyricsForm,
      });
      
      setUploadProgress(100);
      setUploadId(res.uploadId);
      setUploadStatus('processing');
    } catch (err) {
      // The backend reports this specific failure as a stable code
      // (`ARTIST_PROFILE_REQUIRED`), not a display string — never show that
      // code verbatim. This is a defensive fallback: the role/profile gate
      // above should already prevent reaching submit in this state, but the
      // profile can change between page load and submit (e.g. an admin
      // hides it mid-session).
      setErrorMsg(err.code === 'ARTIST_PROFILE_REQUIRED'
        ? t('uploadForm.profileNotReadyMessage', {
          defaultValue: 'Your artist profile is not ready yet. Please contact an admin or complete your artist profile before uploading tracks.',
        })
        : (err.message || 'Upload failed.'));
      setUploadStatus('error');
    }
  };

  useEffect(() => {
    let poller = null;
    
    const checkStatus = async () => {
      if (!uploadId) return;
      try {
        const res = await pollUploadStatus(uploadId);
        if (res.status === 'PROCESSING') {
          setUploadStatus('processing');
        } else if (res.status === 'READY') {
          setUploadStatus('success');
          clearInterval(poller);
        } else if (res.status === 'FAILED') {
          setErrorMsg(res.error || 'Processing failed.');
          setUploadStatus('error');
          clearInterval(poller);
        }
      } catch (err) {
        setErrorMsg(err.message || 'Could not verify processing status.');
        setUploadStatus('error');
        clearInterval(poller);
      }
    };

    if (uploadStatus === 'processing') {
      poller = setInterval(checkStatus, 3000);
      checkStatus(); // Initial check
    }

    return () => {
      if (poller) clearInterval(poller);
    };
  }, [uploadStatus, uploadId]);

  useEffect(() => {
    if (!coverFile) {
      setCoverPreviewUrl('');
      return undefined;
    }
    const previewUrl = URL.createObjectURL(coverFile);
    setCoverPreviewUrl(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [coverFile]);

  const handleReset = () => {
    setTitle('');
    setGenre('');
    setDescription('');
    setTags('');
    setRightsChecked(false);
    setLyricsForm({
      lyricsText: '',
      lyricsType: 'NONE',
      lyricsLanguage: '',
      lyricsRightsConfirmed: false,
    });
    setAudioFile(null);
    setCoverFile(null);
    setErrorMsg('');
    setUploadId(null);
    setUploadStatus('idle');
    setUploadProgress(0);
  };

  if (!authHydrated) {
    return <LoadingState type="list" count={3} />;
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-lg space-y-6 rounded-md border border-zinc-800 bg-surface-noir/50 p-6 text-center animate-fade-in">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-md border border-brand-red/30 bg-brand-red/10 text-brand-red">
          <UploadCloud size={30} />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-bold text-zinc-100">{t('empty.signInTitle')}</h2>
          <p className="text-sm leading-relaxed text-zinc-400">
            {t('empty.signInDesc')}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAuthModalOpen(true)}
          className="w-full ns-button-primary px-5 cursor-pointer"
        >
          {t('header.signIn')}
        </button>
      </div>
    );
  }

  if (!['ARTIST', 'ADMIN'].includes(user.role)) {
    return (
      <div className="mx-auto max-w-lg space-y-4 rounded-md border border-zinc-800 bg-surface-noir/50 p-6 text-center">
        <AlertCircle size={30} className="mx-auto text-amber-300" />
        <div>
          <h2 className="text-xl font-bold text-zinc-100">Creator access required</h2>
          <p className="text-sm leading-relaxed text-zinc-400 mt-2">
            Listener accounts cannot initialize uploads. Ask an administrator to enable an artist profile.
          </p>
        </div>
      </div>
    );
  }

  // Role alone (ARTIST/ADMIN) does not guarantee a working ArtistProfile —
  // strict `=== false` so a user object that doesn't carry this field yet
  // (e.g. demo/mock mode) is never incorrectly blocked here.
  if (user.canUploadTracks === false) {
    const canSelfService = user.role === 'ADMIN' && user.uploadAccessReason === 'MISSING_ARTIST_PROFILE';
    return (
      <div className="mx-auto max-w-lg space-y-4 rounded-md border border-zinc-800 bg-surface-noir/50 p-6 text-center" data-testid="artist-profile-not-ready">
        <AlertCircle size={30} className="mx-auto text-amber-300" />
        <div>
          <h2 className="text-xl font-bold text-zinc-100">
            {t('uploadForm.profileNotReadyTitle', { defaultValue: 'Artist profile not ready' })}
          </h2>
          <p className="text-sm leading-relaxed text-zinc-400 mt-2">
            {t('uploadForm.profileNotReadyMessage', {
              defaultValue: 'Your artist profile is not ready yet. Please contact an admin or complete your artist profile before uploading tracks.',
            })}
          </p>
        </div>
        {canSelfService && (
          <button
            type="button"
            onClick={handleCreateMyArtistProfile}
            disabled={profileSetupStatus === 'loading'}
            className="w-full ns-button-primary px-5 cursor-pointer disabled:opacity-50"
          >
            {profileSetupStatus === 'loading'
              ? t('uploadForm.creatingProfile', { defaultValue: 'Creating…' })
              : t('uploadForm.createMyArtistProfile', { defaultValue: 'Create my artist profile' })}
          </button>
        )}
      </div>
    );
  }

  if (uploadStatus === 'success') {
    return (
      <div className="mx-auto max-w-lg space-y-6 rounded-md border border-zinc-800 bg-surface-noir/50 p-6 text-center animate-fade-in" role="status">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-md border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
          <CheckCircle size={32} />
        </div>
        <div className="space-y-2">
          <h3 className="text-xl font-bold text-zinc-100">Ready to Publish</h3>
          <p className="text-sm text-zinc-400">
            "{title}" has been successfully uploaded and processed.
          </p>
        </div>

        {/* Uploaded Card Preview */}
        <div className="flex items-center space-x-4 rounded border border-zinc-800 bg-zinc-950/50 p-4 text-left">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded bg-zinc-800 border border-zinc-700">
            {coverFile ? (
              <img
                src={coverPreviewUrl}
                alt="preview"
                className="w-full h-full object-cover"
              />
            ) : (
              <Music className="text-zinc-600" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="text-sm font-bold text-zinc-200 truncate">{title}</h4>
            <p className="text-sm text-zinc-500">{getLocalizedGenre(genre)} • {tags || 'No tags'}</p>
          </div>
        </div>

        <div className="flex space-x-3">
          <button
            onClick={handleReset}
            className="flex-1 ns-button-secondary px-4 text-sm cursor-pointer"
          >
            Upload Another
          </button>
        </div>
      </div>
    );
  }

  if (uploadStatus !== 'idle' && uploadStatus !== 'error') {
    return (
      <div className="mx-auto max-w-lg select-none space-y-7 rounded-md border border-zinc-800 bg-surface-noir/50 p-6" aria-live="polite">
        <div className="text-center space-y-2">
          <h3 className="text-lg font-bold text-zinc-200">
            {uploadStatus === 'uploading' && 'Uploading track audio...'}
            {uploadStatus === 'processing' && 'Processing track on server...'}
          </h3>
          <p className="text-sm text-zinc-500">Do not close this page or navigate away.</p>
        </div>

        {/* Progress Display */}
        <div className="space-y-4">
          <div
            className="relative h-1.5 w-full overflow-hidden rounded-sm border border-zinc-800 bg-zinc-900"
            role="progressbar"
            aria-label="Upload progress"
            aria-valuemin="0"
            aria-valuemax="100"
            aria-valuenow={uploadStatus === 'uploading' ? uploadProgress : 100}
          >
            {uploadStatus === 'uploading' ? (
              <div
                className="absolute left-0 top-0 h-full bg-brand-red transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            ) : (
              <div className="absolute left-0 top-0 h-full w-full animate-pulse bg-brand-red" />
            )}
          </div>

          <div className="flex justify-between items-center text-sm text-zinc-400 font-semibold px-1">
            <span>
              {uploadStatus === 'uploading' && `Progress: ${uploadProgress}%`}
              {uploadStatus === 'processing' && 'Awaiting worker...'}
            </span>
            <span className="animate-pulse text-brand-red">●</span>
          </div>
        </div>

        {/* Flow list status */}
        <div className="space-y-3 pt-4 border-t border-zinc-900/60">
          <div className={`flex items-center space-x-3 text-sm ${
            uploadStatus === 'uploading' ? 'text-zinc-200 font-bold' : 'text-zinc-500'
          }`}>
            <span className={`w-2 h-2 rounded-full ${
              uploadProgress === 100 ? 'bg-emerald-400' : uploadStatus === 'uploading' ? 'bg-brand-red animate-ping' : 'bg-zinc-800'
            }`} />
            <span>1. Sending files to storage</span>
          </div>
          <div className={`flex items-center space-x-3 text-sm ${
            uploadStatus === 'processing' ? 'text-zinc-200 font-bold' : 'text-zinc-500'
          }`}>
            <span className={`w-2 h-2 rounded-full ${
              uploadStatus === 'success' ? 'bg-emerald-400' : uploadStatus === 'processing' ? 'bg-brand-red animate-ping' : 'bg-zinc-800'
            }`} />
            <span>2. Audio parsing & validation</span>
          </div>
          <div className="flex items-center space-x-3 text-sm text-zinc-500">
            <span className="w-2 h-2 rounded-full bg-zinc-800" />
            <span>3. Publish processed release</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto grid max-w-6xl gap-7 xl:grid-cols-[minmax(0,1fr)_19rem] xl:items-start" noValidate>
      <div className="min-w-0 space-y-8">
        <div className="border-b border-zinc-800/80 pb-5">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-zinc-100">
            <UploadCloud className="text-brand-red" size={19} />
            <span>{t('uploadForm.title')}</span>
          </h2>
          <p className="mt-1 text-sm text-zinc-400">{t('uploadForm.subtitle')}</p>
        </div>

        {errorMsg && (
          <div id="upload-error" className="flex items-start gap-2.5 border-l-2 border-rose-400 bg-rose-500/10 p-3.5 text-sm text-rose-200" role="alert">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <span className="font-semibold">{errorMsg}</span>
          </div>
        )}

        <section className="space-y-4" aria-labelledby="upload-assets-title">
          <div>
            <h3 id="upload-assets-title" className="text-base font-semibold text-zinc-100">{t('uploadForm.assets')}</h3>
            <p className="mt-1 text-sm text-zinc-500">{t('uploadForm.assetsHelp')}</p>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className={`group relative min-h-44 cursor-pointer rounded-md border border-dashed p-6 text-center transition-colors ${
              audioFile ? 'border-brand-red/35 bg-brand-red/5' : 'border-zinc-800 bg-zinc-950/25 hover:border-zinc-700'
            }`}>
              <input
                id="track-audio"
                type="file"
                accept=".mp3,.wav,.flac,audio/mpeg,audio/wav,audio/flac"
                onChange={(e) => setAudioFile(e.target.files[0])}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                aria-label="Select track audio file"
                aria-describedby={errorMsg ? 'upload-error' : undefined}
              />
              <div className="flex flex-col items-center justify-center space-y-3.5">
                <div className="rounded border border-zinc-800 bg-zinc-900 p-3 text-zinc-400 transition-colors group-hover:border-brand-red/35 group-hover:text-brand-red">
                  <FileAudio size={24} />
                </div>
                <div className="min-w-0 max-w-full">
                  <span className="block truncate text-sm font-bold text-zinc-200">
                    {audioFile ? audioFile.name : t('uploadForm.selectAudio')}
                  </span>
                  <span className="mt-1 block text-ns-label text-zinc-400">{t('uploadForm.audioFormats')}</span>
                  {audioFile && (
                    <span className="mt-2 block text-ns-label text-emerald-400">
                      {(audioFile.size / (1024 * 1024)).toFixed(1)} MB selected
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className={`group relative min-h-44 cursor-pointer overflow-hidden rounded-md border border-dashed p-5 text-center transition-colors ${
              coverFile ? 'border-brand-red/35 bg-brand-red/5' : 'border-zinc-800 bg-zinc-950/25 hover:border-zinc-700'
            }`}>
              <input
                id="track-artwork"
                type="file"
                accept="image/*"
                onChange={(e) => setCoverFile(e.target.files[0])}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                aria-label="Select track artwork"
                aria-describedby={errorMsg ? 'upload-error' : undefined}
              />
              <div className="flex flex-col items-center justify-center space-y-3.5">
                {coverPreviewUrl ? (
                  <img src={coverPreviewUrl} alt="Selected artwork preview" className="h-20 w-20 rounded object-cover border border-zinc-700" />
                ) : (
                  <div className="rounded border border-zinc-800 bg-zinc-900 p-3 text-zinc-400 transition-colors group-hover:border-brand-red/35 group-hover:text-brand-red">
                    <ImageIcon size={24} />
                  </div>
                )}
                <div className="min-w-0 max-w-full">
                  <span className="block truncate text-sm font-bold text-zinc-200">
                    {coverFile ? coverFile.name : t('uploadForm.selectArtwork')}
                  </span>
                  <span className="mt-1 block text-ns-label text-zinc-400">{t('uploadForm.artworkFormats')}</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-5 border-t border-zinc-800/70 pt-6" aria-labelledby="upload-details-title">
          <div>
            <h3 id="upload-details-title" className="text-base font-semibold text-zinc-100">{t('uploadForm.releaseDetails')}</h3>
            <p className="mt-1 text-sm text-zinc-500">{t('uploadForm.releaseDetailsHelp')}</p>
          </div>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="track-title" className="font-sans tabular-nums text-ns-meta font-medium uppercase tracking-ns-label text-zinc-400">{t('uploadForm.trackTitle')}</label>
              <input
                id="track-title"
                type="text"
                placeholder="e.g. Midnight Protocol"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="ns-field px-4 text-base sm:text-sm"
                aria-invalid={Boolean(errorMsg && !title.trim())}
                aria-describedby={errorMsg ? 'upload-error' : undefined}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="track-genre" className="font-sans tabular-nums text-ns-meta font-medium uppercase tracking-ns-label text-zinc-400">{t('uploadForm.primaryGenre')}</label>
              <GenrePicker
                id="track-genre"
                value={genre}
                onChange={setGenre}
                ariaLabel={t('uploadForm.primaryGenre')}
                placeholder={t('uploadForm.selectGenre')}
              />
              <p className="pt-0.5 text-ns-label leading-relaxed text-zinc-500">{t('uploadForm.genreHelper')}</p>
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="track-description" className="font-sans tabular-nums text-ns-meta font-medium uppercase tracking-ns-label text-zinc-400">{t('uploadForm.description')}</label>
            <textarea
              id="track-description"
              rows={4}
              placeholder={t('uploadForm.descriptionPlaceholder')}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="ns-field resize-none px-4 py-3 text-base sm:text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="track-tags" className="font-sans tabular-nums text-ns-meta font-medium uppercase tracking-ns-label text-zinc-400">{t('uploadForm.tags')}</label>
            <input
              id="track-tags"
              type="text"
              placeholder={t('uploadForm.tagsPlaceholder')}
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              className="ns-field px-4 text-base sm:text-sm"
            />
            <p className="pt-0.5 text-ns-label leading-relaxed text-zinc-500">{t('uploadForm.tagsHelper')}</p>
          </div>
        </section>

        <details className="border-y border-zinc-800/70 py-4">
          <summary className="cursor-pointer text-sm font-bold text-zinc-200 marker:text-brand-red">
            {t('upload.lyricsSection')}
          </summary>
          <div className="pt-5">
            <LyricsEditor
              value={lyricsForm}
              onChange={setLyricsForm}
              idPrefix="single-upload-lyrics"
            />
          </div>
        </details>
      </div>

      <aside className="space-y-5 border-t border-zinc-800/80 pt-5 xl:sticky xl:top-6 xl:border-l xl:border-t-0 xl:pl-6 xl:pt-0">
        <div>
          <p className="font-sans tabular-nums text-ns-meta font-medium uppercase tracking-ns-label text-brand-red">
            {t('uploadForm.releaseChecklist')}
          </p>
          <dl className="mt-3 divide-y divide-zinc-800/70 text-sm">
            {[
              [Boolean(audioFile), t('uploadForm.selectAudio')],
              [Boolean(coverFile), t('uploadForm.selectArtwork')],
              [Boolean(title.trim()), t('uploadForm.trackTitle')],
              [Boolean(genre), t('uploadForm.primaryGenre')],
            ].map(([ready, label]) => (
              <div key={label} className="flex items-center justify-between gap-3 py-2.5">
                <dt className="text-zinc-400">{label}</dt>
                <dd className={ready ? 'text-[var(--ns-success)]' : 'text-zinc-600'}>
                  {ready
                    ? t('batchUpload.ready')
                    : t('uploadForm.required')}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <label className="flex min-h-14 cursor-pointer select-none items-start gap-3 border-y border-zinc-800/70 py-4">
          <input
            type="checkbox"
            checked={rightsChecked}
            onChange={(e) => setRightsChecked(e.target.checked)}
            className="mt-0.5 h-5 w-5 cursor-pointer rounded accent-brand-red"
            aria-invalid={Boolean(errorMsg && !rightsChecked)}
            aria-describedby={errorMsg ? 'upload-error' : undefined}
          />
          <span className="text-sm font-medium leading-relaxed text-zinc-300">
            {t('uploadForm.rightsConfirmation')}
          </span>
        </label>

        <button
          type="submit"
          disabled={uploadMutation.isPending}
          className="ns-button-primary w-full cursor-pointer px-5 text-sm disabled:opacity-50"
        >
          {t('uploadForm.submit')}
        </button>
        <p className="text-ns-label leading-relaxed text-zinc-500">
          {t('uploadForm.processingNote')}
        </p>
      </aside>
    </form>
  );
}
