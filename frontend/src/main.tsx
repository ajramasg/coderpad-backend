import React from 'react';
import ReactDOM from 'react-dom/client';
import { loader } from '@monaco-editor/react';
import { client, SigmaClientProvider } from '@sigmacomputing/plugin';
import App from './App';
import './index.css';

// Serve Monaco from the same origin to avoid CDN blocks (e.g. corporate proxies)
loader.config({ paths: { vs: '/monaco-vs' } });

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: string | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(err: unknown) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', background:'#0d1117', color:'#e6edf3', fontFamily:'sans-serif', flexDirection:'column', gap:16, padding:24 }}>
          <div style={{ fontSize:18 }}>Sigma Computing Interview failed to load</div>
          <div style={{ fontSize:13, color:'#f85149', maxWidth:640, textAlign:'center', lineHeight:1.5 }}>
            {this.state.error}
          </div>
          <button onClick={() => window.location.reload()} style={{ marginTop:8, padding:'8px 20px', background:'#1f6feb', color:'#fff', border:'none', borderRadius:6, cursor:'pointer', fontSize:14 }}>
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <SigmaClientProvider client={client}>
        <App />
      </SigmaClientProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
