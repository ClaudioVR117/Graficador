// ============================================
// 1. Referencias
// ============================================
const contenedorRestricciones = document.getElementById('restricciones-container');
const btnAgregar = document.getElementById('btnAgregar');
const btnResolver = document.getElementById('btnResolver');
const btnProblema1 = document.getElementById('btnProblema1');
const btnProblema2 = document.getElementById('btnProblema2');
const resultadoDiv = document.getElementById('resultado');
const canvas = document.getElementById('grafica');
const ctx = canvas.getContext('2d');

let contadorRestricciones = 0;

// ============================================
// 2. Agregar / eliminar restricciones
// ============================================
function agregarRestriccion(coefX = 1, coefY = 1, operador = '<=', valor = 10) {
    contadorRestricciones++;
    const id = contadorRestricciones;

    const div = document.createElement('div');
    div.className = 'restriccion-row';
    div.id = `restriccion-${id}`;

    div.innerHTML = `
        <input type="number" class="coef-x" value="${coefX}" step="any">
        <span>X</span>
        <span>+</span>
        <input type="number" class="coef-y" value="${coefY}" step="any">
        <span>Y</span>
        <select class="operador">
            <option value="<=" ${operador === '<=' ? 'selected' : ''}>≤</option>
            <option value=">=" ${operador === '>=' ? 'selected' : ''}>≥</option>
            <option value="=" ${operador === '=' ? 'selected' : ''}>=</option>
        </select>
        <input type="number" class="valor" value="${valor}" step="any">
        <button type="button" class="btn-eliminar" onclick="eliminarRestriccion(${id})">X</button>
    `;

    contenedorRestricciones.appendChild(div);
}

function eliminarRestriccion(id) {
    const elemento = document.getElementById(`restriccion-${id}`);
    if (elemento) elemento.remove();
}

function limpiarRestricciones() {
    contenedorRestricciones.innerHTML = '';
    contadorRestricciones = 0;
}

// ============================================
// 3. Leer datos
// ============================================
function leerDatos() {
    const tipo = document.getElementById('tipo').value;
    const coefX = parseFloat(document.getElementById('coefX').value) || 0;
    const coefY = parseFloat(document.getElementById('coefY').value) || 0;

    const filas = document.querySelectorAll('#restricciones-container .restriccion-row');
    const restricciones = [];

    filas.forEach(fila => {
        const a = parseFloat(fila.querySelector('.coef-x').value) || 0;
        const b = parseFloat(fila.querySelector('.coef-y').value) || 0;
        const op = fila.querySelector('.operador').value;
        const c = parseFloat(fila.querySelector('.valor').value) || 0;
        restricciones.push({ a, b, op, c });
    });

    // No negatividad
    restricciones.push({ a: 1, b: 0, op: '>=', c: 0 });
    restricciones.push({ a: 0, b: 1, op: '>=', c: 0 });

    return { tipo, objetivo: { coefX, coefY }, restricciones };
}

// ============================================
// 4. Matemáticas
// ============================================
function interseccion(r1, r2) {
    const { a: a1, b: b1, c: c1 } = r1;
    const { a: a2, b: b2, c: c2 } = r2;
    const det = a1 * b2 - a2 * b1;
    if (Math.abs(det) < 1e-10) return null;
    const x = (c1 * b2 - c2 * b1) / det;
    const y = (a1 * c2 - a2 * c1) / det;
    return { x, y };
}

function esFactible(punto, restricciones) {
    const { x, y } = punto;
    for (const r of restricciones) {
        const valor = r.a * x + r.b * y;
        if (r.op === '<=' && valor > r.c + 1e-7) return false;
        if (r.op === '>=' && valor < r.c - 1e-7) return false;
        if (r.op === '='  && Math.abs(valor - r.c) > 1e-7) return false;
    }
    return true;
}

function encontrarVertices(restricciones) {
    const vertices = [];
    const n = restricciones.length;

    for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
            const r1 = { a: restricciones[i].a, b: restricciones[i].b, c: restricciones[i].c };
            const r2 = { a: restricciones[j].a, b: restricciones[j].b, c: restricciones[j].c };
            const punto = interseccion(r1, r2);

            if (punto && isFinite(punto.x) && isFinite(punto.y) && esFactible(punto, restricciones)) {
                const yaExiste = vertices.some(v =>
                    Math.abs(v.x - punto.x) < 1e-5 && Math.abs(v.y - punto.y) < 1e-5
                );
                if (!yaExiste) vertices.push(punto);
            }
        }
    }
    return vertices;
}

function evaluarObjetivo(vertices, objetivo, tipo) {
    if (vertices.length === 0) return { error: 'No se encontró región factible.' };

    let mejorPunto = null;
    let mejorValor = tipo === 'max' ? -Infinity : Infinity;

    const resultados = vertices.map(v => {
        const z = objetivo.coefX * v.x + objetivo.coefY * v.y;
        return { x: v.x, y: v.y, z };
    });

    resultados.forEach(r => {
        if (tipo === 'max') {
            if (r.z > mejorValor) {
                mejorValor = r.z;
                mejorPunto = r;
            }
        } else {
            if (r.z < mejorValor) {
                mejorValor = r.z;
                mejorPunto = r;
            }
        }
    });

    return { vertices: resultados, optimo: mejorPunto, tipo };
}

// ============================================
// 5. Funciones de dibujo
// ============================================
function ajustarCanvas() {
    const container = document.getElementById('canvas-container');
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
}

function aPantalla(x, y, escala, origenX, origenY) {
    return {
        px: origenX + x * escala,
        py: origenY - y * escala
    };
}

/**
 * Clipping de la recta a·x + b·y = c contra el rectángulo [xMin,xMax]×[yMin,yMax].
 * Usa un rango expandido para que las líneas siempre lleguen a los bordes visuales.
 */
function clipLinea(a, b, c, xMin, xMax, yMin, yMax) {
    const candidatos = [];

    // 4 bordes del rectángulo
    if (Math.abs(b) > 1e-12) {
        candidatos.push({ x: xMin, y: (c - a * xMin) / b });
        candidatos.push({ x: xMax, y: (c - a * xMax) / b });
    }
    if (Math.abs(a) > 1e-12) {
        candidatos.push({ x: (c - b * yMin) / a, y: yMin });
        candidatos.push({ x: (c - b * yMax) / a, y: yMax });
    }

    const eps = 1e-6;
    const pts = [];
    candidatos.forEach(p => {
        if (p.x >= xMin - eps && p.x <= xMax + eps &&
            p.y >= yMin - eps && p.y <= yMax + eps) {
            const existe = pts.some(q => Math.abs(q.x - p.x) < 1e-4 && Math.abs(q.y - p.y) < 1e-4);
            if (!existe) {
                pts.push({
                    x: Math.max(xMin, Math.min(xMax, p.x)),
                    y: Math.max(yMin, Math.min(yMax, p.y))
                });
            }
        }
    });

    if (pts.length > 2) {
        pts.sort((p, q) => p.x - q.x || p.y - q.y);
        return [pts[0], pts[pts.length - 1]];
    }
    return pts;
}

/**
 * Construye el polígono de la región factible recortado al viewport.
 * Funciona para regiones acotadas y no acotadas.
 */
function construirPoligonoFactible(restricciones, maxX, maxY) {
    const pts = [];

    // 1. Vértices (intersecciones entre restricciones)
    const n = restricciones.length;
    for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
            const p = interseccion(restricciones[i], restricciones[j]);
            if (p && isFinite(p.x) && isFinite(p.y) &&
                p.x >= -1e-6 && p.x <= maxX + 1e-6 &&
                p.y >= -1e-6 && p.y <= maxY + 1e-6 &&
                esFactible(p, restricciones)) {
                const existe = pts.some(q => Math.abs(q.x - p.x) < 1e-4 && Math.abs(q.y - p.y) < 1e-4);
                if (!existe) pts.push({ x: Math.max(0, p.x), y: Math.max(0, p.y) });
            }
        }
    }

    // 2. Intersecciones de cada restricción con los 4 bordes del viewport
    const bordes = [
        { a: 1, b: 0, c: 0 },
        { a: 1, b: 0, c: maxX },
        { a: 0, b: 1, c: 0 },
        { a: 0, b: 1, c: maxY }
    ];

    restricciones.forEach(r => {
        bordes.forEach(borde => {
            const p = interseccion(r, borde);
            if (p && isFinite(p.x) && isFinite(p.y) &&
                p.x >= -1e-6 && p.x <= maxX + 1e-6 &&
                p.y >= -1e-6 && p.y <= maxY + 1e-6 &&
                esFactible(p, restricciones)) {
                const existe = pts.some(q => Math.abs(q.x - p.x) < 1e-4 && Math.abs(q.y - p.y) < 1e-4);
                if (!existe) pts.push({
                    x: Math.max(0, Math.min(maxX, p.x)),
                    y: Math.max(0, Math.min(maxY, p.y))
                });
            }
        });
    });

    // 3. Esquinas del viewport que sean factibles
    const esquinas = [
        { x: 0, y: 0 },
        { x: maxX, y: 0 },
        { x: maxX, y: maxY },
        { x: 0, y: maxY }
    ];
    esquinas.forEach(p => {
        if (esFactible(p, restricciones)) {
            const existe = pts.some(q => Math.abs(q.x - p.x) < 1e-4 && Math.abs(q.y - p.y) < 1e-4);
            if (!existe) pts.push(p);
        }
    });

    if (pts.length < 3) return pts;

    // Ordenar angularmente alrededor del centroide
    const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
    const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
    pts.sort((a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx));

    return pts;
}

function dibujarGrafica(solucion) {
    if (!solucion || !solucion.vertices || solucion.vertices.length === 0) return;

    ajustarCanvas();
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const { datos, vertices, optimo } = solucion;
    const restricciones = datos.restricciones;
    const objetivo = datos.objetivo;

    const restriccionesVisibles = restricciones.filter(r =>
        !((r.a === 1 && r.b === 0 && r.c === 0) || (r.a === 0 && r.b === 1 && r.c === 0))
    );

    // ---------- Calcular rango ----------
    let maxX = 0, maxY = 0;

    vertices.forEach(v => {
        maxX = Math.max(maxX, v.x);
        maxY = Math.max(maxY, v.y);
    });

    restriccionesVisibles.forEach(r => {
        if (Math.abs(r.a) > 1e-9) {
            const ix = r.c / r.a;
            if (ix > 0) maxX = Math.max(maxX, ix);
        }
        if (Math.abs(r.b) > 1e-9) {
            const iy = r.c / r.b;
            if (iy > 0) maxY = Math.max(maxY, iy);
        }
    });

    if (optimo) {
        const zOpt = objetivo.coefX * optimo.x + objetivo.coefY * optimo.y;
        if (Math.abs(objetivo.coefX) > 1e-9) {
            const ix = zOpt / objetivo.coefX;
            if (ix > 0) maxX = Math.max(maxX, ix);
        }
        if (Math.abs(objetivo.coefY) > 1e-9) {
            const iy = zOpt / objetivo.coefY;
            if (iy > 0) maxY = Math.max(maxY, iy);
        }
    }

    maxX = Math.max(maxX * 1.4, 8);
    maxY = Math.max(maxY * 1.4, 8);
    maxX = Math.min(maxX, 6000);
    maxY = Math.min(maxY, 6000);

    const margen = 55;
    const escalaX = (canvas.width - 2 * margen) / maxX;
    const escalaY = (canvas.height - 2 * margen) / maxY;
    const escala = Math.min(escalaX, escalaY);

    const origenX = margen;
    const origenY = canvas.height - margen;

    const colores = ['#e74c3c', '#2980b9', '#27ae60', '#8e44ad', '#f39c12', '#16a085'];

    // ========== 1. Cuadrícula ==========
    ctx.strokeStyle = '#d0d0d0';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#555';
    ctx.font = '11px Arial';

    const paso = Math.max(1, Math.ceil(Math.max(maxX, maxY) / 8));
    for (let i = 0; i <= maxX + paso; i += paso) {
        const p = aPantalla(i, 0, escala, origenX, origenY);
        ctx.beginPath();
        ctx.moveTo(p.px, origenY);
        ctx.lineTo(p.px, 15);
        ctx.stroke();
        ctx.fillText(i.toFixed(i >= 10 ? 0 : 1), p.px - 8, origenY + 18);
    }
    for (let i = 0; i <= maxY + paso; i += paso) {
        const p = aPantalla(0, i, escala, origenX, origenY);
        ctx.beginPath();
        ctx.moveTo(origenX, p.py);
        ctx.lineTo(canvas.width - 15, p.py);
        ctx.stroke();
        if (i > 0) ctx.fillText(i.toFixed(i >= 10 ? 0 : 1), origenX - 32, p.py + 4);
    }

    // ========== 2. Ejes ==========
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(origenX, 12);
    ctx.lineTo(origenX, origenY);
    ctx.lineTo(canvas.width - 12, origenY);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(origenX, 12); ctx.lineTo(origenX - 7, 22);
    ctx.moveTo(origenX, 12); ctx.lineTo(origenX + 7, 22);
    ctx.moveTo(canvas.width - 12, origenY); ctx.lineTo(canvas.width - 22, origenY - 7);
    ctx.moveTo(canvas.width - 12, origenY); ctx.lineTo(canvas.width - 22, origenY + 7);
    ctx.stroke();

    ctx.fillStyle = '#222';
    ctx.font = 'bold 14px Arial';
    ctx.fillText('Y', origenX - 24, 24);
    ctx.fillText('X', canvas.width - 28, origenY + 22);

    // ========== 3. Dibujar rectas (borde a borde del área visible del canvas) ==========
    // Convertir los bordes en píxeles del área de dibujo a coordenadas del mundo
    const plotLeft   = origenX;
    const plotRight  = canvas.width - 12;
    const plotTop    = 12;
    const plotBottom = origenY;

    // Mundo: x = (px - origenX) / escala ,  y = (origenY - py) / escala
    const worldXMin = (plotLeft  - origenX) / escala;   // ≈ 0
    const worldXMax = (plotRight - origenX) / escala;   // borde derecho real del plot
    const worldYMin = (origenY - plotBottom) / escala;  // ≈ 0
    const worldYMax = (origenY - plotTop)    / escala;  // borde superior real del plot

    function dibujarRecta(a, b, c, color, grosor = 2.6) {
        const pts = clipLinea(a, b, c, worldXMin, worldXMax, worldYMin, worldYMax);
        if (pts.length < 2) return;

        pts.sort((p, q) => p.x - q.x || p.y - q.y);

        const p1 = aPantalla(pts[0].x, pts[0].y, escala, origenX, origenY);
        const p2 = aPantalla(pts[pts.length - 1].x, pts[pts.length - 1].y, escala, origenX, origenY);

        ctx.strokeStyle = color;
        ctx.lineWidth = grosor;
        ctx.beginPath();
        ctx.moveTo(p1.px, p1.py);
        ctx.lineTo(p2.px, p2.py);
        ctx.stroke();
    }

    // ========== 4. Restricciones ==========
    restriccionesVisibles.forEach((r, idx) => {
        dibujarRecta(r.a, r.b, r.c, colores[idx % colores.length], 2.7);
    });

    // ========== 5. Isolínea de Z ==========
    if (optimo) {
        const zOpt = objetivo.coefX * optimo.x + objetivo.coefY * optimo.y;
        dibujarRecta(objetivo.coefX, objetivo.coefY, zOpt, '#e67e22', 2.5);

        const labelX = Math.min(optimo.x + maxX * 0.08, maxX * 0.85);
        const labelY = Math.min(optimo.y + maxY * 0.06, maxY * 0.9);
        const pLabel = aPantalla(labelX, labelY, escala, origenX, origenY);
        ctx.fillStyle = '#e67e22';
        ctx.font = 'bold 13px Arial';
        ctx.fillText(`Z = ${zOpt.toFixed(1)}`, pLabel.px, pLabel.py);
    }

    // ========== 6. Área factible (método correcto, usando bordes reales del plot) ==========
    const poligono = construirPoligonoFactible(restricciones, worldXMax, worldYMax);

    if (poligono.length >= 3) {
        ctx.fillStyle = 'rgba(74, 144, 226, 0.25)';
        ctx.strokeStyle = '#4a90e2';
        ctx.lineWidth = 2.2;
        ctx.beginPath();

        const primero = aPantalla(poligono[0].x, poligono[0].y, escala, origenX, origenY);
        ctx.moveTo(primero.px, primero.py);
        for (let i = 1; i < poligono.length; i++) {
            const p = aPantalla(poligono[i].x, poligono[i].y, escala, origenX, origenY);
            ctx.lineTo(p.px, p.py);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    }

    // ========== 7. Vértices ==========
    ctx.fillStyle = '#1a1a1a';
    vertices.forEach((v, i) => {
        const p = aPantalla(v.x, v.y, escala, origenX, origenY);
        ctx.beginPath();
        ctx.arc(p.px, p.py, 5.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.font = 'bold 12px Arial';
        ctx.fillText(`P${i + 1}`, p.px + 9, p.py - 9);
    });

    // ========== 8. Punto óptimo ==========
    if (optimo) {
        const p = aPantalla(optimo.x, optimo.y, escala, origenX, origenY);
        ctx.fillStyle = '#e74c3c';
        ctx.beginPath();
        ctx.arc(p.px, p.py, 9, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2.5;
        ctx.stroke();

        ctx.fillStyle = '#c0392b';
        ctx.font = 'bold 13px Arial';
        ctx.fillText('ÓPTIMO', p.px + 14, p.py - 12);
        ctx.font = '12px Arial';
        ctx.fillText(`(${optimo.x.toFixed(2)}, ${optimo.y.toFixed(2)})`, p.px + 14, p.py + 5);
    }

    // ========== 9. Leyenda ==========
    const leyendaX = canvas.width - 250;
    const leyendaY = 18;
    const items = restriccionesVisibles.length + (optimo ? 1 : 0);
    const alto = 30 + items * 22;

    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.strokeStyle = '#aaa';
    ctx.lineWidth = 1;
    ctx.beginPath();
    if (ctx.roundRect) {
        ctx.roundRect(leyendaX - 12, leyendaY - 8, 240, alto, 8);
    } else {
        ctx.rect(leyendaX - 12, leyendaY - 8, 240, alto);
    }
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#2c3e50';
    ctx.font = 'bold 13px Arial';
    ctx.fillText('Leyenda', leyendaX, leyendaY + 8);

    restriccionesVisibles.forEach((r, idx) => {
        const color = colores[idx % colores.length];
        const yPos = leyendaY + 28 + idx * 22;

        ctx.fillStyle = color;
        ctx.fillRect(leyendaX, yPos - 8, 16, 16);
        ctx.strokeStyle = '#555';
        ctx.lineWidth = 1;
        ctx.strokeRect(leyendaX, yPos - 8, 16, 16);

        let texto = '';
        const a = r.a, b = r.b, c = r.c;
        const op = r.op === '<=' ? '≤' : r.op === '>=' ? '≥' : '=';

        if (Math.abs(a) < 1e-9) texto = `${b}Y ${op} ${c}`;
        else if (Math.abs(b) < 1e-9) texto = `${a}X ${op} ${c}`;
        else {
            const signo = b >= 0 ? '+' : '-';
            texto = `${a}X ${signo} ${Math.abs(b)}Y ${op} ${c}`;
        }

        ctx.fillStyle = '#333';
        ctx.font = '12px Arial';
        ctx.fillText(texto, leyendaX + 24, yPos + 4);
    });

    if (optimo) {
        const yPos = leyendaY + 28 + restriccionesVisibles.length * 22;
        ctx.strokeStyle = '#e67e22';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(leyendaX, yPos);
        ctx.lineTo(leyendaX + 16, yPos);
        ctx.stroke();

        ctx.fillStyle = '#333';
        ctx.font = '12px Arial';
        ctx.fillText('Función objetivo (Z)', leyendaX + 24, yPos + 4);
    }
}

// ============================================
// 6. Cargar problemas
// ============================================
function cargarProblema1() {
    document.getElementById('tipo').value = 'max';
    document.getElementById('coefX').value = 5;
    document.getElementById('coefY').value = 4;

    limpiarRestricciones();
    agregarRestriccion(6, 4, '<=', 24);
    agregarRestriccion(1, 2, '<=', 6);
    agregarRestriccion(-1, 1, '<=', 1);
    agregarRestriccion(0, 1, '<=', 2);
}

function cargarProblema2() {
    document.getElementById('tipo').value = 'min';
    document.getElementById('coefX').value = 0.30;
    document.getElementById('coefY').value = 0.90;

    limpiarRestricciones();
    agregarRestriccion(1, 1, '>=', 800);
    agregarRestriccion(-0.21, 0.30, '>=', 0);
    agregarRestriccion(-0.03, 0.01, '<=', 0);
}

// ============================================
// 7. Eventos
// ============================================
btnAgregar.addEventListener('click', () => agregarRestriccion());

btnProblema1.addEventListener('click', () => {
    cargarProblema1();
    resultadoDiv.style.display = 'none';
});

btnProblema2.addEventListener('click', () => {
    cargarProblema2();
    resultadoDiv.style.display = 'none';
});

btnResolver.addEventListener('click', () => {
    const datos = leerDatos();
    const vertices = encontrarVertices(datos.restricciones);
    const solucion = evaluarObjetivo(vertices, datos.objetivo, datos.tipo);

    resultadoDiv.style.display = 'block';

    if (solucion.error) {
        resultadoDiv.innerHTML = `<strong style="color:red;">${solucion.error}</strong>`;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        return;
    }

    let html = `
        <strong>Solución encontrada:</strong><br><br>
        <strong>Tipo:</strong> ${solucion.tipo === 'max' ? 'Maximizar' : 'Minimizar'}<br>
        <strong>Función Objetivo:</strong> Z = ${datos.objetivo.coefX}X + ${datos.objetivo.coefY}Y<br><br>
        <strong>Vértices factibles:</strong><br>
    `;

    solucion.vertices.forEach((v, i) => {
        html += `P${i + 1}: (X=${v.x.toFixed(3)}, Y=${v.y.toFixed(3)}) → Z=${v.z.toFixed(3)}<br>`;
    });

    html += `<br>
        <strong style="color:#2c6cb0;">Óptimo:</strong><br>
        X = ${solucion.optimo.x.toFixed(4)}<br>
        Y = ${solucion.optimo.y.toFixed(4)}<br>
        Z = ${solucion.optimo.z.toFixed(4)}
    `;

    resultadoDiv.innerHTML = html;

    window.ultimaSolucion = {
        datos,
        vertices: solucion.vertices,
        optimo: solucion.optimo
    };

    dibujarGrafica(window.ultimaSolucion);
});

window.addEventListener('resize', () => {
    if (window.ultimaSolucion) dibujarGrafica(window.ultimaSolucion);
});

// Cargar Problema 1 al iniciar
cargarProblema1();
