import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { BrowserRouter } from 'react-router-dom';

const rootElement = document.getElementById('root');

// Emergency DOM-based Error Logger
window.addEventListener('error', (event) => {
  const root = document.getElementById('root');
  if (root && root.innerHTML === "") {
    root.innerHTML = `<div style="padding: 20px; color: #ef4444; font-family: sans-serif; background: #000; height: 100vh;">
      <h2 style="margin-bottom: 10px;">⚠️ System Initialization Error</h2>
      <p style="color: #94a3b8; font-size: 14px;">${event.message}</p>
      <p style="margin-top: 20px; font-size: 12px; color: #4b5563;">${event.filename}:${event.lineno}</p>
    </div>`;
  }
});

if (rootElement) {
  console.log("🚀 Initializing React root...");
  try {
    ReactDOM.createRoot(rootElement).render(
      <BrowserRouter>
        <App />
      </BrowserRouter>
    );
  } catch (err) {
    console.error("❌ React Mount Fatal:", err);
    rootElement.innerHTML = `<div style="padding: 20px; color: red;">Fatal Mount Error: ${err.message}</div>`;
  }
} else {
  console.error("❌ Root element not found!");
}
