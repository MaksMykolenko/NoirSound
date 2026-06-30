// Explicit demo-mode data. Runtime components must access it through src/api/mock/*.

export const mockArtists = [
  {
    id: "1",
    name: "HyperDrive",
    username: "hyperdrive",
    avatarUrl: "/images/artist_avatar.png",
    bannerUrl: "linear-gradient(135deg, #180828 0%, #030008 100%)",
    bio: "Phonk producer from the dark alleys of Tokyo. Late night drifts, heavy bass, and aggressive cowbells.",
    followers: 124300,
    monthlyListeners: 852000,
    genres: ["Phonk", "Electronic"],
    socialLinks: {
      instagram: "hyperdrive_phonk",
      twitter: "hyperdrive",
      soundcloud: "hyperdrive-official"
    }
  },
  {
    id: "2",
    name: "Luna Ambient",
    username: "luna_ambient",
    avatarUrl: "/images/artist_avatar.png",
    bannerUrl: "linear-gradient(135deg, #091326 0%, #02050c 100%)",
    bio: "Crafting deep, evolving atmospheric drones and cosmic landscapes. Music to drift away into the void.",
    followers: 98000,
    monthlyListeners: 420000,
    genres: ["Ambient", "Experimental"],
    socialLinks: {
      instagram: "luna_ambient",
      twitter: "luna_ambient",
      bandcamp: "lunaambient"
    }
  },
  {
    id: "3",
    name: "Coffee & Rain",
    username: "coffeerain",
    avatarUrl: "/images/artist_avatar.png",
    bannerUrl: "linear-gradient(135deg, #271a15 0%, #090605 100%)",
    bio: "Cozy lofi hip hop beats for study, sleep, and ultimate relaxation. Coffee brewing, rain pouring, records spinning.",
    followers: 310000,
    monthlyListeners: 1450000,
    genres: ["Lo-fi"],
    socialLinks: {
      instagram: "coffeerain_lofi",
      soundcloud: "coffeerain"
    }
  },
  {
    id: "4",
    name: "K-VLT",
    username: "kvlt_music",
    avatarUrl: "/images/artist_avatar.png",
    bannerUrl: "linear-gradient(135deg, #210404 0%, #050101 100%)",
    bio: "Underground rap and hard Memphis phonk beats infused with occult atmospheres and vintage cassette tape distortion.",
    followers: 54000,
    monthlyListeners: 310000,
    genres: ["Rap", "Phonk"],
    socialLinks: {
      twitter: "kvlt_music",
      soundcloud: "kvlt"
    }
  },
  {
    id: "5",
    name: "Siren's Echo",
    username: "sirensecho",
    avatarUrl: "/images/artist_avatar.png",
    bannerUrl: "linear-gradient(135deg, #1c1d28 0%, #07070a 100%)",
    bio: "Indie experimental dream pop, combining ethereal shoegaze guitars with deep synthetic textures and haunting vocals.",
    followers: 76000,
    monthlyListeners: 290000,
    genres: ["Indie", "Experimental"],
    socialLinks: {
      instagram: "sirens_echo",
      bandcamp: "sirensecho"
    }
  },
  {
    id: "6",
    name: "Glitch Lord",
    username: "glitchlord",
    avatarUrl: "/images/artist_avatar.png",
    bannerUrl: "linear-gradient(135deg, #1a221f 0%, #060807 100%)",
    bio: "Glitch-hop, IDM, and electronic noise experiments from a modular synth enthusiast living in 2088.",
    followers: 42000,
    monthlyListeners: 190000,
    genres: ["Electronic", "Experimental"],
    socialLinks: {
      twitter: "glitchlord",
      github: "glitchlord"
    }
  }
];

export const mockTracks = [
  {
    id: "1",
    title: "Nightcrawler",
    artistId: "1",
    artistName: "HyperDrive",
    coverUrl: "/images/cover_phonk.png",
    audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
    genre: "Phonk",
    tags: ["drift", "cowbell", "heavy-bass", "late-night"],
    duration: 372,
    plays: 1420500,
    likes: 87400,
    description: "The ultimate track for late night city highway racing. Heavy cowbell, crushing 808s, and a relentless groove that keeps your heart pumping.",
    releaseDate: "2026-01-15"
  },
  {
    id: "2",
    title: "Midnight Coffee",
    artistId: "3",
    artistName: "Coffee & Rain",
    coverUrl: "/images/cover_lofi.png",
    audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
    genre: "Lo-fi",
    tags: ["chill", "rain", "cozy", "relax", "study"],
    duration: 423,
    plays: 3204900,
    likes: 198200,
    description: "Warm Rhodes piano chords over a gentle rain background. Perfect companion for late-night coding, studying, or winding down.",
    releaseDate: "2026-02-10"
  },
  {
    id: "3",
    title: "Neon Horizon",
    artistId: "6",
    artistName: "Glitch Lord",
    coverUrl: "/images/cover_electronic.png",
    audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3",
    genre: "Electronic",
    tags: ["cyberpunk", "synthwave", "modular", "driving"],
    duration: 302,
    plays: 670300,
    likes: 41200,
    description: "Cyberpunk retro-synthwave track inspired by neon-drenched megacities, driving synthesizers, and mechanical beats.",
    releaseDate: "2026-03-01"
  },
  {
    id: "4",
    title: "Deep Space Nebula",
    artistId: "2",
    artistName: "Luna Ambient",
    coverUrl: "/images/cover_ambient.png",
    audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3",
    genre: "Ambient",
    tags: ["cosmic", "drone", "space", "meditation", "dark"],
    duration: 502,
    plays: 423000,
    likes: 31000,
    description: "A deep, slowly evolving ambient drone mimicking the vast and cold beauty of outer space nebulas. Close your eyes and float.",
    releaseDate: "2025-11-20"
  },
  {
    id: "5",
    title: "Occult Shadows",
    artistId: "4",
    artistName: "K-VLT",
    coverUrl: "/images/cover_phonk.png",
    audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3",
    genre: "Rap",
    tags: ["underground", "dark-trap", "hardcore", "occult"],
    duration: 348,
    plays: 1104300,
    likes: 72000,
    description: "Grimy underground trap beat featuring distorted phonk vocals, horror movie strings, and a crushing sub bass line.",
    releaseDate: "2026-04-12"
  },
  {
    id: "6",
    title: "Ethereal Echoes",
    artistId: "5",
    artistName: "Siren's Echo",
    coverUrl: "/images/cover_ambient.png",
    audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3",
    genre: "Indie",
    tags: ["dream-pop", "shoegaze", "melancholy", "guitars"],
    duration: 480,
    plays: 890400,
    likes: 56700,
    description: "Melancholic shoegaze track featuring heavily reverbed guitars, a slow driving tempo, and whispery, ghost-like female vocals.",
    releaseDate: "2026-05-01"
  },
  {
    id: "7",
    title: "Tokyo Drift Phonk",
    artistId: "1",
    artistName: "HyperDrive",
    coverUrl: "/images/cover_phonk.png",
    audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3",
    genre: "Phonk",
    tags: ["tokyo", "drift", "jdm", "aggressive", "cowbell"],
    duration: 395,
    plays: 2450000,
    likes: 165000,
    description: "High-octane drift phonk designed for maximal adrenaline. Distorted cowbells, Memphis vocal chops, and deep slide 808s.",
    releaseDate: "2026-02-28"
  },
  {
    id: "8",
    title: "Rainy Night Cafe",
    artistId: "3",
    artistName: "Coffee & Rain",
    coverUrl: "/images/cover_lofi.png",
    audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3",
    genre: "Lo-fi",
    tags: ["relax", "lofi", "jazz", "study", "chill"],
    duration: 518,
    plays: 4120300,
    likes: 280000,
    description: "A warm cup of coffee, a window wet with rain, and smooth jazz guitar chords looping endlessly over a warm vinyl crackle.",
    releaseDate: "2025-09-15"
  },
  {
    id: "9",
    title: "Binary Pulse",
    artistId: "6",
    artistName: "Glitch Lord",
    coverUrl: "/images/cover_electronic.png",
    audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-9.mp3",
    genre: "Electronic",
    tags: ["glitch", "idm", "techno", "modular", "experimental"],
    duration: 378,
    plays: 512000,
    likes: 32000,
    description: "Intricate modular synthesizer patch creating a jittery, binary pulse that accelerates and deconstructs itself over time.",
    releaseDate: "2026-04-30"
  },
  {
    id: "10",
    title: "Abyssal Void",
    artistId: "2",
    artistName: "Luna Ambient",
    coverUrl: "/images/cover_ambient.png",
    audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-10.mp3",
    genre: "Ambient",
    tags: ["dark-ambient", "drone", "abyss", "slow", "sub-bass"],
    duration: 602,
    plays: 289000,
    likes: 19800,
    description: "A slow descent into the deepest ocean trenches. Dark, heavy, pressurizing ambient drone with sub-audible frequencies.",
    releaseDate: "2026-03-15"
  },
  {
    id: "11",
    title: "Grave Digger",
    artistId: "4",
    artistName: "K-VLT",
    coverUrl: "/images/cover_phonk.png",
    audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-11.mp3",
    genre: "Rap",
    tags: ["phonk", "horrorcore", "memphis", "vintage"],
    duration: 384,
    plays: 980400,
    likes: 58000,
    description: "Memphis-rap inspired dark trap beat featuring vintage cassette tape compression, dark analog synths, and classic drum machine programming.",
    releaseDate: "2026-05-18"
  },
  {
    id: "12",
    title: "Subliminal Waves",
    artistId: "5",
    artistName: "Siren's Echo",
    coverUrl: "/images/cover_ambient.png",
    audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-12.mp3",
    genre: "Experimental",
    tags: ["experimental", "noise", "industrial", "vocals", "avantgarde"],
    duration: 442,
    plays: 310500,
    likes: 21500,
    description: "A deconstructed experimental track mixing industrial noise gates, digital feedback loops, and delicate melodic pop vocals.",
    releaseDate: "2026-06-05"
  }
];

export const mockComments = [
  {
    id: "c1",
    trackId: "1",
    userId: "user-2",
    displayName: "Drift King",
    username: "drift_king",
    avatarUrl: "/images/artist_avatar.png",
    text: "This cowbell goes absolutely mental at 2 AM on the highway. Incredible production!",
    likes: 42,
    likedByCurrentUser: false,
    createdAt: "2 hours ago",
    replies: [
      {
        id: "r1",
        userId: "user-1",
        displayName: "Maks After Dark",
        username: "you_after_dark",
        avatarUrl: "/images/artist_avatar.png",
        text: "Exactly, that part feels cinematic.",
        likes: 8,
        likedByCurrentUser: true,
        createdAt: "1 hour ago"
      }
    ]
  },
  {
    id: "c2",
    trackId: "1",
    userId: "user-3",
    displayName: "Bass Head 99",
    username: "basshead99",
    avatarUrl: "/images/artist_avatar.png",
    text: "Cleanest mix I've heard in a long time. The 808 slides are smooth but punch right through the chest.",
    likes: 19,
    likedByCurrentUser: false,
    createdAt: "1 day ago",
    replies: []
  },
  {
    id: "c3",
    trackId: "2",
    userId: "user-4",
    displayName: "Antigravity Dev",
    username: "antigravity_dev",
    avatarUrl: "/images/artist_avatar.png",
    text: "Perfect soundtrack for coding in my dark bedroom. Keeps me focused and calm.",
    likes: 27,
    likedByCurrentUser: false,
    createdAt: "5 hours ago",
    replies: [
      {
        id: "r2",
        userId: "user-3",
        displayName: "Bass Head 99",
        username: "basshead99",
        avatarUrl: "/images/artist_avatar.png",
        text: "Same here, listening to this on repeat while refactoring.",
        likes: 4,
        likedByCurrentUser: false,
        createdAt: "3 hours ago"
      }
    ]
  },
  {
    id: "c4",
    trackId: "3",
    userId: "user-5",
    displayName: "Cyber Runner",
    username: "cyber_runner",
    avatarUrl: "/images/artist_avatar.png",
    text: "Getting massive Blade Runner / Cyberpunk 2077 vibes here. The synthesizer selection is spot on.",
    likes: 35,
    likedByCurrentUser: false,
    createdAt: "3 days ago",
    replies: []
  },
  {
    id: "c5",
    trackId: "4",
    userId: "user-6",
    displayName: "Astral Traveler",
    username: "astral_traveler",
    avatarUrl: "/images/artist_avatar.png",
    text: "Felt like I was floating in a silent void. Incredible texture, Luna does it again.",
    likes: 15,
    likedByCurrentUser: false,
    createdAt: "12 hours ago",
    replies: []
  },
  {
    id: "c6",
    trackId: "7",
    userId: "user-7",
    displayName: "Pump Master",
    username: "pump_master",
    avatarUrl: "/images/artist_avatar.png",
    text: "This track just saved my PR in the gym. Absolute gym phonk masterpiece!",
    likes: 64,
    likedByCurrentUser: false,
    createdAt: "4 days ago",
    replies: [
      {
        id: "r3",
        userId: "user-2",
        displayName: "Drift King",
        username: "drift_king",
        avatarUrl: "/images/artist_avatar.png",
        text: "This is heavy gym drift fuel. Play it loud!",
        likes: 12,
        likedByCurrentUser: false,
        createdAt: "2 days ago"
      }
    ]
  },
  {
    id: "c7",
    trackId: "11",
    userId: "user-8",
    displayName: "Phonk Cult",
    username: "phonk_cult",
    avatarUrl: "/images/artist_avatar.png",
    text: "Love that tape hiss and vintage Memphis vocal sampling. Really captures the underground sound.",
    likes: 22,
    likedByCurrentUser: false,
    createdAt: "1 week ago",
    replies: []
  }
];

export const mockPlaylists = [
  {
    id: "p1",
    name: "Late Night Phonk",
    description: "High-octane aggressive cowbells and JDM drift tracks.",
    coverUrl: "/images/cover_phonk.png",
    trackIds: ["1", "5", "7", "11"],
    creator: "NoirSound Selects",
    likes: 24500
  },
  {
    id: "p2",
    name: "Subway Lo-fi Beats",
    description: "Cozy loops and rain tracks for late night study sessions.",
    coverUrl: "/images/cover_lofi.png",
    trackIds: ["2", "8"],
    creator: "Lo-Fi Lounge",
    likes: 85200
  },
  {
    id: "p3",
    name: "Ambient Drones",
    description: "Atmospheric, deep-space soundscapes and evolving drones.",
    coverUrl: "/images/cover_ambient.png",
    trackIds: ["4", "6", "10"],
    creator: "Luna Ambient",
    likes: 12900
  },
  {
    id: "p4",
    name: "Underground Selects",
    description: "The best experimental and rap tracks from the dark web.",
    coverUrl: "/images/cover_electronic.png",
    trackIds: ["3", "9", "12", "5"],
    creator: "NoirSound Crew",
    likes: 7400
  }
];
