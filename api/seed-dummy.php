<?php
/**
 * Seed 16 dummy teams + bracket matches
 * Run once: http://localhost/dadakan-volleyball-cloud/api/seed-dummy.php
 */

require_once __DIR__ . '/db.php';

header('Content-Type: text/html; charset=utf-8');

$pdo = getDb();

// ─── 1. Teams data ───────────────────────────────────────────
$teams = [
  ['Garuda Smash', 'garuda_smash', 'Pak Budi', '081234561001'],
  ['Bumi Voli FC', 'bumi_voli', 'Bu Siti', '081234561002'],
  ['Langit Biru VC', 'langit_biru', 'Pak Andi', '081234561003'],
  ['Nusantara United', 'nusantara_utd', 'Bu Rina', '081234561004'],
  ['Elang Sakti', 'elang_sakti', 'Pak Doni', '081234561005'],
  ['Rajawali Muda', 'rajawali_muda', 'Bu Yuli', '081234561006'],
  ['Putra Bangsa', 'putra_bangsa', 'Pak Heru', '081234561007'],
  ['Merah Putih VC', 'merah_putih', 'Bu Dewi', '081234561008'],
  ['Santai Juara', 'santai_juara', 'Pak Reza', '081234561009'],
  ['Pantai Voli', 'pantai_voli', 'Bu Maya', '081234561010'],
  ['Semangat API', 'semangat_api', 'Pak Fikri', '081234561011'],
  ['Kilat Voli', 'kilat_voli', 'Bu Laras', '081234561012'],
  ['Badai Utara', 'badai_utara', 'Pak Surya', '081234561013'],
  ['Delta Smash', 'delta_smash', 'Bu Nita', '081234561014'],
  ['Topan Selatan', 'topan_selatan', 'Pak Irfan', '081234561015'],
  ['Cakra Buana', 'cakra_buana', 'Bu Eka', '081234561016'],
];

$playerNames = [
  'Adi','Bayu','Cahyo','Dani','Eko','Fajar',
  'Gilang','Hadi','Ivan','Joko','Kiki','Luki',
  'Miko','Nanda','Oki','Pandu','Qori','Rudi',
  'Sandi','Tono','Umar','Vino','Widi','Xander',
  'Yogi','Zaki'
];

$insertedIds = [];

$pdo->beginTransaction();
try {

  // ── Insert registrations ──────────────────────────────────
  foreach ($teams as $i => $t) {
    [$teamName, $slug, $contact, $phone] = $t;
    $code = 'DV-DUM' . str_pad($i + 1, 3, '0', STR_PAD_LEFT);

    // Check if already seeded
    $check = $pdo->prepare("SELECT id FROM registrations WHERE registration_code = ?");
    $check->execute([$code]);
    if ($check->fetch()) {
      echo "<p>⚠️ Tim <b>{$teamName}</b> sudah ada, skip.</p>\n";
      $row = $pdo->prepare("SELECT id FROM registrations WHERE registration_code = ?");
      $row->execute([$code]);
      $insertedIds[] = $row->fetchColumn();
      continue;
    }

    $stmt = $pdo->prepare("
      INSERT INTO registrations
        (registration_code, team_name, contact_name, contact_phone, contact_email,
         payment_proof_path, payment_verified, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 1, 'approved', NOW())
    ");
    $stmt->execute([
      $code, $teamName, $contact, $phone,
      strtolower($slug) . '@dummy.com',
      'uploads/proofs/dummy-proof.jpg'
    ]);
    $regId = (int)$pdo->lastInsertId();
    $insertedIds[] = $regId;

    // ── Insert 6 players per team ──────────────────────────
    for ($p = 0; $p < 6; $p++) {
      $pName = $playerNames[($i * 6 + $p) % count($playerNames)] . ' ' . $teamName;
      $jersey = $p + 1;
      $ps = $pdo->prepare("
        INSERT INTO registration_players
          (registration_id, player_name, jersey_number, position)
        VALUES (?, ?, ?, ?)
      ");
      $positions = ['Setter','Outside Hitter','Middle Blocker','Opposite','Libero','Outside Hitter'];
      $ps->execute([$regId, $pName, $jersey, $positions[$p]]);
    }

    echo "<p>✅ Tim <b>{$teamName}</b> ditambahkan (ID: {$regId})</p>\n";
  }

  // ─── 2. Clear old dummy matches ───────────────────────────
  $pdo->exec("DELETE FROM tournament_matches WHERE notes LIKE '%dummy%'");

  // ─── 3. Bracket: 16 Besar (8 matches) ────────────────────
  $round16 = [
    [1, $teams[0][0], $teams[1][0]],
    [2, $teams[2][0], $teams[3][0]],
    [3, $teams[4][0], $teams[5][0]],
    [4, $teams[6][0], $teams[7][0]],
    [5, $teams[8][0], $teams[9][0]],
    [6, $teams[10][0], $teams[11][0]],
    [7, $teams[12][0], $teams[13][0]],
    [8, $teams[14][0], $teams[15][0]],
  ];

  $dates16 = [
    '2026-12-05 08:00:00','2026-12-05 10:00:00',
    '2026-12-05 13:00:00','2026-12-05 15:00:00',
    '2026-12-06 08:00:00','2026-12-06 10:00:00',
    '2026-12-06 13:00:00','2026-12-06 15:00:00',
  ];

  foreach ($round16 as $idx => [$num, $t1, $t2]) {
    $ins = $pdo->prepare("
      INSERT INTO tournament_matches
        (round_name, round_order, match_number,
         team1_name, team1_score,
         team2_name, team2_score,
         match_date, court_name, status, notes)
      VALUES ('Babak 16 Besar', 1, ?, ?, 0, ?, 0, ?, 'Lapangan A', 'scheduled', 'dummy')
    ");
    $ins->execute([$num, $t1, $t2, $dates16[$idx]]);
  }
  echo "<p>✅ 8 match Babak 16 Besar dibuat</p>\n";

  // ─── 4. Perempat Final (4 matches) ───────────────────────
  $qf = [
    [1, 'Pemenang M1', 'Pemenang M2', '2026-12-07 08:00:00'],
    [2, 'Pemenang M3', 'Pemenang M4', '2026-12-07 10:00:00'],
    [3, 'Pemenang M5', 'Pemenang M6', '2026-12-07 13:00:00'],
    [4, 'Pemenang M7', 'Pemenang M8', '2026-12-07 15:00:00'],
  ];
  foreach ($qf as [$num, $t1, $t2, $date]) {
    $ins = $pdo->prepare("
      INSERT INTO tournament_matches
        (round_name, round_order, match_number,
         team1_name, team1_score, team2_name, team2_score,
         match_date, court_name, status, notes)
      VALUES ('Perempat Final', 2, ?, ?, NULL, ?, NULL, ?, 'Lapangan A', 'scheduled', 'dummy')
    ");
    $ins->execute([$num, $t1, $t2, $date]);
  }
  echo "<p>✅ 4 match Perempat Final dibuat</p>\n";

  // ─── 5. Semi Final (2 matches) ───────────────────────────
  $sf = [
    [1, 'Pemenang QF1', 'Pemenang QF2', '2026-12-08 09:00:00'],
    [2, 'Pemenang QF3', 'Pemenang QF4', '2026-12-08 13:00:00'],
  ];
  foreach ($sf as [$num, $t1, $t2, $date]) {
    $ins = $pdo->prepare("
      INSERT INTO tournament_matches
        (round_name, round_order, match_number,
         team1_name, team1_score, team2_name, team2_score,
         match_date, court_name, status, notes)
      VALUES ('Semi Final', 3, ?, ?, NULL, ?, NULL, ?, 'Lapangan Utama', 'scheduled', 'dummy')
    ");
    $ins->execute([$num, $t1, $t2, $date]);
  }
  echo "<p>✅ 2 match Semi Final dibuat</p>\n";

  // ─── 6. Grand Final (1 match) ────────────────────────────
  $ins = $pdo->prepare("
    INSERT INTO tournament_matches
      (round_name, round_order, match_number,
       team1_name, team1_score, team2_name, team2_score,
       match_date, court_name, status, notes)
    VALUES ('Grand Final', 4, 1, 'Pemenang SF1', NULL, 'Pemenang SF2', NULL,
            '2026-12-09 15:00:00', 'Lapangan Utama', 'scheduled', 'dummy')
  ");
  $ins->execute();
  echo "<p>✅ 1 match Grand Final dibuat</p>\n";

  $pdo->commit();
  echo "<hr><h2 style='color:green'>🎉 Seeding selesai! 16 tim + bracket lengkap berhasil dibuat.</h2>";
  echo "<p><a href='../bracket.html'>→ Lihat Bracket</a> | <a href='../admin.html'>→ Admin Dashboard</a></p>";

} catch (Exception $e) {
  $pdo->rollBack();
  echo "<h2 style='color:red'>❌ Error: " . htmlspecialchars($e->getMessage()) . "</h2>";
  echo "<pre>" . htmlspecialchars($e->getTraceAsString()) . "</pre>";
}
