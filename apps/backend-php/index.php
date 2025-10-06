<?php
header('Content-Type: application/json');

$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

$dataDir = __DIR__ . '/data';
if (!file_exists($dataDir))
    mkdir($dataDir, 0755, true);

function loadData($name)
{
    $p = __DIR__ . '/data/' . $name . '.json';
    if (!file_exists($p))
        return [];
    return json_decode(file_get_contents($p), true) ?: [];
}

function saveData($name, $data)
{
    $p = __DIR__ . '/data/' . $name . '.json';
    file_put_contents($p, json_encode($data, JSON_PRETTY_PRINT));
}

$workflows = loadData('workflows');
$users = loadData('users');
$executions = loadData('executions');

if ($path === '/health') {
    echo json_encode(['status' => 'ok', 'service' => 'backend-php']);
    exit;
}

// simple router
$method = $_SERVER['REQUEST_METHOD'];

if ($path === '/auth/register' && $method === 'POST') {
    $body = json_decode(file_get_contents('php://input'), true);
    if (empty($body['email']) || empty($body['password'])) {
        http_response_code(400);
        echo json_encode(['error' => 'email and password required']);
        exit;
    }
    foreach ($users as $u)
        if ($u['email'] === $body['email']) {
            http_response_code(400);
            echo json_encode(['error' => 'user exists']);
            exit;
        }
    $id = bin2hex(random_bytes(5));
    $salt = bin2hex(random_bytes(4));
    $hash = hash('sha256', $body['password'] . $salt);
    $users[] = ['id' => $id, 'email' => $body['email'], 'salt' => $salt, 'hash' => $hash];
    saveData('users', $users);
    http_response_code(201);
    echo json_encode(['id' => $id, 'email' => $body['email']]);
    exit;
}

if ($path === '/auth/login' && $method === 'POST') {
    $body = json_decode(file_get_contents('php://input'), true);
    foreach ($users as $u) {
        if ($u['email'] === ($body['email'] ?? '')) {
            $hash = hash('sha256', ($body['password'] ?? '') . $u['salt']);
            if ($hash === $u['hash']) {
                echo json_encode(['token' => 'php-token-' . $u['id']]);
                exit;
            }
        }
    }
    http_response_code(401);
    echo json_encode(['error' => 'Invalid credentials']);
    exit;
}

// Workflows
if ($path === '/workflows' && $method === 'GET') {
    echo json_encode($workflows);
    exit;
}
if ($path === '/workflows' && $method === 'POST') {
    $auth = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (!$auth) {
        http_response_code(401);
        echo json_encode(['error' => 'Unauthorized']);
        exit;
    }
    $body = json_decode(file_get_contents('php://input'), true);
    $id = bin2hex(random_bytes(5));
    $wf = ['id' => $id, 'name' => $body['name'] ?? '', 'description' => $body['description'] ?? ''];
    $workflows[] = $wf;
    saveData('workflows', $workflows);
    http_response_code(201);
    echo json_encode($wf);
    exit;
}

if (preg_match('#^/workflows/([^/]+)$#', $path, $m) && $method === 'GET') {
    foreach ($workflows as $w)
        if ($w['id'] === $m[1]) {
            echo json_encode($w);
            exit;
        }
    http_response_code(404);
    echo json_encode(['error' => 'Not found']);
    exit;
}

if (preg_match('#^/workflows/([^/]+)$#', $path, $m) && $method === 'PUT') {
    $auth = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (!$auth) {
        http_response_code(401);
        echo json_encode(['error' => 'Unauthorized']);
        exit;
    }
    $body = json_decode(file_get_contents('php://input'), true);
    foreach ($workflows as &$w)
        if ($w['id'] === $m[1]) {
            $w['name'] = $body['name'] ?? $w['name'];
            $w['description'] = $body['description'] ?? $w['description'];
            saveData('workflows', $workflows);
            echo json_encode($w);
            exit;
        }
    http_response_code(404);
    echo json_encode(['error' => 'Not found']);
    exit;
}

if (preg_match('#^/workflows/([^/]+)/execute$#', $path, $m) && $method === 'POST') {
    $auth = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (!$auth) {
        http_response_code(401);
        echo json_encode(['error' => 'Unauthorized']);
        exit;
    }
    $id = bin2hex(random_bytes(5));
    $exec = ['id' => $id, 'workflowId' => $m[1], 'status' => 'running', 'startedAt' => time()];
    $executions[] = $exec;
    saveData('executions', $executions);
    // simulate done
    $exec['status'] = 'success';
    $exec['finishedAt'] = time();
    $executions[count($executions) - 1] = $exec;
    saveData('executions', $executions);
    http_response_code(202);
    echo json_encode(['executionId' => $id]);
    exit;
}

echo json_encode(['message' => 'Hello from Avtomation Workflow - PHP backend']);
