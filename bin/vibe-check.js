#!/usr/bin/env node

/**
 * vibe-check - Fun CLI dashboard showing project stats
 *
 * Usage:
 *   npx vibe-check
 *   vibe-check (if installed globally)
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// ═══════════════════════════════════════════════════════════════════
// ANSI COLORS & UTILITIES
// ═══════════════════════════════════════════════════════════════════

const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  magenta: '\x1b[35m',
  white: '\x1b[37m',
  red: '\x1b[31m',
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function clearScreen() {
  process.stdout.write('\x1b[2J\x1b[H');
}

function hideCursor() {
  process.stdout.write('\x1b[?25l');
}

function showCursor() {
  process.stdout.write('\x1b[?25h');
}

function moveCursor(row, col) {
  process.stdout.write(`\x1b[${row};${col}H`);
}

function clearLine() {
  process.stdout.write('\x1b[2K');
}

// ═══════════════════════════════════════════════════════════════════
// LOADING ANIMATION
// ═══════════════════════════════════════════════════════════════════

async function showLoading() {
  hideCursor();

  const frames = [
    'Scanning stats',
    'Scanning stats.',
    'Scanning stats..',
    'Scanning stats...',
  ];

  // Run through animation 2 times
  for (let i = 0; i < 8; i++) {
    process.stdout.write(`\r${c.dim}${frames[i % 4]}${c.reset}   `);
    await sleep(200);
  }

  // Clear the line and screen
  process.stdout.write('\r\x1b[2K');
  clearScreen();
}

// ═══════════════════════════════════════════════════════════════════
// GIT UTILITIES
// ═══════════════════════════════════════════════════════════════════

function exec(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch {
    return '';
  }
}

function getGitStats() {
  const commitCount = parseInt(exec('git rev-list --count HEAD') || '0', 10);
  const contributors = exec('git log --format="%aN" | sort -u').split('\n').filter(Boolean);
  const firstCommitDate = exec('git log --reverse --format="%ci" | head -1');
  const lastCommitDate = exec('git log --format="%ci" | head -1');
  const daysActive = parseInt(exec('git log --format="%cd" --date=format:"%Y-%m-%d" | sort -u | wc -l') || '0', 10);

  // Commit dates for calendar
  const commitDates = exec('git log --format="%cd" --date=format:"%Y-%m-%d"').split('\n').filter(Boolean);

  // Commit hours for heatmap
  const commitHours = exec('git log --format="%cd" --date=format:"%H"').split('\n').filter(Boolean);

  // Recent commits
  const recentCommits = exec('git log --format="%s" -5').split('\n').filter(Boolean);

  // Commits per day for finding best day
  const commitsPerDay = exec('git log --format="%cd" --date=format:"%Y-%m-%d" | uniq -c | sort -rn | head -1');

  // Current streak
  const allDays = exec('git log --format="%cd" --date=format:"%Y-%m-%d" | sort -u').split('\n').filter(Boolean).reverse();

  let streak = 0;
  const today = new Date();
  for (let i = 0; i < allDays.length; i++) {
    const commitDate = new Date(allDays[i]);
    const diffDays = Math.floor((today.getTime() - commitDate.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays <= i + 1) {
      streak++;
    } else {
      break;
    }
  }

  return {
    commitCount,
    contributors,
    firstCommitDate: firstCommitDate ? new Date(firstCommitDate) : null,
    lastCommitDate: lastCommitDate ? new Date(lastCommitDate) : null,
    daysActive,
    commitDates,
    commitHours,
    recentCommits,
    commitsPerDay,
    streak,
  };
}

// ═══════════════════════════════════════════════════════════════════
// CODE UTILITIES
// ═══════════════════════════════════════════════════════════════════

function getCodeStats() {
  const extensions = ['ts', 'tsx', 'js', 'jsx', 'css', 'scss', 'json', 'md'];
  const breakdown = {};
  let totalLines = 0;
  let totalFiles = 0;

  for (const ext of extensions) {
    const files = exec(`find . -name "*.${ext}" -not -path "*/node_modules/*" -not -path "*/.next/*" -not -name "package-lock.json" 2>/dev/null | wc -l`);
    const fileCount = parseInt(files || '0', 10);

    if (fileCount > 0) {
      const lines = exec(`find . -name "*.${ext}" -not -path "*/node_modules/*" -not -path "*/.next/*" -not -name "package-lock.json" -exec cat {} \\; 2>/dev/null | wc -l`);
      const lineCount = parseInt(lines || '0', 10);

      // Only count source code (not json/md) in totals
      if (['ts', 'tsx', 'js', 'jsx', 'css', 'scss'].includes(ext)) {
        totalLines += lineCount;
        totalFiles += fileCount;
      }

      if (lineCount > 0) {
        breakdown[ext] = { files: fileCount, lines: lineCount };
      }
    }
  }

  return { totalLines, totalFiles, breakdown };
}

// ═══════════════════════════════════════════════════════════════════
// PROJECT INFO
// ═══════════════════════════════════════════════════════════════════

function getProjectName() {
  try {
    const pkg = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
    return pkg.name || path.basename(process.cwd());
  } catch {
    return path.basename(process.cwd());
  }
}

function getProjectAge(firstCommitDate) {
  if (!firstCommitDate) return 'just born';
  const days = Math.floor((Date.now() - firstCommitDate.getTime()) / (1000 * 60 * 60 * 24));
  if (days === 0) return 'born today';
  if (days === 1) return 'born yesterday';
  return `born ${days} days ago`;
}

// ═══════════════════════════════════════════════════════════════════
// VISUALIZATIONS
// ═══════════════════════════════════════════════════════════════════

function buildActivityCalendar(commitDates) {
  const counts = new Map();
  for (const date of commitDates) {
    counts.set(date, (counts.get(date) || 0) + 1);
  }

  const today = new Date();
  const cells = [];

  // Last 50 days to fit better
  for (let i = 49; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const count = counts.get(key) || 0;

    if (count === 0) cells.push(`${c.dim}░${c.reset}`);
    else if (count <= 2) cells.push(`${c.green}▒${c.reset}`);
    else if (count <= 5) cells.push(`${c.green}▓${c.reset}`);
    else cells.push(`${c.green}█${c.reset}`);
  }

  return cells.join('');
}

function buildHourHeatmap(commitHours) {
  const counts = new Array(24).fill(0);
  for (const hour of commitHours) {
    const h = parseInt(hour, 10);
    if (!isNaN(h)) counts[h]++;
  }

  const max = Math.max(...counts, 1);
  const blocks = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];

  const bars = counts.map(count => {
    const level = Math.floor((count / max) * 7);
    const color = count === 0 ? c.dim : count === max ? c.yellow : c.green;
    return `${color}${blocks[level]}${c.reset}`;
  });

  const peakHour = counts.indexOf(max);

  return { heatmap: bars.join(''), peakHour };
}

function buildGrowthGraph(totalLines) {
  // Create an ascending graph that ends at current total
  const blocks = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];
  const graph = [];

  // Simulate growth curve (starts slow, accelerates)
  const points = [0.05, 0.1, 0.18, 0.3, 0.45, 0.62, 0.8, 1.0];

  for (const point of points) {
    const level = Math.floor(point * 7);
    graph.push(`${c.green}${blocks[level]}${c.reset}`);
  }

  return graph.join('');
}

function getCodingStyle(commitHours) {
  const counts = new Array(24).fill(0);
  for (const hour of commitHours) {
    const h = parseInt(hour, 10);
    if (!isNaN(h)) counts[h]++;
  }

  const morning = counts.slice(5, 12).reduce((a, b) => a + b, 0);
  const afternoon = counts.slice(12, 18).reduce((a, b) => a + b, 0);
  const evening = counts.slice(18, 22).reduce((a, b) => a + b, 0);
  const night = counts.slice(22, 24).reduce((a, b) => a + b, 0) + counts.slice(0, 5).reduce((a, b) => a + b, 0);

  const max = Math.max(morning, afternoon, evening, night);
  if (max === night) return '🦉 Night owl';
  if (max === morning) return '☕ Early bird';
  if (max === evening) return '🌙 Evening coder';
  return '☀️ Afternoon hacker';
}

function formatHour(hour) {
  if (hour === 0) return '12am';
  if (hour === 12) return '12pm';
  if (hour < 12) return `${hour}am`;
  return `${hour - 12}pm`;
}

// ═══════════════════════════════════════════════════════════════════
// TROPHIES (with emojis)
// ═══════════════════════════════════════════════════════════════════

function getTrophies(lines, commits) {
  const trophies = [];

  if (commits >= 1) trophies.push({ emoji: '🏆', label: 'First commit' });
  if (lines >= 1000) trophies.push({ emoji: '📦', label: '1k lines' });
  if (lines >= 10000) trophies.push({ emoji: '🚀', label: '10k lines' });
  if (lines >= 25000) trophies.push({ emoji: '🔥', label: '25k lines' });
  if (lines >= 50000) trophies.push({ emoji: '💎', label: '50k lines' });
  if (commits >= 50) trophies.push({ emoji: '⚡', label: '50 commits' });
  if (commits >= 100) trophies.push({ emoji: '💯', label: '100 commits' });

  return trophies;
}

// ═══════════════════════════════════════════════════════════════════
// FUN FACTS
// ═══════════════════════════════════════════════════════════════════

function getFunFacts(lines) {
  const facts = [];

  // === STAR WARS ===
  // A New Hope script ~7,500 words = ~1,500 lines
  const aNewHopes = (lines / 1500).toFixed(1);
  facts.push(`${aNewHopes}x longer than the entire Star Wars: A New Hope script`);

  // Death Star trench run is 2km, if lines were meters
  const trenchRuns = (lines / 2000).toFixed(1);
  facts.push(`${trenchRuns} Death Star trench runs (if lines were meters)`);

  // Lightsaber is ~1 meter, stacked lightsabers
  const lightsabers = Math.round(lines);
  facts.push(`${lightsabers.toLocaleString()} lightsabers stacked end to end`);

  // === LORD OF THE RINGS ===
  // Fellowship book is ~187k words = ~37,400 lines
  const fellowships = (lines / 37400).toFixed(1);
  facts.push(`${fellowships}x the length of The Fellowship of the Ring`);

  // Full LOTR trilogy is ~481k words = ~96,200 lines
  const lotrTrilogy = (lines / 96200).toFixed(1);
  facts.push(`${lotrTrilogy}x the entire Lord of the Rings trilogy`);

  // Mordor journey is ~1,800 miles, if lines were miles
  const mordorTrips = (lines / 1800).toFixed(1);
  facts.push(`${mordorTrips} journeys from the Shire to Mordor`);

  // === HARRY POTTER ===
  // Book 1 is ~77k words = ~15,400 lines
  const hp1 = (lines / 15400).toFixed(1);
  facts.push(`${hp1}x the length of Harry Potter and the Sorcerer's Stone`);

  // Full HP series is ~1,084k words = ~216,800 lines
  const hpSeries = (lines / 216800).toFixed(2);
  facts.push(`${hpSeries}x the entire Harry Potter series`);

  // === STAR TREK ===
  // USS Enterprise-D is 642 meters long
  const enterprises = (lines / 642).toFixed(1);
  facts.push(`${enterprises} USS Enterprises laid end to end (if lines were meters)`);

  // === TERMINATOR ===
  // T-800's mini-gun fires ~100 rounds per second
  const minigunSeconds = Math.round(lines / 100);
  facts.push(`${minigunSeconds} seconds of T-800 mini-gun fire`);

  // === ALIENS ===
  // Colonial Marines pulse rifle has 99-round magazine
  const pulseRifleMags = Math.round(lines / 99);
  facts.push(`${pulseRifleMags} Colonial Marine pulse rifle magazines`);

  // === GAMING ===
  // Tetris - lines cleared (perfect 1:1 mapping!)
  facts.push(`${lines.toLocaleString()} Tetris lines cleared - Grand Master status`);

  // Legend of Zelda: original game had 128 screens
  const zeldaGames = (lines / 128).toFixed(1);
  facts.push(`${zeldaGames}x more lines than screens in the original Zelda`);

  // Pac-Man: 240 dots per maze
  const pacmanMazes = Math.round(lines / 240);
  facts.push(`${pacmanMazes.toLocaleString()} Pac-Man mazes worth of dots chomped`);

  // Pokemon - 151 original
  const pokedexes = Math.round(lines / 151);
  facts.push(`${pokedexes}x the original 151 Pokemon`);

  // === DOCTOR WHO ===
  // The Doctor is ~2000 years old
  const doctorAges = (lines / 2000).toFixed(1);
  facts.push(`${doctorAges}x the Doctor's age (in Time Lord years)`);

  // === SPACE/SCI-FI ===
  const moonCircumference = 6783;
  const moonTrips = (lines / moonCircumference).toFixed(1);
  facts.push(`${moonTrips} trips around the Moon (if lines were miles)`);

  const enterprises2 = Math.round(lines / 289);
  facts.push(`${enterprises2} Millennium Falcons long (if lines were meters)`);

  // Return 2 random facts
  const shuffled = facts.sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 2);
}

// ═══════════════════════════════════════════════════════════════════
// ENCOURAGEMENT
// ═══════════════════════════════════════════════════════════════════

function getEncouragement(commits, lines, streak) {
  const messages = [
    `${commits} commits deep. You're locked in.`,
    `${lines.toLocaleString()} lines of pure determination.`,
    `Shipping code and taking names.`,
    `The vibes are immaculate.`,
    `Your future self will thank you.`,
    `This is what momentum looks like.`,
    `You're building something real.`,
  ];

  if (streak >= 5) messages.push(`${streak} day streak. Don't break the chain.`);
  if (commits >= 50) messages.push(`50+ commits. This thing has legs.`);
  if (lines >= 10000) messages.push(`10k+ lines. You're not messing around.`);
  if (lines >= 30000) messages.push(`30k+ lines. This is a real product now.`);

  return messages[Math.floor(Math.random() * messages.length)];
}

// ═══════════════════════════════════════════════════════════════════
// BOX DRAWING HELPERS
// ═══════════════════════════════════════════════════════════════════

function line(width, char = '═') {
  return char.repeat(width);
}

// Calculate visible length (strip ANSI codes, count emojis as 2)
function visibleLength(str) {
  const stripped = str.replace(/\x1b\[[0-9;]*m/g, '');
  let len = 0;
  for (const char of stripped) {
    // Emojis and special characters
    const code = char.codePointAt(0) || 0;
    if (code > 0x1F600 || (code >= 0x2600 && code <= 0x27BF) || code > 0xFF00) {
      len += 2; // Emoji takes 2 spaces
    } else {
      len += 1;
    }
  }
  return len;
}

function padRight(str, targetLen) {
  const currentLen = visibleLength(str);
  const padding = targetLen - currentLen;
  return str + ' '.repeat(Math.max(0, padding));
}

// ═══════════════════════════════════════════════════════════════════
// MAIN RENDER
// ═══════════════════════════════════════════════════════════════════

async function render() {
  // Handle exit gracefully
  process.on('SIGINT', () => {
    showCursor();
    process.exit(0);
  });

  try {
    // Show loading animation
    await showLoading();

    // Gather all stats
    const projectName = getProjectName();
    const gitStats = getGitStats();
    const codeStats = getCodeStats();
    const projectAge = getProjectAge(gitStats.firstCommitDate);
    const trophies = getTrophies(codeStats.totalLines, gitStats.commitCount);
    const calendar = buildActivityCalendar(gitStats.commitDates);
    const { heatmap: hourHeatmap, peakHour } = buildHourHeatmap(gitStats.commitHours);
    const growthGraph = buildGrowthGraph(codeStats.totalLines);
    const codingStyle = getCodingStyle(gitStats.commitHours);
    const encouragement = getEncouragement(gitStats.commitCount, codeStats.totalLines, gitStats.streak);
    const tweetsWorth = Math.floor(codeStats.totalLines / 280);

    // Parse best day
    const bestDayMatch = gitStats.commitsPerDay.match(/(\d+)/);
    const bestDay = bestDayMatch ? parseInt(bestDayMatch[1], 10) : 0;

    // Date range
    const dateRange = gitStats.firstCommitDate && gitStats.lastCommitDate
      ? `${gitStats.firstCommitDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${gitStats.lastCommitDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
      : 'N/A';

    // File type breakdown (top 2)
    const sortedTypes = Object.entries(codeStats.breakdown)
      .filter(([ext]) => ['ts', 'tsx', 'js', 'jsx', 'css'].includes(ext))
      .sort((a, b) => b[1].lines - a[1].lines)
      .slice(0, 2);

    const W = 66; // Total inner width

    const B = c.cyan; // Border color
    const R = c.reset;

    // Helper for bordered line - now with proper padding
    const row = (content) => {
      const padded = padRight(content, W);
      console.log(`${B}║${R} ${padded} ${B}║${R}`);
    };

    // Header
    console.log(`${B}╔${line(W + 2)}╗${R}`);
    await sleep(30);

    const pacman = `${c.magenta}ᗧ${c.yellow}··${c.magenta}ᗣ${c.yellow}··${c.magenta}ᗣ${R}`;
    const nameUpper = projectName.toUpperCase();
    const ageText = projectAge;
    // pacman is 7 visible chars (ᗧ··ᗣ··ᗣ), 2 spaces, then name
    const leftLen = 7 + 2 + nameUpper.length;
    const rightLen = ageText.length;
    const middlePad = W - leftLen - rightLen;
    console.log(`${B}║${R} ${pacman}  ${c.bold}${c.white}${nameUpper}${R}${' '.repeat(Math.max(1, middlePad))}${c.dim}${ageText}${R} ${B}║${R}`);

    console.log(`${B}╠${line(W + 2)}╣${R}`);
    await sleep(50);

    // Three column headers
    row(`${c.bold}CODE${R}                ${c.bold}GIT${R}                 ${c.bold}HABITS${R}`);
    await sleep(30);

    // Stats rows
    row(`${c.yellow}${codeStats.totalLines.toLocaleString().padEnd(8)}${R}lines     ${c.yellow}${gitStats.commitCount.toString().padEnd(6)}${R}commits      ${c.green}${codingStyle}${R}`);
    await sleep(30);
    row(`${c.yellow}${codeStats.totalFiles.toString().padEnd(8)}${R}files     ${c.yellow}${gitStats.daysActive.toString().padEnd(6)}${R}days active  ${c.green}🔥 ${gitStats.streak} day streak${R}`);
    await sleep(30);

    if (sortedTypes[0]) {
      row(`${c.dim}.${sortedTypes[0][0]}: ${sortedTypes[0][1].lines.toLocaleString().padEnd(7)}${R}     ${c.dim}${dateRange.padEnd(15)}${R}   ${c.yellow}⚡ ${bestDay} in a day${R}`);
    }
    if (sortedTypes[1]) {
      row(`${c.dim}.${sortedTypes[1][0]}: ${sortedTypes[1][1].lines.toLocaleString()}${R}`);
    }

    console.log(`${B}╠${line(W + 2)}╣${R}`);
    await sleep(50);

    // Git activity
    row(`${c.bold}ACTIVITY${R}`);
    row(calendar);
    row(`${c.dim}50 days ago${' '.repeat(38)}now${R}`);

    console.log(`${B}╠${line(W + 2)}╣${R}`);
    await sleep(50);

    // Commit hours
    row(`${c.bold}HOURS${R}                                            ${c.dim}peak: ${c.yellow}${formatHour(peakHour)}${R}`);
    row(hourHeatmap);
    row(`${c.dim}12am        6am         12pm        6pm       11pm${R}`);

    console.log(`${B}╠${line(W + 2)}╣${R}`);
    await sleep(50);

    // Growth + Trophies side by side
    // Trophy column starts at position 30
    const trophyCol = 30;
    const trophy = (i) => trophies[i] ? `${trophies[i].emoji} ${trophies[i].label}` : '';

    row(`${c.bold}GROWTH${R}${' '.repeat(trophyCol - 6)}${c.bold}TROPHIES${R}`);
    row(`${growthGraph}  ${c.green}${codeStats.totalLines.toLocaleString()} lines${R}${' '.repeat(Math.max(1, trophyCol - 8 - codeStats.totalLines.toLocaleString().length - 7))}${trophy(0)}`);
    row(`${c.dim}~${tweetsWorth} tweets worth${R}${' '.repeat(Math.max(1, trophyCol - tweetsWorth.toString().length - 14))}${trophy(1)}`);
    row(`${' '.repeat(trophyCol)}${trophy(2)}`);
    if (trophies[3]) {
      row(`${' '.repeat(trophyCol)}${trophy(3)}`);
    }
    if (trophies[4]) {
      row(`${' '.repeat(trophyCol)}${trophy(4)}`);
    }

    console.log(`${B}╠${line(W + 2)}╣${R}`);
    await sleep(50);

    // Recent commits
    row(`${c.bold}RECENT${R}`);
    for (const commit of gitStats.recentCommits.slice(0, 3)) {
      const maxLen = W - 4;
      const truncated = commit.length > maxLen ? commit.slice(0, maxLen - 3) + '...' : commit;
      row(`${c.dim}•${R} ${truncated}`);
    }

    console.log(`${B}╠${line(W + 2)}╣${R}`);
    await sleep(50);

    // Vibecoding vs Human comparison
    const industryDays = Math.round(codeStats.totalLines / 100);
    const industryWeeks = (industryDays / 5).toFixed(1); // work weeks
    const speedup = Math.round(industryDays / gitStats.daysActive);

    row(`${c.bold}VIBECODING VS HUMAN${R}`);
    row(`${c.dim}Human solo dev (~100 lines/day):${R}  ${c.yellow}${industryDays} days${R}`);
    row(`${c.dim}You + Claude:${R}                     ${c.green}${gitStats.daysActive} days${R}`);
    row(`${c.dim}You shipped${R}                       ${c.magenta}${speedup}x faster${R} 🚀`);

    // Fun facts
    const funFacts = getFunFacts(codeStats.totalLines);

    console.log(`${B}╠${line(W + 2)}╣${R}`);
    await sleep(50);
    row(`${c.bold}FUN FACTS${R}`);
    for (const fact of funFacts) {
      row(`${c.dim}•${R} ${fact}`);
    }

    console.log(`${B}╠${line(W + 2)}╣${R}`);
    await sleep(50);

    // Encouragement
    row(`${c.bold}${c.white}"${encouragement}"${R}`);

    console.log(`${B}╚${line(W + 2)}╝${R}`);

  } finally {
    showCursor();
  }
}

// Run it
render().catch(err => {
  showCursor();
  console.error('Error:', err);
  process.exit(1);
});
