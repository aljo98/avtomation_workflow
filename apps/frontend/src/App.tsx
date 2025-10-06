import React, { useEffect, useState } from 'react'
import { api } from './utils/api'

type Workflow = { id: string; name: string; description?: string }

function WorkflowCard({ wf, onRun, onExec }: { wf: Workflow; onRun: (id: string) => void; onExec: (id: string) => void }) {
  return (
    <div className="card">
      <div className="workflow-title">{wf.name}</div>
      <div className="small">{wf.description}</div>
      <div style={{marginTop:8, display:'flex', gap:8}}>
        <button className="btn btn-primary" onClick={() => onRun(wf.id)}>Run</button>
        <button className="btn btn-ghost" onClick={() => onExec(wf.id)}>Executions</button>
      </div>
    </div>
  )
}

export default function App() {
  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [token, setToken] = useState<string | null>(localStorage.getItem('jwt'))

  useEffect(() => { if (token) fetchList() }, [token])

  async function fetchList() {
    const res = await api('/workflows', { method: 'GET' })
    if (res.ok) setWorkflows(await res.json())
  }

  async function create() {
    const res = await api('/workflows', { method: 'POST', body: JSON.stringify({ name, description: desc }) })
    if (res.ok) {
      const wf = await res.json()
      setWorkflows(prev => [...prev, wf])
      setName('')
      setDesc('')
    } else {
      alert('Failed to create workflow')
    }
  }

  async function runWorkflow(id: string) {
    const res = await api(`/workflows/${id}/execute`, { method: 'POST' })
    if (res.status === 202) {
      const data = await res.json()
      alert('Execution started: ' + data.executionId)
    } else {
      const err = await res.json()
      alert('Error: ' + JSON.stringify(err))
    }
  }

  async function fetchExecutions(id: string) {
    const res = await api(`/workflows/${id}/executions`, { method: 'GET' })
    const data = await res.json()
    alert(JSON.stringify(data, null, 2))
  }

  function logout() { localStorage.removeItem('jwt'); setToken(null); setWorkflows([]) }

  return (
    <div className="container">
      <div className="header">
        <h1>Avtomation Workflow</h1>
        <div className="controls">
          {token ? <button className="btn" onClick={logout}>Logout</button> : <span className="small">Not logged in</span>}
        </div>
      </div>

      {!token ? (
        <div style={{marginTop:16}}>
          <div className="card">
            <h3>Auth</h3>
            <div className="small">Use register/login (prompts) to create a local user.</div>
            <div style={{marginTop:8}}>
              <button className="btn btn-primary" onClick={async () => {
                const email = prompt('email')
                const password = prompt('password')
                if (!email || !password) return
                const res = await api('/auth/register', { method: 'POST', body: JSON.stringify({ email, password, name: 'User' }) })
                alert(await res.text())
              }}>Register</button>
              <button className="btn btn-ghost" onClick={async () => {
                const email = prompt('email')
                const password = prompt('password')
                if (!email || !password) return
                const res = await api('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) })
                const data = await res.json()
                if (data.token) { localStorage.setItem('jwt', data.token); setToken(data.token); alert('Logged in') }
                else alert(JSON.stringify(data))
              }}>Login</button>
            </div>
          </div>
        </div>
      ) : (
        <div style={{marginTop:16}}>
          <div className="card">
            <h2>Create workflow</h2>
            <input className="input" placeholder="Name" value={name} onChange={e => setName(e.target.value)} />
            <br />
            <textarea className="input" placeholder="Description" value={desc} onChange={e => setDesc(e.target.value)} />
            <br />
            <button className="btn btn-primary" onClick={create}>Create</button>
            <button className="btn" style={{marginLeft:8}} onClick={fetchList}>Refresh</button>
          </div>

          <div className="grid">
            {workflows.map(w => (
              <WorkflowCard key={w.id} wf={w} onRun={runWorkflow} onExec={fetchExecutions} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
