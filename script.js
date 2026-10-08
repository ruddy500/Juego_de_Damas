// Valores constantes para representar las piezas y casillas vacías en la matriz del tablero
const J1 = 1;       // Ficha normal del Jugador 1 (antes P1)
const J2 = 2;       // Ficha normal del Jugador 2 / IA (antes P2)
const J1_REY = 3;   // Reina/Rey del Jugador 1
const J2_REY = 4;   // Reina/Rey del Jugador 2 / IA
const VACIO = 0;    // Casilla vacía

// ----------------------------------------- PARTE VISUAL Y FRONTEND ----------------------------------------------------

// --- CONTROLADOR DEL DROPDOWN PERSONALIZADO ---
// Espera a que el DOM esté completamente cargado para inicializar los eventos del dropdown
document.addEventListener('DOMContentLoaded', () => {
    const contenedor = document.getElementById('custom-select-wrapper');
    const disparador = document.getElementById('custom-select-trigger');
    const opciones = document.querySelectorAll('.custom-option');
    const selectNativo = document.getElementById('ai-difficulty');

    // Abrir/Cerrar
    // Alterna la clase 'open' para mostrar u ocultar la lista de opciones
    disparador.addEventListener('click', function(e) {
        contenedor.classList.toggle('open');
        e.stopPropagation(); // Evita que el clic se propague al window y lo cierre inmediatamente
    });

    // Seleccionar opción
    // Recorre cada opción disponible en el dropdown personalizado          
    opciones.forEach(opcion => {
        opcion.addEventListener('click', function() {
            // Actualizar texto del disparador con el texto de la opción seleccionada
            disparador.textContent = this.textContent;
            
            // Actualizar clases de seleccionado (remueve de todos y añade al actual)
            opciones.forEach(opc => opc.classList.remove('selected'));
            this.classList.add('selected');
            
            // Sincronizar con el select oculto (mantiene la compatibilidad con formularios/lógica)
            selectNativo.value = this.getAttribute('data-value');
            
            // Cerrar el dropdown tras hacer la selección
            contenedor.classList.remove('open');
        });
    });

    // Cerrar al hacer click afuera
    // Si se hace clic en cualquier parte del documento que no sea el dropdown, este se cierra
    window.addEventListener('click', function(e) {
        if (!contenedor.contains(e.target)) {
            contenedor.classList.remove('open');
        }
    });
});

// CONTROLADOR PRINCIPAL Y DOM
// El objeto aplicacion maneja el ciclo de vida del juego, los eventos visuales y el estado de la UI.
 
const aplicacion = {
    tablero: null,               // Representación lógica del tablero actual
    jugadorActual: J1,           // Jugador activo (empieza J1)
    piezasDOM: new Map(),        // Referencia a los elementos HTML de cada pieza por ID
    piezasLogicas: new Map(),    // Estado lógico (fila, col, valor) asociado al ID de cada pieza
    contadorIdPieza: 0,          // Contador incremental para generar IDs únicos
    idSeleccionado: null,        // ID de la pieza seleccionada actualmente
    movimientosValidos: [],      // Movimientos válidos permitidos para el turno en curso
    estaAnimando: false,         // Bloqueo de UI mientras se animan las piezas
    idPiezaForzada: null,        // ID de pieza obligada a moverse (usado en saltos dobles/múltiples)

    // Inicializa la aplicación y el tablero visual
    inicializar() {
        this.construirCasillas();
        this.reiniciarJuego();
    },

    // Crea los elementos div que componen la cuadrícula del tablero
    construirCasillas() {
        const capa = document.getElementById('squares-layer');
        capa.innerHTML = '';
        for(let f = 0; f < 8; f++) { // f = fila
            for(let c = 0; c < 8; c++) { // c = columna
                let casilla = document.createElement('div');
                casilla.className = `square ${(f+c)%2 !== 0 ? 'dark' : 'light'}`;
                casilla.id = `sq-${f}-${c}`;
                casilla.dataset.f = f; casilla.dataset.c = c;
                
                // Evento click en casilla vacía para mover una pieza seleccionada
                casilla.addEventListener('click', () => {
                    // Ignora clics si no es el turno del jugador, hay animación o no hay selección
                    if(this.jugadorActual !== J1 || this.estaAnimando || !this.idSeleccionado) return;
                    const pl = this.piezasLogicas.get(this.idSeleccionado); // pl = pieza logica
                    // Busca si el destino clickeado corresponde a uno de los movimientos válidos de la pieza
                    let movimiento = this.movimientosValidos.find(m => m.origen.f === pl.f && m.origen.c === pl.c && m.destino.f === f && m.destino.c === c);
                    if(movimiento) this.ejecutarMovimiento(movimiento, this.idSeleccionado);
                });
                capa.appendChild(casilla);
            }
        }
    },

    // Reinicia variables de estado, limpia tablero y coloca piezas en posición inicial
    reiniciarJuego() {
        this.tablero = Logica.obtenerTableroInicial();
        this.jugadorActual = J1;
        this.idSeleccionado = null;
        this.idPiezaForzada = null;
        this.estaAnimando = false;
        this.contadorIdPieza = 0;
        
        // Limpia contenedores visuales de cementerio, tablero y estadísticas
        document.getElementById('grave-p1').innerHTML = '';
        document.getElementById('grave-p2').innerHTML = '';
        document.getElementById('pieces-layer').innerHTML = '';
        document.getElementById('ai-stats').innerHTML = `Métricas deL Adversario:<br>Metodología: <span class="stats-highlight">-</span><br>Nodos Evaluados: <span class="stats-highlight">0</span><br>Tiempo: <span class="stats-highlight">0 ms</span>`;
        this.piezasDOM.clear();
        this.piezasLogicas.clear();
        this.limpiarResaltadosVerdes();

        // Construye visualmente las piezas basado en el array bidimensional inicial
        const capaPiezas = document.getElementById('pieces-layer');
        for(let f = 0; f < 8; f++) {
            for(let c = 0; c < 8; c++) {
                let valor = this.tablero[f][c];
                if(valor !== VACIO) {
                    let id = `piece_${this.contadorIdPieza++}`;
                    this.piezasLogicas.set(id, {f, c, valor});
                    
                    let elemento = document.createElement('div');
                    elemento.id = id;
                    elemento.className = `piece-wrapper ${valor === J1 ? 'p1' : 'p2'}`;
                    // Inserta ícono de corona (solo visible si tiene la clase 'is-king')
                    elemento.innerHTML = `<div class="piece-visual"><span class="crown">♛</span></div>`;
                    
                    // Posiciona usando transformaciones CSS
                    elemento.style.transform = `translate(${c * 100}%, ${f * 100}%)`;
                    
                    // Evento click para seleccionar piezas del jugador humano
                    elemento.addEventListener('click', (e) => {
                        e.stopPropagation(); // Evita accionar eventos de la casilla inferior
                        if(this.jugadorActual !== J1 || this.estaAnimando) return;
                        
                        const pl = this.piezasLogicas.get(id);
                        // Asegura que solo seleccione fichas propias
                        if(pl.valor !== J1 && pl.valor !== J1_REY) return;
                        
                        // Si está obligado a mover una ficha específica (ej. doble captura), previene seleccionar otra
                        if(this.idPiezaForzada && this.idPiezaForzada !== id) return; 

                        // Filtra movimientos aplicables solo a la pieza clickeada
                        let misMovimientos = this.movimientosValidos.filter(m => m.origen.f === pl.f && m.origen.c === pl.c);
                        if(misMovimientos.length > 0) this.seleccionarPieza(id, misMovimientos);
                    });
                    
                    capaPiezas.appendChild(elemento);
                    this.piezasDOM.set(id, elemento);
                }
            }
        }
        // Prepara el primer turno
        this.prepararTurno();
    },

    // Quita las clases CSS de resaltado visual (origen, destino, selección e IA)
    limpiarResaltadosVerdes() {
        document.querySelectorAll('.square').forEach(casilla => {
            casilla.classList.remove('green-source', 'green-dest', 'ai-highlight');
        });
        this.piezasDOM.forEach(p => p.classList.remove('selected'));
    },

    // Maneja la selección de una pieza en la UI, iluminando la pieza y sus destinos posibles
    seleccionarPieza(id, movimientos) {
        this.limpiarResaltadosVerdes();
        
        // Permite deseleccionar si se vuelve a clickear la misma pieza (a menos que esté forzado)
        if(this.idSeleccionado === id && !this.idPiezaForzada) {
            this.idSeleccionado = null;
            return;
        }

        this.idSeleccionado = id;
        this.piezasDOM.get(id).classList.add('selected');

        const pl = this.piezasLogicas.get(id);
        document.getElementById(`sq-${pl.f}-${pl.c}`).classList.add('green-source');
        
        // Resalta las casillas de destino de los movimientos válidos para la pieza
        movimientos.forEach(m => {
            document.getElementById(`sq-${m.destino.f}-${m.destino.c}`).classList.add('green-dest');
        });
    },

    // Procesa lógica, DOM y animaciones de un movimiento (incluye capturas y turnos)
    async ejecutarMovimiento(movimiento, idPieza) {
        this.estaAnimando = true; // Bloquea la interacción del usuario temporalmente
        this.limpiarResaltadosVerdes();

        // Actualiza lógica interna
        let {tablero: nuevoTablero, coronada} = Logica.aplicarMovimiento(this.tablero, movimiento);
        this.tablero = nuevoTablero;

        const elemento = this.piezasDOM.get(idPieza);
        const pl = this.piezasLogicas.get(idPieza);
        
        // Resalta temporalmente la ruta si el que mueve es la IA
        if(this.jugadorActual === J2) {
            const casillaOrigen = document.getElementById(`sq-${pl.f}-${pl.c}`);
            const casillaDestino = document.getElementById(`sq-${movimiento.destino.f}-${movimiento.destino.c}`);
            casillaOrigen.classList.add('ai-highlight');
            casillaDestino.classList.add('ai-highlight');
            
            setTimeout(() => {
                casillaOrigen.classList.remove('ai-highlight');
                casillaDestino.classList.remove('ai-highlight');
            }, 1000);
        }

        // Actualiza posición lógica de la pieza y mueve el elemento en el DOM
        pl.f = movimiento.destino.f; pl.c = movimiento.destino.c;
        elemento.style.transform = `translate(${movimiento.destino.c * 100}%, ${movimiento.destino.f * 100}%)`;

        // Aplica visual y lógicamente la corona si hubo promoción
        if(coronada) {
            pl.valor = (this.jugadorActual === J1) ? J1_REY : J2_REY;
            elemento.classList.add('is-king');
        }

        // Espera a que termine la animación de traslación CSS
        await new Promise(r => setTimeout(r, 400));

        // Lógica y animación en caso de salto (captura)
        if(movimiento.esSalto) {
            let idCaptura = null;
            // Identifica la pieza capturada basándose en sus coordenadas lógicas
            for(let [id, p] of this.piezasLogicas) {
                if(p.f === movimiento.captura.f && p.c === movimiento.captura.c) { idCaptura = id; break; }
            }
            
            if(idCaptura) {
                const elementoCaptura = this.piezasDOM.get(idCaptura);
                elementoCaptura.classList.add('captured'); // Efecto visual de desvanecimiento/captura
                this.piezasLogicas.delete(idCaptura); // Remueve pieza capturada del estado lógico
                
                await new Promise(r => setTimeout(r, 300)); // Espera el efecto visual
                elementoCaptura.remove(); // Quita elemento del DOM
                this.piezasDOM.delete(idCaptura); // Borra referencia del mapa DOM

                // Agrega una ficha representativa al contenedor del "cementerio" correspondiente
                const cajaCementerio = document.getElementById(this.jugadorActual === J1 ? 'grave-p2' : 'grave-p1');
                const piezaCementerio = document.createElement('div');
                piezaCementerio.className = `grave-piece ${this.jugadorActual === J1 ? 'p2' : 'p1'}`;
                cajaCementerio.appendChild(piezaCementerio);
            }

            // Verifica si hay saltos múltiples consecutivos obligatorios con la misma pieza
            if(!coronada) { 
                let saltosMultiples = Logica.obtenerMovimientosPorPieza(this.tablero, pl.f, pl.c, pl.valor).filter(m => m.esSalto);
                if(saltosMultiples.length > 0) {
                    // Bloquea el turno en la pieza actual, permitiendo otro salto consecutivo
                    this.idPiezaForzada = idPieza;
                    this.estaAnimando = false;
                    this.prepararTurno();
                    return; // Retorna para no cambiar de jugador todavía
                }
            }
        }

        // Fin del turno del jugador, resetea estados y cambia de turno
        this.idPiezaForzada = null;
        this.idSeleccionado = null;
        this.jugadorActual = this.jugadorActual === J1 ? J2 : J1;
        this.estaAnimando = false;
        this.prepararTurno();
    },

    // Prepara las validaciones y estados de la UI al iniciar el turno de cada jugador
    prepararTurno() {
        // Obtiene todos los movimientos válidos para el que toca
        this.movimientosValidos = Logica.obtenerTodosMovimientosValidos(this.tablero, this.jugadorActual);
        
        // Si existe obligatoriedad (por salto múltiple), restringe los movimientos solo a esa ficha
        if(this.idPiezaForzada) {
            const pl = this.piezasLogicas.get(this.idPiezaForzada);
            this.movimientosValidos = this.movimientosValidos.filter(m => m.origen.f === pl.f && m.origen.c === pl.c);
        }

        const cajaTurno = document.getElementById('turn-display');
        
        // Fin del juego si el jugador actual no tiene movimientos posibles
        if(this.movimientosValidos.length === 0) {
            cajaTurno.innerText = this.jugadorActual === J1 ? "¡DERROTA! PERDISTE" : "¡VICTORIA! GANASTE";
            cajaTurno.className = "turn-text p1";
            cajaTurno.style.color = "#fff";
            return;
        }

        // Control visual y ejecución según si es humano o máquina
        if(this.jugadorActual === J1) {
            cajaTurno.innerText = "TURNO: JUGADOR";
            cajaTurno.className = "turn-text p1";
            // Si está en salto múltiple, auto-selecciona la pieza obligada para el usuario
            if(this.idPiezaForzada) this.seleccionarPieza(this.idPiezaForzada, this.movimientosValidos);
            
        } else {
            cajaTurno.innerText = "TURNO: ADVERSARIO";
            cajaTurno.className = "turn-text p2";
            // Retraso ligero para dar tiempo al dibujado del DOM antes de bloquear en cálculos de IA
            setTimeout(() => this.activarIA(), 100);
        }
    },

    // Desencadena el cálculo de la IA y ejecuta el resultado
    activarIA() {
        // Ahora lee del select nativo (que está oculto pero se sincroniza)
        const dificultad = document.getElementById('ai-difficulty').value;
        const nombreMetodo = dificultad === 'minimaxClassic' ? "Clásico" : "Alfa-Beta";
        
        // Mide el tiempo de rendimiento para generar estadísticas en pantalla
        const tiempoInicio = performance.now();
        const mejorMovimiento = MotorIA.obtenerMejorMovimiento(this.tablero, dificultad); // Pide movimiento a la lógica Minimax
        const tiempoFin = performance.now();
        const tiempoTomado = (tiempoFin - tiempoInicio).toFixed(2);

        // Dibuja las métricas computacionales reportadas por la IA
        const panelEstadisticas = document.getElementById('ai-stats');
        panelEstadisticas.innerHTML = `
            Métricas deL Adversario:<br>
            Metodología: <span class="stats-highlight">${nombreMetodo}</span><br>
            Nodos Evaluados: <span class="stats-highlight">${MotorIA.nodosEvaluados.toLocaleString()}</span><br>
            Tiempo: <span class="stats-highlight">${tiempoTomado} ms</span>
        `;

        // Ejecuta el movimiento si la IA encontró uno válido
        if(mejorMovimiento) {
            let idPiezaMover = null;
            // Busca el ID visual/lógico de la pieza que la IA decidió mover
            for(let [id, pl] of this.piezasLogicas) {
                if(pl.f === mejorMovimiento.origen.f && pl.c === mejorMovimiento.origen.c) {
                    idPiezaMover = id; break;
                }
            }
            if(idPiezaMover) this.ejecutarMovimiento(mejorMovimiento, idPiezaMover);
        }
    }
};

// Inicia el juego una vez que el DOM está montado
window.addEventListener('DOMContentLoaded', () => { aplicacion.inicializar(); });


// -----------------------------------------------------LÓGICA Y METODOLOGÍAS -------------------------------------------------

// Clase encargada de manejar las reglas del juego de damas, movimientos válidos y estado del tablero.

class Logica {
    // Genera y devuelve el estado inicial del tablero (matriz 8x8)
    static obtenerTableroInicial() {
        let t = Array.from({length: 8}, () => Array(8).fill(VACIO));
        for(let f = 0; f < 8; f++) {
            for(let c = 0; c < 8; c++) {
                // Las piezas solo se colocan en casillas oscuras (donde f+c es impar)
                if((f+c)%2 !== 0) {
                    if(f < 3) t[f][c] = J2;      // Las 3 primeras filas para el Jugador 2
                    else if(f > 4) t[f][c] = J1; // Las 3 últimas filas para el Jugador 1
                }
            }
        }
        return t;
    }

    // Devuelve a qué jugador pertenece una pieza (ignorando si es rey o normal)
    static obtenerJugador(valor) { return (valor === J1 || valor === J1_REY) ? J1 : (valor === J2 || valor === J2_REY) ? J2 : 0; }
    
    // Verifica si la pieza es un Rey/Reina
    static esRey(valor) { return valor === J1_REY || valor === J2_REY; }
    
    // Devuelve el identificador del oponente
    static obtenerOponente(jugador) { return jugador === J1 ? J2 : J1; }
    
    // Verifica si la casilla contiene una pieza del oponente
    static esPiezaOponente(valor, jugador) {
        if (valor === VACIO) return false;
        return this.obtenerJugador(valor) === this.obtenerOponente(jugador);
    }

    // Obtiene todos los movimientos legales posibles para un jugador en el turno actual
    static obtenerTodosMovimientosValidos(tablero, jugador) {
        let movimientos = [];
        let debeSaltar = false; // Bandera para obligar a capturar si hay un salto disponible

        for(let f = 0; f < 8; f++) {
            for(let c = 0; c < 8; c++) {
                const valor = tablero[f][c];
                if(this.obtenerJugador(valor) === jugador) {
                    let movimientosPieza = this.obtenerMovimientosPorPieza(tablero, f, c, valor);
                    for(let mov of movimientosPieza) {
                        if(mov.esSalto) {
                            // Si encontramos un salto, descartamos todos los movimientos simples anteriores
                            if(!debeSaltar) { movimientos = []; debeSaltar = true; }
                            movimientos.push(mov);
                        } else if(!debeSaltar) {
                            // Solo añadimos movimientos simples si no estamos obligados a saltar
                            movimientos.push(mov);
                        }
                    }
                }
            }
        }
        return movimientos;
    }

    // Calcula los movimientos disponibles (simples y saltos) para una pieza específica
    static obtenerMovimientosPorPieza(tablero, f, c, valor) {
        let movimientos = [];
        let direcciones = [];
        
        // Determina la dirección de movimiento según el tipo de pieza (los reyes van en ambas)
        if(valor === J1 || this.esRey(valor)) direcciones.push([-1,-1], [-1,1]); // J1 avanza hacia arriba
        if(valor === J2 || this.esRey(valor)) direcciones.push([1,-1], [1,1]);   // J2 avanza hacia abajo

        for(let [df, dc] of direcciones) {
            let nf = f + df, nc = c + dc; // Coordenadas del movimiento simple
            // Verifica movimiento simple válido
            if(nf >= 0 && nf < 8 && nc >= 0 && nc < 8 && tablero[nf][nc] === VACIO) {
                movimientos.push({ origen: {f, c}, destino: {f: nf, c: nc}, esSalto: false });
            }
            
            let sf = f + df*2, sc = c + dc*2; // Coordenadas de salto (captura)
            // Verifica salto válido pasando sobre una pieza rival
            if(sf >= 0 && sf < 8 && sc >= 0 && sc < 8 && tablero[sf][sc] === VACIO) {
                let medio = tablero[nf][nc]; // La casilla intermedia
                if(this.esPiezaOponente(medio, this.obtenerJugador(valor))) {
                    movimientos.push({ origen: {f, c}, destino: {f: sf, c: sc}, esSalto: true, captura: {f: nf, c: nc} });
                }
            }
        }
        return movimientos;
    }

    // Ejecuta un movimiento en el tablero y devuelve el nuevo estado del tablero
    static aplicarMovimiento(tablero, movimiento) {
        let nt = tablero.map(fila => [...fila]); // Clona la matriz del tablero (nt = nuevo Tablero)
        let valor = nt[movimiento.origen.f][movimiento.origen.c];
        let coronada = false; // Bandera para saber si la pieza se coronó en este turno

        // Mueve la pieza a la nueva posición
        nt[movimiento.origen.f][movimiento.origen.c] = VACIO;
        nt[movimiento.destino.f][movimiento.destino.c] = valor;

        // Si es un salto, elimina la pieza capturada
        if(movimiento.esSalto) nt[movimiento.captura.f][movimiento.captura.c] = VACIO;

        // Lógica de promoción a Rey/Reina al llegar al extremo opuesto
        if(valor === J1 && movimiento.destino.f === 0) { nt[movimiento.destino.f][movimiento.destino.c] = J1_REY; coronada = true; }
        if(valor === J2 && movimiento.destino.f === 7) { nt[movimiento.destino.f][movimiento.destino.c] = J2_REY; coronada = true; }

        return { tablero: nt, coronada: coronada };
    }
}

// Clase MotorIA Contiene la heurística y los algoritmos de búsqueda para el oponente

class MotorIA {
    static nodosEvaluados = 0; 

    // Función de evaluación heurística: calcula quién va ganando en el tablero actual
    static evaluarTablero(t) {
        let puntuacion = 0;
        for(let f = 0; f < 8; f++) {
            for(let c = 0; c < 8; c++) {
                let valor = t[f][c];
                if(valor === VACIO) continue;
                
                // Los reyes valen mucho más (30) que las piezas normales (10)
                let peso = Logica.esRey(valor) ? 30 : 10;
                
                // Bonificación por avance en el tablero (incentiva ir hacia adelante)
                if(valor === J2) peso += (f * 0.5); 
                else if(valor === J1) peso += ((7-f) * 0.5);
                
                // J2 suma puntos positivos (Max), J1 suma puntos negativos (Min)
                puntuacion += (valor === J2 || valor === J2_REY) ? peso : -peso;
            }
        }
        return puntuacion;
    }

    // Punto de entrada: determina y devuelve el mejor movimiento posible
    static obtenerMejorMovimiento(tablero, metodologia) {
        this.nodosEvaluados = 0; 
        const movimientos = Logica.obtenerTodosMovimientosValidos(tablero, J2);
        if(!movimientos.length) return null;

        let mejorPuntuacion = -Infinity; 
        let mejoresMovimientos = [];
        const profundidad = 5; // Profundidad de análisis del árbol de juego

        // Evalúa cada movimiento posible inicial
        for(let mov of movimientos) {
            let {tablero: nt} = Logica.aplicarMovimiento(tablero, mov);
            let evaluacion;
            
            // Elige el algoritmo de búsqueda según la dificultad seleccionada
            if(metodologia === 'alphabeta') {
                evaluacion = this.minimaxAlfaBeta(nt, profundidad - 1, -Infinity, Infinity, false);
            } else {
                evaluacion = this.minimaxClasico(nt, profundidad - 1, false);
            }

            // Guarda el movimiento si es el mejor encontrado hasta ahora
            if(evaluacion > mejorPuntuacion) { mejorPuntuacion = evaluacion; mejoresMovimientos = [mov]; }
            // Si empata en puntuación con el mejor, lo añade a la lista de candidatos
            else if(evaluacion === mejorPuntuacion) mejoresMovimientos.push(mov);
        }
        
        // Si hay varios movimientos igualmente buenos, elige uno al azar para variar las partidas
        return mejoresMovimientos[Math.floor(Math.random() * mejoresMovimientos.length)];
    }

    // Metodología Minimax (recorre todos los nodos hasta 'profundidad')
    static minimaxClasico(t, profundidad, esMax) {
        this.nodosEvaluados++; 
        // Condición de parada: límite de profundidad alcanzado
        if(profundidad === 0) return this.evaluarTablero(t);
        
        const movimientos = Logica.obtenerTodosMovimientosValidos(t, esMax ? J2 : J1);
        // Si no hay movimientos posibles, se le da una puntuación penalizadora de pérdida
        if(!movimientos.length) return esMax ? -1000 : 1000;

        if(esMax) {
            let maxEval = -Infinity;
            for(let mov of movimientos) {
                let {tablero: nt} = Logica.aplicarMovimiento(t, mov);
                let ev = this.minimaxClasico(nt, profundidad - 1, false);
                maxEval = Math.max(maxEval, ev);
            }
            return maxEval;
        } else {
            let minEval = Infinity;
            for(let mov of movimientos) {
                let {tablero: nt} = Logica.aplicarMovimiento(t, mov);
                let ev = this.minimaxClasico(nt, profundidad - 1, true);
                minEval = Math.min(minEval, ev);
            }
            return minEval;
        }
    }

    // Metodología Poda Alfa-Beta (optimizado para descartar ramas inútiles)
    static minimaxAlfaBeta(t, profundidad, alfa, beta, esMax) {
        this.nodosEvaluados++;
        // Condición de parada
        if(profundidad === 0) return this.evaluarTablero(t);
        
        const movimientos = Logica.obtenerTodosMovimientosValidos(t, esMax ? J2 : J1);
        if(!movimientos.length) return esMax ? -1000 : 1000;

        if(esMax) {
            let maxEval = -Infinity;
            for(let mov of movimientos) {
                let {tablero: nt} = Logica.aplicarMovimiento(t, mov);
                let ev = this.minimaxAlfaBeta(nt, profundidad - 1, alfa, beta, false);
                maxEval = Math.max(maxEval, ev);
                alfa = Math.max(alfa, ev);
                // Poda: si beta <= alfa, no tiene sentido seguir explorando esta rama
                if(beta <= alfa) break; 
            }
            return maxEval;
        } else {
            let minEval = Infinity;
            for(let mov of movimientos) {
                let {tablero: nt} = Logica.aplicarMovimiento(t, mov);
                let ev = this.minimaxAlfaBeta(nt, profundidad - 1, alfa, beta, true);
                minEval = Math.min(minEval, ev);
                beta = Math.min(beta, ev);
                // Poda Alfa-Beta en el nodo minimizador
                if(beta <= alfa) break; 
            }
            return minEval;
        }
    }
}