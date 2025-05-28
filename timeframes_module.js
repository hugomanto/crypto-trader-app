/**
 * Módulo de Gerenciamento de Timeframes
 * * Este módulo implementa a seleção dinâmica de períodos (timeframes) para análise
 * de criptomoedas, permitindo que o usuário escolha entre diferentes intervalos
 * de tempo e garantindo que todos os cálculos de indicadores se ajustem automaticamente.
 * * Timeframes suportados:
 * - 15 minutos
 * - 30 minutos
 * - 1 hora
 * - 2 horas
 * - 4 horas
 * - 6 horas
 * - 1 dia
 * - 3 dias
 * - 1 semana
 */

import { calculateRSI, calculateMACD, calculateBollingerBands, analyzeVolume, findSupportResistanceLevels, identifyCandlePatterns, calculateFibonacciLevels, calculateATR, calculateADX, calculateSMA, calculateEMA } from './indicators_module.js';
import { formatPrice, convertUSDTtoBRL } from './price_display_module.js'; // Adicionei o '.js'

// Constantes para timeframes
const TIMEFRAMES = {
  MINUTES_15: '15m',
  MINUTES_30: '30m',
  HOUR_1: '1h',
  HOUR_2: '2h',
  HOUR_4: '4h',
  HOUR_6: '6h',
  DAY_1: '1d',
  DAY_3: '3d',
  WEEK_1: '1w'
};

// Mapeamento de timeframes para intervalos em milissegundos
const TIMEFRAME_INTERVALS = {
  [TIMEFRAMES.MINUTES_15]: 15 * 60 * 1000,
  [TIMEFRAMES.MINUTES_30]: 30 * 60 * 1000,
  [TIMEFRAMES.HOUR_1]: 60 * 60 * 1000,
  [TIMEFRAMES.HOUR_2]: 2 * 60 * 60 * 1000,
  [TIMEFRAMES.HOUR_4]: 4 * 60 * 60 * 1000,
  [TIMEFRAMES.HOUR_6]: 6 * 60 * 60 * 1000,
  [TIMEFRAMES.DAY_1]: 24 * 60 * 60 * 1000,
  [TIMEFRAMES.DAY_3]: 3 * 24 * 60 * 60 * 1000,
  [TIMEFRAMES.WEEK_1]: 7 * 24 * 60 * 60 * 1000
};

// Mapeamento para APIs externas
const BINANCE_INTERVALS = {
  [TIMEFRAMES.MINUTES_15]: '15m',
  [TIMEFRAMES.MINUTES_30]: '30m',
  [TIMEFRAMES.HOUR_1]: '1h',
  [TIMEFRAMES.HOUR_2]: '2h',
  [TIMEFRAMES.HOUR_4]: '4h',
  [TIMEFRAMES.HOUR_6]: '6h',
  [TIMEFRAMES.DAY_1]: '1d',
  [TIMEFRAMES.DAY_3]: '3d',
  [TIMEFRAMES.WEEK_1]: '1w'
};

// Cache para dados históricos por timeframe
const historicalDataCache = {
  // Formato: { symbol_timeframe: { data: [...], timestamp: Date.now() } }
};

// TTL do cache em milissegundos (5 minutos)
const CACHE_TTL = 5 * 60 * 1000;

/**
 * Obtém dados históricos de uma criptomoeda em um timeframe específico
 * @param {String} symbol - Símbolo da criptomoeda (ex: 'BTCUSDT')
 * @param {String} timeframe - Timeframe desejado (ex: '1h')
 * @param {Number} limit - Número de candles a serem retornados (padrão: 100)
 * @returns {Promise<Array>} - Array de candles (timestamp, open, high, low, close, volume)
 */
async function getHistoricalData(symbol, timeframe = TIMEFRAMES.HOUR_1, limit = 100) {
  // Normalizar símbolo
  const normalizedSymbol = symbol.replace('/', '');
  
  // Verificar cache
  const cacheKey = `${normalizedSymbol}_${timeframe}`;
  const now = Date.now();
  
  if (historicalDataCache[cacheKey] && 
      now - historicalDataCache[cacheKey].timestamp < CACHE_TTL) {
    console.log(`Usando dados em cache para ${symbol} em ${timeframe}`);
    return historicalDataCache[cacheKey].data;
  }
  
  try {
    // Mapear timeframe para o formato da Binance
    const interval = BINANCE_INTERVALS[timeframe] || '1h';
    
    // Fazer requisição à API da Binance
    const response = await fetch(`https://api.binance.com/api/v3/klines?symbol=${normalizedSymbol}&interval=${interval}&limit=${limit}`);
    const data = await response.json();
    
    if (!response.ok || !Array.isArray(data)) {
      throw new Error('Formato de resposta inválido');
    }
    
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
  } catch (error) {
    console.error(`Erro ao obter dados históricos para ${symbol} em ${timeframe}:`, error);
    
    // Tentar usar cache mesmo que expirado em caso de erro
    if (historicalDataCache[cacheKey]) {
      console.log(`Usando cache expirado para ${symbol} em ${timeframe} devido a erro`);
      return historicalDataCache[cacheKey].data;
    }
    
    // Se não houver cache, tentar fonte alternativa
    return getHistoricalDataAlternative(symbol, timeframe, limit);
  }
}

/**
 * Fonte alternativa para dados históricos (CryptoCompare)
 * @param {String} symbol - Símbolo da criptomoeda
 * @param {String} timeframe - Timeframe desejado
 * @param {Number} limit - Número de candles
 * @returns {Promise<Array>} - Array de candles
 */
async function getHistoricalDataAlternative(symbol, timeframe = TIMEFRAMES.HOUR_1, limit = 100) {
  try {
    // Extrair moeda base e cotação
    const [base, quote] = symbol.split('/');
    
    // Mapear timeframe para formato do CryptoCompare
    let aggregation = 1;
    let cryptoCompareTimeframe = 'hour';
    
    switch (timeframe) {
      case TIMEFRAMES.MINUTES_15:
        cryptoCompareTimeframe = 'minute';
        aggregation = 15;
        break;
      case TIMEFRAMES.MINUTES_30:
        cryptoCompareTimeframe = 'minute';
        aggregation = 30;
        break;
      case TIMEFRAMES.HOUR_1:
        cryptoCompareTimeframe = 'hour';
        aggregation = 1;
        break;
      case TIMEFRAMES.HOUR_2:
        cryptoCompareTimeframe = 'hour';
        aggregation = 2;
        break;
      case TIMEFRAMES.HOUR_4:
        cryptoCompareTimeframe = 'hour';
        aggregation = 4;
        break;
      case TIMEFRAMES.HOUR_6:
        cryptoCompareTimeframe = 'hour';
        aggregation = 6;
        break;
      case TIMEFRAMES.DAY_1:
        cryptoCompareTimeframe = 'day';
        aggregation = 1;
        break;
      case TIMEFRAMES.DAY_3:
        cryptoCompareTimeframe = 'day';
        aggregation = 3;
        break;
      case TIMEFRAMES.WEEK_1:
        cryptoCompareTimeframe = 'day';
        aggregation = 7;
        break;
      default:
        cryptoCompareTimeframe = 'hour';
        aggregation = 1;
    }
    
    // Fazer requisição à API do CryptoCompare
    const response = await fetch(`https://min-api.cryptocompare.com/data/v2/histo${cryptoCompareTimeframe}?fsym=${base}&tsym=${quote || 'USDT'}&limit=${limit}&aggregate=${aggregation}`);
    const data = await response.json();
    
    if (!response.ok || !data || !data.Data || !data.Data.Data) {
      throw new Error('Formato de resposta inválido');
    }
    
    // Transformar dados para formato padrão
    const candles = data.Data.Data.map(candle => ({
      timestamp: candle.time * 1000,
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
      volume: candle.volumefrom
    }));
    
    // Atualizar cache
    const cacheKey = `${symbol.replace('/', '')}_${timeframe}`;
    historicalDataCache[cacheKey] = {
      data: candles,
      timestamp: Date.now()
    };
    
    return candles;
  } catch (error) {
    console.error(`Erro ao obter dados alternativos para ${symbol} em ${timeframe}:`, error);
    return [];
  }
}

/**
 * Calcula todos os indicadores técnicos para uma criptomoeda em um timeframe específico
 * @param {String} symbol - Símbolo da criptomoeda
 * @param {String} timeframe - Timeframe desejado
 * @returns {Promise<Object>} - Objeto com todos os indicadores calculados
 */
async function calculateAllIndicators(symbol, timeframe = TIMEFRAMES.HOUR_1) {
  try {
    // Obter dados históricos
    const candles = await getHistoricalData(symbol, timeframe);
    
    if (!candles || candles.length === 0) {
      throw new Error('Sem dados históricos disponíveis');
    }
    
    // Extrair arrays de preços para cálculos
    const closes = candles.map(candle => candle.close);
    const highs = candles.map(candle => candle.high);
    const lows = candles.map(candle => candle.low);
    const volumes = candles.map(candle => candle.volume);
    
    // Calcular RSI
    const rsi = calculateRSI(closes);
    
    // Calcular Médias Móveis
    const sma20 = calculateSMA(closes, 20);
    const ema50 = calculateEMA(closes, 50);
    const ema200 = calculateEMA(closes, 200);
    
    // Calcular MACD
    const macd = calculateMACD(closes);
    
    // Calcular Bandas de Bollinger
    const bollinger = calculateBollingerBands(closes);
    
    // Analisar Volume
    const volumeAnalysis = analyzeVolume(volumes);
    
    // Encontrar níveis de Suporte e Resistência
    const supportResistance = findSupportResistanceLevels(candles);
    
    // Calcular níveis de Fibonacci
    const highestPrice = Math.max(...highs);
    const lowestPrice = Math.min(...lows);
    const fibonacci = calculateFibonacciLevels(highestPrice, lowestPrice);
    
    // Calcular ATR
    const atr = calculateATR(candles);
    
    // Calcular ADX
    const adx = calculateADX(candles);
    
    // Identificar padrões de candlesticks
    const candlePatterns = identifyCandlePatterns(candles);
    
    // Retornar todos os indicadores calculados
    return {
      symbol,
      timeframe,
      lastPrice: closes[closes.length - 1],
      lastUpdate: new Date().toISOString(),
      candles: candles.slice(-10), // Últimos 10 candles para referência
      indicators: {
        rsi: rsi,
        sma20: sma20[sma20.length - 1],
        ema50: ema50[ema50.length - 1],
        ema200: ema200[ema200.length - 1],
        macd: {
          line: macd.line[macd.line.length - 1],
          signal: macd.signal[macd.signal.length - 1],
          histogram: macd.histogram[macd.histogram.length - 1]
        },
        bollinger: {
          upper: bollinger.upper[bollinger.upper.length - 1],
          middle: bollinger.middle[bollinger.middle.length - 1],
          lower: bollinger.lower[bollinger.lower.length - 1]
        },
        volume: volumeAnalysis,
        supportResistance: supportResistance,
        fibonacci: fibonacci,
        atr: atr[atr.length - 1],
        adx: {
          value: adx.adx[adx.adx.length - 1],
          plusDI: adx.plusDI[adx.plusDI.length - 1],
          minusDI: adx.minusDI[adx.minusDI.length - 1]
        },
        patterns: candlePatterns.filter(p => p.position >= candles.length - 3) // Padrões recentes
      }
    };
  } catch (error) {
    console.error(`Erro ao calcular indicadores para ${symbol} em ${timeframe}:`, error);
    return {
      symbol,
      timeframe,
      error: error.message,
      lastUpdate: new Date().toISOString()
    };
  }
}

/**
 * Gera alertas baseados em análise técnica real
 * @param {String} symbol - Símbolo da criptomoeda
 * @param {String} timeframe - Timeframe desejado
 * @returns {Promise<Object>} - Objeto com alertas gerados
 */
async function generateTechnicalAlerts(symbol, timeframe = TIMEFRAMES.HOUR_1) {
  try {
    // Calcular todos os indicadores
    const analysis = await calculateAllIndicators(symbol, timeframe);
    
    if (analysis.error) {
      throw new Error(analysis.error);
    }
    
    const alerts = {
      buy: [],
      sell: [],
      monitoring: []
    };
    
    const now = new Date();
    const baseSymbol = symbol.split('/')[0];
    const currentPrice = analysis.lastPrice;
    
    // Extrair indicadores relevantes
    const rsi = analysis.indicators.rsi;
    const macd = analysis.indicators.macd;
    const bollinger = analysis.indicators.bollinger;
    const volume = analysis.indicators.volume;
    const supportResistance = analysis.indicators.supportResistance;
    const patterns = analysis.indicators.patterns;
    const adx = analysis.indicators.adx;
    
    // Lógica para alertas de COMPRA
    if (rsi < 30) {
      // RSI em zona de sobrevenda
      const confidence = rsi < 20 ? 'HIGH' : 'MEDIUM';
      
      // Verificar confirmação por outros indicadores
      let confirmedByMACD = macd.histogram > 0 || (macd.histogram < 0 && macd.histogram > macd.histogram - 1);
      let confirmedByBollinger = currentPrice <= bollinger.lower * 1.01; // Preço próximo ou abaixo da banda inferior
      let confirmedByVolume = volume.volumeChange > 20; // Aumento de volume
      
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
        recommendation += ` Volume aumentou ${volume.volumeChange.toFixed(1)}%, confirmando interesse comprador.`;
      }
      
      if (patterns.length > 0) {
        const bullishPatterns = patterns.filter(p => p.significance.includes('bullish'));
        if (bullishPatterns.length > 0) {
          recommendation += ` Padrão de velas identificado: ${bullishPatterns[0].pattern}.`;
        }
      }
      
      // Calcular níveis de preço
      const stopLoss = Math.min(...analysis.candles.slice(-5).map(c => c.low)) * 0.99;
      const target = currentPrice * (1 + (30 - rsi) / 100); // Alvo baseado na intensidade da sobrevenda
      
      alerts.buy.push({
        id: `buy-${baseSymbol}-${now.getTime()}`,
        symbol: symbol,
        type: 'BUY',
        price: currentPrice,
        confidence: finalConfidence,
        created_at: now.toISOString(),
        read: false,
        timeframe: timeframe,
        indicators: {
          rsi: rsi,
          macd: macd.histogram > 0 ? 'BULLISH' : 'BEARISH',
          moving_averages: currentPrice > analysis.indicators.ema50 ? 'UPTREND' : 'DOWNTREND',
          bollinger_bands: currentPrice < bollinger.lower ? 'LOWER_TOUCH' : 'MIDDLE_BAND'
        },
        recommendation: recommendation,
        levels: {
          support: supportResistance.support[0] || currentPrice * 0.95,
          resistance: supportResistance.resistance[0] || currentPrice * 1.05,
          stopLoss: stopLoss,
          target: target
        }
      });
    }
    
    // Lógica para alertas de VENDA
    if (rsi > 70) {
      // RSI em zona de sobrecompra
      const confidence = rsi > 80 ? 'HIGH' : 'MEDIUM';
      
      // Verificar confirmação por outros indicadores
      let confirmedByMACD = macd.histogram < 0 || (macd.histogram > 0 && macd.histogram < macd.histogram - 1);
      let confirmedByBollinger = currentPrice >= bollinger.upper * 0.99; // Preço próximo ou acima da banda superior
      let confirmedByVolume = volume.volumeChange > 20; // Aumento de volume
      
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
        recommendation += ` Volume aumentou ${volume.volumeChange.toFixed(1)}%, confirmando pressão vendedora.`;
      }
      
      if (patterns.length > 0) {
        const bearishPatterns = patterns.filter(p => p.significance.includes('bearish'));
        if (bearishPatterns.length > 0) {
          recommendation += ` Padrão de velas identificado: ${bearishPatterns[0].pattern}.`;
        }
      }
      
      // Calcular níveis de preço
      const stopLoss = Math.max(...analysis.candles.slice(-5).map(c => c.high)) * 1.01;
      const target = currentPrice * (1 - (rsi - 70) / 100); // Alvo baseado na intensidade da sobrecompra
      
      alerts.sell.push({
        id: `sell-${baseSymbol}-${now.getTime()}`,
        symbol: symbol,
        type: 'SELL',
        price: currentPrice,
        confidence: finalConfidence,
        created_at: now.toISOString(),
        read: false,
        timeframe: timeframe,
        indicators: {
          rsi: rsi,
          macd: macd.histogram < 0 ? 'BEARISH' : 'BULLISH',
          moving_averages: currentPrice < analysis.indicators.ema50 ? 'DOWNTREND' : 'UPTREND',
          bollinger_bands: currentPrice > bollinger.upper ? 'UPPER_TOUCH' : 'MIDDLE_BAND'
        },
        recommendation: recommendation,
        levels: {
          support: supportResistance.support[0] || currentPrice * 0.95,
          resistance: supportResistance.resistance[0] || currentPrice * 1.05,
          stopLoss: stopLoss,
          target: target
        }
      });
    }
    
    // Lógica para alertas de MONITORAMENTO (para todas as moedas, não apenas abaixo de $1)
    
    // 1. Monitoramento de Suporte
    if (currentPrice <= supportResistance.support[0] * 1.02) {
      alerts.monitoring.push({
        id: `monitoring-support-${baseSymbol}-${now.getTime()}`,
        symbol: symbol,
        type: 'MONITORING',
        price: currentPrice,
        confidence: 'MEDIUM',
        created_at: now.toISOString(),
        read: false,
        timeframe: timeframe,
        monitoring_type: 'Próximo ao Suporte',
        indicators: {
          rsi: rsi,
          macd: macd.histogram > 0 ? 'BULLISH' : 'BEARISH',
          moving_averages: currentPrice > analysis.indicators.ema50 ? 'UPTREND' : 'DOWNTREND',
          bollinger_bands: 'MIDDLE_BAND'
        },
        recommendation: `${baseSymbol} está testando um nível de suporte importante em $${supportResistance.support[0].toLocaleString()}. Preço atual de $${currentPrice.toLocaleString()}.`,
        levels: {
          support: supportResistance.support[0],
          resistance: supportResistance.resistance[0]
        }
      });
    }
    
    // 2. Monitoramento de Resistência
    if (currentPrice >= supportResistance.resistance[0] * 0.98) {
      alerts.monitoring.push({
        id: `monitoring-resistance-${baseSymbol}-${now.getTime()}`,
        symbol: symbol,
        type: 'MONITORING',
        price: currentPrice,
        confidence: 'MEDIUM',
        created_at: now.toISOString(),
        read: false,
        timeframe: timeframe,
        monitoring_type: 'Próximo à Resistência',
        indicators: {
          rsi: rsi,
          macd: macd.histogram > 0 ? 'BULLISH' : 'BEARISH',
          moving_averages: currentPrice > analysis.indicators.ema50 ? 'UPTREND' : 'DOWNTREND',
          bollinger_bands: 'MIDDLE_BAND'
        },
        recommendation: `${baseSymbol} está testando um nível de resistência importante em $${supportResistance.resistance[0].toLocaleString()}. Preço atual de $${currentPrice.toLocaleString()}.`,
        levels: {
          support: supportResistance.support[0],
          resistance: supportResistance.resistance[0]
        }
      });
    }
    
    // 3. Monitoramento de Volume Atípico
    if (volume.volumeChange > 100) { // Volume dobrou
      alerts.monitoring.push({
        id: `monitoring-volume-${baseSymbol}-${now.getTime()}`,
        symbol: symbol,
        type: 'MONITORING',
        price: currentPrice,
        confidence: 'MEDIUM',
        created_at: now.toISOString(),
        read: false,
        timeframe: timeframe,
        monitoring_type: 'Volume Atípico',
        indicators: {
          rsi: rsi,
          macd: macd.histogram > 0 ? 'BULLISH' : 'BEARISH',
          moving_averages: currentPrice > analysis.indicators.ema50 ? 'UPTREND' : 'DOWNTREND',
          bollinger_bands: 'MIDDLE_BAND'
        },
        recommendation: `${baseSymbol} apresenta volume de negociação atípico, ${volume.volumeChange.toFixed(1)}% acima da média. Preço atual de $${currentPrice.toLocaleString()}.`,
        levels: {
          support: supportResistance.support[0],
          resistance: supportResistance.resistance[0]
        }
      });
    }
    
    // 4. Monitoramento de Padrões Gráficos
    if (patterns.length > 0) {
      const significantPattern = patterns.find(p => 
        p.significance.includes('strongly') || 
        (patterns[0].position >= analysis.candles.length - 2) // Padrão muito recente
      );
      
      if (significantPattern) {
        alerts.monitoring.push({
          id: `monitoring-pattern-${baseSymbol}-${now.getTime()}`,
          symbol: symbol,
          type: 'MONITORING',
          price: currentPrice,
          confidence: significantPattern.significance.includes('strongly') ? 'HIGH' : 'MEDIUM',
          created_at: now.toISOString(),
          read: false,
          timeframe: timeframe,
          monitoring_type: 'Padrão Gráfico',
          indicators: {
            rsi: rsi,
            macd: macd.histogram > 0 ? 'BULLISH' : 'BEARISH',
            moving_averages: currentPrice > analysis.indicators.ema50 ? 'UPTREND' : 'DOWNTREND',
            bollinger_bands: 'MIDDLE_BAND'
          },
          recommendation: `${baseSymbol} formou um padrão gráfico "${significantPattern.pattern}" (${significantPattern.significance.includes('bullish') ? 'alta' : 'baixa'}). ${significantPattern.description}. Preço atual de $${currentPrice.toLocaleString()}.`,
          levels: {
            support: supportResistance.support[0],
            resistance: supportResistance.resistance[0]
          }
        });
      }
    }
    
    // 5. Monitoramento de Tendência Forte (ADX > 25)
    if (adx.value > 25) {
      const trendDirection = adx.plusDI > adx.minusDI ? 'alta' : 'baixa';
      
      alerts.monitoring.push({
        id: `monitoring-trend-${baseSymbol}-${now.getTime()}`,
        symbol: symbol,
        type: 'MONITORING',
        price: currentPrice,
        confidence: adx.value > 35 ? 'HIGH' : 'MEDIUM',
        created_at: now.toISOString(),
        read: false,
        timeframe: timeframe,
        monitoring_type: 'Tendência Forte',
        indicators: {
          rsi: rsi,
          macd: macd.histogram > 0 ? 'BULLISH' : 'BEARISH',
          moving_averages: currentPrice > analysis.indicators.ema50 ? 'UPTREND' : 'DOWNTREND',
          bollinger_bands: 'MIDDLE_BAND'
        },
        recommendation: `${baseSymbol} está em tendência forte de ${trendDirection} (ADX: ${adx.value.toFixed(1)}). Preço atual de $${currentPrice.toLocaleString()}.`,
        levels: {
          support: supportResistance.support[0],
          resistance: supportResistance.resistance[0]
        }
      });
    }
    
    return alerts;
  } catch (error) {
    console.error(`Erro ao gerar alertas para ${symbol} em ${timeframe}:`, error);
    return { buy: [], sell: [], monitoring: [] };
  }
}

/**
 * Gera alertas para múltiplas criptomoedas em um timeframe específico
 * @param {Array} symbols - Array de símbolos de criptomoedas
 * @param {String} timeframe - Timeframe desejado
 * @returns {Promise<Object>} - Objeto com todos os alertas gerados
 */
async function generateAlertsForMultipleSymbols(symbols, timeframe = TIMEFRAMES.HOUR_1) {
  const allAlerts = {
    buy: [],
    sell: [],
    monitoring: []
  };
  
  // Processar símbolos em lotes para evitar sobrecarga
  const batchSize = 5;
  
  for (let i = 0; i < symbols.length; i += batchSize) {
    const batch = symbols.slice(i, i + batchSize);
    
    // Processar lote em paralelo
    const batchResults = await Promise.all(
      batch.map(symbol => generateTechnicalAlerts(symbol, timeframe))
    );
    
    // Combinar resultados
    batchResults.forEach(result => {
      allAlerts.buy = allAlerts.buy.concat(result.buy);
      allAlerts.sell = allAlerts.sell.concat(result.sell);
      allAlerts.monitoring = allAlerts.monitoring.concat(result.monitoring);
    });
    
    // Pequeno delay entre lotes para evitar rate limiting
    if (i + batchSize < symbols.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  return allAlerts;
}

/**
 * Exporta todas as funções e constantes do módulo
 */
export {
  TIMEFRAMES,
  getHistoricalData,
  calculateAllIndicators,
  generateTechnicalAlerts,
  generateAlertsForMultipleSymbols
};
