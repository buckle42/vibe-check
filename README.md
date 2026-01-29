# vibe-check

A fun stats dashboard for your code projects. See lines of code, commit streaks, activity heatmaps, and nerd culture fun facts.

## Quick Start

1. Open your terminal
2. Navigate to any git project:
   ```bash
   cd ~/your-project
   ```
3. Run the vibe check:
   ```bash
   npx @buckle42/vibe-check
   ```

That's it! Works on any git repository with code files.

## What You Get

- **Code stats** - lines, files, breakdown by language
- **Git stats** - commits, days active, streak
- **Activity calendar** - GitHub-style heatmap of last 50 days
- **Commit hours heatmap** - when you code most
- **Trophy case** - achievements unlocked
- **Vibecoding vs Human** - how much faster you shipped with Claude
- **Fun facts** - your codebase measured in Death Star trench runs, Tetris lines, LOTR journeys, and more
- **Random encouragement** - keep shipping

## Requirements

- [Node.js](https://nodejs.org/) v18+
- Git
- Must be run inside a git repository

## Claude Code Plugin

Want `/vibe-check` as a slash command in [Claude Code](https://claude.ai/claude-code)?

1. Open Claude Code:
   ```
   claude
   ```

2. Add the marketplace and install:
   ```
   /plugin marketplace add buckle42/vibe-check
   /plugin install vibe-check@buckle42-vibe-check
   ```

3. Restart Claude Code

4. Navigate to a git project and run:
   ```
   /vibe-check
   ```

5. Press **ctrl+o** to expand and see the full dashboard

## License

MIT
