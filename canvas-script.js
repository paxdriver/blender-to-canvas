(async function() { // wrapped in IIFE so that this script can be imported and called by another project with configurations provided by the caller, or a dom element can be provided to attach the canvas and animation to a container div or something...

// Gather data stored as json from python script that was run in Blender to extract model data
async function get_model_data(){
    const result = await fetch('./firstcube.json').then(response => response.json())
    return result
}

// DEV ONLY -------------------------  ANIMATION ON/OFF TOGGLE
let animate = 1
setTimeout( () => animate = 0, 23000)
// DEV ONLY -------------------------  ANIMATION ON/OFF TOGGLE

// GLOBAL VARIABLES TO TWEAK AND ALTER DEPENDING ON USE CASE
// const CAMERA_POSITION = [0, 0, 0]    // for later
const BUFFER_SIZE = 4
const [WIDTH, HEIGHT, SIZE] = [500, 500, 2]
const BASIC_MINIMUM = 0.0000000000000001
            // DEV NOTE: consider making conversion scaler more dynamic, based on the canvas size or something...
const INT_CONVERSION_SCALER = 10        // coords imported by Blender need to be scaled to pixel values
const DEPTH_SCALER = 1.75               // kind of like aperture or depth of field
const DOT_SIZE = 5                      // dots or points plotted on each Vert
const MIN_DOT_SIZE = 1                  // minimum dot radius, as they are scaled based on z values
const DEBOUNCER_DELAY = 300             // delay in miliseconds between mouse movement events to recalculate the mesh
const MAX_ROTATION_SPEED = 0.05         // this is the max speed of rotation per axis
const ROTATION_SENSITIVITY = 10000        // this is the divisor applied to mouse coordinates to compute rotation speed
// ---------------------------------------------------------
let minmaxZ = {min: 1, max: 1}  // initialized value, will be updated when Vert class objects get created.
// ---------------------------------------------------------

// initialize the canvas and page
const canvas = document.getElementById('canvas')
canvas.style.backgroundColor = 'beige'
canvas.style.border = '1px solid blue'
canvas.style.width = WIDTH
canvas.style.height = HEIGHT
canvas.width = WIDTH
canvas.height = HEIGHT
const ctx = canvas.getContext('2d')
ctx.translate(WIDTH/2, HEIGHT/2)

// Rendering datapoints to canvas from edges and verts
function drawLineFromTo(a, b){ // a and b are arrays [x,y,z]
    ctx.beginPath()
    ctx.moveTo(a[0]*SIZE, a[1]*SIZE)
    ctx.lineTo(b[0]*SIZE, b[1]*SIZE)
    ctx.lineCap = "round"
    ctx.stroke()
}
function drawVerts(x, y, scaleFactor){
    let _dot_size = DOT_SIZE * (scaleFactor - DEPTH_SCALER)
    if (_dot_size < MIN_DOT_SIZE) _dot_size = MIN_DOT_SIZE
    ctx.beginPath()
    ctx.arc(x*SIZE, y*SIZE, _dot_size, 0, 2 * Math.PI)
    ctx.stroke()
}

/*  VERTICES
    The data contain all of the {x,y,z} coordinates for each vertex under the "vertices" key.

    EDGES
    The data.edges contains an array of edges, with "v1" being the index of the point in the vertices array and "v2" being the second index of the vertex it connects to.

    BUFFERED DATA CLASS
    Since Vert extends BufferedData, apply transformation methods in BufferedData rather than Vert class to ensure the functions are not being needlessly copied with each instantiation of vertices.
*/

// When z coordinates change from a rotation, the range of z values across all points changes. This function calculates the new scaleFactor based on the new z coordinate after a rotation changes the z coordinate
function setScaleFactor(z){
    let scaleFactor = BASIC_MINIMUM
    if (minmaxZ.min !== minmaxZ.max) { // prevent divide by zero
        const zRange = minmaxZ.max - minmaxZ.min
        const zNormalized = (z - minmaxZ.min !== 0) ? (z - minmaxZ.min) / zRange : BASIC_MINIMUM
        scaleFactor = 1 / (1 + zNormalized)
        scaleFactor += DEPTH_SCALER
    }
    return scaleFactor
}

// Methods to be included with every Vert class object can be inherited from here to save memory and latency
class BufferedData{
    constructor(bufferLength) {
        this.buffer = new ArrayBuffer(bufferLength)
        this.view = new Float32Array(this.buffer)
        this._tmpBuffer = new ArrayBuffer(bufferLength)
        this._tmp = new Float32Array(this._tmpBuffer)
        this._rotationsBuffer = new ArrayBuffer(bufferLength)
        this.rotations = new Float32Array(this._rotationsBuffer)
    } // Setter for when Vert class object is initialized
    setView(x, y, z){ // Float values of coordinates from imported data
        this.view[0] = x
        this.view[1] = y
        this.view[2] = z
        this.rotations = [0.025, 0.04, 0.05]
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
    // DEV NOTE: don't need getZ() right now
    // getZ(){ return }
    
    updateCoordsWithDepthFactor(){
        this.getX(this.scaleFactor)
        this.getY(this.scaleFactor)
        // this.getZ()
    }
    rotateX(angle){ // produces new normalized coordinates
        let yValue = this._tmp[1] || this.view[1]   // checks if there are last computed values to use
        let zValue = this._tmp[2] || this.view[2]   // checks if there are last computed values to use
        this._tmp[1] = (yValue * Math.cos(angle)) + (zValue * Math.sin(angle)) // assigns computed coordinates
        this._tmp[2] = (zValue * Math.cos(angle)) - (yValue * Math.sin(angle)) // assigns computed coordinates
        this.scaleFactor = setScaleFactor(this._tmp[2]) // as z changes, each Vert needs new scaleFactor computation
    }
    rotateY(angle){
        let xValue = this._tmp[0] || this.view[0]
        let zValue = this._tmp[2] || this.view[2]
        this._tmp[0] = (xValue * Math.cos(angle)) + (zValue * Math.sin(angle))
        this._tmp[2] = (zValue * Math.cos(angle)) - (xValue * Math.sin(angle))
        this.scaleFactor = setScaleFactor(this._tmp[2])
    }
    rotateZ(angle){
        let xValue = this._tmp[0] || this.view[0]
        let yValue = this._tmp[1] || this.view[1]
        this._tmp[0] = (xValue * Math.cos(angle)) - (yValue * Math.sin(angle))
        this._tmp[1] = (xValue * Math.sin(angle)) + (yValue * Math.cos(angle))
    }
    applyRotations(){ // apply all rotations, but only call the methods with rotations that need to be applied (ie: non-zero)
        if (this.rotations[0] !== 0) this.rotateX(this.rotations[0])
        if (this.rotations[1] !== 0) this.rotateY(this.rotations[1])
        if (this.rotations[2] !== 0) this.rotateZ(this.rotations[2])
    }
}
// VERT CLASS - inherits array buffer of typed arrays, compute functions, and update functions
class Vert extends BufferedData {
    constructor(x, y, z){
        super(BUFFER_SIZE * 3)
        this.setView(x,y,z)
        this.scaleFactor = (() => setScaleFactor(z))
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
    // arc tangent can distinguish direction, unlike rise/run which is pinned to 180 degrees
    const calculate_radians_angle = (x1, y1, x2, y2) => Math.atan2(y2-y1, x2-x1)
    // Pythatgoras theorem for calculating distance
    const calculate_distance = (x1, y1, x2, y2) => Math.sqrt((x2-x1) ** 2 + (y2-y1) ** 2)
    
    const data = await get_model_data()
    const {vertices, edges} = data
    
    // Map data as float32 array buffer values in Vert class objects
    const all_vertices = init_map_verts(vertices) // array of all Vert objects
    
    // this will be for applying rotations, translations, etc later...
    const all_edges = init_map_edges(edges, all_vertices) // array of all edges connecting 2 Vert objects



    // SETUP MOUSE MOVEMENT TRACKING --------------------------------
    function change_rotation_from_mouse(axis, amount){
        console.log(`Axis: ${axis}\nAmount: ${amount}`)
        switch (axis) {
            case "x":
                all_vertices.forEach( vert => vert.rotations[0] = amount )
                break
            case "y":
                all_vertices.forEach( vert => vert.rotations[1] = amount )
                break
            case "z": // z rotations are based on the mouse angle between prev-current coordinates, so "amount" is a float32
                all_vertices.forEach( vert => { 
                    // apply rotation based on angle rather than distance...
                })
                break
            default:
                console.error(`change_rotation_from_mouse(${axis}, ${amount}) function produced an invalid case!!! This should never happen, check code for logical errors!`)
        }
    }
    function calculate_rotation_amount(a, b){ 
        let result = (a-b) / ROTATION_SENSITIVITY || 0
        // check the rotation's direction by the sign but make sure it's capped by the maximum rotation speed allowed
        if (result !== 0 && Math.abs(result) < MAX_ROTATION_SPEED){
            result = (result < 0) ? -(result) : result
        }
        // 
        else if(result > MAX_ROTATION_SPEED) {
            result = MAX_ROTATION_SPEED
        }
        // no change or too small of a change, set rotation to stop
        else if(result == 0 || result < BASIC_MINIMUM) {
            result = 0
        }

        return result
    }

    // DEV NOTE: Int16 uses 2 bytes per element, so 4 coordinate elements and one bounce flag -> 5 * 2
    const mouse_buffer = new ArrayBuffer(12) // [x, y, previous_x, previous_y, bounce_flag_boolean, mouse_change_distance]
    let mouse = new Int16Array(mouse_buffer)
    mouse.fill(1)
    
    // the timeout container, used as a shared reference to be cleared to avoid overlapping / race conditions
    let debounceTimeout = null  

    // reset debouncing flag in debounceTimeout
    function resetBounce(){ mouse[4] = 1 }

    // Get mouse movements with a debouncer so as not to clobber the engine with event callbacks.
    const body = document.getElementsByTagName('body')[0]
    
    // Listener for tracking mouse movements to apply rotational changes to the mesh
    body.addEventListener( 'mousemove', e => {
        if (mouse[4] !== 0) {
            mouse[4] = 0    // bounce flag
            mouse[2] = mouse[0] // move previous x coordinates
            mouse[3] = mouse[1] // move preivous y coordinates
            mouse[0] = e.clientX // store new x coordinates
            mouse[1] = e.clientY // store new y coordinates
            // get DISTANCE between mouse coords for SPEED OF ROTATION
            mouse[5] = calculate_distance(mouse[0], mouse[1], mouse[2], mouse[3])

            // check for x rotation change based on new coordinates
            if (mouse[0] !== mouse[2]) change_rotation_from_mouse("x", calculate_rotation_amount(mouse[0], mouse[2]))

            // check for y rotation change based on new coordinates
            if (mouse[1] !== mouse[3]) change_rotation_from_mouse("y", calculate_rotation_amount(mouse[1], mouse[3]))
            
            // get ANGLE of mouse coords change so we can ROTATEZ based on the ANGLE
            let angle = calculate_radians_angle(mouse[0], mouse[1], mouse[2], mouse[3])
            // change_rotation_from_mouse("z", angle)

            console.log(mouse)
            console.log(all_vertices[0])

            // garbage collection
            clearTimeout(debounceTimeout)   // clear existing timeouts before setting the latest one
            debounceTimeout = setTimeout( resetBounce, DEBOUNCER_DELAY )
        }
    } )
    // --------- END MOUSE TRACKING ----------------------------------

    // find range of depth to scale coordinates (smaller change for further away)
    function render(){
        ctx.clearRect(-WIDTH, -HEIGHT, WIDTH*2, HEIGHT*2)

        all_vertices.forEach( (vertex, idx, arr) => {
            vertex.applyRotations() // Gets new coordinates from radians rotation held in this.rotations[x,y,z]
            if (idx == arr.length-1) { // check if the current iteration is the last element so that global minmaxZ can be updated only once instead of on every iteration
                // Check if rotations are applied to X or Y axes which will affect the z-range so that we only recalculate the minmaxZ when we have to
                if (vertex.rotations[0] !== 0 || vertex.rotations[1] !==0) {
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

        // draw dots, where background dots are smaller than foreground ones based on the new z value after the rotation 
        all_vertices.forEach( v => {
            drawVerts(v.computed_view[0], v.computed_view[1], v.scaleFactor)
        })

        
        if (animate) requestAnimationFrame(render)
    }
    
    console.log(all_vertices[all_vertices.length-1])
    render()
}

main()
})()