const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const cron = require('node-cron');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.use(cors());
app.use(express.static('public'));

// --- Mock Data Store ---
let players = [];
let deaths = [];

// No initial data - server starts empty

const deathCauses = [
    "was blown up by Creeper",
    "fell from a high place",
    "tried to swim in lava",
    "was shot by Skeleton",
    "starved to death",
    "suffocated in a wall",
    "drowned",
    "experienced kinetic energy",
    "was slain by Zombie",
    "hit the ground too hard"
];

// --- Scheduled Tasks ---
cron.schedule('0 0 * * *', () => {
    console.log('Resetting daily death list...');
    deaths = [];
    io.emit('deathsReset');
});

// --- API Endpoints ---
app.get('/api/players', (req, res) => {
    res.json(players);
});

app.get('/api/leaderboard/kills', (req, res) => {
    const sortedPlayers = [...players].sort((a, b) => b.kills - a.kills);
    res.json(sortedPlayers);
});

app.get('/api/deaths/today', (req, res) => {
    // Return deaths sorted by latest
    const sortedDeaths = [...deaths].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    res.json(sortedDeaths);
});

// Test Endpoint to trigger events manually
app.post('/api/test-event', (req, res) => {
    const eventType = Math.random();
    let result = {};

    if (eventType < 0.5) {
        // Trigger Kill
        const killerIndex = Math.floor(Math.random() * players.length);
        const victimIndex = Math.floor(Math.random() * players.length);

        if (killerIndex !== victimIndex) {
            players[killerIndex].kills += 1;
            players[victimIndex].deaths += 1;

            const killData = {
                killerId: players[killerIndex].id,
                newKills: players[killerIndex].kills,
                victimId: players[victimIndex].id,
                newDeaths: players[victimIndex].deaths
            };

            io.emit('killUpdated', killData);

            const newDeath = {
                id: uuidv4(),
                victimId: players[victimIndex].id,
                victimName: players[victimIndex].name,
                killerName: players[killerIndex].name,
                timestamp: new Date().toISOString(),
                message: `${players[victimIndex].name} was slain by ${players[killerIndex].name}`
            };
            deaths.unshift(newDeath);
            if (deaths.length > 100) deaths.pop();

            io.emit('deathAdded', newDeath);
            result = { type: 'kill', data: newDeath };
        } else {
            return res.status(400).json({ error: "Failed to generate valid kill (self-kill)" });
        }
    } else {
        // Trigger Join
        const newPlayerName = `Guest_${Math.floor(Math.random() * 9000) + 1000}`;
        const newPlayer = {
            id: uuidv4(),
            name: newPlayerName,
            kills: 0,
            deaths: 0,
            joinedAt: new Date().toISOString()
        };
        players.push(newPlayer);
        io.emit('playerJoined', newPlayer);
        result = { type: 'join', data: newPlayer };
    }

    res.json({ success: true, event: result });
});

// --- Socket.io Events ---
io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);
    socket.on('disconnect', () => console.log('Client disconnected:', socket.id));
});

// --- Simulation ---
setInterval(() => {
    const eventType = Math.random();

    if (eventType < 0.4) { // Increased frequency for demo life
        // Kill Event
        const killerIndex = Math.floor(Math.random() * players.length);
        const victimIndex = Math.floor(Math.random() * players.length);

        if (killerIndex !== victimIndex) {
            players[killerIndex].kills += 1;
            players[victimIndex].deaths += 1;

            io.emit('killUpdated', {
                killerId: players[killerIndex].id,
                newKills: players[killerIndex].kills,
                victimId: players[victimIndex].id,
                newDeaths: players[victimIndex].deaths
            });

            // Update deaths
            const newDeath = {
                id: uuidv4(),
                victimId: players[victimIndex].id,
                victimName: players[victimIndex].name,
                killerName: players[killerIndex].name,
                timestamp: new Date().toISOString(),
                message: `${players[victimIndex].name} was slain by ${players[killerIndex].name}`
            };

            deaths.unshift(newDeath);
            // Keep death list manageable in memory
            if (deaths.length > 100) deaths.pop();

            io.emit('deathAdded', newDeath);
        }
    } else if (eventType < 0.05) {
        // Player Join (Rare)
        // reuse existing names logic or create generic ones if we run out (for demo we just add Guest)
        const newPlayerName = `Guest_${Math.floor(Math.random() * 9000) + 1000}`;
        const newPlayer = {
            id: uuidv4(),
            name: newPlayerName,
            kills: 0,
            deaths: 0,
            joinedAt: new Date().toISOString()
        };
        players.push(newPlayer);
        io.emit('playerJoined', newPlayer);
    }
}, 5000); // More frequent updates (every 5s) for better "alive" feeling

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
