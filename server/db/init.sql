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
    current_price DECIMAL DEFAULT NULL,
    price_change_24h DECIMAL DEFAULT NULL,
    volume_24h DECIMAL DEFAULT NULL,
    market_cap DECIMAL DEFAULT NULL,
    fdv DECIMAL DEFAULT NULL,
    liquidity DECIMAL DEFAULT NULL,
    holder_count INTEGER DEFAULT NULL,
    total_score DECIMAL DEFAULT NULL,
    last_analysis TIMESTAMP,
    last_score TIMESTAMP,
    buys_24h INTEGER DEFAULT NULL,
    sells_24h INTEGER DEFAULT NULL,
    volume_m5 NUMERIC(20, 8) DEFAULT NULL,
    volume_h1 NUMERIC(20, 8) DEFAULT NULL,
    volume_h6 NUMERIC(20, 8) DEFAULT NULL,
    price_change_m5 DECIMAL DEFAULT NULL,
    txns_24h_buys INTEGER DEFAULT NULL,
    txns_24h_sells INTEGER DEFAULT NULL,
    price_change_h1 DECIMAL DEFAULT NULL,
    price_change_h6 DECIMAL DEFAULT NULL
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