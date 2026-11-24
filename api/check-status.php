<?php
/**
 * API Cek Status Pendaftaran Tim
 * Dadakan Volleyball Tournament
 */

require_once __DIR__ . '/db.php';

header('Content-Type: application/json; charset=utf-8');

try {
    $pdo = getDb();

    // Terima data baik via POST maupun GET
    $code       = strtoupper(trim($_REQUEST['code'] ?? ''));
    $phoneLast4 = trim($_REQUEST['phone_last4'] ?? '');

    if (empty($code) || empty($phoneLast4)) {
        throw new Exception('Kode registrasi dan 4 digit terakhir nomor WhatsApp wajib diisi.');
    }

    if (!preg_match('/^[0-9]{4}$/', $phoneLast4)) {
        throw new Exception('4 digit WhatsApp harus berupa 4 angka numerik.');
    }

    $stmt = $pdo->prepare("
        SELECT 
            r.`id`,
            r.`code`,
            r.`team_name`,
            r.`origin`,
            r.`captain_name`,
            r.`status`,
            r.`payment_verified`,
            r.`admin_note`,
            r.`created_at`,
            (SELECT COUNT(*) FROM `registration_players` p WHERE p.`registration_id` = r.`id`) AS `player_count`
        FROM `registrations` r
        WHERE UPPER(r.`code`) = ? AND RIGHT(r.`whatsapp`, 4) = ?
        LIMIT 1
    ");

    $stmt->execute([$code, $phoneLast4]);
    $team = $stmt->fetch();

    if (!$team) {
        jsonResponse([
            'success' => false,
            'error' => 'Data tidak ditemukan. Pastikan kode registrasi dan 4 digit nomor WhatsApp sesuai saat pendaftaran.'
        ], 404);
    }

    jsonResponse([
        'success' => true,
        'data' => [
            'code' => $team['code'],
            'team_name' => $team['team_name'],
            'origin' => $team['origin'],
            'captain_name' => $team['captain_name'],
            'status' => $team['status'],
            'payment_verified' => (bool)$team['payment_verified'],
            'admin_note' => $team['admin_note'],
            'player_count' => (int)$team['player_count'],
            'created_at' => $team['created_at']
        ]
    ]);

} catch (Exception $e) {
    jsonResponse([
        'success' => false,
        'error' => $e->getMessage()
    ], 400);
}
