import { registerHooks } from 'node:module';
registerHooks({resolve(specifier, context, nextResolve) {
 if(specifier==='next/headers') return nextResolve('next/headers.js',context);
 if(specifier==='server-only') return {url:'data:text/javascript,export {}',shortCircuit:true};
 if(specifier.startsWith('@/')) return nextResolve(new URL('../src/'+specifier.slice(2)+'.ts',import.meta.url).href,context);
 if(specifier.startsWith('./') && context.parentURL?.endsWith('/src/lib/usage-monitor.ts')) return nextResolve(new URL(specifier+'.ts',context.parentURL).href,context);
 return nextResolve(specifier,context);
}});
