import * as React from 'react';
import './App.css';
import { TokenList } from './components/TokenList';
import { Token } from './types/token';
import { config } from './config';

interface TokenGroups {
    last_15m: Token[];
    last_1h: Token[];
    last_6h: Token[];
    last_12h: Token[];
}

const REFRESH_INTERVAL_SECONDS = 30;

function App() {
    const [error, setError] = React.useState<string | null>(null);
    const [isImporting, setIsImporting] = React.useState(false);
    const [isAnalyzing, setIsAnalyzing] = React.useState(false);
    const [isScoring, setIsScoring] = React.useState(false);
    const [importResult, setImportResult] = React.useState<string | null>(null);
    const [analysisResult, setAnalysisResult] = React.useState<string | null>(null);
    const [scoringResult, setScoringResult] = React.useState<string | null>(null);
    const [tokenGroups, setTokenGroups] = React.useState<TokenGroups>({
        last_15m: [],
        last_1h: [],
        last_6h: [],
        last_12h: []
    });
    const [initialLoading, setInitialLoading] = React.useState(true);
    const [countdown, setCountdown] = React.useState(REFRESH_INTERVAL_SECONDS);
    const [showDevPanel, setShowDevPanel] = React.useState(false);
    const [isRefreshing, setIsRefreshing] = React.useState(false);

    const fetchTokens = async (isInitial = false) => {
        try {
            if (isInitial) {
                setInitialLoading(true);
            } else {
                setIsRefreshing(true);  // Start refresh effect
            }
            setCountdown(REFRESH_INTERVAL_SECONDS);
            
            const response = await fetch(`${config.API_URL}/api/tokens`);
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
            if (isInitial) {
                setInitialLoading(false);
            }
            // Remove the refresh effect after a short delay
            if (!isInitial) {
                setTimeout(() => setIsRefreshing(false), 500);
            }
        }
    };

    React.useEffect(() => {
        fetchTokens(true);  // Initial load
        const interval = setInterval(() => fetchTokens(false), REFRESH_INTERVAL_SECONDS * 1000);  // Convert seconds to milliseconds
        return () => clearInterval(interval);
    }, []);

    // Add countdown effect
    React.useEffect(() => {
        const timer = setInterval(() => {
            setCountdown(prev => Math.max(0, prev - 1));
        }, 1000);

        return () => clearInterval(timer);
    }, []);

    const handleImport = async () => {
        setError(null);
        setImportResult(null);
        setIsImporting(true);

        try {
            const response = await fetch(`${config.API_URL}/api/import-tokens`, {
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

    const handleAnalyze = async () => {
        setError(null);
        setAnalysisResult(null);
        setIsAnalyzing(true);

        try {
            const response = await fetch(`${config.API_URL}/api/analyze-tokens`, {
                method: 'POST',
            });
            
            const data = await response.json();
            
            if (!data.success) {
                throw new Error(data.message);
            }

            setAnalysisResult(data.message);
            // Refresh tokens after analysis
            fetchTokens();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to analyze tokens');
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleScore = async () => {
        setError(null);
        setScoringResult(null);
        setIsScoring(true);

        try {
            const response = await fetch(`${config.API_URL}/api/score-tokens`, {
                method: 'POST',
            });
            
            const data = await response.json();
            
            if (!data.success) {
                throw new Error(data.message);
            }

            setScoringResult(data.message);
            // Refresh tokens after scoring
            fetchTokens();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to score tokens');
        } finally {
            setIsScoring(false);
        }
    };

    if (initialLoading) {
        return <div className="loading">Loading tokens...</div>;
    }

    return (
        <div className="App">
            <header className="App-header">
                <h1>The Boys in the Trenches™</h1>
            </header>

            {showDevPanel && (
                <div className="dev-panel">
                    <h2>Dev Controls</h2>
                    <div className="dev-controls">
                        <div className="button-group">
                            <button 
                                className="scan-button"
                                onClick={handleImport}
                                disabled={isImporting}
                            >
                                {isImporting ? 'Importing...' : 'Import New Tokens'}
                            </button>
                            <button 
                                className="scan-button"
                                onClick={handleAnalyze}
                                disabled={isAnalyzing}
                            >
                                {isAnalyzing ? 'Analyzing...' : 'Analyze Recent Tokens'}
                            </button>
                            <button 
                                className="scan-button"
                                onClick={handleScore}
                                disabled={isScoring}
                            >
                                {isScoring ? 'Scoring...' : 'Score Recent Tokens'}
                            </button>
                        </div>
                        
                        {importResult && (
                            <div className="success-message">
                                {importResult}
                            </div>
                        )}
                        {analysisResult && (
                            <div className="success-message">
                                {analysisResult}
                            </div>
                        )}
                        {scoringResult && (
                            <div className="success-message">
                                {scoringResult}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {error && (
                <div className="error-message">
                    {error}
                </div>
            )}

            <p>Top Juicers</p>
            <div className="refresh-countdown">
                Automatically refreshing in {countdown}s
            </div>
            <main className="token-sections">
                {isRefreshing && <div className="refresh-flash" />}
                <section>
                    <h2>Last 15 Minutes (Degen)</h2>
                    <TokenList tokens={tokenGroups.last_15m} />
                </section>

                <section>
                    <h2>Last Hour (Memer)</h2>
                    <TokenList tokens={tokenGroups.last_1h} />
                </section>

                <section>
                    <h2>Last 6 Hours (Le Investor)</h2>
                    <TokenList tokens={tokenGroups.last_6h} />
                </section>

                <section>
                    <h2>Last 12 Hours (Warren Buffet)</h2>
                    <TokenList tokens={tokenGroups.last_12h} />
                </section>
            </main>

            <div 
                className="dev-shortcut-hint"
                onClick={() => setShowDevPanel(prev => !prev)}
            >
                Click for dev controls
            </div>
        </div>
    );
}

export default App; 