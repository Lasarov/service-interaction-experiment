/*
 * ============================================================
 * SERVICE INTERACTION EXPERIMENT — Qualtrics Chat Interface
 * ============================================================
 *
 * SETUP IN QUALTRICS:
 * 1. Create embedded data fields in Survey Flow (BEFORE the chat question):
 *    - condition, session_id, conversation_log, message_count,
 *      selected_city, selected_companion, selected_purpose,
 *      selected_topic, condition_sign, conversation_complete
 *
 * 2. Create a Text/Graphic question → JavaScript editor → paste this file
 * 3. Set BACKEND_URL below to your deployed Flask server URL
 * ============================================================
 */

Qualtrics.SurveyEngine.addOnload(function () {

    // ── CONFIGURATION ─────────────────────────────────────
    var BACKEND_URL = "https://YOUR-BACKEND-URL.onrender.com";
    var TIME_LIMIT_SECONDS = 180;

    // ── READ CONDITION & QUALTRICS RESPONSE ID ─────────
    var condition = "${e://Field/condition}" || "human";
    var qualtricsId = "${e://Field/ResponseID}" || "";
    var sessionId = "sess_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9);
    Qualtrics.SurveyEngine.setEmbeddedData("session_id", sessionId);
    Qualtrics.SurveyEngine.setEmbeddedData("condition_sign", condition);

    var that = this;
    that.hideNextButton();

    // ── CONDITION SIGNS ───────────────────────────────────
    var conditionSigns = {
        "human": "",
        "human_plus": '<div class="desk-sign sign-human-plus">' +
            '<strong>100% Human service:</strong> You receive the same fully personal, human service ' +
            'as always, delivered through our receptionists\u2019 expertise. We add extra support ' +
            '(like real-time checks on availability, opening hours, and pacing) to strengthen ' +
            'recommendations (about 20% additional support). Your receptionist is there from start ' +
            'to finish and delivers the best possible service.</div>',
        "hybrid": '<div class="desk-sign sign-hybrid">' +
            'Do not hesitate to ask our receptionists if you need anything. They support you with ' +
            'their expertise, in collaboration with our dedicated AI assistants.</div>',
        "hybrid_plus": '<div class="desk-sign sign-hybrid-plus">' +
            '<strong>100% Human service \u2014 supported by AI:</strong> You receive the same fully ' +
            'personal, human service as always, delivered by our receptionists\u2019 expertise. AI adds ' +
            'extra support (like real-time checks on availability, opening hours, and pacing) to ' +
            'strengthen recommendations (about 20% extra support). Your receptionist stays in charge ' +
            'from start to finish and delivers the best possible service.</div>'
    };

    // ── BUILD HTML ────────────────────────────────────────
    var container = this.getQuestionContainer();
    container.innerHTML = '';

    var html = '' +
        '<style>' +
        '  .chat-experiment { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; max-width: 620px; margin: 0 auto; }' +
        '  .scenario-intro { background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 8px; padding: 16px; margin-bottom: 16px; font-size: 14px; line-height: 1.5; color: #333; }' +
        '  .scenario-intro strong { color: #1a1a1a; }' +
        '  .desk-sign { background: #fff3cd; border: 1px solid #ffc107; border-radius: 6px; padding: 12px 16px; margin: 12px 0; font-size: 13px; line-height: 1.5; color: #664d03; }' +
        '  .sign-hybrid, .sign-hybrid-plus { background: #d1ecf1; border-color: #0dcaf0; color: #055160; }' +
        '  .sign-human-plus { background: #fff3cd; border-color: #ffc107; color: #664d03; }' +

        /* Selection screens */
        '  .selection-screen { text-align: center; margin: 20px 0; }' +
        '  .selection-screen p { font-size: 15px; margin-bottom: 12px; color: #333; }' +
        '  .sel-btn { display: inline-block; margin: 5px; padding: 10px 18px; background: #f0f0f0; border: 2px solid #ccc; border-radius: 20px; cursor: pointer; font-size: 14px; transition: all 0.2s; user-select: none; }' +
        '  .sel-btn:hover { background: #4a90d9; color: white; border-color: #4a90d9; }' +
        '  .sel-btn.selected { background: #4a90d9; color: white; border-color: #4a90d9; }' +
        '  .city-grid { display: flex; flex-wrap: wrap; justify-content: center; gap: 6px; max-width: 580px; margin: 0 auto; }' +
        '  .city-grid .sel-btn { padding: 8px 14px; font-size: 13px; }' +

        /* Chat */
        '  .chat-window { display: none; border: 1px solid #dee2e6; border-radius: 8px; overflow: hidden; background: #fff; }' +
        '  .chat-header { background: #4a90d9; color: white; padding: 12px 16px; font-size: 15px; display: flex; justify-content: space-between; align-items: center; }' +
        '  .chat-header .timer { background: rgba(255,255,255,0.2); padding: 4px 10px; border-radius: 12px; font-size: 13px; }' +
        '  .timer.warning { background: rgba(255,0,0,0.3); animation: pulse 1s infinite; }' +
        '  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.6} }' +
        '  .chat-messages { height: 350px; overflow-y: auto; padding: 16px; background: #f8f9fa; }' +
        '  .message { margin-bottom: 12px; display: flex; }' +
        '  .message.user { justify-content: flex-end; }' +
        '  .message.assistant { justify-content: flex-start; }' +
        '  .message .bubble { max-width: 80%; padding: 10px 14px; border-radius: 16px; font-size: 14px; line-height: 1.5; white-space: pre-wrap; }' +
        '  .message.user .bubble { background: #4a90d9; color: white; border-bottom-right-radius: 4px; }' +
        '  .message.assistant .bubble { background: white; color: #333; border: 1px solid #e0e0e0; border-bottom-left-radius: 4px; }' +
        '  .typing-indicator { display: none; margin-bottom: 12px; }' +
        '  .typing-indicator .bubble { background: white; border: 1px solid #e0e0e0; border-radius: 16px; padding: 10px 14px; }' +
        '  .typing-dots { display: inline-flex; gap: 4px; }' +
        '  .typing-dots span { width: 8px; height: 8px; background: #999; border-radius: 50%; animation: typingBounce 1.4s infinite; }' +
        '  .typing-dots span:nth-child(2) { animation-delay: 0.2s; }' +
        '  .typing-dots span:nth-child(3) { animation-delay: 0.4s; }' +
        '  @keyframes typingBounce { 0%,60%,100%{transform:translateY(0)} 30%{transform:translateY(-6px)} }' +
        '  .chat-input-area { display: flex; padding: 12px; background: #fff; border-top: 1px solid #dee2e6; gap: 8px; }' +
        '  .chat-input-area input { flex: 1; padding: 10px 14px; border: 1px solid #dee2e6; border-radius: 20px; font-size: 14px; outline: none; }' +
        '  .chat-input-area input:focus { border-color: #4a90d9; }' +
        '  .chat-input-area button { padding: 10px 20px; background: #4a90d9; color: white; border: none; border-radius: 20px; cursor: pointer; font-size: 14px; }' +
        '  .chat-input-area button:hover { background: #357abd; }' +
        '  .chat-input-area button:disabled { background: #ccc; cursor: not-allowed; }' +
        '  .chat-ended { text-align: center; padding: 20px; background: #d4edda; border-radius: 8px; margin-top: 12px; }' +
        '  .chat-ended p { margin: 0 0 12px 0; color: #155724; font-size: 14px; }' +
        '  .chat-ended button { padding: 10px 24px; background: #28a745; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; }' +
        '  .chat-ended button:hover { background: #218838; }' +
        '</style>' +

        '<div class="chat-experiment">' +

        /* Scenario */
        '  <div class="scenario-intro">' +
        '    <strong>Scenario:</strong> You are checking in at a hotel for a short trip. ' +
        '    After receiving your room key, you decide to ask the receptionist for a recommendation. ' +
        '    First, please tell us a bit about your trip, then have a conversation with the receptionist.' +
        (conditionSigns[condition] || '') +
        '  </div>' +

        /* Step 1: City */
        '  <div class="selection-screen" id="stepCity">' +
        '    <p><strong>Where are you staying?</strong></p>' +
        '    <div class="city-grid">' +
        '      <span class="sel-btn city-btn" data-city="Paris">&#127467;&#127479; Paris</span>' +
        '      <span class="sel-btn city-btn" data-city="London">&#127468;&#127463; London</span>' +
        '      <span class="sel-btn city-btn" data-city="New York">&#127482;&#127480; New York</span>' +
        '      <span class="sel-btn city-btn" data-city="Tokyo">&#127471;&#127477; Tokyo</span>' +
        '      <span class="sel-btn city-btn" data-city="Rome">&#127470;&#127481; Rome</span>' +
        '      <span class="sel-btn city-btn" data-city="Barcelona">&#127466;&#127480; Barcelona</span>' +
        '      <span class="sel-btn city-btn" data-city="Dubai">&#127462;&#127466; Dubai</span>' +
        '      <span class="sel-btn city-btn" data-city="Bangkok">&#127481;&#127469; Bangkok</span>' +
        '      <span class="sel-btn city-btn" data-city="Istanbul">&#127481;&#127479; Istanbul</span>' +
        '      <span class="sel-btn city-btn" data-city="Singapore">&#127480;&#127468; Singapore</span>' +
        '      <span class="sel-btn city-btn" data-city="Amsterdam">&#127475;&#127473; Amsterdam</span>' +
        '      <span class="sel-btn city-btn" data-city="Sydney">&#127462;&#127482; Sydney</span>' +
        '      <span class="sel-btn city-btn" data-city="Lisbon">&#127477;&#127481; Lisbon</span>' +
        '      <span class="sel-btn city-btn" data-city="Prague">&#127464;&#127487; Prague</span>' +
        '      <span class="sel-btn city-btn" data-city="Bali">&#127470;&#127465; Bali</span>' +
        '    </div>' +
        '  </div>' +

        /* Step 2: Companion */
        '  <div class="selection-screen" id="stepCompanion" style="display:none;">' +
        '    <p><strong>Who are you travelling with?</strong></p>' +
        '    <span class="sel-btn comp-btn" data-companion="alone">&#128100; Alone</span>' +
        '    <span class="sel-btn comp-btn" data-companion="family">&#128106; With family</span>' +
        '  </div>' +

        /* Step 3: Purpose */
        '  <div class="selection-screen" id="stepPurpose" style="display:none;">' +
        '    <p><strong>What is the purpose of your trip?</strong></p>' +
        '    <span class="sel-btn purp-btn" data-purpose="leisure">&#127965; Leisure</span>' +
        '    <span class="sel-btn purp-btn" data-purpose="business">&#128188; Business</span>' +
        '  </div>' +

        /* Step 4: Topic */
        '  <div class="selection-screen" id="stepTopic" style="display:none;">' +
        '    <p><strong>What would you like to ask the receptionist about?</strong></p>' +
        '    <span class="sel-btn topic-btn" data-topic="restaurant">&#127860; Restaurant</span>' +
        '    <span class="sel-btn topic-btn" data-topic="shopping">&#128717; Shopping</span>' +
        '    <span class="sel-btn topic-btn" data-topic="nightlife">&#127865; Nightlife</span>' +
        '    <span class="sel-btn topic-btn" data-topic="museums">&#127963; Museums &amp; Culture</span>' +
        '    <span class="sel-btn topic-btn" data-topic="sightseeing">&#128247; Sightseeing</span>' +
        '    <span class="sel-btn topic-btn" data-topic="other">&#128172; Other</span>' +
        '  </div>' +

        /* Chat */
        '  <div class="chat-window" id="chatWindow">' +
        '    <div class="chat-header">' +
        '      <span>&#128587; Emma \u2014 Hotel Receptionist</span>' +
        '      <span class="timer" id="timerDisplay">3:00</span>' +
        '    </div>' +
        '    <div class="chat-messages" id="chatMessages">' +
        '      <div class="typing-indicator" id="typingIndicator">' +
        '        <div class="bubble"><div class="typing-dots"><span></span><span></span><span></span></div></div>' +
        '      </div>' +
        '    </div>' +
        '    <div class="chat-input-area" id="chatInputArea">' +
        '      <input type="text" id="userInput" placeholder="Type your message..." />' +
        '      <button id="sendBtn">Send</button>' +
        '    </div>' +
        '  </div>' +

        '  <div class="chat-ended" id="chatEnded" style="display:none;">' +
        '    <p><strong>Conversation complete!</strong> Thank you for interacting with the receptionist.</p>' +
        '    <p>Please click "Continue" to proceed with the survey.</p>' +
        '    <button id="continueBtn">Continue</button>' +
        '  </div>' +

        '</div>';

    container.innerHTML = html;

    // ── STATE ─────────────────────────────────────────────
    var selectedCity = "";
    var selectedCompanion = "";
    var selectedPurpose = "";
    var selectedTopic = "";
    var conversationLog = [];
    var timerInterval = null;
    var remainingSeconds = TIME_LIMIT_SECONDS;
    var isWaitingForResponse = false;
    var conversationComplete = false;

    // ── DOM REFS ──────────────────────────────────────────
    var chatWindowEl = document.getElementById("chatWindow");
    var chatMessagesEl = document.getElementById("chatMessages");
    var typingIndicatorEl = document.getElementById("typingIndicator");
    var userInputEl = document.getElementById("userInput");
    var sendBtnEl = document.getElementById("sendBtn");
    var timerDisplayEl = document.getElementById("timerDisplay");
    var chatEndedEl = document.getElementById("chatEnded");
    var chatInputAreaEl = document.getElementById("chatInputArea");
    var continueBtnEl = document.getElementById("continueBtn");

    // ── STEP 1: CITY SELECTION ────────────────────────────
    var cityBtns = document.querySelectorAll(".city-btn");
    for (var i = 0; i < cityBtns.length; i++) {
        cityBtns[i].addEventListener("click", function () {
            selectedCity = this.getAttribute("data-city");
            for (var j = 0; j < cityBtns.length; j++) cityBtns[j].classList.remove("selected");
            this.classList.add("selected");
            Qualtrics.SurveyEngine.setEmbeddedData("selected_city", selectedCity);
            setTimeout(function () {
                document.getElementById("stepCity").style.display = "none";
                document.getElementById("stepCompanion").style.display = "block";
            }, 250);
        });
    }

    // ── STEP 2: COMPANION SELECTION ───────────────────────
    var compBtns = document.querySelectorAll(".comp-btn");
    for (var i = 0; i < compBtns.length; i++) {
        compBtns[i].addEventListener("click", function () {
            selectedCompanion = this.getAttribute("data-companion");
            for (var j = 0; j < compBtns.length; j++) compBtns[j].classList.remove("selected");
            this.classList.add("selected");
            Qualtrics.SurveyEngine.setEmbeddedData("selected_companion", selectedCompanion);
            setTimeout(function () {
                document.getElementById("stepCompanion").style.display = "none";
                document.getElementById("stepPurpose").style.display = "block";
            }, 250);
        });
    }

    // ── STEP 3: PURPOSE SELECTION ─────────────────────────
    var purpBtns = document.querySelectorAll(".purp-btn");
    for (var i = 0; i < purpBtns.length; i++) {
        purpBtns[i].addEventListener("click", function () {
            selectedPurpose = this.getAttribute("data-purpose");
            for (var j = 0; j < purpBtns.length; j++) purpBtns[j].classList.remove("selected");
            this.classList.add("selected");
            Qualtrics.SurveyEngine.setEmbeddedData("selected_purpose", selectedPurpose);
            setTimeout(function () {
                document.getElementById("stepPurpose").style.display = "none";
                document.getElementById("stepTopic").style.display = "block";
            }, 250);
        });
    }

    // ── STEP 4: TOPIC → START CHAT ───────────────────────
    var topicBtns = document.querySelectorAll(".topic-btn");
    for (var i = 0; i < topicBtns.length; i++) {
        topicBtns[i].addEventListener("click", function () {
            selectedTopic = this.getAttribute("data-topic");
            for (var j = 0; j < topicBtns.length; j++) topicBtns[j].classList.remove("selected");
            this.classList.add("selected");
            Qualtrics.SurveyEngine.setEmbeddedData("selected_topic", selectedTopic);
            setTimeout(function () {
                document.getElementById("stepTopic").style.display = "none";
                chatWindowEl.style.display = "block";
                startTimer();
                var topicNames = { restaurant:"restaurant", shopping:"shopping", nightlife:"nightlife", museums:"museum and cultural", sightseeing:"sightseeing", other:"" };
                var topicLabel = topicNames[selectedTopic] || selectedTopic;
                addMessage("assistant",
                    "Welcome! I'm Emma, your receptionist here in " + selectedCity + ". " +
                    "I'd be happy to help you with " + topicLabel + " recommendations. " +
                    "What are you looking for specifically?"
                );
                userInputEl.focus();
            }, 300);
        });
    }

    // ── TIMER ─────────────────────────────────────────────
    function startTimer() {
        timerInterval = setInterval(function () {
            remainingSeconds--;
            var mins = Math.floor(remainingSeconds / 60);
            var secs = remainingSeconds % 60;
            timerDisplayEl.textContent = mins + ":" + (secs < 10 ? "0" : "") + secs;
            if (remainingSeconds <= 30) timerDisplayEl.classList.add("warning");
            if (remainingSeconds <= 0) { clearInterval(timerInterval); endConversation(); }
        }, 1000);
    }

    // ── ADD MESSAGE ───────────────────────────────────────
    function addMessage(role, text) {
        var msgDiv = document.createElement("div");
        msgDiv.className = "message " + role;
        var bubble = document.createElement("div");
        bubble.className = "bubble";
        bubble.textContent = text;
        msgDiv.appendChild(bubble);
        chatMessagesEl.insertBefore(msgDiv, typingIndicatorEl);
        chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
        conversationLog.push({ role: role, content: text, timestamp: new Date().toISOString() });
    }

    // ── SEND MESSAGE ──────────────────────────────────────
    function sendMessage() {
        var userText = userInputEl.value.trim();
        if (!userText || isWaitingForResponse || conversationComplete) return;
        addMessage("user", userText);
        userInputEl.value = "";
        userInputEl.disabled = true;
        sendBtnEl.disabled = true;
        isWaitingForResponse = true;
        typingIndicatorEl.style.display = "block";
        chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;

        var xhr = new XMLHttpRequest();
        xhr.open("POST", BACKEND_URL + "/chat", true);
        xhr.setRequestHeader("Content-Type", "application/json");
        xhr.timeout = 30000;

        xhr.onload = function () {
            typingIndicatorEl.style.display = "none";
            isWaitingForResponse = false;
            if (xhr.status === 200) {
                var data = JSON.parse(xhr.responseText);
                addMessage("assistant", data.response);
                if (data.conversation_complete) {
                    setTimeout(function () { endConversation(); }, 1500);
                } else {
                    userInputEl.disabled = false;
                    sendBtnEl.disabled = false;
                    userInputEl.focus();
                }
            } else if (xhr.status === 429) {
                endConversation();
            } else {
                addMessage("assistant", "I'm sorry, I seem to be having a moment. Could you repeat that?");
                userInputEl.disabled = false;
                sendBtnEl.disabled = false;
            }
        };
        xhr.onerror = function () {
            typingIndicatorEl.style.display = "none";
            isWaitingForResponse = false;
            addMessage("assistant", "I apologize \u2014 I'm having a slight technical issue. Please try again.");
            userInputEl.disabled = false;
            sendBtnEl.disabled = false;
        };
        xhr.ontimeout = function () {
            typingIndicatorEl.style.display = "none";
            isWaitingForResponse = false;
            addMessage("assistant", "I'm sorry, that took too long. Could you please try again?");
            userInputEl.disabled = false;
            sendBtnEl.disabled = false;
        };

        xhr.send(JSON.stringify({
            session_id: sessionId,
            qualtrics_id: qualtricsId,
            condition: condition,
            message: userText,
            topic: selectedTopic,
            city: selectedCity,
            companion: selectedCompanion,
            purpose: selectedPurpose
        }));
    }

    // ── END CONVERSATION ──────────────────────────────────
    function endConversation() {
        conversationComplete = true;
        if (timerInterval) clearInterval(timerInterval);
        userInputEl.disabled = true;
        sendBtnEl.disabled = true;
        chatInputAreaEl.style.display = "none";
        chatEndedEl.style.display = "block";
        Qualtrics.SurveyEngine.setEmbeddedData("conversation_log", JSON.stringify(conversationLog));
        Qualtrics.SurveyEngine.setEmbeddedData("message_count", String(conversationLog.length));
        Qualtrics.SurveyEngine.setEmbeddedData("conversation_complete", "true");
    }

    // ── CONTINUE BUTTON ───────────────────────────────────
    continueBtnEl.addEventListener("click", function () {
        Qualtrics.SurveyEngine.setEmbeddedData("conversation_log", JSON.stringify(conversationLog));
        that.showNextButton();
        that.clickNextButton();
    });

    // ── EVENT LISTENERS ───────────────────────────────────
    sendBtnEl.addEventListener("click", sendMessage);
    userInputEl.addEventListener("keypress", function (e) {
        if (e.key === "Enter" || e.keyCode === 13) sendMessage();
    });
});

Qualtrics.SurveyEngine.addOnReady(function () {});
Qualtrics.SurveyEngine.addOnUnload(function () {});
