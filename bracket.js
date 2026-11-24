/**
 * Dadakan Volleyball – Knockout Stage Bracket
 * M4 Championship-style tree bracket with connector lines
 */

(function () {
  'use strict';

  const $ = (s) => document.querySelector(s);

  /* ── Escape helper ───────────────────────────────────────── */
  const esc = (v = '') =>
    String(v).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));

  /* ── Toast ───────────────────────────────────────────────── */
  function toast(msg) {
    const el = $('#toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.remove('show'), 3200);
  }

  /* ── Date formatter ──────────────────────────────────────── */
  function fmtDate(str) {
    if (!str) return null;
    try {
      const d = new Date(str);
      if (isNaN(d)) return str;
      return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) +
        ' ' + d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    } catch { return str; }
  }

  /* ── Render one match card ───────────────────────────────── */
  function renderCard(m, matchIdx) {
    const w1 = m.winner_team === 'team1';
    const w2 = m.winner_team === 'team2';
    const isLive = m.status === 'live';
    const dateStr = fmtDate(m.match_date);

    const statusHtml = isLive
      ? '<span class="status-pill-mini live">● LIVE</span>'
      : m.status === 'completed'
        ? '<span class="status-pill-mini completed">Selesai</span>'
        : '';

    return `
<div class="esport-match-card${isLive ? ' is-live' : ''}">
  <div class="match-top-info">
    <span class="match-tag">MATCH ${matchIdx}${statusHtml}</span>
    <span class="match-schedule">${dateStr ? esc(dateStr) : 'Jadwal menyusul'}</span>
  </div>
  <div class="team-slot${w1 ? ' winner' : ''}">
    <div class="team-info-left">
      <span class="team-flag-icon">🏐</span>
      <span class="team-name">${esc(m.team1_name || 'TBD')}</span>
    </div>
    <span class="score-box">${(m.team1_score !== null && m.team1_score !== '') ? esc(String(m.team1_score)) : '0'}</span>
  </div>
  <div class="team-slot${w2 ? ' winner' : ''}">
    <div class="team-info-left">
      <span class="team-flag-icon">🏐</span>
      <span class="team-name">${esc(m.team2_name || 'TBD')}</span>
    </div>
    <span class="score-box">${(m.team2_score !== null && m.team2_score !== '') ? esc(String(m.team2_score)) : '0'}</span>
  </div>
</div>`;
  }

  /* ── Render connector column between rounds ──────────────── */
  function renderConnector(matchCount) {
    const pairCount = Math.ceil(matchCount / 2);
    let pairs = '';
    for (let i = 0; i < pairCount; i++) {
      pairs += `<div class="connector-pair"><div class="line-fork"></div></div>`;
    }
    return `<div class="bracket-connector-col">${pairs}</div>`;
  }

  /* ── Build the full bracket tree HTML ───────────────────── */
  function buildBracketTree(rounds) {
    let html = '<div class="bracket-tree">';

    rounds.forEach((round, ri) => {
      const matches = round.matches || [];

      html += `<div class="bracket-column">`;
      html += `<div class="column-header">
        <span class="column-header-title">${esc(round.round_name)}</span>
      </div>`;
      html += `<div class="column-matches">`;

      matches.forEach((m, mi) => {
        const idx = m.match_number || (mi + 1);
        html += `<div class="match-node">${renderCard(m, idx)}</div>`;
      });

      html += `</div></div>`; // column-matches + bracket-column

      // Connector lines between columns (not after the last one)
      if (ri < rounds.length - 1) {
        html += renderConnector(matches.length);
      }
    });

    html += '</div>'; // bracket-tree
    return html;
  }

  /* ── Empty state ─────────────────────────────────────────── */
  function emptyState() {
    return `
<div style="text-align:center;padding:70px 20px;color:var(--esport-text-muted);">
  <div style="font-size:48px;margin-bottom:16px;filter:grayscale(0.3);">🏆</div>
  <h3 style="font-family:'Barlow Condensed',sans-serif;font-size:24px;color:var(--esport-text-light);
      margin:0 0 10px;letter-spacing:0.08em;text-transform:uppercase;">
    Bagan Belum Diterbitkan
  </h3>
  <p style="font-size:13px;line-height:1.7;max-width:440px;margin:auto;">
    Panitia sedang menyusun bracket dan jadwal pertandingan.<br>
    Silakan periksa kembali setelah proses registrasi selesai.
  </p>
</div>`;
  }

  /* ── Load & render ───────────────────────────────────────── */
  async function loadBracket() {
    const container = $('#bracketTreeContainer');
    if (!container) return;

    container.innerHTML = `
<div style="text-align:center;padding:60px 20px;color:var(--esport-text-muted);">
  <p style="font-size:13px;letter-spacing:0.06em;">Memuat bagan pertandingan…</p>
</div>`;

    try {
      const res = await fetch('api/bracket.php');
      const json = await res.json();

      if (!res.ok || !json.success) throw new Error(json.error || 'Gagal memuat data bracket');

      const rounds = json.data || [];
      if (rounds.length === 0) {
        container.innerHTML = emptyState();
        return;
      }

      container.innerHTML = buildBracketTree(rounds);

    } catch (err) {
      container.innerHTML = `
<div style="text-align:center;padding:40px 20px;color:#f87171;
    background:rgba(239,68,68,0.08);border-radius:12px;border:1px solid rgba(239,68,68,0.2);">
  <div style="font-size:28px;margin-bottom:10px;">⚠️</div>
  <strong>Gagal memuat bagan</strong>
  <p style="margin:6px 0 0;font-size:12px;color:#fca5a5;">${esc(err.message)}</p>
</div>`;
    }
  }

  /* ── Init ────────────────────────────────────────────────── */
  document.addEventListener('DOMContentLoaded', () => {
    loadBracket();
    $('#refreshBracketPageBtn')?.addEventListener('click', () => {
      loadBracket();
      toast('Memperbarui bagan… 🔄');
    });
  });

})();
