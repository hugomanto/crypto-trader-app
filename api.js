// API para integração com dados reais de criptomoedas
// Baseado nas APIs do CryptoCompare, CoinGecko e Binance

// Importar módulos necessários para a API Express
import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch'; // Usar node-fetch para garantir o funcionamento do fetch em Node.js

// Importar módulos de indicadores e timeframes usando ES Modules
import * as indicators from './indicators_module.js';
import { generateTechnicalAlerts, generateAlertsForMultipleSymbols, TIMEFRAMES } from './timeframes_module.js';
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
            const response = await fetch(`${API_CONFIG.cryptoCompare.baseUrl}/pricemulti?fsyms=${MONITORED_COINS.join(',')}&tsyms=USD`);
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
        let brlRate;
        if (brlRateCache.lastUpdate && 
            (new Date() - brlRateCache.lastUpdate) < brlRateCache.expirationTime) {
            brlRate = brlRateCache.rate;
        } else {
            try {
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
                const response = await fetch(`${API_CONFIG.binance.baseUrl}/ticker/price?symbol=${symbol}`);
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
        const response = await fetch(`${API_CONFIG.coinGecko.baseUrl}/coins/markets?vs_currency=usd&ids=${coinIds}`);
        
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
    const cacheKey = `${normalizedSymbol}_${timeframe}`;
    const now = Date.now();
    
    if (historicalDataCache[cacheKey] && 
        now - historicalDataCache[cacheKey].timestamp < 5 * 60 * 1000) { // 5 minutos TTL
        console.log(`Usando dados históricos em cache para ${symbol} em ${timeframe}`);
        return historicalDataCache[cacheKey].data;
    }
    
    try {
        const binanceIntervals = {
            '15m': '15m', '30m': '30m', '1h': '1h', '2h': '2h', '4h': '4h',
            '6h': '6h', '12h': '12h', '1d': '1d', '3d': '3d', '1w': '1w', '1M': '1M'
        };

        const interval = binanceIntervals[timeframe];
        if (!interval) {
            throw new Error(`Timeframe inválido: ${timeframe}`);
        }

        const url = `${API_CONFIG.binance.baseUrl}/klines?symbol=${normalizedSymbol}&interval=${interval}&limit=${limit}`;
        console.log(`Buscando dados históricos da Binance para ${normalizedSymbol} em ${timeframe}: ${url}`);

        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Erro ao buscar dados históricos da Binance: ${response.statusText}`);
        }
        const data = await response.json();

        // Formato: [timestamp, open, high, low, close, volume, ...]
        const history = data.map(d => ({
            time: d[0] / 1000, // Convertendo ms para segundos
            open: parseFloat(d[1]),
            high: parseFloat(d[2]),
            low: parseFloat(d[3]),
            close: parseFloat(d[4]),
            volume: parseFloat(d[5])
        }));

        historicalDataCache[cacheKey] = {
            data: history,
            timestamp: now
        };
        return history;

    } catch (error) {
        console.error('Erro ao buscar dados históricos da Binance:', error);
        // Fallback para CoinGecko se Binance falhar ou não tiver dados
        try {
            console.log(`Tentando CoinGecko para dados históricos de ${symbol} em ${timeframe}`);
            const coinMapping = {
                'BTCUSDT': 'bitcoin', 'ETHUSDT': 'ethereum', 'SOLUSDT': 'solana',
                'BNBUSDT': 'binancecoin', 'AVAXUSDT': 'avalanche-2', 'LINKUSDT': 'chainlink',
                'MATICUSDT': 'matic-network', 'DOTUSDT': 'polkadot'
            };
            const coinId = coinMapping[normalizedSymbol];
            if (!coinId) {
                throw new Error(`Símbolo não mapeado para CoinGecko: ${normalizedSymbol}`);
            }

            let days;
            switch (timeframe) {
                case '1h': days = 1; break; // Pelo menos 1 dia para pegar 1h com 24 pontos
                case '4h': days = 4; break;
                case '1d': days = 30; break; // 30 dias para pegar 1d
                case '1w': days = 90; break; // ~3 meses para 1w
                default: days = 7; // Padrão
            }

            const response = await fetch(`${API_CONFIG.coinGecko.baseUrl}/coins/${coinId}/market_chart?vs_currency=usd&days=${days}&interval=daily`); // CoinGecko não tem granularidade menor que daily para muitos intervalos
            if (!response.ok) {
                throw new Error(`Erro ao buscar dados históricos do CoinGecko: ${response.statusText}`);
            }
            const data = await response.json();
            
            if (!data.prices || data.prices.length === 0) {
                throw new Error('Nenhum dado de preço do CoinGecko.');
            }

            const history = data.prices.map(p => ({
                time: p[0] / 1000,
                close: p[1]
            }));

            // Para dados mais completos (open, high, low, volume), o CoinGecko requer outra rota
            // ou uma API mais específica. Para fins de indicador, o 'close' pode ser suficiente.
            console.log(`Dados históricos do CoinGecko para ${normalizedSymbol} em ${timeframe}:`, history.length);
            historicalDataCache[cacheKey] = {
                data: history,
                timestamp: now
            };
            return history;

        } catch (coinGeckoError) {
            console.error('Erro ao buscar dados históricos do CoinGecko como fallback:', coinGeckoError);
            return null; // Retorna nulo se todas as tentativas falharem
        }
    }
}


// --- ROTAS DA API ---
// Rota para buscar os preços atuais das criptomoedas
app.get('/api/prices', async (req, res) => {
    try {
        const prices = await fetchCurrentPrices(); // Chama a função que busca os preços
        res.json(prices); // Retorna os preços em formato JSON
    } catch (error) {
        console.error('Erro ao buscar preços na rota /api/prices:', error);
        res.status(500).json({ error: 'Erro interno do servidor ao buscar preços.' });
    }
});

// Rota para buscar dados históricos e calcular indicadores
app.get('/api/historical/:symbol/:timeframe', async (req, res) => {
    const { symbol, timeframe } = req.params;
    try {
        // Adapte o símbolo para o formato esperado pela sua função (ex: BTCUSDT)
        const fullSymbol = MONITORED_COINS.includes(symbol.toUpperCase()) ? `${symbol.toUpperCase()}USDT` : symbol.toUpperCase();
        
        const historicalData = await getHistoricalData(fullSymbol, timeframe);
        if (!historicalData || historicalData.length === 0) {
            return res.status(404).json({ error: 'Dados históricos não encontrados para este símbolo e timeframe.' });
        }
        
        // Exemplo de cálculo de RSI para os dados históricos
        // Certifique-se de que historicalData tem a propriedade 'close' ou adapte
        const closes = historicalData.map(d => d.close).filter(c => c !== undefined);

        if (closes.length === 0) {
            return res.status(400).json({ error: 'Dados de fechamento insuficientes para calcular indicadores.' });
        }

        const rsi = indicators.calculateRSI(closes, 14);
        const macd = indicators.calculateMACD(closes);
        const sma20 = indicators.calculateSMA(closes, 20);
        const ema12 = indicators.calculateEMA(closes, 12);
        const bb = indicators.calculateBollingerBands(closes, 20);

        res.json({
            symbol: symbol,
            timeframe: timeframe,
            historicalData: historicalData,
            indicators: {
                rsi: rsi.length > 0 ? rsi.slice(-1)[0] : null, // Último valor de RSI
                macd: macd.macdLine.length > 0 ? macd.macdLine.slice(-1)[0] : null, // Último valor da linha MACD
                signal: macd.signalLine.length > 0 ? macd.signalLine.slice(-1)[0] : null, // Último valor da linha de sinal
                histogram: macd.histogram.length > 0 ? macd.histogram.slice(-1)[0] : null, // Último valor do histograma
                sma20: sma20.length > 0 ? sma20.slice(-1)[0] : null,
                ema12: ema12.length > 0 ? ema12.slice(-1)[0] : null,
                bollingerBands: bb.upper.length > 0 ? { 
                    upper: bb.upper.slice(-1)[0], 
                    middle: bb.middle.slice(-1)[0], 
                    lower: bb.lower.slice(-1)[0] 
                } : null
            }
        });
    } catch (error) {
        console.error('Erro ao buscar dados históricos ou calcular indicadores:', error);
        res.status(500).json({ error: 'Erro interno do servidor ao processar dados históricos.' });
    }
});

// Rota para gerar alertas técnicos (exemplo)
app.get('/api/alerts/:symbol', async (req, res) => {
    const { symbol } = req.params;
    try {
        const fullSymbol = MONITORED_COINS.includes(symbol.toUpperCase()) ? `${symbol.toUpperCase()}USDT` : symbol.toUpperCase();
        const historicalData = await getHistoricalData(fullSymbol, '1h', 200); // Exemplo: usar 1h e mais dados
        
        if (!historicalData || historicalData.length < 50) { // Precisa de dados suficientes para indicadores (ajuste conforme necessário)
            return res.status(400).json({ error: 'Dados históricos insuficientes para gerar alertas. Requer pelo menos 50 velas de 1 hora.' });
        }

        const alerts = generateTechnicalAlerts(fullSymbol, historicalData, MONITORED_COINS, TIMEFRAMES);
        res.json({ symbol: symbol, alerts: alerts });
    } catch (error) {
        console.error('Erro ao gerar alertas técnicos:', error);
        res.status(500).json({ error: 'Erro interno do servidor ao gerar alertas.' });
    }
});


// EXPORTAR O APLICATIVO EXPRESS PARA O VERCEL
export default app;
