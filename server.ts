import {scheduledCheck} from './src/server/notificationSchedule';
import express from 'express';
import fs from 'node:fs/promises';
import {injectListingPreview} from './src/server/linkPreview';
import {startPhotonWorker} from './src/server/photonWorker';
import path from 'path';
import 'dotenv/config';
import { apiRouter } from './src/server/routes';
import {runGroupMatchingAndDelivery} from './src/server/deliveryService';
import { getDb, getAllListings } from './src/server/db';



const app = express();
const port = Number(process.env.PORT || 3000);

app.use(express.json({ limit: "64kb" }));
app.use(express.urlencoded({ extended: true }));

// Initialize database
if (process.env.DEMO_MODE !== 'true') {
  startPhotonWorker(await getDb());

  if (process.env.FAIRROOM_LOCAL_IMESSAGE_ENABLED === 'true') {
    const {startLocalBridge}=await import('./local-bridge/bridge');
    await startLocalBridge(await getDb());
  }
}

// Mount API routes
app.use('/api', apiRouter);
app.use('/api', (_req, res) => res.status(404).json({error: 'API endpoint not found'}));
app.use((err: any, _req: any, res: any, _next: any) => { console.error(err.message); res.status(err.status || 500).json({error: err.status === 400 ? 'Invalid request' : 'Request failed. Please try again.'}); });

// Set up Vite or static serving
const isProduction = process.env.NODE_ENV === 'production';

function listingPreviewRoute(transform?:(url:string,html:string)=>Promise<string>){
  app.get('/listing/:id',async(req,res,next)=>{try{
    const listing=getAllListings(await getDb()).find(l=>l.id===req.params.id);
    if(!listing)return res.status(404).send('Home not found');
    let html=await fs.readFile(path.resolve(isProduction?'dist/index.html':'index.html'),'utf8');
    html=injectListingPreview(html,listing,process.env.PUBLIC_APP_URL||`http://localhost:${port}`);
    if(transform)html=await transform(req.originalUrl,html);
    res.set('Cache-Control','no-cache').type('html').send(html);
  }catch(error){next(error);}});
}

if (!isProduction) {
  const { createServer: createViteServer } = await import('vite');
  const vite = await createViteServer({
    server: {
      middlewareMode: true,
      hmr: process.env.DISABLE_HMR === 'true' ? false : {port: port + 1},
      port: 3000,
      host: process.env.HOST || '127.0.0.1'
    },
    appType: 'spa'
  });
  listingPreviewRoute((url,html)=>vite.transformIndexHtml(url,html));
  app.use(vite.middlewares);
} else {
  const distPath = path.resolve(process.cwd(), 'dist');
  listingPreviewRoute();
  app.use(express.static(distPath));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

app.listen(port, process.env.HOST || '127.0.0.1', () => {
  console.log(`FairRoom scout server running on http://localhost:${port}`);
});

if (process.env.DEMO_MODE !== 'true' && process.env.SCOUT_SCHEDULER_ENABLED === 'true') {
  let busy=false;
  const tick=async()=>{if(busy)return;busy=true;try{const db=await getDb();await scheduledCheck(db);}catch(e){console.error('Scheduled catalog check failed');}finally{busy=false;}};
  void tick();setInterval(tick,60000).unref();
}
