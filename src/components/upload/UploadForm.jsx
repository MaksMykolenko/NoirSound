import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { UploadCloud, CheckCircle, FileAudio, Image as ImageIcon, Music, AlertCircle } from 'lucide-react';
import { useUploadTrack, pollUploadStatus } from '../../hooks/mutations/useUploadTrack';
import { useUserStore } from '../../store/userStore';
import { useToastStore } from '../../store/toastStore';
import { ensureMyArtistProfile, onboardCreator } from '../../api/user';
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
  const errorRef = useRef(null);
  const [creatorName, setCreatorName] = useState(user?.displayName === 'Listener' ? '' : user?.displayName || '');
  const [trackId, setTrackId] = useState(null);
  const [audioPreviewUrl, setAudioPreviewUrl] = useState('');
  const [optionalOpen, setOptionalOpen] = useState(false);
  const [beatOpen, setBeatOpen] = useState(false);
  const [lyricsOpen, setLyricsOpen] = useState(false);
  const [statusCheckFailed, setStatusCheckFailed] = useState(false);
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
  const onPublished = uploadMutation.onPublished;

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
    if (!title.trim() || title.trim().length > 150) return setErrorMsg(t('start.titleHelp'));
    if (!genre) return setErrorMsg(t('uploadForm.genreRequired'));
    if (contentType === 'BEAT' && beatMetadata.beatBpm !== '' && (!Number.isInteger(Number(beatMetadata.beatBpm)) || Number(beatMetadata.beatBpm) < 40 || Number(beatMetadata.beatBpm) > 240)) {
      setBeatOpen(true);
      return setErrorMsg(t('start.bpmError'));
    }
    if (tags.split(',').map((tag) => tag.trim()).filter(Boolean).some((tag) => tag.length > 30) || tags.split(',').filter((tag) => tag.trim()).length > 20) {
      setOptionalOpen(true);
      return setErrorMsg(t('start.tagsError'));
    }
    if (!rightsChecked) return setErrorMsg(t('uploadForm.rightsRequired'));
    if (lyricsCounts(lyricsForm.lyricsText).lines > MAX_LYRICS_LINES) {
      setLyricsOpen(true);
      return setErrorMsg(t('lyrics.tooLong'));
    }
    if (lyricsForm.lyricsText.trim() && !lyricsForm.lyricsRightsConfirmed) {
      setLyricsOpen(true);
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
      setTrackId(res.trackId);
      setStatusCheckFailed(false);
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
    let cancelled = false;
    
    const checkStatus = async () => {
      if (!uploadId) return;
      try {
        const res = await pollUploadStatus(uploadId);
        if (cancelled) return;
        if (res.status === 'READY') {
          setUploadStatus('success');
          onPublished?.();
        } else if (res.status === 'FAILED') {
          setErrorMsg(res.error || t('uploadForm.processingFailed'));
          setUploadStatus('error');
        } else {
          poller = setTimeout(checkStatus, 3000);
        }
      } catch (err) {
        if (cancelled) return;
        setErrorMsg(err.message || t('uploadForm.statusFailed'));
        setStatusCheckFailed(true);
        setUploadStatus('error');
      }
    };

    if (uploadStatus === 'processing') {
      checkStatus(); // Initial check
    }

    return () => {
      cancelled = true;
      if (poller) clearTimeout(poller);
    };
  }, [uploadStatus, uploadId, t, onPublished]);

  useEffect(() => {
    if (!coverFile) {
      setCoverPreviewUrl('');
      return undefined;
    }
    const previewUrl = URL.createObjectURL(coverFile);
    setCoverPreviewUrl(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [coverFile]);

  useEffect(() => {
    if (!audioFile) { setAudioPreviewUrl(''); return undefined; }
    const url = URL.createObjectURL(audioFile);
    setAudioPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [audioFile]);

  useEffect(() => { if (errorMsg) errorRef.current?.focus(); }, [errorMsg]);

  const chooseAudio = (file) => {
    if (!file) return;
    if (!['audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/flac', 'audio/aac', 'audio/ogg'].includes(file.type) || !file.size || file.size > 50 * 1024 * 1024) {
      setErrorMsg(t('start.audioError')); return;
    }
    setAudioFile(file);
    setTitle((value) => value.trim() ? value : file.name.replace(/\.[^.]+$/, '').replace(/_/g, ' ').slice(0, 150));
    setErrorMsg('');
  };
  const chooseCover = (file) => {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || !file.size || file.size > 5 * 1024 * 1024) {
      setErrorMsg(t('start.coverError')); return;
    }
    setCoverFile(file); setErrorMsg('');
  };
  const requestPublishing = async (event) => {
    event.preventDefault();
    if (!creatorName.trim() || profileSetupStatus === 'loading') return;
    setProfileSetupStatus('loading'); setErrorMsg('');
    try {
      await onboardCreator({ displayName: creatorName.trim(), creatorType: 'BOTH', intendsMusic: true, intendsBeats: true });
      await fetchCurrentUser();
      addToast(t('start.creatorRequestSent'), 'success');
    } catch (error) { setErrorMsg(error.message); }
    finally { setProfileSetupStatus('idle'); }
  };

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
    setTrackId(null);
    setStatusCheckFailed(false);
    setOptionalOpen(false);
    setBeatOpen(false);
    setLyricsOpen(false);
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
          <h2 className="text-xl font-bold text-zinc-100">{t('start.uploadSignInTitle')}</h2>
          <p className="text-sm leading-relaxed text-zinc-400">
            {t('start.uploadSignInDescription')}
          </p>
          {landingDraft && <p className="text-sm leading-relaxed text-zinc-400">{t('landing.creator.localNotice')}</p>}
          {lostLandingDraft && <p role="status" className="text-sm leading-relaxed text-zinc-400">{t('landing.creator.lostDraft')}</p>}
        </div>
        <button
          type="button"
          onClick={() => setAuthModalOpen(true, 'register')}
          className="w-full ns-button-primary px-5 cursor-pointer"
        >
          {t('auth.createAccount')}
        </button>
        <button type="button" className="min-h-11 text-sm underline text-zinc-300" onClick={() => setAuthModalOpen(true, 'login')}>{t('auth.haveAccount')} {t('header.signIn')}</button>
      </div>
    );
  }

  if (!['ARTIST', 'ADMIN'].includes(user.role)) {
    const pending = Boolean(user.creatorRegistration);
    return <div className="mx-auto max-w-lg space-y-5 rounded-lg border border-zinc-800 p-6">
      <h2 className="text-xl font-bold text-zinc-100">{t(pending ? 'start.requestPendingTitle' : 'start.requestTitle')}</h2>
      <p className="text-sm leading-relaxed text-zinc-300">{t(pending ? 'start.creatorPending' : 'start.creatorAccessDescription')}</p>
      {pending ? <button type="button" className="ns-button-secondary px-4" disabled={profileSetupStatus === 'loading'} onClick={async () => {
        setProfileSetupStatus('loading');
        try { await fetchCurrentUser(); } catch (error) { setErrorMsg(error.message); }
        finally { setProfileSetupStatus('idle'); }
      }}>{t('start.refreshAccess')}</button> : <form onSubmit={requestPublishing} className="space-y-4">
        <label className="block space-y-2"><span className="text-sm font-medium text-zinc-200">{t('start.artistName')}</span>
          <input required maxLength={120} className="ns-field px-4" value={creatorName} onChange={(event) => setCreatorName(event.target.value)} autoComplete="nickname" />
        </label>
        <p className="text-sm text-zinc-400">{t('start.artistNameHelp')}</p>
        <button type="submit" disabled={profileSetupStatus === 'loading'} className="ns-button-primary w-full px-4 disabled:opacity-50">{t('start.requestAccess')}</button>
      </form>}
      {errorMsg && <p ref={errorRef} tabIndex={-1} role="alert" className="text-sm text-[var(--ns-danger)]">{errorMsg}</p>}
      {landingDraft && <p className="text-sm text-zinc-400">{t('landing.creator.localNotice')}</p>}
    </div>;
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
          <h3 className="text-xl font-bold text-zinc-100">{t('start.published')}</h3>
          <p className="text-sm text-zinc-400">
            {t('start.publishSuccess', { title })}
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

        <div className="flex flex-wrap gap-3">
          {trackId && <a href={`/track/${trackId}`} className="ns-button-primary flex-1 px-4 text-sm">{t('start.openRelease')}</a>}
          <button
            onClick={handleReset}
            className="flex-1 ns-button-secondary px-4 text-sm cursor-pointer"
          >
            {t('start.uploadAnother')}
          </button>
        </div>
      </div>
    );
  }

  if (statusCheckFailed) return <div className="mx-auto max-w-lg space-y-4 p-6" role="alert">
    <h2 className="text-xl font-bold text-zinc-100">{t('start.checkStatusTitle')}</h2>
    <p className="text-sm text-zinc-300">{t('start.checkStatusHelp')}</p>
    <p className="text-sm text-zinc-400">{errorMsg}</p>
    <button type="button" className="ns-button-primary px-4" onClick={() => { setStatusCheckFailed(false); setErrorMsg(''); setUploadStatus('processing'); }}>{t('actions.retry')}</button>
  </div>;

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
          >
            {uploadStatus === 'uploading' ? (
              <div
                className="absolute left-0 top-0 h-full w-full animate-pulse bg-brand-red"
              />
            ) : (
              <div className="absolute left-0 top-0 h-full w-full animate-pulse bg-brand-red" />
            )}
          </div>

          <div className="flex justify-between items-center text-sm text-zinc-400 font-semibold px-1">
            <span>
              {uploadStatus === 'uploading' && t('uploadForm.sendingFiles')}
              {uploadStatus === 'processing' && t('start.processingAudio')}
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
    <form onSubmit={handleSubmit} className="mx-auto max-w-3xl space-y-6" noValidate>
      <div className="min-w-0 space-y-8">
        {landingDraft && (
          <div className="space-y-2 border-l-2 border-zinc-600 pl-4 text-sm leading-relaxed text-zinc-400" role="status">
            <p>{t('landing.creator.uploadDraftNotice')}</p>
            {landingDraft.artistCredit && <p>{t('landing.creator.uploadCreditNotice', { credit: landingDraft.artistCredit })}</p>}
          </div>
        )}
        {lostLandingDraft && <p role="status" className="text-sm leading-relaxed text-zinc-400">{t('landing.creator.lostDraft')}</p>}
        {errorMsg && (
          <div ref={errorRef} tabIndex={-1} id="upload-error" className="flex items-start gap-2.5 border-l-2 border-[var(--ns-danger)] bg-[color-mix(in_srgb,var(--ns-danger)_10%,transparent)] p-3.5 text-sm text-[var(--ns-danger)]" role="alert">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <span className="font-semibold">{errorMsg}</span>
          </div>
        )}

        <p className="text-sm text-zinc-300">{t('start.publishingAs', { name: user.displayName || user.username })}</p>
        <section aria-label={t('content.uploadAs')}>
          <ContentTypeSelector value={contentType} onChange={setContentType} idPrefix="single-upload-content-type" />
        </section>

        <section className="space-y-4" aria-labelledby="upload-assets-title">
          <div>
            <h2 id="upload-assets-title" className="text-base font-semibold text-zinc-100">{t('start.audioStep')}</h2>
          </div>
          <div className="space-y-4">
            <div className={`group relative min-h-44 cursor-pointer focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--ns-accent)] rounded-md border border-dashed p-6 text-center transition-colors ${
              audioFile ? 'border-brand-red/35 bg-brand-red/5' : 'border-zinc-800 bg-zinc-950/25 hover:border-zinc-700'
            }`}>
              <input
                id="track-audio"
                type="file"
                accept=".mp3,.wav,.flac,.aac,.ogg,audio/mpeg,audio/wav,audio/x-wav,audio/flac,audio/aac,audio/ogg"
                onChange={(e) => { chooseAudio(e.target.files[0]); e.target.value = ''; }}
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
                  <span className="mt-1 block text-ns-label text-zinc-400">{t('start.audioFormats')}</span>
                  {audioFile && (
                    <span className="mt-2 block text-ns-label text-[var(--ns-success)]">
                      {t('uploadForm.selectedMegabytes', { size: (audioFile.size / (1024 * 1024)).toFixed(1) })}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {audioPreviewUrl && <audio controls preload="metadata" src={audioPreviewUrl} className="w-full" aria-label={t('start.audioPreview')} />}
          </div>
        </section>

        <section className="space-y-5 border-t border-zinc-800/70 pt-6" aria-labelledby="upload-details-title">
          <div>
            <h2 id="upload-details-title" className="text-base font-semibold text-zinc-100">{t('start.detailsStep')}</h2>
          </div>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="track-title" className="font-sans tabular-nums text-ns-meta font-medium uppercase tracking-ns-label text-zinc-400">{t('uploadForm.trackTitle')}</label>
              <input
                id="track-title"
                type="text"
                maxLength={150}
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

        </section>
        <details className="rounded-lg border border-zinc-800 p-4" open={optionalOpen} onToggle={(event) => setOptionalOpen(event.currentTarget.open)}>
          <summary className="min-h-7 cursor-pointer text-sm font-semibold text-zinc-200">{t('start.optionalDetails')}</summary>
          <div className="space-y-5 pt-4">
            <p className="text-sm text-zinc-400">{t('start.coverHelp')}</p>
            <div className={`group relative min-h-44 cursor-pointer focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--ns-accent)] overflow-hidden rounded-md border border-dashed p-5 text-center transition-colors ${
              coverFile ? 'border-brand-red/35 bg-brand-red/5' : 'border-zinc-800 bg-zinc-950/25 hover:border-zinc-700'
            }`}>
              <input
                id="track-artwork"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => { chooseCover(e.target.files[0]); e.target.value = ''; }}
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
            {coverFile && <button type="button" onClick={() => setCoverFile(null)} className="min-h-11 text-sm underline text-zinc-300">{t('start.removeCover')}</button>}
          <div className="space-y-1.5">
            <label htmlFor="track-description" className="font-sans tabular-nums text-ns-meta font-medium uppercase tracking-ns-label text-zinc-400">{t('uploadForm.description')}</label>
            <textarea
              id="track-description"
              rows={3}
              maxLength={2000}
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


          </div>
        </details>
        {contentType === 'BEAT' && <details className="rounded-lg border border-zinc-800 p-4" open={beatOpen} onToggle={(event) => setBeatOpen(event.currentTarget.open)}>
          <summary className="min-h-7 cursor-pointer text-sm font-semibold text-zinc-200">{t('start.optionalBeat')}</summary>
          <BeatMetadataFields value={beatMetadata} onChange={setBeatMetadata} idPrefix="single-upload-beat" />
        </details>}

        <details className="rounded-lg border border-zinc-800 p-4" open={lyricsOpen} onToggle={(event) => setLyricsOpen(event.currentTarget.open)}>
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

      <aside className="space-y-4 border-t border-zinc-800 pt-5">
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
          {t(contentType === 'BEAT' ? 'start.publishBeat' : 'start.publishTrack')}
        </button>
        <p className="text-ns-label leading-relaxed text-zinc-500">
          {t('start.publishNote')}
        </p>
      </aside>
    </form>
  );
}
