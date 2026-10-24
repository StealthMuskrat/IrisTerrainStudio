// Owned diagnostic geometry; independent of Minecraft resource-pack models.
export const CELL_FACES=[
  ['north',[0,0,-1],[[1,1,0],[1,0,0],[0,0,0],[0,1,0]]],['south',[0,0,1],[[0,1,1],[0,0,1],[1,0,1],[1,1,1]]],
  ['west',[-1,0,0],[[0,1,0],[0,0,0],[0,0,1],[0,1,1]]],['east',[1,0,0],[[1,1,1],[1,0,1],[1,0,0],[1,1,0]]],
  ['up',[0,1,0],[[0,1,0],[0,1,1],[1,1,1],[1,1,0]]],['down',[0,-1,0],[[0,0,1],[0,0,0],[1,0,0],[1,0,1]]]
];
export const CELL_CUBE=CELL_FACES.map(([cull,normal,positions])=>({cull,normal,positions,uv:[[.5,.5],[.5,.5],[.5,.5],[.5,.5]],color:[1,1,1,1],transparency:'opaque'}));
