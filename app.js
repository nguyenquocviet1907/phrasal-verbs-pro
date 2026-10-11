/* Phrasal Verbs Pro — app logic */
'use strict';
const TOPICS = {daily:'🏠 Đời sống', work:'💼 Công việc', social:'💬 Giao tiếp', travel:'✈️ Du lịch', study:'📚 Học tập'};
const SRS_KEY='pvp_srs_v1', META_KEY='pvp_meta_v1';
const INTERVALS=[10*60e3, 24*3600e3, 3*24*3600e3, 7*24*3600e3, 14*24*3600e3, 30*24*3600e3]; // ms per level

const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const imgOf=i=>`img/pv${String(i+1).padStart(3,'0')}.jpg`;
const shuffle=a=>{a=[...a];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

/* ---------- SRS store ---------- */
let srs={}; try{srs=JSON.parse(localStorage.getItem(SRS_KEY)||'{}');}catch(e){srs={};}
const saveSrs=()=>localStorage.setItem(SRS_KEY,JSON.stringify(srs));
const stateOf=i=>srs[i]||{level:0,next:0};
const markKnown=i=>{const s=stateOf(i);const nl=Math.min(s.level+1,5);srs[i]={level:nl,next:Date.now()+INTERVALS[Math.min(nl,INTERVALS.length-1)]};saveSrs();};
const markUnknown=i=>{srs[i]={level:0,next:Date.now()+10*60e3};saveSrs();};
const dueList=()=>{const n=Date.now();return PHRASAL_VERBS.map((_,i)=>i).filter(i=>{const s=srs[i];return !s||s.next<=n;});};
const learnedCount=()=>Object.values(srs).filter(s=>s.level>=2).length;

/* ---------- meta (theme, streak) ---------- */
let meta={theme:'light',streak:0,lastVisit:''}; try{Object.assign(meta,JSON.parse(localStorage.getItem(META_KEY)||'{}'));}catch(e){}
const saveMeta=()=>localStorage.setItem(META_KEY,JSON.stringify(meta));
function trackVisit(){
  const today=new Date().toISOString().slice(0,10);
  if(meta.lastVisit!==today){
    const y=new Date(Date.now()-864e5).toISOString().slice(0,10);
    meta.streak=(meta.lastVisit===y)?(meta.streak||0)+1:1;
    meta.lastVisit=today; saveMeta();
  }
}
function applyTheme(){document.documentElement.dataset.theme=meta.theme;$('#themeBtn').textContent=meta.theme==='dark'?'☀️':'🌙';}

/* ---------- audio: pre-recorded US male voice (MP3), Web Speech API fallback ---------- */
const VERB_AUDIO_IDX={}, EX_AUDIO_IDX={};
PHRASAL_VERBS.forEach((w,i)=>{VERB_AUDIO_IDX[w.v.toLowerCase()]=i+1; EX_AUDIO_IDX[w.e.toLowerCase()]=i+1;});
let curAudioEl=null;
function stopAudio(){ try{ if(curAudioEl){curAudioEl.pause(); curAudioEl=null;} speechSynthesis.cancel(); }catch(e){} }
function speakFallback(text){
  try{
    speechSynthesis.cancel();
    const u=new SpeechSynthesisUtterance(text);
    u.lang='en-US'; u.rate=0.92; u.pitch=1;
    const vs=speechSynthesis.getVoices().filter(v=>v.lang&&v.lang.toLowerCase().startsWith('en'));
    const pick=vs.find(v=>/google us english/i.test(v.name))||vs.find(v=>/david|guy|mark|daniel|alex/i.test(v.name))||vs.find(v=>/en[-_]us/i.test(v.lang))||vs[0];
    if(pick)u.voice=pick;
    speechSynthesis.speak(u);
  }catch(e){alert('Trình duyệt không hỗ trợ phát âm thanh.');}
}
function speak(text){
  const t=String(text).toLowerCase();
  let path=null;
  if(VERB_AUDIO_IDX[t]) path='audio/pv'+String(VERB_AUDIO_IDX[t]).padStart(3,'0')+'.mp3';
  else if(EX_AUDIO_IDX[t]) path='audio/ex'+String(EX_AUDIO_IDX[t]).padStart(3,'0')+'.mp3';
  if(!path){ speakFallback(text); return; }
  try{
    stopAudio();
    const a=new Audio(path);
    curAudioEl=a;
    a.onerror=()=>speakFallback(text);
    const p=a.play();
    if(p&&p.catch)p.catch(()=>speakFallback(text));
  }catch(e){ speakFallback(text); }
}
function speakVerb(i){ speak(PHRASAL_VERBS[i].v); }
function speakEx(i){ speak(PHRASAL_VERBS[i].e); }
if('speechSynthesis' in window) speechSynthesis.getVoices();

/* ---------- navigation ---------- */
const VIEWS=['home','dict','flash','quiz','fill','match','listen','review','stats'];
function navTo(v){
  $$('.nav-btn').forEach(b=>b.classList.toggle('active',b.dataset.nav===v));
  $$('.view').forEach(s=>s.classList.toggle('active',s.id==='view-'+v));
  $('#mainNav').classList.remove('open');
  window.scrollTo({top:0,behavior:'smooth'});
  ({home:renderHome,dict:renderDict,flash:startFlash,quiz:renderQuizSetup,fill:renderFillSetup,
    match:renderMatchSetup,listen:renderListenSetup,review:startReview,stats:renderStats}[v]||(()=>{}))();
  updateReviewBadge();
}
document.addEventListener('click',e=>{
  const b=e.target.closest('[data-nav]');
  if(b)navTo(b.dataset.nav);
});
$('#menuBtn').onclick=()=>$('#mainNav').classList.toggle('open');
$('#themeBtn').onclick=()=>{meta.theme=meta.theme==='dark'?'light':'dark';saveMeta();applyTheme();};
function updateReviewBadge(){
  const n=dueList().length,b=$('#reviewBadge');
  b.hidden=n===0;b.textContent=n>99?'99+':n;
}

/* ---------- modal: chi tiết cụm từ ---------- */
function openWord(i){
  const w=PHRASAL_VERBS[i],s=stateOf(i);
  const lvl=['Chưa học','Mới học','Quen dần','Khá thuộc','Thuộc','Nhuần nhuyễn'][s.level]||'Chưa học';
  $('#modalBox').innerHTML=`
    <button class="modal-close" onclick="closeModal()">✕</button>
    <img src="${imgOf(i)}" alt="${esc(w.v)}" onerror="this.style.display='none'">
    <div class="modal-body">
      <div class="modal-verb">${esc(w.v)}
        <button class="speak-btn" onclick="speak('${esc(w.v)}')" title="Nghe phát âm">🔊</button>
      </div>
      <div class="modal-mean">${esc(w.m)}</div>
      <div class="modal-usage">📌 <b>Cách dùng:</b> ${esc(w.u)}</div>
      <div class="modal-ex">
        <div class="en">"${esc(w.e)}" <button class="speak-btn" onclick="speakEx(${i})" title="Nghe câu ví dụ">🔊</button></div>
        <div class="vi">${esc(w.ev)}</div>
      </div>
      <div class="sub">🏷️ ${TOPICS[w.t]} · 📶 Mức độ: <b>${lvl}</b></div>
      <div class="modal-actions">
        <button class="btn btn-primary btn-sm" onclick="markKnown(${i});openWord(${i});updateReviewBadge()">✅ Tôi đã thuộc</button>
        <button class="btn btn-ghost btn-sm" onclick="markUnknown(${i});openWord(${i});updateReviewBadge()">🔁 Học lại sau</button>
        <button class="btn btn-ghost btn-sm" onclick="closeModal()">Đóng</button>
      </div>
    </div>`;
  $('#modalOverlay').hidden=false;
}
function closeModal(){$('#modalOverlay').hidden=true;}
$('#modalOverlay').addEventListener('click',e=>{if(e.target.id==='modalOverlay')closeModal();});
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal();});

/* ---------- HOME ---------- */
function wordOfDay(){
  const now=new Date(),start=new Date(now.getFullYear(),0,0);
  const day=Math.floor((now-start)/864e5);
  return day%PHRASAL_VERBS.length;
}
function renderHome(){
  const wotd=wordOfDay(),w=PHRASAL_VERBS[wotd],due=dueList().length;
  $('#view-home').innerHTML=`
    <div class="hero">
      <h1>Học 200 Phrasal Verbs thông dụng nhất 🚀</h1>
      <p>Mỗi cụm từ có <b>nghĩa tiếng Việt</b>, <b>cách dùng</b>, <b>ví dụ minh họa</b>, <b>hình ảnh</b> và <b>âm thanh phát âm</b> — cộng 7 hình thức luyện tập: flashcard, trắc nghiệm, điền từ, ghép cặp, luyện nghe, ôn tập nhắc lại ngắt quãng và thống kê tiến độ.</p>
      <div class="hero-stats">
        <div class="hstat"><b>200</b><span>cụm từ</span></div>
        <div class="hstat"><b>${learnedCount()}</b><span>đã thuộc</span></div>
        <div class="hstat"><b>${due}</b><span>cần ôn tập</span></div>
        <div class="hstat"><b>${meta.streak}🔥</b><span>ngày liên tiếp</span></div>
      </div>
      <div class="hero-cta">
        <button class="btn btn-white" data-nav="flash">🃏 Học ngay</button>
        <button class="btn btn-white" data-nav="dict">📖 Mở từ điển</button>
      </div>
    </div>

    <div class="section">
      <h2>🌟 Từ của hôm nay</h2>
      <div class="wotd">
        <img src="${imgOf(wotd)}" alt="${esc(w.v)}" onerror="this.style.display='none'">
        <div class="wotd-body">
          <div class="modal-verb">${esc(w.v)} <button class="speak-btn" onclick="speak('${esc(w.v)}')">🔊</button></div>
          <div class="modal-mean">${esc(w.m)}</div>
          <div class="modal-ex"><div class="en">"${esc(w.e)}"</div><div class="vi">${esc(w.ev)}</div></div>
          <div class="modal-actions">
            <button class="btn btn-primary btn-sm" onclick="openWord(${wotd})">Xem chi tiết</button>
            <button class="btn btn-ghost btn-sm" onclick="speakEx(${wotd})">🔊 Nghe ví dụ</button>
          </div>
        </div>
      </div>
    </div>

    <div class="section">
      <h2>🎯 Chọn cách học của bạn</h2>
      <p class="sub">Kết hợp nhiều hình thức sẽ giúp nhớ lâu hơn gấp nhiều lần so với chỉ đọc.</p>
      <div class="modes">
        <button class="mode-card" data-nav="flash"><div class="ic">🃏</div><h3>Flashcard</h3><p>Lật thẻ học từng cụm từ, đánh dấu đã thuộc/chưa thuộc.</p></button>
        <button class="mode-card" data-nav="quiz"><div class="ic">✏️</div><h3>Trắc nghiệm</h3><p>Chọn nghĩa đúng trong 4 đáp án, có 2 chiều Anh–Việt.</p></button>
        <button class="mode-card" data-nav="fill"><div class="ic">⌨️</div><h3>Gõ từ</h3><p>Nhìn nghĩa tiếng Việt, gõ cụm từ tiếng Anh — nhớ chủ động.</p></button>
        <button class="mode-card" data-nav="match"><div class="ic">🧩</div><h3>Ghép cặp</h3><p>Nối cụm từ với nghĩa đúng — game tính giờ cực vui.</p></button>
        <button class="mode-card" data-nav="listen"><div class="ic">🔊</div><h3>Luyện nghe</h3><p>Nghe phát âm rồi chọn nghĩa đúng.</p></button>
        <button class="mode-card" data-nav="review"><div class="ic">🔁</div><h3>Ôn tập <span class="badge">${due}</span></h3><p>Nhắc lại ngắt quãng đúng lúc sắp quên.</p></button>
        <button class="mode-card" data-nav="stats"><div class="ic">📊</div><h3>Thống kê</h3><p>Theo dõi tiến độ theo từng chủ đề.</p></button>
        <button class="mode-card" data-nav="dict"><div class="ic">📖</div><h3>Từ điển</h3><p>Tra cứu, lọc theo chủ đề, nghe phát âm.</p></button>
      </div>
    </div>

    <div class="section">
      <h2>💡 Gợi ý để nhớ lâu</h2>
      <div class="modes">
        <div class="mode-card"><div class="ic">🗣️</div><h3>Đọc to thành tiếng</h3><p>Mỗi lần học, bấm 🔊 và nhắc lại theo — tai và miệng cùng nhớ.</p></div>
        <div class="mode-card"><div class="ic">🖼️</div><h3>Gắn với hình ảnh</h3><p>Não nhớ hình ảnh tốt hơn chữ — hãy tưởng tượng lại bức tranh khi ôn.</p></div>
        <div class="mode-card"><div class="ic">📝</div><h3>Đặt câu của riêng bạn</h3><p>Sau khi thuộc nghĩa, tự đặt 1 câu về cuộc sống của bạn với cụm từ đó.</p></div>
        <div class="mode-card"><div class="ic">🔁</div><h3>Ôn đúng lúc</h3><p>Vào mục Ôn tập mỗi ngày — app sẽ nhắc đúng lúc bạn sắp quên.</p></div>
      </div>
    </div>`;
}

/* ---------- DICTIONARY ---------- */
let dictQ='',dictTopic='all',dictLetter='all';
function renderDict(){
  const topics=Object.entries(TOPICS);
  $('#view-dict').innerHTML=`
    <h1>📖 Từ điển 200 cụm từ</h1>
    <p class="sub">Bấm vào thẻ để xem chi tiết: cách dùng, ví dụ, phát âm.</p>
    <div class="toolbar">
      <div class="search"><input id="dictSearch" placeholder="Tìm cụm từ hoặc nghĩa tiếng Việt..." value="${esc(dictQ)}"></div>
    </div>
    <div class="toolbar" id="topicChips">
      <button class="chip ${dictTopic==='all'?'active':''}" data-t="all">Tất cả</button>
      ${topics.map(([k,v])=>`<button class="chip ${dictTopic===k?'active':''}" data-t="${k}">${v}</button>`).join('')}
    </div>
    <div class="dict-grid" id="dictGrid"></div>`;
  $('#dictSearch').addEventListener('input',e=>{dictQ=e.target.value;paintDict();});
  $('#topicChips').addEventListener('click',e=>{
    const c=e.target.closest('[data-t]'); if(!c)return;
    dictTopic=c.dataset.t;
    $$('#topicChips .chip').forEach(x=>x.classList.toggle('active',x===c));
    paintDict();
  });
  paintDict();
}
function paintDict(){
  const q=dictQ.trim().toLowerCase();
  const list=PHRASAL_VERBS.map((w,i)=>({w,i})).filter(({w})=>{
    if(dictTopic!=='all'&&w.t!==dictTopic)return false;
    if(q&&!(w.v.toLowerCase().includes(q)||w.m.toLowerCase().includes(q)))return false;
    return true;
  });
  $('#dictGrid').innerHTML=list.length?list.map(({w,i})=>`
    <div class="word-card" onclick="openWord(${i})">
      <img src="${imgOf(i)}" alt="${esc(w.v)}" loading="lazy" onerror="this.style.display='none'">
      <div class="wc-body"><div class="wc-verb">${esc(w.v)}</div><div class="wc-mean">${esc(w.m)}</div></div>
    </div>`).join(''):`<p class="sub">Không tìm thấy cụm từ nào. Thử từ khóa khác nhé!</p>`;
}

/* ---------- FLASHCARD ---------- */
let flashQueue=[],flashPos=0,flashMode='all';
function startFlash(){
  flashQueue=shuffle(PHRASAL_VERBS.map((_,i)=>i));
  flashPos=0;flashMode='all';
  paintFlash();
}
function paintFlash(){
  const total=flashQueue.length;
  if(flashPos>=total){
    $('#view-flash').innerHTML=`<div class="quiz-wrap"><div class="q-card quiz-result">
      <div style="font-size:3rem">🎉</div><h2>Xong một lượt!</h2>
      <p class="sub">Bạn đã duyệt qua ${total} thẻ. Hãy quay lại vào mục Ôn tập để giữ kiến thức lâu dài.</p>
      <button class="btn btn-primary" onclick="startFlash()">🔀 Học lại từ đầu</button>
      <button class="btn btn-ghost" data-nav="review">🔁 Đi ôn tập</button></div></div>`;
    return;
  }
  const i=flashQueue[flashPos],w=PHRASAL_VERBS[i];
  $('#view-flash').innerHTML=`
    <div class="flash-wrap">
      <h1>🃏 Flashcard</h1>
      <p class="sub">Bấm vào thẻ để lật · Thẻ ${flashPos+1}/${total}</p>
      <div class="progress"><div style="width:${Math.round(flashPos/total*100)}%"></div></div>
      <div class="fcard" id="fcard" onclick="this.classList.toggle('flipped')">
        <div class="fcard-inner">
          <div class="fcard-face front">
            <img src="${imgOf(i)}" alt="" onerror="this.style.display='none'">
            <div class="fcard-verb">${esc(w.v)}</div>
            <button class="speak-btn" onclick="event.stopPropagation();speak('${esc(w.v)}')">🔊 Nghe</button>
            <div class="fcard-hint">👆 Bấm để xem nghĩa</div>
          </div>
          <div class="fcard-face back">
            <div class="fcard-mean">${esc(w.m)}</div>
            <div class="fcard-ex">"${esc(w.e)}"<br><span style="font-style:normal">${esc(w.ev)}</span></div>
            <div class="fcard-hint">📌 ${esc(w.u)}</div>
          </div>
        </div>
      </div>
      <div class="flash-btns">
        <button class="btn btn-no" onclick="flashAnswer(false)">😅 Chưa thuộc</button>
        <button class="btn btn-yes" onclick="flashAnswer(true)">😎 Đã thuộc</button>
      </div>
      <p class="sub" style="margin-top:12px"><button class="btn btn-ghost btn-sm" onclick="openWord(${i})">Xem chi tiết</button></p>
    </div>`;
}
function flashAnswer(known){
  const i=flashQueue[flashPos];
  known?markKnown(i):markUnknown(i);
  flashPos++;paintFlash();updateReviewBadge();
}

/* ---------- REVIEW (spaced repetition) ---------- */
let revQueue=[],revPos=0;
function startReview(){
  revQueue=shuffle(dueList());
  revPos=0;paintReview();
}
function paintReview(){
  if(!revQueue.length){
    $('#view-review').innerHTML=`<div class="quiz-wrap"><div class="q-card quiz-result">
      <div style="font-size:3rem">✅</div><h2>Tuyệt vời!</h2>
      <p class="sub">Không còn cụm từ nào cần ôn lúc này. Quay lại sau nhé — app sẽ nhắc đúng lúc bạn sắp quên.</p>
      <button class="btn btn-primary" data-nav="flash">🃏 Học thêm từ mới</button></div></div>`;
    return;
  }
  if(revPos>=revQueue.length){
    $('#view-review').innerHTML=`<div class="quiz-wrap"><div class="q-card quiz-result">
      <div style="font-size:3rem">🎉</div><h2>Ôn tập xong!</h2>
      <p class="sub">Bạn đã ôn ${revQueue.length} cụm từ. Kiến thức sẽ ở lại lâu hơn nhiều đấy!</p>
      <button class="btn btn-primary" onclick="startReview()">🔁 Ôn tiếp</button></div></div>`;
    updateReviewBadge();return;
  }
  const i=revQueue[revPos],w=PHRASAL_VERBS[i],s=stateOf(i);
  $('#view-review').innerHTML=`
    <div class="flash-wrap">
      <h1>🔁 Ôn tập</h1>
      <p class="sub">Còn ${revQueue.length-revPos} từ cần ôn · Mức hiện tại: <b>${['Chưa học','Mới học','Quen dần','Khá thuộc','Thuộc','Nhuần nhuyễn'][s.level]}</b></p>
      <div class="progress"><div style="width:${Math.round(revPos/revQueue.length*100)}%"></div></div>
      <div class="fcard" onclick="this.classList.toggle('flipped')">
        <div class="fcard-inner">
          <div class="fcard-face front">
            <img src="${imgOf(i)}" alt="" onerror="this.style.display='none'">
            <div class="fcard-verb">${esc(w.v)}</div>
            <button class="speak-btn" onclick="event.stopPropagation();speak('${esc(w.v)}')">🔊 Nghe</button>
            <div class="fcard-hint">👆 Bấm để xem nghĩa</div>
          </div>
          <div class="fcard-face back">
            <div class="fcard-mean">${esc(w.m)}</div>
            <div class="fcard-ex">"${esc(w.e)}"<br><span style="font-style:normal">${esc(w.ev)}</span></div>
          </div>
        </div>
      </div>
      <div class="flash-btns">
        <button class="btn btn-no" onclick="revAnswer(false)">😅 Quên rồi</button>
        <button class="btn btn-yes" onclick="revAnswer(true)">😎 Vẫn nhớ</button>
      </div>
    </div>`;
}
function revAnswer(known){
  const i=revQueue[revPos];
  known?markKnown(i):markUnknown(i);
  revPos++;paintReview();updateReviewBadge();
}

/* ---------- QUIZ ---------- */
let quiz={qs:[],pos:0,score:0,dir:'en-vi'};
function renderQuizSetup(){
  $('#view-quiz').innerHTML=`
    <div class="quiz-wrap"><div class="q-card" style="text-align:center">
      <div style="font-size:3rem">✏️</div><h2>Trắc nghiệm</h2>
      <p class="sub">10 câu hỏi, mỗi câu 4 đáp án. Chọn chiều dịch:</p>
      <div class="modal-actions" style="justify-content:center">
        <button class="btn btn-primary" onclick="startQuiz('en-vi')">🇬🇧→🇻🇳 Thấy tiếng Anh, chọn nghĩa Việt</button>
        <button class="btn btn-ghost" onclick="startQuiz('vi-en')">🇻🇳→🇬🇧 Thấy nghĩa Việt, chọn cụm từ</button>
      </div></div></div>`;
}
function startQuiz(dir){
  quiz.dir=dir;quiz.pos=0;quiz.score=0;
  quiz.qs=shuffle(PHRASAL_VERBS.map((_,i)=>i)).slice(0,10).map(i=>{
    const others=shuffle(PHRASAL_VERBS.map((_,j)=>j).filter(j=>j!==i)).slice(0,3);
    return {i,opts:shuffle([i,...others])};
  });
  paintQuiz();
}
function paintQuiz(){
  const q=quiz.qs[quiz.pos];
  if(!q){
    const pct=Math.round(quiz.score/quiz.qs.length*100);
    const msg=pct===100?'🏆 Xuất sắc!':pct>=70?'🎉 Rất tốt!':pct>=50?'💪 Khá ổn, cố thêm nhé!':'📚 Cần luyện thêm, đừng nản!';
    $('#view-quiz').innerHTML=`<div class="quiz-wrap"><div class="q-card quiz-result">
      <div class="score">${quiz.score}/${quiz.qs.length}</div>
      <h2>${msg}</h2>
      <div class="modal-actions" style="justify-content:center">
        <button class="btn btn-primary" onclick="startQuiz(quiz.dir)">🔀 Làm lại</button>
        <button class="btn btn-ghost" data-nav="home">🏠 Trang chủ</button>
      </div></div></div>`;
    return;
  }
  const w=PHRASAL_VERBS[q.i];
  const qtext=quiz.dir==='en-vi'?w.v:w.m;
  const speakBtn=quiz.dir==='en-vi'?`<button class="speak-btn" onclick="speak('${esc(w.v)}')">🔊</button>`:'';
  $('#view-quiz').innerHTML=`
    <div class="quiz-wrap">
      <h1>✏️ Trắc nghiệm</h1>
      <p class="sub">Câu ${quiz.pos+1}/${quiz.qs.length} · Điểm: ${quiz.score}</p>
      <div class="progress"><div style="width:${Math.round(quiz.pos/quiz.qs.length*100)}%"></div></div>
      <div class="q-card">
        <div class="q-num">${quiz.dir==='en-vi'?'Cụm từ này có nghĩa là gì?':'Nghĩa này ứng với cụm từ nào?'}</div>
        <div class="q-text">${esc(qtext)} ${speakBtn}</div>
        ${quiz.dir==='vi-en'?`<img class="q-img" src="${imgOf(q.i)}" onerror="this.style.display='none'">`:''}
        <div id="quizOpts">${q.opts.map(j=>{
          const o=PHRASAL_VERBS[j],label=quiz.dir==='en-vi'?o.m:o.v;
          return `<button class="opt" data-j="${j}">${esc(label)}</button>`;
        }).join('')}</div>
      </div>
    </div>`;
  $('#quizOpts').addEventListener('click',e=>{
    const b=e.target.closest('.opt');if(!b||b.disabled)return;
    const j=+b.dataset.j,ok=j===q.i;
    $$('#quizOpts .opt').forEach(x=>{x.disabled=true;if(+x.dataset.j===q.i)x.classList.add('correct');});
    if(ok){b.classList.add('correct');quiz.score++;markKnown(q.i);}else{b.classList.add('wrong');markUnknown(q.i);}
    updateReviewBadge();
    setTimeout(()=>{quiz.pos++;paintQuiz();},1100);
  });
}

/* ---------- GÕ TỪ (nhớ chủ động) ---------- */
let fill={qs:[],pos:0,score:0};
function renderFillSetup(){
  $('#view-fill').innerHTML=`
    <div class="quiz-wrap"><div class="q-card" style="text-align:center">
      <div style="font-size:3rem">⌨️</div><h2>Gõ từ</h2>
      <p class="sub">Nhìn <b>nghĩa tiếng Việt</b> và <b>câu ví dụ</b>, gõ cụm từ tiếng Anh tương ứng.<br>Bài tập "nhớ chủ động" giúp thuộc lâu nhất. 10 câu mỗi lượt.</p>
      <button class="btn btn-primary" onclick="startFill()">Bắt đầu ▶</button></div></div>`;
}
function startFill(){
  fill.pos=0;fill.score=0;
  fill.qs=shuffle(PHRASAL_VERBS.map((_,i)=>i)).slice(0,10);
  paintFill();
}
function paintFill(){
  const i=fill.qs[fill.pos];
  if(i===undefined){
    const pct=Math.round(fill.score/fill.qs.length*100);
    $('#view-fill').innerHTML=`<div class="quiz-wrap"><div class="q-card quiz-result">
      <div class="score">${fill.score}/${fill.qs.length}</div>
      <h2>${pct>=70?'🎉 Tuyệt vời!':'💪 Cố gắng thêm nhé!'}</h2>
      <div class="modal-actions" style="justify-content:center">
        <button class="btn btn-primary" onclick="startFill()">🔀 Làm lại</button>
        <button class="btn btn-ghost" data-nav="home">🏠 Trang chủ</button>
      </div></div></div>`;
    return;
  }
  const w=PHRASAL_VERBS[i];
  $('#view-fill').innerHTML=`
    <div class="quiz-wrap">
      <h1>⌨️ Gõ từ</h1>
      <p class="sub">Câu ${fill.pos+1}/${fill.qs.length} · Điểm: ${fill.score}</p>
      <div class="progress"><div style="width:${Math.round(fill.pos/fill.qs.length*100)}%"></div></div>
      <div class="q-card" style="text-align:center">
        <img class="q-img" src="${imgOf(i)}" onerror="this.style.display='none'">
        <div class="blank-hint">💡 Nghĩa: <b>${esc(w.m)}</b></div>
        <div class="blank-sentence">🇻🇳 ${esc(w.ev)}</div>
        <div><input class="blank-input" id="blankInput" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="gõ cụm từ tiếng Anh..."></div>
        <div id="fillFb" style="min-height:28px;font-weight:700;margin-top:10px"></div>
        <div class="modal-actions" style="justify-content:center">
          <button class="btn btn-primary" id="fillCheck">Kiểm tra ✓</button>
          <button class="btn btn-ghost" id="fillSkip">Bỏ qua →</button>
        </div>
      </div>
    </div>`;
  const inp=$('#blankInput');inp.focus();
  const norm=s=>s.trim().toLowerCase().replace(/\s+/g,' ');
  const check=()=>{
    const ok=norm(inp.value)===norm(w.v);
    const fb=$('#fillFb');
    if(ok){fb.innerHTML='<span style="color:var(--ok)">✅ Chính xác!</span>';fill.score++;markKnown(i);}
    else{fb.innerHTML=`<span style="color:var(--bad)">❌ Đáp án: <b>${esc(w.v)}</b></span>`;markUnknown(i);}
    const ex=document.createElement('div');
    ex.className='modal-ex';ex.style.textAlign='left';ex.style.marginTop='12px';
    ex.innerHTML=`<div class="en">"${esc(w.e)}" <button class="speak-btn" id="fillSpeak">🔊</button></div><div class="vi">${esc(w.ev)}</div>`;
    fb.appendChild(ex);
    $('#fillSpeak').onclick=()=>speak(w.v);
    updateReviewBadge();
    $('#fillCheck').disabled=true;
    setTimeout(()=>{fill.pos++;paintFill();},2600);
  };
  $('#fillCheck').onclick=check;
  inp.addEventListener('keydown',e=>{if(e.key==='Enter')check();});
  $('#fillSkip').onclick=()=>{markUnknown(i);fill.pos++;paintFill();updateReviewBadge();};
}

/* ---------- MATCHING GAME ---------- */
let mt={ids:[],sel:[],done:0,moves:0,start:0,timer:null};
function renderMatchSetup(){
  $('#view-match').innerHTML=`
    <div class="quiz-wrap"><div class="q-card" style="text-align:center">
      <div style="font-size:3rem">🧩</div><h2>Ghép cặp</h2>
      <p class="sub">Nối mỗi cụm từ với đúng nghĩa của nó. 6 cặp mỗi ván — càng nhanh càng tốt!</p>
      <button class="btn btn-primary" onclick="startMatch()">Bắt đầu ▶</button></div></div>`;
}
function startMatch(){
  mt.ids=shuffle(PHRASAL_VERBS.map((_,i)=>i)).slice(0,6);
  mt.sel=[];mt.done=0;mt.moves=0;mt.start=Date.now();
  clearInterval(mt.timer);
  paintMatch();tickMatch();
  mt.timer=setInterval(tickMatch,1000);
}
function tickMatch(){
  const el=$('#matchTime');if(!el){clearInterval(mt.timer);return;}
  el.textContent=Math.floor((Date.now()-mt.start)/1000)+'s';
}
function paintMatch(){
  const cards=shuffle(mt.ids.flatMap(i=>[{i,k:'v'},{i,k:'m'}]));
  $('#view-match').innerHTML=`
    <h1 style="text-align:center">🧩 Ghép cặp</h1>
    <div class="match-bar"><span>⏱️ <span id="matchTime">0s</span></span><span>✅ ${mt.done}/6 cặp</span><span>👆 ${mt.moves} lượt</span></div>
    <div class="match-grid" id="matchGrid">
      ${cards.map((c,x)=>{const w=PHRASAL_VERBS[c.i];
        return `<button class="mcard" data-x="${x}">${esc(c.k==='v'?w.v:w.m)}</button>`;}).join('')}
    </div>
    <div style="text-align:center"><button class="btn btn-ghost btn-sm" onclick="clearInterval(mt.timer);startMatch()">🔀 Ván mới</button></div>`;
  $('#matchGrid').addEventListener('click',e=>{
    const b=e.target.closest('.mcard');if(!b||b.disabled||b.classList.contains('done'))return;
    const x=+b.dataset.x,card=cards[x];
    if(mt.sel.includes(x))return;
    b.classList.add('sel');mt.sel.push(x);
    if(card.k==='v')speak(PHRASAL_VERBS[card.i].v);
    if(mt.sel.length===2){
      mt.moves++;
      const [a,bx]=mt.sel.map(y=>cards[y]);
      const ok=a.i===bx.i&&a.k!==bx.k;
      const btns=$$('#matchGrid .mcard');
      if(ok){
        setTimeout(()=>{
          btns.forEach(btn=>{const c2=cards[+btn.dataset.x];
            if(c2.i===a.i){btn.classList.remove('sel');btn.classList.add('done');btn.disabled=true;}});
          mt.done++;markKnown(a.i);
          $('#view-match .match-bar').children[1].textContent=`✅ ${mt.done}/6 cặp`;
          if(mt.done===6){
            clearInterval(mt.timer);
            const sec=Math.floor((Date.now()-mt.start)/1000);
            setTimeout(()=>{$('#view-match').innerHTML=`<div class="quiz-wrap"><div class="q-card quiz-result">
              <div style="font-size:3rem">🏆</div><h2>Hoàn thành!</h2>
              <p class="sub">6 cặp trong <b>${sec} giây</b> · ${mt.moves} lượt chọn</p>
              <button class="btn btn-primary" onclick="startMatch()">🔀 Chơi ván mới</button></div></div>`;},600);
          }
          updateReviewBadge();
        },350);
      }else{
        btns.forEach(btn=>{if(mt.sel.includes(+btn.dataset.x))btn.classList.add('err');});
        setTimeout(()=>{btns.forEach(btn=>btn.classList.remove('sel','err'));},600);
      }
      mt.sel=[];
    }
  });
}

/* ---------- LISTENING ---------- */
let li={qs:[],pos:0,score:0};
function renderListenSetup(){
  $('#view-listen').innerHTML=`
    <div class="quiz-wrap"><div class="q-card" style="text-align:center">
      <div style="font-size:3rem">🔊</div><h2>Luyện nghe</h2>
      <p class="sub">Nghe phát âm cụm từ, chọn nghĩa đúng trong 4 đáp án. 10 câu mỗi lượt.</p>
      <button class="btn btn-primary" onclick="startListen()">Bắt đầu ▶</button></div></div>`;
}
function startListen(){
  li.pos=0;li.score=0;
  li.qs=shuffle(PHRASAL_VERBS.map((_,i)=>i)).slice(0,10).map(i=>{
    const others=shuffle(PHRASAL_VERBS.map((_,j)=>j).filter(j=>j!==i)).slice(0,3);
    return {i,opts:shuffle([i,...others])};
  });
  paintListen();
}
function paintListen(){
  const q=li.qs[li.pos];
  if(!q){
    $('#view-listen').innerHTML=`<div class="quiz-wrap"><div class="q-card quiz-result">
      <div class="score">${li.score}/${li.qs.length}</div>
      <h2>${li.score>=7?'🎉 Tai bạn thính lắm!':'💪 Nghe thêm vài lượt nữa nhé!'}</h2>
      <div class="modal-actions" style="justify-content:center">
        <button class="btn btn-primary" onclick="startListen()">🔀 Nghe lại</button>
        <button class="btn btn-ghost" data-nav="home">🏠 Trang chủ</button>
      </div></div></div>`;
    return;
  }
  const w=PHRASAL_VERBS[q.i];
  $('#view-listen').innerHTML=`
    <div class="quiz-wrap">
      <h1>🔊 Luyện nghe</h1>
      <p class="sub">Câu ${li.pos+1}/${li.qs.length} · Điểm: ${li.score}</p>
      <div class="progress"><div style="width:${Math.round(li.pos/li.qs.length*100)}%"></div></div>
      <div class="q-card" style="text-align:center">
        <div class="q-num">Nghe và chọn nghĩa đúng</div>
        <button class="btn btn-primary btn-sm" style="font-size:1.6rem;padding:18px 34px;margin:14px 0" onclick="speak('${esc(w.v)}')">🔊 Nghe lại</button>
        <div id="liOpts">${q.opts.map(j=>`<button class="opt" data-j="${j}">${esc(PHRASAL_VERBS[j].m)}</button>`).join('')}</div>
      </div>
    </div>`;
  setTimeout(()=>speak(w.v),400);
  $('#liOpts').addEventListener('click',e=>{
    const b=e.target.closest('.opt');if(!b||b.disabled)return;
    const j=+b.dataset.j,ok=j===q.i;
    $$('#liOpts .opt').forEach(x=>{x.disabled=true;if(+x.dataset.j===q.i)x.classList.add('correct');});
    if(ok){b.classList.add('correct');li.score++;markKnown(q.i);}else{b.classList.add('wrong');markUnknown(q.i);}
    updateReviewBadge();
    setTimeout(()=>{li.pos++;paintListen();},1200);
  });
}

/* ---------- STATS ---------- */
function renderStats(){
  const total=PHRASAL_VERBS.length,learned=learnedCount(),due=dueList().length;
  const levels=[0,0,0,0,0,0];
  PHRASAL_VERBS.forEach((_,i)=>{levels[Math.min(stateOf(i).level,5)]++;});
  const lvlNames=['Chưa học','Mới học','Quen dần','Khá thuộc','Thuộc','Nhuần nhuyễn'];
  const lvlColors=['#94a3b8','#60a5fa','#a78bfa','#f59e0b','#34d399','#16a34a'];
  const topicRows=Object.entries(TOPICS).map(([k,name])=>{
    const idx=PHRASAL_VERBS.map((w,i)=>w.t===k?i:-1).filter(i=>i>=0);
    const ln=idx.filter(i=>stateOf(i).level>=2).length;
    const pct=Math.round(ln/idx.length*100);
    return `<div class="bar-row"><div class="lbl">${name}</div><div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div><div class="val">${ln}/${idx.length}</div></div>`;
  }).join('');
  $('#view-stats').innerHTML=`
    <h1>📊 Thống kê tiến độ</h1>
    <p class="sub">Tiến độ được lưu trên trình duyệt này.</p>
    <div class="stat-grid">
      <div class="stat-card"><b>${learned}/${total}</b><span>đã thuộc</span></div>
      <div class="stat-card"><b>${Math.round(learned/total*100)}%</b><span>hoàn thành</span></div>
      <div class="stat-card"><b>${due}</b><span>cần ôn tập</span></div>
      <div class="stat-card"><b>${meta.streak}🔥</b><span>ngày liên tiếp</span></div>
    </div>
    <div class="section"><h2>📶 Mức độ thuộc</h2>
      ${levels.map((n,l)=>`<div class="bar-row"><div class="lbl">${lvlNames[l]}</div><div class="bar-track"><div class="bar-fill" style="width:${Math.round(n/total*100)}%;background:${lvlColors[l]}"></div></div><div class="val">${n} từ</div></div>`).join('')}
    </div>
    <div class="section"><h2>🏷️ Theo chủ đề</h2>${topicRows}</div>
    <div class="section">
      <button class="btn btn-ghost btn-sm" onclick="if(confirm('Xóa toàn bộ tiến độ học?')){localStorage.removeItem('${SRS_KEY}');location.reload();}">🗑️ Xóa tiến độ, học lại từ đầu</button>
    </div>`;
}

/* ---------- init ---------- */
trackVisit();applyTheme();renderHome();updateReviewBadge();
