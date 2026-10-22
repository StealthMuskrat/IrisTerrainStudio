import{navigationSettings}from'../../../packages/voxel-renderer/navigation.mjs';
export class CameraTools{
  constructor({$,element,field,copy,ask,errorMessage,getWorld,getSettings,saveSettings}){Object.assign(this,{$,element,field,copy,ask,errorMessage,getWorld,getSettings,saveSettings});}
  settings(){return navigationSettings(this.getSettings());}
  apply(world=this.getWorld()){world?.configureNavigation(this.settings());}
  sync(){
    const settings=this.settings(),world=this.getWorld();this.$('navigation-mode').value=settings.mode;this.$('flight-speed').value=String(settings.speed);
    this.$('camera-position').disabled=!world?.volume||!!world.disposed;
    this.$('world-help').textContent=settings.mode==='fly'?'Drag to look · W A S D to fly · Q / E down / up · Shift faster · Arrows to look · Home frames section':'Drag to orbit · Shift + drag to pan · Scroll or + / − to zoom · Arrows to orbit · Home frames section';
    this.$('world-help').textContent+=' · Click to inspect · Esc stops movement / clears selection';
  }
  change(){
    try{const speed=this.$('flight-speed').value.trim();if(!speed)throw new Error('Enter a flight speed from 0.25 to 256 blocks/second.');const settings=navigationSettings({mode:this.$('navigation-mode').value,speed:Number(speed)});this.getWorld()?.configureNavigation(settings);this.saveSettings(settings);}
    finally{this.sync();}
  }
  wire(){for(const id of ['navigation-mode','flight-speed'])this.$(id).addEventListener('change',()=>{try{this.change();}catch(error){this.errorMessage(error);}});this.$('camera-position').addEventListener('click',()=>this.dialog().catch(this.errorMessage));}
  async dialog(){
    const world=this.getWorld(),volume=world?.volume;if(!volume||world.disposed)throw new Error('Display stored voxels before editing the camera.');
    world.stopNavigation();const view=world.cameraView(),{element,field,copy}=this;
    const number=(value,attrs={})=>element('input',{type:'number',step:'any',required:true,value:String(value),...attrs});
    const eye=view.eye.map(value=>number(value)),yaw=number(view.yaw,{min:-360000,max:360000}),pitch=number(view.pitch,{min:-85.94366926962348,max:85.94366926962348}),distance=number(view.distance,{min:1,max:4096});
    const read=()=>{const inputs=[...eye,yaw,pitch,distance];if(inputs.some(input=>!input.value.trim()||!Number.isFinite(Number(input.value))))throw new Error('Enter finite numbers in every camera field.');return{eye:eye.map(input=>Number(input.value)),yaw:Number(yaw.value),pitch:Number(pitch.value),distance:Number(distance.value)};};
    await this.ask('3D camera',[copy('Move the camera within the stored preview. This changes only the view. No terrain is generated and the current section stays selected.'),...eye.map((input,axis)=>field('Eye world '+['X','Y','Z'][axis],input)),field('Yaw (degrees)',yaw,'0° looks toward −Z; 90° looks toward −X.'),field('Pitch (degrees)',pitch,'Positive pitch looks down; negative pitch looks up.'),field('Orbit distance (blocks)',distance,'Sets the look target distance, including when switching from Free fly to Orbit.'),copy('In Free fly, focus the world canvas to use W/A/S/D and Q/E. Movement has no collision or gravity. The eye is limited to 8192 blocks from the stored volume center on each axis.')],{submit:'Apply camera',read,onSubmit:value=>{if(this.getWorld()!==world||world.volume!==volume||world.disposed)throw new Error('The displayed volume changed. Open the camera dialog again.');world.setCameraView(value);}});
  }
}
