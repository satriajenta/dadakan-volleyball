<?php
/**
 * API Autentikasi Admin (MySQL + PHP Session)
 * Dadakan Volleyball Tournament
 */

require_once __DIR__ . '/db.php';

header('Content-Type: application/json; charset=utf-8');

$action = $_GET['action'] ?? $_POST['action'] ?? 'check';

try {
    $pdo = getDb();

    switch ($action) {
        case 'login':
            if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
                throw new Exception('Metode request tidak diizinkan.');
            }

            // Menerima data JSON atau form-data
            $input = json_decode(file_get_contents('php://input'), true) ?: $_POST;
            $email = trim($input['email'] ?? '');
            $password = $input['password'] ?? '';

            if (empty($email) || empty($password)) {
                throw new Exception('Email dan password admin wajib diisi.');
            }

            $stmt = $pdo->prepare("SELECT `id`, `email`, `password_hash`, `full_name` FROM `admin_users` WHERE `email` = ? LIMIT 1");
            $stmt->execute([$email]);
            $admin = $stmt->fetch();

            if (!$admin || !password_verify($password, $admin['password_hash'])) {
                jsonResponse([
                    'success' => false,
                    'error' => 'Email atau password admin salah.'
                ], 401);
            }

            // Set session login
            $_SESSION['admin_logged_in'] = true;
            $_SESSION['admin_id'] = $admin['id'];
            $_SESSION['admin_email'] = $admin['email'];
            $_SESSION['admin_name'] = $admin['full_name'];

            jsonResponse([
                'success' => true,
                'message' => 'Login berhasil.',
                'user' => [
                    'id' => $admin['id'],
                    'email' => $admin['email'],
                    'full_name' => $admin['full_name']
                ]
            ]);
            break;

        case 'check':
            if (!empty($_SESSION['admin_logged_in']) && $_SESSION['admin_logged_in'] === true) {
                jsonResponse([
                    'authenticated' => true,
                    'user' => [
                        'id' => $_SESSION['admin_id'] ?? null,
                        'email' => $_SESSION['admin_email'] ?? '',
                        'full_name' => $_SESSION['admin_name'] ?? 'Admin'
                    ]
                ]);
            } else {
                jsonResponse([
                    'authenticated' => false
                ]);
            }
            break;

        case 'logout':
            $_SESSION = [];
            if (ini_get("session.use_cookies")) {
                $params = session_get_cookie_params();
                setcookie(session_name(), '', time() - 42000,
                    $params["path"], $params["domain"],
                    $params["secure"], $params["httponly"]
                );
            }
            session_destroy();

            jsonResponse([
                'success' => true,
                'message' => 'Berhasil logout.'
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
