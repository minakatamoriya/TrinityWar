import React from 'react';
import ReactDOM from 'react-dom/client';
import { BattleCanvasDemoApp } from './BattleCanvasDemoApp';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BattleCanvasDemoApp />
  </React.StrictMode>,
);
