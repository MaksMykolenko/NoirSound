'use strict';

const { getPresenceManager } = require('../lib/redisPresence');
const {
  DEFAULT_DEVICE_CODE_TTL_SECONDS,
  DEFAULT_PRESENCE_TTL_SECONDS,
  DEFAULT_PAUSE_PRESENCE_TTL_SECONDS,
  ALLOWED_PRESENCE_EVENTS,
  generateUserCode,
  generateDeviceCode,
  generateRefreshToken,
  hashRefreshToken,
  signDeviceAccessToken,
  verifyDeviceAccessToken,
  formatAuthoritativeTrack
} = require('../lib/desktopPresence');
const { scaledRateLimitMax } = require('../lib/rateLimit');
const { userOrIpKey } = require('../lib/rateLimitKeys');

module.exports = async function desktopConnectRoutes(fastify, options) {
  const presenceManager = options.presenceManager || getPresenceManager();

  // 1. Device Pairing: Start flow from Desktop App
  fastify.post('/device/start', {
    config: {
      rateLimit: {
        max: scaledRateLimitMax(30),
        timeWindow: '1 minute',
        keyGenerator: (req) => req.ip
      }
    }
  }, async (request, reply) => {
    const { deviceName = 'MacBook Pro', platform = 'macOS', appVersion = '0.1.0' } = request.body || {};

    const deviceCode = generateDeviceCode();
    const userCode = generateUserCode();
    const expiresIn = DEFAULT_DEVICE_CODE_TTL_SECONDS;

    const pairingPayload = JSON.stringify({
      deviceCode,
      userCode,
      status: 'PENDING',
      deviceName: String(deviceName).slice(0, 64),
      platform: String(platform).slice(0, 32),
      appVersion: String(appVersion).slice(0, 16),
      createdAt: new Date().toISOString()
    });

    await presenceManager.set(`desktop-pairing:code:${deviceCode}`, pairingPayload, expiresIn);
    await presenceManager.set(`desktop-pairing:user:${userCode}`, deviceCode, expiresIn);

    const baseUrl = (process.env.FRONTEND_ORIGIN || 'https://noirsound.co').split(',')[0].trim().replace(/\/+$/, '');
    const verificationUri = `${baseUrl}/connect/desktop`;
    const verificationUriComplete = `${baseUrl}/connect/desktop?code=${userCode}`;

    return reply.status(200).send({
      deviceCode,
      userCode,
      verificationUri,
      verificationUriComplete,
      expiresIn,
      pollInterval: 5
    });
  });

  // 2. Device Pairing: Verify user code metadata (Authenticated web user)
  fastify.get('/device/verify-info', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const { code } = request.query || {};
    if (!code || typeof code !== 'string') {
      return reply.badRequest('Code query parameter is required.');
    }

    const normalizedCode = code.trim().toUpperCase();
    const deviceCode = await presenceManager.get(`desktop-pairing:user:${normalizedCode}`);
    if (!deviceCode) {
      return reply.notFound('Pairing code not found or expired.');
    }

    const rawPairingData = await presenceManager.get(`desktop-pairing:code:${deviceCode}`);
    if (!rawPairingData) {
      return reply.notFound('Pairing session not found or expired.');
    }

    try {
      const pairingData = JSON.parse(rawPairingData);
      return reply.send({
        userCode: pairingData.userCode,
        deviceName: pairingData.deviceName,
        platform: pairingData.platform,
        appVersion: pairingData.appVersion,
        createdAt: pairingData.createdAt
      });
    } catch {
      return reply.internalServerError('Failed to parse pairing data.');
    }
  });

  // 3. Device Pairing: Authorize device (Authenticated web user)
  fastify.post('/device/authorize', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const { userCode, enableDiscordPresence = true } = request.body || {};
    if (!userCode || typeof userCode !== 'string') {
      return reply.badRequest('User code is required.');
    }

    const normalizedCode = userCode.trim().toUpperCase();
    const deviceCode = await presenceManager.get(`desktop-pairing:user:${normalizedCode}`);
    if (!deviceCode) {
      return reply.status(404).send({ error: 'invalid_code', message: 'Pairing code not found or expired.' });
    }

    const rawPairingData = await presenceManager.get(`desktop-pairing:code:${deviceCode}`);
    if (!rawPairingData) {
      return reply.status(404).send({ error: 'invalid_session', message: 'Pairing session not found or expired.' });
    }

    let pairingData;
    try {
      pairingData = JSON.parse(rawPairingData);
    } catch {
      return reply.internalServerError('Failed to parse pairing data.');
    }

    pairingData.status = 'AUTHORIZED';
    pairingData.userId = request.user.id;

    // Persist updated authorized status with remaining TTL
    await presenceManager.set(`desktop-pairing:code:${deviceCode}`, JSON.stringify(pairingData), DEFAULT_DEVICE_CODE_TTL_SECONDS);

    // Optionally enable Discord presence setting on user profile if requested
    if (enableDiscordPresence) {
      await fastify.prisma.user.update({
        where: { id: request.user.id },
        data: { discordPresenceEnabled: true }
      });
    }

    return reply.send({
      status: 'success',
      message: 'NoirSound Connect device successfully authorized.'
    });
  });

  // 4. Device Pairing: Token polling from Desktop App
  fastify.post('/device/token', {
    config: {
      rateLimit: {
        max: scaledRateLimitMax(60),
        timeWindow: '1 minute',
        keyGenerator: (req) => req.ip
      }
    }
  }, async (request, reply) => {
    const { deviceCode } = request.body || {};
    if (!deviceCode || typeof deviceCode !== 'string') {
      return reply.badRequest('deviceCode is required.');
    }

    const rawPairingData = await presenceManager.get(`desktop-pairing:code:${deviceCode}`);
    if (!rawPairingData) {
      return reply.status(400).send({
        error: 'invalid_grant',
        message: 'The device code has expired or is invalid.'
      });
    }

    let pairingData;
    try {
      pairingData = JSON.parse(rawPairingData);
    } catch {
      return reply.internalServerError('Failed to parse pairing data.');
    }

    if (pairingData.status === 'PENDING') {
      return reply.status(400).send({
        error: 'authorization_pending',
        message: 'Waiting for user authorization.'
      });
    }

    if (pairingData.status !== 'AUTHORIZED' || !pairingData.userId) {
      return reply.status(400).send({
        error: 'invalid_grant',
        message: 'Device authorization failed or was rejected.'
      });
    }

    // One-time consumption: delete pairing keys immediately
    await presenceManager.del(`desktop-pairing:code:${deviceCode}`);
    if (pairingData.userCode) {
      await presenceManager.del(`desktop-pairing:user:${pairingData.userCode}`);
    }

    const user = await fastify.prisma.user.findUnique({
      where: { id: pairingData.userId }
    });

    if (!user || user.status !== 'ACTIVE') {
      return reply.status(403).send({
        error: 'user_inactive',
        message: 'User account is not active.'
      });
    }

    const refreshToken = generateRefreshToken();
    const refreshTokenHash = hashRefreshToken(refreshToken);

    const device = await fastify.prisma.desktopConnectionDevice.create({
      data: {
        userId: user.id,
        deviceName: pairingData.deviceName || 'MacBook Pro',
        platform: pairingData.platform || 'macOS',
        appVersion: pairingData.appVersion || '0.1.0',
        refreshTokenHash,
        lastSeenAt: new Date(),
        revokedAt: null
      }
    });

    const accessToken = signDeviceAccessToken(user.id, device.id);

    return reply.status(200).send({
      accessToken,
      refreshToken,
      deviceId: device.id,
      expiresIn: 900,
      tokenType: 'Bearer',
      settings: {
        enabled: Boolean(user.discordPresenceEnabled),
        showCover: user.discordPresenceShowCover !== false,
        showTimer: user.discordPresenceShowTimer !== false
      }
    });
  });

  // 5. Device Token Refresh: Rotate refresh token & issue new access token
  fastify.post('/device/refresh', {
    config: {
      rateLimit: {
        max: scaledRateLimitMax(30),
        timeWindow: '1 minute',
        keyGenerator: (req) => req.ip
      }
    }
  }, async (request, reply) => {
    const { refreshToken, deviceId } = request.body || {};
    if (!refreshToken || !deviceId) {
      return reply.badRequest('refreshToken and deviceId are required.');
    }

    const device = await fastify.prisma.desktopConnectionDevice.findFirst({
      where: {
        id: deviceId,
        revokedAt: null
      },
      include: { user: true }
    });

    if (!device || !device.user || device.user.status !== 'ACTIVE') {
      return reply.status(401).send({
        error: 'invalid_grant',
        message: 'Device not found, revoked, or user is inactive.'
      });
    }

    const incomingHash = hashRefreshToken(refreshToken);
    if (device.refreshTokenHash !== incomingHash) {
      return reply.status(401).send({
        error: 'invalid_grant',
        message: 'Invalid refresh token.'
      });
    }

    // Refresh token rotation
    const newRefreshToken = generateRefreshToken();
    const newRefreshTokenHash = hashRefreshToken(newRefreshToken);

    await fastify.prisma.desktopConnectionDevice.update({
      where: { id: device.id },
      data: {
        refreshTokenHash: newRefreshTokenHash,
        rotationCounter: { increment: 1 },
        lastSeenAt: new Date()
      }
    });

    const accessToken = signDeviceAccessToken(device.userId, device.id);

    return reply.status(200).send({
      accessToken,
      refreshToken: newRefreshToken,
      expiresIn: 900,
      tokenType: 'Bearer',
      settings: {
        enabled: Boolean(device.user.discordPresenceEnabled),
        showCover: device.user.discordPresenceShowCover !== false,
        showTimer: device.user.discordPresenceShowTimer !== false
      }
    });
  });

  // 6. Device Revoke: Revoke device from Desktop App or Web Settings
  fastify.post('/device/revoke', async (request, reply) => {
    let deviceId = request.body?.deviceId;
    let userId = null;

    // Check device access token header if available
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const decoded = verifyDeviceAccessToken(authHeader.slice(7));
      if (decoded) {
        deviceId = decoded.deviceId;
        userId = decoded.sub;
      }
    }

    // Or check session cookie
    if (!userId && request.cookies?.token) {
      try {
        await fastify.authenticate(request, reply);
        userId = request.user?.id;
      } catch {
        // ignore
      }
    }

    if (!deviceId) {
      return reply.badRequest('deviceId is required.');
    }

    const device = await fastify.prisma.desktopConnectionDevice.findUnique({
      where: { id: deviceId }
    });

    if (!device || (userId && device.userId !== userId)) {
      return reply.notFound('Device not found.');
    }

    await fastify.prisma.desktopConnectionDevice.update({
      where: { id: device.id },
      data: { revokedAt: new Date() }
    });

    // Notify active websocket connections for this user that device is revoked
    await presenceManager.publish(`channel:desktop-presence:${device.userId}`, {
      version: 1,
      type: 'device.revoked',
      deviceId: device.id,
      occurredAt: new Date().toISOString()
    });

    return reply.send({ status: 'success', message: 'Device revoked.' });
  });

  // 7. Connected Devices List (Authenticated Web User)
  fastify.get('/devices', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const devices = await fastify.prisma.desktopConnectionDevice.findMany({
      where: {
        userId: request.user.id,
        revokedAt: null
      },
      select: {
        id: true,
        deviceName: true,
        platform: true,
        appVersion: true,
        lastSeenAt: true,
        createdAt: true
      },
      orderBy: { lastSeenAt: 'desc' }
    });

    return reply.send({ devices });
  });

  // 8. Delete Connected Device by ID (Authenticated Web User)
  fastify.delete('/devices/:id', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const device = await fastify.prisma.desktopConnectionDevice.findFirst({
      where: {
        id: request.params.id,
        userId: request.user.id,
        revokedAt: null
      }
    });

    if (!device) {
      return reply.notFound('Device not found.');
    }

    await fastify.prisma.desktopConnectionDevice.update({
      where: { id: device.id },
      data: { revokedAt: new Date() }
    });

    await presenceManager.publish(`channel:desktop-presence:${request.user.id}`, {
      version: 1,
      type: 'device.revoked',
      deviceId: device.id,
      occurredAt: new Date().toISOString()
    });

    return reply.send({ status: 'success', message: 'Device disconnected.' });
  });

  // 9. Get / Update User Discord Presence Settings
  fastify.get('/settings', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const user = await fastify.prisma.user.findUnique({
      where: { id: request.user.id },
      select: {
        discordPresenceEnabled: true,
        discordPresenceShowCover: true,
        discordPresenceShowTimer: true
      }
    });

    return reply.send({
      enabled: Boolean(user?.discordPresenceEnabled),
      showCover: user?.discordPresenceShowCover !== false,
      showTimer: user?.discordPresenceShowTimer !== false
    });
  });

  fastify.patch('/settings', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const { enabled, showCover, showTimer } = request.body || {};

    const updates = {};
    if (typeof enabled === 'boolean') updates.discordPresenceEnabled = enabled;
    if (typeof showCover === 'boolean') updates.discordPresenceShowCover = showCover;
    if (typeof showTimer === 'boolean') updates.discordPresenceShowTimer = showTimer;

    const user = await fastify.prisma.user.update({
      where: { id: request.user.id },
      data: updates,
      select: {
        discordPresenceEnabled: true,
        discordPresenceShowCover: true,
        discordPresenceShowTimer: true
      }
    });

    // Notify connected desktop app of settings update
    await presenceManager.publish(`channel:desktop-presence:${request.user.id}`, {
      version: 1,
      type: 'settings.updated',
      settings: {
        enabled: Boolean(user.discordPresenceEnabled),
        showCover: user.discordPresenceShowCover !== false,
        showTimer: user.discordPresenceShowTimer !== false
      },
      occurredAt: new Date().toISOString()
    });

    if (!user.discordPresenceEnabled) {
      await presenceManager.del(`desktop-presence:user:${request.user.id}`);
      await presenceManager.publish(`channel:desktop-presence:${request.user.id}`, {
        version: 1,
        type: 'presence.clear',
        occurredAt: new Date().toISOString()
      });
    }

    return reply.send({
      enabled: Boolean(user.discordPresenceEnabled),
      showCover: user.discordPresenceShowCover !== false,
      showTimer: user.discordPresenceShowTimer !== false
    });
  });

  // 10. Web Player Presence Event Relay (Authenticated via user session)
  fastify.post('/presence/event', {
    preHandler: [fastify.authenticate],
    config: {
      rateLimit: {
        max: scaledRateLimitMax(120),
        timeWindow: '1 minute',
        keyGenerator: userOrIpKey
      }
    }
  }, async (request, reply) => {
    const { event, trackId, positionMs = 0, clientSequence = 1, occurredAt } = request.body || {};

    if (!event || !ALLOWED_PRESENCE_EVENTS.has(event)) {
      return reply.badRequest('Invalid or missing presence event type.');
    }

    const user = await fastify.prisma.user.findUnique({
      where: { id: request.user.id },
      select: {
        discordPresenceEnabled: true,
        discordPresenceShowCover: true,
        discordPresenceShowTimer: true
      }
    });

    if (!user || !user.discordPresenceEnabled) {
      return reply.send({ acknowledged: true, presenceActive: false });
    }

    const timestamp = occurredAt || new Date().toISOString();

    if (event === 'ended' || event === 'stop') {
      await presenceManager.del(`desktop-presence:user:${request.user.id}`);
      await presenceManager.publish(`channel:desktop-presence:${request.user.id}`, {
        version: 1,
        type: 'presence.clear',
        sequence: Number(clientSequence) || 1,
        occurredAt: timestamp
      });
      return reply.send({ acknowledged: true, type: 'presence.clear' });
    }

    if (!trackId || typeof trackId !== 'string') {
      return reply.badRequest('trackId is required for this presence event.');
    }

    // Lookup track authoritatively from DB
    const track = await fastify.prisma.track.findFirst({
      where: {
        id: trackId,
        status: 'PUBLISHED',
        isPublic: true,
        artist: {
          isHidden: false,
          user: { status: 'ACTIVE' }
        }
      },
      include: {
        album: { select: { title: true } },
        artist: {
          select: {
            user: { select: { displayName: true, username: true } }
          }
        }
      }
    });

    if (!track) {
      return reply.status(404).send({ error: 'track_unavailable', message: 'Track is not available.' });
    }

    const frontendOrigin = (process.env.FRONTEND_ORIGIN || 'https://noirsound.co').split(',')[0].trim();
    const authoritativeTrack = formatAuthoritativeTrack(track, Number(positionMs) || 0, frontendOrigin);

    if (event === 'pause') {
      const presencePayload = {
        version: 1,
        type: 'presence.pause',
        sequence: Number(clientSequence) || 1,
        occurredAt: timestamp,
        track: authoritativeTrack,
        settings: {
          showCover: user.discordPresenceShowCover !== false,
          showTimer: user.discordPresenceShowTimer !== false
        }
      };

      await presenceManager.set(
        `desktop-presence:user:${request.user.id}`,
        JSON.stringify(presencePayload),
        DEFAULT_PAUSE_PRESENCE_TTL_SECONDS
      );

      await presenceManager.publish(`channel:desktop-presence:${request.user.id}`, presencePayload);
      return reply.send({ acknowledged: true, type: 'presence.pause' });
    }

    // play, resume, seek, heartbeat
    const presencePayload = {
      version: 1,
      type: 'presence.update',
      sequence: Number(clientSequence) || 1,
      occurredAt: timestamp,
      track: authoritativeTrack,
      settings: {
        showCover: user.discordPresenceShowCover !== false,
        showTimer: user.discordPresenceShowTimer !== false
      }
    };

    await presenceManager.set(
      `desktop-presence:user:${request.user.id}`,
      JSON.stringify(presencePayload),
      DEFAULT_PRESENCE_TTL_SECONDS
    );

    await presenceManager.publish(`channel:desktop-presence:${request.user.id}`, presencePayload);
    return reply.send({ acknowledged: true, type: 'presence.update' });
  });

  // 11. WebSocket Connection for Desktop App
  fastify.get('/presence', { websocket: true }, async (socket, req) => {
    let deviceUser = null;
    let deviceId = null;
    let unsubscribeRedis = null;
    let heartbeatTimer = null;
    let isAlive = true;

    // Verify token from query or Authorization header
    const authHeader = req.headers.authorization;
    let token = null;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.slice(7);
    }

    const authenticateSocket = async (authToken) => {
      const decoded = verifyDeviceAccessToken(authToken);
      if (!decoded) return false;

      const device = await fastify.prisma.desktopConnectionDevice.findFirst({
        where: {
          id: decoded.deviceId,
          userId: decoded.sub,
          revokedAt: null
        },
        include: { user: true }
      });

      if (!device || !device.user || device.user.status !== 'ACTIVE') {
        return false;
      }

      deviceUser = device.user;
      deviceId = device.id;

      // Update lastSeenAt
      await fastify.prisma.desktopConnectionDevice.update({
        where: { id: device.id },
        data: { lastSeenAt: new Date() }
      }).catch(() => {});

      return true;
    };

    const setupSubscriptions = async () => {
      // Subscribe to Redis pub/sub channel for user
      unsubscribeRedis = await presenceManager.subscribe(
        `channel:desktop-presence:${deviceUser.id}`,
        (message) => {
          try {
            const parsed = typeof message === 'string' ? JSON.parse(message) : message;
            // If device was revoked, check if it was this specific device
            if (parsed.type === 'device.revoked' && parsed.deviceId === deviceId) {
              socket.send(JSON.stringify({ type: 'device.revoked', message: 'This device connection was revoked.' }));
              socket.close(4001, 'Device revoked');
              return;
            }
            socket.send(typeof message === 'string' ? message : JSON.stringify(message));
          } catch {
            // ignore send errors
          }
        }
      );

      // Send initial ready message
      socket.send(JSON.stringify({
        version: 1,
        type: 'connection.ready',
        deviceId,
        settings: {
          enabled: Boolean(deviceUser.discordPresenceEnabled),
          showCover: deviceUser.discordPresenceShowCover !== false,
          showTimer: deviceUser.discordPresenceShowTimer !== false
        }
      }));

      // If active presence exists in Redis, send current state immediately
      const currentPresence = await presenceManager.get(`desktop-presence:user:${deviceUser.id}`);
      if (currentPresence) {
        try {
          socket.send(currentPresence);
        } catch {
          // ignore
        }
      }

      // Heartbeat ping interval
      heartbeatTimer = setInterval(() => {
        if (!isAlive) {
          socket.terminate ? socket.terminate() : socket.close();
          return;
        }
        isAlive = false;
        try {
          socket.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
        } catch {
          // ignore
        }
      }, 25000);
      heartbeatTimer.unref?.();
    };

    if (token) {
      const ok = await authenticateSocket(token);
      if (!ok) {
        socket.send(JSON.stringify({ type: 'error', code: 'UNAUTHORIZED', message: 'Invalid or expired device token.' }));
        socket.close(4001, 'Unauthorized');
        return;
      }
      await setupSubscriptions();
    }

    socket.on('message', async (data) => {
      try {
        const text = data.toString();
        const msg = JSON.parse(text);

        if (msg.type === 'pong') {
          isAlive = true;
          return;
        }

        if (msg.type === 'ping') {
          socket.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
          return;
        }

        if (msg.type === 'auth' && msg.token && !deviceUser) {
          const ok = await authenticateSocket(msg.token);
          if (!ok) {
            socket.send(JSON.stringify({ type: 'error', code: 'UNAUTHORIZED', message: 'Invalid device token.' }));
            socket.close(4001, 'Unauthorized');
            return;
          }
          await setupSubscriptions();
        }
      } catch {
        // ignore malformed frame
      }
    });

    socket.on('close', () => {
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      if (typeof unsubscribeRedis === 'function') {
        unsubscribeRedis();
      }
    });

    socket.on('error', () => {
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      if (typeof unsubscribeRedis === 'function') {
        unsubscribeRedis();
      }
    });
  });
};
