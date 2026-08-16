import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import AppRouter from './router.jsx';
import './stores/themeStore.js';
import './styles.css';
import './styles/parte3.css';
import './styles/left-panel.css';
import './styles/intel-reference.css';
import './styles/studio.css';
import './styles/pack-wizard.css';
import './styles/steps-runner.css';
import './styles/lazy-todos.css';
import './styles/gina-chat.css';
import './styles/confirm-action.css';
import './styles/agents.css';
import './styles/plans.css';
import './styles/plan-gates.css';
import './styles/responsive.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AppRouter />
    </BrowserRouter>
  </StrictMode>,
);
