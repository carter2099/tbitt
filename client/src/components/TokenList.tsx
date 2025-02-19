import React from 'react';
import { Token } from '../types/token';
import TokenCard from './TokenCard';

interface TokenListProps {
    tokens: Token[];
}

export function TokenList({ tokens }: TokenListProps) {
    if (!tokens?.length) {
        return <p>No tokens found. Patience King 👑</p>;
    }

    return (
        <div className="token-list">
            {tokens.map((token, index) => (
                <TokenCard key={token.address} token={token} rank={index + 1} />
            ))}
        </div>
    );
} 