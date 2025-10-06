const http = require('http')

const hostname = '0.0.0.0'
const port = 4411

const crypto = require('crypto')

const fs = require('fs')
const path = require('path')

const dataDir = path.join(__dirname, '..', 'data')
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true })

function loadData(name) {
  const p = path.join(dataDir, name + '.json')
  if (!fs.existsSync(p)) return []
  try { return JSON.parse(fs.readFileSync(p, 'utf8')) } catch (e) { return [] }
}

function saveData(name, data) {
  const p = path.join(dataDir, name + '.json')
  fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf8')
}

const workflows = loadData('workflows')
const users = loadData('users')
const executions = loadData('executions')

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret'

function sha256(data) {
  return crypto.createHash('sha256').update(data).digest('hex')
}

function base64url(input) {
  return Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function signToken(payload) {
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body = base64url(JSON.stringify(payload))
  const sig = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return `${header}.${body}.${sig}`
}

function verifyToken(token) {
  try {
    const [headerB, bodyB, sig] = token.split('.')
    const expected = crypto.createHmac('sha256', JWT_SECRET).update(`${headerB}.${bodyB}`).digest('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    if (expected !== sig) return null
    const payload = JSON.parse(Buffer.from(bodyB, 'base64').toString('utf8'))
    return payload
  } catch (e) {
    return null
  }
}

function sendJSON(res, status, obj) {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(obj))
}

function parseBody(req) {
  return new Promise((resolve) => {
    let body = ''
    req.on('data', chunk => { body += chunk.toString() })
    req.on('end', () => {
      try { resolve(JSON.parse(body || '{}')) } catch (e) { resolve({}) }
    })
  })
}

const server = http.createServer(async (req, res) => {
  const { method, url, headers } = req

  // Basic CORS handling
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  }

  if (method === 'OPTIONS') {
    res.writeHead(204, corsHeaders)
    res.end()
    return
  }

  if (url === '/health' && method === 'GET') {
    res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ status: 'ok', service: 'backend-fallback' }))
    return
  }

  if (url === '/' && method === 'GET') {
    sendJSON(res, 200, { message: 'Hello from Avtomation Workflow - fallback backend (port 4411)' })
    return
  }

  // List workflows
  if (url === '/workflows' && method === 'GET') {
    res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' })
    res.end(JSON.stringify(workflows))
    return
  }

  // Create workflow
  if (url === '/workflows' && method === 'POST') {
    const auth = headers['authorization'] || headers['Authorization']
    if (!auth) return sendJSON(res, 401, { error: 'Unauthorized' })
    const token = auth.split(' ')[1]
    const payload = token ? verifyToken(token) : null
    if (!payload) return sendJSON(res, 401, { error: 'Invalid token' })
    const body = await parseBody(req)
    const id = Math.random().toString(36).substr(2, 9)
    const wf = { id, name: body.name, description: body.description }
    workflows.push(wf)
    saveData('workflows', workflows)
    res.writeHead(201, { ...corsHeaders, 'Content-Type': 'application/json' })
    res.end(JSON.stringify(wf))
    return
  }

  // Get workflow
  if (url && url.startsWith('/workflows/') && method === 'GET') {
    const id = url.split('/')[2]
    const wf = workflows.find(w => w.id === id)
    if (!wf) { res.writeHead(404, { ...corsHeaders, 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'Not found' })); return }
    res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' })
    res.end(JSON.stringify(wf))
    return
  }

  // Update workflow
  if (url && url.startsWith('/workflows/') && method === 'PUT') {
    const auth = headers['authorization'] || headers['Authorization']
    if (!auth) return sendJSON(res, 401, { error: 'Unauthorized' })
    const token = auth.split(' ')[1]
    const payload = token ? verifyToken(token) : null
    if (!payload) return sendJSON(res, 401, { error: 'Invalid token' })
    const id = url.split('/')[2]
    const idx = workflows.findIndex(w => w.id === id)
    if (idx === -1) return sendJSON(res, 404, { error: 'Not found' })
    const body = await parseBody(req)
    workflows[idx] = { ...workflows[idx], name: body.name, description: body.description }
    saveData('workflows', workflows)
    res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' })
    res.end(JSON.stringify(workflows[idx]))
    return
  }

  // Delete workflow
  if (url && url.startsWith('/workflows/') && method === 'DELETE') {
    const auth = headers['authorization'] || headers['Authorization']
    if (!auth) return sendJSON(res, 401, { error: 'Unauthorized' })
    const token = auth.split(' ')[1]
    const payload = token ? verifyToken(token) : null
    if (!payload) return sendJSON(res, 401, { error: 'Invalid token' })
    const id = url.split('/')[2]
    const idx = workflows.findIndex(w => w.id === id)
    if (idx === -1) return sendJSON(res, 404, { error: 'Not found' })
    workflows.splice(idx, 1)
    saveData('workflows', workflows)
    res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ success: true }))
    return
  }

  // Execute workflow (manual)
  if (url && url.endsWith('/execute') && method === 'POST') {
    const match = url.match(/\/workflows\/(.+)\/execute$/)
    if (match) {
      const auth = headers['authorization'] || headers['Authorization']
      if (!auth) return sendJSON(res, 401, { error: 'Unauthorized' })
      const token = auth.split(' ')[1]
      const payload = token ? verifyToken(token) : null
      if (!payload) return sendJSON(res, 401, { error: 'Invalid token' })
      const workflowId = match[1]
      const wf = workflows.find(w => w.id === workflowId)
      if (!wf) return sendJSON(res, 404, { error: 'Workflow not found' })
      const execId = Math.random().toString(36).substr(2, 9)
      const exec = { id: execId, workflowId, status: 'running', startedAt: Date.now(), logs: [] }
      executions.push(exec)
      saveData('executions', executions)
      // simulate execution
      setTimeout(() => {
        exec.status = 'success'
        exec.finishedAt = Date.now()
        exec.logs.push({ level: 'info', message: 'Execution finished' })
        saveData('executions', executions)
      }, 1000)
      res.writeHead(202, { ...corsHeaders, 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ executionId: execId }))
      return
    }
  }

  // Get executions for workflow
  if (url && url.match(/^\/workflows\/[^/]+\/executions$/) && method === 'GET') {
    const id = url.split('/')[2]
    const list = executions.filter(e => e.workflowId === id)
    res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' })
    res.end(JSON.stringify(list))
    return
  }

  // Get execution by id
  if (url && url.startsWith('/executions/') && method === 'GET') {
    const id = url.split('/')[2]
    const ex = executions.find(e => e.id === id)
    if (!ex) { res.writeHead(404, { ...corsHeaders, 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'Not found' })); return }
    res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' })
    res.end(JSON.stringify(ex))
    return
  }

  // Auth endpoints
  if (url === '/auth/register' && method === 'POST') {
    const body = await parseBody(req)
    const { email, password, name } = body
    if (!email || !password) return sendJSON(res, 400, { error: 'email and password required' })
    if (users.find(u => u.email === email)) return sendJSON(res, 400, { error: 'user exists' })
    const salt = crypto.randomBytes(8).toString('hex')
    const hash = sha256(password + salt)
    const id = Math.random().toString(36).substr(2, 9)
    users.push({ id, email, name, salt, hash })
    sendJSON(res, 201, { id, email, name })
    return
  }

  if (url === '/auth/login' && method === 'POST') {
    const body = await parseBody(req)
    const { email, password } = body
    const user = users.find(u => u.email === email)
    if (!user) return sendJSON(res, 401, { error: 'Invalid credentials' })
    const hash = sha256(password + user.salt)
    if (hash !== user.hash) return sendJSON(res, 401, { error: 'Invalid credentials' })
    const token = signToken({ sub: user.id, email: user.email, name: user.name, iat: Date.now() })
    sendJSON(res, 200, { token })
    return
  }

  sendJSON(res, 404, { error: 'Not Found' })
})

server.listen(port, hostname, () => {
  console.log(`Fallback server running at http://${hostname}:${port}/`)
})
