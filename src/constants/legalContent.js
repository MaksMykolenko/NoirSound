// Practical MVP legal/policy copy for the NoirSound public beta.
// NOTE: This is plain-language policy text for a beta, NOT legal advice.
// Consult a qualified lawyer before a full commercial launch.

const LAST_UPDATED = 'June 28, 2026';
const CONTACT = 'support@noirsound.app';
const COPYRIGHT_CONTACT = 'copyright@noirsound.app';

export const LEGAL_DISCLAIMER =
  'This document is provided for the NoirSound public beta and is not legal advice. ' +
  'Consult a qualified lawyer before relying on it for a commercial launch.';

export const LEGAL_DOCS = {
  terms: {
    title: 'Terms of Service',
    updated: LAST_UPDATED,
    intro:
      'Welcome to NoirSound, an independent platform for creators to share original music. ' +
      'By creating an account or using NoirSound you agree to these terms.',
    sections: [
      {
        heading: '1. Who can use NoirSound',
        body: [
          'You must be at least 16 years old (or the age of digital consent in your country) to use NoirSound.',
          'You are responsible for your account, your credentials, and all activity that happens under it.'
        ]
      },
      {
        heading: '2. Your content',
        body: [
          'You keep ownership of the music and other content you upload.',
          'You grant NoirSound a limited licence to store, process (for example transcoding and waveform generation), and stream your content so the service can function.',
          'You may remove your content at any time, after which we stop streaming it within a reasonable period.'
        ]
      },
      {
        heading: '3. Rules you agree to follow',
        body: [
          'Only upload music you created or have permission to distribute.',
          'Do not upload illegal content, malware, or content that infringes someone else’s rights.',
          'Do not abuse, harass, or attempt to deceive other users, and do not try to inflate play counts or game the platform.'
        ]
      },
      {
        heading: '4. Moderation and enforcement',
        body: [
          'NoirSound may remove or hide content, and may suspend or ban accounts, that violate these terms or our Community Guidelines.',
          'We operate a repeat-infringer policy and may permanently disable accounts that repeatedly infringe copyright.'
        ]
      },
      {
        heading: '5. Beta service, as-is',
        body: [
          'NoirSound is in public beta. Features may change and downtime can occur.',
          'The service is provided “as is” without warranties. To the extent permitted by law, NoirSound is not liable for indirect or consequential damages.'
        ]
      },
      {
        heading: '6. Contact',
        body: [`Questions about these terms: ${CONTACT}.`]
      }
    ]
  },

  privacy: {
    title: 'Privacy Policy',
    updated: LAST_UPDATED,
    intro: 'This policy explains what data NoirSound collects and how we use it.',
    sections: [
      {
        heading: 'What we collect',
        body: [
          'Account data: email, username, display name, and an irreversibly hashed password when you use password sign-in.',
          'When you sign in with Google, Google provides your verified email, display name, profile image, and a provider account identifier. NoirSound does not receive your Google password.',
          'Content data: tracks, cover images, descriptions, tags, comments, and playlists you create.',
          'Usage data: play events and listening statistics used to power your dashboard and basic analytics.'
        ]
      },
      {
        heading: 'How we use it',
        body: [
          'To operate the service: authentication, streaming, search, and your personal library and stats.',
          'To keep the platform safe: rate limiting, abuse prevention, and moderation.',
          'We do not sell your personal data, and NoirSound does not run third-party advertising.'
        ]
      },
      {
        heading: 'Cookies and sessions',
        body: [
          'We use an HttpOnly session cookie to keep you signed in. Google sign-in also uses short-lived, signed security cookies for state, nonce, and PKCE validation. These cookies are not used for cross-site tracking.'
        ]
      },
      {
        heading: 'Your choices',
        body: [
          'You can edit your profile, remove your content, or request account deletion at any time.',
          `For data requests, contact ${CONTACT}.`
        ]
      }
    ]
  },

  guidelines: {
    title: 'Community Guidelines',
    updated: LAST_UPDATED,
    intro: 'NoirSound is a creator-first community. These guidelines keep it that way.',
    sections: [
      {
        heading: 'Be original',
        body: ['Share music you made or have the rights to. Credit collaborators and samples where required.']
      },
      {
        heading: 'Be respectful',
        body: [
          'No harassment, hate speech, threats, or targeted abuse.',
          'No spam, scams, or attempts to manipulate plays, likes, or rankings.'
        ]
      },
      {
        heading: 'Keep it lawful and safe',
        body: [
          'No content that is illegal, sexually exploitative of minors, or that promotes serious harm.',
          'Mark mature content appropriately where the platform supports it.'
        ]
      },
      {
        heading: 'Reporting',
        body: [
          'If you see something that breaks these rules, use the Report option on the track, comment, or profile.',
          'Our moderators review reports and may hide content or suspend accounts.'
        ]
      }
    ]
  },

  copyright: {
    title: 'Copyright Policy',
    updated: LAST_UPDATED,
    intro:
      'NoirSound respects intellectual property and expects its users to do the same.',
    sections: [
      {
        heading: 'Upload only what you own',
        body: [
          'When you upload, you must confirm that you own the rights to the audio or have explicit permission to distribute it.',
          'Uploading copyrighted material without rights is prohibited and may result in removal and account action.'
        ]
      },
      {
        heading: 'Repeat infringers',
        body: [
          'NoirSound maintains a repeat-infringer policy. Accounts that repeatedly upload infringing content will be suspended or permanently banned.'
        ]
      },
      {
        heading: 'How we respond',
        body: [
          'On a valid copyright report or takedown notice we may hide or remove the content and notify the uploader.',
          `To report infringement, see our DMCA / Takedown policy or email ${COPYRIGHT_CONTACT}.`
        ]
      }
    ]
  },

  dmca: {
    title: 'DMCA / Takedown Policy',
    updated: LAST_UPDATED,
    intro:
      'If you believe content on NoirSound infringes your copyright, you can request a takedown.',
    sections: [
      {
        heading: 'What to include in a notice',
        body: [
          'Identify the copyrighted work and the specific NoirSound track or URL you believe infringes it.',
          'Provide your contact information.',
          'Include a statement that you have a good-faith belief the use is not authorized, and that the information in your notice is accurate.',
          'Include your physical or electronic signature.'
        ]
      },
      {
        heading: 'Where to send it',
        body: [`Send takedown notices to ${COPYRIGHT_CONTACT}. We aim to review valid notices promptly.`]
      },
      {
        heading: 'Counter-notices',
        body: [
          'If your content was removed and you believe this was a mistake, you may submit a counter-notice with your contact details and a statement of good-faith belief.'
        ]
      }
    ]
  },

  abuse: {
    title: 'Abuse / Report Content',
    updated: LAST_UPDATED,
    intro:
      'Use the Report option throughout NoirSound to flag tracks, comments, or profiles that break our rules.',
    sections: [
      {
        heading: 'How reporting works',
        body: [
          'Choose a reason (copyright, spam, harassment, hate, NSFW, or other) and add optional details.',
          'Reports go to our moderation queue. We may hide content or suspend accounts based on review.'
        ]
      },
      {
        heading: 'Urgent safety issues',
        body: [
          `For urgent safety concerns, email ${CONTACT}. For copyright specifically, see the DMCA / Takedown policy.`
        ]
      }
    ]
  },

  'creator-rules': {
    title: 'Creator Upload Rules',
    updated: LAST_UPDATED,
    intro: 'A quick checklist before you publish on NoirSound.',
    sections: [
      {
        heading: 'Rights',
        body: [
          'You own the track or have explicit permission to distribute it, including any samples.',
          'You confirm rights at upload — this confirmation is required and recorded.'
        ]
      },
      {
        heading: 'Files',
        body: [
          'Supported audio: MP3, WAV, FLAC, AAC, OGG (up to 50 MB).',
          'Cover images: JPEG, PNG, or WebP (up to 5 MB).',
          'Files are validated and transcoded before they go live; corrupt or non-audio files are rejected.'
        ]
      },
      {
        heading: 'Metadata',
        body: [
          'Use accurate titles, a supported genre, and relevant tags (max 20).',
          'No misleading metadata or keyword stuffing.'
        ]
      },
      {
        heading: 'Consequences',
        body: [
          'Content that breaks these rules can be hidden or removed, and repeat issues can lead to suspension.'
        ]
      }
    ]
  }
};

export const LEGAL_NAV = [
  { slug: 'terms', path: '/terms', label: 'Terms' },
  { slug: 'privacy', path: '/privacy', label: 'Privacy' },
  { slug: 'guidelines', path: '/guidelines', label: 'Guidelines' },
  { slug: 'copyright', path: '/copyright', label: 'Copyright' },
  { slug: 'dmca', path: '/dmca', label: 'DMCA' },
  { slug: 'abuse', path: '/abuse', label: 'Report' },
  { slug: 'creator-rules', path: '/creator-rules', label: 'Creator Rules' }
];
