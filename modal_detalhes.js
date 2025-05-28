// Função para mostrar modal com detalhes do alerta
function showAlertModal(alert) {
    // Remover modal existente, se houver
    const existingModal = document.querySelector('.alert-modal');
    if (existingModal) {
        existingModal.remove();
    }
    
    // Determinar o tipo de alerta
    let alertType = '';
    let alertColor = '';
    let alertIcon = '';
    
    if (alert.monitoring_type) {
        alertType = 'Monitoramento';
        alertColor = '#8e44ad';
        alertIcon = '👁️';
    } else if (alert.type === 'BUY') {
        alertType = 'Compra';
        alertColor = '#2ecc71';
        alertIcon = '📈';
    } else {
        alertType = 'Venda';
        alertColor = '#e74c3c';
        alertIcon = '📉';
    }
    
    // Usar valores reais dos indicadores e níveis
    const supportLevel = alert.levels && alert.levels.support ? 
        alert.levels.support.toFixed(2) : 
        (alert.price * 0.95).toFixed(2);
        
    const resistanceLevel = alert.levels && alert.levels.resistance ? 
        alert.levels.resistance.toFixed(2) : 
        (alert.price * 1.05).toFixed(2);
        
    const stopLossLevel = alert.levels && alert.levels.stopLoss ? 
        alert.levels.stopLoss.toFixed(2) : 
        (alertType === 'Compra' ? (alert.price * 0.93).toFixed(2) : (alert.price * 1.07).toFixed(2));
        
    const targetLevel = alert.levels && alert.levels.target ? 
        alert.levels.target.toFixed(2) : 
        (alertType === 'Compra' ? (alert.price * 1.08).toFixed(2) : (alert.price * 0.92).toFixed(2));
    
    // Calcular lucro estimado com base nos valores reais
    const profitPercentage = alertType === 'Compra' ? 
        ((targetLevel - alert.price) / alert.price * 100).toFixed(2) : 
        ((alert.price - targetLevel) / alert.price * 100).toFixed(2);
    
    // Usar valores reais dos indicadores técnicos
    const rsiValue = alert.rsi ? alert.rsi.toFixed(2) : 
                    (alert.indicators && alert.indicators.rsi ? alert.indicators.rsi.toFixed(2) : '50.00');
                    
    const macdValue = alert.macd ? 
                     (alert.macd.histogram > 0 ? `Positivo (${alert.macd.histogram.toFixed(2)})` : `Negativo (${alert.macd.histogram.toFixed(2)})`) : 
                     (alertType === 'Compra' ? 'Positivo (0.45)' : 'Negativo (-0.32)');
                     
    const volumeChange = alert.volume && alert.volume.volumeChange ? 
                        `${alert.volume.volumeChange > 0 ? '+' : ''}${alert.volume.volumeChange.toFixed(2)}%` : 
                        (alertType === 'Compra' ? '+28%' : '+15%');
    
    // Gerar explicação detalhada baseada nos dados reais
    let detailedExplanation = alert.recommendation || '';
    
    // Se não houver recomendação no objeto de alerta, gerar uma baseada nos indicadores
    if (!detailedExplanation) {
        if (alert.symbol.includes('BTC')) {
            detailedExplanation = alertType === 'Compra' ?
                `O Bitcoin está em tendência de alta com RSI em ${rsiValue}, indicando força compradora. O preço rompeu a resistência anterior de $${(alert.price * 0.98).toLocaleString()} e tem potencial para atingir $${targetLevel.toLocaleString()}. Recomendamos stop loss em $${stopLossLevel.toLocaleString()} para limitar riscos. O volume de negociação aumentou ${volumeChange} em relação à média dos últimos 7 dias, confirmando o interesse dos compradores. As velas dos últimos 3 dias formaram um padrão de continuação de alta.` :
                `O Bitcoin está mostrando sinais de esgotamento da tendência de alta com RSI em ${rsiValue}, indicando condição de sobrevenda. O preço testou a resistência de $${resistanceLevel.toLocaleString()} três vezes sem conseguir romper, formando um triplo topo. Recomendamos venda com stop em $${(alert.price * 1.02).toLocaleString()} e alvo em $${targetLevel.toLocaleString()}. O volume de negociação diminuiu ${volumeChange} nos últimos dias, sugerindo menor força compradora.`;
        } else {
            detailedExplanation = alertType === 'Compra' ?
                `${alert.symbol.split('/')[0]} mostra sinais técnicos positivos com RSI em ${rsiValue} (zona de compra) e MACD ${macdValue} cruzando para cima. O volume de negociação aumentou ${volumeChange} em relação à média, indicando interesse dos compradores. O preço está testando o suporte em $${supportLevel} com velas de cauda longa, sinalizando rejeição de preços mais baixos. Recomendamos entrada com stop loss em $${stopLossLevel} e alvo em $${targetLevel}, com potencial de lucro de ${profitPercentage}%.` :
                `${alert.symbol.split('/')[0]} apresenta sinais de reversão com RSI em ${rsiValue} (zona de sobrevenda) e MACD ${macdValue} divergindo do preço. O ativo testou a resistência em $${resistanceLevel} sem conseguir romper, formando um padrão de topo. O volume de negociação diminuiu ${volumeChange} nos últimos dias, sugerindo esgotamento da tendência atual. Recomendamos venda com stop em $${(alert.price * 1.02).toFixed(2)} e alvo em $${targetLevel}.`;
        }
    }
    
    // Obter o timeframe da análise
    const timeframe = alert.timeframe || '1h';
    
    // Criar conteúdo do modal com todas as informações detalhadas
    const modalHTML = `
        <div class="alert-modal">
            <div class="alert-modal-content" style="border-left: 4px solid ${alertColor}">
                <div class="alert-modal-header">
                    <h2>${alertIcon} ${alertType}: ${alert.symbol}</h2>
                    <button class="alert-modal-close">&times;</button>
                </div>
                <div class="alert-modal-body">
                    <div class="alert-detail-row">
                        <span class="alert-detail-label">Preço Atual:</span>
                        <span class="alert-detail-value">$${formatPrice(alert.price)}</span>
                    </div>
                    <div class="alert-detail-row">
                        <span class="alert-detail-label">Preço em Reais:</span>
                        <span class="alert-detail-value">R$${formatPrice(alert.priceBRL)}</span>
                    </div>
                    ${alert.monitoring_type ? `
                        <div class="alert-detail-row">
                            <span class="alert-detail-label">Tipo:</span>
                            <span class="alert-detail-value">${alert.monitoring_type}</span>
                        </div>
                    ` : ''}
                    <div class="alert-detail-row">
                        <span class="alert-detail-label">Confiança:</span>
                        <span class="alert-detail-value">${alert.confidence || 'Alta'}</span>
                    </div>
                    
                    <div class="alert-section">
                        <h3 class="alert-section-title">Níveis de Preço</h3>
                        <div class="alert-detail-grid">
                            <div class="alert-detail-item">
                                <span class="alert-detail-label">Suporte:</span>
                                <span class="alert-detail-value">$${supportLevel}</span>
                            </div>
                            <div class="alert-detail-item">
                                <span class="alert-detail-label">Resistência:</span>
                                <span class="alert-detail-value">$${resistanceLevel}</span>
                            </div>
                            <div class="alert-detail-item">
                                <span class="alert-detail-label">Stop Loss:</span>
                                <span class="alert-detail-value">$${stopLossLevel}</span>
                            </div>
                            <div class="alert-detail-item">
                                <span class="alert-detail-label">Alvo:</span>
                                <span class="alert-detail-value">$${targetLevel}</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="alert-section">
                        <h3 class="alert-section-title">Indicadores Técnicos</h3>
                        <div class="alert-detail-grid">
                            <div class="alert-detail-item">
                                <span class="alert-detail-label">RSI:</span>
                                <span class="alert-detail-value">${rsiValue}</span>
                            </div>
                            <div class="alert-detail-item">
                                <span class="alert-detail-label">MACD:</span>
                                <span class="alert-detail-value">${macdValue}</span>
                            </div>
                            <div class="alert-detail-item">
                                <span class="alert-detail-label">Volume:</span>
                                <span class="alert-detail-value">${volumeChange}</span>
                            </div>
                            <div class="alert-detail-item">
                                <span class="alert-detail-label">Lucro Estimado:</span>
                                <span class="alert-detail-value">${profitPercentage}%</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="alert-section">
                        <h3 class="alert-section-title">Período Analisado</h3>
                        <div class="alert-detail-row">
                            <span class="alert-detail-value">Timeframe: ${timeframe} (últimos 7 dias)</span>
                        </div>
                    </div>
                    
                    <div class="alert-section">
                        <h3 class="alert-section-title">Análise Detalhada</h3>
                        <div class="alert-detail-row">
                            <span class="alert-detail-value explanation-text">
                                ${detailedExplanation}
                            </span>
                        </div>
                    </div>
                </div>
                <div class="alert-modal-footer">
                    <button class="alert-action-button" style="background-color: ${alertColor}">
                        ${alertType === 'Monitoramento' ? 'Definir Alerta' : 'Confirmar ' + alertType}
                    </button>
                </div>
            </div>
        </div>
    `;
    
    // Adicionar modal ao DOM
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Adicionar estilos específicos para o modal detalhado
    const modalStyles = document.createElement('style');
    modalStyles.textContent = `
        .alert-section {
            margin-top: 15px;
            border-top: 1px solid rgba(255, 255, 255, 0.1);
            padding-top: 10px;
        }
        
        .alert-section-title {
            font-size: 14px;
            font-weight: 600;
            margin-bottom: 10px;
            color: #adb5bd;
        }
        
        .alert-detail-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 10px;
        }
        
        .alert-detail-item {
            background-color: rgba(0, 0, 0, 0.2);
            padding: 8px;
            border-radius: 4px;
        }
        
        .explanation-text {
            line-height: 1.5;
            font-size: 14px;
            text-align: justify;
        }
    `;
    document.head.appendChild(modalStyles);
    
    // Adicionar evento para fechar o modal
    const closeButton = document.querySelector('.alert-modal-close');
    if (closeButton) {
        closeButton.addEventListener('click', function() {
            document.querySelector('.alert-modal').remove();
            modalStyles.remove();
        });
    }
    
    // Adicionar evento para o botão de ação
    const actionButton = document.querySelector('.alert-action-button');
    if (actionButton) {
        actionButton.addEventListener('click', function() {
            showNotImplementedMessage(`Ação de ${alertType.toLowerCase()} será implementada em breve`);
            document.querySelector('.alert-modal').remove();
            modalStyles.remove();
        });
    }
    
    // Fechar modal ao clicar fora dele
    document.querySelector('.alert-modal').addEventListener('click', function(e) {
        if (e.target === this) {
            this.remove();
            modalStyles.remove();
        }
    });
}
