# 📦 GitHub Upload Guide

## ✅ What WILL Be Uploaded (Safe to Share)

### Source Code
- ✅ `src/` - All your React components and pages
- ✅ `public/` - Public assets (icons, images)
- ✅ `index.html` - Main HTML file
- ✅ `package.json` - Dependencies list
- ✅ `package-lock.json` - Locked dependency versions

### Configuration Files
- ✅ `vite.config.js` - Vite build configuration
- ✅ `vercel.json` - Vercel deployment settings
- ✅ `.gitignore` - Git ignore rules
- ✅ `.env.example` - Example environment variables (NO REAL KEYS!)

### Documentation
- ✅ `README.md` - Project documentation
- ✅ `FEATURES.md` - Feature list
- ✅ `DEPLOYMENT.md` - Deployment guide
- ✅ `CHANGES.md` - UI changes summary
- ✅ `DEPLOY_NOW.md` - Quick deploy guide

### Spec Files
- ✅ `.kiro/specs/` - Project specifications

---

## ❌ What WON'T Be Uploaded (Protected)

### Sensitive Files (Automatically Ignored)
- ❌ `.env` - **YOUR ACTUAL API KEYS** (NEVER upload this!)
- ❌ `node_modules/` - Dependencies (too large, can be reinstalled)
- ❌ `dist/` - Build output (generated automatically)
- ❌ `src-backup/` - Backup files
- ❌ `triage-ai-reference/` - Reference repository

### System Files
- ❌ `.DS_Store` - Mac system files
- ❌ `Thumbs.db` - Windows thumbnails
- ❌ `.vscode/` - Editor settings
- ❌ Log files (`*.log`)

---

## 🔒 Security Check

### ⚠️ CRITICAL: Before Uploading to GitHub

**Check that `.env` is NOT being uploaded:**

```bash
git status
```

If you see `.env` in the list, **DO NOT COMMIT!** Run:
```bash
git rm --cached .env
```

### Your API Keys Are Safe Because:
1. ✅ `.env` is in `.gitignore`
2. ✅ Only `.env.example` (with placeholders) will be uploaded
3. ✅ Real keys are only in Vercel environment variables

---

## 📤 How to Upload to GitHub

### Step 1: Create GitHub Repository
1. Go to https://github.com/new
2. Repository name: `triageai` (or your choice)
3. Description: "AI-Powered Emergency Response Platform"
4. **Keep it Public** (or Private if you prefer)
5. **Don't** initialize with README (you already have one)
6. Click **"Create repository"**

### Step 2: Push Your Code

```bash
# Add GitHub as remote
git remote add origin https://github.com/YOUR_USERNAME/triageai.git

# Push to GitHub
git branch -M main
git push -u origin main
```

### Step 3: Verify Upload
1. Go to your GitHub repository
2. Check that files are there
3. **Verify `.env` is NOT visible** (should only see `.env.example`)

---

## 📊 What People Will See on GitHub

When someone visits your repository, they'll see:

### 1. **README.md** (First thing they see)
- Project description
- Features list
- Installation instructions
- Tech stack
- Screenshots (if you add them)

### 2. **Source Code**
- All your React components
- Professional UI code
- Gemini AI integration
- State management

### 3. **Documentation**
- How to deploy
- Feature showcase
- Development guide

### 4. **They CAN'T See:**
- ❌ Your API keys
- ❌ Your environment variables
- ❌ Your local files

---

## 🎯 After Uploading

### Add These to Your README (Optional):

**Badges:**
```markdown
![React](https://img.shields.io/badge/React-19.2.5-61DAFB?logo=react)
![Vite](https://img.shields.io/badge/Vite-8.0.10-646CFF?logo=vite)
![Vercel](https://img.shields.io/badge/Deployed-Vercel-000000?logo=vercel)
```

**Live Demo Link:**
```markdown
🌐 **Live Demo:** [https://tri-age.vercel.app](https://tri-age.vercel.app)
```

**Screenshots:**
- Take screenshots of your app
- Add them to a `screenshots/` folder
- Reference them in README

---

## 🔄 Updating Your Repository

After making changes:

```bash
# Check what changed
git status

# Add all changes
git add .

# Commit with a message
git commit -m "Add new feature: XYZ"

# Push to GitHub
git push
```

**Vercel will automatically redeploy** when you push to GitHub (if connected)!

---

## 🛡️ Security Best Practices

### DO:
- ✅ Keep `.env` in `.gitignore`
- ✅ Use environment variables for secrets
- ✅ Share `.env.example` with placeholder values
- ✅ Document how to get API keys

### DON'T:
- ❌ Commit `.env` file
- ❌ Hardcode API keys in source code
- ❌ Share your actual API keys publicly
- ❌ Commit `node_modules/`

---

## 📝 Quick Checklist Before Upload

- [ ] `.env` is in `.gitignore`
- [ ] No API keys in source code
- [ ] README.md is complete
- [ ] `.env.example` has placeholder values
- [ ] All code is committed
- [ ] Repository is created on GitHub
- [ ] Remote is added
- [ ] Code is pushed

---

## 🎉 After Upload

Your repository will be:
- ✅ **Public** (if you chose public) - anyone can see the code
- ✅ **Forkable** - others can copy and modify
- ✅ **Clonable** - others can download and run locally
- ✅ **Professional** - shows your skills to employers/collaborators

**Share your GitHub repo link:**
```
https://github.com/YOUR_USERNAME/triageai
```

---

## 🆘 Troubleshooting

### "Permission denied" error
```bash
# Use HTTPS instead of SSH
git remote set-url origin https://github.com/YOUR_USERNAME/triageai.git
```

### "Repository not found"
- Check the URL is correct
- Make sure you created the repository on GitHub
- Verify you're logged in to GitHub

### ".env file is showing in git status"
```bash
# Remove it from git tracking
git rm --cached .env

# Make sure .gitignore includes .env
echo ".env" >> .gitignore

# Commit the change
git add .gitignore
git commit -m "Ensure .env is ignored"
```

---

**Ready to upload?** Follow Step 1 above! 🚀
