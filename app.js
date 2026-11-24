/**
 * Dadakan Volleyball - Client App
 * Backend: PHP + MySQL (XAMPP)
 */

const $ = (s) => document.querySelector(s);
let registrations = [];
let sb = null;

const getSupabase = () => {
  if (sb) return sb;
  if (window.supabase && window.SUPABASE_URL && window.SUPABASE_ANON_KEY) {
    sb = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
    return sb;
  }
  return null;
};

// Toast notification helper
const toast = (message) => {
  const el = $('#toast');
  if (!el) return;
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove('show'), 3500);
};

// HTML Escaping
const escapeHtml = (v = '') =>
  String(v).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[c]));

// Tambah baris pemain (minimal 6, maksimal 12)
function addPlayer(name = '', number = '') {
  const list = $('#playersList');
  if (!list || list.children.length >= 12) return;
  const idx = list.children.length + 1;
  const row = document.createElement('div');
  row.className = 'player-row';
  row.innerHTML = `
    <span class="player-index">${idx}</span>
    <input class="player-name" maxlength="70" required placeholder="Nama lengkap pemain ${idx}" value="${escapeHtml(name)}">
    <input class="player-number" type="number" min="0" max="99" required placeholder="No. punggung" value="${escapeHtml(number)}">
    <button type="button" class="remove-player" aria-label="Hapus pemain">×</button>
  `;
  row.querySelector('.remove-player').addEventListener('click', () => {
    if (list.children.length <= 6) {
      toast('Minimal 6 pemain per tim.');
      return;
    }
    row.remove();
    refreshPlayers();
  });
  list.appendChild(row);
  refreshPlayers();
}

function refreshPlayers() {
  const rows = [...($('#playersList')?.children || [])];
  rows.forEach((r, i) => {
    r.querySelector('.player-index').textContent = i + 1;
    r.querySelector('.player-name').placeholder = `Nama lengkap pemain ${i + 1}`;
  });
  const counter = $('#playerCount');
  if (counter) counter.textContent = `${rows.length} / 12`;
  const addBtn = $('#addPlayer');
  if (addBtn) addBtn.disabled = rows.length >= 12;
}

function getPlayers() {
  return [...($('#playersList')?.querySelectorAll('.player-row') || [])].map((r) => ({
    name: r.querySelector('.player-name').value.trim(),
    jersey_number: Number(r.querySelector('.player-number').value)
  }));
}

function validatePlayers(players) {
  if (players.length < 6 || players.length > 12) {
    throw new Error('Jumlah pemain harus antara 6 hingga 12 orang.');
  }
  if (players.some((p) => p.name.length < 2 || !Number.isInteger(p.jersey_number) || p.jersey_number < 0 || p.jersey_number > 99)) {
    throw new Error('Periksa nama dan nomor punggung pemain (0–99).');
  }
  const nums = players.map((p) => p.jersey_number);
  if (new Set(nums).size !== nums.length) {
    throw new Error('Nomor punggung pemain tidak boleh sama. Setiap pemain harus memiliki nomor unik.');
  }
}

// Inisialisasi Aplikasi
async function init() {
  // Tampilkan instruksi pembayaran jika dikonfigurasi di config.js
  if (window.PAYMENT_INSTRUCTIONS && $('#paymentInstructions')) {
    $('#paymentInstructions').textContent = window.PAYMENT_INSTRUCTIONS;
  }

  // Tambah default 6 pemain awal
  const list = $('#playersList');
  if (list && list.children.length === 0) {
    for (let i = 0; i < 6; i++) addPlayer();
  }

  // Label nama file bukti transfer
  $('#paymentProof')?.addEventListener('change', (e) => {
    const fn = $('#proofName');
    if (fn) fn.textContent = e.target.files[0]?.name || 'Belum ada file dipilih';
  });

  $('#addPlayer')?.addEventListener('click', () => addPlayer());
  $('#registrationForm')?.addEventListener('submit', submitRegistration);
  $('#statusForm')?.addEventListener('submit', checkStatus);

  // Navigasi Admin inline
  const adminToggle = $('#adminToggle');
  if (adminToggle && adminToggle.tagName === 'BUTTON') {
    adminToggle.addEventListener('click', () => {
      $('#adminPanel')?.classList.remove('hidden');
      $('#adminPanel')?.scrollIntoView({ behavior: 'smooth' });
    });
  }

  $('#closeAdmin')?.addEventListener('click', () => {
    $('#adminPanel')?.classList.add('hidden');
  });

  const adminForm = $('#adminLoginForm');
  if (adminForm) {
    adminForm.addEventListener('submit', (e) => {
      e.preventDefault();
      loginAdmin();
    });
  }

  $('#adminLogout')?.addEventListener('click', logoutAdmin);

  // Cek apakah admin sudah login di sesi ini
  checkAdminSession();
}

// Submit Pendaftaran (Mendukung Supabase & MySQL)
async function submitRegistration(e) {
  e.preventDefault();
  const form = e.currentTarget;
  const btn = $('#submitRegistration');
  const file = $('#paymentProof')?.files[0];

  try {
    const players = getPlayers();
    validatePlayers(players);

    if (!file) throw new Error('Bukti pembayaran wajib diunggah.');
    if (file.size > 5 * 1024 * 1024) throw new Error('Ukuran bukti pembayaran maksimal 5 MB.');
    if (!['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(file.type)) {
      throw new Error('Format file bukti harus JPG, PNG, atau PDF.');
    }

    const fd = new FormData(form);
    const phone = String(fd.get('whatsapp') || '').replace(/\D/g, '');
    if (phone.length < 9 || phone.length > 16) throw new Error('Nomor WhatsApp tidak valid.');

    btn.disabled = true;
    btn.innerHTML = 'MENGIRIM DATA…';

    let registeredCode = '';
    const client = getSupabase();

    if (client) {
      // Alur Cloud / Supabase
      const code = 'DV-' + Math.random().toString(36).slice(2, 8).toUpperCase();
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const storagePath = `pending/${code}/${Date.now()}-${safeName}`;

      const upload = await client.storage.from('registration-proofs').upload(storagePath, file, {
        contentType: file.type,
        upsert: false
      });
      if (upload.error) throw upload.error;

      const payload = {
        p_code: code,
        p_team_name: fd.get('team_name').trim(),
        p_origin: (fd.get('origin') || '').trim(),
        p_captain_name: fd.get('captain_name').trim(),
        p_whatsapp: phone,
        p_email: (fd.get('email') || '').trim(),
        p_manager_name: (fd.get('manager_name') || '').trim(),
        p_payment_method: fd.get('payment_method'),
        p_payer_name: fd.get('payer_name').trim(),
        p_proof_path: storagePath,
        p_players: players
      };

      const result = await client.rpc('create_team_registration', payload);
      if (result.error) {
        await client.storage.from('registration-proofs').remove([storagePath]);
        throw result.error;
      }
      registeredCode = code;
    } else {
      // Fallback ke PHP API jika ada
      fd.set('whatsapp', phone);
      fd.set('players', JSON.stringify(players));
      if (file) fd.set('payment_proof', file);

      const res = await fetch('api/register.php', { method: 'POST', body: fd });
      const result = await res.json();
      if (!res.ok || !result.success) throw new Error(result.error || 'Pendaftaran gagal.');
      registeredCode = result.code;
    }

    // Tampilkan box sukses
    form.classList.add('hidden');
    const successBox = $('#successBox');
    if (successBox) {
      successBox.classList.remove('hidden');
      successBox.innerHTML = `
        <h3>Pendaftaran berhasil dikirim!</h3>
        <p>Catat kode registrasi tim kamu:</p>
        <div class="code-display">${escapeHtml(registeredCode)}</div>
        <p>Gunakan kode tersebut dan 4 digit terakhir WhatsApp kapten pada formulir <b>Cek status tim</b>.</p>
        <button type="button" class="btn btn-outline" id="copyCode">Salin kode registrasi</button>
      `;
      $('#copyCode')?.addEventListener('click', () => {
        navigator.clipboard.writeText(registeredCode)
          .then(() => toast('Kode registrasi disalin'))
          .catch(() => toast('Kode: ' + registeredCode));
      });
      successBox.scrollIntoView({ behavior: 'smooth' });
    }

    toast('Pendaftaran berhasil dikirim!');
  } catch (err) {
    toast(err.message || 'Terjadi kesalahan sistem.');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = 'KIRIM PENDAFTARAN <span>→</span>';
    }
  }
}

// Cek Status Pendaftaran
async function checkStatus(e) {
  e.preventDefault();
  const form = e.currentTarget;
  const fd = new FormData(form);
  const box = $('#statusResult');
  const code = String(fd.get('code') || '').trim().toUpperCase();
  const phoneLast4 = String(fd.get('phone_last4') || '').trim();

  try {
    const client = getSupabase();
    let d = null;

    if (client) {
      const { data, error } = await client.rpc('check_registration_status', {
        p_code: code,
        p_phone_last4: phoneLast4
      });
      if (error || !data) throw new Error('Data tidak ditemukan. Periksa kode registrasi dan 4 digit nomor WhatsApp.');
      d = data;
    } else {
      const res = await fetch(`api/check-status.php?code=${encodeURIComponent(code)}&phone_last4=${encodeURIComponent(phoneLast4)}`);
      const json = await res.json();
      if (!res.ok || !json.success || !json.data) throw new Error(json.error || 'Data tidak ditemukan.');
      d = json.data;
    }

    if (!box) return;
    box.classList.remove('hidden');

    const statusLabels = {
      pending: '⏳ Menunggu verifikasi',
      approved: '✅ Diterima (Lolos)',
      rejected: '❌ Perlu perbaikan / ditolak'
    };

    box.innerHTML = `
      <b>${escapeHtml(d.team_name)}</b> ${d.origin ? `<small>(${escapeHtml(d.origin)})</small>` : ''}<br>
      Kode: <strong>${escapeHtml(d.code)}</strong><br>
      Status: <strong>${statusLabels[d.status] || d.status}</strong><br>
      Pembayaran: ${d.payment_verified ? '<span style="color:#15803d;font-weight:700;">Terverifikasi</span>' : 'Menunggu pemeriksaan'}<br>
      ${d.admin_note ? `<div style="margin-top:6px;padding:8px;background:#fef2f2;border-radius:6px;color:#991b1b;"><b>Catatan Panitia:</b><br>${escapeHtml(d.admin_note)}</div>` : ''}
    `;
  } catch (err) {
    if (box) {
      box.classList.remove('hidden');
      box.innerHTML = `<span style="color:#b91c1c;">${escapeHtml(err.message)}</span>`;
    }
  }
}

// Cek Sesi Admin
async function checkAdminSession() {
  try {
    const res = await fetch('api/auth.php?action=check');
    const json = await res.json();
    if (json.authenticated) {
      showAdminDashboard();
    }
  } catch (err) {
    // Sesi belum login atau server offline
  }
}

// Login Admin Inline
async function loginAdmin() {
  const email = $('#adminEmail')?.value.trim();
  const password = $('#adminPassword')?.value;
  const btn = $('#adminLogin');

  if (!email || !password) {
    toast('Harap isi email dan password.');
    return;
  }

  try {
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'MEMVERIFIKASI…';
    }

    const res = await fetch('api/auth.php?action=login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json.error || 'Login gagal.');
    }

    toast('Login berhasil!');
    showAdminDashboard();
  } catch (err) {
    toast('Login gagal: ' + err.message);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'LOGIN ADMIN';
    }
  }
}

// Logout Admin Inline
async function logoutAdmin() {
  try {
    await fetch('api/auth.php?action=logout');
    toast('Logout berhasil.');
  } catch (e) {}
  hideAdminDashboard();
}

function showAdminDashboard() {
  $('#adminLoginBox')?.classList.add('hidden');
  $('#adminDashboard')?.classList.remove('hidden');
  loadRegistrations();
}

function hideAdminDashboard() {
  $('#adminLoginBox')?.classList.remove('hidden');
  $('#adminDashboard')?.classList.add('hidden');
}

// Muat data pendaftaran admin dari MySQL
async function loadRegistrations() {
  try {
    const res = await fetch('api/admin.php?action=list');
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.error || 'Gagal memuat data');

    registrations = json.data || [];
    const stats = json.stats || { total: 0, pending: 0, approved: 0 };

    const statsEl = $('#adminStats');
    if (statsEl) {
      statsEl.innerHTML = `
        <span>Total: <b>${stats.total}</b></span>
        <span>Menunggu: <b style="color:#d97706;">${stats.pending}</b></span>
        <span>Diterima: <b style="color:#15803d;">${stats.approved}</b></span>
      `;
    }

    const tbody = $('#registrationRows');
    if (!tbody) return;

    if (registrations.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:24px;">Belum ada data pendaftaran di database MySQL.</td></tr>';
      return;
    }

    tbody.innerHTML = registrations.map((r) => `
      <tr>
        <td><b>${escapeHtml(r.code)}</b><br>${escapeHtml(r.team_name)}</td>
        <td>${escapeHtml(r.captain_name)}<br><small>${escapeHtml(r.whatsapp)}</small></td>
        <td>${(r.registration_players || []).length} pemain</td>
        <td>
          ${escapeHtml(r.payment_method)}<br>
          <a class="proof-link" href="${escapeHtml(r.proof_path)}" target="_blank" rel="noopener">Lihat bukti ↗</a><br>
          <small>${r.payment_verified ? 'Terverifikasi' : 'Belum diverifikasi'}</small>
        </td>
        <td>
          <span class="status-pill ${r.status}">
            ${r.status === 'approved' ? 'Diterima' : r.status === 'rejected' ? 'Ditolak' : 'Menunggu'}
          </span>
        </td>
        <td>
          <div class="row-actions">
            ${r.status !== 'approved' ? `<button class="approve" data-id="${r.id}" data-action="approved">Terima</button>` : ''}
            ${r.status !== 'rejected' ? `<button class="reject" data-id="${r.id}" data-action="rejected">Tolak</button>` : ''}
          </div>
        </td>
      </tr>
    `).join('');

    tbody.querySelectorAll('[data-action]').forEach((b) => {
      b.addEventListener('click', () => updateRegistration(b.dataset.id, b.dataset.action));
    });
  } catch (err) {
    toast('Gagal memuat pendaftaran: ' + err.message);
  }
}

// Update status registrasi
async function updateRegistration(id, status) {
  const note = prompt(status === 'approved' ? 'Catatan persetujuan (opsional):' : 'Alasan penolakan / perbaikan:', '');
  if (status === 'rejected' && !note) return;

  try {
    const res = await fetch('api/admin.php?action=update_status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status, admin_note: note })
    });
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.error || 'Gagal mengubah status');

    toast('Status pendaftaran diperbarui.');
    loadRegistrations();
  } catch (err) {
    toast('Gagal memperbarui status: ' + err.message);
  }
}

document.addEventListener('DOMContentLoaded', init);