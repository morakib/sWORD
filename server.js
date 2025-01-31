
// const express = require('express');
// const http = require('http');
// const { Server } = require('socket.io');
// const axios = require('axios'); // For calling dictionary API
// require('dotenv').config(); // To store API keys securely

// const app = express();
// const server = http.createServer(app);
// const io = new Server(server);

// app.use(express.static('public'));

// const rooms = {}; // Stores all active game rooms

// class GameRoom {
//     constructor(roomId) {
//         this.id = roomId;
//         this.players = [];
//         this.grid = Array(10).fill().map(() => Array(10).fill(''));
//         this.currentPlayerIndex = 0;
//         this.timer = null;
//         this.timeLeft = 10;
//     }

//     nextTurn() {
//         this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
//         this.timeLeft = 10;
//         this.startTimer();
//     }

//     startTimer() {
//         if (this.timer) clearInterval(this.timer);
//         this.timer = setInterval(() => {
//             this.timeLeft--;
//             updateAllClients(this.id);
//             if (this.timeLeft <= 0) this.nextTurn();
//         }, 1000);
//     }

//     async checkWords(x, y) {
//         const words = [];
        
//         // Check horizontal
//         let left = y;
//         while (left > 0 && this.grid[x][left - 1]) left--;
        
//         let right = y;
//         while (right < 9 && this.grid[x][right + 1]) right++;
        
//         if (right - left >= 1) { 
//             const word = this.grid[x].slice(left, right + 1).join('');
//             if (await isValidWord(word)) words.push(word);
//         }

//         // Check vertical
//         let top = x;
//         while (top > 0 && this.grid[top - 1][y]) top--;
        
//         let bottom = x;
//         while (bottom < 9 && this.grid[bottom + 1][y]) bottom++;
        
//         if (bottom - top >= 1) {
//             const word = Array(bottom - top + 1)
//                 .fill()
//                 .map((_, i) => this.grid[top + i][y])
//                 .join('');
//             if (await isValidWord(word)) words.push(word);
//         }

//         return words;
//     }
// }

// async function isValidWord(word) {
//     try {
//         const response = await axios.get(`https://api.dictionaryapi.dev/api/v2/entries/en/${word}`);
//         return response.status === 200; 
//     } catch (error) {
//         return false; // If API returns an error, the word is not valid
//     }
// }

// function updateAllClients(roomId) {
//     const room = rooms[roomId];
//     if (!room) return;
    
//     io.to(roomId).emit('game-state', {
//         grid: room.grid,
//         players: room.players,
//         currentPlayer: room.players[room.currentPlayerIndex],
//         timeLeft: room.timeLeft
//     });
// }

// function getPlayerRoom(socketId) {
//     return Object.values(rooms).find(room => 
//         room.players.some(p => p.id === socketId)
//     );
// }

// io.on('connection', (socket) => {
//     console.log('A user connected:', socket.id);

//     socket.on('chat-message', (message) => {
//         const room = getPlayerRoom(socket.id);
//         if (!room) return;

//         const player = room.players.find(p => p.id === socket.id);
//         if (!player) return;

//         io.to(room.id).emit('chat-message', {
//             name: player.name,
//             message: message
//         });
//     });

//     socket.on('join-room', (roomId, playerName) => {
//         if (!rooms[roomId]) rooms[roomId] = new GameRoom(roomId);
//         const room = rooms[roomId];
        
//         if (room.players.some(p => p.name === playerName)) {
//             socket.emit('error', 'Name already taken');
//             return;
//         }

//         room.players.push({
//             id: socket.id,
//             name: playerName,
//             score: 0
//         });

//         socket.join(room.id);
//         if (room.players.length === 1) room.startTimer();
//         updateAllClients(room.id);
//     });

//     socket.on('letter-placed', async ({ position, letter }) => {
//         const room = getPlayerRoom(socket.id);
//         if (!room) return;
      
//         const [x, y] = position.split(',').map(Number);
//         if (room.players[room.currentPlayerIndex].id !== socket.id) return;
//         if (room.grid[x][y]) return;
      
//         room.grid[x][y] = letter.toUpperCase();
        
//         const foundWords = await room.checkWords(x, y);
//         if (foundWords.length > 0) {
//             const score = foundWords.reduce((total, word) => total + word.length, 0);
//             room.players[room.currentPlayerIndex].score += score;
//         }

//         updateAllClients(room.id);
//     });

//     socket.on('disconnect', () => {
//         console.log('User disconnected:', socket.id);
//     });
// });

// const PORT = process.env.PORT || 3000;
// server.listen(PORT, () => {
//     console.log(`Server running on port ${PORT}`);
// });


// const express = require('express');
// const http = require('http');
// const { Server } = require('socket.io');
// const axios = require('axios');

// const app = express();
// const server = http.createServer(app);
// const io = new Server(server);

// app.use(express.static('public'));

// const rooms = {};
// const DICTIONARY_API_URL = "https://api.dictionaryapi.dev/api/v2/entries/en/";

// class GameRoom {
//     constructor(roomId) {
//         this.id = roomId;
//         this.players = [];
//         this.grid = Array(10).fill().map(() => Array(10).fill(''));
//         this.currentPlayerIndex = 0;
//         this.timer = null;
//         this.timeLeft = 10;
//     }

//     nextTurn() {
//         this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
//         this.timeLeft = 10;
//         this.startTimer();
//     }

//     startTimer() {
//         if (this.timer) clearInterval(this.timer);
//         this.timer = setInterval(() => {
//             this.timeLeft--;
//             updateAllClients(this.id);
//             if (this.timeLeft <= 0) this.nextTurn();
//         }, 1000);
//     }

//     async checkWords(x, y) {
//         let foundWords = [];

//         const directions = [
//             { dx: -1, dy: 0 }, // Up
//             { dx: 1, dy: 0 },  // Down
//             { dx: 0, dy: -1 }, // Left
//             { dx: 0, dy: 1 }   // Right
//         ];

//         for (let { dx, dy } of directions) {
//             let startX = x, startY = y;
//             while (startX - dx >= 0 && startX - dx < 10 && startY - dy >= 0 && startY - dy < 10 && this.grid[startX - dx][startY - dy]) {
//                 startX -= dx;
//                 startY -= dy;
//             }

//             let word = "";
//             let highlightPositions = [];
//             let tempX = startX, tempY = startY;

//             while (tempX >= 0 && tempX < 10 && tempY >= 0 && tempY < 10 && this.grid[tempX][tempY]) {
//                 word += this.grid[tempX][tempY];
//                 highlightPositions.push([tempX, tempY]);
//                 tempX += dx;
//                 tempY += dy;
//             }

//             if (word.length > 1 && await isValidWord(word)) {
//                 foundWords.push({ word, length: word.length, highlightPositions });
//             }
//         }

//         if (foundWords.length > 0) {
//             let bestWord = foundWords.reduce((max, word) => word.length > max.length ? word : max, foundWords[0]);
//             return bestWord;
//         }
//         return null;
//     }
// }

// async function isValidWord(word) {
//     try {
//         const response = await axios.get(DICTIONARY_API_URL + word);
//         return response.status === 200;
//     } catch (error) {
//         return false;
//     }
// }

// function updateAllClients(roomId) {
//     const room = rooms[roomId];
//     if (!room) return;
//     io.to(roomId).emit('game-state', {
//         grid: room.grid,
//         players: room.players,
//         currentPlayer: room.players[room.currentPlayerIndex],
//         timeLeft: room.timeLeft
//     });
// }

// function getPlayerRoom(socketId) {
//     return Object.values(rooms).find(room => 
//         room.players.some(p => p.id === socketId)
//     );
// }

// io.on('connection', (socket) => {
//     console.log('A user connected:', socket.id);

//     socket.on('chat-message', (message) => {
//         const room = getPlayerRoom(socket.id);
//         if (!room) return;

//         const player = room.players.find(p => p.id === socket.id);
//         if (!player) return;

//         io.to(room.id).emit('chat-message', {
//             name: player.name,
//             message: message
//         });
//     });

//     socket.on('join-room', (roomId, playerName) => {
//         if (!rooms[roomId]) rooms[roomId] = new GameRoom(roomId);
//         const room = rooms[roomId];
        
//         if (room.players.some(p => p.name === playerName)) {
//             socket.emit('error', 'Name already taken');
//             return;
//         }

//         room.players.push({
//             id: socket.id,
//             name: playerName,
//             score: 0
//         });

//         socket.join(room.id);
//         if (room.players.length === 1) room.startTimer();
//         updateAllClients(room.id);
//     });

//     socket.on('letter-placed', async ({ position, letter }) => {
//         const room = getPlayerRoom(socket.id);
//         if (!room) return;

//         const [x, y] = position.split(',').map(Number);
//         if (room.players[room.currentPlayerIndex].id !== socket.id) return;
//         if (room.grid[x][y]) return;

//         room.grid[x][y] = letter.toUpperCase();

//         const bestWord = await room.checkWords(x, y);
//         if (bestWord) {
//             room.players[room.currentPlayerIndex].score += bestWord.length;
//             io.to(room.id).emit('word-highlight', bestWord.highlightPositions);
//         }

//         updateAllClients(room.id);
//     });

//     socket.on('disconnect', () => {
//         console.log('User disconnected:', socket.id);
//     });
// });

// const PORT = 3000;
// server.listen(PORT, () => {
//     console.log(`Server running on port ${PORT}`);
// });



//////////////////////////   3   //////////////////////////
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
