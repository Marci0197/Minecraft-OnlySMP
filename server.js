const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const cron = require('node-cron');
const { v4: uuidv4 } = require('uuid');
const util = require('minecraft-server-util');

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

// --- Configuration ---
const MC_SERVER_HOST = 'onlysmp.ddns.net';
const MC_SERVER_PORT = 25567; // Query Port

// --- Data Store ---
let players = [];
let deaths = [];

// Persistent Stats (Store kills/deaths even if player goes offline)
// Key: Player Name, Value: { kills: 0, deaths: 0 }
const playerStats = new Map();

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

// --- Helper Functions ---
function getPlayerStats(name) {
    if (!playerStats.has(name)) {
        playerStats.set(name, { kills: 0, deaths: 0 });
    }
    return playerStats.get(name);
}

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
    // Convert current players list + potentially offline high-scorers (optional, for now just active)
    // To include everyone seen since server start, we could iterate playerStats. 
    // For simplicity, we stick to "Active Players" list for the main grid, but the leaderboard could come from stats.
    // Let's mix: All active players + anyone in stats with > 0 kills

    const leaderboard = [];
    playerStats.forEach((stats, name) => {
        leaderboard.push({ name, ...stats });
    });

    // Sort
    const sorted = leaderboard.sort((a, b) => b.kills - a.kills);
    res.json(sorted);
});

app.get('/api/deaths/today', (req, res) => {
    const sortedDeaths = [...deaths].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    res.json(sortedDeaths);
});

// --- Fetch Real Players ---
async function updatePlayersObject() {
    try {
        const result = await util.queryFull(MC_SERVER_HOST, MC_SERVER_PORT);
        const onlinePlayerNames = result.players.list || [];

        // Map to our player object format
        const currentPlayers = onlinePlayerNames.map(name => {
            const stats = getPlayerStats(name);
            return {
                id: uuidv4(), // Generate a temp session ID (or hash name for stability if needed)
                name: name,
                kills: stats.kills,
                deaths: stats.deaths,
                joinedAt: new Date().toISOString() // In a real app we'd track session start
            };
        });

        // Update global list
        players = currentPlayers;

        // Broadcast the real list
        io.emit('playerListUpdate', players);

        console.log(`Updated players: ${players.length} online.`);
    } catch (error) {
        console.error('Failed to query Minecraft Server:', error.message);
        // On error, we might want to clear the list or keep last known state. 
        // Clearing it usually safer so we don't show ghosts.
        if (players.length > 0) {
            players = [];
            io.emit('playerListUpdate', players);
        }
    }
}

// --- Test Endpoint (For Verification) ---
app.post('/api/test-event', (req, res) => {
    // Force a death event for testing
    const fakeVictim = { name: "Test_Victim", id: uuidv4() };
    const fakeKiller = { name: "Test_Killer", id: uuidv4() };

    const newDeath = {
        id: uuidv4(),
        victimId: fakeVictim.id,
        victimName: fakeVictim.name,
        killerName: fakeKiller.name,
        timestamp: new Date().toISOString(),
        message: `${fakeVictim.name} was slain by ${fakeKiller.name} (TEST)`
    };

    io.emit('deathAdded', newDeath);
    res.json({ success: true, message: "Test death event triggered", data: newDeath });
});

// --- Simulation Loop (Kills/Deaths ONLY for Online Players) ---
setInterval(() => {
    // 1. Fetch Real Players
    updatePlayersObject();

    // 2. Simulate Events if we have players
    if (players.length >= 2) {
        const eventType = Math.random();

        // 20% chance of a kill event every 5s if players exist
        if (eventType < 0.2) {
            const killerIndex = Math.floor(Math.random() * players.length);
            const victimIndex = Math.floor(Math.random() * players.length);

            if (killerIndex !== victimIndex) {
                const killer = players[killerIndex];
                const victim = players[victimIndex];

                // Update Stats
                const killerStats = getPlayerStats(killer.name);
                const victimStats = getPlayerStats(victim.name);

                killerStats.kills += 1;
                victimStats.deaths += 1;

                // Sync back to current objects
                killer.kills = killerStats.kills;
                victim.deaths = victimStats.deaths;

                // Emit Kill Update
                io.emit('killUpdated', {
                    killerName: killer.name, // Use Names for matching now
                    newKills: killer.kills,
                    victimName: victim.name,
                    newDeaths: victim.deaths
                });

                // Create Death Event
                const newDeath = {
                    id: uuidv4(),
                    victimId: victim.id,
                    victimName: victim.name,
                    killerName: killer.name,
                    timestamp: new Date().toISOString(),
                    message: `${victim.name} was slain by ${killer.name}`
                };

                deaths.unshift(newDeath);
                if (deaths.length > 100) deaths.pop();

                io.emit('deathAdded', newDeath);
                console.log(`[SIM] Kill: ${killer.name} -> ${victim.name}`);
            }
        } else if (eventType < 0.25) {
            // 5% Chance of random environmental death
            const victimIndex = Math.floor(Math.random() * players.length);
            const victim = players[victimIndex];
            const stats = getPlayerStats(victim.name);
            stats.deaths += 1;
            victim.deaths = stats.deaths;

            const cause = deathCauses[Math.floor(Math.random() * deathCauses.length)];

            io.emit('killUpdated', {
                victimName: victim.name,
                newDeaths: victim.deaths
            });

            const newDeath = {
                id: uuidv4(),
                victimId: victim.id,
                victimName: victim.name,
                killerName: null, // No killer
                cause: cause,
                timestamp: new Date().toISOString(),
                message: `${victim.name} ${cause}`
            };

            deaths.unshift(newDeath);
            if (deaths.length > 100) deaths.pop();
            io.emit('deathAdded', newDeath);
            console.log(`[SIM] Env Death: ${victim.name}`);
        }
    }
}, 5000);

// --- Socket.io Events ---
io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);
    socket.emit('playerListUpdate', players); // Send immediate state
    socket.on('disconnect', () => console.log('Client disconnected:', socket.id));
});

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    // Initial fetch
    updatePlayersObject();
});
