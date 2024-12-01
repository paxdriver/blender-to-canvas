// Gather data stored as json from python script that was run in Blender to extract model data
async function get_model_data(){
    const result = await fetch('./firstcube.json').then(response => response.json())
    return result
}

// GLOBAL VARIABLES TO TWEAK AND ALTER DEPENDING ON USE CASE
const BUFFER_SIZE = 4
const [WIDTH, HEIGHT, SIZE] = [1000, 1500, 100]
const CAMERA_POSITION = [0, 0, 0]
const BASIC_MINIMUM = 0.00000000001
const INTEGER_CONVERSION_SCALE_FACTOR = 2
const DOT_SIZE = 20
const MIN_DOT_SIZE = 5
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
    ctx.moveTo(a[0]*SIZE,a[1]*SIZE)
    ctx.lineTo(b[0]*SIZE, b[1]*SIZE)
    ctx.lineCap = "round"
    ctx.stroke()
}
function drawVerts(x, y, scaleFactor){
    let _dot_size = DOT_SIZE * scaleFactor
    if (_dot_size < MIN_DOT_SIZE) _dot_size = MIN_DOT_SIZE
    ctx.beginPath()
    ctx.arc(x*SIZE, y*SIZE, _dot_size, 0, 2 * Math.PI)
    ctx.fillStyle = 'green'
    // ctx.fill()
    ctx.stroke()
}

/*  VERTICES
    The data contain all of the {x,y,z} coordinates for each vertex under the "vertices" key.

    EDGES
    The data.edges contains an array of edges, with "v1" being the index of the point in the vertices array and "v2" being the second index of the vertex it connects to.

    BUFFERED DATA CLASS
    Since Vert extends BufferedData, apply transformation methods in BufferedData rather than Vert class to ensure the functions are not being needlessly copied with each instantiation of vertices.
*/

// Methods to be included with every Vert class object
class BufferedData{
    constructor(bufferLength) {
        this.buffer = new ArrayBuffer(bufferLength)
        this.view = new Float32Array(this.buffer)
        this._tmpBuffer = new ArrayBuffer(bufferLength)
        this._tmp = new Float32Array(this._tmpBuffer)
        this._rotationsBuffer = new ArrayBuffer(bufferLength)
        this.rotations = new Float32Array(this._rotationsBuffer)
    }
    // handle values to avoid 0 values
    checkForZeros() { 
        for (let i = 0; i < this.view.length; i++) {
            if (this.view[i] < BASIC_MINIMUM && this.view[i] !== 0) {
                this.view[i] = BASIC_MINIMUM 
            } 
        }
    }
    setView(x, y, z){ // Float values of coordinates from imported data
        this.view[0] = x
        this.view[1] = y
        this.view[2] = z
        this.rotations = [0.0, 0.0, 0.0]
    }
    // returns canvas-friendly integer value
    getX(scaleFactor){
        let xValue = this._tmp[0] || this.view[0]
        this.computed_view[0] = Math.round(xValue * INTEGER_CONVERSION_SCALE_FACTOR * scaleFactor)
    }
    getY(scaleFactor){
        let yValue = this._tmp[1] || this.view[1]
        this.computed_view[1] = Math.round(yValue * INTEGER_CONVERSION_SCALE_FACTOR * scaleFactor)
    }
    getZ(){ // //DEV NOTE: don't need this right now
        // let zValue = this._tmp[2] || this.view[2]
    }
    updateCoordsWithDepthFactor(scaleFactor){
        this.getX(scaleFactor)
        this.getY(scaleFactor)
        console.log(this.computed_view)
    }

    rotateX(angle){
        let yValue = this._tmp[1] || this.view[1]
        let zValue = this._tmp[2] || this.view[2]
        this._tmp[1] = (yValue * Math.cos(angle)) + (zValue * Math.sin(angle))
        this._tmp[2] = (zValue * Math.cos(angle)) - (yValue * Math.sin(angle))
    }
    rotateY(angle){
        let xValue = this._tmp[0] || this.view[0]
        let zValue = this._tmp[2] || this.view[2]
        this._tmp[0] = (xValue * Math.cos(angle)) + (zValue * Math.sin(angle))
        this._tmp[2] = (zValue * Math.cos(angle)) - (xValue * Math.sin(angle))
    }
    rotateZ(angle){
        let xValue = this._tmp[0] || this.view[0]
        let yValue = this._tmp[1] || this.view[1]
        this._tmp[0] = (xValue * Math.cos(angle)) - (yValue * Math.sin(angle))
        this._tmp[1] = (xValue * Math.sin(angle)) + (yValue * Math.cos(angle))
    }
    applyRotations(){
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
        this.computed_buffer = new ArrayBuffer(2 * Int32Array.BYTES_PER_ELEMENT)
        this.computed_view = new Int32Array(this.computed_buffer) // [x, y] integer coordinates
    }
}
class Edge {
    constructor(v1, v2){
        this.a = v1 // Vert's index
        this.b = v2 // Vert's index
    }
}

// Generate typed array object data for each vertex
function map_verts(vert_data){
    const output = []
    vert_data.forEach( v => {
        const vert = new Vert(v.x, v.y, v.z)
        output.push(vert)
    })
    return output
} // Generate edges pased on all Vert class objects
function map_edges(edge_data, all_vertices){
    const output = []
    edge_data.forEach( v => {
        const edge = new Edge(all_vertices[v.v1],all_vertices[v.v2])
        output.push(edge)
    })
    return output
}

// Once all Vert objects are created, find the depth ranges and store a scaler in each object to be used to recalculate the x, y coordinates in 2D space with a scaler for depth adjustments
function calculate_scale_factor(all_vertices){  // WORK IN PROGRESS!!!!
    const minmaxZ = { 
        min: Infinity,
        max: -Infinity
    }

    all_vertices.forEach( vert => {
        if (vert.view[2] < minmaxZ.min) minmaxZ.min = vert.view[2]
        if (vert.view[2] > minmaxZ.max) minmaxZ.max = vert.view[2]
    })
    all_vertices.forEach( vert => {
        let scaleFactor = 1
        if (minmaxZ.min == minmaxZ.max) {
            vert.scaleFactor = scaleFactor
        } else {
            const zRange = minmaxZ.max - minmaxZ.min
            const zNormalized = (vert.view[2] - minmaxZ.min) / zRange     // normalize z to 0 - 1
            const scaleFactor = 1 / (1 + zNormalized)
            vert.scaleFactor = scaleFactor
            console.log(scaleFactor)
        }
    })
}


async function main(){
    const data = await get_model_data()
    const {vertices, edges} = data
    // Map data as float32 array buffer values in Vert class objects
    const all_vertices = map_verts(vertices) // array of all Vert objects
    // Get depth based on min/max depth of all Vert objects and assign integer values to array buffer of integers in Vert.computed_view[0] and Vert.computed_view[1]
    calculate_scale_factor(all_vertices)

    // this will be for applying rotations, translations, etc later...
    const all_edges = map_edges(edges, all_vertices) // array of all edges connecting 2 Vert objects


    let counter = 0.0001
    // find range of depth to scale coordinates (smaller change for further away)
    function render(){
        ctx.clearRect(-WIDTH, -HEIGHT, WIDTH*2, HEIGHT*2)

        all_vertices.forEach( vertex => {
            // apply test rotation of 1/4 PI to update computed points and view points
            vertex.rotations[1] = (counter * Math.PI)
            counter += 0.000001
            vertex.applyRotations()
        })

        calculate_scale_factor(all_vertices) // recalculate the scaleFactor and store it in each instance's scaleFactor

        all_vertices.forEach( vertex => {
            // update x,y,z coordinates with new values from the rotation
            vertex.updateCoordsWithDepthFactor(vertex.scaleFactor)
        })

        // edges are all already just references to the Vert objects, so those updates will be live and good still
        all_edges.forEach( vert_pair => {
            drawLineFromTo(vert_pair.a.computed_view, vert_pair.b.computed_view)
        })

        // draw dots, where background dots are smaller than foreground ones based on the new z value after the rotation 
        all_vertices.forEach( v => {
            drawVerts(v.computed_view[0], v.computed_view[1], v.scaleFactor)
        })

        console.log(all_vertices[all_vertices.length-1])

        // requestAnimationFrame(render)
    }

    render()

}

main()