let placeholderText = 'اضغط توليد...';

document.getElementById('emailOutput').placeholder = placeholderText;
document.getElementById('passOutput').placeholder = placeholderText;
document.getElementById('userOutput').placeholder = placeholderText;

let selectedDomain = 'gmail.com';
let selectedStyle = 'cool';
let historyData = JSON.parse(localStorage.getItem('abuFaizHistory')) || [];
let stats = JSON.parse(localStorage.getItem('abuFaizStats')) || { generated: 0, copied: 0 };
let savedTempEmails = JSON.parse(localStorage.getItem('abuFaizTempEmails')) || [];
let savedMsgData = JSON.parse(localStorage.getItem('abuFaizMsgData')) || {};
let sessionStart = Date.now();
let currentToken = '';
let inboxInterval;
let currentModalToken = '';
let currentModalEmail = '';
const apiUrl = 'https://api.mail.gw';
let isGenerating = false;

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('totalGenerated').textContent = stats.generated;
  document.getElementById('totalCopied').textContent = stats.copied;
  renderHistory();
  renderSavedEmails();

  // استعادة الجلسة النشطة بعد تحديث الصفحة
  const activeSession = JSON.parse(localStorage.getItem('abuFaizActiveSession'));
  if (activeSession && activeSession.token && activeSession.email) {
    currentToken = activeSession.token;
    const field = document.getElementById('emailOutput');
    field.value = activeSession.email;
    field.classList.add('has-value');

    // تفعيل زر البريد المؤقت شكلياً
    document.querySelectorAll('.domain-btn').forEach(b => {
      if (b.getAttribute('onclick').includes('tempmail')) {
        selectDomain(b, 'tempmail');
      }
    });

    document.getElementById('inboxContainer').style.display = 'block';
    document.getElementById('inboxList').innerHTML = '<div class="empty-inbox">جاري استعادة الصندوق...</div>';
    
    checkRealInbox();
    if (inboxInterval) clearInterval(inboxInterval);
    inboxInterval = setInterval(checkRealInbox, 5000);
  }
});

setInterval(() => {
  const mins = Math.floor((Date.now() - sessionStart) / 60000);
  let minStr = mins + 'm';
  document.getElementById('sessionTime').textContent = minStr;
}, 10000);

function saveStats() {
  localStorage.setItem('abuFaizStats', JSON.stringify(stats));
}

function selectDomain(btn, domain) {
  document.querySelectorAll('.domain-btn').forEach(b => {
    b.classList.remove('active');
  });
  btn.classList.add('active');
  selectedDomain = domain;

  const genBtn = document.getElementById('genEmailBtn');
  if (genBtn) {
    if (domain === 'tempmail') {
      let liveText = 'توليد بريد حي';
      genBtn.innerHTML = '<span>⚡</span> ' + liveText;
      genBtn.style.background = 'linear-gradient(135deg, #00e676, #00b248)';
    } else {
      let normalText = 'توليد إيميل';
      genBtn.innerHTML = '<span>⚡</span> ' + normalText;
      genBtn.style.background = '';
    }
  }
}

function selectStyle(btn, style) {
  document.querySelectorAll('.style-chip').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  selectedStyle = style;
}

function toggleOption(el) {
  el.classList.toggle('checked');
  const box = el.querySelector('.toggle-box');
  let checkMark = el.classList.contains('checked') ? '✓' : '';
  box.textContent = checkMark;
}

function addRipple(btn, e) {
  const rect = btn.getBoundingClientRect();
  const ripple = document.createElement('span');
  ripple.className = 'ripple';
  const size = Math.max(rect.width, rect.height);
  let rippleStyle = 'width:' + size + 'px;height:' + size + 'px;left:' + (e.clientX-rect.left-size/2) + 'px;top:' + (e.clientY-rect.top-size/2) + 'px';
  ripple.style.cssText = rippleStyle;
  btn.appendChild(ripple);
  setTimeout(() => ripple.remove(), 700);
}

function showToast(msg, emoji = '✅') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = 'toast success';
  let toastHtml = '<span>' + emoji + '</span> ' + msg;
  toast.innerHTML = toastHtml;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('out');
    setTimeout(() => toast.remove(), 300);
  }, 2000);
}

function addHistory(value, typeKey) {
  historyData.unshift({ value: value, type: typeKey, time: new Date().toLocaleTimeString('en-US') });
  if (historyData.length > 50) historyData.pop();
  localStorage.setItem('abuFaizHistory', JSON.stringify(historyData));
  renderHistory();
  stats.generated++;
  document.getElementById('totalGenerated').textContent = stats.generated;
  saveStats();
}

function renderHistory() {
  const list = document.getElementById('historyList');
  if (historyData.length === 0) {
    let emptyMsg = 'لا يوجد سجل بعد...';
    list.innerHTML = '<div class="empty-history">' + emptyMsg + '</div>';
    return;
  }
  
  let htmlResult = '';
  historyData.forEach((item, i) => {
    let typeStr = '';
    if(item.type === 'email') {
      typeStr = 'إيميل';
    } else if(item.type === 'pass') {
      typeStr = 'سر';
    } else {
      typeStr = 'مستخدم';
    }
    
    let safeValue = item.value.replace(/'/g,"\\'");
    let animStyle = 'animation-delay:' + (i*0.03) + 's';
    
    htmlResult += '<div class="history-item" style="' + animStyle + '">';
    htmlResult += '<div class="history-value">' + item.value + '</div>';
    htmlResult += '<span class="history-badge badge-' + item.type + '">' + typeStr + '</span>';
    htmlResult += '<button class="history-copy" onclick="copyRaw(\'' + safeValue + '\')">📋</button>';
    htmlResult += '</div>';
  });
  list.innerHTML = htmlResult;
}

function askClearHistory() {
  document.getElementById('confirmModal').classList.add('active');
}

function confirmClearHistory() {
  historyData = [];
  localStorage.removeItem('abuFaizHistory');
  renderHistory();
  document.getElementById('confirmModal').classList.remove('active');
  let msgClear = 'تم مسح السجل بنجاح';
  showToast(msgClear, '🗑️');
}

async function copyRaw(text) {
  try {
    await navigator.clipboard.writeText(text);
    let msgCopied = 'تم النسخ!';
    showToast(msgCopied);
    stats.copied++;
    document.getElementById('totalCopied').textContent = stats.copied;
    saveStats();
  } catch (err) {}
}

async function copyField(fieldId, btnId) {
  const field = document.getElementById(fieldId);
  if (!field.value) { 
    let msgEmpty = 'لا يوجد شيء للنسخ';
    showToast(msgEmpty, '⚠️'); 
    return; 
  }
  await copyRaw(field.value);
  const btn = document.getElementById(btnId);
  btn.classList.add('copied');
  btn.querySelector('span').textContent = '✅';
  setTimeout(() => {
    btn.classList.remove('copied');
    btn.querySelector('span').textContent = '📋';
  }, 2000);
}

const rand = arr => arr[Math.floor(Math.random() * arr.length)];
const randInt = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;

function shuffle(str) {
  return str.split('').sort(() => 0.5 - Math.random()).join('');
}

function sanitizeHTML(html) {
  if (!html) return '';
  const parser = new DOMParser();
  const doc = parser.parseFromString(String(html), 'text/html');
  const badTags = ['script', 'object', 'embed', 'form', 'base', 'iframe']; 
  badTags.forEach(tag => {
    const elements = doc.querySelectorAll(tag);
    elements.forEach(el => el.remove());
  });
  const allElements = doc.querySelectorAll('*');
  allElements.forEach(el => {
    for (let i = el.attributes.length - 1; i >= 0; i--) {
      const attr = el.attributes[i];
      if (attr.name.toLowerCase().startsWith('on') || attr.value.toLowerCase().includes('javascript:')) {
        el.removeAttribute(attr.name);
      }
    }
  });
  return doc.body.innerHTML;
}

function buildMessageUI(msgFrom, dateStr, htmlContent) {
  let cleanHtml = sanitizeHTML(htmlContent);
  
  let iframeWrapper = `<!DOCTYPE html>
  <html dir="auto">
  <head>
    <meta charset="utf-8">
    <style>
      html { zoom: 0.55; overflow: hidden; } 
      @media screen and (min-width: 600px) { html { zoom: 1; } }
      body {
        margin: 0;
        padding: 10px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        background-color: #ffffff;
        color: #000000;
        word-wrap: break-word;
      }
      img { max-width: 100% !important; height: auto !important; }
      table, tr, td, div { max-width: 100% !important; box-sizing: border-box !important; }
      pre, code { white-space: pre-wrap !important; word-break: break-word !important; }
    </style>
  </head>
  <body>
    ${cleanHtml}
  </body>
  </html>`;

  let safeSrcDoc = iframeWrapper.replace(/'/g, "&apos;").replace(/"/g, "&quot;");

  let html = '<div style="width: 100%; height: auto; display: flex; flex-direction: column; text-align: right; direction: rtl; margin: 0; padding: 0; border-radius: 12px; overflow: hidden; border: 1px solid rgba(0,212,255,0.3);">';
  
  html += '<div style="background: #0f172a; color: #fff; padding: 15px; border-bottom: 2px solid #00d4ff; text-align: right; flex-shrink: 0; z-index: 10;">';
  html += '<div style="font-weight: bold; font-size: 16px; margin-bottom: 5px;">👤 المرسل: <br><span style="color:#00d4ff; user-select:all; font-size:14px; direction:ltr; display:inline-block; margin-top:5px;">' + msgFrom + '</span></div>';
  html += '<div style="font-size: 12px; color: #aaa; margin-top:8px;">📅 الوقت: ' + dateStr + '</div>';
  html += '</div>';

  html += '<div style="width: 100%; background: #fff;">';
  html += `<iframe sandbox="allow-same-origin" srcdoc="${safeSrcDoc}" style="width: 100%; min-height: 50px; border: none; display: block;" onload="setTimeout(() => { this.style.height = this.contentWindow.document.documentElement.scrollHeight + 20 + 'px'; }, 50);"></iframe>`;
  html += '</div></div>';

  return html;
}

window.addEventListener('popstate', function(event) {
    const hash = window.location.hash;
    
    if (hash === '#savedModal') {
        if (document.getElementById('readingSavedEmail')) {
            backToSavedInboxLogic(true);
        }
    } else if (hash === '') {
        if (document.getElementById('readingEmail')) {
            backToRealInboxLogic(true);
        }
        if (document.getElementById('savedEmailModal').classList.contains('active')) {
            closeSavedModal(true);
        }
    }
});

async function generateEmail(btn, e) {
  if (isGenerating) return;
  if (btn && e) addRipple(btn, e);

  const field = document.getElementById('emailOutput');
  const inboxContainer = document.getElementById('inboxContainer');
  const inboxList = document.getElementById('inboxList');

  const adjectives = ['dark', 'blue', 'fire', 'swift', 'cool', 'epic', 'star', 'nova', 'iron', 'wild', 'sky', 'zen', 'toxic', 'neon', 'shadow', 'crystal', 'quantum', 'cosmic', 'phantom', 'silent', 'golden'];
  const nouns = ['wolf', 'hawk', 'lion', 'dragon', 'ghost', 'shadow', 'blade', 'storm', 'void', 'pixel', 'cyber', 'nexus', 'tiger', 'bear', 'eagle', 'falcon', 'shark', 'viper', 'cobra', 'ninja'];

  if (selectedDomain === 'tempmail') {
    isGenerating = true;
    inboxContainer.style.display = 'block';
    
    let msgCreating = 'جاري إنشاء إيميل...';
    field.value = msgCreating;
    field.classList.remove('has-value');
    
    let msgWaiting = 'جاري تجهيز الصندوق...';
    inboxList.innerHTML = '<div class="empty-inbox">' + msgWaiting + '</div>';

    const username = adjectives[Math.floor(Math.random() * adjectives.length)] + '_' + nouns[Math.floor(Math.random() * nouns.length)] + Math.floor(Math.random() * 999);

    try {
      const domainRes = await fetch(apiUrl + '/domains');
      const domainData = await domainRes.json();
      const domain = domainData['hydra:member'][0].domain;

      const email = username + '@' + domain;
      const password = 'P@ss_' + Math.random().toString(36).substring(2, 10) + '!';

      await fetch(apiUrl + '/accounts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ address: email, password: password })
      });

      const tokenRes = await fetch(apiUrl + '/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ address: email, password: password })
      });
      
      const tokenData = await tokenRes.json();
      currentToken = tokenData.token;

      // حفظ الجلسة النشطة
      localStorage.setItem('abuFaizActiveSession', JSON.stringify({ email: email, token: currentToken }));

      field.value = email;
      field.classList.add('has-value');
      addHistory(email, 'email');

      savedTempEmails.unshift({ email: email, token: currentToken });
      localStorage.setItem('abuFaizTempEmails', JSON.stringify(savedTempEmails));
      renderSavedEmails();

      let msgReady = 'بانتظار الرسائل الجديدة...';
      inboxList.innerHTML = '<div class="empty-inbox">' + msgReady + '</div>';

      if (inboxInterval) clearInterval(inboxInterval);
      inboxInterval = setInterval(checkRealInbox, 5000);

      let msgSuccess = 'تم توليد إيميل مؤقت!';
      showToast(msgSuccess, '📧');

    } catch (error) {
      field.value = 'فشل الاتصال بالخادم';
      inboxList.innerHTML = '<div class="empty-inbox">تأكد من اتصالك بالإنترنت</div>';
    } finally {
      isGenerating = false;
    }

  } else {
    // مسح الجلسة النشطة إذا ولد إيميل عادي مشان يختفي الصندوق لو عمل تحديث
    localStorage.removeItem('abuFaizActiveSession');
    currentToken = '';
    
    inboxContainer.style.display = 'none';
    if (inboxInterval) clearInterval(inboxInterval);

    const patterns = [
      () => rand(adjectives) + rand(nouns) + randInt(10, 9999),
      () => rand(adjectives) + '_' + rand(nouns) + randInt(1, 999),
      () => rand(nouns) + '.' + rand(adjectives) + randInt(10, 9999),
      () => shuffle('abcdefghijklmnopqrstuvwxyz'.substring(0, randInt(5,9))) + randInt(100, 99999),
      () => rand(adjectives) + randInt(10000, 99999),
      () => rand(nouns) + rand(nouns) + randInt(1, 99)
    ];

    const username = rand(patterns)();
    
    let targetDomain = selectedDomain;
    if (targetDomain === 'random') {
      const rDoms = ['gmail.com', 'hotmail.com', 'yahoo.com', 'proton.me', 'outlook.com', 'icloud.com', 'mail.com'];
      targetDomain = rand(rDoms);
    }

    const email = username + '@' + targetDomain;
    field.value = email;
    field.classList.add('has-value');
    addHistory(email, 'email');
    
    showToast('تم توليد إيميل جديد!', '📧');
  }
}

async function checkRealInbox() {
    if (!currentToken) return;
    if (document.getElementById('readingEmail')) return;

    try {
        const res = await fetch(apiUrl + '/messages', {
            headers: { 'Authorization': 'Bearer ' + currentToken }
        });
        const data = await res.json();
        const messages = data['hydra:member'];

        const inboxList = document.getElementById('inboxList');

        if (messages.length === 0) return;

        let htmlContent = '';
        let noSubject = 'بدون موضوع';
        let fromLabel = 'من: ';

        messages.forEach(msg => {
            let msgSubj = msg.subject || noSubject;
            let msgFrom = msg.from.address;
            let dateStr = new Date(msg.createdAt).toLocaleTimeString();
            
            htmlContent += '<div class="email-message" onclick="readRealMessage(\'' + msg.id + '\')">';
            htmlContent += '<div class="email-subject">' + msgSubj + '</div>';
            htmlContent += '<div class="email-sender">' + fromLabel + msgFrom + ' - ' + dateStr + '</div></div>';
        });

        inboxList.innerHTML = htmlContent;

    } catch (error) {
        console.log(error);
    }
}

async function readRealMessage(msgId) {
    const inboxList = document.getElementById('inboxList');
    inboxList.innerHTML = '<div class="empty-inbox">جاري فتح الرسالة...</div>';

    try {
        const res = await fetch(apiUrl + '/messages/' + msgId, {
            headers: { 'Authorization': 'Bearer ' + currentToken }
        });
        const msgData = await res.json();
        
        let msgFrom = msgData.from ? msgData.from.address : 'غير معروف';
        let dateStr = new Date(msgData.createdAt).toLocaleTimeString();
        let rawContent = msgData.html ? msgData.html[0] : (msgData.text || 'الرسالة فارغة');
        
        inboxList.style.cssText = 'padding: 0 !important; margin: 0 !important; max-height: none !important; overflow: visible !important; border: none !important;';
        
        let uiHtml = buildMessageUI(msgFrom, dateStr, rawContent);
        
        window.history.pushState({ view: 'reading' }, '', '#reading');

        inboxList.innerHTML = '<div id="readingEmail" style="width:100%;">' + uiHtml + '</div>';
        
    } catch (error) {
        inboxList.innerHTML = '<div class="empty-inbox">خطأ بفتح الرسالة</div>';
        setTimeout(() => backToRealInboxLogic(false), 2000);
    }
}

function backToRealInboxLogic(fromHistory = false) {
    const inboxList = document.getElementById('inboxList');
    inboxList.style.cssText = ''; 
    
    if (!fromHistory) {
        window.history.back();
    }
    
    inboxList.innerHTML = '<div class="empty-inbox">جاري التحديث...</div>';
    checkRealInbox();
}

function generatePass(btn, e) {
  if (btn && e) addRipple(btn, e);

  const options = document.querySelectorAll('#passOptions .option-toggle');
  const upper = options[0].classList.contains('checked') ? 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' : '';
  const lower = options[1].classList.contains('checked') ? 'abcdefghijklmnopqrstuvwxyz' : '';
  const nums  = options[2].classList.contains('checked') ? '0123456789' : '';
  const syms  = options[3].classList.contains('checked') ? '!@#$%^&*()_+-=[]{}|;:,.<>?' : '';

  const all = upper + lower + nums + syms;
  if (!all) { 
    showToast('اختر نوع واحد على الأقل!', '⚠️'); 
    return; 
  }

  const length = parseInt(document.getElementById('passLength').value);
  let pass = '';

  if (upper) pass += rand(upper);
  if (lower) pass += rand(lower);
  if (nums)  pass += rand(nums);
  if (syms)  pass += rand(syms);

  while (pass.length < length) pass += rand(all);
  if (pass.length > length) pass = pass.substring(0, length);
  pass = shuffle(pass);

  const field = document.getElementById('passOutput');
  field.value = pass;
  field.classList.add('has-value');

  updateStrength(pass, upper, lower, nums, syms);
  addHistory(pass, 'pass');
  
  showToast('تم توليد كلمة سر قوية! 🔐');
}

function updateStrength(pass, upper, lower, nums, syms) {
  let score = 0;
  if (pass.length >= 12) score += 25;
  if (pass.length >= 20) score += 15;
  if (upper) score += 15;
  if (lower) score += 15;
  if (nums)  score += 15;
  if (syms)  score += 15;

  const fill = document.getElementById('strengthFill');
  const text = document.getElementById('strengthText');

  fill.style.width = score + '%';
  
  if (score < 40) {
    fill.style.background = '#ff3d71';
    text.style.color = '#ff3d71';
    text.textContent = 'ضعيفة ⚠️';
  } else if (score < 70) {
    fill.style.background = '#ffd700';
    text.style.color = '#ffd700';
    text.textContent = 'متوسطة ⚡';
  } else if (score < 90) {
    fill.style.background = '#00e676';
    text.style.color = '#00e676';
    text.textContent = 'قوية 💪';
  } else {
    fill.style.background = 'linear-gradient(90deg, #00d4ff, #00e676)';
    text.style.color = '#00d4ff';
    text.textContent = 'لا تكسر! 🔥';
  }
}

function generateUsername(btn, e) {
  if (btn && e) addRipple(btn, e);

  const styles = {
    cool: [
      () => ['dark','epic','ultra','hyper','neo','alpha','omega','meta','cyber','neon','quantum','cosmic','astral','void','flux'][randInt(0,14)] + ['Wolf','Hawk','Fox','Viper','Ghost','Blade','Storm','Nexus','Core','Void','Pulse','Spark','Flare','Sync','Grid'][randInt(0,14)],
      () => 'x_' + ['hunter','sniper','driv3r','coderr','hack3r','nod3r','kill3r','slay3r','play3r','gam3r','mast3r','lord','king','boss'][randInt(0,13)] + '_x',
      () => ['shadow','phantom','spectr','cipher','zenith','apex','vortex','matrix','system','logic','pixel','byte'][randInt(0,11)] + randInt(100,9999),
      () => ['TheReal','Just','Only','True','Pure','Absolute','Infinite'][randInt(0,6)] + ['Legend','Myth','Icon','Hero','Champ','Star'][randInt(0,5)] + randInt(1,99)
    ],
    gamer: [
      () => ['xX','XX','gg','Ez','Pro','God'][randInt(0,5)] + ['Noob','Killer','Sniper','Boss','Slayer','Hunter','Beast','Titan','Ninja','Samurai','Demon','Dragon'][randInt(0,11)] + ['Xx','XX','_YT','_TV','TTV'][randInt(0,4)],
      () => ['ProPlayer','MLGpro','TopFrag','AceKill','OneShot','HeadShot','Clutch','Carry','Rush','Camp','Loot'][randInt(0,10)] + randInt(100,9999),
      () => ['N3on','Ph4ntom','Vip3r','Gh0st','Fr0st','Bl4ze','Ven0m','T0xic','H4v0c','R3c0n'][randInt(0,9)] + '_' + ['GG','YT','TV','PRO','GOD','MVP'][randInt(0,5)],
      () => ['FaZe_','OpTic_','TSM_','C9_','G2_','Navi_'][randInt(0,5)] + ['Aim','Flick','Spray','Peek','Push'][randInt(0,4)] + randInt(1,99)
    ],
    pro: [
      () => ['Alex','Ryan','Sam','Kyle','Drew','Max','John','Mike','Chris','David','James','Tom'][randInt(0,11)] + ['Dev','Tech','Pro','Hub','Lab','Studio','Code','Web','App','Net'][randInt(0,9)] + randInt(10,999),
      () => ['the','mr_','sir_','dr_','real_'][randInt(0,4)] + ['dev','coder','builder','maker','creator','founder','admin','root','sys','hacker'][randInt(0,9)],
      () => ['dev','tech','code','build','stack','data','cloud'][randInt(0,6)] + ['_' + ['io','hub','xyz','app','co','net','org'][randInt(0,6)]],
      () => ['Code','Byte','Bit','Data','Logic','Loop','Node','Script'][randInt(0,7)] + ['Master','Ninja','Guru','Wizard','Jedi','Geek'][randInt(0,5)] + randInt(1,99)
    ],
    arabic: [
      () => ['abu','om','bnt','ibn','akh','okht'][randInt(0,5)] + '_' + ['faiz','nour','ali','sara','reem','lara','ahmad','omar','tariq','rami','sami','fadi'][randInt(0,11)] + randInt(0,999),
      () => ['alqamar','alnoor','alsayf','alward','albadr','alahly','alshams','alnajm','alfajer','allayl','alassad','alnimr'][randInt(0,11)] + randInt(10,9999),
      () => ['malik','amir','batal','qaid','nokhba','zaeem','sheikh','pasha','bek','muallem','ostaz','wahsh'][randInt(0,11)] + '_' + randInt(100,9999),
      () => ['Syrian','Sham','Halabi','Homsi','Dimashqi','Arab'][randInt(0,5)] + ['King','Prince','Boss','Pro','Gamer'][randInt(0,4)] + randInt(1,99)
    ],
    random: null,
  };

  let username;
  if (selectedStyle === 'random') {
    const allStyles = Object.values(styles).filter(s => s);
    const picked = rand(allStyles);
    username = rand(picked)();
  } else {
    username = rand(styles[selectedStyle])();
  }

  const field = document.getElementById('userOutput');
  field.value = username;
  field.classList.add('has-value');
  addHistory(username, 'user');
  
  showToast('تم توليد اسم مستخدم! ✨');
}

function renderSavedEmails() {
  const list = document.getElementById('savedEmailsList');
  if (savedTempEmails.length === 0) {
    list.innerHTML = '<div class="empty-history">لا يوجد إيميلات محفوظة بعد...</div>';
    return;
  }
  
  let htmlResult = '';
  savedTempEmails.forEach((item, i) => {
    let safeEmail = item.email.replace(/'/g,"\\'");
    let safeToken = item.token.replace(/'/g,"\\'");
    
    htmlResult += '<div class="saved-email-item" style="cursor:default;">';
    htmlResult += '<div class="saved-email-text" style="cursor:pointer;" onclick="openSavedEmail(\'' + safeEmail + '\', \'' + safeToken + '\')">' + item.email + '</div>';
    htmlResult += '<button class="saved-email-copy" onclick="copyRaw(\'' + safeEmail + '\')">📋 نسخ</button>';
    htmlResult += '</div>';
  });
  list.innerHTML = htmlResult;
}

function openSavedEmail(email, token) {
  document.getElementById('savedEmailTitle').textContent = email;
  document.getElementById('savedEmailModal').classList.add('active');
  
  const modalBox = document.querySelector('#savedEmailModal .modal-box');
  if (modalBox) {
      modalBox.style.width = '95%';
      modalBox.style.maxWidth = '600px';
      modalBox.style.height = 'auto';  
      modalBox.style.maxHeight = '85vh';
      modalBox.style.margin = 'auto'; 
      modalBox.style.padding = '20px';
      modalBox.style.borderRadius = '15px';
      modalBox.style.background = '';
      modalBox.style.border = '';
  }
  
  currentModalToken = token;
  currentModalEmail = email;
  
  window.history.pushState({ view: 'modal' }, '', '#savedModal');
  
  document.getElementById('savedInboxList').innerHTML = '<div class="empty-inbox">جاري جلب الرسائل...</div>';
  fetchSavedMessages();
}

function closeSavedModal(fromHistory = false) {
  document.getElementById('savedEmailModal').classList.remove('active');
  currentModalToken = '';
  currentModalEmail = '';
  if (!fromHistory && window.location.hash === '#savedModal') {
      window.history.back();
  }
}

async function fetchSavedMessages() {
  if (!currentModalToken) return;
  if (document.getElementById('readingSavedEmail')) return;

  const inboxList = document.getElementById('savedInboxList');
  let localMsgs = savedMsgData[currentModalEmail] || {};

  try {
      const res = await fetch(apiUrl + '/messages', {
          headers: { 'Authorization': 'Bearer ' + currentModalToken }
      });
      const data = await res.json();
      const apiMessages = data['hydra:member'] || [];

      let combined = [];
      let seenIds = new Set();

      apiMessages.forEach(msg => {
          combined.push(msg);
          seenIds.add(msg.id);
      });

      Object.values(localMsgs).forEach(localMsg => {
          if (!seenIds.has(localMsg.id)) {
              combined.push(localMsg);
              seenIds.add(localMsg.id);
          }
      });

      combined.sort((a, b) => new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date));

      if (combined.length === 0) {
          inboxList.innerHTML = '<div class="empty-inbox">لا يوجد رسائل في هذا الصندوق.</div>';
          return;
      }

      let htmlContent = '';
      combined.forEach(msg => {
          let msgSubj = msg.subject || 'بدون موضوع';
          let msgFrom = msg.from ? msg.from.address : (msg.fromAddress || 'غير معروف');
          let dateVal = msg.createdAt || msg.date;
          let dateStr = new Date(dateVal).toLocaleTimeString();
          
          let badgeHtml = seenIds.has(msg.id) && !apiMessages.find(m=>m.id === msg.id) ? '<span style="color:#00e676;font-size:10px;">[محفوظة] </span> ' : '';

          htmlContent += '<div class="email-message" onclick="readSavedMessage(\'' + msg.id + '\')">';
          htmlContent += '<div class="email-subject">' + badgeHtml + msgSubj + '</div>';
          htmlContent += '<div class="email-sender">من: ' + msgFrom + ' - ' + dateStr + '</div></div>';
      });

      inboxList.innerHTML = htmlContent;

  } catch (error) {
      let combined = Object.values(localMsgs);
      combined.sort((a, b) => new Date(b.date) - new Date(a.date));

      if (combined.length === 0) {
          inboxList.innerHTML = '<div class="empty-inbox">الحساب محذوف من الخادم ولا يوجد رسائل محفوظة محلياً.</div>';
          return;
      }

      let htmlContent = '<div style="color:#00e676;font-size:12px;margin-bottom:10px;text-align:center;">نعرض الرسائل المحفوظة بذاكرة المتصفح فقط</div>';
      combined.forEach(msg => {
          let msgSubj = msg.subject || 'بدون موضوع';
          let msgFrom = msg.fromAddress || 'غير معروف';
          let dateStr = new Date(msg.date).toLocaleTimeString();

          htmlContent += '<div class="email-message" onclick="readSavedMessage(\'' + msg.id + '\')">';
          htmlContent += '<div class="email-subject">' + msgSubj + '</div>';
          htmlContent += '<div class="email-sender">من: ' + msgFrom + ' - ' + dateStr + '</div></div>';
      });
      inboxList.innerHTML = htmlContent;
  }
}

async function readSavedMessage(msgId) {
    const inboxList = document.getElementById('savedInboxList');
    const modalBox = document.querySelector('#savedEmailModal .modal-box');
    const modalWrap = document.getElementById('savedEmailModal');
    
    inboxList.innerHTML = '<div class="empty-inbox">جاري فتح الرسالة...</div>';

    let localMsgs = savedMsgData[currentModalEmail] || {};
    let localMsg = localMsgs[msgId];
    let bodyContent = '';
    let msgFrom = 'غير معروف';
    let dateStr = '';

    try {
        const res = await fetch(apiUrl + '/messages/' + msgId, {
            headers: { 'Authorization': 'Bearer ' + currentModalToken }
        });
        if (!res.ok) throw new Error('Not found');
        const msgData = await res.json();
        
        msgFrom = msgData.from ? msgData.from.address : 'غير معروف';
        dateStr = new Date(msgData.createdAt).toLocaleTimeString();
        bodyContent = msgData.html ? msgData.html[0] : (msgData.text || 'الرسالة فارغة');
        
        if (!savedMsgData[currentModalEmail]) savedMsgData[currentModalEmail] = {};
        savedMsgData[currentModalEmail][msgId] = {
            id: msgData.id,
            subject: msgData.subject,
            fromAddress: msgData.from.address,
            date: msgData.createdAt,
            bodyContent: bodyContent
        };
        localStorage.setItem('abuFaizMsgData', JSON.stringify(savedMsgData));
    } catch (error) {
        if (localMsg && localMsg.bodyContent) {
            bodyContent = localMsg.bodyContent;
            msgFrom = localMsg.fromAddress || 'غير معروف';
            dateStr = new Date(localMsg.date).toLocaleTimeString();
        } else {
            inboxList.innerHTML = '<div class="empty-inbox">الرسالة محذوفة وغير محفوظة!</div>';
            setTimeout(() => backToSavedInboxLogic(false), 2500);
            return;
        }
    }

    if (modalBox) {
        modalBox.style.cssText = 'width: 95% !important; max-width: 800px !important; height: auto !important; max-height: none !important; margin: 20px auto !important; padding: 0 !important; border-radius: 12px !important; border: none !important; background: transparent !important; box-shadow: none !important;';
    }
    if (modalWrap) {
        modalWrap.style.setProperty('padding', '0', 'important');
    }

    inboxList.style.cssText = 'padding: 0 !important; margin: 0 !important; max-height: none !important; overflow: visible !important; border: none !important;';

    let uiHtml = buildMessageUI(msgFrom, dateStr, bodyContent);
    
    window.history.pushState({ view: 'savedMsg' }, '', '#savedMsg');

    inboxList.innerHTML = '<div id="readingSavedEmail" style="width:100%;">' + uiHtml + '</div>';
}

function backToSavedInboxLogic(fromHistory = false) {
    const inboxList = document.getElementById('savedInboxList');
    const modalBox = document.querySelector('#savedEmailModal .modal-box');
    const modalWrap = document.getElementById('savedEmailModal');
    
    if (modalBox) {
        modalBox.style.cssText = 'width: 95%; max-width: 600px; height: auto; max-height: 85vh; margin: auto; border-radius: 15px; padding: 20px; display: flex; flex-direction: column; background: var(--surface); border: 1px solid var(--accent2);';
    }
    if (modalWrap) {
        modalWrap.style.setProperty('padding', '');
    }

    inboxList.style.cssText = ''; 
    
    if (!fromHistory) {
        window.history.back();
    }
    
    inboxList.innerHTML = '<div class="empty-inbox">جاري التحديث...</div>';
    fetchSavedMessages();
}