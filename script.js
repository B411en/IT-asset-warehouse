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
const USER_ROLE_KEY = "aa_it_user_role";
const FAIL_COUNT_KEY = "aa_it_fail_count";
const LOCKOUT_UNTIL_KEY = "aa_it_lockout_until";
const ACCESS_SETTINGS_PATH = "it_system_settings/access";
const MANAGER_ACCESS_PATH = "it_system_settings/manager_access";
const ACCESS_ITERATIONS = 150000;

let currentAccessSalt = null;
let currentAccessHash = null;
let currentAccessIterations = ACCESS_ITERATIONS;

let managerAccessSalt = null;
let managerAccessHash = null;

let accessState = 'unknown';
let currentUserRole = 'admin'; // 'admin' or 'manager'

firebase.initializeApp(firebaseConfig);
const database = firebase.database();

let dashWarehouseChartInstance = null;
let dashStatusChartInstance = null;

let employeesDb = [];
let wDb = [];
let rustdeskDb = [];
let plannedTasks = [];
let dailyTasks = [];
let notesDb = [];

let currentEditPlannedIdx = -1;
let currentEditDailyIdx = -1;

/* ================= MODAL LOGICS ================= */
function openEmpModal() {
    if(currentUserRole === 'manager') { alert("Access Denied: Manager view is monitoring only."); return; }
    document.getElementById('emp-modal').classList.remove('hidden');
    document.getElementById('emp-modal').classList.add('flex');
}

function closeEmpModal() {
    document.getElementById('emp-modal').classList.add('hidden');
    document.getElementById('emp-modal').classList.remove('flex');
    clearEmployeeForm();
}

function openWarehouseModal() {
    if(currentUserRole === 'manager') { alert("Access Denied: Manager view is monitoring only."); return; }
    document.getElementById('warehouse-modal').classList.remove('hidden');
    document.getElementById('warehouse-modal').classList.add('flex');
    generateAutoAssetTag();
}

function closeWarehouseModal() {
    document.getElementById('warehouse-modal').classList.add('hidden');
    document.getElementById('warehouse-modal').classList.remove('flex');
    clearWarehouseForm();
}

function openRustDeskModal() {
    if(currentUserRole === 'manager') { alert("Access Denied: Manager view is monitoring only."); return; }
    document.getElementById('rustdesk-modal').classList.remove('hidden');
    document.getElementById('rustdesk-modal').classList.add('flex');
}

function closeRustDeskModal() {
    document.getElementById('rustdesk-modal').classList.add('hidden');
    document.getElementById('rustdesk-modal').classList.remove('flex');
    clearRustDeskForm();
}

function openNoteModal() {
    if(currentUserRole === 'manager') return;
    document.getElementById('notes-modal').classList.remove('hidden');
    document.getElementById('notes-modal').classList.add('flex');
}

function closeNoteModal() {
    document.getElementById('notes-modal').classList.add('hidden');
    document.getElementById('notes-modal').classList.remove('flex');
    clearNoteForm();
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

        const mSnap = await database.ref(MANAGER_ACCESS_PATH).once('value');
        const mVal = mSnap.val();
        if(mVal && mVal.hash && mVal.salt) {
            managerAccessSalt = mVal.salt;
            managerAccessHash = mVal.hash;
        } else {
            managerAccessSalt = "default_m_salt";
            managerAccessHash = await pbkdf2Hash("123456", managerAccessSalt, ACCESS_ITERATIONS);
        }
    } catch (e) {
        accessState = 'unconfigured';
    }
}

function lockoutSecondsFor(count) {
    if (count >= 12) return 300;
    if (count >= 8) return 60;
    if (count >= 5) return 20;
    if (count >= 3) return 5;
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
        const el = document.getElementById('dash-total-reports');
        if(el) el.innerText = plannedTasks.length + dailyTasks.length;
        renderPlannedTasksTable();
        renderDailyTasksTable();
    });

    database.ref('it_knowledge_notes').on('value', (s) => {
        notesDb = s.val() ? Object.values(s.val()) : [];
        renderNotesList();
    });
}

function unlockApp(role = 'admin') {
    currentUserRole = role;
    try { sessionStorage.setItem(USER_ROLE_KEY, role); } catch(e) {}
    
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
    applyRolePermissions();
}

function applyRolePermissions() {
    if(currentUserRole === 'manager') {
        const notesBtn = document.getElementById('btn-notes-tab');
        if(notesBtn) notesBtn.style.display = 'none';
        const notesTab = document.getElementById('notes-tab');
        if(notesTab) notesTab.remove();

        const addEmpBtn = document.querySelector('button[onclick="openEmpModal()"]');
        if(addEmpBtn) addEmpBtn.style.display = 'none';

        const addWhBtn = document.querySelector('button[onclick="openWarehouseModal()"]');
        if(addWhBtn) addWhBtn.style.display = 'none';

        const csvInputWrap = document.getElementById('csv-upload-container');
        if(csvInputWrap) csvInputWrap.style.display = 'none';

        const addRdBtn = document.querySelector('button[onclick="openRustDeskModal()"]');
        if(addRdBtn) addRdBtn.style.display = 'none';

        const wrAuthor = document.getElementById('wr-author');
        if(wrAuthor) wrAuthor.setAttribute('readonly', 'true');
        
        const saveReportBtn = document.querySelector('button[onclick="saveWeeklyReport()"]');
        if(saveReportBtn) saveReportBtn.style.display = 'none';

        const brandSub = document.querySelector('header span.text-slate-400');
        if(brandSub) brandSub.innerText = "Manager Monitoring Mode (Ranj)";
    }
}

function openManagerLogin() {
    const pin = prompt("Enter Manager Passcode (Default: 123456):");
    if(!pin) return;
    pbkdf2Hash(pin, managerAccessSalt, ACCESS_ITERATIONS).then(hash => {
        if(hash === managerAccessHash) {
            unlockApp('manager');
            showToast("Welcome Manager Ranj!");
        } else {
            alert("Incorrect Manager Passcode!");
        }
    });
}

function updateAccessUIState() {
    const banner = document.getElementById('setup-warning-banner');
    const navBtn = document.getElementById('passcode-nav-btn');
    const navBtnText = document.getElementById('passcode-nav-btn-text');
    const navBtnMobile = document.getElementById('passcode-nav-btn-mobile');
    if(!banner || !navBtn) return;

    if(accessState === 'unconfigured') {
        banner.classList.remove('hidden');
        banner.classList.add('flex');
        navBtn.classList.remove('bg-slate-700', 'hover:bg-slate-600');
        navBtn.classList.add('bg-amber-500', 'text-slate-900', 'hover:bg-amber-400');
        navBtnText.innerText = 'Set Passcode';
        if(navBtnMobile) {
            navBtnMobile.classList.remove('text-slate-300');
            navBtnMobile.classList.add('text-amber-400');
        }
    } else {
        banner.classList.add('hidden');
        banner.classList.remove('flex');
        navBtn.classList.add('bg-slate-700', 'hover:bg-slate-600');
        navBtn.classList.remove('bg-amber-500', 'text-slate-900', 'hover:bg-amber-400');
        navBtnText.innerText = 'Passcode';
        if(navBtnMobile) {
            navBtnMobile.classList.add('text-slate-300');
            navBtnMobile.classList.remove('text-amber-400');
        }
    }
}

function lockApp() {
    try { sessionStorage.removeItem(LOCK_SESSION_KEY); sessionStorage.removeItem(USER_ROLE_KEY); } catch(e) {}
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
        unlockApp('admin');
    } else {
        errorMsg.innerHTML = `<i class="fa-solid fa-triangle-exclamation mr-1"></i> Incorrect passcode. Try again.`;
        errorMsg.classList.remove('hidden');
        input.value = '';
        input.focus();
        const card = document.querySelector('#lock-screen .card-3d');
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
    const errorMsg = document.getElementById('lock-error');

    await loadAccessSettings();

    if(accessState === 'unconfigured') {
        unlockApp('admin');
        return;
    }

    let alreadyUnlocked = false;
    let savedRole = 'admin';
    try { 
        alreadyUnlocked = sessionStorage.getItem(LOCK_SESSION_KEY) === '1'; 
        savedRole = sessionStorage.getItem(USER_ROLE_KEY) || 'admin';
    } catch(e) {}
    
    if(alreadyUnlocked) { unlockApp(savedRole); return; }

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
    if(currentUserRole === 'manager') { alert("Access Denied."); return; }
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

    const modal = document.getElementById('change-pin-modal');
    if(modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
    const focusInput = document.getElementById(isSetMode ? 'cp-new' : 'cp-current');
    if(focusInput) focusInput.focus();
}

function closeChangePasscodeModal() {
    const modal = document.getElementById('change-pin-modal');
    if(modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
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
        showToast(isSetMode ? "Passcode set! This system is now protected." : "Passcode updated successfully!");
    } catch(err) {
        showErr("Failed to save passcode: " + err.message);
    }
    return false;
}

const cpForm = document.getElementById('change-pin-form');
if(cpForm) cpForm.addEventListener('submit', handleChangePasscodeSubmit);

document.addEventListener('DOMContentLoaded', initApp);

function toggleMobileMenu() {
    const menu = document.getElementById('mobile-menu');
    if(menu) menu.classList.toggle('hidden');
}

function switchTab(tabId) {
    if(currentUserRole === 'manager' && tabId === 'notes-tab') return;
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    const target = document.getElementById(tabId);
    if(target) target.classList.remove('hidden');
    
    document.querySelectorAll('.tab-btn').forEach(btn => { 
        btn.classList.remove('bg-red-600', 'text-white', 'shadow-lg', 'shadow-red-600/30'); 
        btn.classList.add('text-slate-300', 'hover:bg-slate-800'); 
    });
    
    const ab = document.getElementById('btn-' + tabId); 
    if (ab) { 
        ab.classList.remove('text-slate-300', 'hover:bg-slate-800'); 
        ab.classList.add('bg-red-600', 'text-white', 'shadow-lg', 'shadow-red-600/30'); 
    }
    if (tabId === 'dashboard-tab') updateDashboardCharts();
}

function updateDashboardCharts() {
    const wCounts = { "Laptop": 0, "PC": 0, "Cable": 0, "Printer": 0, "Monitor": 0, "Switch": 0, "Hub": 0, "IP camera": 0, "NVR": 0, "Hard":0, "Ram":0, "Access point": 0, "Printer cartridge": 0, "Other": 0 };
    let inUseCount = 0;
    wDb.forEach(item => { 
        if(wCounts[item.category] !== undefined) wCounts[item.category] += parseInt(item.quantity || 1); else wCounts["Other"] += parseInt(item.quantity || 1); 
        if(item.status === 'In Use') inUseCount += parseInt(item.quantity || 1);
    });

    const inUseEl = document.getElementById('dash-total-inuse');
    if(inUseEl) inUseEl.innerText = inUseCount;

    const bgColors = ['#4f46e5','#2563eb','#0891b2','#0d9488','#059669','#65a30d','#d97706','#ea580c','#dc2626','#e11d48','#db2777','#7c3aed','#475569','#0284c7'];

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
    "Laptop": "LAP", "PC": "PC", "Cable": "CBL", "Printer": "PRN", 
    "Monitor": "MON", "Switch": "SW", "Hub": "HUB", "IP camera": "CAM", 
    "NVR": "NVR", "Access point": "AP", "Hard": "HDD", "Ram": "RAM", 
    "Printer cartridge": "CRT", "Other": "OTH"
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
    } catch(err) {
        console.log("Tag generation notice:", err);
    }
}

/* ================= EMPLOYEES DIRECTORY LOGIC ================= */
function saveEmployeeEntry() {
    if(currentUserRole === 'manager') return;
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
        
        let actionButtons = `
            <div class="flex justify-center gap-2">
                <button onclick="editEmployeeItem('${emp.id}')" class="text-blue-400 hover:text-blue-300"><i class="fa-solid fa-pen-to-square"></i></button>
                <button onclick="deleteEmployeeItem('${emp.id}')" class="text-slate-500 hover:text-red-400"><i class="fa-solid fa-trash"></i></button>
            </div>
        `;
        if(currentUserRole === 'manager') actionButtons = `<span class="text-slate-600">-</span>`;

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
            <td class="p-3 text-center">${actionButtons}</td>
        `;
        tbody.appendChild(tr);
    });
}

function editEmployeeItem(id) {
    if(currentUserRole === 'manager') return;
    const item = employeesDb.find(e => e.id === id); if(!item) return;
    if(document.getElementById('emp-edit-id')) document.getElementById('emp-edit-id').value = item.id;
    if(document.getElementById('emp-code-id')) document.getElementById('emp-code-id').value = item.empId || '';
    if(document.getElementById('emp-fullname')) document.getElementById('emp-fullname').value = item.fullName || '';
    if(document.getElementById('emp-position')) document.getElementById('emp-position').value = item.position || '';
    if(document.getElementById('emp-department')) document.getElementById('emp-department').value = item.department || '';
    if(document.getElementById('emp-section')) document.getElementById('emp-section').value = item.section || '';
    if(document.getElementById('emp-phone')) document.getElementById('emp-phone').value = item.phone || '';
    if(document.getElementById('emp-status')) document.getElementById('emp-status').value = item.status || 'Active';
    if(document.getElementById('emp-start-date')) document.getElementById('emp-start-date').value = item.startDate || '';
    if(document.getElementById('emp-end-date')) document.getElementById('emp-end-date').value = item.endDate || '';
    if(document.getElementById('emp-form-title')) document.getElementById('emp-form-title').innerHTML = `<i class="fa-solid fa-user-pen text-lg"></i> Edit Employee`;
    openEmpModal();
}

function clearEmployeeForm() {
    if(document.getElementById('emp-edit-id')) document.getElementById('emp-edit-id').value = '';
    if(document.getElementById('emp-code-id')) document.getElementById('emp-code-id').value = '';
    if(document.getElementById('emp-fullname')) document.getElementById('emp-fullname').value = '';
    if(document.getElementById('emp-position')) document.getElementById('emp-position').value = '';
    if(document.getElementById('emp-department')) document.getElementById('emp-department').value = '';
    if(document.getElementById('emp-section')) document.getElementById('emp-section').value = '';
    if(document.getElementById('emp-phone')) document.getElementById('emp-phone').value = '';
    if(document.getElementById('emp-status')) document.getElementById('emp-status').value = 'Active';
    if(document.getElementById('emp-start-date')) document.getElementById('emp-start-date').value = '';
    if(document.getElementById('emp-end-date')) document.getElementById('emp-end-date').value = '';
    if(document.getElementById('emp-form-title')) document.getElementById('emp-form-title').innerHTML = `<i class="fa-solid fa-user-pen text-lg"></i> Register / Edit Employee`;
}

function deleteEmployeeItem(id) {
    if(currentUserRole === 'manager') return;
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
            opt.value = emp.id;
            opt.textContent = text;
            select.appendChild(opt);
        }
    });
    select.value = currentVal;
}

function onWarehouseEmployeeSelected() {
    const select = document.getElementById('w-emp-select');
    if(!select) return;
    const empIdVal = select.value;
    if(!empIdVal) {
        if(document.getElementById('w-emp-name')) document.getElementById('w-emp-name').value = '';
        if(document.getElementById('w-emp-id')) document.getElementById('w-emp-id').value = '';
        if(document.getElementById('w-emp-position')) document.getElementById('w-emp-position').value = '';
        if(document.getElementById('w-emp-department')) document.getElementById('w-emp-department').value = '';
        return;
    }
    const emp = employeesDb.find(e => e.id === empIdVal);
    if(emp) {
        if(document.getElementById('w-emp-name')) document.getElementById('w-emp-name').value = emp.fullName || '';
        if(document.getElementById('w-emp-id')) document.getElementById('w-emp-id').value = emp.empId || '';
        if(document.getElementById('w-emp-position')) document.getElementById('w-emp-position').value = emp.position || '';
        if(document.getElementById('w-emp-department')) document.getElementById('w-emp-department').value = emp.department || '';
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

function logItemToWarehouse() {
    if(currentUserRole === 'manager') return;
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

        let actionButtons = `
            <div class="flex justify-center gap-2">
                <button onclick="editWarehouseItem('${item.id}')" class="text-blue-400 hover:text-blue-300"><i class="fa-solid fa-pen-to-square"></i></button>
                <button onclick="deleteWarehouseItem('${item.id}')" class="text-slate-500 hover:text-red-400"><i class="fa-solid fa-trash"></i></button>
            </div>
        `;
        if(currentUserRole === 'manager') actionButtons = `<span class="text-slate-600">-</span>`;

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
            <td class="p-3 text-center">${actionButtons}</td>
        `;
        tbody.appendChild(tr);
    });
}

function editWarehouseItem(id) {
    if(currentUserRole === 'manager') return;
    const item = wDb.find(i => i.id === id); if(!item) return;
    if(document.getElementById('w-edit-id')) document.getElementById('w-edit-id').value = item.id;
    if(document.getElementById('w-asset-tag')) document.getElementById('w-asset-tag').value = item.assetTag || '';
    if(document.getElementById('w-category')) document.getElementById('w-category').value = item.category || 'Laptop';
    if(document.getElementById('w-ip-address')) document.getElementById('w-ip-address').value = item.ipAddress || '';
    if(document.getElementById('w-desc')) document.getElementById('w-desc').value = item.desc || '';
    if(document.getElementById('w-details')) document.getElementById('w-details').value = item.details || '';
    if(document.getElementById('w-serial')) document.getElementById('w-serial').value = item.serial || '';
    if(document.getElementById('w-quantity')) document.getElementById('w-quantity').value = item.quantity || '1';
    if(document.getElementById('w-emp-name')) document.getElementById('w-emp-name').value = item.empName || '';
    if(document.getElementById('w-emp-id')) document.getElementById('w-emp-id').value = item.empId || '';
    if(document.getElementById('w-emp-position')) document.getElementById('w-emp-position').value = item.empPosition || '';
    if(document.getElementById('w-emp-department')) document.getElementById('w-emp-department').value = item.empDepartment || '';
    if(document.getElementById('w-location')) document.getElementById('w-location').value = item.location || '';
    if(document.getElementById('w-handover-date')) document.getElementById('w-handover-date').value = item.handoverDate || '';
    if(document.getElementById('w-return-date')) document.getElementById('w-return-date').value = item.returnDate || '';
    if(document.getElementById('w-status')) document.getElementById('w-status').value = item.status || 'In Stock';
    if(document.getElementById('w-form-title')) document.getElementById('w-form-title').innerHTML = `<i class="fa-solid fa-pen text-lg"></i> Edit Stock Item`;
    toggleIpField();
    openWarehouseModal();
}

function clearWarehouseForm() {
    if(document.getElementById('w-edit-id')) document.getElementById('w-edit-id').value = '';
    if(document.getElementById('w-asset-tag')) document.getElementById('w-asset-tag').value = '';
    if(document.getElementById('w-ip-address')) document.getElementById('w-ip-address').value = '';
    if(document.getElementById('w-desc')) document.getElementById('w-desc').value = '';
    if(document.getElementById('w-details')) document.getElementById('w-details').value = '';
    if(document.getElementById('w-serial')) document.getElementById('w-serial').value = '';
    if(document.getElementById('w-quantity')) document.getElementById('w-quantity').value = '1';
    if(document.getElementById('w-emp-name')) document.getElementById('w-emp-name').value = '';
    if(document.getElementById('w-emp-id')) document.getElementById('w-emp-id').value = '';
    if(document.getElementById('w-emp-position')) document.getElementById('w-emp-position').value = '';
    if(document.getElementById('w-emp-department')) document.getElementById('w-emp-department').value = '';
    if(document.getElementById('w-location')) document.getElementById('w-location').value = '';
    if(document.getElementById('w-handover-date')) document.getElementById('w-handover-date').value = '';
    if(document.getElementById('w-return-date')) document.getElementById('w-return-date').value = '';
    if(document.getElementById('w-status')) document.getElementById('w-status').value = 'In Stock';
    if(document.getElementById('w-emp-search')) document.getElementById('w-emp-search').value = '';
    if(document.getElementById('w-emp-select')) document.getElementById('w-emp-select').value = '';
    if(document.getElementById('w-form-title')) document.getElementById('w-form-title').innerHTML = `<i class="fa-solid fa-barcode text-lg"></i> Store / Edit Asset`;
    toggleIpField();
    generateAutoAssetTag();
}

function deleteWarehouseItem(id) {
    if(currentUserRole === 'manager') return;
    if(!confirmDelete("Delete this warehouse item?")) return;
    database.ref('it_warehouse_inventory/' + id).remove().then(() => showToast("Warehouse Item Deleted"));
}

/* ================= CSV BULK UPLOAD ================= */
function importWarehouseCSV(event) {
    if(currentUserRole === 'manager') return;
    const file = event.target.files[0];
    if (!file) return;
    
    if (!file.name.toLowerCase().endsWith('.csv')) {
        alert("Please upload a valid .csv file.");
        event.target.value = ""; 
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        const text = e.target.result;
        const rows = text.split(/
?
/);
        
        if (rows.length < 2) {
            alert("The CSV file appears to be empty or missing data rows.");
            return;
        }

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
                    category: cat, 
                    ipAddress: ipStr, 
                    desc: modelStr + " (Firmware: " + (cols[4] || '') + ")", 
                    details: "",
                    serial: serialStr, 
                    quantity: "1",
                    empName: "", empId: "", empPosition: "", empDepartment: "", 
                    location: "Main Warehouse", 
                    handoverDate: "", returnDate: "", 
                    status: "In Stock", 
                    updated: new Date().toLocaleDateString('en-GB') 
                };
                
                updates['it_warehouse_inventory/' + key] = payload;
                addedCount++;
            }
        }

        if(addedCount > 0) {
            database.ref().update(updates).then(() => {
                showToast(`Successfully imported ${addedCount} items from CSV!`);
                event.target.value = ""; 
            }).catch(err => {
                alert("Failed to upload items: " + err.message);
            });
        } else {
            alert("No valid rows found to import. Check the CSV format.");
        }
    };
    reader.readAsText(file);
}

/* WORK SCHEDULE (Manager CAN add planned tasks) */
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
    if(document.getElementById('plan-task-date')) document.getElementById('plan-task-date').value = t.taskDate;
    if(document.getElementById('plan-task-type')) document.getElementById('plan-task-type').value = t.type;
    if(document.getElementById('plan-task-priority')) document.getElementById('plan-task-priority').value = t.priority;
    if(document.getElementById('plan-task-details')) document.getElementById('plan-task-details').value = t.details;
}

function renderPlannedTasksTable() {
    const tbody = document.getElementById('planned-tasks-tbody'); if(!tbody) return;
    tbody.innerHTML = "";
    if(plannedTasks.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center p-6 text-slate-500">No upcoming planned tasks.</td></tr>`;
        return;
    }
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
    if(currentUserRole === 'manager') return;
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
}

function editDailyTask(index) {
    if(currentUserRole === 'manager') return;
    currentEditDailyIdx = index;
    const t = dailyTasks[index];
    if(document.getElementById('daily-task-date')) document.getElementById('daily-task-date').value = t.taskDate;
    if(document.getElementById('daily-task-details')) document.getElementById('daily-task-details').value = t.details;
}

function renderDailyTasksTable() {
    const tbody = document.getElementById('daily-tasks-tbody'); if(!tbody) return;
    tbody.innerHTML = "";
    if(dailyTasks.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" class="text-center p-6 text-slate-500">No daily tasks logged yet.</td></tr>`;
        return;
    }
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
    if(currentUserRole === 'manager') return;
    dailyTasks.splice(index, 1);
    renderDailyTasksTable();
}

function saveWeeklyReport() {
    const date = document.getElementById('wr-date')?.value || '';
    const author = document.getElementById('wr-author')?.value.trim() || 'IT Team';

    const payload = { date, author, plannedTasks, dailyTasks, updated: new Date().toLocaleString() };
    database.ref('it_weekly_plans').set(payload).then(() => showToast("Schedule Synchronized!"));
}

/* IT KNOWLEDGE BASE */
function saveNoteEntry() { if(currentUserRole === 'manager') return; }
function renderNotesList() { if(currentUserRole === 'manager') return; }
function editNoteItem(id) { if(currentUserRole === 'manager') return; }
function clearNoteForm() {}
function deleteNoteItem(id) { if(currentUserRole === 'manager') return; }

/* RUSTDESK */
function saveRustDeskEntry() {
    if(currentUserRole === 'manager') return;
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
        let actionButtons = `
            <td class="p-3 text-center flex justify-center gap-2">
                <button onclick="editRustDeskItem('${item.id}')" class="text-blue-400 hover:text-blue-300"><i class="fa-solid fa-pen-to-square"></i></button>
                <button onclick="deleteRustDeskItem('${item.id}')" class="text-slate-500 hover:text-red-400"><i class="fa-solid fa-trash"></i></button>
            </td>
        `;
        if(currentUserRole === 'manager') actionButtons = `<td class="p-3 text-center"><span class="text-slate-600">-</span></td>`;

        const tr = document.createElement('tr'); tr.className = "border-b border-slate-800 text-xs hover:bg-slate-800/40";
        tr.innerHTML = `
            <td class="p-3"><span class="font-bold text-white block">${item.empName}</span><span class="text-slate-400 text-[10px]">${item.dept || '-'}</span></td>
            <td class="p-3 font-mono font-black text-red-400">${item.rdId}</td>
            <td class="p-3 font-mono text-slate-300">${item.password || '••••'}</td>
            <td class="p-3"><span class="font-semibold text-slate-200 block">${item.device || '-'}</span><span class="text-slate-400 text-[10px]">${item.notes || ''}</span></td>
            <td class="p-3 text-center">
                <a href="rustdesk://${(item.rdId || '').replace(/\s+/g, '')}" class="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-[10px] rounded-lg shadow-md inline-flex items-center gap-1">
                    <i class="fa-solid fa-plug"></i> Connect
                </a>
            </td>
            ${actionButtons}
        `;
        tbody.appendChild(tr);
    });
}

function editRustDeskItem(id) {
    if(currentUserRole === 'manager') return;
    const item = rustdeskDb.find(i => i.id === id); if(!item) return;
    if(document.getElementById('rd-edit-id')) document.getElementById('rd-edit-id').value = item.id;
    if(document.getElementById('rd-emp-name')) document.getElementById('rd-emp-name').value = item.empName || '';
    if(document.getElementById('rd-dept')) document.getElementById('rd-dept').value = item.dept || '';
    if(document.getElementById('rd-id')) document.getElementById('rd-id').value = item.rdId || '';
    if(document.getElementById('rd-password')) document.getElementById('rd-password').value = item.password || '';
    if(document.getElementById('rd-device')) document.getElementById('rd-device').value = item.device || '';
    if(document.getElementById('rd-notes')) document.getElementById('rd-notes').value = item.notes || '';
    openRustDeskModal();
}

function clearRustDeskForm() {
    if(document.getElementById('rd-edit-id')) document.getElementById('rd-edit-id').value = '';
    if(document.getElementById('rd-emp-name')) document.getElementById('rd-emp-name').value = '';
    if(document.getElementById('rd-dept')) document.getElementById('rd-dept').value = '';
    if(document.getElementById('rd-id')) document.getElementById('rd-id').value = '';
    if(document.getElementById('rd-password')) document.getElementById('rd-password').value = '';
    if(document.getElementById('rd-device')) document.getElementById('rd-device').value = '';
    if(document.getElementById('rd-notes')) document.getElementById('rd-notes').value = '';
}

function deleteRustDeskItem(id) {
    if(currentUserRole === 'manager') return;
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
    if(currentUserRole === 'manager') return;
    const file = event.target.files[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.json')) {
        alert("Please select a valid .json backup file.");
        event.target.value = ""; return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        let parsed;
        try { parsed = JSON.parse(e.target.result); }
        catch (err) { alert("This file is not valid JSON."); event.target.value = ""; return; }

        const payload = parsed.data ? parsed.data : parsed;
        const knownKeys = ['it_employees_directory', 'it_warehouse_inventory', 'it_rustdesk_devices', 'it_weekly_plans', 'it_knowledge_notes'];
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
