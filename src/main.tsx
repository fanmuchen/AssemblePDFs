import React from 'react';
import ReactDOM from 'react-dom/client';
import 'antd/dist/reset.css'; // Import Ant Design's global reset stylesheet
import App from './App';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';


ReactDOM.createRoot(document.getElementById('root')!).render(
  // <React.StrictMode>
  <ConfigProvider locale={zhCN}>
    <App />
  </ConfigProvider>
);