import{HydrologyNetworkIndex}from'../iris-engine/hydrology-network.mjs';
export function displayRange(value){
  if(value==null)return null;
  if(!Array.isArray(value)||value.length!==2||!value.every(Number.isFinite)||value[0]>=value[1])throw new Error('Display range needs two finite values with minimum below maximum.');return value.slice();
}
// Category colors identify keys; they do not represent native terrain/material colors.
export function categoryColor(key){let hash=2166136261;for(let i=0;i<key.length;i++)hash=Math.imul(hash^key.charCodeAt(i),16777619);const hue=(hash>>>0)%360/60,c=.55,x=c*(1-Math.abs(hue%2-1)),m=.24,parts=hue<1?[c,x,0]:hue<2?[x,c,0]:hue<3?[0,c,x]:hue<4?[0,x,c]:hue<5?[x,0,c]:[c,0,x];return[...parts.map(value=>value+m),1];}
function normalized(value,low,high){
  if(value<=low||low===high)return 0;if(value>=high)return 1;
  const width=high-low;if(Number.isFinite(width))return(value-low)/width;
  const scale=Math.max(Math.abs(low),Math.abs(high));return(value/scale-low/scale)/(high/scale-low/scale);
}
export class FieldIndex{
  constructor(data){
    if(!Number.isInteger(data.width)||!Number.isInteger(data.height)||data.width<1||data.height<1||data.width>4096||data.height>4096||data.width*data.height>1048576||!(data.values instanceof Float64Array)||data.values.length!==data.width*data.height)throw new Error('Map data requires complete coverage within the 1048576-sample limit.');
    if(![data.x,data.z,data.span,data.depth].every(Number.isFinite)||![data.span,data.depth].every(value=>Number.isFinite(Math.fround(value))&&Math.fround(value)>0)||![data.x-data.span/2,data.x+data.span/2,data.z-data.depth/2,data.z+data.depth/2].every(Number.isFinite))throw new Error('Map world bounds must be finite, positive and displayable.');
    const categories=data.categories;
    let characters=0;if(categories&&(!Array.isArray(categories)||!categories.length||categories.length>65536||categories.some(key=>typeof key!=='string'||!key.length||key.length>1024||(characters+=key.length)>8*1024*1024)||new Set(categories).size!==categories.length))throw new Error('Categorical map identities are invalid or exceed the key-length budget.');
    this.data=data;this.network=data.hydrology?.network?new HydrologyNetworkIndex(data.hydrology.network):null;this.counts=categories?new Uint32Array(categories.length):null;this.min=Infinity;this.max=-Infinity;
    for(const value of data.values){if(!Number.isFinite(value))throw new Error('Map samples must be finite; unsupported values cannot be displayed.');if(categories&&(!Number.isInteger(value)||value<0||value>=categories.length))throw new Error('A categorical sample has no identity.');if(categories)this.counts[value]++;this.min=Math.min(this.min,value);this.max=Math.max(this.max,value);}
    this.categories=categories?categories.map((key,index)=>({key,index,count:this.counts[index]})).filter(row=>row.count).sort((a,b)=>b.count-a.count||(a.key<b.key?-1:a.key>b.key?1:0)):null;
  }
  display(range=null){
    if(this.categories)return Float32Array.from(this.data.values);
    const [low,high]=displayRange(range)??[this.min,this.max];return Float32Array.from(this.data.values,value=>normalized(value,low,high));
  }
  sample(row,column){
    const d=this.data;if(!Number.isInteger(row)||!Number.isInteger(column)||row<0||column<0||row>=d.height||column>=d.width)throw new Error('Choose a sample inside the retained map.');
    const value=d.values[row*d.width+column];return{row,column,value,category:d.categories?.[value]??null,x:d.x-d.span/2+(column+.5)*d.span/d.width,z:d.z-d.depth/2+(row+.5)*d.depth/d.height,y:Number.isFinite(d.y)?d.y:null};
  }
  legend(query='',page=0){
    if(!this.categories)throw new Error('This scalar map has no category legend.');
    if(typeof query!=='string'||query.length>1024||!Number.isSafeInteger(page)||page<0)throw new Error('Invalid category search or page.');
    const rows=this.categories.filter(row=>row.key.toLowerCase().includes(query.trim().toLowerCase())),pages=Math.max(1,Math.ceil(rows.length/64));page=Math.min(page,pages-1);return{rows:rows.slice(page*64,page*64+64),total:rows.length,pages,page};
  }
  categorySample(category,cursor=0){
    if(!this.categories||!Number.isInteger(category)||category<0||category>=this.counts.length||!this.counts[category]||!Number.isSafeInteger(cursor))throw new Error('Choose a category present in the retained map.');
    if(this.matches?.category!==category){const cells=new Uint32Array(this.counts[category]);let at=0;for(let i=0;i<this.data.values.length;i++)if(this.data.values[i]===category)cells[at++]=i;if(at!==cells.length)throw new Error('Map samples changed. Reopen the legend.');this.matches={category,cells};}
    const cells=this.matches.cells,index=cells[((cursor%cells.length)+cells.length)%cells.length];return this.sample(Math.floor(index/this.data.width),index%this.data.width);
  }
}
