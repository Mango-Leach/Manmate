const logger = require('../utils/logger');

/**
 * WebRTC Signaling Server with Matchmaking Integration
 * Manages peer-to-peer connections between users and listeners
 */

class SignalingServer {
  constructor(io, matchmakingService) {
    this.io = io;
    this.matchmaking = matchmakingService;
    this.rooms = new Map(); // roomId -> { user: socketId, listener: socketId }
    this.users = new Map(); // socketId -> { roomId, role: 'user' | 'listener' }
    // Chat-specific state
    this.chatRooms = new Map(); // roomId -> { client: socketId, listener: socketId }
    this.chatUsers = new Map(); // socketId -> { roomId, role: 'client' | 'listener' }
    this.pendingCallProposals = new Map(); // roomId -> proposerSocketId
  }

  initialize() {
    this.io.on('connection', (socket) => {
      logger.info(`WebRTC: New connection - ${socket.id}`);

      // ========== MATCHMAKING EVENTS ==========

      // User/Listener goes online
      socket.on('go-online', ({ name, email, role }) => {
        const stats = this.matchmaking.goOnline(socket.id, { name, email, role });
        socket.emit('online-success', { stats });
        this.io.emit('queue-update', stats);

        logger.info(`📊 Queue stats: ${stats.usersWaiting} users, ${stats.listenersAvailable} listeners`);
      });

      // User requests to be matched with a listener (client↔listener queue only)
      socket.on('request-match', ({ name, email, role, userName, userId }) => {
        // If this socket is already in the peer queue, ignore — prevent accidental cross-queue
        if (this.matchmaking.clientPeerQueue.has(socket.id)) {
          logger.warn(`⚠️ request-match ignored for ${socket.id} — already in peer queue`);
          return;
        }
        // Handle both parameter formats: (name, email) or (userName, userId)
        const finalName = name || userName || 'Anonymous';
        const finalEmail = email || userId || `user_${socket.id}@temp.com`;
        const finalRole = role || 'client';

        // Ensure user is online first
        if (!this.matchmaking.onlineUsers.has(socket.id)) {
          this.matchmaking.goOnline(socket.id, {
            name: finalName,
            email: finalEmail,
            role: finalRole
          });
        } else {
          // If user is already online, update their info if role is provided
          const existingUser = this.matchmaking.onlineUsers.get(socket.id);
          if (existingUser) {
            if (role) existingUser.role = role;
            if (finalName) existingUser.name = finalName;
            if (finalEmail) existingUser.email = finalEmail;
          }
        }

        const result = this.matchmaking.requestMatch(socket.id);

        if (result.success && result.status === 'waiting') {
          socket.emit('waiting-for-match', { message: 'Looking for a peer...' });
        } else if (!result.success) {
          socket.emit('match-error', { error: result.error });
        }
        // If match was found immediately, MatchmakingService handles the emission
      });

      // Client requests to be matched with another client (peer-to-peer support)
      socket.on('request-client-peer-match', ({ name, email, userName, userId, role }) => {
        const finalName = name || userName || 'Anonymous';
        const finalEmail = email || userId || `user_${socket.id}@temp.com`;
        const actualRole = role || 'client';

        // Listeners and therapists must not enter the peer queue
        if (actualRole === 'listener' || actualRole === 'therapist') {
          logger.warn(`🚫 Role '${actualRole}' tried to use peer matching, rejected: ${socket.id}`);
          socket.emit('match-error', { error: 'Only registered clients can use Talk to a Peer.' });
          return;
        }

        // Also check the cached role in onlineUsers for already-registered sockets
        const existingUser = this.matchmaking.onlineUsers.get(socket.id);
        if (existingUser && (existingUser.role === 'listener' || existingUser.role === 'therapist')) {
          logger.warn(`🚫 Cached role '${existingUser.role}' tried to use peer matching, rejected: ${socket.id}`);
          socket.emit('match-error', { error: 'Only registered clients can use Talk to a Peer.' });
          return;
        }

        // Remove from listener/client queues — this socket belongs ONLY in clientPeerQueue
        this.matchmaking.clientQueue.delete(socket.id);
        this.matchmaking.listenerQueue.delete(socket.id);
        this.matchmaking.listenerQueueJoinedAt.delete(socket.id);

        if (!this.matchmaking.onlineUsers.has(socket.id)) {
          this.matchmaking.goOnline(socket.id, { name: finalName, email: finalEmail, role: 'client' });
        } else {
          const existing = this.matchmaking.onlineUsers.get(socket.id);
          if (existing) {
            if (finalName) existing.name = finalName;
            if (finalEmail) existing.email = finalEmail;
            existing.role = 'client';
          }
        }

        const result = this.matchmaking.requestClientPeerMatch(socket.id);

        if (result.success && result.status === 'waiting') {
          socket.emit('waiting-for-match', { message: 'Looking for a peer...' });
        } else if (!result.success) {
          socket.emit('match-error', { error: result.error });
        }
      });

      // Get queue stats
      socket.on('get-queue-stats', () => {
        const stats = this.matchmaking.getQueueStats();
        socket.emit('queue-update', stats);
      });

      // Favorites: presence status ('online' | 'busy' | 'offline') for these emails.
      socket.on('check-listeners-online', ({ emails } = {}) => {
        const list = Array.isArray(emails) ? emails : [];
        const statuses = {};
        const online = [];
        for (const e of list) {
          const lc = (e || '').toLowerCase();
          if (!lc) continue;
          const status = this.matchmaking.getListenerStatus(lc);
          statuses[lc] = status;
          if (status === 'online') online.push(lc);
        }
        socket.emit('listeners-online', { online, statuses });
      });

      // "Connect again": reconnect to a specific favorite listener. The client
      // waits in that listener's own queue ('call' or 'chat').
      socket.on('request-direct-match', ({ targetEmail, kind, name, email, role } = {}) => {
        const matchKind = kind === 'chat' ? 'chat' : 'call';
        const finalName = name || 'Anonymous';
        const finalEmail = email || `user_${socket.id}@temp.com`;

        if (!this.matchmaking.onlineUsers.has(socket.id)) {
          this.matchmaking.goOnline(socket.id, { name: finalName, email: finalEmail, role: role || 'client' });
        } else {
          const existing = this.matchmaking.onlineUsers.get(socket.id);
          if (existing) {
            if (finalName) existing.name = finalName;
            if (finalEmail) existing.email = finalEmail;
          }
        }

        const result = this.matchmaking.requestDirectMatch(socket.id, targetEmail, matchKind);
        if (!result.success) {
          socket.emit('match-error', { error: result.error });
          return;
        }

        // Tell the requesting client whether their favorite is online / matched.
        socket.emit('direct-match-status', {
          online: result.online,
          status: result.status,
          targetEmail: (targetEmail || '').toLowerCase(),
        });

        // Nudge the favorite listener's online sockets so they know to start a
        // session for the client who is waiting specifically for them.
        if (result.status !== 'matched') {
          for (const sid of this.matchmaking.getListenerSocketsByEmail(targetEmail)) {
            this.io.to(sid).emit('favorite-waiting', { kind: matchKind, clientName: finalName });
          }
        }
      });

      // ========== WEBRTC SIGNALING EVENTS ==========

      // User joins a call room
      socket.on('join-room', ({ roomId, role, userId }) => {
        logger.info(`WebRTC: ${socket.id} joining room ${roomId} as ${role}`);

        socket.join(roomId);
        this.users.set(socket.id, { roomId, role, userId });

        // Initialize room if it doesn't exist
        if (!this.rooms.has(roomId)) {
          this.rooms.set(roomId, {});
        }

        const room = this.rooms.get(roomId);
        room[role] = socket.id;

        // Notify the other peer that someone joined
        socket.to(roomId).emit('peer-joined', { role, socketId: socket.id });

        // If both peers are in the room, notify them to start connection
        if (room.user && room.listener) {
          room.startedAt = Date.now();
          logger.info(`WebRTC: Room ${roomId} is ready - both peers present`);
          this.io.to(roomId).emit('room-ready', {
            user: room.user,
            listener: room.listener
          });
        }
      });

      // Forward WebRTC offer
      socket.on('offer', ({ offer, to }) => {
        logger.info(`WebRTC: Forwarding offer from ${socket.id} to ${to}`);
        socket.to(to).emit('offer', {
          offer,
          from: socket.id
        });
      });

      // Forward WebRTC answer
      socket.on('answer', ({ answer, to }) => {
        logger.info(`WebRTC: Forwarding answer from ${socket.id} to ${to}`);
        socket.to(to).emit('answer', {
          answer,
          from: socket.id
        });
      });

      // Forward ICE candidate
      socket.on('ice-candidate', ({ candidate, to }) => {
        logger.info(`WebRTC: Forwarding ICE candidate from ${socket.id} to ${to}`);
        socket.to(to).emit('ice-candidate', {
          candidate,
          from: socket.id
        });
      });

      // Handle call end
      socket.on('end-call', ({ roomId } = {}) => {
        // If roomId is provided, only disconnect if the user is currently in THAT room
        // This prevents race conditions where a cleanup from a previous room (e.g. 'default')
        // accidentally kills the connection to the new room (e.g. 'room_123')
        const currentUserData = this.users.get(socket.id);
        if (roomId && currentUserData && currentUserData.roomId !== roomId) {
          logger.info(`WebRTC: Ignoring stale end-call for room ${roomId} (currently in ${currentUserData.roomId})`);
          return;
        }

        this.handleDisconnect(socket);
      });

      // ========== CHAT EVENTS ==========

      // Request a chat match (client or listener)
      socket.on('request-chat-match', ({ name, email, role }) => {
        if (!this.matchmaking.onlineUsers.has(socket.id)) {
          this.matchmaking.goOnline(socket.id, { name, email, role });
        }
        const result = this.matchmaking.requestChatMatch(socket.id);
        if (result.status === 'waiting') {
          socket.emit('chat-waiting', { message: 'Looking for a match...' });
        }
      });

      // Request a peer-to-peer chat match (client↔client)
      socket.on('request-peer-chat-match', ({ name, email, role }) => {
        const actualRole = role || 'client';
        if (actualRole === 'listener' || actualRole === 'therapist') {
          socket.emit('match-error', { error: 'Only registered clients can use peer-to-peer chat.' });
          return;
        }
        if (!this.matchmaking.onlineUsers.has(socket.id)) {
          this.matchmaking.goOnline(socket.id, { name, email, role: 'client' });
        } else {
          const existing = this.matchmaking.onlineUsers.get(socket.id);
          if (existing) { existing.role = 'client'; }
        }
        const result = this.matchmaking.requestPeerChatMatch(socket.id);
        if (result.success && result.status === 'waiting') {
          socket.emit('chat-waiting', { message: 'Looking for a peer to chat with...' });
        } else if (!result.success) {
          socket.emit('match-error', { error: result.error });
        }
      });

      // Join a chat room after match
      socket.on('join-chat-room', ({ roomId, role }) => {
        socket.join(roomId);
        this.chatUsers.set(socket.id, { roomId, role });
        if (!this.chatRooms.has(roomId)) this.chatRooms.set(roomId, {});
        this.chatRooms.get(roomId)[role] = socket.id;
        logger.info(`💬 ${socket.id} joined chat room ${roomId} as ${role}`);
      });

      // Relay a chat message to the other peer in the room
      socket.on('send-message', ({ roomId, text, senderName }) => {
        socket.to(roomId).emit('receive-message', { text, senderName, timestamp: Date.now() });
      });

      // Relay typing indicator
      socket.on('typing', ({ roomId, isTyping, senderName }) => {
        socket.to(roomId).emit('user-typing', { isTyping, senderName });
      });

      // One peer proposes upgrading to a voice call
      socket.on('propose-call', ({ roomId }) => {
        this.pendingCallProposals.set(roomId, socket.id);
        socket.to(roomId).emit('call-proposed');
        logger.info(`📞 Call proposed in chat room ${roomId} by ${socket.id}`);
      });

      // The other peer accepts the call upgrade
      socket.on('accept-call', ({ roomId }) => {
        const proposer = this.pendingCallProposals.get(roomId);
        if (!proposer) return;
        this.pendingCallProposals.delete(roomId);

        const acceptorData = this.chatUsers.get(socket.id);
        const proposerData = this.chatUsers.get(proposer);

        // Chat 'client' → WebRTC 'user' (initiator); 'listener' stays 'listener'
        const acceptorRole = acceptorData?.role === 'listener' ? 'listener' : 'user';
        const proposerRole = proposerData?.role === 'listener' ? 'listener' : 'user';

        this.io.to(socket.id).emit('call-upgrade-approved', { roomId, role: acceptorRole });
        this.io.to(proposer).emit('call-upgrade-approved', { roomId, role: proposerRole });
        logger.info(`✅ Call upgrade approved in room ${roomId}`);
      });

      // The other peer rejects the call upgrade
      socket.on('reject-call', ({ roomId }) => {
        this.pendingCallProposals.delete(roomId);
        socket.to(roomId).emit('call-rejected');
      });

      // End a chat session
      socket.on('end-chat', ({ roomId }) => {
        socket.to(roomId).emit('chat-ended', { message: 'Your chat partner ended the session.' });
        this.cleanupChatRoom(socket, roomId);
      });

      // Handle disconnect
      socket.on('disconnect', () => {
        logger.info(`WebRTC: Connection closed - ${socket.id}`);
        this.handleDisconnect(socket);

        // Remove from matchmaking
        const stats = this.matchmaking.goOffline(socket.id);
        if (stats) {
          this.io.emit('queue-update', stats);
        }

        // Clean up any matches
        const cleanupResult = this.matchmaking.cleanupMatchesForSocket(socket.id);
        if (cleanupResult) {
          // Notify the other peer
          this.io.to(cleanupResult.otherSocketId).emit('peer-disconnected', {
            message: 'Your call partner disconnected'
          });
        }
      });
    });

    logger.info('WebRTC Signaling Server with Matchmaking initialized');
  }

  handleDisconnect(socket) {
    const userData = this.users.get(socket.id);

    if (userData) {
      const { roomId, role } = userData;
      const room = this.rooms.get(roomId);

      if (room) {
        // Log the call when both peers were present and call actually started
        if (room.user && room.listener && room.startedAt) {
          const durationMs = Date.now() - room.startedAt;
          const durationMinutes = Math.max(1, Math.round(durationMs / 60000));
          this._logCall(room, durationMinutes);
          room.startedAt = null; // Prevent double-logging if other peer disconnects too
        }
        socket.to(roomId).emit('peer-left', { role });
        delete room[role];
        if (!room.user && !room.listener) {
          this.rooms.delete(roomId);
          logger.info(`WebRTC: Room ${roomId} deleted - empty`);
        }
      }

      this.users.delete(socket.id);
      socket.leave(roomId);
    }

    // Also clean up any chat room this socket was in
    const chatData = this.chatUsers.get(socket.id);
    if (chatData) {
      this.cleanupChatRoom(socket, chatData.roomId);
    }
  }

  cleanupChatRoom(socket, roomId) {
    const chatData = this.chatUsers.get(socket.id);
    if (chatData) {
      this.chatUsers.delete(socket.id);
    }

    const room = this.chatRooms.get(roomId);
    if (room) {
      const role = chatData?.role;
      if (role) delete room[role];
      if (!room.client && !room.listener && !room.peer1 && !room.peer2) {
        this.chatRooms.delete(roomId);
        this.pendingCallProposals.delete(roomId);
        logger.info(`💬 Chat room ${roomId} deleted - empty`);
      }
    }
  }

  async _logCall(room, durationMinutes) {
    if (!this.matchmaking?.getDB) {
      logger.error('_logCall: matchmaking.getDB not available — call not logged!');
      return;
    }
    try {
      const listenerInfo = this.matchmaking.onlineUsers.get(room.listener);
      const userInfo = this.matchmaking.onlineUsers.get(room.user);
      if (!listenerInfo?.email) {
        logger.error(`_logCall: listenerInfo missing for socket ${room.listener} — call not logged!`);
        return;
      }
      const db = this.matchmaking.getDB();

      // Normalize emails to lowercase so analytics queries always match
      const listenerEmail = listenerInfo.email.toLowerCase();
      const clientEmail = userInfo?.email ? userInfo.email.toLowerCase() : null;

      await db.collection('callLogs').insertOne({
        listenerEmail,
        listenerName: listenerInfo.name || null,
        counterpart: 'listener',
        clientEmail,
        type: 'call',
        durationMinutes,
        startedAt: new Date(room.startedAt || Date.now() - durationMinutes * 60000),
        endedAt: new Date(),
      });
      logger.info(`✅ callLogs insert OK: listener=${listenerEmail} client=${clientEmail} dur=${durationMinutes}min`);

      // Keep listener profile totals in sync
      const updateResult = await db.collection('users').updateOne(
        { email: listenerEmail },
        {
          $inc: {
            'listenerProfile.totalCalls': 1,
            'listenerProfile.totalMinutes': durationMinutes,
          },
          $set: { updatedAt: new Date() },
        }
      );
      logger.info(`✅ Listener profile updated: matchedCount=${updateResult.matchedCount} modifiedCount=${updateResult.modifiedCount}`);
    } catch (e) {
      logger.error('_logCall FAILED:', e);
    }
  }

  // Get active rooms count (for monitoring)
  getActiveRoomsCount() {
    return this.rooms.size;
  }

  // Get active connections count
  getActiveConnectionsCount() {
    return this.users.size;
  }
}

module.exports = SignalingServer;
