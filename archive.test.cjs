'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {safeUrl,dateKey,sourceKey,filterProjects,validateArchive,element,externalLink}=require('./app.js');
const data=JSON.parse(fs.readFileSync(path.join(__dirname,'projects.json'),'utf8'));
const clone=()=>structuredClone(data);
test('public dataset is valid, nonempty and source IDs unique',()=>{
  assert.equal(validateArchive(data),data);assert.ok(data.count>0);
  assert.equal(new Set(data.projects.map(p=>`${p.provider}:${p.sourceId}`)).size,data.count);
  assert.equal(new Set(data.projects.map(p=>p.canonicalUrl)).size,data.count);
});
test('schema failures are rejected rather than rendered',()=>{
  for(const change of [d=>{d.count++},d=>{d.schemaVersion='2.0.0'},d=>{d.projects[1].id=d.projects[0].id},d=>{d.projects[0].what=''},d=>{d.projects[0].url='javascript:alert(1)'},d=>{d.projects[0].whySource.urls=[]},d=>{d.projects[0].publishedAt='yesterday'},d=>{d.projects[0].verification.status='fully_verified'}]){
    const modified=clone();change(modified);assert.throws(()=>validateArchive(modified));
  }
});
test('only absolute credential-free HTTP(S) URLs are accepted',()=>{
  for(const url of ['javascript:alert(1)','data:text/html,<script>alert(1)</script>','//evil.example','/relative','file:///etc/passwd','https://a:b@example.com/','https://example.com\n.evil.test','https://example.com\\evil',' https://example.com','https://'])assert.equal(safeUrl(url),null,url);
  assert.equal(safeUrl('https://example.com/?q=%3Cscript%3E'),'https://example.com/?q=%3Cscript%3E');
  assert.equal(safeUrl('http://example.com/path'),'http://example.com/path');
});
test('dates filter in Asia/Shanghai, including UTC midnight boundary',()=>{
  assert.equal(dateKey('2026-10-04T16:00:00Z'),'2026-10-05');
  assert.equal(dateKey('2026-10-04T15:59:59Z'),'2026-10-04');
  const filtered=filterProjects(data.projects,{from:'2026-10-05',to:'2026-10-05'});
  assert.ok(filtered.length>0);assert.ok(filtered.every(p=>dateKey(p.publishedAt)==='2026-10-05'));
  assert.equal(filterProjects(data.projects,{from:'2026-10-06',to:'2026-10-04'}).length,0);
});
test('search, generic sources, all/none and descending dates',()=>{
  const result=filterProjects(data.projects,{});assert.equal(result.length,data.count);
  assert.ok(result.every((p,i)=>i===0||Date.parse(result[i-1].publishedAt)>=Date.parse(p.publishedAt)));
  const first=result[0];assert.ok(filterProjects(data.projects,{search:first.title.toUpperCase()}).some(p=>p.id===first.id));
  assert.equal(filterProjects(data.projects,{search:'no-match-2ae81ff3'}).length,0);
  assert.equal(filterProjects(data.projects,{source:sourceKey(first)}).length,data.count);
  assert.equal(filterProjects(data.projects,{source:'future:source'}).length,0);
  const future={...first,id:'new:1',provider:'other_platform',source:'launches'};
  assert.equal(filterProjects([...data.projects,future],{source:sourceKey(future)}).length,1);
});
test('untrusted text stays text and links isolate their opener',()=>{
  const doc={createElement:tag=>({tag,textContent:'',className:''})};
  const payload='<img src=x onerror="alert(1)"> & <script>alert(2)</script>';
  const el=element(doc,'p',payload,'test');assert.equal(el.textContent,payload);assert.equal(el.innerHTML,undefined);
  const link=externalLink(doc,payload,'https://example.com/?q=%3Cscript%3E');
  assert.equal(link.textContent,payload);assert.equal(link.rel,'noopener noreferrer');assert.equal(link.target,'_blank');assert.equal(link.referrerPolicy,'no-referrer');
  assert.equal(externalLink(doc,'bad','javascript:alert(1)'),null);
});
test('static bundle has relative assets, security policy and no HTML injection sinks',()=>{
  const js=fs.readFileSync(path.join(__dirname,'app.js'),'utf8');
  const html=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
  assert.doesNotMatch(js,/\.innerHTML\s*=|insertAdjacentHTML|document\.write\(|\beval\(/);
  assert.match(html,/Content-Security-Policy/);assert.match(html,/src="\.\/app.js"/);assert.match(html,/href="\.\/style.css"/);assert.match(js,/fetch\('\.\/projects.json'/);
  assert.doesNotMatch(html,/<script[^>]+src="https?:|<iframe/i);
});
