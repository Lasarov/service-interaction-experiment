# Complete Setup & Qualtrics Integration Guide

This guide walks you through **everything** — from getting your API key to running a live
experiment on Qualtrics. No programming experience needed; just follow each step.

---

## OVERVIEW: HOW THE SYSTEM WORKS

```
Participant opens Qualtrics survey
         |
         v
Qualtrics secretly assigns a condition (1 of 4)
         |
         v
Participant selects city, companion, purpose, topic
         |
         v
Participant chats with "Emma" (hotel receptionist)
         |
    Participant's browser  ──sends message──>  Your backend server (Render.com)
                                                    |
                                                    v
                                               Claude AI (Anthropic)
                                                    |
                                               <──reply──
         |
         v
Conversation stored in Qualtrics + on server
         |
         v
Participant continues to post-chat survey questions
```

**Key points:**
- Participants **never see** an API key, condition name, or anything technical
- Your Anthropic API key stays **safe on the server** — participants only talk to your server
- Conversations are stored in **two places** (Qualtrics embedded data + server) for safety
- The server is a small program that runs on the internet 24/7 (hosted free on Render.com)

---

## WHAT IS THE "BACKEND URL"?

You will see `BACKEND_URL` mentioned several times in this guide. Here is what it means:

**The backend** = your server program (the Flask app in `backend/app.py`). It receives
messages from participants, sends them to Claude, and returns the response.

**The backend URL** = the internet address of that server. Like a website address, but for
your server instead of a website.

- When you **test locally** on your own computer, the URL is: `http://localhost:5000`
- When you **deploy to Render.com** for the real experiment, Render gives you a URL like:
  `https://service-interaction-experiment.onrender.com`

**You MUST replace the placeholder** `https://YOUR-BACKEND-URL.onrender.com` in the
JavaScript files with your actual Render URL before pasting them into Qualtrics.

---

## STEP 1: GET YOUR ANTHROPIC API KEY

You need an API key from Anthropic to power the receptionist (Claude AI).

1. Go to **https://console.anthropic.com/**
2. **Sign up** or log in
3. Navigate to **API Keys** in the left sidebar
4. Click **Create Key** and give it a name (e.g., "hotel experiment")
5. **Copy** and **save** the key somewhere safe — it looks like:
   `sk-ant-api03-xxxxxxxxxxxxxxxxxxxx`
6. Go to **Settings > Billing** > add credit ($10-20 is enough for ~200 participants)

**Cost estimate:** Each conversation costs approximately $0.01-0.05 (10 message exchanges
with Claude Sonnet). A budget of $10-20 covers about 200-400 participants.

> **Important:** Keep your API key secret. Never share it with participants, put it in
> Qualtrics, or commit it to a public GitHub repo.

---

## STEP 2: SET UP GITHUB (needed for deployment)

You need a GitHub account to deploy your server to Render.com.

### If you have never used GitHub:

1. Go to **https://github.com** and create a free account
2. Download and install **GitHub Desktop** from https://desktop.github.com
   (this is the easiest option — no command line needed)

### Create your repository:

**Option A — Using GitHub Desktop (recommended for beginners):**

1. Open GitHub Desktop
2. Click **File > Add Local Repository**
3. Navigate to your project folder: `service-interaction-experiment`
4. If it says "This directory does not appear to be a Git repository", click **create a repository**
5. Fill in:
   - **Name:** `service-interaction-experiment`
   - **Local path:** your project folder
   - Leave "Initialize with a README" unchecked (you already have files)
6. Click **Create Repository**
7. Click **Publish repository** (top bar)
   - Uncheck "Keep this code private" if you want it public (private is fine too)
   - Click **Publish Repository**
8. You now have your code on GitHub!

**Option B — Using the command line:**

```bash
cd service-interaction-experiment
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/service-interaction-experiment.git
git branch -M main
git push -u origin main
```

### Your GitHub repository URL:
After publishing, your repo URL will be something like:
`https://github.com/YOUR_USERNAME/service-interaction-experiment`

You will need this in the next step.

---

## STEP 3: DEPLOY YOUR SERVER TO RENDER.COM

This puts your backend server on the internet so Qualtrics participants can reach it.

### 3.1 Create a Render account

1. Go to **https://render.com**
2. Click **Get Started for Free**
3. **Sign up with your GitHub account** (this makes connecting your repo easy)

### 3.2 Create a new Web Service

1. On the Render dashboard, click **New +** (top right) > **Web Service**
2. Connect your GitHub repository:
   - If you signed up with GitHub, your repos should appear automatically
   - Find and select **`service-interaction-experiment`**
   - Click **Connect**
3. Configure the service with these settings:

   | Setting | Value |
   |---------|-------|
   | **Name** | `service-interaction-experiment` (or any name you want) |
   | **Region** | Choose the closest to your participants |
   | **Branch** | `main` |
   | **Root Directory** | `backend` |
   | **Runtime** | `Python 3` |
   | **Build Command** | `pip install -r requirements.txt` |
   | **Start Command** | `gunicorn app:app --bind 0.0.0.0:$PORT --workers 2 --timeout 120` |
   | **Instance Type** | Free (or Starter at $7/mo — see note below) |

4. Scroll down to **Environment Variables** and add these:

   | Key | Value | Notes |
   |-----|-------|-------|
   | `ANTHROPIC_API_KEY` | `sk-ant-api03-your-actual-key-here` | Click "secret" to hide it |
   | `CLAUDE_MODEL` | `claude-sonnet-4-20250514` | The AI model to use |
   | `MAX_TOKENS` | `300` | Max response length per message |
   | `TEMPERATURE` | `0.7` | Creativity (0.0 = deterministic, 1.0 = creative) |

5. Click **Create Web Service**

### 3.3 Wait for deployment

- Render will now build and deploy your server (takes 2-5 minutes)
- You will see a log of the build process
- When it says **"Your service is live"**, you're ready!

### 3.4 Find your Backend URL

After deployment, Render shows your URL at the top of the page. It looks like:

```
https://service-interaction-experiment.onrender.com
```

**This is your BACKEND_URL.** Write it down — you will need it in Steps 6 and 7.

### 3.5 Test your server

Open a browser and go to: `https://YOUR-APP-NAME.onrender.com/health`

You should see something like:
```json
{"status": "ok", "model": "claude-sonnet-4-20250514", "valid_conditions": ["human", "human_plus", "hybrid", "hybrid_plus"]}
```

If you see this, your server is working!

> **Note about the free tier:** Free Render servers "sleep" after 15 minutes of no
> activity. The first request after sleeping takes ~30 seconds to wake up. This is fine for
> testing, but for a live experiment with participants, consider upgrading to the **Starter
> plan ($7/month)** to keep the server always awake. You can upgrade temporarily just for
> your data collection period.

---

## STEP 4: TEST LOCALLY (optional but recommended)

Before setting up Qualtrics, you can test the chat on your own computer.

### 4.1 Install Python dependencies

Open a terminal/command prompt and run:

```bash
cd service-interaction-experiment/backend
pip install -r requirements.txt
```

### 4.2 Start the local server

**On Windows (Command Prompt):**
```bash
set ANTHROPIC_API_KEY=sk-ant-api03-your-key-here
python app.py
```

**On Windows (PowerShell):**
```bash
$env:ANTHROPIC_API_KEY="sk-ant-api03-your-key-here"
python app.py
```

**On Mac/Linux:**
```bash
export ANTHROPIC_API_KEY=sk-ant-api03-your-key-here
python app.py
```

You should see: `Running on http://127.0.0.1:5000`

### 4.3 Test with the test page

1. Open `frontend/test_page.html` in your browser (just double-click the file)
2. The **Backend URL** should already be set to `http://localhost:5000`
   (if not, type it in and click "Update")
3. Select a condition from the dropdown
4. Click **Start** → select a city → companion → purpose → topic
5. Chat with Emma and see how the conversation flows
6. Try all 4 conditions to see the behavioral differences

### 4.4 Verify data storage

While the local server is running, open in your browser:
- `http://localhost:5000/sessions` — see a list of all test conversations
- `http://localhost:5000/export/csv` — download all data as CSV

---

## STEP 5: CREATE THE QUALTRICS SURVEY

Now set up the actual survey in Qualtrics.

1. Log in to Qualtrics (**https://your-institution.qualtrics.com**)
2. Click **Create new project** > **Survey** > **Blank survey**
3. Name it (e.g., "Service Interaction Experiment")
4. Click **Create project**

---

## STEP 6: SET UP EMBEDDED DATA FIELDS

These invisible fields store the condition assignment and conversation data.
Participants never see them.

1. Click **Survey flow** (left sidebar or top menu)
2. At the very TOP of the flow, click **Add a New Element Here**
3. Select **Embedded Data**
4. Add each of these fields by clicking **Add a New Field** for each one.
   Type the field name **EXACTLY** as shown (case-sensitive):

   | Field name             | Value          |
   |------------------------|----------------|
   | `condition`            | *(leave blank)* |
   | `session_id`           | *(leave blank)* |
   | `conversation_log`     | *(leave blank)* |
   | `message_count`        | *(leave blank)* |
   | `selected_city`        | *(leave blank)* |
   | `selected_companion`   | *(leave blank)* |
   | `selected_purpose`     | *(leave blank)* |
   | `selected_topic`       | *(leave blank)* |
   | `condition_sign`       | *(leave blank)* |
   | `conversation_complete`| *(leave blank)* |
   | `browser_check`        | *(leave blank)* |

5. Click **Apply** (bottom right)

---

## STEP 7: SET UP RANDOM CONDITION ASSIGNMENT

This is where participants get randomly assigned. They never see this happening.

1. Still in **Survey flow**
2. Click **Add a New Element Here** (BELOW the Embedded Data block you just created)
3. Select **Randomizer**
4. In the Randomizer box, check **Evenly present elements**
5. Now add 4 branches inside the Randomizer. For each one:
   - Click **Add a New Element Here** inside the Randomizer
   - Select **Embedded Data**
   - Set a single field:

   **Branch 1:** Click the Randomizer's "Add a new element here"
   > Embedded Data > Field name: `condition` > Set Value to: `human`

   **Branch 2:** Click the Randomizer's "Add a new element here"
   > Embedded Data > Field name: `condition` > Set Value to: `human_plus`

   **Branch 3:** Click the Randomizer's "Add a new element here"
   > Embedded Data > Field name: `condition` > Set Value to: `hybrid`

   **Branch 4:** Click the Randomizer's "Add a new element here"
   > Embedded Data > Field name: `condition` > Set Value to: `hybrid_plus`

6. Your Survey Flow should now look like this:

   ```
   Embedded Data
     condition (blank)
     session_id (blank)
     conversation_log (blank)
     ... (all the other fields)

   Randomizer — Evenly present elements
     |-- Embedded Data: condition = human
     |-- Embedded Data: condition = human_plus
     |-- Embedded Data: condition = hybrid
     '-- Embedded Data: condition = hybrid_plus
   ```

7. Click **Apply**

**How this is invisible to participants:** The Randomizer silently picks one of the 4
branches and sets the `condition` field. The participant sees nothing — no branching,
no condition names, no group labels. They just proceed to the next page.

---

## STEP 8: ADD THE BROWSER COMPATIBILITY CHECK (Page 1)

This silently tests whether the participant's browser can reach your server.
If it can't, they get screened out immediately.

### 8.1 Add the check question

1. Go back to the **Builder** view (click the survey name at the top)
2. You should see a default question block. Click on it.
3. Change the first question type to **Text / Graphic** (dropdown on the left)
4. Set the question text to:
   ```
   Please wait while we check your browser compatibility...
   ```
5. Click the **gear icon** on this question
6. Select **Add JavaScript...**
7. **Delete** all the default template code in the editor
8. Open the file `frontend/qualtrics_api_check.js` from your project folder
9. **IMPORTANT — Change the URL:** Find this line near the top of the file (line 26):
   ```javascript
   var BACKEND_URL = "https://YOUR-BACKEND-URL.onrender.com";
   ```
   Replace `https://YOUR-BACKEND-URL.onrender.com` with **your actual Render URL** from Step 3.
   For example, if your Render URL is `https://service-interaction-experiment.onrender.com`,
   the line should become:
   ```javascript
   var BACKEND_URL = "https://service-interaction-experiment.onrender.com";
   ```
10. **Copy the entire file** (after making the URL change) and paste it into the
    Qualtrics JavaScript editor
11. Click **Save**

### 8.2 Add the screen-out logic

12. Go to **Survey flow**
13. BELOW the Randomizer, your Question Block should appear
14. Click **Add a New Element Here** (below the question block that contains the check)
15. Select **Branch**
16. Set the branch condition:
    - **If** > Embedded Data > `browser_check` > Is Equal To > `0`
17. Inside this branch, click **Add a New Element Here** > **End of Survey**
    - Optionally customize the end-of-survey message:
      "We're sorry, but your browser does not support this study."
18. Click **Apply**

---

## STEP 9: ADD YOUR PRE-CHAT QUESTIONS (optional)

If you have questions before the chat (consent form, demographics, etc.):

1. Go back to **Builder**
2. Add a **new Block** (click "Add Block" at the bottom)
3. Add your pre-chat questions in this block
4. In **Survey flow**, make sure this block appears AFTER the browser check
   and BEFORE the chat block

---

## STEP 10: ADD THE CHAT INTERFACE

This is the main experiment question where participants interact with Emma.

1. Add a **new Block** (or use the next available block)
2. Add a single **Text / Graphic** question
3. Set the question text to something like:
   ```
   Please interact with the hotel receptionist below.
   ```
   (Or leave it blank — the JavaScript will replace the content anyway)
4. Click the **gear icon** on this question
5. Select **Add JavaScript...**
6. **Delete** all the default template code
7. Open the file `frontend/qualtrics_chat.js` from your project folder
8. **IMPORTANT — Change the URL:** Find this line near the top of the file (line 20):
   ```javascript
   var BACKEND_URL = "https://YOUR-BACKEND-URL.onrender.com";
   ```
   Replace `https://YOUR-BACKEND-URL.onrender.com` with **your actual Render URL** from Step 3.
   **This must be the same URL you used in Step 8.** For example:
   ```javascript
   var BACKEND_URL = "https://service-interaction-experiment.onrender.com";
   ```
9. **Copy the entire file** (after making the URL change) and paste it into
   the JavaScript editor
10. Click **Save**

**Important:** Make sure this question is on its OWN page (page break before and after).
In the Block options, set "Page break" between questions if needed, or put it in its own block.

---

## STEP 11: ADD YOUR POST-CHAT QUESTIONS

1. Add another **new Block** after the chat block
2. Add your dependent measures, manipulation checks, etc.
3. You can reference the conversation data using Qualtrics piped text:
   - `${e://Field/condition}` — shows which condition was assigned
   - `${e://Field/selected_city}` — the city the participant chose
   - `${e://Field/selected_topic}` — the topic they chose
   - `${e://Field/selected_companion}` — alone or family
   - `${e://Field/selected_purpose}` — leisure or business

---

## STEP 12: VERIFY YOUR SURVEY FLOW

Go to **Survey flow** one final time. It should look like this:

```
+---------------------------------------------------+
| Embedded Data                                      |
|   condition = (blank)                              |
|   session_id = (blank)                             |
|   conversation_log = (blank)                       |
|   message_count = (blank)                          |
|   selected_city = (blank)                          |
|   selected_companion = (blank)                     |
|   selected_purpose = (blank)                       |
|   selected_topic = (blank)                         |
|   condition_sign = (blank)                         |
|   conversation_complete = (blank)                  |
|   browser_check = (blank)                          |
+---------------------------------------------------+
| Randomizer — Evenly present elements               |
|   |-- Embedded Data: condition = human             |
|   |-- Embedded Data: condition = human_plus        |
|   |-- Embedded Data: condition = hybrid            |
|   '-- Embedded Data: condition = hybrid_plus       |
+---------------------------------------------------+
| Block: Browser Check                               |
|   (Text/Graphic question with API check JS)        |
+---------------------------------------------------+
| Branch: If browser_check = 0                       |
|   '-- End of Survey                                |
+---------------------------------------------------+
| Block: Pre-chat questions (optional)               |
+---------------------------------------------------+
| Block: Chat Interface                              |
|   (Text/Graphic question with chat JS)             |
+---------------------------------------------------+
| Block: Post-chat questions                         |
+---------------------------------------------------+
| End of Survey                                      |
+---------------------------------------------------+
```

Click **Apply** to save.

---

## STEP 13: TEST YOUR SURVEY

**IMPORTANT: Do NOT use the Qualtrics "Preview" button.** It does not run JavaScript properly.

Instead:

1. Go to **Distributions** (top menu)
2. Click **Anonymous Link**
3. Toggle it **ON** if not already active
4. Copy the anonymous link
5. Open it in a **new browser tab** (or incognito window)
6. Walk through the survey — you should see:
   - Browser check passes automatically (green checkmark, auto-advances)
   - Scenario description + condition sign (depending on your random assignment)
   - City selection (15 cities)
   - Companion selection (alone / family)
   - Purpose selection (leisure / business)
   - Topic selection (6 topics)
   - Chat with Emma (3-minute timer visible)
   - Conversation ends -> "Continue" button -> post-chat questions

7. **Test each condition:** You'll need to open the link 4-8 times to randomly
   land on each condition. Or temporarily force a specific condition:
   - Go to **Survey flow** > in the initial Embedded Data block,
     set `condition` = `hybrid_plus` (instead of blank)
   - Test that condition
   - Change to another condition and test again
   - **IMPORTANT: Set it back to blank before going live!**

8. After testing, check your server's data:
   - Visit `https://YOUR-APP-NAME.onrender.com/sessions` to see recorded conversations
   - Visit `https://YOUR-APP-NAME.onrender.com/export/csv` to download data as CSV

---

## STEP 14: GO LIVE

1. In **Survey flow**, make sure `condition` is **blank** (so the randomizer works)
2. In **Survey options**:
   - Set your desired settings (anonymous, prevent retakes, etc.)
3. Go to **Distributions**
4. Generate your anonymous link or use your preferred distribution method
5. Share the link with participants

> **Reminder:** If using Render's free tier, your server sleeps after 15 min of inactivity
> and takes ~30 seconds to wake up. The browser check page handles this gracefully (it waits
> up to 15 seconds). But for a smoother participant experience, consider upgrading to
> Render's Starter plan ($7/month) during your data collection period.

---

## WHAT CAN YOU MODIFY AFTERWARDS?

### YES — you can change these at any time:

| What | How | Re-paste in Qualtrics? |
|------|-----|------------------------|
| **Receptionist communication style** | Edit `prompts.py` on server -> push to GitHub -> auto-redeploys | No |
| **Condition-specific behavior** | Edit `prompts.py` -> change any of the 4 condition prompts | No |
| **Add/remove conditions** | Edit `prompts.py` + add Randomizer branch in Qualtrics | Yes (if changing JS signs) |
| **Scenario description text** | Edit `qualtrics_chat.js` -> scenario-intro section | Yes |
| **Sign text per condition** | Edit `qualtrics_chat.js` -> conditionSigns object | Yes |
| **City list** | Edit `qualtrics_chat.js` -> city-btn elements | Yes |
| **Topic options** | Edit `qualtrics_chat.js` -> topic-btn elements | Yes |
| **Time limit** | Edit `qualtrics_chat.js` -> TIME_LIMIT_SECONDS variable | Yes |
| **Claude model** | Change CLAUDE_MODEL env var on Render | No |
| **Response length/creativity** | Change MAX_TOKENS / TEMPERATURE env vars on Render | No |
| **Pre/post-chat survey questions** | Edit directly in Qualtrics | No (just edit in Qualtrics) |

### How to make changes (two workflows):

**Workflow A — Backend changes (no re-paste needed):**
These are changes to the receptionist's behavior, model, or parameters.

1. Edit `backend/prompts.py` (or change environment variables on Render dashboard)
2. Push to GitHub:
   - **GitHub Desktop:** Make your changes, go to GitHub Desktop, write a commit message,
     click "Commit to main", then click "Push origin"
   - **Command line:** `git add . && git commit -m "Update prompts" && git push`
3. Render auto-redeploys in ~2 minutes
4. New participants get the updated behavior immediately
5. **You do NOT need to touch Qualtrics at all**

**Workflow B — Frontend changes (re-paste needed):**
These are changes to what participants see (signs, cities, topics, timer).

1. Edit `frontend/qualtrics_chat.js` on your computer
2. **Make sure the BACKEND_URL is still set to your Render URL** (not localhost!)
3. Go to Qualtrics -> click the chat question -> gear icon -> Add JavaScript
4. Select all text -> delete -> paste the updated file
5. Save

### What about participants mid-study?
- Participants who **already completed** the survey are NOT affected by changes
- Changes only apply to **new** participants going forward
- All conversation data remains stored on the server regardless of changes

### Common modifications you might want to make:

**"I want to change how the receptionist speaks"**
-> Edit `backend/prompts.py` > `SHARED_CONTEXT` (affects all conditions) or the individual
condition prompt. Push to GitHub. Done.

**"I want to add a new condition"**
-> 1) Add a new prompt in `prompts.py` + add it to `CONDITION_PROMPTS` dict
-> 2) Add a new Randomizer branch in Qualtrics Survey Flow
-> 3) Add the sign text in `qualtrics_chat.js` > conditionSigns object -> re-paste

**"I want to change the city list"**
-> Edit the `city-btn` spans in `frontend/qualtrics_chat.js` -> re-paste into Qualtrics

**"I want to remove the time limit"**
-> Set `TIME_LIMIT_SECONDS = 99999` in `frontend/qualtrics_chat.js` -> re-paste

**"I want to change the Claude model"**
-> Go to Render dashboard > your service > Environment > change `CLAUDE_MODEL`
   (e.g., to `claude-haiku-4-20250414` for faster/cheaper responses)

**"I want to change response length or creativity"**
-> Go to Render dashboard > your service > Environment > change `MAX_TOKENS` or `TEMPERATURE`

---

## HOW RANDOM ASSIGNMENT WORKS (invisible to participants)

Qualtrics assigns each participant to a condition BEFORE they see any questions.
The condition value is stored in an invisible "embedded data" field. The participant
never sees which condition they are in — they only see the corresponding sign text
and experience the matching receptionist behavior. There is no mention of "conditions"
or "experimental groups" anywhere in the participant-facing survey.

### The 4 conditions (2x2 factorial design):

```
                           Factor 2: Interaction Framing
                       SIMPLE              AGENCY / AUGMENTATION
                  +------------------+----------------------------+
Factor 1:         |                  |                            |
Receptionist only | HUMAN            | HUMAN_PLUS                 |
                  | (simple, direct) | (elaborate process, agency |
                  |                  |  framing, no AI)           |
                  +------------------+----------------------------+
Receptionist      |                  |                            |
+ AI              | HYBRID           | HYBRID_PLUS                |
                  | (simple, AI does | (human-first + AI-augments |
                  |  the heavy work) |  recurring every exchange) |
                  +------------------+----------------------------+
```

- **HUMAN:** Simple, direct. Receptionist uses personal knowledge. No AI mentioned ever.
- **HUMAN_PLUS:** Same as above but with an elaborate process showing agency, autonomy,
  and thoroughness. Still no AI — everything attributed to the receptionist's own initiative.
- **HYBRID:** Receptionist relies heavily on an AI tool throughout the conversation.
  Low human agency — the AI is clearly doing the work.
- **HYBRID_PLUS:** Receptionist leads, AI supports. A recurring cycle every exchange:
  human thinks first -> AI supplements -> human endorses. AI augments (~20%), never substitutes.

---

## DATA YOU COLLECT

For every participant, you get:

### In Qualtrics (exported with survey data):

| Field | Description |
|-------|-------------|
| `condition` | human / human_plus / hybrid / hybrid_plus |
| `selected_city` | Which city they picked |
| `selected_companion` | alone / family |
| `selected_purpose` | leisure / business |
| `selected_topic` | restaurant / shopping / nightlife / etc. |
| `conversation_log` | Full JSON of every message with timestamps |
| `message_count` | Number of messages exchanged |
| `conversation_complete` | Whether conversation ended naturally |
| `session_id` | Links to server-side data |
| All your survey questions | Standard Qualtrics export |

### On server (download from your Render URL):

| URL path | Description |
|----------|-------------|
| `/sessions` | Summary list of all sessions |
| `/session/SESSION_ID` | Full data for one session |
| `/export/json` | All data as JSON |
| `/export/csv` | All data as CSV (one row per message) |
| `/export/csv-sessions` | All data as CSV (one row per session) |

**To access:** Open `https://YOUR-APP-NAME.onrender.com/export/csv` in your browser.

**To merge Qualtrics + server data:** Export from both, then join on `session_id`.

---

## TROUBLESHOOTING

| Problem | Solution |
|---------|----------|
| Chat doesn't load in Qualtrics | Check that `BACKEND_URL` in the JS is your actual Render URL (not the placeholder). Test by visiting `https://YOUR-URL.onrender.com/health` in your browser. |
| "API key not configured" error | Go to Render dashboard > your service > Environment > make sure `ANTHROPIC_API_KEY` is set correctly. |
| Browser check always fails | The Render free tier server might be sleeping. Visit your `/health` URL manually first to wake it, then retry. Consider upgrading to Starter plan. |
| Qualtrics Preview doesn't work | This is normal. Qualtrics Preview doesn't run JavaScript well. Always use the **Anonymous Link** (Distributions tab) for testing. |
| Embedded data not saving | Check that the field names in Qualtrics Survey Flow match EXACTLY (case-sensitive). |
| CORS error in browser console | This should not happen if you deployed the code as-is. Make sure `flask-cors` is in requirements.txt. |
| Conversations lost on server restart | Data is saved to `data/sessions.json`. On Render free tier, data may be lost when the server re-deploys (free tier has ephemeral storage). Download your data regularly via `/export/csv`. |
| Server takes 30+ seconds to respond | Render free tier servers sleep after 15 min. First request wakes them up (~30 sec). Upgrade to Starter ($7/mo) for always-on. |
| Participants see raw placeholder text | You forgot to change `BACKEND_URL` from the placeholder. See Steps 8 and 10. |

---

## FILE REFERENCE

```
service-interaction-experiment/
|
|-- backend/                         [SERVER CODE - deployed to Render.com]
|   |-- app.py                       Main server (handles chat, data, exports)
|   |-- prompts.py                   All 4 condition prompts (edit this for behavior changes)
|   |-- requirements.txt             Python dependencies
|   |-- render.yaml                  Render.com auto-deploy config
|   '-- Procfile                     Alternative deploy config
|
|-- frontend/                        [QUALTRICS CODE - paste into survey]
|   |-- qualtrics_chat.js            Main chat interface (paste into chat question)
|   |-- qualtrics_api_check.js       Browser check (paste into first question)
|   '-- test_page.html               Local test page (for testing without Qualtrics)
|
|-- QUALTRICS_STEP_BY_STEP.md        This file (complete setup guide)
|-- SETUP_GUIDE.md                   Technical reference
'-- .gitignore                       Git ignore rules
```
