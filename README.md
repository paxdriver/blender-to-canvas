# blender-to-canvas
PROJECT DESCRIPTION:
Using model data from Blender to render 3D it in canvas. It's important to note that this project's main purpose is to help me practise using arrayBuffers in javascript and exchanging data between programming languages and platforms. There's no reason this can't be simplified by not using arraybuffers and this is certainly NOT the best approach to achieving a 3D engine in the browser using javascript.

I'm considering making another version of this once I'm done tinkering with it so that I can compare performance between the regular javascript memory allocation vs the contiguous memory allocation, and then also compare with THREE.js and using a math library to perform rotations and transformation using a math library which has matrix operations built-in to see if there's measurable benefits to arraybuffers with simple and complex meshes. Expect this project to branch, but it's just for fun. Please don't even consider putting something like this in production lol.


PLATFORM: 'Linux-5.19.0-50-generic-x86_64-with-glibc2.35'

BLENDER VERSION 3.0.1
PYTHON INTERACTIVE CONSOLE 3.10.12 [GCC 11.4.0]
  or
BLENDER VERSION 2.8
PYTHON INTERACTIVE CONSOLE 3.9

The version of python used depends entirely on the compatibility of the version of Blender that you're using. If you're trying to work with an appImage of Blender instead of an installed one, then you may find that only certain directories on your machine will work for saving json data to file. The paths will also be skewed if you're using appImage, and permissions can be a bit of a hassle too. If the python script isn't working for you then I suspect the version and type of launcher used for the Blender program is the culprit.
