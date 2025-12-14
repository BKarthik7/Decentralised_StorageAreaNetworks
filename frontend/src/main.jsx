import React from 'react'
import { Buffer } from 'buffer'
window.global = window;
window.Buffer = Buffer;
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>,
)
