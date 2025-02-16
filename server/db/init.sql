CREATE TABLE scan (
    id SERIAL PRIMARY KEY,
    scan_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    scan_type VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL 
);

CREATE TABLE token (
    id SERIAL PRIMARY KEY,
    address VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255),
    symbol VARCHAR(255),
    current_price DECIMAL,
    price_change_24h DECIMAL,
    volume_24h DECIMAL,
    market_cap DECIMAL,
    fdv DECIMAL,
    liquidity DECIMAL,
    holder_count INTEGER,
    total_score DECIMAL,
    last_analysis TIMESTAMP,
    mint_date TIMESTAMP,
    import_date TIMESTAMP
);

CREATE INDEX idx_tokens_address ON token(address);