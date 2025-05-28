# Crypto Alert - Código Completo

## Visão Geral

O Crypto Alert é uma aplicação web que exibe alertas de compra e venda de criptomoedas, com preços atualizados em tempo real através de múltiplas APIs externas. O aplicativo foi desenvolvido seguindo o design aprovado e está disponível publicamente em https://bnrvhxwc.manus.space.

## Estrutura do Projeto

O projeto consiste nos seguintes arquivos principais:

- **index.html**: Estrutura HTML principal da aplicação
- **styles.css**: Estilos CSS conforme o design aprovado
- **api.js**: Integração com APIs externas (Binance, CryptoCompare, CoinGecko)
- **app.js**: Lógica da aplicação e renderização dinâmica

## Como Executar Localmente

1. Clone ou extraia todos os arquivos para uma pasta local
2. Abra o arquivo `index.html` diretamente no navegador
   - Não é necessário servidor web para executar a aplicação
   - Todos os recursos são carregados localmente ou de CDNs públicas

## Funcionalidades Implementadas

1. **Integração com APIs Reais**
   - Conexão com Binance (fonte primária)
   - Fallback para CryptoCompare e CoinGecko
   - Sistema de dados simulados como último recurso

2. **Interface Conforme Design Aprovado**
   - Tema escuro com fundo cinza (#212529)
   - Layout centralizado com largura limitada
   - Visualização em duas colunas (COMPRA/VENDA)
   - Filtros coloridos (azul para Compra, vermelho para Venda, roxo para Monitoramento)

3. **Sistema de Alertas**
   - Divisão entre alertas de COMPRA e VENDA
   - Seção especial para MONITORAMENTO
   - Indicadores visuais para alertas não lidos

4. **Atualização Automática**
   - Preços atualizados a cada 30 segundos
   - Pausa automática quando a aba está em segundo plano
   - Retomada automática quando o usuário volta para a aba

## Problemas Conhecidos e Soluções

### Filtros não funcionando corretamente

Os filtros de categoria (Compra, Venda, Monitoramento) podem não estar funcionando como esperado. Para corrigir:

1. Verifique a função `setupUIEvents()` no arquivo `app.js`
2. Confirme que os seletores CSS estão corretos para os botões de filtro
3. Verifique se a função `renderAlerts()` está recebendo o tipo de filtro correto

### Possíveis melhorias nos filtros

Para melhorar a funcionalidade dos filtros:

1. Adicione constantes para os tipos de filtro em vez de strings literais
2. Implemente filtros adicionais para nível de confiança (Forte, Neutra, Baixa)
3. Adicione persistência local para lembrar o último filtro selecionado

## Como Fazer Deploy

Para fazer deploy da aplicação:

1. Copie todos os arquivos para um servidor web estático
2. Ou utilize serviços como Netlify, Vercel ou GitHub Pages
3. Não são necessárias configurações especiais de servidor

## Contato e Suporte

Se precisar de ajuda adicional ou tiver dúvidas sobre o código, entre em contato.
