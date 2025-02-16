import * as React from 'react';
import './App.css';
import TokenList from './components/TokenList';
import { Token } from './types';
import { APIError, isAPIError } from './types/errors';

function App() {
    const [tokens, setTokens] = React.useState<Token[]>([]);
    const [isLoading, setIsLoading] = React.useState<boolean>(true);
    const [error, setError] = React.useState<string | null>(null);

    const fetchTopTokens = async () => {
        try {
            const response = await fetch('http://localhost:3001/api/top-tokens');
            const data = await response.json();

            if (!response.ok) {
                if (isAPIError(data)) {
                    throw new Error(data.message);
                }
                throw new Error('Failed to fetch top tokens');
            }

            setTokens(data);
            setError(null);
        } catch (error) {
            console.error('Failed to fetch top tokens:', error);
            setError(error instanceof Error ? error.message : 'An unexpected error occurred');
        } finally {
            setIsLoading(false);
        }
    };

    // Fetch top tokens on mount and every minute
    React.useEffect(() => {
        fetchTopTokens();
        const interval = setInterval(fetchTopTokens, 60000);
        return () => clearInterval(interval);
    }, []);



    return (
        <div className="App">
            <header className="App-header">
                <h1>The Boys in the Trenches™</h1>
                <p>Top Juicers</p>
            </header>
            
            {error && (
                <div className="error-message">
                    {error}
                </div>
            )}

            <main>
                {isLoading ? (
                    <div className="loading">Loading top tokens...</div>
                ) : (
                    <TokenList tokens={tokens} />
                )}
            </main>

        </div>
    );
}

export default App; 