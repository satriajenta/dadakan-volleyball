<?php
/**
 * API Pendaftaran Tim Baru
 * Dadakan Volleyball Tournament
 */

require_once __DIR__ . '/db.php';

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(['success' => false, 'error' => 'Metode request tidak diizinkan.'], 405);
}

try {
    $pdo = getDb();

    // 1. Ambil data input
    $teamName    = trim($_POST['team_name'] ?? '');
    $origin      = trim($_POST['origin'] ?? '');
    $captainName = trim($_POST['captain_name'] ?? '');
    $whatsapp    = preg_replace('/\D/', '', $_POST['whatsapp'] ?? '');
    $email       = trim($_POST['email'] ?? '');
    $managerName = trim($_POST['manager_name'] ?? '');
    $payMethod   = trim($_POST['payment_method'] ?? '');
    $payerName   = trim($_POST['payer_name'] ?? '');
    $playersRaw  = $_POST['players'] ?? '[]';

    // 2. Validasi form
    if (mb_strlen($teamName) < 2 || mb_strlen($teamName) > 70) {
        throw new Exception('Nama tim wajib diisi (2–70 karakter).');
    }
    if (mb_strlen($captainName) < 2 || mb_strlen($captainName) > 70) {
        throw new Exception('Nama kapten wajib diisi.');
    }
    if (strlen($whatsapp) < 9 || strlen($whatsapp) > 16) {
        throw new Exception('Nomor WhatsApp tidak valid (minimal 9 digit angka).');
    }
    if (!in_array($payMethod, ['Transfer bank', 'QRIS'], true)) {
        throw new Exception('Metode pembayaran harus berupa Transfer bank atau QRIS.');
    }
    if (empty($payerName)) {
        throw new Exception('Nama pengirim pembayaran wajib diisi.');
    }

    // 3. Validasi daftar pemain
    $players = is_array($playersRaw) ? $playersRaw : json_decode($playersRaw, true);
    if (!is_array($players)) {
        throw new Exception('Data susunan pemain tidak valid.');
    }
    $playerCount = count($players);
    if ($playerCount < 6 || $playerCount > 12) {
        throw new Exception('Jumlah pemain harus antara 6 hingga 12 orang.');
    }

    $jerseyNumbers = [];
    $cleanPlayers = [];
    foreach ($players as $p) {
        $name = trim($p['name'] ?? $p['player_name'] ?? '');
        $num  = isset($p['jersey_number']) ? (int)$p['jersey_number'] : -1;

        if (mb_strlen($name) < 2 || mb_strlen($name) > 70) {
            throw new Exception("Nama pemain '$name' tidak valid (minimal 2 karakter).");
        }
        if ($num < 0 || $num > 99) {
            throw new Exception("Nomor punggung pemain '$name' harus antara 0 dan 99.");
        }
        if (in_array($num, $jerseyNumbers, true)) {
            throw new Exception("Nomor punggung #$num digunakan lebih dari satu pemain. Nomor harus unik.");
        }

        $jerseyNumbers[] = $num;
        $cleanPlayers[] = [
            'name' => $name,
            'jersey_number' => $num
        ];
    }

    // 4. Validasi & Proses Upload Bukti Pembayaran
    if (empty($_FILES['payment_proof']) || $_FILES['payment_proof']['error'] !== UPLOAD_ERR_OK) {
        throw new Exception('File bukti transfer wajib diunggah.');
    }

    $file = $_FILES['payment_proof'];
    $maxSize = 5 * 1024 * 1024; // 5 MB
    if ($file['size'] > $maxSize) {
        throw new Exception('Ukuran file bukti pembayaran melebihi batas maksimal 5 MB.');
    }

    $allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    $finfo = new finfo(FILEINFO_MIME_TYPE);
    $mimeType = $finfo->file($file['tmp_name']);
    if (!in_array($mimeType, $allowedMimes, true)) {
        throw new Exception('Format file harus berupa JPG, PNG, atau PDF.');
    }

    $ext = pathinfo($file['name'], PATHINFO_EXTENSION);
    $ext = strtolower($ext);
    if (!in_array($ext, ['jpg', 'jpeg', 'png', 'webp', 'pdf'], true)) {
        $ext = ($mimeType === 'application/pdf') ? 'pdf' : 'jpg';
    }

    // Buat folder upload jika belum ada
    $uploadDir = dirname(__DIR__) . '/uploads/proofs';
    if (!is_dir($uploadDir)) {
        mkdir($uploadDir, 0755, true);
    }

    // Generate kode pendaftaran acak DV-XXXXXX
    $randomStr = strtoupper(substr(bin2hex(random_bytes(4)), 0, 6));
    $code = 'DV-' . $randomStr;

    $fileName = 'proof_' . $code . '_' . time() . '.' . $ext;
    $targetPath = $uploadDir . '/' . $fileName;
    $relativeProofPath = 'uploads/proofs/' . $fileName;

    if (!move_uploaded_file($file['tmp_name'], $targetPath)) {
        throw new Exception('Gagal menyimpan file bukti pembayaran ke server.');
    }

    // 5. Simpan ke Database MySQL dalam Transaksi
    $pdo->beginTransaction();

    $stmt = $pdo->prepare("
        INSERT INTO `registrations` (
            `code`, `team_name`, `origin`, `captain_name`, `whatsapp`,
            `email`, `manager_name`, `payment_method`, `payer_name`,
            `proof_path`, `status`, `payment_verified`, `created_at`
        ) VALUES (
            ?, ?, ?, ?, ?,
            ?, ?, ?, ?,
            ?, 'pending', 0, NOW()
        )
    ");

    $stmt->execute([
        $code,
        $teamName,
        $origin ?: null,
        $captainName,
        $whatsapp,
        $email ?: null,
        $managerName ?: null,
        $payMethod,
        $payerName,
        $relativeProofPath
    ]);

    $registrationId = (int)$pdo->lastInsertId();

    // Insert seluruh pemain
    $stmtPlayer = $pdo->prepare("
        INSERT INTO `registration_players` (`registration_id`, `player_name`, `jersey_number`)
        VALUES (?, ?, ?)
    ");

    foreach ($cleanPlayers as $cp) {
        $stmtPlayer->execute([$registrationId, $cp['name'], $cp['jersey_number']]);
    }

    $pdo->commit();

    jsonResponse([
        'success' => true,
        'message' => 'Pendaftaran tim berhasil dikirim!',
        'code' => $code,
        'team_name' => $teamName,
        'players_count' => count($cleanPlayers)
    ]);

} catch (Exception $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    // Hapus file yang sudah terupload jika transaksi gagal
    if (isset($targetPath) && file_exists($targetPath)) {
        @unlink($targetPath);
    }

    jsonResponse([
        'success' => false,
        'error' => $e->getMessage()
    ], 400);
}
