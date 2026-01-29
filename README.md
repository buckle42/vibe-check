# vibe-check

A fun stats dashboard for [Claude Code](https://claude.ai/claude-code) (Anthropic's CLI). Run a vibe check on any project to see lines of code, commit streaks, activity heatmaps, and nerd culture fun facts.

## Requirements

- [Claude Code](https://claude.ai/claude-code) installed
- [Node.js](https://nodejs.org/) v18+
- Git
- Must be run inside a git repository

## Installation

1. Open Claude Code in your terminal:
   ```
   claude
   ```

2. Add the plugin marketplace:
   ```
   /plugin marketplace add buckle42/vibe-check
   ```

3. Install the plugin:
   ```
   /plugin install vibe-check@buckle42-vibe-check
   ```

4. When prompted, approve the plugin installation

## Usage

1. Navigate to any git project in your terminal
2. Start Claude Code:
   ```
   claude
   ```
3. Run the vibe check:
   ```
   /vibe-check
   ```
4. First time only: approve the permission to run the stats script

## What You Get

- **Code stats** - lines, files, breakdown by language
- **Git stats** - commits, days active, streak
- **Activity calendar** - GitHub-style heatmap of last 50 days
- **Commit hours heatmap** - when you code most
- **Trophy case** - achievements unlocked
- **Vibecoding vs Human** - how much faster you shipped with Claude
- **Fun facts** - your codebase measured in Death Star trench runs, Tetris lines, LOTR journeys, and more
- **Random encouragement** - keep shipping

## License

MIT
