// Small authored source shared by the focused native hydrology checks.
export function hydrologyFixture(flat){return {
    'dimensions/terrain3d.json':{name:'Hydrology fixture',version:1,mode:{type:'OVERWORLD'},regions:['floor'],environment:'NORMAL',dimensionHeight:{min:0,max:128},logicalHeight:128,fluidHeight:16,caveProfile:{enabled:false},riverPolicy:{surfacePools:['lava_pool'],surfaceSourceDensity:0,surfaceSourceSpacing:32,surfaceCoastalOutlets:0,surfaceInlandOutlets:0},hydrology:{rivers:{enabled:true,routing:{tileSize:256,sampleSpacing:64,maximumRouteLength:256,minimumSurfaceCourseLength:0,minimumUndergroundCourseLength:0,oceanOutlets:false,inlandOutlets:[],maximumCoastalOutletsPerTile:0,regional:{enabled:false}},surface:{enabled:false,sources:{density:0,minimumSpacing:32}},underground:{enabled:false,sources:{density:0,minimumSpacing:32}},grottos:{coastal:{enabled:false,seaCaves:{enabled:false}},inland:{enabled:false}}},surfacePools:[{id:'lava_pool',fluidPalette:{palette:[{block:'minecraft:lava'}]},density:8,spacing:32,minimumRadius:2,maximumRadius:2,depth:2}]}},
    'regions/floor.json':{name:'Floor',landBiomes:['floor'],seaBiomes:['floor'],shoreBiomes:['floor']},
    'biomes/floor.json':{name:'Floor',derivative:'minecraft:plains',vanillaDerivative:'minecraft:plains',layers:[{palette:[{block:'minecraft:stone'}]}],generators:[{generator:'flat',min:48,max:48}]},
    'generators/flat.json':flat
  };}

// One independent contained deep pool per tile, in an authored solid floor.
export function deepHydrologyFixture(flat){
  const source=hydrologyFixture(flat),dimension=source['dimensions/terrain3d.json'];
  dimension.name='Contained deep-fluid fixture';
  dimension.riverPolicy.surfacePools=[];
  dimension.hydrology.surfacePools=[];
  dimension.hydrology.deepFluids=[{id:'deep_lava',fluidPalette:{palette:[{block:'minecraft:lava'}]},density:1,spacing:256,height:{min:20,max:20},horizontalRadius:2,verticalRadius:2,channelWidth:1,depth:1,headroom:1,containedPools:true,shortChannels:false}];
  return source;
}
