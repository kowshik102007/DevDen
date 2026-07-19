# 🚀 Deploy Your TriageAI App NOW!

Your app is ready to go live! Follow these simple steps:

## Option 1: Deploy with Vercel (Easiest - 5 minutes) ⚡

### Step 1: Install Vercel CLI
Open your terminal and run:
```bash
npm install -g vercel
```

### Step 2: Login to Vercel
```bash
vercel login
```
- Choose your preferred login method (GitHub, GitLab, Bitbucket, or Email)
- Follow the authentication prompts

### Step 3: Deploy!
```bash
vercel
```
- Press Enter to accept defaults
- Your app will be deployed in seconds!

### Step 4: Add Environment Variables
After deployment, you'll get a dashboard URL. Go there and:

1. Click on your project
2. Go to **Settings** → **Environment Variables**
3. Add these two variables:
   - **Name**: `VITE_GEMINI_API_KEY`
   - **Value**: `AIzaSyBxNPdF8ONoMp2o6_k1E_GsKeq4UV9UIOM`
   
   - **Name**: `VITE_GOOGLE_MAPS_API_KEY`
   - **Value**: `AIzaSyB8HlZhwkZThIrGiRiaF7J3YrSjx_Q0WDc`

4. Click **Save**

### Step 5: Redeploy with Environment Variables
```bash
vercel --prod
```

**🎉 Your app is now LIVE!** You'll get a URL like: `https://triageai-xyz.vercel.app`

---

## Option 2: Deploy with GitHub + Vercel (Recommended for Teams) 🐙

### Step 1: Create GitHub Repository
1. Go to [github.com](https://github.com) and create a new repository
2. Name it: `triageai` (or whatever you prefer)
3. Don't initialize with README (we already have one)

### Step 2: Push Your Code
```bash
# Add GitHub as remote
git remote add origin https://github.com/YOUR_USERNAME/triageai.git

# Push to GitHub
git branch -M main
git push -u origin main
```

### Step 3: Connect to Vercel
1. Go to [vercel.com](https://vercel.com)
2. Click **"Add New Project"**
3. Import your GitHub repository
4. Vercel will auto-detect Vite settings
5. Add environment variables (same as Option 1, Step 4)
6. Click **"Deploy"**

**🎉 Done!** Every time you push to GitHub, Vercel will auto-deploy!

---

## Option 3: Deploy with Netlify (Alternative) 🌐

### Step 1: Build Your App
```bash
npm run build
```

### Step 2: Install Netlify CLI
```bash
npm install -g netlify-cli
```

### Step 3: Login
```bash
netlify login
```

### Step 4: Deploy
```bash
netlify deploy --prod
```
- Choose "Create & configure a new site"
- Publish directory: `dist`

### Step 5: Add Environment Variables
1. Go to your Netlify dashboard
2. Site Settings → Build & Deploy → Environment
3. Add your API keys (same as Vercel)

**🎉 Live on Netlify!**

---

## 🔒 Important: Secure Your API Keys

**⚠️ WARNING**: Your API keys are currently in the `.env` file. For production:

### Option A: Use Vercel/Netlify Environment Variables (Recommended)
- Add keys in the dashboard (as shown above)
- They'll be injected at build time
- Keys never exposed in code

### Option B: Restrict API Keys
1. **Google Gemini API Key**:
   - Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
   - Click on your key → "Edit"
   - Add "HTTP referrers" restriction
   - Add your domain: `https://your-app.vercel.app/*`

2. **Google Maps API Key**:
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - APIs & Services → Credentials
   - Edit your API key
   - Add "Website restrictions"
   - Add your domain

---

## 📊 After Deployment Checklist

- [ ] App loads without errors
- [ ] All pages are accessible
- [ ] Gemini AI triage works
- [ ] Voice input works (requires HTTPS ✓)
- [ ] Photo upload works
- [ ] Navigation is smooth
- [ ] Mobile responsive
- [ ] Share the link with friends! 🎉

---

## 🌐 Custom Domain (Optional)

### Vercel
1. Go to Project Settings → Domains
2. Add your domain (e.g., `triageai.com`)
3. Update DNS records as shown
4. SSL certificate auto-provisions

### Netlify
1. Domain Settings → Add custom domain
2. Configure DNS
3. SSL auto-provisions

---

## 🆘 Troubleshooting

### "Command not found: vercel"
```bash
# Try with npx
npx vercel
```

### Build fails
```bash
# Clear cache and rebuild
rm -rf node_modules package-lock.json
npm install
npm run build
```

### Environment variables not working
- Make sure they start with `VITE_`
- Redeploy after adding them
- Check for typos

### API calls failing
- Verify API keys are correct
- Check API quotas/limits
- Ensure HTTPS is enabled

---

## 🎯 Quick Commands Reference

```bash
# Deploy to Vercel
vercel

# Deploy to production
vercel --prod

# Check deployment status
vercel ls

# View logs
vercel logs

# Remove deployment
vercel rm PROJECT_NAME
```

---

## 📞 Need Help?

- **Vercel Docs**: https://vercel.com/docs
- **Netlify Docs**: https://docs.netlify.com
- **GitHub Issues**: Create an issue in your repo

---

**🚀 Ready to go live? Run `vercel` now!**

Your professional emergency response platform is ready to help save lives! 🏥💙
