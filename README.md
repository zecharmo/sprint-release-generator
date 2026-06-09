# Sprint Release Generator — PM Portfolio

An AI-powered portfolio piece demonstrating how a PM can automate post-sprint communication across four audiences from a single Jira CSV export. Built by Molly Zechar.

---

## What This Is

Select a sprint (Feature or Hardening) and an output type. The generator reads the sprint ticket data and produces a tailored artifact for that audience — powered by Claude.

**Four outputs:**
1. Internal Release Notes — for engineering, QA, and product records
2. Customer Announcement — in-app popup style, benefit-led
3. Marketing Handoff Brief — traffic-light system flagging what to amplify
4. Sprint Demo Script — slide-by-slide for stakeholder review meeting

**Two sprint variants:**
- Sprint A: Feature sprint (Sparks, Kindle Import, Book Search)
- Sprint B: Hardening sprint (bug fixes, performance, one new feature)

---

## Deploy to Netlify

### 1. Push to GitHub
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/sprint-release-generator.git
git push -u origin main
```

### 2. Connect to Netlify
1. Netlify → Add new site → Import from GitHub
2. Select your repo
3. Build command: leave blank
4. Publish directory: `.`
5. Deploy

### 3. Add environment variable
- Key: `ANTHROPIC_API_KEY`
- Value: your key from console.anthropic.com
- Redeploy after saving

### 4. Link from Squarespace
```html
<iframe
  src="https://YOUR-SITE.netlify.app"
  width="100%"
  height="900px"
  frameborder="0"
  style="border-radius: 8px;">
</iframe>
```

---

## Project Structure

```
sprint-release-generator/
├── index.html                   # Main app
├── netlify.toml                 # Netlify config
├── package.json                 # Dependencies
├── sprint-a.csv                 # Feature sprint data
├── sprint-b.csv                 # Hardening sprint data
├── netlify/
│   └── functions/
│       └── analyze.js           # Claude API proxy + rate limiter
└── README.md
```

---

## Rate Limiting
2 runs per IP per 24 hours. Change `MAX_RUNS` in `analyze.js` to adjust.

---

Built with Claude API · Hosted on Netlify · Linked from Squarespace
