// API para integração com dados reais de criptomoedas
// Baseado nas APIs do CryptoCompare, CoinGecko e Binance

// Importar módulos necessários para a API Express
import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch'; // Usar node-fetch para garantir o funcionamento do fetch em Node.js

// Importar módulos de indicadores e timeframes usando ES Modules
import * as indicators from './indicators_module.js'; // Caminho corrigido de ../ para ./
import { generateTechnicalAlerts, generateAlertsForMultipleSymbols, TIMEFRAMES } from './timeframes_module.js'; // Caminho corrigido de ../ para ./
import { convertUSDTtoBRL } from './price_display_module.js'; // Importa a função de conversão BRL

// Configuração inicial do Express
const app = express();
app.use(cors()); // Habilita CORS para permitir requisições de diferentes domínios
app.use(express.json()); // Habilita o parsing de JSON para requisições POST/PUT

// --- EXPOSIÇÃO DE FUNÇÕES INDICADORES (apenas se este módulo também for usado diretamente no navegador) ---
// Se este arquivo for executado apenas como um módulo no Vercel/Node.js, as linhas 'window.xxx' podem ser removidas.
// Mantemos por compatibilidade se você também o usar diretamente em um frontend sem um sistema de build.
if (typeof window !== 'undefined') { // Verifica se está em um ambiente de navegador
    window.calculateRSI = indicators.calculateRSI;
    window.calculateMACD = indicators.calculateMACD;
    window.calculateSMA = indicators.calculateSMA;
    window.calculateEMA = indicators.calculateEMA;
    window.calculateBollingerBands = indicators.calculateBollingerBands;
    window.analyzeVolume = indicators.analyzeVolume;
    window.findSupportResistanceLevels = indicators.findSupportResistanceLevels;
    window.calculateFibonacciLevels = indicators.calculateFibonacciLevels;
    window.calculateATR = indicators.calculateATR;
    window.calculateADX = indicators.calculateADX;
    window.generateTechnicalAlerts = generateTechnicalAlerts;
    window.convertUSDTtoBRL = convertUSDTtoBRL; // Atribui a função importada ao objeto global window
}
// --- FIM DA EXPOSIÇÃO DE FUNÇÕES INDICADORES ---


// Configuração das APIs
const API_CONFIG = {
    cryptoCompare: {
        baseUrl: 'https://min-api.cryptocompare.com/data',
        apiKey: ''  // Sem chave para uso gratuito com limites
    },
    coinGecko: {
        baseUrl: 'https://api.coingecko.com/api/v3'
    },
    binance: {
        baseUrl: 'https://api.binance.com/api/v3'
    }
};

// Lista de moedas a serem monitoradas
const MONITORED_COINS = [
    'BTC', 'ETH', 'SOL', 'BNB', 'AVAX', 'LINK', 'MATIC', 'DOT'
];

// Timeframe padrão para análise
let currentTimeframe = '1h';

// Cache para armazenar preços temporariamente e evitar uso excessivo de API
const priceCache = {
    lastUpdate: null,
    prices: null,
    expirationTime: 2 * 60 * 1000 // 2 minutos
};

// Cache para taxa de conversão BRL
const brlRateCache = {
    rate: 5.3, // Taxa padrão inicial
    lastUpdate: null,
    expirationTime: 30 * 60 * 1000 // 30 minutos
};

// Cache para dados históricos
const historicalDataCache = {};

// Função para buscar preços atuais das criptomoedas
async function fetchCurrentPrices() {
    try {
        console.log('Iniciando busca de preços...');
        
        if (priceCache.prices && priceCache.lastUpdate && 
            (new Date() - priceCache.lastUpdate) < priceCache.expirationTime) {
            console.log('Usando dados de cache (menos de 2 minutos)');
            return priceCache.prices;
        }
        
        // Em ambiente de desenvolvimento local que não seja Node.js direto, usar dados simulados
        // Em ambiente Vercel/Node.js, 'window.location.protocol' não existe, então tentará as APIs reais
        if (typeof window !== 'undefined' && window.location.protocol === 'file:') {
            console.log('Ambiente local (file://) detectado, usando dados simulados temporários');
            return await fetchSimulatedRealPrices();
        }
        
        try {
            const binancePrices = await fetchPricesFromBinance();
            if (binancePrices && binancePrices.length > 0) {
                console.log('Preços obtidos da Binance:', binancePrices);
                const pricesWithBRL = await addBRLPrices(binancePrices);
                priceCache.prices = pricesWithBRL;
                priceCache.lastUpdate = new Date();
                return pricesWithBRL;
            }
        } catch (error) {
            console.error('Erro ao buscar preços da Binance:', error);
        }
        
        try {
            const response = await fetch(`<span class="math-inline">\{API\_CONFIG\.cryptoCompare\.baseUrl\}/pricemulti?fsyms\=</span>{MONITORED_COINS.join(',')}&tsyms=USD`);
            if (response.ok) {
                const data = await response.json();
                const prices = Object.entries(data).map(([symbol, prices]) => ({
                    symbol: `${symbol}/USDT`,
                    price: prices.USD
                }));
                console.log('Preços obtidos do CryptoCompare:', prices);
                const pricesWithBRL = await addBRLPrices(prices);
                priceCache.prices = pricesWithBRL;
                priceCache.lastUpdate = new Date();
                return pricesWithBRL;
            }
        } catch (error) {
            console.error('Erro ao buscar preços do CryptoCompare:', error);
        }
        
        try {
            const coinGeckoPrices = await fetchPricesFromCoinGecko();
            if (coinGeckoPrices && coinGeckoPrices.length > 0) {
                const pricesWithBRL = await addBRLPrices(coinGeckoPrices);
                priceCache.prices = pricesWithBRL;
                priceCache.lastUpdate = new Date();
                return pricesWithBRL;
            }
        } catch (error) {
            console.error('Erro ao buscar preços do CoinGecko:', error);
        }
        
        if (priceCache.prices) {
            console.warn('Todas as APIs falharam, usando dados de cache expirados');
            return priceCache.prices;
        }
        
        console.warn('Todas as APIs falharam e não há cache, usando preços simulados como último recurso');
        const simulatedPrices = await fetchSimulatedRealPrices();
        const simulatedPricesWithBRL = await addBRLPrices(simulatedPrices);
        priceCache.prices = simulatedPricesWithBRL;
        priceCache.lastUpdate = new Date();
        return simulatedPricesWithBRL;
    } catch (error) {
        console.error('Erro geral ao buscar preços:', error);
        if (priceCache.prices) {
            return priceCache.prices;
        }
        const simulatedPrices = await fetchSimulatedRealPrices();
        return await addBRLPrices(simulatedPrices);
    }
}

// Função para adicionar preços em BRL aos dados
async function addBRLPrices(prices) {
    try {
        // Agora convertUSDTtoBRL é importado diretamente
        let brlRate;
        if (brlRateCache.lastUpdate && 
            (new Date() - brlRateCache.lastUpdate) < brlRateCache.expirationTime) {
            brlRate = brlRateCache.rate;
        } else {
            try {
                // Em um ambiente Node.js, você pode buscar a taxa de câmbio de uma API
                // Por simplicidade, vou manter a taxa padrão ou buscar de um serviço simples.
                // Idealmente, você chamaria uma API de câmbio real aqui.
                const response = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
                const data = await response.json();
                brlRate = data.rates.BRL || brlRateCache.rate; // Fallback para taxa padrão
                
                brlRateCache.rate = brlRate;
                brlRateCache.lastUpdate = new Date();
            } catch (error) {
                console.error('Erro ao obter taxa de conversão BRL via API, usando fallback:', error);
                brlRate = brlRateCache.rate; // Usar taxa de fallback
            }
        }
        
        return prices.map(item => ({
            ...item,
            priceBRL: item.price * brlRate
        }));
    } catch (error) {
        console.error('Erro ao adicionar preços em BRL:', error);
        return prices;
    }
}

// Função para buscar preços da Binance
async function fetchPricesFromBinance() {
    try {
        const symbols = MONITORED_COINS.map(coin => `${coin}USDT`);
        const promises = symbols.map(async symbol => {
            try {
                const response = await fetch(`<span class="math-inline">\{API\_CONFIG\.binance\.baseUrl\}/ticker/price?symbol\=</span>{symbol}`);
                if (response.ok) {
                    const data = await response.json();
                    return {
                        symbol: `${symbol.slice(0, -4)}/USDT`,
                        price: parseFloat(data.price)
                    };
                }
                return null;
            } catch (e) {
                console.error(`Erro ao buscar ${symbol} da Binance:`, e);
                return null;
            }
        });
        const results = await Promise.all(promises);
        const validResults = results.filter(result => result !== null);
        if (validResults.length > 0) {
            return validResults;
        } else {
            throw new Error('Nenhum preço válido obtido da Binance');
        }
    } catch (error) {
        console.error('Erro ao buscar preços da Binance:', error);
        return null;
    }
}

// Função para buscar preços do CoinGecko
async function fetchPricesFromCoinGecko() {
    try {
        const coinMapping = {
            'BTC': 'bitcoin', 'ETH': 'ethereum', 'SOL': 'solana', 'BNB': 'binancecoin',
            'AVAX': 'avalanche-2', 'LINK': 'chainlink', 'MATIC': 'matic-network', 'DOT': 'polkadot'
        };
        const coinIds = MONITORED_COINS.map(symbol => coinMapping[symbol]).join(',');
        const response = await fetch(`<span class="math-inline">\{API\_CONFIG\.coinGecko\.baseUrl\}/coins/markets?vs\_currency\=usd&ids\=</span>{coinIds}`);
        
        if (response.ok) {
            const data = await response.json();
            const prices = data.map(coin => ({
                symbol: `${coin.symbol.toUpperCase()}/USDT`,
                price: coin.current_price
            }));
            console.log('Preços obtidos do CoinGecko:', prices);
            return prices;
        } else {
            throw new Error('Falha ao buscar dados do CoinGecko');
        }
    } catch (error) {
        console.error('Erro ao buscar preços do CoinGecko:', error);
        return null;
    }
}

// Função para buscar preços simulados mais próximos da realidade
async function fetchSimulatedRealPrices() {
    console.log('Buscando preços simulados mais próximos da realidade');
    // Para um ambiente de servidor, o mode 'no-cors' não faz sentido direto, pois CORS é uma restrição do navegador.
    // A chamada abaixo pode falhar em Node.js se o Coincap realmente exigir um User-Agent ou algo similar.
    // No entanto, como é um fallback para simulados, os valores fixos abaixo serão usados de qualquer forma.
    try {
        await fetch('https://api.coincap.io/v2/assets?ids=bitcoin,ethereum,solana,binance-coin,avalanche,chainlink,matic-network,polkadot');
    } catch (error) {
        console.error('Erro ao tentar buscar preços simulados de CoinCap (ignorado, usando valores fixos):', error);
    }
    
    return [
        { symbol: 'BTC/USDT', price: 108646.09 },
        { symbol: 'ETH/USDT', price: 2559.85 },
        { symbol: 'SOL/USDT', price: 149.50 },
        { symbol: 'BNB/USDT', price: 664.80 },
        { symbol: 'AVAX/USDT', price: 36.20 },
        { symbol: 'LINK/USDT', price: 18.75 },
        { symbol: 'MATIC/USDT', price: 0.92 },
        { symbol: 'DOT/USDT', price: 12.30 }
    ];
}

// Função para obter dados históricos para cálculo de indicadores
async function getHistoricalData(symbol, timeframe = '1h', limit = 100) {
    const normalizedSymbol = symbol.replace('/', '');
    const cacheKey = `<span class="math-inline">\{normalizedSymbol\}\_</span>{timeframe}`;
    const now = Date.now();
    
    if (historicalDataCache[cacheKey] && 
        now - historicalDataCache[cacheKey].timestamp < 5 * 60 * 1000) { // 5 minutos TTL
        console.log(`Usando dados históricos em cache para ${symbol} em ${timeframe}`);
        return historicalDataCache[cacheKey].data;
    }
    
    try {
        const binanceIntervals = {
            '15m': '15m', '30m': '30m', '1h': '1h', '2h': '2h', '4h': '4h',
            '6h': '6h', '1d': '1d', '3d': '3d', '
