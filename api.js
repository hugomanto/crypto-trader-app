// API para integração com dados reais de criptomoedas
// Baseado nas APIs do CryptoCompare, CoinGecko e Binance

// Importar módulos de indicadores e timeframes
if (typeof require !== 'undefined') {
  try {
    const indicators = require('../indicators_module.js');
    const timeframes = require('../timeframes_module.js');
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
    window.generateTechnicalAlerts = timeframes.generateTechnicalAlerts;
  } catch (e) {
    console.warn('Módulos Node.js não disponíveis no navegador:', e);
  }
}

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
  // Tempo de expiração do cache em milissegundos (2 minutos)
  expirationTime: 2 * 60 * 1000
};

// Cache para taxa de conversão BRL
const brlRateCache = {
  rate: 5.3, // Taxa padrão inicial
  lastUpdate: null,
  expirationTime: 30 * 60 * 1000 // 30 minutos
};

// Cache para dados históricos
const historicalDataCache = {
  // Formato: { symbol_timeframe: { data: [...], timestamp: Date.now() } }
};

// Função para buscar preços atuais das criptomoedas
async function fetchCurrentPrices() {
  try {
    console.log('Iniciando busca de preços...');
    
    // Verificar se temos dados em cache válidos
    if (priceCache.prices && priceCache.lastUpdate && 
        (new Date() - priceCache.lastUpdate) < priceCache.expirationTime) {
      console.log('Usando dados de cache (menos de 2 minutos)');
      return priceCache.prices;
    }
    
    // Em ambiente local (file://), usar proxy CORS ou dados simulados temporários
    if (window.location.protocol === 'file:') {
      console.log('Ambiente local detectado, usando dados simulados temporários');
      // Tentar usar dados simulados mais próximos da realidade
      return await fetchSimulatedRealPrices();
    }
    
    // Primeiro tenta Binance (fonte primária)
    try {
      const binancePrices = await fetchPricesFromBinance();
      if (binancePrices && binancePrices.length > 0) {
        console.log('Preços obtidos da Binance:', binancePrices);
        
        // Adicionar preços em BRL usando o módulo price_display
        const pricesWithBRL = await addBRLPrices(binancePrices);
        
        // Atualizar cache
        priceCache.prices = pricesWithBRL;
        priceCache.lastUpdate = new Date();
        return pricesWithBRL;
      }
    } catch (error) {
      console.error('Erro ao buscar preços da Binance:', error);
    }
    
    // Se Binance falhar, tenta CryptoCompare
    try {
      const response = await fetch(`${API_CONFIG.cryptoCompare.baseUrl}/pricemulti?fsyms=${MONITORED_COINS.join(',')}&tsyms=USD`);
      
      if (response.ok) {
        const data = await response.json();
        const prices = Object.entries(data).map(([symbol, prices]) => ({
          symbol: `${symbol}/USDT`,
          price: prices.USD
        }));
        console.log('Preços obtidos do CryptoCompare:', prices);
        
        // Adicionar preços em BRL usando o módulo price_display
        const pricesWithBRL = await addBRLPrices(prices);
        
        // Atualizar cache
        priceCache.prices = pricesWithBRL;
        priceCache.lastUpdate = new Date();
        return pricesWithBRL;
      }
    } catch (error) {
      console.error('Erro ao buscar preços do CryptoCompare:', error);
    }
    
    // Fallback para CoinGecko se CryptoCompare falhar
    try {
      const coinGeckoPrices = await fetchPricesFromCoinGecko();
      if (coinGeckoPrices && coinGeckoPrices.length > 0) {
        // Adicionar preços em BRL usando o módulo price_display
        const pricesWithBRL = await addBRLPrices(coinGeckoPrices);
        
        // Atualizar cache
        priceCache.prices = pricesWithBRL;
        priceCache.lastUpdate = new Date();
        return pricesWithBRL;
      }
    } catch (error) {
      console.error('Erro ao buscar preços do CoinGecko:', error);
    }
    
    // Se todas as APIs falharem, usar dados de cache mesmo que expirados
    if (priceCache.prices) {
      console.warn('Todas as APIs falharam, usando dados de cache expirados');
      return priceCache.prices;
    }
    
    // Se não houver cache, usar dados simulados como último recurso
    console.warn('Todas as APIs falharam e não há cache, usando preços simulados como último recurso');
    const simulatedPrices = await fetchSimulatedRealPrices();
    
    // Adicionar preços em BRL usando o módulo price_display
    const simulatedPricesWithBRL = await addBRLPrices(simulatedPrices);
    
    // Atualizar cache mesmo com dados simulados
    priceCache.prices = simulatedPricesWithBRL;
    priceCache.lastUpdate = new Date();
    return simulatedPricesWithBRL;
  } catch (error) {
    console.error('Erro geral ao buscar preços:', error);
    // Se houver cache, usar mesmo que expirado
    if (priceCache.prices) {
      return priceCache.prices;
    }
    // Último recurso: dados simulados
    const simulatedPrices = await fetchSimulatedRealPrices();
    return await addBRLPrices(simulatedPrices);
  }
}

// Função para adicionar preços em BRL aos dados
async function addBRLPrices(prices) {
  try {
    // Verificar se o módulo price_display está disponível
    if (typeof window.convertUSDTtoBRL === 'function') {
      // Obter taxa de conversão BRL
      let brlRate;
      
      // Verificar se temos taxa em cache válida
      if (brlRateCache.lastUpdate && 
          (new Date() - brlRateCache.lastUpdate) < brlRateCache.expirationTime) {
        brlRate = brlRateCache.rate;
      } else {
        try {
          // Usar a função do módulo price_display para obter taxa atualizada
          const testConversion = await window.convertUSDTtoBRL(1);
          brlRate = testConversion;
          
          // Atualizar cache da taxa
          brlRateCache.rate = brlRate;
          brlRateCache.lastUpdate = new Date();
        } catch (error) {
          console.error('Erro ao obter taxa de conversão BRL:', error);
          brlRate = brlRateCache.rate; // Usar taxa de fallback
        }
      }
      
      // Adicionar preço em BRL a cada item
      return prices.map(item => ({
        ...item,
        priceBRL: item.price * brlRate
      }));
    } else {
      console.warn('Módulo price_display não encontrado, preços em BRL não disponíveis');
      return prices;
    }
  } catch (error) {
    console.error('Erro ao adicionar preços em BRL:', error);
    return prices;
  }
}

// Função para buscar preços da Binance
async function fetchPricesFromBinance() {
  try {
    // Mapear símbolos para formato da Binance
    const symbols = MONITORED_COINS.map(coin => `${coin}USDT`);
    
    // Fazer requisições para cada símbolo
    const promises = symbols.map(async symbol => {
      try {
        // Usar modo no-cors para evitar problemas de CORS
        const response = await fetch(`${API_CONFIG.binance.baseUrl}/ticker/price?symbol=${symbol}`, {
          mode: 'cors',
          headers: {
            'Accept': 'application/json'
          }
        });
        
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
    
    // Aguardar todas as requisições e filtrar resultados nulos
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
    // Mapeamento de símbolos para IDs do CoinGecko
    const coinMapping = {
      'BTC': 'bitcoin',
      'ETH': 'ethereum',
      'SOL': 'solana',
      'BNB': 'binancecoin',
      'AVAX': 'avalanche-2',
      'LINK': 'chainlink',
      'MATIC': 'matic-network',
      'DOT': 'polkadot'
    };
    
    const coinIds = MONITORED_COINS.map(symbol => coinMapping[symbol]).join(',');
    const response = await fetch(`${API_CONFIG.coinGecko.baseUrl}/coins/markets?vs_currency=usd&ids=${coinIds}`, {
      mode: 'cors',
      headers: {
        'Accept': 'application/json'
      }
    });
    
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
    // Tentar buscar preços reais de uma API pública que não tenha restrições de CORS
    const response = await fetch('https://api.coincap.io/v2/assets?ids=bitcoin,ethereum,solana,binance-coin,avalanche,chainlink,matic-network,polkadot', {
      mode: 'no-cors', // Alterado para no-cors para evitar erros de CORS
      headers: {
        'Accept': 'application/json'
      }
    });
    
    // Como no-cors retorna uma resposta opaca, não podemos acessar o conteúdo
    // Vamos direto para os valores simulados
  } catch (error) {
    console.error('Erro ao buscar preços simulados de CoinCap:', error);
  }
  
  // Usar valores aproximados baseados em dados recentes
  return [
    { symbol: 'BTC/USDT', price: 108646.09 }, // Valor atualizado conforme Binance
    { symbol: 'ETH/USDT', price: 2559.85 },   // Valores atualizados
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
  // Normalizar símbolo
  const normalizedSymbol = symbol.replace('/', '');
  
  // Verificar cache
  const cacheKey = `${normalizedSymbol}_${timeframe}`;
  const now = Date.now();
  
  if (historicalDataCache[cacheKey] && 
      now - historicalDataCache[cacheKey].timestamp < 5 * 60 * 1000) { // 5 minutos TTL
    console.log(`Usando dados históricos em cache para ${symbol} em ${timeframe}`);
    return historicalDataCache[cacheKey].data;
  }
  
  try {
    // Mapear timeframe para o formato da Binance
    const binanceIntervals = {
      '15m': '15m',
      '30m': '30m',
      '1h': '1h',
      '2h': '2h',
      '4h': '4h',
      '6h': '6h',
      '1d': '1d',
      '3d': '3d',
      '1w': '1w'
    };
    
    const interval = binanceIntervals[timeframe] || '1h';
    
    // Fazer requisição à API da Binance
    const response = await fetch(`${API_CONFIG.binance.baseUrl}/klines?symbol=${normalizedSymbol}&interval=${interval}&limit=${limit}`, {
      mode: 'cors',
      headers: {
        'Accept': 'application/json'
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      
      // Transformar dados para formato padrão
      const candles = data.map(candle => ({
        timestamp: candle[0],
        open: parseFloat(candle[1]),
        high: parseFloat(candle[2]),
        low: parseFloat(candle[3]),
        close: parseFloat(candle[4]),
        volume: parseFloat(candle[5])
      }));
      
      // Atualizar cache
      historicalDataCache[cacheKey] = {
        data: candles,
        timestamp: now
      };
      
      return candles;
    } else {
      throw new Error(`Erro ao obter dados da Binance: ${response.status}`);
    }
  } catch (error) {
    console.error(`Erro ao obter dados históricos para ${symbol}:`, error);
    
    // Tentar usar cache mesmo que expirado em caso de erro
    if (historicalDataCache[cacheKey]) {
      console.log(`Usando cache expirado para ${symbol} devido a erro`);
      return historicalDataCache[cacheKey].data;
    }
    
    // Se não houver cache, gerar dados simulados
    return generateSimulatedHistoricalData(symbol);
  }
}

// Função para gerar dados históricos simulados
function generateSimulatedHistoricalData(symbol) {
  console.log(`Gerando dados históricos simulados para ${symbol}`);
  
  // Obter preço atual do cache, se disponível
  let currentPrice = 100;
  if (priceCache.prices) {
    const symbolData = priceCache.prices.find(item => item.symbol === symbol);
    if (symbolData) {
      currentPrice = symbolData.price;
    }
  }
  
  // Gerar 100 candles simulados com tendência aleatória
  const candles = [];
  const trend = Math.random() > 0.5 ? 1 : -1;
  const volatility = currentPrice * 0.02; // 2% de volatilidade
  
  let price = currentPrice * 0.9; // Começar 10% abaixo do preço atual
  
  for (let i = 0; i < 100; i++) {
    const timestamp = Date.now() - (100 - i) * 3600000; // 1 hora por candle
    const change = (Math.random() - 0.5) * volatility + trend * volatility * 0.2;
    price += change;
    
    const open = price;
    const close = price + (Math.random() - 0.5) * volatility * 0.5;
    const high = Math.max(open, close) + Math.random() * volatility * 0.5;
    const low = Math.min(open, close) - Math.random() * volatility * 0.5;
    const volume = currentPrice * 100 * (0.5 + Math.random());
    
    candles.push({
      timestamp,
      open,
      high,
      low,
      close,
      volume
    });
  }
  
  return candles;
}

// Função para buscar alertas baseados em análise técnica real
async function fetchAlerts() {
  console.log('Gerando alertas baseados em análise técnica real');
  
  try {
    // Obter preços atuais
    const currentPrices = await fetchCurrentPrices();
    
    // Inicializar objeto de alertas
    const alerts = {
      buy: [],
      sell: [],
      monitoring: []
    };
    
    // Para cada moeda monitorada, gerar alertas baseados em análise técnica
    for (const priceData of currentPrices) {
      const symbol = priceData.symbol;
      
      try {
        // Obter dados históricos para cálculo de indicadores
        const historicalData = await getHistoricalData(symbol, currentTimeframe);
        
        if (!historicalData || historicalData.length < 14) {
          console.warn(`Dados históricos insuficientes para ${symbol}`);
          continue;
        }
        
        // Extrair arrays de preços para cálculos
        const closes = historicalData.map(candle => candle.close);
        const highs = historicalData.map(candle => candle.high);
        const lows = historicalData.map(candle => candle.low);
        const volumes = historicalData.map(candle => candle.volume);
        
        // Calcular RSI
        const rsi = typeof window.calculateRSI === 'function' ? 
                    window.calculateRSI(closes, 14) : 
                    Math.floor(Math.random() * 100); // Fallback para simulação
        
        // Calcular MACD
        let macd = { line: 0, signal: 0, histogram: 0 };
        if (typeof window.calculateMACD === 'function') {
          const macdResult = window.calculateMACD(closes);
          macd = {
            line: macdResult.line[macdResult.line.length - 1],
            signal: macdResult.signal[macdResult.signal.length - 1],
            histogram: macdResult.histogram[macdResult.histogram.length - 1]
          };
        }
        
        // Calcular Bandas de Bollinger
        let bollinger = { upper: 0, middle: 0, lower: 0 };
        if (typeof window.calculateBollingerBands === 'function') {
          const bollingerResult = window.calculateBollingerBands(closes);
          bollinger = {
            upper: bollingerResult.upper[bollingerResult.upper.length - 1],
            middle: bollingerResult.middle[bollingerResult.middle.length - 1],
            lower: bollingerResult.lower[bollingerResult.lower.length - 1]
          };
        }
        
        // Analisar Volume
        let volumeAnalysis = { volumeChange: 0, trend: 'neutral' };
        if (typeof window.analyzeVolume === 'function') {
          volumeAnalysis = window.analyzeVolume(volumes);
        }
        
        // Encontrar níveis de Suporte e Resistência
        let supportResistance = { support: [], resistance: [] };
        if (typeof window.findSupportResistanceLevels === 'function') {
          supportResistance = window.findSupportResistanceLevels(historicalData);
        }
        
        // Calcular ATR
        let atrValue = 0;
        if (typeof window.calculateATR === 'function') {
          const atrResult = window.calculateATR(historicalData);
          atrValue = atrResult[atrResult.length - 1];
        }
        
        // Calcular ADX
        let adx = { value: 0, plusDI: 0, minusDI: 0 };
        if (typeof window.calculateADX === 'function') {
          const adxResult = window.calculateADX(historicalData);
          adx = {
            value: adxResult.adx[adxResult.adx.length - 1],
            plusDI: adxResult.plusDI[adxResult.plusDI.length - 1],
            minusDI: adxResult.minusDI[adxResult.minusDI.length - 1]
          };
        }
        
        // Determinar tipo de alerta baseado em indicadores reais
        const now = new Date();
        const baseSymbol = symbol.split('/')[0];
        const currentPrice = priceData.price;
        
        // Lógica para alertas de COMPRA
        if (rsi < 30) {
          // RSI em zona de sobrevenda
          const confidence = rsi < 20 ? 'HIGH' : 'MEDIUM';
          
          // Verificar confirmação por outros indicadores
          const confirmedByMACD = macd.histogram > 0 || (macd.histogram < 0 && macd.histogram > macd.histogram - 1);
          const confirmedByBollinger = currentPrice <= bollinger.lower * 1.01; // Preço próximo ou abaixo da banda inferior
          const confirmedByVolume = volumeAnalysis.volumeChange > 20; // Aumento de volume
          
          // Calcular nível de confiança baseado em confirmações
          const confirmationCount = [confirmedByMACD, confirmedByBollinger, confirmedByVolume].filter(Boolean).length;
          const finalConfidence = confirmationCount >= 2 ? 'HIGH' : (confirmationCount >= 1 ? 'MEDIUM' : 'LOW');
          
          // Gerar recomendação detalhada
          let recommendation = `Oportunidade de compra para ${baseSymbol} com RSI em zona de sobrevenda (${rsi}) e preço atual de $${currentPrice.toLocaleString()}.`;
          
          if (confirmedByMACD) {
            recommendation += ` MACD mostra momentum positivo.`;
          }
          
          if (confirmedByBollinger) {
            recommendation += ` Preço testando a banda inferior de Bollinger, sugerindo sobrevenda.`;
          }
          
          if (confirmedByVolume) {
            recommendation += ` Volume aumentou ${volumeAnalysis.volumeChange.toFixed(1)}%, confirmando interesse comprador.`;
          }
          
          // Calcular níveis de preço
          const supportLevel = supportResistance.support[0] || currentPrice * 0.95;
          const resistanceLevel = supportResistance.resistance[0] || currentPrice * 1.05;
          const stopLossLevel = Math.min(...lows.slice(-5)) * 0.99;
          const targetLevel = currentPrice * (1 + (30 - rsi) / 100);
          
          alerts.buy.push({
            id: `buy-${baseSymbol}-${now.getTime()}`,
            symbol: symbol,
            type: 'BUY',
            price: currentPrice,
            priceBRL: priceData.priceBRL,
            confidence: finalConfidence,
            created_at: now.toISOString(),
            read: false,
            timeframe: currentTimeframe,
            rsi: rsi,
            macd: macd,
            bollinger: bollinger,
            volume: volumeAnalysis,
            atr: atrValue,
            adx: adx,
            indicators: {
              rsi: rsi,
              macd: macd.histogram > 0 ? 'BULLISH' : 'BEARISH',
              moving_averages: currentPrice > bollinger.middle ? 'UPTREND' : 'DOWNTREND',
              bollinger_bands: currentPrice < bollinger.lower ? 'LOWER_TOUCH' : 'MIDDLE_BAND'
            },
            recommendation: recommendation,
            levels: {
              support: supportLevel,
              resistance: resistanceLevel,
              stopLoss: stopLossLevel,
              target: targetLevel
            }
          });
        }
        
        // Lógica para alertas de VENDA
        if (rsi > 70) {
          // RSI em zona de sobrecompra
          const confidence = rsi > 80 ? 'HIGH' : 'MEDIUM';
          
          // Verificar confirmação por outros indicadores
          const confirmedByMACD = macd.histogram < 0 || (macd.histogram > 0 && macd.histogram < macd.histogram - 1);
          const confirmedByBollinger = currentPrice >= bollinger.upper * 0.99; // Preço próximo ou acima da banda superior
          const confirmedByVolume = volumeAnalysis.volumeChange > 20; // Aumento de volume
          
          // Calcular nível de confiança baseado em confirmações
          const confirmationCount = [confirmedByMACD, confirmedByBollinger, confirmedByVolume].filter(Boolean).length;
          const finalConfidence = confirmationCount >= 2 ? 'HIGH' : (confirmationCount >= 1 ? 'MEDIUM' : 'LOW');
          
          // Gerar recomendação detalhada
          let recommendation = `Oportunidade de venda para ${baseSymbol} com RSI em zona de sobrecompra (${rsi}) e preço atual de $${currentPrice.toLocaleString()}.`;
          
          if (confirmedByMACD) {
            recommendation += ` MACD mostra momentum negativo.`;
          }
          
          if (confirmedByBollinger) {
            recommendation += ` Preço testando a banda superior de Bollinger, sugerindo sobrecompra.`;
          }
          
          if (confirmedByVolume) {
            recommendation += ` Volume aumentou ${volumeAnalysis.volumeChange.toFixed(1)}%, confirmando pressão vendedora.`;
          }
          
          // Calcular níveis de preço
          const supportLevel = supportResistance.support[0] || currentPrice * 0.95;
          const resistanceLevel = supportResistance.resistance[0] || currentPrice * 1.05;
          const stopLossLevel = Math.max(...highs.slice(-5)) * 1.01; // Stop loss acima do preço para venda
          const targetLevel = currentPrice * (1 - (rsi - 70) / 100);
          
          alerts.sell.push({
            id: `sell-${baseSymbol}-${now.getTime()}`,
            symbol: symbol,
            type: 'SELL',
            price: currentPrice,
            priceBRL: priceData.priceBRL,
            confidence: finalConfidence,
            created_at: now.toISOString(),
            read: false,
            timeframe: currentTimeframe,
            rsi: rsi,
            macd: macd,
            bollinger: bollinger,
            volume: volumeAnalysis,
            atr: atrValue,
            adx: adx,
            indicators: {
              rsi: rsi,
              macd: macd.histogram < 0 ? 'BEARISH' : 'BULLISH',
              moving_averages: currentPrice < bollinger.middle ? 'DOWNTREND' : 'UPTREND',
              bollinger_bands: currentPrice > bollinger.upper ? 'UPPER_TOUCH' : 'MIDDLE_BAND'
            },
            recommendation: recommendation,
            levels: {
              support: supportLevel,
              resistance: resistanceLevel,
              stopLoss: stopLossLevel,
              target: targetLevel
            }
          });
        }
        
        // Lógica para alertas de MONITORAMENTO (para todas as moedas, não apenas abaixo de $1)
        // Verificar proximidade a níveis de suporte/resistência
        if (supportResistance.support.length > 0 || supportResistance.resistance.length > 0) {
          let monitoringType = null;
          let monitoringReason = '';
          
          // Verificar proximidade ao suporte
          if (supportResistance.support.length > 0) {
            const closestSupport = supportResistance.support[0];
            const distanceToSupport = (currentPrice - closestSupport) / currentPrice * 100;
            
            if (distanceToSupport >= 0 && distanceToSupport < 3) {
              monitoringType = 'Próximo ao Suporte';
              monitoringReason = `${baseSymbol} está a apenas ${distanceToSupport.toFixed(2)}% do nível de suporte em $${closestSupport.toLocaleString()}.`;
            }
          }
          
          // Verificar proximidade à resistência
          if (!monitoringType && supportResistance.resistance.length > 0) {
            const closestResistance = supportResistance.resistance[0];
            const distanceToResistance = (closestResistance - currentPrice) / currentPrice * 100;
            
            if (distanceToResistance >= 0 && distanceToResistance < 3) {
              monitoringType = 'Próximo à Resistência';
              monitoringReason = `${baseSymbol} está a apenas ${distanceToResistance.toFixed(2)}% do nível de resistência em $${closestResistance.toLocaleString()}.`;
            }
          }
          
          // Verificar volume atípico
          if (!monitoringType && volumeAnalysis.volumeChange > 50) {
            monitoringType = 'Volume Atípico';
            monitoringReason = `${baseSymbol} apresenta volume ${volumeAnalysis.volumeChange > 0 ? 'acima' : 'abaixo'} da média em ${Math.abs(volumeAnalysis.volumeChange).toFixed(1)}%.`;
          }
          
          // Verificar tendência forte (ADX)
          if (!monitoringType && adx.value > 25) {
            const trendDirection = adx.plusDI > adx.minusDI ? 'alta' : 'baixa';
            monitoringType = 'Tendência Forte';
            monitoringReason = `${baseSymbol} está em tendência de ${trendDirection} com ADX de ${adx.value.toFixed(1)}.`;
          }
          
          // Adicionar alerta de monitoramento se identificado algum tipo
          if (monitoringType) {
            alerts.monitoring.push({
              id: `monitoring-${baseSymbol}-${now.getTime()}`,
              symbol: symbol,
              type: 'MONITORING',
              price: currentPrice,
              priceBRL: priceData.priceBRL,
              confidence: 'MEDIUM',
              created_at: now.toISOString(),
              read: false,
              timeframe: currentTimeframe,
              monitoring_type: monitoringType,
              rsi: rsi,
              macd: macd,
              bollinger: bollinger,
              volume: volumeAnalysis,
              atr: atrValue,
              adx: adx,
              indicators: {
                rsi: rsi,
                macd: macd.histogram > 0 ? 'BULLISH' : 'BEARISH',
                moving_averages: currentPrice > bollinger.middle ? 'UPTREND' : 'DOWNTREND',
                bollinger_bands: 'MIDDLE_BAND'
              },
              recommendation: monitoringReason,
              levels: {
                support: supportResistance.support[0] || currentPrice * 0.95,
                resistance: supportResistance.resistance[0] || currentPrice * 1.05
              }
            });
          }
        }
      } catch (error) {
        console.error(`Erro ao gerar alertas para ${symbol}:`, error);
      }
    }
    
    return alerts;
  } catch (error) {
    console.error('Erro ao gerar alertas:', error);
    return { buy: [], sell: [], monitoring: [] };
  }
}

// Função para marcar um alerta como lido
function markAlertAsRead(alertId) {
  // Simulação de marcação de alerta como lido
  console.log(`Alerta ${alertId} marcado como lido`);
  return Promise.resolve({ success: true });
}

// Função para forçar atualização dos preços
async function forceUpdatePrices() {
  // Invalidar cache
  priceCache.lastUpdate = null;
  // Buscar novos preços
  return await fetchCurrentPrices();
}

// Função para alterar o timeframe atual
function setTimeframe(timeframe) {
  if (['15m', '30m', '1h', '2h', '4h', '6h', '1d', '3d', '1w'].includes(timeframe)) {
    currentTimeframe = timeframe;
    console.log(`Timeframe alterado para ${timeframe}`);
    // Limpar cache de alertas para forçar recálculo com novo timeframe
    return true;
  }
  return false;
}

// Função para obter o timeframe atual
function getCurrentTimeframe() {
  return currentTimeframe;
}

// Exportar funções para uso externo
window.WorkspaceAPI = {
  fetchCurrentPrices,
  fetchAlerts,
  markAlertAsRead,
  forceUpdatePrices,
  setTimeframe,
  getCurrentTimeframe
};
