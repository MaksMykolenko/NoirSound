'use strict';
const crypto = require('node:crypto');
function createImportTokens(secret) {
  const key = crypto.createHash('sha256').update('noirsound-playlist-import:' + secret).digest();
  return {
    seal(value, purpose, lifetime = 900000) {
      const iv = crypto.randomBytes(12), cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
      cipher.setAAD(Buffer.from(purpose));
      const encrypted = Buffer.concat([cipher.update(JSON.stringify({ ...value, expires:Date.now()+lifetime })),cipher.final()]);
      return Buffer.concat([iv,cipher.getAuthTag(),encrypted]).toString('base64url');
    },
    open(value, purpose) {
      try {
        if(typeof value!=='string'||value.length>8000)return null;
        const data=Buffer.from(value,'base64url'), decipher=crypto.createDecipheriv('aes-256-gcm',key,data.subarray(0,12));
        decipher.setAAD(Buffer.from(purpose));decipher.setAuthTag(data.subarray(12,28));
        const payload=JSON.parse(Buffer.concat([decipher.update(data.subarray(28)),decipher.final()]).toString());
        return payload.expires>Date.now()?payload:null;
      } catch { return null; }
    },
  };
}
module.exports={createImportTokens};
