import Fastify from 'fastify'
import cors from '@fastify/cors'

const server = Fastify({ logger: true })

const workflows: Array<{ id: string; name: string; description?: string; nodes?: any[] }> = [];

server.register(cors, { origin: true })

server.get('/health', async () => ({ status: 'ok', service: 'backend' }))

server.get('/', async () => ({ message: 'Hello from Avtomation Workflow - backend (port 4411)' }))

// List workflows
server.get('/workflows', async () => workflows)

// Get workflow by id
server.get('/workflows/:id', async (request: any, reply: any) => {
  const { id } = request.params as { id: string };
  const wf = workflows.find(w => w.id === id);
  if (!wf) return reply.code(404).send({ error: 'Not found' });
  return wf;
})

// Simple auth: allow create/update/delete only when Authorization header exists (mocked JWT)
function requireAuth(request: any, reply: any) {
  const auth = request.headers['authorization'] || request.headers['Authorization']
  if (!auth) return reply.code(401).send({ error: 'Unauthorized' })
}

// Create workflow
// Create workflow
server.post('/workflows', async (request: any, reply: any) => {
  const auth = request.headers['authorization'] || request.headers['Authorization']
  if (!auth) return reply.code(401).send({ error: 'Unauthorized' })
  const { name, description, nodes } = request.body as any;
  const id = Math.random().toString(36).substr(2, 9);
  const wf = { id, name, description, nodes };
  workflows.push(wf);
  return reply.code(201).send(wf);
})

// Update workflow
server.put('/workflows/:id', async (request: any, reply: any) => {
  const auth = request.headers['authorization'] || request.headers['Authorization']
  if (!auth) return reply.code(401).send({ error: 'Unauthorized' })
  const { id } = request.params as { id: string };
  const idx = workflows.findIndex(w => w.id === id);
  if (idx === -1) return reply.code(404).send({ error: 'Not found' });
  const { name, description, nodes } = request.body as any;
  workflows[idx] = { ...workflows[idx], name, description, nodes };
  return workflows[idx];
})

// Delete workflow
server.delete('/workflows/:id', async (request: any, reply: any) => {
  const auth = request.headers['authorization'] || request.headers['Authorization']
  if (!auth) return reply.code(401).send({ error: 'Unauthorized' })
  const { id } = request.params as { id: string };
  const idx = workflows.findIndex(w => w.id === id);
  if (idx === -1) return reply.code(404).send({ error: 'Not found' });
  workflows.splice(idx, 1);
  return { success: true };
})

const start = async () => {
  try {
    await server.listen({ port: 4411, host: '0.0.0.0' })
  } catch (err) {
    server.log.error(err)
    process.exit(1)
  }
}

start()
