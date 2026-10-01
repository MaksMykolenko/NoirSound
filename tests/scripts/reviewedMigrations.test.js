import {describe,it,expect} from 'vitest';
import verifier from '../../backend/scripts/verify-reviewed-migrations.cjs';
const {verifyHistory}=verifier;
const files=[{name:'existing',sha256:'a'},{name:'additive',sha256:'b'}];
const history=[{migration_name:'existing',checksum:'a',finished_at:new Date(),rolled_back_at:null}];
describe('exact additive migration review',()=>{
 it('accepts only the reviewed pending checksum',()=>expect(verifyHistory(history,files,{additive:'b'})).toEqual(['additive']));
 it('rejects changed or unknown SQL',()=>{expect(()=>verifyHistory(history,files,{additive:'c'})).toThrow();expect(()=>verifyHistory(history,files,{})).toThrow();});
 it('rejects failed or divergent live history',()=>{expect(()=>verifyHistory([{...history[0],finished_at:null}],files,{additive:'b'})).toThrow();expect(()=>verifyHistory([{...history[0],checksum:'x'}],files,{additive:'b'})).toThrow();});
 it('does not reinterpret unrelated status failures as permission to deploy',()=>expect(()=>verifyHistory(history,files.slice(0,1),{})).toThrow());
});
