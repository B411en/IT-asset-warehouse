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
let notesDb = [];

/* ================= MODAL LOGICS ================= */
function openEmpModal() { document.getElementById('emp-modal').classList.remove('hidden'); document.getElementById('emp-modal').classList.add('flex'); }
function closeEmpModal() { document.getElementById('emp-modal').classList.add('hidden'); clearEmployeeForm(); }

function openWarehouseModal() { document.getElementById('warehouse-modal').classList.remove('hidden'); document.getElementById('warehouse-modal').classList.add('flex'); generateAutoAssetTag(); }
function closeWarehouseModal() { document.getElementById('warehouse-modal').classList.add('hidden'); clearWarehouseForm(); }

function openRustDeskModal() { document.getElementById('rustdesk-modal').classList.remove('hidden'); document.getElementById('rustdesk-modal').classList.add('flex'); }
function closeRustDeskModal() { document.getElementById('rustdesk-modal').classList.add('hidden'); clearRustDeskForm(); }

function openIspModal() { document.getElementById('isp-modal').classList.remove('hidden'); document.getElementById('isp-modal').classList.add('flex'); }
function closeIspModal() { document.getElementById('isp-modal').classList.add('hidden'); clearIspForm(); }

function openHelpdeskModal() { document.getElementById('helpdesk-modal').classList.remove('hidden'); document.getElementById('helpdesk-modal').classList.add('flex'); }
function closeHelpdeskModal() { document.getElementById('helpdesk-modal').classList.add('hidden'); clearHelpdeskForm(); }

function openIpamModal() { document.getElementById('ipam-modal').classList.remove('hidden'); document.getElementById('ipam-modal').classList.add('flex'); }
function closeIpamModal() { document.getElementById('ipam-modal').classList.add('hidden'); clearIpamForm(); }

function openNoteModal() { document.getElementById('notes-modal').classList.remove('hidden'); document.getElementById('notes-modal').classList.add('flex'); }
function closeNoteModal() { document.getElementById('notes-modal').classList.add('hidden'); clearNoteForm(); }

/* ================= UTILS & ACCESS ================= */
function bytesToHex(bytes) { return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join(''); }
function hexToBytes(hex) {
    const arr = new Uint8Array(hex.length / 2);
    for (let i = 0; i < arr.length; i++) arr[i] = parseInt(hex.substr(i * 2, 2), 16);
    return arr;
}
async function pbkdf2Hash(passcode, saltHex, iterations) {
    const keyMaterial = await crypto.subtle.importKey('raw', new TextEncoder().encode(passcode), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: hexToBytes(saltHex), iterations, hash: 'SHA-256' }, keyMaterial, 256);
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
        } else { accessState = 'unconfigured'; }
    } catch (e) { accessState = 'unconfigured'; }
}

/* ================= DATA LISTENERS ================= */
function attachDataListeners() {
    database.ref('it_employees_directory').on('value', (s) => {
        employeesDb = s.val() ? Object.values(s.val()) : [];
        if(document.getElementById('dash-total-employees')) document.getElementById('dash-total-employees').innerText = employeesDb.length;
        renderEmployeesList();
        populateWarehouseEmployeeDropdown();
    });
    database.ref('it_warehouse_inventory').on('value', (s) => {
        wDb = s.val() ? Object.values(s.val()) : [];
        if(document.getElementById('dash-total-warehouse')) document.getElementById('dash-total-warehouse').innerText = wDb.length;
        renderWarehouseList();
        updateDashboardCharts();
    });
    database.ref('it_rustdesk_devices').on('value', (s) => {
        rustdeskDb = s.val() ? Object.values(s.val()) : [];
        if(document.getElementById('dash-total-rustdesk')) document.getElementById('dash-total-rustdesk').innerText = rustdeskDb.length;
        renderRustDeskList();
    });
    database.ref('it_switches').on('value', (s) => {
        switchesDb = s.val() ? Object.values(s.val()) : [];
        renderIspList();
    });
    database.ref('it_helpdesk_tickets').on('value', (s) => {
        helpdeskDb = s.val() ? Object.values(s.val()) : [];
        const openTickets = helpdeskDb.filter(t => t.status === 'Open' || t.status === 'In Progress').length;
        if(document.getElementById('dash-total-tickets')) document.getElementById('dash-total-tickets').innerText = openTickets;
        renderHelpdeskList();
    });
    database.ref('it_ipam_subnets').on('value', (s) => {
        ipamDb = s.val() ? Object.values(s.val()) : [];
        renderIpamList();
    });
    database.ref('it_knowledge_notes').on('value', (s) => {
        notesDb = s.val() ? Object.values(s.val()) : [];
        renderNotesList();
    });
    
    // کۆچپێکردنی بڕگە دێرینەکانی Work Schedule بۆ ناو Tickets
    migrateWorkScheduleToHelpdesk();
}

/* ================= MIGRATION SCRIPT ================= */
function migrateWorkScheduleToHelpdesk() {
    database.ref('it_weekly_plans').once('value', (snapshot) => {
        const data = snapshot.val();
        if (!data) return;

        const updates = {};
        if (data.plannedTasks && Array.isArray(data.plannedTasks)) {
            data.plannedTasks.forEach(task => {
                const key = "HD-MIG-" + Date.now() + "-" + Math.floor(Math.random() * 1000);
                updates['it_helpdesk_tickets/' + key] = {
                    id: key, emp: data.author || "IT Directive",
                    title: `[Schedule Task] ${task.type || 'General'}`,
                    status: task.priority === 'High' ? 'Open' : 'In Progress',
                    details: `[Priority: ${task.priority}] ${task.details} (Date: ${task.taskDate})`,
                    updated: task.taskDate || new Date().toLocaleDateString('en-GB')
                };
            });
        }
        if (data.dailyTasks && Array.isArray(data.dailyTasks)) {
            data.dailyTasks.forEach(task => {
                const key = "HD-MIG-D-" + Date.now() + "-" + Math.floor(Math.random() * 1000);
                updates['it_helpdesk_tickets/' + key] = {
                    id: key, emp: data.author || "IT Log",
                    title: `[Daily Accomplishment]`, status: 'Resolved',
                    details: `${task.details} (Date: ${task.taskDate})`,
                    updated: task.taskDate || new Date().toLocaleDateString('en-GB')
                };
            });
        }
        updates['it_weekly_plans'] = null;
        database.ref().update(updates).then(() => {
            showToast("Work Schedule tasks imported to Tickets!");
        });
    });
}

/* ================= UNLOCK APP ================= */
function unlockApp() {
    const lockScreen = document.getElementById('lock-screen');
    const appRoot = document.getElementById('app-root');
    if(lockScreen) lockScreen.remove();
    if(appRoot) { appRoot.classList.remove('hidden'); appRoot.classList.add('flex'); }
    attachDataListeners();
}

async function handleUnlockSubmit(evt) {
    evt.preventDefault();
    const input = document.getElementById('lock-pin-input');
    const val = input.value.trim();
    if(!val) return false;
    const enteredHash = await pbkdf2Hash(val, currentAccessSalt, currentAccessIterations);
    if(enteredHash === currentAccessHash) {
        try { sessionStorage.setItem(LOCK_SESSION_KEY, '1'); } catch(e) {}
        unlockApp();
    } else {
        alert("Incorrect passcode!");
    }
    return false;
}

async function initApp() {
    const lockForm = document.getElementById('lock-form');
    await loadAccessSettings();
    if(accessState === 'unconfigured') { unlockApp(); return; }
    let alreadyUnlocked = false;
    try { alreadyUnlocked = sessionStorage.getItem(LOCK_SESSION_KEY) === '1'; } catch(e) {}
    if(alreadyUnlocked) { unlockApp(); return; }
    
    document.getElementById('lock-pin-input')?.removeAttribute('disabled');
    lockForm.querySelector('button[type="submit"]')?.removeAttribute('disabled');
    lockForm.addEventListener('submit', handleUnlockSubmit);
}

document.addEventListener('DOMContentLoaded', initApp);

/* ================= TAB SWITCHING ================= */
function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => { el.classList.add('hidden'); el.classList.remove('block'); });
    const target = document.getElementById(tabId);
    if(target) { target.classList.remove('hidden'); target.classList.add('block'); }
    if (tabId === 'dashboard-tab') updateDashboardCharts();
}

function updateDashboardCharts() {
    const wCounts = { "Laptop": 0, "PC": 0, "Cable": 0, "Printer": 0, "Monitor": 0, "Switch": 0, "Hub": 0, "IP camera": 0, "NVR": 0, "Other": 0 };
    wDb.forEach(item => { if(wCounts[item.category] !== undefined) wCounts[item.category] += parseInt(item.quantity || 1); else wCounts["Other"] += parseInt(item.quantity || 1); });
    const ctxW = document.getElementById('dashWarehouseChart')?.getContext('2d');
    if(ctxW) {
        if (dashWarehouseChartInstance) dashWarehouseChartInstance.destroy();
        dashWarehouseChartInstance = new Chart(ctxW, {
            type: 'doughnut',
            data: { labels: Object.keys(wCounts), datasets: [{ data: Object.values(wCounts), backgroundColor: ['#4f46e5','#2563eb','#0891b2','#0d9488','#059669','#65a30d','#d97706','#ea580c','#dc2626','#7c3aed'] }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#94a3b8' } } } }
        });
    }
}

/* ================= IPAM LOGIC (ONLINE/OFFLINE FEATURE) ================= */
function saveIpamEntry() {
    const editId = document.getElementById('ipam-edit-id')?.value || '';
    const ip = document.getElementById('ipam-ip')?.value.trim() || '';
    const device = document.getElementById('ipam-device')?.value.trim() || '';
    const status = document.getElementById('ipam-status')?.value || 'Online';
    const type = document.getElementById('ipam-type')?.value.trim() || '';
    const owner = document.getElementById('ipam-owner')?.value.trim() || '';
    const notes = document.getElementById('ipam-notes')?.value.trim() || '';
    
    if(!ip || !device) { alert("Please enter IP Address and Device Name!"); return; }
    
    const key = editId ? editId : "IPAM-" + Date.now();
    const payload = { id: key, ip, device, status, type, owner, notes, updated: new Date().toLocaleDateString('en-GB') };
    
    database.ref('it_ipam_subnets/' + key).set(payload).then(() => {
        closeIpamModal();
        showToast("Static IP Recorded!");
    });
}

function renderIpamList() {
    const tbody = document.getElementById('ipam-list-body'); if(!tbody) return;
    const s = document.getElementById('ipam-search')?.value.toLowerCase() || '';
    tbody.innerHTML = "";
    
    const filtered = ipamDb.filter(i => (i.ip || '').toLowerCase().includes(s) || (i.device || '').toLowerCase().includes(s));
    if(filtered.length === 0) { tbody.innerHTML = `<tr><td colspan="8" class="text-center p-6 text-slate-500">No static IP records found.</td></tr>`; return; }
    
    filtered.forEach(item => {
        // ڕەنگی ئۆنلاین (سەوز) یان ئۆفلاین (سوور)
        const statusHtml = item.status === 'Online'
            ? `<span class="text-emerald-400 font-bold bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20 text-[10px]"><i class="fa-solid fa-circle text-[8px] mr-1"></i>Online</span>`
            : `<span class="text-red-400 font-bold bg-red-500/10 px-2.5 py-1 rounded-full border border-red-500/20 text-[10px]"><i class="fa-solid fa-circle text-[8px] mr-1"></i>Offline</span>`;

        const tr = document.createElement('tr');
        tr.className = "border-b border-slate-800 text-xs hover:bg-slate-800/40";
        tr.innerHTML = `
            <td class="p-3 font-mono font-bold text-blue-400">${item.ip}</td>
            <td class="p-3 font-bold text-white">${item.device}</td>
            <td class="p-3 text-amber-400">${item.type || '-'}</td>
            <td class="p-3 text-slate-300">${item.owner || '-'}</td>
            <td class="p-3 font-mono text-emerald-400">••••••••</td>
            <td class="p-3 text-center">${statusHtml}</td>
            <td class="p-3 text-slate-400 text-[11px]">${item.notes || '-'}</td>
            <td class="p-3 text-center flex justify-center gap-2">
                <button onclick="editIpamItem('${item.id}')" class="text-blue-400"><i class="fa-solid fa-pen-to-square"></i></button>
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
    document.getElementById('ipam-notes').value = '';
}

function deleteIpamItem(id) {
    if(!confirm("Delete this IP entry?")) return;
    database.ref('it_ipam_subnets/' + id).remove().then(() => showToast("IP Entry Deleted"));
}

/* ================= WAREHOUSE LOGIC & PRINT HANDOVER FORM ================= */
function renderWarehouseList() {
    const tbody = document.getElementById('warehouse-list-body'); if(!tbody) return;
    const searchInput = document.getElementById('warehouse-search');
    const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : "";
    tbody.innerHTML = "";
    
    const filtered = wDb.filter(item => {
        const tag = (item.assetTag || "").toLowerCase();
        const emp = (item.empName || "").toLowerCase();
        const desc = (item.desc || "").toLowerCase();
        return tag.includes(searchTerm) || emp.includes(searchTerm) || desc.includes(searchTerm);
    });
    
    filtered.forEach(item => {
        const tr = document.createElement('tr');
        tr.className = "border-b border-slate-800 text-xs hover:bg-slate-800/40";
        tr.innerHTML = `
            <td class="p-3 font-mono font-bold text-red-400">${item.assetTag}</td>
            <td class="p-3">
                <span class="font-bold text-white block">${item.category}</span>
                <span class="text-slate-400 text-[10px]">${item.desc}</span>
            </td>
            <td class="p-3"><span class="font-bold text-white block">${item.empName || 'Unassigned'}</span></td>
            <td class="p-3 text-[10px] text-slate-300">${item.handoverDate || '-'}</td>
            <td class="p-3 text-center"><span class="px-2.5 py-1 rounded-full text-[10px] font-bold border bg-blue-500/20 text-blue-400">${item.status}</span></td>
            <td class="p-3 text-center">
                <div class="flex justify-center gap-2">
                    <button onclick="printHandoverForm('${item.id}')" title="Print Handover Form" class="text-amber-400 hover:text-amber-300">
                        <i class="fa-solid fa-file-signature"></i>
                    </button>
                    <button onclick="editWarehouseItem('${item.id}')" class="text-blue-400"><i class="fa-solid fa-pen-to-square"></i></button>
                    <button onclick="deleteWarehouseItem('${item.id}')" class="text-slate-500 hover:text-red-400"><i class="fa-solid fa-trash"></i></button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

/* چاپکردنی فۆرمی تەسلیمکردن (IT HANDOVER PRINT FORM) */
function printHandoverForm(itemId) {
    const item = wDb.find(i => i.id === itemId);
    if (!item) { alert("Asset record not found!"); return; }

    const empItems = item.empId ? wDb.filter(i => i.empId === item.empId) : [item];
    const printWindow = window.open('', '_blank');
    
    let tableRowsHtml = empItems.map((i, index) => `
        <tr>
            <td style="border: 1px solid #333; padding: 8px; text-align: center;">${index + 1}</td>
            <td style="border: 1px solid #333; padding: 8px; font-weight: bold;">${i.assetTag}</td>
            <td style="border: 1px solid #333; padding: 8px;">${i.category} - ${i.desc}</td>
            <td style="border: 1px solid #333; padding: 8px;">${i.serial || 'N/A'}</td>
            <td style="border: 1px solid #333; padding: 8px; text-align: center;">${i.quantity || 1}</td>
        </tr>
    `).join('');

    const formTemplate = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <title>IT Handover Form - ${item.empName || 'Employee'}</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 30px; color: #000; background: #fff; }
            .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px; }
            .header h1 { margin: 0; font-size: 18pt; }
            .header h3 { margin: 5px 0 0 0; font-size: 11pt; color: #444; }
            .info-table { width: 100%; margin-bottom: 20px; font-size: 10pt; }
            .info-table td { padding: 5px; }
            table.data { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 10pt; }
            table.data th { border: 1px solid #000; padding: 8px; background-color: #f2f2f2; }
            .terms { font-size: 9pt; border: 1px solid #ccc; padding: 10px; margin-bottom: 30px; background-color: #fcfcfc; }
            .signatures { display: flex; justify-content: space-between; margin-top: 40px; }
            .sig-box { width: 40%; text-align: center; border-top: 1px solid #000; padding-top: 8px; font-size: 10pt; }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>ASIA ALUMINIUM COMPANY</h1>
            <h3>IT Department - Asset Handover & Receipt Form</h3>
        </div>

        <table class="info-table">
            <tr>
                <td><strong>Employee Name:</strong> ${item.empName || '___________________'}</td>
                <td><strong>Position:</strong> ${item.empPosition || '___________________'}</td>
            </tr>
            <tr>
                <td><strong>Employee ID:</strong> ${item.empId || '___________________'}</td>
                <td><strong>Handover Date:</strong> ${item.handoverDate || new Date().toLocaleDateString()}</td>
            </tr>
            <tr>
                <td><strong>Department:</strong> ${item.empDepartment || '___________________'}</td>
                <td><strong>Location:</strong> ${item.location || 'Main Office'}</td>
            </tr>
        </table>

        <h4>Assigned Equipment List:</h4>
        <table class="data">
            <thead>
                <tr>
                    <th>#</th>
                    <th>Asset Tag</th>
                    <th>Description / Model</th>
                    <th>Serial Number</th>
                    <th>Qty</th>
                </tr>
            </thead>
            <tbody>
                ${tableRowsHtml}
            </tbody>
        </table>

        <div class="terms">
            <strong>پەیماننامە / Declaration:</strong><br>
            بەڕێزەوە دان بە وەرهێنانی ئەم ئامێرانەی سەرەوەدا دەنێم بە باری دروست و تەندروست. بەڵێن دەدەم بۆ کارە فەرمییەکان بەکاری بهێنم و بپارێزگارێتی لێ بکەم، و لە کاتی داواکردنەوە یان کۆتایی هاتنی کارەکەمدای بگەڕێنمەوە.
        </div>

        <div class="signatures">
            <div class="sig-box">
                <strong>IT Officer Signature</strong><br><br>
                <span>Ballen Saman</span><br>
                <small>Date: ____ / ____ / ________</small>
            </div>
            <div class="sig-box">
                <strong>Receiver Signature</strong><br><br>
                <span>${item.empName || 'Employee Name'}</span><br>
                <small>Date: ____ / ____ / ________</small>
            </div>
        </div>
    </body>
    </html>
    `;

    printWindow.document.write(formTemplate);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); }, 500);
}

/* ================= OTHER BASIC FUNCTIONS ================= */
function showToast(m) {
    const t = document.getElementById('toast'); 
    if(!t) return;
    document.getElementById('toast-msg').innerText = m;
    t.classList.remove('translate-y-28'); 
    setTimeout(() => { t.classList.add('translate-y-28'); }, 3000);
}

function populateWarehouseEmployeeDropdown() {
    const select = document.getElementById('w-emp-select'); if(!select) return;
    select.innerHTML = `<option value="">-- Choose Employee --</option>`;
    employeesDb.forEach(emp => {
        const opt = document.createElement('option');
        opt.value = emp.id; opt.textContent = `${emp.fullName} (${emp.department || 'General'})`;
        select.appendChild(opt);
    });
}

function onWarehouseEmployeeSelected() {
    const empIdVal = document.getElementById('w-emp-select')?.value;
    const emp = employeesDb.find(e => e.id === empIdVal);
    if(emp) {
        document.getElementById('w-emp-name').value = emp.fullName || '';
        document.getElementById('w-emp-id').value = emp.empId || '';
        document.getElementById('w-emp-department').value = emp.department || '';
    }
}

function toggleIpField() {}
function generateAutoAssetTag() {}
function clearEmployeeForm() {}
function clearWarehouseForm() {}
function clearRustDeskForm() {}
function clearIspForm() {}
function clearHelpdeskForm() {}
function clearNoteForm() {}
function logItemToWarehouse() {}
function saveEmployeeEntry() {}
function saveRustDeskEntry() {}
function saveIspEntry() {}
function saveHelpdeskEntry() {}
function saveNoteEntry() {}
function renderEmployeesList() {}
function renderRustDeskList() {}
function renderIspList() {}
function renderHelpdeskList() {}
function renderNotesList() {}
function renderCommandSnippets() {}
function exportData() {}
function exportToExcel() {}
function importData() {}
function openChangePasscodeModal() {}
function closeChangePasscodeModal() {}
