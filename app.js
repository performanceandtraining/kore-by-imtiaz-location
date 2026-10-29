'use strict';
(() => {
 const D=JSON.parse(document.getElementById('course-data').textContent);
 const CATS={roads:{label:'Roads',symbol:'R'},landmarks:{label:'Landmarks',symbol:'◆'},neighboring_areas:{label:'Neighbouring areas',symbol:'▱'},healthcare:{label:'Healthcare',symbol:'+'},education:{label:'Education',symbol:'S'}};
 const features=new Map(D.features.map(f=>[f.id,f])), routes=new Map(D.routes.map(r=>[r.destination_feature_id,r])), sources=new Map(D.sources.map(s=>[s.id,s]));
 const state={visible:new Set(Object.keys(CATS)),category:'landmarks',selected:null,showAllRoads:false};let map,tiles,selecting=false;const layers=new Map(),groups={};
 const $=id=>document.getElementById(id),el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined&&text!==null)n.textContent=String(text);if(cls)n.className=cls;return n;};
 const append=(n,...children)=>{children.flat().forEach(c=>c&&n.append(c));return n;};
 const safeURL=u=>{try{let x=new URL(u);return x.protocol==='https:'?x.href:'#';}catch{return '#';}};
 const link=(text,url,cls)=>{const a=el('a',text,cls);a.href=safeURL(url);a.target='_blank';a.rel='noopener';return a;};
 const button=(text,fn,cls='secondary')=>{const b=el('button',text,cls);b.type='button';b.addEventListener('click',fn);return b;};
 const date=v=>new Intl.DateTimeFormat('en-GB',{dateStyle:'long',timeZone:'Asia/Dubai'}).format(new Date(v));
 const duration=r=>r.duration_minutes_min===r.duration_minutes_max?r.duration_minutes_min+' min':r.duration_minutes_min+'–'+r.duration_minutes_max+' min';
 const journeyDate=date(D.routes.find(r=>!r.within).departure_setting), depart=journeyDate+' · 11:00 pm · Dubai (UTC+4)', researchDate=date(D.researched_at);
 const context='Approximate Google Maps driving estimate from the Kore mapped project approach. Departure: '+depart+'.';
 const fmt=n=>new Intl.NumberFormat('en-GB').format(n);
 const sourceLinks=(ids,classes='sources-inline')=>{const box=el('div',null,classes);[...new Set(ids)].forEach(id=>{const s=sources.get(id);if(s)box.append(link(s.short_title||s.title,s.url,'source-link'));});return box;};
 const factMap=f=>Object.fromEntries(f.properties.facts.map(x=>[x.key,x]));
 const proximity=r=>r.within?r.proximity:duration(r)+' · '+r.distance_km+' km';
 function routeBlock(r,compact=false){const box=el('div');if(r.within){append(box,el('strong',r.proximity,'within-label'),link('Google Maps directions ↗',r.google_directions_url,'source-link'));return box;}append(box,append(el('div',null,'journey-line'),el('strong',duration(r)),el('span',r.distance_km+' km by car')),el('p',context,compact?'popup-context':'context-note'),link('Google Maps directions ↗',r.google_directions_url,'source-link'));return box;}
 function addFactList(parent,f){const facts=factMap(f),dl=el('dl');for(const key of ['curriculum','grades_offered','tuition_fees','khda_rating']){const x=facts[key];if(!x)continue;append(dl,el('dt',x.label),el('dd',x.text.replace(/\.\.$/,'.')));}if(facts.tuition_fees){append(dl,el('dt','Additional charges'),el('dd',facts.tuition_fees.value.exclusions));}parent.append(dl);}
 function setCategory(cat){state.category=cat;$('category-select').value=cat;renderList();}
 function renderList(){
  const list=$('browse-list');list.replaceChildren();const ids=D.coverage[state.category];
  $('browse-note').textContent=state.visible.has(state.category)?'Select an entry to read its details.':'This layer is off. Select an entry to reveal it.';
  ids.forEach(id=>{const f=features.get(id),r=routes.get(id),b=button('',()=>selectFeature(id),'browse-item');b.dataset.feature=id;b.setAttribute('aria-pressed',String(state.selected===id));const symbol=el('span',CATS[state.category].symbol,'category-symbol');symbol.setAttribute('aria-hidden','true');const text=el('span');append(text,el('strong',f.properties.name),el('span',r?proximity(r):state.category==='roads'?(factMap(f).road_code?.value||'Road connection'):'Approximate area outline','item-meta'));if(state.selected===id)text.append(el('span','Selected','selection-label'));append(b,symbol,text);list.append(b);});
 }
 function renderControls(){document.querySelectorAll('.layer-toggle').forEach(b=>{const on=state.visible.has(b.dataset.layer);b.setAttribute('aria-pressed',String(on));b.querySelector('.layer-state').textContent=on?'On':'Off';});$('show-roads').setAttribute('aria-pressed',String(state.showAllRoads));syncRoadLabels();}
 function syncRoadLabels(){if(!map)return;const shown=[];for(const id of D.coverage.roads){const layer=layers.get(id);if(!layer)continue;const show=state.visible.has('roads')&&(state.showAllRoads||state.selected===id);if(show){const f=features.get(id);if(!layer.getTooltip())layer.bindTooltip(f.properties.name+' · '+(factMap(f).road_code?.value||''),{permanent:true,direction:'center',className:'road-label',interactive:false});shown.push(id);}else if(layer.getTooltip())layer.unbindTooltip();}$('map').dataset.roadLabels=shown.join(',');}
 function toggleAllRoads(){state.showAllRoads=!state.showAllRoads;if(state.showAllRoads){state.visible.add('roads');if(map)groups.roads.addTo(map);setCategory('roads');}renderControls();renderList();}

 function clearSelection(closePopup=true){state.selected=null;selecting=true;if(map&&closePopup)map.closePopup();selecting=false;updateStyles();$('detail').replaceChildren(el('p','Choose a place, road or neighbouring area to see details.','muted small'));renderList();}
 function toggleLayer(cat){const on=!state.visible.has(cat);if(on)state.visible.add(cat);else{state.visible.delete(cat);if(state.selected&&features.get(state.selected).properties.category===cat)clearSelection();}if(map){on?groups[cat].addTo(map):map.removeLayer(groups[cat]);}renderControls();renderList();}
 function detail(f){
  const p=f.properties,r=routes.get(f.id),box=$('detail');box.replaceChildren();const head=el('div',null,'close-row');const titles=el('div');append(titles,el('p',CATS[p.category]?.label||'Area reference','selected-kind'),el('h3',p.name));append(head,titles,button('×',()=>clearSelection(),'detail-close'));head.lastChild.setAttribute('aria-label','Close selected details');box.append(head);
  if(r)box.append(routeBlock(r));
  if(p.category!=='roads')box.append(el('p',p.popup_text));if(p.category!=='roads'&&p.approximation_label)box.append(el('p',p.approximation_label,'context-note'));
  if(p.category==='education')addFactList(box,f);else p.facts.forEach(x=>box.append(el('p',x.text.replace(/\.\.$/,'.'))));
  if(r&&!r.within)box.append(el('p','Vehicle arrival selected in Google Maps. Follow current gate and parking instructions.','context-note'));
  box.append(sourceLinks(p.source_ids.filter(x=>!x.startsWith('google-'))));
  if(map)box.append(button('View on map',()=>{fitFeature(f);$('map').scrollIntoView({behavior:scrollBehavior(),block:'center'});},'secondary'));
 }
 function scrollBehavior(){return window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth';}
 function fitFeature(f){if(!map)return;const l=layers.get(f.id);if(f.geometry.type==='Point')map.setView([f.geometry.coordinates[1],f.geometry.coordinates[0]],16,{animate:false});else map.fitBounds(l.getBounds(),{padding:[35,35],maxZoom:15,animate:false});}
 function positionPopup(layer){const p=layer?.getPopup();if(!p||!map.hasLayer(p)||!map.getBounds().contains(p.getLatLng()))return;const node=p.getElement();if(!node)return;const box=$('map').getBoundingClientRect(),r=node.getBoundingClientRect(),pad=8,leftPad=box.width<400?62:8;const dx=r.left<box.left+leftPad?box.left+leftPad-r.left:r.right>box.right-pad?box.right-pad-r.right:0,dy=r.top<box.top+pad?box.top+pad-r.top:r.bottom>box.bottom-pad?box.bottom-pad-r.bottom:0;if(dx||dy){const offset=L.point(p.options.offset||[0,7]);p.options.offset=L.point(offset.x+dx,offset.y+dy);p.update();node.classList.add('is-offset');}}
 function selectFeature(id,scroll=false){const f=features.get(id);if(!f)return;const cat=f.properties.category;if(CATS[cat]){if(!state.visible.has(cat)){state.visible.add(cat);if(map)groups[cat].addTo(map);}setCategory(cat);}state.selected=id;renderControls();renderList();detail(f);updateStyles();if(map){selecting=true;map.closePopup();const selectedLayer=layers.get(id);if(selectedLayer){selectedLayer.getPopup().options.offset=L.point(0,7);selectedLayer.openPopup();positionPopup(selectedLayer);}selecting=false;}$('selection-live').textContent=f.properties.name+' selected. Details are below the browse list.';if(scroll)$('explorer-title').scrollIntoView({behavior:scrollBehavior(),block:'start'});}
 function style(f){const cat=f.properties.category,s=state.selected===f.id;
  if(cat==='roads'){const i=D.coverage.roads.indexOf(f.id),palette=['#286c9d','#ad5e27','#6c558b'];return {color:palette[i%palette.length],weight:s?8:4.5,opacity:.98,dashArray:i===2?'10 4':''};}
  if(cat==='subject_area')return {color:'#2786c5',weight:2.5,dashArray:'7 5',fillColor:'#4baaf4',fillOpacity:.1};
  return {color:s?'#234d75':'#77728f',weight:s?4:1.5,dashArray:s?'':'4 4',fillColor:'#9b98b3',fillOpacity:s?.24:.1};
 }
 function markerIcon(f){const cat=f.properties.category;return L.divIcon({className:'map-marker '+cat+(state.selected===f.id?' is-selected':''),html:'<span aria-hidden="true">'+(CATS[cat]?.symbol||'O')+'</span>',iconSize:[34,34],iconAnchor:[17,17],popupAnchor:[0,-20]});}
 function updateStyles(){if(!map)return;for(const [id,l] of layers){const f=features.get(id);if(f.geometry.type==='Point')l.setIcon(markerIcon(f));else{l.setStyle(style(f));if(state.selected===id)l.bringToFront();}}syncRoadLabels();}
 function fitLocal(){if(!map)return;const l=layers.get(D.boundary_id);map.fitBounds(l.getBounds(),{padding:[26,26],maxZoom:13,animate:false});}
 function reset(){state.showAllRoads=false;state.visible=new Set(Object.keys(CATS));Object.keys(groups).forEach(c=>groups[c].addTo(map));state.category='landmarks';$('category-select').value='landmarks';clearSelection();renderControls();fitLocal();}
 function decoratePath(part,id){const path=part.getElement();if(!path||path.dataset.featureId)return;path.dataset.featureId=id;path.setAttribute('aria-label',features.get(id).properties.name);path.setAttribute('role','button');path.setAttribute('tabindex','0');path.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();selectFeature(id);}});}
 function initMap(){
  if(!window.L||!L.vectorGrid){$('map').replaceChildren(el('div','The interactive map could not load. All places, journeys and school details remain available below.','map-failed'));$('map-status').textContent='Map library unavailable. Use the browse list, school cards and Google Maps links.';$('map-status').hidden=false;$('reset-view').disabled=true;$('show-all').disabled=true;$('show-roads').disabled=true;return;}
  try{
   map=L.map('map',{scrollWheelZoom:true,wheelDebounceTime:0,zoomAnimation:false,keyboard:true,tap:true});L.control.scale({imperial:false}).addTo(map);
   map.attributionControl.addAttribution('Traces © <a href="https://2gis.ae" target="_blank" rel="noopener">2GIS. The City Expert</a>');
   const cfg=window.LOCATION_MAP_CONFIG;
   const hide=()=>[],styles=new Proxy({
    land:p=>({fill:true,fillColor:['wood','forest','grass','grassland','scrub','farmland'].includes(p.kind)?'#e5eddd':'#f2f1ec',fillOpacity:1,stroke:false}),
    ocean:{fill:true,fillColor:'#dcebf1',fillOpacity:1,stroke:false},
    water_polygons:{fill:true,fillColor:'#dcebf1',fillOpacity:1,stroke:false},
    water_lines:{color:'#d4e5ed',weight:1,opacity:1},
    sites:p=>['park','garden','golf_course','recreation_ground','nature_reserve','forest','wood'].includes(p.kind)?{fill:true,fillColor:'#e0ead6',fillOpacity:.8,stroke:false}:[],
    street_polygons:{fill:true,fillColor:'#fff',fillOpacity:1,stroke:false},
    streets:(p,z)=>({color:['motorway','trunk','primary'].includes(p.kind)?'#d9d6ce':'#fff',weight:['motorway','trunk','primary'].includes(p.kind)?Math.max(1.4,z-10):Math.max(.6,(z-11)*.5),opacity:1}),
    bridges:(p,z)=>({color:'#e5e1d9',weight:Math.max(1,z-11),opacity:1})
   },{get:(obj,key)=>obj[key]||hide});
   if(!L.vectorGrid)throw Error('Background renderer unavailable');
   tiles=L.vectorGrid.protobuf(cfg.tileUrl,{vectorTileLayerStyles:styles,rendererFactory:L.canvas.tile,interactive:false,maxNativeZoom:14,maxZoom:19,attribution:cfg.attribution,keepBuffer:1});
   tiles.on('tileerror',()=>{$('map').dataset.tiles='error';$('map-status').textContent='Background map tiles are unavailable. The supplied boundaries, roads and markers still work. All text and directions links remain available.';$('map-status').hidden=false;});
   tiles.on('load',()=>{$('map').dataset.tiles='loaded';});tiles.addTo(map);
   for(const cat of Object.keys(CATS))groups[cat]=L.layerGroup().addTo(map);
   for(const f of D.features){
    const p=f.properties,cat=p.category;let l;
    if(f.geometry.type==='Point')l=L.marker([f.geometry.coordinates[1],f.geometry.coordinates[0]],{icon:markerIcon(f),keyboard:true,autoPanOnFocus:false,title:p.name,alt:p.name});
    else l=L.geoJSON(f,{style:()=>style(f)});
    const pop=el('div');pop.append(el('strong',p.name));const r=routes.get(f.id);if(r)pop.append(routeBlock(r,true));else if(cat==='roads')pop.append(el('p',factMap(f).road_code?.value||'','popup-context'));else pop.append(el('p',p.approximation_label||p.popup_text,'popup-context'));pop.append(button('Read details',()=>{$('detail').scrollIntoView({behavior:scrollBehavior(),block:'center'});$('detail').setAttribute('tabindex','-1');$('detail').focus({preventScroll:true});},'text-link-button'));
    l.bindPopup(pop,{maxWidth:Math.min(260,Math.max(150,$('map').clientWidth-($('map').clientWidth<400?130:80))),minWidth:150,autoPan:false,keepInView:false,maxHeight:240});l.on('click',()=>selectFeature(f.id));l.on('keypress',e=>{if(e.originalEvent?.key==='Enter'||e.originalEvent?.keyCode===13)selectFeature(f.id);});
    if(l.eachLayer)l.eachLayer(part=>part.on('add',()=>decoratePath(part,f.id)));layers.set(f.id,l);if(groups[cat])groups[cat].addLayer(l);else l.addTo(map);

   }
   const camera=()=>{const c=map.getCenter();$('map').dataset.center=JSON.stringify([c.lat,c.lng]);$('map').dataset.zoom=map.getZoom();$('map').dataset.roads=state.visible.has('roads')?D.coverage.roads.filter(id=>map.hasLayer(layers.get(id))).join(','):'';};map.on('moveend zoomend layeradd layerremove',()=>{if(map._loaded)camera();});
   fitLocal();camera();syncRoadLabels();
   for(const [id,l] of layers)if(l.eachLayer)l.eachLayer(part=>decoratePath(part,id));

   $('show-roads').addEventListener('click',toggleAllRoads);
   $('reset-view').addEventListener('click',reset);
   $('show-all').addEventListener('click',()=>{state.visible=new Set(Object.keys(CATS));Object.values(groups).forEach(g=>g.addTo(map));renderControls();renderList();map.fitBounds(L.featureGroup([...layers.values()]).getBounds(),{padding:[25,25],maxZoom:14,animate:false});});
   let resizeTimer,lastSize=[$('map').clientWidth,$('map').clientHeight];new ResizeObserver(()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{const size=[$('map').clientWidth,$('map').clientHeight];if(size[0]===lastSize[0]&&size[1]===lastSize[1])return;lastSize=size;const retainedCenter=map.getCenter(),retainedZoom=map.getZoom();map.invalidateSize({pan:true,animate:false});map.setView(retainedCenter,retainedZoom,{animate:false,reset:true});for(const l of layers.values()){const p=l.getPopup();p.options.maxWidth=Math.min(260,Math.max(150,$('map').clientWidth-($('map').clientWidth<400?130:80)));if(map.hasLayer(p)){p.update();positionPopup(l);}}},120);}).observe($('map'));
  }catch(e){console.error('Map initialization failed',e);$('map-status').textContent='The map could not start. The complete text and Google Maps links remain available.';$('map-status').hidden=false;}
 }
 function schoolCard(f,i){const p=f.properties,ff=factMap(f),fee=ff.tuition_fees.value,r=routes.get(f.id),card=el('article',null,'school-card surface');card.dataset.school=f.id;append(card,el('div','School option '+(i+1),'school-number'),el('h3',p.name),el('p',ff.curriculum.text,'curriculum'));const dl=el('dl',null,'school-facts');const row=(label,text,cls)=>{const v=el('div');append(v,el('dt',label),el('dd',text,cls));dl.append(v);};
  row('Annual tuition · '+fee.academic_year,'AED '+fmt(fee.min_aed)+'–'+fmt(fee.max_aed),'tuition');row('Overall KHDA rating · '+ff.khda_rating.value.inspection_year,ff.khda_rating.value.rating);row('Grades / years',ff.grades_offered.value);if(r.within)row('Location',r.proximity);else row('Project-origin journey · '+journeyDate,proximity(r));
  append(card,dl,el('p',fee.basis+'. '+fee.exclusions,'fee-note'),r.within?null:el('p','11:00 pm, Dubai (UTC+4). Approximate Google driving estimate. School-run times have not been measured.','context-note'));
  if(ff.curriculum.value.length>1)card.append(el('p','UK curriculum from FS1. KHDA lists IB in Years 12–13. IB means International Baccalaureate.','school-grade-note'));
  const actions=el('div',null,'school-actions');append(actions,button('Explore on map',()=>selectFeature(f.id,true)),link('Google directions ↗',r.google_directions_url));card.append(actions);card.append(sourceLinks([...new Set(p.facts.flatMap(x=>x.source_ids))]));return card;
 }
 function render(){
 document.title=D.area+' | '+D.project;$('area-name').textContent=D.area;$('project-name').textContent=D.project;$('intro').textContent=D.narrative.intro.map(x=>x.text).join(' ');$('research-date').textContent='Research: '+researchDate;
 $('origin-copy').textContent=D.origin_description;$('journey-date').textContent=depart;$('journey-context').textContent='Approximate Google Maps driving estimates from Kore’s mapped project approach. Within labels use the plotted point and area outline. Scheduled estimates are not live traffic or school-run travel.';
 Object.entries(CATS).forEach(([cat,x])=>{const b=button('',()=>toggleLayer(cat),'layer-toggle');b.dataset.layer=cat;b.setAttribute('aria-pressed','true');append(b,el('span',x.symbol,'category-symbol'),el('span',x.label),el('span','On','layer-state'));$('layer-controls').append(b);const o=el('option',x.label);o.value=cat;$('category-select').append(o);});$('category-select').value=state.category;$('category-select').addEventListener('change',()=>setCategory($('category-select').value));renderList();clearSelection();
 D.coverage.neighboring_areas.forEach(id=>{const f=features.get(id),li=el('li');append(li,button(f.properties.name,()=>selectFeature(id,true),'text-link-button'),el('div',f.properties.relation_to_area||f.properties.popup_text));$('neighbors-copy').append(li);});
 [['landmarks','Landmarks'],['healthcare','Healthcare']].forEach(([cat,label])=>{const group=el('article',null,'surface journey-group');group.append(el('h3',label));D.coverage[cat].forEach(id=>{const f=features.get(id),r=routes.get(id),row=el('div',null,'journey-row');row.dataset.route=r.id;const text=el('div');append(text,el('h4',f.properties.name),el('div',proximity(r),'travel'));const actions=el('div',null,'journey-actions');append(actions,button('Explore on map',()=>selectFeature(id,true),'text-link-button'),link('Directions ↗',r.google_directions_url));append(row,text,actions,el('p',f.properties.popup_text,'row-note'));group.append(row);});$('journey-groups').append(group);});
 D.coverage.education.forEach((id,i)=>$('schools').append(schoolCard(features.get(id),i)));$('school-overview').textContent=D.narrative.education_summary.map(x=>x.text).join(' ');
 for(const [key,id] of [['positioning','positioning'],['rental_performance','rental'],['resale_performance','resale']]){const facts=D.narrative.how_to_sell[key];facts.forEach(f=>$ (id).append(el('li',f.text)));$(id+'-sources').append(sourceLinks(facts.flatMap(f=>f.source_ids)));}
 $('selling-title').textContent='How to sell '+D.area;$('pitch').textContent=D.narrative.how_to_sell.one_line_pitch.text;$('location-link').append(link('Open Kore in Google Maps ↗',D.location_url,'primary'));
 D.sources.filter(s=>!s.id.startsWith('google-')).forEach(s=>{const li=el('li');append(li,link(s.title,s.url),el('span','Checked '+date(s.checked_at)));$('source-list').append(li);});
 $('notes-research').textContent='Research checked '+researchDate+'. Journey readings use '+journeyDate+', 11:00 pm, Asia/Dubai (UTC+4). They have not been refreshed after that source check.';$('area-reference').textContent='Kore mapped project pin';$('map-note-area').textContent=D.area;
 }
 render();initMap();
})();
