// --- Required Node.js Modules ---
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs/promises'); // Still needed for file uploads, but not for chat logs
const path = require('path');     // To handle file paths correctly
const cors = require('cors');     // For handling Cross-Origin Resource Sharing
const multer = require('multer'); // For handling multipart/form-data file uploads
const mysql = require('mysql2/promise'); // NEW: MySQL promise-based driver

// --- Server Setup ---
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", // Allow all origins for development. In production, specify your client's domain.
        methods: ["GET", "POST"]
    }
});

// Serve static files (your HTML, CSS, JS, images).
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json({ limit: '10mb' }));

// --- MySQL Database Connection (FIXED) ---
// This configuration now matches your XAMPP setup.
const dbConfig = {
    host: 'localhost',
    port: 3306, // CORRECTED: Matches the port shown in your XAMPP control panel.
    user: 'root',
    password: '', // CORRECTED: Use an empty password for the default XAMPP user.
    database: 'chat_app_db'
};

// Create a connection pool
const pool = mysql.createPool(dbConfig);

// Function to test the database connection on startup
async function testDbConnection() {
    try {
        const connection = await pool.getConnection();
        console.log('[MySQL] Successfully connected to the database.');
        connection.release(); // Release the connection back to the pool
    } catch (error) {
        console.error('[MySQL] !!! CRITICAL: Could not connect to the database. !!!');
        console.error(`[MySQL] Error: ${error.message}`);
        console.error('[MySQL] Please check your dbConfig in server.js and ensure the MySQL server is running.');
        // Exit the process if the database connection fails, as the app cannot function.
        process.exit(1);
    }
}


// --- Directories Setup ---
// We only need the uploads directory now for persistent storage.
const uploadDir = path.join(__dirname, 'public', 'uploads');

// Ensure the uploads directory exists on server startup
fs.mkdir(uploadDir, { recursive: true })
    .then(() => console.log('Uploads directory ensured.'))
    .catch(err => console.error('Failed to create uploads directory:', err));


// --- Multer Setup ---
// Configure Multer to store uploaded files temporarily
const upload = multer({ dest: path.join(__dirname, 'temp_uploads/') });
fs.mkdir(path.join(__dirname, 'temp_uploads'), { recursive: true })
    .then(() => console.log('Multer temp_uploads directory ensured.'))
    .catch(err => console.error('Failed to create Multer temp_uploads directory:', err));


// --- In-Memory User Management (Room info is now in DB) ---
const usersInRooms = new Map(); // Map: socket.id -> { username, room }

// --- File Upload Endpoint (Unchanged) ---
app.post('/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file data received.' });
        }
        const uploadedFile = req.file;
        const tempPath = uploadedFile.path;
        const originalExtension = path.extname(uploadedFile.originalname || '');
        const filename = `upload_${Date.now()}_${Math.random().toString(36).substring(2, 8)}${originalExtension}`;
        const newFilePath = path.join(uploadDir, filename);
        await fs.rename(tempPath, newFilePath);
        const fileUrl = `/uploads/${filename}`;
        res.status(200).json({ url: fileUrl, message: 'File uploaded successfully' });
    } catch (error) {
        console.error('[Upload Server] Server-side error during file upload with Multer:', error);
        if (req.file && req.file.path) {
            try { await fs.unlink(req.file.path); } catch (cleanupErr) { console.error('[Upload Server] Failed to clean up temp file:', cleanupErr); }
        }
        res.status(500).json({ error: 'Failed to upload file.' });
    }
});


// --- NEW: Chat History Database Operations ---

/**
 * Ensures a room exists in the database. If not, it creates it.
 * @param {string} roomId - The ID of the room.
 * @returns {Promise<void>}
 */
async function createOrGetRoomInDb(roomId) {
    const sql = 'INSERT INTO rooms (room_id, created_at) VALUES (?, NOW()) ON DUPLICATE KEY UPDATE room_id=room_id;';
    try {
        await pool.query(sql, [roomId]);
        console.log(`[MySQL] Ensured room "${roomId}" exists in the database.`);
    } catch (error) {
        console.error(`[MySQL] Error ensuring room "${roomId}" exists in DB:`, error);
    }
}

/**
 * Saves a single chat message to the database.
 * @param {string} room - The room ID.
 * @param {object} messageObj - The message object { username, message, fileUrl, timestamp (ISO string) }.
 */
async function saveChatMessage(room, messageObj) {
    // **THE FIX:** The SQL query is now a clean, single-line string to prevent parsing errors.
    const sql = `INSERT INTO chat_history (room_id_fk, username, message, file_url, timestamp) VALUES (?, ?, ?, ?, ?);`;
    const params = [
        room,
        messageObj.username,
        messageObj.message,
        messageObj.fileUrl,
        new Date(messageObj.timestamp) // Convert ISO string to MySQL DATETIME compatible format
    ];

    try {
        await pool.query(sql, params);
        console.log(`[MySQL] SUCCESS: Saved message for room "${room}" to database.`);
    } catch (error) {
        console.error(`[MySQL] ERROR: Failed to save message for room "${room}". Reason:`, error);
    }
}

/**
 * Loads all chat history for a given room from the database.
 * @param {string} room - The room ID.
 * @returns {Promise<Array<object>>} A promise that resolves to an array of message objects.
 */
async function loadChatHistory(room) {
    const sql = `SELECT username, message, file_url, timestamp FROM chat_history WHERE room_id_fk = ? ORDER BY timestamp ASC;`;
    try {
        const [rows] = await pool.query(sql, [room]);
        console.log(`[MySQL] Loaded ${rows.length} messages for room "${room}".`);
        // Convert rows to the format the client expects (with ISO timestamp)
        return rows.map(row => ({
            username: row.username,
            message: row.message,
            fileUrl: row.file_url,
            timestamp: new Date(row.timestamp).toISOString()
        }));
    } catch (error) {
        console.error(`[MySQL] Error loading chat history for room "${room}":`, error);
        return []; // Return empty array on error
    }
}


// --- Socket.IO Connection Handling ---
io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    // --- Room Creation ---
    socket.on('room:create', async (data) => {
        const { room, username } = data;
        if (!username) {
            return socket.emit('error', 'Username is required to create a room.');
        }
        if (io.sockets.adapter.rooms.has(room)) {
            return socket.emit('error', `Room ${room} already exists. Please choose another ID or join it.`);
        }

        socket.join(room);
        usersInRooms.set(socket.id, { username, room });
        console.log(`${username} (${socket.id}) created and joined room: ${room}`);

        // NEW: Ensure room exists in the database
        await createOrGetRoomInDb(room);

        socket.emit('room:created', { room: room });
        socket.to(room).emit('user:joined', { id: socket.id, username: username });
    });

    // --- Room Joining ---
    socket.on('room:join', async (data) => {
        const { room, username } = data;
        if (!username || !room) {
            return socket.emit('error', 'Username and Room ID are required to join a room.');
        }

        const roomExists = io.sockets.adapter.rooms.has(room);
        if (!roomExists) {
            return socket.emit('room:not-found');
        }

        const roomSize = io.sockets.adapter.rooms.get(room).size || 0;
        if (roomSize >= 2) {
            return socket.emit('room:full');
        }

        socket.join(room);
        usersInRooms.set(socket.id, { username, room });
        console.log(`${username} (${socket.id}) joined room: ${room}`);

        // NEW: Ensure room exists in the database
        await createOrGetRoomInDb(room);
        // NEW: Load history from the database
        const chatHistory = await loadChatHistory(room);

        const socketsInRoom = await io.in(room).fetchSockets();
        const usersPresentInRoom = socketsInRoom
            .filter(s => s.id !== socket.id)
            .map(s => usersInRooms.get(s.id))
            .filter(Boolean);

        socket.emit('room:joined', {
            room: room,
            username: username,
            usersInRoom: usersPresentInRoom,
            chatHistory: chatHistory // Send DB history to client
        });

        socket.to(room).emit('user:joined', { id: socket.id, username: username });
    });

    // --- WebRTC Signaling (Unchanged) ---
    socket.on('webrtc:offer', (data) => {
        socket.to(data.targetSocketId).emit('webrtc:offer', {
            offer: data.offer,
            senderSocketId: socket.id,
            senderUsername: usersInRooms.get(socket.id)?.username || 'Unknown User'
        });
    });

    socket.on('webrtc:answer', (data) => {
        socket.to(data.targetSocketId).emit('webrtc:answer', {
            answer: data.answer,
            senderSocketId: socket.id,
            senderUsername: usersInRooms.get(socket.id)?.username || 'Unknown User'
        });
    });

    socket.on('webrtc:ice-candidate', (data) => {
        socket.to(data.targetSocketId).emit('webrtc:ice-candidate', {
            candidate: data.candidate,
            senderSocketId: socket.id
        });
    });

    // --- Chat Message Handling (FINAL, ROBUST VERSION) ---
    socket.on('chat:message', async (data) => {
        try {
            // Log the raw incoming data from the client for debugging
            console.log('[Chat Server] Received "chat:message" event with data:', data);

            // Get the sender's info first to ensure they are registered in a room
            const senderInfo = usersInRooms.get(socket.id);

            // More robust check to ensure the user is properly registered
            if (!senderInfo || !senderInfo.room) {
                console.warn(`[Chat Server] User ${socket.id} sent a message but is not in a valid room. Message will not be saved or broadcast.`);
                return;
            }

            // Get the room ID reliably from the server's state, not the client's packet
            const room = senderInfo.room;

            // Construct the definitive payload on the server to ensure data integrity
            const payloadToBroadcastAndSave = {
                username: senderInfo.username,
                message: data.message,
                fileUrl: data.fileUrl || null,
                timestamp: new Date().toISOString(),
                senderId: socket.id
            };

            // Broadcast the message to everyone in the correct room
            io.to(room).emit('chat:message', payloadToBroadcastAndSave);
            console.log(`[Chat Server] Message broadcasted to room: "${room}"`);

            // Save the message to the database for that room
            await saveChatMessage(room, payloadToBroadcastAndSave);

        } catch (error) {
            console.error('[Chat Server] A critical error occurred in the chat:message handler:', error);
        }
    });

    // --- Typing Indicator Handling (Unchanged) ---
    socket.on('chat:typing', (data) => {
        const { room, isTyping } = data;
        const senderInfo = usersInRooms.get(socket.id);
        if (senderInfo) {
            socket.to(room).emit('chat:typing', {
                username: senderInfo.username,
                isTyping: isTyping
            });
        }
    });

    // --- Get Peer Username (Unchanged) ---
    socket.on('get:peer:username', (data) => {
        const peerInfo = usersInRooms.get(data.peerId);
        if (peerInfo) {
            socket.emit('get:peer:username:response', {
                peerId: data.peerId,
                username: peerInfo.username
            });
        }
    });

    // --- Disconnect Handling (Simplified) ---
    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
        const disconnectedUserInfo = usersInRooms.get(socket.id);

        if (disconnectedUserInfo) {
            const { username, room } = disconnectedUserInfo;
            usersInRooms.delete(socket.id);
            socket.to(room).emit('user:left', { id: socket.id, username: username });
            console.log(`${username} (${socket.id}) left room: ${room}`);
        }
        // No file system cleanup is needed anymore.
    });
});


// --- Start the Server ---
const PORT = process.env.PORT || 3000;
server.listen(PORT, async () => {
    console.log(`Server running on port ${PORT}`);
    // Test the database connection when the server starts
    await testDbConnection();
    const now = new Date();
    console.log(`Server started at ${now.toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'long' })} (City of Batac, Ilocos Region, Philippines)`);
    console.log(`Access the application at http://localhost:${PORT}`);
});
