import React from 'react';
import { Token } from '../types/token';

interface TokenCardProps {
    token: Token;
    rank: number;
}

function TokenCard({ token, rank }: TokenCardProps) {
    const [copyConfirm, setCopyConfirm] = React.useState(false);

    const formatNumber = (num: number | null) => {
        if (num == null || isNaN(num)) return '$0.00';
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(num);
    };

    const formatPercentage = (num: number | null) => {
        if (num == null || isNaN(num)) return '0.00%';
        return `${num.toFixed(2)}%`;
    };

    const formatPrice = (price: number | null) => {
        if (price == null || isNaN(price)) return '$0.00';
        if (price < 0.01) {
            // Convert to string and remove scientific notation
            const priceStr = price.toFixed(20);
            // Find first non-zero digit after decimal
            const match = priceStr.match(/\.0*[1-9]/);
            if (match) {
                // Get position of first non-zero digit
                const firstNonZero = match.index! + match[0].length - 1;
                // Find the next occurrence of three consecutive zeros
                const afterFirstNonZero = priceStr.slice(firstNonZero + 1);
                const tripleZeroMatch = afterFirstNonZero.match(/000/);
                // If found triple zeros, cut off there, otherwise show all remaining digits
                const additionalDigits: number = tripleZeroMatch 
                    ? (tripleZeroMatch.index ?? afterFirstNonZero.length)
                    : afterFirstNonZero.length;
                const decimalPlaces = firstNonZero - priceStr.indexOf('.') + additionalDigits;
                return `$${price.toFixed(decimalPlaces)}`;
            }
            return '$0.00';
        }
        return formatNumber(price);
    };

    const formatAddress = (address: string) => {
        if (!address) return '';
        const start = address.slice(0, 8);
        const end = address.slice(-8);
        return `${start}...${end}`;
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        setCopyConfirm(true);
        setTimeout(() => setCopyConfirm(false), 1500); // Reset after 1.5 seconds
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        // Ensure we're comparing UTC timestamps
        const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

        if (diffInSeconds < 0) {
            // If somehow in the future, show actual date
            return date.toLocaleString();
        }
        if (diffInSeconds < 60) {
            return `${diffInSeconds}s ago`;
        }
        if (diffInSeconds < 3600) {
            const minutes = Math.floor(diffInSeconds / 60);
            return `${minutes}m ago`;
        }
        if (diffInSeconds < 86400) {
            const hours = Math.floor(diffInSeconds / 3600);
            return `${hours}h ago`;
        }
        // For older dates, show the full date and time
        return date.toLocaleString();
    };

    // Helper function to get icon and style for social media type
    const getSocialIcon = (type: string): { icon: string; className?: string } => {
        switch (type.toLowerCase()) {
            case 'twitter':
                return { icon: '𝕏', className: 'twitter-icon' }; // Using mathematical bold X for Twitter/X
            case 'telegram':
                return { icon: '📱' };
            case 'discord':
                return { icon: '💬' };
            case 'medium':
                return { icon: '📝' };
            case 'github':
                return { icon: '💻' };
            default:
                return { icon: '🔗' };
        }
    };

    const getXSearchUrl = (query: string): string => {
        return `https://x.com/search?q=${encodeURIComponent(query)}`;
    };

    const formatLargeToHumanReadable = (num: number | null) => {
        if (num == null || isNaN(num)) return '$0.00';
        if (num >= 1000000) {
            return `$${(num / 1000000).toFixed(2)}M`;
        } else if (num >= 1000) {
            return `$${(num / 1000).toFixed(2)}K`;
        }
        return `$${num.toFixed(2)}`;
    };

    const getDexScreenerUrl = (address: string): string => {
        return `https://dexscreener.com/solana/${address}`;
    };

    const formatSymbol = (symbol: string): string => {
        return symbol.startsWith('$') ? symbol : `$${symbol}`;
    };

    const getScoreIndicator = (score: number): { emoji: string; label: string; className: string } => {
        if (score >= 70) {
            return { emoji: '🔥', label: 'Excellent', className: 'excellent' };
        }
        if (score >= 60) {
            return { emoji: '🚀', label: 'Great', className: 'great' };
        }
        if (score >= 50) {
            return { emoji: '👍', label: 'Good', className: 'good' };
        }
        if (score >= 40) {
            return { emoji: '😐', label: 'Average', className: 'average' };
        }
        return { emoji: '⚠️', label: 'Risky', className: 'terrible' };
    };

    return (
        <div className="token-card">
            <div className="token-card-header">
                <div className="token-card-title">
                    <h3>{token.name}</h3>
                    <a 
                        href={`https://dexscreener.com/solana/${token.address}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="chart-link"
                        title="View on DexScreener"
                    >
                        📈
                    </a>

                </div>
                <div className="rank">#{rank}</div>
            </div>
            <div className="metrics">
                <h3>{formatSymbol(token.symbol)}</h3>
                <div>
                    Address:{" "}
                    <span className="address">{formatAddress(token.address)}</span>
                    <button 
                        className={`copy-button ${copyConfirm ? 'copied' : ''}`}
                        onClick={() => copyToClipboard(token.address)}
                        title={copyConfirm ? 'Copied!' : 'Copy full address'}
                    >
                        {copyConfirm ? '✓' : '📋'}
                    </button>
                </div>
                <div>Created: {formatDate(token.mintDate)}</div>
                <div>Price: {formatPrice(token.currentPrice)}</div>
                <div>Market Cap: {formatLargeToHumanReadable(token.marketCap)}</div>
                {/* <div>Holders: {(token.holderCount || 0).toLocaleString()}</div> */}
                <div>Liquidity: {token.liquidity && token.liquidity > 0 ? formatLargeToHumanReadable(token.liquidity) : '?'}</div>
                {token.socialScore !== undefined && (
                    <div>Social Score: {token.socialScore.toFixed(2)}</div>
                )}
                <div className="volume-metrics">
                    <div>Volume 5m:<br /> {formatLargeToHumanReadable(token.volumeM5)}</div>
                    <div>Volume 1h:<br /> {formatLargeToHumanReadable(token.volumeH1)}</div>
                    <div>Volume 24h:<br /> {formatLargeToHumanReadable(token.volume24h)}</div>
                </div>
                {token.totalScore && (
                        <div 
                            className={`score-indicator ${getScoreIndicator(token.totalScore).className}`}
                            title={`Score: ${token.totalScore.toFixed(2)}`}
                        >
                            Score: 
                            <span>{(token.totalScore || 0).toFixed(2)}</span>
                            <span className="emoji">{getScoreIndicator(token.totalScore).emoji}</span>
                        </div>
                    )}
                <br />
                <div className="social-links">
                    {token.socials && token.socials.length > 0 ? (
                        <div>
                            Social Media: {' '}
                            {token.socials.map((social, index) => (
                                <a
                                    key={index}
                                    href={social.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="social-link"
                                    title={social.type}
                                >
                                    {getSocialIcon(social.type).icon}
                                </a>
                            ))}
                        </div>
                    ) : (
                        <div>Social Media: No social media</div>
                    )}
                </div>
                <div className="x-search">
                    Search X: {' '}
                    <a 
                        href={getXSearchUrl(token.address)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="x-search-link"
                        title="Search for address on X"
                    >
                        CA
                    </a>
                    {' '} | {' '}
                    <a 
                        href={getXSearchUrl(formatSymbol(token.symbol))}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="x-search-link"
                        title={`Search for $${token.symbol} on X`}
                    >
                        ${token.symbol}
                    </a>
                </div>
            </div>
        </div>
    );
}

export default TokenCard; 