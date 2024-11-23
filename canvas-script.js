
async function get_model_data(){
    const result = await fetch('./firstcube.json').then(response => response.json())
    return result
}

const BUFFER_SIZE = 4

async function main(){
    const data = await get_model_data()
    const {vertices, edges} = data
    // console.log(vertices)
    // console.log(edges)

    const canvas = document.getElementById('canvas')
    const ctx = canvas.getContext('2d')

    // VERTICES
    // The data contain all of the {x,y,z} coordinates for each vertex under the "vertices" key.
    
    // EDGES
    // The data.edges contains an array of edges, with "v1" being the index of the point in the vertices array and "v2" being the second index of the vertex it connects to.

    class BufferedData{
        constructor(bufferLength) {
            this.buffer = new ArrayBuffer(bufferLength)
            this.view = new Float32Array(this.buffer)
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
            const edge = new Edge(all_vertices[v.v1],all_vertices[v.v2])
            output.push(edge)
        })
        return output
    }
    const all_edges = map_edges(edges, all_vertices)
    console.log(all_edges)
}

main()