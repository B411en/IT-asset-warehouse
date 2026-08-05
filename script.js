const firebaseConfig = {
    apiKey: "AIzaSyC32BVdl1WOfxij22MVBtOYeoyxfQRQMrg",
    authDomain: "it-asset-system-3462d.firebaseapp.com",
    databaseURL: "https://it-asset-system-3462d-default-rtdb.firebaseio.com",
    projectId: "it-asset-system-3462d",
    storageBucket: "it-asset-system-3462d.firebasestorage.app",
    messagingSenderId: "918668871166",
    appId: "1:918668871166:web:bac8e8ba00836ccdfc2caf"
};

const LOCK_SESSION_KEY = "aa_it_unlocked";
const FAIL_COUNT_KEY = "aa_it_fail_count";
const LOCKOUT_UNTIL_KEY = "aa_it_lockout_until";
const ACCESS_SETTINGS_PATH = "it_system_settings/access";
const ACCESS_ITERATIONS = 1000000;

let currentAccessSalt = null;
let currentAccessHash = null;
let currentAccessIterations = ACCESS_ITERATIONS;
let accessState = 'unknown';

firebase.initializeApp(firebaseConfig);
const database = firebase.database();

let dashWarehouseChartInstance = null;
let dashStatusChartInstance = null;
let employeesDb = [];
let wDb = [];
let rustdeskDb = [];
let switchesDb = [];
let helpdeskDb = [];
let ipamDb = [];
let snippetsDb = [];
let plannedTasks = [];
let dailyTasks = [];
let notesDb = [];
let currentEditPlannedIdx = -1;
let currentEditDailyIdx = -1;

/* ================= HELPER FOR CENTER POPUP MODALS ================= */
function showModalCentered(modalId) {
    const m = document.getElementById(modalId);
    if(!m) return;
    m.classList.remove('hidden');
    m.classList.add('flex');
}

/* ================= MODAL LOGICS ================= */
function openEmpModal() {
    showModalCentered('emp-modal');
}
function closeEmpModal() {
    const m = document.getElementById('emp-modal');
    m.classList.add('hidden'); m.classList.remove('flex');
    clearEmployeeForm();
}

function openWarehouseModal() {
    showModalCentered('warehouse-modal');
    generateAutoAssetTag();
}
function closeWarehouseModal() {
    const m = document.getElementById('warehouse-modal');
    m.classList.add('hidden'); m.classList.remove('flex');
    clearWarehouseForm();
}

function openRustDeskModal() {
    showModalCentered('rustdesk-modal');
}
function closeRustDeskModal() {
    const m = document.getElementById('rustdesk-modal');
    m.classList.add('hidden'); m.classList.remove('flex');
    clearRustDeskForm();
}

function openIspModal() {
    showModalCentered('isp-modal');
}
function closeIspModal() {
    const m = document.getElementById('isp-modal');
    m.classList.add('hidden'); m.classList.remove('flex');
    clearIspForm();
}

function openHelpdeskModal() {
    showModalCentered('helpdesk-modal');
}
function closeHelpdeskModal() {
    const m = document.getElementById('helpdesk-modal');
    m.classList.add('hidden'); m.classList.remove('flex');
    clearHelpdeskForm();
}

function openIpamModal() {
    showModalCentered('ipam-modal');
}
function closeIpamModal() {
    const m = document.getElementById('ipam-modal');
    m.classList.add('hidden'); m.classList.remove('flex');
    clearIpamForm();
}

function openSnippetModal() {
    showModalCentered('snippet-modal');
}
function closeSnippetModal() {
    const m = document.getElementById('snippet-modal');
    m.classList.add('hidden'); m.classList.remove('flex');
    clearSnippetForm();
}

function openNoteModal() {
    showModalCentered('notes-modal');
}
function closeNoteModal() {
    const m = document.getElementById('notes-modal');
    m.classList.add('hidden'); m.classList.remove('flex');
    clearNoteForm();
}

function openScheduleModal() {
    showModalCentered('schedule-modal');
    initDefaultDates();
}
function closeScheduleModal() {
    const modal = document.getElementById('schedule-modal');
    if(!modal) return;
    modal.classList.remove('flex');
    modal.classList.add('hidden');
}

/* ================= HANDOVER FORM LOGIC (MULTI-ITEM & CENTERED) ================= */
function openHandoverModal(id) {
    const item = wDb.find(i => i.id === id);
    if (!item) return;

    // دۆزینەوە و داڕشتنی بەرواری ئەمڕۆ بە شێوازی (Y-M-D) یان (D/M/Y)
const now = new Date();
const formattedDate = String(now.getDate()).padStart(2, '0') + '/' + 
                      String(now.getMonth() + 1).padStart(2, '0') + '/' + 
                      now.getFullYear();
document.getElementById('ho-doc-date').innerText = formattedDate;
    
    document.getElementById('ho-emp-name').innerText = item.empName || 'N/A';
    document.getElementById('ho-emp-id').innerText = item.empId || 'N/A';
    document.getElementById('ho-emp-pos').innerText = item.empPosition || 'N/A';
    document.getElementById('ho-emp-dept').innerText = item.empDepartment || 'N/A';
    document.getElementById('ho-sign-name').innerText = item.empName || 'Employee';

    let empAssets = [];
    if (item.empId && item.empId.trim() !== '') {
        empAssets = wDb.filter(a => a.empId && a.empId.trim() === item.empId.trim());
    } else if (item.empName && item.empName.trim() !== '') {
        empAssets = wDb.filter(a => a.empName && a.empName.trim().toLowerCase() === item.empName.trim().toLowerCase());
    } else {
        empAssets = [item];
    }

    const tbody = document.querySelector('#handover-print-area table tbody');
    if (tbody) {
        tbody.innerHTML = '';
        empAssets.forEach(asset => {
            const tr = document.createElement('tr');
            tr.className = "border-b border-slate-200";
            tr.innerHTML = `
                <td class="p-2.5 font-mono font-bold text-cyan-800">${asset.assetTag || 'N/A'}</td>
                <td class="p-2.5 font-semibold">${asset.category || 'N/A'}</td>
                <td class="p-2.5">${asset.desc || 'N/A'}</td>
                <td class="p-2.5 font-mono">${asset.serial || 'N/A'}</td>
                <td class="p-2.5 font-bold">${asset.quantity || '1'}</td>
                <td class="p-2.5 font-mono text-cyan-800">${asset.handoverDate || 'N/A'}</td>
                <td class="p-2.5 font-mono text-slate-700">${asset.returnDate || 'Permanent'}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    const allDetails = empAssets
        .map(a => a.details ? `• [${a.assetTag}]: ${a.details}` : null)
        .filter(Boolean)
        .join('<br>');

    const detailsEl = document.getElementById('ho-asset-details');
    if (detailsEl) detailsEl.innerHTML = allDetails || 'No additional notes provided.';

    showModalCentered('handover-modal');
}

function closeHandoverModal() {
    const modal = document.getElementById('handover-modal');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

/* ================= ACCESS LOCK SCREEN ================= */
function bytesToHex(bytes) {
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}
function hexToBytes(hex) {
    const arr = new Uint8Array(hex.length / 2);
    for (let i = 0; i < arr.length; i++) arr[i] = parseInt(hex.substr(i * 2, 2), 16);
    return arr;
}
function randomSaltHex(len = 16) {
    return bytesToHex(crypto.getRandomValues(new Uint8Array(len)));
}
async function pbkdf2Hash(passcode, saltHex, iterations) {
    const keyMaterial = await crypto.subtle.importKey('raw', new TextEncoder().encode(passcode), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits(
        { name: 'PBKDF2', salt: hexToBytes(saltHex), iterations, hash: 'SHA-256' },
        keyMaterial, 256
    );
    return bytesToHex(new Uint8Array(bits));
}
async function loadAccessSettings() {
    try {
        const snap = await database.ref(ACCESS_SETTINGS_PATH).once('value');
        const val = snap.val();
        if (val && val.hash && val.salt) {
            currentAccessSalt = val.salt;
            currentAccessHash = val.hash;
            currentAccessIterations = val.iterations || ACCESS_ITERATIONS;
            accessState = 'configured';
        } else {
            accessState = 'unconfigured';
        }
    } catch (e) {
        accessState = 'unconfigured';
    }
}
function lockoutSecondsFor(count) {
    if (count >= 10) return 3600;
    if (count >= 7) return 600;
    if (count >= 5) return 60;
    if (count >= 3) return 10;
    return 0;
}
function clearFailedAttempts() {
    try { sessionStorage.removeItem(FAIL_COUNT_KEY); sessionStorage.removeItem(LOCKOUT_UNTIL_KEY); } catch (e) {}
}
function registerFailedAttempt() {
    let count = 0;
    try { count = parseInt(sessionStorage.getItem(FAIL_COUNT_KEY) || '0', 10) + 1; sessionStorage.setItem(FAIL_COUNT_KEY, String(count)); } catch (e) {}
    const wait = lockoutSecondsFor(count);
    if (wait > 0) {
        const until = Date.now() + wait * 1000;
        try { sessionStorage.setItem(LOCKOUT_UNTIL_KEY, String(until)); } catch (e) {}
        startLockoutCountdown(wait);
    }
}
function startLockoutCountdown(seconds) {
    const btn = document.querySelector('#lock-form button[type="submit"]');
    const input = document.getElementById('lock-pin-input');
    const errorMsg = document.getElementById('lock-error');
    if (!btn || !input || !errorMsg) return;
    let remaining = Math.ceil(seconds);
    input.setAttribute('disabled', 'true'); btn.setAttribute('disabled', 'true'); btn.classList.add('opacity-40', 'cursor-not-allowed');
    errorMsg.classList.remove('hidden');
    const tick = () => {
        errorMsg.innerHTML = `<i class="fa-solid fa-hourglass-half mr-1"></i> Too many attempts. Try again in ${remaining}s.`;
        if (remaining <= 0) {
            clearInterval(timer);
            input.removeAttribute('disabled'); btn.removeAttribute('disabled'); btn.classList.remove('opacity-40', 'cursor-not-allowed');
            errorMsg.classList.add('hidden');
            input.focus();
            return;
        }
        remaining--;
    };
    tick();
    const timer = setInterval(tick, 1000);
}
function resumeLockoutIfActive() {
    let until = 0;
    try { until = parseInt(sessionStorage.getItem(LOCKOUT_UNTIL_KEY) || '0', 10); } catch (e) {}
    if (Date.now() < until) startLockoutCountdown((until - Date.now()) / 1000);
}
function initDefaultDates() {
    const today = new Date();
    if(document.getElementById('wr-date')) document.getElementById('wr-date').valueAsDate = today;
    if(document.getElementById('plan-task-date')) document.getElementById('plan-task-date').valueAsDate = today;
    if(document.getElementById('daily-task-date')) document.getElementById('daily-task-date').valueAsDate = today;
}
function attachDataListeners() {
    database.ref('it_employees_directory').on('value', (s) => {
        employeesDb = s.val() ? Object.values(s.val()) : [];
        const el = document.getElementById('dash-total-employees');
        if(el) el.innerText = employeesDb.length;
        renderEmployeesList();
        populateWarehouseEmployeeDropdown();
    });
    database.ref('it_warehouse_inventory').on('value', (s) => {
        wDb = s.val() ? Object.values(s.val()) : [];
        const el = document.getElementById('dash-total-warehouse');
        if(el) el.innerText = wDb.length;
        renderWarehouseList();
        updateDashboardCharts();
    });
    database.ref('it_rustdesk_devices').on('value', (s) => {
        rustdeskDb = s.val() ? Object.values(s.val()) : [];
        const el = document.getElementById('dash-total-rustdesk');
        if(el) el.innerText = rustdeskDb.length;
        renderRustDeskList();
    });
    database.ref('it_switches').on('value', (s) => {
        switchesDb = s.val() ? Object.values(s.val()) : [];
        renderIspList();
    });
   database.ref('it_helpdesk_tickets').on('value', (s) => {
        helpdeskDb = s.val() ? Object.values(s.val()) : [];
        
        const openCount = helpdeskDb.filter(t => t.status === 'Open' || t.status === 'In Progress').length;
        const resolvedCount = helpdeskDb.filter(t => t.status === 'Resolved').length;
        const openCard = document.getElementById('dash-open-tickets') || document.getElementById('dash-total-tickets');
        const resolvedCard = document.getElementById('dash-resolved-tickets');

        if(openCard) {
            openCard.innerText = openCount;
        }
        if(resolvedCard) {
            resolvedCard.innerText = resolvedCount;
        }
        
        renderHelpdeskList();
    });
    database.ref('it_ipam_subnets').on('value', (s) => {
        ipamDb = s.val() ? Object.values(s.val()) : [];
        renderIpamList();
    });
    database.ref('it_weekly_plans').on('value', (s) => {
        const data = s.val();
        if(data) {
            plannedTasks = data.plannedTasks || [];
            plannedTasks.sort((a, b) => new Date(a.taskDate) - new Date(b.taskDate));
            dailyTasks = data.dailyTasks || [];
            dailyTasks.sort((a, b) => new Date(a.taskDate) - new Date(b.taskDate));
            if(document.getElementById('wr-date') && data.date) document.getElementById('wr-date').value = data.date;
            if(document.getElementById('wr-author') && data.author) document.getElementById('wr-author').value = data.author;
        }
        renderPlannedTasksTable();
        renderDailyTasksTable();
    });
    database.ref('it_knowledge_notes').on('value', (s) => {
        notesDb = s.val() ? Object.values(s.val()) : [];
        renderNotesList();
    });
    database.ref('it_command_snippets').on('value', (s) => {
        snippetsDb = s.val() ? Object.values(s.val()) : [];
        if (snippetsDb.length === 0) {
            initDefaultSnippetsToFirebase();
        } else {
            renderCommandSnippets();
        }
    });
}

function unlockApp() {
    const lockScreen = document.getElementById('lock-screen');
    const appRoot = document.getElementById('app-root');
    if(lockScreen) lockScreen.remove();
    if(appRoot) {
        appRoot.classList.remove('hidden');
        appRoot.classList.add('flex');
    }
    initDefaultDates();
    attachDataListeners();
    updateAccessUIState();
}

function updateAccessUIState() {
    const banner = document.getElementById('setup-warning-banner');
    const navBtn = document.getElementById('passcode-nav-btn');
    const navBtnText = document.getElementById('passcode-nav-btn-text');
    if(!banner || !navBtn) return;
    if(accessState === 'unconfigured') {
        banner.classList.remove('hidden');
        banner.classList.add('flex');
        navBtn.classList.remove('bg-slate-700', 'hover:bg-slate-600');
        navBtn.classList.add('bg-amber-500', 'text-slate-900', 'hover:bg-amber-400');
        navBtnText.innerText = 'Set Passcode';
    } else {
        banner.classList.add('hidden');
        banner.classList.remove('flex');
        navBtn.classList.add('bg-slate-700', 'hover:bg-slate-600');
        navBtn.classList.remove('bg-amber-500', 'text-slate-900', 'hover:bg-amber-400');
        navBtnText.innerText = 'Passcode';
    }
}

function lockApp() {
    try { sessionStorage.removeItem(LOCK_SESSION_KEY); } catch(e) {}
    location.reload();
}

async function handleUnlockSubmit(evt) {
    evt.preventDefault();
    let lockedOut = false;
    try { lockedOut = Date.now() < parseInt(sessionStorage.getItem(LOCKOUT_UNTIL_KEY) || '0', 10); } catch(e) {}
    if(lockedOut) return false;
    const input = document.getElementById('lock-pin-input');
    const errorMsg = document.getElementById('lock-error');
    const val = input.value.trim();
    if(!val) return false;
    const enteredHash = await pbkdf2Hash(val, currentAccessSalt, currentAccessIterations);
    if(enteredHash === currentAccessHash) {
        clearFailedAttempts();
        try { sessionStorage.setItem(LOCK_SESSION_KEY, '1'); } catch(e) {}
        errorMsg.classList.add('hidden');
        unlockApp();
    } else {
        errorMsg.innerHTML = `<i class="fa-solid fa-triangle-exclamation mr-1"></i> Incorrect passcode. Try again.`;
        errorMsg.classList.remove('hidden');
        input.value = '';
        input.focus();
        const card = document.querySelector('#lock-screen .card-3d-effect');
        if(card) { card.classList.remove('shake'); void card.offsetWidth; card.classList.add('shake'); }
        registerFailedAttempt();
    }
    return false;
}

async function initApp() {
    const lockForm = document.getElementById('lock-form');
    if(!lockForm) return;
    const submitBtn = lockForm.querySelector('button[type="submit"]');
    const pinInput = document.getElementById('lock-pin-input');
    await loadAccessSettings();
    if(accessState === 'unconfigured') {
        unlockApp();
        return;
    }
    let alreadyUnlocked = false;
    try { alreadyUnlocked = sessionStorage.getItem(LOCK_SESSION_KEY) === '1'; } catch(e) {}
    if(alreadyUnlocked) { unlockApp(); return; }
    if(submitBtn) {
        submitBtn.removeAttribute('disabled');
        submitBtn.classList.remove('opacity-40', 'cursor-not-allowed');
    }
    if(pinInput) {
        pinInput.removeAttribute('disabled');
        pinInput.focus();
    }
    lockForm.addEventListener('submit', handleUnlockSubmit);
    resumeLockoutIfActive();
}

/* ================= CHANGE / SET PASSCODE ================= */
function openChangePasscodeModal() {
    const isSetMode = accessState === 'unconfigured';
    if(document.getElementById('cp-current')) document.getElementById('cp-current').value = '';
    if(document.getElementById('cp-new')) document.getElementById('cp-new').value = '';
    if(document.getElementById('cp-confirm')) document.getElementById('cp-confirm').value = '';
    if(document.getElementById('cp-error')) document.getElementById('cp-error').classList.add('hidden');
    if(document.getElementById('cp-modal-title')) {
        document.getElementById('cp-modal-title').innerHTML = isSetMode
            ? `<i class="fa-solid fa-key text-amber-500"></i> Set Access Passcode`
            : `<i class="fa-solid fa-key text-red-500"></i> Change Access Passcode`;
    }
    if(document.getElementById('cp-modal-subtitle')) document.getElementById('cp-modal-subtitle').classList.toggle('hidden', !isSetMode);
    if(document.getElementById('cp-current-wrap')) document.getElementById('cp-current-wrap').classList.toggle('hidden', isSetMode);
    if(document.getElementById('cp-submit-text')) document.getElementById('cp-submit-text').innerText = isSetMode ? 'Save Passcode' : 'Save New Passcode';
    showModalCentered('change-pin-modal');
    const focusInput = document.getElementById(isSetMode ? 'cp-new' : 'cp-current');
    if(focusInput) focusInput.focus();
}

function closeChangePasscodeModal() {
    const modal = document.getElementById('change-pin-modal');
    modal.classList.add('hidden'); modal.classList.remove('flex');
}

async function handleChangePasscodeSubmit(evt) {
    evt.preventDefault();
    const isSetMode = accessState === 'unconfigured';
    const current = document.getElementById('cp-current')?.value || '';
    const next = document.getElementById('cp-new')?.value || '';
    const confirmVal = document.getElementById('cp-confirm')?.value || '';
    const errorMsg = document.getElementById('cp-error');
    const showErr = (msg) => { if(errorMsg) { errorMsg.innerText = msg; errorMsg.classList.remove('hidden'); } };
    if(errorMsg) errorMsg.classList.add('hidden');
    if(!isSetMode && !current) { showErr("Please enter your current passcode."); return false; }
    if(!next || !confirmVal) { showErr("Please fill in all fields."); return false; }
    if(next.length < 6) { showErr("New passcode must be at least 6 characters."); return false; }
    if(next !== confirmVal) { showErr("New passcode and confirmation do not match."); return false; }
    if(!isSetMode) {
        if(current === next) { showErr("New passcode must be different from the current one."); return false; }
        const currentHash = await pbkdf2Hash(current, currentAccessSalt, currentAccessIterations);
        if(currentHash !== currentAccessHash) { showErr("Current passcode is incorrect."); return false; }
    }
    const newSalt = randomSaltHex(16);
    const newIterations = ACCESS_ITERATIONS;
    const newHash = await pbkdf2Hash(next, newSalt, newIterations);
    try {
        await database.ref(ACCESS_SETTINGS_PATH).set({
            salt: newSalt, hash: newHash, iterations: newIterations, updatedAt: new Date().toISOString()
        });
        currentAccessSalt = newSalt;
        currentAccessHash = newHash;
        currentAccessIterations = newIterations;
        accessState = 'configured';
        try { sessionStorage.setItem(LOCK_SESSION_KEY, '1'); } catch(e) {}
        updateAccessUIState();
        closeChangePasscodeModal();
        showToast(isSetMode ? "Passcode set! System secured." : "Passcode updated successfully!");
    } catch(err) {
        showErr("Failed to save passcode: " + err.message);
    }
    return false;
}

const cpForm = document.getElementById('change-pin-form');
if(cpForm) cpForm.addEventListener('submit', handleChangePasscodeSubmit);
document.addEventListener('DOMContentLoaded', initApp);

function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => {
        el.classList.add('hidden');
        el.classList.remove('block');
    });
    
    const target = document.getElementById(tabId);
    if(target) {
        target.classList.remove('hidden');
        target.classList.add('block');
    }
     
    document.querySelectorAll('.tab-btn').forEach(btn => { 
         btn.className = "tab-btn text-slate-400 hover:text-cyan-300 hover:bg-slate-800/80 px-5 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 whitespace-nowrap transition-all";
    });
     
    const ab = document.getElementById('btn-' + tabId);
    if (ab) {
         ab.className = "tab-btn active-tab bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-lg shadow-cyan-500/30 px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 whitespace-nowrap transition-all transform hover:scale-105 scale-105";
    }
    if (tabId === 'dashboard-tab') updateDashboardCharts();
}

function updateDashboardCharts() {
    const wCounts = { "Laptop": 0, "PC": 0, "Cable": 0, "Printer": 0, "Monitor": 0, "Switch": 0, "Hub": 0, "IP camera": 0, "NVR": 0, "Hard":0, "Ram":0,"Mouse_keyboard":0, "Access point": 0, "Printer cartridge": 0, "Other": 0 };
    wDb.forEach(item => { 
         if(wCounts[item.category] !== undefined) wCounts[item.category] += parseInt(item.quantity || 1); else wCounts["Other"] += parseInt(item.quantity || 1);
    });
    const bgColors = ['#4f46e5','#2563eb','#0891b2','#0d9488','#059669','#65a30d','#d97706','#d97706','#ea580c','#dc2626','#e11d48','#db2777','#7c3aed','#475569','#0284c7'];
    const ctxW = document.getElementById('dashWarehouseChart')?.getContext('2d');
    if(ctxW) {
        if (dashWarehouseChartInstance) dashWarehouseChartInstance.destroy();
        dashWarehouseChartInstance = new Chart(ctxW, {
            type: 'doughnut',
            data: {
                labels: Object.keys(wCounts),
                datasets: [{
                    data: Object.values(wCounts),
                    backgroundColor: bgColors
                }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#94a3b8' } } } }
        });
    }
    const statusCounts = { "In Stock": 0, "In Use": 0, "Under Maintenance": 0, "Damaged": 0 };
    wDb.forEach(doc => {
        if(statusCounts[doc.status] !== undefined) statusCounts[doc.status] += parseInt(doc.quantity || 1);
    });
    const ctxS = document.getElementById('dashStatusChart')?.getContext('2d');
    if(ctxS) {
        if (dashStatusChartInstance) dashStatusChartInstance.destroy();
        dashStatusChartInstance = new Chart(ctxS, {
            type: 'bar',
            data: {
                labels: Object.keys(statusCounts),
                datasets: [{
                    label: 'Devices By Status',
                    data: Object.values(statusCounts),
                    backgroundColor: ['#10b981', '#3b82f6', '#f59e0b', '#ef4444'],
                    borderRadius: 8
                }]
            },
            options: { 
                 responsive: true, 
                 maintainAspectRatio: false,
                 scales: { 
                     y: { beginAtZero: true, ticks: { color: '#94a3b8', stepSize: 1 }, grid: { color: 'rgba(255,255,255,0.05)' } },
                     x: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.05)' } }
                 },
                 plugins: { legend: { labels: { color: '#94a3b8' } } }
            }
        });
    }
}

/* ================= AUTO ASSET TAG GENERATOR ================= */
const categoryPrefixes = {
    "Laptop": "LAP", "PC": "PC", "Mouse": "MSE", "Keyboard": "KBD", 
    "Cable": "CBL", "Printer": "PRN", "Monitor": "MON", "Switch": "SW", 
    "Hub": "HUB", "IP camera": "CAM", "NVR": "NVR", "Access point": "AP", 
    "Hard": "HDD", "Ram": "RAM", "Mouse_Keyboard": "MKD", "Printer cartridge": "CRT", "Other": "OTH"
};
function generateAutoAssetTag() {
    try {
        const catSelect = document.getElementById('w-category');
        const tagInput = document.getElementById('w-asset-tag');
        if(!catSelect || !tagInput) return;
        const editId = document.getElementById('w-edit-id')?.value;
        if(editId) return;
        const cat = catSelect.value;
        const prefix = categoryPrefixes[cat] || "OTH";
        let maxNum = 0;
        if (typeof wDb !== 'undefined' && Array.isArray(wDb)) {
            wDb.forEach(item => {
                if(item && item.assetTag && item.assetTag.startsWith(`AA-${prefix}-`)) {
                    const parts = item.assetTag.split('-');
                    const num = parseInt(parts[parts.length - 1], 10);
                    if(!isNaN(num) && num > maxNum) maxNum = num;
                }
            });
        }
        const nextNum = String(maxNum + 1).padStart(3, '0');
        tagInput.value = `AA-${prefix}-${nextNum}`;
    } catch(err) { console.log("Tag generation notice:", err); }
}

/* ================= EMPLOYEES DIRECTORY LOGIC ================= */
function saveEmployeeEntry() {
    const editId = document.getElementById('emp-edit-id')?.value || '';
    const empId = document.getElementById('emp-code-id')?.value.trim() || '';
    const fullName = document.getElementById('emp-fullname')?.value.trim() || '';
    const position = document.getElementById('emp-position')?.value.trim() || '';
    const department = document.getElementById('emp-department')?.value.trim() || '';
    const section = document.getElementById('emp-section')?.value.trim() || '';
    const phone = document.getElementById('emp-phone')?.value.trim() || '';
    const status = document.getElementById('emp-status')?.value || 'Active';
    const startDate = document.getElementById('emp-start-date')?.value || '';
    const endDate = document.getElementById('emp-end-date')?.value || '';
    if(!empId || !fullName) { alert("Please enter Employee ID and Full Name!"); return; }
    const key = editId ? editId : "EMP-" + Date.now();
    const payload = { id: key, empId, fullName, position, department, section, phone, status, startDate, endDate, updated: new Date().toLocaleDateString('en-GB') };
    database.ref('it_employees_directory/' + key).set(payload).then(() => {
        closeEmpModal();
        showToast(editId ? "Employee Updated Successfully!" : "Employee Registered Successfully!");
    });
}
function renderEmployeesList() {
    const tbody = document.getElementById('employees-list-body'); if(!tbody) return;
    const searchInput = document.getElementById('employee-search');
    const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : "";
    tbody.innerHTML = "";
    const filtered = employeesDb.filter(emp => {
        const id = (emp.empId || "").toLowerCase();
        const name = (emp.fullName || "").toLowerCase();
        const pos = (emp.position || "").toLowerCase();
        const dept = (emp.department || "").toLowerCase();
        const sec = (emp.section || "").toLowerCase();
        const ph = (emp.phone || "").toLowerCase();
        return id.includes(searchTerm) || name.includes(searchTerm) || pos.includes(searchTerm) || dept.includes(searchTerm) || sec.includes(searchTerm) || ph.includes(searchTerm);
    });
    const countEl = document.getElementById('employee-count');
    if(countEl) countEl.innerText = `${filtered.length} of ${employeesDb.length} Employees`;
    if(filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="text-center p-6 text-slate-500">No matching employees found.</td></tr>`;
        return;
    }
    filtered.forEach((emp, idx) => {
        const tr = document.createElement('tr');
        tr.className = "border-b border-slate-800 text-xs hover:bg-slate-800/40";
        const statBadge = emp.status === 'Left' ? `<span class="text-[10px] text-red-400 font-bold bg-red-500/20 px-2 py-0.5 rounded ml-2">Left</span>` : `<span class="text-[10px] text-emerald-400 font-bold bg-emerald-500/20 px-2 py-0.5 rounded ml-2">Active</span>`;
        tr.innerHTML = `
            <td class="p-3 font-mono text-slate-400">${idx + 1}</td>
            <td class="p-3 font-mono font-bold text-red-400">${emp.empId}</td>
            <td class="p-3 font-bold text-white flex items-center">${emp.fullName} ${statBadge}</td>
            <td class="p-3 text-slate-300">${emp.position || '-'}</td>
            <td class="p-3 text-slate-300">${emp.department || '-'}</td>
            <td class="p-3 font-mono text-amber-400">${emp.phone || '-'}</td>
            <td class="p-3 text-[10px] text-slate-400">
                ${emp.startDate ? `<span class="block text-emerald-400">Start: ${emp.startDate}</span>` : ''}
                ${emp.endDate ? `<span class="block text-red-400">Left: ${emp.endDate}</span>` : ''}
                ${!emp.startDate && !emp.endDate ? '-' : ''}
            </td>
            <td class="p-3 text-center">
                <div class="flex justify-center gap-2">
                    <button onclick="editEmployeeItem('${emp.id}')" class="text-blue-400 hover:text-blue-300"><i class="fa-solid fa-pen-to-square"></i></button>
                    <button onclick="deleteEmployeeItem('${emp.id}')" class="text-slate-500 hover:text-red-400"><i class="fa-solid fa-trash"></i></button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}
function editEmployeeItem(id) {
    const item = employeesDb.find(e => e.id === id); if(!item) return;
    document.getElementById('emp-edit-id').value = item.id;
    document.getElementById('emp-code-id').value = item.empId || '';
    document.getElementById('emp-fullname').value = item.fullName || '';
    document.getElementById('emp-position').value = item.position || '';
    document.getElementById('emp-department').value = item.department || '';
    document.getElementById('emp-section').value = item.section || '';
    document.getElementById('emp-phone').value = item.phone || '';
    document.getElementById('emp-status').value = item.status || 'Active';
    document.getElementById('emp-start-date').value = item.startDate || '';
    document.getElementById('emp-end-date').value = item.endDate || '';
    document.getElementById('emp-form-title').innerHTML = `<i class="fa-solid fa-user-pen text-lg"></i> Edit Employee`;
    openEmpModal();
}
function clearEmployeeForm() {
    document.getElementById('emp-edit-id').value = '';
    document.getElementById('emp-code-id').value = '';
    document.getElementById('emp-fullname').value = '';
    document.getElementById('emp-position').value = '';
    document.getElementById('emp-department').value = '';
    document.getElementById('emp-section').value = '';
    document.getElementById('emp-phone').value = '';
    document.getElementById('emp-status').value = 'Active';
    document.getElementById('emp-start-date').value = '';
    document.getElementById('emp-end-date').value = '';
    document.getElementById('emp-form-title').innerHTML = `<i class="fa-solid fa-user-pen text-lg"></i> Register / Edit Employee`;
}
function deleteEmployeeItem(id) {
    if(!confirmDelete("Delete this employee from directory?")) return;
    database.ref('it_employees_directory/' + id).remove().then(() => showToast("Employee Deleted"));
}

/* ================= WAREHOUSE LOGIC ================= */
function populateWarehouseEmployeeDropdown() {
    const select = document.getElementById('w-emp-select'); if(!select) return;
    const searchInput = document.getElementById('w-emp-search');
    const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : "";
    const currentVal = select.value;
    select.innerHTML = `<option value="">-- Choose Employee (Auto-fill) --</option>`;
    employeesDb.forEach(emp => {
        const text = `${emp.fullName} (${emp.department || 'General'})`;
        if (text.toLowerCase().includes(searchTerm)) {
            const opt = document.createElement('option');
            opt.value = emp.id; opt.textContent = text;
            select.appendChild(opt);
        }
    });
    select.value = currentVal;
}
function onWarehouseEmployeeSelected() {
    const select = document.getElementById('w-emp-select'); if(!select) return;
    const empIdVal = select.value;
    if(!empIdVal) {
        document.getElementById('w-emp-name').value = '';
        document.getElementById('w-emp-id').value = '';
        document.getElementById('w-emp-position').value = '';
        document.getElementById('w-emp-department').value = '';
        return;
    }
    const emp = employeesDb.find(e => e.id === empIdVal);
    if(emp) {
        document.getElementById('w-emp-name').value = emp.fullName || '';
        document.getElementById('w-emp-id').value = emp.empId || '';
        document.getElementById('w-emp-position').value = emp.position || '';
        document.getElementById('w-emp-department').value = emp.department || '';
        if(emp.section && document.getElementById('w-location')) {
            document.getElementById('w-location').value = emp.section;
        }
    }
}
function toggleIpField() {
    const cat = document.getElementById('w-category')?.value || '';
    const ipContainer = document.getElementById('w-ip-container');
    if(!ipContainer) return;
    if(cat === 'IP camera' || cat === 'NVR' || cat === 'Switch' || cat === 'Access point' || cat === 'PC') {
        ipContainer.classList.remove('hidden');
    } else {
        ipContainer.classList.add('hidden');
    }
    generateAutoAssetTag();
}
function toggleIpamPasswordVisibility() {
    const input = document.getElementById('ipam-password');
    const icon = document.getElementById('ipam-eye-icon');
    if (!input || !icon) return;
    if (input.type === 'password') {
        input.type = 'text';
        icon.classList.remove('fa-eye');
        icon.classList.add('fa-eye-slash');
    } else {
        input.type = 'password';
        icon.classList.remove('fa-eye-slash');
        icon.classList.add('fa-eye');
    }
}
function logItemToWarehouse() {
    const editId = document.getElementById('w-edit-id')?.value || '';
    const assetTag = document.getElementById('w-asset-tag')?.value.trim() || '';
    const category = document.getElementById('w-category')?.value || 'Laptop';
    const ipAddress = document.getElementById('w-ip-address')?.value.trim() || '';
    const desc = document.getElementById('w-desc')?.value.trim() || '';
    const serial = document.getElementById('w-serial')?.value.trim() || '';
    const quantity = document.getElementById('w-quantity')?.value || "1";
    const details = document.getElementById('w-details')?.value.trim() || '';
    const empName = document.getElementById('w-emp-name')?.value.trim() || '';
    const empId = document.getElementById('w-emp-id')?.value.trim() || '';
    const empPosition = document.getElementById('w-emp-position')?.value.trim() || '';
    const empDepartment = document.getElementById('w-emp-department')?.value.trim() || '';
    const location = document.getElementById('w-location')?.value.trim() || '';
    const handoverDate = document.getElementById('w-handover-date')?.value || '';
    const returnDate = document.getElementById('w-return-date')?.value || '';
    const status = document.getElementById('w-status')?.value || 'In Stock';
    
    if(!assetTag || !desc) { alert("Please fill Tag and Description!"); return; }
    
    const key = editId ? editId : "W-" + Date.now();
    const payload = { id: key, assetTag, category, ipAddress, desc, details, serial, quantity, empName, empId, empPosition, empDepartment, location, handoverDate, returnDate, status, updated: new Date().toLocaleDateString('en-GB') };
    
    database.ref('it_warehouse_inventory/' + key).set(payload).then(() => {
        closeWarehouseModal();
        switchTab('warehouse-tab'); 
        showToast(editId ? "Warehouse Item Updated!" : "Asset Added to Warehouse!");
    });
}

function renderWarehouseList() {
    const tbody = document.getElementById('warehouse-list-body'); if(!tbody) return;
    const searchInput = document.getElementById('warehouse-search');
    const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : "";
    tbody.innerHTML = "";
    const filtered = wDb.filter(item => {
        const tag = (item.assetTag || "").toLowerCase();
        const emp = (item.empName || "").toLowerCase();
        const desc = (item.desc || "").toLowerCase();
        const cat = (item.category || "").toLowerCase();
        const serial = (item.serial || "").toLowerCase();
        const loc = (item.location || "").toLowerCase();
        const dept = (item.empDepartment || "").toLowerCase();
        const ip = (item.ipAddress || "").toLowerCase();
        const detailsStr = (item.details || "").toLowerCase();
        return tag.includes(searchTerm) || emp.includes(searchTerm) || desc.includes(searchTerm) || cat.includes(searchTerm) || serial.includes(searchTerm) || loc.includes(searchTerm) || dept.includes(searchTerm) || ip.includes(searchTerm) || detailsStr.includes(searchTerm);
    });
    const stockCountEl = document.getElementById('stock-count');
    if(stockCountEl) stockCountEl.innerText = `${filtered.length} of ${wDb.length} Logs`;
    if(filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center p-6 text-slate-500">No matching items found.</td></tr>`;
        return;
    }
    filtered.forEach(item => {
        const tr = document.createElement('tr');
        tr.className = "border-b border-slate-800 text-xs hover:bg-slate-800/40";
        let badgeClass = "bg-slate-500/20 text-slate-400 border-slate-500/30";
        if(item.status === "In Stock") badgeClass = "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
        else if(item.status === "In Use") badgeClass = "bg-blue-500/20 text-blue-400 border-blue-500/30";
        else if(item.status === "Under Maintenance") badgeClass = "bg-amber-500/20 text-amber-400 border-amber-500/30";
        else if(item.status === "Damaged") badgeClass = "bg-red-500/20 text-red-400 border-red-500/30";
        const ipText = item.ipAddress ? `<span class="text-blue-400 text-[10px] block font-mono mt-1"><i class="fa-solid fa-network-wired"></i> IP: ${item.ipAddress}</span>` : '';
        const detailsText = item.details ? `<span class="text-amber-400/90 text-[10px] block mt-1 leading-relaxed"><i class="fa-solid fa-circle-info"></i> ${item.details}</span>` : '';
        tr.innerHTML = `
            <td class="p-3 font-mono font-bold text-red-400">${item.assetTag}</td>
            <td class="p-3">
                <span class="font-bold text-white block">${item.category} <span class="text-xs bg-slate-700 px-1.5 py-0.5 rounded text-amber-400 ml-1">Qty: ${item.quantity || 1}</span></span>
                <span class="text-slate-400 text-[10px] block mt-1">${item.desc} (S/N: ${item.serial || 'N/A'})</span>
                ${detailsText}
                ${ipText}
            </td>
            <td class="p-3">
                <span class="font-bold text-white block"><i class="fa-solid fa-user text-slate-400 mr-1"></i> ${item.empName || 'Unassigned'}</span>
                <span class="text-slate-400 text-[10px]"><i class="fa-solid fa-building mr-1"></i> ${item.empDepartment || '-'} | ${item.location || 'Warehouse'}</span>
            </td>
            <td class="p-3 text-[10px] text-slate-300">
                ${item.handoverDate ? `<span class="block text-amber-400">Out: ${item.handoverDate}</span>` : ''}
                ${item.returnDate ? `<span class="block text-emerald-400">In: ${item.returnDate}</span>` : ''}
                ${!item.handoverDate && !item.returnDate ? '-' : ''}
            </td>
            <td class="p-3 text-center"><span class="px-2.5 py-1 rounded-full text-[10px] font-bold border ${badgeClass}">${item.status}</span></td>
            <td class="p-3 text-center">
                <div class="flex justify-center gap-2">
                    <button onclick="openHandoverModal('${item.id}')" title="Print Handover Form" class="text-emerald-400 hover:text-emerald-300"><i class="fa-solid fa-file-contract"></i></button>
                    <button onclick="editWarehouseItem('${item.id}')" title="Edit Item" class="text-blue-400 hover:text-blue-300"><i class="fa-solid fa-pen-to-square"></i></button>
                    <button onclick="deleteWarehouseItem('${item.id}')" title="Delete Item" class="text-slate-500 hover:text-red-400"><i class="fa-solid fa-trash"></i></button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}
function editWarehouseItem(id) {
    const item = wDb.find(i => i.id === id); if(!item) return;
    document.getElementById('w-edit-id').value = item.id;
    document.getElementById('w-asset-tag').value = item.assetTag || '';
    document.getElementById('w-category').value = item.category || 'Laptop';
    document.getElementById('w-ip-address').value = item.ipAddress || '';
    document.getElementById('w-desc').value = item.desc || '';
    document.getElementById('w-details').value = item.details || '';
    document.getElementById('w-serial').value = item.serial || '';
    document.getElementById('w-quantity').value = item.quantity || '1';
    document.getElementById('w-emp-name').value = item.empName || '';
    document.getElementById('w-emp-id').value = item.empId || '';
    document.getElementById('w-emp-position').value = item.empPosition || '';
    document.getElementById('w-emp-department').value = item.empDepartment || '';
    document.getElementById('w-location').value = item.location || '';
    document.getElementById('w-handover-date').value = item.handoverDate || '';
    document.getElementById('w-return-date').value = item.returnDate || '';
    document.getElementById('w-status').value = item.status || 'In Stock';
    document.getElementById('w-form-title').innerHTML = `<i class="fa-solid fa-pen text-lg"></i> Edit Stock Item`;
    toggleIpField();
    openWarehouseModal();
}
function clearWarehouseForm() {
    document.getElementById('w-edit-id').value = '';
    document.getElementById('w-asset-tag').value = '';
    document.getElementById('w-ip-address').value = '';
    document.getElementById('w-desc').value = '';
    document.getElementById('w-details').value = '';
    document.getElementById('w-serial').value = '';
    document.getElementById('w-quantity').value = '1';
    document.getElementById('w-emp-name').value = '';
    document.getElementById('w-emp-id').value = '';
    document.getElementById('w-emp-position').value = '';
    document.getElementById('w-emp-department').value = '';
    document.getElementById('w-location').value = '';
    document.getElementById('w-handover-date').value = '';
    document.getElementById('w-return-date').value = '';
    document.getElementById('w-status').value = 'In Stock';
    document.getElementById('w-emp-search').value = '';
    document.getElementById('w-emp-select').value = '';
    document.getElementById('w-form-title').innerHTML = `<i class="fa-solid fa-barcode text-lg"></i> Store / Edit Asset`;
    toggleIpField();
    generateAutoAssetTag();
}
function deleteWarehouseItem(id) {
    if(!confirmDelete("Delete this warehouse item?")) return;
    database.ref('it_warehouse_inventory/' + id).remove().then(() => showToast("Warehouse Item Deleted"));
}

/* ================= CSV BULK UPLOAD ================= */
function importWarehouseCSV(event) {
    const file = event.target.files[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.csv')) { alert("Please upload a valid .csv file."); event.target.value = ""; return; }
    const reader = new FileReader();
    reader.onload = function(e) {
        const text = e.target.result;
        const rows = text.split(/\r?\n/);
        if (rows.length < 2) { alert("The CSV file appears to be empty."); return; }
        let addedCount = 0;
        const updates = {};
        for (let i = 1; i < rows.length; i++) {
            const row = rows[i].trim();
            if (!row) continue;
            const cols = row.split(',');
            if (cols.length >= 6) {
                const modelStr = cols[1].trim();
                const ipStr = cols[2].trim();
                const serialStr = cols[5].trim();
                let cat = "Other";
                const mLower = modelStr.toLowerCase();
                if(mLower.includes('camera') || mLower.includes('cd')) cat = "IP camera";
                else if (mLower.includes('nvr') || mLower.includes('ni')) cat = "NVR";
                else if (mLower.includes('switch')) cat = "Switch";
                else if (mLower.includes('cartridge') || mLower.includes('catridge')) cat = "Printer cartridge";
                const key = "W-CSV-" + Date.now() + "-" + i;
                const payload = { 
                     id: key, 
                     assetTag: "AA-" + Date.now().toString().slice(-4) + "-" + i,
                     category: cat, ipAddress: ipStr, 
                     desc: modelStr + " (Firmware: " + (cols[4] || '') + ")", 
                     details: "", serial: serialStr, quantity: "1",
                     empName: "", empId: "", empPosition: "", empDepartment: "", 
                     location: "Main Warehouse", handoverDate: "", returnDate: "", 
                     status: "In Stock", updated: new Date().toLocaleDateString('en-GB') 
                };
                updates['it_warehouse_inventory/' + key] = payload;
                addedCount++;
            }
        }
        if(addedCount > 0) {
            database.ref().update(updates).then(() => {
                showToast(`Successfully imported ${addedCount} items from CSV!`);
                event.target.value = "";
            }).catch(err => { alert("Failed to upload items: " + err.message); });
        } else { alert("No valid rows found to import."); }
    };
    reader.readAsText(file);
}

/* ================= HELPDESK TICKETS LOGIC ================= */
function saveHelpdeskEntry() {
    const editId = document.getElementById('helpdesk-edit-id')?.value || '';
    const emp = document.getElementById('hd-emp')?.value.trim() || '';
    const title = document.getElementById('hd-title')?.value.trim() || '';
    const status = document.getElementById('hd-status')?.value || 'Open';
    const details = document.getElementById('hd-details')?.value.trim() || '';
    if(!emp || !title) { alert("Please enter Employee and Issue Title!"); return; }
    const key = editId ? editId : "HD-" + Date.now();
    const payload = { id: key, emp, title, status, details, updated: new Date().toLocaleDateString('en-GB') };
    database.ref('it_helpdesk_tickets/' + key).set(payload).then(() => {
        closeHelpdeskModal();
        showToast(editId ? "Ticket Updated!" : "Support Ticket Created!");
    });
}
function renderHelpdeskList() {
    const tbody = document.getElementById('helpdesk-list-body'); if(!tbody) return;
    const s = document.getElementById('helpdesk-search')?.value.toLowerCase() || '';
    tbody.innerHTML = "";
    const filtered = helpdeskDb.filter(t => (t.emp || '').toLowerCase().includes(s) || (t.title || '').toLowerCase().includes(s) || (t.details || '').toLowerCase().includes(s));
    if(filtered.length === 0) { tbody.innerHTML = `<tr><td colspan="6" class="text-center p-6 text-slate-500">No support tickets found.</td></tr>`; return; }
    filtered.forEach(item => {
        let statusBadge = "bg-amber-500/20 text-amber-400 border-amber-500/30";
        if(item.status === 'Resolved') statusBadge = "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
        else if(item.status === 'In Progress') statusBadge = "bg-blue-500/20 text-blue-400 border-blue-500/30";
        const tr = document.createElement('tr'); tr.className = "border-b border-slate-800 text-xs hover:bg-slate-800/40";
        tr.innerHTML = `
            <td class="p-3 font-mono font-bold text-red-400">${item.id.slice(-6)}</td>
            <td class="p-3 font-bold text-white">${item.emp}</td>
            <td class="p-3"><span class="font-bold text-slate-200 block">${item.title}</span><span class="text-[10px] text-slate-400">${item.details || ''}</span></td>
            <td class="p-3 font-mono text-slate-400">${item.updated || '-'}</td>
            <td class="p-3 text-center"><span class="px-2.5 py-1 rounded-full text-[10px] font-bold border ${statusBadge}">${item.status}</span></td>
            <td class="p-3 text-center flex justify-center gap-2">
                <button onclick="editHelpdeskItem('${item.id}')" class="text-blue-400 hover:text-blue-300"><i class="fa-solid fa-pen-to-square"></i></button>
                <button onclick="deleteHelpdeskItem('${item.id}')" class="text-slate-500 hover:text-red-400"><i class="fa-solid fa-trash"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}
function editHelpdeskItem(id) {
    const item = helpdeskDb.find(t => t.id === id); if(!item) return;
    document.getElementById('helpdesk-edit-id').value = item.id;
    document.getElementById('hd-emp').value = item.emp || '';
    document.getElementById('hd-title').value = item.title || '';
    document.getElementById('hd-status').value = item.status || 'Open';
    document.getElementById('hd-details').value = item.details || '';
    openHelpdeskModal();
}
function clearHelpdeskForm() {
    document.getElementById('helpdesk-edit-id').value = '';
    document.getElementById('hd-emp').value = '';
    document.getElementById('hd-title').value = '';
    document.getElementById('hd-status').value = 'Open';
    document.getElementById('hd-details').value = '';
}
function deleteHelpdeskItem(id) {
    if(!confirmDelete("Delete this support ticket?")) return;
    database.ref('it_helpdesk_tickets/' + id).remove().then(() => showToast("Ticket Deleted"));
}

/* ================= IPAM SUBNET LOGIC (STATUS FULLY INTEGRATED) ================= */
function saveIpamEntry() {
    const editId = document.getElementById('ipam-edit-id')?.value || '';
    const ip = document.getElementById('ipam-ip')?.value.trim() || '';
    const device = document.getElementById('ipam-device')?.value.trim() || '';
    const status = document.getElementById('ipam-status')?.value || 'Online';
    const type = document.getElementById('ipam-type')?.value.trim() || '';
    const owner = document.getElementById('ipam-owner')?.value.trim() || '';
    const password = document.getElementById('ipam-password')?.value.trim() || '';
    const notes = document.getElementById('ipam-notes')?.value.trim() || '';
    
    if(!ip || !device) { alert("Please enter IP Address and Device Name!"); return; }
    
    const key = editId ? editId : "IPAM-" + Date.now();
    const payload = { id: key, ip, device, status, type, owner, password, notes, updated: new Date().toLocaleDateString('en-GB') };
    
    database.ref('it_ipam_subnets/' + key).set(payload).then(() => {
        closeIpamModal();
        showToast(editId ? "IP Entry Updated!" : "Static IP Recorded!");
    });
}
function renderIpamList() {
    const tbody = document.getElementById('ipam-list-body'); if(!tbody) return;
    const s = document.getElementById('ipam-search')?.value.toLowerCase() || '';
    tbody.innerHTML = "";
    
    const filtered = ipamDb.filter(i => 
        (i.ip || '').toLowerCase().includes(s) || 
        (i.device || '').toLowerCase().includes(s) || 
        (i.owner || '').toLowerCase().includes(s) || 
        (i.notes || '').toLowerCase().includes(s)
    );
    
    if(filtered.length === 0) { 
        tbody.innerHTML = `<tr><td colspan="8" class="text-center p-6 text-slate-500">No static IP records found.</td></tr>`; 
        return; 
    }
    
    filtered.forEach(item => {
        const isOnline = item.status === 'Online';
        const statusHtml = isOnline 
            ? `<span class="text-emerald-400 font-bold bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20 text-[10px]"><i class="fa-solid fa-circle text-[8px] mr-1"></i>Online</span>`
            : `<span class="text-red-400 font-bold bg-red-500/10 px-2.5 py-1 rounded-full border border-red-500/20 text-[10px]"><i class="fa-solid fa-circle text-[8px] mr-1"></i>Offline</span>`;

        const tr = document.createElement('tr'); 
        tr.className = "border-b border-slate-800 text-xs hover:bg-slate-800/40";
        tr.innerHTML = `
            <td class="p-3 font-mono font-bold text-blue-400">${item.ip}</td>
            <td class="p-3 font-bold text-white">${item.device}</td>
            <td class="p-3 font-bold">${statusHtml}</td>
            <td class="p-3 text-amber-400">${item.type || '-'}</td>
            <td class="p-3 text-slate-300">${item.owner || '-'}</td>
            <td class="p-3 font-mono text-emerald-400">${item.password ? '••••••••' : '-'}</td>
            <td class="p-3 text-slate-400 text-[11px]">${item.notes || '-'}</td>
            <td class="p-3 text-center flex justify-center gap-2">
                <button onclick="editIpamItem('${item.id}')" class="text-blue-400 hover:text-blue-300"><i class="fa-solid fa-pen-to-square"></i></button>
                <button onclick="deleteIpamItem('${item.id}')" class="text-slate-500 hover:text-red-400"><i class="fa-solid fa-trash"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}
function editIpamItem(id) {
    const item = ipamDb.find(i => i.id === id); if(!item) return;
    document.getElementById('ipam-edit-id').value = item.id;
    document.getElementById('ipam-ip').value = item.ip || '';
    document.getElementById('ipam-device').value = item.device || '';
    document.getElementById('ipam-status').value = item.status || 'Online';
    document.getElementById('ipam-type').value = item.type || '';
    document.getElementById('ipam-owner').value = item.owner || '';
    document.getElementById('ipam-password').value = item.password || '';
    document.getElementById('ipam-notes').value = item.notes || '';
    openIpamModal();
}
function clearIpamForm() {
    document.getElementById('ipam-edit-id').value = '';
    document.getElementById('ipam-ip').value = '';
    document.getElementById('ipam-device').value = '';
    document.getElementById('ipam-status').value = 'Online';
    document.getElementById('ipam-type').value = '';
    document.getElementById('ipam-owner').value = '';
    document.getElementById('ipam-password').value = '';
    document.getElementById('ipam-notes').value = '';
}
function deleteIpamItem(id) {
    if(!confirmDelete("Delete this IP entry?")) return;
    database.ref('it_ipam_subnets/' + id).remove().then(() => showToast("IP Entry Deleted"));
}

/* ================= QUICK COMMAND SNIPPETS VAULT ================= */
const defaultSnippets = [
    { id: 1, title: "Flush DNS Cache", category: "Windows CMD", cmd: "ipconfig /flushdns", desc: "Clears and resets the contents of the DNS resolver cache." },
    { id: 2, title: "Reset Winsock Catalog", category: "Windows CMD", cmd: "netsh winsock reset", desc: "Resets Winsock catalog back to clean state (fixes network connection issues)." },
    { id: 3, title: "Full IP Configuration", category: "Windows CMD", cmd: "ipconfig /all", desc: "Displays full detailed IP configuration for all adapters." },
    { id: 4, title: "Restart Print Spooler", category: "Windows", cmd: "net stop spooler && net start spooler", desc: "Restarts the printing service to clear stuck print jobs." },
    { id: 5, title: "View Active ARP Table", category: "Network", cmd: "arp -a", desc: "Displays current ARP entries to find IP-to-MAC mappings on local network." },
    { id: 6, title: "MikroTik Print Interfaces", category: "MikroTik CLI", cmd: "/interface print", desc: "Lists all active physical and virtual router interfaces." },
    { id: 7, title: "MikroTik Reboot Router", category: "MikroTik CLI", cmd: "/system reboot", desc: "Safely restarts the MikroTik router system." },
    { id: 8, title: "Check Network Routes", category: "Windows CMD", cmd: "route print", desc: "Displays the routing table for local gateway pathways." }
];

function initDefaultSnippetsToFirebase() {
    const updates = {};
    defaultSnippets.forEach(item => {
        const key = "SNIP-" + item.id;
        updates[key] = { id: key, title: item.title, category: item.category, cmd: item.cmd, desc: item.desc };
    });
    database.ref('it_command_snippets').update(updates);
}

function clearSnippetForm() {
    document.getElementById('snippet-edit-id').value = '';
    document.getElementById('snippet-title').value = '';
    document.getElementById('snippet-category').value = '';
    document.getElementById('snippet-cmd').value = '';
    document.getElementById('snippet-desc').value = '';
    document.getElementById('snippet-form-title').innerHTML = `<i class="fa-solid fa-terminal text-red-500"></i> Add Command Snippet`;
}

function saveSnippetEntry() {
    const editId = document.getElementById('snippet-edit-id')?.value || '';
    const title = document.getElementById('snippet-title')?.value.trim() || '';
    const category = document.getElementById('snippet-category')?.value.trim() || '';
    const cmd = document.getElementById('snippet-cmd')?.value.trim() || '';
    const desc = document.getElementById('snippet-desc')?.value.trim() || '';
    if(!title || !cmd || !category) { alert("Please fill Title, Category, and Command!"); return; }
    const key = editId ? editId : "SNIP-" + Date.now();
    const payload = { id: key, title, category, cmd, desc, updated: new Date().toLocaleDateString('en-GB') };
    database.ref('it_command_snippets/' + key).set(payload).then(() => {
        closeSnippetModal();
        showToast(editId ? "Snippet Updated Successfully!" : "Command Snippet Saved!");
    });
}

function renderCommandSnippets() {
    const grid = document.getElementById('snippets-grid');
    if (!grid) return;
    const searchInput = document.getElementById('snippet-search');
    const term = searchInput ? searchInput.value.toLowerCase().trim() : "";
     
    grid.innerHTML = "";
    const filtered = snippetsDb.filter(s => 
        (s.title || '').toLowerCase().includes(term) || 
        (s.category || '').toLowerCase().includes(term) || 
        (s.cmd || '').toLowerCase().includes(term) ||
        (s.desc || '').toLowerCase().includes(term)
    );

    if (filtered.length === 0) {
        grid.innerHTML = `<div class="col-span-2 text-center p-4 text-slate-500 text-xs">No command snippets found.</div>`;
        return;
    }

    filtered.forEach(item => {
        const card = document.createElement('div');
        card.className = "bg-slate-950 border border-slate-800 rounded-xl p-3 flex flex-col justify-between hover:border-slate-700 transition-all";
        card.innerHTML = `
            <div>
                <div class="flex justify-between items-center mb-1.5">
                    <span class="text-xs font-bold text-white">${item.title}</span>
                    <div class="flex items-center gap-1.5">
                        <span class="text-[9px] font-mono bg-slate-900 text-red-400 px-2 py-0.5 rounded border border-slate-800">${item.category}</span>
                        <button onclick="editSnippetItem('${item.id}')" class="text-blue-400 hover:text-blue-300 text-xs px-1"><i class="fa-solid fa-pen"></i></button>
                        <button onclick="deleteSnippetItem('${item.id}')" class="text-slate-500 hover:text-red-400 text-xs px-1"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </div>
                <p class="text-[10px] text-slate-400 mb-2">${item.desc || ''}</p>
            </div>
            <div class="flex items-center justify-between bg-slate-900 border border-slate-800/80 rounded-lg px-2.5 py-1.5 mt-auto">
                <code class="text-[11px] font-mono text-emerald-400 select-all truncate mr-2">${item.cmd}</code>
                <button onclick="copySnippetCommand('${(item.cmd || '').replace(/'/g, "\\'")}')" class="bg-slate-800 hover:bg-slate-700 text-slate-200 px-2.5 py-1 rounded text-[10px] font-semibold transition-all flex items-center gap-1 flex-shrink-0">
                    <i class="fa-solid fa-copy text-blue-400"></i> Copy
                </button>
            </div>
        `;
        grid.appendChild(card);
    });
}

function editSnippetItem(id) {
    const item = snippetsDb.find(s => s.id === id); if(!item) return;
    document.getElementById('snippet-edit-id').value = item.id;
    document.getElementById('snippet-title').value = item.title || '';
    document.getElementById('snippet-category').value = item.category || '';
    document.getElementById('snippet-cmd').value = item.cmd || '';
    document.getElementById('snippet-desc').value = item.desc || '';
    document.getElementById('snippet-form-title').innerHTML = `<i class="fa-solid fa-terminal text-red-500"></i> Edit Command Snippet`;
    openSnippetModal();
}

function deleteSnippetItem(id) {
    if(!confirmDelete("Delete this command snippet?")) return;
    database.ref('it_command_snippets/' + id).remove().then(() => showToast("Snippet Deleted"));
}

function copySnippetCommand(text) {
    navigator.clipboard.writeText(text).then(() => {
        showToast("Command copied to clipboard!");
    }).catch(err => {
        alert("Failed to copy command: " + err.message);
    });
}

/* WORK SCHEDULE / DIRECTIVES */
function addPlannedTaskToList() {
    const taskDate = document.getElementById('plan-task-date')?.value || '';
    const type = document.getElementById('plan-task-type')?.value || '';
    const priority = document.getElementById('plan-task-priority')?.value || 'Medium';
    const details = document.getElementById('plan-task-details')?.value.trim() || '';
    if(!taskDate || !details) { alert("Please enter Date and Task Details!"); return; }
    if (currentEditPlannedIdx > -1) {
        plannedTasks[currentEditPlannedIdx].taskDate = taskDate;
        plannedTasks[currentEditPlannedIdx].type = type;
        plannedTasks[currentEditPlannedIdx].priority = priority;
        plannedTasks[currentEditPlannedIdx].details = details;
        currentEditPlannedIdx = -1;
        showToast("Planned Task Updated!");
    } else {
        plannedTasks.push({ id: "PTK-" + Date.now(), taskDate, type, priority, details });
        showToast("Planned Task Added!");
    }
    plannedTasks.sort((a, b) => new Date(a.taskDate) - new Date(b.taskDate));
    if(document.getElementById('plan-task-details')) document.getElementById('plan-task-details').value = "";
    renderPlannedTasksTable();
    saveWeeklyReport();
}
function editPlannedTask(index) {
    currentEditPlannedIdx = index;
    const t = plannedTasks[index];
    document.getElementById('plan-task-date').value = t.taskDate;
    document.getElementById('plan-task-type').value = t.type;
    document.getElementById('plan-task-priority').value = t.priority;
    document.getElementById('plan-task-details').value = t.details;
}
function renderPlannedTasksTable() {
    const tbody = document.getElementById('planned-tasks-tbody'); if(!tbody) return;
    tbody.innerHTML = "";
    if(plannedTasks.length === 0) { tbody.innerHTML = `<tr><td colspan="5" class="text-center p-6 text-slate-500">No upcoming planned tasks.</td></tr>`; return; }
    plannedTasks.forEach((t, idx) => {
        let badgeBg = "bg-slate-800 text-slate-300";
        if(t.priority === "High") badgeBg = "bg-red-500/20 text-red-400 font-bold border border-red-500/30";
        else if(t.priority === "Medium") badgeBg = "bg-amber-500/20 text-amber-400 font-bold border border-amber-500/30";
        const tr = document.createElement('tr');
        tr.className = "border-b border-slate-800 text-xs hover:bg-slate-800/40";
        tr.innerHTML = `
            <td class="p-3 font-mono font-bold text-slate-200">${t.taskDate || '-'}</td>
            <td class="p-3 font-semibold text-red-400">${t.type}</td>
            <td class="p-3 text-slate-200 whitespace-pre-line leading-relaxed">${t.details}</td>
            <td class="p-3 text-center"><span class="px-2.5 py-1 rounded-full text-[10px] ${badgeBg}">${t.priority}</span></td>
            <td class="p-3 text-center no-print">
                <div class="flex justify-center gap-2">
                    <button onclick="editPlannedTask(${idx})" class="text-blue-400 hover:text-blue-300"><i class="fa-solid fa-pen"></i></button>
                    <button onclick="removePlannedTask(${idx})" class="text-slate-500 hover:text-red-400"><i class="fa-solid fa-trash"></i></button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}
function removePlannedTask(index) {
    plannedTasks.splice(index, 1);
    renderPlannedTasksTable();
    saveWeeklyReport();
}
function addDailyTaskToList() {
    const taskDate = document.getElementById('daily-task-date')?.value || '';
    const details = document.getElementById('daily-task-details')?.value.trim() || '';
    if(!taskDate || !details) { alert("Please enter Date and Daily Task Description!"); return; }
    if (currentEditDailyIdx > -1) {
        dailyTasks[currentEditDailyIdx].taskDate = taskDate;
        dailyTasks[currentEditDailyIdx].details = details;
        currentEditDailyIdx = -1;
        showToast("Daily Log Updated!");
    } else {
        dailyTasks.push({ id: "DTK-" + Date.now(), taskDate, details });
        showToast("Daily Log Added!");
    }
    dailyTasks.sort((a, b) => new Date(a.taskDate) - new Date(b.taskDate));
    if(document.getElementById('daily-task-details')) document.getElementById('daily-task-details').value = "";
    renderDailyTasksTable();
    saveWeeklyReport();
}
function editDailyTask(index) {
    currentEditDailyIdx = index;
    const t = dailyTasks[index];
    document.getElementById('daily-task-date').value = t.taskDate;
    document.getElementById('daily-task-details').value = t.details;
}
function renderDailyTasksTable() {
    const tbody = document.getElementById('daily-tasks-tbody'); if(!tbody) return;
    tbody.innerHTML = "";
    if(dailyTasks.length === 0) { tbody.innerHTML = `<tr><td colspan="3" class="text-center p-6 text-slate-500">No daily tasks logged yet.</td></tr>`; return; }
    dailyTasks.forEach((t, idx) => {
        const tr = document.createElement('tr');
        tr.className = "border-b border-slate-800 text-xs hover:bg-slate-800/40";
        tr.innerHTML = `
            <td class="p-3 font-mono font-bold text-slate-200">${t.taskDate || '-'}</td>
            <td class="p-3 text-slate-200 whitespace-pre-line leading-relaxed">${t.details}</td>
            <td class="p-3 text-center no-print">
                <div class="flex justify-center gap-2">
                    <button onclick="editDailyTask(${idx})" class="text-blue-400 hover:text-blue-300"><i class="fa-solid fa-pen"></i></button>
                    <button onclick="removeDailyTask(${idx})" class="text-slate-500 hover:text-red-400"><i class="fa-solid fa-trash"></i></button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}
function removeDailyTask(index) {
    dailyTasks.splice(index, 1);
    renderDailyTasksTable();
    saveWeeklyReport();
}
function saveWeeklyReport() {
    const date = document.getElementById('wr-date')?.value || '';
    const author = document.getElementById('wr-author')?.value.trim() || 'Ballen (IT Officer)';
    const payload = { date, author, plannedTasks, dailyTasks, updated: new Date().toLocaleString() };
    database.ref('it_weekly_plans').set(payload).then(() => showToast("Schedule Synchronized!"));
}

/* ================= SWITCH PORT MAPPING LOGIC ================= */
function saveIspEntry() {
    const name = document.getElementById('isp-name')?.value.trim() || '';
    const location = document.getElementById('isp-speed')?.value.trim() || '';
    const ip = document.getElementById('isp-ip')?.value.trim() || '';
    const uplink = document.getElementById('isp-pass')?.value.trim() || '';
    const notes = document.getElementById('isp-notes')?.value.trim() || '';
    const editId = document.getElementById('isp-edit-id')?.value || '';
    if(!name) { alert("Please enter Switch Name!"); return; }
    const key = editId ? editId : "SW-" + Date.now();
    const payload = { id: key, name, location, ip, uplink, notes, updated: new Date().toLocaleDateString('en-GB') };
    database.ref('it_switches/' + key).set(payload).then(() => {
        closeIspModal();
        showToast("Switch Mapping Saved Successfully!");
    });
}
function renderIspList() {
    const tbody = document.getElementById('switch-mapping-list-body'); if(!tbody) return;
    const s = document.getElementById('isp-search')?.value.toLowerCase() || '';
    tbody.innerHTML = "";
    const filtered = switchesDb.filter(d => (d.name || '').toLowerCase().includes(s) || (d.ip || '').toLowerCase().includes(s) || (d.location || '').toLowerCase().includes(s));
    if(filtered.length === 0) { tbody.innerHTML = `<tr><td colspan="7" class="text-center p-6 text-slate-500">No switch port mappings found.</td></tr>`; return; }
    filtered.forEach(item => {
        const tr = document.createElement('tr'); tr.className = "border-b border-slate-800 text-xs hover:bg-slate-800/40";
        tr.innerHTML = `
            <td class="p-3 font-bold text-red-400">${item.name}</td>
            <td class="p-3 text-slate-300">${item.location || '-'}</td>
            <td class="p-3 text-slate-300">Port Configuration</td>
            <td class="p-3 font-mono text-blue-400">${item.ip || '-'}</td>
            <td class="p-3 text-slate-300">${item.uplink || '-'}</td>
            <td class="p-3 text-amber-400 font-mono">VLANs Configured</td>
            <td class="p-3 text-slate-400 text-[11px]">
                ${item.notes || ''}
                <div class="mt-2 flex gap-3">
                    <button onclick="editIspItem('${item.id}')" class="text-blue-400 hover:text-blue-300 transition-colors"><i class="fa-solid fa-pen"></i></button>
                    <button onclick="deleteIspItem('${item.id}')" class="text-red-400 hover:text-red-300 transition-colors"><i class="fa-solid fa-trash"></i></button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}
function editIspItem(id) {
    const item = switchesDb.find(i => i.id === id); if(!item) return;
    document.getElementById('isp-edit-id').value = item.id;
    document.getElementById('isp-name').value = item.name || '';
    document.getElementById('isp-speed').value = item.location || '';
    document.getElementById('isp-ip').value = item.ip || '';
    document.getElementById('isp-pass').value = item.uplink || '';
    document.getElementById('isp-notes').value = item.notes || '';
    openIspModal();
}
function deleteIspItem(id) {
    if(!confirmDelete("Delete this switch mapping record?")) return;
    database.ref('it_switches/' + id).remove().then(() => showToast("Switch Record Deleted"));
}
function clearIspForm() {
    document.getElementById('isp-edit-id').value = '';
    document.getElementById('isp-name').value = '';
    document.getElementById('isp-speed').value = '';
    document.getElementById('isp-ip').value = '';
    document.getElementById('isp-pass').value = '';
    document.getElementById('isp-notes').value = '';
}

/* IT KNOWLEDGE BASE */
function saveNoteEntry() {
    const title = document.getElementById('note-title')?.value.trim() || '';
    const category = document.getElementById('note-category')?.value || '';
    const problem = document.getElementById('note-problem')?.value.trim() || '';
    const solution = document.getElementById('note-solution')?.value.trim() || '';
    const editId = document.getElementById('note-edit-id')?.value || '';
    if(!title || !solution) { alert("Please enter Issue Title and Solution steps!"); return; }
    const key = editId ? editId : "NOTE-" + Date.now();
    const payload = { id: key, title, category, problem, solution, updated: new Date().toLocaleDateString('en-GB') };
    database.ref('it_knowledge_notes/' + key).set(payload).then(() => {
        closeNoteModal();
        showToast("Knowledge Note Saved!");
    });
}
function renderNotesList() {
    const container = document.getElementById('notes-container'); if(!container) return;
    const s = document.getElementById('note-search')?.value.toLowerCase() || '';
    container.innerHTML = "";
    const filtered = notesDb.filter(n => (n.title || '').toLowerCase().includes(s) || (n.problem || '').toLowerCase().includes(s) || (n.solution || '').toLowerCase().includes(s));
    if(filtered.length === 0) {
        container.innerHTML = `<div class="col-span-2 text-center p-6 text-slate-500">No troubleshooting notes found.</div>`;
        return;
    }
    filtered.forEach(note => {
        const card = document.createElement('div');
        card.className = "bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg card-3d-effect flex flex-col justify-between";
        card.innerHTML = `
            <div>
                <div class="flex justify-between items-start mb-2">
                    <span class="text-[10px] font-bold bg-red-500/20 text-red-400 px-2.5 py-0.5 rounded-full border border-red-500/30">${note.category}</span>
                    <div class="flex gap-2">
                        <button onclick="editNoteItem('${note.id}')" class="text-blue-400 hover:text-blue-300 text-xs"><i class="fa-solid fa-pen"></i></button>
                        <button onclick="deleteNoteItem('${note.id}')" class="text-slate-500 hover:text-red-400 text-xs"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </div>
                <h4 class="text-sm font-bold text-white mb-2">${note.title}</h4>
                ${note.problem ? `<p class="text-xs text-slate-400 mb-3"><strong class="text-slate-300">Problem:</strong> ${note.problem}</p>` : ''}
                <div class="bg-slate-950/80 border border-slate-800/80 rounded-xl p-3 font-mono text-xs text-slate-200 whitespace-pre-line leading-relaxed mb-3">${note.solution}</div>
            </div>
            <div class="text-[10px] text-slate-500 text-right">Updated: ${note.updated || ''}</div>
        `;
        container.appendChild(card);
    });
}
function editNoteItem(id) {
    const item = notesDb.find(n => n.id === id); if(!item) return;
    document.getElementById('note-edit-id').value = item.id;
    document.getElementById('note-title').value = item.title || '';
    document.getElementById('note-category').value = item.category || 'General Note';
    document.getElementById('note-problem').value = item.problem || '';
    document.getElementById('note-solution').value = item.solution || '';
    openNoteModal();
}
function clearNoteForm() {
    document.getElementById('note-edit-id').value = '';
    document.getElementById('note-title').value = '';
    document.getElementById('note-problem').value = '';
    document.getElementById('note-solution').value = '';
}
function deleteNoteItem(id) {
    if(!confirmDelete("Delete this knowledge note?")) return;
    database.ref('it_knowledge_notes/' + id).remove().then(() => showToast("Note Deleted"));
}

/* RUSTDESK */
function saveRustDeskEntry() {
    const empName = document.getElementById('rd-emp-name')?.value.trim() || '';
    const rdId = document.getElementById('rd-id')?.value.trim() || '';
    const password = document.getElementById('rd-password')?.value.trim() || '';
    const dept = document.getElementById('rd-dept')?.value.trim() || '';
    const device = document.getElementById('rd-device')?.value.trim() || '';
    const notes = document.getElementById('rd-notes')?.value.trim() || '';
    const editId = document.getElementById('rd-edit-id')?.value || '';
    if(!empName || !rdId) { alert("Please enter Employee Name and RustDesk ID!"); return; }
    const key = editId ? editId : "RD-" + Date.now();
    const payload = { id: key, empName, rdId, password, dept, device, notes, updated: new Date().toLocaleDateString('en-GB') };
    database.ref('it_rustdesk_devices/' + key).set(payload).then(() => {
        closeRustDeskModal();
        showToast("RustDesk Device Saved!");
    });
}
function renderRustDeskList() {
    const tbody = document.getElementById('rd-list-body'); if(!tbody) return;
    const s = document.getElementById('rd-search')?.value.toLowerCase() || '';
    tbody.innerHTML = "";
    const filtered = rustdeskDb.filter(d => (d.empName || '').toLowerCase().includes(s) || (d.rdId || '').toLowerCase().includes(s) || (d.dept && d.dept.toLowerCase().includes(s)));
    if(filtered.length === 0) { tbody.innerHTML = `<tr><td colspan="6" class="text-center p-6 text-slate-500">No RustDesk devices recorded.</td></tr>`; return; }
    filtered.forEach(item => {
        const tr = document.createElement('tr'); tr.className = "border-b border-slate-800 text-xs hover:bg-slate-800/40";
        tr.innerHTML = `
            <td class="p-3"><span class="font-bold text-white block">${item.empName}</span><span class="text-slate-400 text-[10px]">${item.dept || '-'}</span></td>
            <td class="p-3 font-mono font-black text-red-400">${item.rdId}</td>
            <td class="p-3 font-mono text-slate-300">${item.password || ' '}</td>
            <td class="p-3"><span class="font-semibold text-slate-200 block">${item.device || '-'}</span><span class="text-slate-400 text-[10px]">${item.notes || ''}</span></td>
            <td class="p-3 text-center">
                <a href="rustdesk://${(item.rdId || '').replace(/\s+/g, '')}" class="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-[10px] rounded-lg shadow-md inline-flex items-center gap-1">
                    <i class="fa-solid fa-plug"></i> Connect
                </a>
            </td>
            <td class="p-3 text-center flex justify-center gap-2">
                <button onclick="editRustDeskItem('${item.id}')" class="text-blue-400 hover:text-blue-300"><i class="fa-solid fa-pen-to-square"></i></button>
                <button onclick="deleteRustDeskItem('${item.id}')" class="text-slate-500 hover:text-red-400"><i class="fa-solid fa-trash"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}
function editRustDeskItem(id) {
    const item = rustdeskDb.find(i => i.id === id); if(!item) return;
    document.getElementById('rd-edit-id').value = item.id;
    document.getElementById('rd-emp-name').value = item.empName || '';
    document.getElementById('rd-dept').value = item.dept || '';
    document.getElementById('rd-id').value = item.rdId || '';
    document.getElementById('rd-password').value = item.password || '';
    document.getElementById('rd-device').value = item.device || '';
    document.getElementById('rd-notes').value = item.notes || '';
    openRustDeskModal();
}
function clearRustDeskForm() {
    document.getElementById('rd-edit-id').value = '';
    document.getElementById('rd-emp-name').value = '';
    document.getElementById('rd-dept').value = '';
    document.getElementById('rd-id').value = '';
    document.getElementById('rd-password').value = '';
    document.getElementById('rd-device').value = '';
    document.getElementById('rd-notes').value = '';
}
function deleteRustDeskItem(id) {
    if(!confirmDelete("Delete this RustDesk device entry?")) return;
    database.ref('it_rustdesk_devices/' + id).remove().then(() => showToast("Device Deleted"));
}

function confirmDelete(msg) {
    return confirm(msg || "Are you sure you want to delete this? This cannot be undone.");
}
function showToast(m) {
    const t = document.getElementById('toast'); 
    const msgEl = document.getElementById('toast-msg');
    if(!t || !msgEl) return;
    msgEl.innerText = m;
    t.classList.remove('translate-y-28'); 
    setTimeout(() => { t.classList.add('translate-y-28'); }, 3000);
}

/* BACKUP EXPORT / IMPORT */
function buildBackupPayload() {
    return {
        source: "Asia Aluminium IT Management System",
        exportedAt: new Date().toISOString(),
        data: {
            it_employees_directory: employeesDb,
            it_warehouse_inventory: wDb,
            it_rustdesk_devices: rustdeskDb,
            it_switches: switchesDb,
            it_helpdesk_tickets: helpdeskDb,
            it_ipam_subnets: ipamDb,
            it_command_snippets: snippetsDb,
            it_weekly_plans: {
                plannedTasks, dailyTasks,
                date: document.getElementById('wr-date')?.value || "",
                author: document.getElementById('wr-author')?.value || ""
            },
            it_knowledge_notes: notesDb
        }
    };
}
function downloadBlob(content, filename, mime) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
}
function exportData() {
    const payload = buildBackupPayload();
    const stamp = new Date().toISOString().slice(0, 10);
    downloadBlob(JSON.stringify(payload, null, 2), `asia-aluminium-backup-${stamp}.json`, 'application/json');
    showToast("Backup JSON Exported!");
}
function exportToExcel() {
    if (typeof XLSX === 'undefined') { alert("Excel export library failed to load."); return; }
    const wb = XLSX.utils.book_new();
    const addSheet = (rows, name) => {
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows.length ? rows : [{ Note: "No records" }]), name);
    };
    addSheet(employeesDb.map(e => ({
        "ID": e.empId, "Employee Name": e.fullName, "Position": e.position, "Department": e.department, "Section": e.section, "Phone": e.phone, "Status": e.status, "Start Date": e.startDate, "End Date": e.endDate
    })), "Employees Directory");
    addSheet(wDb.map(i => ({
        "Asset Tag": i.assetTag, "Category": i.category, "IP Address": i.ipAddress, "Description": i.desc, "Details/Notes": i.details || "", "Serial": i.serial, "Quantity": i.quantity || 1,
        "Employee Name": i.empName, "Emp ID": i.empId, "Position": i.empPosition, "Department": i.empDepartment,
        "Location": i.location, "Handover Date": i.handoverDate, "Return Date": i.returnDate, "Status": i.status
    })), "Warehouse");
    addSheet(rustdeskDb.map(i => ({
        "Employee": i.empName, "Department": i.dept, "RustDesk ID": i.rdId, "Password": i.password,
        "Device": i.device, "Notes": i.notes, "Updated": i.updated
    })), "RustDesk");
    addSheet(switchesDb.map(i => ({
        "Switch Name": i.name, "Location": i.location, "Management IP": i.ip, "Uplink & VLANs": i.uplink, "Notes": i.notes
    })), "Switch Port Mapping");
    addSheet(helpdeskDb.map(t => ({
        "Ticket ID": t.id, "Employee": t.emp, "Issue": t.title, "Status": t.status, "Details": t.details
    })), "Helpdesk Tickets");
    addSheet(ipamDb.map(i => ({
        "IP Address": i.ip, "Device Name": i.device, "Status": i.status || "Online", "Type": i.type, "Owner/Location": i.owner
    })), "IPAM Subnets");
    addSheet(snippetsDb.map(s => ({
        "Title": s.title, "Category": s.category, "Command": s.cmd, "Description": s.desc
    })), "Command Snippets");
    addSheet(plannedTasks.map(t => ({
        "Date": t.taskDate, "Category": t.type, "Priority": t.priority, "Details": t.details
    })), "Planned Tasks");
    addSheet(dailyTasks.map(t => ({ "Date": t.taskDate, "Details": t.details })), "Daily Log");
    const stamp = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `asia-aluminium-report-${stamp}.xlsx`);
    showToast("Excel Report Exported!");
}
function arrayToKeyedObject(arr, idField) {
    const obj = {};
    const list = Array.isArray(arr) ? arr : Object.values(arr || {});
    list.forEach((item, idx) => {
        const key = item[idField] || (idField + '-' + Date.now() + '-' + idx);
        obj[key] = item;
    });
    return obj;
}
function importData(event) {
    const file = event.target.files[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.json')) { alert("Please select a valid .json backup file."); event.target.value = ""; return; }
    const reader = new FileReader();
    reader.onload = (e) => {
        let parsed;
        try { parsed = JSON.parse(e.target.result); }
        catch (err) { alert("This file is not valid JSON."); event.target.value = ""; return; }
        const payload = parsed.data ? parsed.data : parsed;
        const knownKeys = ['it_employees_directory', 'it_warehouse_inventory', 'it_rustdesk_devices', 'it_switches', 'it_helpdesk_tickets', 'it_ipam_subnets', 'it_command_snippets', 'it_weekly_plans', 'it_knowledge_notes'];
        if (!knownKeys.some(k => payload[k] !== undefined)) {
            alert("This file doesn't look like an Asia Aluminium backup.");
            event.target.value = ""; return;
        }
        if (!confirm("Importing will OVERWRITE current live data with this backup. Continue?")) {
            event.target.value = ""; return;
        }
        const updates = {};
        updates['it_forms_archive'] = null;
        if (payload.it_employees_directory) updates['it_employees_directory'] = arrayToKeyedObject(payload.it_employees_directory, 'id');
        if (payload.it_warehouse_inventory) updates['it_warehouse_inventory'] = arrayToKeyedObject(payload.it_warehouse_inventory, 'id');
        if (payload.it_rustdesk_devices) updates['it_rustdesk_devices'] = arrayToKeyedObject(payload.it_rustdesk_devices, 'id');
        if (payload.it_switches) updates['it_switches'] = arrayToKeyedObject(payload.it_switches, 'id');
        if (payload.it_helpdesk_tickets) updates['it_helpdesk_tickets'] = arrayToKeyedObject(payload.it_helpdesk_tickets, 'id');
        if (payload.it_ipam_subnets) updates['it_ipam_subnets'] = arrayToKeyedObject(payload.it_ipam_subnets, 'id');
        if (payload.it_command_snippets) updates['it_command_snippets'] = arrayToKeyedObject(payload.it_command_snippets, 'id');
        if (payload.it_weekly_plans) updates['it_weekly_plans'] = payload.it_weekly_plans;
        if (payload.it_knowledge_notes) updates['it_knowledge_notes'] = arrayToKeyedObject(payload.it_knowledge_notes, 'id');
        database.ref().update(updates).then(() => {
            showToast("Backup Restored Successfully!");
            event.target.value = "";
        }).catch(err => {
            alert("Import failed: " + err.message);
            event.target.value = "";
        });
    };
    reader.readAsText(file);
}

window.updateThemeIcon = function() {
    const icon = document.getElementById('theme-icon');
    if (!icon) return;
    if (document.documentElement.classList.contains('dark')) {
        icon.className = 'fa-solid fa-sun text-amber-400';
    } else {
        icon.className = 'fa-solid fa-moon text-indigo-500';
    }
};

window.initTheme = function() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light') {
        document.documentElement.classList.remove('dark');
    } else {
        document.documentElement.classList.add('dark');
    }
    updateThemeIcon();
};

document.addEventListener('DOMContentLoaded', () => {
    initTheme();
});
