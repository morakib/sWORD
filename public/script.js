// Get room ID from URL
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.has('room')) {
    document.getElementById('room-id').value = urlParams.get('room');
}

const socket = io();
let currentRoom = null;
let playerName = null;

// Show join modal initially
document.getElementById('join-modal').style.display = 'block';

// Chat message handler
socket.on('chat-message', ({ name, message }) => {
    const chatDiv = document.getElementById('chat-messages');
    chatDiv.innerHTML += `<div><strong>${name}:</strong> ${message}</div>`;
    chatDiv.scrollTop = chatDiv.scrollHeight;
});

// Chat input handler
document.getElementById('chat-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        const message = e.target.value.trim();
        if (message) {
            socket.emit('chat-message', message);
            e.target.value = '';
        }
    }
});

function joinGame() {
    playerName = document.getElementById('player-name').value.trim();
    let roomId = document.getElementById('room-id').value.trim();
    
    if (!playerName) {
        alert('Please enter your name');
        return;
    }

    // Generate room ID if empty
    if (!roomId) {
        roomId = generateRoomId();
        window.history.pushState({}, '', `?room=${roomId}`);
    }
    
    currentRoom = roomId;
    socket.emit('join-room', roomId, playerName);
    
    document.getElementById('join-modal').style.display = 'none';
    document.getElementById('game-container').style.display = 'flex';
}

function generateRoomId() {
    return Math.random().toString(36).substr(2, 5).toUpperCase();
}

function createGrid() {
    const grid = document.getElementById('game-grid');
    for (let i = 0; i < 100; i++) {
        const cell = document.createElement('div');
        cell.className = 'grid-cell';
        cell.dataset.position = `${Math.floor(i/10)},${i%10}`;
        grid.appendChild(cell);
    }
}

// Grid click handler
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('grid-cell') && playerName) {
        const letter = prompt('Enter a capital letter:');
        if (letter && /^[A-Z]$/i.test(letter)) {
            socket.emit('letter-placed', {
                position: e.target.dataset.position,
                letter: letter.toUpperCase()
            });
        }
    }
});

// Game state updates
socket.on('game-state', (state) => {
    document.getElementById('turn-display').textContent = 
        `Player Turn: ${state.currentPlayer?.name || '-'}`;
        
    document.getElementById('timer').textContent = 
        `Time left: ${state.timeLeft}s`;

    // Update scores
    const scoresDiv = document.getElementById('scores');
  scoresDiv.innerHTML = state.players.map(player => 
    `<div>${player.name}: ${player.score}</div>`
  ).join('');   

    // Update grid      
    state.grid.forEach((row, x) => {
        row.forEach((letter, y) => {
            const cell = document.querySelector(`[data-position="${x},${y}"]`);
            if (cell.textContent !== letter) {
                cell.textContent = letter;
                cell.classList.add('updated');
                setTimeout(() => cell.classList.remove('updated'), 500);
            }
        });
    });
});


socket.on('word-highlight', ({ word, cells }) => {
    cells.forEach(({ x, y }) => {
        const cell = document.querySelector(`.grid-cell[data-position="${x},${y}"]`);
        if (cell) {
            cell.classList.add('word-found');
            setTimeout(() => cell.classList.remove('word-found'), 1500); // Remove glow after 1.5s
        }
    });
});


// Initialize grid on load
window.onload = createGrid; 