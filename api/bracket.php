<?php
/**
 * API Public - Tournament Bracket
 * Dadakan Volleyball Tournament
 */

require_once __DIR__ . '/db.php';

header('Content-Type: application/json; charset=utf-8');

try {
    $pdo = getDb();

    // Ambil data pertandingan yang diurutkan berdasarkan babak dan nomor pertandingan
    $stmt = $pdo->query("
        SELECT 
            id, round_name, round_order, match_number,
            team1_id, team1_name, team1_score,
            team2_id, team2_name, team2_score,
            match_date, court_name, status, winner_team, notes,
            created_at, updated_at
        FROM `tournament_matches`
        ORDER BY `round_order` ASC, `match_number` ASC
    ");
    $matches = $stmt->fetchAll();

    // Kelompokkan pertandingan per ronde / babak
    $rounds = [];
    foreach ($matches as $m) {
        $rName = $m['round_name'];
        if (!isset($rounds[$rName])) {
            $rounds[$rName] = [
                'round_name' => $rName,
                'round_order' => (int)$m['round_order'],
                'matches' => []
            ];
        }
        $rounds[$rName]['matches'][] = $m;
    }

    jsonResponse([
        'success' => true,
        'data' => array_values($rounds),
        'total_matches' => count($matches)
    ]);

} catch (Exception $e) {
    jsonResponse([
        'success' => false,
        'error' => $e->getMessage()
    ], 500);
}
