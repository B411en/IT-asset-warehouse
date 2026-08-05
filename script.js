const firebaseConfig = {
    apiKey: "AIzaSyC32BVdl1WOfxij22MVBtOYeoyxfQRQMrg",
    authDomain: "it-asset-system-3462d.firebaseapp.com",
    databaseURL: "https://it-asset-system-3462d-default-rtdb.firebaseio.com",
    projectId: "it-asset-system-3462d",
    storageBucket: "it-asset-system-3462d.firebasestorage.app",
    messagingSenderId: "918668871166",
    appId: "1:918668871166:web:bac8e8ba00836ccdfc2caf"
};

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

/* ================= MODAL DISPLAY CENTER & AUTO SCROLL ================= */
function showModalCentered(id) {
    const modal = document.getElementById(id);
    if (!modal) return;
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function hideModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return;
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

/* ================= MODAL OPENERS & CLOSERS ================= */
function openEmpModal() { showModalCentered('emp-modal'); }
function closeEmpModal() { hideModal('emp-modal'); clearEmployeeForm(); }

function openWarehouseModal() { showModalCentered('warehouse-modal'); generateAutoAssetTag(); }
function closeWarehouseModal() { hideModal('warehouse-modal'); clearWarehouseForm(); }

function openRustDeskModal() { showModalCentered('rustdesk-modal'); }
function closeRustDeskModal() { hideModal('rustdesk-modal'); clearRustDeskForm(); }

function openIspModal() { showModalCentered('isp-modal'); }
function closeIspModal() { hideModal('isp-modal'); clearIspForm(); }

function openHelpdeskModal() { showModalCentered('helpdesk-modal'); }
function closeHelpdeskModal() { hideModal('helpdesk-modal'); clearHelpdeskForm(); }

function openIpamModal() { showModalCentered('ipam-modal'); }
function closeIpamModal() { hideModal('ipam-modal'); clearIpamForm(); }

function openSnippetModal() { showModalCentered('snippet-modal'); }
function closeSnippetModal() { hideModal('snippet-modal'); clearSnippetForm(); }

function openNoteModal() { showModalCentered('notes-modal'); }
function closeNoteModal() { hideModal('notes-modal'); clearNoteForm(); }

function openScheduleModal() { showModalCentered('schedule-modal'); initDefaultDates(); }
function closeScheduleModal() { hideModal('schedule-modal'); }

function openChangePasscodeModal() { showModalCentered('change-pin-modal'); }
function closeChangePasscodeModal() { hideModal('change-pin-modal'); }

/* ================= HANDOVER FORM (MULTI-ITEM WITH HANDOVER & RETURN DATES) ================= */
function openHandoverModal(id) {
    const item = wDb.find(i => i.id === id);
    if (!item) return;

    document.getElementById('ho-doc-ref').innerText = `AA-HO-${new Date().getFullYear()}-${item.assetTag || '001'}`;
    document.getElementById('ho-doc-handover-date').innerText = item.handoverDate || new Date().toLocaleDateString('en-GB');
    document.getElementById('ho-doc-return-date').innerText = item.returnDate || 'N/A (Permanent)';
    
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
            `;
            tbody.appendChild(tr);
        });
    }

    const allDetails = empAssets
        .map(a => a.details ? `• [${a.assetTag}]: ${a.details}` : null)
        .filter(Boolean)
        .join('<br>');

    document.getElementById('ho-asset-details').innerHTML = allDetails || 'No additional notes provided.';

    showModalCentered('handover-modal');
}
function closeHandoverModal() { hideModal('handover-modal'); }

/* ================= ACCESS & UNLOCK SYSTEM ================= */
function unlockApp() {
    const lockScreen = document.getElementById('lock-screen');
    const appRoot = document.getElementById('app-root');
    if (lockScreen) lockScreen.style.display = 'none';
    if (appRoot) {
        appRoot.classList.remove('hidden');
        appRoot.classList.add('flex');
    }
    initDefaultDates();
    attachDataListeners();
}

function lockApp() {
    location.reload();
}

document.getElementById('lock-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    unlockApp();
});

/* ================= REALTIME DATA LISTENERS ================= */
function attachDataListeners() {
    database.ref('it_employees_directory').on('value', (s) => {
        employeesDb = s.val() ? Object.values(s.val()) : [];
        if (document.getElementById('dash-total-employees')) document.getElementById('dash-total-employees').innerText = employeesDb.length;
        renderEmployeesList();
        populateWarehouseEmployeeDropdown();
    });
    database.ref('it_warehouse_inventory').on('value', (s) => {
        wDb = s.val() ? Object.values(s.val()) : [];
        if (document.getElementById('dash-total-warehouse')) document.getElementById('dash-total-warehouse').innerText = wDb.length;
        renderWarehouseList();
        updateDashboardCharts();
    });
    database.ref('it_rustdesk_devices').on('value', (s) => {
        rustdeskDb = s.val() ? Object.values(s.val()) : [];
        if (document.getElementById('dash-total-rustdesk')) document.getElementById('dash-total-rustdesk').innerText = rustdeskDb.length;
        renderRustDeskList();
    });
    database.ref('it_switches').on('value', (s) => {
        switchesDb = s.val() ? Object.values(s.val()) : [];
        renderIspList();
    });
    database.ref('it_helpdesk_tickets').on('value', (s) => {
        helpdeskDb = s.val() ? Object.values(s.val()) : [];
        const openTickets = helpdeskDb.filter(t => t.status === 'Open' || t.status === 'In Progress').length;
        if (document.getElementById('dash-total-tickets')) document.getElementById('dash-total-tickets').innerText = openTickets;
        renderHelpdeskList();
    });
    database.ref('it_ipam_subnets').on('value', (s) => {
        ipamDb = s.val() ? Object.values(s.val()) : [];
        renderIpamList();
    });
    database.ref('it_weekly_plans').on('value', (s) => {
        const data = s.val();
        if (data) {
            plannedTasks = data.plannedTasks || [];
            dailyTasks = data.dailyTasks || [];
        }
        renderPlannedTasksTable();
    });
    database.ref('it_knowledge_notes').on('value', (s) => {
        notesDb = s.val() ? Object.values(s.val()) : [];
        renderNotesList();
    });
    database.ref('it_command_snippets').on('value', (s) => {
        snippetsDb = s.val() ? Object.values(s.val()) : [];
        renderCommandSnippets();
    });
}

function initDefaultDates() {
    const today = new Date();
    if(document.getElementById('wr-date')) document.getElementById('wr-date').valueAsDate = today;
    if(document.getElementById('plan-task-date')) document.getElementById('plan-task-date').valueAsDate = today;
}

function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    const target = document.getElementById(tabId);
    if (target) target.classList.remove('hidden');
    
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active-tab', 'bg-gradient-to-r', 'from-cyan-600', 'to-blue-600', 'text-white'));
    const activeBtn = document.getElementById('btn-' + tabId);
    if (activeBtn) activeBtn.classList.add('active-tab', 'bg-gradient-to-r', 'from-cyan-600', 'to-blue-600', 'text-white');
    if (tabId === 'dashboard-tab') updateDashboardCharts();
}

/* ================= DASHBOARD CHARTS ================= */
function updateDashboardCharts() {
    const wCounts = { "Laptop": 0, "PC": 0, "Cable": 0, "Printer": 0, "Monitor": 0, "Switch": 0, "IP camera": 0, "NVR": 0, "Access point": 0, "Other": 0 };
    wDb.forEach(item => { 
        if(wCounts[item.category] !== undefined) wCounts[item.category] += parseInt(item.quantity || 1); else wCounts["Other"] += parseInt(item.quantity || 1);
    });
    const ctxW = document.getElementById('dashWarehouseChart')?.getContext('2d');
    if(ctxW) {
        if (dashWarehouseChartInstance) dashWarehouseChartInstance.destroy();
        dashWarehouseChartInstance = new Chart(ctxW, {
            type: 'doughnut',
            data: { labels: Object.keys(wCounts), datasets: [{ data: Object.values(wCounts), backgroundColor: ['#4f46e5','#2563eb','#0891b2','#0d9488','#059669','#65a30d','#d97706','#ea580c','#dc2626','#7c3aed'] }] },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }
}

/* ================= AUTO ASSET TAG GENERATOR ================= */
function generateAutoAssetTag() {
    const tagInput = document.getElementById('w-asset-tag');
    if (tagInput && !tagInput.value) {
        tagInput.value = "AA-AST-" + Math.floor(100 + Math.random() * 900);
    }
}

/* ================= EMPLOYEES DIRECTORY ================= */
function renderEmployeesList() {
    const tbody = document.getElementById('employees-list-body');
    if (!tbody) return;
    tbody.innerHTML = employeesDb.map((e, idx) => `
        <tr class="border-b border-slate-800 text-xs">
            <td class="p-3 font-mono">${idx + 1}</td>
            <td class="p-3 font-mono font-bold text-red-400">${e.empId}</td>
            <td class="p-3 font-bold text-white">${e.fullName}</td>
            <td class="p-3 text-slate-300">${e.position || '-'}</td>
            <td class="p-3 text-slate-300">${e.department || '-'}</td>
            <td class="p-3 text-amber-400">${e.phone || '-'}</td>
            <td class="p-3">${e.status || 'Active'}</td>
            <td class="p-3 text-center">
                <button onclick="editEmployeeItem('${e.id}')" class="text-blue-400 mr-2"><i class="fa-solid fa-pen"></i></button>
                <button onclick="deleteEmp('${e.id}')" class="text-red-400"><i class="fa-solid fa-trash"></i></button>
            </td>
        </tr>
    `).join('');
}

function saveEmployeeEntry() {
    const editId = document.getElementById('emp-edit-id')?.value;
    const empId = document.getElementById('emp-code-id')?.value;
    const fullName = document.getElementById('emp-fullname')?.value;
    if (!empId || !fullName) return alert("Please fill ID and Full Name!");
    const key = editId ? editId : "EMP-" + Date.now();
    database.ref('it_employees_directory/' + key).set({
        id: key, empId, fullName,
        position: document.getElementById('emp-position')?.value || '',
        department: document.getElementById('emp-department')?.value || '',
        section: document.getElementById('emp-section')?.value || '',
        phone: document.getElementById('emp-phone')?.value || '',
        status: document.getElementById('emp-status')?.value || 'Active'
    }).then(() => { closeEmpModal(); showToast("Employee Saved!"); });
}

function editEmployeeItem(id) {
    const item = employeesDb.find(e => e.id === id); if(!item) return;
    document.getElementById('emp-edit-id').value = item.id;
    document.getElementById('emp-code-id').value = item.empId || '';
    document.getElementById('emp-fullname').value = item.fullName || '';
    document.getElementById('emp-position').value = item.position || '';
    document.getElementById('emp-department').value = item.department || '';
    openEmpModal();
}
function clearEmployeeForm() {
    document.getElementById('emp-edit-id').value = '';
    document.getElementById('emp-code-id').value = '';
    document.getElementById('emp-fullname').value = '';
}
function deleteEmp(id) { if(confirm("Delete this employee?")) database.ref('it_employees_directory/' + id).remove(); }

/* ================= WAREHOUSE LOGIC ================= */
function populateWarehouseEmployeeDropdown() {
    const select = document.getElementById('w-emp-select'); if(!select) return;
    select.innerHTML = `<option value="">-- Choose Employee --</option>`;
    employeesDb.forEach(emp => {
        const opt = document.createElement('option');
        opt.value = emp.id; opt.textContent = `${emp.fullName} (${emp.department || 'General'})`;
        select.appendChild(opt);
    });
}

function renderWarehouseList() {
    const tbody = document.getElementById('warehouse-list-body');
    if (!tbody) return;
    tbody.innerHTML = wDb.map(item => `
        <tr class="border-b border-slate-800 text-xs">
            <td class="p-3 font-mono font-bold text-cyan-400">${item.assetTag}</td>
            <td class="p-3"><strong class="text-white">${item.category}</strong><br><span class="text-slate-400">${item.desc}</span></td>
            <td class="p-3 text-white">${item.empName || 'Unassigned'}</td>
            <td class="p-3 text-slate-400">Out: ${item.handoverDate || '-'}<br>In: ${item.returnDate || '-'}</td>
            <td class="p-3 text-center"><span class="px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded-full text-[10px]">${item.status}</span></td>
            <td class="p-3 text-center">
                <button onclick="openHandoverModal('${item.id}')" class="text-emerald-400 mr-2"><i class="fa-solid fa-file-contract"></i></button>
                <button onclick="editWarehouseItem('${item.id}')" class="text-blue-400 mr-2"><i class="fa-solid fa-pen"></i></button>
                <button onclick="deleteWarehouse('${item.id}')" class="text-red-400"><i class="fa-solid fa-trash"></i></button>
            </td>
        </tr>
    `).join('');
}

function logItemToWarehouse() {
    const editId = document.getElementById('w-edit-id')?.value;
    const assetTag = document.getElementById('w-asset-tag').value;
    const desc = document.getElementById('w-desc').value;
    if (!assetTag || !desc) return alert("Fill Tag and Description");
    const key = editId ? editId : "W-" + Date.now();
    database.ref('it_warehouse_inventory/' + key).set({
        id: key, assetTag, category: document.getElementById('w-category').value, desc,
        serial: document.getElementById('w-serial').value, quantity: document.getElementById('w-quantity').value || "1",
        empName: document.getElementById('w-emp-name').value, empId: document.getElementById('w-emp-id').value,
        handoverDate: document.getElementById('w-handover-date').value, returnDate: document.getElementById('w-return-date').value, status: document.getElementById('w-status').value
    }).then(() => { closeWarehouseModal(); showToast("Asset Saved!"); });
}

function editWarehouseItem(id) {
    const item = wDb.find(i => i.id === id); if(!item) return;
    document.getElementById('w-edit-id').value = item.id;
    document.getElementById('w-asset-tag').value = item.assetTag || '';
    document.getElementById('w-category').value = item.category || 'Laptop';
    document.getElementById('w-desc').value = item.desc || '';
    document.getElementById('w-serial').value = item.serial || '';
    document.getElementById('w-emp-name').value = item.empName || '';
    document.getElementById('w-emp-id').value = item.empId || '';
    document.getElementById('w-handover-date').value = item.handoverDate || '';
    document.getElementById('w-return-date').value = item.returnDate || '';
    document.getElementById('w-status').value = item.status || 'In Stock';
    openWarehouseModal();
}
function clearWarehouseForm() { document.getElementById('w-edit-id').value = ''; }
function deleteWarehouse(id) { if(confirm("Delete this asset?")) database.ref('it_warehouse_inventory/' + id).remove(); }

/* ================= RUSTDESK LOGIC ================= */
function renderRustDeskList() {
    const tbody = document.getElementById('rd-list-body'); if(!tbody) return;
    tbody.innerHTML = rustdeskDb.map(item => `
        <tr class="border-b border-slate-800 text-xs">
            <td class="p-3 font-bold text-white">${item.empName}</td>
            <td class="p-3 font-mono text-cyan-400 font-bold">${item.rdId}</td>
            <td class="p-3 font-mono text-slate-300">${item.password || '-'}</td>
            <td class="p-3 text-slate-300">${item.device || '-'}</td>
            <td class="p-3 text-center"><a href="rustdesk://${(item.rdId||'').replace(/\s+/g,'')}" class="bg-blue-600 text-white px-2.5 py-1 rounded text-[10px]"><i class="fa-solid fa-plug"></i> Connect</a></td>
            <td class="p-3 text-center"><button onclick="deleteRustDesk('${item.id}')" class="text-red-400"><i class="fa-solid fa-trash"></i></button></td>
        </tr>
    `).join('');
}
function saveRustDeskEntry() {
    const empName = document.getElementById('rd-emp-name').value;
    const rdId = document.getElementById('rd-id').value;
    if(!empName || !rdId) return alert("Fill Name and RustDesk ID!");
    const key = "RD-" + Date.now();
    database.ref('it_rustdesk_devices/' + key).set({ id: key, empName, rdId, password: document.getElementById('rd-password').value, device: document.getElementById('rd-device').value }).then(() => { closeRustDeskModal(); showToast("RustDesk Saved!"); });
}
function clearRustDeskForm() {}
function deleteRustDesk(id) { database.ref('it_rustdesk_devices/' + id).remove(); }

/* ================= SWITCH MAPPING LOGIC ================= */
function renderIspList() {
    const tbody = document.getElementById('switch-mapping-list-body'); if(!tbody) return;
    tbody.innerHTML = switchesDb.map(s => `
        <tr class="border-b border-slate-800 text-xs">
            <td class="p-3 font-bold text-red-400">${s.name}</td>
            <td class="p-3 text-slate-300">${s.location || '-'}</td>
            <td class="p-3 font-mono text-blue-400">${s.ip || '-'}</td>
            <td class="p-3 text-slate-300">${s.uplink || '-'}</td>
            <td class="p-3 text-slate-400">${s.notes || '-'}</td>
        </tr>
    `).join('');
}
function saveIspEntry() {
    const name = document.getElementById('isp-name').value;
    if(!name) return alert("Enter Switch Name");
    const key = "SW-" + Date.now();
    database.ref('it_switches/' + key).set({ id: key, name, location: document.getElementById('isp-speed').value, ip: document.getElementById('isp-ip').value, uplink: document.getElementById('isp-pass').value, notes: document.getElementById('isp-notes').value }).then(() => { closeIspModal(); showToast("Switch Saved!"); });
}
function clearIspForm() {}

/* ================= HELPDESK TICKETS ================= */
function renderHelpdeskList() {
    const tbody = document.getElementById('helpdesk-list-body'); if(!tbody) return;
    tbody.innerHTML = helpdeskDb.map(t => `
        <tr class="border-b border-slate-800 text-xs">
            <td class="p-3 font-mono text-red-400">${t.id.slice(-6)}</td>
            <td class="p-3 font-bold text-white">${t.emp}</td>
            <td class="p-3 text-slate-300">${t.title}</td>
            <td class="p-3 font-mono text-slate-400">${t.updated || '-'}</td>
            <td class="p-3 text-center"><span class="px-2 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-400">${t.status}</span></td>
            <td class="p-3 text-center"><button onclick="deleteHelpdesk('${t.id}')" class="text-red-400"><i class="fa-solid fa-trash"></i></button></td>
        </tr>
    `).join('');
}
function saveHelpdeskEntry() {
    const emp = document.getElementById('hd-emp').value;
    const title = document.getElementById('hd-title').value;
    if(!emp || !title) return alert("Fill Name and Title");
    const key = "HD-" + Date.now();
    database.ref('it_helpdesk_tickets/' + key).set({ id: key, emp, title, status: document.getElementById('hd-status').value, details: document.getElementById('hd-details').value, updated: new Date().toLocaleDateString('en-GB') }).then(() => { closeHelpdeskModal(); showToast("Ticket Created!"); });
}
function clearHelpdeskForm() {}
function deleteHelpdesk(id) { database.ref('it_helpdesk_tickets/' + id).remove(); }

/* ================= IP MANAGEMENT (IPAM) ================= */
function renderIpamList() {
    const tbody = document.getElementById('ipam-list-body'); if(!tbody) return;
    tbody.innerHTML = ipamDb.map(i => {
        const isOnline = i.status === 'Online';
        const badge = isOnline ? `<span class="text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 text-[10px]">Online</span>` : `<span class="text-red-400 font-bold bg-red-500/10 px-2 py-0.5 rounded-full border border-red-500/20 text-[10px]">Offline</span>`;
        return `
        <tr class="border-b border-slate-800 text-xs">
            <td class="p-3 font-mono font-bold text-blue-400">${i.ip}</td>
            <td class="p-3 font-bold text-white">${i.device}</td>
            <td class="p-3">${badge}</td>
            <td class="p-3 text-amber-400">${i.type || '-'}</td>
            <td class="p-3 text-slate-300">${i.owner || '-'}</td>
            <td class="p-3 font-mono text-emerald-400">${i.password ? '••••••••' : '-'}</td>
            <td class="p-3 text-center"><button onclick="deleteIpam('${i.id}')" class="text-red-400"><i class="fa-solid fa-trash"></i></button></td>
        </tr>`;
    }).join('');
}
function saveIpamEntry() {
    const ip = document.getElementById('ipam-ip').value;
    const device = document.getElementById('ipam-device').value;
    if(!ip || !device) return alert("Fill IP and Device Name");
    const key = "IPAM-" + Date.now();
    database.ref('it_ipam_subnets/' + key).set({ id: key, ip, device, status: document.getElementById('ipam-status').value, type: document.getElementById('ipam-type').value, owner: document.getElementById('ipam-owner').value, password: document.getElementById('ipam-password').value }).then(() => { closeIpamModal(); showToast("IP Recorded!"); });
}
function clearIpamForm() {}
function deleteIpam(id) { database.ref('it_ipam_subnets/' + id).remove(); }

/* ================= COMMAND SNIPPETS & NOTES ================= */
function renderCommandSnippets() {
    const grid = document.getElementById('snippets-grid'); if (!grid) return;
    grid.innerHTML = snippetsDb.map(item => `
        <div class="bg-slate-950 border border-slate-800 rounded-xl p-3">
            <div class="flex justify-between items-center mb-1"><span class="text-xs font-bold text-white">${item.title}</span><span class="text-[9px] font-mono text-red-400 bg-slate-900 px-1.5 py-0.5 rounded">${item.category}</span></div>
            <div class="flex justify-between items-center bg-slate-900 p-2 rounded mt-2"><code class="text-[11px] font-mono text-emerald-400">${item.cmd}</code><button onclick="navigator.clipboard.writeText('${item.cmd}'); showToast('Copied!')" class="text-blue-400 text-xs"><i class="fa-solid fa-copy"></i></button></div>
        </div>
    `).join('');
}
function saveSnippetEntry() {
    const title = document.getElementById('snippet-title').value;
    const cmd = document.getElementById('snippet-cmd').value;
    if(!title || !cmd) return alert("Fill Title and Command");
    const key = "SNIP-" + Date.now();
    database.ref('it_command_snippets/' + key).set({ id: key, title, category: document.getElementById('snippet-category').value, cmd, desc: document.getElementById('snippet-desc').value }).then(() => { closeSnippetModal(); showToast("Snippet Saved!"); });
}
function clearSnippetForm() {}

function renderNotesList() {
    const container = document.getElementById('notes-container'); if(!container) return;
    container.innerHTML = notesDb.map(n => `
        <div class="bg-slate-900 border border-slate-800 rounded-2xl p-4">
            <span class="text-[10px] font-bold text-red-400 bg-red-500/10 px-2 py-0.5 rounded">${n.category}</span>
            <h4 class="text-sm font-bold text-white mt-2 mb-1">${n.title}</h4>
            <div class="bg-slate-950 p-3 rounded-xl font-mono text-xs text-slate-200 mt-2 whitespace-pre-line">${n.solution}</div>
        </div>
    `).join('');
}
function saveNoteEntry() {
    const title = document.getElementById('note-title').value;
    const solution = document.getElementById('note-solution').value;
    if(!title || !solution) return alert("Fill Title and Solution");
    const key = "NOTE-" + Date.now();
    database.ref('it_knowledge_notes/' + key).set({ id: key, title, category: document.getElementById('note-category').value, problem: document.getElementById('note-problem').value, solution }).then(() => { closeNoteModal(); showToast("Note Saved!"); });
}
function clearNoteForm() {}

/* ================= SCHEDULE & DIRECTIVES ================= */
function addPlannedTaskToList() {
    const taskDate = document.getElementById('plan-task-date').value;
    const details = document.getElementById('plan-task-details').value;
    if(!taskDate || !details) return alert("Fill Date and Details");
    plannedTasks.push({ id: "PTK-" + Date.now(), taskDate, priority: document.getElementById('plan-task-priority').value, details });
    database.ref('it_weekly_plans').set({ plannedTasks }).then(() => { document.getElementById('plan-task-details').value = ""; showToast("Schedule Added!"); });
}
function renderPlannedTasksTable() {
    const tbody = document.getElementById('planned-tasks-tbody'); if(!tbody) return;
    tbody.innerHTML = plannedTasks.map((t, idx) => `
        <tr class="border-b border-slate-800 text-xs">
            <td class="p-2 font-mono text-slate-200">${t.taskDate}</td>
            <td class="p-2 text-slate-200">${t.details}</td>
            <td class="p-2 text-center">${t.priority}</td>
            <td class="p-2 text-center"><button onclick="plannedTasks.splice(${idx},1); database.ref('it_weekly_plans').set({plannedTasks})" class="text-red-400"><i class="fa-solid fa-trash"></i></button></td>
        </tr>
    `).join('');
}

/* ================= BACKUP & EXPORT ================= */
function exportData() {
    const payload = { source: "Asia Aluminium IT System", data: { it_employees_directory: employeesDb, it_warehouse_inventory: wDb, it_rustdesk_devices: rustdeskDb, it_switches: switchesDb, it_helpdesk_tickets: helpdeskDb, it_ipam_subnets: ipamDb, it_command_snippets: snippetsDb, it_knowledge_notes: notesDb } };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `aa-it-backup-${new Date().toISOString().slice(0,10)}.json`; a.click();
    showToast("Backup JSON Downloaded!");
}

function showToast(m) {
    const t = document.getElementById('toast'); 
    const msgEl = document.getElementById('toast-msg');
    if(!t || !msgEl) return;
    msgEl.innerText = m;
    t.classList.remove('translate-y-28'); 
    setTimeout(() => { t.classList.add('translate-y-28'); }, 3000);
}

document.addEventListener('DOMContentLoaded', () => {
    unlockApp();
});
