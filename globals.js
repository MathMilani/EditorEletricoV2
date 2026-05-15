// Inicialização do Canvas
const canvas = new fabric.Canvas('planta-canvas', { width: 800, height: 600, selection: true, fireMiddleClick: true });

// Variáveis Globais de Estado
let listaConduites = [];
let modoConduite = null;
let objConexaoOrigem = null;
let objetoSendoEditado = null;
let escalaGlobalSímbolos = 1;
let isPanning = false; 
let lastPosX, lastPosY;

// Dicionário de Símbolos SVG
const bibliotecaSimbologia = {
    'Tomada Baixa': { normal: `<svg width="40" height="40" viewBox="0 0 100 100"><polygon points="50,20 80,60 20,60" fill="white" stroke="black" stroke-width="3"/><line x1="50" y1="60" x2="50" y2="90" stroke="black" stroke-width="3"/></svg>`, alta: `<svg width="40" height="40" viewBox="0 0 100 100"><circle cx="50" cy="46" r="35" fill="white" stroke="black" stroke-width="3" /><polygon points="50,20 80,60 20,60" fill="none" stroke="black" stroke-width="3"/><line x1="50" y1="60" x2="50" y2="90" stroke="black" stroke-width="3"/></svg>` },
    'Tomada Média': { normal: `<svg width="40" height="40" viewBox="0 0 100 100"><polygon points="50,20 80,60 50,60" fill="black" stroke="black" stroke-width="3"/><polygon points="50,20 20,60 50,60" fill="white" stroke="black" stroke-width="3"/><line x1="50" y1="60" x2="50" y2="90" stroke="black" stroke-width="3"/></svg>`, alta: `<svg width="40" height="40" viewBox="0 0 100 100"><circle cx="50" cy="46" r="35" fill="white" stroke="black" stroke-width="3" /><polygon points="50,20 80,60 50,60" fill="black" stroke="black" stroke-width="3"/><polygon points="50,20 20,60 50,60" fill="none" stroke="black" stroke-width="3"/><line x1="50" y1="60" x2="50" y2="90" stroke="black" stroke-width="3"/></svg>` },
    'Tomada Alta': { normal: `<svg width="40" height="40" viewBox="0 0 100 100"><polygon points="50,20 80,60 20,60" fill="black" stroke="black" stroke-width="3"/><line x1="50" y1="60" x2="50" y2="90" stroke="black" stroke-width="3"/></svg>`, alta: `<svg width="40" height="40" viewBox="0 0 100 100"><circle cx="50" cy="46" r="35" fill="white" stroke="black" stroke-width="3" /><polygon points="50,20 80,60 20,60" fill="black" stroke="black" stroke-width="3"/><line x1="50" y1="60" x2="50" y2="90" stroke="black" stroke-width="3"/></svg>` },
    'Lâmpada Teto': { normal: `<svg width="40" height="40" viewBox="0 0 100 100"><circle cx="50" cy="50" r="45" fill="white" stroke="black" stroke-width="3"/><line x1="5" y1="50" x2="95" y2="50" stroke="black" stroke-width="3"/></svg>`, alta: `` },
    'Interruptor Simples': { normal: `<svg width="40" height="40" viewBox="0 0 100 100"><rect width="100" height="100" fill="transparent"/><text x="50" y="75" font-size="70" font-family="Arial" text-anchor="middle" fill="black">S</text></svg>`, alta: `` },
    'Interruptor Paralelo': { normal: `<svg width="40" height="40" viewBox="0 0 100 100"><rect width="100" height="100" fill="transparent"/><text x="50" y="70" font-size="60" font-family="Arial" text-anchor="middle" fill="black">SP</text></svg>`, alta: `` },
    'Interruptor Intermediário': { normal: `<svg width="40" height="40" viewBox="0 0 100 100"><rect width="100" height="100" fill="transparent"/><text x="50" y="70" font-size="60" font-family="Arial" text-anchor="middle" fill="black">SI</text></svg>`, alta: `` },
    'Quadro de Distribuição': { normal: `<svg width="40" height="40" viewBox="0 0 100 100"><rect x="5" y="10" width="90" height="80" fill="white" stroke="black" stroke-width="3"/><line x1="5" y1="10" x2="95" y2="90" stroke="black" stroke-width="3"/><polygon points="5,10 5,90 95,90" fill="black"/></svg>`, alta: `` }
};

// Responsividade da tela
window.addEventListener('resize', () => {
    canvas.setWidth(document.getElementById('canvas-wrapper').clientWidth);
    canvas.setHeight(document.getElementById('canvas-wrapper').clientHeight);
    canvas.renderAll();
});
window.dispatchEvent(new Event('resize'));