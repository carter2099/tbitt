import * as React from 'react';
import './App.css';

function App() {
    const [error, setError] = React.useState<string | null>(null);
    const [isImporting, setIsImporting] = React.useState(false);
    const [importResult, setImportResult] = React.useState<string | null>(null);

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
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to import tokens');
        } finally {
            setIsImporting(false);
        }
    };

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

            <main>
                <p>TODO</p>
            </main>
        </div>
    );
}

export default App; 