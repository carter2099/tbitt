CREATE TABLE scan (
    id SERIAL PRIMARY KEY,
    scan_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    scan_type VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL 
);

CREATE TABLE token (
    address VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255),
    symbol VARCHAR(255),
    mint_date TIMESTAMP,
    import_date TIMESTAMP,
    current_price DECIMAL,
    price_change_24h DECIMAL,
    volume_24h DECIMAL,
    market_cap DECIMAL,
    fdv DECIMAL,
    liquidity DECIMAL,
    holder_count INTEGER,
    total_score DECIMAL,
    last_analysis TIMESTAMP,
    last_score TIMESTAMP,
    buys_24h INTEGER DEFAULT 0,
    sells_24h INTEGER DEFAULT 0,
    volume_m5 NUMERIC(20, 8) DEFAULT 0,
    volume_h1 NUMERIC(20, 8) DEFAULT 0,
    volume_h6 NUMERIC(20, 8) DEFAULT 0,
    price_change_m5 DECIMAL,
    txns_24h_buys INTEGER DEFAULT 0,
    txns_24h_sells INTEGER DEFAULT 0,
    price_change_h1 DECIMAL,
    price_change_h6 DECIMAL
); 

CREATE INDEX idx_tokens_address ON token(address);

CREATE TABLE token_social_media (
    id SERIAL PRIMARY KEY,
    token_address VARCHAR(255) REFERENCES token(address) ON DELETE CASCADE,
    social_type VARCHAR(50) NOT NULL,
    url VARCHAR(512) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(token_address, social_type)
);

CREATE INDEX idx_token_social_media_address ON token_social_media(token_address);