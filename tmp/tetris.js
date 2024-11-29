/**
 * Tetris Game
 * 
 * Features:
 * - Adjustable board width and height
 * - Adjustable game speed
 * - Adjustable game hardness (rate of speed increase)
 * - Score, speed, and hardness display
 * - Keyboard controls for moving, rotating, and dropping pieces
 * 
 * Controls:
 * - Left Arrow: Move piece left
 * - Right Arrow: Move piece right
 * - Down Arrow: Move piece down
 * - Up Arrow: Rotate piece
 * - Space: Drop piece
 * - Escape or Ctrl+C: Exit game
 * 
 * Flags:
 * - -w WIDTH: Set the width of the board (default: 12)
 * - -h HEIGHT: Set the height of the board (default: 20)
 * - -s SPEED: Set the starting speed in seconds (default: 1)
 * - -r HARDNESS: Set the rate of speed increase (default: 0.05, range: 0 to 0.5)
 * 
 * Author: gpt-4o
 * Orchestrator: nemesarial@gmail.com
 */

const readline = require('readline')
const { stdin: input, stdout: output, argv } = require('process')

const rl = readline.createInterface({ input, output })

if (argv.includes('--help')) {
  console.log('Usage: node tetris.js [-w WIDTH] [-h HEIGHT] [-s SPEED] [-r HARDNESS]')
  console.log('  -w WIDTH   Set the width of the board (default: 12)')
  console.log('  -h HEIGHT  Set the height of the board (default: 20)')
  console.log('  -s SPEED   Set the starting speed in seconds (default: 1)')
  console.log('  -r HARDNESS Set the rate of speed increase (default: 0.05, range: 0 to 0.5)')
  process.exit(0)
}

/**
 * Retrieves the value of a flag from the command line arguments.
 * @param {string} flag - The flag to search for.
 * @param {any} defaultValue - The default value if the flag is not found.
 * @returns {any} - The value of the flag or the default value.
 */
function getArgument(flag, defaultValue) {
  const index = argv.indexOf(flag)
  return (index !== -1 && index + 1 < argv.length) ? argv[index + 1] : defaultValue
}

const DEFAULT_WIDTH = 12
const DEFAULT_HEIGHT = 20
const DEFAULT_SPEED = 1
const DEFAULT_HARDNESS = 0.05
const EMPTY = ' '
const BLOCK = '█'

const WIDTH = parseInt(getArgument('-w', DEFAULT_WIDTH))
const HEIGHT = parseInt(getArgument('-h', DEFAULT_HEIGHT))
const SPEED = parseFloat(getArgument('-s', DEFAULT_SPEED))
const HARDNESS = parseFloat(getArgument('-r', DEFAULT_HARDNESS))

let speed = SPEED
let score = 0
let gameOver = false
let intervalId = null

let board = createBoard(HEIGHT, WIDTH)
let currentPiece = generatePiece()
let currentX = Math.floor(WIDTH / 2) - Math.floor(currentPiece[0].length / 2)
let currentY = 0

/**
 * Creates a new game board.
 * @param {number} height - The height of the board.
 * @param {number} width - The width of the board.
 * @returns {Array} - The initialized game board.
 */
function createBoard(height, width) {
  return Array.from({ length: height }, () => Array(width).fill(EMPTY))
}

/**
 * Generates a random Tetris piece.
 * @returns {Array} - The generated piece.
 */
function generatePiece() {
  const pieces = [
    [[BLOCK, BLOCK], [BLOCK, BLOCK]], // O
    [[BLOCK, BLOCK, BLOCK, BLOCK]], // I
    [[EMPTY, BLOCK, EMPTY], [BLOCK, BLOCK, BLOCK]], // T
    [[BLOCK, BLOCK, EMPTY], [EMPTY, BLOCK, BLOCK]], // S
    [[EMPTY, BLOCK, BLOCK], [BLOCK, BLOCK, EMPTY]], // Z
    [[BLOCK, BLOCK, BLOCK], [BLOCK, EMPTY, EMPTY]], // L
    [[BLOCK, BLOCK, BLOCK], [EMPTY, EMPTY, BLOCK]]  // J
  ]
  return pieces[Math.floor(Math.random() * pieces.length)]
}

/**
 * Draws the game board and the current piece.
 */
function drawBoard() {
  output.write('\x1B[2J\x1B[0f') // Clear the screen
  for (let y = 0; y < HEIGHT; y++) {
    let row = ''
    for (let x = 0; x < WIDTH; x++) {
      if (isCurrentPieceBlock(x, y)) {
        row += `\x1B[47m${BLOCK}${BLOCK}\x1B[0m` // Two characters wide with background
      } else {
        row += `\x1B[40m${board[y][x]}${board[y][x]}\x1B[0m` // Two characters wide with background
      }
    }
    output.write(row + '\n')
  }
  const scoreText = `Score: ${score.toString().padStart(4, ' ')}`
  const speedText = `Speed: ${speed.toFixed(2)}`
  const hardnessText = `Hardness: ${HARDNESS.toFixed(2)}`
  output.write(`${scoreText}  ${speedText}  ${hardnessText}\n`)
}

/**
 * Checks if the current piece occupies the given board position.
 * @param {number} x - The x-coordinate on the board.
 * @param {number} y - The y-coordinate on the board.
 * @returns {boolean} - True if the current piece occupies the position, false otherwise.
 */
function isCurrentPieceBlock(x, y) {
  return currentY <= y && y < currentY + currentPiece.length &&
    currentX <= x && x < currentX + currentPiece[0].length &&
    currentPiece[y - currentY][x - currentX] === BLOCK
}

/**
 * Places the current piece on the board.
 */
function placePiece() {
  for (let y = 0; y < currentPiece.length; y++) {
    for (let x = 0; x < currentPiece[y].length; x++) {
      if (currentPiece[y][x] === BLOCK) {
        board[currentY + y][currentX + x] = BLOCK
      }
    }
  }
}

/**
 * Checks if the current piece can move by the given offsets.
 * @param {number} dx - The x-offset.
 * @param {number} dy - The y-offset.
 * @returns {boolean} - True if the piece can move, false otherwise.
 */
function canMove(dx, dy) {
  for (let y = 0; y < currentPiece.length; y++) {
    for (let x = 0; x < currentPiece[y].length; x++) {
      if (currentPiece[y][x] === BLOCK) {
        let newX = currentX + x + dx
        let newY = currentY + y + dy
        if (newX < 0 || newX >= WIDTH || newY >= HEIGHT || (newY >= 0 && board[newY][newX] !== EMPTY)) {
          return false
        }
      }
    }
  }
  return true
}

/**
 * Moves the current piece by the given offsets.
 * @param {number} dx - The x-offset.
 * @param {number} dy - The y-offset.
 */
function movePiece(dx, dy) {
  if (canMove(dx, dy)) {
    currentX += dx
    currentY += dy
  } else if (dy === 1) {
    placePiece()
    clearLines()
    resetPiece()
    if (!canMove(0, 0)) {
      gameOver = true
    }
  }
}

/**
 * Clears completed lines from the board.
 */
function clearLines() {
  for (let y = HEIGHT - 1; y >= 0; y--) {
    if (board[y].every(cell => cell === BLOCK)) {
      board.splice(y, 1)
      board.unshift(Array(WIDTH).fill(EMPTY))
      y++
      score += 100
      increaseSpeed()
    }
  }
}

/**
 * Increases the game speed.
 */
function increaseSpeed() {
  speed = Math.max(0.05, speed - HARDNESS)
  clearInterval(intervalId)
  intervalId = setInterval(() => {
    if (!gameOver) {
      movePiece(0, 1)
      drawBoard()
    }
  }, speed * 1000)
}

/**
 * Rotates the current piece.
 */
function rotatePiece() {
  const rotatedPiece = currentPiece[0].map((_, index) =>
    currentPiece.map(row => row[index]).reverse()
  )
  const originalPiece = currentPiece
  currentPiece = rotatedPiece
  if (!canMove(0, 0)) {
    currentPiece = originalPiece
  }
}

/**
 * Drops the current piece to the bottom.
 */
function dropPiece() {
  while (canMove(0, 1)) {
    currentY += 1
  }
  placePiece()
  clearLines()
  resetPiece()
  if (!canMove(0, 0)) {
    gameOver = true
  }
}

/**
 * Resets the current piece to a new random piece.
 */
function resetPiece() {
  currentPiece = generatePiece()
  currentX = Math.floor(WIDTH / 2) - Math.floor(currentPiece[0].length / 2)
  currentY = 0
}

/**
 * The main game loop.
 */
function gameLoop() {
  if (gameOver) {
    output.write('Game Over!\n')
    rl.close()
    return
  }
  drawBoard()
}

// Set up input handling
input.setRawMode(true)
input.resume()
input.setEncoding('utf8')
input.on('data', handleInput)

/**
 * Handles user input.
 * @param {string} key - The key pressed by the user.
 */
function handleInput(key) {
  switch (key) {
    case '\u001B\u005B\u0044': // Left arrow
      movePiece(-1, 0)
      break
    case '\u001B\u005B\u0043': // Right arrow
      movePiece(1, 0)
      break
    case '\u001B\u005B\u0042': // Down arrow
      movePiece(0, 1)
      break
    case '\u001B\u005B\u0041': // Up arrow
      rotatePiece()
      break
    case ' ':
      dropPiece()
      break
    case '\u001B': // Escape key
    case '\u0003': // Ctrl+C to exit
      process.exit()
      break
  }
  gameLoop()
}

// Start the game loop
intervalId = setInterval(() => {
  if (!gameOver) {
    movePiece(0, 1)
    drawBoard()
  }
}, speed * 1000)

gameLoop()