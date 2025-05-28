/**
 * Módulo de Cálculo de Indicadores Técnicos
 * * Este módulo implementa cálculos reais para os principais indicadores técnicos
 * utilizados na análise de criptomoedas, substituindo as simulações aleatórias.
 * * Indicadores implementados:
 * - RSI (Relative Strength Index)
 * - MACD (Moving Average Convergence Divergence)
 * - Médias Móveis (Simples e Exponencial)
 * - Bandas de Bollinger
 * - Análise de Volume
 * - Suporte e Resistência dinâmicos
 */

/**
 * Calcula o RSI (Relative Strength Index) usando o método original de Wilder
 * @param {Array} prices - Array de preços de fechamento
 * @param {Number} period - Período para cálculo (padrão: 14)
 * @returns {Number} - Valor do RSI (0-100)
 */
export function calculateRSI(prices, period = 14) {
  if (!prices || prices.length < period + 1) {
    console.error('Dados insuficientes para cálculo do RSI');
    return null;
  }

  // Calcular mudanças nos preços
  const changes = [];
  for (let i = 1; i < prices.length; i++) {
    changes.push(prices[i] - prices[i - 1]);
  }

  // Verificar se todos os preços são iguais (sem variação)
  const allSame = changes.every(change => change === 0);
  if (allSame) {
    return 50; // RSI é 50 quando não há variação de preço
  }

  // Separar ganhos (positivos) e perdas (negativos)
  const gains = changes.map(change => change > 0 ? change : 0);
  const losses = changes.map(change => change < 0 ? Math.abs(change) : 0);

  // Verificar casos especiais de alta ou baixa contínua
  const allGains = losses.every(loss => loss === 0);
  if (allGains) return 100;

  const allLosses = gains.every(gain => gain === 0);
  if (allLosses) return 0;

  // Implementação exata do método de Wilder para o RSI
  // Primeiro, calculamos a média simples dos primeiros 'period' ganhos e perdas
  let avgGain = 0;
  let avgLoss = 0;

  for (let i = 0; i < period; i++) {
    avgGain += gains[i];
    avgLoss += losses[i];
  }

  avgGain /= period;
  avgLoss /= period;

  // Para os períodos subsequentes, usamos a fórmula de suavização de Wilder
  // Essa é a implementação exata que corresponde ao TradingView e outras plataformas
  for (let i = period; i < changes.length; i++) {
    avgGain = ((avgGain * (period - 1)) + gains[i]) / period;
    avgLoss = ((avgLoss * (period - 1)) + losses[i]) / period;
  }

  // Calcular RS e RSI
  // Se avgLoss for zero, o RSI é 100
  if (avgLoss === 0) return 100;

  const rs = avgGain / avgLoss;
  const rsi = 100 - (100 / (1 + rs));

  // Retornar com precisão de 2 casas decimais
  return parseFloat(rsi.toFixed(2));
}

/**
 * Calcula a Média Móvel Simples (SMA)
 * @param {Array} prices - Array de preços
 * @param {Number} period - Período para cálculo
 * @returns {Array} - Array de valores SMA
 */
export function calculateSMA(prices, period) {
  if (!prices || prices.length < period) {
    console.error('Dados insuficientes para cálculo da SMA');
    return [];
  }

  const sma = [];

  // Preencher com null até termos dados suficientes
  for (let i = 0; i < period - 1; i++) {
    sma.push(null);
  }

  // Calcular SMA para cada período
  for (let i = period - 1; i < prices.length; i++) {
    const sum = prices.slice(i - period + 1, i + 1).reduce((total, price) => total + price, 0);
    sma.push(parseFloat((sum / period).toFixed(2)));
  }

  return sma;
}

/**
 * Calcula a Média Móvel Exponencial (EMA)
 * @param {Array} prices - Array de preços
 * @param {Number} period - Período para cálculo
 * @returns {Array} - Array de valores EMA
 */
export function calculateEMA(prices, period) {
  if (!prices || prices.length < period) {
    console.error('Dados insuficientes para cálculo da EMA');
    return [];
  }

  const ema = [];
  const multiplier = 2 / (period + 1);

  // Iniciar com SMA
  const smaFirst = prices.slice(0, period).reduce((total, price) => total + price, 0) / period;
  ema.push(smaFirst);

  // Calcular EMA para cada período subsequente
  for (let i = period; i < prices.length; i++) {
    const currentEMA = (prices[i] - ema[ema.length - 1]) * multiplier + ema[ema.length - 1];
    ema.push(parseFloat(currentEMA.toFixed(2)));
  }

  // Preencher com null os valores iniciais para alinhar com o array de preços
  const result = Array(period - 1).fill(null).concat(ema);

  return result;
}

/**
 * Calcula o MACD (Moving Average Convergence Divergence)
 * @param {Array} prices - Array de preços de fechamento
 * @param {Number} fastPeriod - Período da EMA rápida (padrão: 12)
 * @param {Number} slowPeriod - Período da EMA lenta (padrão: 26)
 * @param {Number} signalPeriod - Período da linha de sinal (padrão: 9)
 * @returns {Object} - Objeto com valores MACD, Signal e Histogram
 */
export function calculateMACD(prices, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
  if (!prices || prices.length < slowPeriod + signalPeriod) {
    console.error('Dados insuficientes para cálculo do MACD');
    return { line: [], signal: [], histogram: [] };
  }

  // Calcular EMAs
  const fastEMA = calculateEMA(prices, fastPeriod);
  const slowEMA = calculateEMA(prices, slowPeriod);

  // Calcular linha MACD (diferença entre EMAs)
  const macdLine = [];
  for (let i = 0; i < prices.length; i++) {
    if (fastEMA[i] !== null && slowEMA[i] !== null) {
      macdLine.push(parseFloat((fastEMA[i] - slowEMA[i]).toFixed(2)));
    } else {
      macdLine.push(null);
    }
  }

  // Calcular linha de sinal (EMA da linha MACD)
  const validMacdValues = macdLine.filter(value => value !== null);
  const signalEMA = calculateEMA(validMacdValues, signalPeriod);

  // Alinhar a linha de sinal com a linha MACD
  const signalLine = Array(macdLine.length - validMacdValues.length).fill(null).concat(signalEMA);

  // Calcular histograma (MACD - Signal)
  const histogram = [];
  for (let i = 0; i < macdLine.length; i++) {
    if (macdLine[i] !== null && signalLine[i] !== null) {
      histogram.push(parseFloat((macdLine[i] - signalLine[i]).toFixed(2)));
    } else {
      histogram.push(null);
    }
  }

  return {
    line: macdLine,
    signal: signalLine,
    histogram: histogram
  };
}

/**
 * Calcula as Bandas de Bollinger
 * @param {Array} prices - Array de preços de fechamento
 * @param {Number} period - Período para cálculo (padrão: 20)
 * @param {Number} stdDev - Número de desvios padrão (padrão: 2)
 * @returns {Object} - Objeto com bandas superior, média e inferior
 */
export function calculateBollingerBands(prices, period = 20, stdDev = 2) {
  if (!prices || prices.length < period) {
    console.error('Dados insuficientes para cálculo das Bandas de Bollinger');
    return { upper: [], middle: [], lower: [] };
  }

  // Calcular SMA (banda média)
  const sma = calculateSMA(prices, period);

  const upper = [];
  const lower = [];

  // Preencher com null até termos dados suficientes
  for (let i = 0; i < period - 1; i++) {
    upper.push(null);
    lower.push(null);
  }

  // Calcular bandas superior e inferior
  for (let i = period - 1; i < prices.length; i++) {
    const slice = prices.slice(i - period + 1, i + 1);

    // Calcular desvio padrão
    const mean = slice.reduce((sum, price) => sum + price, 0) / period;
    const squaredDiffs = slice.map(price => Math.pow(price - mean, 2));
    const variance = squaredDiffs.reduce((sum, diff) => sum + diff, 0) / period;
    const standardDeviation = Math.sqrt(variance);

    // Calcular bandas
    upper.push(parseFloat((sma[i] + (standardDeviation * stdDev)).toFixed(2)));
    lower.push(parseFloat((sma[i] - (standardDeviation * stdDev)).toFixed(2)));
  }

  return {
    upper: upper,
    middle: sma,
    lower: lower
  };
}

/**
 * Analisa o volume para detectar anomalias e tendências
 * @param {Array} volumes - Array de volumes
 * @param {Number} period - Período para análise (padrão: 14)
 * @returns {Object} - Objeto com análise de volume
 */
export function analyzeVolume(volumes, period = 14) {
  if (!volumes || volumes.length < period) {
    console.error('Dados insuficientes para análise de volume');
    return { 
      averageVolume: null, 
      volumeChange: null, 
      isVolumeHigh: false,
      trend: 'neutral'
    };
  }

  // Calcular volume médio do período
  const recentVolumes = volumes.slice(-period);
  const averageVolume = recentVolumes.reduce((sum, vol) => sum + vol, 0) / period;

  // Calcular mudança percentual do último volume em relação à média
  const lastVolume = volumes[volumes.length - 1];
  const volumeChange = ((lastVolume - averageVolume) / averageVolume) * 100;

  // Determinar se o volume está alto (>50% acima da média)
  const isVolumeHigh = volumeChange > 50;

  // Analisar tendência de volume (últimos 3 períodos vs 3 anteriores)
  const last3 = volumes.slice(-3).reduce((sum, vol) => sum + vol, 0) / 3;
  const prev3 = volumes.slice(-6, -3).reduce((sum, vol) => sum + vol, 0) / 3;
  const volumeTrend = last3 > prev3 * 1.2 ? 'increasing' : 
                      last3 < prev3 * 0.8 ? 'decreasing' : 'neutral';

  return {
    averageVolume: parseFloat(averageVolume.toFixed(2)),
    volumeChange: parseFloat(volumeChange.toFixed(2)),
    isVolumeHigh: isVolumeHigh,
    trend: volumeTrend
  };
}

/**
 * Identifica níveis de suporte e resistência
 * @param {Array} prices - Array de preços (high, low, close)
 * @param {Number} lookback - Períodos para análise retrospectiva
 * @returns {Object} - Objeto com níveis de suporte e resistência
 */
export function findSupportResistanceLevels(prices, lookback = 30) {
  if (!prices || prices.length < lookback || !prices[0].high) {
    console.error('Dados insuficientes ou formato incorreto para análise de suporte/resistência');
    return { support: [], resistance: [] };
  }

  const supports = [];
  const resistances = [];

  // Encontrar mínimos locais (suportes) e máximos locais (resistências)
  for (let i = 5; i < prices.length - 5; i++) {
    // Verificar se é um mínimo local
    if (prices[i].low < prices[i-1].low && 
        prices[i].low < prices[i-2].low && 
        prices[i].low < prices[i+1].low && 
        prices[i].low < prices[i+2].low) {
      supports.push({
        price: prices[i].low,
        index: i
      });
    }

    // Verificar se é um máximo local
    if (prices[i].high > prices[i-1].high && 
        prices[i].high > prices[i-2].high && 
        prices[i].high > prices[i+1].high && 
        prices[i].high > prices[i+2].high) {
      resistances.push({
        price: prices[i].high,
        index: i
      });
    }
  }

  // Agrupar níveis próximos (dentro de 0.5% um do outro)
  const groupedSupports = groupLevels(supports);
  const groupedResistances = groupLevels(resistances);

  // Ordenar por relevância (frequência de toque)
  const sortedSupports = groupedSupports.sort((a, b) => b.strength - a.strength);
  const sortedResistances = groupedResistances.sort((a, b) => b.strength - a.strength);

  // Retornar os níveis mais significativos (top 3)
  return {
    support: sortedSupports.slice(0, 3).map(s => parseFloat(s.price.toFixed(2))),
    resistance: sortedResistances.slice(0, 3).map(r => parseFloat(r.price.toFixed(2)))
  };
}

/**
 * Função auxiliar para agrupar níveis próximos
 * @param {Array} levels - Array de níveis (preço e índice)
 * @returns {Array} - Array de níveis agrupados com força
 */
function groupLevels(levels) { // Esta função auxiliar não precisa ser exportada
  if (levels.length === 0) return [];

  const grouped = [];
  const threshold = 0.005; // 0.5% de tolerância

  for (const level of levels) {
    let found = false;

    for (const group of grouped) {
      // Verificar se o nível está próximo o suficiente de um grupo existente
      if (Math.abs(level.price - group.price) / group.price < threshold) {
        // Atualizar o grupo com média ponderada
        const totalWeight = group.strength + 1;
        group.price = (group.price * group.strength + level.price) / totalWeight;
        group.strength += 1;
        found = true;
        break;
      }
    }

    // Se não encontrou grupo, criar um novo
    if (!found) {
      grouped.push({
        price: level.price,
        strength: 1
      });
    }
  }

  return grouped;
}

/**
 * Calcula níveis de Fibonacci Retracement
 * @param {Number} high - Preço mais alto do período
 * @param {Number} low - Preço mais baixo do período
 * @returns {Object} - Objeto com níveis de Fibonacci
 */
export function calculateFibonacciLevels(high, low) {
  if (high === undefined || low === undefined) {
    console.error('Dados insuficientes para cálculo dos níveis de Fibonacci');
    return {};
  }

  const diff = high - low;

  return {
    level0: parseFloat(high.toFixed(2)),             // 0%
    level236: parseFloat((high - 0.236 * diff).toFixed(2)), // 23.6%
    level382: parseFloat((high - 0.382 * diff).toFixed(2)), // 38.2%
    level500: parseFloat((high - 0.5 * diff).toFixed(2)),   // 50%
    level618: parseFloat((high - 0.618 * diff).toFixed(2)), // 61.8%
    level786: parseFloat((high - 0.786 * diff).toFixed(2)), // 78.6%
    level1000: parseFloat(low.toFixed(2))                   // 100%
  };
}

/**
 * Calcula o ATR (Average True Range)
 * @param {Array} prices - Array de preços (high, low, close)
 * @param {Number} period - Período para cálculo (padrão: 14)
 * @returns {Array} - Array de valores ATR
 */
export function calculateATR(prices, period = 14) {
  if (!prices || prices.length < period + 1 || !prices[0].high) {
    console.error('Dados insuficientes ou formato incorreto para cálculo do ATR');
    return [];
  }

  const trueRanges = [];

  // Calcular True Range para cada período
  for (let i = 1; i < prices.length; i++) {
    const high = prices[i].high;
    const low = prices[i].low;
    const prevClose = prices[i-1].close;

    const tr1 = high - low;
    const tr2 = Math.abs(high - prevClose);
    const tr3 = Math.abs(low - prevClose);

    const trueRange = Math.max(tr1, tr2, tr3);
    trueRanges.push(trueRange);
  }

  // Calcular ATR inicial (média simples dos primeiros N períodos)
  let atr = trueRanges.slice(0, period).reduce((sum, tr) => sum + tr, 0) / period;

  const atrValues = [atr];

  // Calcular ATR para os períodos restantes (usando suavização)
  for (let i = period; i < trueRanges.length; i++) {
    atr = ((atr * (period - 1)) + trueRanges[i]) / period;
    atrValues.push(parseFloat(atr.toFixed(4)));
  }

  // Preencher com null os valores iniciais para alinhar com o array de preços
  return Array(period).fill(null).concat(atrValues);
}

/**
 * Calcula o ADX (Average Directional Index)
 * @param {Array} prices - Array de preços (high, low, close)
 * @param {Number} period - Período para cálculo (padrão: 14)
 * @returns {Object} - Objeto com valores ADX, +DI e -DI
 */
export function calculateADX(prices, period = 14) {
  if (!prices || prices.length < period * 2 || !prices[0].high) {
    console.error('Dados insuficientes ou formato incorreto para cálculo do ADX');
    return { adx: [], plusDI: [], minusDI: [] };
  }

  const trueRanges = [];
  const plusDM = [];
  const minusDM = [];

  // Calcular +DM, -DM e TR para cada período
  for (let i = 1; i < prices.length; i++) {
    const high = prices[i].high;
    const low = prices[i].low;
    const prevHigh = prices[i-1].high;
    const prevLow = prices[i-1].low;
    const prevClose = prices[i-1].close;

    // Calcular True Range
    const tr1 = high - low;
    const tr2 = Math.abs(high - prevClose);
    const tr3 = Math.abs(low - prevClose);
    const trueRange = Math.max(tr1, tr2, tr3);
    trueRanges.push(trueRange);

    // Calcular +DM e -DM
    const upMove = high - prevHigh;
    const downMove = prevLow - low;

    if (upMove > downMove && upMove > 0) {
      plusDM.push(upMove);
      minusDM.push(0);
    } else if (downMove > upMove && downMove > 0) {
      plusDM.push(0);
      minusDM.push(downMove);
    } else {
      plusDM.push(0);
      minusDM.push(0);
    }
  }

  // Calcular ATR suavizado
  let smoothedTR = trueRanges.slice(0, period).reduce((sum, tr) => sum + tr, 0);
  let smoothedPlusDM = plusDM.slice(0, period).reduce((sum, dm) => sum + dm, 0);
  let smoothedMinusDM = minusDM.slice(0, period).reduce((sum, dm) => sum + dm, 0);

  const plusDIs = [];
  const minusDIs = [];
  const dxValues = [];

  // Calcular +DI, -DI e DX para cada período
  for (let i = period; i < prices.length - 1; i++) {
    // Atualizar valores suavizados
    smoothedTR = smoothedTR - (smoothedTR / period) + trueRanges[i];
    smoothedPlusDM = smoothedPlusDM - (smoothedPlusDM / period) + plusDM[i];
    smoothedMinusDM = smoothedMinusDM - (smoothedMinusDM / period) + minusDM[i];

    // Calcular +DI e -DI
    const plusDI = (smoothedPlusDM / smoothedTR) * 100;
    const minusDI = (smoothedMinusDM / smoothedTR) * 100;

    plusDIs.push(parseFloat(plusDI.toFixed(2)));
    minusDIs.push(parseFloat(minusDI.toFixed(2)));

    // Calcular DX
    const dx = Math.abs((plusDI - minusDI) / (plusDI + minusDI)) * 100;
    dxValues.push(parseFloat(dx.toFixed(2)));
  }

  // Calcular ADX (média do DX)
  const adxValues = [];
  let adx = dxValues.slice(0, period).reduce((sum, dx) => sum + dx, 0) / period;
  adxValues.push(parseFloat(adx.toFixed(2)));

  for (let i = 1; i < dxValues.length - period + 1; i++) {
    adx = ((adx * (period - 1)) + dxValues[i + period - 1]) / period;
    adxValues.push(parseFloat(adx.toFixed(2)));
  }

  // Preencher com null os valores iniciais para alinhar com o array de preços
  const nullPadding = Array(prices.length - adxValues.length).fill(null);

  return {
    adx: nullPadding.concat(adxValues),
    plusDI: nullPadding.slice(0, nullPadding.length - plusDIs.length).concat(plusDIs),
    minusDI: nullPadding.slice(0, nullPadding.length - minusDIs.length).concat(minusDIs)
  };
}

/**
 * Identifica padrões de candlesticks
 * @param {Array} candles - Array de candles (open, high, low, close)
 * @returns {Array} - Array de padrões identificados
 */
export function identifyCandlePatterns(candles) {
  if (!candles || candles.length < 3 || !candles[0].open) {
    console.error('Dados insuficientes ou formato incorreto para identificação de padrões');
    return [];
  }

  const patterns = [];

  // Analisar os últimos candles para padrões
  for (let i = 2; i < candles.length; i++) {
    const c1 = candles[i-2]; // Antepenúltimo candle
    const c2 = candles[i-1]; // Penúltimo candle
    const c3 = candles[i];   // Último candle

    // Calcular tamanhos dos corpos e sombras
    const c1Body = Math.abs(c1.close - c1.open);
    const c2Body = Math.abs(c2.close - c2.open);
    const c3Body = Math.abs(c3.close - c3.open);

    const c1UpperShadow = c1.high - Math.max(c1.open, c1.close);
    const c1LowerShadow = Math.min(c1.open, c1.close) - c1.low;
    const c2UpperShadow = c2.high - Math.max(c2.open, c2.close);
    const c2LowerShadow = Math.min(c2.open, c2.close) - c2.low;
    const c3UpperShadow = c3.high - Math.max(c3.open, c3.close);
    const c3LowerShadow = Math.min(c3.open, c3.close) - c3.low;

    // Verificar padrão Doji
    if (c3Body / ((c3.high - c3.low) || 1) < 0.1) {
      patterns.push({
        pattern: 'Doji',
        position: i,
        significance: 'neutral',
        description: 'Indica indecisão no mercado'
      });
    }

    // Verificar padrão Martelo (Hammer)
    if (c3.close > c3.open && // Candle de alta
        c3LowerShadow > c3Body * 2 && // Sombra inferior longa
        c3UpperShadow < c3Body * 0.5) { // Sombra superior curta
      patterns.push({
        pattern: 'Martelo',
        position: i,
        significance: 'bullish',
        description: 'Possível reversão de baixa para alta'
      });
    }

    // Verificar padrão Estrela Cadente (Shooting Star)
    if (c3.close < c3.open && // Candle de baixa
        c3UpperShadow > c3Body * 2 && // Sombra superior longa
        c3LowerShadow < c3Body * 0.5) { // Sombra inferior curta
      patterns.push({
        pattern: 'Estrela Cadente',
        position: i,
        significance: 'bearish',
        description: 'Possível reversão de alta para baixa'
      });
    }

    // Verificar padrão Engolfo de Alta (Bullish Engulfing)
    if (c2.close < c2.open && // Candle anterior de baixa
        c3.close > c3.open && // Candle atual de alta
        c3.close > c2.open && // Fecha acima da abertura anterior
        c3.open < c2.close) { // Abre abaixo do fechamento anterior
      patterns.push({
        pattern: 'Engolfo de Alta',
        position: i,
        significance: 'bullish',
        description: 'Forte sinal de reversão para alta'
      });
    }

    // Verificar padrão Engolfo de Baixa (Bearish Engulfing)
    if (c2.close > c2.open && // Candle anterior de alta
        c3.close < c3.open && // Candle atual de baixa
        c3.close < c2.open && // Fecha abaixo da abertura anterior
        c3.open > c2.close) { // Abre acima do fechamento anterior
      patterns.push({
        pattern: 'Engolfo de Baixa',
        position: i,
        significance: 'bearish',
        description: 'Forte sinal de reversão para baixa'
      });
    }

    // Verificar padrão Harami de Alta (Bullish Harami)
    if (c2.close < c2.open && // Candle anterior de baixa
        c3.close > c3.open && // Candle atual de alta
        c3.high < c2.open && // Máxima abaixo da abertura anterior
        c3.low > c2.close) { // Mínima acima do fechamento anterior
      patterns.push({
        pattern: 'Harami de Alta',
        position: i,
