// Lightweight online talking AI (no server needed)
// - persona: professional / friend / coder
// - voice input (if supported) + text-to-speech replies
// - stores conversations in localStorage (persists in browser)

const $ = id => document.getElementById(id);
const messagesEl = $('messages'), userInput = $('userInput'), sendBtn = $('sendBtn');
const micBtn = $('micBtn'), ttsBtn = $('ttsBtn'), clearBtn = $('clearBtn');
const personaSel = $('persona'), newBtn = $('newBtn'), exportBtn = $('exportBtn');
const convoList = $('convoList'), titleInput = $('titleInput');

let conversations = JSON.parse(localStorage.getItem('lg_online_convos')||'[]');
let currentId = null;
let ttsEnabled = true;
let recognition = null;
const synth = window.speechSynthesis;

function uid(n=8){ return Math.random().toString(36).slice(2,2+n); }
function now(){ return new Date().toISOString(); }
function save(){ localStorage.setItem('lg_online_convos', JSON.stringify(conversations)); }

function renderConvoList(){
  convoList.innerHTML = '';
  conversations.forEach(c=>{
    const el=document.createElement('div'); el.className='convo-item';
    el.innerHTML = `<div style="display:flex;justify-content:space-between"><div><strong>${escapeHtml(c.title||'Chat')}</strong><div class="meta" style="font-size:12px;color:#96a0aa">${new Date(c.created).toLocaleString()}</div></div>
      <div style="display:flex;gap:6px"><button class="btn open" data-id="${c.id}">Open</button><button class="btn quiet del" data-id="${c.id}">Del</button></div></div>`;
    convoList.appendChild(el);
  });
  convoList.querySelectorAll('.open').forEach(b=>b.onclick=e=> loadConvo(e.target.dataset.id));
  convoList.querySelectorAll('.del').forEach(b=>b.onclick=e=>{ if(confirm('Delete?')){ conversations = conversations.filter(x=>x.id!==e.target.dataset.id); save(); renderConvoList(); if(conversations[0]) loadConvo(conversations[0].id); }});
}

function escapeHtml(s){ return (s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

function newConvo(){
  const id=uid(10);
  const c = { id, title:'Chat', created: now(), persona: personaSel.value, messages: [] };
  conversations.unshift(c); save(); renderConvoList(); loadConvo(id);
}

function loadConvo(id){
  const c = conversations.find(x=>x.id===id);
  if(!c) return;
  currentId=id;
  titleInput.value = c.title||'';
  personaSel.value = c.persona || 'professional';
  renderMessages(c.messages);
}

function renderMessages(msgs){
  messagesEl.innerHTML='';
  msgs.forEach(m=> appendMessage(m));
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function appendMessage(m){
  const d=document.createElement('div'); d.className='msg '+(m.who==='user'?'user':'bot');
  d.innerHTML = `<div>${escapeHtml(m.text)}</div>`;
  messagesEl.appendChild(d);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function pushMessage(who, text){
  if(!currentId) newConvo();
  const convo = conversations.find(x=>x.id===currentId);
  const m = { who, text, ts: now() };
  convo.messages.push(m);
  save();
  appendMessage(m);
  return m;
}

// Simple local "AI" logic (improved heuristics)
function localAI(persona, input){
  const t = input.toLowerCase();
  if(persona==='professional'){
    if(t.includes('help')||t.includes('how')) return 'Start with a short objective, list 3 steps, and set a deadline. Want me to draft it?';
    if(t.includes('plan')) return 'I recommend: 1) Snapshot 2) Prioritize 3) Execute — I can create a checklist.';
    return 'I can give concise plans, templates, and edits. Ask me for a 3-step plan.';
  }
  if(persona==='friend'){
    if(t.includes('sad')||t.includes('down')) return 'I\'m sorry you feel that way — want to talk about it? I\'m here.';
    if(t.includes('joke')) return 'Why did the coder quit? Because he didn’t get arrays 😉';
    return 'I\'m here to chat — tell me what\'s on your mind.';
  }
  if(persona==='coder'){
    if(t.includes('bug')||t.includes('error')) return 'Paste the short error or function and I will suggest a fix.';
    if(t.includes('react')||t.includes('component')) return 'I can scaffold a React component for you — tell me props and behavior.';
    return 'I can generate code snippets, explain errors, or help structure projects.';
  }
  return 'Tell me more so I can help.';
}

// TTS speak
function speak(text){
  if(!ttsEnabled || !synth) return;
  if(synth.speaking) synth.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'en-US';
  synth.speak(u);
}

// Voice input setup
if('webkitSpeechRecognition' in window || 'SpeechRecognition' in window){
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SR();
  recognition.lang = 'en-US';
  recognition.interimResults = false;
  recognition.onresult = e => {
    const txt = e.results[0][0].transcript;
    userInput.value += (userInput.value ? ' ' : '') + txt;
  };
  recognition.onerror = e => console.warn('Speech error', e);
} else {
  micBtn.style.opacity = 0.5;
  micBtn.title = 'Voice input not supported';
}

// Send flow
async function send(){
  const text = userInput.value.trim();
  if(!text) return;
  pushMessage('user', text);
  userInput.value = '';
  // create bot placeholder
  pushMessage('bot', '...');
  // simulate thinking
  await new Promise(r=>setTimeout(r, 600 + Math.random()*600));
  const persona = personaSel.value;
  const reply = localAI(persona, text);
  // replace last bot '...' message with reply
  const convo = conversations.find(x=>x.id===currentId);
  convo.messages[convo.messages.length-1].text = reply;
  save();
  renderMessages(convo.messages);
  if(ttsEnabled) speak(reply);
}

sendBtn.onclick = send;
userInput.addEventListener('keydown', e=> { if(e.key==='Enter' && !e.shiftKey){ e.preventDefault(); send(); }});
micBtn.onclick = ()=> { if(!recognition) return alert('Voice not supported'); recognition.start(); };
ttsBtn.onclick = ()=> { ttsEnabled = !ttsEnabled; ttsBtn.textContent = ttsEnabled ? '🔊' : '🔈'; };
newBtn.onclick = ()=> newConvo();
clearBtn.onclick = ()=>{
  const convo = conversations.find(x=>x.id===currentId);
  if(convo){ convo.messages=[]; save(); renderMessages(convo.messages); }
};
exportBtn.onclick = ()=> {
  const data = JSON.stringify(conversations, null, 2);
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([data], {type:'application/json'})); a.download='conversations.json'; a.click();
};

titleInput.addEventListener('change', ()=>{
  const convo = conversations.find(x=>x.id===currentId);
  if(convo){ convo.title = titleInput.value || 'Chat'; save(); renderConvoList(); }
});

// init
if(conversations.length) loadConvo(conversations[0].id);
else newConvo();
renderConvoList();
