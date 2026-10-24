// Lossless packing of already-captured native states. This performs no native evaluations.
export function compactRenderingStates(data){
  if(data.formatVersion===2)return data;if(data.formatVersion!==1)throw new Error('Unknown native render input format.');
  for(const block of Object.values(data.blocks)){
    const domains=block.properties.map(()=>[]),entries=Object.entries(block.states).map(([key,id])=>({values:block.properties.length?key.split(','):[],id}));
    for(const row of entries)row.values.forEach((value,i)=>{if(!domains[i].includes(value))domains[i].push(value);});
    const states=new Array(domains.reduce((size,domain)=>size*domain.length,1));
    for(const row of entries){const index=row.values.reduce((index,value,i)=>index*domains[i].length+domains[i].indexOf(value),0);if(states[index]!==undefined)throw new Error('Duplicate captured native state.');states[index]=row.id;}
    if(states.length!==entries.length||states.includes(undefined))throw new Error('Incomplete native rendering property domains.');block.values=domains;block.states=states;
  }
  data.formatVersion=2;return data;
}
