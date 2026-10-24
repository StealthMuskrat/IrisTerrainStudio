import data from'./client-model-data.json' with{type:'json'};
const MASK=(1n<<48n)-1n,MULTIPLIER=25214903917n,known=new Set(data.blockTypes);
export class ClientModelRandom {
  constructor(seed){this.setSeed(seed);}
  setSeed(seed){this.seed=(BigInt(seed)^MULTIPLIER)&MASK;}
  next(bits){this.seed=(this.seed*MULTIPLIER+11n)&MASK;return Number(this.seed>>BigInt(48-bits));}
  nextLong(){return BigInt.asIntN(64,(BigInt(this.next(32)|0)<<32n)+BigInt(this.next(32)|0));}
  nextInt(bound){if(!Number.isInteger(bound)||bound<1||bound>2147483647)throw new Error('Invalid native model weight total.');if((bound&(bound-1))===0)return Math.floor(bound*this.next(31)/2147483648);let sample,value;do{sample=this.next(31);value=sample%bound;}while((sample-value+bound-1|0)<0);return value;}
}
export function visualSeedRule(id){if(!known.has(id))throw new Error(`Block ${id} needs an authoritative client visual seed rule.`);return data.seedRules[id]??data.defaultSeedRule;}
export function blockModelSeed(block,position,rule=visualSeedRule(block.id)){
  if(!Array.isArray(position)||position.length!==3||!position.every(value=>Number.isInteger(value)&&value>=-2147483648&&value<=2147483647))throw new Error('Client model selection requires signed whole-block coordinates.');let[x,y,z]=position;
  if(rule==='lower-half'){if(block.properties?.half==='upper')y=(y-1)|0;}
  else if(rule==='bed-source'){if(block.properties?.part==='foot'){const facing={north:[0,-1],south:[0,1],west:[-1,0],east:[1,0]}[block.properties?.facing];if(!facing)throw new Error('Bed model selection requires its native facing.');x=(x+facing[0])|0;z=(z+facing[1])|0;}}
  else if(rule!=='position')throw new Error('Unknown client visual seed rule.');
  return coordinateSeed(x,y,z);
}
export function selectedModelParts(plan,block,position){
  if(plan.kind!=='minecraft-model-plan'||!Array.isArray(plan.groups)||plan.groups.length>128)throw new Error('Invalid client model selection plan.');const random=new ClientModelRandom(blockModelSeed(block,position,plan.seedRule)),seed=plan.multipart?random.nextLong():null,result=[];
  for(const group of plan.groups){if(plan.multipart)random.setSeed(seed);let index=0;if(group.weighted){let choice=random.nextInt(group.totalWeight);for(;index<group.variants.length;index++){choice-=group.variants[index].weight;if(choice<0)break;}}const selected=group.variants[index];if(!selected||!Array.isArray(selected.quads))throw new Error('Client weighted model coverage is incomplete.');result.push(selected.quads);}return result;
}

function coordinateSeed(x,y,z){let seed=BigInt.asIntN(64,BigInt(Math.imul(x,3129871))^(BigInt(z)*116129781n)^BigInt(y));seed=BigInt.asIntN(64,seed*seed*42317861n+seed*11n);return seed>>16n;}
export function positionModelSeed(position){if(!Array.isArray(position)||position.length!==3||!position.every(v=>Number.isInteger(v)&&v>=-2147483648&&v<=2147483647))throw new Error('Model offset requires signed whole-block coordinates.');return coordinateSeed(...position);}
