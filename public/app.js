const socket = io();
const apiBase = '/api';
const SERVER_IP = "onlysmp.ddns.net";

// State
let allPlayers = [];
let deaths = [];

// DOM Elements
const playerCountEl = document.getElementById('player-count');
const leaderboardBody = document.getElementById('leaderboard-body');
const topThreeContainer = document.getElementById('top-three-container');
const playersGrid = document.getElementById('players-grid');
const deathFeed = document.getElementById('death-feed');
const noDeathsMsg = document.getElementById('no-deaths-msg');
const mobileMenuBtn = document.getElementById('mobile-menu-btn');
const mobileMenu = document.getElementById('mobile-menu');

// Initial Load
document.addEventListener('DOMContentLoaded', () => {
    // Set Server IP in UI
    const ipText = document.getElementById('ip-text');
    if (ipText) ipText.innerText = SERVER_IP;

    initAnimations();
    fetchData();
    setupMobileMenu();
});

function setupMobileMenu() {
    mobileMenuBtn.addEventListener('click', () => {
        mobileMenu.classList.toggle('hidden');
    });

    // Close menu when clicking a link
    document.querySelectorAll('.mobile-link').forEach(link => {
        link.addEventListener('click', () => {
            mobileMenu.classList.add('hidden');
        });
    });
}

function initAnimations() {
    const tl = gsap.timeline();
    tl.to("#hero-title", { opacity: 1, y: 0, duration: 1, ease: "power4.out" })
        .to("#hero-subtitle", { opacity: 1, y: 0, duration: 1, ease: "power3.out" }, "-=0.5")
        .to("#hero-cta", { opacity: 1, y: 0, duration: 0.8, ease: "power2.out" }, "-=0.5");
}

async function fetchData() {
    try {
        const [playersRes, deathsRes] = await Promise.all([
            fetch(`${apiBase}/players`),
            fetch(`${apiBase}/deaths/today`)
        ]);

        allPlayers = await playersRes.json();
        deaths = await deathsRes.json();

        updateUI();
    } catch (error) {
        console.error("Failed to fetch data:", error);
    }
}

function updateUI() {
    renderPlayerCount();
    renderLeaderboard();
    renderPlayersGrid();
    renderDeathFeed();
}

function renderPlayerCount() {
    // Animate the number change
    const currentVal = parseInt(playerCountEl.innerText);
    const newVal = allPlayers.length;

    gsap.to(playerCountEl, {
        innerText: newVal,
        duration: 1,
        snap: { innerText: 1 },
        ease: "power2.out",
        onUpdate: function () {
            playerCountEl.innerText = Math.round(this.targets()[0].innerText);
        }
    });
}

function renderLeaderboard() {
    // Sort by kills
    const sorted = [...allPlayers].sort((a, b) => b.kills - a.kills);
    const top3 = sorted.slice(0, 3);
    const rest = sorted.slice(3, 10); // Top 4-10

    // Render Top 3 Cards
    topThreeContainer.innerHTML = top3.map((p, index) => {
        let rankClass = index === 0 ? 'text-yellow-400 border-yellow-500/50 shadow-yellow-500/20' :
            index === 1 ? 'text-gray-300 border-gray-400/50 shadow-gray-400/20' :
                'text-orange-400 border-orange-500/50 shadow-orange-500/20';

        // Make 1st place larger
        let classes = index === 0 ? 'md:-mt-8 z-10 scale-110' : '';
        let crown = index === 0 ? '<div class="absolute -top-6 text-3xl">👑</div>' : '';

        return `
            <div class="glass-panel p-6 rounded-2xl flex flex-col items-center relative ${classes} border ${rankClass.split(' ')[1]} transition-transform hover:scale-105">
                ${crown}
                <div class="w-20 h-20 rounded-lg overflow-hidden mb-4 border-2 border-white/20">
                    <img src="https://mc-heads.net/avatar/${p.name}" alt="${p.name}" class="w-full h-full object-cover">
                </div>
                <h3 class="text-xl font-bold ${rankClass.split(' ')[0]} mb-1">${p.name}</h3>
                <div class="text-sm text-gray-400 mb-2">Rank #${index + 1}</div>
                <div class="text-3xl font-bold text-white">${p.kills} <span class="text-xs text-gray-500 align-middle">KILLS</span></div>
            </div>
        `;
    }).join('');

    // Render Table
    leaderboardBody.innerHTML = rest.map((p, i) => `
        <tr class="hover:bg-white/5 transition-colors group">
            <td class="py-3 pl-4 text-gray-500 font-mono group-hover:text-white">#${i + 4}</td>
            <td class="py-3 flex items-center gap-3">
                <img src="https://mc-heads.net/avatar/${p.name}/24" class="rounded-sm">
                <span class="font-medium text-gray-300 group-hover:text-green-400 transition-colors">${p.name}</span>
            </td>
            <td class="py-3 text-right font-bold text-white">${p.kills}</td>
            <td class="py-3 text-right pr-4 text-gray-500">${p.deaths}</td>
        </tr>
    `).join('');
}

function renderPlayersGrid() {
    playersGrid.innerHTML = allPlayers.map(p => `
        <div class="glass-panel p-4 rounded-xl flex items-center gap-4 player-card group cursor-pointer">
            <div class="w-12 h-12 rounded bg-gray-800 overflow-hidden shrink-0 group-hover:ring-2 ring-green-400 transition-all">
                <img src="https://mc-heads.net/avatar/${p.name}" loading="lazy" class="w-full h-full">
            </div>
            <div class="overflow-hidden">
                <h4 class="font-bold text-gray-200 group-hover:text-white truncate">${p.name}</h4>
                <div class="text-xs text-gray-500 flex gap-2">
                    <span>⚔️ ${p.kills}</span>
                    <span>☠️ ${p.deaths}</span>
                </div>
            </div>
        </div>
    `).join('');
}

function renderDeathFeed() {
    if (deaths.length === 0) {
        if (noDeathsMsg) noDeathsMsg.style.display = 'block';
        return;
    }

    if (noDeathsMsg) noDeathsMsg.style.display = 'none';

    // We'll just prepend new ones, but for full render:
    deathFeed.innerHTML = deaths.map(d => createDeathItemHTML(d)).join('');
}

function createDeathItemHTML(death) {
    const time = new Date(death.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `
        <div class="p-4 border-b border-white/5 hover:bg-red-500/5 transition-colors flex items-center gap-4 animate-fade-in-down">
            <span class="text-xs font-mono text-gray-500">${time}</span>
            <img src="https://mc-heads.net/avatar/${death.victimName}/32" class="w-8 h-8 rounded opacity-80 grayscale hover:grayscale-0 transition-all">
            <div class="text-sm text-gray-300">
                <span class="text-red-400 font-bold">${death.victimName}</span>
                <span class="opacity-70">${death.message.replace(death.victimName, '').replace(death.killerName || '???', '')}</span>
                ${death.killerName ? `<span class="text-green-400 font-bold">${death.killerName}</span>` : ''}
            </div>
        </div>
    `;
}

// Helper to Copy IP
window.copyIP = function () {
    navigator.clipboard.writeText(SERVER_IP);

    const btnText = document.getElementById('ip-text');
    const originalText = btnText.innerText;

    btnText.innerText = "COPIED!";
    document.getElementById('ip-btn').classList.add('bg-green-500/30');

    setTimeout(() => {
        btnText.innerText = originalText;
        document.getElementById('ip-btn').classList.remove('bg-green-500/30');
    }, 2000);
}

// --- Socket Listeners ---

socket.on('playerListUpdate', (players) => {
    // Replace full list
    allPlayers = players;
    updateUI();
});

socket.on('playerJoined', (newPlayer) => {
    // Legacy support or single redundant update
    const exists = allPlayers.find(p => p.id === newPlayer.id);
    if (!exists) {
        allPlayers.push(newPlayer);
        updateUI();
    }
});

socket.on('killUpdated', (data) => {
    // Update local state by Name since IDs might regenerate on fetch
    const killer = allPlayers.find(p => p.name === data.killerName);
    if (killer) killer.kills = data.newKills;

    const victim = allPlayers.find(p => p.name === data.victimName);
    if (victim) victim.deaths = data.newDeaths;

    renderLeaderboard(); // Re-sort and render
    renderPlayersGrid(); // Update cards
});

socket.on('deathAdded', (newDeath) => {
    deaths.unshift(newDeath); // Add to top
    if (noDeathsMsg) noDeathsMsg.style.display = 'none';

    const html = createDeathItemHTML(newDeath);
    if (deathFeed) {
        deathFeed.insertAdjacentHTML('afterbegin', html);
        // Animate the new entry
        gsap.from(deathFeed.firstElementChild, {
            height: 0,
            opacity: 0,
            x: -20,
            duration: 0.5,
            clearProps: "all"
        });
    }

    // Trigger Death Screen
    showDeathScreen(newDeath);
});

socket.on('deathsReset', () => {
    deaths = [];
    renderDeathFeed();
});

// --- Death Screen Logic ---
function showDeathScreen(death) {
    const screen = document.getElementById('death-screen');
    const content = document.getElementById('death-content');
    const victimImg = document.getElementById('death-victim-img');
    const victimName = document.getElementById('death-victim-name');
    const killerContainer = document.getElementById('death-killer-container');
    const killerImg = document.getElementById('death-killer-img');
    const killerName = document.getElementById('death-killer-name');
    const msg = document.getElementById('death-message');

    if (!screen || !content) return;

    // 1. Setup Data
    victimName.innerText = death.victimName;
    victimImg.src = `https://mc-heads.net/avatar/${death.victimName}`;

    if (death.killerName) {
        killerContainer.style.display = 'flex';
        killerName.innerText = death.killerName;
        killerImg.src = `https://mc-heads.net/avatar/${death.killerName}`;
    } else {
        // Environmental / Mob (if we mapped mobs to heads later)
        // For now, hide second head or show a generic block?
        // simple: hide killer container if null
        killerContainer.style.display = 'none';
        // Or show specific icon based on cause?
        // For now, hide.
    }

    msg.innerText = death.message;

    // 2. Show Screen
    screen.classList.remove('hidden');

    // 3. Animate In
    gsap.to(content, {
        scale: 1,
        opacity: 1,
        duration: 0.5,
        ease: "back.out(1.7)"
    });

    // 4. Play Sound? (Optional)

    // 5. Hide after 4 seconds
    setTimeout(() => {
        gsap.to(content, {
            scale: 0.8,
            opacity: 0,
            duration: 0.3,
            onComplete: () => {
                screen.classList.add('hidden');
            }
        });
    }, 4000);
}
