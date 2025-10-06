<?php
header('Content-Type: application/json');

$path = $_SERVER['REQUEST_URI'];

if ($path === '/health' || $path === '/health/') {
    echo json_encode(['status' => 'ok', 'service' => 'backend-php']);
    exit;
}

echo json_encode(['message' => 'Hello from Avtomation Workflow - PHP backend']);
