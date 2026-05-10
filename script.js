const board = document.querySelector("#board");
const board3d = document.querySelector("#board3d");
const scene = document.querySelector("#scene");
const numberPad = document.querySelector("#numberPad");
const selectedReadout = document.querySelector("#selectedReadout");
const difficultyReadout = document.querySelector("#difficultyReadout");
const difficultySelect = document.querySelector("#difficulty");
const message = document.querySelector("#message");
const mistakesEl = document.querySelector("#mistakes");
const scoreEl = document.querySelector("#score");
const timerEl = document.querySelector("#timer");
const winModal = document.querySelector("#winModal");
const winStats = document.querySelector("#winStats");

const difficultySettings = {
  easy: { label: "Easy", givens: 43, baseScore: 1000 },
  medium: { label: "Medium", givens: 35, baseScore: 1500 },
  hard: { label: "Hard", givens: 28, baseScore: 2200 }
};

let selected = null;
let values = [];
let puzzle = [];
let givens = [];
let solution = [];
let mistakes = 0;
let hints = 0;
let seconds = 0;
let score = 0;
let timer = null;
let gameSolved = false;
let rotation = { x: 58, z: -38, moveX: 0, moveY: 0 };
let drag = null;

function shuffledNumbers() {
  const nums = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  for (let i = nums.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [nums[i], nums[j]] = [nums[j], nums[i]];
  }
  return nums;
}

function canPlace(grid, index, number) {
  const row = Math.floor(index / 9);
  const col = index % 9;
  const boxRow = Math.floor(row / 3) * 3;
  const boxCol = Math.floor(col / 3) * 3;

  for (let i = 0; i < 9; i += 1) {
    if (grid[row * 9 + i] === number || grid[i * 9 + col] === number) return false;
  }

  for (let r = 0; r < 3; r += 1) {
    for (let c = 0; c < 3; c += 1) {
      if (grid[(boxRow + r) * 9 + boxCol + c] === number) return false;
    }
  }

  return true;
}

function fillGrid(grid, index = 0) {
  while (index < 81 && grid[index] !== 0) index += 1;
  if (index === 81) return true;

  for (const number of shuffledNumbers()) {
    if (canPlace(grid, index, number)) {
      grid[index] = number;
      if (fillGrid(grid, index + 1)) return true;
      grid[index] = 0;
    }
  }

  return false;
}

function countSolutions(grid, limit = 2) {
  const emptyIndex = grid.findIndex((cell) => cell === 0);
  if (emptyIndex === -1) return 1;

  let count = 0;
  for (let number = 1; number <= 9; number += 1) {
    if (canPlace(grid, emptyIndex, number)) {
      grid[emptyIndex] = number;
      count += countSolutions(grid, limit);
      grid[emptyIndex] = 0;
      if (count >= limit) return count;
    }
  }

  return count;
}

function generatePuzzle(difficulty) {
  const solved = Array(81).fill(0);
  fillGrid(solved);

  const generated = [...solved];
  const targetGivens = difficultySettings[difficulty].givens;
  const positions = shuffledNumbers()
    .flatMap((group) => Array.from({ length: 9 }, (_, i) => (group - 1) * 9 + i))
    .sort(() => Math.random() - 0.5);

  for (const index of positions) {
    const filled = generated.filter(Boolean).length;
    if (filled <= targetGivens) break;

    const backup = generated[index];
    generated[index] = 0;
    const copy = [...generated];
    if (countSolutions(copy) !== 1) generated[index] = backup;
  }

  return { puzzleGrid: generated, solvedGrid: solved };
}

function startGame({ keepPuzzle = false } = {}) {
  const difficulty = difficultySelect.value;
  if (!keepPuzzle) {
    const generated = generatePuzzle(difficulty);
    puzzle = generated.puzzleGrid;
    solution = generated.solvedGrid;
  }

  values = puzzle.map((number) => (number === 0 ? "" : String(number)));
  givens = puzzle.map(Boolean);
  selected = null;
  mistakes = 0;
  hints = 0;
  seconds = 0;
  gameSolved = false;
  score = difficultySettings[difficulty].baseScore;
  mistakesEl.textContent = mistakes;
  scoreEl.textContent = score;
  timerEl.textContent = "00:00";
  difficultyReadout.textContent = difficultySettings[difficulty].label;
  message.textContent = "A fresh valid puzzle is ready. Choose an empty square to begin.";
  winModal.hidden = true;
  resetTimer();
  renderBoard();
  updateSelection();
}

function resetTimer() {
  clearInterval(timer);
  timer = setInterval(() => {
    seconds += 1;
    updateScore();
    const mins = String(Math.floor(seconds / 60)).padStart(2, "0");
    const secs = String(seconds % 60).padStart(2, "0");
    timerEl.textContent = `${mins}:${secs}`;
  }, 1000);
}

function updateScore() {
  const base = difficultySettings[difficultySelect.value].baseScore;
  score = Math.max(0, base - mistakes * 75 - hints * 120 - Math.floor(seconds / 5));
  scoreEl.textContent = score;
}

function renderBoard() {
  board.innerHTML = "";
  values.forEach((value, index) => {
    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = "cell";
    cell.textContent = value;
    cell.setAttribute("role", "gridcell");
    cell.setAttribute("aria-label", cellLabel(index, value));
    cell.dataset.index = index;

    if (givens[index]) cell.classList.add("given");
    if ((index % 9) === 2 || (index % 9) === 5) cell.classList.add("box-right");
    if (Math.floor(index / 9) === 2 || Math.floor(index / 9) === 5) cell.classList.add("box-bottom");

    cell.addEventListener("click", () => selectCell(index));
    board.appendChild(cell);
  });
}

function cellLabel(index, value) {
  const row = Math.floor(index / 9) + 1;
  const col = (index % 9) + 1;
  return `Row ${row}, column ${col}${value ? `, value ${value}` : ", empty"}`;
}

function selectCell(index) {
  selected = index;
  updateSelection();
  const row = Math.floor(index / 9) + 1;
  const col = (index % 9) + 1;
  selectedReadout.textContent = `R${row} C${col}`;
  message.textContent = givens[index] ? "That number is fixed for this puzzle." : "Enter a number with the pad or keyboard.";
}

function isPeer(index, otherIndex) {
  const sameRow = Math.floor(index / 9) === Math.floor(otherIndex / 9);
  const sameCol = (index % 9) === (otherIndex % 9);
  const sameBox = Math.floor(index / 27) === Math.floor(otherIndex / 27) && Math.floor((index % 9) / 3) === Math.floor((otherIndex % 9) / 3);
  return sameRow || sameCol || sameBox;
}

function updateSelection() {
  const cells = [...board.children];
  cells.forEach((cell, index) => {
    cell.classList.remove("selected", "peer", "same", "error");
    if (values[index] && values[index] !== String(solution[index])) cell.classList.add("error");
    if (selected === null) return;
    if (index === selected) cell.classList.add("selected");
    if (index !== selected && isPeer(index, selected)) cell.classList.add("peer");
    if (values[selected] && values[index] === values[selected]) cell.classList.add("same");
  });

  [...numberPad.children].forEach((key) => {
    key.classList.toggle("active", selected !== null && key.textContent === values[selected]);
  });

  if (selected === null) selectedReadout.textContent = "None";
}

function setNumber(number) {
  if (gameSolved) return;
  if (selected === null) {
    message.textContent = "Select an empty square first.";
    return;
  }
  if (givens[selected]) {
    message.textContent = "Fixed puzzle numbers cannot be changed.";
    return;
  }

  values[selected] = String(number);
  const cell = board.children[selected];
  cell.textContent = values[selected];
  cell.setAttribute("aria-label", cellLabel(selected, values[selected]));

  if (values[selected] !== String(solution[selected])) {
    mistakes += 1;
    mistakesEl.textContent = mistakes;
    message.textContent = "That number does not fit. The mistake is highlighted.";
  } else {
    message.textContent = "Correct placement.";
  }

  updateScore();
  updateSelection();
  if (isCompleteAndCorrect()) finishGame("Puzzle Complete");
}

function clearSelected() {
  if (gameSolved || selected === null || givens[selected]) return;
  values[selected] = "";
  board.children[selected].textContent = "";
  board.children[selected].setAttribute("aria-label", cellLabel(selected, ""));
  message.textContent = "Cell cleared.";
  updateSelection();
}

function giveHint() {
  if (gameSolved) return;
  const target = selected !== null && !givens[selected] && values[selected] !== String(solution[selected])
    ? selected
    : values.findIndex((value, index) => !givens[index] && value !== String(solution[index]));

  if (target === -1) return;
  hints += 1;
  selected = target;
  values[target] = String(solution[target]);
  board.children[target].textContent = values[target];
  board.children[target].setAttribute("aria-label", cellLabel(target, values[target]));
  selectCell(target);
  message.textContent = "Hint placed.";
  updateScore();
  updateSelection();
  if (isCompleteAndCorrect()) finishGame("Puzzle Complete");
}

function checkBoard() {
  const wrong = values.filter((value, index) => value && value !== String(solution[index])).length;
  const empty = values.filter((value) => !value).length;
  if (!wrong && !empty) {
    finishGame("Puzzle Complete");
  } else if (!wrong) {
    message.textContent = `${empty} cells left, and everything placed so far is correct.`;
  } else {
    message.textContent = `${wrong} cell${wrong === 1 ? " is" : "s are"} incorrect. Mistakes are marked in red.`;
  }
  updateSelection();
}

function solvePuzzle() {
  values = solution.map(String);
  gameSolved = true;
  score = 0;
  scoreEl.textContent = score;
  clearInterval(timer);
  renderBoard();
  updateSelection();
  message.textContent = "Puzzle solved.";
}

function isCompleteAndCorrect() {
  return values.every((value, index) => value === String(solution[index]));
}

function finishGame(title) {
  gameSolved = true;
  clearInterval(timer);
  document.querySelector("#winTitle").textContent = title;
  winStats.textContent = `Finished in ${timerEl.textContent} with ${mistakes} mistake${mistakes === 1 ? "" : "s"}, ${hints} hint${hints === 1 ? "" : "s"}, and ${score} points.`;
  winModal.hidden = false;
}

function buildNumberPad() {
  for (let number = 1; number <= 9; number += 1) {
    const key = document.createElement("button");
    key.type = "button";
    key.className = "pad-key";
    key.textContent = number;
    key.addEventListener("click", () => setNumber(number));
    numberPad.appendChild(key);
  }
}

function applyTransform() {
  board3d.style.setProperty("--rx", `${rotation.x}deg`);
  board3d.style.setProperty("--rz", `${rotation.z}deg`);
  board3d.style.setProperty("--move-x", `${rotation.moveX}px`);
  board3d.style.setProperty("--move-y", `${rotation.moveY}px`);
}

scene.addEventListener("pointerdown", (event) => {
  scene.setPointerCapture(event.pointerId);
  scene.classList.add("dragging");
  drag = {
    x: event.clientX,
    y: event.clientY,
    startX: rotation.x,
    startZ: rotation.z,
    startMoveX: rotation.moveX,
    startMoveY: rotation.moveY,
    moveMode: event.shiftKey
  };
});

scene.addEventListener("pointermove", (event) => {
  if (!drag) return;
  const dx = event.clientX - drag.x;
  const dy = event.clientY - drag.y;

  if (drag.moveMode) {
    rotation.moveX = drag.startMoveX + dx;
    rotation.moveY = drag.startMoveY + dy;
  } else {
    rotation.z = drag.startZ + dx * 0.35;
    rotation.x = Math.max(34, Math.min(72, drag.startX - dy * 0.22));
  }
  applyTransform();
});

function stopDrag() {
  scene.classList.remove("dragging");
  drag = null;
}

scene.addEventListener("pointerup", stopDrag);
scene.addEventListener("pointercancel", stopDrag);

document.addEventListener("keydown", (event) => {
  if (/^[1-9]$/.test(event.key)) setNumber(event.key);
  if (event.key === "Backspace" || event.key === "Delete" || event.key === "0") clearSelected();
  if (event.key.startsWith("Arrow") && selected !== null) {
    event.preventDefault();
    const row = Math.floor(selected / 9);
    const col = selected % 9;
    if (event.key === "ArrowUp" && row > 0) selectCell(selected - 9);
    if (event.key === "ArrowDown" && row < 8) selectCell(selected + 9);
    if (event.key === "ArrowLeft" && col > 0) selectCell(selected - 1);
    if (event.key === "ArrowRight" && col < 8) selectCell(selected + 1);
  }
});

document.querySelector("#rotateLeft").addEventListener("click", () => {
  rotation.z -= 18;
  applyTransform();
});

document.querySelector("#rotateRight").addEventListener("click", () => {
  rotation.z += 18;
  applyTransform();
});

document.querySelector("#resetView").addEventListener("click", () => {
  rotation = { x: 58, z: -38, moveX: 0, moveY: 0 };
  applyTransform();
});

difficultySelect.addEventListener("change", () => startGame());
document.querySelector("#checkBoard").addEventListener("click", checkBoard);
document.querySelector("#hint").addEventListener("click", giveHint);
document.querySelector("#solvePuzzle").addEventListener("click", solvePuzzle);
document.querySelector("#restartGame").addEventListener("click", () => startGame({ keepPuzzle: true }));
document.querySelector("#clearCell").addEventListener("click", clearSelected);
document.querySelector("#newGame").addEventListener("click", () => startGame());
document.querySelector("#playAgain").addEventListener("click", () => startGame());

buildNumberPad();
applyTransform();
startGame();
