import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles.css';

export function App() {
  return <div className="p-4 font-semibold tracking-[0.14em] text-xs">ARGUS</div>;
}

const el = document.getElementById('root');
if (el) ReactDOM.createRoot(el).render(<React.StrictMode><App /></React.StrictMode>);
