"""
Backend server for the Service Interaction Experiment.
Proxies requests from Qualtrics to the Anthropic (Claude) API,
keeping the API key secure on the server side.

Endpoints:
  POST /chat                — Send a message and get a response
  GET  /health              — Health check
  GET  /session/<id>        — Get a single session
  GET  /sessions            — List all sessions
  GET  /export/json         — Export all data as JSON
  GET  /export/csv          — Export all data as CSV (for analysis)
"""

import os
import io
import csv
import json
import uuid
import logging
import threading
from datetime import datetime

from flask import Flask, request, jsonify, Response
from flask_cors import CORS
import anthropic

from prompts import get_system_prompt, CONDITION_PROMPTS

# ──────────────────────────────────────────────────────────
# Configuration
# ──────────────────────────────────────────────────────────
app = Flask(__name__)
CORS(app)  # Allow cross-origin requests from Qualtrics

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Anthropic API key — set as environment variable on the server
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
if not ANTHROPIC_API_KEY:
    logger.warning("ANTHROPIC_API_KEY not set! The /chat endpoint will fail.")

# Claude model to use
CLAUDE_MODEL = os.environ.get("CLAUDE_MODEL", "claude-sonnet-4-20250514")

# Max tokens per response
MAX_TOKENS = int(os.environ.get("MAX_TOKENS", "300"))

# Temperature (lower = more deterministic)
TEMPERATURE = float(os.environ.get("TEMPERATURE", "0.7"))

# Rate limiting: max requests per session
MAX_REQUESTS_PER_SESSION = int(os.environ.get("MAX_REQUESTS_PER_SESSION", "30"))

# Persistent storage file (on Render, use /opt/render/project/src/ for persistence)
DATA_DIR = os.environ.get("DATA_DIR", "data")
SESSIONS_FILE = os.path.join(DATA_DIR, "sessions.json")

# ──────────────────────────────────────────────────────────
# Anthropic client
# ──────────────────────────────────────────────────────────
client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY) if ANTHROPIC_API_KEY else None

# ──────────────────────────────────────────────────────────
# Persistent session store
# ──────────────────────────────────────────────────────────
sessions = {}
_save_lock = threading.Lock()


def _load_sessions():
    """Load sessions from disk on startup."""
    global sessions
    if os.path.exists(SESSIONS_FILE):
        try:
            with open(SESSIONS_FILE, "r", encoding="utf-8") as f:
                sessions = json.load(f)
            logger.info(f"Loaded {len(sessions)} sessions from {SESSIONS_FILE}")
        except Exception as e:
            logger.error(f"Failed to load sessions: {e}")
            sessions = {}
    else:
        sessions = {}


def _save_sessions():
    """Save sessions to disk (thread-safe)."""
    with _save_lock:
        try:
            os.makedirs(DATA_DIR, exist_ok=True)
            with open(SESSIONS_FILE, "w", encoding="utf-8") as f:
                json.dump(sessions, f, ensure_ascii=False, indent=2)
        except Exception as e:
            logger.error(f"Failed to save sessions: {e}")


# Load existing sessions on startup
_load_sessions()


def _find_existing_session_by_qualtrics_id(qualtrics_id: str) -> dict | None:
    """If a Qualtrics participant already has a session, return it.
    This prevents duplicate sessions when the JS initialises twice."""
    if not qualtrics_id:
        return None
    # Don't match on unreplaced piped text or placeholder values
    if "e://" in qualtrics_id or qualtrics_id.startswith("$"):
        return None
    # Only match real Qualtrics ResponseIDs (they start with "R_")
    if not qualtrics_id.startswith("R_"):
        return None
    for sid, session in sessions.items():
        if session.get("qualtrics_id") == qualtrics_id and not session["completed"]:
            return session
    return None


def get_session(session_id: str, condition: str, topic: str = "",
                 city: str = "", companion: str = "", purpose: str = "",
                 qualtrics_id: str = "") -> dict:
    """Retrieve or initialize a conversation session."""
    # First: check if this exact session_id already exists in memory
    if session_id in sessions:
        return sessions[session_id]

    # Safety net: reload from disk in case another process saved new data
    _load_sessions()
    if session_id in sessions:
        logger.info(f"Session {session_id} found after disk reload")
        return sessions[session_id]

    # Second: check if this Qualtrics participant already has a session
    # (handles cases where the frontend creates a new session_id but
    #  the same participant is still in the same conversation)
    existing = _find_existing_session_by_qualtrics_id(qualtrics_id)
    if existing:
        logger.info(
            f"Dedup: reusing session {existing['id']} for qualtrics_id={qualtrics_id} "
            f"(new session_id={session_id} was discarded)"
        )
        return existing

    # Third: create a brand new session
    logger.info(f"New session: {session_id} | condition={condition} | qualtrics_id={qualtrics_id}")
    sessions[session_id] = {
        "id": session_id,
        "qualtrics_id": qualtrics_id,
        "condition": condition,
        "city": city,
        "companion": companion,
        "purpose": purpose,
        "topic": topic,
        "messages": [],
        "created_at": datetime.utcnow().isoformat(),
        "request_count": 0,
        "completed": False,
    }
    return sessions[session_id]


# ──────────────────────────────────────────────────────────
# POST /chat
# ──────────────────────────────────────────────────────────
@app.route("/chat", methods=["POST"])
def chat():
    """
    Handle a chat message from a participant.

    Expected JSON body:
    {
        "session_id":    "unique-session-id",
        "qualtrics_id":  "R_abc123..." (Qualtrics ResponseID for linking),
        "condition":     "human" | "human_plus" | "hybrid" | "hybrid_plus",
        "message":       "The participant's message text",
        "city":          "Paris",
        "companion":     "alone" | "family",
        "purpose":       "leisure" | "business",
        "topic":         "restaurant"
    }
    """
    try:
        if not client:
            return jsonify({"error": "API key not configured on server"}), 500

        data = request.get_json()
        if not data:
            return jsonify({"error": "No JSON body provided"}), 400

        session_id = data.get("session_id", str(uuid.uuid4()))
        qualtrics_id = data.get("qualtrics_id", "")
        condition = data.get("condition", "human")
        user_message = data.get("message", "").strip()
        city = data.get("city", "")
        companion = data.get("companion", "")
        purpose = data.get("purpose", "")
        topic = data.get("topic", "")

        if not user_message:
            return jsonify({"error": "Empty message"}), 400

        # Validate condition
        if condition.lower() not in CONDITION_PROMPTS:
            return jsonify({
                "error": f"Invalid condition: {condition}",
                "valid_conditions": list(CONDITION_PROMPTS.keys())
            }), 400

        # Get or create session
        session = get_session(session_id, condition, topic,
                              city, companion, purpose, qualtrics_id)

        # Check rate limit
        if session["request_count"] >= MAX_REQUESTS_PER_SESSION:
            return jsonify({
                "error": "Session message limit reached",
                "conversation_complete": True
            }), 429

        # Check if already completed
        if session["completed"]:
            return jsonify({
                "response": "Thank you for your visit! I hope you enjoy your stay.",
                "conversation_complete": True,
                "session_id": session_id,
                "message_count": len(session["messages"])
            })

        # Build system prompt
        system_prompt = get_system_prompt(condition)

        # Always include guest context in the system prompt (not just first message)
        # so Claude always knows the full situation on every request
        s_city = session.get("city") or city
        s_companion = session.get("companion") or companion
        s_purpose = session.get("purpose") or purpose
        s_topic = session.get("topic") or topic

        context_parts = []
        if s_city:
            context_parts.append(
                f"The hotel is located in {s_city}. All your recommendations "
                f"must be specific to {s_city} — use real-sounding place names, "
                f"neighborhoods, and local details appropriate for {s_city}."
            )
        if s_companion == "alone":
            context_parts.append("The guest is travelling alone.")
        elif s_companion == "family":
            context_parts.append("The guest is travelling with their family.")
        if s_purpose == "leisure":
            context_parts.append("This is a leisure trip.")
        elif s_purpose == "business":
            context_parts.append("This is a business trip.")
        if s_topic:
            context_parts.append(f"The guest is interested in: {s_topic} recommendations.")
        if context_parts:
            system_prompt += "\n\nGUEST CONTEXT:\n" + "\n".join(context_parts)

        # On the very first request, inject the initial greeting that the frontend
        # already showed the participant, so Claude knows the conversation has started
        # and does NOT generate a duplicate greeting.
        if session["request_count"] == 0:
            topic_names = {
                "restaurant": "restaurant", "shopping": "shopping",
                "nightlife": "nightlife", "museums": "museum and cultural",
                "sightseeing": "sightseeing", "other": "general"
            }
            topic_label = topic_names.get(s_topic, s_topic) if s_topic else "local"
            greeting = (
                f"Welcome! I'm Emma, your receptionist here in {s_city or 'the hotel'}. "
                f"I'd be happy to help you with {topic_label} recommendations. "
                f"What are you looking for specifically?"
            )
            session["messages"].append({
                "role": "assistant",
                "content": greeting,
                "timestamp": datetime.utcnow().isoformat()
            })

        # Add user message to history
        session["messages"].append({
            "role": "user",
            "content": user_message,
            "timestamp": datetime.utcnow().isoformat()
        })
        session["request_count"] += 1

        # Build messages list for Claude (without timestamps)
        claude_messages = [
            {"role": m["role"], "content": m["content"]}
            for m in session["messages"]
        ]

        # Call Claude API
        response = client.messages.create(
            model=CLAUDE_MODEL,
            max_tokens=MAX_TOKENS,
            temperature=TEMPERATURE,
            system=system_prompt,
            messages=claude_messages
        )

        # Extract response text
        assistant_message = response.content[0].text

        # Check if conversation is complete
        conversation_complete = "[CONVERSATION_COMPLETE]" in assistant_message

        # Clean the marker from the response shown to participant
        clean_response = assistant_message.replace("[CONVERSATION_COMPLETE]", "").strip()

        # Add assistant message to history
        session["messages"].append({
            "role": "assistant",
            "content": clean_response,
            "timestamp": datetime.utcnow().isoformat()
        })

        if conversation_complete:
            session["completed"] = True

        # Persist to disk
        _save_sessions()

        logger.info(
            f"Session {session_id} | Condition: {condition} | "
            f"Messages: {len(session['messages'])} | Complete: {conversation_complete}"
        )

        return jsonify({
            "response": clean_response,
            "conversation_complete": conversation_complete,
            "session_id": session_id,
            "message_count": len(session["messages"])
        })

    except anthropic.APIError as e:
        logger.error(f"Anthropic API error: {e}")
        return jsonify({"error": "AI service temporarily unavailable. Please try again."}), 503
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        return jsonify({"error": "An unexpected error occurred."}), 500


# ──────────────────────────────────────────────────────────
# GET /health
# ──────────────────────────────────────────────────────────
@app.route("/health", methods=["GET"])
def health():
    """Health check endpoint."""
    return jsonify({
        "status": "ok",
        "model": CLAUDE_MODEL,
        "valid_conditions": list(CONDITION_PROMPTS.keys()),
        "active_sessions": len(sessions),
        "timestamp": datetime.utcnow().isoformat()
    })


# ──────────────────────────────────────────────────────────
# GET /session/<session_id>
# ──────────────────────────────────────────────────────────
@app.route("/session/<session_id>", methods=["GET"])
def get_session_data(session_id):
    """Retrieve the full conversation log for a session."""
    if session_id not in sessions:
        return jsonify({"error": "Session not found"}), 404

    session = sessions[session_id]
    return jsonify({
        "session_id": session["id"],
        "condition": session["condition"],
        "topic": session.get("topic", ""),
        "created_at": session["created_at"],
        "message_count": len(session["messages"]),
        "completed": session["completed"],
        "messages": session["messages"]
    })


# ──────────────────────────────────────────────────────────
# GET /sessions
# ──────────────────────────────────────────────────────────
@app.route("/sessions", methods=["GET"])
def list_sessions():
    """List all sessions (summary view)."""
    summary = []
    for sid, session in sessions.items():
        summary.append({
            "session_id": sid,
            "condition": session["condition"],
            "topic": session.get("topic", ""),
            "created_at": session["created_at"],
            "message_count": len(session["messages"]),
            "completed": session["completed"]
        })
    return jsonify({"sessions": summary, "total": len(summary)})


# ──────────────────────────────────────────────────────────
# GET /export/json
# ──────────────────────────────────────────────────────────
@app.route("/export/json", methods=["GET"])
def export_json():
    """Export all session data as JSON."""
    all_data = []
    for sid, session in sessions.items():
        all_data.append({
            "session_id": session["id"],
            "condition": session["condition"],
            "topic": session.get("topic", ""),
            "created_at": session["created_at"],
            "message_count": len(session["messages"]),
            "completed": session["completed"],
            "messages": session["messages"]
        })
    return jsonify({
        "export_date": datetime.utcnow().isoformat(),
        "total_sessions": len(all_data),
        "sessions": all_data
    })


# ──────────────────────────────────────────────────────────
# GET /export/csv
# ──────────────────────────────────────────────────────────
@app.route("/export/csv", methods=["GET"])
def export_csv():
    """
    Export all data as CSV for analysis.
    One row per MESSAGE, with session metadata repeated on each row.
    Columns: session_id, condition, topic, created_at, completed,
             message_number, role, content, timestamp
    """
    output = io.StringIO()
    writer = csv.writer(output)

    # Header row
    writer.writerow([
        "session_id", "qualtrics_id", "condition", "city", "companion",
        "purpose", "topic", "session_created_at", "session_completed",
        "total_messages", "message_number", "role", "content", "message_timestamp"
    ])

    for sid, session in sessions.items():
        for i, msg in enumerate(session["messages"]):
            writer.writerow([
                session["id"],
                session.get("qualtrics_id", ""),
                session["condition"],
                session.get("city", ""),
                session.get("companion", ""),
                session.get("purpose", ""),
                session.get("topic", ""),
                session["created_at"],
                session["completed"],
                len(session["messages"]),
                i + 1,
                msg["role"],
                msg["content"],
                msg.get("timestamp", "")
            ])

    csv_content = output.getvalue()
    output.close()

    return Response(
        csv_content,
        mimetype="text/csv",
        headers={
            "Content-Disposition":
                f"attachment; filename=experiment_data_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.csv"
        }
    )


# ──────────────────────────────────────────────────────────
# GET /export/csv-sessions
# ──────────────────────────────────────────────────────────
@app.route("/export/csv-sessions", methods=["GET"])
def export_csv_sessions():
    """
    Export one row per SESSION (wide format).
    Columns: session_id, condition, topic, created_at, completed,
             total_messages, full_conversation_json
    """
    output = io.StringIO()
    writer = csv.writer(output)

    writer.writerow([
        "session_id", "qualtrics_id", "condition", "city", "companion",
        "purpose", "topic", "created_at", "completed", "total_messages",
        "conversation_json"
    ])

    for sid, session in sessions.items():
        writer.writerow([
            session["id"],
            session.get("qualtrics_id", ""),
            session["condition"],
            session.get("city", ""),
            session.get("companion", ""),
            session.get("purpose", ""),
            session.get("topic", ""),
            session["created_at"],
            session["completed"],
            len(session["messages"]),
            json.dumps(session["messages"], ensure_ascii=False)
        ])

    csv_content = output.getvalue()
    output.close()

    return Response(
        csv_content,
        mimetype="text/csv",
        headers={
            "Content-Disposition":
                f"attachment; filename=experiment_sessions_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.csv"
        }
    )


# ──────────────────────────────────────────────────────────
# Run
# ──────────────────────────────────────────────────────────
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    debug = os.environ.get("FLASK_DEBUG", "false").lower() == "true"
    app.run(host="0.0.0.0", port=port, debug=debug)
