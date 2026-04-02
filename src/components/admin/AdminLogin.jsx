import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { KeyRound, ShieldAlert } from 'lucide-react';

export function AdminLogin() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      // Encrypt password securely on client before sending
      const msgUint8 = new TextEncoder().encode(password);
      const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      const res = await fetch(`/api/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passwordHash: hashHex })
      });
      const data = await res.json();
      if (res.ok) {
        sessionStorage.setItem('adminToken', data.token);
        navigate('/admin/dashboard');
      } else {
        setError(data.error || 'Login failed');
      }
    } catch {
      setError('Server unreachable');
    }
  };

  return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#111' }}>
      <form onSubmit={handleLogin} style={{
        background: 'var(--surface-color)', padding: '40px', borderRadius: '16px',
        width: '100%', maxWidth: '400px', display: 'flex', flexDirection: 'column', gap: '20px',
        border: '1px solid var(--border-color)', boxShadow: '0 10px 30px rgba(0,0,0,0.5)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '10px' }}>
          <ShieldAlert size={48} color="var(--primary-color)" style={{ marginBottom: '10px' }} />
          <h2>Admin Restricted</h2>
          <p style={{ color: 'var(--text-muted)' }}>Enter admin credentials to proceed</p>
        </div>
        
        {error && <div style={{ color: '#ff4444', background: '#331111', padding: '10px', borderRadius: '8px', textAlign: 'center' }}>{error}</div>}
        
        <div>
          <label style={{ display: 'block', marginBottom: '8px' }}>Security Passcode</label>
          <div className="input-with-icon">
            <KeyRound size={20} />
            <input 
              type="password" 
              placeholder="Enter admin password..." 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="form-input"
              required
            />
          </div>
        </div>
        
        <button type="submit" className="btn-primary" style={{ marginTop: '10px' }}>
          Gain Access
        </button>
      </form>
    </div>
  );
}
