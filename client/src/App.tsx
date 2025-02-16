import * as React from 'react';
import './App.css';
import { TokenList } from './components/TokenList';
import { Token } from './types/token';

interface TokenGroups {
    last_15m: Token[];
    last_1h: Token[];
    last_6h: Token[];
    last_12h: Token[];
}

function App() {
    const [error, setError] = React.useState<string | null>(null);
    const [isImporting, setIsImporting] = React.useState(false);
    const [importResult, setImportResult] = React.useState<string | null>(null);
    const [tokenGroups, setTokenGroups] = React.useState<TokenGroups>({
        last_15m: [],
        last_1h: [],
        last_6h: [],
        last_12h: []
    });
    const [isLoading, setIsLoading] = React.useState(true);

    const fetchTokens = async () => {
        try {
            setIsLoading(true);
            const response = await fetch(`${process.env.REACT_APP_API_URL}/api/tokens`);
            if (!response.ok) {
                throw new Error('Failed to fetch tokens');
            }
            const data = await response.json();
            setTokenGroups({
                last_15m: data.last_15m || [],
                last_1h: data.last_1h || [],
                last_6h: data.last_6h || [],
                last_12h: data.last_12h || []
            });
        } catch (err) {
            setError('Failed to fetch tokens');
            console.error('Error fetching tokens:', err);
        } finally {
            setIsLoading(false);
        }
    };

    React.useEffect(() => {
        fetchTokens();
        // Refresh every minute
        const interval = setInterval(fetchTokens, 60000);
        return () => clearInterval(interval);
    }, []);

    const handleImport = async () => {
        setError(null);
        setImportResult(null);
        setIsImporting(true);

        try {
            const response = await fetch(`${process.env.REACT_APP_API_URL}/api/import-tokens`, {
                method: 'POST',
            });
            
            const data = await response.json();
            
            if (!data.success) {
                throw new Error(data.message);
            }

            setImportResult(data.message);
            // Refresh tokens after import
            fetchTokens();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to import tokens');
        } finally {
            setIsImporting(false);
        }
    };

    if (isLoading) {
        return <div className="loading">Loading tokens...</div>;
    }

    return (
        <div className="App">
            <header className="App-header">
                <h1>The Boys in the Trenches™</h1>
                <p>Top Juicers</p>
            </header>
            
            <div className="dev-panel">
                <h2>Dev Controls</h2>
                <div className="dev-controls">
                    <button 
                        className="scan-button"
                        onClick={handleImport}
                        disabled={isImporting}
                    >
                        {isImporting ? 'Importing...' : 'Import New Tokens'}
                    </button>
                    
                    {importResult && (
                        <div className="success-message">
                            {importResult}
                        </div>
                    )}
                </div>
            </div>

            {error && (
                <div className="error-message">
                    {error}
                </div>
            )}

            <main className="token-sections">
                <section>
                    <h2>Last 15 Minutes</h2>
                    <TokenList tokens={tokenGroups.last_15m} />
                </section>

                <section>
                    <h2>Last Hour</h2>
                    <TokenList tokens={tokenGroups.last_1h} />
                </section>

                <section>
                    <h2>Last 6 Hours</h2>
                    <TokenList tokens={tokenGroups.last_6h} />
                </section>

                <section>
                    <h2>Last 12 Hours</h2>
                    <TokenList tokens={tokenGroups.last_12h} />
                </section>
            </main>
        </div>
    );
}

export default App; 