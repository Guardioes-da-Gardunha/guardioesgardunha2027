const {chromium}=require('playwright');(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1200,height:900},deviceScaleFactor:1});
await p.goto('file://'+process.cwd()+'/teatro-frontal.svg');await p.screenshot({path:'teatro-frontal.png'});await b.close()})()
