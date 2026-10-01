'use strict';
const fp=require('fastify-plugin');
const {requestBetaUser,includeRecording,recordingView,allowRole,visibleRecording}=require('../lib/externalCatalog');
module.exports=fp(async fastify=>{
  fastify.addHook('preHandler',async(request,reply)=>{
    const m=request.url.split('?')[0].match(/^\/api\/tracks\/([^/]+)(?:\/|$)/);
    if(!m || !fastify.prisma.externalRecording?.findUnique)return;
    const r=await fastify.prisma.externalRecording.findUnique({where:{trackId:m[1]},include:includeRecording});
    if(!r || r.track.catalogScope==='NATIVE')return;
    const user=await requestBetaUser(fastify,request);
    if(!user)return reply.code(404).send({error:'Track not found'});
    if(request.method==='DELETE' && request.url.split('?')[0]===`/api/tracks/${m[1]}/like`) {
      const rootId=r.mergedIntoId || r.id;
      const group=await fastify.prisma.externalRecording.findMany({where:{OR:[{id:rootId},{mergedIntoId:rootId}]},select:{trackId:true}});
      await fastify.prisma.$transaction(async tx=>{for(const member of group){const removed=await tx.trackLike.deleteMany({where:{userId:user.id,trackId:member.trackId}});if(removed.count)await tx.track.update({where:{id:member.trackId},data:{likes:{decrement:removed.count}}});}});
      return reply.send({success:true,liked:false});
    }
    if(request.method==='GET' && request.url.split('?')[0]===`/api/tracks/${m[1]}`) {
      const root=r.mergedIntoId ? await fastify.prisma.externalRecording.findUnique({where:{id:r.mergedIntoId},include:includeRecording}) : r;
      if(!allowRole(user)&&!visibleRecording(root))return reply.code(404).send({error:'Track not found'});
      return reply.send({track:recordingView(root)});
    }
    if(request.url.split('?')[0].endsWith('/play-event'))return reply.code(409).send({error:'EXTERNAL_PLAY_EVENT_ENDPOINT_REQUIRED'});
  });
});
