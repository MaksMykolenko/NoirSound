import { create } from 'zustand';

// Only a loss notice survives a full navigation. Audio, names and all form
// contents stay in this tab's memory; nothing is serialized or uploaded here.
export const LANDING_DRAFT_MARKER = 'noirsound:landing-draft-present';

export function hasLostLandingDraft() {
  try {
    return sessionStorage.getItem(LANDING_DRAFT_MARKER) === '1';
  } catch {
    return false;
  }
}

function markDraft(present) {
  try {
    if (present) sessionStorage.setItem(LANDING_DRAFT_MARKER, '1');
    else sessionStorage.removeItem(LANDING_DRAFT_MARKER);
  } catch {
    // Private browsing and unavailable storage must not break the editor.
  }
}

const emptyDraft = () => ({
  title: '',
  artistCredit: '',
  contentType: 'MUSIC',
  audioFile: null,
  uploadRequested: false,
  uploadFields: {},
});

export const useLandingDraftStore = create((set) => ({
  draft: null,
  lostDraft: hasLostLandingDraft(),
  updateDraft: (patch) => {
    markDraft(true);
    set(({ draft }) => {
      const next = { ...(draft || emptyDraft()) };
      if (typeof patch.title === 'string') next.title = patch.title.slice(0, 150);
      if (typeof patch.artistCredit === 'string') next.artistCredit = patch.artistCredit.slice(0, 60);
      if (patch.contentType === 'MUSIC' || patch.contentType === 'BEAT') next.contentType = patch.contentType;
      if (patch.audioFile === null || (typeof File !== 'undefined' && patch.audioFile instanceof File)) {
        next.audioFile = patch.audioFile;
      }
      return { draft: next, lostDraft: false };
    });
  },
  requestUpload: () => {
    markDraft(true);
    set(({ draft }) => ({ draft: { ...(draft || emptyDraft()), uploadRequested: true } }));
  },
  saveUploadFields: (fields) => set(({ draft }) => {
    if (!draft?.uploadRequested) return {};
    // These are existing form inputs only. In particular, owner/artist IDs,
    // roles and profile data cannot enter the upload handoff.
    const uploadFields = {};
    for (const key of ['genre', 'description', 'tags', 'beatMetadata', 'rightsChecked', 'lyricsForm', 'coverFile']) {
      if (Object.hasOwn(fields, key)) uploadFields[key] = fields[key];
    }
    return { draft: { ...draft, uploadFields } };
  }),
  clearDraft: () => {
    markDraft(false);
    set({ draft: null, lostDraft: false });
  },
}));
