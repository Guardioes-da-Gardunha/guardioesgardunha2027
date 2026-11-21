const {chromium}=require('playwright');(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1200,height:900},deviceScaleFactor:1});
await p.goto('file://'+process.cwd()+'/alpedrinha-teatro.svg');await p.screenshot({path:'alpedrinha-teatro.png'});await b.close()})()
