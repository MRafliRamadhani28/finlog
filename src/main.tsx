import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import 'goey-toast/styles.css';
import './index.css';
import { App } from './App';

const root = document.getElementById('root');
if (!root) throw new Error('#root tidak ditemukan');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
