
// Game State Management
console.log('engine.js loaded');
let gameState = {
  currentLevel: 'level1',
  currentModule: 'A',
  currentRound: 1,
  currentTaskIndex: 0,
  responses: [], // { taskIndex, answer, correct, timeMs, taskId }
  unlockedLevels: ['level1'],
  sessionStartTime: null,
  roundTasks: [], // Tasks for current round
  previousTaskId: null // To avoid repeating same task
};

// Save/Load from localStorage
function saveState() {
  localStorage.setItem('gameState', JSON.stringify(gameState));
}

function loadState() {
  const saved = localStorage.getItem('gameState');
  if (saved) {
    gameState = JSON.parse(saved);
  }
}

// Initialize tasks for a round
function initializeRound() {
  const moduleKey = `${gameState.currentLevel}-${gameState.currentModule}`;
  const moduleTasks = TASKS[moduleKey] || [];
  
  let selectedTasks = [];
  let availableTasks = [...moduleTasks];
  
  // First round is control test (matching numbers)
  if (gameState.currentRound === 1) {
    selectedTasks = createControlTasks();
  }
  // Review rounds
  else if (gameState.currentRound === 13) {
    // Review of rounds 1,2,3,5,6 (modules A,B,C pattern)
    selectedTasks = [
      ...shuffleArray(TASKS[`${gameState.currentLevel}-A`]).slice(0, 2),
      ...shuffleArray(TASKS[`${gameState.currentLevel}-B`]).slice(0, 2),
      ...shuffleArray(TASKS[`${gameState.currentLevel}-C`]).slice(0, 2),
      ...shuffleArray(TASKS[`${gameState.currentLevel}-A`]).slice(0, 2),
      ...shuffleArray(TASKS[`${gameState.currentLevel}-C`]).slice(0, 1)
    ].slice(0, 10);
  } else if (gameState.currentRound === 14) {
    // Review of rounds 4,8,12 - broader mix
    selectedTasks = [
      ...shuffleArray(TASKS[`${gameState.currentLevel}-A`]).slice(0, 3),
      ...shuffleArray(TASKS[`${gameState.currentLevel}-B`]).slice(0, 3),
      ...shuffleArray(TASKS[`${gameState.currentLevel}-C`]).slice(0, 4)
    ].slice(0, 10);
  } else {
    // Regular rounds - select 10 unique tasks from current module
    while (selectedTasks.length < 10 && availableTasks.length > 0) {
      const idx = Math.floor(Math.random() * availableTasks.length);
      selectedTasks.push(availableTasks[idx]);
      availableTasks.splice(idx, 1);
    }
  }
  
  // Shuffle to avoid repeating pattern and ensure no same task twice in a row
  let finalTasks = shuffleArray(selectedTasks);
  
  // Double-check that same question doesn't appear twice in a row
  for (let i = 0; i < finalTasks.length - 1; i++) {
    if (finalTasks[i].items === finalTasks[i + 1].items) {
      // Swap with a random task not at position i+1
      let swapIdx = Math.floor(Math.random() * (finalTasks.length - i - 2)) + i + 2;
      [finalTasks[i + 1], finalTasks[swapIdx]] = [finalTasks[swapIdx], finalTasks[i + 1]];
    }
  }
  
  gameState.roundTasks = finalTasks;
  gameState.currentTaskIndex = 0;
  gameState.responses = [];
  gameState.sessionStartTime = Date.now();
}

// Create control tasks (match numbers to numbers)
function createControlTasks() {
  const controlTasks = [];
  for (let i = 0; i < 10; i++) {
    const number = (i % 10).toString();
    const allOptions = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
    const otherOptions = allOptions.filter(n => n !== number);
    const shuffledOthers = shuffleArray(otherOptions);
    const options = shuffleArray([number, ...shuffledOthers.slice(0, 3)]);
    
    controlTasks.push({
      items: number,
      a: options,
      correct: number
    });
  }
  return controlTasks;
}

// Shuffle array
function shuffleArray(arr) {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Render current task
function render() {
  const app = document.getElementById('app');
  
  if (gameState.currentTaskIndex >= gameState.roundTasks.length) {
    showRoundResults();
    return;
  }
  
  const task = gameState.roundTasks[gameState.currentTaskIndex];
  const taskNumber = gameState.currentTaskIndex + 1;
  const level = LEVELS[gameState.currentLevel];
  let moduleInfo = '';
  
  if (gameState.currentRound === 1) {
    moduleInfo = ' (Kontroll-sjekk)';
  } else if (gameState.currentRound === 13) {
    moduleInfo = ' (Review - Runder 1-6)';
  } else if (gameState.currentRound === 14) {
    moduleInfo = ' (Review - Runder 4,8,12)';
  } else {
    const module = level.modules[gameState.currentModule];
    moduleInfo = ` - ${module.name}`;
  }
  
  let html = `
    <div class="task-container">
      <div class="progress-header">
        <div class="level-info">${level.name}</div>
        <div class="round-info">Runde ${gameState.currentRound}/14${moduleInfo} · Oppgave ${taskNumber}/10</div>
      </div>
      <h2 class="task-question">Hvor mange?</h2>
      <div class="items-display">${task.items}</div>
      <div class="buttons-container">
  `;
  
  task.a.forEach((answer, idx) => {
    html += `<button class="answer-btn" onclick="recordAnswer('${answer}')">${answer}</button>`;
  });
  
  html += `</div></div>`;
  app.innerHTML = html;
}

// Record answer and move to next task
function recordAnswer(answer) {
  const task = gameState.roundTasks[gameState.currentTaskIndex];
  const taskStartTime = Date.now();
  const isCorrect = answer === task.correct;
  
  gameState.responses.push({
    taskIndex: gameState.currentTaskIndex,
    answer: answer,
    correct: isCorrect,
    question: `Hvor mange? ${gameState.roundTasks[gameState.currentTaskIndex].items}`,
    correctAnswer: task.correct,
    timeMs: gameState.sessionStartTime ? Date.now() - gameState.sessionStartTime : 0
  });
  
  gameState.currentTaskIndex++;
  gameState.previousTaskId = gameState.currentTaskIndex - 1;
  saveState();
  
  // Small delay before showing next task
  setTimeout(() => render(), 500);
}

// Calculate results
function calculateResults() {
  const correct = gameState.responses.filter(r => r.correct).length;
  const incorrect = gameState.responses.filter(r => !r.correct).length;
  const avgTime = gameState.responses.length > 0 
    ? gameState.responses.reduce((sum, r) => sum + r.timeMs, 0) / gameState.responses.length / 1000
    : 0;
  
  return {
    correct,
    incorrect,
    avgTime,
    percentage: Math.round((correct / gameState.responses.length) * 100),
    total: gameState.responses.length,
    passed: correct / gameState.responses.length >= 0.9 && avgTime < 5
  };
}

// Show results screen
function showRoundResults() {
  const app = document.getElementById('app');
  const results = calculateResults();
  const passStyle = results.passed ? '#2ecc71' : '#e74c3c';
  const failStyle = results.passed ? '#27ae60' : '#c0392b';
  
  let html = `
    <div class="results-container">
      <h1>Runde ${gameState.currentRound} Ferdig!</h1>
      
      <div class="results-summary">
        <div class="result-item" style="color: ${results.correct > results.incorrect ? '#2ecc71' : '#e74c3c'}">
          <strong>Riktig:</strong> ${results.correct}/${results.total}
        </div>
        <div class="result-item" style="color: ${results.avgTime < 5 ? '#2ecc71' : '#e74c3c'}">
          <strong>Gj.snitt tid:</strong> ${results.avgTime.toFixed(1)}s (mål: <5s)
        </div>
        <div class="result-item">
          <strong>Prosent:</strong> ${results.percentage}% (mål: >90%)
        </div>
      </div>
  `;
  
  // Show incorrect answers
  const incorrectAnswers = gameState.responses.filter(r => !r.correct);
  if (incorrectAnswers.length > 0) {
    html += `
      <div class="exercises-section">
        <h3 style="color: #e74c3c;">Øv på disse før ny runde:</h3>
        <ul class="exercise-list">
    `;
    incorrectAnswers.forEach(answer => {
      html += `
        <li class="exercise-item">
          <strong>Oppgave:</strong> ${answer.question}<br>
          <strong>Ditt svar:</strong> ${answer.answer}<br>
          <strong>Riktig svar:</strong> ${answer.correctAnswer}
        </li>
      `;
    });
    html += `</ul></div>`;
  }
  
  // Show action buttons
  if (results.passed) {
    html += `
      <div class="actions">
        <button class="btn-next" onclick="nextRound()">✓ Klar for neste runde!</button>
      </div>
    `;
  } else {
    html += `
      <div class="actions">
        <button class="btn-retry" onclick="retryRound()">Prøv igjen</button>
        <button class="btn-next" onclick="skipToNextRound()">Gå videre likevel</button>
      </div>
    `;
  }
  
  app.innerHTML = html;
}

// Advance to next round
function nextRound() {
  const results = calculateResults();
  const level = LEVELS[gameState.currentLevel];
  
  // Determine next module and round based on progression
  const getNextModuleForRound = (round) => {
    if (round === 1 || round === 2 || round === 3 || round === 4) return 'A';
    if (round === 5 || round === 6 || round === 7 || round === 8) return 'B';
    if (round === 9 || round === 10 || round === 11 || round === 12) return 'C';
    return 'A'; // Review rounds stay flexible
  };
  
  if (gameState.currentRound < level.rounds) {
    gameState.currentRound++;
    gameState.currentModule = getNextModuleForRound(gameState.currentRound);
    
    // Check if we completed the level (round 14 passed)
    if (gameState.currentRound > level.rounds && results.passed) {
      // Move to next level if available
      const levelKeys = Object.keys(LEVELS);
      const currentIndex = levelKeys.indexOf(gameState.currentLevel);
      if (currentIndex < levelKeys.length - 1) {
        gameState.currentLevel = levelKeys[currentIndex + 1];
        gameState.currentModule = 'A';
        gameState.currentRound = 1;
        if (!gameState.unlockedLevels.includes(gameState.currentLevel)) {
          gameState.unlockedLevels.push(gameState.currentLevel);
        }
      }
    }
  }
  
  saveState();
  initializeRound();
  render();
}

// Retry current round
function retryRound() {
  gameState.currentTaskIndex = 0;
  gameState.responses = [];
  gameState.sessionStartTime = Date.now();
  saveState();
  initializeRound();
  render();
}

// Skip to next round anyway
function skipToNextRound() {
  nextRound();
}

// Initialize game
function initGame() {
  // Check if LEVELS and TASKS are defined
  if (typeof LEVELS === 'undefined' || typeof TASKS === 'undefined') {
    console.error('LEVELS or TASKS not defined');
    const app = document.getElementById('app');
    if (app) {
      app.innerHTML = '<div style="padding: 40px; text-align: center; color: red;"><h1>Error: Data not loaded</h1><p>LEVELS or TASKS not defined. Check if data.js loaded.</p></div>';
    }
    return;
  }
  
  try {
    loadState();
  } catch (e) {
    console.error('Error loading state:', e);
  }
  try {
    initializeRound();
    render();
  } catch (e) {
    console.error('Error initializing game:', e);
    // Fallback: show error message
    const app = document.getElementById('app');
    if (app) {
      app.innerHTML = `<div style="padding: 40px; text-align: center; color: red;"><h1>Error loading game</h1><p>${e.message}</p></div>`;
    }
  }
}

// Start on page load
window.addEventListener('DOMContentLoaded', initGame);

// Fallback: also try to start after a delay
setTimeout(() => {
  if (!gameState.roundTasks || gameState.roundTasks.length === 0) {
    initGame();
  }
}, 500);
