import Fastify from 'fastify'

const server = Fastify({ logger: true })

server.get('/health', async () => ({ status: 'ok', service: 'backend-fastify' }))

server.get('/', async () => ({ message: 'Hello from Avtomation Workflow - Fastify backend' }))

const start = async () => {
  try {
    await server.listen({ port: 3000, host: '0.0.0.0' })
  } catch (err) {
    server.log.error(err)
    process.exit(1)
  }
}

start()
