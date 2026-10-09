import test from 'node:test';
import assert from 'node:assert/strict';
import {viewport,panViewport,zoomViewport} from '../public/chart-view.js';
test('panning covers oldest and newest sessions and clamps at both ends',()=>{
 const oldest=panViewport(756,63,0,1e6),latest=panViewport(756,63,oldest.offset,-1e6);
 assert.equal(oldest.first,0);assert.equal(oldest.last,62);
 assert.equal(latest.first,693);assert.equal(latest.last,755);
});
test('zoom keeps the pointed date within one session and all-history reaches both ends',()=>{
 for(const fraction of [0,.25,.5,.75,1]){
  const a=viewport(756,63,300),b=zoomViewport(756,63,300,126,fraction);
  assert.ok(Math.abs(a.first+fraction*(a.size-1)-b.first-fraction*(b.size-1))<=1);
 }
 assert.deepEqual(zoomViewport(756,63,300,756,.5),{size:756,offset:0,first:0,last:755});
});
test('short datasets and zoom limits never produce invalid or empty windows',()=>{
 for(const total of [1,8,10,30,756])for(const size of [-2,0,10,63,1e6])for(const offset of [-1e6,0,7,1e6]){
  const v=viewport(total,size,offset);assert.ok(v.first>=0&&v.last<total&&v.first<=v.last);assert.equal(v.last-v.first+1,v.size);
 }
});
