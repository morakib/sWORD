const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const axios = require('axios');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

const rooms = {};
const DICTIONARY_API_URL = "https://api.dictionaryapi.dev/api/v2/entries/en/";

class GameRoom {
    constructor(roomId) {
        this.id = roomId;
        this.players = [];
        this.grid = Array(10).fill().map(() => Array(10).fill(''));
        this.currentPlayerIndex = 0;
        this.timer = null;
        this.timeLeft = 10;
    }

    nextTurn() {
        if (this.timer) clearInterval(this.timer);
        this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
        this.timeLeft = 10;
        this.startTimer();
        updateAllClients(this.id);
    }

    startTimer() {
        this.timer = setInterval(() => {
            this.timeLeft--;
            updateAllClients(this.id);
            if (this.timeLeft <= 0) {
                this.nextTurn();
            }
        }, 1000);
    }

    stopTimer() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }

    removePlayer(socketId) {
        const playerIndex = this.players.findIndex(p => p.id === socketId);
        if (playerIndex !== -1) {
            this.players.splice(playerIndex, 1);

            // Adjust currentPlayerIndex if necessary
            if (this.players.length > 0) {
                if (this.currentPlayerIndex >= this.players.length) {
                    this.currentPlayerIndex = 0;
                }
                if (playerIndex < this.currentPlayerIndex) {
                    this.currentPlayerIndex--;
                }
            } else {
                // No players left, stop the game
                this.stopTimer();
                delete rooms[this.id];
            }

            updateAllClients(this.id);
        }
    }

    async checkWords(x, y) {
        const foundWords = [];
        
        // Check horizontal substrings
        let left = y;
        while (left > 0 && this.grid[x][left - 1]) left--;
        let right = y;
        while (right < 9 && this.grid[x][right + 1]) right++;
        const horizontalLetters = this.grid[x].slice(left, right + 1);
        const hPlacedIndex = y - left;

        // Generate all horizontal substrings including the placed letter
        for (let start = 0; start <= hPlacedIndex; start++) {
            for (let end = hPlacedIndex; end < horizontalLetters.length; end++) {
                const length = end - start + 1;
                if (length < 2) continue;
                const word = horizontalLetters.slice(start, end + 1).join('');
                if (await isValidWord(word)) {
                    foundWords.push({
                        word,
                        length,
                        positions: Array.from({ length }, (_, i) => ({
                            x,
                            y: left + start + i
                        }))
                    });
                }
            }
        }

        // Check vertical substrings
        let top = x;
        while (top > 0 && this.grid[top - 1][y]) top--;
        let bottom = x;
        while (bottom < 9 && this.grid[bottom + 1][y]) bottom++;
        const verticalLetters = Array.from({ length: bottom - top + 1 }, (_, i) => this.grid[top + i][y]);
        const vPlacedIndex = x - top;

        // Generate all vertical substrings including the placed letter
        for (let start = 0; start <= vPlacedIndex; start++) {
            for (let end = vPlacedIndex; end < verticalLetters.length; end++) {
                const length = end - start + 1;
                if (length < 2) continue;
                const word = verticalLetters.slice(start, end + 1).join('');
                if (await isValidWord(word)) {
                    foundWords.push({
                        word,
                        length,
                        positions: Array.from({ length }, (_, i) => ({
                            x: top + start + i,
                            y
                        }))
                    });
                }
            }
        }

        if (foundWords.length === 0) return null;

        // Find the longest valid word
        let maxLength = Math.max(...foundWords.map(w => w.length));
        let bestWords = foundWords.filter(w => w.length === maxLength);
        return bestWords[0];
    }
}

async function isValidWord(word) {
    try {
        const response = await axios.get(DICTIONARY_API_URL + word.toLowerCase());
        return response.data && response.data.length > 0;
    } catch (error) {
        return false;
    }
}

function updateAllClients(roomId) {
    const room = rooms[roomId];
    if (!room) return;
    io.to(roomId).emit('game-state', {
        grid: room.grid,
        players: room.players,
        currentPlayer: room.players[room.currentPlayerIndex],
        timeLeft: room.timeLeft
    });
}

function getPlayerRoom(socketId) {
    return Object.values(rooms).find(room => 
        room.players.some(p => p.id === socketId)
    );
}

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    socket.on('chat-message', (message) => {
        const room = getPlayerRoom(socket.id);
        if (!room) return;

        const player = room.players.find(p => p.id === socket.id);
        if (!player) return;

        io.to(room.id).emit('chat-message', {
            name: player.name,
            message: message
        });
    });

    socket.on('join-room', (roomId, playerName) => {
        if (!rooms[roomId]) rooms[roomId] = new GameRoom(roomId);
        const room = rooms[roomId];
        
        if (room.players.some(p => p.name === playerName)) {
            socket.emit('error', 'Name already taken');
            return;
        }

        room.players.push({
            id: socket.id,
            name: playerName,
            score: 0
        });

        socket.join(room.id);
        if (room.players.length === 1) room.startTimer();
        updateAllClients(room.id);
    });

    socket.on('letter-placed', async ({ position, letter }) => {
        const room = getPlayerRoom(socket.id);
        if (!room) return;  

        const [x, y] = position.split(',').map(Number);
        if (room.players[room.currentPlayerIndex].id !== socket.id) return;
        if (room.grid[x][y]) return;

        room.grid[x][y] = letter.toUpperCase();

        // Stop the timer immediately after placing a letter
        room.stopTimer();

        const bestWord = await room.checkWords(x, y);
        if (bestWord) {
            const player = room.players[room.currentPlayerIndex];
            player.score += bestWord.word.length;
            io.to(room.id).emit('word-highlight', { 
                word: bestWord.word,
                positions: bestWord.positions 
            });
        }

        updateAllClients(room.id);

        // Move to the next player
        room.nextTurn();
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        const room = getPlayerRoom(socket.id);
        if (room) {
            room.removePlayer(socket.id);
        }
    });
});

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
