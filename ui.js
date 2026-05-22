// ui.js - GESTÃO DE EVENTOS DE INTERFACE E CANVAS

function addEvent(id, evento, callback) {
    const el = document.getElementById(id);
    if (el) el.addEventListener(evento, callback);
}

const styleFix = document.createElement('style');
styleFix.innerHTML = `
    #btn-conduite-subterraneo.ativo { background-color: #27ae60 !important; color: white !important; border-color: #2ecc71 !important; }
`;
document.head.appendChild(styleFix);

['layer-quadros', 'layer-tomadas', 'layer-iluminacao', 'layer-conduites', 'layer-fiacao'].forEach(id => {
    addEvent(id, 'change', applyLayersVisibility);
});

addEvent('conf-has-chamada', 'change', e => {
    const container = document.getElementById('chamada-cor-container');
    if(container) container.style.display = e.target.checked ? 'block' : 'none';
});

const layersContainer = document.querySelector('.layers-container');
if (layersContainer) {
    const filterDiv = document.createElement('div');
    filterDiv.style.marginTop = '15px'; filterDiv.style.paddingTop = '15px'; filterDiv.style.borderTop = '1px solid #ccc';
    filterDiv.innerHTML = `
        <div style="font-size: 13px; font-weight: bold; margin-bottom: 5px; color: #2c3e50;">🔍 Filtrar Fiação por Circuito:</div>
        <input type="text" id="filtro-circuito" placeholder="Ex: 1, 2, A..." style="width: 100%; padding: 6px; border: 1px solid #bdc3c7; border-radius: 4px; box-sizing: border-box; font-family: Arial;">
        <button id="btn-limpar-filtro" style="margin-top: 8px; width: 100%; padding: 6px; background: #e74c3c; color: white; border: none; border-radius: 4px; cursor: pointer; display: none; font-weight: bold;">Limpar Filtro</button>
    `;
    layersContainer.appendChild(filterDiv);

    addEvent('filtro-circuito', 'input', (e) => {
        circuitoFiltroGlobal = e.target.value.trim();
        const btn = document.getElementById('btn-limpar-filtro');
        if(btn) btn.style.display = circuitoFiltroGlobal ? 'block' : 'none';
        atualizarPosicaoConduites(); applyLayersVisibility(); 
    });

    addEvent('btn-limpar-filtro', 'click', () => {
        const input = document.getElementById('filtro-circuito');
        if(input) input.value = ''; circuitoFiltroGlobal = '';
        document.getElementById('btn-limpar-filtro').style.display = 'none';
        atualizarPosicaoConduites(); applyLayersVisibility();
    });
}

function desativarModoConduite() {
    modoConduite = null; objConexaoOrigem = null;
    const btnCurvo = document.getElementById('btn-conduite-curvo');
    const btnReto = document.getElementById('btn-conduite-reto');
    const btnSub = document.getElementById('btn-conduite-subterraneo');
    if (btnCurvo) btnCurvo.classList.remove('ativo');
    if (btnReto) btnReto.classList.remove('ativo');
    if (btnSub) btnSub.classList.remove('ativo');
    if (typeof canvas !== 'undefined') { canvas.discardActiveObject(); canvas.renderAll(); }
}

function toggleModoConduite(modoSelecionado, btn) {
    if (modoConduite === modoSelecionado) { desativarModoConduite(); } 
    else { desativarModoConduite(); modoConduite = modoSelecionado; btn.classList.add('ativo'); }
}

addEvent('btn-conduite-curvo', 'click', function() { toggleModoConduite('curvo', this); });
addEvent('btn-conduite-reto', 'click', function() { toggleModoConduite('reto', this); });
addEvent('btn-conduite-subterraneo', 'click', function() { toggleModoConduite('subterraneo', this); });

addEvent('btn-add-circuito', 'click', () => { addCircuitoDOM(); });
addEvent('reset-view-btn', 'click', () => { canvas.setZoom(1); canvas.viewportTransform = [1, 0, 0, 1, 0, 0]; canvas.renderAll(); });
addEvent('btn-cancelar', 'click', () => { document.getElementById('modal-overlay').style.display = 'none'; objetoSendoEditado = null; });

const symbols = document.querySelectorAll('.symbol-container');
symbols.forEach(symbol => { symbol.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/plain', symbol.getAttribute('data-type')); }); });
const canvasContainer = document.querySelector('.canvas-container');
if (canvasContainer) {
    canvasContainer.addEventListener('dragover', (e) => e.preventDefault());
    canvasContainer.addEventListener('drop', (e) => {
        e.preventDefault(); const tipoSimbolo = e.dataTransfer.getData('text/plain');
        if (tipoSimbolo) { const pointer = canvas.getPointer(e); inserirOuAtualizarSimbolo({ tipo: tipoSimbolo, x: pointer.x, y: pointer.y, escala: escalaGlobalSímbolos, angulo: 0 }); }
    });
}

const fileInputPlanta = document.getElementById('upload-planta');
if (fileInputPlanta) {
    fileInputPlanta.addEventListener('change', function(e) {
        const file = e.target.files[0]; if (!file) return;
        const reader = new FileReader(); 
        reader.onload = function(f) {
            fabric.Image.fromURL(f.target.result, function(img) {
                if (!img) { alert("Erro ao ler o arquivo."); return; }
                const pText = document.getElementById('placeholder-text'); if (pText) pText.style.display = 'none';
                const cw = canvas.getWidth(); const ch = canvas.getHeight(); const scale = Math.min(cw / img.width, ch / img.height);
                img.set({ originX: 'center', originY: 'center', left: cw / 2, top: ch / 2, scaleX: scale * 0.9, scaleY: scale * 0.9, selectable: false, evented: false });
                canvas.setZoom(1); canvas.viewportTransform = [1, 0, 0, 1, 0, 0];
                canvas.setBackgroundImage(img, canvas.renderAll.bind(canvas)); fileInputPlanta.value = ""; 
            });
        }; reader.readAsDataURL(file);
    });
}

canvas.on('object:modified', function(e) {
    const obj = e.target;
    if (obj && obj.tipoEquipamento) {
        escalaGlobalSímbolos = obj.scaleX;
        if (obj.type === 'group') {
            let nA = obj.angle % 360; if (nA < 0) nA += 360; const isUD = (Math.round(nA) === 180);
            obj._objects.filter(o => o.type === 'text').forEach(t => { t.set('angle', isUD ? 180 : 0); });
            obj.setCoords(); canvas.requestRenderAll();
        }
    }
    atualizarPosicaoConduites();
});

// MOTOR DE ARRASTO: Controla o deslizamento tanto das chamadas elétricas quanto do Anchor de Árvore Azul
canvas.on('object:moving', function(e) {
    const obj = e.target;
    if (!obj) return;

    // NOVO: Arrasto dinâmico da nova âncora azul de ramificações curvas/subterrâneas
    if (obj.isBranchAnchor) {
        const c = obj.conduitRef;
        const p1 = getTrueCenter(c.origem);
        const p2 = c.destino.isConduiteHitbox ? getTrueCenter(c.destino.conduitRef.origem) : getTrueCenter(c.destino);
        const parentC = c.destino.conduitRef;

        let bestT = c.tBranch || 0.5;
        let minDist = Infinity;

        // Amostra a espinha do conduíte pai para colar o quadrado perfeitamente nele
        for (let t = 0.0; t <= 1.0; t += 0.005) {
            let p = getPointOnConduitAtT(parentC, t);
            let d = Math.hypot(obj.left - p.x, obj.top - p.y);
            if (d < minDist) { minDist = d; bestT = t; }
        }
        c.tBranch = bestT;
        atualizarPosicaoConduites();
        return;
    }

    if (obj.isChamadaBaseHandle) {
        const c = obj.conduitRef;
        const p1 = c.origem.tipoEquipamento?.includes('Interruptor') ? getConnectionPointOnEdge(c.origem, getTrueCenter(c.destino)) : getTrueCenter(c.origem);
        const p2 = c.destino.isConduiteHitbox ? getTrueCenter(c.destino.conduitRef.origem) : getTrueCenter(c.destino);
        let bestT = c.posChamada || 0.5;
        let minDist = Infinity;

        for (let t = 0.0; t <= 1.0; t += 0.01) {
            let p = getPointOnConduitAtT(c, t);
            let d = Math.hypot(obj.left - p.x, obj.top - p.y);
            if (d < minDist) { minDist = d; bestT = t; }
        }
        c.posChamada = bestT;
    }
    atualizarPosicaoConduites();
});

canvas.on('mouse:wheel', function(opt) {
    if (opt.e.ctrlKey) {
        const delta = opt.e.deltaY; let zoom = canvas.getZoom(); zoom *= Math.pow(0.999, delta);
        if (zoom > 5) zoom = 5; if (zoom < 0.2) zoom = 0.2;
        canvas.zoomToPoint({ x: opt.e.offsetX, y: opt.e.offsetY }, zoom);
        opt.e.preventDefault(); opt.e.stopPropagation();
    }
});

canvas.on('mouse:down', function(opt) {
    const evt = opt.e;
    // CORREÇÃO DEF: Pan universal via ALT + Clique Esquerdo OU Botão do Meio
    if (opt.button === 2 || (evt && evt.button === 1) || (evt && evt.altKey)) { 
        isPanning = true; canvas.selection = false; canvas.defaultCursor = 'grab'; 
        lastPosX = evt.clientX; lastPosY = evt.clientY; canvas.discardActiveObject(); canvas.renderAll(); 
        return;
    }

    if (!modoConduite) {
        listaConduites.forEach(c => {
            const isTarget = opt.target && (opt.target === c.hitbox || opt.target === c.handle || opt.target === c.chamadaHandle || opt.target === c.chamadaBaseHandle || opt.target === c.branchAnchor || opt.target === c.linha);
            c.isAtivo = !!isTarget; 
            const isBranchReto = c.tipo === 'reto' && c.destino && c.destino.isConduiteHitbox;

            if (isTarget) {
                if (c.handle && !isBranchReto) canvas.bringToFront(c.handle); 
                if (c.chamadaHandle) canvas.bringToFront(c.chamadaHandle);
                if (c.chamadaBaseHandle) canvas.bringToFront(c.chamadaBaseHandle);
                if (c.branchAnchor) canvas.bringToFront(c.branchAnchor);
            }
        });
        gerirVisibilidadeAncoras(); 
    }

    if (modoConduite && opt.target) {
        const isEquip = !!opt.target.tipoEquipamento;
        const isHitbox = !!opt.target.isConduiteHitbox;

        if (isEquip || isHitbox) {
            if (objConexaoOrigem === null) {
                if (isEquip) { objConexaoOrigem = opt.target; }
            } else if (objConexaoOrigem !== opt.target) {
                if (isHitbox && opt.target.conduitRef.origem === objConexaoOrigem) return; 

                const p1 = getTrueCenter(objConexaoOrigem);
                let p2 = isHitbox ? getClosestPointOnConduit(opt.target.conduitRef, p1) : getTrueCenter(opt.target);
                
                const tipoAtual = modoConduite; const corPadrao = '#000000'; 
                let pathStr = '', handleObj = null, eixoRef = 'X';
                let initHx = (p1.x + p2.x) / 2; let initHy = (p1.y + p2.y) / 2;

                if (tipoAtual === 'curvo') {
                    initHx += ((p2.y - p1.y) * 0.2); initHy -= ((p2.x - p1.x) * 0.2);
                    pathStr = `M ${p1.x} ${p1.y} Q ${initHx} ${initHy} ${p2.x} ${p2.y}`; 
                } else if (tipoAtual === 'subterraneo' || (tipoAtual === 'reto' && isHitbox)) {
                    pathStr = `M ${p1.x} ${p1.y} L ${p2.x} ${p2.y}`;
                } else {
                    eixoRef = Math.abs(p2.x - p1.x) > Math.abs(p2.y - p1.y) ? 'Y' : 'X';
                    if (eixoRef === 'Y') { initHy += 50; } else { initHx += 50; }
                    pathStr = `M ${p1.x} ${p1.y} L ${p2.x} ${p2.y}`;
                }

                handleObj = new fabric.Circle({ left: initHx, top: initHy, radius: 6, fill: corPadrao, stroke: '#fff', strokeWidth: 2, originX: 'center', originY: 'center', hasControls: false, hasBorders: false, isHandle: true, hoverCursor: 'pointer', visible: false, id: 'hand_' + Date.now(), selectable: true });
                canvas.add(handleObj);

                const isSub = tipoAtual === 'subterraneo';
                const curva = new fabric.Path(pathStr, { fill: 'transparent', stroke: corPadrao, strokeWidth: 1, strokeUniform: true, strokeLineJoin: 'miter', strokeDashArray: isSub ? [8, 5] : null, selectable: false, evented: false, isConduite: true, id: 'cond_' + Date.now(), objectCaching: false });
                const hitbox = new fabric.Path(pathStr, { fill: 'transparent', stroke: 'rgba(0,0,0,0.05)', strokeWidth: 15, strokeUniform: true, strokeLineJoin: 'miter', selectable: false, evented: true, hoverCursor: 'pointer', isConduiteHitbox: true, perPixelTargetFind: true, excludeFromExport: true, objectCaching: false });

                canvas.add(hitbox); canvas.add(curva); canvas.sendToBack(hitbox); canvas.sendToBack(curva); 
                
                // Inicializa c.tBranch com 0.5 (meio) caso seja uma ramificação de curvo/subterrâneo
                let tInit = isHitbox ? 0.5 : undefined;

                const novoConduite = { origem: objConexaoOrigem, destino: isHitbox ? opt.target : opt.target, linha: curva, hitbox: hitbox, circuitos: [], cor: corPadrao, tipo: tipoAtual, handle: handleObj, eixo: eixoRef, escalaFios: 1.0, posChamada: 0.5, tBranch: tInit, grupoFiacao: [], hasChamada: false, corChamada: '#555555', isAtivo: false };
                hitbox.conduitRef = novoConduite; if (handleObj) handleObj.conduitRef = novoConduite;
                listaConduites.push(novoConduite); atualizarPosicaoConduites();
                if (handleObj) canvas.bringToFront(handleObj); canvas.renderAll();
                objConexaoOrigem = opt.target;
            }
        }
    }
});

canvas.on('mouse:move', function(opt) {
    if (isPanning && opt.e) { 
        const delta = new fabric.Point(opt.e.clientX - lastPosX, opt.e.clientY - lastPosY);
        canvas.relativePan(delta); lastPosX = opt.e.clientX; lastPosY = opt.e.clientY; 
    }
});

canvas.on('mouse:up', function() {
    if (isPanning) { isPanning = false; canvas.selection = true; canvas.defaultCursor = 'default'; canvas.getObjects().forEach(obj => { obj.setCoords(); }); }
});

canvas.on('mouse:dblclick', function(options) {
    if (!options.target) return;

    if (options.target.isHandle) {
        const c = options.target.conduitRef; const p1 = c.origem.getCenterPoint(); const p2 = c.destino.getCenterPoint();
        if (c.tipo === 'curvo') {
            const cx = c.handle.left; const cy = c.handle.top; const dx = p2.x - p1.x; const dy = p2.y - p1.y;
            if(dx !== 0 || dy !== 0) {
                const t = ((cx - p1.x) * dx + (cy - p1.y) * dy) / (dx * dx + dy * dy);
                const pX = p1.x + t * dx; const pY = p1.y + t * dy;
                c.handle.set({ left: 2 * pX - cx, top: 2 * pY - cy }); c.handle.setCoords();
            }
        } else if (c.tipo === 'reto') {
            if (!(c.destino && c.destino.isConduiteHitbox)) {
                c.eixo = c.eixo === 'X' ? 'Y' : 'X';
                if (c.eixo === 'X') { c.handle.set({ left: (p1.x + p2.x)/2 + 50, top: (p1.y + p2.y)/2 }); } else { c.handle.set({ left: (p1.x + p2.x)/2, top: (p1.y + p2.y)/2 + 50 }); }
            }
        }
        atualizarPosicaoConduites(); canvas.renderAll(); return;
    }
    
    if (options.target.isChamadaHandle || options.target.isChamadaBaseHandle || options.target.isBranchAnchor) return;

    if (options.target.isConduiteHitbox || options.target.isConduite) {
        objetoSendoEditado = options.target.conduitRef || listaConduites.find(c => c.linha === options.target);
        if (!objetoSendoEditado) return; const conduitData = objetoSendoEditado;
        
        document.getElementById('modal-title').innerText = 'Edição do Conduíte';
        ['campos-tomada', 'campos-comum-id', 'campos-potencia', 'campo-circuito-container'].forEach(id => {
            const el = document.getElementById(id); if (el) el.style.display = 'none';
        });
        document.getElementById('campos-conduite').style.display = 'block'; document.getElementById('modal-botoes-padrao').style.display = 'flex'; 

        document.getElementById('conf-cor-conduite').value = conduitData.cor || '#000000';
        document.getElementById('conf-escala-fios').value = conduitData.escalaFios || 1.0;
        document.getElementById('conf-has-chamada').checked = conduitData.hasChamada || false;
        document.getElementById('conf-cor-chamada').value = conduitData.corChamada || '#555555';
        document.getElementById('chamada-cor-container').style.display = conduitData.hasChamada ? 'block' : 'none';

        renderListaCircuitosDOM(conduitData.circuitos || []);
        document.getElementById('modal-overlay').style.display = 'flex'; return;
    }

    if (options.target.tipoEquipamento && options.target.tipoEquipamento !== 'Quadro de Distribuição') {
        objetoSendoEditado = options.target; const t = objetoSendoEditado.tipoEquipamento;
        document.getElementById('modal-title').innerText = 'Configuração: ' + t;
        
        document.getElementById('campos-tomada').style.display = t.includes('Tomada') ? 'block' : 'none';
        document.getElementById('campos-comum-id').style.display = (t.includes('Lâmpada') || t.includes('Interruptor')) ? 'block' : 'none';
        document.getElementById('campos-potencia').style.display = t.includes('Lâmpada') ? 'block' : 'none';
        document.getElementById('campo-circuito-container').style.display = t.includes('Interruptor') ? 'none' : 'block';
        document.getElementById('campos-conduite').style.display = 'none'; document.getElementById('modal-botoes-padrao').style.display = 'flex'; 

        document.getElementById('conf-circuito').value = objetoSendoEditado.circuito || '';
        document.getElementById('conf-220v').checked = objetoSendoEditado.is220v || false;

        if (t.includes('Tomada')) { document.getElementById('conf-alta-potencia').checked = objetoSendoEditado.altaPotencia || false; document.getElementById('conf-nome').value = objetoSendoEditado.nome || ''; document.getElementById('conf-numero-tomadas').value = objetoSendoEditado.numeroTomadas || 1; } 
        if (t.includes('Lâmpada') || t.includes('Interruptor')) document.getElementById('conf-id-comando').value = objetoSendoEditado.lampId || '';
        if (t.includes('Lâmpada')) document.getElementById('conf-lamp-potencia').value = objetoSendoEditado.potencia || '';
        
        document.getElementById('modal-overlay').style.display = 'flex';
    }
});

addEvent('btn-salvar', 'click', () => {
    if (!objetoSendoEditado) return;
    
    if (objetoSendoEditado.linha) { 
        const c = objetoSendoEditado;
        c.cor = document.getElementById('conf-cor-conduite').value; c.escalaFios = parseFloat(document.getElementById('conf-escala-fios').value) || 1.0;
        const hasChamada = document.getElementById('conf-has-chamada').checked;
        c.hasChamada = hasChamada; c.corChamada = document.getElementById('conf-cor-chamada').value;

        if (hasChamada && !c.chamadaHandle) {
            const p1 = c.origem.getCenterPoint();
            c.chamadaHandle = new fabric.Rect({ left: p1.x + 60, top: p1.y - 60, width: 12, height: 12, fill: '#f39c12', stroke: '#fff', strokeWidth: 2, originX: 'center', originY: 'center', hasControls: false, hasBorders: false, isChamadaHandle: true, hoverCursor: 'pointer', id: 'cham_' + Date.now(), selectable: true });
            c.chamadaHandle.conduitRef = c; canvas.add(c.chamadaHandle);
        }

        c.linha.set({ stroke: c.cor });
        c.circuitos = Array.from(document.querySelectorAll('.circuito-box')).map(b => ({ numero: b.querySelector('.c-num').value, fase: parseInt(b.querySelector('.c-fase').value) || 0, neutro: parseInt(b.querySelector('.c-neutro').value) || 0, retorno: parseInt(b.querySelector('.c-retorno').value) || 0, terra: parseInt(b.querySelector('.c-terra').value) || 0 }));
        atualizarPosicaoConduites(); canvas.renderAll();
    } else {
        inserirOuAtualizarSimbolo({ tipo: objetoSendoEditado.tipoEquipamento, x: objetoSendoEditado.left, y: objetoSendoEditado.top, escala: objetoSendoEditado.scaleX, angulo: objetoSendoEditado.angle, id: objetoSendoEditado.id, objetoAntigo: objetoSendoEditado, circuito: document.getElementById('conf-circuito').value, is220v: document.getElementById('conf-220v').checked, altaPotencia: document.getElementById('conf-alta-potencia').checked, nome: document.getElementById('conf-nome').value, numeroTomadas: document.getElementById('conf-numero-tomadas').value, lampId: document.getElementById('conf-id-comando').value, potencia: document.getElementById('conf-lamp-potencia').value });
    }
    document.getElementById('modal-overlay').style.display = 'none'; objetoSendoEditado = null;
});

addEvent('btn-save-project', 'click', () => {
    const data = {
        canvas: canvas.toJSON(['id', 'tipoEquipamento', 'circuito', 'is220v', 'altaPotencia', 'nome', 'numeroTomadas', 'lampId', 'potencia', 'isConduite', 'isHandle', 'isFiacao', 'isChamadaHandle', 'isChamadaBaseHandle']),
        conduites: listaConduites.map(c => ({ 
            origemId: c.origem ? c.origem.id : null, 
            destinoId: c.destino && !c.destino.isConduiteHitbox ? c.destino.id : null, 
            destinoConduiteLinhaId: c.destino && c.destino.isConduiteHitbox ? c.destino.conduitRef.linha.id : null,
            linhaId: c.linha ? c.linha.id : null, handleId: c.handle ? c.handle.id : null, chamadaHandleId: c.chamadaHandle ? c.chamadaHandle.id : null, hasChamada: c.hasChamada, corChamada: c.corChamada, posChamada: c.posChamada, tBranch: c.tBranch, tipo: c.tipo, cor: c.cor, eixo: c.eixo, escalaFios: c.escalaFios, circuitos: c.circuitos 
        }))
    };
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: 'application/json' })); a.download = 'projeto_eletrico.json'; a.click();
});

addEvent('load-project', 'change', function(e) {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = function(f) {
        const data = JSON.parse(f.target.result);
        canvas.loadFromJSON(data.canvas, function() {
            const todosObjs = canvas.getObjects();
            
            todosObjs.forEach(obj => {
                if (obj._objects) { obj._objects.forEach(s => { if (s.type === 'text' && (s.fill === '#1a252f' || s.fill === 'rgb(26, 37, 47)')) { s.set('fill', '#000000'); } }); }
                if (obj.isConduite || obj.isConduiteHitbox) { if (obj.stroke === '#1a252f') obj.set('stroke', '#000000'); }
            });

            const toRemove = todosObjs.filter(o => o.isFiacao || o.isConduiteHitbox || o.isChamadaBaseHandle || o.isBranchAnchor); 
            toRemove.forEach(o => canvas.remove(o));
            listaConduites = [];

            if (data.conduites) {
                data.conduites.forEach(cData => {
                    const org = canvas.getObjects().find(o => o.id === cData.origemId); 
                    const lin = canvas.getObjects().find(o => o.id === cData.linhaId);
                    let han = cData.handleId ? canvas.getObjects().find(o => o.id === cData.handleId) : null; 
                    let cham = cData.chamadaHandleId ? canvas.getObjects().find(o => o.id === cData.chamadaHandleId) : null;
                    
                    if (org && lin) {
                        const corF = (cData.cor === '#1a252f') ? '#000000' : (cData.cor || '#000000');
                        const isSub = cData.tipo === 'subterraneo';
                        lin.set({ selectable: false, evented: false, isConduite: true, objectCaching: false, fill: 'transparent', stroke: corF, strokeDashArray: isSub ? [8, 5] : null });

                        const hitbox = new fabric.Path(lin.path, { fill: 'transparent', stroke: 'rgba(0,0,0,0.05)', strokeWidth: 15, strokeUniform: true, strokeLineJoin: 'miter', selectable: false, evented: true, hoverCursor: 'pointer', isConduiteHitbox: true, perPixelTargetFind: true, excludeFromExport: true, objectCaching: false });
                        canvas.add(hitbox); canvas.sendToBack(hitbox); canvas.sendToBack(lin);

                        if (han) han.set({ selectable: true, evented: true, hasControls: false, hasBorders: false, isHandle: true, fill: corF });
                        if (cham) cham.set({ selectable: true, evented: true, hasControls: false, hasBorders: false, isChamadaHandle: true });
                        
                        if (cData.hasChamada && !cham) {
                            const p1 = org.getCenterPoint();
                            cham = new fabric.Rect({ left: p1.x + 60, top: p1.y - 60, width: 12, height: 12, fill: '#f39c12', stroke: '#fff', strokeWidth: 2, originX: 'center', originY: 'center', hasControls: false, hasBorders: false, isChamadaHandle: true, hoverCursor: 'pointer', visible: false, id: 'cham_' + Date.now(), selectable: true });
                            canvas.add(cham);
                        }

                        const nC = { origem: org, destino: null, linha: lin, hitbox: hitbox, handle: han, chamadaHandle: cham, hasChamada: cData.hasChamada || false, corChamada: cData.corChamada || '#555555', posChamada: cData.posChamada !== undefined ? cData.posChamada : 0.5, tBranch: cData.tBranch, tipo: cData.tipo, cor: corF, eixo: cData.eixo, escalaFios: cData.escalaFios, circuitos: cData.circuitos || [], grupoFiacao: [], isAtivo: false, cDataRef: cData };
                        hitbox.conduitRef = nC; if (han) han.conduitRef = nC; if (cham) cham.conduitRef = nC;
                        listaConduites.push(nC);
                    }
                });

                listaConduites.forEach(c => {
                    if (c.cDataRef.destinoConduiteLinhaId) {
                        const parentC = listaConduites.find(pc => pc.linha.id === c.cDataRef.destinoConduiteLinhaId);
                        c.destino = parentC ? parentC.hitbox : null;
                    } else {
                        c.destino = canvas.getObjects().find(o => o.id === c.cDataRef.destinoId);
                    }
                    delete c.cDataRef;
                });
            }
            const pText = document.getElementById('placeholder-text'); if(pText) pText.style.display = 'none';
            atualizarPosicaoConduites(); applyLayersVisibility(); canvas.renderAll(); document.getElementById('load-project').value = "";
        });
    }; reader.readAsText(file);
});

addEvent('btn-export-pdf', 'click', () => {
    const { jsPDF } = window.jspdf; canvas.discardActiveObject(); 
    listaConduites.forEach(c => { if (c.hitbox) c.hitbox.set('visible', false); }); canvas.renderAll();
    const dataUrl = canvas.toDataURL({ format: 'png', quality: 1, multiplier: 2 }); 
    const showConduites = document.getElementById('layer-conduites').checked;
    listaConduites.forEach(c => { if (c.hitbox) c.hitbox.set('visible', showConduites); }); canvas.renderAll();
    const pdf = new jsPDF({ orientation: canvas.width > canvas.height ? 'l' : 'p', unit: 'px', format: [canvas.width, canvas.height] });
    pdf.addImage(dataUrl, 'PNG', 0, 0, canvas.width, canvas.height); pdf.save('planta_eletrica_exportada.pdf');
});

function deletarConduiteEFilhos(conduitData) {
    const idx = listaConduites.indexOf(conduitData);
    if (idx > -1) { 
        canvas.remove(conduitData.linha); if(conduitData.hitbox) canvas.remove(conduitData.hitbox);
        if(conduitData.grupoFiacao) conduitData.grupoFiacao.forEach(f => canvas.remove(f)); 
        if(conduitData.chamadaLine) canvas.remove(conduitData.chamadaLine);
        if(conduitData.chamadaHandle) canvas.remove(conduitData.chamadaHandle);
        if(conduitData.chamadaBaseHandle) canvas.remove(conduitData.chamadaBaseHandle);
        if(conduitData.branchAnchor) canvas.remove(conduitData.branchAnchor);
        if(conduitData.handle) canvas.remove(conduitData.handle);
        listaConduites.splice(idx, 1); 
        
        listaConduites.filter(c => c.destino === conduitData.hitbox).forEach(child => deletarConduiteEFilhos(child));
    }
}

function acaoDeletar() {
    const activeObject = canvas.getActiveObject(); 
    if (activeObject) {
        if (activeObject.isHandle || activeObject.isChamadaHandle || activeObject.isChamadaBaseHandle || activeObject.isBranchAnchor) {
            deletarConduiteEFilhos(activeObject.conduitRef);
        } else {
            listaConduites.filter(c => c.origem === activeObject || c.destino === activeObject).forEach(child => deletarConduiteEFilhos(child));
        }
        canvas.remove(activeObject); 
    }
}

addEvent('delete-btn', 'click', acaoDeletar);
addEvent('btn-deletar-conduite', 'click', () => {
    if (objetoSendoEditado && objetoSendoEditado.linha) { 
        deletarConduiteEFilhos(objetoSendoEditado);
        canvas.renderAll(); document.getElementById('modal-overlay').style.display = 'none'; objetoSendoEditado = null;
    }
});

addEvent('clear-btn', 'click', () => { 
    if(confirm('Tem certeza que deseja limpar tudo?')) { 
        canvas.clear(); listaConduites = []; 
        const pText = document.getElementById('placeholder-text'); if(pText) pText.style.display = 'block'; 
        escalaGlobalSímbolos = 1; canvas.setZoom(1); canvas.viewportTransform = [1, 0, 0, 1, 0, 0]; 
    } 
});

window.addEventListener('keydown', (e) => { 
    if ((e.key === 'Delete' || e.key === 'Backspace') && e.target.tagName !== 'INPUT') { acaoDeletar(); } 
    if (e.key === 'Escape') {
        desativarModoConduite(); document.getElementById('modal-overlay').style.display = 'none'; objetoSendoEditado = null;
    }
});
