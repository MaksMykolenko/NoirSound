'use strict';
const C=require('./externalCatalog');
const {auditData}=require('./auditLog');
// The caller holds catalogLock and owns the transaction.
async function importCatalogTrack(tx,userId,m) {
  const provider=m.provider;
  if(!C.IMPORT_PROVIDERS.includes(provider))C.fail('EXTERNAL_PROVIDER_UNSUPPORTED',400);
      const existing=await tx.externalSource.findFirst({where:{OR:[{provider,externalId:m.externalId},{canonicalUrl:m.canonicalUrl}]},include:{recording:true}});
      if(existing){
        await tx.externalSource.update({where:{id:existing.id},data:{availability:m.availability,playbackMode:m.playbackMode,checkedAt:m.checkedAt}});
        if(existing.recording.metadataProvenance===m.provenance&&!existing.recording.mergedIntoId){
          await tx.track.update({where:{id:existing.recording.trackId},data:{title:m.title,primaryArtistName:m.artistName,coverUrl:m.coverUrl,durationSeconds:m.durationSeconds,duration:m.durationSeconds,explicit:m.explicit}});
          await tx.externalRecording.update({where:{id:existing.recordingId},data:{metadataExpiresAt:new Date(Date.now()+86400000)}});
        }
        return tx.externalRecording.findUnique({where:{id:existing.recording.mergedIntoId || existing.recordingId},include:C.includeRecording});
      }
      const curator=await tx.artistProfile.upsert({where:{userId:userId},create:{userId:userId,genres:[]},update:{}});
      const track=await tx.track.create({data:{title:m.title,primaryArtistName:m.artistName,coverUrl:m.coverUrl,durationSeconds:m.durationSeconds,duration:m.durationSeconds,tags:[],artistId:curator.id,status:'PUBLISHED',isPublic:false,catalogScope:'EXTERNAL_BETA',explicit:m.explicit}});
      const r=await tx.externalRecording.create({data:{trackId:track.id,curatorId:userId,versionType:m.versionType,isrc:m.isrc,metadataProvenance:m.provenance,metadataExpiresAt:new Date(Date.now()+86400000),sources:{create:{provider,externalId:m.externalId,canonicalUrl:m.canonicalUrl,playbackMode:m.playbackMode,availability:m.availability,provenance:m.provenance,checkedAt:m.checkedAt,isPrimary:true,matchStatus:'CONFIRMED'}}},include:C.includeRecording});
      await tx.auditLog.create({data:auditData(userId,'EXTERNAL_IMPORT','EXTERNAL_RECORDING',r.id,'User selected catalog track',{provider,externalId:m.externalId})});return r;
}
module.exports={importCatalogTrack};
