# Reglas del motor de fabricación (calcVersion 1.0.0)

Código: `packages/domain/src/engine/`. Valores configurables: `ENGINE_DEFAULTS` (`module.ts`), `PricingSettings` y `CutSettings` del proyecto. Ninguno es una norma universal.

## Convenciones

- Unidades: mm; dinero en centavos MXN enteros.
- Ejes del módulo: X ancho, Y profundidad (0 = frente), Z altura; origen en la esquina frontal-inferior-izquierda. Los módulos se colocan en fila sobre X y se alinean por el respaldo (contra muro).
- La altura exterior `H` es la de la caja; la base (zoclo/patas/bastidor) se suma aparte (`overallHeightMm`).
- Dos medidas por pieza: **final** (la que queda armada, con canto) y **de corte** (la que se corta). Ver «Medida de corte».
- `L1/L2` = aristas a lo largo del largo de la pieza; `A1/A2` = aristas del ancho. `L1` es la arista frontal visible en piezas de caja.
- ID de pieza: `<módulo>-<código>` (p. ej. `M01-SIDE`); cada pieza lleva una posición 3D por unidad (`placements`).

## Medida de corte (compensación de canto)

- Canto en L1/L2 (aristas a lo largo del largo) reduce el **ancho** de corte; en A1/A2 reduce el **largo**.
- `corte = final − espesor de canto × aristas canteadas + repasado × aristas canteadas` (si `edgeCompensation` está activo; por defecto sí, repasado 0).
- El acomodo de tableros y la verificación de formato usan la medida de corte; la geometría 3D, la final.
- Ejemplo verificado: puerta 716 × 396.5 mm con canto de 0.45 mm en las 4 aristas → corte 715.1 × 395.6 mm; con canto de 2 mm → 712 × 392.5 mm.

## Flecha y divisores automáticos

- Viga simplemente apoyada con carga uniforme: `δ = 5·w·L⁴ / (384·E·I)`, `I = fondo·t³/12`.
- Carga = peso propio (densidad × espesor) + carga útil del módulo o de su familia (kg/m²: ropa/baño 25, cocina 30, despensa/lavandería 40, libros 80).
- Flecha final = δ peso propio·(1 + kdef) + δ carga útil·(1 + kdef·0.6). kdef (Eurocódigo 5, clase de servicio 1): aglomerado/MDF 2.25, contrachapado 0.8, madera maciza 0.6.
- Admisible: claro / 200 (0.5 %), configurable. Divisores automáticos = el mínimo con el que cumple (huecos ≥ 250 mm).
- E y densidad son valores típicos (melamina 2800 MPa / 650 kg/m³, MDF 3000 / 750, contrachapado 6000 / 600, roble 10000 / 700): usar la ficha del tablero para cálculo definitivo.
- Ejemplo verificado: entrepaño 764 × 554 × 18 mm, 30 kg/m² → 1.33 mm inmediata, 3.47 mm a largo plazo ≤ 3.82 mm.

## Caja

| Elemento | Regla |
|---|---|
| Profundidad de caja | `cd = D − espesor respaldo − (frente ≠ abierto ? T : 0)`; error si `cd < 100`. |
| Tapa/piso entre costados | Costados `H × cd`; horizontales `(W − 2T) × cd`. |
| Costados entre tapa/piso | Horizontales `W × cd`; costados `(H − 2T) × cd`. |
| Respaldo sobrepuesto | `H × W × B`, fijado con tornillos a paso 150 mm (orientativo). Si no cabe en el tablero (−10 mm de escuadrado por lado), se divide en el mínimo de secciones con juntas sobre divisores; sin divisor útil, en partes iguales con aviso de listón. Sin respaldo ⇒ advertencia de escuadra. |
| Divisores | Automático por flecha calculada (ver arriba) o número manual. Con cajones se omiten. |
| Entrepaños | `(hueco − 2) × (cd − 5)`, equiespaciados; 4 soportes Ø5 por entrepaño. Advertencia si el hueco excede la luz libre. |
| Clóset | Por hueco: maletero a 350 mm de la tapa y tubo 50 mm debajo; si hay ≥2 huecos y `entrepaños > 1`, el último hueco es torre de entrepaños. Antivuelco obligatorio. |
| Puertas | n = automático `huecos × ceil(W/huecos/600)` o manual. Sin divisores: ancho `(W − 2r − (n−1)g)/n`. Con divisores: ancho por tramo, con las juntas centradas sobre cada divisor (las hojas extremas cubren además el costado y pueden diferir de las centrales: DOOR, DOOR_2). Alto `H − 2r`. Bisagras por alto de puerta; las hojas que giran sobre un divisor reciben bisagra de semi-solape. |
| Cajones | Frentes `(H − 2r − (n−1)g)/n × (W − 2r)`. La caja sólo se calcula con corredera que declare holgura lateral y largos nominales: largo = mayor nominal ≤ `cd − 10`; ancho = `W − 2T − 2·holgura`; costados/frente-trasera del espesor que pide la corredera; fondo 6 mm sobrepuesto. |
| Uniones | 4 uniones de caja + 2 por divisor; conectores por unión: 2 (≤400 mm), 3 (≤700), 4. Excéntrico + taquete, taquete, tornillo o mixta. |
| Base | Patas niveladoras (4 o 6), bastidor de zoclo remetido 40 mm, o bastidor PTR (validación estructural obligatoria). |
| Montaje | A muro ⇒ colgadores + bloqueo `WALL_MOUNT_VALIDATION`. Piso con altura ≥ 1200 mm, clóset, o cajonera ≥ 600 mm ⇒ antivuelco + bloqueo `ANTITIP_REQUIRED`. |

## Escritorio

Cubierta `W × D`; costados tipo panel `(H − T) × D`; faldón `(W − 2T) × min(280, H − T − 120)` remetido 20 mm. Advertencias de claro de cubierta, altura libre (< 620 mm) y ancho libre (< 600 mm). Con PTR: 4 patas, 2 largueros y 2 travesaños; bloqueo `STEEL_LOAD_VALIDATION_REQUIRED`.

## Verificación dimensional (en cada cálculo)

Se reconstruye el mueble con las posiciones de cada pieza y se comprueba, con resultado esperado vs. calculado:

| Tipo | Comprobación |
|---|---|
| Cierre | La envolvente de las piezas mide exactamente ancho, fondo y alto pedidos (con PTR: pata + tablero = alto). Cada posición 3D = medida final de su pieza. Hojas + juntas = ancho cubierto; frentes de cajón + juntas = alto cubierto. |
| Apoyos | Grafo de contacto: toda pieza toca otra (tolerancia 1.5 mm; cajas de cajón con la holgura de la corredera). |
| Cantos | Ancho del canto ≥ espesor + 1 mm de refilado; compensación activa. |
| Espesores | Espesor de pieza = espesor nominal del material. |
| Taller | Ancho mínimo de corte (30 mm) y tamaño mínimo para canteadora (50 mm transversal, 150 mm de arista), configurables. |
| Frentes | Holgura perimetral < espesor del costado; juntas centradas sobre divisores. |
| Herrajes | Espesor de puerta dentro del rango de la bisagra; peso de puerta vs. capacidad si el producto la declara; altura de base dentro del ajuste de la pata. |
| Flecha | Entrepaños, piso sin zoclo y cubierta de escritorio sin faldón. |
| Peso | Peso estimado de tableros por módulo. |

## Validaciones geométricas

- Pieza que no cabe en el tablero (respetando veta si el acabado la tiene) ⇒ error `PART_EXCEEDS_SHEET`.
- Interferencia volumétrica entre cualquier par de piezas ⇒ error `COLLISION`.
- Módulo vecino más profundo con frentes ⇒ `DOOR_OPENING_INTERFERENCE`.
- Mecanizado verificado: barreno ciego que deja menos del remanente mínimo ⇒ `MACHINING_DEPTH_EXCEEDS`; barrenos traslapados ⇒ `MACHINING_HOLE_COLLISION`; fuera de pieza ⇒ `MACHINING_OUTSIDE_PART`.
- Diagonales medidas: diferencia > tolerancia ⇒ `DIAGONAL_OUT_OF_TOLERANCE` (no fabricable).

## Severidades y liberación

`error` (no fabricable) · `blocker` (requiere validación externa documentada) · `warning` · `info`.
Liberación: `NO_FABRICABLE` si hay errores; `PENDIENTE_VALIDACION` si hay bloqueos o mecanizado sin ficha; `LISTO_PARA_APROBACION` si no; `LIBERADO_CON_APROBACION` sólo con responsable y, si había pendientes, evidencia.

## Tapacanto

Largo neto = Σ aristas marcadas × cantidad. Compra = (neto + tramos × margen por tramo) × (1 + merma de rollo).

## Corte

Guillotina BSSF con división por eje de menor sobrante; kerf entre piezas; escuadrado por lado; rotación sólo si la pieza no tiene veta o el acabado no la muestra. Sólo un acomodo completo da `layout_factible`.

## Presupuesto

1. Requerimientos: tableros (del acomodo), canto (m), herrajes agregados por clave, herrería (m de barras completas), servicios manuales.
2. Ofertas por clave equivalente: neto = precio ÷ (1 + IVA) si el IVA está incluido; compra = `ceil(requerido / presentación)`.
3. Selección: manual por requerimiento o automática (la utilizable más barata). No utilizables: `PENDIENTE`, vencidas, IVA no definido, `ESTIMADO` sin permiso, sin disponibilidad.
4. Venta: margen `costo/(1−m)` o markup `costo×(1+k)`; IVA sobre la venta.
5. Estado: `INCOMPLETO` si falta un precio obligatorio (o la oferta elegida está vencida o sin IVA definido); `SIMULACION` si usa estimados; `COMPLETO` en otro caso. Sin ninguna línea con precio, los importes son `null`.
