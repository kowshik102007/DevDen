# 🚀 Deployment Guide - TriageAI

## Quick Deploy Options

### Option 1: Vercel (Recommended) ⚡

**Why Vercel?**
- Zero configuration
- Automatic HTTPS
- Global CDN
- Free tier available
- Perfect for React/Vite apps

**Steps:**

1. **Install Vercel CLI**
   ```bash
   npm install -g vercel
   ```

2. **Login to Vercel**
   ```bash
   vercel login
   ```

3. **Deploy**
   ```bash
   vercel
   ```

4. **Add Environment Variables**
   - Go to your project dashboard on vercel.com
   - Settings → Environment Variables
   - Add:
     - `VITE_GEMINI_API_KEY`
     - `VITE_GOOGLE_MAPS_API_KEY`

5. **Redeploy**
   ```bash
   vercel --prod
   ```

**Your app is live!** 🎉

---

### Option 2: Netlify 🌐

**Why Netlify?**
- Simple drag-and-drop
- Automatic builds
- Free SSL
- Form handling
- Serverless functions

**Steps:**

1. **Build the project**
   ```bash
   npm run build
   ```

2. **Install Netlify CLI**
   ```bash
   npm install -g netlify-cli
   ```

3. **Login**
   ```bash
   netlify login
   ```

4. **Deploy**
   ```bash
   netlify deploy --prod
   ```

5. **Set Environment Variables**
   - Go to Site Settings → Build & Deploy → Environment
   - Add your API keys

**Alternative: Drag & Drop**
1. Build: `npm run build`
2. Go to [app.netlify.com/drop](https://app.netlify.com/drop)
3. Drag the `dist` folder
4. Done!

---

### Option 3: GitHub Pages 📄

**Why GitHub Pages?**
- Free hosting
- Integrated with GitHub
- Custom domains
- Version control

**Steps:**

1. **Install gh-pages**
   ```bash
   npm install --save-dev gh-pages
   ```

2. **Update package.json**
   ```json
   {
     "homepage": "https://yourusername.github.io/triageai",
     "scripts": {
       "predeploy": "npm run build",
       "deploy": "gh-pages -d dist"
     }
   }
   ```

3. **Update vite.config.js**
   ```javascript
   export default {
     base: '/triageai/',
     // ... rest of config
   }
   ```

4. **Deploy**
   ```bash
   npm run deploy
   ```

**Note:** Environment variables need to be hardcoded or use a backend proxy for GitHub Pages.

---

### Option 4: Firebase Hosting 🔥

**Why Firebase?**
- Google integration
- Fast CDN
- Free tier
- Analytics included

**Steps:**

1. **Install Firebase CLI**
   ```bash
   npm install -g firebase-tools
   ```

2. **Login**
   ```bash
   firebase login
   ```

3. **Initialize**
   ```bash
   firebase init hosting
   ```
   - Select "Use an existing project" or create new
   - Set public directory to `dist`
   - Configure as single-page app: Yes
   - Don't overwrite index.html

4. **Build**
   ```bash
   npm run build
   ```

5. **Deploy**
   ```bash
   firebase deploy
   ```

---

### Option 5: Docker 🐳

**Why Docker?**
- Consistent environments
- Easy scaling
- Cloud-agnostic
- Self-hosted option

**Dockerfile:**
```dockerfile
FROM node:18-alpine as build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

**nginx.conf:**
```nginx
server {
    listen 80;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /assets {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

**Build & Run:**
```bash
docker build -t triageai .
docker run -p 8080:80 triageai
```

---

## Environment Variables Setup

### Required Variables
```env
VITE_GEMINI_API_KEY=your_gemini_api_key_here
VITE_GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here
```

### Getting API Keys

**Google Gemini API Key:**
1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Click "Create API Key"
3. Copy the key
4. Add to your deployment platform

**Google Maps API Key:**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable "Maps JavaScript API"
4. Go to Credentials → Create Credentials → API Key
5. Restrict the key (optional but recommended)
6. Copy and add to deployment

---

## Post-Deployment Checklist

### ✅ Functionality
- [ ] App loads without errors
- [ ] Navigation works (all pages accessible)
- [ ] Gemini API calls succeed
- [ ] Voice input works (HTTPS required)
- [ ] Photo upload works
- [ ] Forms submit correctly
- [ ] Responsive on mobile

### ✅ Performance
- [ ] Page load < 3 seconds
- [ ] Lighthouse score > 90
- [ ] No console errors
- [ ] Images optimized
- [ ] Fonts loading correctly

### ✅ Security
- [ ] HTTPS enabled
- [ ] API keys not exposed in client
- [ ] CSP headers configured
- [ ] CORS properly set
- [ ] No sensitive data in logs

### ✅ SEO & Meta
- [ ] Title tag correct
- [ ] Meta description present
- [ ] Open Graph tags (optional)
- [ ] Favicon displays
- [ ] Sitemap generated (optional)

---

## Custom Domain Setup

### Vercel
1. Go to Project Settings → Domains
2. Add your domain
3. Update DNS records as shown
4. Wait for SSL certificate (automatic)

### Netlify
1. Go to Domain Settings
2. Add custom domain
3. Configure DNS
4. SSL auto-provisions

### Cloudflare (Any Host)
1. Add site to Cloudflare
2. Update nameservers
3. Enable "Always Use HTTPS"
4. Configure page rules
5. Enable caching

---

## Monitoring & Analytics

### Google Analytics
Add to `index.html`:
```html
<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-XXXXXXXXXX');
</script>
```

### Sentry (Error Tracking)
```bash
npm install @sentry/react
```

```javascript
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: "your-sentry-dsn",
  environment: "production",
});
```

---

## Troubleshooting

### Build Fails
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
npm run build
```

### Environment Variables Not Working
- Ensure they start with `VITE_`
- Restart dev server after adding
- Check deployment platform settings
- Verify no typos in variable names

### 404 on Refresh
- Configure server for SPA routing
- Add `_redirects` file (Netlify)
- Update `vercel.json` (Vercel)
- Configure nginx (Docker)

### API Calls Failing
- Check CORS settings
- Verify API keys are correct
- Check API quotas/limits
- Ensure HTTPS for production

---

## Performance Optimization

### Before Deploy
```bash
# Analyze bundle size
npm run build
npx vite-bundle-visualizer

# Optimize images
npm install -g sharp-cli
sharp -i src/assets/*.png -o src/assets/ -f webp
```

### CDN Configuration
- Enable gzip/brotli compression
- Set cache headers for static assets
- Use CDN for fonts and icons
- Lazy load images

---

## Backup & Rollback

### Vercel
- Automatic deployment history
- One-click rollback in dashboard
- Git-based versioning

### Netlify
- Deploy previews for each commit
- Instant rollback to any deploy
- Branch deploys

### Manual Backup
```bash
# Backup dist folder
tar -czf triageai-backup-$(date +%Y%m%d).tar.gz dist/

# Restore
tar -xzf triageai-backup-YYYYMMDD.tar.gz
```

---

**Need help?** Open an issue on GitHub or contact support! 🚀
