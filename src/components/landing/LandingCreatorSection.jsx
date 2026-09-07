import React, { useId, useState } from 'react';
import { ArrowUpRight, CheckCircle2, Sparkles, Upload } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useLandingDraftStore } from '../../store/landingDraftStore';
import { useUserStore } from '../../store/userStore';
import { BATCH_MAX_FILE_BYTES, validateSelectedFiles } from '../upload/batch/batchUploadUtils';
import LandingReleasePreview from './LandingReleasePreview';

export default function LandingCreatorSection() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { draft, lostDraft, updateDraft, requestUpload } = useLandingDraftStore();
  const user = useUserStore((s) => s.user);
  const openAuth = useUserStore((s) => s.setAuthModalOpen);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [fileError, setFileError] = useState(false);
  const [dragging, setDragging] = useState(false);
  const id = useId();
  const title = draft?.title || '';
  const artistCredit = draft?.artistCredit || '';
  const contentType = draft?.contentType || 'MUSIC';
  const audioFile = draft?.audioFile;

  const isCreatorRegistered = Boolean(user?.creatorRegistration);
  const canUploadTracks = Boolean(user?.canUploadTracks);

  function chooseFile(file) {
    if (!file) return;
    const { accepted } = validateSelectedFiles([file]);
    setFileError(accepted.length === 0);
    if (!accepted.length) return;
    updateDraft({ audioFile: file, ...(!title.trim() ? { title: file.name.replace(/\.[^.]+$/, '').slice(0, 150) } : {}) });
  }

  function continueUpload() {
    setPreviewOpen(false);
    requestUpload();
    navigate('/upload');
  }

  return (
    <section className="create-scene" id="create" aria-labelledby={`${id}-heading`}>
      <div className="create-sticky">
        <div className="scene-head"><span className="eyebrow">{t('landing.creator.sectionLabel')}</span><span className="scene-note">{t('landing.creator.sectionNote')}</span></div>
        <div className="create-grid">
          <div className="create-copy">
            <h2 id={`${id}-heading`}>{t('landing.creator.titleLine1')}<br /><span className="dim">{t('landing.creator.titleLine2')}</span></h2>
            <p className="section-copy">{t('landing.creator.introLine1')}<br />{t('landing.creator.introLine2')}</p>
            <ol className="creator-steps" aria-label={t('landing.creator.stepsLabel')}>
              {['upload', 'design', 'share'].map((step, index) => (
                <li key={step} className={index === 0 ? 'active' : undefined} data-step={index}>
                  <span>0{index + 1}</span><div><h3>{t(`landing.creator.${step}Step`)}</h3><p>{t(`landing.creator.${step}Help`)}</p></div>
                </li>
              ))}
            </ol>

            <div className="creator-cta-box">
              {isCreatorRegistered ? (
                <div className="creator-cta-content">
                  <div className="creator-cta-status">
                    <CheckCircle2 size={16} aria-hidden="true" />
                    <span>{t('landing.creator.registeredBadge') || 'Creator Profile Active'}</span>
                  </div>
                  <p className="creator-cta-text">
                    {canUploadTracks
                      ? (t('landing.creator.canUploadNotice') || 'You have upload access enabled! Open the app to publish.')
                      : (t('landing.creator.pendingNotice') || `Registered as ${user.creatorRegistration?.creatorType}. Upload tools will open when the creator rollout begins.`)}
                  </p>
                  {canUploadTracks && (
                    <button
                      type="button"
                      onClick={continueUpload}
                      className="button button-accent creator-cta-button"
                    >
                      <span>{t('landing.publish') || 'Open Studio'}</span>
                      <ArrowUpRight size={14} aria-hidden="true" />
                    </button>
                  )}
                </div>
              ) : user ? (
                <div className="creator-cta-content">
                  <p className="creator-cta-text">
                    {t('landing.creator.listenerUpgradePrompt') || 'You are registered as a Listener. Register your creator profile to get ready for publishing.'}
                  </p>
                  <button
                    type="button"
                    onClick={() => openAuth(true, 'register', 'CREATOR')}
                    className="button button-accent creator-cta-button"
                  >
                    <Sparkles size={14} aria-hidden="true" />
                    <span>{t('landing.creator.upgradeButton') || 'Register as Creator'}</span>
                  </button>
                </div>
              ) : (
                <div className="creator-cta-content">
                  <p className="creator-cta-text">
                    {t('landing.creator.joinPrompt') || 'Ready to share your music or beats with NoirSound? Register your creator account now.'}
                  </p>
                  <button
                    type="button"
                    onClick={() => openAuth(true, 'register', 'CREATOR')}
                    className="button button-accent creator-cta-button"
                  >
                    <Sparkles size={14} aria-hidden="true" />
                    <span>{t('landing.creator.registerButton') || 'Register as Creator'}</span>
                  </button>
                </div>
              )}
            </div>
          </div>
          <div className="release-editor">
            <div className="editor-top"><span className="editor-dot" aria-hidden="true" /><span>{t('landing.creator.newRelease')}</span><span className="editor-badge">{t('landing.creator.previewBadge')}</span></div>
            <div className="editor-cover">
              <img src={`/landing/${contentType === 'BEAT' ? 'b1' : 'm1'}.svg`} width="180" height="180" alt={t('landing.creator.decorativeArtwork')} loading="lazy" />
              <div className="editor-cover-copy"><span className="eyebrow">{t('landing.creator.coverEyebrow')}</span><strong>{title.trim() || t('landing.creator.defaultTitle')}</strong><span>{artistCredit.trim() || t('landing.creator.defaultArtist')}</span></div>
            </div>
            <div className="editor-fields">
              <div className="field"><label htmlFor={`${id}-title`}>{t('landing.creator.titleLabel')}</label><input id={`${id}-title`} type="text" maxLength={150} value={title} onChange={(event) => updateDraft({ title: event.target.value })} autoComplete="off" placeholder={t('landing.creator.titlePlaceholder')} /></div>
              <div className="field"><label htmlFor={`${id}-artist`}>{t('landing.creator.artistLabel')}</label><input id={`${id}-artist`} type="text" maxLength={60} value={artistCredit} onChange={(event) => updateDraft({ artistCredit: event.target.value })} autoComplete="off" placeholder={t('landing.creator.artistPlaceholder')} aria-describedby={`${id}-credit-note`} /></div>
              <p className="editor-disclaimer" id={`${id}-credit-note`}>{t('landing.creator.creditNote')}</p>
              <fieldset className="release-type">
                <legend>{t('landing.creator.typeLabel')}</legend>
                {['MUSIC', 'BEAT'].map((type) => <label key={type}><input type="radio" name={`${id}-release-type`} value={type} checked={contentType === type} onChange={() => updateDraft({ contentType: type })} /><span>{t(type === 'BEAT' ? 'landing.creator.beat' : 'landing.creator.music')}</span></label>)}
              </fieldset>
              <label
                className={`file-drop${dragging ? ' dragover' : ''}`}
                htmlFor={`${id}-audio`}
                onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={(event) => { event.preventDefault(); setDragging(false); chooseFile(event.dataTransfer.files[0]); }}
              >
                <Upload className="icon" aria-hidden="true" />
                <span>{audioFile ? audioFile.name : t('landing.creator.chooseAudio')}</span>
                <span className="file-hint">{audioFile ? t('landing.creator.fileLocal', { size: (audioFile.size / (1024 * 1024)).toFixed(1) }) : t('landing.creator.dropHint')}</span>
                <input className="visually-hidden" id={`${id}-audio`} type="file" accept=".mp3,.wav,.flac,.aac,.ogg,audio/mpeg,audio/wav,audio/x-wav,audio/flac,audio/aac,audio/ogg" aria-label={t('landing.creator.chooseAudio')} aria-describedby={`${id}-file-note`} onChange={(event) => chooseFile(event.target.files[0])} />
              </label>
              {fileError && <p className="editor-disclaimer" role="alert">{t('landing.creator.fileError', { size: BATCH_MAX_FILE_BYTES / (1024 * 1024) })}</p>}
              <button className="button button-light editor-preview-button" type="button" onClick={() => setPreviewOpen(true)}>{t('landing.creator.seePreview')} <ArrowUpRight className="icon" aria-hidden="true" /></button>
              <button className="text-link editor-continue" type="button" onClick={continueUpload}>{t('landing.creator.continueUpload')} <ArrowUpRight className="icon" aria-hidden="true" /></button>
              <p className="editor-disclaimer" id={`${id}-file-note`}>{t('landing.creator.localNotice')}</p>
              {lostDraft && <p className="editor-disclaimer" role="status">{t('landing.creator.lostDraft')}</p>}
            </div>
          </div>
        </div>
      </div>
      <LandingReleasePreview open={previewOpen} onClose={() => setPreviewOpen(false)} title={title.trim()} artistCredit={artistCredit.trim()} contentType={contentType} onContinue={continueUpload} />
    </section>
  );
}
