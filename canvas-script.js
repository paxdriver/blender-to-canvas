// Gather data stored as json from python script that was run in Blender to extract model data
async function get_model_data(){
    const result = await fetch('./firstcube.json').then(response => response.json())
    return result
}

// GLOBAL VARIABLES TO TWEAK AND ALTER DEPENDING ON USE CASE
const BUFFER_SIZE = 4
const [WIDTH, HEIGHT, SIZE] = [800, 800, 100]
const CAMERA_POSITION = [0, 0, 10]
const BASIC_MINIMUM = 0.00001
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
function drawVerts(x, y, z){
    let _dot_size = (z*SIZE) / 20
    if (_dot_size < 0) _dot_size = _dot_size*-1
    ctx.beginPath()
    ctx.arc(x*SIZE, y*SIZE, _dot_size, 0, 2*Math.PI)
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

class BufferedData{
    constructor(bufferLength) {
        this.buffer = new ArrayBuffer(bufferLength)
        this.view = new Float32Array(this.buffer)
    }
    // handle values to avoid 0 values
    checkForZero() { 
        for (let i = 0; i < this.view.length; i++) {
            this.view[i] = (this.view[i] < BASIC_MINIMUM && this.view[i] !== 0) ? BASIC_MINIMUM : this.view[i]
        }
    }
    // Compute X coordinate
    getComputedX(){ return this.view[0] / this.view[2] }

    // Compute Y coordinate
    getComputedY(){ return this.view[1] / this.view[2] }

    // get computed value of X and Y computed
    updateCoordinates(){
        this.checkForZero()
        this.view[0] = this.getComputedX()
        this.view[1] = this.getComputedY()
    }
}

class Vert extends BufferedData {
    constructor(x, y, z){
        super(BUFFER_SIZE * arguments.length)
        this.setView(x,y,z)
    }

    setView(x, y, z){
        this.view[0] = x
        this.view[1] = y
        this.view[2] = z
    }
    getX(){ return this.view[0] }
    getY(){ return this.view[1] }
    getZ(){ return this.view[2] }
}

class Edge {
    constructor(v1, v2){
        this.a = v1
        this.b = v2
    }
}

async function main(){
    const data = await get_model_data()
    const {vertices, edges} = data

    function map_verts(vert_data){
        const output = []
        vert_data.forEach( v => {
            const vert = new Vert(v.x, v.y, v.z)
            output.push(vert)
        })
        return output
    }
    const all_vertices = map_verts(vertices)
    console.log(all_vertices)

    function map_edges(edge_data, all_vertices){
        const output = []
        edge_data.forEach( v => {
            all_vertices[v.v1].updateCoordinates()
            all_vertices[v.v2].updateCoordinates()
            const edge = new Edge(all_vertices[v.v1],all_vertices[v.v2])
            output.push(edge)
        })
        return output
    }
    const all_edges = map_edges(edges, all_vertices)
    
    function render(){
        all_edges.forEach( v => {
            drawLineFromTo(v.a.view, v.b.view)
        })

        all_vertices.forEach( v => {
            drawVerts(v.view[0], v.view[1], v.view[2])
        })

        // requestAnimationFrame(render)
    }

    render()

}

main()