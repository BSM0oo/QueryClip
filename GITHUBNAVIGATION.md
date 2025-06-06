# if i want to scroll the options for restore points how do i do this


# Basic commit log
git log

# Prettier one-line format with graph
git log --oneline --graph

# Detailed log with files changed
git log --stat

# Navigate in log view:
# Space bar - scroll down
# b - scroll up
# q - quit log view
# ↑↓ - move up/down one line


-------------  -------------  -------------  -------------

# How to test two feature versions:
1. Create a new branch for each version
2. Implement features separately
3. Switch between branches to compare
4. Choose and merge the preferred version

### Commands:

```bash
# Create and switch to branch for version 1
git checkout -b feature/version1

# Make changes and commit version 1
git add .
git commit -m "feat: implement version 1"

# Switch back to main branch
git checkout main

# Create and switch to branch for version 2
git checkout -b feature/version2

# Make changes and commit version 2
git add .
git commit -m "feat: implement version 2"

# Switch between versions to compare
git checkout feature/version1
# test version 1
git checkout feature/version2
# test version 2

# Once decided, merge preferred version
git checkout main
git merge feature/version1  # or feature/version2
```

### VS Code Shortcuts:
- `Cmd + Shift + P` -> "Git: Checkout to..."
- Source Control panel (`Cmd + Shift + G`) to manage branches