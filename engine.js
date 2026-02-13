
// Game State Management
let gameState = {
  currentLevel: 'level1',
  currentModule: 'A',
  currentRound: 1,
  currentTaskIndex: 0,
  responses: [], // { taskIndex, answer, correct, timeMs, taskId }
  unlockedLevels: ['level1'],
  sessionStartTime: null,
  questionStartTime: null,
  roundTasks: [], // Tasks for current round
  previousTaskId: null,
  previousCorrectIndex: null,
  completedRounds: {}, // { 'level1-1': {passed: true, score: 95, time: 4.2}, ... }
  showOverview: true
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
  gameState.questionStartTime = null;
  gameState.previousCorrectIndex = null;
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

// Render dice with dots (1-6)
function renderDice(number) {
  const dots = parseInt(number);
  if (dots < 1 || dots > 6) return '';
  
  let dotElements = '';
  for (let i = 0; i < dots; i++) {
    dotElements += '<span class="dice-dot"></span>';
  }
  
  return `<span class="dice">${dotElements}</span>`;
}

// Process items display (convert emoji dice to HTML dice)
function processItemsDisplay(items) {
  // Replace dice emoji with HTML dice
  let processed = items;
  
  // Match patterns like "🎲3" or just the dice emoji value from correct answer
  const dicePattern = /🎲(\d+)?/g;
  processed = processed.replace(dicePattern, (match, num) => {
    // If no number, we need to figure out what number this dice should show
    // This happens in level1-C where items is just '🎲'
    return match; // Will be handled in render() by checking correct answer
  });
  
  return processed;
}

// Show level overview screen with progress
function showLevelOverview() {
  const app = document.getElementById('app');
  const level = LEVELS[gameState.currentLevel];
  
  let html = `
    <div class="overview-container">
      <h1 class="overview-title">${level.name}</h1>
      <p class="overview-subtitle">${level.category}</p>
      
      <div class="rounds-grid">
  `;
  
  // Show all 14 rounds with their status
  for (let round = 1; round <= 14; round++) {
    const roundKey = `${gameState.currentLevel}-${round}`;
    const completed = gameState.completedRounds[roundKey];
    const isLocked = round > 1 && !gameState.completedRounds[`${gameState.currentLevel}-${round - 1}`];
    const isCurrent = round === gameState.currentRound && !completed;
    
    // Determine module for this round
    let moduleName = '';
    let moduleDesc = '';
    if (round === 1) {
      moduleName = 'Kontroll';
      moduleDesc = 'Kontroll-sjekk';
    } else if (round === 13) {
      moduleName = 'Review 1-6';
      moduleDesc = 'Oppsummering';
    } else if (round === 14) {
      moduleName = 'Review';
      moduleDesc = 'Hovedoppsummering';
    } else {
      const module = getModuleForRound(round);
      const moduleInfo = level.modules[module];
      moduleName = moduleInfo.name;
      moduleDesc = moduleInfo.description;
    }
    
    let statusClass = 'round-card-locked';
    let statusIcon = '🔒';
    let statusText = 'Låst';
    
    if (completed) {
      statusClass = completed.passed ? 'round-card-completed' : 'round-card-failed';
      statusIcon = completed.passed ? '✓' : '✗';
      statusText = completed.passed ? `${completed.score}% (${completed.time}s)` : `${completed.score}%`;
    } else if (isCurrent) {
      statusClass = 'round-card-current';
      statusIcon = '▶';
      statusText = 'Klar!';
    } else if (!isLocked) {
      statusClass = 'round-card-available';
      statusIcon = '○';
      statusText = 'Tilgjengelig';
    }
    
    const clickable = !isLocked && !completed;
    const onclick = clickable ? `onclick="startRound(${round})"` : '';
    
    html += `
      <div class="round-card ${statusClass}" ${onclick}>
        <div class="round-number">Runde ${round}</div>
        <div class="round-module">${moduleName}</div>
        <div class="round-status">
          <span class="status-icon">${statusIcon}</span>
          <span class="status-text">${statusText}</span>
        </div>
      </div>
    `;
  }
  
  html += `
      </div>
      
      <div class="overview-footer">
        <div class="progress-info">
          <strong>Fullført:</strong> ${Object.keys(gameState.completedRounds).filter(k => k.startsWith(gameState.currentLevel) && gameState.completedRounds[k].passed).length}/14 runder
        </div>
      </div>
    </div>
  `;
  
  app.innerHTML = html;
}

// Get module for a given round number
function getModuleForRound(round) {
  if (round === 1 || round === 2 || round === 3 || round === 4) return 'A';
  if (round === 5 || round === 6 || round === 7 || round === 8) return 'B';
  if (round === 9 || round === 10 || round === 11 || round === 12) return 'C';
  return 'A';
}

// Start a specific round from overview
function startRound(roundNumber) {
  gameState.currentRound = roundNumber;
  gameState.currentModule = getModuleForRound(roundNumber);
  gameState.showOverview = false;
  saveState();
  initializeRound();
  render();
}

// Render current task
function render() {
  const app = document.getElementById('app');
  
  // Show overview if flag is set
  if (gameState.showOverview) {
    showLevelOverview();
    return;
  }
  
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
  
  gameState.questionStartTime = Date.now();
  
  // Process items display for dice
  let displayItems = task.items;
  if (displayItems === '🎲') {
    // For level1-C, show dice with correct number
    displayItems = renderDice(task.correct);
  } else if (displayItems.includes('🎲')) {
    // For level2-C and others with dice in text, replace emoji with HTML
    displayItems = displayItems.replace(/🎲(\d+)/g, (match, num) => renderDice(num));
    displayItems = displayItems.replace(/🎲/g, (match) => {
      // Extract number from context if available
      return match;
    });
  }
  
  let html = `
    <div class="task-container">
      <div class="progress-header">
        <div class="level-info">${level.name}</div>
        <div class="round-info">Runde ${gameState.currentRound}/14${moduleInfo} · Oppgave ${taskNumber}/10</div>
      </div>
      <h2 class="task-question">Hvor mange?</h2>
      <div class="items-display">${displayItems}</div>
      <div class="buttons-container">
  `;
  
  let answers = shuffleArray([...task.a]);
  const correctIndex = answers.indexOf(task.correct);
  if (gameState.previousCorrectIndex !== null && answers.length > 1 && correctIndex === gameState.previousCorrectIndex) {
    const swapIndex = (correctIndex + 1) % answers.length;
    [answers[correctIndex], answers[swapIndex]] = [answers[swapIndex], answers[correctIndex]];
  }
  gameState.previousCorrectIndex = answers.indexOf(task.correct);

  answers.forEach((answer) => {
    let displayAnswer = answer;
    // For dice modules, show dice on answer buttons if answer starts with 🎲
    if (answer.startsWith('🎲')) {
      const num = answer.replace('🎲', '');
      displayAnswer = renderDice(num);
    }
    html += `<button class="answer-btn" onclick="recordAnswer('${answer}')">${displayAnswer}</button>`;
  });
  
  html += `</div></div>`;
  app.innerHTML = html;
}

// Record answer and move to next task
function recordAnswer(answer) {
  // Remove focus from clicked button to prevent cursor persistence
  if (document.activeElement) {
    document.activeElement.blur();
  }
  
  const task = gameState.roundTasks[gameState.currentTaskIndex];
  const isCorrect = answer === task.correct;
  const timeMs = gameState.questionStartTime ? Date.now() - gameState.questionStartTime : 0;
  
  gameState.responses.push({
    taskIndex: gameState.currentTaskIndex,
    answer: answer,
    correct: isCorrect,
    question: `Hvor mange? ${gameState.roundTasks[gameState.currentTaskIndex].items}`,
    correctAnswer: task.correct,
    timeMs: timeMs
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
  const timesMs = gameState.responses.map(r => r.timeMs);
  const avgTime = timesMs.length > 0
    ? timesMs.reduce((sum, t) => sum + t, 0) / timesMs.length / 1000
    : 0;
  const maxTime = timesMs.length > 0
    ? Math.max(...timesMs) / 1000
    : 0;
  const perQuestionOk = timesMs.length > 0 && timesMs.every(t => t < 5000);
  const percentage = gameState.responses.length > 0
    ? Math.round((correct / gameState.responses.length) * 100)
    : 0;
  
  return {
    correct,
    incorrect,
    avgTime,
    maxTime,
    percentage,
    total: gameState.responses.length,
    passed: gameState.responses.length > 0 && (correct / gameState.responses.length) >= 0.9 && perQuestionOk
  };
}

// Show results screen
function showRoundResults() {
  const app = document.getElementById('app');
  const results = calculateResults();
  const passStyle = results.passed ? '#2ecc71' : '#e74c3c';
  const failStyle = results.passed ? '#27ae60' : '#c0392b';
  
  // Save round completion
  const roundKey = `${gameState.currentLevel}-${gameState.currentRound}`;
  gameState.completedRounds[roundKey] = {
    passed: results.passed,
    score: results.percentage,
    time: results.avgTime.toFixed(1)
  };
  
  // If passed, unlock next round
  if (results.passed && gameState.currentRound < 14) {
    const nextRoundKey = `${gameState.currentLevel}-${gameState.currentRound + 1}`;
    if (!gameState.completedRounds[nextRoundKey]) {
      // Next round is now unlocked (handled in overview)
    }
  }
  
  saveState();
  
  let html = `
    <div class="results-container">
      <h1>Runde ${gameState.currentRound} Ferdig!</h1>
      
      <div class="results-summary">
        <div class="result-item" style="color: ${results.correct > results.incorrect ? '#2ecc71' : '#e74c3c'}">
          <strong>Riktig:</strong> ${results.correct}/${results.total}
        </div>
        <div class="result-item" style="color: ${results.maxTime < 5 ? '#2ecc71' : '#e74c3c'}">
          <strong>Gj.snitt tid:</strong> ${results.avgTime.toFixed(1)}s (mål: <5s)
        </div>
        <div class="result-item" style="color: ${results.maxTime < 5 ? '#2ecc71' : '#e74c3c'}">
          <strong>Maks tid:</strong> ${results.maxTime.toFixed(1)}s (mål: <5s per oppgave)
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
  html += `
    <div class="actions">
      <button class="btn-next" onclick="backToOverview()">Tilbake til oversikt</button>
  `;
  
  if (!results.passed) {
    html += `<button class="btn-retry" onclick="retryRound()">Prøv igjen</button>`;
  }
  
  html += `</div>`;
  
  app.innerHTML = html;
}

// Go back to overview
function backToOverview() {
  gameState.showOverview = true;
  saveState();
  render();
}

// Advance to next round (legacy - now handled via overview)
function nextRound() {
  backToOverview();
}

// Retry current round
function retryRound() {
  // Remove the completion record for this round
  const roundKey = `${gameState.currentLevel}-${gameState.currentRound}`;
  delete gameState.completedRounds[roundKey];
  
  gameState.currentTaskIndex = 0;
  gameState.responses = [];
  gameState.sessionStartTime = Date.now();
  gameState.showOverview = false;
  saveState();
  initializeRound();
  render();
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
