import React from 'react';
import ReactDOM from 'react-dom/client';
import 'antd/dist/reset.css'; // Import Ant Design's global reset stylesheet
import App from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);