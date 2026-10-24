import{checkJsonSource}from'../../../packages/iris-resources/pack-problems.mjs';
self.onmessage=({data})=>{try{self.postMessage({id:data.id,result:checkJsonSource(data.text,data.schemaText)});}catch(error){self.postMessage({id:data.id,error:error.message});}};
