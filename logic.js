// logic.js - GESTÃO DE CAMADAS E LÓGICA DE DESENHO

function getTrueCenter(obj) {
    if (!obj) return { x: 0, y: 0 };
    if (obj.type === 'group' && obj._objects && obj._objects.length > 0) {
        const svgPart = obj._objects[0];
        const pt = new fabric.Point(svgPart.left, svgPart.top);
        return fabric.util.transformPoint(pt, obj.calcTransformMatrix());
    }
    return obj.getCenterPoint();
}

function temFiosFiltradosParaConduite(c) {
    const circuitosFiltrados = (c.circuitos || []).filter(cir => {
        const numStr = cir.numero.toString().trim();
        return !circuitoFiltroGlobal || numStr === circuitoFiltroGlobal || numStr === '';
    });
    return circuitosFiltrados.some(cir => (cir.fase + cir.neutro + cir.retorno + cir.terra) > 0);
}

function gerirVisibilidadeAncoras() {
    const showConduites = document.getElementById('layer-conduites').checked;
    const showFiacao = document.getElementById('layer-fiacao').checked;

    listaConduites.forEach(c => {
        const isSelected = !!c.isAtivo; 
        const temFios = temFiosFiltradosParaConduite(c);

        if (c.handle) c.handle.set('visible', showConduites && isSelected);
        if (c.chamadaHandle) c.chamadaHandle.set('visible', showConduites && showFiacao && c.hasChamada && isSelected && temFios);
        if (c.chamadaBaseHandle) c.chamadaBaseHandle.set('visible', showConduites && showFiacao && c.hasChamada && isSelected && temFios);
    });
    canvas.requestRenderAll();
}

function applyLayersVisibility() {
    const showQuadros = document.getElementById('layer-quadros').checked;
    const showTomadas = document.getElementById('layer-tomadas').checked;
    const showIlumCmd = document.getElementById('layer-iluminacao').checked;
    const showConduites = document.getElementById('layer-conduites').checked;
    const showFiacao = document.getElementById('layer-fiacao').checked;

    canvas.getObjects().forEach(obj => {
        if (obj.tipoEquipamento) {
            if (obj.tipoEquipamento.includes('Quadro')) obj.set('visible', showQuadros);
            else if (obj.tipoEquipamento.includes('Tomada')) obj.set('visible', showTomadas);
            else if (obj.tipoEquipamento.includes('Lâmpada') || obj.tipoEquipamento.includes('Interruptor')) obj.set('visible', showIlumCmd);
        }
    });

    listaConduites.forEach(c => {
        const temFios = temFiosFiltradosParaConduite(c);
        if (c.linha) c.linha.set('visible', showConduites);
        if (c.hitbox) c.hitbox.set('visible', showConduites);
        if (c.chamadaLine) c.chamadaLine.set('visible', showConduites && showFiacao && c.hasChamada && temFios);
        if (c.grupoFiacao) c.grupoFiacao.forEach(f => f.set('visible', showConduites && showFiacao));
    });
    gerirVisibilidadeAncoras();
}

function getConnectionPointOnEdge(origem, dPt) {
    const c = getTrueCenter(origem); 
    const size = 40 * (origem.scaleX || 1);
    const r = { left: c.x - (size / 2), top: c.y - (size / 2), width: size, height: size };
    const dx = dPt.x - c.x; const dy = dPt.y - c.y;
    if (dx === 0 && dy === 0) return { x: c.x, y: c.y };
    let p = { x: c.x, y: c.y };
    if (Math.abs(dx) > Math.abs(dy)) { p.x = dx > 0 ? r.left + r.width : r.left; p.y = c.y + (p.x - c.x) * (dy / dx); } 
    else { p.y = dy > 0 ? r.top + r.height : r.top; p.x = c.x + (p.y - c.y) * (dx / dy); }
    return p;
}

// NOVO: Calcula o ponto perpendicular perfeito na espinha de um conduíte
function getClosestPointOnConduit(c, pt) {
    if (!c || !c.origem || !c.destino) return pt;
    
    const p1 = getTrueCenter(c.origem);
    const p2 = c.destino.isConduiteHitbox ? getTrueCenter(c.destino.conduitRef.origem) : getTrueCenter(c.destino); 
    
    const midX = (p1.x+p2.x)/2; const midY = (p1.y+p2.y)/2;
    let minDist = Infinity;
    let bestPt = {x: p1.x, y: p1.y};

    for (let t = 0.0; t <= 1.0; t += 0.02) {
        let px, py;
        if (c.tipo === 'curvo') {
            const cx = c.handle ? c.handle.left : midX + ((p2.y - p1.y) * 0.2);
            const cy = c.handle ? c.handle.top : midY - ((p2.x - p1.x) * 0.2);
            px = Math.pow(1-t, 2)*p1.x + 2*(1-t)*t*cx + Math.pow(t, 2)*p2.x;
            py = Math.pow(1-t, 2)*p1.y + 2*(1-t)*t*cy + Math.pow(t, 2)*p2.y;
        } else if (c.tipo === 'subterraneo') {
            px = p1.x + (p2.x - p1.x) * t;
            py = p1.y + (p2.y - p1.y) * t;
        } else {
            const hx = c.handle ? c.handle.left : midX; const hy = c.handle ? c.handle.top : midY;
            let pts = c.eixo === 'X' ? [{x:p1.x, y:p1.y}, {x:hx, y:p1.y}, {x:hx, y:p2.y}, {x:p2.x, y:p2.y}] : [{x:p1.x, y:p1.y}, {x:p1.x, y:hy}, {x:p2.x, y:hy}, {x:p2.x, y:p2.y}];
            let l1 = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
            let l2 = Math.hypot(pts[2].x - pts[1].x, pts[2].y - pts[1].y);
            let l3 = Math.hypot(pts[3].x - pts[2].x, pts[3].y - pts[2].y);
            let totalL = l1 + l2 + l3 || 1; let targetL = t * totalL;

            if (targetL <= l1) {
                let ratio = l1 === 0 ? 0 : targetL / l1;
                px = pts[0].x + (pts[1].x - pts[0].x) * ratio; py = pts[0].y + (pts[1].y - pts[0].y) * ratio;
            } else if (targetL <= l1 + l2) {
                let ratio = l2 === 0 ? 0 : (targetL - l1) / l2;
                px = pts[1].x + (pts[2].x - pts[1].x) * ratio; py = pts[1].y + (pts[2].y - pts[1].y) * ratio;
            } else {
                let ratio = l3 === 0 ? 0 : (targetL - l1 - l2) / l3;
                px = pts[2].x + (pts[3].x - pts[2].x) * ratio; py = pts[2].y + (pts[3].y - pts[2].y) * ratio;
            }
        }
        let d = Math.hypot(pt.x - px, pt.y - py);
        if (d < minDist) { minDist = d; bestPt = {x: px, y: py}; }
    }
    return bestPt;
}

function atualizarPosicaoConduites() {
    listaConduites.forEach(c => {
        if (!c.origem || !c.destino || !c.linha) return;

        let p1 = getTrueCenter(c.origem);
        let p2;

        // NOVO: Resolve a posição P2 permitindo conectar na linha de outro conduíte
        if (c.destino.isConduiteHitbox) {
            p2 = getClosestPointOnConduit(c.destino.conduitRef, p1);
            if (c.origem.tipoEquipamento?.includes('Interruptor')) p1 = getConnectionPointOnEdge(c.origem, p2);
            p2 = getClosestPointOnConduit(c.destino.conduitRef, p1); // Recalcula mais fino
        } else {
            p2 = getTrueCenter(c.destino);
            if (c.origem.tipoEquipamento?.includes('Interruptor')) p1 = getConnectionPointOnEdge(c.origem, p2);
            if (c.destino.tipoEquipamento?.includes('Interruptor')) p2 = getConnectionPointOnEdge(c.destino, p1);
        }
        
        let pathStr = '', cx, cy, baseX, baseY;
        const midX = (p1.x+p2.x)/2; const midY = (p1.y+p2.y)/2;
        let tChamada = c.posChamada !== undefined ? c.posChamada : 0.5;

        if (c.tipo === 'curvo') {
            cx = c.handle ? c.handle.left : midX + ((p2.y - p1.y) * 0.2);
            cy = c.handle ? c.handle.top : midY - ((p2.x - p1.x) * 0.2);
            pathStr = `M ${p1.x} ${p1.y} Q ${cx} ${cy} ${p2.x} ${p2.y}`;
            if (c.handle) { c.handle.set({ lockMovementX: false, lockMovementY: false, fill: c.cor }); c.handle.setCoords(); }
            baseX = Math.pow(1-tChamada, 2)*p1.x + 2*(1-tChamada)*tChamada*cx + Math.pow(tChamada, 2)*p2.x;
            baseY = Math.pow(1-tChamada, 2)*p1.y + 2*(1-tChamada)*tChamada*cy + Math.pow(tChamada, 2)*p2.y;
        } else if (c.tipo === 'subterraneo') {
            pathStr = `M ${p1.x} ${p1.y} L ${p2.x} ${p2.y}`;
            if (c.handle) { c.handle.set({ left: midX, top: midY, lockMovementX: true, lockMovementY: true, fill: c.cor }); c.handle.setCoords(); }
            baseX = p1.x + (p2.x - p1.x) * tChamada;
            baseY = p1.y + (p2.y - p1.y) * tChamada;
        } else {
            const hx = c.handle ? c.handle.left : midX; const hy = c.handle ? c.handle.top : midY;
            if (c.eixo === 'X') { pathStr = `M ${p1.x} ${p1.y} L ${hx} ${p1.y} L ${hx} ${p2.y} L ${p2.x} ${p2.y}`; } 
            else { pathStr = `M ${p1.x} ${p1.y} L ${p1.x} ${hy} L ${p2.x} ${hy} L ${p2.x} ${p2.y}`; }
            if (c.handle) { c.handle.set({ fill: c.cor }); c.handle.setCoords(); }

            let pts = c.eixo === 'X' ? [{x:p1.x, y:p1.y}, {x:hx, y:p1.y}, {x:hx, y:p2.y}, {x:p2.x, y:p2.y}] : [{x:p1.x, y:p1.y}, {x:p1.x, y:hy}, {x:p2.x, y:hy}, {x:p2.x, y:p2.y}];
            let l1 = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
            let l2 = Math.hypot(pts[2].x - pts[1].x, pts[2].y - pts[1].y);
            let l3 = Math.hypot(pts[3].x - pts[2].x, pts[3].y - pts[2].y);
            let totalL = l1 + l2 + l3 || 1; let targetL = tChamada * totalL;

            if (targetL <= l1) {
                let ratio = l1 === 0 ? 0 : targetL / l1;
                baseX = pts[0].x + (pts[1].x - pts[0].x) * ratio; baseY = pts[0].y + (pts[1].y - pts[0].y) * ratio;
            } else if (targetL <= l1 + l2) {
                let ratio = l2 === 0 ? 0 : (targetL - l1) / l2;
                baseX = pts[1].x + (pts[2].x - pts[1].x) * ratio; baseY = pts[1].y + (pts[2].y - pts[1].y) * ratio;
            } else {
                let ratio = l3 === 0 ? 0 : (targetL - l1 - l2) / l3;
                baseX = pts[2].x + (pts[3].x - pts[2].x) * ratio; baseY = pts[2].y + (pts[3].y - pts[2].y) * ratio;
            }
        }

        const np = new fabric.Path(pathStr);
        const props = { path: np.path, width: np.width, height: np.height, pathOffset: np.pathOffset, left: np.left, top: np.top };
        
        const tracejado = c.tipo === 'subterraneo' ? [8, 5] : null;
        c.linha.set({...props, stroke: c.cor, fill: 'transparent', strokeDashArray: tracejado}); c.linha.setCoords();
        if (c.hitbox) { c.hitbox.set({...props, fill: 'transparent'}); c.hitbox.setCoords(); }

        const corChamadaFinal = c.corChamada || '#555555';
        const temFios = temFiosFiltradosParaConduite(c);

        if (c.hasChamada && c.chamadaHandle) {
            c.chamadaHandle.set({ visible: c.handle ? c.handle.visible && temFios : false });

            if (!c.chamadaBaseHandle) {
                c.chamadaBaseHandle = new fabric.Rect({
                    left: baseX, top: baseY, width: 10, height: 10, fill: '#3498db', stroke: '#fff', strokeWidth: 2,
                    originX: 'center', originY: 'center', hasControls: false, hasBorders: false,
                    isChamadaBaseHandle: true, hoverCursor: 'pointer', id: 'cb_' + Date.now(), selectable: true
                });
                c.chamadaBaseHandle.conduitRef = c; canvas.add(c.chamadaBaseHandle);
            }
            c.chamadaBaseHandle.set({ left: baseX, top: baseY }); c.chamadaBaseHandle.setCoords();
            c.chamadaBaseHandle.set({ visible: c.handle ? c.handle.visible && temFios : false });

            const chamX = c.chamadaHandle.left; const chamY = c.chamadaHandle.top;
            const cp = `M ${baseX} ${baseY} L ${chamX} ${chamY}`;
            
            if (!c.chamadaLine) {
                c.chamadaLine = new fabric.Path(cp, { fill: 'transparent', stroke: corChamadaFinal, strokeWidth: 1.5, selectable: false, evented: false, isFiacao: true, objectCaching: false });
                canvas.add(c.chamadaLine); canvas.sendToBack(c.chamadaLine);
            } else {
                const ncp = new fabric.Path(cp);
                c.chamadaLine.set({ path: ncp.path, stroke: corChamadaFinal, width: ncp.width, height: ncp.height, pathOffset: ncp.pathOffset, left: ncp.left, top: ncp.top });
                c.chamadaLine.setCoords();
            }
            
            const sC = document.getElementById('layer-conduites').checked;
            const sF = document.getElementById('layer-fiacao').checked;
            c.chamadaLine.set('visible', sC && sF && c.hasChamada && temFios);
        } else {
            if (c.chamadaLine) { canvas.remove(c.chamadaLine); c.chamadaLine = null; }
            if (c.chamadaHandle && !c.hasChamada) { canvas.remove(c.chamadaHandle); c.chamadaHandle = null; }
            if (c.chamadaBaseHandle && !c.hasChamada) { canvas.remove(c.chamadaBaseHandle); c.chamadaBaseHandle = null; }
        }

        if (c.grupoFiacao) { c.grupoFiacao.forEach(f => canvas.remove(f)); }
        c.grupoFiacao = [];
        
        if (temFios) {
            const circuitosFiltrados = (c.circuitos || []).filter(cir => {
                const numStr = cir.numero.toString().trim();
                return !circuitoFiltroGlobal || numStr === circuitoFiltroGlobal || numStr === '';
            });
            
            const esc = c.escalaFios || 1.0; const fioLen = 30 * esc; const spacing = 8 * esc; const gapC = 15 * esc; 
            let totLen = 0; circuitosFiltrados.forEach(cir => totLen += (cir.fase+cir.neutro+cir.retorno+cir.terra)*spacing + gapC);
            totLen -= gapC; 

            let pos = (c.hasChamada && c.chamadaHandle) ? 0 : -totLen / 2; 
            const visibilidadeFiacao = document.getElementById('layer-conduites').checked && document.getElementById('layer-fiacao').checked;

            circuitosFiltrados.forEach(circ => {
                if ((circ.fase+circ.neutro+circ.retorno+circ.terra) === 0) return;
                let sPos = pos, d = "";
                
                const numStr = circ.numero.toString().trim();
                const isDestacado = (circuitoFiltroGlobal !== '') && (numStr === circuitoFiltroGlobal);
                const corTraco = isDestacado ? '#e74c3c' : (c.hasChamada ? corChamadaFinal : c.cor);
                const corTexto = isDestacado ? '#e74c3c' : '#000000';

                const getLData = (currP) => {
                    if (c.hasChamada && c.chamadaHandle) {
                        const chamX = c.chamadaHandle.left, chamY = c.chamadaHandle.top;
                        const dx = chamX - baseX, dy = chamY - baseY;
                        const dist = Math.hypot(dx, dy) || 1; const dirX = dx / dist, dirY = dy / dist;
                        return { px: chamX - (currP + 15) * dirX, py: chamY - (currP + 15) * dirY, dirX, dirY, nx: -dirY, ny: dirX, angle: Math.atan2(dy, dx)*(180/Math.PI) };
                    } else if (c.tipo === 'curvo') {
                        const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y) || 1; 
                        let t = 0.5 + (currP / dist); t = Math.max(0.05, Math.min(0.95, t)); 
                        const px = Math.pow(1-t, 2)*p1.x + 2*(1-t)*t*cx + Math.pow(t, 2)*p2.x;
                        const py = Math.pow(1-t, 2)*p1.y + 2*(1-t)*t*cy + Math.pow(t, 2)*p2.y;
                        const tx = 2*(1-t)*(cx - p1.x) + 2*t*(p2.x - cx); const ty = 2*(1-t)*(cy - p1.y) + 2*t*(p2.y - cy);
                        const tL = Math.hypot(tx, ty) || 1;
                        return { px, py, dirX: tx/tL, dirY: ty/tL, nx: -ty/tL, ny: tx/tL, angle: Math.atan2(ty, tx)*(180/Math.PI) };
                    } else if (c.tipo === 'subterraneo') {
                        const dx = p2.x - p1.x; const dy = p2.y - p1.y;
                        const dist = Math.hypot(dx, dy) || 1; const dirX = dx / dist; const dirY = dy / dist;
                        return { px: baseX + currP*dirX, py: baseY + currP*dirY, dirX, dirY, nx: -dirY, ny: dirX, angle: Math.atan2(dy, dx)*(180/Math.PI) };
                    } else {
                        let aR = (c.eixo === 'X' ? 90 : 0) * (Math.PI / 180);
                        return { px: baseX + currP*Math.cos(aR), py: baseY + currP*Math.sin(aR), dirX: Math.cos(aR), dirY: Math.sin(aR), nx: -Math.sin(aR), ny: Math.cos(aR), angle: aR*(180/Math.PI) };
                    }
                };

                let ws = [];
                for(let i=0;i<circ.neutro;i++) ws.push('N'); for(let i=0;i<circ.fase;i++) ws.push('F');
                for(let i=0;i<circ.retorno;i++) ws.push('R'); for(let i=0;i<circ.terra;i++) ws.push('T');

                ws.forEach((w) => {
                    const ld = getLData(pos);
                    const tX = ld.px-(fioLen/2)*ld.nx, tY = ld.py-(fioLen/2)*ld.ny, bX = ld.px+(fioLen/2)*ld.nx, bY = ld.py+(fioLen/2)*ld.ny;
                    if (w === 'N') d += `M ${tX} ${tY} L ${bX} ${bY} M ${tX} ${tY} L ${tX-8*esc*ld.dirX} ${tY-8*esc*ld.dirY} `;
                    if (w === 'F') d += `M ${tX} ${tY} L ${bX} ${bY} `;
                    if (w === 'R') d += `M ${ld.px} ${ld.py} L ${tX} ${tY} `;
                    if (w === 'T') d += `M ${tX} ${tY} L ${bX} ${bY} M ${bX-6*esc*ld.dirX} ${bY-6*esc*ld.dirY} L ${bX+6*esc*ld.dirX} ${bY+6*esc*ld.dirY} `;
                    pos += spacing;
                });
                
                if (circ.numero && circ.numero.toString().trim() !== '') {
                    const ldMid = getLData((sPos + pos - spacing) / 2);
                    let tA = ldMid.angle; if (tA > 90 || tA < -90) tA += 180; 
                    const textObj = new fabric.Text(circ.numero.toString(), { fontSize: 14 * esc, fontFamily: 'Arial', fill: corTexto, left: ldMid.px - ldMid.nx * 25 * esc, top: ldMid.py - ldMid.ny * 25 * esc, originX: 'center', originY: 'center', angle: tA, selectable: false, evented: false, isFiacao: true, visible: visibilidadeFiacao });
                    canvas.add(textObj); c.grupoFiacao.push(textObj);
                }

                if (d !== "") {
                    const pathFiacao = new fabric.Path(d, { fill: 'transparent', stroke: corTraco, strokeWidth: 1.5, strokeUniform: true, selectable: false, evented: false, isFiacao: true, objectCaching: false, visible: visibilidadeFiacao });
                    canvas.add(pathFiacao); canvas.bringToFront(pathFiacao); c.grupoFiacao.push(pathFiacao);
                }
                pos += gapC; 
            });
        }
    });
    canvas.requestRenderAll();
}

function inserirOuAtualizarSimbolo(dados) {
    const { tipo, x, y, escala, angulo, id, objetoAntigo, altaPotencia, nome, numeroTomadas, lampId, potencia, circuito, is220v } = dados;
    const isTomada = tipo.includes('Tomada'); const isLampada = tipo.includes('Lâmpada'); const isSwitch = tipo.includes('Interruptor');
    const svgString = (isTomada && altaPotencia) ? bibliotecaSimbologia[tipo].alta : bibliotecaSimbologia[tipo].normal;
    const estiloTexto = { fontSize: 16, fontFamily: 'Arial', fill: '#000000', fontWeight: 'normal', originX: 'center', originY: 'center' };
    let nA = (angulo || 0) % 360; if (nA < 0) nA += 360; const textAngle = (Math.round(nA) === 180) ? 180 : 0;

    fabric.loadSVGFromString(svgString, function(objects, options) {
        const svgSimb = fabric.util.groupSVGElements(objects, options); svgSimb.set({ originX: 'center', originY: 'center', left: 0, top: 0 });
        const objectsToGroup = [svgSimb];

        if (isTomada) {
            if (nome) objectsToGroup.push(new fabric.Text(nome, { ...estiloTexto, left: 0, top: -24, angle: textAngle }));
            if (numeroTomadas > 1) objectsToGroup.push(new fabric.Text('x' + numeroTomadas, { ...estiloTexto, left: 24, top: 0, angle: textAngle }));
        } else if (isLampada) {
            if (circuito) objectsToGroup.push(new fabric.Text(circuito.toString(), { ...estiloTexto, left: 0, top: -8, fontSize: 14, angle: textAngle }));
            if (potencia) objectsToGroup.push(new fabric.Text(potencia.toString(), { ...estiloTexto, left: 0, top: 8, fontSize: 14, angle: textAngle }));
            if (lampId) objectsToGroup.push(new fabric.Text(lampId.toString(), { ...estiloTexto, left: 25, top: 0, fontSize: 14, angle: textAngle }));
        } else if (isSwitch) {
            if (lampId) objectsToGroup.push(new fabric.Text(lampId.toString(), { ...estiloTexto, left: 20, top: -15, fontSize: 14, angle: textAngle }));
        }

        const grupoFinal = new fabric.Group(objectsToGroup, {
            left: x, top: y, originX: 'center', originY: 'center', scaleX: escala, scaleY: escala, angle: angulo || 0,
            transparentCorners: false, cornerColor: '#2c3e50', cornerStrokeColor: '#2c3e50', borderColor: '#2c3e50', cornerSize: 8, padding: 5, snapAngle: 90, snapThreshold: 45,
            id: id || 'eqp_' + Date.now() + Math.floor(Math.random() * 1000), tipoEquipamento: tipo, circuito: circuito || '', is220v: is220v || false,
            altaPotencia: altaPotencia || false, nome: nome || '', numeroTomadas: numeroTomadas || 1, lampId: lampId || '', potencia: potencia || ''
        });
        
        if (objetoAntigo) { listaConduites.forEach(c => { if (c.origem === objetoAntigo) c.origem = grupoFinal; if (c.destino === objetoAntigo) c.destino = grupoFinal; }); canvas.remove(objetoAntigo); }
        canvas.add(grupoFinal); atualizarPosicaoConduites(); canvas.renderAll();
    });
}

function renderListaCircuitosDOM(circuitos) {
    const container = document.getElementById('lista-circuitos'); if (!container) return; container.innerHTML = '';
    if (circuitos) { circuitos.forEach(circ => addCircuitoDOM(circ)); }
}

function addCircuitoDOM(circ = {numero: '', fase:0, neutro:0, retorno:0, terra:0}) {
    const container = document.getElementById('lista-circuitos'); if (!container) return;
    const div = document.createElement('div'); div.className = 'circuito-box';
    div.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <span style="font-size: 12px; font-weight: bold; color: #333;">Nº Circuito: <input type="text" class="c-num" value="${circ.numero}" style="width: 50px; display: inline-block;"></span>
            <button type="button" class="btn-remover-circ" onclick="this.parentElement.parentElement.remove()">X</button>
        </div>
        <div class="fios-grid">
            <div><label>Fase</label><input type="number" class="c-fase" min="0" value="${circ.fase}"></div>
            <div><label>Neutro</label><input type="number" class="c-neutro" min="0" value="${circ.neutro}"></div>
            <div><label>Retorno</label><input type="number" class="c-retorno" min="0" value="${circ.retorno}"></div>
            <div><label>Terra</label><input type="number" class="c-terra" min="0" value="${circ.terra}"></div>
        </div>
    `;
    container.appendChild(div);
}
