'use strict';
const {createAudiusAdapter}=require('../providers/audius');
const {ADMIN_PERMISSIONS,adminReadOptions,adminMutationOptions}=require('../lib/adminGuard');
const C=require('../lib/externalCatalog');
const {EMBED_PROVIDERS,officialEmbed}=require('../providers/officialEmbeds');
const reasonSchema={type:'string',minLength:3,maxLength:1000};
const textSchema={type:'string',minLength:1,maxLength:300};
const bodySchema=(properties,required=[])=>({body:{type:'object',additionalProperties:false,properties,required}});
module.exports=async function externalCatalogRoutes(fastify,options) {
  const audius=options.audius || createAudiusAdapter();
  const read=adminReadOptions(fastify,ADMIN_PERMISSIONS.TRACKS_READ);
  const mutate=adminMutationOptions(fastify,ADMIN_PERMISSIONS.TRACKS_MANAGE);
  fastify.addHook('preHandler',async(request,reply)=>{
    reply.header('cache-control','private, no-store');reply.header('x-robots-tag','noindex, nofollow');
    if(!C.allowRole(request.user))return reply.code(403).send({error:'EXTERNAL_BETA_FORBIDDEN'});
    if(!/\/(status|settings)$/.test(request.url.split('?')[0])&&!await C.betaEnabled(fastify.prisma))return reply.code(403).send({error:'EXTERNAL_BETA_DISABLED'});
  });
  fastify.setErrorHandler((error,request,reply)=>{
    const known=error instanceof C.CatalogError;
    const validation=Boolean(error.validation);
    if (!known && !validation && error.statusCode >= 400 && error.statusCode < 500) return reply.code(error.statusCode).send({error:error.statusCode===429?'RATE_LIMITED':'EXTERNAL_REQUEST_REJECTED'});
    if(!known&&!validation)fastify.log.error({code:error.code || 'EXTERNAL_CATALOG_INTERNAL'},'External catalog operation failed');
    reply.code(known?error.statusCode:validation?400:500).send({error:known?error.code:validation?'EXTERNAL_INPUT_INVALID':'EXTERNAL_CATALOG_ERROR'});
  });
  async function getRecording(id) {
    const r=await fastify.prisma.externalRecording.findUnique({where:{id},include:C.includeRecording});
    if(!r)C.fail('EXTERNAL_RECORDING_NOT_FOUND',404);return r;
  }
  async function refreshSource(source) {
    let m;
    try {m=await audius.getTrack(source.externalId);}catch(e) {
      if(['AUDIUS_HTTP_404','AUDIUS_HTTP_403'].includes(e.code)) {
        await fastify.prisma.$transaction(async tx=>{
          await tx.externalSource.update({where:{id:source.id},data:{availability:'UNAVAILABLE',checkedAt:new Date()}});
          const r=await tx.externalRecording.findUnique({where:{id:source.recordingId}});
          if(r?.metadataProvenance==='AUDIUS_PUBLIC_API')await tx.track.update({where:{id:r.trackId},data:{title:'Unavailable Audius track',coverUrl:null,primaryArtistName:null}});
        });
      }
      throw e;
    }
    await fastify.prisma.$transaction(async tx=>{
      await tx.externalSource.update({where:{id:source.id},data:{availability:m.availability,playbackMode:m.playbackMode,checkedAt:m.checkedAt}});
      const r=await tx.externalRecording.findUnique({where:{id:source.recordingId}});
      if(r?.metadataProvenance==='AUDIUS_PUBLIC_API') {
        await tx.track.update({where:{id:r.trackId},data:{title:m.title,primaryArtistName:m.artistName,coverUrl:m.coverUrl,durationSeconds:m.durationSeconds,duration:m.durationSeconds,explicit:m.explicit}});
        await tx.externalRecording.update({where:{id:r.id},data:{metadataExpiresAt:new Date(Date.now()+86400000)}});
      }
    });
    return m;
  }
  fastify.get('/status',read,async()=>{ if(process.env.EXTERNAL_CATALOG_ENABLED==='true' && audius.status()==='NOT_CONFIGURED') { try { await audius.search('NoirSound',0,1); } catch {} } return ({enabled:await C.betaEnabled(fastify.prisma),providers:[{provider:'AUDIUS',status:process.env.EXTERNAL_CATALOG_ENABLED !== 'true' ? 'DISABLED' : audius.status(),capabilities:audius.capabilities},...C.PROVIDERS.slice(1).map(provider=>({provider,status:EMBED_PROVIDERS.includes(provider)?'OFFICIAL_EMBED':'LINK_OUT_ONLY',capabilities:{search:false,metadata:false,playbackMode:EMBED_PROVIDERS.includes(provider)?'OFFICIAL_EMBED':'LINK_OUT'}}))]}); });
  fastify.get('/embed',{...read,schema:{querystring:{type:'object',additionalProperties:false,properties:{provider:{type:'string',enum:EMBED_PROVIDERS},url:{type:'string',minLength:1,maxLength:1000}},required:['provider','url']}}},async request=>officialEmbed(request.query.provider,request.query.url));
  fastify.patch('/settings',{...mutate,schema:bodySchema({enabled:{type:'boolean'},reason:reasonSchema},['enabled','reason'])},async request=>{
    return fastify.prisma.$transaction(async tx=>{await C.catalogLock(tx);const setting=await tx.externalCatalogSetting.upsert({where:{id:'beta'},create:{id:'beta',enabled:request.body.enabled},update:{enabled:request.body.enabled}});await C.recordAudit(tx,request,'EXTERNAL_BETA_SETTING','beta',request.body.reason,{enabled:setting.enabled});return {enabled:setting.enabled};});
  });
  fastify.get('/search',{...read,config:{...read.config,rateLimit:{max:30,timeWindow:'1 minute'}},schema:{querystring:{type:'object',additionalProperties:false,properties:{q:{type:'string',minLength:1,maxLength:200},offset:{type:'integer',minimum:0,maximum:1000,default:0},limit:{type:'integer',minimum:1,maximum:20,default:20}},required:['q']}}},async request=>{
    const {q,offset,limit}=request.query;
    const data=q.startsWith('https:')?[await audius.resolve(q)]:await audius.search(q,offset,limit);
    const sources=await fastify.prisma.externalSource.findMany({where:{provider:'AUDIUS',externalId:{in:data.map(t=>t.externalId)}},include:{recording:{include:C.includeRecording}}});
    const seen=new Set();const items=[];
    for(const m of data) {
      const source=sources.find(x=>x.externalId===m.externalId);let record=source?.recording;
      if(record?.mergedIntoId)record=await getRecording(record.mergedIntoId);
      const key=record?.id || `audius:${m.externalId}`;if(seen.has(key))continue;seen.add(key);
      items.push(record?{...C.recordingView(record),imported:true}:{...m,id:key,artistName:m.artistName,duration:m.durationSeconds,isStreamable:m.availability==='AVAILABLE',playbackSource:'external',previewExternalId:m.externalId,imported:false});
    }
    return {items,pageInfo:{offset,nextOffset:offset+limit,hasNextPage:data.length===limit}};
  });
  fastify.get('/preview/:id/playback',read,async request=>{const p=await audius.playback(request.params.id);return {url:p.url,playbackMode:p.playbackMode,provider:p.provider,expiresAt:p.expiresAt};});
  fastify.post('/import',{...mutate,schema:bodySchema({externalId:{type:'string',pattern:'^[A-Za-z0-9]{1,32}$'},url:{type:'string',maxLength:1000}})},async request=>{
    if(Boolean(request.body.externalId)===Boolean(request.body.url))C.fail('AUDIUS_ID_OR_URL_REQUIRED');
    const m=request.body.url?await audius.resolve(request.body.url):await audius.getTrack(request.body.externalId);
    if(m.availability!=='AVAILABLE')C.fail('EXTERNAL_TRACK_UNAVAILABLE',409);
    const record=await fastify.prisma.$transaction(async tx=>{
      await C.catalogLock(tx);
      const existing=await tx.externalSource.findFirst({where:{OR:[{provider:'AUDIUS',externalId:m.externalId},{canonicalUrl:m.canonicalUrl}]},include:{recording:true}});
      if(existing)return tx.externalRecording.findUnique({where:{id:existing.recording.mergedIntoId || existing.recordingId},include:C.includeRecording});
      const curator=await tx.artistProfile.upsert({where:{userId:request.user.id},create:{userId:request.user.id,genres:[]},update:{}});
      const track=await tx.track.create({data:{title:m.title,primaryArtistName:m.artistName,coverUrl:m.coverUrl,durationSeconds:m.durationSeconds,duration:m.durationSeconds,tags:[],artistId:curator.id,status:'PUBLISHED',isPublic:false,catalogScope:'EXTERNAL_BETA',explicit:m.explicit}});
      const r=await tx.externalRecording.create({data:{trackId:track.id,curatorId:request.user.id,versionType:m.versionType,isrc:m.isrc,metadataProvenance:m.provenance,metadataExpiresAt:new Date(Date.now()+86400000),sources:{create:{provider:'AUDIUS',externalId:m.externalId,canonicalUrl:m.canonicalUrl,playbackMode:m.playbackMode,availability:m.availability,provenance:m.provenance,checkedAt:m.checkedAt,isPrimary:true,matchStatus:'CONFIRMED'}}},include:C.includeRecording});
      await C.recordAudit(tx,request,'EXTERNAL_IMPORT',r.id,'Selected Audius import',{provider:'AUDIUS',externalId:m.externalId});return r;
    });
    return {recording:C.recordingView(record)};
  });
  fastify.post('/recordings',{...mutate,schema:bodySchema({nativeTrackId:textSchema,title:textSchema,artistName:textSchema,durationSeconds:{type:'integer',minimum:0,maximum:36000},versionType:{type:'string',enum:C.VERSIONS},provenance:reasonSchema,reason:reasonSchema,provider:{type:'string',enum:C.PROVIDERS.slice(1)},url:{type:'string',maxLength:1000}},['reason'])},async request=>{
    const b=request.body;
    if(Boolean(b.url)!==Boolean(b.provider) || (b.nativeTrackId && b.url))C.fail('EXTERNAL_INPUT_INVALID');
    const link=b.url?C.platformUrl(b.provider,b.url):null;
    const r=await fastify.prisma.$transaction(async tx=>{
      await C.catalogLock(tx);let track;
      if(link){const existing=await tx.externalSource.findFirst({where:{OR:[{canonicalUrl:link.canonicalUrl},...(link.externalId?[{provider:b.provider,externalId:link.externalId}]:[])]},include:{recording:true}});if(existing)return tx.externalRecording.findUnique({where:{id:existing.recording.mergedIntoId || existing.recordingId},include:C.includeRecording});}
      if(b.nativeTrackId){track=await tx.track.findUnique({where:{id:b.nativeTrackId}});if(!track || track.catalogScope!=='NATIVE')C.fail('NATIVE_TRACK_NOT_FOUND',404);const exists=await tx.externalRecording.findUnique({where:{trackId:track.id},include:C.includeRecording});if(exists)return exists;}
      else {if(!b.title || !b.artistName || !b.provenance)C.fail('PERMITTED_METADATA_REQUIRED');const curator=await tx.artistProfile.upsert({where:{userId:request.user.id},create:{userId:request.user.id,genres:[]},update:{}});track=await tx.track.create({data:{title:b.title,primaryArtistName:b.artistName,durationSeconds:b.durationSeconds || 0,tags:[],artistId:curator.id,status:'PUBLISHED',isPublic:false,catalogScope:'EXTERNAL_BETA'}});}
      const record=await tx.externalRecording.create({data:{trackId:track.id,curatorId:request.user.id,versionType:b.versionType || 'UNKNOWN',metadataProvenance:b.nativeTrackId?'NOIRSOUND_NATIVE':b.provenance,...(link?{sources:{create:{provider:b.provider,...link,playbackMode:'LINK_OUT',availability:'UNKNOWN',provenance:'ADMIN_LINK',matchStatus:'CONFIRMED',verificationEvidence:b.provenance,isPrimary:true,checkedAt:new Date()}}}: {})},include:C.includeRecording});await C.recordAudit(tx,request,'EXTERNAL_RECORDING_CREATE',record.id,b.reason);return record;
    });return {recording:C.recordingView(r)};
  });
  fastify.get('/recordings',read,async request=>{
    const q=String(request.query.q || '').trim().slice(0,200);
    const records=await fastify.prisma.externalRecording.findMany({where:{mergedIntoId:null,...(q?{track:{title:{contains:q,mode:'insensitive'}}}:{})},include:C.includeRecording,orderBy:{createdAt:'desc'},take:30});
    // Refresh selected catalog entries only, bounded to this page. No raw payload cache.
    for(const r of records)if(r.metadataProvenance==='AUDIUS_PUBLIC_API' && (!r.metadataExpiresAt || r.metadataExpiresAt<new Date() || r.sources.some(s=>s.availability==='ERROR'))) {
      const source=r.sources.find(s=>s.provider==='AUDIUS');if(source)try{await refreshSource(source);}catch{}
    }
    const fresh=await fastify.prisma.externalRecording.findMany({where:{id:{in:records.map(r=>r.id)}},include:C.includeRecording,orderBy:{createdAt:'desc'}});
    const views=fresh.map(r=>C.recordingView(r));const explicitVersion=C.versionFromTitle(q)!=='UNKNOWN';
    return {items:explicitVersion?views:views.filter(r=>!r.parentId).map(r=>({...r,otherVersions:views.filter(v=>v.parentId===r.recordingId)})),limit:30};
  });
  fastify.get('/recordings/:id',read,async request=>{
    let r=await getRecording(request.params.id);if(r.mergedIntoId)r=await getRecording(r.mergedIntoId);
    for(const s of r.sources)if(s.provider==='AUDIUS' && (!s.checkedAt || Date.now()-s.checkedAt.getTime()>86400000 || s.availability==='ERROR'))try{await refreshSource(s);}catch{}
    return {recording:C.recordingView(await getRecording(r.id)),versions:(await fastify.prisma.externalRecording.findMany({where:{parentId:r.id,mergedIntoId:null},include:C.includeRecording})).map(r=>C.recordingView(r)),audit:await fastify.prisma.auditLog.findMany({where:{targetType:'EXTERNAL_RECORDING',targetId:r.id},select:{id:true,action:true,reason:true,createdAt:true},orderBy:{createdAt:'desc'},take:30})};
  });
  fastify.patch('/recordings/:id',{...mutate,schema:bodySchema({versionType:{type:'string',enum:C.VERSIONS},versionLabel:{type:'string',maxLength:200},parentId:{anyOf:[textSchema,{type:'null'}]},isrc:{anyOf:[{type:'string',pattern:'^[A-Z]{2}[A-Z0-9]{3}[0-9]{7}$'},{type:'null'}]},reason:reasonSchema},['reason'])},async request=>{
    const {reason,...updates}=request.body;
    return fastify.prisma.$transaction(async tx=>{
      await C.catalogLock(tx);const r=await tx.externalRecording.findUnique({where:{id:request.params.id},include:C.includeRecording});if(!r)C.fail('EXTERNAL_RECORDING_NOT_FOUND',404);
      if(r.mergedIntoId || r.members.length)C.fail('UNMERGE_BEFORE_VERSION_EDIT',409);
      if(updates.parentId) {const parent=await tx.externalRecording.findUnique({where:{id:updates.parentId}});if(!parent || parent.parentId || parent.mergedIntoId || parent.id===r.id || (updates.versionType || r.versionType)==='ORIGINAL')C.fail('VERSION_PARENT_INVALID');}
      await tx.externalRecording.update({where:{id:r.id},data:updates});await C.recordAudit(tx,request,'EXTERNAL_VERSION_UPDATE',r.id,reason,updates);return {success:true};
    });
  });
  fastify.post('/recordings/:id/sources',{...mutate,schema:bodySchema({provider:{type:'string',enum:C.PROVIDERS},url:{type:'string',maxLength:1000},reason:reasonSchema},['provider','url','reason'])},async request=>{
    const b=request.body;let link=C.platformUrl(b.provider,b.url),m=null;
    if(b.provider==='AUDIUS'){m=await audius.resolve(link.canonicalUrl);link={canonicalUrl:m.canonicalUrl,externalId:m.externalId};}
    return fastify.prisma.$transaction(async tx=>{
      await C.catalogLock(tx);const r=await tx.externalRecording.findUnique({where:{id:request.params.id}});if(!r || r.mergedIntoId)C.fail('EXTERNAL_RECORDING_NOT_FOUND',404);
      const existing=await tx.externalSource.findFirst({where:{OR:[{canonicalUrl:link.canonicalUrl},...(link.externalId?[{provider:b.provider,externalId:link.externalId}]:[])]}});
      if(existing) {if(existing.recordingId!==r.id)C.fail('SOURCE_ALREADY_ATTACHED_MERGE_REQUIRED',409);return {source:existing};}
      const source=await tx.externalSource.create({data:{provider:b.provider,...link,recordingId:r.id,playbackMode:m?.playbackMode || 'LINK_OUT',availability:m?.availability || 'UNKNOWN',provenance:m?.provenance || 'ADMIN_LINK',checkedAt:m?.checkedAt || new Date()}});await C.recordAudit(tx,request,'EXTERNAL_SOURCE_ADD',r.id,b.reason,{sourceId:source.id});return {source};
    });
  });
  fastify.patch('/sources/:id',{...mutate,schema:bodySchema({url:{type:'string',maxLength:1000},matchStatus:{type:'string',enum:['UNVERIFIED','CONFIRMED','REJECTED']},officialStatus:{type:'string',enum:['UNVERIFIED','VERIFIED','REJECTED']},evidence:reasonSchema,isPrimary:{type:'boolean'},reason:reasonSchema},['reason'])},async request=>{
    return fastify.prisma.$transaction(async tx=>{
      await C.catalogLock(tx);const s=await tx.externalSource.findUnique({where:{id:request.params.id},include:{recording:{include:{members:true}}}});if(!s)C.fail('EXTERNAL_SOURCE_NOT_FOUND',404);
      const b=request.body;const updates={};
      if(b.url){if(s.provider==='AUDIUS')C.fail('AUDIUS_SOURCE_ID_IMMUTABLE');Object.assign(updates,C.platformUrl(s.provider,b.url));updates.matchStatus='UNVERIFIED';updates.officialStatus='UNVERIFIED';updates.verificationEvidence=null;updates.isPrimary=false;}
      if((b.matchStatus==='CONFIRMED'||b.officialStatus==='VERIFIED')&&!b.evidence)C.fail('VERIFICATION_EVIDENCE_REQUIRED');
      if(b.matchStatus)updates.matchStatus=b.matchStatus;if(b.officialStatus)updates.officialStatus=b.officialStatus;if(b.evidence)updates.verificationEvidence=b.evidence;
      updates.checkedAt=new Date();
      if(b.isPrimary!==undefined) {
        const match=updates.matchStatus || s.matchStatus,official=updates.officialStatus || s.officialStatus;
        if(b.isPrimary && (match!=='CONFIRMED'||official!=='VERIFIED'))C.fail('CONFIRMED_OFFICIAL_PRIMARY_REQUIRED');
        if(b.isPrimary) {
          const rootId=s.recording.mergedIntoId || s.recordingId;const group=await tx.externalRecording.findMany({where:{OR:[{id:rootId},{mergedIntoId:rootId}]},select:{id:true}});
          await tx.externalSource.updateMany({where:{recordingId:{in:group.map(r=>r.id)},provider:s.provider},data:{isPrimary:false}});
        }
        updates.isPrimary=b.isPrimary;
      }
      if((updates.matchStatus==='REJECTED'||updates.officialStatus==='REJECTED'))updates.isPrimary=false;
      const result=await tx.externalSource.update({where:{id:s.id},data:updates});await C.recordAudit(tx,request,'EXTERNAL_SOURCE_VERIFY',s.recordingId,b.reason,{sourceId:s.id,...updates});return {source:result};
    });
  });
  fastify.post('/recordings/:id/merge',{...mutate,schema:bodySchema({intoId:textSchema,reason:reasonSchema,evidence:reasonSchema},['intoId','reason','evidence'])},async request=>{
    return fastify.prisma.$transaction(async tx=>{
      await C.catalogLock(tx);const a=await tx.externalRecording.findUnique({where:{id:request.params.id},include:C.includeRecording}),b=await tx.externalRecording.findUnique({where:{id:request.body.intoId},include:C.includeRecording});
      if(!a || !b || a.id===b.id || a.mergedIntoId || b.mergedIntoId || a.members.length || a.parentId!==b.parentId)C.fail('MERGE_INVALID',409);
      // Manual evidence is mandatory even for strong ISRC. No fuzzy auto-merge.
      if(C.matchAssessment(a,b)==='CONFLICT')C.fail('RECORDING_VERSION_CONFLICT',409);
      await tx.externalRecording.update({where:{id:a.id},data:{mergedIntoId:b.id}});
      await tx.externalSource.updateMany({where:{recordingId:a.id},data:{matchStatus:'CONFIRMED',verificationEvidence:request.body.evidence}});
      await C.recordAudit(tx,request,'EXTERNAL_MERGE',b.id,request.body.reason,{memberId:a.id,evidence:request.body.evidence,sourceStates:a.sources.map(s=>({id:s.id,matchStatus:s.matchStatus,isPrimary:s.isPrimary,verificationEvidence:s.verificationEvidence}))});return {success:true};
    });
  });
  fastify.post('/recordings/:id/unmerge',{...mutate,schema:bodySchema({reason:reasonSchema},['reason'])},async request=>{
    return fastify.prisma.$transaction(async tx=>{
      await C.catalogLock(tx);const r=await tx.externalRecording.findUnique({where:{id:request.params.id}});if(!r?.mergedIntoId)C.fail('UNMERGE_INVALID',409);
      const merge=await tx.auditLog.findFirst({where:{action:'EXTERNAL_MERGE',targetId:r.mergedIntoId,metadata:{path:['memberId'],equals:r.id}},orderBy:{createdAt:'desc'}});
      if(!Array.isArray(merge?.metadata?.sourceStates))C.fail('UNMERGE_AUDIT_REQUIRED',409);
      await tx.externalRecording.update({where:{id:r.id},data:{mergedIntoId:null}});
      for(const state of merge.metadata.sourceStates)await tx.externalSource.update({where:{id:state.id},data:{matchStatus:state.matchStatus,isPrimary:state.isPrimary,verificationEvidence:state.verificationEvidence}});
      await C.recordAudit(tx,request,'EXTERNAL_UNMERGE',r.mergedIntoId,request.body.reason,{memberId:r.id});return {success:true};
    });
  });
  fastify.get('/recordings/:id/playback',{...read,schema:{querystring:{type:'object',additionalProperties:false,properties:{sourceId:textSchema},required:['sourceId']}}},async request=>{
    const r=await getRecording(request.params.id);const source=[...r.sources,...r.members.flatMap(m=>m.sources)].find(s=>s.id===request.query.sourceId);
    if(!source)C.fail('EXTERNAL_SOURCE_NOT_FOUND',404);
    if(source.matchStatus!=='CONFIRMED' || source.officialStatus==='REJECTED' || ['UNAVAILABLE','ERROR'].includes(source.availability))C.fail('EXTERNAL_SOURCE_NOT_PLAYABLE',409);
    if(EMBED_PROVIDERS.includes(source.provider))return officialEmbed(source.provider,source.canonicalUrl);
    if(source.playbackMode==='LINK_OUT')return {playbackMode:'LINK_OUT',canonicalUrl:source.canonicalUrl,provider:source.provider};
    if(source.provider!=='AUDIUS')C.fail('EXTERNAL_PROVIDER_UNSUPPORTED');
    try {const p=await audius.playback(source.externalId);await refreshSource(source);return {url:p.url,playbackMode:p.playbackMode,provider:p.provider,expiresAt:p.expiresAt};}
    catch(e){await fastify.prisma.externalSource.update({where:{id:source.id},data:{availability:['AUDIUS_HTTP_404','AUDIUS_HTTP_403','EXTERNAL_TRACK_UNAVAILABLE'].includes(e.code)?'UNAVAILABLE':'ERROR',checkedAt:new Date()}});throw e;}
  });
  fastify.post('/recordings/:id/play-event',{...mutate,schema:bodySchema({sourceId:textSchema,durationListenedSeconds:{type:'integer',minimum:1,maximum:3600},completed:{type:'boolean'}},['sourceId','durationListenedSeconds'])},async request=>{
    const r=await getRecording(request.params.id);const s=[...r.sources,...r.members.flatMap(m=>m.sources)].find(s=>s.id===request.body.sourceId && s.playbackMode==='EXTERNAL_STREAM');if(!s)C.fail('EXTERNAL_SOURCE_NOT_PLAYABLE');
    await fastify.prisma.externalPlaybackEvent.create({data:{recordingId:r.id,userId:request.user.id,provider:s.provider,durationListenedSeconds:Math.min(request.body.durationListenedSeconds,r.track.durationSeconds || 3600),completed:!!request.body.completed}});return {success:true,source:'NOIRSOUND_EXTERNAL_PLAYBACK',providerListenVerified:false};
  });
  // Bounded expiry sweep purges stale provider metadata, preserving Track IDs and links.
  let sweep;
  fastify.addHook('onReady',async()=>{
    const expire=async()=>{try{const rows=await fastify.prisma.externalRecording.findMany({where:{metadataProvenance:'AUDIUS_PUBLIC_API',metadataExpiresAt:{lt:new Date()}},select:{id:true,trackId:true},take:100});for(const r of rows)await fastify.prisma.$transaction([fastify.prisma.externalRecording.update({where:{id:r.id},data:{metadataExpiresAt:null,isrc:null}}),fastify.prisma.track.update({where:{id:r.trackId},data:{title:'Metadata refresh required',primaryArtistName:null,coverUrl:null}}),fastify.prisma.externalSource.updateMany({where:{recordingId:r.id,provider:'AUDIUS'},data:{availability:'UNKNOWN'}})]);}catch{fastify.log.warn('External metadata expiry sweep unavailable');}};
    await expire();sweep=setInterval(expire,3600000);sweep.unref();
  });
  fastify.addHook('onClose',async()=>clearInterval(sweep));
};
