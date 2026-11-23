const {chromium}=require('playwright');(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:420,height:860},deviceScaleFactor:2});
await p.setContent('<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1"></head><body>'+require('fs').readFileSync(process.argv[2],'utf8')+'</body></html>');
await p.waitForTimeout(400);await p.screenshot({path:'/tmp/f1.png'});
await p.click('#fBtn');await p.waitForTimeout(800);await p.screenshot({path:'/tmp/f2.png'});await b.close()})()
