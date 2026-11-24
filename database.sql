-- ==============================================================
-- DATABASE: Dadakan Volleyball Tournament
-- SISTEM DATABASE: MySQL / MariaDB (XAMPP)
-- ==============================================================

CREATE DATABASE IF NOT EXISTS `dadakan_volleyball`
CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE `dadakan_volleyball`;

-- --------------------------------------------------------------
-- 1. Tabel Administrator (admin_users)
-- --------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `admin_users` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `email` VARCHAR(120) NOT NULL UNIQUE,
  `password_hash` VARCHAR(255) NOT NULL,
  `full_name` VARCHAR(100) NOT NULL DEFAULT 'Administrator',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------
-- 2. Tabel Pendaftaran Tim (registrations)
-- --------------------------------------------------------------
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

-- --------------------------------------------------------------
-- 3. Tabel Anggota Pemain Tim (registration_players)
-- --------------------------------------------------------------
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

-- --------------------------------------------------------------
-- 4. Akun Admin Bawaan
-- Email: admin@dadakan.com
-- Password: admin123
-- --------------------------------------------------------------
INSERT INTO `admin_users` (`id`, `email`, `password_hash`, `full_name`)
VALUES (
  1,
  'admin@dadakan.com',
  '$2y$10$Xf.VZhbflVj1slXjM5XlOu5Uq714N.H2ExonaT5O0VGjF9xxVg8Oa',
  'Panitia Turnamen'
)
ON DUPLICATE KEY UPDATE `email` = VALUES(`email`);

-- --------------------------------------------------------------
-- 5. Tabel Turnamen Bracket / Pertandingan (tournament_matches)
-- --------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `tournament_matches` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `round_name` VARCHAR(50) NOT NULL, -- 'Babak 16 Besar', 'Perempat Final', 'Semi Final', 'Final', 'Perebutan Juara 3'
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
