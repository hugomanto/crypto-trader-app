// Aplicativo principal para o Crypto Alert MVP
// Integra a interface com os dados reais

// Constantes para tipos de filtro
const FILTER_TYPES = {
    BUY: 'compra',
    SELL: 'venda',
    MONITORING: 'monitoramento'
};

// Estado global da aplicação
const appState = {
    currentFilter: FILTER_TYPES.BUY,
    lastUpdate: null,
    selectedAlert: null
};

document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM carregado, inicializando aplicativo...');
    
    // Inicialização do app
    initApp();
    
    // Configurar eventos de UI imediatamente
    setupUIEvents();
});

// Função para inicializar o aplicativo
async function initApp() {
    try {
        // Mostrar indicador de carregamento
        showLoadingIndicator();
        
        // Buscar preços atuais - forçar atualização inicial
        const prices = await window.cryptoAPI.forceUpdatePrices();
        console.log('Preços obtidos:', prices);
        
        // Buscar alertas
        const alerts = window.cryptoAPI.fetchAlerts();
        console.log('Alertas obtidos:', alerts);
        
        // Renderizar alertas iniciais (compra por padrão)
        renderAlerts(alerts, appState.currentFilter);
        
        // Atualizar contadores de alertas não lidos
        updateUnreadCounters(alerts);
        
        // Esconder indicador de carregamento
        hideLoadingIndicator();
        
        // Configurar atualização automática a cada 15 segundos (reduzido de 30 para maior frequência)
        setInterval(async () => {
            try {
                // Verificar se a página está visível
                if (document.visibilityState === 'visible') {
                    const updatedPrices = await window.cryptoAPI.fetchCurrentPrices();
                    console.log('Preços atualizados:', updatedPrices);
                    
                    const updatedAlerts = window.cryptoAPI.fetchAlerts();
                    renderAlerts(updatedAlerts, appState.currentFilter);
                    updateUnreadCounters(updatedAlerts);
                    
                    // Atualizar timestamp da última atualização
                    appState.lastUpdate = new Date();
                    
                    // Mostrar notificação de atualização
                    showUpdateNotification();
                }
            } catch (error) {
                console.error('Erro ao atualizar dados:', error);
                showErrorMessage('Falha ao atualizar dados. Tentando novamente...');
            }
        }, 15000); // Reduzido para 15 segundos
        
        // Adicionar listener para visibilidade da página
        document.addEventListener('visibilitychange', handleVisibilityChange);
    } catch (error) {
        console.error('Erro ao inicializar o aplicativo:', error);
        hideLoadingIndicator();
        showErrorMessage('Não foi possível carregar os dados. Tente novamente mais tarde.');
    }
}

// Função para lidar com mudanças de visibilidade da página
function handleVisibilityChange() {
    if (document.visibilityState === 'visible') {
        console.log('Página visível, atualizando dados...');
        // Se a última atualização foi há mais de 30 segundos, atualizar imediatamente
        if (!appState.lastUpdate || (new Date() - appState.lastUpdate) > 30000) {
            refreshData();
        }
    } else {
        console.log('Página em segundo plano, pausando atualizações');
    }
}

// Função para atualizar dados manualmente
async function refreshData() {
    try {
        showLoadingIndicator();
        // Forçar atualização dos preços
        const prices = await window.cryptoAPI.forceUpdatePrices();
        const alerts = window.cryptoAPI.fetchAlerts();
        renderAlerts(alerts, appState.currentFilter);
        updateUnreadCounters(alerts);
        hideLoadingIndicator();
        appState.lastUpdate = new Date();
    } catch (error) {
        console.error('Erro ao atualizar dados:', error);
        hideLoadingIndicator();
        showErrorMessage('Falha ao atualizar dados. Tente novamente.');
    }
}

// Função para configurar eventos de UI
function setupUIEvents() {
    console.log('Configurando eventos de UI...');
    
    // Alternar menu lateral - usando seletor mais específico e garantindo que o elemento existe
    const menuButton = document.querySelector('.menu-button');
    if (menuButton) {
        console.log('Botão de menu encontrado, adicionando evento de clique');
        menuButton.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('Botão de menu clicado');
            toggleSidebar();
        });
    } else {
        console.error('Botão de menu não encontrado!');
    }
    
    // Fechar menu ao clicar no overlay
    const sidebarOverlay = document.querySelector('.sidebar-overlay');
    if (sidebarOverlay) {
        sidebarOverlay.addEventListener('click', toggleSidebar);
    }
    
    // Alternar entre os filtros principais
    const filterButtons = document.querySelectorAll('.filter-button');
    filterButtons.forEach(button => {
        button.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('Botão de filtro clicado:', this.textContent);
            
            // Identificar qual filtro foi clicado
            let filterType = FILTER_TYPES.BUY; // Padrão
            
            if (this.classList.contains('compra')) {
                filterType = FILTER_TYPES.BUY;
            } else if (this.classList.contains('venda')) {
                filterType = FILTER_TYPES.SELL;
            } else if (this.classList.contains('monitoramento')) {
                filterType = FILTER_TYPES.MONITORING;
            }
            
            // Atualizar estado e UI
            updateActiveFilter(filterType);
        });
    });
    
    // Configurar eventos para itens do menu lateral
    setupSidebarMenuEvents();
    
    // Delegação de eventos para cards de alerta
    document.addEventListener('click', function(event) {
        const alertCard = event.target.closest('.alert-card, .monitoring-card');
        if (alertCard) {
            const alertId = alertCard.dataset.id;
            if (alertId) {
                console.log('Card de alerta clicado:', alertId);
                showAlertDetails(alertId);
            }
        }
    });
    
    // Adicionar botão de atualização manual
    const headerTitle = document.querySelector('.header-title');
    if (headerTitle) {
        const refreshButton = document.createElement('button');
        refreshButton.className = 'refresh-button';
        refreshButton.innerHTML = '🔄';
        refreshButton.title = 'Atualizar preços';
        refreshButton.addEventListener('click', function() {
            refreshData();
        });
        headerTitle.parentNode.insertBefore(refreshButton, headerTitle.nextSibling);
    }
}

// Configurar eventos para o menu lateral
function setupSidebarMenuEvents() {
    console.log('Configurando eventos do menu lateral...');
    
    // Evento para o item "Meus Alertas"
    const meusAlertasItem = document.querySelector('.sidebar-menu .menu-item.active');
    if (meusAlertasItem) {
        meusAlertasItem.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('Item Meus Alertas clicado');
            toggleSidebar(); // Fechar o menu
            updateActiveFilter(appState.currentFilter); // Manter o filtro atual
        });
    }
    
    // Eventos para submenu de Compra
    const compraItems = document.querySelectorAll('.menu-category:nth-of-type(1) + .submenu .submenu-item');
    compraItems.forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('Item de submenu Compra clicado:', this.textContent);
            toggleSidebar(); // Fechar o menu
            updateActiveFilter(FILTER_TYPES.BUY);
            // Aqui poderia filtrar por confiança (Forte, Neutra, Baixa)
        });
    });
    
    // Eventos para submenu de Venda
    const vendaItems = document.querySelectorAll('.menu-category:nth-of-type(2) + .submenu .submenu-item');
    vendaItems.forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('Item de submenu Venda clicado:', this.textContent);
            toggleSidebar(); // Fechar o menu
            updateActiveFilter(FILTER_TYPES.SELL);
            // Aqui poderia filtrar por confiança (Forte, Neutra, Baixa)
        });
    });
    
    // Eventos para submenu de Monitoramento
    const monitoramentoItems = document.querySelectorAll('.menu-category:nth-of-type(3) + .submenu .submenu-item');
    monitoramentoItems.forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('Item de submenu Monitoramento clicado:', this.textContent);
            toggleSidebar(); // Fechar o menu
            updateActiveFilter(FILTER_TYPES.MONITORING);
            // Aqui poderia filtrar por tipo de monitoramento
        });
    });
    
    // Eventos para outros itens do menu
    const otherMenuItems = document.querySelectorAll('.sidebar-menu > .menu-item:not(.active)');
    otherMenuItems.forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('Item de menu clicado:', this.textContent);
            toggleSidebar(); // Fechar o menu
            // Aqui poderia navegar para outras páginas (Manual, Configurações, etc.)
            showNotImplementedMessage(item.textContent.trim());
        });
    });
}

// Função para atualizar o filtro ativo
function updateActiveFilter(filterType) {
    console.log('Atualizando filtro ativo para:', filterType);
    
    // Atualizar estado da aplicação
    appState.currentFilter = filterType;
    
    // Atualizar UI - botões de filtro
    const filterButtons = document.querySelectorAll('.filter-button');
    filterButtons.forEach(btn => {
        btn.classList.remove('active');
        
        if ((filterType === FILTER_TYPES.BUY && btn.classList.contains('compra')) ||
            (filterType === FILTER_TYPES.SELL && btn.classList.contains('venda')) ||
            (filterType === FILTER_TYPES.MONITORING && btn.classList.contains('monitoramento'))) {
            btn.classList.add('active');
        }
    });
    
    // Buscar alertas e renderizar com o novo filtro
    const alerts = window.cryptoAPI.fetchAlerts();
    renderAlerts(alerts, filterType);
}

// Função para renderizar alertas
function renderAlerts(alerts, filterType = FILTER_TYPES.BUY) {
    console.log('Renderizando alertas para filtro:', filterType);
    
    const alertsContainer = document.querySelector('.alerts-container');
    if (!alertsContainer) {
        console.error('Container de alertas não encontrado!');
        return;
    }
    
    // Limpar conteúdo atual
    alertsContainer.innerHTML = '';
    
    if (filterType === FILTER_TYPES.MONITORING) {
        // Renderizar visualização de monitoramento (coluna única)
        const monitoringHTML = `
            <div class="monitoring-container">
                <h2 class="monitoring-title">MONITORAMENTO</h2>
                <div class="monitoring-list">
                    ${alerts.monitoring.map(alert => `
                        <div class="monitoring-card ${alert.read ? '' : 'unread'}" data-id="${alert.id}">
                            <div class="alert-symbol">${alert.symbol}</div>
                            <div class="alert-price">$${window.cryptoAPI.formatPrice(alert.price)}</div>
                            <div class="alert-price-brl">${window.cryptoAPI.formatPrice(alert.priceBRL, 'BRL')}</div>
                            ${alert.monitoring_type ? `<div class="monitoring-type">${alert.monitoring_type}</div>` : ''}
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
        alertsContainer.innerHTML = monitoringHTML;
    } else {
        // Renderizar visualização de duas colunas (COMPRA/VENDA)
        // Filtrar alertas com base no tipo selecionado
        let filteredBuyAlerts = alerts.buy;
        let filteredSellAlerts = alerts.sell;
        
        // Se o filtro for específico, mostrar apenas os alertas desse tipo
        if (filterType === FILTER_TYPES.BUY) {
            filteredSellAlerts = [];
        } else if (filterType === FILTER_TYPES.SELL) {
            filteredBuyAlerts = [];
        }
        
        const buyColumn = `
            <div class="alerts-column buy-column">
                <h2 class="column-title">COMPRA</h2>
                <div class="alerts-list">
                    ${filteredBuyAlerts.map(alert => `
                        <div class="alert-card buy ${alert.read ? '' : 'unread'}" data-id="${alert.id}">
                            <div class="alert-symbol">${alert.symbol}</div>
                            <div class="alert-price">$${window.cryptoAPI.formatPrice(alert.price)}</div>
                            <div class="alert-price-brl">${window.cryptoAPI.formatPrice(alert.priceBRL, 'BRL')}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
        
        const sellColumn = `
            <div class="alerts-column sell-column">
                <h2 class="column-title">VENDA</h2>
                <div class="alerts-list">
                    ${filteredSellAlerts.map(alert => `
                        <div class="alert-card sell ${alert.read ? '' : 'unread'}" data-id="${alert.id}">
                            <div class="alert-symbol">${alert.symbol}</div>
                            <div class="alert-price">$${window.cryptoAPI.formatPrice(alert.price)}</div>
                            <div class="alert-price-brl">${window.cryptoAPI.formatPrice(alert.priceBRL, 'BRL')}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
        
        alertsContainer.innerHTML = buyColumn + sellColumn;
    }
}

// Função para atualizar contadores de alertas não lidos
function updateUnreadCounters(alerts) {
    const unreadCounts = {
        buy: alerts.buy.filter(alert => !alert.read).length,
        sell: alerts.sell.filter(alert => !alert.read).length,
        monitoring: alerts.monitoring.filter(alert => !alert.read).length
    };
    
    // Atualizar badges nos botões de filtro
    const compraButton = document.querySelector('.filter-button.compra .badge');
    if (compraButton) compraButton.textContent = unreadCounts.buy;
    
    const vendaButton = document.querySelector('.filter-button.venda .badge');
    if (vendaButton) vendaButton.textContent = unreadCounts.sell;
    
    const monitoramentoButton = document.querySelector('.filter-button.monitoramento .badge');
    if (monitoramentoButton) monitoramentoButton.textContent = unreadCounts.monitoring;
}

// Função para mostrar detalhes do alerta
function showAlertDetails(alertId) {
    console.log('Mostrando detalhes do alerta:', alertId);
    
    // Marcar alerta como lido
    window.cryptoAPI.markAlertAsRead(alertId).then(() => {
        // Atualizar UI para refletir que o alerta foi lido
        const alertCard = document.querySelector(`.alert-card[data-id="${alertId}"], .monitoring-card[data-id="${alertId}"]`);
        if (alertCard) {
            alertCard.classList.remove('unread');
        }
        
        // Atualizar contadores
        const alerts = window.cryptoAPI.fetchAlerts();
        updateUnreadCounters(alerts);
        
        // Encontrar o alerta específico
        let selectedAlert = null;
        const allAlerts = [
            ...alerts.buy,
            ...alerts.sell,
            ...alerts.monitoring
        ];
        
        selectedAlert = allAlerts.find(alert => alert.id.toString() === alertId.toString());
        
        if (selectedAlert) {
            // Armazenar o alerta selecionado no estado
            appState.selectedAlert = selectedAlert;
            
            // Criar e mostrar o modal com detalhes
            showAlertModalDetalhado(selectedAlert);
        }
    });
}

// Função para alternar o menu lateral
function toggleSidebar() {
    console.log('Alternando visibilidade do menu lateral');
    
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    
    if (sidebar && overlay) {
        sidebar.classList.toggle('active');
        overlay.classList.toggle('active');
    }
}

// Função para mostrar indicador de carregamento
function showLoadingIndicator() {
    console.log('Mostrando indicador de carregamento');
    
    // Verificar se já existe um indicador
    let loadingIndicator = document.querySelector('.loading-indicator');
    
    if (!loadingIndicator) {
        // Criar indicador de carregamento
        loadingIndicator = document.createElement('div');
        loadingIndicator.className = 'loading-indicator';
        loadingIndicator.innerHTML = `
            <div class="loading-spinner"></div>
            <div class="loading-text">Carregando...</div>
        `;
        document.body.appendChild(loadingIndicator);
    }
    
    // Mostrar indicador
    loadingIndicator.style.display = 'flex';
}

// Função para esconder indicador de carregamento
function hideLoadingIndicator() {
    console.log('Escondendo indicador de carregamento');
    
    const loadingIndicator = document.querySelector('.loading-indicator');
    if (loadingIndicator) {
        loadingIndicator.style.display = 'none';
    }
}

// Função para mostrar mensagem de erro
function showErrorMessage(message) {
    console.error('Erro:', message);
    
    // Criar elemento de mensagem
    const errorMessage = document.createElement('div');
    errorMessage.className = 'error-message';
    errorMessage.textContent = message;
    
    // Adicionar à página
    document.body.appendChild(errorMessage);
    
    // Remover após 5 segundos
    setTimeout(() => {
        errorMessage.remove();
    }, 5000);
}

// Função para mostrar notificação de atualização
function showUpdateNotification() {
    console.log('Mostrando notificação de atualização');
    
    // Criar elemento de notificação
    const notification = document.createElement('div');
    notification.className = 'update-notification';
    notification.textContent = 'Dados atualizados';
    
    // Adicionar à página
    document.body.appendChild(notification);
    
    // Remover após 3 segundos
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

// Função para mostrar mensagem de funcionalidade não implementada
function showNotImplementedMessage(feature) {
    console.log(`Funcionalidade não implementada: ${feature}`);
    
    // Criar elemento de mensagem
    const message = document.createElement('div');
    message.className = 'not-implemented-message';
    message.textContent = `A funcionalidade "${feature}" ainda não está implementada nesta versão.`;
    
    // Adicionar à página
    document.body.appendChild(message);
    
    // Remover após 5 segundos
    setTimeout(() => {
        message.remove();
    }, 5000);
}

// Função para mostrar modal com detalhes do alerta
function showAlertModalDetalhado(alert) {
    console.log('Mostrando modal detalhado para alerta:', alert);
    
    // Verificar se o módulo de detalhes está disponível
    if (typeof window.showModalDetalhes === 'function') {
        window.showModalDetalhes(alert);
        return;
    }
    
    // Implementação padrão caso o módulo não esteja disponível
    // Determinar tipo de alerta
    let alertType = '';
    if (alert.monitoring_type) {
        alertType = 'Monitoramento';
    } else {
        // Verificar em qual lista o alerta está
        const alerts = window.cryptoAPI.fetchAlerts();
        if (alerts.buy.some(a => a.id === alert.id)) {
            alertType = 'Compra';
        } else if (alerts.sell.some(a => a.id === alert.id)) {
            alertType = 'Venda';
        }
    }
    
    // Criar modal
    const modalOverlay = document.createElement('div');
    modalOverlay.className = 'modal-overlay';
    
    // Determinar níveis de suporte e resistência simulados
    const currentPrice = alert.price;
    const support = (currentPrice * 0.95).toFixed(2);
    const resistance = (currentPrice * 1.05).toFixed(2);
    
    // Calcular stop loss e alvo com base no tipo de alerta
    let stopLoss, target;
    if (alertType === 'Compra') {
        stopLoss = (currentPrice * 0.97).toFixed(2);
        target = (currentPrice * 1.05).toFixed(2);
    } else if (alertType === 'Venda') {
        stopLoss = (currentPrice * 1.03).toFixed(2);
        target = (currentPrice * 0.95).toFixed(2);
    } else {
        stopLoss = support;
        target = resistance;
    }
    
    // Calcular lucro estimado
    const estimatedProfit = alertType === 'Compra' 
        ? ((target - currentPrice) / currentPrice * 100).toFixed(2)
        : ((currentPrice - target) / currentPrice * 100).toFixed(2);
    
    // Obter RSI do alerta ou calcular um valor simulado
    const rsi = alert.rsi || Math.floor(Math.random() * 100);
    
    // Criar conteúdo do modal
    modalOverlay.innerHTML = `
        <div class="modal-content">
            <div class="modal-header ${alertType.toLowerCase()}">
                <h2>${alert.symbol} - ${alertType}</h2>
                <button class="modal-close">&times;</button>
            </div>
            <div class="modal-body">
                <div class="price-section">
                    <div class="current-price">
                        <span class="label">Preço Atual:</span>
                        <span class="value">$${window.cryptoAPI.formatPrice(alert.price)}</span>
                    </div>
                    <div class="current-price-brl">
                        <span class="label">Preço em Reais:</span>
                        <span class="value">${window.cryptoAPI.formatPrice(alert.priceBRL, 'BRL')}</span>
                    </div>
                </div>
                
                <div class="levels-section">
                    <h3>Níveis de Preço</h3>
                    <div class="level-item">
                        <span class="label">Suporte:</span>
                        <span class="value">$${support}</span>
                    </div>
                    <div class="level-item">
                        <span class="label">Resistência:</span>
                        <span class="value">$${resistance}</span>
                    </div>
                    <div class="level-item">
                        <span class="label">Stop Loss:</span>
                        <span class="value">$${stopLoss}</span>
                    </div>
                    <div class="level-item">
                        <span class="label">Alvo:</span>
                        <span class="value">$${target}</span>
                    </div>
                </div>
                
                <div class="indicators-section">
                    <h3>Indicadores Técnicos</h3>
                    <div class="indicator-item">
                        <span class="label">RSI:</span>
                        <span class="value">${rsi}</span>
                    </div>
                    <div class="indicator-item">
                        <span class="label">MACD:</span>
                        <span class="value">${alertType === 'Compra' ? 'Positivo (0.25)' : 'Negativo (-0.15)'}</span>
                    </div>
                    <div class="indicator-item">
                        <span class="label">Volume:</span>
                        <span class="value">+35% (acima da média)</span>
                    </div>
                    <div class="indicator-item">
                        <span class="label">Lucro Estimado:</span>
                        <span class="value">${estimatedProfit}%</span>
                    </div>
                </div>
                
                <div class="analysis-section">
                    <h3>Análise Detalhada</h3>
                    <p>
                        ${getDetailedAnalysis(alert, alertType, rsi)}
                    </p>
                    <p>
                        <strong>Período Analisado:</strong> Últimos 7 dias (velas de 4 horas)
                    </p>
                </div>
            </div>
            <div class="modal-footer">
                <button class="modal-close-btn">Fechar</button>
            </div>
        </div>
    `;
    
    // Adicionar modal ao DOM
    document.body.appendChild(modalOverlay);
    
    // Configurar eventos
    const closeButton = modalOverlay.querySelector('.modal-close');
    const closeBtn = modalOverlay.querySelector('.modal-close-btn');
    
    closeButton.addEventListener('click', () => {
        modalOverlay.remove();
    });
    
    closeBtn.addEventListener('click', () => {
        modalOverlay.remove();
    });
    
    // Fechar ao clicar fora do modal
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) {
            modalOverlay.remove();
        }
    });
}

// Função para gerar análise detalhada com base no tipo de alerta e RSI
function getDetailedAnalysis(alert, alertType, rsi) {
    if (alertType === 'Compra') {
        return `
            ${alert.symbol} apresenta uma forte tendência de alta, com RSI em ${rsi} indicando momentum positivo. 
            As médias móveis de 20 e 50 períodos formaram um cruzamento de alta (Golden Cross), 
            e o volume de negociação está acima da média dos últimos 7 dias.
            
            O preço rompeu a resistência anterior e está formando um padrão de continuação. 
            Recomendamos entrada na zona atual com stop loss em $${(alert.price * 0.97).toFixed(2)} 
            e primeiro alvo em $${(alert.price * 1.05).toFixed(2)}.
            
            As velas recentes mostram um padrão de Engolfo de Alta, reforçando a probabilidade de continuação do movimento.
        `;
    } else if (alertType === 'Venda') {
        return `
            ${alert.symbol} mostra sinais de esgotamento da tendência de alta, com RSI em ${rsi} indicando possível reversão. 
            As médias móveis de 20 e 50 períodos formaram um cruzamento de baixa (Death Cross), 
            e o volume de negociação está diminuindo durante os movimentos de alta.
            
            O preço testou a resistência várias vezes sem conseguir rompê-la, formando um padrão de topo duplo. 
            Recomendamos entrada na zona atual com stop loss em $${(alert.price * 1.03).toFixed(2)} 
            e primeiro alvo em $${(alert.price * 0.95).toFixed(2)}.
            
            As velas recentes mostram um padrão de Estrela Cadente, reforçando a probabilidade de reversão do movimento.
        `;
    } else if (alert.monitoring_type === 'Próximo ao Suporte') {
        return `
            ${alert.symbol} está se aproximando de um nível importante de suporte em $${(alert.price * 0.95).toFixed(2)}. 
            Este nível foi testado 3 vezes nos últimos 30 dias e tem se mostrado uma zona de reação.
            
            O RSI em ${rsi} indica que o ativo está ${rsi < 30 ? 'sobrevendido' : 'próximo de condição de sobrevenda'}, 
            o que aumenta a probabilidade de reação positiva ao tocar o suporte.
            
            Recomendamos monitorar atentamente para possível oportunidade de compra caso o preço reaja positivamente 
            ao tocar este nível, com confirmação de padrões de reversão nas velas.
        `;
    } else if (alert.monitoring_type === 'Próximo à Resistência') {
        return `
            ${alert.symbol} está se aproximando de um nível importante de resistência em $${(alert.price * 1.05).toFixed(2)}. 
            Este nível foi testado 2 vezes nos últimos 30 dias e tem se mostrado uma zona de rejeição.
            
            O RSI em ${rsi} indica que o ativo está ${rsi > 70 ? 'sobrecomprado' : 'próximo de condição de sobrecompra'}, 
            o que aumenta a probabilidade de rejeição ao tocar a resistência.
            
            Recomendamos monitorar atentamente para possível oportunidade de venda caso o preço reaja negativamente 
            ao tocar este nível, com confirmação de padrões de reversão nas velas.
        `;
    } else {
        return `
            ${alert.symbol} está em uma fase de consolidação, oscilando entre o suporte em $${(alert.price * 0.95).toFixed(2)} 
            e a resistência em $${(alert.price * 1.05).toFixed(2)}.
            
            O RSI em ${rsi} indica condição neutra, sem sinais claros de sobrecompra ou sobrevenda.
            
            Recomendamos monitorar os níveis de suporte e resistência para possíveis oportunidades de entrada 
            quando o preço reagir a estes níveis com confirmação de padrões de velas.
        `;
    }
}
