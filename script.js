// ═══════════════════════════════════════════
// State
// ═══════════════════════════════════════════
const answers = {};
let currentIdx = 0;
let autoTimer = null;
const multiAnswers = [];

const SCREENS = ['s1','s2','s3','s4','s5','s6','s7','s8','s9','s10',
                 's11','s12','s13','s14','s15','s16','s17',
                 'ts-intro','ts-how','ts-camera','ts-scanning','ts-results',
                 's18','s19','s20','s21','s22','s23'];

// Quiz screens that show progress header (maps to step number 1..13)
const QUIZ_MAP = {s2:1,s3:2,s4:3,s6:4,s7:5,s8:6,s10:7,s11:8,s12:9,s13:10,s15:11,s16:12,s17:13};
const TOTAL_QUIZ = 13;

// ── TS: Tongue Scan navigation helper ──
function tsGoTo(id) {
  showScreen(SCREENS.indexOf(id));
}

// ── TS: Sticky CTA config ──
const TS_STICKY_CONFIG = {
  'ts-intro':    { text: 'Scan My Tongue Now',        fine: true,  action: () => tsGoTo('ts-how') },
  'ts-how':      { text: "I'm Ready — Start Scan",    fine: false, action: () => tsGoTo('ts-camera') },
  'ts-camera':   { text: 'Take Photo',                fine: false, action: () => capturePhoto() },
  'ts-scanning': null,
  'ts-results':  { text: 'Continue to My Plan →',     fine: false, action: () => advanceStep() },
};

let tsStickyCurrentAction = null;

function updateTsSticky(sid) {
  const bar  = document.getElementById('ts-sticky-cta');
  const btn  = document.getElementById('ts-sticky-btn');
  const fine = document.getElementById('ts-sticky-fine');
  if (!bar) return;
  const cfg = TS_STICKY_CONFIG[sid];
  if (!cfg) { bar.classList.add('hidden'); return; }
  bar.classList.remove('hidden');
  btn.textContent = cfg.text;
  tsStickyCurrentAction = cfg.action;
  if (fine) {
    fine.style.display = cfg.fine ? 'block' : 'none';
  }
}

function tsStickyAction() {
  if (tsStickyCurrentAction) tsStickyCurrentAction();
}

// ═══════════════════════════════════════════
// Inject header into every .quiz-top
// ═══════════════════════════════════════════
const tpl = document.getElementById('tpl-header');
document.querySelectorAll('.quiz-top').forEach(top => {
  if (top.dataset.noHeader) return;
  top.appendChild(tpl.content.cloneNode(true));
});

// ═══════════════════════════════════════════
// Navigation
// ═══════════════════════════════════════════
function showScreen(idx) {
  if (idx < 0 || idx >= SCREENS.length) return;
  if (autoTimer) { clearTimeout(autoTimer); autoTimer = null; }

  const prevEl = document.getElementById(SCREENS[currentIdx]);
  const nextEl = document.getElementById(SCREENS[idx]);

  prevEl?.classList.add('hidden');
  prevEl?.classList.remove('visible');
  nextEl?.classList.remove('hidden');
  nextEl?.classList.add('visible');

  currentIdx = idx;
  const sid = SCREENS[idx];

  // TS camera
  if (sid === 'ts-camera') startCamera();
  else if (typeof stopCamera === 'function') stopCamera();
  // TS sticky
  updateTsSticky(sid);

  // Update all progress fills (black overlay sliding over 5 white seg pills)
  const step = QUIZ_MAP[sid];
  document.querySelectorAll('#progress-fill').forEach(el => {
    el.style.width = step ? Math.round((step / TOTAL_QUIZ) * 100) + '%' : '0%';
  });

  // Auto-advance
  const autoMs = parseInt(nextEl?.dataset.auto);
  if (autoMs) autoTimer = setTimeout(advanceStep, autoMs);

  // Show/hide paywall sticky bar
  const pwBar = document.getElementById('pw-sticky-bar');
  if (pwBar) pwBar.style.display = (sid === 's21') ? 'flex' : 'none';

  // Show/hide results sticky button
  const resBtn = document.getElementById('results-sticky-btn');
  if (resBtn) resBtn.style.display = (sid === 's19') ? 'block' : 'none';

  // Show/hide multi-select confirm wrap
  const multiWrap = document.getElementById('multi-confirm-wrap');
  if (multiWrap) multiWrap.style.display = (sid === 's11') ? 'block' : 'none';

  // Special inits
  if (sid === 's18') runLoading();
  if (sid === 's19') initResults();
  if (sid === 's20') { /* no prefill needed */ }
  if (sid === 's21') { initPwPaywall(); }
  if (sid === 's22') { if (answers.email) document.getElementById('pay-email').value = answers.email; }

  nextEl?.scrollTo?.(0, 0);
}

function advanceStep() { showScreen(currentIdx + 1); }
function goBack()      { showScreen(currentIdx - 1); }

// ═══════════════════════════════════════════
// Single-select options
// ═══════════════════════════════════════════
document.querySelectorAll('.option:not(.multi)').forEach(btn => {
  btn.addEventListener('click', () => {
    const key = btn.dataset.key;
    if (!key) return;
    btn.closest('.options').querySelectorAll('.option').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    answers[key] = btn.dataset.value;
    setTimeout(advanceStep, 280);
  });
});

// ═══════════════════════════════════════════
// Multi-select (S11)
// ═══════════════════════════════════════════
document.querySelectorAll('.option.multi').forEach(btn => {
  btn.addEventListener('click', () => {
    const val = btn.dataset.value;
    if (val === 'none') {
      document.querySelectorAll('.option.multi').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      multiAnswers.length = 0;
      multiAnswers.push('none');
    } else {
      document.querySelector('.option.multi[data-value="none"]')?.classList.remove('selected');
      const ni = multiAnswers.indexOf('none');
      if (ni > -1) multiAnswers.splice(ni, 1);

      btn.classList.toggle('selected');
      const vi = multiAnswers.indexOf(val);
      vi > -1 ? multiAnswers.splice(vi, 1) : multiAnswers.push(val);
    }
    const confirmBtn = document.getElementById('confirm-11');
    confirmBtn.classList.toggle('hidden', multiAnswers.length === 0);
  });
});

function confirmMulti() {
  answers.triggers = [...multiAnswers];
  advanceStep();
}

// ═══════════════════════════════════════════
// Segmented sliders (S7, S12, S15)
// ═══════════════════════════════════════════
['7','12','15'].forEach(sid => {
  const opts = document.querySelectorAll('#sopts-' + sid + ' .slider-opt');
  const fill  = document.getElementById('sfill-'  + sid);
  const thumb = document.getElementById('sthumb-' + sid);

  opts.forEach(btn => {
    btn.addEventListener('click', () => {
      opts.forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      answers[btn.dataset.key] = btn.dataset.value;

      const i   = parseInt(btn.dataset.idx);
      const pct = opts.length <= 1 ? 0 : (i / (opts.length - 1)) * 100;
      if (fill)  fill.style.width = pct + '%';
      if (thumb) thumb.style.left = pct + '%';

      setTimeout(advanceStep, 350);
    });
  });
});

// ═══════════════════════════════════════════
// S17 — Height / Weight
// ═══════════════════════════════════════════
let currentUnit = 'metric';
function setUnit(unit) {
  currentUnit = unit;
  document.getElementById('unit-metric').classList.toggle('active', unit === 'metric');
  document.getElementById('unit-imperial').classList.toggle('active', unit === 'imperial');
  document.getElementById('unit-h').textContent = unit === 'metric' ? 'cm' : 'ft';
  document.getElementById('unit-w').textContent = unit === 'metric' ? 'kg' : 'lbs';
  document.getElementById('inp-height').placeholder = unit === 'metric' ? '170' : '5.7';
  document.getElementById('inp-weight').placeholder = unit === 'metric' ? '70'  : '154';
}

function submitHeightWeight() {
  const h = document.getElementById('inp-height').value;
  const w = document.getElementById('inp-weight').value;
  document.getElementById('inp-height').closest('.input-wrap').style.borderColor = h ? '' : '#ff3b30';
  document.getElementById('inp-weight').closest('.input-wrap').style.borderColor = w ? '' : '#ff3b30';
  if (!h || !w) return;
  answers.height = h; answers.weight = w; answers.unit = currentUnit;
  advanceStep();
}

// ═══════════════════════════════════════════
// S18 — Loading (8s)
// ═══════════════════════════════════════════
function runLoading() {
  const bar = document.getElementById('loading-bar');
  const [l1,l2,l3] = ['l1','l2','l3'].map(id => document.getElementById(id));
  bar.style.width = '0%';
  [l1,l2,l3].forEach(el => { el.className = 'l-step'; });

  l1.classList.add('active');
  setTimeout(() => { bar.style.width = '33%'; }, 200);
  setTimeout(() => { l1.className = 'l-step done'; l2.classList.add('active'); bar.style.width = '66%'; }, 2600);
  setTimeout(() => { l2.className = 'l-step done'; l3.classList.add('active'); bar.style.width = '100%'; }, 5600);
  setTimeout(() => { l3.className = 'l-step done'; advanceStep(); }, 8300);
}

// ═══════════════════════════════════════════
// S19 — Results
// ═══════════════════════════════════════════
const CONCERN_I18N = { bloating:'concernBloating', irregularity:'concernIrregularity', discomfort:'concernDiscomfort', general:'concernGeneral' };
const DIET_I18N    = { regular:'dietRegular', vegetarian:'dietVegetarian', keto:'dietKeto', mediterranean:'dietMediterranean', none:'dietNone' };

function initResults() {
  const d = new Date(); d.setDate(d.getDate() + 14);
  const rawLang = (typeof i18n !== 'undefined' && i18n.currentLanguage) || 'en';
  const lang = rawLang.replace('_', '-');
  document.getElementById('target-date').textContent =
    d.toLocaleDateString(lang, { month:'long', day:'numeric' });

  drawChart();

  const concern = answers.concern || 'bloating';
  const diet    = answers.diet    || 'regular';
  const stress  = answers.stress  || 'moderate';

  const t = (key) => (typeof i18n !== 'undefined') ? i18n.getTranslation(key) : key;
  const concernLabel = t('s19.' + (CONCERN_I18N[concern] || 'concernGeneral'));
  const dietLabel    = t('s19.' + (DIET_I18N[diet] || 'dietNone'));

  const insight1 = t('s19.insight1').replace('{concern}', concernLabel);
  const insight2 = t('s19.insight2').replace('{diet}', dietLabel);
  const insight3 = t('s19.insight3');
  const insight4 = t('s19.insight4');

  document.getElementById('insights').innerHTML = `
    <div class="insight-card"><span class="insight-icon">🔍</span>
      <p class="insight-text">${insight1}</p></div>
    <div class="insight-card"><span class="insight-icon">⚠️</span>
      <p class="insight-text">${insight2}</p></div>
    <div class="insight-card"><span class="insight-icon">📋</span>
      <p class="insight-text">${insight3}</p></div>
    ${(stress === 'high' || stress === 'very-high') ? `<div class="insight-card"><span class="insight-icon">🧘</span><p class="insight-text">${insight4}</p></div>` : ''}
  `;
}

function drawChart() {
  const pts = [[10,95],[60,82],[110,68],[170,48],[220,32],[270,18],[310,8]];
  const pathD = 'M ' + pts.map(p => p.join(' ')).join(' L ');
  document.getElementById('chart-line').setAttribute('d', pathD);
  document.getElementById('chart-area').setAttribute('d', pathD + ' L 310 110 L 10 110 Z');
  document.getElementById('chart-dot').setAttribute('cx', pts[pts.length-1][0]);
  document.getElementById('chart-dot').setAttribute('cy', pts[pts.length-1][1]);
}

// ═══════════════════════════════════════════
// S20 — Email
// ═══════════════════════════════════════════
function submitEmail() {
  const email = document.getElementById('email-input').value.trim();
  const input = document.getElementById('email-input');
  if (!email || !email.includes('@')) { input.style.borderColor = '#ff3b30'; return; }
  input.style.borderColor = '';
  answers.email = email;
  advanceStep();
}

// ═══════════════════════════════════════════
// S21 — Full Paywall
// ═══════════════════════════════════════════
let pwTimerInterval = null;

function initPwPaywall() {
  // Set hero image based on gender answer
  const heroImg = document.querySelector('.pw-hero-img');
  if (heroImg) {
    heroImg.src = (answers.gender === 'male') ? 'assets/man.png' : 'assets/Gut.png';
  }
  // Duplicate media strip logos for seamless marquee
  const strip = document.getElementById('pw-media-strip');
  if (strip && !strip.dataset.duped) {
    strip.innerHTML += strip.innerHTML;
    strip.dataset.duped = '1';
  }
  // Start countdown timer
  if (pwTimerInterval) clearInterval(pwTimerInterval);
  let pwSecs = 14 * 60 + 47;
  const timerEl = document.getElementById('pw-timer');
  if (timerEl) {
    pwTimerInterval = setInterval(() => {
      if (pwSecs <= 0) { clearInterval(pwTimerInterval); return; }
      pwSecs--;
      const m = Math.floor(pwSecs / 60);
      const s = String(pwSecs % 60).padStart(2, '0');
      timerEl.textContent = m + ':' + s;
    }, 1000);
  }
}

// ═══════════════════════════════════════════
// S22 — Payment form
// ═══════════════════════════════════════════
function formatCard(input) {
  input.value = input.value.replace(/\D/g,'').slice(0,16).replace(/(.{4})/g,'$1 ').trim();
}
function formatExpiry(input) {
  let v = input.value.replace(/\D/g,'').slice(0,4);
  if (v.length >= 2) v = v.slice(0,2) + ' / ' + v.slice(2);
  input.value = v;
}
function submitPayment() {
  const fields = [
    ['pay-email',  v => v.includes('@')],
    ['pay-card',   v => v.replace(/\s/g,'').length >= 16],
    ['pay-expiry', v => v.length >= 7],
    ['pay-cvc',    v => v.length >= 3],
  ];
  let ok = true;
  fields.forEach(([id, check]) => {
    const el = document.getElementById(id);
    const pass = check(el.value);
    el.style.borderColor = pass ? '' : '#ff3b30';
    if (!pass) ok = false;
  });
  if (ok) advanceStep();
}

// ═══════════════════════════════════════════
// TONGUE SCAN — Camera
// ═══════════════════════════════════════════
let videoStream = null;
let facingMode = 'user';

async function startCamera() {
  const video = document.getElementById('camera-video');
  const denied = document.getElementById('cam-denied');
  if (!video) return;
  denied.style.display = 'none';
  video.style.display = 'block';
  stopCamera();
  try {
    const constraints = { video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } } };
    videoStream = await navigator.mediaDevices.getUserMedia(constraints);
    video.srcObject = videoStream;
  } catch (err) {
    console.warn('Camera error:', err);
    video.style.display = 'none';
    denied.style.display = 'flex';
  }
}

function stopCamera() {
  if (videoStream) { videoStream.getTracks().forEach(t => t.stop()); videoStream = null; }
}

function stopCameraAndBack() {
  stopCamera();
  tsGoTo('ts-how');
}

function flipCamera() {
  facingMode = facingMode === 'user' ? 'environment' : 'user';
  startCamera();
}

function capturePhoto() {
  const video = document.getElementById('camera-video');
  const canvas = document.getElementById('capture-canvas');
  const vw = video.videoWidth || 640;
  const vh = video.videoHeight || 480;
  const ovalEl = document.querySelector('.cam-oval-ring');
  const videoRect = video.getBoundingClientRect();
  const ovalRect = ovalEl.getBoundingClientRect();
  const scaleX = videoRect.width / vw;
  const scaleY = videoRect.height / vh;
  const scale = Math.max(scaleX, scaleY);
  const frameW = vw * scale;
  const frameH = vh * scale;
  const offsetX = (videoRect.width - frameW) / 2;
  const offsetY = (videoRect.height - frameH) / 2;
  const pad = 20;
  const sx = ((ovalRect.left - videoRect.left - offsetX) - pad) / scale;
  const sy = ((ovalRect.top - videoRect.top - offsetY) - pad) / scale;
  const sw = (ovalRect.width + pad * 2) / scale;
  const sh = (ovalRect.height + pad * 2) / scale;
  canvas.width = Math.round(sw);
  canvas.height = Math.round(sh);
  const ctx = canvas.getContext('2d');
  if (facingMode === 'user') {
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  } else {
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  }
  capturedImageSrc = canvas.toDataURL('image/jpeg', 0.92);
  stopCamera();
  startScan(capturedImageSrc);
}

// ═══════════════════════════════════════════
// TONGUE SCAN — Analysis Profiles
// ═══════════════════════════════════════════
const TS_PROFILES = [
  {
    score: 58, title: 'Digestive Imbalance Detected',
    color:     { val: 'Pale Pink with Yellow Tinge', desc: 'Suggests liver heat and mild Pitta imbalance. Common in people who eat processed or spicy foods regularly.', badge: 'yellow', level: 'Moderate' },
    coating:   { val: 'Thick White–Yellow Coating', desc: 'Indicates Ama (undigested toxins) in the gut. Often linked to sluggish digestion and irregular meal times.', badge: 'red', level: 'High' },
    hydration: { val: 'Mildly Dehydrated', desc: 'Tongue surface shows early signs of dryness. You may not be drinking enough water between meals.', badge: 'yellow', level: 'Low' },
    texture:   { val: 'Slightly Swollen Edges', desc: 'Tooth marks along the edges suggest dampness and spleen deficiency — a classic sign of digestive stress.', badge: 'yellow', level: 'Moderate' },
    insight: 'Your tongue shows classic signs of digestive imbalance — white–yellow coating and pale colour point to accumulated toxins (Ama) and possible dairy or gluten sensitivity. Many people with this profile find they feel heavy after meals, experience afternoon energy dips, and may have irregular bowel movements.',
    zones: { tip: 'healthy', front: 'attention', center: 'issue', back: 'attention' },
    markers: [{ x:55,y:30,color:'yellow',tag:'Liver zone' },{ x:30,y:55,color:'red',tag:'Coating heavy' },{ x:65,y:65,color:'yellow',tag:'Stomach zone' }],
    recs: [
      { icon:'🥛', title:'Try a 7-day dairy-free trial', body:'Your coating pattern is strongly associated with dairy sensitivity. 72% of users with this profile feel lighter after cutting dairy.' },
      { icon:'🌅', title:'Eat your largest meal at lunch', body:'Digestive fire (Agni) peaks at midday. Shifting calories earlier reduces the coating and bloating you may experience.' },
      { icon:'💧', title:'Sip warm water throughout the day', body:'Cold water slows digestion. Warm or room-temperature water helps clear coating and supports enzyme activity.' },
      { icon:'🌿', title:'Add ginger before meals', body:'Fresh ginger stimulates digestive juices and helps break down Ama. Try ½ tsp grated ginger with lemon 10 min before eating.' },
    ],
  },
  {
    score: 41, title: 'Significant Gut Stress Found',
    color:     { val: 'Dusky Red–Purple', desc: 'Indicates blood stagnation and heat in the body. Often linked to high stress, poor circulation, or chronic inflammation.', badge: 'red', level: 'High' },
    coating:   { val: 'Thick Yellow Coating (Root)', desc: 'Heavy coating concentrated at the back of the tongue — this zone corresponds to the large intestine and kidneys in TCM.', badge: 'red', level: 'High' },
    hydration: { val: 'Dehydrated', desc: 'Tongue is visibly dry with reduced moisture. This slows digestion and reduces nutrient absorption significantly.', badge: 'red', level: 'Very Low' },
    texture:   { val: 'Cracked Surface', desc: 'Cracks in the tongue body suggest chronic dehydration, Yin deficiency, or prolonged stress on the digestive system.', badge: 'red', level: 'High' },
    insight: 'Your scan reveals significant digestive stress — the purple-red colour combined with a thick yellow coating is a classic presentation of heat toxins and gut inflammation in both Ayurvedic and TCM frameworks. People with this profile often report frequent bloating, constipation or diarrhoea, skin breakouts, and low energy.',
    zones: { tip: 'attention', front: 'issue', center: 'issue', back: 'issue' },
    markers: [{ x:50,y:20,color:'red',tag:'Inflammation' },{ x:25,y:50,color:'red',tag:'Colon stress' },{ x:70,y:50,color:'red',tag:'Heat detected' },{ x:48,y:75,color:'yellow',tag:'Kidney zone' }],
    recs: [
      { icon:'❄️', title:'Cool your diet for 2 weeks', body:'Reduce spicy, fried, and alcohol. Add cooling foods: cucumber, mint, coconut water, and leafy greens.' },
      { icon:'🫐', title:'Prioritise anti-inflammatory foods', body:'Blueberries, turmeric, fatty fish (or flaxseed), and dark leafy greens directly target the inflammation pattern shown in your scan.' },
      { icon:'😴', title:'Protect your sleep', body:'Your tongue pattern is strongly associated with elevated cortisol. Aim for a consistent 10pm bedtime.' },
      { icon:'🧘', title:'Add 10 min of daily breathwork', body:"Box breathing (4-4-4-4) reduces gut inflammation markers by lowering cortisol." },
    ],
  },
  {
    score: 74, title: 'Mostly Balanced — Minor Signs',
    color:     { val: 'Light Pink with Pale Edges', desc: 'Healthy base colour. Slightly pale edges may indicate mild Vata imbalance or occasional blood sugar fluctuations.', badge: 'green', level: 'Good' },
    coating:   { val: 'Thin White Coating', desc: 'A thin white coat is completely normal and healthy. Your digestive system is processing food well with minimal Ama.', badge: 'green', level: 'Normal' },
    hydration: { val: 'Well Hydrated', desc: 'Tongue surface shows good moisture. Your fluid intake appears adequate. Maintain current water consumption.', badge: 'green', level: 'Good' },
    texture:   { val: 'Slight Indentation (Tip)', desc: 'Minor scalloping at the tip may indicate occasional stress or irregular sleep. Generally a minor finding.', badge: 'yellow', level: 'Minor' },
    insight: "Your tongue is showing a mostly healthy digestive system — good news! The main signals are occasional stress patterns (scalloped tip) and a slight tendency towards Vata imbalance.",
    zones: { tip: 'attention', front: 'healthy', center: 'healthy', back: 'healthy' },
    markers: [{ x:50,y:25,color:'yellow',tag:'Mild stress' },{ x:30,y:55,color:'green',tag:'Stomach OK' },{ x:68,y:55,color:'green',tag:'Liver OK' }],
    recs: [
      { icon:'⏰', title:'Establish consistent meal times', body:'Your Vata pattern responds well to routine. Eating at the same time each day significantly reduces evening bloating.' },
      { icon:'🌾', title:'Watch your fibre balance', body:'Add a daily tablespoon of ground flaxseed to support your gut microbiome optimally.' },
      { icon:'🍵', title:'Add CCF tea after dinner', body:'Cumin, Coriander, and Fennel tea is a classic Ayurvedic digestive tonic — perfect for your profile.' },
      { icon:'📱', title:'Track your gut for 7 days', body:"You're close to optimal. A 7-day food and symptom log will reveal the 1–2 specific foods causing the stress pattern." },
    ],
  },
  {
    score: 49, title: 'Lactose & Gluten Signals Detected',
    color:     { val: 'Pink with White Patches', desc: 'Geographic tongue pattern with white patches may indicate food sensitivities — particularly dairy and gluten reactions in the gut lining.', badge: 'yellow', level: 'Moderate' },
    coating:   { val: 'Patchy White Coating', desc: 'Uneven coating distribution is characteristic of absorption issues and food sensitivity reactions.', badge: 'red', level: 'High' },
    hydration: { val: 'Moderate Hydration', desc: 'Hydration is acceptable but could be improved. Increased water intake will help flush the coating and support gut barrier repair.', badge: 'yellow', level: 'Moderate' },
    texture:   { val: 'Smooth Patches + Papillae Changes', desc: 'Areas of smooth, shiny tongue surface indicate possible B12 or iron deficiency — nutrients most affected by gut malabsorption.', badge: 'yellow', level: 'Moderate' },
    insight: 'Your tongue is showing a classic sensitivity pattern — the patchy coating and colour variation are hallmarks of immune reactivity to specific foods, most commonly dairy, gluten, and sometimes eggs.',
    zones: { tip: 'healthy', front: 'issue', center: 'attention', back: 'attention' },
    markers: [{ x:35,y:40,color:'red',tag:'Sensitivity zone' },{ x:65,y:35,color:'yellow',tag:'Absorption issue' },{ x:50,y:65,color:'yellow',tag:'Gut lining' }],
    recs: [
      { icon:'🥛', title:'Try a strict 14-day dairy elimination', body:'This is the single highest-impact change for your tongue pattern. Remove all dairy for 14 days and photograph your tongue each morning.' },
      { icon:'🌾', title:'Consider a 7-day gluten-free trial', body:'After dairy, gluten is the second most common trigger for this coating pattern.' },
      { icon:'🫐', title:'Add gut-lining support foods', body:'Bone broth, collagen peptides, L-glutamine (from plant sources), and colourful vegetables support tight junction repair.' },
      { icon:'💊', title:'Check B12 and iron levels', body:'Your texture changes suggest possible malabsorption. Ask your GP for a simple blood panel.' },
    ],
  },
];

let currentTsProfile = null;
let capturedImageSrc = null;
const DEMO_EMOJI_SRC = 'assets/tongue.png';

function handlePhoto(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => { capturedImageSrc = e.target.result; startScan(capturedImageSrc); };
  reader.readAsDataURL(file);
}

function runDemoScan() {
  capturedImageSrc = DEMO_EMOJI_SRC;
  startScan(capturedImageSrc);
}

// ═══════════════════════════════════════════
// TONGUE SCAN — Scanning Animation
// ═══════════════════════════════════════════
function startScan(imgSrc) {
  const tr = (key) => (typeof i18n !== 'undefined') ? i18n.getTranslation(key) : key;
  const stepText = (el) => tr(el.dataset.label);
  currentTsProfile = TS_PROFILES[Math.floor(Math.random() * TS_PROFILES.length)];
  document.getElementById('scan-preview').src = imgSrc;
  tsGoTo('ts-scanning');
  document.getElementById('scan-pct').textContent = '0%';
  document.getElementById('scan-label').textContent = tr('ts.scanning.title');
  const ringCircleScan = document.getElementById('scan-ring-circle');
  if (ringCircleScan) { ringCircleScan.style.strokeDashoffset = '327'; ringCircleScan.style.transition = 'none'; }
  ['step1','step2','step3','step4','step5'].forEach(id => {
    const el = document.getElementById(id);
    el.classList.remove('done','active');
    el.textContent = stepText(el);
  });
  const steps = [
    { id:'step1', pct:18, delay:600  },
    { id:'step2', pct:38, delay:1100 },
    { id:'step3', pct:57, delay:1800 },
    { id:'step4', pct:78, delay:2600 },
    { id:'step5', pct:96, delay:3400 },
  ];
  steps.forEach((step, i) => {
    setTimeout(() => {
      setTsProgress(step.pct);
      for (let j = 0; j < i; j++) {
        const el = document.getElementById(steps[j].id);
        el.classList.remove('active'); el.classList.add('done');
        el.textContent = stepText(el);
      }
      const cur = document.getElementById(step.id);
      cur.classList.add('active');
      cur.textContent = stepText(cur);
    }, step.delay);
  });
  setTimeout(() => {
    setTsProgress(100);
    document.getElementById('scan-label').textContent = tr('ts.scanning.complete');
    ['step1','step2','step3','step4','step5'].forEach(id => {
      const el = document.getElementById(id);
      el.classList.remove('active'); el.classList.add('done');
      el.textContent = stepText(el);
    });
    setTimeout(() => showTsResults(), 600);
  }, 4400);
}

function setTsProgress(pct) {
  document.getElementById('scan-pct').textContent = pct + '%';
  const circle = document.getElementById('scan-ring-circle');
  if (circle) {
    const offset = 327 - (327 * pct / 100);
    circle.style.transition = 'stroke-dashoffset 0.5s ease';
    circle.style.strokeDashoffset = offset;
  }
}

// ═══════════════════════════════════════════
// TONGUE SCAN — Results
// ═══════════════════════════════════════════
function showTsResults() {
  const p = currentTsProfile;
  document.getElementById('result-photo').src = capturedImageSrc;
  document.getElementById('results-title').textContent = p.title;

  const markersEl = document.getElementById('zone-markers');
  markersEl.innerHTML = '';
  p.markers.forEach(m => {
    const div = document.createElement('div');
    div.className = 'zone-marker';
    div.style.left = m.x + '%'; div.style.top = m.y + '%';
    div.innerHTML = `<div class="zone-dot ${m.color}"></div><div class="zone-tag">${m.tag}</div>`;
    markersEl.appendChild(div);
  });

  const scoreEl = document.getElementById('score-fill');
  const scorePct = document.getElementById('score-pct');
  const ringCircle = document.getElementById('ring-circle');
  const ringNum = document.getElementById('ring-num');
  setTimeout(() => {
    scoreEl.style.width = p.score + '%';
    scorePct.textContent = p.score + '/100';
    ringNum.textContent = p.score;
    const offset = 163 - (163 * p.score / 100);
    ringCircle.style.transition = 'stroke-dashoffset 1.2s ease';
    ringCircle.style.strokeDashoffset = offset;
    ringCircle.style.stroke = p.score >= 70 ? '#00ce00' : p.score >= 50 ? '#ffb800' : '#ff4444';
  }, 300);

  function setMetric(suffix, data) {
    document.getElementById('m' + suffix + '-val').textContent = data.val;
    document.getElementById('m' + suffix + '-desc').textContent = data.desc;
    const badge = document.getElementById('m' + suffix + '-badge');
    badge.textContent = data.level;
    badge.className = 'metric-badge ts-badge-' + data.badge;
  }
  setMetric('c', p.color); setMetric('f', p.coating);
  setMetric('h', p.hydration); setMetric('t', p.texture);

  document.getElementById('insight-text').textContent = p.insight;

  ['tip','front','center','back'].forEach(zone => {
    const dot = document.getElementById('tz-' + zone + '-dot');
    dot.className = 'tzone-dot ' + (p.zones[zone] || 'healthy');
  });

  const recsList = document.getElementById('recs-list');
  recsList.innerHTML = '';
  p.recs.forEach(rec => {
    const div = document.createElement('div');
    div.className = 'rec-item';
    div.innerHTML = `<div class="rec-icon">${rec.icon}</div><div class="rec-body"><p>${rec.title}</p><p>${rec.body}</p></div>`;
    recsList.appendChild(div);
  });

  tsGoTo('ts-results');
  setTimeout(() => { scoreEl.style.width = p.score + '%'; }, 400);
}

function shareResult() {
  const p = currentTsProfile;
  const text = `👅 My FoodZee Tongue Scan: "${p.title}" — score ${p.score}/100. `;
  if (navigator.share) {
    navigator.share({ title: 'My FoodZee Tongue Scan', text, url: window.location.href }).catch(() => {});
  } else {
    navigator.clipboard?.writeText(text + window.location.href).then(() => alert('Copied!')).catch(() => alert('Share: ' + text));
  }
}

function rescan() {
  document.getElementById('ts-file-input').value = '';
  capturedImageSrc = null; currentTsProfile = null;
  tsGoTo('ts-camera');
}

// ═══════════════════════════════════════════
// Init
// ═══════════════════════════════════════════
document.getElementById('s1-cta').addEventListener('click', advanceStep);
document.getElementById('s1').classList.add('visible');
