// API para integração com dados reais de criptomoedas
// Baseado nas APIs do CryptoCompare, CoinGecko e Binance

// Importar módulos necessários para a API Express
import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch'; // Usar node-fetch para garantir o funcionamento do fetch em Node.js

// Importar módulos de indicadores e timeframes usando ES Modules
import * as indicators from '../indicators_module.js';
import { generateTechnicalAlerts, generateAlertsForMultipleSymbols, TIMEFRAMES } from '../timeframes_module.js';

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
    // window.convertUSDTtoBRL seria importado separadamente se price_display.js existisse e fosse um módulo
    // Para simplificar, assumimos que convertUSDTtoBRL seria fornecido por um contexto de navegador ou outro módulo
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
        // Em ambiente Vercel/Node.js, 'window.location.protocol' não
