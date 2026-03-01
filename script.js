// Version: 1.1.0 (Robust Normalization Update)
(function () {
    var CONFIG = {
        webhookUrl: 'https://sl11565-n8n-free.hf.space/webhook/ed6bee45-c6b0-4511-8660-b4589689d9b5',
        mockDelay: 1200,
        minWords: 100,
        maxWords: 600
    };

    var MOCK_RESPONSE = {
        "studentTextSummary": "The student reflects on testing an AI tutor, identifies strengths in the tutor's questioning approach.",
        "answers": {
            "A": { "label": "Supportive", "text": "Good self-awareness. Add a concrete example of a question." },
            "B": { "label": "Detailed", "text": "Clear start, needs specific evidence. Add one specific interaction." },
            "C": { "label": "Reflective", "text": "identified your reflection is too descriptive. Why does it matter?" }
        },
        "evaluation": {
            "winner": "B",
            "winnerLabel": "Detailed",
            "evaluatorNotes": "Variant B gives clear direction and asks for concrete evidence."
        }
    };

    function init() {
        var form = document.getElementById('reflection-form');
        var textarea = document.getElementById('reflection-text');
        var wordCountBadge = document.getElementById('word-count');
        var inputSection = document.getElementById('input-section');
        var loadingSection = document.getElementById('loading-section');
        var resultsSection = document.getElementById('results-section');
        var restartBtn = document.getElementById('restart-btn');
        var mockBtn = document.getElementById('mock-btn');
        var toast = document.getElementById('toast');

        var studentSummaryEl = document.getElementById('student-summary');
        var evalWinnerLabelEl = document.getElementById('winner-label');
        var evalNotesEl = document.getElementById('evaluator-notes');

        if (!form || !textarea) return;

        function showUI(section) {
            if (inputSection) inputSection.style.display = (section === 'input' ? 'block' : 'none');
            if (loadingSection) loadingSection.style.display = (section === 'loading' ? 'block' : 'none');
            if (resultsSection) resultsSection.style.display = (section === 'results' ? 'block' : 'none');
        }

        function updateWordCount() {
            var text = textarea.value.trim();
            var words = text ? text.split(/\s+/).length : 0;
            wordCountBadge.textContent = words + ' / ' + CONFIG.maxWords + ' words';

            if (words > CONFIG.maxWords) {
                wordCountBadge.style.color = '#ef4444';
            } else if (words >= CONFIG.minWords) {
                wordCountBadge.style.color = '#10b981';
            } else {
                wordCountBadge.style.color = '#818cf8';
            }
        }

        textarea.addEventListener('input', updateWordCount);

        form.addEventListener('submit', function (e) {
            e.preventDefault();
            var text = textarea.value.trim();
            var words = text ? text.split(/\s+/).length : 0;

            if (words < CONFIG.minWords || words > CONFIG.maxWords) {
                alert('Please enter between ' + CONFIG.minWords + ' and ' + CONFIG.maxWords + ' words.');
                return;
            }

            execute(text, false);
        });

        mockBtn.addEventListener('click', function () {
            textarea.value = "This is a placeholder reflection that meets the word count requirements for testing the system flow. It contains enough words to bypass the validation and trigger the analysis process accurately for the user.";
            updateWordCount();
            execute(textarea.value, true);
        });

        restartBtn.addEventListener('click', function () {
            showUI('input');
            textarea.value = '';
            updateWordCount();
            window.scrollTo(0, 0);
        });

        function execute(text, isMock) {
            showUI('loading');
            if (window.scrollTo) window.scrollTo(0, 0);

            if (isMock) {
                setTimeout(function () {
                    displayResults(MOCK_RESPONSE);
                }, CONFIG.mockDelay);
            } else {
                console.log('Fetching from n8n...', CONFIG.webhookUrl);
                fetch(CONFIG.webhookUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify({ studentText: text })
                })
                    .then(function (response) {
                        console.log('Response status:', response.status);
                        return response.text().then(function (rawText) {
                            return { ok: response.ok, status: response.status, text: rawText };
                        });
                    })
                    .then(function (result) {
                        if (!result.ok) {
                            throw new Error('Server error ' + result.status + ': ' + (result.text || 'Empty'));
                        }
                        if (!result.text || result.text.trim() === '') {
                            throw new Error('Server returned an empty response. Check if n8n is set to "Respond: When Last Node Finishes".');
                        }

                        var data;
                        try {
                            data = JSON.parse(result.text);
                        } catch (e) {
                            throw new Error('Invalid JSON from server. Raw text: ' + result.text.substring(0, 50));
                        }

                        console.log('Received data:', data);

                        // Normalize n8n response shape robustly
                        var payload = data;

                        // unwrap array
                        if (Array.isArray(payload)) payload = payload[0];

                        // unwrap repeated "output" wrappers (up to 3 levels)
                        for (var i = 0; i < 3; i++) {
                            if (payload && payload.output) {
                                payload = payload.output;
                            } else {
                                break;
                            }
                        }

                        // if payload is still a JSON string, parse it
                        if (typeof payload === 'string') {
                            try {
                                payload = JSON.parse(payload);
                            } catch (e) {
                                throw new Error('Payload is a string but not valid JSON');
                            }
                        }

                        // one more unwrap after string parse (just in case)
                        if (payload && payload.output) payload = payload.output;

                        console.log('Normalized payload:', payload);
                        console.log('Payload keys:', payload ? Object.keys(payload) : null);

                        if (!payload || !payload.answers || !payload.answers.A || !payload.answers.B || !payload.answers.C) {
                            throw new Error('Invalid response format: missing answers A/B/C');
                        }

                        displayResults(payload);
                    })
                    .catch(function (err) {
                        console.error('Fetch error:', err.message);
                        alert('Error: ' + err.message);
                        showUI('input');
                    });
            }
        }

        function displayResults(data) {
            try {
                if (studentSummaryEl) studentSummaryEl.textContent = data.studentTextSummary || "Done.";

                var v = ['A', 'B', 'C'];
                for (var i = 0; i < v.length; i++) {
                    var key = v[i];
                    var ans = data.answers && data.answers[key];
                    var lEl = document.getElementById('label-' + key);
                    var tEl = document.getElementById('text-' + key);
                    var cEl = document.getElementById('variant-' + key);

                    if (ans && lEl && tEl) {
                        lEl.textContent = ans.label || key;
                        tEl.textContent = ans.text || "";
                    }
                    if (cEl) {
                        cEl.style.border = (data.evaluation && data.evaluation.winner === key) ? '2px solid #f59e0b' : '1px solid rgba(255,255,255,0.1)';
                    }
                }

                if (evalWinnerLabelEl && data.evaluation) {
                    evalWinnerLabelEl.textContent = data.evaluation.winnerLabel || data.evaluation.winner || "";
                }
                if (evalNotesEl && data.evaluation) {
                    evalNotesEl.textContent = data.evaluation.evaluatorNotes || "";
                }

                showUI('results');
            } catch (e) {
                alert('Display error: ' + e.message);
                showUI('input');
            }
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
