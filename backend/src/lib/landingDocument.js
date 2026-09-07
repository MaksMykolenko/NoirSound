'use strict';

// Minimal server content for the public root. React replaces this content when
// the application mounts; no scripts, audio, catalog requests, or duplicated
// landing markup are inserted on app/detail routes. Keep these real CTA paths
// aligned with the router and the existing Discover content URL contract.
function injectLandingDocument(shell) {
  const content = `<main id="landing-initial" lang="en">
      <header><a href="/">NoirSound</a><nav aria-label="Main navigation"><a href="/discover">Listen</a> <a href="/upload">Create</a></nav></header>
      <h1>Your sound.</h1>
      <p>Not everything has to sound the same.</p>
      <p><a href="/discover?content=MUSIC">Discover music</a> <a href="/discover?content=BEAT">Discover beats</a></p>
      <h2>Your music. Your space.</h2>
      <p>Upload. Shape. Share.</p>
      <h2>Start with one track.</h2>
      <p><a href="/discover">Start listening</a> <a href="/upload">Continue to upload</a></p>
      <footer><a href="/terms">Terms</a> <a href="/privacy">Privacy</a> <a href="/abuse">Support</a></footer>
    </main>`;
  return shell.replace(/(<div\s+id=["']root["'][^>]*>)\s*(<\/div>)/i, (_match, open, close) => `${open}${content}${close}`);
}

module.exports = { injectLandingDocument };
