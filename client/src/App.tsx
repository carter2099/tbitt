import * as React from 'react';
import './App.css';

function App() {
    const [error, setError] = React.useState<string | null>(null);

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
                <p>TODO</p>
            </main>

        </div>
    );
}

export default App; 