const SUPABASE_URL = 'https://bizeppowtegiiarudswp.supabase.co';
const SUPABASE_KEY = 'sb_publishable_-_BzV9MA1BHzZIkrap91NQ_R5Gr0Ecl';
const BUCKET_NAME = 'prompt-images';
const TABLE_NAME = 'prompt_cards';
const CATEGORIES_TABLE = 'prompt_categories';
const NOTICE_TABLE = 'important_notice';
const TOOLS_TABLE = 'ai_tools';
const LIKES_TABLE = 'prompt_likes';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let itemsCache = [];
let categoriesCache = ['Male', 'Female'];
let editingCategoryName = null;
let promptCategoriesSubscribed = false;
let editingId = null;
let editingToolId = null;
let toolsCache = [];
let secretClickCount = 0;
let secretClickTimer = null;
let heroSlides = [];
let heroIndex = 0;
let heroInterval = null;
let lastScrollY = 0;
const ITEMS_PER_PAGE = 10;
let currentPage = 1;
let lastFilterValue = 'All';
let pendingSharedCardId = null;
let isFocusingSharedCard = false;
let promptLikesCache = {};
let siteLanguageIndex = 0;

const fallbackHeroSlides = [
  { title: '3D Portrait Style', image: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=1200&q=80' },
  { title: 'Luxury Cinematic Look', image: 'https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=1200&q=80' },
  { title: 'Creative Fashion Mood', image: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=1200&q=80' },
  { title: 'Stylish Viral Prompt', image: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=1200&q=80' }
];


function animateVisitCounter(newCount) {
  const countEl = document.getElementById('liveVisitCount');
  const wrap = document.querySelector('.visit-counter');
  if (!countEl) return;

  const oldValue = Number(countEl.textContent.replace(/,/g, '')) || 0;
  const cleanCount = Number(newCount || 0);

  countEl.textContent = cleanCount.toLocaleString('en-IN');

  if (wrap && cleanCount !== oldValue) {
    wrap.classList.remove('bump');
    void wrap.offsetWidth;
    wrap.classList.add('bump');
  }
}

async function fetchCurrentVisitCount() {
  try {
    const { data, error } = await supabaseClient
      .from('site_views')
      .select('view_count')
      .eq('id', 1)
      .single();

    if (error) throw error;
    animateVisitCounter(data?.view_count || 0);
  } catch (error) {
    console.warn('Current visit count fetch failed:', error);
  }
}

async function incrementLiveVisitCount() {
  try {
    const { data, error } = await supabaseClient.rpc('increment_site_views');
    if (error) throw error;
    animateVisitCounter(data || 0);

    setTimeout(() => {
      fetchCurrentVisitCount();
    }, 450);
  } catch (error) {
    console.warn('Visit count update failed:', error);
    fetchCurrentVisitCount();
  }
}

function subscribeLiveVisitCount() {
  try {
    supabaseClient
      .channel('site_views_live_count')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'site_views', filter: 'id=eq.1' },
        payload => {
          const row = payload.new || payload.old;
          if (row && typeof row.view_count !== 'undefined') {
            animateVisitCounter(row.view_count);
          }
        }
      )
      .subscribe();
  } catch (error) {
    console.warn('Live visit subscription failed:', error);
  }
}

async function startLiveVisitCounter() {
  await fetchCurrentVisitCount();
  await incrementLiveVisitCount();
  subscribeLiveVisitCount();
}


async function fetchImportantNotice() {
  try {
    const { data, error } = await supabaseClient
      .from(NOTICE_TABLE)
      .select('*')
      .eq('id', 1)
      .maybeSingle();

    if (error) throw error;

    const bar = document.getElementById('importantNoticeBar');
    const textEl = document.getElementById('importantNoticeText');
    const input = document.getElementById('noticeTextInput');

    if (!bar || !textEl) return;

    const text = data?.message?.trim() || '';

    if (text) {
      textEl.textContent = text;
      bar.classList.remove('hidden');
    } else {
      bar.classList.add('hidden');
    }

    if (input) input.value = text;
  } catch (error) {
    console.warn('Notice fetch failed:', error);
  }
}

async function saveImportantNotice() {
  const input = document.getElementById('noticeTextInput');
  const message = input?.value?.trim() || '';

  if (!message) {
    showToast('Please enter notice text');
    return;
  }

  try {
    const { error } = await supabaseClient
      .from(NOTICE_TABLE)
      .upsert({
        id: 1,
        message,
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' });

    if (error) throw error;

    await fetchImportantNotice();
    showToast('Important notice updated');
  } catch (error) {
    console.error(error);
    showToast(error.message || 'Notice save failed');
  }
}

async function deleteImportantNotice() {
  if (!confirm('Delete the important notice?')) return;

  try {
    const { error } = await supabaseClient
      .from(NOTICE_TABLE)
      .delete()
      .eq('id', 1);

    if (error) throw error;

    const input = document.getElementById('noticeTextInput');
    if (input) input.value = '';

    await fetchImportantNotice();
    showToast('Important notice deleted');
  } catch (error) {
    console.error(error);
    showToast(error.message || 'Notice delete failed');
  }
}

function subscribeImportantNotice() {
  try {
    supabaseClient
      .channel('important_notice_live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: NOTICE_TABLE, filter: 'id=eq.1' },
        () => fetchImportantNotice()
      )
      .subscribe();
  } catch (error) {
    console.warn('Notice subscription failed:', error);
  }
}


function normalizeToolUrl(url) {
  const clean = String(url || '').trim();
  if (!clean) return '';
  if (clean.startsWith('http://') || clean.startsWith('https://')) return clean;
  return 'https://' + clean;
}

async function fetchAiTools() {
  try {
    const { data, error } = await supabaseClient
      .from(TOOLS_TABLE)
      .select('*')
      .order('created_at', { ascending: true });

    if (error) throw error;
    toolsCache = data || [];
    renderAiTools();
    renderToolsAdminList(); renderCategoryAdminList();
  } catch (error) {
    console.warn('Tools fetch failed:', error);
    renderAiTools();
  }
}

function renderAiTools() {
  const grid = document.getElementById('toolsGrid');
  if (!grid) return;

  const section = document.getElementById('toolsSection');
  const existingWrap = document.querySelector('.tools-marquee-wrap');
  if (!existingWrap && grid.parentElement && grid.parentElement.id === 'toolsSection') {
    const wrap = document.createElement('div');
    wrap.className = 'tools-marquee-wrap';
    grid.parentElement.insertBefore(wrap, grid);
    wrap.appendChild(grid);
  }

  if (!toolsCache.length) {
    grid.innerHTML = `<div class="tools-empty">No AI tools added yet. Add tools from the hidden admin panel.</div>`;
    grid.style.animation = 'none';
    return;
  }

  grid.style.animation = '';
  const repeatedTools = [...toolsCache, ...toolsCache];

  grid.innerHTML = repeatedTools.map(tool => `
    <a class="tool-card" href="${escapeHtml(tool.url)}" target="_blank" rel="noopener">
      <div class="tool-main">
        <span class="tool-icon">${escapeHtml(tool.icon || '✨')}</span>
        <span class="tool-name">${escapeHtml(tool.name)}</span>
      </div>
      <span class="tool-open">↗</span>
    </a>
  `).join('');
}

async function saveAiTool() {
  const nameInput = document.getElementById('toolNameInput');
  const iconInput = document.getElementById('toolIconInput');
  const urlInput = document.getElementById('toolUrlInput');

  const name = nameInput?.value?.trim() || '';
  const icon = iconInput?.value?.trim() || '✨';
  const url = normalizeToolUrl(urlInput?.value || '');

  if (!name || !url) {
    showToast('Please enter tool name and URL');
    return;
  }

  try {
    if (editingToolId) {
      const { error } = await supabaseClient
        .from(TOOLS_TABLE)
        .update({
          name,
          icon,
          url,
          updated_at: new Date().toISOString()
        })
        .eq('id', editingToolId);

      if (error) throw error;
      showToast('Tool updated');
    } else {
      const { error } = await supabaseClient
        .from(TOOLS_TABLE)
        .insert({ name, icon, url });

      if (error) throw error;
      showToast('Tool added');
    }

    clearToolForm();
    await fetchAiTools();
fetchPromptLikes();
  } catch (error) {
    console.error(error);
    showToast(error.message || 'Tool save failed');
  }
}

function editAiTool(id) {
  const tool = toolsCache.find(item => String(item.id) === String(id));
  if (!tool) return;

  editingToolId = tool.id;
  document.getElementById('toolNameInput').value = tool.name || '';
  document.getElementById('toolIconInput').value = tool.icon || '';
  document.getElementById('toolUrlInput').value = tool.url || '';
  document.getElementById('toolSaveBtn').textContent = 'Update Tool';
  showToast('Tool edit mode enabled');
}

async function deleteAiTool(id) {
  if (!confirm('Delete this tool?')) return;

  try {
    const { error } = await supabaseClient
      .from(TOOLS_TABLE)
      .delete()
      .eq('id', id);

    if (error) throw error;

    if (String(editingToolId) === String(id)) clearToolForm();
    await fetchAiTools();
    showToast('Tool deleted');
  } catch (error) {
    console.error(error);
    showToast(error.message || 'Tool delete failed');
  }
}

function clearToolForm() {
  editingToolId = null;
  const nameInput = document.getElementById('toolNameInput');
  const iconInput = document.getElementById('toolIconInput');
  const urlInput = document.getElementById('toolUrlInput');
  const saveBtn = document.getElementById('toolSaveBtn');

  if (nameInput) nameInput.value = '';
  if (iconInput) iconInput.value = '';
  if (urlInput) urlInput.value = '';
  if (saveBtn) saveBtn.textContent = 'Save Tool';
}

function renderToolsAdminList() {
  const list = document.getElementById('toolsAdminList');
  if (!list) return;

  if (!toolsCache.length) {
    list.innerHTML = `<div class="tools-empty">No tools added yet.</div>`;
    return;
  }

  list.innerHTML = toolsCache.map(tool => `
    <div class="tool-admin-item">
      <div>
        <b>${escapeHtml(tool.icon || '✨')} ${escapeHtml(tool.name)}</b>
        <small>${escapeHtml(tool.url)}</small>
      </div>
      <div class="tool-admin-actions">
        <button class="tool-edit-btn" onclick="editAiTool('${tool.id}')">Edit</button>
        <button class="tool-delete-btn" onclick="deleteAiTool('${tool.id}')">Delete</button>
      </div>
    </div>
  `).join('');
}

function subscribeAiTools() {
  try {
    supabaseClient
      .channel('ai_tools_live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: TOOLS_TABLE },
        () => fetchAiTools()
      )
      .subscribe();
  } catch (error) {
    console.warn('Tools subscription failed:', error);
  }
}


const dmHelpLanguages = [
  {
    button: 'English',
    label: 'Need help?',
    text: 'If you cannot generate your photo yourself, DM us on Instagram. Send your photo and selected prompt.'
  },
  {
    button: 'हिंदी',
    label: 'मदद चाहिए?',
    text: 'अगर आप अपनी फोटो खुद generate नहीं कर पा रहे हैं, तो Instagram पर DM करें. अपनी photo और selected prompt भेजें.'
  },
  {
    button: 'ગુજરાતી',
    label: 'મદદ જોઈએ છે?',
    text: 'જો તમારાથી photo generate ન થતો હોય, તો Instagram પર DM કરો. તમારો photo અને selected prompt મોકલો.'
  }
];

let dmHelpLanguageIndex = 0;

function changeDmLanguage() {
  dmHelpLanguageIndex = (dmHelpLanguageIndex + 1) % dmHelpLanguages.length;
  const data = dmHelpLanguages[dmHelpLanguageIndex];

  const card = document.getElementById('dmHelpCard');
  const label = document.getElementById('dmHelpLabel');
  const text = document.getElementById('dmHelpText');
  const button = document.getElementById('dmLangBtn');

  if (!label || !text || !button) return;

  label.textContent = data.label;
  text.textContent = data.text;
  button.textContent = data.button;

  if (card) {
    card.classList.remove('text-swap');
    void card.offsetWidth;
    card.classList.add('text-swap');
  }
}


let deferredInstallPrompt=null;
function setupNexaPromInstallButton(){
  const btn=document.getElementById('installAppBtn');
  if(!btn) return;
  if('serviceWorker' in navigator){navigator.serviceWorker.register('/sw.js').catch(e=>console.warn('SW failed:',e));}
  window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();deferredInstallPrompt=event;btn.classList.remove('hidden');});
  window.addEventListener('appinstalled',()=>{deferredInstallPrompt=null;btn.classList.add('hidden');showToast('NexaProm installed');});
  const standalone=window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
  if(standalone) btn.classList.add('hidden');
}
async function installNexaPromApp(){
  const btn=document.getElementById('installAppBtn');
  if(!deferredInstallPrompt){showToast('Use browser menu → Add to Home screen');return;}
  deferredInstallPrompt.prompt(); await deferredInstallPrompt.userChoice;
  deferredInstallPrompt=null; if(btn) btn.classList.add('hidden');
}


function hideSiteLoader() {
  const loader = document.getElementById('siteLoader');
  if (!loader) return;
  loader.classList.add('hide');
  setTimeout(() => loader.remove(), 500);
}

function initLottieLoader() {
  const target = document.getElementById('lottieLoader');
  if (!target) return;

  if (window.lottie) {
    try {
      window.lottie.loadAnimation({
        container: target,
        renderer: 'svg',
        loop: true,
        autoplay: true,
        path: 'loader.json'
      });
    } catch (error) {
      console.warn('Lottie loader failed:', error);
      target.innerHTML = '<div class="loader-fallback-logo">NX</div>';
    }
  } else {
    target.innerHTML = '<div class="loader-fallback-logo">NX</div>';
  }
}

/* Loader safety:
   - Do not wait forever for images, ads, network, or slow scripts.
   - Hide after DOM is ready.
   - Force hide after 3.5 seconds even on bad network. */
document.addEventListener('DOMContentLoaded', () => {
  initLottieLoader();
  setTimeout(hideSiteLoader, 900);
});

window.addEventListener('load', () => {
  setTimeout(hideSiteLoader, 300);
});

setTimeout(hideSiteLoader, 3500);

function scrollToSection(id) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: 'smooth' });
}

function showToast(text) {
  const t = document.getElementById('toast');
  t.textContent = text;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 1800);
}


function playCopySound() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;

    const ctx = new AudioContext();
    const now = ctx.currentTime;

    const master = ctx.createGain();
    master.gain.setValueAtTime(0.0001, now);
    master.gain.exponentialRampToValueAtTime(0.16, now + 0.012);
    master.gain.exponentialRampToValueAtTime(0.0001, now + 0.62);
    master.connect(ctx.destination);

    // Cartoon toy whistle: quick rising slide + playful bounce note
    const whistle = ctx.createOscillator();
    const whistleGain = ctx.createGain();
    whistle.type = 'sine';
    whistle.frequency.setValueAtTime(520, now);
    whistle.frequency.exponentialRampToValueAtTime(1550, now + 0.18);
    whistle.frequency.exponentialRampToValueAtTime(1180, now + 0.28);
    whistle.frequency.exponentialRampToValueAtTime(1800, now + 0.42);

    whistleGain.gain.setValueAtTime(0.0001, now);
    whistleGain.gain.exponentialRampToValueAtTime(0.36, now + 0.025);
    whistleGain.gain.exponentialRampToValueAtTime(0.12, now + 0.28);
    whistleGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.52);

    whistle.connect(whistleGain);
    whistleGain.connect(master);
    whistle.start(now);
    whistle.stop(now + 0.56);

    // Soft pop layer
    const pop = ctx.createOscillator();
    const popGain = ctx.createGain();
    pop.type = 'triangle';
    pop.frequency.setValueAtTime(220, now + 0.02);
    pop.frequency.exponentialRampToValueAtTime(90, now + 0.14);
    popGain.gain.setValueAtTime(0.0001, now + 0.02);
    popGain.gain.exponentialRampToValueAtTime(0.20, now + 0.04);
    popGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
    pop.connect(popGain);
    popGain.connect(master);
    pop.start(now + 0.02);
    pop.stop(now + 0.18);

    // Tiny sparkle ending
    [2100, 2600].forEach((freq, i) => {
      const sparkle = ctx.createOscillator();
      const gain = ctx.createGain();
      sparkle.type = 'sine';
      sparkle.frequency.setValueAtTime(freq, now + 0.36 + i * 0.05);
      gain.gain.setValueAtTime(0.0001, now + 0.36 + i * 0.05);
      gain.gain.exponentialRampToValueAtTime(0.08, now + 0.38 + i * 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.48 + i * 0.05);
      sparkle.connect(gain);
      gain.connect(master);
      sparkle.start(now + 0.36 + i * 0.05);
      sparkle.stop(now + 0.52 + i * 0.05);
    });

    setTimeout(() => ctx.close(), 850);
  } catch (error) {
    console.warn('Copy sound skipped:', error);
  }
}

function showCopyAnimation(button) {
  playCopySound();

  if (button) {
    const oldText = button.textContent;
    button.classList.add('copied');
    button.textContent = 'Copied ✓';
    setTimeout(() => {
      button.classList.remove('copied');
      button.textContent = oldText;
    }, 1200);
  }

  const burst = document.getElementById('copyBurst');
  burst.classList.remove('hidden', 'show');
  void burst.offsetWidth;
  burst.classList.add('show');

  launchConfettiRibbons();

  setTimeout(() => {
    burst.classList.remove('show');
    burst.classList.add('hidden');
  }, 1150);
}

function launchConfettiRibbons() {
  const colors = ['#33d8ff', '#865dff', '#ff4ca2', '#20e3a2', '#ffd166', '#ffffff'];
  const total = window.innerWidth <= 780 ? 34 : 56;

  for (let i = 0; i < total; i++) {
    const piece = document.createElement('span');
    const type = i % 5;
    piece.className =
      type === 0 ? 'star-pop' :
      type === 1 ? 'bubble-pop' :
      type === 2 ? 'spark-pop' :
      'confetti-piece' + (i % 3 === 0 ? ' ribbon' : '');

    const color = colors[i % colors.length];
    if (piece.className.includes('bubble-pop')) {
      piece.style.setProperty('--bubbleColor', color);
    } else if (piece.className.includes('spark-pop')) {
      piece.style.setProperty('--sparkColor', color);
    } else if (piece.className.includes('star-pop')) {
      piece.style.setProperty('--starColor', color);
    } else {
      piece.style.background = color;
    }

    const angle = (Math.PI * 2 * i) / total;
    const distance = (window.innerWidth <= 780 ? 105 : 165) + Math.random() * 105;
    const x = Math.cos(angle) * distance;
    const y = Math.sin(angle) * distance - 55 - Math.random() * 95;
    const rotate = (Math.random() * 900 - 450).toFixed(0) + 'deg';
    const scale = (0.65 + Math.random() * 0.8).toFixed(2);

    piece.style.setProperty('--x', `${x.toFixed(0)}px`);
    piece.style.setProperty('--y', `${y.toFixed(0)}px`);
    piece.style.setProperty('--r', rotate);
    piece.style.setProperty('--s', scale);
    piece.style.animationDelay = `${Math.random() * 0.16}s`;

    document.body.appendChild(piece);
    setTimeout(() => piece.remove(), 1700);
  }
}

function escapeHtml(str = '') {
  return String(str).replace(/[&<>"']/g, s => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[s]));
}

function safeName(str = 'file') {
  return String(str).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'file';
}

function normalizeRow(row) {
  return {
    ...row,
    images: Array.isArray(row.images) ? row.images : [],
    current: 0,
    trending: Boolean(row.trending)
  };
}


let scrollSoundLastTime = 0;
let scrollSoundUnlocked = false;

function playScrollDubSound() {
  try {
    const nowMs = Date.now();
    if (nowMs - scrollSoundLastTime < 165) return;
    scrollSoundLastTime = nowMs;

    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;

    const ctx = new AudioContext();
    const now = ctx.currentTime;

    const master = ctx.createGain();
    master.gain.setValueAtTime(0.0001, now);
    master.gain.exponentialRampToValueAtTime(0.075, now + 0.008);
    master.gain.exponentialRampToValueAtTime(0.0001, now + 0.13);
    master.connect(ctx.destination);

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(155, now);
    osc.frequency.exponentialRampToValueAtTime(82, now + 0.11);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.48, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.125);

    osc.connect(gain);
    gain.connect(master);
    osc.start(now);
    osc.stop(now + 0.15);

    setTimeout(() => ctx.close(), 260);
  } catch (error) {
    console.warn('Scroll sound skipped:', error);
  }
}

function setupScrollDubSound() {
  const unlock = () => {
    scrollSoundUnlocked = true;
  };

  window.addEventListener('touchstart', unlock, { passive: true });
  window.addEventListener('mousedown', unlock, { passive: true });
  window.addEventListener('wheel', () => {
    scrollSoundUnlocked = true;
    playScrollDubSound();
  }, { passive: true });

  window.addEventListener('touchmove', () => {
    if (scrollSoundUnlocked) playScrollDubSound();
  }, { passive: true });

  window.addEventListener('scroll', () => {
    if (scrollSoundUnlocked && window.innerWidth <= 780) {
      playScrollDubSound();
    }
  }, { passive: true });
}

function setupHideTopbarOnScroll() {
  const topbar = document.getElementById('topbar');
  if (!topbar) return;

  window.addEventListener('scroll', () => {
    const y = window.scrollY || document.documentElement.scrollTop;
    const isMobile = window.innerWidth <= 780;

    if (!isMobile) {
      topbar.classList.remove('hide-on-scroll');
      lastScrollY = y;
      return;
    }

    if (y > 90 && y > lastScrollY + 8) {
      topbar.classList.add('hide-on-scroll');
    } else if (y < lastScrollY - 8 || y < 40) {
      topbar.classList.remove('hide-on-scroll');
    }

    lastScrollY = Math.max(0, y);
  }, { passive: true });
}

function buildHeroSlides() {
  const uploadedSlides = [];
  itemsCache.forEach(item => {
    (item.images || []).forEach((img, index) => {
      uploadedSlides.push({
        title: item.title || item.category || `Preview ${index + 1}`,
        image: img
      });
    });
  });
  heroSlides = uploadedSlides.length ? uploadedSlides : fallbackHeroSlides;
}

function renderHeroSlide(index, firstLoad = false) {
  const heroImg = document.getElementById('heroPreviewImage');
  const heroTitle = document.getElementById('heroPreviewTitle');
  if (!heroImg || !heroTitle || !heroSlides.length) return;

  const slide = heroSlides[index];
  if (firstLoad || !heroImg.src) {
    heroImg.src = slide.image;
    heroTitle.textContent = slide.title;
    heroImg.classList.remove('flip-out');
    heroImg.classList.add('flip-in');
    return;
  }

  heroImg.classList.remove('flip-in');
  heroImg.classList.add('flip-out');

  setTimeout(() => {
    heroImg.src = slide.image;
    heroTitle.textContent = slide.title;
    heroImg.classList.remove('flip-out');
    heroImg.classList.add('flip-in');
  }, 280);
}

function startHeroSlider() {
  buildHeroSlides();
  heroIndex = 0;
  renderHeroSlide(heroIndex, true);

  if (heroInterval) clearInterval(heroInterval);
  heroInterval = setInterval(() => {
    if (!heroSlides.length) return;
    heroIndex = (heroIndex + 1) % heroSlides.length;
    renderHeroSlide(heroIndex);
  }, 3200);
}

async function fetchItems() {
  const { data, error } = await supabaseClient
    .from(TABLE_NAME)
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error(error);
    itemsCache = [];
    showToast('Unable to load prompt data');
  } else {
    itemsCache = (data || []).map(normalizeRow);
  }

  startHeroSlider();
  await fetchPromptCategories();
  renderGallery();
}

function updateCategoryFilter(items) {
  const select = document.getElementById('categoryFilter');
  if (!select) return;
  const oldValue = select.value || 'All';
  const categories = getAllPromptCategories();
  select.innerHTML = [`<option value="All">All Prompts</option>`, ...categories.map(cat => `<option value="${escapeHtml(cat)}">${escapeHtml(cat)}</option>`)].join('');
  select.value = oldValue === 'All' || categories.includes(oldValue) ? oldValue : 'All';
  renderCategoryPills();
}


function slugifyText(text) {
  return String(text || '')
    .toLowerCase()
    .trim()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70) || 'prompt';
}

function getItemSlug(item) {
  return `${slugifyText(item.title)}-${item.id}`;
}

function getIdFromSlug(slug) {
  if (!slug) return null;
  const parts = String(slug).split('-');
  return parts[parts.length - 1];
}

function getPromptParam() {
  const params = new URLSearchParams(window.location.search);
  return params.get('prompt');
}

function getLikedPromptIds() {
  try {
    return JSON.parse(localStorage.getItem('nexaprom_liked_prompts') || '[]');
  } catch {
    return [];
  }
}

function setLikedPromptIds(ids) {
  localStorage.setItem('nexaprom_liked_prompts', JSON.stringify([...new Set(ids)]));
}

function isPromptLiked(id) {
  return getLikedPromptIds().includes(String(id));
}

async function fetchPromptLikes() {
  try {
    const { data, error } = await supabaseClient
      .from(LIKES_TABLE)
      .select('prompt_id, like_count');

    if (error) throw error;
    promptLikesCache = {};
    (data || []).forEach(row => {
      promptLikesCache[String(row.prompt_id)] = row.like_count || 0;
    });
    renderGallery(false);
  } catch (error) {
    console.warn('Likes fetch failed:', error);
  }
}

async function togglePromptLike(id, btn) {
  const likedIds = getLikedPromptIds();
  const idText = String(id);
  const alreadyLiked = likedIds.includes(idText);

  let nextLikedIds;
  let delta;
  if (alreadyLiked) {
    nextLikedIds = likedIds.filter(item => item !== idText);
    delta = -1;
  } else {
    nextLikedIds = [...likedIds, idText];
    delta = 1;
  }

  setLikedPromptIds(nextLikedIds);
  promptLikesCache[idText] = Math.max(0, (promptLikesCache[idText] || 0) + delta);
  if (btn) {
    btn.classList.toggle('liked', !alreadyLiked);
    btn.querySelector('span').textContent = promptLikesCache[idText] || 0;
  }

  try {
    const { data } = await supabaseClient
      .from(LIKES_TABLE)
      .select('prompt_id, like_count')
      .eq('prompt_id', idText)
      .maybeSingle();

    if (data) {
      await supabaseClient
        .from(LIKES_TABLE)
        .update({ like_count: Math.max(0, (data.like_count || 0) + delta), updated_at: new Date().toISOString() })
        .eq('prompt_id', idText);
    } else if (delta > 0) {
      await supabaseClient
        .from(LIKES_TABLE)
        .insert({ prompt_id: idText, like_count: 1 });
    }
  } catch (error) {
    console.warn('Like sync failed:', error);
  }
}

function openHowToUse(id) {
  const item = itemsCache.find(entry => String(entry.id) === String(id));
  const modal = document.getElementById('howUseModal');
  const title = document.getElementById('howUseTitle');
  if (title && item) title.textContent = `Create “${item.title}” in 3 simple steps`;
  if (modal) modal.classList.remove('hidden');
}

function closeHowToUse() {
  document.getElementById('howUseModal')?.classList.add('hidden');
}

function openPromptDetail(id, pushUrl = true) {
  const item = itemsCache.find(entry => String(entry.id) === String(id));
  if (!item) return;

  const modal = document.getElementById('promptDetailModal');
  const content = document.getElementById('promptDetailContent');
  const img = item.images?.[0] || '';
  const likeCount = promptLikesCache[String(item.id)] || 0;
  const liked = isPromptLiked(item.id);

  content.innerHTML = `
    <button class="close-btn" onclick="closePromptDetail()">×</button>
    <div class="detail-grid">
      <div class="detail-image-wrap">
        ${img ? `<img src="${escapeHtml(img)}" alt="${escapeHtml(item.title)}" />` : `<div class="empty-card"><strong>No image</strong></div>`}
        ${item.trending ? `<span class="trending-badge detail-trending">🔥 Trending</span>` : ''}
      </div>
      <div class="detail-content">
        <span class="feature-kicker">${escapeHtml(item.category || 'Prompt')}</span>
        <h1>${escapeHtml(item.title)}</h1>
        <p class="detail-intro">Copy this AI photo prompt, use your own image, and recreate a similar style in your favorite AI image generator.</p>
        <div class="detail-prompt">${escapeHtml(item.prompt)}</div>
        <div class="detail-actions">
          <button class="copy-btn" onclick='copyPrompt(${JSON.stringify(item.prompt)}, this)'>Copy Prompt</button>
          <button class="share-btn" onclick="sharePrompt('${item.id}')">Share Link</button>
          <button class="mini-action-btn ${liked ? 'liked' : ''}" onclick="togglePromptLike('${item.id}', this)">❤ <span>${likeCount}</span></button>
          <button class="mini-action-btn" onclick="openHowToUse('${item.id}')">How to use</button>
        </div>
        <a class="how-dm-link" href="https://www.instagram.com/nexaprom.ai" target="_blank" rel="noopener">Can’t generate? DM @nexaprom.ai</a>
      </div>
    </div>
  `;

  modal.classList.remove('hidden');

  if (pushUrl) {
    const url = `${window.location.origin}${window.location.pathname}?prompt=${encodeURIComponent(getItemSlug(item))}`;
    history.pushState({ prompt: item.id }, '', url);
  }
}

function closePromptDetail() {
  document.getElementById('promptDetailModal')?.classList.add('hidden');
  if (window.location.search.includes('prompt=')) {
    history.pushState({}, '', `${window.location.origin}${window.location.pathname}`);
  }
}

function openPromptFromUrl() {
  const slug = getPromptParam();
  if (!slug || !itemsCache.length) return;
  const id = getIdFromSlug(slug);
  const item = itemsCache.find(entry => String(entry.id) === String(id));
  if (item) {
    openPromptDetail(item.id, false);
  }
}

function renderTrendingStrip() {
  const wrap = document.getElementById('trendingStrip');
  if (!wrap) return;
  const trending = itemsCache.filter(item => item.trending).slice(0, 10);
  if (!trending.length) {
    wrap.classList.add('hidden');
    wrap.innerHTML = '';
    return;
  }
  wrap.classList.remove('hidden');
  wrap.innerHTML = `
    <div class="trending-title">🔥 Trending Prompts</div>
    <div class="trending-pills">
      ${trending.map(item => `<button onclick="openPromptDetail('${item.id}')">${escapeHtml(item.title)}</button>`).join('')}
    </div>
  `;
}

const siteLanguages = [
  {
    button: 'English',
    hero: 'Create stunning AI images from premium prompts',
    heroText: 'Browse premium prompt containers, preview style images, copy the prompt instantly, and recreate the same look using your own photo in any AI image tool.',
    gallery: 'Choose your AI photo prompt category',
    tools: 'Create images with these AI tools'
  },
  {
    button: 'हिंदी',
    hero: 'Premium prompts से शानदार AI images बनाएं',
    heroText: 'Prompt containers देखें, style images preview करें, prompt copy करें और अपनी photo से similar look बनाएं.',
    gallery: 'अपनी AI photo prompt category चुनें',
    tools: 'इन AI tools से images बनाएं'
  },
  {
    button: 'ગુજરાતી',
    hero: 'Premium prompts થી stunning AI images બનાવો',
    heroText: 'Prompt containers browse કરો, style images preview કરો, prompt copy કરો અને તમારા photo થી same look બનાવો.',
    gallery: 'તમારી AI photo prompt category પસંદ કરો',
    tools: 'આ AI tools થી images બનાવો'
  }
];

function changeSiteLanguage() {
  siteLanguageIndex = (siteLanguageIndex + 1) % siteLanguages.length;
  const lang = siteLanguages[siteLanguageIndex];
  const btn = document.getElementById('siteLanguageBtn');
  if (btn) btn.textContent = lang.button;

  const heroTitle = document.querySelector('.hero-copy h2');
  const heroText = document.querySelector('.hero-text');
  const galleryTitle = document.querySelector('#gallery .section-title h2');
  const toolsTitle = document.querySelector('#toolsSection .tools-head h2');

  if (heroTitle) heroTitle.textContent = lang.hero;
  if (heroText) heroText.textContent = lang.heroText;
  if (galleryTitle) galleryTitle.textContent = lang.gallery;
  if (toolsTitle) toolsTitle.textContent = lang.tools;

  document.body.classList.remove('lang-swap');
  void document.body.offsetWidth;
  document.body.classList.add('lang-swap');
}

function cardTemplate(item) {
  const currentIndex = item.current || 0;
  const currentImage = item.images?.[currentIndex] || '';
  const swap = item.images?.length > 1 ? `
    <div class="swap-controls">
      <button onclick="changeImage('${item.id}', -1)">‹</button>
      <button onclick="changeImage('${item.id}', 1)">›</button>
    </div>
  ` : '';

  return `
    <article class="prompt-card" data-card-id="${item.id}">
      <div class="image-box">
        <span class="cat-pill">${escapeHtml(item.category)}</span>
        ${currentImage ? `<img src="${escapeHtml(currentImage)}" alt="${escapeHtml(item.title)}" loading="lazy" />` : `<div class="empty-card"><strong>No image</strong><span>Upload images from the admin panel.</span></div>`}
        ${swap}
      </div>
      <div class="card-body">
        <h3>${escapeHtml(item.title)}</h3>
        <div class="prompt-text">${escapeHtml(item.prompt)}</div>
        <div class="card-actions">
          <button class="copy-btn" onclick='copyPrompt(${JSON.stringify(item.prompt)}, this)'>Copy Prompt</button>
          <button class="share-btn" onclick="sharePrompt('${item.id}')">Share</button>
        </div>
      </div>
    </article>
  `;
}


function getAllPromptCategories() {
  const fromRows = itemsCache.map(item => item.category).filter(Boolean);
  return [...new Set(['Male','Female',...categoriesCache,...fromRows])].filter(Boolean);
}
async function fetchPromptCategories() {
  try {
    const { data, error } = await supabaseClient.from(CATEGORIES_TABLE).select('*').order('created_at',{ascending:true});
    if (error) throw error;
    categoriesCache = (data || []).map(row => row.name).filter(Boolean);
    if (!categoriesCache.includes('Male')) categoriesCache.unshift('Male');
    if (!categoriesCache.includes('Female')) categoriesCache.splice(1,0,'Female');
  } catch(error) { console.warn('Categories fetch failed:', error); }
  updateCategoryFilter(itemsCache);
  renderCategoryAdminList();
}
function renderCategoryPills() {
  const wrap=document.getElementById('categoryPills'), select=document.getElementById('categoryFilter');
  if(!wrap||!select) return;
  const selected=select.value||'All';
  const categories=['All',...getAllPromptCategories()];
  wrap.innerHTML=categories.map(cat=>`<button class="category-pill-btn ${selected===cat?'active':''}" onclick="selectPromptCategory('${escapeHtml(cat)}')">${escapeHtml(cat==='All'?'All Prompts':cat)}</button>`).join('');
}
function selectPromptCategory(category) {
  const select=document.getElementById('categoryFilter');
  if(select) select.value=category;
  currentPage=1;
  renderGallery(true);
}
async function savePromptCategory() {
  const input=document.getElementById('categoryNameInput');
  const name=input?.value?.trim()||'';
  if(!name){showToast('Enter category name');return;}
  try{
    if(editingCategoryName){
      const {error}=await supabaseClient.from(CATEGORIES_TABLE).update({name,updated_at:new Date().toISOString()}).eq('name',editingCategoryName);
      if(error) throw error; showToast('Category updated');
    }else{
      const {error}=await supabaseClient.from(CATEGORIES_TABLE).upsert({name}, { onConflict: 'name' });
      if(error) throw error; showToast('Category added');
    }
    editingCategoryName=null; if(input) input.value='';
    const btn=document.getElementById('categorySaveBtn'); if(btn) btn.textContent='Save Category';
    await fetchPromptCategories();
    const itemSelect = document.getElementById('itemCategory');
    if (itemSelect) itemSelect.value = name;
  }catch(error){console.error(error);showToast(error.message||'Category save failed');}
}
function editPromptCategory(name){
  editingCategoryName=name;
  const input=document.getElementById('categoryNameInput'), btn=document.getElementById('categorySaveBtn');
  if(input) input.value=name; if(btn) btn.textContent='Update Category';
  showToast('Category edit mode enabled');
}
async function deletePromptCategory(name){
  if(name==='Male'||name==='Female'){showToast('Default categories cannot be deleted');return;}
  if(!confirm('Delete this category? Existing prompt cards will keep their saved category text.')) return;
  try{
    const {error}=await supabaseClient.from(CATEGORIES_TABLE).delete().eq('name',name);
    if(error) throw error;
    await fetchPromptCategories(); showToast('Category deleted');
  }catch(error){console.error(error);showToast(error.message||'Category delete failed');}
}
function renderCategoryAdminList(){
  const list=document.getElementById('categoryAdminList'), itemSelect=document.getElementById('itemCategory');
  const categories=getAllPromptCategories();
  if(itemSelect){
    const old=itemSelect.value||'';
    itemSelect.innerHTML=[`<option value="">Select Prompt Type</option>`,...categories.map(cat=>`<option value="${escapeHtml(cat)}">${escapeHtml(cat)}</option>`)].join('');
    itemSelect.value=categories.includes(old)?old:'';
  }
  if(!list) return;
  list.innerHTML=categories.map(cat=>`<div class="category-admin-item"><b>${escapeHtml(cat)}</b>${cat==='Male'||cat==='Female'?'':`<button type="button" title="Edit" onclick="editPromptCategory('${escapeHtml(cat)}')">✎</button><button type="button" title="Delete" onclick="deletePromptCategory('${escapeHtml(cat)}')">×</button>`}</div>`).join('');
}
function subscribePromptCategories(){
  if (promptCategoriesSubscribed) return;
  promptCategoriesSubscribed = true;
  try{
    supabaseClient
      .channel('prompt_categories_live')
      .on('postgres_changes',{event:'*',schema:'public',table:CATEGORIES_TABLE},()=>fetchPromptCategories())
      .subscribe();
  } catch(error){
    console.warn('Categories subscription failed:',error);
  }
}

function renderGallery(resetPage = false) {
  updateCategoryFilter(itemsCache);

  const q = document.getElementById('searchInput').value.toLowerCase().trim();
  const selectedCategory = document.getElementById('categoryFilter').value;
  const grid = document.getElementById('cardsGrid');

  const filterKey = `${q}|${selectedCategory}`;
  if (resetPage || filterKey !== lastFilterValue) {
    currentPage = 1;
    lastFilterValue = filterKey;
    playFilterAnimation();
  }

  const filtered = itemsCache.filter(item => {
    const hay = `${item.title} ${item.category} ${item.prompt}`.toLowerCase();
    const searchOk = !q || hay.includes(q);
    const categoryOk = selectedCategory === 'All' || item.category === selectedCategory;
    return searchOk && categoryOk;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  if (currentPage > totalPages) currentPage = totalPages;

  const start = (currentPage - 1) * ITEMS_PER_PAGE;
  const pageItems = filtered.slice(start, start + ITEMS_PER_PAGE);

  grid.classList.remove('filter-pop');
  void grid.offsetWidth;
  grid.classList.add('filter-pop');

  if (!filtered.length) {
    grid.innerHTML = `<div class="empty-card"><strong>No prompt found</strong><span>Select All, Male, or Female. Add content from the hidden admin panel if nothing appears.</span></div>`;
  } else {
    grid.innerHTML = pageItems.map(cardTemplate).join('');
  }

  renderPagination(filtered.length, totalPages);
  renderTrendingStrip();

  if (!isFocusingSharedCard && (pendingSharedCardId || getSharedCardIdFromUrl())) {
    setTimeout(focusSharedCardIfNeeded, 80);
  }

  document.getElementById('totalCards').textContent = itemsCache.length;
  document.getElementById('totalImages').textContent = itemsCache.reduce((sum, item) => sum + (item.images?.length || 0), 0);
  document.getElementById('totalCategories').textContent = getAllPromptCategories().filter(cat => cat !== 'All').length;
}

function renderPagination(totalItems, totalPages) {
  const wrap = document.getElementById('paginationControls');
  if (!wrap) return;

  if (totalItems <= ITEMS_PER_PAGE) {
    wrap.innerHTML = '';
    return;
  }

  let pagesHtml = '';
  for (let i = 1; i <= totalPages; i++) {
    pagesHtml += `<button class="page-btn ${i === currentPage ? 'active' : ''}" onclick="goToPage(${i})">${i}</button>`;
  }

  const start = (currentPage - 1) * ITEMS_PER_PAGE + 1;
  const end = Math.min(currentPage * ITEMS_PER_PAGE, totalItems);

  wrap.innerHTML = `
    <button class="page-arrow" ${currentPage === 1 ? 'disabled' : ''} onclick="goToPage(${currentPage - 1})">‹</button>
    ${pagesHtml}
    <button class="page-arrow" ${currentPage === totalPages ? 'disabled' : ''} onclick="goToPage(${currentPage + 1})">›</button>
    <div class="page-info">Showing ${start}-${end} of ${totalItems}</div>
  `;
}

function goToPage(page) {
  currentPage = page;
  renderGallery(false);
  const gallery = document.getElementById('gallery');
  if (gallery) gallery.scrollIntoView({ behavior: 'smooth', block: 'start' });
  playFilterAnimation();
}

function playFilterAnimation() {
  const colors = ['#33d8ff', '#865dff', '#ff4ca2', '#20e3a2', '#ffd166'];
  const count = window.innerWidth <= 780 ? 12 : 18;
  const centerX = window.innerWidth / 2;
  const centerY = Math.min(window.innerHeight * 0.45, 360);

  for (let i = 0; i < count; i++) {
    const spark = document.createElement('span');
    spark.className = 'filter-spark';
    spark.style.left = `${centerX}px`;
    spark.style.top = `${centerY}px`;
    spark.style.setProperty('--sparkColor', colors[i % colors.length]);

    const angle = (Math.PI * 2 * i) / count;
    const dist = (window.innerWidth <= 780 ? 50 : 85) + Math.random() * 50;
    spark.style.setProperty('--x', `${Math.cos(angle) * dist}px`);
    spark.style.setProperty('--y', `${Math.sin(angle) * dist}px`);
    spark.style.animationDelay = `${Math.random() * .08}s`;

    document.body.appendChild(spark);
    setTimeout(() => spark.remove(), 900);
  }
}


function changeImage(id, direction) {
  const item = itemsCache.find(entry => String(entry.id) === String(id));
  if (!item || !item.images?.length) return;
  const total = item.images.length;
  item.current = (item.current + direction + total) % total;
  renderGallery();
}

async function copyPrompt(prompt, button) {
  try {
    await navigator.clipboard.writeText(prompt);
    showCopyAnimation(button);
    showToast('Prompt copied');
  } catch {
    showToast('Copy failed');
  }
}


async function sharePrompt(id) {
  const item = itemsCache.find(entry => String(entry.id) === String(id));
  if (!item) return;

  const shareUrl = `${window.location.origin}${window.location.pathname}?prompt=${encodeURIComponent(getItemSlug(item))}`;
  const shareText = `${item.title}\n\nOpen this prompt container:\n${shareUrl}`;

  if (navigator.share) {
    try {
      await navigator.share({
        title: item.title,
        text: shareText,
        url: shareUrl
      });
      return;
    } catch (_) {}
  }

  try {
    await navigator.clipboard.writeText(shareUrl);
    showCopyAnimation(null);
    showToast('Prompt detail link copied');
  } catch {
    showToast('Share failed');
  }
}

function getSharedCardIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get('card');
}

function focusSharedCardIfNeeded() {
  if (isFocusingSharedCard) return;

  const sharedId = pendingSharedCardId || getSharedCardIdFromUrl();
  if (!sharedId || !itemsCache.length) return;

  const sharedIndex = itemsCache.findIndex(item => String(item.id) === String(sharedId));
  if (sharedIndex === -1) return;

  isFocusingSharedCard = true;

  const categoryFilter = document.getElementById('categoryFilter');
  const searchInput = document.getElementById('searchInput');

  if (categoryFilter) categoryFilter.value = 'All';
  if (searchInput) searchInput.value = '';

  currentPage = Math.floor(sharedIndex / ITEMS_PER_PAGE) + 1;
  pendingSharedCardId = sharedId;

  renderGallery(false);

  setTimeout(() => {
    const card = document.querySelector(`[data-card-id="${CSS.escape(sharedId)}"]`);
    if (!card) {
      isFocusingSharedCard = false;
      return;
    }

    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    card.classList.add('shared-focus');

    setTimeout(() => {
      card.classList.remove('shared-focus');
    }, 6500);

    pendingSharedCardId = null;
    isFocusingSharedCard = false;
  }, 280);
}

function openAdminModal() {
  document.getElementById('adminModal').classList.remove('hidden');
  checkAdminState();
}

function closeAdminModal() {
  document.getElementById('adminModal').classList.add('hidden');
}

async function adminLogin() {
  const email = document.getElementById('adminEmail').value.trim();
  const password = document.getElementById('adminPass').value;
  if (!email || !password) {
    showToast('Enter email and password');
    return;
  }

  const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) {
    showToast(error.message || 'Login failed');
    return;
  }

  showToast('Login successful');
  await checkAdminState();
}

async function logoutAdmin() {
  await supabaseClient.auth.signOut();
  editingId = null;
  clearForm();
  await checkAdminState();
  showToast('Logged out');
}

async function checkAdminState() {
  const { data } = await supabaseClient.auth.getSession();
  const hasSession = !!data.session;
  document.getElementById('loginView').classList.toggle('hidden', hasSession);
  document.getElementById('adminView').classList.toggle('hidden', !hasSession);
  if (hasSession) { renderAdminList(); fetchImportantNotice(); renderToolsAdminList(); renderCategoryAdminList(); }
}

function clearForm() {
  editingId = null;
  document.getElementById('itemTitle').value = '';
  document.getElementById('itemCategory').value = '';
  document.getElementById('itemPrompt').value = '';
  document.getElementById('itemImages').value = '';
  const trendingInput = document.getElementById('itemTrending');
  if (trendingInput) trendingInput.checked = false;
  document.getElementById('saveBtn').textContent = 'Save Container';
}

async function uploadImages(files) {
  const uploadedUrls = [];
  for (const file of files) {
    const ext = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}-${safeName(file.name.replace(/\.[^.]+$/, ''))}.${ext}`;
    const { error } = await supabaseClient.storage.from(BUCKET_NAME).upload(fileName, file, { upsert: false });
    if (error) throw error;
    const { data } = supabaseClient.storage.from(BUCKET_NAME).getPublicUrl(fileName);
    uploadedUrls.push(data.publicUrl);
  }
  return uploadedUrls;
}

async function savePromptItem() {
  const title = document.getElementById('itemTitle').value.trim();
  const category = document.getElementById('itemCategory').value.trim();
  const prompt = document.getElementById('itemPrompt').value.trim();
  const trending = document.getElementById('itemTrending')?.checked || false;
  const imageFiles = Array.from(document.getElementById('itemImages').files || []);

  if (!title || !category || !prompt) {
    showToast('Please fill title, select Male/Female, and prompt');
    return;
  }

  try {
    let imageUrls = [];
    if (imageFiles.length) imageUrls = await uploadImages(imageFiles);

    if (editingId) {
      const existing = itemsCache.find(item => String(item.id) === String(editingId));
      const payload = {
        title,
        category,
        prompt,
        trending,
        images: imageUrls.length ? imageUrls : (existing?.images || []),
        updated_at: new Date().toISOString()
      };
      const { error } = await supabaseClient.from(TABLE_NAME).update(payload).eq('id', editingId);
      if (error) throw error;
      showToast('Container updated');
    } else {
      const payload = { title, category, prompt, trending, images: imageUrls };
      const { error } = await supabaseClient.from(TABLE_NAME).insert(payload);
      if (error) throw error;
      showToast('Container saved');
    }

    clearForm();
    await fetchItems();
    await fetchPromptCategories();
    renderAdminList();
  } catch (error) {
    console.error(error);
    showToast(error.message || 'Save failed');
  }
}

function renderAdminList() {
  const adminList = document.getElementById('adminList');
  if (!itemsCache.length) {
    adminList.innerHTML = `<div class="empty-card"><strong>No data yet</strong><span>Create your first prompt container from the form above.</span></div>`;
    return;
  }

  adminList.innerHTML = itemsCache.map(item => `
    <div class="admin-item">
      <div>
        <h4>${escapeHtml(item.title)}</h4>
        <p>${escapeHtml(item.category)} • ${item.images?.length || 0} image(s) ${item.trending ? '• 🔥 Trending' : ''}</p>
      </div>
      <div class="admin-actions">
        <button class="edit-btn" onclick="editItem('${item.id}')">Edit</button>
        <button class="delete-btn" onclick="deleteItem('${item.id}')">Delete</button>
      </div>
    </div>
  `).join('');
}

function editItem(id) {
  const item = itemsCache.find(entry => String(entry.id) === String(id));
  if (!item) return;
  editingId = item.id;
  document.getElementById('itemTitle').value = item.title || '';
  document.getElementById('itemCategory').value = item.category || '';
  document.getElementById('itemPrompt').value = item.prompt || '';
  const trendingInput = document.getElementById('itemTrending');
  if (trendingInput) trendingInput.checked = Boolean(item.trending);
  document.getElementById('itemImages').value = '';
  document.getElementById('saveBtn').textContent = 'Update Container';
  window.scrollTo({ top: 0, behavior: 'smooth' });
  showToast('Edit mode enabled');
}

async function deleteItem(id) {
  if (!confirm('Delete this container?')) return;
  const { error } = await supabaseClient.from(TABLE_NAME).delete().eq('id', id);
  if (error) {
    showToast(error.message || 'Delete failed');
    return;
  }
  if (String(editingId) === String(id)) clearForm();
  await fetchItems();
  renderAdminList();
  showToast('Container deleted');
}

function handleSecretAdminClick() {
  secretClickCount += 1;
  clearTimeout(secretClickTimer);
  secretClickTimer = setTimeout(() => { secretClickCount = 0; }, 1800);
  if (secretClickCount >= 4) {
    secretClickCount = 0;
    openAdminModal();
  }
}

supabaseClient.auth.onAuthStateChange(() => checkAdminState());
setupHideTopbarOnScroll();
setupNexaPromInstallButton();
setupScrollDubSound();
fetchItems();
subscribePromptCategories();
startLiveVisitCounter();
fetchImportantNotice();
subscribeImportantNotice();
fetchAiTools();
subscribeAiTools();

setInterval(() => {
  let changed = false;
  itemsCache.forEach(item => {
    if (item.images?.length > 1) {
      item.current = ((item.current || 0) + 1) % item.images.length;
      changed = true;
    }
  });
  if (changed) renderGallery();
}, 4200);

window.addEventListener('popstate', openPromptFromUrl);
