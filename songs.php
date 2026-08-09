<?php
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');

$songsDir = __DIR__ . '/songs';

if (!is_dir($songsDir)) {
    http_response_code(500);
    echo json_encode(['error' => 'Songs directory not found.']);
    exit;
}

$files = [];

foreach (scandir($songsDir) as $fileName) {
    if ($fileName === '.' || $fileName === '..') {
        continue;
    }

    $fullPath = $songsDir . DIRECTORY_SEPARATOR . $fileName;

    if (is_file($fullPath) && strcasecmp(pathinfo($fileName, PATHINFO_EXTENSION), 'pdf') === 0) {
        $files[] = $fileName;
    }
}

natcasesort($files);
echo json_encode(array_values($files), JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
