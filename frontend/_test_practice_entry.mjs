// Execute the real PracticePage script setup, with only browser/services stubbed.
import fs from 'node:fs'
import vm from 'node:vm'
import assert from 'node:assert/strict'
import { parse } from '@vue/compiler-sfc'
import { ref, reactive, computed, watch, nextTick, effectScope } from 'vue'
import * as book from './src/book.js'
const source=fs.readFileSync(new URL('./src/pages/PracticePage.vue',import.meta.url),'utf8')
const script=parse(source).descriptor.scriptSetup.content
async function mount(items,focus){
 const state=ref(items),route=reactive({params:{mode:'original'},query:{focus}}),scope=effectScope(),mounted=[]
 const context={useTour:()=>({tourOpen:ref(false)}),console,ref,reactive,computed,watch,nextTick,...book,window:{addEventListener(){},removeEventListener(){}},document:{querySelector(){return null}},onMounted:f=>mounted.push(f),onBeforeUnmount(){},useRoute:()=>route,useRouter:()=>({push(){}}),bookRef:()=>state,settingsRef:()=>ref({pace:'standard'}),toast:{info(){},error(){}},api:{},recordAction(){}}
 // Components and non-invoked services are dummy imports; actual Vue reactivity is retained.
 for(const match of script.matchAll(/^import\s+([\s\S]*?)\s+from\s+['"][^'"]+['"]\s*$/gm)){
  const names=match[1].replace(/[{}]/g,'').split(',').map(x=>x.trim().split(/\s+as\s+/).at(-1))
  for(const name of names) if(!(name in context))context[name]=()=>{}
 }
 const cleaned=script.replace(/^import\s+[\s\S]*?\s+from\s+['"][^'"]+['"]\s*$/gm,'')
 vm.createContext(context);scope.run(()=>vm.runInContext(cleaned,context));mounted.forEach(f=>f())
 const page=vm.runInContext('({stage,paper,mode,focusId})',context)
 return {page,state,route,stop:()=>scope.stop()}
}
let a=await mount([{id:7,question:'Mastered question',mastered:true}], '7')
assert.equal(a.page.stage.value,'answering','route entry must actually start mastered redo')
assert.equal(a.page.paper.value[0].refId,7);a.stop()
a=await mount([], '9');assert.equal(a.page.stage.value,'config')
a.state.value=[{id:9,question:'Cloud mastered',mastered:true}];await nextTick()
assert.equal(a.page.stage.value,'answering','cloud hydration starts requested redo')
assert.equal(a.page.paper.value.length,1);assert.equal(a.page.paper.value[0].refId,9)
a.page.stage.value='result';a.state.value=[...a.state.value];await nextTick();assert.equal(a.page.stage.value,'result','sync must not restart completed redo')
a.route.query.focus='10';a.state.value=[...a.state.value,{id:10,question:'Next',mastered:true}];await nextTick();assert.equal(a.page.paper.value[0].refId,10);a.stop()
a=await mount([{id:7,mastered:true}], 'missing');assert.equal(a.page.stage.value,'config');a.stop()
console.log('PASS PracticePage actual entry: mastered redo, delayed cloud hydration, no repeat restart, route changes, missing id')
