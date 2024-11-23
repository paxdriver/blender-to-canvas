import bpy
import json
import os

def export_vertex_data(obj_name, file_path):
    
    try:
        # Get the object by name
        print("Define mesh for reference...")
        obj = bpy.data.objects[obj_name]
        mesh = obj.data

        # Get vertex data from the mesh
        print("Collect vertices")
        vertices = [{"x": vertex.co.x, "y": vertex.co.y, "z": vertex.co.z} for vertex in mesh.vertices]

        # Collect edges
        print("Collect edges...")
        edges = [{"v1": edge.vertices[0], "v2": edge.vertices[1]} for edge in mesh.edges]

        # Gather verts and edges
        print("Gather verts and edges to prepare for writing to file...")
        data = {"vertices": vertices, "edges": edges}
        
        # Write data to a JSON file
        print("Writing json data...")
        cwd = os.getcwd()
        print(cwd)
        full_path = os.path.join(cwd, file_path)
        print(full_path)
        with open(full_path, 'w') as file:
            json.dump(data, file, indent=4)
    except:
        print("Not sure what the error was but something went wrong...")

# Usage
export_vertex_data('myobject', 'firstcube.json')
print("FINISHED")