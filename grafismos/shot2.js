const {chromium}=require('playwright');(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1200,height:900}});
await p.goto('file://'+process.cwd()+'/comp.html');await p.waitForTimeout(300);await p.screenshot({path:'teatro-v2.png'});await b.close()})()
