/* Build-free archive. Public source content is always rendered as text. */
(function () {
  'use strict';
  const TIME_ZONE = 'Asia/Shanghai';
  const WHY_LABELS = Object.freeze({author_stated:'作者自述',official_stated:'官方自述',product_goal_only:'仅产品目标',not_stated:'未明确说明'});
  const CHECK_LABELS = Object.freeze({interactive_demo:'部分演示已观察',page_reviewed:'网页已核对',source_reviewed:'资料已核对',limited:'核查有限'});
  const SOURCE_TYPES = Object.freeze({discussion:'原始讨论',official_site:'官方网站',repository:'代码与文档',source_metadata:'来源元数据'});
  const DATE_FORMAT = new Intl.DateTimeFormat('zh-CN',{timeZone:TIME_ZONE,year:'numeric',month:'2-digit',day:'2-digit'});
  const TIME_FORMAT = new Intl.DateTimeFormat('zh-CN',{timeZone:TIME_ZONE,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false});

  function safeUrl(value) {
    if (typeof value !== 'string' || !/^https?:\/\//i.test(value) || /[\u0000-\u0020\u007f\\]/.test(value)) return null;
    try { const parsed = new URL(value); return ['https:','http:'].includes(parsed.protocol) && parsed.hostname && !parsed.username && !parsed.password ? parsed.href : null; } catch { return null; }
  }
  function dateKey(value) {
    const date = new Date(value);
    if (!Number.isFinite(date.valueOf())) return '';
    const parts = Object.fromEntries(DATE_FORMAT.formatToParts(date).map(part=>[part.type,part.value]));
    return `${parts.year}-${parts.month}-${parts.day}`;
  }
  function sourceKey(project) { return `${project.provider}:${project.source}`; }
  function sourceLabel(project) { return project.provider === 'hacker_news' && project.source === 'show_hn' ? 'Hacker News · Show HN' : `${project.provider.replaceAll('_',' ')} · ${project.source.replaceAll('_',' ')}`; }
  function filterProjects(projects,filters={}) {
    const terms=(filters.search||'').trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
    if (filters.from && filters.to && filters.from > filters.to) return [];
    return projects.filter(project=> {
      const date=dateKey(project.publishedAt);
      const haystack=[project.title,project.what,project.audience,project.why,project.provider,project.source,sourceLabel(project),project.url,...(project.tags||[])].join(' ').toLocaleLowerCase();
      return (!filters.source || sourceKey(project)===filters.source) && (!filters.from || date>=filters.from) && (!filters.to || date<=filters.to) && terms.every(term=>haystack.includes(term));
    }).sort((a,b)=>Date.parse(b.publishedAt)-Date.parse(a.publishedAt)||a.id.localeCompare(b.id));
  }
  function validateArchive(data) {
    const nonempty=value=>typeof value==='string'&&value.trim().length>0;
    const timestamp=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)&&Number.isFinite(Date.parse(value));
    if (!data || data.schemaVersion!=='1.0.0' || !nonempty(data.language) || !timestamp(data.updatedAt) || !Array.isArray(data.projects) || data.count!==data.projects.length) throw new Error('数据版本、数量或更新时间不正确');
    const ids=new Set();
    for (const project of data.projects) {
      if (!project || ['id','provider','source','sourceId','title','audience','what','why'].some(key=>!nonempty(project[key]))) throw new Error('产品记录缺少必要信息');
      if (ids.has(project.id)) throw new Error('产品记录 ID 重复');
      ids.add(project.id);
      if (['url','canonicalUrl','sourceUrl'].some(key=>!safeUrl(project[key])) || (project.hnUrl!=null&&!safeUrl(project.hnUrl))) throw new Error('产品记录含无效链接');
      if (!timestamp(project.publishedAt)||!timestamp(project.discoveredAt)||Date.parse(project.publishedAt)>Date.parse(project.discoveredAt)) throw new Error('产品时间无效');
      if (!project.whySource || !Object.hasOwn(WHY_LABELS,project.whySource.status) || !Array.isArray(project.whySource.urls) || !project.whySource.urls.length || project.whySource.urls.some(url=>!safeUrl(url))) throw new Error('创作动机缺少出处');
      if (!project.verification || !Object.hasOwn(CHECK_LABELS,project.verification.status) || !nonempty(project.verification.summary) || !timestamp(project.verification.checkedAt)) throw new Error('核查信息无效');
      if (!Array.isArray(project.caveats) || project.caveats.some(value=>!nonempty(value))) throw new Error('核查限制格式无效');
      if (!Array.isArray(project.sources)||!project.sources.length||project.sources.some(source=>!source||!Object.hasOwn(SOURCE_TYPES,source.type)||!safeUrl(source.url))) throw new Error('公开出处格式无效');
      if (project.tags!==undefined&&(!Array.isArray(project.tags)||project.tags.some(value=>!nonempty(value)))) throw new Error('标签格式无效');
    }
    return data;
  }
  function element(document,tag,text,className) {
    const node=document.createElement(tag);
    if (text!==undefined && text!==null) node.textContent=String(text);
    if (className) node.className=className;
    return node;
  }
  function externalLink(document,label,url) {
    const href=safeUrl(url);
    if (!href) return null;
    const link=element(document,'a',label);
    link.href=href;link.target='_blank';link.rel='noopener noreferrer';link.referrerPolicy='no-referrer';
    return link;
  }
  const api={safeUrl,dateKey,sourceKey,sourceLabel,filterProjects,validateArchive,element,externalLink};
  if (typeof module!=='undefined' && module.exports) module.exports=api;
  if (typeof document==='undefined') return;

  const $=id=>document.getElementById(id);
  const dialog=$('project-dialog');
  let archive=null;
  let lastTrigger=null;
  let activeId=null;
  let loading=false;
  function make(tag,text,className) { return element(document,tag,text,className); }
  function formatTime(value) { return TIME_FORMAT.format(new Date(value)); }
  function addSection(container,title,content) { const section=make('section',null,'detail-section');section.append(make('h3',title),make('p',content));container.append(section); }
  function buildCard(project) {
    const card=make('article',null,'project-card');
    const top=make('div',null,'card-top');
    const time=make('time',dateKey(project.publishedAt));time.dateTime=project.publishedAt;time.title=`来源帖发布：${formatTime(project.publishedAt)} 北京时间`;
    top.append(make('span',sourceLabel(project),'source-badge'),time);
    const title=make('h3',project.title);
    const summary=make('p',project.what,'project-summary');
    const facts=make('dl',null,'card-facts');
    facts.append(make('dt','谁会用'),make('dd',project.audience),make('dt','起点'),make('dd',project.why));
    const footer=make('div',null,'card-footer');
    const verification=make('span',CHECK_LABELS[project.verification.status],'creator');verification.title=project.verification.summary;
    const button=make('button','查看档案','detail-button');button.type='button';button.setAttribute('aria-label',`查看 ${project.title} 的档案`);
    button.addEventListener('click',()=>{lastTrigger=button;location.hash=`project=${encodeURIComponent(project.id)}`;});
    footer.append(verification,button);card.append(top,title,summary,facts,footer);return card;
  }
  function render() {
    if (!archive) return;
    const filters={search:$('search').value,source:$('source').value,from:$('date-from').value,to:$('date-to').value};
    const invalid=Boolean(filters.from&&filters.to&&filters.from>filters.to);
    $('date-error').hidden=!invalid;
    $('date-from').setAttribute('aria-invalid',String(invalid));$('date-to').setAttribute('aria-invalid',String(invalid));
    const results=filterProjects(archive.projects,filters);
    const fragment=document.createDocumentFragment();for(const project of results) fragment.append(buildCard(project));
    $('projects').replaceChildren(fragment);
    $('projects').setAttribute('aria-busy','false');
    $('result-count').replaceChildren(make('strong',results.length),document.createTextNode(` 个结果 / 共 ${archive.projects.length} 个产品`));
    $('empty-state').hidden=results.length!==0||invalid;
    $('clear-search').hidden=!filters.search;
  }
  function reset() { $('filters').reset();render(); }
  function renderDetail(project) {
    const container=$('project-detail');container.replaceChildren();
    container.append(make('div',`${sourceLabel(project)} · ${dateKey(project.publishedAt)}`,'detail-eyebrow'));
    const title=make('h2',project.title);title.id='detail-title';container.append(title);
    const meta=make('div',null,'detail-meta');
    meta.append(make('p',`来源帖发布：${formatTime(project.publishedAt)} 北京时间`),make('p',`收录批次：${formatTime(project.discoveredAt)} 北京时间`));container.append(meta);
    addSection(container,'在做什么',project.what);
    addSection(container,'为谁而做',project.audience);
    addSection(container,`为什么开始 · ${WHY_LABELS[project.whySource.status]}`,project.why);
    if(project.tags?.length) {const tags=make('div',null,'tags');project.tags.forEach(tag=>tags.append(make('span',tag,'tag')));container.append(tags);}
    const evidence=make('aside',null,'evidence-note');
    evidence.append(make('strong',`核查范围：${CHECK_LABELS[project.verification.status]}`),make('div',project.verification.summary));
    if (project.caveats.length) { const list=make('ul');project.caveats.forEach(text=>list.append(make('li',text)));evidence.append(list); }
    evidence.append(make('div',`核查时间：${formatTime(project.verification.checkedAt)} 北京时间`));container.append(evidence);
    const links=make('div',null,'detail-links');const seen=new Set();
    function addLink(label,url) {const href=safeUrl(url);if (!href||seen.has(href))return;seen.add(href);links.append(externalLink(document,label,href));}
    addLink('查看产品入口',project.url);addLink('查看原始来源',project.sourceUrl);
    project.sources.forEach(source=>addLink(SOURCE_TYPES[source.type],source.url));
    project.whySource.urls.forEach(url=>addLink('动机出处',url));
    container.append(links,make('p','链接在新标签页打开。产品入口可能是自托管项目的仓库或制作记录。','detail-link-note'));
  }
  function closeDetail(updateHash=true) {
    if (dialog.open) dialog.close();
    document.body.classList.remove('dialog-open');activeId=null;
    if(updateHash&&location.hash.startsWith('#project=')) history.replaceState(null,'',`${location.pathname}${location.search}#archive`);
    if(lastTrigger?.isConnected)lastTrigger.focus({preventScroll:true});
  }
  function syncHash() {
    if (!archive) return;
    if(!location.hash.startsWith('#project=')){closeDetail(false);return;}
    let id;try{id=decodeURIComponent(location.hash.slice(9));}catch{closeDetail();return;}
    const project=archive.projects.find(item=>item.id===id);
    if(!project){closeDetail();return;}
    if(activeId!==id){renderDetail(project);activeId=id;dialog.scrollTop=0;}
    if(!dialog.open)dialog.showModal();
    document.body.classList.add('dialog-open');$('close-dialog').focus({preventScroll:true});
  }
  async function loadArchive() {
    if(loading)return;loading=true;
    $('error-state').hidden=true;$('empty-state').hidden=true;$('projects').setAttribute('aria-busy','true');
    $('result-count').textContent='正在加载…';
    try{
      const response=await fetch('./projects.json',{cache:'no-cache',credentials:'omit'});
      if(!response.ok)throw new Error(`HTTP ${response.status}`);
      archive=validateArchive(await response.json());
      $('total-count').textContent=String(archive.projects.length);
      const sources=new Map();archive.projects.forEach(project=>sources.set(sourceKey(project),sourceLabel(project)));
      $('source-count').textContent=String(sources.size);
      const sourceSelect=$('source');sourceSelect.replaceChildren();const all=make('option','全部来源');all.value='';sourceSelect.append(all);
      for(const [key,label]of [...sources].sort((a,b)=>a[1].localeCompare(b[1]))){const option=make('option',label);option.value=key;sourceSelect.append(option);}
      $('updated-at').textContent=`最近核查 ${formatTime(archive.updatedAt)} 北京时间`;
      render();syncHash();
    }catch{
      archive=null;$('projects').replaceChildren();$('projects').setAttribute('aria-busy','false');$('result-count').textContent='未能读取档案';$('updated-at').textContent='';$('error-state').hidden=false;
      $('error-description').textContent='请稍后重新加载。如果问题持续，可通过页面中的公开数据文件查看记录。';
      if(!$('data-fallback')){const fallback=make('a','查看公开数据文件');fallback.id='data-fallback';fallback.href='./projects.json';$('error-state').append(document.createTextNode(' '),fallback);}
    }finally{loading=false;}
  }
  $('filters').addEventListener('submit',event=>event.preventDefault());
  $('search').addEventListener('input',render);
  ['source','date-from','date-to'].forEach(id=>$(id).addEventListener('change',render));
  $('clear-search').addEventListener('click',()=>{$('search').value='';render();$('search').focus();});
  $('reset-filters').addEventListener('click',reset);$('empty-reset').addEventListener('click',reset);$('retry-load').addEventListener('click',loadArchive);
  $('close-dialog').addEventListener('click',()=>closeDetail());
  dialog.addEventListener('cancel',event=>{event.preventDefault();closeDetail();});
  dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const box=dialog.getBoundingClientRect();if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)closeDetail();});
  window.addEventListener('hashchange',syncHash);
  loadArchive();
}());
