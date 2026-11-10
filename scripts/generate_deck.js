/**
 * Flynn AI - Techstars Pitch Deck Generator (Global Copy Edition)
 * Compiles a widescreen 16:9 PDF using Puppeteer.
 * Run with: node scripts/generate_deck.js
 */
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const DECK_PDF_PATH = path.resolve(PROJECT_ROOT, 'Flynn_Techstars_Pitch_Deck.pdf');
const DECK_HTML_PATH = path.resolve(PROJECT_ROOT, 'scratch/deck.html');

// Ensure scratch directory exists
const scratchDir = path.resolve(PROJECT_ROOT, 'scratch');
if (!fs.existsSync(scratchDir)) {
  fs.mkdirSync(scratchDir, { recursive: true });
}

// Load the official master SVG logo and prepare fill dynamic helpers
const MASTER_SVG_PATH = path.resolve(PROJECT_ROOT, 'brand/logo-concepts/master/flynn-icon.svg');
let masterSvgRaw = '';

try {
  masterSvgRaw = fs.readFileSync(MASTER_SVG_PATH, 'utf8');
} catch (e) {
  console.warn('Official master SVG logo not loaded, using fallback: ', e.message);
  // Fallback F monogram SVG if master is missing
  masterSvgRaw = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%"><g fill="#f5ebe0"><path d="M 154.3 159.8 L 328.6 159.8 L 328.4 213.6 L 218.5 213.9 L 218.5 268.3 L 305.2 268.3 L 305.2 322.6 L 218.5 322.9 L 218.3 429.8 L 154.3 429.8 L 154.3 159.8 Z" /></g><circle cx="324.4" cy="115.0" r="33.1" fill="#f46430" /></svg>`;
}

// Helper to generate the SVG with custom main fill color
function getLogoSvg(fillColor) {
  // Replace the default cream fill (#f5ebe0) in the main group tag with our custom color
  return masterSvgRaw
    .replace('fill="#f5ebe0"', `fill="${fillColor}"`)
    .replace('<svg ', '<svg style="width: 100%; height: 100%;" ');
}

// Compile the HTML template with the official master logo
const deckHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Flynn - Pitch Deck</title>
  <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    /* Styling variables */
    :root {
      --coral: #FB5B1E;
      --cream: #F4E6CE;
      --charcoal: #2C2018;
      --white: #FFFFFF;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: 'Inter', -apple-system, sans-serif;
      color: var(--charcoal);
      background-color: var(--cream);
      -webkit-font-smoothing: antialiased;
    }

    .deck {
      display: flex;
      flex-direction: column;
    }

    /* 16:9 aspect ratio pages */
    .slide {
      width: 16in;
      height: 9in;
      position: relative;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 1.0in;
      page-break-after: always;
      box-sizing: border-box;
    }

    /* Typography styles */
    .title-font {
      font-family: 'Space Grotesk', sans-serif;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: -0.02em;
    }

    .slide.cream {
      background-color: var(--cream);
      color: var(--charcoal);
    }

    .slide.charcoal {
      background-color: var(--charcoal);
      color: var(--cream);
    }
    
    .slide.white {
      background-color: var(--white);
      color: var(--charcoal);
    }

    h1 {
      font-size: 64px;
      line-height: 1.1;
      margin-bottom: 20px;
    }
    
    h2 {
      font-size: 40px;
      line-height: 1.2;
      margin-bottom: 15px;
    }

    h3 {
      font-size: 28px;
      margin-bottom: 10px;
    }

    p {
      font-size: 20px;
      line-height: 1.5;
    }
    
    .subtitle {
      font-size: 24px;
      font-weight: 500;
      line-height: 1.4;
      max-width: 850px;
    }

    .coral-text {
      color: var(--coral);
    }

    .footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 14px;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      font-weight: 600;
      border-top: 2px solid rgba(44, 32, 24, 0.1);
      padding-top: 20px;
    }
    
    .slide.charcoal .footer {
      border-top-color: rgba(244, 230, 206, 0.1);
    }

    /* Slide 1 - Vision */
    .logo-container {
      display: flex;
      align-items: center;
      gap: 15px;
    }
    
    .logo-svg {
      width: 48px;
      height: 48px;
    }

    .vision-content {
      margin-top: auto;
      margin-bottom: auto;
    }

    .vision-headline {
      font-size: 68px;
      margin-bottom: 24px;
      max-width: 1000px;
    }

    .vision-context {
      font-size: 24px;
      opacity: 0.8;
      max-width: 750px;
    }

    /* Slide 2 - Problem */
    .problem-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 40px;
      margin-top: 40px;
    }

    .brutalist-card {
      border: 3px solid var(--cream);
      padding: 30px;
      border-radius: 12px;
      background-color: rgba(255, 255, 255, 0.04);
      display: flex;
      flex-direction: column;
      height: 100%;
    }
    
    .slide.cream .brutalist-card {
      border-color: var(--charcoal);
      background-color: var(--white);
      box-shadow: 6px 6px 0px var(--charcoal);
    }
    
    .brutalist-card h3 {
      font-family: 'Space Grotesk', sans-serif;
      margin-bottom: 15px;
      font-size: 22px;
      text-transform: uppercase;
      line-height: 1.2;
    }

    .brutalist-card p {
      font-size: 16px;
      line-height: 1.6;
      opacity: 0.9;
    }

    /* Slide 3 - Solution */
    .solution-layout {
      display: grid;
      grid-template-columns: 1.3fr 1fr;
      gap: 60px;
      align-items: center;
      height: 75%;
    }

    .solution-list {
      display: flex;
      flex-direction: column;
      gap: 25px;
    }

    .solution-item h3 {
      font-size: 24px;
      color: var(--coral);
      margin-bottom: 8px;
    }

    .solution-item p {
      font-size: 16px;
      color: #4A4A4A;
      line-height: 1.5;
    }

    /* iPhone CSS Mockup */
    .iphone-mockup {
      width: 320px;
      height: 560px;
      background-color: #1A1A1A;
      border-radius: 40px;
      padding: 10px;
      box-shadow: 0px 20px 40px rgba(0, 0, 0, 0.15);
      border: 4px solid #333;
      margin-left: auto;
      margin-right: auto;
      position: relative;
    }

    .iphone-screen {
      width: 100%;
      height: 100%;
      background-color: #F4E6CE;
      border-radius: 32px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      font-family: -apple-system, sans-serif;
    }

    .iphone-header {
      background-color: #EDE1CB;
      padding: 12px 10px 8px 10px;
      text-align: center;
      border-bottom: 1px solid #DFD4C4;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
    }
    
    .iphone-avatar {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background-color: var(--charcoal);
      display: flex;
      align-items: center;
      justify-content: center;
      border: 1px solid var(--charcoal);
      padding: 4px;
    }
    
    .iphone-title {
      font-size: 12px;
      font-weight: 700;
      color: #333;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .iphone-chat {
      flex: 1;
      padding: 15px 10px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      justify-content: flex-end;
    }

    .chat-bubble {
      max-width: 80%;
      padding: 10px 14px;
      border-radius: 18px;
      font-size: 12px;
      line-height: 1.4;
    }

    .chat-bubble.me {
      background-color: #007AFF; /* standard iMessage blue */
      color: white;
      align-self: flex-end;
      border-bottom-right-radius: 4px;
    }

    .chat-bubble.flynn {
      background-color: #E5E5EA;
      color: black;
      align-self: flex-start;
      border-bottom-left-radius: 4px;
    }

    .chat-bubble.flynn.invoice-card {
      background-color: white;
      border: 2px solid var(--charcoal);
      box-shadow: 4px 4px 0px var(--charcoal);
      border-radius: 12px;
      max-width: 85%;
      padding: 10px;
    }

    /* Slide 4 - Market & Business Model */
    .market-layout {
      display: grid;
      grid-template-columns: 1.1fr 1fr;
      gap: 60px;
      align-items: center;
      height: 75%;
    }

    .stat-callout {
      background-color: var(--white);
      border: 4px solid var(--charcoal);
      box-shadow: 10px 10px 0px var(--charcoal);
      padding: 40px;
      border-radius: 16px;
      text-align: center;
    }

    .big-number {
      font-size: 120px;
      font-family: 'Space Grotesk', sans-serif;
      font-weight: 700;
      color: var(--coral);
      line-height: 1;
    }

    .stat-label {
      font-size: 22px;
      font-weight: 600;
      margin-top: 15px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .market-points {
      display: flex;
      flex-direction: column;
      gap: 30px;
    }

    .market-point h3 {
      font-size: 22px;
      margin-bottom: 8px;
      text-transform: uppercase;
      color: var(--coral);
    }

    .market-point p {
      font-size: 16px;
      color: #4A4A4A;
      line-height: 1.5;
    }

    /* Slide 5 - Traction */
    .traction-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 30px;
      margin-top: 40px;
    }

    .traction-card {
      background-color: var(--white);
      border: 3px solid var(--charcoal);
      box-shadow: 8px 8px 0px var(--charcoal);
      border-radius: 12px;
      padding: 30px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      height: 300px;
    }

    .traction-val {
      font-size: 64px;
      font-family: 'Space Grotesk', sans-serif;
      font-weight: 700;
      color: var(--coral);
      line-height: 1;
      text-align: left;
    }
    
    .traction-title {
      font-size: 20px;
      font-weight: 600;
      margin-top: 15px;
      margin-bottom: 10px;
      text-transform: uppercase;
    }

    .traction-desc {
      font-size: 15px;
      line-height: 1.5;
      color: #555555;
    }

    /* Slide 6 - Team */
    .team-layout {
      display: grid;
      grid-template-columns: 1.2fr 1fr;
      gap: 60px;
      align-items: center;
      height: 75%;
    }

    .team-bio {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    .team-headline {
      font-size: 44px;
      margin-bottom: 5px;
    }

    .team-role {
      font-size: 22px;
      font-weight: 600;
      color: var(--coral);
      margin-bottom: 15px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .team-bullets {
      display: flex;
      flex-direction: column;
      gap: 15px;
      font-size: 17px;
      line-height: 1.6;
      list-style: none;
    }

    .team-bullets li {
      position: relative;
      padding-left: 24px;
    }
    
    .team-bullets li::before {
      content: "▪";
      color: var(--coral);
      font-size: 20px;
      position: absolute;
      left: 0;
      top: -2px;
    }

    .team-visual {
      background-color: var(--white);
      border: 3px solid var(--charcoal);
      box-shadow: 10px 10px 0px var(--charcoal);
      border-radius: 16px;
      padding: 40px;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 30px;
      height: 380px;
    }
    
    .team-logo {
      width: 140px;
      height: 140px;
    }

    .team-cta {
      font-family: 'Space Grotesk', sans-serif;
      font-size: 22px;
      font-weight: 700;
      color: var(--charcoal);
      text-transform: uppercase;
      letter-spacing: -0.01em;
      line-height: 1.3;
    }
  </style>
</head>
<body>
  <div class="deck">
  
    <!-- SLIDE 1: THE VISION (Minimalist Wordmark) -->
    <div class="slide cream">
      <div style="font-family: 'Space Grotesk', sans-serif; font-size: 48px; font-weight: 700; text-transform: uppercase; letter-spacing: -0.01em;">
        FLYNN<span class="coral-text">.</span>
      </div>
      
      <div class="vision-content">
        <h1 class="title-font vision-headline">The Zero-UI Financial Operating System for the <span class="coral-text">Deskless Economy.</span></h1>
        <p class="subtitle">Replaces complex SaaS dashboards with a proactive, team-wide text thread.</p>
      </div>
      
      <div class="footer">
        <span>01 · The Vision</span>
        <span>flynnai.app</span>
      </div>
    </div>

    <!-- SLIDE 2: THE PROBLEM (Globalised Copy) -->
    <div class="slide charcoal">
      <div class="logo-container">
        <div class="logo-svg">${getLogoSvg('#F4E6CE')}</div>
      </div>
      
      <div class="vision-content" style="margin-top: 20px;">
        <h2 class="title-font" style="font-size: 54px; margin-bottom: 30px;">The "Dashboard Tax" is Killing <span class="coral-text">Cash Flow in the Trades.</span></h2>
        
        <div class="problem-grid">
          <div class="brutalist-card">
            <h3>Deskless Workers Don't Use Laptops</h3>
            <p>A plumber covered in mud or a landscaper driving a ute physically cannot navigate a 50-screen SaaS dashboard on a job site.</p>
          </div>
          <div class="brutalist-card">
            <h3>Delayed Billing</h3>
            <p>Admin gets pushed to nights and weekends, causing severe cash-flow leaks and late invoices.</p>
          </div>
          <div class="brutalist-card">
            <h3>Team Friction</h3>
            <p>Current apps force complex "per-seat" onboarding, app downloads, and login creation for every single crew member.</p>
          </div>
        </div>
      </div>
      
      <div class="footer">
        <span>02 · The Problem</span>
        <span>flynnai.app</span>
      </div>
    </div>

    <!-- SLIDE 3: THE SOLUTION -->
    <div class="slide cream">
      <div class="logo-container">
        <div class="logo-svg">${getLogoSvg('#2C2018')}</div>
      </div>
      
      <div class="solution-layout">
        <div class="solution-content">
          <h2 class="title-font" style="font-size: 54px; margin-bottom: 25px;">Zero UI. <span class="coral-text">Pure Execution.</span></h2>
          <div class="solution-list">
            <div class="solution-item">
              <h3>Proactive Text Agent</h3>
              <p>No apps. No dashboards. Tradies simply text or voice note Flynn.</p>
            </div>
            <div class="solution-item">
              <h3>Automated Admin</h3>
              <p>Flynn instantly generates quotes, texts tracking links, and automatically chases down late payments.</p>
            </div>
            <div class="solution-item">
              <h3>Multiplayer with Zero Logins</h3>
              <p>An entire crew texts photos of receipts and hours to the exact same Flynn number. No account creation or per-seat fees required.</p>
            </div>
          </div>
        </div>
        
        <div class="solution-mockup">
          <div class="iphone-mockup">
            <div class="iphone-screen">
              <div class="iphone-header">
                <!-- Master Logo dynamically loaded inside iPhone Mockup avatar -->
                <div class="iphone-avatar">
                  ${getLogoSvg('#F4E6CE')}
                </div>
                <div class="iphone-title" style="margin-top: 4px;">Flynn</div>
              </div>
              <div class="iphone-chat">
                <div class="chat-bubble me">invoice 23 Greens Rd deck rebuild $2,400</div>
                <div class="chat-bubble flynn invoice-card">
                  <div style="font-weight:700; margin-bottom:4px; font-size:11px;">Tax Invoice · 23 Greens Rd</div>
                  <div style="font-size:14px; font-weight:bold; color:var(--coral); margin-bottom:6px;">$2,400.00</div>
                  <div style="height:44px; border-radius:4px; background:#D9D4C7 center/cover no-repeat; background-image:url('https://flynnai.app/img-03-768x768.jpg'); margin-bottom:6px;"></div>
                  <div style="font-size:10px; color:#555;">Deck rebuild job photos attached</div>
                </div>
                <div class="chat-bubble flynn">here's the invoice for $2,400. want me to send it?</div>
                <div class="chat-bubble me">yep</div>
                <div class="chat-bubble flynn">sent it to David. i'll flag when they pay.</div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div class="footer">
        <span>03 · The Solution</span>
        <span>flynnai.app</span>
      </div>
    </div>

    <!-- SLIDE 4: MARKET & BUSINESS MODEL -->
    <div class="slide cream">
      <div class="logo-container">
        <div class="logo-svg">${getLogoSvg('#2C2018')}</div>
      </div>
      
      <div class="market-layout">
        <div class="stat-callout">
          <div class="big-number">1%</div>
          <div class="stat-label">Platform Fee</div>
          <p style="font-size: 15px; margin-top: 10px; color: #555;">Taken directly at point of settlement</p>
        </div>
        
        <div class="market-points">
          <h2 class="title-font" style="font-size: 50px;">Monetizing the <span class="coral-text">Flow of Capital.</span></h2>
          
          <div class="market-point">
            <h3>The Business Model</h3>
            <p>We bypass traditional SaaS subscription friction by charging a flat 1% platform fee on top of payment processing costs at the point of settlement.</p>
          </div>
          <div class="market-point">
            <h3>The Market</h3>
            <p>Over 1.2 million tradespeople in Australia alone, and tens of millions globally.</p>
          </div>
          <div class="market-point">
            <h3>The Scale</h3>
            <p>Capturing just 5% of the massive, un-digitized transactional volume moving through the deskless economy represents a multi-billion dollar annual revenue opportunity.</p>
          </div>
        </div>
      </div>
      
      <div class="footer">
        <span>04 · Market & Model</span>
        <span>flynnai.app</span>
      </div>
    </div>

    <!-- SLIDE 5: UNFAIR DISTRIBUTION ADVANTAGE (Globalised Copy) -->
    <div class="slide cream">
      <div class="logo-container">
        <div class="logo-svg">${getLogoSvg('#2C2018')}</div>
      </div>
      
      <div class="vision-content">
        <h2 class="title-font" style="font-size: 54px; margin-bottom: 20px;">Earned Insights & <span class="coral-text">Built-In Distribution.</span></h2>
        
        <div class="traction-grid">
          <div class="traction-card">
            <div class="traction-val">900+</div>
            <div class="traction-title">Field Jobs Handled</div>
            <p class="traction-desc">Founder personally ran a logistics and removals business with an unblemished 100% 5-star track record on Airtasker—experiencing the problem firsthand.</p>
          </div>
          <div class="traction-card">
            <div class="traction-val">1,400+</div>
            <div class="traction-title">Active Tradespeople Network</div>
            <p class="traction-desc">Previously built Mates Rates, a localized services marketplace, establishing a proprietary distribution loop to acquire Flynn users at zero cost.</p>
          </div>
          <div class="traction-card">
            <div class="traction-val">8</div>
            <div class="traction-title">Beta Testers Secured</div>
            <p class="traction-desc">Launched the Flynn alpha architecture weeks ago and immediately locked in our first 8 paying beta testers.</p>
          </div>
        </div>
      </div>
      
      <div class="footer">
        <span>05 · Traction & Distribution</span>
        <span>flynnai.app</span>
      </div>
    </div>

    <!-- SLIDE 6: THE TEAM -->
    <div class="slide cream">
      <div class="logo-container">
        <div class="logo-svg">${getLogoSvg('#2C2018')}</div>
      </div>
      
      <div class="team-layout">
        <div class="team-bio">
          <h2 class="title-font team-headline">Built by Operators.</h2>
          <div class="team-role">Atticus Jackson – Founder & CEO</div>
          
          <ul class="team-bullets">
            <li>4th-year Bachelor of Engineering (Honours) / Bachelor of Business (Finance) student at Queensland University of Technology (QUT).</li>
            <li>Full-stack software builder specializing in Node.js, Vercel deployments, database replication, and LLM orchestration.</li>
            <li>Hands-on domain experience running physical trade operations.</li>
          </ul>
        </div>
        
        <div class="team-visual">
          <!-- Logo scaled up to be the focal team asset -->
          <div style="width: 140px; height: 140px; filter: drop-shadow(4px 4px 0px var(--charcoal));">${getLogoSvg('#2C2018')}</div>
          <div class="team-cta" style="margin-top: 10px;">
            Building the financial infrastructure for the physical world.
            <div class="coral-text" style="margin-top: 12px; font-size: 28px;">flynnai.app</div>
          </div>
        </div>
      </div>
      
      <div class="footer">
        <span>06 · The Team</span>
        <span>flynnai.app</span>
      </div>
    </div>

  </div>
</body>
</html>`;

fs.writeFileSync(DECK_HTML_PATH, deckHtml, 'utf8');
console.log('deck.html compiled at:', DECK_HTML_PATH);

// Render PDF using Puppeteer
(async () => {
  console.log('Launching browser via Puppeteer...');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    console.log('Loading HTML deck page...');
    await page.goto('file://' + DECK_HTML_PATH, { waitUntil: 'networkidle0' });
    
    console.log('Printing to PDF (16in x 9in)...');
    await page.pdf({
      path: DECK_PDF_PATH,
      width: '16in',
      height: '9in',
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 }
    });
    
    console.log('SUCCESS: Pitch deck created at:', DECK_PDF_PATH);
  } catch (err) {
    console.error('Failed to generate PDF:', err.message);
  } finally {
    await browser.close();
  }
})();
