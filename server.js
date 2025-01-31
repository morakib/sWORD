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
        this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
        this.timeLeft = 10;
        this.startTimer();
    }

    startTimer() {
        if (this.timer) clearInterval(this.timer);
        this.timer = setInterval(() => {
            this.timeLeft--;
            updateAllClients(this.id);
            if (this.timeLeft <= 0) this.nextTurn();
        }, 1000);
    }

    async checkWords(x, y) {
        const foundWords = [];
        
        // Check horizontal (left-right)
        let left = y;
        while (left > 0 && this.grid[x][left - 1]) left--;
        let right = y;
        while (right < 9 && this.grid[x][right + 1]) right++;
        const horizontalWord = this.grid[x].slice(left, right + 1).join('');
        
        // Check vertical (up-down)
        let top = x;
        while (top > 0 && this.grid[top - 1][y]) top--;
        let bottom = x;
        while (bottom < 9 && this.grid[bottom + 1][y]) bottom++;
        const verticalWord = Array(bottom - top + 1)
            .fill()
            .map((_, i) => this.grid[top + i][y])
            .join('');

        // Check both directions
        for (const word of [horizontalWord, verticalWord]) {
            if (word.length >= 2 && await isValidWord(word)) {
                foundWords.push({
                    word,
                    length: word.length,
                    positions: word === horizontalWord ? 
                        Array.from({length: right - left + 1}, (_, i) => ({x, y: left + i})) :
                        Array.from({length: bottom - top + 1}, (_, i) => ({x: top + i, y}))
                });
            }
        }

        if (foundWords.length > 0) {
            return foundWords.reduce((a, b) => a.length > b.length ? a : b);
        }
        return null;
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

// Rest of the server code remains the same...

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

            const bestWord = await room.checkWords(x, y);
            if (bestWord) {
                room.players[room.currentPlayerIndex].score += bestWord.length;
                io.to(room.id).emit('word-highlight', bestWord.highlightPositions);
            }

            updateAllClients(room.id);
        });

        socket.on('disconnect', () => {
            console.log('User disconnected:', socket.id);
        });
    });

    const PORT = 3000;
    server.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
