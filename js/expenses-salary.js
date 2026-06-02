function renderSalary(){
  const b=biz();
  if(!b){ var sw=el('sallist'); if(sw) sw.innerHTML='<div style="padding:30px;text-align:center;color:var(--t3)"><div style="font-size:32px;margin-bottom:10px">⏳</div><div style="font-weight:700">Loading business data...</div><div style="font-size:12px;margin-top:6px">If this persists, check your connection or reload the app.</div></div>'; return; }
  const month=el('smonsel')?.value||thisMonth();const emps=b.employees||[];
  el('semp').textContent=emps.length;el('smon').textContent=month;
  if(!b.salaryRecords)b.salaryRecords=[];if(!b.nextSalId)b.nextSalId=1;
  emps.forEach(emp=>{if(!b.salaryRecords.find(r=>r.empId===emp.id&&r.month===month))b.salaryRecords.push({id:b.nextSalId++,empId:emp.id,month,baseSalary:emp.monthlySalary,deductions:[],paid:false,paidDate:null,createdAt:Date.now()});});
  const recs=(b.salaryRecords||[]).filter(r=>r.month===month);
  el('sal-pay').textContent=f$(recs.reduce((a,r)=>{const d=(r.deductions||[]).reduce((c,x)=>c+(x.amount||0),0);return a+Math.max(0,(r.baseSalary||0)-d);},0));
  const wrap=el('sallist');if(!wrap)return;
  if(!emps.length){wrap.innerHTML=em('No employees yet. Click + Employee to add.');return;}
  wrap.innerHTML=emps.map(emp=>{const rec=recs.find(r=>r.empId===emp.id)||{baseSalary:emp.monthlySalary,deductions:[],paid:false};const totalDed=(rec.deductions||[]).reduce((a,b)=>a+(b.amount||0),0);const net=Math.max(0,(rec.baseSalary||0)-totalDed);const over=totalDed>rec.baseSalary;
    return `<div class="ecard"><div style="display:flex;align-items:center;gap:11px;margin-bottom:11px"><div class="eavatar">${mkInit(emp.name)}</div><div style="flex:1"><div style="font-size:14px;font-weight:700;color:var(--t1)">${esc(emp.name)}</div><div style="font-size:11px;color:var(--t3);margin-top:2px">${esc(emp.role)} · ${esc(emp.type||'Employee')}</div></div>${rec.paid?'<span class="bdg bok0">PAID</span>':'<span class="bdg bwa0">PENDING</span>'}</div><div class="salg"><div class="sali"><div class="sall">Base Salary</div><div class="salv c-g">${f$(rec.baseSalary||0)}</div></div><div class="sali"><div class="sall">Deductions</div><div class="salv c-er">−${f$(totalDed)}</div></div><div class="sali"><div class="sall">Net Pay</div><div class="salv" style="color:${over?'var(--er)':net<(rec.baseSalary||0)*0.7?'var(--wa)':'var(--ok)'}">${f$(net)}</div></div></div>${over?'<div style="margin-top:9px;padding:7px 11px;background:var(--erb);border-radius:var(--r10);font-size:11px;font-weight:600;color:var(--er)">⚠ Deductions exceed base salary!</div>':''}<div style="display:flex;gap:8px;margin-top:11px"><button type="button" class="btn bte bsm" onclick="openSalDetail(${emp.id},'${month}')">View Details</button>${canDel()?`<button type="button" class="btn bgh bsm" onclick="openEditEmp(${emp.id})">Edit</button>`:''}</div></div>`;
  }).join('');dbSave();
}
function openAddEmp(){if(!canDel()){toast('Admin required','er');return;}editEmpId=null;el('empttl').textContent='Add Employee';el('esavebtn').textContent='Save Employee';['ename','erole','ephone','esal'].forEach(id=>sv(id,''));sv('estart',today());sv('etype','Employee');openD('d-emp');setTimeout(()=>el('ename')?.focus(),300);}
function openEditEmp(id){if(!canDel()){toast('Admin required','er');return;}const b=biz();const emp=(b.employees||[]).find(x=>x.id===id);if(!emp)return;editEmpId=id;el('empttl').textContent='Edit Employee';el('esavebtn').textContent='Update';sv('ename',emp.name);sv('erole',emp.role);sv('ephone',emp.phone||'');sv('esal',emp.monthlySalary);sv('estart',emp.startDate||today());sv('etype',emp.type||'Employee');openD('d-emp');}
function saveEmployee(){if(!canDel()){toast('Admin required','er');return;}const b=biz();if(!b)return;const name=gv('ename'),role=gv('erole'),salary=parseFloat(el('esal')?.value)||0;if(!name||!role){toast('Name and role required','er');return;}if(salary<=0){toast('Salary required','er');return;}const emp={name,role,phone:gv('ephone'),monthlySalary:salary,type:el('etype')?.value||'Employee',startDate:el('estart')?.value||today()};if(!b.employees)b.employees=[];if(!b.nextEmpId)b.nextEmpId=1;if(editEmpId!==null){const i=b.employees.findIndex(x=>x.id===editEmpId);if(i>-1)b.employees[i]={...b.employees[i],...emp};toast('Employee updated!');}else{emp.id=b.nextEmpId++;emp.createdAt=Date.now();b.employees.push(emp);toast('Employee added!');}dbSave();closeD('d-emp');renderSalary();}
function openSalDetail(empId,month){const b=biz();if(!b)return;const emp=(b.employees||[]).find(x=>x.id===empId);if(!emp)return;const rec=(b.salaryRecords||[]).find(r=>r.empId===empId&&r.month===month);if(!rec)return;curSalRecId=rec.id;el('sdttl').textContent=emp.name;el('sdsub').textContent=`${month} · ${esc(emp.role)}`;const totalDed=(rec.deductions||[]).reduce((a,b)=>a+(b.amount||0),0);const net=Math.max(0,(rec.baseSalary||0)-totalDed);el('sdsum').innerHTML=`<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px"><div style="text-align:center"><div style="font-size:9px;font-weight:700;color:var(--t3);text-transform:uppercase;margin-bottom:4px">Base</div><div class="fw9 disp c-g" style="font-size:19px">${f$(rec.baseSalary||0)}</div></div><div style="text-align:center"><div style="font-size:9px;font-weight:700;color:var(--t3);text-transform:uppercase;margin-bottom:4px">Deductions</div><div class="fw9 disp c-er" style="font-size:19px">−${f$(totalDed)}</div></div><div style="text-align:center"><div style="font-size:9px;font-weight:700;color:var(--t3);text-transform:uppercase;margin-bottom:4px">Net Pay</div><div class="fw9 disp" style="font-size:19px;color:${net<(rec.baseSalary||0)?'var(--wa)':'var(--ok)'}">${f$(net)}</div></div></div>`;el('sddeds').innerHTML=(rec.deductions||[]).length?`<div class="card" style="border-radius:0;border:none">${(rec.deductions||[]).map((d,i)=>`<div class="cr"><div class="ci" style="background:var(--erb);font-size:13px">−</div><div class="cb"><div class="ct">${esc(d.reason)}</div><div class="cs">${d.date} · ${esc(d.type||'')} · by ${esc(d.addedBy||'')}</div></div><div style="text-align:right"><div class="cv c-er">−${f$(d.amount)}</div>${canDel()?`<button type="button" class="btn ber bxs" style="margin-top:3px" onclick="removeDed(${curSalRecId},${i})">Del</button>`:''}</div></div>`).join('')}</div>`:em('No deductions');el('sdnet').innerHTML=`<div style="display:flex;justify-content:space-between;align-items:center"><div><div style="font-size:10px;font-weight:700;color:var(--t3);text-transform:uppercase;margin-bottom:3px">Net Payable</div><div class="fw9 disp c-g" style="font-size:21px">${f$(net)}</div></div>${rec.paid?`<span class="bdg bok0" style="font-size:12px">✓ Paid ${rec.paidDate||''}</span>`:''}</div>`;if(el('addbtn'))el('addbtn').style.display=canDel()?'':'none';if(el('mpaybtn')){el('mpaybtn').textContent=rec.paid?'Mark as Unpaid':'Mark as Paid';el('mpaybtn').className=rec.paid?'btn bwa bbl':'btn bok bbl';el('mpaybtn').style.display=canDel()?'':'none';}openD('d-saldet');}
function openAddDed(){if(!canDel()){toast('Admin required','er');return;}const b=biz();const rec=(b.salaryRecords||[]).find(r=>r.id===curSalRecId);if(!rec)return;const totalDed=(rec.deductions||[]).reduce((a,b)=>a+(b.amount||0),0);const rem=Math.max(0,(rec.baseSalary||0)-totalDed);el('dedinfo').textContent=`Max allowed: ${f$(rem)}`;sv('dedd',today());sv('deda','');sv('dedr','');sv('dedt','Absence');openD('d-ded');setTimeout(()=>el('deda')?.focus(),300);}
function saveDeduction(){if(!canDel()){toast('Admin required','er');return;}const b=biz();const rec=(b.salaryRecords||[]).find(r=>r.id===curSalRecId);if(!rec)return;const amount=parseFloat(el('deda')?.value)||0,reason=gv('dedr');if(amount<=0){toast('Enter valid amount','er');return;}if(!reason){toast('Reason required','er');return;}const totalDed=(rec.deductions||[]).reduce((a,b)=>a+(b.amount||0),0);if(totalDed+amount>(rec.baseSalary||0)){toast(`Cannot exceed ${f$(rec.baseSalary)}. Remaining: ${f$(Math.max(0,rec.baseSalary-totalDed))}`,'er');return;}if(!rec.deductions)rec.deductions=[];rec.deductions.push({date:el('dedd')?.value||today(),amount,reason,type:el('dedt')?.value||'Other',addedBy:CU?.name||'admin'});addAdminLog('add_ded',`Deduction ${f$(amount)} — ${reason}`,CU.name);dbSave();closeD('d-ded');const emp=(b.employees||[]).find(x=>x.id===rec.empId);if(emp)openSalDetail(emp.id,rec.month);renderSalary();toast(`Deduction ${f$(amount)} added`);}
function removeDed(recId,idx){if(!canDel()){toast('Admin required','er');return;}const b=biz();const rec=(b.salaryRecords||[]).find(r=>r.id===recId);if(!rec)return;rec.deductions.splice(idx,1);dbSave();const emp=(b.employees||[]).find(x=>x.id===rec.empId);if(emp)openSalDetail(emp.id,rec.month);renderSalary();toast('Deduction removed');}
function markPaid(){if(!canDel()){toast('Admin required','er');return;}const b=biz();const rec=(b.salaryRecords||[]).find(r=>r.id===curSalRecId);if(!rec)return;rec.paid=!rec.paid;rec.paidDate=rec.paid?today():null;addAdminLog('salary_paid',`Salary ${rec.paid?'PAID':'UNPAID'} empId ${rec.empId}`,CU.name);dbSave();const emp=(b.employees||[]).find(x=>x.id===rec.empId);if(emp)openSalDetail(emp.id,rec.month);renderSalary();toast(rec.paid?'Marked Paid':'Marked Unpaid');}

// ── STOCK OPERATIONS ──
let _si=0,_so=0,_pu=0;
function prodOpts(onlyStock){const b=biz();return`<option value="">Select product...</option>`+((b.products||[]).filter(p=>!onlyStock||p.qty>0)).map(p=>`<option value="${p.id}">${esc(p.name)} (${p.qty} ${p.unit})</option>`).join('');}
function openStockIn(){
  if(!canAccess('stock')){toast('No access','er');return;}
  siItems=[];_si=0;
  ['sisupp','siref','sinotes'].forEach(id=>sv(id,''));
  sv('sidate',today());
  renderSiItems();
  // Reset shortage banner
  var banner = el('si-shortage-banner');
  if(banner) banner.style.display = 'none';
  openD('d-si');
}
function addSiItem(){siItems.push({idx:_si++,prodId:'',qty:1,cost:0});renderSiItems();}
function removeSiItem(idx){siItems=siItems.filter(i=>i.idx!==idx);renderSiItems();}
function renderSiItems(){const w=el('siitems');if(!w)return;if(!siItems.length){w.innerHTML='<div style="padding:11px;text-align:center;font-size:12px;color:var(--t3)">Tap "+ Add Product Row"</div>';el('sicnt').textContent='0';el('sitotal').textContent=f$(0);return;}w.innerHTML=siItems.map(i=>`<div class="mir"><div class="mip"><div class="mil">Product</div><select class="mii" id="sip${i.idx}" onchange="onSiProd(${i.idx})">${prodOpts(false)}</select></div><div class="miq"><div class="mil">Qty</div><input class="mii" type="number" id="siq${i.idx}" value="${i.qty||''}" min="1" oninput="updateSiItem(${i.idx})"></div><div class="miv"><div class="mil">Cost</div><input class="mii" type="number" id="sic${i.idx}" value="${i.cost||''}" step="0.01" oninput="updateSiItem(${i.idx})"></div><div class="mid" onclick="removeSiItem(${i.idx})">✕</div></div>`).join('');siItems.forEach(i=>{const s=el(`sip${i.idx}`);if(s&&i.prodId)s.value=i.prodId;});updateSiTotals();el('sicnt').textContent=siItems.length;}
function onSiProd(idx){
  const s=el('sip'+idx);
  const i=siItems.find(x=>x.idx===idx);if(!i)return;
  i.prodId=parseInt(s.value)||'';
  const b=biz();
  const p=(b&&b.products||[]).find(x=>x.id===i.prodId);
  if(p){
    i.cost=p.cost;
    const c=el('sic'+idx);if(c)c.value=p.cost.toFixed(2);
  }
  updateSiTotals();
  updateSiShortageBanner(idx);
}

function updateSiShortageBanner(idx){
  const banner = el('si-shortage-banner');
  const title  = el('si-shortage-title');
  const detail = el('si-shortage-detail');
  if(!banner||!title||!detail) return;

  // Find ALL short products across all rows
  var shortItems = [];
  siItems.forEach(function(row){
    if(!row.prodId) return;
    var b = biz();
    var p = (b&&b.products||[]).find(function(x){return x.id===row.prodId;});
    if(p && p.qty < 0){
      shortItems.push({prod:p, row:row});
    }
  });

  if(!shortItems.length){
    banner.style.display = 'none';
    return;
  }

  banner.style.display = '';

  if(shortItems.length === 1){
    var s = shortItems[0];
    var shortage = Math.abs(s.prod.qty);
    var restockCost = s.prod.cost > 0 ? shortage * s.prod.cost : 0;
    var daysAgo = '';
    if(s.prod.wentNegativeAt){
      var d = Math.floor((Date.now()-s.prod.wentNegativeAt)/(1000*60*60*24));
      daysAgo = d <= 0 ? ' (today)' : ' ('+d+' day'+(d!==1?'s':'')+' ago)';
    }
    title.textContent = '⚠ Shortage: ' + s.prod.name;
    detail.innerHTML =
      'You are short <strong style="color:var(--er)">' + shortage + ' ' + s.prod.unit + '</strong>' + daysAgo + '.<br>' +
      (restockCost > 0 ? 'Est. cost to recover: <strong style="color:var(--wa)">' + f$(restockCost) + '</strong><br>' : '') +
      '<span style="color:var(--t3)">Enter quantity below to see recovery math →</span>';
  } else {
    title.textContent = '⚠ ' + shortItems.length + ' products have shortages';
    detail.innerHTML = shortItems.map(function(s){
      return '• ' + esc(s.prod.name) + ': short <strong style="color:var(--er)">' + Math.abs(s.prod.qty) + ' ' + s.prod.unit + '</strong>';
    }).join('<br>');
  }

  // Show recovery math if qty already entered
  updateSiRecoveryMath();
}

function updateSiRecoveryMath(){
  var mathEl = el('si-recovery-math');
  if(!mathEl) return;

  var lines = [];
  siItems.forEach(function(row){
    if(!row.prodId || !row.qty) return;
    var b = biz();
    var p = (b&&b.products||[]).find(function(x){return x.id===row.prodId;});
    if(!p || p.qty >= 0) return;  // only show for short products

    var shortage = Math.abs(p.qty);
    var incoming = row.qty || 0;
    var netAfter = p.qty + incoming;  // p.qty is negative

    if(netAfter >= 0){
      lines.push(
        '<span style="color:var(--ok)">✓ '+esc(p.name)+':</span> ' +
        'Shortage of '+shortage+' covered' +
        (netAfter > 0 ? ' · <span style="color:var(--ok)">Surplus: +'+netAfter+' '+p.unit+'</span>' : ' · <span style="color:var(--t2)">Exactly zero</span>')
      );
    } else {
      lines.push(
        '<span style="color:var(--er)">✗ '+esc(p.name)+':</span> ' +
        'Receiving '+incoming+' · Still short: <strong style="color:var(--er)">'+Math.abs(netAfter)+' '+p.unit+'</strong>'
      );
    }
  });

  if(!lines.length){
    mathEl.style.display = 'none';
    return;
  }

  mathEl.style.display = '';
  mathEl.innerHTML = lines.join('<br>');
}
function updateSiItem(idx){
  const i=siItems.find(x=>x.idx===idx);if(!i)return;
  i.qty=parseFloat(el('siq'+idx)?.value)||0;
  i.cost=parseFloat(el('sic'+idx)?.value)||0;
  updateSiTotals();
  // Update recovery math live as qty is typed
  updateSiRecoveryMath();
}
function updateSiTotals(){el('sitotal').textContent=f$(siItems.reduce((a,b)=>a+(b.qty||0)*(b.cost||0),0));}
function saveStockIn(){const b=biz();if(!b)return;const supp=gv('sisupp');if(!supp){toast('Supplier required','er');return;}const ref=gv('siref'),date=el('sidate')?.value||today();siItems.forEach(i=>{const s=el(`sip${i.idx}`);if(s)i.prodId=parseInt(s.value)||'';const q=el(`siq${i.idx}`);if(q)i.qty=parseFloat(q.value)||0;const c=el(`sic${i.idx}`);if(c)i.cost=parseFloat(c.value)||0;});const valid=siItems.filter(i=>i.prodId&&i.qty>0);if(!valid.length){toast('Add at least one product','er');return;}valid.forEach(item=>{const p=(b.products||[]).find(x=>x.id===item.prodId);if(!p)return;
      var wasNeg = p.qty < 0;
      p.qty += item.qty;
      if(item.cost>0) p.cost = item.cost;
      // Clear shortage tracking if stock is now positive
      if(wasNeg && p.qty >= 0) {
        p.wentNegativeAt = null;
      }if(!b.stockHistory)b.stockHistory=[];b.stockHistory.unshift({id:b.nextHistId++,date,type:'IN',prodName:p.name,qty:item.qty,by:CU.name,ref,notes:'Supplier: '+supp,ts:Date.now()});});addAdminLog('stock_in',`Stock In · ${supp} · ${valid.length} products`,CU.name);dbSave();closeD('d-si');renderProducts();renderGallery();renderDash();toast(valid.length+' product(s) added to stock');}
function openStockOut(){if(!canAccess('stock')){toast('No access','er');return;}soItems=[];_so=0;['socust','sodisc','sopaid'].forEach(id=>sv(id,''));sv('sodate',today());sv('soreason','Sale');sv('sopaym','Cash');toggleSoPay();renderSoItems();openD('d-so');}
function toggleSoPay(){if(el('sopaysec'))el('sopaysec').style.display=el('soreason')?.value==='Sale'?'':'none';}
function addSoItem(){soItems.push({idx:_so++,prodId:'',qty:1,price:0});renderSoItems();}
function removeSoItem(idx){soItems=soItems.filter(i=>i.idx!==idx);renderSoItems();updateSoTotals();}
function renderSoItems(){const w=el('soitems');if(!w)return;if(!soItems.length){w.innerHTML='<div style="padding:11px;text-align:center;font-size:12px;color:var(--t3)">Tap "+ Add Product Row"</div>';el('socnt').textContent='0';updateSoTotals();return;}w.innerHTML=soItems.map(i=>`<div class="mir"><div class="mip"><div class="mil">Product</div><select class="mii" id="sop${i.idx}" onchange="onSoProd(${i.idx})">${prodOpts(true)}</select></div><div class="miq"><div class="mil">Qty</div><input class="mii" type="number" id="soq${i.idx}" value="${i.qty||''}" min="1" oninput="updateSoItem(${i.idx})"></div><div class="miv"><div class="mil">Price</div><input class="mii" type="number" id="sor${i.idx}" value="${i.price||''}" step="0.01" oninput="updateSoItem(${i.idx})"></div><div class="mid" onclick="removeSoItem(${i.idx})">✕</div></div>`).join('');soItems.forEach(i=>{const s=el(`sop${i.idx}`);if(s&&i.prodId)s.value=i.prodId;});updateSoTotals();el('socnt').textContent=soItems.length;}
function onSoProd(idx){const s=el(`sop${idx}`);const i=soItems.find(x=>x.idx===idx);if(!i)return;i.prodId=parseInt(s.value)||'';const p=(biz().products||[]).find(x=>x.id===i.prodId);if(p){i.price=p.price;const r=el(`sor${idx}`);if(r)r.value=p.price.toFixed(2);}updateSoTotals();}
function updateSoItem(idx){const i=soItems.find(x=>x.idx===idx);if(!i)return;i.qty=parseFloat(el(`soq${idx}`)?.value)||0;i.price=parseFloat(el(`sor${idx}`)?.value)||0;updateSoTotals();}
function updateSoTotals(){const sub=soItems.reduce((a,b)=>a+(b.qty||0)*(b.price||0),0),disc=parseFloat(el('sodisc')?.value)||0,total=Math.max(0,sub-disc),paid=parseFloat(el('sopaid')?.value)||0,due=Math.max(0,total-paid);if(el('sosub'))el('sosub').textContent=f$(sub);if(el('sototal'))el('sototal').textContent=f$(total);const dueEl=el('sodue');if(dueEl){dueEl.textContent=f$(due);dueEl.style.color=due<=0?'var(--ok)':paid>0?'var(--wa)':'var(--er)';}if(el('sobdg'))el('sobdg').innerHTML=payBadge(due<=0?'PAID':paid>0?'PARTIAL':'CREDIT');}
function saveStockOut(){
  const b=biz();if(!b)return;
  const date=el('sodate')?.value||today();
  const reason=el('soreason')?.value||'Adjustment';
  const notes=gv('sonotes');
  const ref='OUT-'+String(b.nextSoId||1).padStart(4,'0');
  // Collect items
  soItems.forEach(i=>{
    const s=el('sop'+i.idx);if(s)i.prodId=parseInt(s.value)||'';
    const q=el('soq'+i.idx);if(q)i.qty=parseFloat(q.value)||0;
  });
  const valid=soItems.filter(i=>i.prodId&&i.qty>0);
  if(!valid.length){toast('Add at least one product','er');return;}
  // Process each item
  valid.forEach(item=>{
    const p=(b.products||[]).find(x=>x.id===item.prodId);
    if(!p){toast('Product not found: '+item.prodId,'er');return;}
    var prevQty=p.qty;
    p.qty=p.qty-item.qty;
    if(p.qty<0&&prevQty>=0)p.wentNegativeAt=Date.now();
    if(p.qty>=0)p.wentNegativeAt=null;
    if(!b.stockHistory)b.stockHistory=[];
    b.stockHistory.unshift({
      id:b.nextHistId++,date,type:'OUT',
      prodName:p.name,qty:-item.qty,
      by:CU.name,ref,
      notes:reason+(notes?' · '+notes:''),
      ts:Date.now()
    });
  });
  // Log movement
  if(!b.stockOuts)b.stockOuts=[];
  b.stockOuts.unshift({
    id:b.nextSoId||1,ref,date,reason,notes,
    items:valid.map(i=>{const p=(b.products||[]).find(x=>x.id===i.prodId);return{name:p?p.name:'',qty:i.qty};}),
    by:CU.name,createdAt:Date.now()
  });
  b.nextSoId=(b.nextSoId||1)+1;
  addAdminLog('stock_out','Stock Out · '+reason+' · '+valid.length+' products',CU.name);
  dbSave();closeD('d-so');
  renderProducts();renderGallery();renderDash();
  toast(valid.length+' product(s) removed — '+reason,'gd');
}
function openPurchase(){if(!canAccess('stock')){toast('No access','er');return;}puItems=[];_pu=0;['pusupp','puinv'].forEach(id=>sv(id,''));sv('pudate',today());renderPuItems();openD('d-pu');}
function addPuItem(){puItems.push({idx:_pu++,prodId:'',qty:1,cost:0});renderPuItems();}
function removePuItem(idx){puItems=puItems.filter(i=>i.idx!==idx);renderPuItems();}
function renderPuItems(){const w=el('puitems');if(!w)return;if(!puItems.length){w.innerHTML='<div style="padding:11px;text-align:center;font-size:12px;color:var(--t3)">Tap "+ Add Product Row"</div>';el('putotal').textContent=f$(0);return;}w.innerHTML=puItems.map(i=>`<div class="mir"><div class="mip"><div class="mil">Product</div><select class="mii" id="pup${i.idx}" onchange="onPuProd(${i.idx})">${prodOpts(false)}</select></div><div class="miq"><div class="mil">Qty</div><input class="mii" type="number" id="puq${i.idx}" value="${i.qty||''}" min="1" oninput="updatePuItem(${i.idx})"></div><div class="miv"><div class="mil">Cost</div><input class="mii" type="number" id="puc${i.idx}" value="${i.cost||''}" step="0.01" oninput="updatePuItem(${i.idx})"></div><div class="mid" onclick="removePuItem(${i.idx})">✕</div></div>`).join('');puItems.forEach(i=>{const s=el(`pup${i.idx}`);if(s&&i.prodId)s.value=i.prodId;});updatePuTotals();}
function onPuProd(idx){const s=el(`pup${idx}`);const i=puItems.find(x=>x.idx===idx);if(!i)return;i.prodId=parseInt(s.value)||'';const p=(biz().products||[]).find(x=>x.id===i.prodId);if(p){i.cost=p.cost;const c=el(`puc${idx}`);if(c)c.value=p.cost.toFixed(2);}updatePuTotals();}
function updatePuItem(idx){const i=puItems.find(x=>x.idx===idx);if(!i)return;i.qty=parseFloat(el(`puq${idx}`)?.value)||0;i.cost=parseFloat(el(`puc${idx}`)?.value)||0;updatePuTotals();}
function updatePuTotals(){el('putotal').textContent=f$(puItems.reduce((a,b)=>a+(b.qty||0)*(b.cost||0),0));}
function savePurchase(){const b=biz();if(!b)return;const supp=gv('pusupp');if(!supp){toast('Supplier required','er');return;}const inv=gv('puinv'),date=el('pudate')?.value||today();puItems.forEach(i=>{const s=el(`pup${i.idx}`);if(s)i.prodId=parseInt(s.value)||'';const q=el(`puq${i.idx}`);if(q)i.qty=parseFloat(q.value)||0;const c=el(`puc${i.idx}`);if(c)i.cost=parseFloat(c.value)||0;});const valid=puItems.filter(i=>i.prodId&&i.qty>0);if(!valid.length){toast('Add at least one product','er');return;}if(!b.purchases)b.purchases=[];valid.forEach(item=>{const p=(b.products||[]).find(x=>x.id===item.prodId);if(!p)return;p.qty+=item.qty;if(item.cost>0)p.cost=item.cost;b.purchases.unshift({date,supplier:supp,prodName:p.name,qty:item.qty,cost:item.cost,inv});if(!b.stockHistory)b.stockHistory=[];b.stockHistory.unshift({id:b.nextHistId++,date,type:'PURCHASE',prodName:p.name,qty:item.qty,by:CU.name,ref:inv,notes:'Supplier: '+supp,ts:Date.now()});});addAdminLog('purchase',`Purchase · ${supp} · ${valid.length} products`,CU.name);dbSave();closeD('d-pu');renderProducts();renderGallery();renderDash();toast(valid.length+' product(s) received');}

// ── CREDITS ──
function showCredits(){const b=biz();
  if(!b){var _c=el('credbody');if(_c)_c.innerHTML='<div style="padding:30px;text-align:center"><div style="font-size:28px;margin-bottom:8px">⏳</div><div style="font-weight:700;color:var(--t1)">Loading...</div><div style="font-size:12px;color:var(--t3);margin-top:6px">Tap More → Sync → Reconnect</div></div>';openD('d-cred');return;}const credits=b.credits||[];const active=credits.filter(c=>crBal(c)>0);el('credsub').textContent=active.length+' outstanding · '+credits.length+' total';const tOwed=credits.reduce((a,b)=>a+(b.totalOwed||0),0),tPaid=credits.reduce((a,b)=>a+(b.totalPaid||0),0);let h=`<div style="display:flex;gap:10px;padding:11px 13px;border-bottom:1px solid var(--bd);background:var(--s2)"><div style="flex:1;text-align:center"><div style="font-size:9px;font-weight:700;color:var(--t3);text-transform:uppercase;margin-bottom:4px">Total Owed</div><div class="fw9 disp c-er" style="font-size:17px">${f$(tOwed-tPaid)}</div></div><div style="flex:1;text-align:center"><div style="font-size:9px;font-weight:700;color:var(--t3);text-transform:uppercase;margin-bottom:4px">Collected</div><div class="fw9 disp c-ok" style="font-size:17px">${f$(tPaid)}</div></div></div>`;h+=credits.length?`<div class="card" style="border-radius:0;border:none">${credits.map(c=>{const bal=crBal(c),settled=bal<=0;return`<div class="cr"><div class="ci" style="background:${settled?'var(--okb)':'var(--erb)'}">${settled?'✓':'💳'}</div><div class="cb"><div class="ct">${esc(c.name)}</div><div class="cs">${esc(c.ref||'—')} · ${c.date}${c.contact?' · 📞 '+esc(c.contact):''}</div><div style="margin-top:3px"><span class="bdg ${settled?'bok0':c.totalPaid>0?'bwa0':'ber0'}">${settled?'SETTLED':c.totalPaid>0?'PARTIAL':'UNPAID'}</span></div></div><div style="text-align:right"><div class="cv" style="color:${settled?'var(--ok)':'var(--er)'}">${f$(bal)}</div>${settled?'':`<button type="button" class="btn bok bxs" style="margin-top:3px" onclick="openPayCred(${c.id})">Pay</button>`}</div></div>`;}).join('')}</div>`:em('No credit records');el('credbody').innerHTML=h;openD('d-cred');}
function openPayCred(id){payingCrId=id;const b=biz();const c=(b.credits||[]).find(x=>x.id===id);if(!c)return;const bal=crBal(c);el('pcsub').textContent=`${c.name} · Balance: ${f$(bal)}`;el('pcinfo').innerHTML=`<div class="fw7">${esc(c.name)}</div><div style="font-size:12px;color:var(--t2);margin-top:4px;display:flex;gap:12px;flex-wrap:wrap"><span>Total: ${f$(c.totalOwed)}</span><span>Paid: ${f$(c.totalPaid||0)}</span><span style="color:var(--er)">Balance: ${f$(bal)}</span></div>`;sv('pcd',today());sv('pca','');sv('pcr','');openD('d-paycred');}
function saveCreditPay(){const b=biz();const c=(b.credits||[]).find(x=>x.id===payingCrId);if(!c)return;const amt=parseFloat(el('pca')?.value)||0;if(amt<=0){toast('Enter valid amount','er');return;}const bal=crBal(c);if(amt>bal+0.01){toast('Amount exceeds balance of '+f$(bal),'er');return;}c.totalPaid=(c.totalPaid||0)+amt;if(!c.payments)c.payments=[];c.payments.push({date:el('pcd')?.value||today(),amount:amt,mode:el('pcm')?.value||'Cash',ref:gv('pcr')});if(c.totalPaid>=c.totalOwed)c.status='SETTLED';addAdminLog('credit_pay',`Payment ${f$(amt)} from ${c.name}`,CU.name);dbSave();closeD('d-paycred');showCredits();renderDash();toast(`Payment ${f$(amt)} recorded`);}

// ── STOCK HISTORY ──
function showStockHist(){const b=biz();if(!b)return;const hist=[...(b.stockHistory||[])].sort((a,b)=>(b.ts||0)-(a.ts||0)).slice(0,100);const tIco={IN:'📥',OUT:'📤',SALE:'💸',PURCHASE:'🛒'};const tCl={IN:'c-ok',OUT:'c-er',SALE:'c-g',PURCHASE:'c-in'};el('histbody').innerHTML=hist.length?`<div class="card" style="border-radius:0;border:none">${hist.map(h=>`<div class="cr"><div class="ci" style="background:var(--s2)">${tIco[h.type]||'📋'}</div><div class="cb"><div class="ct">${esc(h.prodName)}</div><div class="cs">${h.date} · ${esc(h.ref||h.type)} · ${esc(h.by||'')}</div></div><div style="text-align:right"><div class="cv ${tCl[h.type]||''}">${h.qty>0?'+':''}${h.qty}</div><div class="cm">${h.type}</div></div></div>`).join('')}</div>`:em('No stock history yet');openD('d-hist');}

// ── BIZ SETTINGS ──
function openBizSettings(){if(!isAdmin()){toast('Admin required','er');return;}const b=biz();if(!b)return;sv('bizname',b.name);sv('bizaddr',b.address||'');sv('bizphone',b.phone||'');sv('bizcurr',b.currency||'USD');sv('bizlow',b.lowStock||5);if(el('bizcountry'))el('bizcountry').value=b.country||'Liberia';if(el('biz-alloc-toggle'))el('biz-alloc-toggle').checked=(b.allocationsEnabled!==false);

  el('bizsetsub').textContent='Editing: '+b.name;const prev=el('bizlogoprev');if(b.logoType==='image'&&b.logoData)prev.innerHTML=`<img src="${b.logoData}" style="width:100%;height:100%;object-fit:cover;border-radius:12px">`;else prev.textContent=mkInit(b.name);['bizlogofile','bizlogofile2'].forEach(id=>{const e=el(id);if(e){e.value='';e.dataset.ld=b.logoData||'';e.dataset.lt=b.logoType||'initials';}});openD('d-bizset');}
function handleBizLogo(inp){const f=inp.files[0];if(!f)return;const r=new FileReader();r.onload=e=>{inp.dataset.ld=e.target.result;inp.dataset.lt='image';el('bizlogoprev').innerHTML=`<img src="${e.target.result}" style="width:100%;height:100%;object-fit:cover;border-radius:12px">`;};r.readAsDataURL(f);}
function clearBizLogo(){['bizlogofile','bizlogofile2'].forEach(id=>{const e=el(id);if(e){e.dataset.ld='';e.dataset.lt='initials';e.value='';}});const b=biz();el('bizlogoprev').textContent=mkInit(b?b.name:'S');}
function saveBizSettings(){const b=biz();if(!b)return;const name=gv('bizname');if(!name){toast('Business name required','er');return;}b.name=name;b.address=gv('bizaddr');b.phone=gv('bizphone');b.currency=el('bizcurr')?.value||'USD';b.lowStock=parseInt(el('bizlow')?.value)||5;b.country=el('bizcountry')?.value||'Liberia';b.allocationsEnabled=el('biz-alloc-toggle')?.checked!==false;
const lf=el('bizlogofile'),lf2=el('bizlogofile2');const src=lf2&&lf2.dataset.ld?lf2:lf;b.logoData=src.dataset.ld||'';b.logoType=src.dataset.lt||'initials';addAdminLog('settings','Settings updated: '+name,CU.name);
  dbSave();
  try { if(typeof fbPush==='function') fbPush(); } catch(e){}
  closeD('d-bizset');
  // Reflect settings changes across the entire app
  try { updateTopbar(); } catch(e){}
  try { if(typeof refreshSidebar==='function') refreshSidebar(); } catch(e){}
  try { if(typeof renderDash==='function') renderDash(); } catch(e){}
  try { if(typeof updateAllocToggleUI==='function') updateAllocToggleUI(); } catch(e){}
  // Update currency symbol everywhere
  try { if(typeof renderSales==='function' && typeof page!=='undefined' && page==='sales') renderSales(); } catch(e){}
  try { if(typeof renderProducts==='function' && typeof page!=='undefined' && page==='products') renderProducts(); } catch(e){}
  try { if(typeof renderExpenses==='function' && typeof page!=='undefined' && page==='expenses') renderExpenses(); } catch(e){}
  toast('✅ Settings saved and applied!');}
function addNewBiz(){const name=prompt('New business name:');if(!name||!name.trim())return;const b={id:DB.nextBizId++,name:name.trim(),currency:'USD',address:'',phone:'',logoType:'initials',logoData:'',lowStock:5,products:[],sales:[],expenses:[],employees:[],salaryRecords:[],stockHistory:[],purchases:[],stockOuts:[],credits:[],nextProdId:1,nextSaleId:1,nextExpId:1,nextEmpId:1,nextSalId:1,nextHistId:1,nextSoId:1,nextCrId:1};DB.businesses.push(b);const u=DB.users.find(x=>x.id===CU.id);if(u&&!u.businessIds.includes(b.id))u.businessIds.push(b.id);dbSave();toast('"'+b.name+'" created!','gd');closeD('d-bizset');}
function openBizSel(){if(DB.businesses.length<=1&&!isAdmin())return;const myBizs=DB.businesses.filter(b=>(CU.businessIds||[]).includes(b.id));el('bizself').innerHTML=myBizs.map(b=>`<div class="bizcard${b.id===CBI?' on':''}" onclick="switchBiz(${b.id})"><div class="bclogo">${b.logoType==='image'&&b.logoData?`<img src="${b.logoData}">`:mkInit(b.name)}</div><div style="flex:1"><div style="font-weight:700;color:var(--t1);font-size:14px">${esc(b.name)}${b.id===CBI?' ✓':''}</div><div style="font-size:11px;color:var(--t3);margin-top:2px">${(b.products||[]).length} products · ${b.currency||'USD'}</div></div></div>`).join('')+(isAdmin()?'<button type="button" class="btn bok bbl mt8" onclick="closeD(\'d-bizsel\');openBizSettings()">+ Add Business</button>':'');openD('d-bizsel');}
function switchBiz(id){CBI=id;DB.currentBizId=id;const u=DB.users.find(x=>x.id===CU.id);if(u&&!u.businessIds.includes(id))u.businessIds.push(id);dbSave();closeD('d-bizsel');updateTopbar();goTo('dash');toast('Switched to '+biz().name,'gd');}

// ── TEAM ──
function openTeam(){
  try {
    if(!CU){ toast('Please sign in first', 'er'); return; }
    if(CU.role !== 'primaryAdmin' && CU.role !== 'admin'){
      toast('Only admins can manage the team', 'er');
      return;
    }
    // Open drawer first so user sees something even if render fails
    openD('d-team');
    // Then render
    renderTeam();
  } catch(e){
    console.error('[openTeam]', e);
    toast('Team page error: ' + (e.message || 'unknown'), 'er');
    // Still show drawer with error message
    var tb = document.getElementById('teambody');
    if(tb) tb.innerHTML =
      '<div style="padding:30px 20px;text-align:center">' +
        '<div style="font-size:38px;margin-bottom:10px">⚠️</div>' +
        '<div style="font-size:14px;font-weight:700;color:var(--er);margin-bottom:8px">Team page error</div>' +
        '<div style="font-size:12px;color:var(--t3);margin-bottom:14px;line-height:1.5">' + esc(e.message || 'Unknown error') + '</div>' +
        '<button type="button" class="btn bg bsm" onclick="closeD(\'d-team\');setTimeout(openTeam,200)">Retry</button>' +
      '</div>';
  }
}

function renderTeam(){
  if(typeof CBI === 'undefined' || !CBI) {
    var tb0 = document.getElementById('teambody');
    if(tb0) tb0.innerHTML = '<div style="padding:30px;text-align:center;color:var(--t3)">No business selected.</div>';
    return;
  }
  // Defensive: ensure DB shape
  DB.users = DB.users || [];
  DB.notifications = DB.notifications || [];
  DB.inviteCodes = DB.inviteCodes || [];
  const myUsers = DB.users.filter(function(u){
    return u && u.businessIds && u.businessIds.indexOf(CBI) >= 0;
  });
  const pending = myUsers.filter(u => u.status === 'pending');
  const active  = myUsers.filter(u => u.status !== 'pending');
  const codes   = (DB.inviteCodes||[]).filter(c => c.bizId===CBI && !c.used && (c.expiresAt===0 || c.expiresAt>Date.now()));
  const pendingResets = (DB.notifications||[]).filter(n => n.bizId===CBI && n.pendingResetUserId);

  let html = '';

  // ─── PENDING SIGNUPS SECTION ───
  if(pending.length){
    html += `<div style="padding:11px 13px;background:linear-gradient(135deg,rgba(245,158,11,.12),rgba(245,158,11,.04));border-bottom:1px solid rgba(245,158,11,.25)">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
        <span style="font-size:14px">⏳</span>
        <span style="font-size:11px;font-weight:800;color:var(--wa);text-transform:uppercase;letter-spacing:.12em;font-family:var(--fm)">Pending Approvals (${pending.length})</span>
      </div>
      <div style="font-size:11px;color:var(--t3)">These staff want to join your business. Approve or reject below.</div>
    </div>`;
    html += `<div>`;
    pending.forEach(function(u){
      const ago = u.createdAt ? timeAgo(u.createdAt) : '';
      const rejBadge = u.rejectedAt ? `<span class="bdg" style="background:rgba(239,68,68,.15);color:var(--er);font-size:9px;margin-left:6px">retry</span>` : '';
      html += `<div style="padding:13px;border-bottom:1px solid var(--bd);background:var(--s2)">
        <div style="display:flex;align-items:center;gap:11px;margin-bottom:10px">
          <div class="av" style="width:42px;height:42px;font-size:13px;flex-shrink:0;background:linear-gradient(135deg,var(--wa),#d97706)">${mkInit(u.name)}</div>
          <div style="flex:1;min-width:0">
            <div style="font-size:14px;font-weight:700;color:var(--t1)">${esc(u.name)} ${rejBadge}</div>
            <div style="font-size:11px;color:var(--t3);margin-top:2px">@${esc(u.username)} ${ago ? '· requested '+ago : ''}</div>
          </div>
        </div>
        <div style="display:flex;gap:6px">
          <button type="button" class="btn bg bsm" style="flex:1" onclick="approveStaffSignup(${u.id})">✓ Approve</button>
          <button type="button" class="btn ber bsm" style="flex:1" onclick="rejectStaffSignup(${u.id})">✕ Reject</button>
        </div>
      </div>`;
    });
    html += `</div>`;
  }

  // ─── PASSWORD RESET REQUESTS ───
  if(pendingResets.length){
    html += `<div style="padding:11px 13px;background:linear-gradient(135deg,rgba(79,195,247,.1),rgba(79,195,247,.04));border-bottom:1px solid rgba(79,195,247,.25);border-top:1px solid var(--bd)">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
        <span style="font-size:14px">🔑</span>
        <span style="font-size:11px;font-weight:800;color:var(--in);text-transform:uppercase;letter-spacing:.12em;font-family:var(--fm)">Password Reset Requests (${pendingResets.length})</span>
      </div>
    </div>`;
    pendingResets.forEach(function(n){
      const u = (DB.users||[]).find(x => x.id === n.pendingResetUserId);
      if(!u) return;
      html += `<div style="padding:13px;border-bottom:1px solid var(--bd);background:var(--s2)">
        <div style="display:flex;align-items:center;gap:11px;margin-bottom:10px">
          <div class="av" style="width:36px;height:36px;font-size:11px;background:linear-gradient(135deg,var(--in),#0284c7)">${mkInit(u.name)}</div>
          <div style="flex:1;min-width:0">
            <div style="font-size:13px;font-weight:700;color:var(--t1)">${esc(u.name)}</div>
            <div style="font-size:11px;color:var(--t3)">@${esc(u.username)} needs a new password</div>
          </div>
        </div>
        <button type="button" class="btn bg bsm" style="width:100%" onclick="adminResetUserPassword(${u.id})">🔓 Reset Their Password</button>
      </div>`;
    });
  }

  // ─── ACTIVE TEAM SECTION (REDESIGNED) ───
  html += `<div style="padding:14px 14px 11px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--bd);border-top:1px solid var(--bd);background:linear-gradient(135deg,rgba(34,197,94,.04),transparent)">
    <div>
      <div style="font-size:11px;font-weight:800;color:var(--ok);text-transform:uppercase;letter-spacing:.12em;font-family:var(--fm);margin-bottom:2px">Active Team</div>
      <div style="font-size:10px;color:var(--t3)">${active.length} member${active.length!==1?'s':''}</div>
    </div>
    <button type="button" class="btn bg bsm" onclick="closeD('d-team');openAddUser()">+ Add Member</button>
  </div>`;

  html += `<div style="padding:10px 10px 12px">`;
  active.forEach(function(u){
    const isMe = u.id === CU.id;
    const isOwner = u.role === 'primaryAdmin';
    const isAdmin = u.role === 'admin';
    const canPromote = !isMe && !isOwner && !isAdmin && CU.role === 'primaryAdmin';
    const canDemote  = !isMe && !isOwner && isAdmin && CU.role === 'primaryAdmin';
    const canRemove  = !isMe && !isOwner;
    const canResetPw = !isMe && CU.role === 'primaryAdmin';

    // ── INLINE STATS ──
    var userSales = 0, userSalesAmt = 0;
    try {
      var b = biz();
      if (b && b.sales) {
        b.sales.forEach(function(s){
          if (s.createdBy === u.id && s.status !== 'cancelled') {
            userSales++;
            userSalesAmt += sTotal(s);
          }
        });
      }
    } catch(e){}
    var lastLoginText = '';
    if (u.lastLoginAt) {
      lastLoginText = timeAgo(u.lastLoginAt);
    } else if (u.createdAt) {
      lastLoginText = 'joined ' + timeAgo(u.createdAt);
    } else {
      lastLoginText = 'never logged in';
    }

    // ── ROLE BADGE ──
    var roleBadge;
    if (isOwner) {
      roleBadge = '<span style="background:linear-gradient(135deg,rgba(232,160,32,.2),rgba(232,160,32,.08));color:var(--g);border:1px solid rgba(232,160,32,.4);padding:2px 7px;border-radius:99px;font-size:9px;font-weight:800;font-family:var(--fm);letter-spacing:.04em">👑 OWNER</span>';
    } else if (isAdmin) {
      roleBadge = '<span style="background:rgba(232,160,32,.12);color:var(--g);border:1px solid rgba(232,160,32,.25);padding:2px 7px;border-radius:99px;font-size:9px;font-weight:700;font-family:var(--fm);letter-spacing:.04em">⭐ ADMIN</span>';
    } else if (u.role === 'dataOperator') {
      roleBadge = '<span style="background:rgba(79,195,247,.12);color:var(--in);border:1px solid rgba(79,195,247,.25);padding:2px 7px;border-radius:99px;font-size:9px;font-weight:700;font-family:var(--fm);letter-spacing:.04em">📊 STAFF</span>';
    } else {
      roleBadge = '<span style="background:var(--s3);color:var(--t2);border:1px solid var(--bd);padding:2px 7px;border-radius:99px;font-size:9px;font-weight:700;font-family:var(--fm);letter-spacing:.04em">👤 ' + (u.role||'VIEWER').toUpperCase() + '</span>';
    }

    // ── AVATAR COLOR (by role) ──
    var avBg;
    if (isOwner) avBg = 'linear-gradient(135deg,#e8a020,#c07010)';
    else if (isAdmin) avBg = 'linear-gradient(135deg,#22c55e,#15803d)';
    else if (u.role === 'dataOperator') avBg = 'linear-gradient(135deg,#4fc3f7,#1976d2)';
    else avBg = 'linear-gradient(135deg,#64748b,#334155)';

    // ── ACTION BUTTONS ──
    let actionBtns = '';
    if(isMe){
      actionBtns = '<span style="background:rgba(232,160,32,.15);color:var(--g);padding:3px 9px;border-radius:99px;font-size:10px;font-weight:700;font-family:var(--fm);border:1px solid rgba(232,160,32,.25)">YOU</span>';
    } else {
      let btnRow = '';
      if(canPromote) btnRow += `<button type="button" class="btn bg bxs" onclick="promoteToAdmin(${u.id})" title="Promote to Admin" style="padding:5px 8px">⬆ Admin</button>`;
      if(canDemote)  btnRow += `<button type="button" class="btn bgh bxs" onclick="demoteFromAdmin(${u.id})" title="Demote to Staff" style="padding:5px 8px">⬇ Staff</button>`;
      if(canResetPw) btnRow += `<button type="button" class="btn bin bxs" onclick="openAdminPwReset(${u.id})" title="Reset password" style="padding:5px 8px;min-width:32px">🔑</button>`;
      if(isPrimary() && u.role !== 'primaryAdmin') btnRow += `<button type="button" class="btn bg bxs" onclick="openUserPerms(${u.id})" title="Permissions" style="padding:5px 8px">🔐 Perms</button>`;
      if(canRemove)  btnRow += `<button type="button" class="btn ber bxs" onclick="removeUser(${u.id})" title="Remove user" style="padding:5px 8px;min-width:32px">✕</button>`;
      actionBtns = `<div style="display:flex;gap:5px;flex-wrap:wrap;justify-content:flex-end;margin-top:10px;padding-top:10px;border-top:1px solid var(--bd)">${btnRow}</div>`;
    }

    // ── CARD ──
    html += `<div style="background:var(--s2);border:1px solid var(--bd);border-radius:var(--r10);padding:12px;margin-bottom:8px;transition:border-color .15s" onmouseover="this.style.borderColor='var(--bd2)'" onmouseout="this.style.borderColor='var(--bd)'">
      <!-- Top row: avatar + name + role badge -->
      <div style="display:flex;align-items:center;gap:11px">
        <div style="width:42px;height:42px;border-radius:50%;background:${avBg};color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:13px;flex-shrink:0;box-shadow:0 2px 8px rgba(0,0,0,.3)">${mkInit(u.name)}</div>
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:center;gap:7px;flex-wrap:wrap">
            <div style="font-size:13px;font-weight:700;color:var(--t1)">${esc(u.name)}</div>
            ${roleBadge}
          </div>
          <div style="font-family:var(--fm);font-size:10px;color:var(--t3);margin-top:2px">@${esc(u.username)}</div>
        </div>
      </div>
      <!-- Inline stats row -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px;padding-top:10px;border-top:1px solid var(--bd)">
        <div style="background:var(--s1);border-radius:8px;padding:7px 10px">
          <div style="font-size:8px;color:var(--t3);font-family:var(--fm);font-weight:700;letter-spacing:.06em">SALES MADE</div>
          <div style="font-size:14px;font-weight:800;color:var(--ok);font-family:var(--fd);margin-top:1px">${userSales}</div>
          <div style="font-size:9px;color:var(--t3);margin-top:1px">${f$(userSalesAmt)} total</div>
        </div>
        <div style="background:var(--s1);border-radius:8px;padding:7px 10px">
          <div style="font-size:8px;color:var(--t3);font-family:var(--fm);font-weight:700;letter-spacing:.06em">${u.lastLoginAt ? 'LAST SEEN' : 'STATUS'}</div>
          <div style="font-size:12px;font-weight:700;color:var(--t1);margin-top:2px">${lastLoginText}</div>
        </div>
      </div>
      ${actionBtns}
    </div>`;
  });
  html += `</div>`;

  // ─── ACTIVE INVITE CODES ───
  if(codes.length){
    html += `<div style="padding:9px 13px;border-top:1px solid var(--bd)">
      <div class="sh" style="margin-bottom:7px">Active Invite Codes</div>
    </div>`;
    codes.forEach(function(c){
      html += `<div style="padding:9px 13px;display:flex;align-items:center;gap:11px;border-bottom:1px solid var(--bd)">
        <div style="flex:1;min-width:0">
          <div style="font-family:var(--fm);font-size:17px;font-weight:700;color:var(--g);letter-spacing:.2em">${c.code}</div>
          <div style="font-size:11px;color:var(--t3)">${RLBL[c.role]||c.role}</div>
        </div>
        <button type="button" class="btn ber bxs" onclick="revokeCode('${c.code}')">Revoke</button>
      </div>`;
    });
  }

  const tb = document.getElementById('teambody');
  if(tb) tb.innerHTML = html;
}

// Helper: time ago in human format
function timeAgo(ts){
  if(!ts) return '';
  const s = Math.floor((Date.now()-ts)/1000);
  if(s < 60) return 'just now';
  if(s < 3600) return Math.floor(s/60)+'m ago';
  if(s < 86400) return Math.floor(s/3600)+'h ago';
  return Math.floor(s/86400)+'d ago';
}

function openAddUser(){switchUTab('manual');renderPG('manual');renderPG('invite');openD('d-adduser');}
function switchUTab(mode){el('utmanual').style.display=mode==='manual'?'':'none';el('utinvite').style.display=mode==='invite'?'':'none';el('utmc').classList.toggle('on',mode==='manual');el('utic').classList.toggle('on',mode==='invite');el('invres').style.display='none';}
function renderPG(tab){const role=el(tab==='manual'?'umrole':'uirole')?.value;const isAdm=role==='admin';const hint=el(tab==='manual'?'pmhint':'');if(hint)hint.textContent=isAdm?'Admins have full access.':'Select allowed modules.';const gridEl=el(tab==='manual'?'pmgrid':'pigrid');if(!gridEl)return;if(isAdm){gridEl.innerHTML='<div style="font-size:12px;color:var(--ok);font-weight:600">✓ Full access</div>';return;}if(!permSel[tab])permSel[tab]=MODS.slice();gridEl.innerHTML=MODS.map(m=>{const on=(permSel[tab]||[]).includes(m);return`<div class="pitem${on?' on':''}" onclick="togglePerm('${tab}','${m}')"><div class="pcb">${on?'✓':''}</div><div class="plbl">${MLBL[m]}</div></div>`;}).join('');}
function togglePerm(tab,mod){if(!permSel[tab])permSel[tab]=[];const i=permSel[tab].indexOf(mod);if(i>-1)permSel[tab].splice(i,1);else permSel[tab].push(mod);renderPG(tab);}
function saveUser(){const name=gv('umname'),un=gv('umuser'),pw=el('umpass')?.value||'',role=el('umrole')?.value||'dataOperator';if(!name||!un||!pw){toast('Fill all fields','er');return;}if(pw.length<4){toast('Password min 6 chars','er');return;}if(DB.users.find(u=>u.username===un)){toast('Username taken','er');return;}const mods=role==='admin'?MODS:(permSel['manual']||MODS);DB.users.push({id:DB.nextUserId++,username:un,password:pw,name,role,businessIds:[CBI],allowedModules:mods,phone:'',createdAt:Date.now()});addAdminLog('add_user','Added: '+name+' ('+RLBL[role]+')',CU.name);addNotif('user','New member: '+name);dbSave();closeD('d-adduser');openTeam();toast(name+' added!');}
function genInvite(){const role=el('uirole')?.value||'dataOperator',expH=parseInt(el('uiexp')?.value)||0,mods=role==='admin'?MODS:(permSel['invite']||MODS),code=g6();DB.inviteCodes.push({id:DB.nextCodeId++,code,role,mods,bizId:CBI,createdBy:CU.name,createdAt:Date.now(),expiresAt:expH===0?0:Date.now()+expH*3600000,used:false});dbSave();el('invres').style.display='';el('invres').innerHTML=`<div style="background:var(--gd);border:1.5px solid var(--bd2);border-radius:var(--r10);padding:13px;text-align:center"><div style="font-size:10px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.1em;margin-bottom:7px">Share this code</div><div style="font-family:var(--fm);font-size:26px;font-weight:900;color:var(--g);letter-spacing:.3em;margin-bottom:7px">${code}</div><div style="font-size:11px;color:var(--t3)">Role: ${RLBL[role]} · ${expH?'Expires in '+expH+'h':'No expiry'}</div></div>`;toast('Invite code generated!','gd');}
function revokeCode(code){DB.inviteCodes.filter(c=>c.code===code).forEach(c=>c.used=true);dbSave();openTeam();toast('Code revoked');}
function removeUser(userId){const u=DB.users.find(x=>x.id===userId);if(!u)return;showConf('👤','Remove Member?',u.name+' will lose access.',()=>{u.businessIds=u.businessIds.filter(id=>id!==CBI);dbSave();openTeam();toast('Member removed');});}

// ── ACCOUNT ──
function openChangePw(){sv('pwc','');sv('pwn','');sv('pwcf','');openD('d-pw');}
async function saveChangePw(){
  var cur = el('pwc') ? el('pwc').value : '';
  var nw  = el('pwn') ? el('pwn').value : '';
  var cf  = el('pwcf') ? el('pwcf').value : '';
  if(!cur||!nw||!cf){ toast('Fill all fields','er'); return; }
  // Verify current password (works with hashed AND plain-text)
  var curOk = await verifyPassword(cur, CU.password);
  if(!curOk){ toast('Current password is incorrect','er'); return; }
  // New password strength
  if(nw.length < 6){ toast('New password must be at least 6 characters','er'); return; }
  var WEAK_LIST = ['123456','111111','000000','123123','password','654321','112233'];
  if(WEAK_LIST.indexOf(nw) !== -1 || /^(.)+$/.test(nw)){
    toast('New password is too weak','er'); return;
  }
  if(nw !== cf){ toast('Passwords do not match','er'); return; }
  try {
    var hashed = await hashPassword(nw);
    var u = (DB.users||[]).find(function(x){ return x.id === CU.id; });
    if(u) u.password = hashed;
    CU.password = hashed;
    dbSave();
    // Push users immediately to Firebase so other devices get new password
    try{ if(typeof fbPushUsers==='function') fbPushUsers(); }catch(e){}
    // Also do full push to keep everything in sync
    try{ if(typeof fbPush==='function') setTimeout(fbPush, 500); }catch(e){}
    // Update Firebase Auth password
    try {
      if (FB_AUTH && FB_AUTH.currentUser) {
        FB_AUTH.currentUser.updatePassword(nw).then(function(){
          console.log('[Firebase Auth] Password updated in Firebase Auth');
        }).catch(function(err){
          console.warn('[Firebase Auth] Password update error:', err.code);
        });
      }
    } catch(e){}
    sv('pwc',''); sv('pwn',''); sv('pwcf','');
    closeD('d-pw');
    toast('✅ Password updated successfully!','gd');
  } catch(e) {
    toast('Error updating password: ' + e.message,'er');
  }
}
function openUserMenu(){el('umenubody').innerHTML=`<div style="padding:13px 17px;border-bottom:1px solid var(--bd);display:flex;align-items:center;gap:11px"><div class="av" style="width:44px;height:44px;font-size:15px">${mkInit(CU.name)}</div><div><div class="fw7" style="font-size:15px">${esc(CU.name)}</div><div style="font-size:12px;color:var(--t3)">@${esc(CU.username)} · ${rb(CU.role)}</div></div></div><div style="padding:8px 13px"><button type="button" class="btn bgh bbl" style="justify-content:flex-start;gap:11px;margin-bottom:7px" onclick="closeD('d-umenu');openChangePw()">🔑 Change Password</button><button type="button" class="btn ber bbl" style="justify-content:flex-start;gap:11px" onclick="doLogout()">⏏ Sign Out</button></div>`;openD('d-umenu');}

// ── TILE CALCULATOR ──
function initCalc(){if(!el('calcrooms').children.length){calcRooms=[{id:1,name:'Room 1',l:0,w:0,area:0}];renderCalcRooms();}calcTiles();}
function addCalcRoom(){calcRooms.push({id:calcRId++,name:'Room '+calcRooms.length+1,l:0,w:0,area:0});renderCalcRooms();}
function removeCalcRoom(id){if(calcRooms.length<=1){toast('Need at least one room','er');return;}calcRooms=calcRooms.filter(r=>r.id!==id);renderCalcRooms();calcTiles();}
function renderCalcRooms(){const unit=el('tcu')?.value||'sqm',uL=unit==='sqft'?'ft':'m';el('calcrooms').innerHTML=calcRooms.map(r=>`<div class="calcroom"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><span style="font-size:10px;font-weight:700;color:var(--g);text-transform:uppercase;letter-spacing:.08em">${esc(r.name)}</span>${calcRooms.length>1?`<button type="button" onclick="removeCalcRoom(${r.id})" style="color:var(--er);font-size:12px;background:var(--erb);border:none;border-radius:var(--r99);padding:2px 10px;cursor:pointer">Remove</button>`:''}</div><div class="fr2"><div class="fg" style="margin:0"><label class="fl">Length (${uL})</label><input class="fi" type="number" id="cl${r.id}" placeholder="5" value="${r.l||''}" oninput="updateRoom(${r.id})"></div><div class="fg" style="margin:0"><label class="fl">Width (${uL})</label><input class="fi" type="number" id="cw${r.id}" placeholder="4" value="${r.w||''}" oninput="updateRoom(${r.id})"></div></div><div style="margin-top:5px;font-size:12px;color:var(--t3)" id="ca${r.id}">Area: —</div></div>`).join('');}
function updateRoom(id){const l=parseFloat(el(`cl${id}`)?.value)||0,w=parseFloat(el(`cw${id}`)?.value)||0;const r=calcRooms.find(x=>x.id===id);if(r){r.l=l;r.w=w;r.area=l*w;}const unit=el('tcu')?.value||'sqm';const aEl=el(`ca${id}`);if(aEl)aEl.textContent=`Area: ${r&&r.area>0?r.area.toFixed(2):'—'} ${unit==='sqft'?'ft²':'m²'}`;calcTiles();}
function calcTiles(){const tW=parseFloat(el('tcw')?.value)||60,tH=parseFloat(el('tch')?.value)||60,perBox=parseFloat(el('tcb')?.value)||6,unit=el('tcu')?.value||'sqm',waste=parseFloat(el('tcw2')?.value)||10;const tileSqm=(tW/100)*(tH/100);let totalArea=calcRooms.reduce((a,r)=>a+(r.area||0),0);if(unit==='sqft')totalArea*=0.0929;if(totalArea<=0){el('calcres').innerHTML='';return;}const areaW=totalArea*(1+waste/100),numTiles=Math.ceil(areaW/tileSqm),numBoxes=Math.ceil(numTiles/perBox);const roomSum=calcRooms.map(r=>`${esc(r.name)} (${(r.area||0).toFixed(1)}${unit==='sqft'?'ft²':'m²'})`).join(', ');el('calcres').innerHTML=`<div class="calcres"><div style="font-size:10px;font-weight:700;opacity:.75;text-transform:uppercase;letter-spacing:.1em;margin-bottom:9px">Result</div><div class="crgrid"><div class="cri"><div class="crl">Total Area</div><div class="crv">${totalArea.toFixed(2)}m²</div></div><div class="cri"><div class="crl">+${waste}% Waste</div><div class="crv">${areaW.toFixed(2)}m²</div></div><div class="cri"><div class="crl">Tiles Needed</div><div class="crv">${numTiles} pcs</div></div><div class="cri"><div class="crl">Boxes Needed</div><div class="crv">${numBoxes} box</div></div></div><div style="margin-top:11px;font-size:11px;opacity:.7">${tW}×${tH}cm · ${perBox}/box · ${roomSum}</div></div>`;}


// ── DAILY REPORT ──────────────────────────────────────────
function openDailyReport(){
  sv('report-date', today());
  switchRptTab('summary');
  renderDailyReport();
  openD('d-report');
}
function switchRptTab(tab){
  const tabs=['summary','cash','preview'];
  tabs.forEach(t=>{
    const pane=el('rpt-'+t);if(pane)pane.style.display=t===tab?'':'none';
    const chip=el('rpt-tab-'+t);if(chip)chip.classList.toggle('on',t===tab);
  });
  if(tab==='preview')buildPrintPreview();
}
// ── CASH COUNTING ──
function calcCash(){
  // USD row values
  var usdRows=[
    {id:'usd-100',  val:100},
    {id:'usd-50',   val:50},
    {id:'usd-20',   val:20},
    {id:'usd-10',   val:10},
    {id:'usd-5',    val:5},
    {id:'usd-1',    val:1},
    {id:'usd-coins',val:1},
  ];
  var usd=0;
  usdRows.forEach(function(r){
    var inp=document.getElementById(r.id);
    var qty=inp?parseFloat(inp.value)||0:0;
    var rowVal = (r.id === 'usd-coins') ? qty : qty * r.val;
    usd += rowVal;
    var valEl = document.getElementById(r.id+'-val');
    if(valEl) valEl.textContent = rowVal > 0 ? '$' + rowVal.toFixed(2) : '—';
  });

  // LRD row values
  var lrdRows=[
    {id:'lrd-1000', val:1000},
    {id:'lrd-500',  val:500},
    {id:'lrd-100',  val:100},
    {id:'lrd-50',   val:50},
    {id:'lrd-20',   val:20},
    {id:'lrd-10',   val:10},
    {id:'lrd-5',    val:5},
  ];
  var lrd=0;
  lrdRows.forEach(function(r){
    var inp=document.getElementById(r.id);
    var qty=inp?parseFloat(inp.value)||0:0;
    var rowVal=qty*r.val;
    lrd+=rowVal;
    var valEl=document.getElementById(r.id+'-val');
    if(valEl) valEl.textContent=rowVal>0?'L$'+rowVal.toFixed(0):'—';
  });

  var rate=parseFloat(document.getElementById('exch-rate')?document.getElementById('exch-rate').value:195)||195;
  var lrdInUsd=lrd/rate;
  var grand=usd+lrdInUsd;

  // Update totals
  var usdTot=document.getElementById('usd-total');
  var lrdTot=document.getElementById('lrd-total');
  var lrdUsd=document.getElementById('lrd-in-usd');
  var grandEl=document.getElementById('grand-total-usd');
  if(usdTot) usdTot.textContent='$'+usd.toFixed(2);
  if(lrdTot) lrdTot.textContent='L$'+lrd.toFixed(0);
  if(lrdUsd) lrdUsd.textContent='$'+lrdInUsd.toFixed(2);
  if(grandEl) grandEl.textContent='$'+grand.toFixed(2);

  // Reconciliation
  var b=biz();if(!b)return;
  var date=document.getElementById('report-date')?document.getElementById('report-date').value:today();
  var dayS=(b.sales||[]).filter(function(s){return s.date===date&&s.status!=='cancelled';});
  var dayE=(b.expenses||[]).filter(function(e){return e.date===date&&e.status!=='cancelled';});
  var expectedCash=dayS.reduce(function(a,s){return a+(s.paymode==='Cash'?(s.paid||0):0);},0);
  var totalExp=dayE.reduce(function(a,e){return a+(e.amount||0);},0);
  var netExpected=expectedCash-totalExp;
  var diff=grand-netExpected;

  var rcEl=document.getElementById('recon-cash');
  var reEl=document.getElementById('recon-exp');
  var rnEl=document.getElementById('recon-net');
  var rtEl=document.getElementById('recon-total');
  var rdEl=document.getElementById('recon-diff');
  if(rcEl) rcEl.textContent='$'+expectedCash.toFixed(2);
  if(reEl) reEl.textContent='-$'+totalExp.toFixed(2);
  if(rnEl) rnEl.textContent='$'+netExpected.toFixed(2);
  if(rtEl) rtEl.textContent='$'+grand.toFixed(2);
  if(rdEl){
    rdEl.textContent = (diff >= 0 ? '+$' : '-$') + Math.abs(diff).toFixed(2);
    rdEl.style.color = Math.abs(diff) < 0.01 ? 'var(--ok)' : diff > 0 ? 'var(--wa)' : 'var(--er)';
  }
  var rsEl = document.getElementById('recon-status');
  if(rsEl){
    if(Math.abs(diff) < 0.01){
      rsEl.textContent = '✓ BALANCED PERFECTLY';
      rsEl.style.background = 'var(--okb)';
      rsEl.style.color = 'var(--ok)';
      rsEl.style.border = '1px solid var(--okbd)';
    } else if(diff > 0){
      rsEl.textContent = '↑ SURPLUS · $' + diff.toFixed(2) + ' more than expected';
      rsEl.style.background = 'var(--wab)';
      rsEl.style.color = 'var(--wa)';
      rsEl.style.border = '1px solid var(--wabd)';
    } else {
      rsEl.textContent = '↓ SHORTAGE · $' + Math.abs(diff).toFixed(2) + ' less than expected';
      rsEl.style.background = 'var(--erb)';
      rsEl.style.color = 'var(--er)';
      rsEl.style.border = '1px solid var(--erbd)';
    }
  }
}
function resetCashCount(){
  ['usd-100','usd-50','usd-20','usd-10','usd-5','usd-1','usd-coins','lrd-1000','lrd-500','lrd-100','lrd-50','lrd-20','lrd-10','lrd-5'].forEach(id=>{const e=el(id);if(e)e.value=0;});
  calcCash();toast('Cash count reset');
}
function buildPrintPreview(){
  const b=biz();if(!b)return;
  const date=el('report-date')?.value||today();
  const dayS=(b.sales||[]).filter(s=>s.date===date&&s.status!=='cancelled');
  const dayE=(b.expenses||[]).filter(e=>e.date===date&&e.status!=='cancelled');
  const grossSales=dayS.reduce((a,s)=>a+sTotal(s),0);
  const totalPaid=dayS.reduce((a,s)=>a+(s.paid||0),0);
  const totalOwed=dayS.reduce((a,s)=>a+sDue(s),0);
  const totalExp=dayE.reduce((a,e)=>a+(e.amount||0),0);
  const profit=grossSales-totalExp;
  const rate=parseFloat(el('exch-rate')?.value)||195;
  // ── Cash totals — SAME source of truth as calcCash() ──
  const usdRows2=[
    {id:'usd-100',  val:100},
    {id:'usd-50',   val:50},
    {id:'usd-20',   val:20},
    {id:'usd-10',   val:10},
    {id:'usd-5',    val:5},
    {id:'usd-1',    val:1},
    {id:'usd-coins',val:1}
  ];
  const lrdRows2=[
    {id:'lrd-1000', val:1000},
    {id:'lrd-500',  val:500},
    {id:'lrd-100',  val:100},
    {id:'lrd-50',   val:50},
    {id:'lrd-20',   val:20},
    {id:'lrd-10',   val:10},
    {id:'lrd-5',    val:5}
  ];
  let usd=0;
  usdRows2.forEach(function(r){
    const inp=document.getElementById(r.id);
    const qty=inp?parseFloat(inp.value)||0:0;
    usd += (r.id==='usd-coins') ? qty : qty*r.val;
  });
  let lrd=0;
  lrdRows2.forEach(function(r){
    const inp=document.getElementById(r.id);
    const qty=inp?parseFloat(inp.value)||0:0;
    lrd += qty*r.val;
  });
  const lrdUSD=lrd/rate;
  const grandCash=usd+lrdUSD;
  const netExpected=totalPaid-totalExp;
  const diff=grandCash-netExpected;
  const prep=gv('sig-prep'),appr=gv('sig-appr'),notes=gv('rpt-notes');
  const itemMap={};dayS.forEach(s=>s.items.forEach(i=>{if(!itemMap[i.name])itemMap[i.name]={qty:0,total:0,cat:i.category||''};itemMap[i.name].qty+=i.qty;itemMap[i.name].total+=i.qty*i.unitPrice;}));
  const items=Object.entries(itemMap).sort((a,b)=>b[1].total-a[1].total);
  let pv=`<div id="printable-report" style="background:#fff;padding:20px;border:1px solid var(--bd);border-radius:var(--r14);color:#111;font-family:Georgia,serif;">
    <!-- HEADER -->
    <div style="text-align:center;border-bottom:3px solid #D4A520;padding-bottom:12px;margin-bottom:14px">
      <div style="font-family:sans-serif;font-size:24px;font-weight:900;color:#B8900A;letter-spacing:.04em">${esc(b.name)}</div>
      ${b.address?`<div style="font-size:11px;color:#666;margin-top:3px">${esc(b.address)}${b.phone?' · '+esc(b.phone):''}</div>`:''}
      <div style="font-size:13px;font-weight:700;color:#333;margin-top:6px;text-transform:uppercase;letter-spacing:.08em">Daily Cash Report</div>
      <div style="font-size:11px;color:#888;margin-top:3px">Date: ${date} &nbsp;|&nbsp; Generated: ${new Date().toLocaleString()}</div>
    </div>
    <!-- BUSINESS SUMMARY -->
    <div style="margin-bottom:14px">
      <div style="font-family:sans-serif;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#888;border-bottom:1px solid #e0e0e0;padding-bottom:5px;margin-bottom:10px">A. Business Summary</div>
      <table style="width:100%;border-collapse:collapse;font-size:12px;font-family:sans-serif">
        <tr style="background:#f9f5ee"><td style="padding:7px 10px;border:1px solid #e0d5c0;font-weight:700">Gross Sales</td><td style="padding:7px 10px;border:1px solid #e0d5c0;text-align:right;font-weight:900;color:#B8900A">${f$(grossSales)}</td></tr>
        <tr><td style="padding:7px 10px;border:1px solid #e0d5c0">Total Expenses</td><td style="padding:7px 10px;border:1px solid #e0d5c0;text-align:right;color:#dc2626">(${f$(totalExp)})</td></tr>
        <tr style="background:#f9f5ee"><td style="padding:7px 10px;border:1px solid #e0d5c0">Amount Collected (Cash)</td><td style="padding:7px 10px;border:1px solid #e0d5c0;text-align:right;color:#16a34a">${f$(totalPaid)}</td></tr>
        <tr><td style="padding:7px 10px;border:1px solid #e0d5c0">Outstanding Credit</td><td style="padding:7px 10px;border:1px solid #e0d5c0;text-align:right;color:#d97706">${f$(totalOwed)}</td></tr>
        <tr><td style="padding:7px 10px;border:1px solid #e0d5c0">Total Transactions</td><td style="padding:7px 10px;border:1px solid #e0d5c0;text-align:right">${dayS.length} sales, ${dayE.length} expenses</td></tr>
        <tr style="background:${profit>=0?'#dcfce7':'#fee2e2'}"><td style="padding:9px 10px;border:2px solid ${profit>=0?'#16a34a':'#dc2626'};font-size:13px;font-weight:900;font-family:sans-serif">NET PROFIT</td><td style="padding:9px 10px;border:2px solid ${profit>=0?'#16a34a':'#dc2626'};text-align:right;font-size:15px;font-weight:900;color:${profit>=0?'#16a34a':'#dc2626'}">${profit>=0?'+':''}${f$(profit)}</td></tr>
      </table>
    </div>`;
  // SALES LIST
  if(dayS.length){pv+=`<div style="margin-bottom:14px"><div style="font-family:sans-serif;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#888;border-bottom:1px solid #e0e0e0;padding-bottom:5px;margin-bottom:10px">B. Sales Records (${dayS.length})</div>
    <table style="width:100%;border-collapse:collapse;font-size:11px;font-family:sans-serif">
      <thead><tr style="background:#f5f0e6"><th style="padding:6px 8px;border:1px solid #e0d5c0;text-align:left">Invoice</th><th style="padding:6px 8px;border:1px solid #e0d5c0;text-align:left">Customer</th><th style="padding:6px 8px;border:1px solid #e0d5c0;text-align:left">Items</th><th style="padding:6px 8px;border:1px solid #e0d5c0;text-align:right">Total</th><th style="padding:6px 8px;border:1px solid #e0d5c0;text-align:right">Paid</th><th style="padding:6px 8px;border:1px solid #e0d5c0;text-align:center">Status</th></tr></thead>
      <tbody>`;
    dayS.forEach((s,idx)=>{const st=sSt(s);pv+=`<tr style="background:${idx%2?'#fff':'#faf8f4'}"><td style="padding:6px 8px;border:1px solid #e8e0cc;font-family:monospace;font-size:10px">${esc(s.inv||'—')}</td><td style="padding:6px 8px;border:1px solid #e8e0cc">${esc(s.customer||'Walk-in')}${s.contact?'<br><small style="color:#888">'+esc(s.contact)+'</small>':''}</td><td style="padding:6px 8px;border:1px solid #e8e0cc;font-size:10px">${s.items.map(i=>esc(i.name)+' ×'+i.qty).join('<br>')}</td><td style="padding:6px 8px;border:1px solid #e8e0cc;text-align:right;font-weight:700;color:#B8900A">${f$(sTotal(s))}</td><td style="padding:6px 8px;border:1px solid #e8e0cc;text-align:right;color:#16a34a">${f$(s.paid||0)}</td><td style="padding:6px 8px;border:1px solid #e8e0cc;text-align:center"><span style="padding:1px 6px;border-radius:99px;font-size:9px;font-weight:700;background:${st==='PAID'?'#dcfce7':st==='PARTIAL'?'#fef3c7':'#fee2e2'};color:${st==='PAID'?'#166534':st==='PARTIAL'?'#92400e':'#991b1b'}">${st}</span></td></tr>`;});
    pv+=`</tbody><tfoot><tr style="background:#f5f0e6"><td colspan="3" style="padding:7px 8px;border:1px solid #e0d5c0;font-weight:700;font-size:11px">TOTALS</td><td style="padding:7px 8px;border:1px solid #e0d5c0;text-align:right;font-weight:900;color:#B8900A">${f$(grossSales)}</td><td style="padding:7px 8px;border:1px solid #e0d5c0;text-align:right;font-weight:900;color:#16a34a">${f$(totalPaid)}</td><td></td></tr></tfoot></table></div>`;}
  // EXPENSES LIST
  if(dayE.length){pv+=`<div style="margin-bottom:14px"><div style="font-family:sans-serif;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#888;border-bottom:1px solid #e0e0e0;padding-bottom:5px;margin-bottom:10px">C. Expenses (${dayE.length})</div>
    <table style="width:100%;border-collapse:collapse;font-size:11px;font-family:sans-serif">
      <thead><tr style="background:#f5f0e6"><th style="padding:6px 8px;border:1px solid #e0d5c0;text-align:left">Description</th><th style="padding:6px 8px;border:1px solid #e0d5c0;text-align:left">Category</th><th style="padding:6px 8px;border:1px solid #e0d5c0;text-align:left">By</th><th style="padding:6px 8px;border:1px solid #e0d5c0;text-align:right">Amount</th></tr></thead>
      <tbody>`;
    dayE.forEach((e,idx)=>{pv+=`<tr style="background:${idx%2?'#fff':'#faf8f4'}"><td style="padding:6px 8px;border:1px solid #e8e0cc">${esc(e.description)}</td><td style="padding:6px 8px;border:1px solid #e8e0cc">${esc(e.category||'General')}</td><td style="padding:6px 8px;border:1px solid #e8e0cc;color:#888;font-size:10px">${esc(e.by||'—')}</td><td style="padding:6px 8px;border:1px solid #e8e0cc;text-align:right;color:#dc2626;font-weight:700">${f$(e.amount)}</td></tr>`;});
    pv+=`</tbody><tfoot><tr style="background:#fee2e2"><td colspan="3" style="padding:7px 8px;border:1px solid #e0d5c0;font-weight:700">TOTAL EXPENSES</td><td style="padding:7px 8px;border:1px solid #e0d5c0;text-align:right;font-weight:900;color:#dc2626">${f$(totalExp)}</td></tr></tfoot></table></div>`;}
  // PRODUCTS SOLD
  if(items.length){pv+=`<div style="margin-bottom:14px"><div style="font-family:sans-serif;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#888;border-bottom:1px solid #e0e0e0;padding-bottom:5px;margin-bottom:10px">D. Products Sold Summary</div>
    <table style="width:100%;border-collapse:collapse;font-size:11px;font-family:sans-serif"><thead><tr style="background:#f5f0e6"><th style="padding:6px 8px;border:1px solid #e0d5c0;text-align:left">Product</th><th style="padding:6px 8px;border:1px solid #e0d5c0;text-align:center">Qty Sold</th><th style="padding:6px 8px;border:1px solid #e0d5c0;text-align:right">Revenue</th></tr></thead><tbody>`;
    items.forEach(([name,d],idx)=>{pv+=`<tr style="background:${idx%2?'#fff':'#faf8f4'}"><td style="padding:6px 8px;border:1px solid #e8e0cc">${esc(name)}</td><td style="padding:6px 8px;border:1px solid #e8e0cc;text-align:center">${d.qty}</td><td style="padding:6px 8px;border:1px solid #e8e0cc;text-align:right;font-weight:700;color:#B8900A">${f$(d.total)}</td></tr>`;});
    pv+=`</tbody></table></div>`;}
  // CASH COUNT
  if(usd>0||lrd>0){pv+=`<div style="margin-bottom:14px"><div style="font-family:sans-serif;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#888;border-bottom:1px solid #e0e0e0;padding-bottom:5px;margin-bottom:10px">E. Cash Count &amp; Reconciliation</div>
    <table style="width:100%;border-collapse:collapse;font-size:11px;font-family:sans-serif;margin-bottom:10px">
      <thead><tr style="background:#f5f0e6"><th style="padding:6px 8px;border:1px solid #e0d5c0;text-align:left">Currency</th><th style="padding:6px 8px;border:1px solid #e0d5c0;text-align:left">Denominations</th><th style="padding:6px 8px;border:1px solid #e0d5c0;text-align:right">Amount</th></tr></thead>
      <tbody>
        <tr><td style="padding:6px 8px;border:1px solid #e8e0cc;font-weight:700">USD ($)</td><td style="padding:6px 8px;border:1px solid #e8e0cc;font-size:10px;color:#666">100×${el('usd-100')?.value||0}, 50×${el('usd-50')?.value||0}, 20×${el('usd-20')?.value||0}, 10×${el('usd-10')?.value||0}, 5×${el('usd-5')?.value||0}, 1×${el('usd-1')?.value||0}, coins ${f$(parseFloat(el('usd-coins')?.value)||0)}</td><td style="padding:6px 8px;border:1px solid #e8e0cc;text-align:right;font-weight:700">${f$(usd)}</td></tr>
        <tr style="background:#faf8f4"><td style="padding:6px 8px;border:1px solid #e8e0cc;font-weight:700">LRD (L$)</td><td style="padding:6px 8px;border:1px solid #e8e0cc;font-size:10px;color:#666">1000×${el('lrd-1000')?.value||0}, 500×${el('lrd-500')?.value||0}, 100×${el('lrd-100')?.value||0}, 50×${el('lrd-50')?.value||0}, 20×${el('lrd-20')?.value||0}, 10×${el('lrd-10')?.value||0}, 5×${el('lrd-5')?.value||0}</td><td style="padding:6px 8px;border:1px solid #e8e0cc;text-align:right;font-weight:700">L$${fN(lrd)} ≈ ${f$(lrdUSD)}</td></tr>
        <tr style="background:#f5f0e6"><td colspan="2" style="padding:7px 8px;border:1px solid #e0d5c0;font-weight:700">Rate: 1 USD = ${rate} LRD &nbsp;|&nbsp; Grand Total Cash</td><td style="padding:7px 8px;border:1px solid #e0d5c0;text-align:right;font-weight:900;color:#B8900A;font-size:13px">${f$(grandCash)}</td></tr>
      </tbody>
    </table>
    <table style="width:100%;border-collapse:collapse;font-size:12px;font-family:sans-serif">
      <tr><td style="padding:7px 10px;border:1px solid #e0d5c0">💰 Cash from Sales</td><td style="padding:7px 10px;border:1px solid #e0d5c0;text-align:right;font-weight:700;color:#16a34a">${f$(totalPaid)}</td></tr>
      <tr><td style="padding:7px 10px;border:1px solid #e0d5c0">💸 Less: Expenses Paid</td><td style="padding:7px 10px;border:1px solid #e0d5c0;text-align:right;font-weight:700;color:#dc2626">-${f$(totalExp)}</td></tr>
      <tr style="background:#fef9ee"><td style="padding:7px 10px;border:1px solid #e0d5c0;font-weight:800">🎯 Expected in Drawer</td><td style="padding:7px 10px;border:1px solid #e0d5c0;text-align:right;font-weight:800;color:#B8900A">${f$(netExpected)}</td></tr>
      <tr style="background:#f9f5ee"><td style="padding:7px 10px;border:1px solid #e0d5c0">📊 Actual Cash Counted</td><td style="padding:7px 10px;border:1px solid #e0d5c0;text-align:right;font-weight:700">${f$(grandCash)}</td></tr>
      <tr style="background:${Math.abs(diff)<0.01?'#dcfce7':diff>0?'#dcfce7':'#fee2e2'}"><td style="padding:9px 10px;border:2px solid ${Math.abs(diff)<0.01?'#16a34a':diff>0?'#16a34a':'#dc2626'};font-weight:900">${Math.abs(diff)<0.01?'✓ BALANCED':diff>0?'📈 SURPLUS':'⚠️ SHORTAGE'}</td><td style="padding:9px 10px;border:2px solid ${Math.abs(diff)<0.01?'#16a34a':diff>0?'#16a34a':'#dc2626'};text-align:right;font-weight:900;font-size:14px;color:${Math.abs(diff)<0.01?'#166534':diff>0?'#166534':'#991b1b'}">${diff>=0?'+':''}${f$(diff)}</td></tr>
    </table>
  </div>`;}
  // NOTES
  if(notes){pv+=`<div style="margin-bottom:14px;background:#fffbeb;border:1px solid #fcd34d;border-radius:8px;padding:10px 14px;font-family:sans-serif;font-size:12px"><strong>Remarks:</strong> ${esc(notes)}</div>`;}
  // SIGNATURES
  pv+=`<div style="margin-top:20px;padding-top:16px;border-top:2px solid #D4A520">
    <div class="sig-grid">
      <div class="sig-box"><div class="sig-lbl">Prepared By</div><div style="height:36px;border-bottom:1.5px solid #999;margin:8px 0 4px"></div><div class="sig-name">${esc(prep)||'____________________'}</div></div>
      <div class="sig-box"><div class="sig-lbl">Approved By</div><div style="height:36px;border-bottom:1.5px solid #999;margin:8px 0 4px"></div><div class="sig-name">${esc(appr)||'____________________'}</div></div>
    </div>
    <div style="text-align:center;margin-top:12px;font-family:sans-serif;font-size:10px;color:#aaa">SmartStock Pro &bull; ${esc(b.name)} &bull; ${new Date().toLocaleString()}</div>
  </div></div>`;
  const prevEl=el('print-preview-body');if(prevEl)prevEl.innerHTML=pv;
}
function printReport(){
  // Build latest preview
  buildPrintPreview();

  var previewEl = document.getElementById('rpt-preview');
  if(!previewEl){ alert('No report to print. Tap Generate first.'); return; }

  var content = previewEl.innerHTML;
  if(!content || content.trim().length < 50){
    alert('No report content. Tap Generate first.'); return;
  }

  // Create a full-page print overlay that covers the app
  var overlay = document.createElement('div');
  overlay.id = 'print-overlay';
  overlay.style.cssText = [
    'position:fixed','inset:0','z-index:99999',
    'background:#fff','overflow:auto',
    'font-family:Georgia,serif','color:#111',
    'padding:20px'
  ].join(';');
  overlay.innerHTML =
    '<div style="max-width:900px;margin:0 auto">' +
      '<div class="no-print" style="position:sticky;top:0;background:#fff;border-bottom:1px solid #e5e7eb;padding:10px 0;margin-bottom:16px;display:flex;gap:10px;z-index:1">' +
        '<button onclick="window.print()" style="padding:10px 24px;background:linear-gradient(135deg,#D4A520,#A07810);color:#060810;border:none;border-radius:10px;font-size:15px;font-weight:800;cursor:pointer">🖨 Print</button>' +
        '<button onclick="document.getElementById(\'print-overlay\').remove()" style="padding:10px 20px;background:#f3f4f6;color:#374151;border:1px solid #e5e7eb;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer">✕ Close</button>' +
      '</div>' +
      content +
    '</div>';

  document.body.appendChild(overlay);

  // Add print CSS to hide everything except the overlay
  var printStyle = document.createElement('style');
  printStyle.id = 'print-style-override';
  printStyle.textContent =
    '@media print{' +
      'body > *:not(#print-overlay){ display:none !important; }' +
      '#print-overlay .no-print{ display:none !important; }' +
      '#print-overlay{ position:static !important; overflow:visible !important; padding:0 !important; }' +
      '@page{ margin:10mm; size:A4; }' +
    '}';
  document.head.appendChild(printStyle);

  // Auto-print
  setTimeout(function(){
    window.print();
  }, 300);
}
function renderDailyReport(){
  var b=biz();if(!b)return;
  var dateEl=document.getElementById('report-date');
  var date=dateEl?dateEl.value:today();
  if(document.getElementById('report-date-sub'))
    document.getElementById('report-date-sub').textContent='Report for: '+date;

  var dayS=(b.sales||[]).filter(function(s){return s.date===date&&s.status!=='cancelled';});
  var dayE=(b.expenses||[]).filter(function(e){return e.date===date&&e.status!=='cancelled';});
  var grossSales=dayS.reduce(function(a,s){return a+sTotal(s);},0);
  var totalPaid =dayS.reduce(function(a,s){return a+(s.paid||0);},0);
  var totalOwed =dayS.reduce(function(a,s){return a+sDue(s);},0);
  var actualExp =dayE.reduce(function(a,e){return a+(e.amount||0);},0);
  // ── Include daily allocations (if enabled) ──
  var allocEnabled = (b.allocationsEnabled !== false);
  var allocExp = 0;
  var allocBreakdown = null;
  if (allocEnabled && typeof getDayAllocations === 'function') {
    allocBreakdown = getDayAllocations(date);
    allocExp = (allocBreakdown && allocBreakdown.total) || 0;
  }
  var totalExp  = actualExp + allocExp;
  var profit    = grossSales - totalExp;
  var margin    = grossSales>0?Math.round((profit/grossSales)*100):0;

  // Build products sold summary
  var prodMap={};
  dayS.forEach(function(s){
    (s.items||[]).forEach(function(i){
      if(!prodMap[i.name]) prodMap[i.name]={name:i.name,qty:0,revenue:0};
      prodMap[i.name].qty+=i.qty;
      prodMap[i.name].revenue+=i.qty*i.unitPrice;
    });
  });
  var prodSold=Object.values(prodMap).sort(function(a2,b2){return b2.revenue-a2.revenue;});

  var rb=document.getElementById('report-body');if(!rb)return;

  var salesRows='<tr><td colspan="5" style="padding:10px;text-align:center;color:#9ca3af;font-size:12px">No sales for this date.</td></tr>';
  if(dayS.length){
    salesRows=dayS.map(function(s){
      var st2=sSt(s);
      var stC=st2==='PAID'?'#16a34a':st2==='PARTIAL'?'#d97706':'#dc2626';
      return '<tr>'+
        '<td style="padding:7px 10px;font-family:monospace;font-size:11px;color:#111">'+esc(s.inv||'—')+'</td>'+
        '<td style="padding:7px 10px;font-size:12px;color:#111">'+esc(s.customer||'Walk-in')+'</td>'+
        '<td style="padding:7px 10px;font-size:11px;color:#555">'+
          (s.items||[]).map(function(i){return esc(i.name)+' \u00d7'+i.qty;}).join(', ')+'</td>'+
        '<td style="padding:7px 10px;text-align:right;font-weight:700;color:#111">'+f$(sTotal(s))+'</td>'+
        '<td style="padding:7px 10px;text-align:center">'+
          '<span style="display:inline-block;padding:2px 8px;border-radius:99px;font-size:10px;font-weight:700;background:'+stC+';color:#fff">'+st2+'</span>'+
        '</td>'+
      '</tr>';
    }).join('');
  }

  var expRows='<tr><td colspan="4" style="padding:10px;text-align:center;color:#9ca3af;font-size:12px">No expenses for this date.</td></tr>';
  if(dayE.length || (allocBreakdown && allocBreakdown.breakdown.length)){
    var rowsArr = [];
    dayE.forEach(function(e){
      rowsArr.push('<tr>'+
        '<td style="padding:7px 10px;font-size:12px;color:#111">'+esc(e.description)+'</td>'+
        '<td style="padding:7px 10px;font-size:12px;color:#555">'+esc(e.category||'General')+'</td>'+
        '<td style="padding:7px 10px;font-size:12px;color:#555">'+esc(e.by||'')+'</td>'+
        '<td style="padding:7px 10px;text-align:right;font-weight:700;color:#dc2626">'+f$(e.amount)+'</td>'+
      '</tr>');
    });
    // Add allocation rows (yellow background to distinguish)
    if (allocBreakdown && allocBreakdown.breakdown && allocBreakdown.breakdown.length) {
      allocBreakdown.breakdown.forEach(function(a){
        var label = a.type === 'doc' ? '📋 ' + a.name : '👤 ' + a.name + ' (salary)';
        var cat = a.type === 'doc' ? 'Documentation' : 'Salary';
        rowsArr.push('<tr style="background:#fff8e1">'+
          '<td style="padding:7px 10px;font-size:12px;color:#111;font-style:italic">'+esc(label)+'</td>'+
          '<td style="padding:7px 10px;font-size:12px;color:#555">'+cat+' (allocated)</td>'+
          '<td style="padding:7px 10px;font-size:11px;color:#777">auto</td>'+
          '<td style="padding:7px 10px;text-align:right;font-weight:700;color:#d97706">'+f$(a.amount)+'</td>'+
        '</tr>');
      });
    }
    expRows = rowsArr.join('');
  } else {
    expRows=dayE.map(function(e){
      return '<tr>'+
        '<td style="padding:7px 10px;font-size:12px;color:#111">'+esc(e.description)+'</td>'+
        '<td style="padding:7px 10px;font-size:12px;color:#555">'+esc(e.category||'General')+'</td>'+
        '<td style="padding:7px 10px;font-size:12px;color:#555">'+esc(e.by||'')+'</td>'+
        '<td style="padding:7px 10px;text-align:right;font-weight:700;color:#dc2626">'+f$(e.amount)+'</td>'+
      '</tr>';
    }).join('');
  }

  var prodRows='';
  if(prodSold.length){
    prodRows=prodSold.map(function(p,idx){
      return '<tr>'+
        '<td style="padding:7px 10px;font-size:12px;color:#555;text-align:center">'+(idx+1)+'</td>'+
        '<td style="padding:7px 10px;font-size:12px;color:#111">'+esc(p.name)+'</td>'+
        '<td style="padding:7px 10px;text-align:center;font-weight:700;color:#111">'+p.qty+'</td>'+
        '<td style="padding:7px 10px;text-align:right;font-weight:700;color:#D4A520">'+f$(p.revenue)+'</td>'+
      '</tr>';
    }).join('');
  }

  // Build the full report HTML (same styles for screen AND print)
  var reportHtml=
    '<div id="printable-report" style="font-family:Georgia,serif;padding:20px;color:#111;max-width:900px;margin:0 auto">'+

      // Title bar
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;padding-bottom:16px;border-bottom:3px solid #D4A520">'+
        '<div>'+
          '<div style="font-size:22px;font-weight:900;color:#111">Daily Business Report</div>'+
          '<div style="font-size:13px;color:#6b7280;margin-top:4px">'+esc(b.name)+' &bull; '+date+' &bull; Generated '+new Date().toLocaleTimeString()+'</div>'+
        '</div>'+
        (b.logoType==='image'&&b.logoData
          ? '<img src="'+b.logoData+'" style="height:50px;width:50px;object-fit:cover;border-radius:10px">'
          : '<div style="width:50px;height:50px;border-radius:10px;background:linear-gradient(135deg,#D4A520,#A07810);display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:900;color:#fff">'+mkInit(b.name)+'</div>')+
      '</div>'+

      // KPI cards (3 per row)
      '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px">'+
        kpiBox('Gross Sales',    f$(grossSales), '#16a34a')+
        kpiBox('Total Expenses', f$(totalExp),   '#dc2626')+
        kpiBox('Net Profit',     (profit>=0?'+':'')+f$(profit), profit>=0?'#16a34a':'#dc2626')+
        kpiBox('Cash Collected', f$(totalPaid),  '#2563eb')+
        kpiBox('Credit Owed',    f$(totalOwed),  '#d97706')+
        kpiBox('Profit Margin',  margin+'%',     margin>=50?'#16a34a':margin>=25?'#d97706':'#dc2626')+
      '</div>'+

      // Profit summary bar
      '<div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:14px 18px;margin-bottom:20px;display:flex;justify-content:space-between;align-items:center">'+
        '<div>'+
          '<div style="font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.1em;margin-bottom:4px">Net Profit = Gross Sales \u2212 Expenses</div>'+
          '<div style="font-size:13px;color:#555">'+f$(grossSales)+' \u2212 '+f$(totalExp)+' = <b style="color:'+(profit>=0?'#16a34a':'#dc2626')+'">'+f$(profit)+'</b></div>'+
        '</div>'+
        '<div style="text-align:right">'+
          '<div style="font-size:28px;font-weight:900;color:'+(profit>=0?'#16a34a':'#dc2626')+'">'+(profit>=0?'+':'')+f$(profit)+'</div>'+
          '<div style="font-size:11px;color:#6b7280">'+margin+'% margin</div>'+
        '</div>'+
      '</div>'+

      // Sales table
      rptSection('Sales ('+dayS.length+' transactions)',
        '<table style="width:100%;border-collapse:collapse">'+
          '<thead><tr style="background:#f3f4f6">'+
            '<th style="padding:8px 10px;text-align:left;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.08em;border-bottom:1px solid #e5e7eb">Invoice</th>'+
            '<th style="padding:8px 10px;text-align:left;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.08em;border-bottom:1px solid #e5e7eb">Customer</th>'+
            '<th style="padding:8px 10px;text-align:left;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.08em;border-bottom:1px solid #e5e7eb">Items</th>'+
            '<th style="padding:8px 10px;text-align:right;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.08em;border-bottom:1px solid #e5e7eb">Total</th>'+
            '<th style="padding:8px 10px;text-align:center;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.08em;border-bottom:1px solid #e5e7eb">Status</th>'+
          '</tr></thead>'+
          '<tbody>'+salesRows+'</tbody>'+
          '<tfoot><tr style="background:#fef9ee;border-top:2px solid #D4A520">'+
            '<td colspan="3" style="padding:8px 10px;font-size:11px;font-weight:700;color:#6b7280">TOTALS ('+dayS.length+' transactions)</td>'+
            '<td style="padding:8px 10px;text-align:right;font-size:14px;font-weight:900;color:#D4A520">'+f$(grossSales)+'</td>'+
            '<td></td>'+
          '</tr></tfoot>'+
        '</table>')+

      // Expenses table
      rptSection('Expenses ('+dayE.length+')',
        '<table style="width:100%;border-collapse:collapse">'+
          '<thead><tr style="background:#f3f4f6">'+
            '<th style="padding:8px 10px;text-align:left;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.08em;border-bottom:1px solid #e5e7eb">Description</th>'+
            '<th style="padding:8px 10px;text-align:left;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.08em;border-bottom:1px solid #e5e7eb">Category</th>'+
            '<th style="padding:8px 10px;text-align:left;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.08em;border-bottom:1px solid #e5e7eb">By</th>'+
            '<th style="padding:8px 10px;text-align:right;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.08em;border-bottom:1px solid #e5e7eb">Amount</th>'+
          '</tr></thead>'+
          '<tbody>'+expRows+'</tbody>'+
          '<tfoot><tr style="background:#fff5f5;border-top:2px solid #dc2626">'+
            '<td colspan="3" style="padding:8px 10px;font-size:11px;font-weight:700;color:#6b7280">TOTAL EXPENSES</td>'+
            '<td style="padding:8px 10px;text-align:right;font-size:14px;font-weight:900;color:#dc2626">-'+f$(totalExp)+'</td>'+
          '</tr></tfoot>'+
        '</table>')+

      // Products sold
      (prodSold.length?
        rptSection('Products Sold',
          '<table style="width:100%;border-collapse:collapse">'+
            '<thead><tr style="background:#f3f4f6">'+
              '<th style="padding:8px 10px;text-align:center;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.08em;border-bottom:1px solid #e5e7eb">#</th>'+
              '<th style="padding:8px 10px;text-align:left;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.08em;border-bottom:1px solid #e5e7eb">Product</th>'+
              '<th style="padding:8px 10px;text-align:center;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.08em;border-bottom:1px solid #e5e7eb">Qty</th>'+
              '<th style="padding:8px 10px;text-align:right;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.08em;border-bottom:1px solid #e5e7eb">Revenue</th>'+
            '</tr></thead>'+
            '<tbody>'+prodRows+'</tbody>'+
          '</table>'):'')+

      // Signature section
      '<div style="margin-top:28px;padding-top:16px;border-top:1px solid #e5e7eb">'+
        '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:30px;margin-top:16px">'+
          sigBox('Prepared by')+
          sigBox('Verified by')+
          sigBox('Approved by')+
        '</div>'+
      '</div>'+

    '</div>';

  rb.innerHTML = reportHtml;
  // Store for print
  window._lastReportHtml = reportHtml;
  window._lastReportDate = date;
  window._lastReportBiz  = b;
}

function kpiBox(label, value, color){
  return '<div style="background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:14px 16px;border-left:4px solid '+color+'">'+
    '<div style="font-size:10px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.1em;margin-bottom:6px">'+label+'</div>'+
    '<div style="font-size:22px;font-weight:900;color:'+color+'">'+value+'</div>'+
  '</div>';
}

function rptSection(title, content){
  return '<div style="margin-bottom:20px">'+
    '<div style="font-size:14px;font-weight:800;color:#111;text-transform:uppercase;letter-spacing:.05em;margin-bottom:10px;padding-bottom:6px;border-bottom:2px solid #e5e7eb">'+title+'</div>'+
    '<div style="background:#fff;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">'+content+'</div>'+
  '</div>';
}

function sigBox(label){
  return '<div>'+
    '<div style="border-top:1.5px solid #d1d5db;margin-bottom:6px;margin-top:40px"></div>'+
    '<div style="font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.08em">'+label+'</div>'+
  '</div>';
}

function printDailyReport(){
  var html = window._lastReportHtml;
  if(!html){ renderDailyReport(); html=window._lastReportHtml; }
  if(!html) return;
  var win=window.open('','_blank','width=900,height=700,toolbar=no,menubar=no,scrollbars=yes');
  if(!win){ alert('Please allow popups to print'); return; }
  win.document.write(
    '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Daily Report</title>'+
    '<style>'+
      'body{margin:0;padding:20px;background:#fff;font-family:Georgia,serif}'+
      '@media print{'+
        'body{padding:0}'+
        '@page{margin:12mm;size:A4}'+
        '.no-print{display:none}'+
      '}'+
      'table{border-collapse:collapse;width:100%}'+
      'tr:nth-child(even){background:#f9fafb}'+
    '</style>'+
    '</head><body>'+html+'</bo'+'dy></ht'+'ml>'
  );
  win.document.close();
  setTimeout(function(){ win.focus(); win.print(); }, 600);
}

function renderWeekChart(){
  const b=biz();if(!b)return;
  const days=[];
  for(var i=6;i>=0;i--){var d=new Date();d.setDate(d.getDate()-i);days.push(d.toISOString().split('T')[0]);}
  var vals=days.map(function(d){return(b.sales||[]).filter(function(s){return s.date===d&&s.status!=='cancelled';}).reduce(function(a,s){return a+sTotal(s);},0);});
  var maxVal=Math.max.apply(null,vals.concat([1]));
  var todayStr=today();
  var weekTotal=vals.reduce(function(a,v){return a+v;},0);
  if(el('weekly-total'))el('weekly-total').textContent=f$(weekTotal);
  var wrap=el('week-chart');if(!wrap)return;
  var dayNames=['Su','Mo','Tu','We','Th','Fr','Sa'];
  wrap.innerHTML=days.map(function(d,i){
    var pct=Math.max((vals[i]/maxVal)*100,3);
    var isNow=d===todayStr;
    var dn=dayNames[new Date(d+'T12:00:00').getDay()];
    var amtLabel=vals[i]>0?f$(vals[i]):'';
    return '<div class="week-bar-col">'+
      '<div class="week-bar-fill '+(isNow?'today':'past')+'" style="height:'+pct+'%" title="'+f$(vals[i])+'">'+
        (isNow&&vals[i]>0?'<div style="position:absolute;bottom:calc(100%+3px);left:50%;transform:translateX(-50%);font-size:8px;font-family:var(--fm);font-weight:700;color:var(--g);white-space:nowrap">'+f$(vals[i])+'</div>':'')+'</div>'+
      '<div class="week-bar-lbl" style="color:'+(isNow?'var(--g)':'var(--t3)')+';font-weight:'+(isNow?'800':'500')+'">'+dn+'</div>'+
    '</div>';
  }).join('');
}