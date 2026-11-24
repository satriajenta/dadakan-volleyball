<?php
/**
 * Konfigurasi & Koneksi Database MySQL (XAMPP)
 * Dadakan Volleyball Tournament
 */

// Konfigurasi Database MySQL
define('DB_HOST', 'localhost');
define('DB_USER', 'root');
define('DB_PASS', '');
define('DB_NAME', 'dadakan_volleyball');

// Start PHP Session jika belum aktif
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

/**
 * Mendapatkan koneksi PDO ke MySQL
 * Otomatis membuat database dan tabel jika belum ada
 */
function getDb() {
    static $pdo = null;
    if ($pdo !== null) {
        return $pdo;
    }

    try {
        // 1. Hubungkan ke MySQL Server
        $dsn = "mysql:host=" . DB_HOST . ";charset=utf8mb4";
        $pdo = new PDO($dsn, DB_USER, DB_PASS, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false
        ]);

        // 2. Buat database jika belum ada
        $pdo->exec("CREATE DATABASE IF NOT EXISTS `" . DB_NAME . "` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
        $pdo->exec("USE `" . DB_NAME . "`");

        // 3. Pastikan tabel-tabel utama sudah ada
        ensureTablesExist($pdo);

        return $pdo;
    } catch (PDOException $e) {
        jsonResponse([
            'success' => false,
            'error' => 'Gagal terhubung ke MySQL. Pastikan service MySQL sudah diaktifkan di XAMPP Control Panel.',
            'debug' => $e->getMessage()
        ], 500);
        exit;
    }
}

/**
 * Auto-migration: membuat tabel dan data admin awal secara otomatis
 */
function ensureTablesExist($pdo) {
    // Tabel Admin
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS `admin_users` (
            `id` INT AUTO_INCREMENT PRIMARY KEY,
            `email` VARCHAR(120) NOT NULL UNIQUE,
            `password_hash` VARCHAR(255) NOT NULL,
            `full_name` VARCHAR(100) NOT NULL DEFAULT 'Administrator',
            `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    ");

    // Tabel Pendaftaran Tim
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS `registrations` (
            `id` INT AUTO_INCREMENT PRIMARY KEY,
            `code` VARCHAR(15) NOT NULL UNIQUE,
            `team_name` VARCHAR(70) NOT NULL,
            `origin` VARCHAR(100) NULL,
            `captain_name` VARCHAR(70) NOT NULL,
            `whatsapp` VARCHAR(25) NOT NULL,
            `email` VARCHAR(120) NULL,
            `manager_name` VARCHAR(70) NULL,
            `payment_method` ENUM('Transfer bank', 'QRIS') NOT NULL,
            `payer_name` VARCHAR(70) NOT NULL,
            `proof_path` VARCHAR(255) NOT NULL,
            `status` ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
            `payment_verified` TINYINT(1) NOT NULL DEFAULT 0,
            `admin_note` TEXT NULL,
            `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            `reviewed_at` TIMESTAMP NULL DEFAULT NULL,
            INDEX `idx_reg_status` (`status`),
            INDEX `idx_reg_code` (`code`),
            INDEX `idx_reg_wa` (`whatsapp`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    ");

    // Tabel Anggota Pemain
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS `registration_players` (
            `id` INT AUTO_INCREMENT PRIMARY KEY,
            `registration_id` INT NOT NULL,
            `player_name` VARCHAR(70) NOT NULL,
            `jersey_number` INT NOT NULL,
            `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT `fk_player_registration`
                FOREIGN KEY (`registration_id`) REFERENCES `registrations`(`id`)
                ON DELETE CASCADE ON UPDATE CASCADE,
            UNIQUE KEY `unique_team_jersey` (`registration_id`, `jersey_number`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    ");

    // Tabel Turnamen Bracket / Jadwal Pertandingan
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS `tournament_matches` (
            `id` INT AUTO_INCREMENT PRIMARY KEY,
            `round_name` VARCHAR(50) NOT NULL,
            `round_order` INT NOT NULL DEFAULT 1,
            `match_number` INT NOT NULL DEFAULT 1,
            `team1_id` INT NULL,
            `team1_name` VARCHAR(70) NOT NULL,
            `team1_score` INT NULL DEFAULT NULL,
            `team2_id` INT NULL,
            `team2_name` VARCHAR(70) NOT NULL,
            `team2_score` INT NULL DEFAULT NULL,
            `match_date` DATETIME NULL DEFAULT NULL,
            `court_name` VARCHAR(50) NULL DEFAULT 'Lapangan Utama',
            `status` ENUM('scheduled', 'live', 'completed') NOT NULL DEFAULT 'scheduled',
            `winner_team` ENUM('team1', 'team2', 'draw') NULL DEFAULT NULL,
            `notes` VARCHAR(255) NULL DEFAULT NULL,
            `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX `idx_round_order` (`round_order`),
            INDEX `idx_match_status` (`status`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    ");

    // Seeder akun admin awal jika tabel masih kosong
    $stmt = $pdo->query("SELECT COUNT(*) AS total FROM `admin_users`");
    $count = $stmt->fetchColumn();
    if ($count == 0) {
        $defaultHash = '$2y$10$Xf.VZhbflVj1slXjM5XlOu5Uq714N.H2ExonaT5O0VGjF9xxVg8Oa'; // admin123
        $insert = $pdo->prepare("INSERT INTO `admin_users` (`email`, `password_hash`, `full_name`) VALUES (?, ?, ?)");
        $insert->execute(['admin@dadakan.com', $defaultHash, 'Panitia Turnamen']);
    }
}

/**
 * Helper untuk response JSON
 */
function jsonResponse($data, $statusCode = 200) {
    http_response_code($statusCode);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit;
}

/**
 * Helper verifikasi login admin
 */
function checkAdminAuth() {
    if (empty($_SESSION['admin_logged_in']) || $_SESSION['admin_logged_in'] !== true) {
        jsonResponse([
            'success' => false,
            'error' => 'Akses ditolak. Silakan login sebagai admin terlebih dahulu.'
        ], 401);
    }
}
