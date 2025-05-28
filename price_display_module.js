/**
 * Módulo de exibição de preços em múltiplas moedas
 * 
 * Este módulo implementa a conversão e exibição de preços de criptomoedas
 * em USDT e BRL (Real Brasileiro), seguindo o padrão visual da Binance.
 * 
 * Funcionalidades:
 * - Conversão de USDT para BRL usando taxa atualizada
 * - Formatação de preços no padrão Binance
 * - Atualização automática da cotação
 * - Cache para otimização de requisições
 */

const axios = require('axios');

// Cache para a taxa de conversão
let exchangeRateCache = {
  rate: null,
  timestamp: 0,
  ttl: 5 * 60 * 1000 // 5 minutos em milissegundos
};

/**
 * Obtém a taxa de conversão atual de USD para BRL
 * @returns {Promise<Number>} - Taxa de conversão
 */
async function getUSDToBRLRate() {
  try {
    // Verificar se o cache é válido
    const now = Date.now();
    if (exchangeRateCache.rate && (now - exchangeRateCache.timestamp) < exchangeRateCache.ttl) {
      return exchangeRateCache.rate;
    }
    
    // Obter taxa atualizada da API
    const response = await axios.get('https://economia.awesomeapi.com.br/json/last/USD-BRL');
    
    if (response.data && response.data.USDBRL) {
      const rate = parseFloat(response.data.USDBRL.bid);
      
      // Atualizar cache
      exchangeRateCache = {
        rate: rate,
        timestamp: now,
        ttl: 5 * 60 * 1000
      };
      
      return rate;
    } else {
      throw new Error('Formato de resposta inválido');
    }
  } catch (error) {
    console.error('Erro ao obter taxa de conversão:', error);
    
    // Se temos um valor em cache, mesmo expirado, usamos como fallback
    if (exchangeRateCache.rate) {
      return exchangeRateCache.rate;
    }
    
    // Fallback para uma taxa fixa se não temos nada em cache
    return 5.3;
  }
}

/**
 * Converte preço de USDT para BRL
 * @param {Number} priceUSDT - Preço em USDT
 * @returns {Promise<Number>} - Preço em BRL
 */
async function convertUSDTtoBRL(priceUSDT) {
  const rate = await getUSDToBRLRate();
  return parseFloat((priceUSDT * rate).toFixed(2));
}

/**
 * Formata preço para exibição no padrão Binance
 * @param {Number} price - Preço a ser formatado
 * @param {String} currency - Moeda (USDT ou BRL)
 * @returns {String} - Preço formatado
 */
function formatPrice(price, currency = 'USDT') {
  // Determinar o número de casas decimais com base no valor
  let decimals = 2;
  if (price < 1) decimals = 6;
  else if (price < 10) decimals = 4;
  else if (price < 1000) decimals = 2;
  
  // Formatar com separador de milhares e casas decimais
  const formattedPrice = price.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
  
  // Adicionar prefixo da moeda
  if (currency === 'BRL') {
    return `R$${formattedPrice}`;
  } else {
    return formattedPrice;
  }
}

/**
 * Gera HTML para exibição de preço no padrão Binance
 * @param {String} symbol - Símbolo da moeda (ex: BTC/USDT)
 * @param {Number} priceUSDT - Preço em USDT
 * @param {Number} priceBRL - Preço em BRL
 * @returns {String} - HTML formatado
 */
function generatePriceHTML(symbol, priceUSDT, priceBRL) {
  return `
    <div class="crypto-price-container">
      <div class="crypto-symbol">${symbol}</div>
      <div class="crypto-price-usdt">${formatPrice(priceUSDT)}</div>
      <div class="crypto-price-brl">${formatPrice(priceBRL, 'BRL')}</div>
    </div>
  `;
}

/**
 * Atualiza a exibição de preço de uma criptomoeda
 * @param {String} elementId - ID do elemento HTML a ser atualizado
 * @param {String} symbol - Símbolo da moeda (ex: BTC/USDT)
 * @param {Number} priceUSDT - Preço em USDT
 */
async function updatePriceDisplay(elementId, symbol, priceUSDT) {
  try {
    const priceBRL = await convertUSDTtoBRL(priceUSDT);
    const html = generatePriceHTML(symbol, priceUSDT, priceBRL);
    
    const element = document.getElementById(elementId);
    if (element) {
      element.innerHTML = html;
    }
  } catch (error) {
    console.error('Erro ao atualizar exibição de preço:', error);
  }
}

/**
 * Atualiza a exibição de preços para múltiplas criptomoedas
 * @param {Array} prices - Array de objetos com symbol e price
 */
async function updateAllPrices(prices) {
  try {
    // Obter taxa de conversão uma única vez para todas as moedas
    const rate = await getUSDToBRLRate();
    
    // Processar cada moeda
    for (const price of prices) {
      const priceBRL = parseFloat((price.price * rate).toFixed(2));
      
      // Atualizar elemento no DOM
      const elementId = `price-${price.symbol.replace('/', '-')}`;
      const element = document.getElementById(elementId);
      
      if (element) {
        const html = generatePriceHTML(price.symbol, price.price, priceBRL);
        element.innerHTML = html;
      }
    }
  } catch (error) {
    console.error('Erro ao atualizar todos os preços:', error);
  }
}

/**
 * Exporta todas as funções do módulo
 */
module.exports = {
  getUSDToBRLRate,
  convertUSDTtoBRL,
  formatPrice,
  generatePriceHTML,
  updatePriceDisplay,
  updateAllPrices
};
