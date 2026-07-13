const logger = require('../utils/logger');

/**
 * Matchmaking Service
 * Manages online presence and automatic pairing of users with listeners
 */

class MatchmakingService {
  constructor(io, getDB) {
    this.io = io;
    this.getDB = getDB || null;
    // Store online users by socket ID
    this.onlineUsers = new Map(); // socketId -> {name, email, role, status, joinedAt}

    // Separate queues for role-based matching
    this.clientQueue = new Set(); // Set of client socketIds waiting for a match
    this.listenerQueue = new Set(); // Set of listener socketIds waiting for a match

    // Track when each socket joined the listener queue (for stale-session eviction)
    this.listenerQueueJoinedAt = new Map(); // socketId -> Date.now()

    // Active matches
    this.activeMatches = new Map(); // roomId -> {userSocketId, listenerSocketId, startedAt}

    // Evict stale listener sockets every 60 s (connected but left tab open, nobody attending)
    const LISTENER_MAX_QUEUE_MS = 2 * 60 * 1000; // 2 minutes
    setInterval(() => {
      const now = Date.now();
      for (const socketId of Array.from(this.listenerQueue)) {
        const joinedAt = this.listenerQueueJoinedAt.get(socketId) || now;
        if (now - joinedAt > LISTENER_MAX_QUEUE_MS) {
          logger.warn(`⏰ Evicting stale listener from queue (idle > 2 min): ${socketId}`);
          this.listenerQueue.delete(socketId);
          this.listenerQueueJoinedAt.delete(socketId);
          this.onlineUsers.delete(socketId);
          // Notify the socket so its tab knows it was evicted
          if (this.io) this.io.to(socketId).emit('queue-evicted', { reason: 'idle_timeout' });
        }
      }
    }, 60000);

    // Client-to-client peer queue (clients matching with other clients)
    this.clientPeerQueue = new Set();

    // Chat queues (separate from call queues)
    this.clientChatQueue = new Set();
    this.listenerChatQueue = new Set();
    this.activeChatSessions = new Map(); // roomId → { clientSocketId, listenerSocketId }

    // Peer-to-peer chat queue (client↔client text chat)
    this.clientPeerChatQueue = new Set();
    this.activePeerChatSessions = new Map(); // roomId → { peer1SocketId, peer2SocketId }

    // Per-listener "Connect again" queues — a client reconnecting to a favorite
    // listener waits in that listener's own queue (keyed by listener email),
    // matched ahead of the general queue when that listener becomes available.
    this.directedCallQueues = new Map(); // listenerEmail(lc) → Set<clientSocketId>
    this.directedChatQueues = new Map(); // listenerEmail(lc) → Set<clientSocketId>

    // Debug logging
    setInterval(() => {
      logger.info(`🔍 Queue Status: ${this.clientQueue.size} clients, ${this.listenerQueue.size} listeners, ${this.clientPeerQueue.size} peer-clients waiting | ${this.onlineUsers.size} online, ${this.activeMatches.size} active matches | Chat: ${this.clientChatQueue.size} clients, ${this.listenerChatQueue.size} listeners, ${this.clientPeerChatQueue.size} peer-chat`);
      if (this.clientQueue.size > 0) {
        logger.info(`   Clients waiting: ${Array.from(this.clientQueue).join(', ')}`);
      }
      if (this.listenerQueue.size > 0) {
        logger.info(`   Listeners waiting: ${Array.from(this.listenerQueue).join(', ')}`);
      }
    }, 10000);
  }

  /**
     * Add user to online presence
     */
  goOnline(socketId, userData) {
    const { name, email, role } = userData;

    this.onlineUsers.set(socketId, {
      name: name || 'Anonymous',
      email: email || 'anonymous@example.com',
      role: role || 'user',
      status: 'online',
      joinedAt: Date.now()
    });

    logger.info(`👥 User went online: ${socketId} as ${role} (${name})`);

    // Everyone is treated equally - no auto-queue for listeners
    // Users must explicitly request a match

    return this.getQueueStats();
  }

  /**
     * Remove user from online presence
     */
  goOffline(socketId) {
    const user = this.onlineUsers.get(socketId);
    if (!user) return;

    logger.info(`👋 User went offline: ${socketId} (${user.name})`);

    // Remove from all queues (whichever they're in)
    this.clientQueue.delete(socketId);
    this.listenerQueue.delete(socketId);
    this.listenerQueueJoinedAt.delete(socketId);
    this.clientPeerQueue.delete(socketId);
    this.clientChatQueue.delete(socketId);
    this.listenerChatQueue.delete(socketId);
    this.clientPeerChatQueue.delete(socketId);
    this._removeFromDirectedQueues(socketId);

    // Remove from online users
    this.onlineUsers.delete(socketId);

    // Clean up any active matches
    this.cleanupMatchesForSocket(socketId);

    return this.getQueueStats();
  }

  /**
     * Is a listener with this email currently online (present, any state)?
     */
  isListenerOnline(email) {
    const lc = (email || '').toLowerCase();
    if (!lc) return false;
    for (const u of this.onlineUsers.values()) {
      if (u.role === 'listener' && (u.email || '').toLowerCase() === lc) return true;
    }
    return false;
  }

  /**
     * Presence status for a listener email: 'offline' | 'busy' | 'online'.
     * 'busy' if any of their sockets is in a session; 'online' if present & free.
     */
  getListenerStatus(email) {
    const lc = (email || '').toLowerCase();
    if (!lc) return 'offline';
    let present = false;
    let busy = false;
    for (const u of this.onlineUsers.values()) {
      if (u.role === 'listener' && (u.email || '').toLowerCase() === lc) {
        present = true;
        if (u.status === 'busy') busy = true;
      }
    }
    if (!present) return 'offline';
    return busy ? 'busy' : 'online';
  }

  /**
     * Emails of all currently-online listeners (lowercased, de-duped).
     */
  getOnlineListenerEmails() {
    const set = new Set();
    for (const u of this.onlineUsers.values()) {
      if (u.role === 'listener' && u.email) set.add(u.email.toLowerCase());
    }
    return Array.from(set);
  }

  /**
     * Socket ids of online listeners with this email (usually one).
     */
  getListenerSocketsByEmail(email) {
    const lc = (email || '').toLowerCase();
    const ids = [];
    for (const [sid, u] of this.onlineUsers.entries()) {
      if (u.role === 'listener' && (u.email || '').toLowerCase() === lc) ids.push(sid);
    }
    return ids;
  }

  /** Remove a socket from every per-listener directed queue. */
  _removeFromDirectedQueues(socketId) {
    for (const [email, set] of this.directedCallQueues) {
      set.delete(socketId);
      if (set.size === 0) this.directedCallQueues.delete(email);
    }
    for (const [email, set] of this.directedChatQueues) {
      set.delete(socketId);
      if (set.size === 0) this.directedChatQueues.delete(email);
    }
  }

  /**
     * Client requests to reconnect to a specific favorite listener. The client
     * waits in that listener's own queue and is matched ahead of the general
     * queue once the listener becomes available. `kind` is 'call' or 'chat'.
     */
  requestDirectMatch(socketId, targetEmail, kind) {
    const user = this.onlineUsers.get(socketId);
    if (!user) return { success: false, error: 'User not found' };
    const lc = (targetEmail || '').toLowerCase();
    if (!lc) return { success: false, error: 'No target listener specified' };

    // Reconnecting users act as clients regardless of any stale cached role.
    if (user.role === 'listener' || user.role === 'therapist') user.role = 'client';
    user.status = 'waiting';

    const queues = kind === 'chat' ? this.directedChatQueues : this.directedCallQueues;
    if (!queues.has(lc)) queues.set(lc, new Set());
    queues.get(lc).add(socketId);
    logger.info(`🎯 ${socketId} (${user.name}) waiting in ${kind} queue for listener ${lc}`);

    const online = this.isListenerOnline(lc);

    // If the target listener is already waiting, match immediately.
    if (kind === 'chat') this.tryMatchChat(); else this.tryMatch();

    const stillWaiting = queues.get(lc)?.has(socketId);
    return { success: true, online, status: stillWaiting ? 'waiting' : 'matched' };
  }

  /**
     * Request a match
     * Used by both users and listeners (implicitly or explicitly)
     */
  requestMatch(socketId) {
    const user = this.onlineUsers.get(socketId);
    if (!user) {
      return { success: false, error: 'User not found' };
    }

    // Add to appropriate queue based on role
    if (user.role === 'listener') {
      this.listenerQueue.add(socketId);
      this.listenerQueueJoinedAt.set(socketId, Date.now());
      logger.info(`🎧 Listener joined queue: ${socketId} (${user.name})`);
    } else {
      // Default to client queue for 'client', 'user', or any other role
      this.clientQueue.add(socketId);
      logger.info(`👤 Client joined queue: ${socketId} (${user.name})`);
    }

    user.status = 'waiting';

    // Try to find a match immediately
    this.tryMatch();

    // Check if user was matched (removed from queue)
    const stillWaiting = this.clientQueue.has(socketId) || this.listenerQueue.has(socketId);
    if (stillWaiting) {
      return { success: true, status: 'waiting' };
    } else {
      return { success: true, status: 'matched' };
    }
  }

  /**
     * Try to match users in the queue.
     * Only matches clients with listeners (role-based matching).
     * Skips any socket ID that is no longer connected to Socket.IO.
     */
  tryMatch() {
    logger.info(`🎲 tryMatch checking queues: ${this.clientQueue.size} clients, ${this.listenerQueue.size} listeners`);

    // Purge stale socket IDs that Socket.IO no longer tracks
    this._purgeGhosts(this.clientQueue);
    this._purgeGhosts(this.listenerQueue);

    // First: satisfy "Connect again" — for each waiting listener, pair them with a
    // client who is specifically waiting in that listener's directed queue.
    for (const listenerId of Array.from(this.listenerQueue)) {
      if (!this.listenerQueue.has(listenerId)) continue;
      const listener = this.onlineUsers.get(listenerId);
      const lc = (listener?.email || '').toLowerCase();
      const dq = lc ? this.directedCallQueues.get(lc) : null;
      if (!dq || dq.size === 0) continue;
      this._purgeGhosts(dq);
      const clientId = Array.from(dq)[0];
      if (!clientId) continue;
      dq.delete(clientId);
      if (dq.size === 0) this.directedCallQueues.delete(lc);
      this.clientQueue.delete(clientId); // in case they also sit in the general queue
      logger.info(`🎯 Direct call match: client ${clientId} ↔ favorite listener ${lc}`);
      this.createMatch(clientId, listenerId);
    }

    // Need at least one client AND one listener to match
    while (this.clientQueue.size >= 1 && this.listenerQueue.size >= 1) {
      const clientId   = Array.from(this.clientQueue)[0];
      const listenerId = Array.from(this.listenerQueue)[0];

      const client   = this.onlineUsers.get(clientId);
      const listener = this.onlineUsers.get(listenerId);

      logger.info(`🤝 Attempting to match: Client ${clientId} (${client?.name}) ⚡ Listener ${listenerId} (${listener?.name})`);

      const result = this.createMatch(clientId, listenerId);

      if (!result) {
        logger.warn(`⚠️ Match failed for ${clientId} or ${listenerId}, retrying...`);
        continue;
      }
    }

    if (this.clientQueue.size > 0 && this.listenerQueue.size === 0) {
      logger.info(`⏳ ${this.clientQueue.size} client(s) waiting for listeners`);
    }
    if (this.listenerQueue.size > 0 && this.clientQueue.size === 0) {
      logger.info(`⏳ ${this.listenerQueue.size} listener(s) waiting for clients`);
    }
  }

  /**
     * Remove from a queue any socket IDs that Socket.IO no longer has connected.
     */
  _purgeGhosts(queue) {
    if (!this.io) return;
    for (const socketId of Array.from(queue)) {
      const socketObj = this.io.sockets.sockets.get(socketId);
      if (!socketObj || !socketObj.connected) {
        logger.warn(`🧹 Purging ghost socket from queue: ${socketId}`);
        queue.delete(socketId);
        this.onlineUsers.delete(socketId);
      }
    }
  }

  /**
     * Create a match between two peers
     */
  createMatch(socketId1, socketId2) {
    const peer1 = this.onlineUsers.get(socketId1);
    const peer2 = this.onlineUsers.get(socketId2);

    // Handle ghost users
    if (!peer1) {
      logger.warn(`👻 Ghost user found in queue: ${socketId1} - removing`);
      this.clientQueue.delete(socketId1);
      this.listenerQueue.delete(socketId1);
    }
    if (!peer2) {
      logger.warn(`👻 Ghost user found in queue: ${socketId2} - removing`);
      this.clientQueue.delete(socketId2);
      this.listenerQueue.delete(socketId2);
    }

    if (!peer1 || !peer2) return null;

    // Remove both from their respective queues
    this.clientQueue.delete(socketId1);
    this.listenerQueue.delete(socketId1);
    this.listenerQueueJoinedAt.delete(socketId1);
    this.clientQueue.delete(socketId2);
    this.listenerQueue.delete(socketId2);
    this.listenerQueueJoinedAt.delete(socketId2);

    peer1.status = 'busy';
    peer2.status = 'busy';

    const roomId = `room_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Store match
    this.activeMatches.set(roomId, {
      userSocketId: socketId1,
      listenerSocketId: socketId2,
      startedAt: Date.now()
    });

    logger.info(`✨ Match created: ${roomId} (${peer1.name} ↔️ ${peer2.name})`);

    // Emit match events asynchronously (DB lookup for costPerMin)
    this._emitMatchEvent(socketId1, socketId2, roomId, peer1, peer2);

    return { roomId };
  }

  /**
     * End a match
     */
  endMatch(roomId) {
    const match = this.activeMatches.get(roomId);
    if (!match) return null;

    logger.info(`🔚 Match ended: ${roomId}`);

    // Update user statuses
    const user = this.onlineUsers.get(match.userSocketId);
    const listener = this.onlineUsers.get(match.listenerSocketId);

    if (user) user.status = 'online';
    if (listener) listener.status = 'online';

    // Remove match
    this.activeMatches.delete(roomId);

    return match;
  }

  /**
     * Clean up matches when a socket disconnects
     */
  cleanupMatchesForSocket(socketId) {
    for (const [roomId, match] of this.activeMatches.entries()) {
      if (match.userSocketId === socketId || match.listenerSocketId === socketId) {
        logger.info(`🧹 Cleaning up match due to disconnect: ${roomId}`);
        this.activeMatches.delete(roomId);
        const otherSocketId = match.userSocketId === socketId ? match.listenerSocketId : match.userSocketId;
        if (this.io) this.io.to(otherSocketId).emit('peer-disconnected');
        return { roomId, otherSocketId };
      }
    }

    // Also clean up chat sessions
    for (const [roomId, session] of this.activeChatSessions.entries()) {
      if (session.clientSocketId === socketId || session.listenerSocketId === socketId) {
        logger.info(`🧹 Cleaning up chat session due to disconnect: ${roomId}`);
        this.activeChatSessions.delete(roomId);
        const otherSocketId = session.clientSocketId === socketId ? session.listenerSocketId : session.clientSocketId;
        if (this.io) this.io.to(otherSocketId).emit('peer-disconnected');
        return { roomId, otherSocketId };
      }
    }

    // Clean up peer chat sessions
    for (const [roomId, session] of this.activePeerChatSessions.entries()) {
      if (session.peer1SocketId === socketId || session.peer2SocketId === socketId) {
        logger.info(`🧹 Cleaning up peer chat session due to disconnect: ${roomId}`);
        this.activePeerChatSessions.delete(roomId);
        const otherSocketId = session.peer1SocketId === socketId ? session.peer2SocketId : session.peer1SocketId;
        if (this.io) this.io.to(otherSocketId).emit('peer-disconnected');
        return { roomId, otherSocketId };
      }
    }

    return null;
  }

  /**
     * Request a client-to-client peer match (two clients talking to each other).
     * Only non-listener roles are allowed.
     */
  requestClientPeerMatch(socketId) {
    const user = this.onlineUsers.get(socketId);
    if (!user) return { success: false, error: 'User not found' };

    // Listeners must not enter the peer queue — they have their own listener queue
    if (user.role === 'listener' || user.role === 'therapist') {
      logger.warn(`🚫 Role '${user.role}' tried to join peer queue, rejected: ${socketId}`);
      return { success: false, error: 'Only client users can use peer-to-peer matching' };
    }

    // Keep role pinned to 'client' so the socket cannot be hijacked into clientQueue
    user.role = 'client';

    this.clientPeerQueue.add(socketId);
    user.status = 'waiting';
    logger.info(`🤝 Client joined peer queue: ${socketId} (${user.name})`);

    this.tryMatchClientPeer();

    const stillWaiting = this.clientPeerQueue.has(socketId);
    return { success: true, status: stillWaiting ? 'waiting' : 'matched' };
  }

  /**
     * Try to pair two clients from the peer queue
     */
  tryMatchClientPeer() {
    this._purgeGhosts(this.clientPeerQueue);

    while (this.clientPeerQueue.size >= 2) {
      const arr = Array.from(this.clientPeerQueue);
      const peer1Id = arr[0];
      const peer2Id = arr[1];

      // Remove from peer queue before createMatch (which only cleans clientQueue/listenerQueue)
      this.clientPeerQueue.delete(peer1Id);
      this.clientPeerQueue.delete(peer2Id);

      const result = this.createMatch(peer1Id, peer2Id);
      if (!result) {
        logger.warn(`⚠️ Peer match failed for ${peer1Id} or ${peer2Id} — re-queuing survivors`);
        // Re-add whichever peer is still alive so they are not lost
        if (this.onlineUsers.has(peer1Id)) this.clientPeerQueue.add(peer1Id);
        if (this.onlineUsers.has(peer2Id)) this.clientPeerQueue.add(peer2Id);
        this._purgeGhosts(this.clientPeerQueue);
      }
    }

    if (this.clientPeerQueue.size === 1) {
      logger.info('⏳ 1 client waiting for a peer to join');
    }
  }

  /**
     * Request a chat match (separate queue from call matching)
     */
  requestChatMatch(socketId) {
    const user = this.onlineUsers.get(socketId);
    if (!user) return { success: false, error: 'User not found' };

    if (user.role === 'listener') {
      this.listenerChatQueue.add(socketId);
      logger.info(`💬 Listener joined chat queue: ${socketId} (${user.name})`);
    } else {
      this.clientChatQueue.add(socketId);
      logger.info(`💬 Client joined chat queue: ${socketId} (${user.name})`);
    }

    user.status = 'waiting';
    this.tryMatchChat();

    const stillWaiting = this.clientChatQueue.has(socketId) || this.listenerChatQueue.has(socketId);
    return { success: true, status: stillWaiting ? 'waiting' : 'matched' };
  }

  /**
     * Try to match from chat queues
     */
  tryMatchChat() {
    this._purgeGhosts(this.clientChatQueue);
    this._purgeGhosts(this.listenerChatQueue);

    // First: satisfy "Connect again" for chat — pair each waiting listener with a
    // client waiting in that listener's directed chat queue.
    for (const listenerId of Array.from(this.listenerChatQueue)) {
      if (!this.listenerChatQueue.has(listenerId)) continue;
      const listener = this.onlineUsers.get(listenerId);
      const lc = (listener?.email || '').toLowerCase();
      const dq = lc ? this.directedChatQueues.get(lc) : null;
      if (!dq || dq.size === 0) continue;
      this._purgeGhosts(dq);
      const clientId = Array.from(dq)[0];
      if (!clientId) continue;
      dq.delete(clientId);
      if (dq.size === 0) this.directedChatQueues.delete(lc);
      this.clientChatQueue.delete(clientId);
      logger.info(`🎯 Direct chat match: client ${clientId} ↔ favorite listener ${lc}`);
      this.createChatMatch(clientId, listenerId);
    }

    while (this.clientChatQueue.size >= 1 && this.listenerChatQueue.size >= 1) {
      const clientId = Array.from(this.clientChatQueue)[0];
      const listenerId = Array.from(this.listenerChatQueue)[0];
      this.createChatMatch(clientId, listenerId);
    }
  }

  /**
     * Create a chat match between client and listener
     */
  createChatMatch(clientId, listenerId) {
    const client = this.onlineUsers.get(clientId);
    const listener = this.onlineUsers.get(listenerId);

    if (!client) { this.clientChatQueue.delete(clientId); }
    if (!listener) { this.listenerChatQueue.delete(listenerId); }
    if (!client || !listener) return null;

    this.clientChatQueue.delete(clientId);
    this.listenerChatQueue.delete(listenerId);
    client.status = 'busy';
    listener.status = 'busy';

    const roomId = `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.activeChatSessions.set(roomId, { clientSocketId: clientId, listenerSocketId: listenerId, startedAt: Date.now() });

    logger.info(`💬 Chat match created: ${roomId} (${client.name} ↔️ ${listener.name})`);

    // Emit with DB-backed costPerMin lookup
    this._emitChatMatchEvent(clientId, listenerId, roomId, client, listener);

    return { roomId };
  }

  /**
     * Request a peer-to-peer chat match (client↔client text chat)
     */
  requestPeerChatMatch(socketId) {
    const user = this.onlineUsers.get(socketId);
    if (!user) return { success: false, error: 'User not found' };

    if (user.role === 'listener' || user.role === 'therapist') {
      logger.warn(`🚫 Role '${user.role}' tried to join peer chat queue, rejected: ${socketId}`);
      return { success: false, error: 'Only client users can use peer-to-peer chat' };
    }

    user.role = 'client';
    this.clientPeerChatQueue.add(socketId);
    user.status = 'waiting';
    logger.info(`💬 Client joined peer chat queue: ${socketId} (${user.name})`);

    this.tryMatchPeerChat();

    const stillWaiting = this.clientPeerChatQueue.has(socketId);
    return { success: true, status: stillWaiting ? 'waiting' : 'matched' };
  }

  /**
     * Try to pair two clients from the peer chat queue
     */
  tryMatchPeerChat() {
    this._purgeGhosts(this.clientPeerChatQueue);

    while (this.clientPeerChatQueue.size >= 2) {
      const arr = Array.from(this.clientPeerChatQueue);
      const peer1Id = arr[0];
      const peer2Id = arr[1];

      this.clientPeerChatQueue.delete(peer1Id);
      this.clientPeerChatQueue.delete(peer2Id);

      const result = this.createPeerChatMatch(peer1Id, peer2Id);
      if (!result) {
        logger.warn('⚠️ Peer chat match failed — re-queuing survivors');
        if (this.onlineUsers.has(peer1Id)) this.clientPeerChatQueue.add(peer1Id);
        if (this.onlineUsers.has(peer2Id)) this.clientPeerChatQueue.add(peer2Id);
        this._purgeGhosts(this.clientPeerChatQueue);
      }
    }

    if (this.clientPeerChatQueue.size === 1) {
      logger.info('⏳ 1 client waiting for a peer chat partner');
    }
  }

  /**
     * Create a peer-to-peer chat match between two clients
     */
  createPeerChatMatch(peer1Id, peer2Id) {
    const peer1 = this.onlineUsers.get(peer1Id);
    const peer2 = this.onlineUsers.get(peer2Id);

    if (!peer1) { this.clientPeerChatQueue.delete(peer1Id); }
    if (!peer2) { this.clientPeerChatQueue.delete(peer2Id); }
    if (!peer1 || !peer2) return null;

    peer1.status = 'busy';
    peer2.status = 'busy';

    const roomId = `peerchat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.activePeerChatSessions.set(roomId, { peer1SocketId: peer1Id, peer2SocketId: peer2Id, startedAt: Date.now() });

    logger.info(`💬 Peer chat match created: ${roomId} (${peer1.name} ↔️ ${peer2.name})`);

    if (this.io) {
      this.io.to(peer1Id).emit('chat-match-found', {
        roomId,
        role: 'peer1',
        peer: { name: peer2.name, role: 'peer', socketId: peer2Id },
        you: { name: peer1.name, role: 'peer', socketId: peer1Id },
      });
      this.io.to(peer2Id).emit('chat-match-found', {
        roomId,
        role: 'peer2',
        peer: { name: peer1.name, role: 'peer', socketId: peer1Id },
        you: { name: peer2.name, role: 'peer', socketId: peer2Id },
      });
      this.io.emit('queue-update', this.getQueueStats());
    }

    return { roomId };
  }

  /**
     * Look up a listener's costPerMin from DB by email
     */
  async _getListenerCostPerMin(email) {
    if (!this.getDB || !email) {
      logger.warn(`[Billing] _getListenerCostPerMin skipped — getDB:${!!this.getDB} email:${email}`);
      return 0;
    }
    try {
      const db = this.getDB();
      const doc = await db.collection('users').findOne(
        { email: email.toLowerCase() },
        { projection: { 'listenerProfile.costPerMin': 1 } }
      );
      const rate = doc?.listenerProfile?.costPerMin || 0;
      logger.info(`[Billing] costPerMin for ${email}: ${rate} (doc found: ${!!doc})`);
      return rate;
    } catch (e) {
      logger.warn(`Failed to fetch costPerMin for ${email}:`, e);
      return 0;
    }
  }

  /**
     * Emit match-found events for a call match (async — looks up costPerMin from DB)
     */
  async _emitMatchEvent(socketId1, socketId2, roomId, peer1, peer2) {
    if (!this.io) return;
    // peer2 is the listener side in client↔listener matches
    const costPerMin = peer2.role === 'listener'
      ? await this._getListenerCostPerMin(peer2.email)
      : 0;

    this.io.to(socketId1).emit('match-found', {
      roomId,
      role: 'user',
      peer: { name: peer2.name, role: peer2.role, socketId: socketId2, costPerMin, email: peer2.email },
      you: { name: peer1.name, role: peer1.role, socketId: socketId1 },
    });
    this.io.to(socketId2).emit('match-found', {
      roomId,
      role: 'listener',
      peer: { name: peer1.name, role: peer1.role, socketId: socketId1, email: peer1.email },
      you: { name: peer2.name, role: peer2.role, socketId: socketId2 },
    });
    this.io.emit('queue-update', this.getQueueStats());
  }

  /**
     * Emit chat-match-found events (async — looks up costPerMin from DB)
     */
  async _emitChatMatchEvent(clientId, listenerId, roomId, client, listener) {
    if (!this.io) return;
    const costPerMin = await this._getListenerCostPerMin(listener.email);

    this.io.to(clientId).emit('chat-match-found', {
      roomId,
      role: 'client',
      peer: { name: listener.name, role: 'listener', socketId: listenerId, costPerMin, email: listener.email },
      you: { name: client.name, role: 'client', socketId: clientId },
    });
    this.io.to(listenerId).emit('chat-match-found', {
      roomId,
      role: 'listener',
      peer: { name: client.name, role: 'client', socketId: clientId, email: client.email },
      you: { name: listener.name, role: 'listener', socketId: listenerId },
    });
    this.io.emit('queue-update', this.getQueueStats());
  }

  /**
     * Get queue statistics
     */
  getQueueStats() {
    return {
      clientsWaiting: this.clientQueue.size,
      listenersWaiting: this.listenerQueue.size,
      usersWaiting: this.clientQueue.size + this.listenerQueue.size,
      clientPeersWaiting: this.clientPeerQueue.size,
      onlineUsers: this.onlineUsers.size,
      activeMatches: this.activeMatches.size,
      chatClientsWaiting: this.clientChatQueue.size,
      chatListenersWaiting: this.listenerChatQueue.size,
      activeChatSessions: this.activeChatSessions.size,
      peerChatWaiting: this.clientPeerChatQueue.size,
      activePeerChatSessions: this.activePeerChatSessions.size,
    };
  }

  /**
     * Get all online listeners (for display)
     */
  getOnlineListeners() {
    const listeners = [];
    for (const [socketId, user] of this.onlineUsers.entries()) {
      if (user.role === 'listener') {
        listeners.push({
          socketId,
          name: user.name,
          status: user.status,
          joinedAt: user.joinedAt
        });
      }
    }
    return listeners;
  }

  /**
     * Check if user is in a match
     */
  isInMatch(socketId) {
    for (const match of this.activeMatches.values()) {
      if (match.userSocketId === socketId || match.listenerSocketId === socketId) {
        return true;
      }
    }
    return false;
  }
}

module.exports = MatchmakingService;
