// Gather data stored as json from python script that was run in Blender to extract model data
async function get_model_data(){
    const result = await fetch('./firstcube.json').then(response => response.json())
    return result
}

// GLOBAL VARIABLES TO TWEAK AND ALTER DEPENDING ON USE CASE
const BUFFER_SIZE = 4
const [WIDTH, HEIGHT, SIZE] = [800, 800, 100]
const CAMERA_POSITION = [0, 0, 10]
const BASIC_MINIMUM = 0.00000001
const INTEGER_CONVERSION_SCALE_FACTOR = 1
const DOT_SIZE = 20
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
    console.log(x, y, scaleFactor) // getting 0, 0, undefined!!! I'VE MADE AN ERROR SOMEWHERE WHEN THIS IS CALLED
    let _dot_size = DOT_SIZE * scaleFactor
    if (_dot_size < 2) _dot_size = 2
    ctx.beginPath()
    ctx.arc(x*SIZE, y*SIZE, _dot_size, 0, 2 * Math.PI)
    ctx.fillStyle = 'green'
    ctx.fill()
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
    }
    // returns canvas-friendly integer value
    getX(scaleFactor){
        let output = Math.round(this.view[0] * INTEGER_CONVERSION_SCALE_FACTOR * scaleFactor)
        this.computed_view[0] = output
    }
    getY(scaleFactor){ 
        this.computed_view[1] = Math.round(this.view[1] * INTEGER_CONVERSION_SCALE_FACTOR * scaleFactor)
    }
    updateCoordsWithDepthFactor(scaleFactor){
        this.getX(scaleFactor)
        this.getY(scaleFactor)
    }
    // WORK IN PROGRESS!!! TRYING MANUAL ROTATION TO MAKE SURE POINTS AND EDGES ARE BEING PLOTTED AS EXPECTED. HARD TO TELL FROM FACE-ON VIEW
    rotateY(amt){
        let x = this.view[2] / this.view[0]
        x *= Math.cos(amt) + this.view[0]
        this.view[0] = x
        this.computed_view[0] = Math.round(x)

        let z = this.view[0] / this.view[2]
        z *= -Math.sin(amt) + this.view[0]
        this.view[2]
        this.computed_view[2] = Math.round(z)
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
        vert.checkForZeros()
        if (vert.view[2] < minmaxZ.min) minmaxZ.min = vert.view[2]
        if (vert.view[2] > minmaxZ.max) minmaxZ.max = vert.view[2]
    })
    all_vertices.forEach( vert => {
        if (minmaxZ.min == minmaxZ.max) {
            vert.updateCoordsWithDepthFactor(1)
        } else {
            const zRange = minmaxZ.max - minmaxZ.min
            const zNormalized = (vert.view[2] - minmaxZ.min) / zRange     // normalize z to 0 - 1
            const scaleFactor = 1 / (1 + zNormalized)
            console.log(scaleFactor)
            vert.updateCoordsWithDepthFactor(scaleFactor)
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


    //                  WORK IN PROGRESS
    // this will be for applying rotations, translations, etc later...
    const all_edges = map_edges(edges, all_vertices) // array of all edges connecting 2 Vert objects

    // find range of depth to scale coordinates (smaller change for further away)
    function render(){

        all_vertices.forEach( vertex => {
            // apply test rotation of 1/4 PI to update computed points and view points
            vertex.rotateY(0.25 * Math.PI)
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

        // requestAnimationFrame(render)
    }

    render()

}

main()