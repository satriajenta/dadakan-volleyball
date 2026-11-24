<?php
/**
 * API Dashboard Admin (MySQL)
 * Dadakan Volleyball Tournament
 */

require_once __DIR__ . '/db.php';

header('Content-Type: application/json; charset=utf-8');

// Pastikan hanya admin yang login yang bisa mengakses
checkAdminAuth();

$action = $_GET['action'] ?? $_POST['action'] ?? 'list';

try {
    $pdo = getDb();

    switch ($action) {
        case 'list':
            // 1. Ambil seluruh data pendaftaran
            $stmt = $pdo->query("
                SELECT * FROM `registrations`
                ORDER BY `created_at` DESC
            ");
            $registrations = $stmt->fetchAll();

            // 2. Ambil seluruh pemain dan kelompokkan berdasarkan registration_id
            $playersStmt = $pdo->query("
                SELECT * FROM `registration_players`
                ORDER BY `jersey_number` ASC
            ");
            $allPlayers = $playersStmt->fetchAll();

            $playersByRegId = [];
            foreach ($allPlayers as $p) {
                $regId = $p['registration_id'];
                if (!isset($playersByRegId[$regId])) {
                    $playersByRegId[$regId] = [];
                }
                $playersByRegId[$regId][] = [
                    'id' => (int)$p['id'],
                    'player_name' => $p['player_name'],
                    'jersey_number' => (int)$p['jersey_number']
                ];
            }

            // Gabungkan pemain ke dalam data pendaftaran
            $stats = [
                'total' => count($registrations),
                'pending' => 0,
                'approved' => 0,
                'rejected' => 0,
                'total_players' => 0
            ];

            foreach ($registrations as &$reg) {
                $regId = $reg['id'];
                $reg['registration_players'] = $playersByRegId[$regId] ?? [];
                $reg['payment_verified'] = (bool)$reg['payment_verified'];

                // Hitung statistik
                $st = $reg['status'];
                if (isset($stats[$st])) {
                    $stats[$st]++;
                }
                $stats['total_players'] += count($reg['registration_players']);
            }
            unset($reg);

            jsonResponse([
                'success' => true,
                'data' => $registrations,
                'stats' => $stats
            ]);
            break;

        case 'update_status':
            if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
                throw new Exception('Metode request tidak diizinkan.');
            }

            $input = json_decode(file_get_contents('php://input'), true) ?: $_POST;
            $id = (int)($input['id'] ?? 0);
            $status = trim($input['status'] ?? '');
            $note = trim($input['admin_note'] ?? '');

            if ($id <= 0) {
                throw new Exception('ID pendaftaran tidak valid.');
            }
            if (!in_array($status, ['pending', 'approved', 'rejected'], true)) {
                throw new Exception('Status pendaftaran tidak valid.');
            }

            $paymentVerified = ($status === 'approved') ? 1 : 0;

            $stmt = $pdo->prepare("
                UPDATE `registrations`
                SET `status` = ?,
                    `payment_verified` = ?,
                    `admin_note` = ?,
                    `reviewed_at` = NOW()
                WHERE `id` = ?
            ");
            $stmt->execute([
                $status,
                $paymentVerified,
                $note ?: null,
                $id
            ]);

            jsonResponse([
                'success' => true,
                'message' => 'Status pendaftaran berhasil diperbarui.'
            ]);
            break;

        case 'export_csv':
            // Generate dan download CSV
            header('Content-Type: text/csv; charset=utf-8');
            header('Content-Disposition: attachment; filename="pendaftaran-dadakan-volleyball-' . date('Y-m-d') . '.csv"');

            $output = fopen('php://output', 'w');
            // Tulis BOM UTF-8 agar Excel mengenali karakter khusus
            fprintf($output, chr(0xEF).chr(0xBB).chr(0xBF));

            // Header kolom
            fputcsv($output, [
                'Kode Registrasi',
                'Nama Tim',
                'Asal Klub/Kota',
                'Nama Kapten',
                'WhatsApp Kapten',
                'Email',
                'Nama Manajer',
                'Metode Pembayaran',
                'Nama Pengirim',
                'Status Pendaftaran',
                'Pembayaran Terverifikasi',
                'Jumlah Pemain',
                'Daftar Roster (No - Nama)',
                'Catatan Admin',
                'Waktu Mendaftar'
            ]);

            // Ambil data
            $stmt = $pdo->query("SELECT * FROM `registrations` ORDER BY `created_at` DESC");
            $regs = $stmt->fetchAll();

            $pStmt = $pdo->prepare("SELECT `jersey_number`, `player_name` FROM `registration_players` WHERE `registration_id` = ? ORDER BY `jersey_number` ASC");

            foreach ($regs as $r) {
                $pStmt->execute([$r['id']]);
                $players = $pStmt->fetchAll();
                $rosterList = [];
                foreach ($players as $p) {
                    $rosterList[] = '#' . $p['jersey_number'] . ' ' . $p['player_name'];
                }

                fputcsv($output, [
                    $r['code'],
                    $r['team_name'],
                    $r['origin'] ?? '-',
                    $r['captain_name'],
                    $r['whatsapp'],
                    $r['email'] ?? '-',
                    $r['manager_name'] ?? '-',
                    $r['payment_method'],
                    $r['payer_name'],
                    strtoupper($r['status']),
                    $r['payment_verified'] ? 'Ya' : 'Belum',
                    count($players),
                    implode('; ', $rosterList),
                    $r['admin_note'] ?? '',
                    $r['created_at']
                ]);
            }

            fclose($output);
            exit;

        // ==================== CRUD BRACKET / MATCHES ====================
        case 'bracket_list':
            $stmt = $pdo->query("SELECT * FROM `tournament_matches` ORDER BY `round_order` ASC, `match_number` ASC");
            $matches = $stmt->fetchAll();

            // Ambil daftar tim yang sudah diapprove untuk pilihan dropdown
            $teamsStmt = $pdo->query("SELECT id, team_name, origin FROM `registrations` WHERE status = 'approved' ORDER BY team_name ASC");
            $approvedTeams = $teamsStmt->fetchAll();

            jsonResponse([
                'success' => true,
                'data' => $matches,
                'approved_teams' => $approvedTeams
            ]);
            break;

        case 'bracket_save':
            if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
                throw new Exception('Metode request tidak diizinkan.');
            }

            $input = json_decode(file_get_contents('php://input'), true) ?: $_POST;
            $id = !empty($input['id']) ? (int)$input['id'] : null;
            $roundName = trim($input['round_name'] ?? 'Babak 1');
            $roundOrder = (int)($input['round_order'] ?? 1);
            $matchNumber = (int)($input['match_number'] ?? 1);
            $team1Name = trim($input['team1_name'] ?? '');
            $team2Name = trim($input['team2_name'] ?? '');
            $team1Id = !empty($input['team1_id']) ? (int)$input['team1_id'] : null;
            $team2Id = !empty($input['team2_id']) ? (int)$input['team2_id'] : null;
            $team1Score = ($input['team1_score'] !== '' && $input['team1_score'] !== null) ? (int)$input['team1_score'] : null;
            $team2Score = ($input['team2_score'] !== '' && $input['team2_score'] !== null) ? (int)$input['team2_score'] : null;
            $matchDate = !empty($input['match_date']) ? $input['match_date'] : null;
            $courtName = trim($input['court_name'] ?? 'Lapangan Utama');
            $status = in_array($input['status'] ?? '', ['scheduled', 'live', 'completed']) ? $input['status'] : 'scheduled';
            $winnerTeam = in_array($input['winner_team'] ?? '', ['team1', 'team2', 'draw']) ? $input['winner_team'] : null;
            $notes = trim($input['notes'] ?? '');

            if (empty($team1Name) || empty($team2Name)) {
                throw new Exception('Nama Tim 1 dan Tim 2 wajib diisi.');
            }

            // Otomatis tentukan pemenang jika status completed dan skor ada
            if ($status === 'completed' && empty($winnerTeam) && $team1Score !== null && $team2Score !== null) {
                if ($team1Score > $team2Score) $winnerTeam = 'team1';
                elseif ($team2Score > $team1Score) $winnerTeam = 'team2';
                else $winnerTeam = 'draw';
            }

            if ($id) {
                // Update match
                $stmt = $pdo->prepare("
                    UPDATE `tournament_matches`
                    SET round_name = ?, round_order = ?, match_number = ?,
                        team1_id = ?, team1_name = ?, team1_score = ?,
                        team2_id = ?, team2_name = ?, team2_score = ?,
                        match_date = ?, court_name = ?, status = ?, winner_team = ?, notes = ?
                    WHERE id = ?
                ");
                $stmt->execute([
                    $roundName, $roundOrder, $matchNumber,
                    $team1Id, $team1Name, $team1Score,
                    $team2Id, $team2Name, $team2Score,
                    $matchDate, $courtName, $status, $winnerTeam, $notes ?: null,
                    $id
                ]);
                $msg = 'Pertandingan bracket berhasil diperbarui.';
            } else {
                // Create new match
                $stmt = $pdo->prepare("
                    INSERT INTO `tournament_matches` (
                        round_name, round_order, match_number,
                        team1_id, team1_name, team1_score,
                        team2_id, team2_name, team2_score,
                        match_date, court_name, status, winner_team, notes
                    ) VALUES (
                        ?, ?, ?,
                        ?, ?, ?,
                        ?, ?, ?,
                        ?, ?, ?, ?, ?
                    )
                ");
                $stmt->execute([
                    $roundName, $roundOrder, $matchNumber,
                    $team1Id, $team1Name, $team1Score,
                    $team2Id, $team2Name, $team2Score,
                    $matchDate, $courtName, $status, $winnerTeam, $notes ?: null
                ]);
                $id = (int)$pdo->lastInsertId();
                $msg = 'Pertandingan bracket berhasil ditambahkan.';
            }

            jsonResponse([
                'success' => true,
                'message' => $msg,
                'id' => $id
            ]);
            break;

        case 'bracket_delete':
            if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
                throw new Exception('Metode request tidak diizinkan.');
            }

            $input = json_decode(file_get_contents('php://input'), true) ?: $_POST;
            $id = (int)($input['id'] ?? 0);
            if ($id <= 0) {
                throw new Exception('ID pertandingan tidak valid.');
            }

            $stmt = $pdo->prepare("DELETE FROM `tournament_matches` WHERE id = ?");
            $stmt->execute([$id]);

            jsonResponse([
                'success' => true,
                'message' => 'Pertandingan bracket berhasil dihapus.'
            ]);
            break;

        default:
            throw new Exception('Aksi tidak dikenali.');
    }

} catch (Exception $e) {
    jsonResponse([
        'success' => false,
        'error' => $e->getMessage()
    ], 400);
}
