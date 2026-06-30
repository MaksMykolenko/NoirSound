import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const outputDir = path.join(process.cwd(), 'design-audit-screenshots');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

async function captureAll() {
  const browser = await chromium.launch();
  const baseURL = 'http://localhost:5173';

  console.log('Fetching real API IDs...');
  let realTrackId = 'b9fff4e2-14d7-4fe7-bc8c-e6fb19747958';
  let realArtistId = '8b3f1f06-bc90-4567-9166-f824e956210f';
  let realPlaylistId = '1';

  try {
    const res = await fetch('http://localhost:3000/api/tracks');
    if (res.ok) {
      const data = await res.json();
      if (data.data && data.data[0]) {
        realTrackId = data.data[0].id;
        realArtistId = data.data[0].artistId;
      }
    }
  } catch (err) {
    console.warn('Could not fetch API tracks:', err);
  }

  console.log(`Using real track ID: ${realTrackId}, artist ID: ${realArtistId}`);

  // 1. DESKTOP CAPTURES (1440x900)
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    
    // Home
    await page.goto(`${baseURL}/`);
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(outputDir, 'desktop-home-1440x900.png') });
    await page.screenshot({ path: path.join(outputDir, 'desktop-player-empty-1440x900.png') });

    // Discover
    await page.goto(`${baseURL}/discover`);
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(outputDir, 'desktop-discover-1440x900.png') });

    // Track detail
    await page.goto(`${baseURL}/track/${realTrackId}`);
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(outputDir, 'desktop-track-detail-1440x900.png') });

    // Scroll to comments
    await page.evaluate(() => window.scrollTo(0, 800));
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(outputDir, 'desktop-comments-1440x900.png') });

    // Artist Profile
    await page.goto(`${baseURL}/artist/${realArtistId}`);
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(outputDir, 'desktop-artist-profile-1440x900.png') });

    // User Profile
    await page.goto(`${baseURL}/profile`);
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(outputDir, 'desktop-user-profile-1440x900.png') });

    // Library
    await page.goto(`${baseURL}/library`);
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(outputDir, 'desktop-library-1440x900.png') });

    // Playlist
    await page.goto(`${baseURL}/playlist/${realPlaylistId}`);
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(outputDir, 'desktop-playlist-1440x900.png') });

    // Upload Track
    await page.goto(`${baseURL}/upload`);
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(outputDir, 'desktop-upload-1440x900.png') });

    // Dashboard
    await page.goto(`${baseURL}/dashboard`);
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(outputDir, 'desktop-dashboard-1440x900.png') });

    // 404
    await page.goto(`${baseURL}/non-existent-page-test-404`);
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(outputDir, 'desktop-404-1440x900.png') });

    // Login & Register Modal
    await page.goto(`${baseURL}/`);
    await page.waitForTimeout(500);
    const loginBtn = page.locator('button:has-text("Log In")').first();
    if (await loginBtn.isVisible()) {
      await loginBtn.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(outputDir, 'desktop-login-modal-1440x900.png') });
      
      const signUpBtn = page.locator('button:has-text("Sign up")').first();
      if (await signUpBtn.isVisible()) {
        await signUpBtn.click();
        await page.waitForTimeout(500);
        await page.screenshot({ path: path.join(outputDir, 'desktop-register-modal-1440x900.png') });
      }
    }

    // Active Player & Queue & Collapsed Player
    await page.goto(`${baseURL}/track/${realTrackId}`);
    await page.waitForTimeout(1000);
    const playBtn = page.locator('button:has-text("Play Track")').first();
    if (await playBtn.isVisible()) {
      await playBtn.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(outputDir, 'desktop-player-active-1440x900.png') });

      // Open queue
      const queueBtn = page.locator('button[aria-label="Open play queue"]').first();
      if (await queueBtn.isVisible()) {
        await queueBtn.click();
        await page.waitForTimeout(500);
        await page.screenshot({ path: path.join(outputDir, 'desktop-queue-panel-1440x900.png') });
        await queueBtn.click(); // close
        await page.waitForTimeout(300);
      }

      // Collapse player
      const collapseBtn = page.locator('button[aria-label="Collapse player"]').first();
      if (await collapseBtn.isVisible()) {
        await collapseBtn.click();
        await page.waitForTimeout(500);
        await page.screenshot({ path: path.join(outputDir, 'desktop-player-collapsed-1440x900.png') });
      }
    }

    await page.close();
  }

  // 2. MOBILE CAPTURES (360x800, 390x844, 430x932, 768x1024)
  const mobileViewports = [
    { name: '360x800', width: 360, height: 800 },
    { name: '390x844', width: 390, height: 844 },
    { name: '430x932', width: 430, height: 932 },
    { name: '768x1024', width: 768, height: 1024 },
  ];

  for (const vp of mobileViewports) {
    const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.width < 768 });

    // Home
    await page.goto(`${baseURL}/`);
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(outputDir, `mobile-home-${vp.name}.png`) });

    // Discover
    await page.goto(`${baseURL}/discover`);
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(outputDir, `mobile-discover-${vp.name}.png`) });

    // Track detail
    await page.goto(`${baseURL}/track/${realTrackId}`);
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(outputDir, `mobile-track-${vp.name}.png`) });

    // Mobile Comments
    await page.evaluate(() => window.scrollTo(0, 600));
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(outputDir, `mobile-comments-${vp.name}.png`) });

    // Upload
    await page.goto(`${baseURL}/upload`);
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(outputDir, `mobile-upload-${vp.name}.png`) });

    // Library
    await page.goto(`${baseURL}/library`);
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(outputDir, `mobile-library-${vp.name}.png`) });

    // Profile
    await page.goto(`${baseURL}/profile`);
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(outputDir, `mobile-profile-${vp.name}.png`) });

    // Player states
    await page.goto(`${baseURL}/track/${realTrackId}`);
    await page.waitForTimeout(1000);
    const playBtn = page.locator('button:has-text("Play Track")').first();
    if (await playBtn.isVisible()) {
      await playBtn.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(outputDir, `mobile-player-collapsed-${vp.name}.png`) });

      // Expand mobile player
      const miniPlayer = page.locator('div[aria-label="Expand player"]').first();
      if (await miniPlayer.isVisible()) {
        await miniPlayer.click();
        await page.waitForTimeout(500);
        await page.screenshot({ path: path.join(outputDir, `mobile-player-expanded-${vp.name}.png`) });
      }
    }

    await page.close();
  }

  await browser.close();
  console.log('Updated screenshot capture finished successfully!');
}

captureAll().catch((err) => {
  console.error('Error during screenshot capture:', err);
  process.exit(1);
});
