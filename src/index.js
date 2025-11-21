//checkout homepage https://github.com/Trim21/gm-fetch for @trim21/gm-fetch
import GM_fetch from "@trim21/gm-fetch";

// Config
const config = {
  apiKey: localStorage.getItem('ixl_api_key') || '',
  model: 'openai/gpt-oss-20b',
  autoSubmit: false,
  lastHTML: ''
};

// UI
const panel = document.createElement('div');
panel.id = 'ixl-panel';
panel.innerHTML = `
    <div class="header">
        <b>IXL Solver</b>
        <button id="close">×</button>
    </div>
    <div class="body">
        <label><input type="checkbox" id="autosubmit"> Auto Submit</label>
        <button id="start">Solve</button>
        <button id="rollback">Rollback</button>

        <div id="answer-box" style="display:none; margin-top:10px; padding:8px; border:1px solid #ccc; background:#f9f9f9;">
            <b>Answer:</b> <span id="answer"></span>
            <div id="steps" style="margin-top:8px; font-size:13px; color:#555;"></div>
        </div>
        <div id="status" style="margin-top:8px; font-weight:bold;">Idle</div>
    </div>
`;
document.body.appendChild(panel);

// Styles
const style = document.createElement('style');
style.textContent = `
    #ixl-panel {
        position: fixed; top: 20px; right: 20px; width: 380px; background: white;
        border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.2); z-index: 999999;
        font-family: system-ui, sans-serif; font-size: 14px;
    }
    .header { background: #4caf50; color: white; padding: 8px; border-radius: 8px 8px 0 0; display: flex; align-items: center; justify-content: space-between; }
    .body { padding: 12px; }
    button, select { margin: 4px 0; padding: 6px 10px; border: none; border-radius: 4px; font-size: 13px; }
    button { background: #2196F3; color: white; cursor: pointer; }
    button:hover { background: #1976D2; }
    #close { background: none; font-size: 18px; padding: 0 8px; }
    #answer { color: #d32f2f; font-weight: bold; }
`;
document.head.appendChild(style);

// Elements
const UI = {
  panel, close: $('close'), start: $('start'), rollback: $('rollback'),
  autosubmit: $('autosubmit'), answerBox: $('answer-box'), answer: $('answer'), steps: $('steps'),
  status: $('status')
};

function $(id) { return document.getElementById(id); }

// Save API key prompt
if (!config.apiKey) {
  config.apiKey = prompt("Enter your Groq/OpenAI API key:") || '';
  localStorage.setItem('ixl_api_key', config.apiKey);
}

// Events
UI.close.onclick = () => panel.style.display = 'none';
UI.start.onclick = solve;
UI.rollback.onclick = () => {
  const q = getQuestionDiv();
  if (q && config.lastHTML) q.innerHTML = config.lastHTML;
};
UI.autosubmit.onchange = () => config.autoSubmit = UI.autosubmit.checked;

// Get question container
function getQuestionDiv() {
  return document.querySelector('.question-and-submission-view') ||
    document.evaluate('//section[contains(@class,"question")]', document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
}

// Capture LaTeX or Canvas
function captureContent(div) {
  let latex = Array.from(div.querySelectorAll('script[type="math/tex"], img[data-latex]'))
    .map(el => el.dataset?.latex || el.textContent).join('\n');
  if (latex) return { type: 'latex', data: latex };

  const canvas = div.querySelector('canvas');
  if (canvas) {
    const img = canvas.toDataURL('image/png');
    return { type: 'image', data: img };
  }
  return { type: 'html', data: div.outerHTML };
}

// Solve with Groq/OpenAI
async function solve() {
  const div = getQuestionDiv();
  if (!div) return UI.status.textContent = "No question found";

  config.lastHTML = div.innerHTML;
  const content = captureContent(div);

  let prompt = content.type === 'html' ? `HTML:\n${content.data}`
    : content.type === 'latex' ? `LaTeX:\n${content.data}`
      : `Image attached (base64 PNG)`;

  UI.status.textContent = "Solving...";
  UI.answerBox.style.display = 'none';

  const payload = {
    model: config.model,
    messages: [
      {
        role: "system", content: `You are an IXL math solver.
- Solve the problem.
- Wrap final answer in <answer>...</answer>
- Use $...$ for math in steps.
- If auto-fill needed, include JS in \`\`\`javascript\n...\`\`\`` },
      { role: "user", content: prompt }
    ],
    temperature: 0.7,
    max_completion_tokens: 4096
  };

  if (content.type === 'image') {
    payload.messages[1] = { type: 'image_url', image_url: content.data };
  }

  try {
    const res = await GM_fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });


    const data = res.json()
    const { choices, error } = JSON.parse(data);
    if (error != null) {
      UI.status.textContent = "Error: " + error.message;
      return;
    }

    const text = choices[0].message.content;

    const answer = (text.match(/<answer>([\s\S]*?)<\/answer>/i)?.[1] || "No answer").trim();

    UI.answer.textContent = answer;
    UI.steps.innerHTML = marked.parse(text.replace(/<answer>[\s\S]*?<\/answer>/gi, '').trim());
    UI.answerBox.style.display = 'block';

    if (window.MathJax) MathJax.typesetPromise([UI.steps, UI.answer]);

    // Auto-fill
    const input = div.querySelector('input.fillIn');
    if (input) {
      const clean = answer.replace(/\$|`|\\\(|\)/g, '').trim();
      input.value = clean;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }

    const jsMatch = text.match(/```javascript\s*([\s\S]*?)```/);
    if (jsMatch) {
      const script = document.createElement('script');
      script.textContent = jsMatch[1];
      document.body.appendChild(script);
      script.remove();
    }

    if (config.autoSubmit) {
      setTimeout(() => {
        const btn = document.querySelector('button.crisp-button')?.textContent?.trim() === 'Submit' ? document.querySelector('button.crisp-button') : (() => {
          const xpath = '//button[@class="crisp-button" and normalize-space(text())="Submit"]';
          return document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
        })();
        btn?.click();
      }, 500);
    }

    UI.status.textContent = "Done";
  } catch (e) {
    UI.status.textContent = "Error: " + e.message;
  }
}

UI.autosubmit.checked = config.autoSubmit;

