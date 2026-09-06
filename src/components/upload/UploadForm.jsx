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
import BeatMetadataFields from './BeatMetadataFields';
import ContentTypeSelector from './ContentTypeSelector';
import { beatMetadataPayload, EMPTY_BEAT_METADATA } from './beatMetadata';
import { useLandingDraftStore } from '../../store/landingDraftStore';

export default function UploadForm() {
  const { t } = useTranslation();
  const { user, authHydrated, setAuthModalOpen, fetchCurrentUser } = useUserStore();
  const addToast = useToastStore((state) => state.addToast);
  const [profileSetupStatus, setProfileSetupStatus] = useState('idle'); // idle | loading
  const [landingDraft] = useState(() => {
    const draft = useLandingDraftStore.getState().draft;
    return draft?.uploadRequested ? draft : null;
  });
  const lostLandingDraft = useLandingDraftStore((state) => state.lostDraft);
  const draftFields = landingDraft?.uploadFields;

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
  const [title, setTitle] = useState(landingDraft?.title || '');
  const [genre, setGenre] = useState(draftFields?.genre || '');
  const [description, setDescription] = useState(draftFields?.description || '');
  const [tags, setTags] = useState(draftFields?.tags || '');
  const [contentType, setContentType] = useState(landingDraft?.contentType || 'MUSIC');
  const [beatMetadata, setBeatMetadata] = useState(() => draftFields?.beatMetadata || ({ ...EMPTY_BEAT_METADATA }));
  const [rightsChecked, setRightsChecked] = useState(draftFields?.rightsChecked || false);
  const [lyricsForm, setLyricsForm] = useState(draftFields?.lyricsForm || {
    lyricsText: '',
    lyricsType: 'NONE',
    lyricsLanguage: '',
    lyricsRightsConfirmed: false,
  });
  const [audioFile, setAudioFile] = useState(landingDraft?.audioFile || null);
  const [coverFile, setCoverFile] = useState(draftFields?.coverFile || null);
  const [coverPreviewUrl, setCoverPreviewUrl] = useState('');

  const [uploadStatus, setUploadStatus] = useState('idle'); // idle | uploading | processing | generating | success | error
  const [uploadProgress, setUploadProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const [uploadId, setUploadId] = useState(null);

  const uploadMutation = useUploadTrack();

  useEffect(() => {
    if (!landingDraft || !['idle', 'error'].includes(uploadStatus)) return;
    const store = useLandingDraftStore.getState();
    if (!store.draft?.uploadRequested) return;
    store.updateDraft({ title, contentType, audioFile });
    store.saveUploadFields({ genre, description, tags, beatMetadata, rightsChecked, lyricsForm, coverFile });
  }, [landingDraft, title, contentType, audioFile, genre, description, tags, beatMetadata, rightsChecked, lyricsForm, coverFile, uploadStatus]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!audioFile) return setErrorMsg(t('uploadForm.audioRequired'));
    if (!coverFile) return setErrorMsg(t('uploadForm.artworkRequired'));
    if (!title.trim()) return setErrorMsg(t('uploadForm.titleRequired'));
    if (!genre) return setErrorMsg(t('uploadForm.genreRequired'));
    if (!rightsChecked) return setErrorMsg(t('uploadForm.rightsRequired'));
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
        contentType,
        ...beatMetadataPayload(contentType, beatMetadata),
        audioFile,
        coverFile,
        copyrightConfirmed: rightsChecked,
        ...lyricsForm,
      });
      if (landingDraft) useLandingDraftStore.getState().clearDraft();
      
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
        : (err.message || t('uploadForm.uploadFailed')));
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
          setErrorMsg(res.error || t('uploadForm.processingFailed'));
          setUploadStatus('error');
          clearInterval(poller);
        }
      } catch (err) {
        setErrorMsg(err.message || t('uploadForm.statusFailed'));
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
  }, [uploadStatus, uploadId, t]);

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
    if (landingDraft) useLandingDraftStore.getState().clearDraft();
    setTitle('');
    setGenre('');
    setDescription('');
    setTags('');
    setContentType('MUSIC');
    setBeatMetadata({ ...EMPTY_BEAT_METADATA });
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
          {landingDraft && <p className="text-sm leading-relaxed text-zinc-400">{t('landing.creator.localNotice')}</p>}
          {lostLandingDraft && <p role="status" className="text-sm leading-relaxed text-zinc-400">{t('landing.creator.lostDraft')}</p>}
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
        <AlertCircle size={30} className="mx-auto text-[var(--ns-warning)]" />
        <div>
          <h2 className="text-xl font-bold text-zinc-100">{t('uploadForm.creatorAccessRequired')}</h2>
          <p className="text-sm leading-relaxed text-zinc-400 mt-2">
            {t('uploadForm.creatorAccessHelp')}
          </p>
          {landingDraft && <p className="mt-2 text-sm leading-relaxed text-zinc-400">{t('landing.creator.localNotice')}</p>}
          {lostLandingDraft && <p role="status" className="mt-2 text-sm leading-relaxed text-zinc-400">{t('landing.creator.lostDraft')}</p>}
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
        <AlertCircle size={30} className="mx-auto text-[var(--ns-warning)]" />
        <div>
          <h2 className="text-xl font-bold text-zinc-100">
            {t('uploadForm.profileNotReadyTitle', { defaultValue: 'Artist profile not ready' })}
          </h2>
          <p className="text-sm leading-relaxed text-zinc-400 mt-2">
            {t('uploadForm.profileNotReadyMessage', {
              defaultValue: 'Your artist profile is not ready yet. Please contact an admin or complete your artist profile before uploading tracks.',
            })}
          </p>
          {landingDraft && <p className="mt-2 text-sm leading-relaxed text-zinc-400">{t('landing.creator.localNotice')}</p>}
          {lostLandingDraft && <p role="status" className="mt-2 text-sm leading-relaxed text-zinc-400">{t('landing.creator.lostDraft')}</p>}
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
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-md border border-emerald-500/30 bg-emerald-500/10 text-[var(--ns-success)]">
          <CheckCircle size={32} />
        </div>
        <div className="space-y-2">
          <h3 className="text-xl font-bold text-zinc-100">{t('uploadForm.readyToPublish')}</h3>
          <p className="text-sm text-zinc-400">
            {t('uploadForm.uploadSuccess', { title })}
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
            <h4 title={title} className="text-sm font-bold text-zinc-200 truncate">{title}</h4>
            <p className="break-words [overflow-wrap:anywhere] text-sm text-zinc-500">{getLocalizedGenre(genre)} • {tags || t('uploadForm.noTags')}</p>
            <span className="mt-1 inline-flex rounded border border-zinc-700 px-1.5 py-0.5 font-sans tabular-nums text-ns-meta font-medium uppercase tracking-ns-label text-zinc-400">
              {contentType === 'BEAT' ? t('content.beats') : t('content.music')}
            </span>
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
            {uploadStatus === 'uploading' && t('uploadForm.uploadingAudio')}
            {uploadStatus === 'processing' && t('uploadForm.processingAudio')}
          </h3>
          <p className="text-sm text-zinc-500">{t('uploadForm.keepPageOpen')}</p>
        </div>

        {/* Progress Display */}
        <div className="space-y-4">
          <div
            className="relative h-1.5 w-full overflow-hidden rounded-sm border border-zinc-800 bg-zinc-900"
            role="progressbar"
            aria-label={t('uploadForm.uploadProgress')}
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
              {uploadStatus === 'uploading' && t('uploadForm.progressPercent', { progress: uploadProgress })}
              {uploadStatus === 'processing' && t('uploadForm.awaitingWorker')}
            </span>
          </div>
        </div>

        {/* Flow list status */}
        <div className="space-y-3 pt-4 border-t border-zinc-900/60">
          <div className={`flex items-center space-x-3 text-sm ${
            uploadStatus === 'uploading' ? 'text-zinc-200 font-bold' : 'text-zinc-500'
          }`}>
            <span className={`w-2 h-2 rounded-full ${
              uploadProgress === 100 ? 'bg-emerald-400' : uploadStatus === 'uploading' ? 'bg-brand-red' : 'bg-zinc-800'
            }`} />
            <span>1. {t('uploadForm.sendingFiles')}</span>
          </div>
          <div className={`flex items-center space-x-3 text-sm ${
            uploadStatus === 'processing' ? 'text-zinc-200 font-bold' : 'text-zinc-500'
          }`}>
            <span className={`w-2 h-2 rounded-full ${
              uploadStatus === 'success' ? 'bg-emerald-400' : uploadStatus === 'processing' ? 'bg-brand-red' : 'bg-zinc-800'
            }`} />
            <span>2. {t('uploadForm.validatingAudio')}</span>
          </div>
          <div className="flex items-center space-x-3 text-sm text-zinc-500">
            <span className="w-2 h-2 rounded-full bg-zinc-800" />
            <span>3. {t('uploadForm.publishRelease')}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto grid max-w-6xl gap-7 xl:grid-cols-[minmax(0,1fr)_19rem] xl:items-start" noValidate>
      <div className="min-w-0 space-y-8">
        {landingDraft && (
          <div className="space-y-2 border-l-2 border-zinc-600 pl-4 text-sm leading-relaxed text-zinc-400" role="status">
            <p>{t('landing.creator.uploadDraftNotice')}</p>
            {landingDraft.artistCredit && <p>{t('landing.creator.uploadCreditNotice', { credit: landingDraft.artistCredit })}</p>}
          </div>
        )}
        {lostLandingDraft && <p role="status" className="text-sm leading-relaxed text-zinc-400">{t('landing.creator.lostDraft')}</p>}
        {errorMsg && (
          <div id="upload-error" className="flex items-start gap-2.5 border-l-2 border-[var(--ns-danger)] bg-[color-mix(in_srgb,var(--ns-danger)_10%,transparent)] p-3.5 text-sm text-[var(--ns-danger)]" role="alert">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <span className="font-semibold">{errorMsg}</span>
          </div>
        )}

        <section aria-label={t('content.uploadAs')}>
          <ContentTypeSelector value={contentType} onChange={setContentType} idPrefix="single-upload-content-type" />
        </section>

        <section className="space-y-4" aria-labelledby="upload-assets-title">
          <div>
            <h2 id="upload-assets-title" className="text-base font-semibold text-zinc-100">{t('uploadForm.assets')}</h2>
            <p className="mt-1 text-sm text-zinc-500">{t('uploadForm.assetsHelp')}</p>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className={`group relative min-h-44 cursor-pointer focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--ns-accent)] rounded-md border border-dashed p-6 text-center transition-colors ${
              audioFile ? 'border-brand-red/35 bg-brand-red/5' : 'border-zinc-800 bg-zinc-950/25 hover:border-zinc-700'
            }`}>
              <input
                id="track-audio"
                type="file"
                accept=".mp3,.wav,.flac,audio/mpeg,audio/wav,audio/flac"
                onChange={(e) => setAudioFile(e.target.files[0])}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                aria-label={t('uploadForm.audioFileLabel')}
                aria-describedby={errorMsg ? 'upload-error' : undefined}
              />
              <div className="flex flex-col items-center justify-center space-y-3.5">
                <div className="rounded border border-zinc-800 bg-zinc-900 p-3 text-zinc-400 transition-colors group-hover:border-brand-red/35 group-hover:text-brand-red">
                  <FileAudio size={24} />
                </div>
                <div className="min-w-0 max-w-full">
                  <span title={audioFile?.name} className="block truncate text-sm font-bold text-zinc-200">
                    {audioFile ? audioFile.name : t('uploadForm.selectAudio')}
                  </span>
                  <span className="mt-1 block text-ns-label text-zinc-400">{t('uploadForm.audioFormats')}</span>
                  {audioFile && (
                    <span className="mt-2 block text-ns-label text-[var(--ns-success)]">
                      {t('uploadForm.selectedMegabytes', { size: (audioFile.size / (1024 * 1024)).toFixed(1) })}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className={`group relative min-h-44 cursor-pointer focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--ns-accent)] overflow-hidden rounded-md border border-dashed p-5 text-center transition-colors ${
              coverFile ? 'border-brand-red/35 bg-brand-red/5' : 'border-zinc-800 bg-zinc-950/25 hover:border-zinc-700'
            }`}>
              <input
                id="track-artwork"
                type="file"
                accept="image/*"
                onChange={(e) => setCoverFile(e.target.files[0])}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                aria-label={t('uploadForm.artworkFileLabel')}
                aria-describedby={errorMsg ? 'upload-error' : undefined}
              />
              <div className="flex flex-col items-center justify-center space-y-3.5">
                {coverPreviewUrl ? (
                  <img src={coverPreviewUrl} alt={t('uploadForm.artworkPreview')} className="h-20 w-20 rounded object-cover border border-zinc-700" />
                ) : (
                  <div className="rounded border border-zinc-800 bg-zinc-900 p-3 text-zinc-400 transition-colors group-hover:border-brand-red/35 group-hover:text-brand-red">
                    <ImageIcon size={24} />
                  </div>
                )}
                <div className="min-w-0 max-w-full">
                  <span title={coverFile?.name} className="block truncate text-sm font-bold text-zinc-200">
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
            <h2 id="upload-details-title" className="text-base font-semibold text-zinc-100">{t('uploadForm.releaseDetails')}</h2>
            <p className="mt-1 text-sm text-zinc-500">{t('uploadForm.releaseDetailsHelp')}</p>
          </div>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="track-title" className="font-sans tabular-nums text-ns-meta font-medium uppercase tracking-ns-label text-zinc-400">{t('uploadForm.trackTitle')}</label>
              <input
                id="track-title"
                type="text"
                placeholder={t('uploadForm.titlePlaceholder')}
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

        {contentType === 'BEAT' && (
          <BeatMetadataFields
            value={beatMetadata}
            onChange={setBeatMetadata}
            idPrefix="single-upload-beat"
          />
        )}

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
