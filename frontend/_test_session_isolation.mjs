import { build } from 'esbuild'
import { pathToFileURL } from 'node:url'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
const mem=new Map()
globalThis.localStorage={getItem:k=>mem.get(k)||null,setItem:(k,v)=>mem.set(k,String(v)),removeItem:k=>mem.delete(k),key:i=>[...mem.keys()][i],get length(){return mem.size}}
globalThis.document={cookie:'',createElement:()=>({}),addEventListener(){},visibilityState:'visible'}
const root=fileURLToPath(new URL('.',import.meta.url))
const tmp=await mkdtemp(path.join(os.tmpdir(),'zhiyi-session-test-'))
try {
 const outfile=path.join(tmp,'bundle.mjs')
 await build({stdin:{contents: `export * as S from './src/stores/sessionStore.js'; export * as B from './src/stores/bookStore.js'; export {api} from './src/api.js'; export * as auth from './src/auth.js'; export * as C from './src/stores/chatStore.js'; export * as P from './src/profileStore.js';`,resolveDir:root},bundle:true,platform:'node',format:'esm',outfile,define:{'import.meta.env':'{}'}})
 const {S,B,api,auth,C,P}=await import(pathToFileURL(outfile))
 let cloud={ok:true,account_id:1,items:[],deleted_ids:[],stats:{}};const pushes=[]
 api.sync.pull=async()=>cloud;api.sync.push=async(...a)=>{pushes.push(a);return {ok:true}}
 api.account.profile=async()=>({ok:true,profile:{}});api.account.saveProfile=async()=>({ok:true})
 S.initSession();mem.set('zhiyi_errorbook_account_v1',JSON.stringify([{id:'legacy'}]))
 auth.adoptSession('A','A-token',1);await S.adoptLogin({token:'A-token',userId:'A',accountId:1})
 assert.equal(B.currentSpace(),'account');assert.equal(B.getItems().length,0,'legacy cache not imported')
 C.createChat('A private chat'); P.updateProfile({nickname:'Private A'});
 B.upsert({id:'a',question:'A private'});assert.equal(JSON.parse(mem.get('zhiyi_errorbook_account_v1:uid:1'))[0].id,'a');assert.equal(mem.has('zhiyi_errorbook_v1'),false)
 S.logout(true);cloud={...cloud,account_id:2,items:[]};auth.adoptSession('B','B-token',2);await S.adoptLogin({token:'B-token',userId:'B',accountId:2});assert.equal(B.getItems().length,0);assert.equal(C.chatRef().value.length,0,'chat cache partitioned');assert.notEqual(P.getProfile().nickname,'Private A','profile cache partitioned')
 api.sync.pull=async()=>{throw new Error('network timeout')};await S.refreshCloud();assert.equal(S.session.userId,'B')
 let resolveOld;api.sync.pull=()=>new Promise(r=>{resolveOld=r});const pending=S.refreshCloud();S.logout(true)
 cloud={...cloud,account_id:1,items:[{id:'cloudA'}]};api.sync.pull=async()=>cloud;auth.adoptSession('A','A-new',1);await S.adoptLogin({token:'A-new',userId:'A',accountId:1})
 resolveOld({ok:true,account_id:2,items:[{id:'staleB'}]});await pending;assert.equal(S.session.userId,'A');assert(!B.getItems().some(x=>x.id==='staleB'))
 B.remove('a');cloud={...cloud,items:[{id:'a'},{id:'newTeach'}]};await S.refreshCloud();assert(!B.getItems().some(x=>x.id==='a'));assert(B.getItems().some(x=>x.id==='newTeach'))
 await S.syncNow();assert(pushes.at(-1)[6].includes('a'))
 api.sync.pull=async()=>({ok:true,account_id:1,items:[],deleted_ids:['newTeach']});await S.refreshCloud();assert(!B.getItems().some(x=>x.id==='newTeach'))
 api.sync.pull=async()=>{let e=new Error('expired');e.code='AUTH_INVALID';throw e};await S.refreshCloud();assert.equal(S.session.space,'guest')
 console.log('PASS account isolation, stale responses, transient network, auth expiry, classroom refresh, deletion propagation')
} finally {assert(path.resolve(tmp).startsWith(path.resolve(os.tmpdir()) + path.sep + 'zhiyi-session-test-')); await rm(tmp,{recursive:true,force:true})}
