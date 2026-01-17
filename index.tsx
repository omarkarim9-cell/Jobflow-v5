import React from 'react';
import ReactDOM from 'react-dom/client';
import { ClerkProvider } from '@clerk/clerk-react';
import { App } from './components/App';
import './index.css';

const CLERK_KEY = process.env.VITE_CLERK_PUBLISHABLE_KEY || 'pk_test_d2FudGVkLWRpbmdvLTkxLmNsZXJrLmFjY291bnRzLmRldiQ';

const rootElement = document.getElementById('root');
if (rootElement) {
    const root = ReactDOM.createRoot(rootElement);
    root.render(
        <React.StrictMode>
            <ClerkProvider publishableKey={CLERK_KEY} afterSignOutUrl="/">
                <App />
            </ClerkProvider>
        </React.StrictMode>
    );
}