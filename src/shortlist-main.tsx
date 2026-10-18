import React from 'react';
import {createRoot} from 'react-dom/client';
import {ShortlistDemo} from './components/ShortlistDemo';
import './index.css';
createRoot(document.getElementById('root')!).render(<React.StrictMode><ShortlistDemo/></React.StrictMode>);
