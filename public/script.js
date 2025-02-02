let selectedCell = null;
const mobileInput = document.createElement("input");
// Chat input handler
const chatInput = document.getElementById("chat-input");
chatInput.addEventListener("focus", () => {
  // Ensure the input is visible when focused
  chatInput.scrollIntoView({ behavior: "smooth", block: "center" });
});
chatInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    const message = e.target.value.trim();
    if (message) {
      socket.emit("chat-message", message);
      e.target.value = "";
    }
  }
});

mobileInput.type = "text";
mobileInput.style.position = "absolute";
mobileInput.style.opacity = "0";
mobileInput.style.height = "0";
mobileInput.style.width = "0";
mobileInput.style.padding = "0";
mobileInput.style.border = "none";
mobileInput.maxLength = 1; // Allow only one character
document.body.appendChild(mobileInput);
// Get room ID from URL
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.has("room")) {
  document.getElementById("room-id").value = urlParams.get("room");
}

const socket = io();
let currentRoom = null;
let playerName = null;

// Show join modal initially
document.getElementById("join-modal").style.display = "flex";

// Chat message handler
socket.on("chat-message", ({ name, message }) => {
  const chatDiv = document.getElementById("chat-messages");
  chatDiv.innerHTML += `<div><strong>${name}:</strong> ${message}</div>`;
  chatDiv.scrollTop = chatDiv.scrollHeight;
});

// Chat input handler
document.getElementById("chat-input").addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    const message = e.target.value.trim();
    if (message) {
      socket.emit("chat-message", message);
      e.target.value = "";
    }
  }
});
document.getElementById("chat-messages").addEventListener("click", () => {
  chatInput.focus();
});

function joinGame() {
  playerName = document.getElementById("player-name").value.trim();
  let roomId = document.getElementById("room-id").value.trim();

  if (!playerName) {
    alert("Please enter your name");
    return;
  }

  // Generate room ID if empty
  if (!roomId) {
    roomId = generateRoomId();
    window.history.pushState({}, "", `?room=${roomId}`);
  }

  currentRoom = roomId;
  socket.emit("join-room", roomId, playerName);

  document.getElementById("join-modal").style.display = "none";
  document.getElementById("game-container").style.display = "flex";
}

function generateRoomId() {
  return Math.random().toString(36).substr(2, 5).toUpperCase();
}

function createGrid() {
  const grid = document.getElementById("game-grid");
  for (let i = 0; i < 100; i++) {
    const cell = document.createElement("div");
    cell.className = "grid-cell";
    cell.dataset.position = `${Math.floor(i / 10)},${i % 10}`;
    grid.appendChild(cell);
  }
}

// Grid click handler
document.addEventListener("click", (e) => {
  if (e.target.classList.contains("grid-cell") && playerName) {
    // Remove selection from previously selected cell
    if (selectedCell) {
      selectedCell.classList.remove("selected");
    }

    // Set new selected cell
    selectedCell = e.target;
    selectedCell.classList.add("selected");

    // Focus the mobile input to trigger the keyboard
    mobileInput.value = "";
    mobileInput.focus();
  }
});

// Keyboard input handler
document.addEventListener("keydown", (e) => {
  if (selectedCell && playerName && /^[a-zA-Z]$/.test(e.key)) {
    const letter = e.key.toUpperCase();

    // Emit the letter-placed event
    socket.emit("letter-placed", {
      position: selectedCell.dataset.position,
      letter: letter,
    });

    // Update the cell visually
    selectedCell.textContent = letter;
    selectedCell.classList.remove("selected");
    selectedCell = null;
  }
});

// Mobile input handler
mobileInput.addEventListener("input", (e) => {
  if (selectedCell && playerName && /^[a-zA-Z]$/.test(mobileInput.value)) {
    const letter = mobileInput.value.toUpperCase();

    // Emit the letter-placed event
    socket.emit("letter-placed", {
      position: selectedCell.dataset.position,
      letter: letter,
    });

    // Update the cell visually
    selectedCell.textContent = letter;
    selectedCell.classList.remove("selected");
    selectedCell = null;

    // Blur the input to hide the keyboard
    mobileInput.blur();
  }
});

// Handle mobile input blur
mobileInput.addEventListener("blur", () => {
  if (selectedCell) {
    selectedCell.classList.remove("selected");
    selectedCell = null;
  }
});

socket.on("game-state", (state) => {
  // Update turn display
  if (state.isTransitioning) {
    // Show transition message
    document.getElementById(
      "turn-display"
    ).textContent = `Turn changes to ${state.nextPlayer.name} in 3s...`;
  } else {
    // Show current player's turn
    document.getElementById("turn-display").textContent = `Player Turn: ${
      state.currentPlayer?.name || "-"
    }`;
  }

  // Update timer
  document.getElementById(
    "timer"
  ).textContent = `Time left: ${state.timeLeft}s`;

  // Update scores with (you) indicator
  const scoresDiv = document.getElementById("scores");
  scoresDiv.innerHTML = state.players
    .map((player) => {
      const isYou = player.id === socket.id;
      return `<div>
            <span>${player.name}${isYou ? " (you)" : ""}</span>
            <span class="score">${player.score} points</span>
        </div>`;
    })
    .join("");

  // Update grid
  state.grid.forEach((row, x) => {
    row.forEach((letter, y) => {
      const cell = document.querySelector(`[data-position="${x},${y}"]`);
      if (cell.textContent !== letter) {
        cell.textContent = letter;
        cell.classList.add("updated");
        setTimeout(() => cell.classList.remove("updated"), 500);
      }
    });
  });
});

socket.on("word-highlight", ({ word, positions }) => {
  // Display the valid word
  const wordElement = document.getElementById("valid-word");
  wordElement.textContent = word.toUpperCase();

  // Optional: Add animation
  wordElement.classList.add("word-flash");
  setTimeout(() => wordElement.classList.remove("word-flash"), 1000);

  // Existing highlight code
  positions.forEach(({ x, y }) => {
    const cell = document.querySelector(`[data-position="${x},${y}"]`);
    if (cell) {
      cell.classList.add("word-found");
      setTimeout(() => cell.classList.remove("word-found"), 1500);
    }
  });
});

// Initialize grid on load
window.onload = createGrid;
