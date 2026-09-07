'use strict';

const { summarizeArtistAccess } = require('./artistAccess');

// Explicit DTOs also protect callers whose database/mock returns extra columns.
const SELF_FIELDS = ['id', 'creatorType', 'intendsMusic', 'intendsBeats', 'displayName',
  'portfolioUrl', 'primaryPlatformUrl', 'note', 'createdAt', 'updatedAt'];
const ADMIN_FIELDS = [...SELF_FIELDS, 'userId', 'status', 'adminNote', 'reviewedAt', 'enabledAt'];
const USER_FIELDS = ['id', 'username', 'displayName', 'role', 'status', 'joinedAt'];
const selectFields = (fields) => Object.fromEntries(fields.map((key) => [key, true]));
const pick = (value, fields) => Object.fromEntries(fields.filter((key) => value[key] !== undefined).map((key) => [key, value[key]]));

function creatorSelfView(registration) {
  return registration ? pick(registration, SELF_FIELDS) : null;
}

function creatorAdminSelect({ includePii = false } = {}) {
  return {
    ...selectFields(ADMIN_FIELDS),
    user: { select: { ...selectFields(USER_FIELDS), ...(includePii ? { email: true } : {}),
      artistProfile: { select: { id: true, isHidden: true } } } }
  };
}

function creatorAdminView(registration, { includePii = false } = {}) {
  if (!registration) return null;
  const view = pick(registration, ADMIN_FIELDS);
  if (registration.user) {
    view.user = pick(registration.user, [...USER_FIELDS, ...(includePii ? ['email'] : [])]);
    view.user.artistProfile = registration.user.artistProfile
      ? pick(registration.user.artistProfile, ['id', 'isHidden']) : null;
    view.userAccess = summarizeArtistAccess(view.user);
  }
  return view;
}

function creatorSearchConditions(query, { includePii = false } = {}) {
  const contains = { contains: query, mode: 'insensitive' };
  return [
    { displayName: contains },
    { user: { username: contains } },
    { user: { displayName: contains } },
    ...(includePii ? [{ user: { email: contains } }] : [])
  ];
}

module.exports = { creatorSelfView, creatorAdminView, creatorAdminSelect, creatorSearchConditions,
  CREATOR_SELF_SELECT: Object.freeze(selectFields(SELF_FIELDS)) };
