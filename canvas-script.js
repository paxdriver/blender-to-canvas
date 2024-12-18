(async function() { // wrapped in IIFE so that this script can be imported and called by another project with configurations provided by the caller, or a dom element can be provided to attach the canvas and animation to a container div or something...

// Gather data stored as json from python script that was run in Blender to extract model data
async function get_model_data(){
    const result = await fetch('./firstcube-01.json').then(response => response.json())
    return result
}

// arc tangent can distinguish direction, unlike rise/run which is pinned to 180 degrees
const calculate_radians_angle = (x1, y1, x2, y2) => {
    let result = Math.atan2(y2-y1, x2-x1)

    if (isNaN(result)) {
        console.error("ATAN2 got a bad value!!!!")
        console.log(arguments)
        result = 0
        debugger
    }
    return result
}

// Pythatgoras theorem for calculating distance
const calculate_distance = (x1, y1, x2, y2) => {
    let result = Math.sqrt((x2-x1) ** 2 + (y2-y1) ** 2)
    if (isNaN(result)) {
        console.error("ATAN2 got a bad value!!!!")
        console.log(arguments)
        result = 0
    }
    return result
}


// DEV ONLY -------------------------  ANIMATION ON/OFF TOGGLE
let animate = 1
// setTimeout( () => animate = 0, 23000)
// DEV ONLY -------------------------  ANIMATION ON/OFF TOGGLE

// GLOBAL VARIABLES TO TWEAK AND ALTER DEPENDING ON USE CASE
// const CAMERA_POSITION = [0, 0, 0]    // for later
let CAMERA_DISTANCE = 1                 // init value, this is updated in setScaleFactor()
const FLOAT_BUFFER_SIZE = 4                   // 4 bytes per float32, 2 bytes per int16
const MODEL_POSITION_ADJUSTMENT = [100, 100]    // if the imported model is clipping or not positioned exactly right, use this to apply [x, y] pixel offsets to the canvas of the model being imported
const MODEL_SCALER = 0.5                 // if your model doesn't fit nicely in the frame, use this to scale it up or down. Values smaller than 1 will shrink the mesh, and values greater than 1 will scale larger.
const [WIDTH, HEIGHT, SIZE] = [250, 200, 2 * MODEL_SCALER]
const BASIC_MINIMUM = 0.000001
            // DEV NOTE: consider making conversion scaler more dynamic, based on the canvas size or something...
const INT_CONVERSION_SCALER = 100        // coords imported by Blender need to be scaled to pixel values
const DEPTH_SCALER = 2                  // kind of like aperture or depth of field
const DEBOUNCER_DELAY = 125             // delay in miliseconds between mouse movement events to recalculate the mesh
const MAX_ROTATION_SPEED = 0.25         // this is the max speed of rotation per axis
const ROTATION_SENSITIVITY = 0.0002        // this is the divisor applied to mouse coordinates to compute rotation speed
const BASELINE_ROTATIONS = [0.0175, 0.0125, 0.0075]        // when producing decaying rotations, this will be the levels they all gravitate back toward.

// ---------------------------------------------------------
let minmaxZ = {min: 1, max: 1}  // initialized value, will be updated when Vert class objects get created.
// ---------------------------------------------------------

// INITIALIZE CANVAS AND THE PAGE
const canvas = document.getElementById('canvas')
canvas.width = WIDTH*2
canvas.height = HEIGHT*2
canvas.style.backgroundColor = 'rgba(255,255,255,0)'
canvas.style.border = '1px solid rgba(22,22,200,0.25)'
canvas.style.boxShadow = '3px 3px 5px rgba(0,0,0,0.5), -3px -3px 2px rgba(0,0,0,0.1)'
// canvas.style.boxShadow = '-3px -3px 3px rgba(0,0,0,0.25)'
canvas.style.borderRadius = '5%'
canvas.style.width = `${WIDTH}px`
canvas.style.height = `${HEIGHT}px`
const ctx = canvas.getContext('2d')
ctx.translate((WIDTH/2 + MODEL_POSITION_ADJUSTMENT[0]), (HEIGHT/2 + MODEL_POSITION_ADJUSTMENT[1]))

// SET UP GLOBAL ROTATIONS WITH INITIALIZED VALUES
const _rotationsBuffer = new ArrayBuffer(FLOAT_BUFFER_SIZE*3)
let ROTATIONS = new Float32Array(_rotationsBuffer)
BASELINE_ROTATIONS.forEach( (v, i) => ROTATIONS[i] = v )

// DEV NOTE: Int16 uses 2 bytes per element, so 4 coordinate elements and one bounce flag -> 5 * 2
const mouse_buffer = new ArrayBuffer(12) // [x, y, previous_x, previous_y, bounce_flag_boolean, mouse_change_distance]
let mouse = new Int16Array(mouse_buffer)
mouse.fill(2)

// const DAMPEN_ROTATION = (current_amount, distance=1) => current_amount - (distance / BASIC_MINIMUM)

// let result = current_amount - ( distance * (1 / (1 + MAX_ROTATION_SPEED)) )
// let result = current_amount * (mouse[5] * (1 / (1 + MAX_ROTATION_SPEED) ) * (distance * 100))

// THE FUNCTION WE APPLY TO GET NEW ROTATION AMOUNTS
function dampen_all_rotations(){
    // THE DAMPENING FUNCTION ITSELF (reduce rotation speed incrementally based on the mouse displacement and current rotation value)
    const DAMPEN_ROTATION = current_rotation => {
        console.log(`CURRENT_ROTATION: ${current_rotation}`)
        if (current_rotation == 0 || Math.abs(current_rotation) < BASIC_MINIMUM) return 0

        // if (mouse[5] > 0){
            console.log(`distance is: ${mouse[5]}`)

            let result
            if (current_rotation > 0) {
                result = current_rotation - 0.0001
                // result = (current_rotation - (current_rotation + BASIC_MINIMUM/(ROTATION_SENSITIVITY*mouse[5])) )
                // console.log(`new rotation is: ${result}`)
                mouse[5]--
                return result
            }
            else if (current_rotation < 0){
                result = current_rotation + 0.0001
                // result = (current_rotation + (current_rotation + BASIC_MINIMUM/(ROTATION_SENSITIVITY*mouse[5])) )
                // console.log(`new rotation is: ${result}`)
                mouse[5]--
                return result
            }
        // }
        else return 0
    }

    if (mouse[5] && mouse[5] > 1) {
        if (Math.abs(ROTATIONS[0]) > 0) ROTATIONS[0] = DAMPEN_ROTATION(ROTATIONS[0]) // TO FIX
        if (Math.abs(ROTATIONS[1]) > 0) ROTATIONS[1] = DAMPEN_ROTATION(ROTATIONS[1]) // TO FIX
        if (Math.abs(ROTATIONS[2]) > 0) ROTATIONS[2] = DAMPEN_ROTATION(ROTATIONS[2]) // TO FIX!!! 
    }
}


    // Get mouse movements with a debouncer so as not to clobber the engine with event callbacks.
// the timeout container, used as a shared reference to be cleared to avoid overlapping / race conditions
let debounceTimeout = null  
// reset debouncing flag in debounceTimeout
const resetBounce = () => mouse[4] = 1

// Z axis rotations are calculated based on angle of the 2 mouse positions, as opposed to the Euclidean distance    
function calculate_rotation_amount(a, b){ 
    // let result = (a-b) * (ROTATION_SENSITIVITY)
    let result = a-b
    if (result !== 0) result = result / ( 1 + a / b)
    // let result = (a-b) * (ROTATION_SENSITIVITY*DEPTH_SCALER)
    // check the rotation's direction by the sign but make sure it's capped by the maximum rotation speed allowed
    if (result < -MAX_ROTATION_SPEED) result = -MAX_ROTATION_SPEED 
    // cap the max
    else if(result > MAX_ROTATION_SPEED) result = MAX_ROTATION_SPEED
    // set the min - no change or too small of a change, set rotation to stop
    else if(Math.abs(result) < BASIC_MINIMUM) result = 0
    return result
}

// Listener for tracking mouse movements to apply rotational changes to the mesh
canvas.addEventListener( 'mousemove', e => {
    if (mouse[4] !== 0) {
        
        // bounce flag
        mouse[4] = 0
        
        // store old mouse x,y 
        mouse[2] = mouse[0]
        mouse[3] = mouse[1]

        // store new mouse x,y
        mouse[0] = e.clientX
        mouse[1] = e.clientY
        
        // get DISTANCE between mouse coords for SPEED OF ROTATION
        mouse[5] = calculate_distance(mouse[0], mouse[1], mouse[2], mouse[3])

        // check for x rotation change based on new coordinates (returns signed value for direction)
        if (mouse[0] !== mouse[2]) ROTATIONS[0] = calculate_rotation_amount(mouse[0], mouse[2])

        // else if (Math.abs(ROTATIONS[0]) < BASIC_MINIMUM) ROTATIONS[0] = 0
    
        // check for y rotation change based on new coordinates (returns signed value for direction)
        if (mouse[1] !== mouse[3]) ROTATIONS[1] = calculate_rotation_amount(mouse[1], mouse[3])
        // else if (Math.abs(ROTATIONS[1]) < BASIC_MINIMUM) ROTATIONS[1] = 0
    
        // DEV NOTE: ANGLE of mouse displacement is used to ROTATEZ rather than x or y distance from previous mark
        // provide the angle in radians, and the distance the mouse travelled to scale the speed of the rotation
        ROTATIONS[2] = calculate_radians_angle(mouse[0], mouse[1], mouse[2], mouse[3])

        // else if (Math.abs(ROTATIONS[2]) < BASIC_MINIMUM) ROTATIONS[2] = 0


        // garbage collection
        clearTimeout(debounceTimeout)   // clear existing timeouts before setting the latest one
        debounceTimeout = setTimeout( resetBounce, DEBOUNCER_DELAY )
        console.log(mouse)
    }
} )
// --------- END MOUSE TRACKING ----------------------------------


// Rendering datapoints to canvas from edges and verts
function drawLineFromTo(a, b){ // a and b are arrays [x,y,z]
    ctx.beginPath()
    ctx.moveTo(a[0]*SIZE, a[1]*SIZE)
    ctx.lineTo(b[0]*SIZE, b[1]*SIZE)
    ctx.stroke()
}


// When z coordinates change from a rotation, the range of z values across all points changes. This function calculates the new scaleFactor based on the new z coordinate after a rotation changes the z coordinate
function setScaleFactor(z){
    let scaleFactor = BASIC_MINIMUM
    if (minmaxZ.min !== minmaxZ.max && z !== 0) { // prevent divide by zero
        const zRange = minmaxZ.max - minmaxZ.min
        CAMERA_DISTANCE = zRange * 10
        scaleFactor = CAMERA_DISTANCE / (CAMERA_DISTANCE + Math.abs(z))
    }
    return scaleFactor
}

/*  VERTICES
    The data contain all of the {x,y,z} coordinates for each vertex under the "vertices" key.

    EDGES
    The data.edges contains an array of edges, with "v1" being the index of the point in the vertices array and "v2" being the second index of the vertex it connects to.

    BUFFERED DATA CLASS
    Since Vert extends BufferedData, apply transformation methods in BufferedData rather than Vert class to ensure the functions are not being needlessly copied with each instantiation of vertices.
*/

// Methods to be included with every Vert class object can be inherited from here to save memory and latency
class BufferedData{
    constructor(bufferLength) {
        this.buffer = new ArrayBuffer(bufferLength)
        this.view = new Float32Array(this.buffer)
        this._tmpBuffer = new ArrayBuffer(bufferLength)
        this._tmp = new Float32Array(this._tmpBuffer)
    } // Setter for when Vert class object is initialized
    setView(x, y, z){ // Float values of coordinates from imported data
        this.view[0] = x
        this.view[1] = y
        this.view[2] = -z
        this.scaleFactor = setScaleFactor(z)
    }
    // returns HTML canvas-friendly integer value
    getX(scaleFactor){
        let xValue = this._tmp[0] || this.view[0]
        this.computed_view[0] = Math.round(xValue * INT_CONVERSION_SCALER * scaleFactor)
    }
    // returns HTML canvas-friendly integer value
    getY(scaleFactor){
        let yValue = this._tmp[1] || this.view[1]
        this.computed_view[1] = Math.round(yValue * INT_CONVERSION_SCALER * scaleFactor)
    }
    updateCoordsWithDepthFactor(){
        this.getX(this.scaleFactor)
        this.getY(this.scaleFactor)
    }

    // Applies new X,Y coordinate based on X axis rotation amount, and then recalculates the Vert's scaleFactor which is dependent on the z value range from one from to the next
    rotateX(rot_speed){ // produces new normalized coordinates
        let yValue = this._tmp[1] || this.view[1]   // checks if there are last computed values to use
        let zValue = this._tmp[2] || this.view[2]   // checks if there are last computed values to use
        this._tmp[1] = (yValue * Math.cos(rot_speed)) + (zValue * Math.sin(rot_speed)) // assigns computed coordinates
        this._tmp[2] = (zValue * Math.cos(rot_speed)) - (yValue * Math.sin(rot_speed)) // assigns computed coordinates
        this.scaleFactor = setScaleFactor(this._tmp[2]) // as z changes, each Vert needs new scaleFactor computation

    } // Applies new X,Y coordinate based on Y axis rotation amount & recalc Vert's scaleFactor
    rotateY(rot_speed){
        let xValue = this._tmp[0] || this.view[0]
        let zValue = this._tmp[2] || this.view[2]
        this._tmp[0] = (xValue * Math.cos(rot_speed)) + (zValue * Math.sin(rot_speed))
        this._tmp[2] = (zValue * Math.cos(rot_speed)) - (xValue * Math.sin(rot_speed))
        this.scaleFactor = setScaleFactor(this._tmp[2])

    } // Applies new X,Y coordinate based on Y axis rotation amount & recalc Vert's scaleFactor
    rotateZ(angle){ 

        // FIX THIS!!! ROTATION ANGLE NEEDS AN ALGORITHM TO GET SPEED FROM MOUSE DISTANCE

        let xValue = this._tmp[0] || this.view[0]
        let yValue = this._tmp[1] || this.view[1]
        console.log(`ROTATEZ's angle: ${angle}`)
        console.log(`ROTATEZ's coordinates: ${this._tmp[0]}, ${this._tmp[1]}`)
        this._tmp[0] = (xValue * Math.cos(angle)) - (yValue * Math.sin(angle))
        this._tmp[1] = (xValue * Math.sin(angle)) + (yValue * Math.cos(angle))
        console.log(`ROTATEZ's coordinates: ${this._tmp[0]}, ${this._tmp[1]}`)
        debugger

    }
    applyRotations(){ // apply all rotations, but only call the methods with rotations that need to be applied (ie: non-zero)
        if (ROTATIONS[0] !== 0) { this.rotateX(ROTATIONS[0]) }
        if (ROTATIONS[1] !== 0) { this.rotateY(ROTATIONS[1]) }
        if (ROTATIONS[2] !== 0) { this.rotateZ(ROTATIONS[2]) }
    }
}
// VERT CLASS - inherits array buffer of typed arrays, compute functions, and update functions
class Vert extends BufferedData {
    constructor(x, y, z){
        super(FLOAT_BUFFER_SIZE * 3)
        this.setView(x,y,z)
        this.scaleFactor = setScaleFactor(z)
        this.computed_buffer = new ArrayBuffer(2 * Int32Array.BYTES_PER_ELEMENT)
        this.computed_view = new Int32Array(this.computed_buffer) // [x, y] integer coordinates
    }
}
class Edge {
    // Receives the index for the particular Vert object it connecting this edge. These are index values of the Vert, not the Vert's coordinates
    constructor(v1, v2){
        this.a = v1
        this.b = v2
    }
}

// Generate Vert class object data for each vertex included in the imported json
function init_map_verts(vert_data){
    minmaxZ = calculate_scale_factor(vert_data)
    const output = []
    vert_data.forEach( v => {
        const vert = new Vert(v.x, v.y, v.z)
        output.push(vert)
    })
    return output
} // Generate Edge class object data passed to all Vert class objects
function init_map_edges(edge_data, all_vertices){
    const output = []
    edge_data.forEach( v => {
        const edge = new Edge(all_vertices[v.v1],all_vertices[v.v2])
        output.push(edge)
    })
    return output
}

// Once all Vert objects are created, find the depth ranges and store a scaler in each object to be used to recalculate the x, y coordinates in 2D space with a scaler for depth adjustments
function calculate_scale_factor(vertices){
    vertices.forEach( vert => {
        if (vert.z < minmaxZ.min) minmaxZ.min = vert.z
        if (vert.z > minmaxZ.max) minmaxZ.max = vert.z
    })
    return minmaxZ
}   

function assign_updated_scale_factor(all_vertices){
    all_vertices.forEach( v => v.scaleFactor = setScaleFactor(v._tmp[2]) )
}

// ENTRY POINT
async function main(){
    
    const data = await get_model_data()
    const {vertices, edges} = data
    
    // Map data as float32 array buffer values in Vert class objects
    const all_vertices = init_map_verts(vertices) // array of all Vert objects
    
    // this will be for applying rotations, translations, etc later...
    const all_edges = init_map_edges(edges, all_vertices) // array of all edges connecting 2 Vert objects


    // find range of depth to scale coordinates (smaller change for further away)
    function render(){
        ctx.clearRect(-WIDTH, -HEIGHT, WIDTH*2, HEIGHT*2)

        all_vertices.forEach( (vertex, idx, arr) => {
            vertex.applyRotations() // Gets new coordinates from radians rotation held in this.rotations[x,y,z]
            if (idx == arr.length-1) { // check if the current iteration is the last element so that global minmaxZ can be updated only once instead of on every iteration
                // Check if rotations are applied to X or Y axes which will affect the z-range so that we only recalculate the minmaxZ when we have to

                if (ROTATIONS[0] !== 0 || ROTATIONS[1] !==0) {
                    minmaxZ = calculate_scale_factor(arr)
                    assign_updated_scale_factor(arr) // apply new scaleFactor for new z coordinates after all of the rotations are done and applied, with new computed values already stored and ready to render
                }
            }
        })
        
        // update x,y,z coordinates with new values from the rotation
        all_vertices.forEach( vertex => {
            vertex.updateCoordsWithDepthFactor()
        })
        
        // edges are all already just references to the Vert objects, so those updates will be live and good still
        all_edges.forEach( vert_pair => {
            drawLineFromTo(vert_pair.a.computed_view, vert_pair.b.computed_view)
        })
        
        // WORK IN PROGRESS ----------------------------------
        console.log(`ROTATIONS BEFORE: ${ROTATIONS}`)
        dampen_all_rotations()
        console.log(`ROTATIONS AFTER: ${ROTATIONS}`)
        // debugger
        // WORK IN PROGRESS ----------------------------------
        
        if (animate) requestAnimationFrame(render)
        }
    
    setInterval( ()=>{
        console.log("====================")
        console.log(all_vertices[all_vertices.length-1])
        console.log(mouse)
        console.log("====================")
        console.log("")
    }, 1500)
    
    render()
}

main()
})()