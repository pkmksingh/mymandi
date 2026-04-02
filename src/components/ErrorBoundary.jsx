import React from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, RotateCcw } from 'lucide-react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error("React Crash:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ 
          height: '100vh', display: 'flex', flexDirection: 'column', 
          alignItems: 'center', justifyContent: 'center', padding: '40px', 
          background: 'var(--bg-color)', textAlign: 'center' 
        }}>
          <AlertTriangle size={64} color="var(--danger-color)" style={{ marginBottom: '24px' }} />
          <h2 style={{ fontSize: '28px', marginBottom: '16px' }}>Oops! Something went wrong.</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '32px', maxWidth: '400px' }}>
            A component has crashed, but don't worry, your data is safe.
          </p>
          <button 
            className="btn-primary" 
            onClick={() => window.location.href = '/'}
            style={{ padding: '16px 32px' }}
          >
            <RotateCcw size={20} /> Back to Dashboard
          </button>
        </div>
      );
    }

    return this.props.children; 
  }
}
