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
        let foundWords = [];

        const directions = [
            { dx: -1, dy: 0 }, // Up
            { dx: 1, dy: 0 },  // Down
            { dx: 0, dy: -1 }, // Left
            { dx: 0, dy: 1 }   // Right
        ];

        for (let { dx, dy } of directions) {
            for (let length = 2; length <= 10; length++) { // Checking all possible word lengths
                let word = "";
                let highlightPositions = [];
                let tempX = x, tempY = y;

                for (let i = 0; i < length; i++) {
                    if (tempX < 0 || tempX >= 10 || tempY < 0 || tempY >= 10 || !this.grid[tempX][tempY]) break;
                    
                    word += this.grid[tempX][tempY];
                    highlightPositions.push({ x: tempX, y: tempY });

                    tempX += dx;
                    tempY += dy;
                }

                if (word.length > 1 && await isValidWord(word)) {
                    foundWords.push({ word, length: word.length, highlightPositions });
                }
            }
        }

        if (foundWords.length > 0) {
            let bestWord = foundWords.reduce((max, word) => word.length > max.length ? word : max, foundWords[0]);
            return bestWord;
        }
        return null;
    }
}

async function isValidWord(word) {
    try {
        const response = await axios.get(DICTIONARY_API_URL + word);
        return response.status === 200;
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
