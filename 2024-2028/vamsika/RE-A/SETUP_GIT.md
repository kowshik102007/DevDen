# Git Setup Instructions

Run these commands in your terminal to push to GitHub:

```bash
cd /Users/ashish/research-companion-ai

# Add all files
git add .

# Commit changes
git commit -m "Initial commit: Research Companion AI with web app, extension, and backend"

# Set main branch (if not already set)
git branch -M main

# Add remote repository
git remote add origin https://github.com/ashish-066/RE-A.git

# Push to GitHub
git push -u origin main
```

If you get an error about remote already existing:
```bash
git remote remove origin
git remote add origin https://github.com/ashish-066/RE-A.git
```

If you need to force push (be careful with this):
```bash
git push -u origin main --force
```

