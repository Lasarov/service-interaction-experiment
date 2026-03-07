/*
 * ============================================================
 * API CONNECTIVITY CHECK — Qualtrics First Page
 * ============================================================
 *
 * Place this on the VERY FIRST page of your survey (before anything else).
 * It silently tests whether the participant's browser can reach your backend.
 *
 * SETUP:
 * 1. Create an embedded data field: "browser_check" (leave blank)
 * 2. Create a Text/Graphic question on the first page with text like:
 *    "Checking browser compatibility, please wait..."
 * 3. Paste this script into that question's JavaScript editor
 * 4. In Survey Flow, add Branch Logic AFTER this page:
 *    - If browser_check = 0 → redirect to End of Survey
 *      (custom message: "Sorry, your network does not support this study.")
 *    - If browser_check = 1 → continue to the main survey
 *
 * 5. CHANGE the BACKEND_URL below to your actual server URL
 * ============================================================
 */

Qualtrics.SurveyEngine.addOnload(function () {

    // CHANGE THIS to your actual backend URL
    var BACKEND_URL = "https://YOUR-BACKEND-URL.onrender.com";

    var that = this;

    // Hide the Next button while checking
    that.hideNextButton();

    // Show a loading message
    var container = this.getQuestionContainer();
    container.innerHTML =
        '<div style="text-align:center; padding:40px; font-family:sans-serif;">' +
        '  <div style="font-size:24px; margin-bottom:16px;">&#9203;</div>' +
        '  <p style="font-size:16px; color:#333;">Checking browser compatibility...</p>' +
        '  <p style="font-size:13px; color:#888;">This takes only a few seconds.</p>' +
        '</div>';

    // Test connectivity to the backend /health endpoint
    var xhr = new XMLHttpRequest();
    xhr.open("GET", BACKEND_URL + "/health", true);
    xhr.timeout = 15000; // 15 second timeout

    xhr.onload = function () {
        if (xhr.status === 200) {
            // Success — participant can reach the backend
            Qualtrics.SurveyEngine.setEmbeddedData("browser_check", "1");
            container.innerHTML =
                '<div style="text-align:center; padding:40px; font-family:sans-serif;">' +
                '  <div style="font-size:24px; margin-bottom:16px;">&#9989;</div>' +
                '  <p style="font-size:16px; color:#28a745;">Browser compatible. Proceeding...</p>' +
                '</div>';
            // Auto-advance after 1.5 seconds
            setTimeout(function () {
                that.showNextButton();
                that.clickNextButton();
            }, 1500);
        } else {
            // Server responded but with an error
            Qualtrics.SurveyEngine.setEmbeddedData("browser_check", "0");
            container.innerHTML =
                '<div style="text-align:center; padding:40px; font-family:sans-serif;">' +
                '  <div style="font-size:24px; margin-bottom:16px;">&#10060;</div>' +
                '  <p style="font-size:16px; color:#dc3545;">Compatibility check failed.</p>' +
                '  <p style="font-size:13px; color:#888;">Your network may not support this study.</p>' +
                '</div>';
            setTimeout(function () {
                that.showNextButton();
                that.clickNextButton();
            }, 3000);
        }
    };

    xhr.onerror = function () {
        Qualtrics.SurveyEngine.setEmbeddedData("browser_check", "0");
        container.innerHTML =
            '<div style="text-align:center; padding:40px; font-family:sans-serif;">' +
            '  <div style="font-size:24px; margin-bottom:16px;">&#10060;</div>' +
            '  <p style="font-size:16px; color:#dc3545;">Connection failed.</p>' +
            '  <p style="font-size:13px; color:#888;">Your network appears to block the required service.</p>' +
            '</div>';
        setTimeout(function () {
            that.showNextButton();
            that.clickNextButton();
        }, 3000);
    };

    xhr.ontimeout = function () {
        Qualtrics.SurveyEngine.setEmbeddedData("browser_check", "0");
        container.innerHTML =
            '<div style="text-align:center; padding:40px; font-family:sans-serif;">' +
            '  <div style="font-size:24px; margin-bottom:16px;">&#10060;</div>' +
            '  <p style="font-size:16px; color:#dc3545;">Connection timed out.</p>' +
            '  <p style="font-size:13px; color:#888;">Please check your internet connection.</p>' +
            '</div>';
        setTimeout(function () {
            that.showNextButton();
            that.clickNextButton();
        }, 3000);
    };

    xhr.send();
});

Qualtrics.SurveyEngine.addOnReady(function () {});
Qualtrics.SurveyEngine.addOnUnload(function () {});
