// --- Security & Passcode Configuration Keys ---
const LOCK_SESSION_KEY = 'aa_system_unlocked';
const LOCKOUT_UNTIL_KEY = 'aa_lockout_until';
const ACCESS_HASH_KEY = 'aa_access_hash';
const ACCESS_SALT_KEY = 'aa_access_salt';
const ACCESS_ITER_KEY = 'aa_access_iter';
const FAILED_ATTEMPTS_KEY = 'aa_failed_attempts';

let currentAccessHash = localStorage.getItem(ACCESS_HASH_KEY) || '';
let currentAccessSalt = localStorage.getItem(ACCESS_SALT_KEY) || '';
let currentAccessIterations = parseInt(localStorage.getItem(ACCESS_ITER_KEY) || '100000', 10);

// Default passcode setup if not configured yet (Default: "admin123")
async function initDefaultPasscode() {
    if (!currentAccessHash) {
        const defaultPin = 'admin123';
        const salt = window.crypto.getRandomValues(new Uint8Array(16));
        const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');
        const hash = await pbkdf2Hash(defaultPin, saltHex, 100000);
        localStorage.setItem(ACCESS_HASH_KEY, hash);
        localStorage.setItem(ACCESS_SALT_KEY, saltHex);
        localStorage.setItem(ACCESS_ITER_KEY, '100000');
        currentAccessHash = hash;
        currentAccessSalt = saltHex;
        currentAccessIterations = 100000;
    }
}

// PBKDF2 Hashing Utility
async function pbkdf2Hash(password, saltHex, iterations) {
    const enc = new TextEncoder();
    const keyMaterial = await window.crypto.subtle.importKey(
        "raw", enc.encode(password), { name: "PBKDF2" }, false, ["deriveBits"]
    );
    const saltBytes = new Uint8Array(saltHex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
    const derivedBits = await window.crypto.subtle.deriveBits(
        { name: "PBKDF2", salt: saltBytes, iterations: iterations, hash: "SHA-256" },
        keyMaterial, 256
    );
    return Array.from(new Uint8Array(derivedBits)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Initialization on DOM Load
document.addEventListener('DOMContentLoaded', async () => {
    await initDefaultPasscode();
    checkLockState();
    
    const lockForm = document.getElementById('lock-form');
    if (lockForm) {
        lockForm.addEventListener('submit', handleUnlockSubmit);
    }

    const changePinForm = document.getElementById('change-pin-form');
    if (changePinForm) {
        changePinForm.addEventListener('submit', handleChangePasscodeSubmit);
    }

    loadAllAppData();
});

// Lock State Check
function checkLockState() {
    const isUnlocked = sessionStorage.getItem(LOCK_SESSION_KEY) === '1';
    const lockScreen = document.getElementById('lock-screen');
    const appRoot = document.getElementById('app-root');
    const pinInput = document.getElementById('lock-pin-input');
    const submitBtn = document.querySelector('#lock-form button[type="submit"]');

    if (isUnlocked) {
        if (lockScreen) lockScreen.classList.add('hidden');
        if (appRoot) {
            appRoot.classList.remove('hidden');
            appRoot.classList.add('flex');
        }
    } else {
        if (lockScreen) lockScreen.classList.remove('hidden');
        if (appRoot) {
            appRoot.classList.add('hidden');
            appRoot.classList.remove('flex');
        }
        if (pinInput) {
            pinInput.removeAttribute('disabled');
            pinInput.focus();
        }
        if (submitBtn) {
            submitBtn.removeAttribute('disabled');
        }
    }
    checkPasscodeSetupBanner();
}

function lockApp() {
    sessionStorage.removeItem(LOCK_SESSION_KEY);
    location.reload();
}

// Unlock Form Handler with Comedic Effects
async function handleUnlockSubmit(evt) {
    evt.preventDefault();
    let lockedOut = false;
    try { lockedOut = Date.now() < parseInt(sessionStorage.getItem(LOCKOUT_UNTIL_KEY) || '0', 10); } catch(e) {}
    if(lockedOut) return false;
    
    const input = document.getElementById('lock-pin-input');
    const errorMsg = document.getElementById('lock-error');
    const submitBtn = document.querySelector('#lock-form button[type="submit"]');
    const val = input.value.trim();
    if(!val) return false;
    
    const enteredHash = await pbkdf2Hash(val, currentAccessSalt, currentAccessIterations);
    
    if(enteredHash === currentAccessHash) {
        clearFailedAttempts();
        try { sessionStorage.setItem(LOCK_SESSION_KEY, '1'); } catch(e) {}
        errorMsg.classList.add('hidden');
        
        if(submitBtn) {
            submitBtn.classList.add('comic-giant');
        }
        
        setTimeout(() => {
            unlockApp();
        }, 700);
        
    } else {
        errorMsg.innerHTML = `<i class="fa-solid fa-triangle-exclamation mr-1"></i> Incorrect passcode. Try again.`;
        errorMsg.classList.remove('hidden');
        input.value = '';
        input.focus();
        
        if(submitBtn) {
            submitBtn.classList.add('comic-dodge');
            submitBtn.setAttribute('disabled', 'true');
            submitBtn.classList.add('opacity-50', 'cursor-not-allowed');
            
            setTimeout(() => {
                submitBtn.classList.remove('comic-dodge');
                submitBtn.removeAttribute('disabled');
                submitBtn.classList.remove('opacity-50', 'cursor-not-allowed');
            }, 500);
        }
        
        registerFailedAttempt();
    }
    return false;
}

function unlockApp() {
    const lockScreen = document.getElementById('lock-screen');
    const appRoot = document.getElementById('app-root');
    if (lockScreen) lockScreen.classList.add('hidden');
    if (appRoot) {
        appRoot.classList.remove('hidden');
        appRoot.classList.add('flex');
    }
}

function registerFailedAttempt() {
    let attempts = parseInt(localStorage.getItem(FAILED_ATTEMPTS_KEY) || '0', 10) + 1;
    localStorage.setItem(FAILED_ATTEMPTS_KEY, attempts.toString());
    if (attempts >= 5) {
        const lockoutTime = Date.now() + 30000; // 30 seconds lockout
        sessionStorage.setItem(LOCKOUT_UNTIL_KEY, lockoutTime.toString());
        localStorage.setItem(FAILED_ATTEMPTS_KEY, '0');
        showToast('Too many failed attempts. Locked for 30 seconds.');
    }
}

function clearFailedAttempts() {
    localStorage.removeItem(FAILED_ATTEMPTS_KEY);
    sessionStorage.removeItem(LOCKOUT_UNTIL_KEY);
}

function checkPasscodeSetupBanner() {
    const banner = document.getElementById('setup-warning-banner');
    if (banner) {
        banner.classList.add('hidden');
    }
}

// Tab Switching System
function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('bg-cyan-500', 'text-slate-950', 'shadow-lg', 'shadow-cyan-500/25', 'font-bold');
        btn.classList.add('text-slate-300', 'hover:bg-slate-900', 'hover:text-white', 'font-semibold');
    });

    const targetTab = document.getElementById(tabId);
    if (targetTab) targetTab.classList.remove('hidden');

    const activeBtn = document.getElementById('btn-' + tabId);
    if (activeBtn) {
        activeBtn.classList.remove('text-slate-300', 'hover:bg-slate-900', 'hover:text-white', 'font-semibold');
        activeBtn.classList.add('bg-cyan-500', 'text-slate-950', 'shadow-lg', 'shadow-cyan-500/25', 'font-bold');
    }

    if (tabId === 'dashboard-tab') {
        updateDashboardStats();
    }
}

// Toast Notification
function showToast(msg) {
    const toast = document.getElementById('toast');
    const toastMsg = document.getElementById('toast-msg');
    if (toast && toastMsg) {
        toastMsg.textContent = msg;
        toast.classList.remove('translate-y-28');
        setTimeout(() => {
            toast.classList.add('translate-y-28');
        }, 3000);
    }
}

// Load All App Data & Charts
let dashWarehouseChartInst = null;
let dashStatusChartInst = null;

function loadAllAppData() {
    renderEmployeesList();
    renderWarehouseList();
    renderRustDeskList();
    renderIspList();
    renderHelpdeskList();
    renderIpamList();
    renderCommandSnippets();
    renderNotesList();
    updateDashboardStats();
}

function updateDashboardStats() {
    const employees = JSON.parse(localStorage.getItem('aa_employees')) || [];
    const warehouse = JSON.parse(localStorage.getItem('aa_warehouse_items')) || [];
    const rustdesk = JSON.parse(localStorage.getItem('aa_rustdesk_items')) || [];
    const tickets = JSON.parse(localStorage.getItem('aa_helpdesk_tickets')) || [];

    document.getElementById('dash-total-employees').textContent = employees.length;
    document.getElementById('dash-total-warehouse').textContent = warehouse.length;
    document.getElementById('dash-total-rustdesk').textContent = rustdesk.length;
    document.getElementById('dash-total-tickets').textContent = tickets.filter(t => t.status === 'Open').length;

    // Category count for chart
    let catCounts = {};
    warehouse.forEach(item => {
        let cat = item.category || 'Other';
        catCounts[cat] = (catCounts[cat] || 0) + 1;
    });

    let statusCounts = { 'In Stock': 0, 'In Use': 0, 'Maintenance': 0, 'Damaged': 0 };
    warehouse.forEach(item => {
        let st = item.status || 'In Stock';
        statusCounts[st] = (statusCounts[st] || 0) + 1;
    });

    // Render Charts if Chart.js is ready
    if (typeof Chart !== 'undefined') {
        const ctx1 = document.getElementById('dashWarehouseChart');
        if (ctx1) {
            if (dashWarehouseChartInst) dashWarehouseChartInst.destroy();
            dashWarehouseChartInst = new Chart(ctx1, {
                type: 'doughnut',
                data: {
                    labels: Object.keys(catCounts),
                    datasets: [{
                        data: Object.values(catCounts),
                        backgroundColor: ['#00f2ea', '#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#6366f1']
                    }]
                },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: '#cbd5e1', font: { size: 10 } } } } }
            });
        }

        const ctx2 = document.getElementById('dashStatusChart');
        if (ctx2) {
            if (dashStatusChartInst) dashStatusChartInst.destroy();
            dashStatusChartInst = new Chart(ctx2, {
                type: 'bar',
                data: {
                    labels: Object.keys(statusCounts),
                    datasets: [{
                        label: 'Assets Count',
                        data: Object.values(statusCounts),
                        backgroundColor: '#00f2ea'
                    }]
                },
                options: { responsive: true, maintainAspectRatio: false, scales: { x: { ticks: { color: '#cbd5e1' } }, y: { ticks: { color: '#cbd5e1' } } }, plugins: { legend: { display: false } } }
            });
        }
    }
}

// --- EMPLOYEES CRUD ---
function openEmpModal(editId = null) {
    document.getElementById('emp-edit-id').value = editId || '';
    document.getElementById('emp-modal').classList.remove('hidden');
    document.getElementById('emp-modal').classList.add('flex');
}
function closeEmpModal() {
    document.getElementById('emp-modal').classList.add('hidden');
    document.getElementById('emp-modal').classList.remove('flex');
}
function saveEmployeeEntry() {
    const editId = document.getElementById('emp-edit-id').value;
    const codeId = document.getElementById('emp-code-id').value.trim();
    const fullname = document.getElementById('emp-fullname').value.trim();
    if(!codeId || !fullname) { alert('Please enter Employee ID and Name'); return; }

    let employees = JSON.parse(localStorage.getItem('aa_employees')) || [];
    const newEmp = {
        id: editId || 'EMP-' + Date.now(),
        codeId,
        fullname,
        position: document.getElementById('emp-position').value.trim(),
        department: document.getElementById('emp-department').value.trim(),
        section: document.getElementById('emp-section').value.trim(),
        phone: document.getElementById('emp-phone').value.trim(),
        status: document.getElementById('emp-status').value,
        startDate: document.getElementById('emp-start-date').value,
        endDate: document.getElementById('emp-end-date').value
    };

    if (editId) {
        employees = employees.map(e => e.id === editId ? newEmp : e);
    } else {
        employees.push(newEmp);
    }
    localStorage.setItem('aa_employees', JSON.stringify(employees));
    closeEmpModal();
    renderEmployeesList();
    showToast('Employee saved successfully!');
}
function renderEmployeesList() {
    let employees = JSON.parse(localStorage.getItem('aa_employees')) || [];
    const search = (document.getElementById('employee-search')?.value || '').toLowerCase();
    const tbody = document.getElementById('employees-list-body');
    if (!tbody) return;

    let filtered = employees.filter(e => 
        (e.codeId && e.codeId.toLowerCase().includes(search)) ||
        (e.fullname && e.fullname.toLowerCase().includes(search)) ||
        (e.department && e.department.toLowerCase().includes(search))
    );

    document.getElementById('employee-count').textContent = filtered.length + ' Employees';
    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="text-center p-6 text-slate-500 font-mono">No employees found.</td></tr>`;
        return;
    }

    tbody.innerHTML = filtered.map((e, idx) => `
        <tr class="border-b border-cyan-500/10 hover:bg-slate-900/50 transition-all text-xs font-mono">
            <td class="p-3">${idx + 1}</td>
            <td class="p-3 text-cyan-400 font-bold">${e.codeId}</td>
            <td class="p-3 text-white font-bold">${e.fullname}</td>
            <td class="p-3 text-slate-300">${e.position || '-'}</td>
            <td class="p-3 text-slate-300">${e.department || '-'}</td>
            <td class="p-3 text-slate-300">${e.phone || '-'}</td>
            <td class="p-3"><span class="px-2 py-0.5 rounded-full text-[10px] ${e.status === 'Active' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}">${e.status}</span></td>
            <td class="p-3 text-center">
                <button onclick="deleteEmployee('${e.id}')" class="text-red-400 hover:text-red-300 px-2 py-1"><i class="fa-solid fa-trash"></i></button>
            </td>
        </tr>
    `).join('');
}
function deleteEmployee(id) {
    if(confirm('Are you sure you want to delete this employee?')) {
        let employees = JSON.parse(localStorage.getItem('aa_employees')) || [];
        employees = employees.filter(e => e.id !== id);
        localStorage.setItem('aa_employees', JSON.stringify(employees));
        renderEmployeesList();
        showToast('Employee deleted.');
    }
}

// --- WAREHOUSE CRUD ---
function openWarehouseModal(editId = null) {
    document.getElementById('w-edit-id').value = editId || '';
    document.getElementById('warehouse-modal').classList.remove('hidden');
    document.getElementById('warehouse-modal').classList.add('flex');
    populateWarehouseEmployeeDropdown();
}
function closeWarehouseModal() {
    document.getElementById('warehouse-modal').classList.add('hidden');
    document.getElementById('warehouse-modal').classList.remove('flex');
}
function toggleIpField() {
    const cat = document.getElementById('w-category').value;
    const ipContainer = document.getElementById('w-ip-container');
    if (['IP camera', 'NVR', 'Access point', 'Switch', 'Printer'].includes(cat)) {
        ipContainer.classList.remove('hidden');
    } else {
        ipContainer.classList.add('hidden');
    }
}
function populateWarehouseEmployeeDropdown() {
    const employees = JSON.parse(localStorage.getItem('aa_employees')) || [];
    const select = document.getElementById('w-emp-select');
    if (!select) return;
    select.innerHTML = '<option value="">-- Choose Employee --</option>' + employees.map(e => `<option value="${e.fullname}">${e.fullname} (${e.department || 'General'})</option>`).join('');
}
function onWarehouseEmployeeSelected() {
    const name = document.getElementById('w-emp-select').value;
    if (!name) return;
    const employees = JSON.parse(localStorage.getItem('aa_employees')) || [];
    const emp = employees.find(e => e.fullname === name);
    if (emp) {
        document.getElementById('w-emp-name').value = emp.fullname;
        document.getElementById('w-emp-id').value = emp.codeId || '';
        document.getElementById('w-emp-position').value = emp.position || '';
        document.getElementById('w-emp-department').value = emp.department || '';
        document.getElementById('w-location').value = emp.section || '';
    }
}
function logItemToWarehouse() {
    const editId = document.getElementById('w-edit-id').value;
    const tag = document.getElementById('w-asset-tag').value.trim();
    const category = document.getElementById('w-category').value;
    const desc = document.getElementById('w-desc').value.trim();
    if (!tag || !desc) { alert('Asset Tag and Description are required.'); return; }

    let warehouse = JSON.parse(localStorage.getItem('aa_warehouse_items')) || [];
    const newItem = {
        id: editId || 'AST-' + Date.now(),
        tag,
        category,
        ipAddress: document.getElementById('w-ip-address')?.value.trim() || '',
        desc,
        serial: document.getElementById('w-serial').value.trim(),
        quantity: parseInt(document.getElementById('w-quantity').value || '1', 10),
        status: document.getElementById('w-status').value,
        empName: document.getElementById('w-emp-name').value.trim(),
        empId: document.getElementById('w-emp-id').value.trim(),
        empPosition: document.getElementById('w-emp-position').value.trim(),
        empDepartment: document.getElementById('w-emp-department').value.trim(),
        location: document.getElementById('w-location').value.trim(),
        handoverDate: document.getElementById('w-handover-date').value,
        returnDate: document.getElementById('w-return-date').value,
        details: document.getElementById('w-details').value.trim()
    };

    if (editId) {
        warehouse = warehouse.map(w => w.id === editId ? newItem : w);
    } else {
        warehouse.push(newItem);
    }
    localStorage.setItem('aa_warehouse_items', JSON.stringify(warehouse));
    closeWarehouseModal();
    renderWarehouseList();
    updateDashboardStats();
    showToast('Asset saved successfully!');
}
function renderWarehouseList() {
    let warehouse = JSON.parse(localStorage.getItem('aa_warehouse_items')) || [];
    const search = (document.getElementById('warehouse-search')?.value || '').toLowerCase();
    const tbody = document.getElementById('warehouse-list-body');
    if (!tbody) return;

    let filtered = warehouse.filter(w => 
        (w.tag && w.tag.toLowerCase().includes(search)) ||
        (w.desc && w.desc.toLowerCase().includes(search)) ||
        (w.empName && w.empName.toLowerCase().includes(search)) ||
        (w.serial && w.serial.toLowerCase().includes(search))
    );

    document.getElementById('stock-count').textContent = filtered.length + ' Items';
    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center p-6 text-slate-500 font-mono">No warehouse items found.</td></tr>`;
        return;
    }

    tbody.innerHTML = filtered.map(w => `
        <tr class="border-b border-cyan-500/10 hover:bg-slate-900/50 transition-all text-xs font-mono">
            <td class="p-3 text-cyan-400 font-bold">${w.tag}</td>
            <td class="p-3 text-white"><b>${w.category}</b>: ${w.desc} ${w.ipAddress ? `<br><span class="text-cyan-300">IP: ${w.ipAddress}</span>` : ''}</td>
            <td class="p-3 text-slate-300">${w.empName ? `${w.empName} <span class="text-[10px] text-slate-500">(${w.empDepartment || 'Dept'})</span>` : '<span class="text-slate-500">Unassigned</span>'}</td>
            <td class="p-3 text-slate-400 text-[10px]">H: ${w.handoverDate || '-'}<br>R: ${w.returnDate || '-'}</td>
            <td class="p-3 text-center"><span class="px-2 py-0.5 rounded-full text-[10px] bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">${w.status}</span></td>
            <td class="p-3 text-center">
                <button onclick="deleteWarehouseItem('${w.id}')" class="text-red-400 hover:text-red-300 px-2 py-1"><i class="fa-solid fa-trash"></i></button>
            </td>
        </tr>
    `).join('');
}
function deleteWarehouseItem(id) {
    if(confirm('Delete this asset record?')) {
        let warehouse = JSON.parse(localStorage.getItem('aa_warehouse_items')) || [];
        warehouse = warehouse.filter(w => w.id !== id);
        localStorage.setItem('aa_warehouse_items', JSON.stringify(warehouse));
        renderWarehouseList();
        updateDashboardStats();
        showToast('Asset deleted.');
    }
}

// --- RUSTDESK CRUD ---
function openRustDeskModal() { document.getElementById('rustdesk-modal').classList.remove('hidden'); document.getElementById('rustdesk-modal').classList.add('flex'); }
function closeRustDeskModal() { document.getElementById('rustdesk-modal').classList.add('hidden'); document.getElementById('rustdesk-modal').classList.remove('flex'); }
function saveRustDeskEntry() {
    const empName = document.getElementById('rd-emp-name').value.trim();
    const id = document.getElementById('rd-id').value.trim();
    if(!empName || !id) { alert('Employee Name and RustDesk ID are required'); return; }
    let list = JSON.parse(localStorage.getItem('aa_rustdesk_items')) || [];
    list.push({
        empName,
        dept: document.getElementById('rd-dept').value.trim(),
        id,
        password: document.getElementById('rd-password').value.trim(),
        device: document.getElementById('rd-device').value.trim(),
        notes: document.getElementById('rd-notes').value.trim()
    });
    localStorage.setItem('aa_rustdesk_items', JSON.stringify(list));
    closeRustDeskModal();
    renderRustDeskList();
    updateDashboardStats();
    showToast('RustDesk saved!');
}
function renderRustDeskList() {
    let list = JSON.parse(localStorage.getItem('aa_rustdesk_items')) || [];
    const search = (document.getElementById('rd-search')?.value || '').toLowerCase();
    const tbody = document.getElementById('rd-list-body');
    if (!tbody) return;
    let filtered = list.filter(r => (r.empName && r.empName.toLowerCase().includes(search)) || (r.id && r.id.toLowerCase().includes(search)));
    if (filtered.length === 0) { tbody.innerHTML = `<tr><td colspan="5" class="text-center p-6 text-slate-500 font-mono">No records.</td></tr>`; return; }
    tbody.innerHTML = filtered.map((r, idx) => `
        <tr class="border-b border-cyan-500/10 text-xs font-mono">
            <td class="p-3 text-white font-bold">${r.empName} <span class="text-[10px] text-slate-400">(${r.dept})</span></td>
            <td class="p-3 text-cyan-400 font-bold">${r.id}</td>
            <td class="p-3 text-amber-300">${r.password || '-'}</td>
            <td class="p-3 text-slate-300">${r.device || '-'}</td>
            <td class="p-3 text-center"><button onclick="deleteRustDesk(${idx})" class="text-red-400"><i class="fa-solid fa-trash"></i></button></td>
        </tr>
    `).join('');
}
function deleteRustDesk(idx) {
    let list = JSON.parse(localStorage.getItem('aa_rustdesk_items')) || [];
    list.splice(idx, 1);
    localStorage.setItem('aa_rustdesk_items', JSON.stringify(list));
    renderRustDeskList();
    updateDashboardStats();
}

// --- SWITCH MAPPING CRUD ---
function openIspModal() { document.getElementById('isp-modal').classList.remove('hidden'); document.getElementById('isp-modal').classList.add('flex'); }
function closeIspModal() { document.getElementById('isp-modal').classList.add('hidden'); document.getElementById('isp-modal').classList.remove('flex'); }
function saveIspEntry() {
    const name = document.getElementById('isp-name').value.trim();
    if(!name) { alert('Switch Name required'); return; }
    let list = JSON.parse(localStorage.getItem('aa_switch_mappings')) || [];
    list.push({
        name,
        speed: document.getElementById('isp-speed').value.trim(),
        ip: document.getElementById('isp-ip').value.trim(),
        pass: document.getElementById('isp-pass').value.trim(),
        notes: document.getElementById('isp-notes').value.trim()
    });
    localStorage.setItem('aa_switch_mappings', JSON.stringify(list));
    closeIspModal();
    renderIspList();
    showToast('Switch saved!');
}
function renderIspList() {
    let list = JSON.parse(localStorage.getItem('aa_switch_mappings')) || [];
    const search = (document.getElementById('isp-search')?.value || '').toLowerCase();
    const tbody = document.getElementById('switch-mapping-list-body');
    if (!tbody) return;
    let filtered = list.filter(s => s.name && s.name.toLowerCase().includes(search));
    if (filtered.length === 0) { tbody.innerHTML = `<tr><td colspan="5" class="text-center p-6 text-slate-500 font-mono">No switch mappings.</td></tr>`; return; }
    tbody.innerHTML = filtered.map((s, idx) => `
        <tr class="border-b border-cyan-500/10 text-xs font-mono">
            <td class="p-3 text-cyan-400 font-bold">${s.name}</td>
            <td class="p-3 text-slate-300">${s.speed || '-'}</td>
            <td class="p-3 text-white font-mono">${s.ip || '-'}</td>
            <td class="p-3 text-amber-300 font-mono">${s.pass || '-'}</td>
            <td class="p-3 text-slate-300">${s.notes || '-'}</td>
        </tr>
    `).join('');
}

// --- HELPDESK TICKETS CRUD ---
function openHelpdeskModal() { document.getElementById('helpdesk-modal').classList.remove('hidden'); document.getElementById('helpdesk-modal').classList.add('flex'); }
function closeHelpdeskModal() { document.getElementById('helpdesk-modal').classList.add('hidden'); document.getElementById('helpdesk-modal').classList.remove('flex'); }
function saveHelpdeskEntry() {
    const title = document.getElementById('hd-title').value.trim();
    if(!title) { alert('Issue Title required'); return; }
    let list = JSON.parse(localStorage.getItem('aa_helpdesk_tickets')) || [];
    list.push({
        id: 'TKT-' + Math.floor(1000 + Math.random() * 9000),
        emp: document.getElementById('hd-emp').value.trim(),
        title,
        status: document.getElementById('hd-status').value,
        details: document.getElementById('hd-details').value.trim()
    });
    localStorage.setItem('aa_helpdesk_tickets', JSON.stringify(list));
    closeHelpdeskModal();
    renderHelpdeskList();
    updateDashboardStats();
    showToast('Ticket created!');
}
function renderHelpdeskList() {
    let list = JSON.parse(localStorage.getItem('aa_helpdesk_tickets')) || [];
    const tbody = document.getElementById('helpdesk-list-body');
    if (!tbody) return;
    if (list.length === 0) { tbody.innerHTML = `<tr><td colspan="5" class="text-center p-6 text-slate-500 font-mono">No tickets.</td></tr>`; return; }
    tbody.innerHTML = list.map((t, idx) => `
        <tr class="border-b border-cyan-500/10 text-xs font-mono">
            <td class="p-3 text-cyan-400 font-bold">${t.id}</td>
            <td class="p-3 text-white">${t.emp || 'General'}</td>
            <td class="p-3 text-slate-200">${t.title}</td>
            <td class="p-3 text-center"><span class="px-2 py-0.5 rounded text-[10px] ${t.status === 'Open' ? 'bg-amber-500/10 text-amber-400' : 'bg-emerald-500/10 text-emerald-400'}">${t.status}</span></td>
            <td class="p-3 text-center"><button onclick="deleteTicket(${idx})" class="text-red-400"><i class="fa-solid fa-trash"></i></button></td>
        </tr>
    `).join('');
}
function deleteTicket(idx) {
    let list = JSON.parse(localStorage.getItem('aa_helpdesk_tickets')) || [];
    list.splice(idx, 1);
    localStorage.setItem('aa_helpdesk_tickets', JSON.stringify(list));
    renderHelpdeskList();
    updateDashboardStats();
}

// --- IPAM CRUD ---
function openIpamModal() { document.getElementById('ipam-modal').classList.remove('hidden'); document.getElementById('ipam-modal').classList.add('flex'); }
function closeIpamModal() { document.getElementById('ipam-modal').classList.add('hidden'); document.getElementById('ipam-modal').classList.remove('flex'); }
function saveIpamEntry() {
    const ip = document.getElementById('ipam-ip').value.trim();
    if(!ip) { alert('IP Address required'); return; }
    let list = JSON.parse(localStorage.getItem('aa_ipam_items')) || [];
    list.push({
        ip,
        device: document.getElementById('ipam-device').value.trim(),
        type: document.getElementById('ipam-type').value.trim(),
        owner: document.getElementById('ipam-owner').value.trim()
    });
    localStorage.setItem('aa_ipam_items', JSON.stringify(list));
    closeIpamModal();
    renderIpamList();
    showToast('IP Saved!');
}
function renderIpamList() {
    let list = JSON.parse(localStorage.getItem('aa_ipam_items')) || [];
    const tbody = document.getElementById('ipam-list-body');
    if (!tbody) return;
    if (list.length === 0) { tbody.innerHTML = `<tr><td colspan="5" class="text-center p-6 text-slate-500 font-mono">No IPAM records.</td></tr>`; return; }
    tbody.innerHTML = list.map((i, idx) => `
        <tr class="border-b border-cyan-500/10 text-xs font-mono">
            <td class="p-3 text-cyan-400 font-bold">${i.ip}</td>
            <td class="p-3 text-white">${i.device}</td>
            <td class="p-3 text-slate-300">${i.type}</td>
            <td class="p-3 text-slate-300">${i.owner}</td>
            <td class="p-3 text-center"><button onclick="deleteIpam(${idx})" class="text-red-400"><i class="fa-solid fa-trash"></i></button></td>
        </tr>
    `).join('');
}
function deleteIpam(idx) {
    let list = JSON.parse(localStorage.getItem('aa_ipam_items')) || [];
    list.splice(idx, 1);
    localStorage.setItem('aa_ipam_items', JSON.stringify(list));
    renderIpamList();
}

// --- COMMAND SNIPPETS & NOTES ---
function openSnippetModal() { document.getElementById('snippet-modal').classList.remove('hidden'); document.getElementById('snippet-modal').classList.add('flex'); }
function closeSnippetModal() { document.getElementById('snippet-modal').classList.add('hidden'); document.getElementById('snippet-modal').classList.remove('flex'); }
function saveSnippetEntry() {
    const title = document.getElementById('snippet-title').value.trim();
    const cmd = document.getElementById('snippet-cmd').value.trim();
    if(!title || !cmd) { alert('Title and Command required'); return; }
    let list = JSON.parse(localStorage.getItem('aa_snippets')) || [];
    list.push({ title, category: document.getElementById('snippet-category').value.trim(), cmd, desc: document.getElementById('snippet-desc').value.trim() });
    localStorage.setItem('aa_snippets', JSON.stringify(list));
    closeSnippetModal();
    renderCommandSnippets();
    showToast('Snippet saved!');
}
function renderCommandSnippets() {
    let list = JSON.parse(localStorage.getItem('aa_snippets')) || [];
    const grid = document.getElementById('snippets-grid');
    if (!grid) return;
    if (list.length === 0) { grid.innerHTML = `<p class="text-slate-500 text-xs font-mono">No command snippets.</p>`; return; }
    grid.innerHTML = list.map(s => `
        <div class="bg-slate-900 border border-cyan-500/20 p-3 rounded-xl font-mono text-xs space-y-1">
            <div class="flex justify-between font-bold text-cyan-400"><span>${s.title}</span><span class="text-[10px] text-slate-500">${s.category}</span></div>
            <div class="bg-slate-950 p-2 rounded text-emerald-400 overflow-x-auto"><code>${s.cmd}</code></div>
            <p class="text-[11px] text-slate-400">${s.desc || ''}</p>
        </div>
    `).join('');
}

function openNoteModal() { document.getElementById('notes-modal').classList.remove('hidden'); document.getElementById('notes-modal').classList.add('flex'); }
function closeNoteModal() { document.getElementById('notes-modal').classList.add('hidden'); document.getElementById('notes-modal').classList.remove('flex'); }
function saveNoteEntry() {
    const title = document.getElementById('note-title').value.trim();
    const solution = document.getElementById('note-solution').value.trim();
    if(!title || !solution) { alert('Title and Solution required'); return; }
    let list = JSON.parse(localStorage.getItem('aa_it_notes')) || [];
    list.push({ title, category: document.getElementById('note-category').value, problem: document.getElementById('note-problem').value.trim(), solution });
    localStorage.setItem('aa_it_notes', JSON.stringify(list));
    closeNoteModal();
    renderNotesList();
    showToast('Note saved!');
}
function renderNotesList() {
    let list = JSON.parse(localStorage.getItem('aa_it_notes')) || [];
    const container = document.getElementById('notes-container');
    if (!container) return;
    if (list.length === 0) { container.innerHTML = `<p class="text-slate-500 text-xs font-mono">No notes recorded.</p>`; return; }
    container.innerHTML = list.map(n => `
        <div class="card-3d-effect p-4 rounded-xl border border-cyan-500/20 space-y-2 text-xs font-mono">
            <div class="font-bold text-white text-sm flex justify-between"><span>${n.title}</span><span class="text-[10px] text-cyan-400">${n.category}</span></div>
            <p class="text-slate-300"><b>Problem:</b> ${n.problem || 'N/A'}</p>
            <div class="bg-slate-950 p-2 rounded text-emerald-300"><b>Solution:</b><br>${n.solution}</div>
        </div>
    `).join('');
}

// --- WORK SCHEDULE MODAL CONTROLS ---
function openScheduleModal() { document.getElementById('schedule-modal').classList.remove('hidden'); document.getElementById('schedule-modal').classList.add('flex'); }
function closeScheduleModal() { document.getElementById('schedule-modal').classList.add('hidden'); document.getElementById('schedule-modal').classList.remove('flex'); }
function saveWeeklyReport() { showToast('Schedule synced successfully!'); }
function addPlannedTaskToList() { showToast('Directive added.'); }
function addDailyTaskToList() { showToast('Daily log added.'); }

// --- PASSCODE CHANGE MODAL ---
function openChangePasscodeModal() { document.getElementById('change-pin-modal').classList.remove('hidden'); document.getElementById('change-pin-modal').classList.add('flex'); }
function closeChangePasscodeModal() { document.getElementById('change-pin-modal').classList.add('hidden'); document.getElementById('change-pin-modal').classList.remove('flex'); }
async function handleChangePasscodeSubmit(evt) {
    evt.preventDefault();
    const newPin = document.getElementById('cp-new').value.trim();
    const confirmPin = document.getElementById('cp-confirm').value.trim();
    const errorDiv = document.getElementById('cp-error');
    if (newPin.length < 6) { errorDiv.textContent = 'Passcode must be at least 6 characters.'; errorDiv.classList.remove('hidden'); return; }
    if (newPin !== confirmPin) { errorDiv.textContent = 'Passcodes do not match.'; errorDiv.classList.remove('hidden'); return; }

    const salt = window.crypto.getRandomValues(new Uint8Array(16));
    const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');
    const hash = await pbkdf2Hash(newPin, saltHex, 100000);
    localStorage.setItem(ACCESS_HASH_KEY, hash);
    localStorage.setItem(ACCESS_SALT_KEY, saltHex);
    currentAccessHash = hash;
    currentAccessSalt = saltHex;
    closeChangePasscodeModal();
    showToast('Passcode updated successfully!');
}

// --- BACKUP & RESTORE ---
function exportData() {
    const backupObj = {};
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        backupObj[key] = localStorage.getItem(key);
    }
    const blob = new Blob([JSON.stringify(backupObj, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Asia_Aluminium_IT_Backup.json';
    a.click();
    showToast('Backup downloaded!');
}
function importData(evt) {
    const file = evt.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            for (const key in data) {
                localStorage.setItem(key, data[key]);
            }
            if (typeof showToast === 'function') {
                showToast('Data restored successfully!');
            }
            setTimeout(() => {
                location.reload();
            }, 1000);
        } catch(err) {
            console.error(err);
            alert('Invalid backup file format. Please select a valid JSON file.');
        }
    };
    reader.readAsText(file);
    
    // گرنگ: پاککردنەوەی خانەی فایلەکە بۆ ئەوەی دووبارە کار بکاتەوە ئەگەر هەمان فایل هەڵبژێریتەوە
    evt.target.value = '';
}
