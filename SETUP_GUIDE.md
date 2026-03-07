# Service Interaction Experiment — Technical Reference

> **For the full setup guide, see `QUALTRICS_STEP_BY_STEP.md`.**
> This file is a quick technical reference for developers.

---

## Architecture

```
Participant's Browser (Qualtrics)
         |
         |  HTTPS POST /chat
         v
   Flask Backend (Render.com)     <-- API key stored here (secure)
         |
         |  Anthropic API
         v
    Claude (LLM)
```

---

## 2x2 Factorial Design

|  | **Simple interaction** | **Agency / Augmentation framing** |
|---|---|---|
| **Receptionist only** | `human` | `human_plus` |
| **Receptionist + AI** | `hybrid` | `hybrid_plus` |

- **Factor 1 (rows):** Whether AI is present in the service interaction
- **Factor 2 (columns):** Whether the interaction stresses the receptionist's agency, autonomy, endorsement, and frames AI as augmenting (not substituting) the service

---

## File Structure

```
service-interaction-experiment/
|-- backend/
|   |-- app.py                    Flask server (chat, sessions, export)
|   |-- prompts.py                All 4 condition prompts (EDIT THIS for behavior)
|   |-- requirements.txt          Python dependencies
|   |-- render.yaml               Render.com deploy config
|   '-- Procfile                  Gunicorn start command
|-- frontend/
|   |-- qualtrics_chat.js         Chat interface (PASTE into Qualtrics)
|   |-- qualtrics_api_check.js    Browser pre-check (PASTE into Qualtrics)
|   '-- test_page.html            Standalone test page
|-- QUALTRICS_STEP_BY_STEP.md     Complete setup guide
|-- SETUP_GUIDE.md                This file
'-- .gitignore
```

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/chat` | Send a message, get AI response |
| GET | `/health` | Health check / connectivity test |
| GET | `/session/<id>` | Full data for one session |
| GET | `/sessions` | List all sessions (summary) |
| GET | `/export/json` | Export all data as JSON |
| GET | `/export/csv` | Export as CSV (one row per message) |
| GET | `/export/csv-sessions` | Export as CSV (one row per session) |

### POST /chat — Request body

```json
{
    "session_id": "sess_1234567890_abc123def",
    "qualtrics_id": "R_abc123...",
    "condition": "human | human_plus | hybrid | hybrid_plus",
    "message": "The participant's message text",
    "city": "Paris",
    "companion": "alone | family",
    "purpose": "leisure | business",
    "topic": "restaurant | shopping | nightlife | museums | sightseeing | other"
}
```

### POST /chat — Response body

```json
{
    "response": "Emma's reply text",
    "conversation_complete": false,
    "session_id": "sess_1234567890_abc123def",
    "message_count": 4
}
```

---

## Environment Variables (Render.com)

| Variable | Default | Description |
|----------|---------|-------------|
| `ANTHROPIC_API_KEY` | *(required)* | Your Anthropic API key |
| `CLAUDE_MODEL` | `claude-sonnet-4-20250514` | Claude model to use |
| `MAX_TOKENS` | `300` | Max tokens per response |
| `TEMPERATURE` | `0.7` | Response creativity (0.0-1.0) |
| `MAX_REQUESTS_PER_SESSION` | `30` | Max messages per conversation |
| `DATA_DIR` | `data` | Directory for session storage |

---

## Qualtrics Embedded Data Fields

| Field | Set by | Description |
|-------|--------|-------------|
| `condition` | Randomizer | human / human_plus / hybrid / hybrid_plus |
| `session_id` | Chat JS | Unique session ID (links to server data) |
| `conversation_log` | Chat JS | Full JSON array of messages |
| `message_count` | Chat JS | Total messages in conversation |
| `selected_city` | Chat JS | City participant chose |
| `selected_companion` | Chat JS | alone / family |
| `selected_purpose` | Chat JS | leisure / business |
| `selected_topic` | Chat JS | restaurant / shopping / nightlife / etc. |
| `condition_sign` | Chat JS | Condition name (for researcher reference) |
| `conversation_complete` | Chat JS | "true" if conversation ended normally |
| `browser_check` | API Check JS | "1" = pass, "0" = fail |

---

## Quick Local Test

```bash
cd backend
pip install -r requirements.txt

# Windows CMD:
set ANTHROPIC_API_KEY=sk-ant-api03-your-key-here
python app.py

# Mac/Linux:
export ANTHROPIC_API_KEY=sk-ant-api03-your-key-here
python app.py
```

Then open `frontend/test_page.html` in your browser.

---

## Cost Estimates

| Model | Cost per conversation (~10 exchanges) | 200 participants |
|-------|--------------------------------------|------------------|
| Claude Sonnet | ~$0.01-0.05 | ~$2-10 |
| Claude Haiku | ~$0.002-0.01 | ~$0.40-2 |

---

## Conversation Flow

1. Participant sees scenario description + condition-specific sign (if any)
2. Selects city (15 options) -> companion (alone/family) -> purpose (leisure/business) -> topic (6 options)
3. Emma greets and asks what they're looking for
4. Back-and-forth conversation (style varies by condition)
5. Emma makes a specific recommendation and asks participant to confirm/accept
6. Participant responds -> Emma closes warmly -> conversation ends automatically
7. 3-minute timer enforced as hard limit
8. "Continue" button appears -> participant proceeds with post-chat survey
