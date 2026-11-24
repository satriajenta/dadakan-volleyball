/**
 * Dadakan Volleyball - Admin Portal Script
 * Backend: PHP + MySQL (XAMPP)
 */

(function () {
  'use strict';

  // State Management
  let currentAdmin = null;
  let registrations = [];
  let bracketMatches = [];
  let approvedTeamsList = [];
  let currentFilter = 'all';
  let searchQuery = '';
  let isDemoMode = false;

  // Data Demo Cadangan (bila MySQL di XAMPP belum dijalankan)
  const DEFAULT_DEMO_DATA = [
    {
      id: 1,
      code: 'DV-GARUDA',
      team_name: 'Garuda Volleyball Club',
      origin: 'Jakarta Selatan',
      captain_name: 'Bambang Sudirman',
      whatsapp: '081234567890',
      email: 'bambang@garudavc.id',
      manager_name: 'Hendro Wijaya',
      payment_method: 'Transfer bank',
      payer_name: 'Bambang Sudirman',
      proof_path: 'assets/tournament-banner.png',
      status: 'pending',
      payment_verified: false,
      admin_note: null,
      created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
      registration_players: [
        { player_name: 'Bambang Sudirman (C)', jersey_number: 1 },
        { player_name: 'Rian Pratama', jersey_number: 7 },
        { player_name: 'Dimas Kurniawan', jersey_number: 9 },
        { player_name: 'Fajar Nugraha', jersey_number: 11 },
        { player_name: 'Agus Santoso', jersey_number: 4 },
        { player_name: 'Rizky Ramadhan (L)', jersey_number: 12 },
        { player_name: 'Dedi Irawan', jersey_number: 5 },
        { player_name: 'Farhan Maulana', jersey_number: 8 }
      ]
    },
    {
      id: 2,
      code: 'DV-BINTNG',
      team_name: 'Bintang Muda VC',
      origin: 'Kota Bandung',
      captain_name: 'Ahmad Fauzi',
      whatsapp: '085712345678',
      email: 'fauzi@bintangmuda.com',
      manager_name: 'Sutrisno',
      payment_method: 'QRIS',
      payer_name: 'Ahmad Fauzi',
      proof_path: 'assets/tournament-banner.png',
      status: 'approved',
      payment_verified: true,
      admin_note: 'Pembayaran terverifikasi via QRIS. Roster lengkap.',
      created_at: new Date(Date.now() - 3600000 * 18).toISOString(),
      registration_players: [
        { player_name: 'Ahmad Fauzi (C)', jersey_number: 10 },
        { player_name: 'Rudi Hartono', jersey_number: 2 },
        { player_name: 'Yoga Saputra', jersey_number: 3 },
        { player_name: 'Bayu Prasetyo', jersey_number: 6 },
        { player_name: 'Gilang Ramadhan', jersey_number: 14 },
        { player_name: 'Eko Wahyudi (L)', jersey_number: 17 }
      ]
    }
  ];

  // Helper DOM selectors
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => document.querySelectorAll(s);

  // Helper sanitization
  const escapeHtml = (v = '') =>
    String(v).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[c]));

  // Toast Notification
  function showToast(msg) {
    const el = $('#toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => el.classList.remove('show'), 3500);
  }

  // Inisialisasi
  async function init() {
    setupEventListeners();
    await checkDatabaseConnection();
  }

  // Event Listeners
  function setupEventListeners() {
    // Form Login
    const loginForm = $('#adminLoginForm');
    if (loginForm) {
      loginForm.addEventListener('submit', handleLogin);
    }

    // Toggle Password Visibility
    const togglePassBtn = $('#togglePassword');
    if (togglePassBtn) {
      togglePassBtn.addEventListener('click', () => {
        const input = $('#adminPassword');
        const icon = togglePassBtn.querySelector('.icon');
        if (input.type === 'password') {
          input.type = 'text';
          if (icon) icon.textContent = '🙈';
        } else {
          input.type = 'password';
          if (icon) icon.textContent = '👁️';
        }
      });
    }

    // Demo Mode Button
    const demoBtn = $('#demoLoginBtn');
    if (demoBtn) {
      demoBtn.addEventListener('click', () => {
        enableDemoMode({ email: 'admin@dadakan-demo.local', full_name: 'Demo Admin' });
      });
    }

    // Help Toggle
    const helpToggle = $('#helpToggleBtn');
    if (helpToggle) {
      helpToggle.addEventListener('click', () => {
        const box = $('#helpBox');
        if (box) box.classList.toggle('hidden');
      });
    }

    // Logout Button
    const logoutBtn = $('#adminLogoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', handleLogout);
    }

    // Refresh Button
    const refreshBtn = $('#refreshBtn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        loadRegistrations();
        showToast('Data diperbarui');
      });
    }

    // Filter Buttons
    $$('.filter-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        $$('.filter-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        currentFilter = btn.dataset.filter || 'all';
        renderRegistrations();
      });
    });

    // Search Input
    const searchInput = $('#searchInput');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value.trim().toLowerCase();
        renderRegistrations();
      });
    }

    // Export CSV
    const exportBtn = $('#exportCsvBtn');
    if (exportBtn) {
      exportBtn.addEventListener('click', exportToCsv);
    }

    // ==================== TABS ADMIN (TIM VS BRACKET) ====================
    $('#tabTeamsBtn')?.addEventListener('click', () => switchAdminTab('teams'));
    $('#tabBracketBtn')?.addEventListener('click', () => switchAdminTab('bracket'));

    // Buka Modal Tambah Match
    $('#openBracketModalBtn')?.addEventListener('click', () => openCreateBracketModal());
    $('#openBracketModalBtn2')?.addEventListener('click', () => openCreateBracketModal());
    $('#refreshBracketAdminBtn')?.addEventListener('click', () => {
      loadBracketAdmin();
      showToast('Memperbarui data bagan…');
    });

    // Auto-fill dari dropdown pilihan tim ke input teks nama tim
    $('#selectTeam1')?.addEventListener('change', (e) => {
      const selected = e.target.selectedOptions[0];
      if (selected && selected.value) {
        $('#matchTeam1Name').value = selected.dataset.name || selected.text;
      }
    });

    $('#selectTeam2')?.addEventListener('change', (e) => {
      const selected = e.target.selectedOptions[0];
      if (selected && selected.value) {
        $('#matchTeam2Name').value = selected.dataset.name || selected.text;
      }
    });

    // Form Submit Pertandingan Bracket
    $('#bracketForm')?.addEventListener('submit', handleBracketFormSubmit);

    // Modal Close buttons
    $$('[data-close-modal]').forEach((btn) => {
      btn.addEventListener('click', closeModal);
    });

    // Close modal on click outside
    $$('.modal-overlay').forEach((overlay) => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeModal();
      });
    });
  }

  // Cek Status Database & Sesi
  async function checkDatabaseConnection() {
    const dot = $('#connectionDot');
    const text = $('#connectionText');

    try {
      const res = await fetch('api/auth.php?action=check');
      const json = await res.json();

      if (dot && text) {
        dot.className = 'status-dot online';
        text.textContent = 'MySQL Online';
      }

      if (json.authenticated && json.user) {
        currentAdmin = json.user;
        isDemoMode = false;
        showDashboardView();
        await loadRegistrations();
        await loadBracketAdmin();
      }
    } catch (err) {
      if (dot && text) {
        dot.className = 'status-dot demo';
        text.textContent = 'MySQL Belum Aktif';
      }
      setAlert('Tidak dapat menghubungi server MySQL. Pastikan service MySQL di XAMPP Control Panel sudah dalam status <b>Running (Start)</b>.', 'error');
    }
  }

  // Login Handler (MySQL)
  async function handleLogin(e) {
    e.preventDefault();
    const submitBtn = $('#submitLoginBtn');
    const email = $('#adminEmail').value.trim();
    const password = $('#adminPassword').value;

    if (!email || !password) {
      setAlert('Harap isi email dan password.', 'error');
      return;
    }

    try {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span>Memverifikasi MySQL…</span>';
      setAlert('', 'none');

      const res = await fetch('api/auth.php?action=login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Email atau password salah.');
      }

      currentAdmin = json.user;
      isDemoMode = false;
      showToast('Login berhasil!');
      showDashboardView();
      await loadRegistrations();
      await loadBracketAdmin();
    } catch (err) {
      setAlert('Login gagal: ' + err.message, 'error');
      showToast('Login gagal');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<span>MASUK SEBAGAI ADMIN</span> <span>→</span>';
    }
  }

  // Alert Box Helper
  function setAlert(msg, type = 'none') {
    const box = $('#loginAlert');
    if (!box) return;
    if (type === 'none' || !msg) {
      box.className = 'login-alert hidden';
      box.innerHTML = '';
      return;
    }
    box.className = `login-alert ${type}`;
    box.innerHTML = msg;
  }

  // Enable Demo Mode
  function enableDemoMode(user) {
    isDemoMode = true;
    currentAdmin = user;
    registrations = DEFAULT_DEMO_DATA;
    showDashboardView();
    renderRegistrations();
    showToast('Masuk dalam Mode Demo');
  }

  // Logout
  async function handleLogout() {
    if (isDemoMode) {
      currentAdmin = null;
      isDemoMode = false;
      showLoginView();
      showToast('Berhasil logout');
      return;
    }

    try {
      await fetch('api/auth.php?action=logout');
      currentAdmin = null;
      showLoginView();
      showToast('Berhasil logout');
    } catch (e) {
      showLoginView();
    }
  }

  // View Switching
  function showLoginView() {
    $('#loginSection')?.classList.remove('hidden');
    $('#dashboardSection')?.classList.add('hidden');
    $('#navActionsLoggedIn')?.classList.add('hidden');
    $('#demoBanner')?.classList.add('hidden');
  }

  function showDashboardView() {
    $('#loginSection')?.classList.add('hidden');
    $('#dashboardSection')?.classList.remove('hidden');
    $('#navActionsLoggedIn')?.classList.remove('hidden');

    const adminEmailEl = $('#adminUserEmail');
    if (adminEmailEl && currentAdmin) {
      adminEmailEl.textContent = `${currentAdmin.full_name || 'Admin'} (${currentAdmin.email})`;
    }

    const demoBanner = $('#demoBanner');
    if (demoBanner) {
      if (isDemoMode) {
        demoBanner.classList.remove('hidden');
      } else {
        demoBanner.classList.add('hidden');
      }
    }
  }

  // Load Registrations from MySQL
  async function loadRegistrations() {
    if (isDemoMode) {
      renderRegistrations();
      return;
    }

    try {
      const res = await fetch('api/admin.php?action=list');
      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Gagal memuat data');
      }

      registrations = json.data || [];
      renderRegistrations(json.stats);
    } catch (err) {
      showToast('Gagal memuat data MySQL: ' + err.message);
    }
  }

  // Render Registrations & KPI Stats
  function renderRegistrations(statsData = null) {
    updateKpiStats(statsData);

    // Filter
    let filtered = registrations.filter((r) => {
      if (currentFilter !== 'all' && r.status !== currentFilter) {
        return false;
      }
      if (searchQuery) {
        const query = searchQuery;
        const matchCode = (r.code || '').toLowerCase().includes(query);
        const matchTeam = (r.team_name || '').toLowerCase().includes(query);
        const matchCaptain = (r.captain_name || '').toLowerCase().includes(query);
        const matchOrigin = (r.origin || '').toLowerCase().includes(query);
        const matchPhone = (r.whatsapp || '').includes(query);
        return matchCode || matchTeam || matchCaptain || matchOrigin || matchPhone;
      }
      return true;
    });

    const tbody = $('#registrationsTableBody');
    const emptyState = $('#emptyState');

    if (!filtered.length) {
      if (tbody) tbody.innerHTML = '';
      emptyState?.classList.remove('hidden');
      return;
    }

    emptyState?.classList.add('hidden');
    if (tbody) {
      tbody.innerHTML = filtered.map((r) => renderRowHtml(r)).join('');

      // Pasang event listener tombol baris
      tbody.querySelectorAll('[data-view-roster]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const item = registrations.find((x) => String(x.id) === String(btn.dataset.viewRoster));
          if (item) showRosterModal(item);
        });
      });

      tbody.querySelectorAll('[data-view-proof]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const item = registrations.find((x) => String(x.id) === String(btn.dataset.viewProof));
          if (item) showProofModal(item);
        });
      });

      tbody.querySelectorAll('[data-action-approve]').forEach((btn) => {
        btn.addEventListener('click', () => updateRegistrationStatus(btn.dataset.actionApprove, 'approved'));
      });

      tbody.querySelectorAll('[data-action-reject]').forEach((btn) => {
        btn.addEventListener('click', () => showRejectModal(btn.dataset.actionReject));
      });
    }
  }

  // Row HTML Template
  function renderRowHtml(r) {
    const playerCount = r.registration_players ? r.registration_players.length : 0;
    const cleanPhone = (r.whatsapp || '').replace(/\D/g, '');
    const waUrl = cleanPhone ? `https://wa.me/62${cleanPhone.replace(/^0/, '')}` : '#';

    let statusPillClass = 'status-pill';
    let statusLabel = 'Menunggu';
    if (r.status === 'approved') {
      statusPillClass += ' approved';
      statusLabel = 'Diterima';
    } else if (r.status === 'rejected') {
      statusPillClass += ' rejected';
      statusLabel = 'Ditolak';
    }

    const dateStr = r.created_at
      ? new Date(r.created_at).toLocaleDateString('id-ID', {
          day: 'numeric',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit'
        })
      : '-';

    return `
      <tr>
        <td>
          <span class="reg-code">${escapeHtml(r.code)}</span>
          <div style="font-size:11px;color:#64748b;">${dateStr}</div>
        </td>
        <td class="team-cell">
          <b>${escapeHtml(r.team_name)}</b>
          <span>📍 ${escapeHtml(r.origin || 'Asal tidak diisi')}</span>
          ${r.manager_name ? `<span style="display:block;font-size:11px;">Mgr: ${escapeHtml(r.manager_name)}</span>` : ''}
        </td>
        <td class="contact-cell">
          <b>${escapeHtml(r.captain_name)}</b>
          <a class="wa-link" href="${waUrl}" target="_blank" rel="noopener">
            💬 ${escapeHtml(r.whatsapp)}
          </a>
          ${r.email ? `<small style="display:block;color:#64748b;">${escapeHtml(r.email)}</small>` : ''}
        </td>
        <td class="roster-cell">
          <button type="button" data-view-roster="${r.id}">
            📋 ${playerCount} Pemain
          </button>
        </td>
        <td class="payment-cell">
          <b>${escapeHtml(r.payment_method)}</b>
          <small>A.n. ${escapeHtml(r.payer_name)}</small>
          <div>
            <button type="button" class="proof-btn" data-view-proof="${r.id}">
              🔍 Bukti Bayar
            </button>
          </div>
        </td>
        <td>
          <span class="${statusPillClass}">${statusLabel}</span>
          ${r.admin_note ? `<div style="font-size:11px;color:#b91c1c;margin-top:4px;max-width:180px;white-space:normal;">📝 ${escapeHtml(r.admin_note)}</div>` : ''}
        </td>
        <td>
          <div class="table-actions">
            ${
              r.status !== 'approved'
                ? `<button type="button" class="action-btn approve" data-action-approve="${r.id}">✓ Terima</button>`
                : ''
            }
            ${
              r.status !== 'rejected'
                ? `<button type="button" class="action-btn reject" data-action-reject="${r.id}">✕ Tolak</button>`
                : ''
            }
          </div>
        </td>
      </tr>
    `;
  }

  // Update KPI Stats Cards
  function updateKpiStats(statsData = null) {
    let total = 0, pending = 0, approved = 0, rejected = 0, totalPlayers = 0;

    if (statsData) {
      total = statsData.total;
      pending = statsData.pending;
      approved = statsData.approved;
      rejected = statsData.rejected;
      totalPlayers = statsData.total_players;
    } else {
      total = registrations.length;
      pending = registrations.filter((r) => r.status === 'pending').length;
      approved = registrations.filter((r) => r.status === 'approved').length;
      rejected = registrations.filter((r) => r.status === 'rejected').length;
      registrations.forEach((r) => {
        if (r.registration_players) totalPlayers += r.registration_players.length;
      });
    }

    if ($('#kpiTotal')) $('#kpiTotal').textContent = total;
    if ($('#kpiPending')) $('#kpiPending').textContent = pending;
    if ($('#kpiApproved')) $('#kpiApproved').textContent = approved;
    if ($('#kpiRejected')) $('#kpiRejected').textContent = rejected;
    if ($('#kpiPlayers')) $('#kpiPlayers').textContent = totalPlayers;

    // Filter Badges
    if ($('#badgeAll')) $('#badgeAll').textContent = total;
    if ($('#badgePending')) $('#badgePending').textContent = pending;
    if ($('#badgeApproved')) $('#badgeApproved').textContent = approved;
    if ($('#badgeRejected')) $('#badgeRejected').textContent = rejected;
  }

  // Update Status in MySQL Database
  async function updateRegistrationStatus(id, newStatus, note = null) {
    if (isDemoMode) {
      const idx = registrations.findIndex((x) => String(x.id) === String(id));
      if (idx !== -1) {
        registrations[idx].status = newStatus;
        registrations[idx].payment_verified = newStatus === 'approved';
        registrations[idx].admin_note = note || (newStatus === 'approved' ? 'Terverifikasi' : 'Perlu perbaikan');
        renderRegistrations();
        showToast(`Status tim diubah menjadi ${newStatus === 'approved' ? 'Diterima' : 'Ditolak'}`);
      }
      return;
    }

    try {
      const res = await fetch('api/admin.php?action=update_status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: id,
          status: newStatus,
          admin_note: note
        })
      });

      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Gagal mengubah status');

      showToast('Status pendaftaran berhasil diperbarui di MySQL.');
      await loadRegistrations();
    } catch (err) {
      showToast('Gagal mengubah status: ' + err.message);
    }
  }

  // Show Roster Modal
  function showRosterModal(item) {
    const modal = $('#rosterModal');
    $('#rosterModalTeamName').textContent = item.team_name;
    $('#rosterModalCode').textContent = item.code;
    $('#rosterModalOrigin').textContent = item.origin || '-';
    $('#rosterModalCaptain').textContent = item.captain_name;

    const list = item.registration_players || [];
    const tbody = $('#rosterModalBody');
    if (tbody) {
      tbody.innerHTML = list
        .map(
          (p, i) => `
          <tr>
            <td style="width:40px;color:#64748b;">${i + 1}</td>
            <td><b>${escapeHtml(p.player_name)}</b></td>
            <td style="text-align:center;">
              <span class="jersey-pill">${escapeHtml(p.jersey_number)}</span>
            </td>
          </tr>
        `
        )
        .join('');
    }

    openModal(modal);
  }

  // Show Payment Proof Modal
  function showProofModal(item) {
    const modal = $('#proofModal');
    $('#proofModalTeam').textContent = item.team_name;
    $('#proofModalPayer').textContent = `${item.payment_method} — A.n. ${item.payer_name}`;

    const previewContainer = $('#proofModalPreview');
    if (!previewContainer) return;

    const filePath = item.proof_path || '';
    const isPdf = filePath.toLowerCase().endsWith('.pdf');

    if (isPdf) {
      previewContainer.innerHTML = `
        <div style="padding:24px;">
          <p>Dokumen bukti transfer berupa file PDF.</p>
          <a href="${escapeHtml(filePath)}" target="_blank" rel="noopener" class="btn btn-primary">Buka Dokumen PDF di Tab Baru ↗</a>
        </div>
      `;
    } else {
      previewContainer.innerHTML = `
        <img src="${escapeHtml(filePath)}" alt="Bukti Pembayaran" class="proof-img" onerror="this.src='assets/tournament-banner.png';">
        <div style="margin-top:10px;">
          <a href="${escapeHtml(filePath)}" target="_blank" rel="noopener" style="font-size:12px;color:#0f3b82;text-decoration:underline;">Lihat ukuran penuh ↗</a>
        </div>
      `;
    }

    openModal(modal);
  }

  // Show Reject / Note Modal
  function showRejectModal(id) {
    const modal = $('#actionModal');
    const noteInput = $('#actionModalNote');
    noteInput.value = '';

    const confirmBtn = $('#actionModalConfirmBtn');
    const newConfirmBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);

    newConfirmBtn.addEventListener('click', () => {
      const note = noteInput.value.trim();
      if (!note) {
        alert('Harap masukkan alasan penolakan atau perbaikan data.');
        return;
      }
      updateRegistrationStatus(id, 'rejected', note);
      closeModal();
    });

    openModal(modal);
  }

  // Modal Helpers
  function openModal(el) {
    if (!el) return;
    el.classList.add('active');
  }

  function closeModal() {
    $$('.modal-overlay').forEach((m) => m.classList.remove('active'));
  }

  // Export to CSV
  function exportToCsv() {
    if (isDemoMode) {
      showToast('Mode demo: menggunakan export lokal');
      // Export lokal dari array
      const headers = ['Kode', 'Tim', 'Asal', 'Kapten', 'WhatsApp', 'Metode', 'Pengirim', 'Status'];
      const rows = registrations.map((r) => [r.code, `"${r.team_name}"`, `"${r.origin}"`, `"${r.captain_name}"`, r.whatsapp, r.payment_method, `"${r.payer_name}"`, r.status]);
      const csv = '\uFEFF' + [headers.join(','), ...rows.map(x => x.join(','))].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `pendaftaran-demo-${Date.now()}.csv`;
      a.click();
      return;
    }

    // Download file CSV dari server PHP MySQL
    window.location.href = 'api/admin.php?action=export_csv';
  }

  // ==============================================================
  // TAB NAVIGATION & BRACKET CRUD MANAGEMENT
  // ==============================================================
  function switchAdminTab(tab) {
    const tabTeams = $('#tabTeamsContent');
    const tabBracket = $('#tabBracketContent');
    const btnTeams = $('#tabTeamsBtn');
    const btnBracket = $('#tabBracketBtn');

    if (tab === 'teams') {
      tabTeams?.classList.remove('hidden');
      tabBracket?.classList.add('hidden');

      btnTeams.style.background = 'var(--navy)';
      btnTeams.style.color = '#fff';
      btnTeams.className = 'btn';

      btnBracket.style.background = '';
      btnBracket.style.color = '';
      btnBracket.className = 'btn btn-outline';
    } else {
      tabTeams?.classList.add('hidden');
      tabBracket?.classList.remove('hidden');

      btnBracket.style.background = 'var(--navy)';
      btnBracket.style.color = '#fff';
      btnBracket.className = 'btn';

      btnTeams.style.background = '';
      btnTeams.style.color = '';
      btnTeams.className = 'btn btn-outline';

      loadBracketAdmin();
    }
  }

  // Load Bracket list for Admin
  async function loadBracketAdmin() {
    try {
      const res = await fetch('api/admin.php?action=bracket_list');
      const json = await res.json();

      if (!res.ok || !json.success) throw new Error(json.error || 'Gagal memuat bracket');

      bracketMatches = json.data || [];
      approvedTeamsList = json.approved_teams || [];

      // Update badge
      const badge = $('#bracketTotalBadge');
      if (badge) badge.textContent = bracketMatches.length;

      // Update dropdown tim yang diapprove di form modal
      populateTeamDropdowns();

      renderBracketTable();
    } catch (err) {
      showToast('Gagal memuat bracket: ' + err.message);
    }
  }

  function populateTeamDropdowns() {
    const sel1 = $('#selectTeam1');
    const sel2 = $('#selectTeam2');
    if (!sel1 || !sel2) return;

    let options = '<option value="">-- Ketik manual atau pilih tim --</option>';
    approvedTeamsList.forEach((t) => {
      options += `<option value="${t.id}" data-name="${escapeHtml(t.team_name)}">${escapeHtml(t.team_name)} (${escapeHtml(t.origin || 'Klub')})</option>`;
    });

    sel1.innerHTML = options;
    sel2.innerHTML = options;
  }

  function renderBracketTable() {
    const tbody = $('#bracketTableBody');
    const emptyState = $('#emptyBracketState');
    if (!tbody) return;

    if (bracketMatches.length === 0) {
      tbody.innerHTML = '';
      emptyState?.classList.remove('hidden');
      return;
    }

    emptyState?.classList.add('hidden');

    const statusLabels = {
      scheduled: '<span class="status-pill">Terjadwal</span>',
      live: '<span class="status-pill" style="background:#fef2f2;color:#dc2626;">● LIVE</span>',
      completed: '<span class="status-pill approved">Selesai</span>'
    };

    tbody.innerHTML = bracketMatches.map((m) => {
      const isT1Win = m.winner_team === 'team1';
      const isT2Win = m.winner_team === 'team2';
      const dateStr = m.match_date ? formatDateTime(m.match_date) : '-';
      const scoreStr = (m.team1_score !== null && m.team2_score !== null)
        ? `<b>${m.team1_score}</b> - <b>${m.team2_score}</b>`
        : '<span style="color:#94a3b8;">Belum main</span>';

      let winnerText = '-';
      if (isT1Win) winnerText = `👑 <b>${escapeHtml(m.team1_name)}</b>`;
      else if (isT2Win) winnerText = `👑 <b>${escapeHtml(m.team2_name)}</b>`;
      else if (m.winner_team === 'draw') winnerText = 'Seri (Draw)';

      return `
        <tr>
          <td>
            <b style="color:var(--navy);font-size:13px;">${escapeHtml(m.round_name)}</b>
            <div style="font-size:11px;color:#64748b;">Match #${m.match_number} · Ronde ${m.round_order}</div>
          </td>
          <td>
            <div style="${isT1Win ? 'color:#15803d;font-weight:800;' : ''}">${escapeHtml(m.team1_name)}</div>
            <div style="font-size:11px;color:#94a3b8;margin:2px 0;">vs</div>
            <div style="${isT2Win ? 'color:#15803d;font-weight:800;' : ''}">${escapeHtml(m.team2_name)}</div>
          </td>
          <td style="text-align:center;">
            <div style="font-size:15px;background:#f8fafc;padding:6px 10px;border-radius:8px;border:1px solid var(--line);display:inline-block;">
              ${scoreStr}
            </div>
          </td>
          <td>
            <div>🕒 ${escapeHtml(dateStr)}</div>
            <small style="color:#64748b;">📍 ${escapeHtml(m.court_name || 'Lapangan')}</small>
          </td>
          <td>
            ${statusLabels[m.status] || m.status}
          </td>
          <td>
            <span style="font-size:12px;">${winnerText}</span>
          </td>
          <td>
            <div class="table-actions">
              <button type="button" class="action-btn" style="background:#eff6ff;color:#1e40af;border:1px solid #bfdbfe;" data-edit-match="${m.id}">
                ✏️ Edit
              </button>
              <button type="button" class="action-btn reject" data-delete-match="${m.id}">
                🗑️ Hapus
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    // Attach actions
    tbody.querySelectorAll('[data-edit-match]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const item = bracketMatches.find((x) => String(x.id) === String(btn.dataset.editMatch));
        if (item) openEditBracketModal(item);
      });
    });

    tbody.querySelectorAll('[data-delete-match]').forEach((btn) => {
      btn.addEventListener('click', () => {
        deleteBracketMatch(btn.dataset.deleteMatch);
      });
    });
  }

  function openCreateBracketModal() {
    $('#bracketModalTitle').textContent = 'Tambah Pertandingan Bracket';
    $('#matchId').value = '';
    $('#matchRoundName').value = 'Babak 16 Besar';
    $('#matchRoundOrder').value = '1';
    $('#matchNumber').value = (bracketMatches.length + 1).toString();
    $('#selectTeam1').value = '';
    $('#matchTeam1Name').value = '';
    $('#matchTeam1Score').value = '';
    $('#selectTeam2').value = '';
    $('#matchTeam2Name').value = '';
    $('#matchTeam2Score').value = '';
    $('#matchDateTime').value = '';
    $('#matchCourtName').value = 'Lapangan Utama';
    $('#matchStatus').value = 'scheduled';
    $('#matchWinnerTeam').value = '';
    $('#matchNotes').value = '';

    openModal($('#bracketModal'));
  }

  function openEditBracketModal(m) {
    $('#bracketModalTitle').textContent = `Edit Pertandingan #${m.match_number} (${m.round_name})`;
    $('#matchId').value = m.id;
    $('#matchRoundName').value = m.round_name;
    $('#matchRoundOrder').value = m.round_order;
    $('#matchNumber').value = m.match_number;

    $('#selectTeam1').value = m.team1_id || '';
    $('#matchTeam1Name').value = m.team1_name;
    $('#matchTeam1Score').value = m.team1_score !== null ? m.team1_score : '';

    $('#selectTeam2').value = m.team2_id || '';
    $('#matchTeam2Name').value = m.team2_name;
    $('#matchTeam2Score').value = m.team2_score !== null ? m.team2_score : '';

    // Format datetime-local
    if (m.match_date) {
      try {
        const dt = new Date(m.match_date);
        const y = dt.getFullYear();
        const mo = String(dt.getMonth() + 1).padStart(2, '0');
        const d = String(dt.getDate()).padStart(2, '0');
        const h = String(dt.getHours()).padStart(2, '0');
        const mi = String(dt.getMinutes()).padStart(2, '0');
        $('#matchDateTime').value = `${y}-${mo}-${d}T${h}:${mi}`;
      } catch (e) {
        $('#matchDateTime').value = '';
      }
    } else {
      $('#matchDateTime').value = '';
    }

    $('#matchCourtName').value = m.court_name || 'Lapangan Utama';
    $('#matchStatus').value = m.status || 'scheduled';
    $('#matchWinnerTeam').value = m.winner_team || '';
    $('#matchNotes').value = m.notes || '';

    openModal($('#bracketModal'));
  }

  async function handleBracketFormSubmit(e) {
    e.preventDefault();
    const btn = $('#saveBracketBtn');
    btn.disabled = true;
    btn.textContent = 'Menyimpan…';

    const payload = {
      id: $('#matchId').value || null,
      round_name: $('#matchRoundName').value,
      round_order: Number($('#matchRoundOrder').value) || 1,
      match_number: Number($('#matchNumber').value) || 1,
      team1_id: $('#selectTeam1').value || null,
      team1_name: $('#matchTeam1Name').value.trim(),
      team1_score: $('#matchTeam1Score').value !== '' ? Number($('#matchTeam1Score').value) : null,
      team2_id: $('#selectTeam2').value || null,
      team2_name: $('#matchTeam2Name').value.trim(),
      team2_score: $('#matchTeam2Score').value !== '' ? Number($('#matchTeam2Score').value) : null,
      match_date: $('#matchDateTime').value || null,
      court_name: $('#matchCourtName').value.trim(),
      status: $('#matchStatus').value,
      winner_team: $('#matchWinnerTeam').value || null,
      notes: $('#matchNotes').value.trim()
    };

    try {
      const res = await fetch('api/admin.php?action=bracket_save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Gagal menyimpan laga bracket');

      showToast(json.message || 'Laga bracket berhasil disimpan!');
      closeModal();
      loadBracketAdmin();
    } catch (err) {
      showToast('Gagal: ' + err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Simpan Pertandingan';
    }
  }

  async function deleteBracketMatch(id) {
    if (!confirm('Apakah Anda yakin ingin menghapus pertandingan ini dari bagan turnamen?')) {
      return;
    }

    try {
      const res = await fetch('api/admin.php?action=bracket_delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Gagal menghapus laga');

      showToast('Pertandingan berhasil dihapus');
      loadBracketAdmin();
    } catch (err) {
      showToast('Gagal menghapus: ' + err.message);
    }
  }

  function formatDateTime(dtStr) {
    try {
      const d = new Date(dtStr);
      if (isNaN(d.getTime())) return dtStr;
      return d.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return dtStr;
    }
  }

  // Run on DOM Ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
