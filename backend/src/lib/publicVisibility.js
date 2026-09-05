'use strict';

const { Prisma } = require('@prisma/client');

// Public discovery does not grant an owner/admin exception. Published records
// without processed audio remain discoverable under the existing contract;
// their isStreamable=false prevents playback. Private owner detail is separate.
function publicArtistWhere() {
  return { isHidden: false, user: { status: 'ACTIVE' } };
}

function publicTrackWhere(extra = {}) {
  return { ...extra, status: 'PUBLISHED', isPublic: true, artist: publicArtistWhere() };
}

// Fixed aliases only, used by catalog SQL together with Track t, ArtistProfile a,
// and User u. No identifier or SQL fragment originates in request parameters.
function publicTrackSql() {
  return Prisma.sql`t.status = 'PUBLISHED' AND t."isPublic" = true
    AND a."isHidden" = false AND u.status = 'ACTIVE'`;
}

module.exports = { publicArtistWhere, publicTrackWhere, publicTrackSql };
