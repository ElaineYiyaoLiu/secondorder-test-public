// Viewport navigation never changes the model's selected dates.
export function viewport(total,size,offset=0){
 total=Math.max(1,Math.floor(total));
 size=Math.max(Math.min(10,total),Math.min(total,Math.round(size)||10));
 offset=Math.max(0,Math.min(total-size,Math.round(offset)||0));
 return {size,offset,first:total-size-offset,last:total-1-offset};
}
export function panViewport(total,size,offset,delta){return viewport(total,size,offset+delta);}
export function zoomViewport(total,size,offset,nextSize,fraction=1){
 const current=viewport(total,size,offset),next=viewport(total,nextSize),f=Math.max(0,Math.min(1,fraction));
 const anchor=current.first+f*(current.size-1),first=Math.round(anchor-f*(next.size-1));
 return viewport(total,next.size,total-next.size-first);
}
