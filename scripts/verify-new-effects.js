/* Verify the experimental lyric-effect contract without a browser. */
'use strict';
const fs=require('fs');
const path=require('path');
const cp=require('child_process');
const root=path.join(__dirname,'..');
const expected=[
  ['karaoke','effects/karaoke.js','Inter Tight'],
  ['slide','effects/slide.js','Bricolage Grotesque'],
  ['bounce','effects/bounce.js','Archivo Narrow']
];
const failures=[];
for(const [name,file,font] of expected){
  const full=path.join(root,file);
  if(!fs.existsSync(full)){failures.push(`missing file: ${file}`);continue;}
  const syntax=cp.spawnSync(process.execPath,['--check',full],{encoding:'utf8'});
  if(syntax.status!==0)failures.push(`syntax error: ${file}\n${syntax.stderr}`);
  const src=fs.readFileSync(full,'utf8');
  if(!src.includes(`kefeEffects.${name}`))failures.push(`missing renderer registration: ${name}`);
  if(!src.includes(font))failures.push(`missing bundled font contract usage: ${name} -> ${font}`);
}
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
for(const [name,file] of expected){
  if(!html.includes(`data-effect="${name}"`))failures.push(`missing UI button: ${name}`);
  if(!html.includes(`./${file}`))failures.push(`missing script tag: ${file}`);
}
if(failures.length){console.error('NEW EFFECT CHECK FAILED\n- '+failures.join('\n- '));process.exit(1);}
console.log('NEW EFFECT CHECK PASSED — Karaoke, Slide and Bounce are wired and syntactically valid.');
